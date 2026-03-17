/**
 * kitchen-builder.js
 * JSCAD-style kitchen module builders using Three.js.
 *
 * Coordinate mapping (SCAD → Three.js):
 *   THREE.X  =  SCAD.X  (width, left→right)
 *   THREE.Y  =  SCAD.Z  (height, bottom→top)
 *   THREE.Z  = -SCAD.Y  (depth, wall→viewer)
 *
 * All measurements in cm (UI units).
 * Material constants: M1=1.8, M=1.6, MDF=1.8, HDF=0.3, RPL=3.8
 */

import * as THREE from 'three';
import { geom3ToThreeGeometry } from './jscadUtils.js';

import { M, M1, MDF, HDF, RPL } from './modules-config.js';
import { createMaterial } from './materials.js';

const { primitives, transforms, booleans, extrusions, geometries } = window.jscadModeling;
const { cuboid, cylinder, polygon } = primitives;
const { translate, rotateX, rotateY, rotateZ } = transforms;
const { union } = booleans;
const { extrudeLinear } = extrusions;

// ─── JSCAD Web Worker ─────────────────────────────────────────────────────────
// Offloads cylinder/polygon JSCAD union() + triangulation to a background thread.
// The worker is used for async pre-population of _geomCache.threeGeos entries.
//
// Architecture:
//   1. First call for a unique shape → synchronous build (boxes fast, JSCAD slow)
//   2. Cache entry is stored immediately after sync build
//   3. Worker also receives the same JSCAD specs and computes in background
//   4. On worker completion, cache entry's threeGeos are replaced with worker-built
//      BufferGeometries (identical result but frees main thread for future builds)
//   5. Subsequent calls for same shape → instant cache hit, no JSCAD at all
//
// Note: since the geometry cache already means each unique shape is computed only
// once, the main benefit of the worker is for scenes that have many *different*
// module shapes — the worker overlaps computation of the next shape while the
// main thread is idle.

let _worker = null;
let _workerReady = false;
let _pendingWorkerCbs = new Map(); // id → callback
let _workerIdCounter = 0;

function _getWorker() {
  if (_worker) return _worker;
  try {
    _worker = new Worker(new URL('./jscad.worker.js', import.meta.url), { type: 'classic' });
    _worker.onmessage = (e) => {
      const { id, results, error } = e.data;
      const cb = _pendingWorkerCbs.get(id);
      if (cb) { _pendingWorkerCbs.delete(id); cb(results, error); }
    };
    _worker.onerror = (e) => {
      console.warn('JSCAD worker error:', e);
      // On worker failure, fall back to sync path permanently
      _worker = null;
    };
    _workerReady = true;
  } catch (e) {
    console.warn('JSCAD worker unavailable, using sync path:', e.message);
    _worker = null;
  }
  return _worker;
}

/**
 * Dispatch groups of JSCAD specs to the worker for async computation.
 * groups: Array<{ matKey, specs: GeomSpec[] }>
 * Returns a Promise that resolves with Array<{ matKey, bufferGeo }>
 */
function _dispatchToWorker(groups) {
  const worker = _getWorker();
  if (!worker) return null; // worker unavailable
  return new Promise((resolve) => {
    const id = ++_workerIdCounter;
    _pendingWorkerCbs.set(id, (results, error) => {
      if (error || !results) { resolve(null); return; }
      const geos = results.map(r => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(r.positions, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(r.normals, 3));
        return { matKey: r.matKey, bufferGeo: geo };
      });
      resolve(geos);
    });
    worker.postMessage({ id, groups });
  });
}

// ─── Global material cache ────────────────────────────────────────────────────
// Keyed by the serialized material definition so identical materials are reused
// across all buildKitchenModule calls instead of being recreated each time.
const _matCache = new Map();

function _getCachedMat(matDef) {
  if (!matDef) return null;
  const key = typeof matDef === 'string' ? matDef : JSON.stringify(matDef);
  if (_matCache.has(key)) return _matCache.get(key);
  const mat = createMaterial(matDef);
  _matCache.set(key, mat);
  return mat;
}

/** Call this when materials change globally (e.g. user picks a new material).
 *  Does NOT dispose — existing scene meshes may still reference these materials.
 *  Three.js will GC them once no mesh holds a reference.
 *  Geometry cache is NOT cleared here — shapes don't change when materials change. */
export function clearMaterialCache() {
  _matCache.clear();
}

/** Call this when settings change (front_vrata, polica, etc.) or the app resets,
 *  as settings affect which geometry is generated. */
export function clearGeomCache() {
  _geomCache.clear();
}

// ─── Geometry instance cache ──────────────────────────────────────────────────
// Caches the raw builder output (boxes[] + JSCAD geom lists) keyed by
// "moduleName|serializedParams|serializedSettings".
// Boxes are plain JS objects — cheap to clone per instance.
// JSCAD geom objects are immutable after creation — safe to share across instances.
// Three.js BufferGeometry objects from the slow path are also cached and cloned.
//
// Cache is cleared when:
//   - Settings change (clearGeomCache called from initToggles)
//   - Project is loaded/restored (clearGeomCache called)
//   - Any module param changes → new cache key, automatic miss
const _geomCache = new Map();
const _GEOM_CACHE_MAX = 200; // evict oldest when over limit

function _geomCacheKey(name, p, settings) {
  return name + '|' + JSON.stringify(p) + '|' + JSON.stringify(settings);
}

/** Evict oldest entry when cache is full. */
function _geomCacheSet(key, val) {
  if (_geomCache.size >= _GEOM_CACHE_MAX) {
    _geomCache.delete(_geomCache.keys().next().value);
  }
  _geomCache.set(key, val);
}

// ─── addBox — stores box data for direct THREE.BoxGeometry creation ───────────
// Each entry: { cx, cy, cz, sx, sy, sz, matKey }
// No JSCAD cuboid is created here — boxes bypass union() entirely.
function addBox(group, sx, sy, sz, tx, ty, tz, matKey) {
  if (sx <= 0 || Math.abs(sy) <= 0 || sz <= 0) return;
  const cx = tx + sx / 2;
  const cy = tz + sz / 2;
  const cz = -(ty + sy / 2);
  if (!group.boxes) group.boxes = [];
  group.boxes.push({ cx, cy, cz, sx, sy: Math.abs(sy), sz, matKey });
}

// ─── Corpus box (shared logic for base cabinets) ──────────────────────────────
// SCAD: back rail at translate([m1, d-70, v-m1]), front rail at translate([m1, 0, v-m1])
// frontRailZ override: gola modules use v-6 (v-60mm), regular use v-M1
function buildCorpus(group, s, v, d, c, mKorpus, settings, frontRailZ) {
  const frz = frontRailZ !== undefined ? frontRailZ : (v - M1);
  // Left side
  addBox(group, M1, d, v - c, 0, -d, c, mKorpus);
  // Right side
  addBox(group, M1, d, v - c, s - M1, -d, c, mKorpus);
  // Bottom
  addBox(group, s - 2 * M1, d, M1, M1, -d, c, mKorpus);
  // Top back cross rail — SCAD: translate([m1, d-70, v-m1])
  addBox(group, s - 2 * M1, 7, M1, M1, -7, v - M1, mKorpus);
  // Top front cross rail — SCAD: translate([m1, 0, v-m1]) or translate([m1, 0, v-60]) for gola
  addBox(group, s - 2 * M1, 7, M1, M1, -d, frz, mKorpus);
  // Back panel (HDF)
  if (settings.pozadina) {
    addBox(group, s, HDF, v - c, 0, 0, c, mKorpus);
  }
}




function buildShelves(group, s, v, d, c, brp, mKorpus, settings) {
  if (!settings.polica || brp <= 0) return;
  const spacing = (v - c - M1) / (brp + 1);
  for (let i = 1; i <= brp; i++) {
    addBox(group, s - 2 * M1, d - 5, M1, M1, -d + 5, c + i * spacing, mKorpus);
  }
}



// ─── Geom spec recording ──────────────────────────────────────────────────────
// Each slow-path helper records serializable specs alongside JSCAD geoms so the
// worker can reproduce the same geometry without receiving JSCAD objects.
function _addSpec(group, matKey, spec) {
  if (!group.geomSpecs) group.geomSpecs = [];
  group.geomSpecs.push({ matKey, spec });
}

// ─── cevasta_rucka_horizontala ─────────────────────────────────────────────────
// Horizontal handle: two posts protrude outward (+Z from door), bar runs along X
// Arguments mapped to Three.js space: tx=X(width), ty=Z(depth toward viewer), tz=Y(height)
function addCevastaRuckaHorizontala(group, tx, ty, tz, duzina = 18.6, visina = 2.5, debljina = 0.8) {
  const r = debljina;
  // Posts: JSCAD cylinder default axis is Z (outward from door) — no rotation needed
  let p1 = translate(
    [tx - duzina / 2 + visina - debljina / 2, tz, ty + visina / 2],
    cylinder({ radius: r, height: visina, segments: 16 })
  );
  let p2 = translate(
    [tx + duzina / 2 - visina - debljina / 2, tz, ty + visina / 2],
    cylinder({ radius: r, height: visina, segments: 16 })
  );
  // Bar: lies along X axis, at depth = ty + visina + 1
  let b = translate(
    [tx, tz, ty + visina + 1],
    rotateY(Math.PI / 2, cylinder({ radius: r, height: duzina, segments: 16 }))
  );
  if (!group.materials['handle']) group.materials['handle'] = [];
  group.materials['handle'].push(p1, p2, b);
  // Worker specs
  _addSpec(group, 'handle', { type: 'cylinder', radius: r, height: visina, segments: 16, translate: [tx - duzina / 2 + visina - debljina / 2, tz, ty + visina / 2] });
  _addSpec(group, 'handle', { type: 'cylinder', radius: r, height: visina, segments: 16, translate: [tx + duzina / 2 - visina - debljina / 2, tz, ty + visina / 2] });
  _addSpec(group, 'handle', { type: 'cylinder', radius: r, height: duzina, segments: 16, rotateY: Math.PI / 2, translate: [tx, tz, ty + visina + 1] });
}

// ─── cevasta_rucka (vertical) ─────────────────────────────────────────────────
// Vertical handle: two posts protrude outward (+Z from door), bar runs along Y (height)
// Arguments mapped to Three.js space: tx=X(width), ty=Z(depth toward viewer), tz=Y(height)
function addCevastaRucka(group, tx, ty, tz, duzina = 18.6, visina = 2.5, debljina = 0.8) {
  const r = debljina;
  // Posts: JSCAD cylinder default axis is Z (outward from door) — no rotation needed
  let p1 = translate(
    [tx, tz - duzina / 2 + visina - debljina / 2, ty + visina / 2],
    cylinder({ radius: r, height: visina, segments: 16 })
  );
  let p2 = translate(
    [tx, tz + duzina / 2 - visina - debljina / 2, ty + visina / 2],
    cylinder({ radius: r, height: visina, segments: 16 })
  );
  // Bar: lies along Y axis (height), at depth = ty + visina + 1
  let b = translate(
    [tx, tz, ty + visina + 1],
    rotateX(Math.PI / 2, cylinder({ radius: r, height: duzina, segments: 16 }))
  );
  if (!group.materials['handle']) group.materials['handle'] = [];
  group.materials['handle'].push(p1, p2, b);
  // Worker specs
  _addSpec(group, 'handle', { type: 'cylinder', radius: r, height: visina, segments: 16, translate: [tx, tz - duzina / 2 + visina - debljina / 2, ty + visina / 2] });
  _addSpec(group, 'handle', { type: 'cylinder', radius: r, height: visina, segments: 16, translate: [tx, tz + duzina / 2 - visina - debljina / 2, ty + visina / 2] });
  _addSpec(group, 'handle', { type: 'cylinder', radius: r, height: duzina, segments: 16, rotateX: Math.PI / 2, translate: [tx, tz, ty + visina + 1] });
}

function addLegs(group, s, c, depth, customPositions = null) {
  const r = 1.5, h = c;
  const positions = customPositions || [
    [3, depth - 5.5],
    [s - 3, depth - 5.5],
    [3, 5.5],
    [s - 3, 5.5]
  ];
  for (const [px, py] of positions) {
    let cyl = cylinder({ radius: r, height: h });
    cyl = rotateX(-Math.PI / 2, cyl); // map Z axis cylinder to Y axis
    cyl = translate([px, h / 2, py], cyl);
    if (!group.materials['leg']) group.materials['leg'] = [];
    group.materials['leg'].push(cyl);
    // Worker spec
    _addSpec(group, 'leg', { type: 'cylinder', radius: r, height: h, segments: 16, rotateX: -Math.PI / 2, translate: [px, h / 2, py] });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * radni_stol — base cabinet with doors
 * Params: s (width), v (height), d (depth), c (plinth h), brvr (door count), brp (shelf count)
 */
function build_radni_stol(p, mats, settings) {
  const { s, v, d, c, brvr = 2, brp = 1 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // SCAD: front rail at v-m1
  buildCorpus(g, s, v, d, c, mK, settings, v - M1);
  buildShelves(g, s, v, d, c, brp, mK, settings);

  // Doors — SCAD: vrata=[s/brv-3,mdf,v-c-3] @ translate([1.5+i*rasporedi,-d-mdf,c])
  if (settings.front_vrata && brvr > 0) {
    const dw = s / brvr - 0.3;
    const dh = v - c - 0.3;
    for (let i = 0; i < brvr; i++) {
      const dx = 0.15 + i * (s / brvr);
      addBox(g, dw, MDF, dh, dx, -d - MDF, c, mF);
    }
    // Handles — SCAD: translate([s/brv-50+j*postavi_rucke,-mdf,v-186/2-50])
    const postavi_rucke = 5 * brvr;
    for (let j = 0; j < brvr; j++) {
      addCevastaRucka(g, s / brvr - 5 + j * postavi_rucke, d + MDF, v - 18.6 / 2 - 5);
    }
  }

  // Legs
  addLegs(g, s, c, d);

  return g;
}

/**
 * gola_radni_stol — base cabinet (taller, no handle treatment different)
 */
function build_gola_radni_stol(p, mats, settings) {
  const { s, v, d, c, brp = 1, brvr = 2 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // SCAD gola_radni_stol: front rail at v-60 (v-6cm)
  buildCorpus(g, s, v, d, c, mK, settings, v - 6);
  buildShelves(g, s, v, d, c, brp, mK, settings);

  // Doors — SCAD: vrata=[s/brv-3, mdf, v-c-33] (3.3cm shorter than regular)
  if (settings.front_vrata && brvr > 0) {
    const dw = s / brvr - 0.3;
    const dh = v - c - 3.3;
    for (let i = 0; i < brvr; i++) {
      addBox(g, dw, MDF, dh, 0.15 + i * (s / brvr), -d - MDF, c, mF);
    }
    // No handles in gola
  }
  // Legs
  addLegs(g, s, c, d);
  return g;
}

/**
 * fiokar — drawer unit
 * SCAD: front rail at v-m1, drawer fronts with handles
 */
function build_fiokar(p, mats, settings) {
  const { s, v, d, c, brf = 4, brfp = 2, brfd = 1 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;
  const kl = 50; // drawer depth (cm)

  // SCAD fiokar: front rail at v-m1
  buildCorpus(g, s, v, d, c, mK, settings, v - M1);

  // Drawer fronts — SCAD 1:1
  if (settings.celafioka && brf > 0) {
    const pom = (v - c) / brf;
    // SCAD: celo_duboke_fioke = [s-3, mdf, (v-c)/brf*2-3]
    const fh_deep = pom * 2 - 0.3;
    // SCAD: celo_plitke_fioke = [s-3, mdf, (v-c)/brf-3]
    const fh_shrt = pom - 0.3;
    const fw = s - 0.3;

    // Deep drawer front (bottom) at c
    addBox(g, fw, MDF, fh_deep, 0.15, -d - MDF, c, mF);
    // Handle
    addCevastaRuckaHorizontala(g, s / 2, d + MDF, c + pom);

    // Shallow drawer fronts — SCAD: for(k=[2:brf-1])
    for (let k = 2; k < brf; k++) {
      addBox(g, fw, MDF, fh_shrt, 0.15, -d - MDF, c + k * pom, mF);
      addCevastaRuckaHorizontala(g, s / 2, d + MDF, c + pom - 5 + k * pom);
    }
  }

  // Drawer boxes (visible interior) — SCAD deep drawer at for(i=[0])
  if (settings.fioke) {
    const pom = (v - c) / brf;
    const dboxH = pom * 2 - 5.8;
    const mstrH = dboxH - 1.2 - M1;
    const dnoW = s - 2 * M1 - 0.8 - 2 * M;
    const baseZ = c + 1.2;
    addBox(g, M, kl - 0.8, dboxH, M1 + 0.4, -kl + 0.8, baseZ + M1 + 0.4, mK);
    addBox(g, M, kl - 0.8, dboxH, s - M1 - 0.4 - M, -kl + 0.8, baseZ + M1 + 0.4, mK);
    addBox(g, dnoW, M1, mstrH, M1 + 0.4 + M, -kl + 0.8, baseZ + M1 + 0.4 + 1.2 + M1, mK);
    addBox(g, dnoW, M1, mstrH, M1 + 0.4 + M, -M1, baseZ + M1 + 0.4 + 1.2 + M1, mK);
    addBox(g, dnoW, kl - 1.0, M1, M1 + 0.4 + M, -kl + 1.0, baseZ + M1 + 0.4 + 1.2, mK);
  }

  // Legs
  addLegs(g, s, c, d);
  return g;
}

/**
 * fiokar_gola — bare drawer unit (taller variant)
 * SCAD: front rail at v-60, drawer fronts -3cm/-1.8cm, shallow at k=[2,2.92]
 */
function build_fiokar_gola(p, mats, settings) {
  const { s, v, d, c, brf = 4, brfp = 2, brfd = 1 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;
  const kl = 50;

  // Corpus — front rail at v-60 (v-6cm)
  addBox(g, M1, d, v - c, 0, -d, c, mK);
  addBox(g, M1, d, v - c, s - M1, -d, c, mK);
  addBox(g, s - 2 * M1, d, M1, M1, -d, c, mK);
  addBox(g, s - 2 * M1, 7, M1, M1, -7, v - M1, mK);
  addBox(g, s - 2 * M1, 7, M1, M1, -d, v - 6, mK);
  if (settings.pozadina) addBox(g, s, HDF, v - c, 0, 0, c, mK);

  if (settings.celafioka && brf > 0) {
    const pom = (v - c) / brf;
    const fh_deep = pom * 2 - 3.0;  // SCAD: (v-c)/brf*2-30
    const fh_shrt = pom - 1.8;       // SCAD: (v-c)/brf-18
    const fw = s - 0.3;

    addBox(g, fw, MDF, fh_deep, 0.15, -d - MDF, c, mF);

    // SCAD: for(k=[2, 2.92])
    for (const k of [2, 2.92]) {
      addBox(g, fw, MDF, fh_shrt, 0.15, -d - MDF, c + k * pom, mF);
    }
  }

  if (settings.fioke) {
    const pom = (v - c) / brf;
    const dboxH = pom * 2 - 10.0;  // SCAD gola: (v-c)/brf*2-100
    const mstrH = dboxH - 1.2 - M1;
    const dnoW = s - 2 * M1 - 0.8 - 2 * M;
    const baseZ = c + 1.2;
    addBox(g, M, kl - 1.0, dboxH, M1 + 0.4, -kl + 1.0, baseZ + M1 + 0.4, mK);
    addBox(g, M, kl - 1.0, dboxH, s - M1 - 0.4 - M, -kl + 1.0, baseZ + M1 + 0.4, mK);
    addBox(g, dnoW, M1, mstrH, M1 + 0.4 + M, -kl + 1.0, baseZ + M1 + 0.4 + 1.2 + M1, mK);
    addBox(g, dnoW, M1, mstrH, M1 + 0.4 + M, -M1, baseZ + M1 + 0.4 + 1.2 + M1, mK);
    addBox(g, dnoW, kl - 1.0, M1, M1 + 0.4 + M, -kl + 1.0, baseZ + M1 + 0.4 + 1.2, mK);
  }

  addLegs(g, s, c, d);
  return g;
}

/**
 * vrata_sudo_masine — dishwasher door panel
 */
function build_vrata_sudo_masine(p, mats, settings) {
  const { s, v, d, c } = p;
  const g = { materials: {} };
  const mK = mats.korpus;

  // Door — SCAD: vrata_sudo_masine=[s-3,mdf,v-c-3] @ translate([1.5,-d-mdf,c])
  if (settings.front_vrata) {
    const dw = s - 0.3;
    const dh = v - c - 0.3;
    addBox(g, dw, MDF, dh, 0.15, -d - MDF, c, mats.front);
    // Handle — SCAD: translate([s/2,-d-mdf,v-50]) cevasta_rucka_horizontala(186,25,8)
    addCevastaRuckaHorizontala(g, s / 2, d + MDF, v - 5);
  }
  return g;
}

/**
 * vrata_sudo_masine_gola — dishwasher door panel (GOLA variant)
 */
function build_vrata_sudo_masine_gola(p, mats, settings) {
  const { s, v, d, c } = p;
  const g = { materials: {} };
  const mK = mats.korpus;

  // Door — SCAD: vrata_sudo_masine=[s-3,mdf,v-c-33]
  if (settings.front_vrata) {
    const dw = s - 0.3;
    const dh = v - c - 3.3;
    addBox(g, dw, MDF, dh, 0.15, -d - MDF, c, mats.front);
  }
  return g;
}

/**
 * radni_stol_rerne — cabinet with oven cutout
 */
function build_radni_stol_rerne(p, mats, settings) {
  const { s, v, d, c, rerna = 58.5 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // Sides
  addBox(g, M1, d, v - c, 0, -d, c, mK);
  addBox(g, M1, d, v - c, s - M1, -d, c, mK);
  // Bottom shelf
  addBox(g, s - 2 * M1, d, M1, M1, -d, c, mK);
  // Shelf above oven
  addBox(g, s - 2 * M1, d, M1, M1, -d, v - 2 * M1 - rerna, mK);
  // Top rails
  addBox(g, s - 2 * M1, 7, M1, M1, -7, v - M1, mK);
  addBox(g, s - 2 * M1, 7, M1, M1, -d, v - M1, mK);
  if (settings.pozadina) addBox(g, s, HDF, v - c, 0, 0, c, mK);

  // Oven cutout visual (dark box)
  const mOven = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  addBox(g, s - 2 * M1, d - 2, rerna - M1, M1, -d + 1, v - 2 * M1 - rerna + M1, mOven);

  // Drawer front (below oven) — SCAD: celo_fioke=[s-3,mdf,v-c-m1-rerna-3]
  if (settings.celafioka) {
    const fh = v - c - M1 - rerna - 0.3;
    if (fh > 0) {
      addBox(g, s - 0.3, MDF, fh, 0.15, -d - MDF, c, mF);
      // Handle — SCAD: translate([s/2,-d-mdf,c+(v-c-m1-rerna-50)]) cevasta_rucka_horizontala
      addCevastaRuckaHorizontala(g, s / 2, d + MDF, c + (v - c - M1 - rerna - 5));
    }
  }
  addLegs(g, s, c, d);
  return g;
}

/**
 * radni_stol_rerne_gola — cabinet with oven cutout (GOLA variant)
 */
function build_radni_stol_rerne_gola(p, mats, settings) {
  const { s, v, d, c, rerna = 58.5 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // Sides
  addBox(g, M1, d, v - c, 0, -d, c, mK);
  addBox(g, M1, d, v - c, s - M1, -d, c, mK);
  // Bottom shelf
  addBox(g, s - 2 * M1, d, M1, M1, -d, c, mK);

  // Shelf above oven — SCAD: translate([m1, 0, v-60-rerna-m1])
  const shelfY = v - 6 - rerna - M1;
  addBox(g, s - 2 * M1, d, M1, M1, -d, shelfY, mK);

  // Top rails
  // SCAD back: translate([m1, d-70, v-m1])
  addBox(g, s - 2 * M1, 7, M1, M1, -7, v - M1, mK);
  // SCAD front: translate([m1, 0, v-60])
  addBox(g, s - 2 * M1, 7, M1, M1, -d, v - 6, mK);

  if (settings.pozadina) addBox(g, s, HDF, v - c, 0, 0, c, mK);

  // Oven cutout visual
  const mOven = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  addBox(g, s - 2 * M1, d - 2, rerna, M1, -d + 1, shelfY + M1, mOven);

  // Drawer front — SCAD: celo_fioke= [s-3,mdf,v-c-60-rerna-3]
  if (settings.celafioka) {
    const fh = v - c - rerna - 6.3;
    if (fh > 0) {
      addBox(g, s - 0.3, MDF, fh, 0.15, -d - MDF, c, mF);
      // No handle in gola
    }
  }
  addLegs(g, s, c, d);
  return g;
}

/**
 * radni_stol_rerne_gola_bez_fioke — oven cabinet without drawer (SCAD 1:1)
 * SCAD: module radni_stol_rerne_gola_bez_fioke(s,v,d,c,rerna)
 */
function build_radni_stol_rerne_gola_bez_fioke(p, mats, settings) {
  const { s, v, d, c, rerna = 58.5 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // Sides
  addBox(g, M1, d, v - c, 0, -d, c, mK);
  addBox(g, M1, d, v - c, s - M1, -d, c, mK);
  // Bottom
  addBox(g, s - 2 * M1, d, M1, M1, -d, c, mK);
  // Shelf for oven support
  addBox(g, s - 2 * M1, d, M1, M1, -d, c + M1 + 8 - M1, mK);
  // Top rails
  addBox(g, s - 2 * M1, 7, M1, M1, -7, v - M1, mK);
  addBox(g, s - 2 * M1, 7, M1, M1, -d, v - 6, mK);
  // Back panel
  if (settings.pozadina) addBox(g, s, HDF, v - c, 0, 0, c, mK);

  // Two front panels (upper and lower halves around oven)
  if (settings.front_vrata) {
    const frontH = (v - c - rerna) / 2 - 0.3;
    if (frontH > 0) {
      addBox(g, s - 0.3, MDF, frontH, 0.15, -d - MDF, c, mF);
      addBox(g, s - 0.3, MDF, frontH, 0.15, -d - MDF, v - 3 - frontH, mF);
    }
  }
  addLegs(g, s, c, d);
  return g;
}

/**
 * sporet — cooker/stove placeholder
 */
function build_sporet(p, mats, settings) {
  const { s = 60, v = 85, d = 60 } = p;
  const g = { materials: {} };
  const mBody = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.5 });
  const mTop = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.2 });
  addBox(g, s, d, v, 0, -d, 0, mBody);
  addBox(g, s, d, 0.5, 0, -d, v, mTop);
  return g;
}

/**
 * samostojeci_frizider — standalone fridge placeholder
 */
function build_samostojeci_frizider(p, mats, settings) {
  const { s = 60, v = 185, d = 65 } = p;
  const g = { materials: {} };
  const mFridge = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.1, metalness: 0.4 });
  addBox(g, s, d, v, 0, -d, 0, mFridge);
  // Handle
  const mH = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.1, metalness: 0.9 });
  addBox(g, 0.8, 0.8, 20, s - 4, -d - 1.5, v / 2 - 10, mH);
  return g;
}

// ─── L-shaped corner cabinet ──────────────────────────────────────────────────
/**
 * dug_element_90 — L-shaped base corner cabinet
 * dss = long side width, lss = short side width
 */
function build_dug_element_90(p, mats, settings) {
  const { dss, lss, v, d, c, brp = 1 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // Long side corpus
  addBox(g, M1, d, v - c, 0, -d, c, mK);           // left
  addBox(g, M1, d, v - c, dss - M1, -d, c, mK);    // right
  addBox(g, dss - 2 * M1, d, M1, M1, -d, c, mK);   // bottom
  // Top rails
  // Long side back
  addBox(g, dss - 2 * M1, 7, M1, M1, -7, v - M1, mK);
  // Long side front (dropped to v-6 for gola)
  addBox(g, dss - 2 * M1, 7, M1, M1, -d, settings.isGola ? v - 6 : v - M1, mK);

  // Short side corpus (perpendicular)
  addBox(g, d, M1, v - c, 0, -lss, c, mK);         // back of short side
  addBox(g, d, lss - d - M1, M1, 0, -lss + M1, c, mK); // bottom short side
  // Short side back
  addBox(g, 7, lss - d - M1, M1, 0, -lss + M1, v - M1, mK); // top left short
  // Short side front (dropped by 5cm for gola)
  addBox(g, 7, lss - d - M1, M1, d - 7, -lss + M1, settings.isGola ? v - 6 : v - M1, mK); // top right short

  // Shelves in long side
  if (settings.polica && brp > 0) {
    const sp = (v - c - M1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, dss - 2 * M1, d - 5, M1, M1, -d + 5, c + i * sp, mK);
    }
  }

  // Back panels
  if (settings.pozadina) {
    addBox(g, dss, HDF, v - c, 0, 0, c, mK);
    addBox(g, HDF, lss, v - c, -HDF, -lss, c, mK);
  }

  // Doors — SCAD 1:1
  if (settings.front_vrata) {
    // Long side door
    const ldw = dss - d - MDF - 0.3;
    const dh = v - c - 0.3;
    addBox(g, ldw, MDF, dh, 0.15 + d + MDF, -d - MDF, c, mF);
    // Short side door (rotated 90°)
    const sdw = lss - d - MDF - 0.3;
    addBox(g, MDF, sdw, dh, d, -lss + 0.15, c, mF);
    addCevastaRucka(g, dss - 5, d + MDF, v - 18.6 / 2 - 5);
  }

  // Corner cabinet has 8 legs in SCAD
  const legs = [
    [3, 5.5], [dss - 3, 5.5],
    [3, d - 5.5], [dss - 3, d - 5.5],
    [d - 5.5, lss - 3], [3, lss - 3],
    [d - 5.5, -3], [d + 5.5, 5.5]
  ];
  addLegs(g, dss, c, d, legs);
  return g;
}

/**
 * dug_element_90_desni — RIGHT-side corner cabinet, exact X-mirror of dug_element_90.
 * Shape: long arm X=0..dss depth Y=0..-d, short arm X=(dss-d)..dss depth Y=-d..-lss.
 * Inner corner is at top-RIGHT (X=dss, Y=-d). Open/door side faces LEFT (low X).
 *
 * Mirror rule applied to every panel: tx_R = dss - tx_L - sx  (sx unchanged)
 */
function build_dug_element_90_desni(p, mats, settings) {
  const { dss, lss, v, d, c, brp = 1 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;
  const frontRailZ = settings.isGola ? v - 6 : v - M1;

  // ── Long arm corpus ──────────────────────────────────────────────────────────
  // original left  panel (tx=0,      sx=M1)  → mirror tx = dss-M1
  addBox(g, M1, d, v - c, dss - M1, -d, c, mK);
  // original right panel (tx=dss-M1, sx=M1)  → mirror tx = 0
  addBox(g, M1, d, v - c, 0,        -d, c, mK);
  // bottom (symmetric in X)
  addBox(g, dss - 2 * M1, d, M1, M1, -d, c, mK);
  // top back rail (symmetric)
  addBox(g, dss - 2 * M1, 7, M1, M1, -7, v - M1, mK);
  // top front rail
  addBox(g, dss - 2 * M1, 7, M1, M1, -d, frontRailZ, mK);

  // ── Short arm corpus — now at RIGHT end (X = dss-d … dss) ────────────────────
  // original back   (tx=0,   sx=d)  → mirror tx = dss-d
  addBox(g, d, M1,          v - c, dss - d, -lss,      c,  mK); // back wall
  addBox(g, d, lss - d - M1, M1,  dss - d, -lss + M1, c,  mK); // bottom
  // top-back rail: original (tx=0, sx=7) → mirror tx = dss-7
  addBox(g, 7, lss - d - M1, M1, dss - 7,     -lss + M1, v - M1,    mK);
  // top-front rail: original (tx=d-7, sx=7) → mirror tx = dss-(d-7)-7 = dss-d
  addBox(g, 7, lss - d - M1, M1, dss - d,     -lss + M1, frontRailZ, mK);

  // ── Shelves ──────────────────────────────────────────────────────────────────
  if (settings.polica && brp > 0) {
    const sp = (v - c - M1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, dss - 2 * M1, d - 5, M1, M1, -d + 5, c + i * sp, mK);
    }
  }

  // ── Back panels ─────────────────────────────────────────────────────────────
  if (settings.pozadina) {
    addBox(g, dss, HDF, v - c, 0,   0,    c, mK); // long arm back
    addBox(g, HDF, lss, v - c, dss, -lss, c, mK); // short arm back (mirror of tx=-HDF → dss)
  }

  // ── Doors ───────────────────────────────────────────────────────────────────
  // Original long door:  tx=0.15+d+MDF, sx=ldw  → mirror tx = dss-(0.15+d+MDF)-ldw = 0.15
  // Original short door: tx=d,          sx=MDF  → mirror tx = dss-d-MDF
  if (settings.front_vrata) {
    const dh  = v - c - 0.3;
    const ldw = dss - d - MDF - 0.3;
    const sdw = lss - d - MDF - 0.3;
    addBox(g, ldw, MDF, dh, 0.15,         -d - MDF,    c, mF); // long door (left side)
    addBox(g, MDF, sdw, dh, dss - d - MDF, -lss + 0.15, c, mF); // short door (right side face)
    // Handle: mirror of (dss-5) → 5
    addCevastaRucka(g, 5, d + MDF, v - 18.6 / 2 - 5);
  }

  // ── Legs ────────────────────────────────────────────────────────────────────
  // Original legs mirrored: tx_R = dss - tx_L
  const legs = [
    [dss - 3,     5.5],
    [3,           5.5],
    [dss - 3,     d - 5.5],
    [3,           d - 5.5],
    [dss - d + 5.5, lss - 3],
    [dss - 3,     lss - 3],
    [dss - d + 5.5, -3],
    [dss - d - 5.5, 5.5]
  ];
  addLegs(g, dss, c, d, legs);
  return g;
}

/**
 * dug_element_90_desni_gola — GOLA variant of the right-side corner cabinet.
 * Same as _desni but doors are 3.3cm shorter (no handle).
 */
function build_dug_element_90_desni_gola(p, mats, settings) {
  const g = build_dug_element_90_desni(p, mats, { ...settings, front_vrata: false, isGola: true });
  const { v, d, c } = p;
  const dss = parseFloat(p.dss) || 90;
  const lss = parseFloat(p.lss) || 90;
  const mF = mats.front;

  if (settings.front_vrata) {
    const dh  = v - c - 3.3;
    const ldw = dss - d - MDF - 0.3;
    const sdw = lss - d - MDF - 0.3;
    addBox(g, ldw, MDF, dh, 0.15,          -d - MDF,    c, mF);
    addBox(g, MDF, sdw, dh, dss - d - MDF, -lss + 0.15, c, mF);
  }
  return g;
}

/**
 * dug_element_90_gola — corner cabinet L shape 90 (GOLA variant)
 */
function build_dug_element_90_gola(p, mats, settings) {
  const g = build_dug_element_90(p, mats, { ...settings, front_vrata: false, isGola: true }); // Build without default doors
  const { v, d, c, dss = 90, lss = 90 } = p;
  const mF = mats.front;

  // Doors — SCAD for gola: vrata=[..., v-c-33]
  if (settings.front_vrata) {
    const ldw = dss - d - MDF - 0.3;
    const dh = v - c - 3.3; // 3.3cm shorter
    addBox(g, ldw, MDF, dh, 0.15 + d + MDF, -d - MDF, c, mF);

    const sdw = lss - d - MDF - 0.3;
    addBox(g, MDF, sdw, dh, d, -lss + 0.15, c, mF);
    // No handle added
  }
  return g;
}

// 45° corner cabinet
function build_donji_ugaoni_element_45(p, mats, settings) {
  const { dss, lss, v, d, c } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // Two straight sides
  addBox(g, M1, d, v - c, dss - M1, -d, c, mK);
  addBox(g, d, M1, v - c, 0, -lss, c, mK);

  // EXTREME PRECISION: 1:1 SCAD polygon for the bottom
  const botPoly = polygon({
    points: [
      [0, 0], [0, -lss + M1], [d, -lss + M1], [dss - M1, -d], [dss - M1, 0]
    ]
  });

  let botExt = extrudeLinear({ height: M1 }, botPoly);
  // Lay it flat onto XZ plane
  botExt = rotateX(-Math.PI / 2, botExt); // maps Z to Y
  botExt = translate([0, c + M1 / 2, 0], botExt); // Z=0 is centered around c+M1/2 vertically 

  if (!g.materials[mK]) g.materials[mK] = [];
  g.materials[mK].push(botExt);
  // Worker spec for the bottom polygon
  _addSpec(g, mK, {
    type: 'polygon',
    points: [[0, 0], [0, -lss + M1], [d, -lss + M1], [dss - M1, -d], [dss - M1, 0]],
    extrudeHeight: M1,
    rotateX: -Math.PI / 2,
    translate: [0, c + M1 / 2, 0]
  });

  // Stranica u uglu (SCAD: cube([150, m1, v-c-2*m1]) @ [0,-m1,c+m1])
  addBox(g, 15, M1, v - c - 2 * M1, 0, -M1, c + M1, mK);

  // Top rails
  // traverzna kraca
  addBox(g, 7, lss - M1, M1, 7, -lss + M1, v - M1, mK);
  // traverzna
  addBox(g, dss - 7 - M1, 7, M1, M1, -7, v - M1, mK);

  if (settings.pozadina) {
    addBox(g, HDF, lss, v - c, -HDF, -lss, c, mK);
    addBox(g, dss, HDF, v - c, 0, 0, c, mK);
  }

  if (settings.polica) {
    addBox(g, d - 5, lss - M1, M1, 0, -lss + M1, c + (v - c) / 2 - M1, mK);
  }

  // Diagonal door — SCAD: vrata at translate([d+m1/1.4,-lss+5,c]) rotate([0,0,polozaj_vrati])
  if (settings.front_vrata) {
    const angle = Math.atan2(lss - d, dss - d);
    const dw = Math.sqrt((lss - d) ** 2 + (dss - d) ** 2) - 0.3;
    const dh = v - c - 0.3;

    let dgeom = cuboid({ size: [dw, dh, MDF] });
    dgeom = rotateY(angle, dgeom);
    // Align outer face to outer corners of cabinet (d, lss) and (dss, d)
    // Offset midpoint by MDF/2 along the normal to push door outward
    const Xm = (d + dss) / 2 + (MDF / 2) * Math.sin(angle);
    const Zm = (lss + d) / 2 + (MDF / 2) * Math.cos(angle);
    dgeom = translate([Xm, c + dh / 2, Zm], dgeom);
    if (!g.materials[mF]) g.materials[mF] = [];
    g.materials[mF].push(dgeom);

    // Handle — SCAD: translate([dss-50,-d-50,v-186/2-50]) rotate([0,0,polozaj_vrati]) cevasta_rucka
    addCevastaRucka(g, dss - 5, d + 5, v - 18.6 / 2 - 5);
  }

  // 5 legs for 45 corner
  const legs = [
    [3, 5.5], [dss - 3, 5.5],
    [3, lss - 5.5], [dss - 3, d - 5.5],
    [d - 5.5, lss - 3]
  ];
  addLegs(g, dss, c, d, legs);
  return g;
}

/**
 * donji_ugaoni_element_45_gola — diagonal corner cabinet 45 (GOLA variant)
 */
function build_donji_ugaoni_element_45_gola(p, mats, settings) {
  const g = build_donji_ugaoni_element_45(p, mats, { ...settings, front_vrata: false });
  const { v, d, c, dss = 90, lss = 90 } = p;
  const mF = mats.front;

  if (settings.front_vrata) {
    const angle = Math.atan2(lss - d, dss - d);
    const dw = Math.sqrt((lss - d) ** 2 + (dss - d) ** 2) - 0.3;
    const dh = v - c - 3.3; // 3.3cm shorter

    let dgeom = cuboid({ size: [dw, dh, MDF] });
    dgeom = rotateY(angle, dgeom);
    const Xm = (d + dss) / 2 + (MDF / 2) * Math.sin(angle);
    const Zm = (lss + d) / 2 + (MDF / 2) * Math.cos(angle);
    dgeom = translate([Xm, c + dh / 2, Zm], dgeom);
    if (!g.materials[mF]) g.materials[mF] = [];
    g.materials[mF].push(dgeom);
    // No handle
  }
  return g;
}

// ─── Upper cabinets ───────────────────────────────────────────────────────────
/**
 * klasicna_viseca — classic wall cabinet (no cokla/legs)
 */
function buildUpperCorpus(g, s, v, d, mK, settings) {
  addBox(g, M1, d, v, 0, -d, 0, mK);
  addBox(g, M1, d, v, s - M1, -d, 0, mK);
  addBox(g, s - 2 * M1, d, M1, M1, -d, 0, mK);      // bottom
  addBox(g, s - 2 * M1, d, M1, M1, -d, v - M1, mK); // top
  if (settings.pozadina) addBox(g, s, HDF, v, 0, 0, 0, mK);
}

function build_klasicna_viseca(p, mats, settings) {
  const { s, v, d, brp = 1, brvr = 2 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  buildUpperCorpus(g, s, v, d, mK, settings);

  // Shelves
  if (settings.polica && brp > 0) {
    const sp = (v - M1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, i * sp, mK);
    }
  }

  // Doors — SCAD: vrata=[s/brv-3,mdf,v-3] @ translate([1.5+i*rasporedi,-d-mdf,0])
  if (settings.front_vrata && brvr > 0) {
    const dw = s / brvr - 0.3;
    const dh = v - 0.3;
    for (let i = 0; i < brvr; i++) {
      const dx = 0.15 + i * (s / brvr);
      addBox(g, dw, MDF, dh, dx, -d - MDF, 0, mF);
    }
    // Handles — SCAD: translate([s/brv-50+j*postavi_rucke,-d-mdf,186/2+50]) cevasta_rucka(186,25,8)
    const postavi_rucke = 5 * brvr;
    for (let j = 0; j < brvr; j++) {
      addCevastaRucka(g, s / brvr - 5 + j * postavi_rucke, d + MDF, 18.6 / 2 + 5);
    }
  }
  return g;
}

function build_klasicna_viseca_gola(p, mats, settings) {
  const { s, v, d, brp = 2, brvr = 1 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // Corpus (slightly different: dno is 22mm shallower)
  addBox(g, M1, d, v, 0, -d, 0, mK);
  addBox(g, M1, d, v, s - M1, -d, 0, mK);
  addBox(g, s - 2 * M1, d - 2.2, M1, M1, -d + 2.2, 0, mK); // bottom
  addBox(g, s - 2 * M1, d, M1, M1, -d, v - M1, mK);          // top
  if (settings.pozadina) addBox(g, s, HDF, v, 0, 0, 0, mK);

  if (settings.polica && brp > 0) {
    const sp = (v - M1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, i * sp, mK);
    }
  }
  if (settings.front_vrata && brvr > 0) {
    const dw = s / brvr - 0.3;
    addBox(g, dw, MDF, v - 0.3, 0.15 + 0 * (s / brvr), -d - MDF, 0, mF);
  }
  return g;
}

/**
 * klasicna_viseca_gola_ispod_grede — variant with beam cutout
 * SCAD: sirina_grede=300; visina_grede=210;
 */
function build_klasicna_viseca_gola_ispod_grede(p, mats, settings) {
  const { s, v, d, brp = 2, brvr = 1 } = p;
  const sg = 30, vg = 21; // Beam width and height in cm
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // Stranice
  addBox(g, M1, d, v - vg, 0, -d, 0, mK);
  addBox(g, M1, d, v - vg, s - M1, -d, 0, mK);
  // Dno i Plafon
  addBox(g, s - 2 * M1, d - 2.2, M1, M1, -d + 2.2, 0, mK); // bottom
  addBox(g, s - 2 * M1, d, M1, M1, -d, v - vg - M1, mK); // top (dropped for beam)

  if (settings.pozadina) addBox(g, s, HDF, v - vg, 0, 0, 0, mK);

  if (settings.polica && brp > 0) {
    const sp = (v - vg - M1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, i * sp, mK);
    }
  }
  if (settings.front_vrata && brvr > 0) {
    const dw = s / brvr - 0.3;
    const dh = v - vg - 0.3;
    for (let i = 0; i < brvr; i++) {
      const dx = 0.15 + i * (s / brvr);
      addBox(g, dw, MDF, dh, dx, -d - MDF, 0, mF);
    }
  }
  return g;
}

/**
 * viseca_na_kipu — flip-up door wall cabinet
 */
function build_viseca_na_kipu(p, mats, settings) {
  const { s, v, d, brp = 2, brvr = 2 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  buildUpperCorpus(g, s, v, d, mK, settings);
  // Middle horizontal divider
  addBox(g, s - 2 * M1, d, M1, M1, -d, (v - M1) / 2, mK);

  if (settings.polica && brp > 0) {
    const sp = ((v - M1) / 2) / 2;
    for (const i of [1, 3]) {
      addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, i * sp, mK);
    }
  }

  // Horizontal flip-up doors — SCAD: vrata=[s-3,mdf,v/2-3]
  if (settings.front_vrata) {
    const dh = v / 2 - 0.3;
    const dw = s - 0.3;
    const sp = v / brvr;
    for (let i = 0; i < brvr; i++) {
      addBox(g, dw, MDF, dh, 0.15, -d - MDF, 0.15 + i * sp, mF);
      // Handle — SCAD: translate([s/2,-d-mdf,50+j*rasporedi_vrata]) cevasta_rucka_horizontala(186,25,8)
      addCevastaRuckaHorizontala(g, s / 2, d + MDF, 5 + i * sp);
    }
  }
  return g;
}

/**
 * viseca_na_kipu_gola — flip-up door wall cabinet (GOLA variant)
 */
function build_viseca_na_kipu_gola(p, mats, settings) {
  const { s, v, d, brp = 2, brvr = 2 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // Custom corpus for GOLA variant: bottom is shallower (d-2.2)
  addBox(g, M1, d, v, 0, -d, 0, mK);
  addBox(g, M1, d, v, s - M1, -d, 0, mK);
  addBox(g, s - 2 * M1, d - 2.2, M1, M1, -d + 2.2, 0, mK); // bottom
  addBox(g, s - 2 * M1, d, M1, M1, -d, v - M1, mK);          // top
  if (settings.pozadina) addBox(g, s, HDF, v, 0, 0, 0, mK);

  // Middle horizontal divider
  addBox(g, s - 2 * M1, d, M1, M1, -d, (v - M1) / 2, mK);

  if (settings.polica && brp > 0) {
    const sp = ((v - M1) / 2) / 2;
    for (const i of [1, 3]) {
      addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, i * sp, mK);
    }
  }

  if (settings.front_vrata) {
    const dh = v / 2 - 0.3;
    const dw = s - 0.3;
    const sp = v / brvr;
    for (let i = 0; i < brvr; i++) {
      addBox(g, dw, MDF, dh, 0.15, -d - MDF, 0.15 + i * sp, mF);
      // No handles in gola kip
    }
  }
  return g;
}

/**
 * gue90 — corner upper cabinet 90°
 */
function build_gue90(p, mats, settings) {
  const { sl, sd, v, d, brp = 1 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // Long side
  addBox(g, M1, d, v, 0, -d, 0, mK);
  addBox(g, M1, d, v, sl - M1, -d, 0, mK);
  addBox(g, sl - 2 * M1, d, M1, M1, -d, 0, mK);
  addBox(g, sl - 2 * M1, d, M1, M1, -d, v - M1, mK);

  // Short side (rotated)
  addBox(g, d, M1, v, sl - d, -sd, 0, mK);
  addBox(g, d, sd - d - M1, M1, sl - d, -sd + M1, 0, mK);
  addBox(g, d, sd - d - M1, M1, sl - d, -sd + M1, v - M1, mK);

  if (settings.pozadina) {
    addBox(g, sl, HDF, v, 0, 0, 0, mK);
    addBox(g, HDF, sd - d + 2.0, v, sl, -sd, 0, mK);
  }

  if (settings.polica && brp > 0) {
    const sp = (v - M1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, sl - 2 * M1, d - 3, M1, M1, -d + 3, i * sp, mK);
      addBox(g, d - 3, sd - d + 3 - M1, M1, sl - d + 3, -sd + M1, i * sp, mK);
    }
  }

  if (settings.front_vrata) {
    const dh = v - 0.6;
    const dw_l = sl - d - MDF - HDF - 0.2;
    const dw_d = sd - d - MDF - HDF - 0.2;
    addBox(g, dw_l, MDF, dh, 0.15, -d - MDF, 0.3, mF);
    addBox(g, MDF, dw_d, dh, sl - d - MDF - HDF, -sd + 0.15, 0.3, mF);
  }
  return g;
}

// ─── Special elements ─────────────────────────────────────────────────────────
/**
 * radna_ploca — worktop slab
 */
function build_radna_ploca(p, mats, settings) {
  if (!settings.radna_ploca) return new THREE.Group();
  const { l, d = 60, debljina = 3.8 } = p;
  const g = { materials: {} };
  addBox(g, l, d, debljina, 0, -d, 0, mats.radna);
  return g;
}

/**
 * radna_ploca_ugaona — L-shaped corner worktop
 * l   = length of the primary arm (along X, the wall the user is building on)
 * lss = length of the perpendicular arm going into the corner wall (along -Y)
 * d   = countertop depth (default 60cm)
 * debljina = thickness (default 3.8cm)
 *
 * The two slabs share the dss×d corner square so they fit together without overlap:
 *   - Primary arm  : from X=0 to X=l,  Y=-d to Y=0   (full width)
 *   - Perp arm     : from X=0 to X=d,  Y=-lss to Y=-d (only the portion beyond the corner square)
 */
function build_radna_ploca_ugaona(p, mats, settings) {
  if (!settings.radna_ploca) return new THREE.Group();
  const { l, lss = 60, d = 60, debljina = 3.8 } = p;
  const g = { materials: {} };
  // Primary arm along wall
  addBox(g, l, d, debljina, 0, -d, 0, mats.radna);
  // Perpendicular arm — starts at -d (avoiding overlap with primary arm corner square)
  const perpLen = lss - d;
  if (perpLen > 0) {
    addBox(g, d, perpLen, debljina, 0, -lss, 0, mats.radna);
  }
  return g;
}

/**
 * cokla — plinth/kickboard
 */
function build_cokla(p, mats, settings) {
  const { l, h = 9.5, debljina = 1.8 } = p;
  const g = { materials: {} };
  addBox(g, l, debljina, h, 0, -(debljina + 5.5), 0, mats.cokla);
  return g;
}

/**
 * ormar_visoki — tall wardrobe/larder unit
 */
function build_ormar_visoki(p, mats, settings) {
  const { s, v, d, c, brp = 4, brvr = 2 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  addBox(g, M1, d, v - c, 0, -d, c, mK);
  addBox(g, M1, d, v - c, s - M1, -d, c, mK);
  addBox(g, s - 2 * M1, d, M1, M1, -d, c, mK);
  addBox(g, s - 2 * M1, d, M1, M1, -d, v - M1, mK);
  addBox(g, s - 2 * M1, 7, M1, M1, -7, v - M1, mK);
  if (settings.pozadina) addBox(g, s, HDF, v - c, 0, 0, c, mK);

  if (settings.polica && brp > 0) {
    const sp = (v - c - M1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, s - 2 * M1, d - 5, M1, M1, -d + 5, c + i * sp, mK);
    }
  }
  if (settings.front_vrata && brvr > 0) {
    const dw = s / brvr - 0.3;
    const dh = v - c - 0.3;
    for (let i = 0; i < brvr; i++) {
      const dx = 0.15 + i * (s / brvr);
      addBox(g, dw, MDF, dh, dx, -d - MDF, c, mF);
    }
    // Handles — cevasta_rucka
    const postavi_rucke = 5 * brvr;
    for (let j = 0; j < brvr; j++) {
      addCevastaRucka(g, s / brvr - 5 + j * postavi_rucke, d + MDF, v - 18.6 / 2 - 5);
    }
  }
  addLegs(g, s, c, d);
  return g;
}

function build_radni_stol_pored_stuba(p, mats, settings) {
  const { s, v, d, c, brp = 1, brv = 2, ss = 20, ds = 17, vs = 250 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // Stranice
  addBox(g, M1, d, v - c, 0, -d, c, mK); // left
  addBox(g, M1, d - ds, v - c, s - M1, -d, c, mK); // right

  // Stranice do stuba (bocna and prednja)
  addBox(g, M1, ds, v - c - 2 * M1, s - M1 - ss, -ds, c + M1, mK);
  addBox(g, ss, M1, v - c - 2 * M1, s - M1 - ss, -ds - M1, c + M1, mK);

  // Dno
  addBox(g, s - 2 * M1, d - ds, M1, M1, -d, c, mK);
  addBox(g, s - 2 * M1 - ss, ds, M1, M1, -ds, c, mK);

  // Traverzne
  addBox(g, s - 2 * M1, 7, M1, M1, -d, v - M1, mK); // front
  addBox(g, s - M1 - ss, 7, M1, M1, -7, v - M1, mK); // back (cut for pillar)

  if (settings.pozadina) {
    addBox(g, s - ss, HDF, v - c, 0, 0, c, mK);
  }

  // Police
  if (settings.polica && brp > 0) {
    const sp = (v - c - M1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      if (d - 5 > ds) {
        addBox(g, s - 2 * M1, d - 5 - ds, M1, M1, -d + 5, c + i * sp, mK);
        addBox(g, s - 2 * M1 - ss, ds, M1, M1, -ds, c + i * sp, mK);
      } else {
        addBox(g, s - 2 * M1 - ss, d - 5, M1, M1, -d + 5, c + i * sp, mK);
      }
    }
  }

  // Vrata
  if (settings.front_vrata && brv > 0) {
    const dw = s / brv - 0.3;
    const dh = v - c - 0.3;
    for (let i = 0; i < brv; i++) {
      const dx = 0.15 + i * (s / brv);
      addBox(g, dw, MDF, dh, dx, -d - MDF, c, mF);
    }
    const postavi_rucke = 5 * brv;
    for (let j = 0; j < brv; j++) {
      addCevastaRucka(g, s / brv - 5 + j * postavi_rucke, d + MDF, v - 18.6 / 2 - 5);
    }
  }

  addLegs(g, s, c, d);
  return g;
}

function build_radni_stol_pored_stuba_gola(p, mats, settings) {
  // Gola variant: doors 3.3cm shorter, no handles, front rail at v-60 (v-6cm)
  const { s, v, d, c, brp = 1, brv = 2, ss = 20, ds = 17 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // Stranice — identical to regular
  addBox(g, M1, d, v - c, 0, -d, c, mK); // left
  addBox(g, M1, d - ds, v - c, s - M1, -d, c, mK); // right (shorter for pillar)

  // Stranice do stuba (bocna and prednja)
  addBox(g, M1, ds, v - c - 2 * M1, s - M1 - ss, -ds, c + M1, mK);
  addBox(g, ss, M1, v - c - 2 * M1, s - M1 - ss, -ds - M1, c + M1, mK);

  // Dno (L-shaped bottom, difference for pillar cutout)
  addBox(g, s - 2 * M1, d - ds, M1, M1, -d, c, mK);
  addBox(g, s - 2 * M1 - ss, ds, M1, M1, -ds, c, mK);

  // Traverzne — GOLA: back rail at v-m1, front rail DROPPED to v-60
  addBox(g, s - M1 - ss, 7, M1, M1, -7, v - M1, mK); // back (cut for pillar)
  addBox(g, s - 2 * M1, 7, M1, M1, -d, v - 6, mK);   // front (dropped to v-60 = v-6cm)

  if (settings.pozadina) {
    addBox(g, s - ss, HDF, v - c, 0, 0, c, mK);
  }

  // Police — identical cutout logic
  if (settings.polica && brp > 0) {
    const sp = (v - c - M1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      if (d - 5 > ds) {
        addBox(g, s - 2 * M1, d - 5 - ds, M1, M1, -d + 5, c + i * sp, mK);
        addBox(g, s - 2 * M1 - ss, ds, M1, M1, -ds, c + i * sp, mK);
      } else {
        addBox(g, s - 2 * M1 - ss, d - 5, M1, M1, -d + 5, c + i * sp, mK);
      }
    }
  }

  // Vrata — GOLA: v-c-33 (3.3cm shorter), NO handles
  if (settings.front_vrata && brv > 0) {
    const dw = s / brv - 0.3;
    const dh = v - c - 3.3;
    for (let i = 0; i < brv; i++) {
      const dx = 0.15 + i * (s / brv);
      addBox(g, dw, MDF, dh, dx, -d - MDF, c, mF);
    }
  }

  addLegs(g, s, c, d);
  return g;
}

// ─── Tall units (visoki elementi) ─────────────────────────────────────────────

/**
 * visoki_element_za_kombinovani_frizider — tall unit for combo fridge
 * SCAD 1:1: sides, bottom, 2 fixed shelves (above fridge + top), doors (upper/middle/lower)
 */
function build_visoki_element_za_kombinovani_frizider(p, mats, settings) {
  const { s, v, vde = 88, d, c, brp = 2, brv = 1, frizider = 180 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // Sides (full height minus plinth and 3*M1 for top frame)
  addBox(g, M1, d, v - c - 3 * M1, 0, -d, c + M1, mK);
  addBox(g, M1, d, v - c - 3 * M1, s - M1, -d, c + M1, mK);
  // Bottom
  addBox(g, s, d, M1, 0, -d, c, mK);
  // Fixed shelf above fridge
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, frizider + 1 + c + M1, mK);
  // Fixed shelf at top
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, v - 3 * M1, mK);

  // Back panel (above fridge zone only)
  if (settings.pozadina) {
    const lesonitH = (v - frizider - c - 1.3) - 3 * M1;
    if (lesonitH > 0) addBox(g, s - M1, HDF, lesonitH, M1 / 2, -3, frizider + 1 + c + M1, mK);
  }

  // Movable shelves (above fridge)
  if (settings.polica && brp > 0) {
    const shelfZone = v - 2 * M1 - frizider - 1 - c;
    const sp = shelfZone / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, s - 2 * M1, d - 8, M1, M1, -d + 8 - 3.3, frizider + 1 + c + i * sp, mK);
    }
  }

  // Doors
  if (settings.front_vrata) {
    // Upper doors (above fridge)
    const upperH = (v - frizider - 1.3 - c) - 3 * M1 - 0.3;
    if (upperH > 0) {
      const dw = s / brv - 0.3;
      for (let i = 0; i < brv; i++) {
        addBox(g, dw, MDF, upperH, 0.15 + i * (s / brv), -d - MDF, frizider + 1 + c + M1 + 0.3, mF);
      }
    }
    // Lower door (fridge zone)
    const lowerH = vde - c - 0.3;
    if (lowerH > 0) addBox(g, s - 0.3, MDF, lowerH, 0.15, -d - MDF, c, mF);
    // Middle door
    const midH = (v - vde) - (v - frizider - 1.3 - c - M1) - 0.3;
    if (midH > 0) addBox(g, s - 0.3, MDF, midH, 0.15, -d - MDF, vde, mF);
  }

  // Granc (crown moulding) — top decorative frame
  const mG = mats.granc;
  addBox(g, s, 7, M1, 0, -d - M1, v - 2 * M1, mG);
  addBox(g, s, 3, M1, 0, -d - M1, v - M1, mG);

  addLegs(g, s, c, d);
  return g;
}

/**
 * visoki_element_za_kombinovani_frizider_gola — bare variant (narrower side)
 */
function build_visoki_element_za_kombinovani_frizider_gola(p, mats, settings) {
  const { s, v, vde = 88, d, c, brp = 2, brv = 1, frizider = 180 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // Left side (narrower by 22mm for handle clearance)
  addBox(g, M1, d - 2.2, v - c - 3 * M1, 0, -d + 2.2, c + M1, mK);
  // Right side (full depth)
  addBox(g, M1, d, v - c - 3 * M1, s - M1, -d, c + M1, mK);
  // Bottom
  addBox(g, s, d, M1, 0, -d, c, mK);
  // Fixed shelves
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d, frizider + 1 + c + M1, mK);
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d, v - 3 * M1, mK);

  if (settings.pozadina) {
    const lesonitH = (v - frizider - c - 1.3) - 3 * M1;
    if (lesonitH > 0) addBox(g, s - M1, HDF, lesonitH, M1 / 2, -3, frizider + 1 + c + M1, mK);
  }

  if (settings.polica && brp > 0) {
    const sp = (v - 2 * M1 - frizider - 1 - c) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, s - 2 * M1, d - 8, M1, M1, -d + 8 - 3.3, frizider + 1 + c + i * sp, mK);
    }
  }

  if (settings.front_vrata) {
    const upperH = (v - frizider - 1.3 - c) - 3 * M1 - 0.3;
    if (upperH > 0) {
      const dw = s / brv - 0.3;
      for (let i = 0; i < brv; i++) {
        addBox(g, dw, MDF, upperH, 0.15 + i * (s / brv), -d - MDF, frizider + 1 + c + M1 + 0.3, mF);
      }
    }
    const lowerH = vde - c - 0.3;
    if (lowerH > 0) addBox(g, s - 0.3, MDF, lowerH, 0.15, -d - MDF, c, mF);
    const midH = (v - vde) - (v - frizider - 1.3 - c - M1) - 0.3;
    if (midH > 0) addBox(g, s - 0.3, MDF, midH, 0.15, -d - MDF, vde, mF);
  }

  // Granc
  const mG = mats.granc;
  addBox(g, s, 7, M1, 0, -d - M1, v - 2 * M1, mG);
  addBox(g, s, 3, M1, 0, -d - M1, v - M1, mG);

  addLegs(g, s, c, d);
  return g;
}

/**
 * visoki_element_za_frizider — tall unit for fridge (no middle door)
 */
function build_visoki_element_za_frizider(p, mats, settings) {
  const { s, v, vde = 88, d, c, brp = 2, brv = 1, frizider = 180 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  addBox(g, M1, d, v - c - 3 * M1, 0, -d, c + M1, mK);
  addBox(g, M1, d, v - c - 3 * M1, s - M1, -d, c + M1, mK);
  addBox(g, s, d, M1, 0, -d, c, mK);
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, frizider + 1 + c + M1, mK);
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, v - 3 * M1, mK);

  if (settings.pozadina) {
    const lH = (v - frizider - c - 1.3) - 3 * M1;
    if (lH > 0) addBox(g, s - M1, HDF, lH, M1 / 2, -3, frizider + 1 + c + M1, mK);
  }

  if (settings.polica && brp > 0) {
    const sp = (v - 2 * M1 - frizider - 1 - c) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, s - 2 * M1, d - 8, M1, M1, -d + 8 - 3.3, frizider + 1 + c + i * sp, mK);
    }
  }

  if (settings.front_vrata) {
    const upperH = (v - frizider - 1.3 - c) - 3 * M1 - 0.3;
    if (upperH > 0) {
      const dw = s / brv - 0.3;
      for (let i = 0; i < brv; i++) {
        addBox(g, dw, MDF, upperH, 0.15 + i * (s / brv), -d - MDF, frizider + 1 + c + M1 + 0.3, mF);
      }
    }
    // Lower door (fridge zone = entire bottom)
    const lowerH = v - 2 * M1 + 0.9 - (v - frizider - 1.3 - c) - 3 * M1 - 0.3;
    if (lowerH > 0) addBox(g, s - 0.3, MDF, lowerH, 0.15, -d - MDF, c, mF);
  }

  const mG = mats.granc;
  addBox(g, s, 7, M1, 0, -d - M1, v - 2 * M1, mG);
  addBox(g, s, 3, M1, 0, -d - M1, v - M1, mG);

  addLegs(g, s, c, d);
  return g;
}

/**
 * visoki_element_za_frizider_gola — bare variant
 */
function build_visoki_element_za_frizider_gola(p, mats, settings) {
  const { s, v, vde = 88, d, c, brp = 2, brv = 1, frizider = 180 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  addBox(g, M1, d, v - c - 3 * M1, 0, -d, c + M1, mK);
  addBox(g, M1, d - 2.2, v - c - 3 * M1, s - M1, -d + 2.2, c + M1, mK);
  addBox(g, s, d, M1, 0, -d, c, mK);
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, frizider + 1 + c + M1, mK);
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, v - 3 * M1, mK);

  if (settings.pozadina) {
    const lH = (v - frizider - c - 1.3) - 3 * M1;
    if (lH > 0) addBox(g, s - M1, HDF, lH, M1 / 2, -3, frizider + 1 + c + M1, mK);
  }

  if (settings.polica && brp > 0) {
    const sp = (v - 2 * M1 - frizider - 1 - c) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, s - 2 * M1, d - 8, M1, M1, -d + 8 - 3.3, frizider + 1 + c + i * sp, mK);
    }
  }

  if (settings.front_vrata) {
    const upperH = (v - frizider - 1.3 - c) - 3 * M1 - 0.3;
    if (upperH > 0) {
      const dw = s / brv - 0.3;
      for (let i = 0; i < brv; i++) {
        addBox(g, dw, MDF, upperH, 0.15 + i * (s / brv), -d - MDF, frizider + 1 + c + M1 + 0.3, mF);
      }
    }
    const lowerH = v - 2 * M1 + 0.9 - (v - frizider - 1.3 - c) - 3 * M1 - 0.3;
    if (lowerH > 0) addBox(g, s - 0.3, MDF, lowerH, 0.15, -d - MDF, c, mF);
  }

  const mG = mats.granc;
  addBox(g, s, 7, M1, 0, -d - M1, v - 2 * M1, mG);
  addBox(g, s, 3, M1, 0, -d - M1, v - M1, mG);

  addLegs(g, s, c, d);
  return g;
}

/**
 * visoki_element_za_rernu — tall oven housing unit
 * SCAD: sides, bottom, 3 fixed shelves (below oven, above oven, top), doors upper+lower
 */
function build_visoki_element_za_rernu(p, mats, settings) {
  const { s, v, vde = 88, d, c, brp = 2, brv = 1, rerna = 58.5 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  addBox(g, M1, d, v - c - 3 * M1, 0, -d, c + M1, mK);
  addBox(g, M1, d, v - c - 3 * M1, s - M1, -d, c + M1, mK);
  addBox(g, s, d, M1, 0, -d, c, mK);
  // Fixed shelves: below oven, above oven, near top
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, vde - M1, mK);
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, vde + rerna, mK);
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, v - 3 * M1, mK);

  if (settings.pozadina) {
    addBox(g, s - M1, HDF, vde - c + M1 / 2, M1 / 2, -3, c + M1 / 2, mK);
    const upperLH = v - vde - rerna - 2 * M1;
    if (upperLH > 0) addBox(g, s - M1, HDF, upperLH, M1 / 2, -3, vde + rerna, mK);
  }

  // Movable shelves above oven
  if (settings.polica && brp > 0) {
    const sp = (v - vde - rerna - 2 * M1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, s - 2 * M1, d - 8, M1, M1, -d + 8 - 3.3, vde + M1 + rerna + i * sp, mK);
    }
    // Extra shelf in lower section
    addBox(g, s - 2 * M1, d - 8, M1, M1, -d + 8 - 3.3, (vde + c) / 2, mK);
  }

  if (settings.front_vrata) {
    // Upper doors
    const upperH = v - vde - rerna - 3 * M1 - 0.3;
    if (upperH > 0) {
      const dw = s / brv - 0.3;
      for (let i = 0; i < brv; i++) {
        addBox(g, dw, MDF, upperH, 0.15 + i * (s / brv), -d - MDF, vde + rerna + M1, mF);
      }
    }
    // Lower door
    const lowerH = vde - c - 0.3;
    if (lowerH > 0) addBox(g, s - 0.3, MDF, lowerH, 0.15, -d - MDF, c, mF);
  }

  // Granc
  const mG = mats.granc;
  addBox(g, s, 7, M1, 0, -d - M1, v - 2 * M1, mG);
  addBox(g, s, 3, M1, 0, -d - M1, v - M1, mG);

  addLegs(g, s, c, d);
  return g;
}

/**
 * visoki_element_za_rernu_sa_fiokama — tall oven unit with drawers below
 * SCAD 1:1: same as visoki_element_za_rernu but with drawer fronts instead of lower door
 */
function build_visoki_element_za_rernu_sa_fiokama(p, mats, settings) {
  const { s, v, vde = 88, d, c, brp = 2, brv = 1, rerna = 58.5 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  addBox(g, M1, d, v - c - 3 * M1, 0, -d, c + M1, mK);
  addBox(g, M1, d, v - c - 3 * M1, s - M1, -d, c + M1, mK);
  addBox(g, s, d, M1, 0, -d, c, mK);
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, vde - M1, mK);
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, vde + rerna, mK);
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, v - 3 * M1, mK);

  if (settings.pozadina) {
    addBox(g, s - M1, HDF, vde - c + M1 / 2, M1 / 2, -3, c + M1 / 2, mK);
    const upperLH = v - vde - rerna - 2 * M1;
    if (upperLH > 0) addBox(g, s - M1, HDF, upperLH, M1 / 2, -3, vde + rerna, mK);
  }

  if (settings.polica && brp > 0) {
    const sp = (v - vde - rerna - 2 * M1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, s - 2 * M1, d - 8, M1, M1, -d + 8 - 3.3, vde + M1 + rerna + i * sp, mK);
    }
  }

  // Upper doors
  if (settings.front_vrata) {
    const upperH = v - vde - rerna - 3 * M1 - 0.3;
    if (upperH > 0) {
      const dw = s / brv - 0.3;
      for (let i = 0; i < brv; i++) {
        addBox(g, dw, MDF, upperH, 0.15 + i * (s / brv), -d - MDF, vde + rerna + M1, mF);
      }
    }
  }

  // Drawer fronts below oven (SCAD: brf=4, deep bottom + shallow above)
  if (settings.celafioka) {
    const brf = 4;
    const pom = (vde - c) / brf;
    const fh_deep = pom * 2 - 0.3;
    const fh_shrt = pom - 0.3;
    // Deep drawer
    addBox(g, s - 0.3, MDF, fh_deep, 0.15, -d - MDF, c, mF);
    addCevastaRuckaHorizontala(g, s / 2, d + MDF + 0.1, c + fh_deep - 5);
    // Shallow drawers
    for (let k = 2; k < brf; k++) {
      addBox(g, s - 0.3, MDF, fh_shrt, 0.15, -d - MDF, c + k * pom, mF);
      addCevastaRuckaHorizontala(g, s / 2, d + MDF + 0.1, c + k * pom + fh_shrt - 5);
    }
  }

  const mG = mats.granc;
  addBox(g, s, 7, M1, 0, -d - M1, v - 2 * M1, mG);
  addBox(g, s, 3, M1, 0, -d - M1, v - M1, mG);

  addLegs(g, s, c, d);
  return g;
}

/**
 * visoki_element_za_rernu_i_mikrotalasnu_pec_sa_fiokama
 * SCAD 1:1: oven + microwave opening above oven, drawers below, shelves on top
 */
function build_visoki_element_za_rernu_i_mikrotalasnu_pec_sa_fiokama(p, mats, settings) {
  const { s, v, vde = 88, d, c, brp = 1, brv = 1, rerna = 58.5, mikrovele = 38 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  addBox(g, M1, d, v - c - 3 * M1, 0, -d, c + M1, mK);
  addBox(g, M1, d, v - c - 3 * M1, s - M1, -d, c + M1, mK);
  addBox(g, s, d, M1, 0, -d, c, mK);
  // 4 fixed shelves: below oven, above oven, above microwave, near top
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d, vde - M1, mK);
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d, vde + rerna, mK);
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d, vde + rerna + M1 + mikrovele, mK);
  addBox(g, s - 2 * M1, d - 3, M1, M1, -d, v - 3 * M1, mK);

  if (settings.pozadina) {
    addBox(g, s - M1, HDF, vde - c + M1 / 2, M1 / 2, -3, c + M1 / 2, mK);
    const upperLH = v - vde - rerna - mikrovele - 3 * M1;
    if (upperLH > 0) addBox(g, s - M1, HDF, upperLH, M1 / 2, -3, vde + rerna + M1 + mikrovele, mK);
  }

  if (settings.polica && brp > 0) {
    const sp = (v - vde - rerna - mikrovele - 2 * M1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, s - 2 * M1, d - 8, M1, M1, -d + 8 - 3.3, vde + 2 * M1 + rerna + mikrovele + i * sp, mK);
    }
  }

  // Upper door (above microwave)
  if (settings.front_vrata) {
    const upperH = v - vde - rerna - mikrovele - 0.8 - 3 * M1 - 0.3;
    if (upperH > 0) {
      const dw = s / brv - 0.3;
      for (let i = 0; i < brv; i++) {
        addBox(g, dw, MDF, upperH, 0.15 + i * (s / brv), -d - MDF, vde + rerna + M1 + mikrovele + 0.8, mF);
      }
    }
  }

  // Drawer fronts below oven
  if (settings.celafioka) {
    const brf = 4;
    const pom = (vde - c) / brf;
    const fh_deep = pom * 2 - 0.3;
    const fh_shrt = pom - 0.3;
    addBox(g, s - 0.3, MDF, fh_deep, 0.15, -d - MDF, c, mF);
    addCevastaRuckaHorizontala(g, s / 2, d + MDF + 0.1, c + fh_deep - 5);
    for (let k = 2; k < brf; k++) {
      addBox(g, s - 0.3, MDF, fh_shrt, 0.15, -d - MDF, c + k * pom, mF);
      addCevastaRuckaHorizontala(g, s / 2, d + MDF + 0.1, c + k * pom + fh_shrt - 5);
    }
  }

  const mG = mats.granc;
  addBox(g, s, 7, M1, 0, -d - M1, v - 2 * M1, mG);
  addBox(g, s, 3, M1, 0, -d - M1, v - M1, mG);

  addLegs(g, s, c, d);
  return g;
}

// ─── Kitchen appliances (kuhinjski_aparati.scad) ──────────────────────────────

/**
 * ploca_za_kuvanje — cooktop surface
 * SCAD: color("black") translate([10,15,880+38]) cube([x,y,z])
 */
function build_ploca_za_kuvanje(p, mats, settings) {
  const { x = 58, y = 51, z = 0.5 } = p;
  const g = { materials: {} };
  const mTop = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.3 });
  addBox(g, x, y, z, 1, -y - 1.5, 0, mTop);
  return g;
}

/**
 * sudopera — sink (approximated as cylindrical basin)
 * SCAD uses rotate_extrude with a polygon profile. We approximate as a box cutout.
 */
function build_sudopera(p, mats, settings) {
  const { D = 48, h = 18 } = p;
  const g = { materials: {} };
  const mSink = new THREE.MeshStandardMaterial({ color: 0xB0C4DE, roughness: 0.15, metalness: 0.6 });
  // Rim (outer rectangle)
  addBox(g, D + 4, D + 4, 0.3, -2, -D / 2 - 2 - 3, 0, mSink);
  // Basin (inner box, inset)
  addBox(g, D, D, h, 0, -D / 2 - 3, -h + 0.3, mSink);
  return g;
}

/**
 * gue90rotiran — rotated upper corner 90° cabinet
 * Rotation: SCAD rotate([0,0,90]) translate([0,-sl,0])
 * Three.js equivalent: rotate Y by PI/2, then shift X by sl.
 * Since gue90 uses only addBox (no JSCAD geoms), we transform the box positions directly.
 */
function build_gue90rotiran(p, mats, settings) {
  const g = build_gue90(p, mats, settings);
  const sl = parseFloat(p.sl) || 60;
  // Transform each box: rotate 90° around Y, then translate X by sl.
  // Rotation 90° around Y: (x, y, z) → (z, y, -x)
  if (g.boxes) {
    g.boxes = g.boxes.map(b => {
      const nx = b.cz + sl;
      const nz = -b.cx;
      // sx/sz swap due to Y rotation
      return { ...b, cx: nx, cz: nz, sx: b.sz, sz: b.sx };
    });
  }
  // Handle any residual JSCAD geoms (e.g. if gue90 grows handles later)
  for (const matKey in g.materials) {
    g.materials[matKey] = g.materials[matKey].map(geom => {
      let r = rotateY(Math.PI / 2, geom);
      return translate([sl, 0, 0], r);
    });
  }
  return g;
}

/**
 * lijevi_gue90 — left upper corner 90° cabinet
 * Mirror of gue90 geometry
 */
function build_lijevi_gue90(p, mats, settings) {
  const { sl, sd, v, d, brp = 1 } = p;
  const g = { materials: {} };
  const mK = mats.korpus, mF = mats.front;

  // Left side
  addBox(g, M1, d, v, 0, -d, 0, mK);
  // Two sides forming the L corner
  addBox(g, d, M1, v, sd - d, -M1, 0, mK);
  addBox(g, d, M1, v, sd - d, -sl, 0, mK);

  // Floor and ceiling - long side
  addBox(g, d, sl - 2 * M1, M1, sd - d, -sl + M1, 0, mK);
  addBox(g, d, sl - 2 * M1, M1, sd - d, -sl + M1, v - M1, mK);
  // Floor and ceiling - short side
  addBox(g, sd - d - M1, d, M1, M1, -d, 0, mK);
  addBox(g, sd - d - M1, d, M1, M1, -d, v - M1, mK);

  if (settings.pozadina) {
    addBox(g, HDF, sl, v, sd, -sl, 0, mK);
    addBox(g, sd - d + 2, HDF, v, 0, 0, 0, mK);
  }

  if (settings.polica && brp > 0) {
    const sp = (v - M1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, d - 3, sl - 2 * M1, M1, sd - d + 3, -sl + M1, i * sp, mK);
      addBox(g, sd - d + 3 - M1, d - 3, M1, M1, -d + 3, i * sp, mK);
    }
  }

  if (settings.front_vrata) {
    const dh = v - 0.6;
    const dw_l = sd - d - MDF - HDF - 0.2;
    const dw_d = sl - d - MDF - HDF - 0.2;
    addBox(g, dw_l, MDF, dh, 0.15, -d - MDF, 0.3, mF);
    addBox(g, MDF, dw_d, dh, sd - d - MDF, -sl + 0.15, 0.3, mF);
  }
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPATCH TABLE
// ═══════════════════════════════════════════════════════════════════════════════

const BUILDERS = {
  radni_stol: build_radni_stol,
  gola_radni_stol: build_gola_radni_stol,
  fiokar: build_fiokar,
  fiokar_gola: build_fiokar_gola,
  vrata_sudo_masine: build_vrata_sudo_masine,
  vrata_sudo_masine_gola: build_vrata_sudo_masine_gola,
  radni_stol_rerne: build_radni_stol_rerne,
  radni_stol_rerne_gola: build_radni_stol_rerne_gola,
  radni_stol_rerne_gola_bez_fioke: build_radni_stol_rerne_gola_bez_fioke,
  sporet: build_sporet,
  samostojeci_frizider: build_samostojeci_frizider,
  dug_element_90: build_dug_element_90,
  dug_element_90_gola: build_dug_element_90_gola,
  dug_element_90_desni: build_dug_element_90_desni,
  dug_element_90_desni_gola: build_dug_element_90_desni_gola,
  donji_ugaoni_element_45_sa_plocom: build_donji_ugaoni_element_45,
  donji_ugaoni_element_45_sa_plocom_gola: build_donji_ugaoni_element_45_gola,
  klasicna_viseca: build_klasicna_viseca,
  klasicna_viseca_gola: build_klasicna_viseca_gola,
  klasicna_viseca_gola_ispod_grede: build_klasicna_viseca_gola_ispod_grede,
  viseca_na_kipu: build_viseca_na_kipu,
  viseca_na_kipu_gola: build_viseca_na_kipu_gola,
  gue90: build_gue90,
  gue90rotiran: build_gue90rotiran,
  lijevi_gue90: build_lijevi_gue90,
  radni_stol_pored_stuba: build_radni_stol_pored_stuba,
  radni_stol_pored_stuba_gola: build_radni_stol_pored_stuba_gola,
  ormar_visoki: build_ormar_visoki,
  visoki_element_za_kombinovani_frizider: build_visoki_element_za_kombinovani_frizider,
  visoki_element_za_kombinovani_frizider_gola: build_visoki_element_za_kombinovani_frizider_gola,
  visoki_element_za_frizider: build_visoki_element_za_frizider,
  visoki_element_za_frizider_gola: build_visoki_element_za_frizider_gola,
  visoki_element_za_rernu: build_visoki_element_za_rernu,
  visoki_element_za_rernu_sa_fiokama: build_visoki_element_za_rernu_sa_fiokama,
  visoki_element_za_rernu_i_mikrotalasnu_pec_sa_fiokama: build_visoki_element_za_rernu_i_mikrotalasnu_pec_sa_fiokama,
  radna_ploca: build_radna_ploca,
  radna_ploca_ugaona: build_radna_ploca_ugaona,
  cokla: build_cokla,
  ploca_za_kuvanje: build_ploca_za_kuvanje,
  sudopera: build_sudopera
};

/**
 * buildKitchenModule — main entry point
 * @param {string} name - Module name
 * @param {Object} params - Parameter values (all in cm)
 * @param {Object} materialDefs - { front, korpus, radna, granc, cokla } material definitions
 * @param {Object} settings - Display settings (front_vrata, polica, etc.)
 * @param {number} posX, posY, posZ - World position (cm)
 * @param {number} rotDeg - Y-axis rotation in degrees
 * @returns {THREE.Group}
 */
export function buildKitchenModule(name, params, materialDefs, settings, posX, posY, posZ, rotDeg) {
  const builder = BUILDERS[name];
  if (!builder) {
    console.warn(`No builder for module: ${name}`);
    return new THREE.Group();
  }

  // Convert numeric params once
  const p = {};
  for (const [k, v] of Object.entries(params)) {
    const n = parseFloat(v);
    p[k] = isNaN(n) ? v : n;
  }

  // ── Resolve real Three.js materials (use global cache) ───────────────────────
  const realMats = {
    front:  _getCachedMat(materialDefs.front),
    korpus: _getCachedMat(materialDefs.korpus),
    radna:  _getCachedMat(materialDefs.radna),
    granc:  _getCachedMat(materialDefs.granc),
    cokla:  _getCachedMat(materialDefs.cokla),
    handle: _getCachedMat('__handle__') || (() => {
      const m = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, roughness: 0.2, metalness: 0.9 });
      _matCache.set('__handle__', m); return m;
    })(),
    leg: _getCachedMat('__leg__') || (() => {
      const m = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.3, metalness: 0.5 });
      _matCache.set('__leg__', m); return m;
    })(),
    box: _getCachedMat('__box__') || (() => {
      const m = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
      _matCache.set('__box__', m); return m;
    })(),
  };

  const group = new THREE.Group();
  group.name = name;

  // ── Geometry instance cache ───────────────────────────────────────────────────
  // Key includes name, numeric params, and settings — anything that affects shape.
  // materialDefs are NOT in the key: materials affect appearance only, not geometry.
  const cacheKey = _geomCacheKey(name, p, settings);
  const cached = _geomCache.get(cacheKey);

  if (cached) {
    // Cache hit: clone BoxGeometry for each box, reuse BufferGeometry for JSCAD meshes
    for (const b of cached.boxes) {
      const geo = new THREE.BoxGeometry(b.sx, b.sz, b.sy);
      const mm = (b.matKey && b.matKey.isMaterial) ? b.matKey
               : (realMats[b.matKey] || realMats.korpus);
      const mesh = new THREE.Mesh(geo, mm);
      mesh.position.set(b.cx, b.cy, b.cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const { bufferGeo, matKey } of cached.threeGeos) {
      const mm = (matKey && matKey.isMaterial) ? matKey
               : (realMats[matKey] || realMats.korpus);
      const mesh = new THREE.Mesh(bufferGeo.clone(), mm);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  } else {
    // Cache miss: run builder, convert, store results
    const mats = { front: 'front', korpus: 'korpus', radna: 'radna', granc: 'granc', cokla: 'cokla' };
    const raw = builder(p, mats, settings);

    const cacheEntry = { boxes: raw.boxes || [], threeGeos: [] };

    // ── Fast path: boxes → direct THREE.BoxGeometry, no JSCAD union() ───────────
    for (const b of cacheEntry.boxes) {
      const geo = new THREE.BoxGeometry(b.sx, b.sz, b.sy);
      const mm = (b.matKey && b.matKey.isMaterial) ? b.matKey
               : (realMats[b.matKey] || realMats.korpus);
      const mesh = new THREE.Mesh(geo, mm);
      mesh.position.set(b.cx, b.cy, b.cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    // ── Slow path: JSCAD geometries (cylinders, polygons) → union + convert ──────
    if (raw.materials) {
      for (const [matKey, geoms] of Object.entries(raw.materials)) {
        if (!geoms || geoms.length === 0) continue;
        const unifiedGeom = union(geoms);
        const bufferGeo = geom3ToThreeGeometry(unifiedGeom);
        const mm = (matKey && matKey.isMaterial) ? matKey
                 : (realMats[matKey] || realMats.korpus);
        const mesh = new THREE.Mesh(bufferGeo, mm);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        cacheEntry.threeGeos.push({ bufferGeo, matKey });
      }
    }

    _geomCacheSet(cacheKey, cacheEntry);
  }

  // Apply position and rotation globally
  // We add a tiny 0.1cm Z-offset to prevent z-fighting with the back wall
  group.position.set(posX, posZ, -posY + 0.1);
  group.rotation.y = -rotDeg * (Math.PI / 180);

  return group;
}

/**
 * buildKitchenModuleAsync — async version used by rebuildAllModules.
 *
 * For cache hits: behaves identically to buildKitchenModule (instant, sync).
 * For cache misses with worker-capable specs: dispatches JSCAD slow path to worker
 * in parallel with boxes-only group construction, then adds JSCAD meshes when done.
 * Falls back to sync buildKitchenModule if worker is unavailable.
 *
 * Returns a Promise<THREE.Group>.
 */
export async function buildKitchenModuleAsync(name, params, materialDefs, settings, posX, posY, posZ, rotDeg) {
  const builder = BUILDERS[name];
  if (!builder) {
    console.warn(`No builder for module: ${name}`);
    return new THREE.Group();
  }

  const p = {};
  for (const [k, v] of Object.entries(params)) {
    const n = parseFloat(v);
    p[k] = isNaN(n) ? v : n;
  }

  const cacheKey = _geomCacheKey(name, p, settings);

  // Cache hit → instant, no async needed
  if (_geomCache.has(cacheKey)) {
    return buildKitchenModule(name, params, materialDefs, settings, posX, posY, posZ, rotDeg);
  }

  // Cache miss — try worker for slow path
  const mats = { front: 'front', korpus: 'korpus', radna: 'radna', granc: 'granc', cokla: 'cokla' };
  const raw = builder(p, mats, settings);

  const realMats = {
    front:  _getCachedMat(materialDefs.front),
    korpus: _getCachedMat(materialDefs.korpus),
    radna:  _getCachedMat(materialDefs.radna),
    granc:  _getCachedMat(materialDefs.granc),
    cokla:  _getCachedMat(materialDefs.cokla),
    handle: _getCachedMat('__handle__') || new THREE.MeshStandardMaterial({ color: 0xC0C0C0, roughness: 0.2, metalness: 0.9 }),
    leg: _getCachedMat('__leg__') || new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.3, metalness: 0.5 }),
  };
  // Ensure handle/leg are cached
  if (!_matCache.has('__handle__')) _matCache.set('__handle__', realMats.handle);
  if (!_matCache.has('__leg__')) _matCache.set('__leg__', realMats.leg);

  const group = new THREE.Group();
  group.name = name;
  const cacheEntry = { boxes: raw.boxes || [], threeGeos: [] };

  // Fast path — boxes (sync, no blocking)
  for (const b of cacheEntry.boxes) {
    const geo = new THREE.BoxGeometry(b.sx, b.sz, b.sy);
    const mm = (b.matKey && b.matKey.isMaterial) ? b.matKey
             : (realMats[b.matKey] || realMats.korpus);
    const mesh = new THREE.Mesh(geo, mm);
    mesh.position.set(b.cx, b.cy, b.cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Slow path — attempt worker, fall back to sync
  const geomSpecs = raw.geomSpecs || [];
  const specsByMatKey = new Map();
  for (const { matKey, spec } of geomSpecs) {
    if (!specsByMatKey.has(matKey)) specsByMatKey.set(matKey, []);
    specsByMatKey.get(matKey).push(spec);
  }
  const workerGroups = Array.from(specsByMatKey.entries()).map(([matKey, specs]) => ({ matKey, specs }));

  let workerGeos = null;
  if (workerGroups.length > 0) {
    workerGeos = await _dispatchToWorker(workerGroups).catch(() => null);
  }

  if (workerGeos) {
    // Worker succeeded — add worker-computed meshes, store in cache
    for (const { bufferGeo, matKey } of workerGeos) {
      const mm = (matKey && matKey.isMaterial) ? matKey
               : (realMats[matKey] || realMats.korpus);
      const mesh = new THREE.Mesh(bufferGeo.clone(), mm);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      cacheEntry.threeGeos.push({ bufferGeo, matKey });
    }
    // Also build any remaining JSCAD geoms that had no spec (e.g. cuboid diagonal door)
    if (raw.materials) {
      for (const [matKey, geoms] of Object.entries(raw.materials)) {
        if (!geoms || geoms.length === 0) continue;
        // Skip matKeys already handled by worker
        if (specsByMatKey.has(matKey) && workerGeos.some(g => g.matKey === matKey)) continue;
        const unifiedGeom = union(geoms);
        const bufferGeo = geom3ToThreeGeometry(unifiedGeom);
        const mm = (matKey && matKey.isMaterial) ? matKey
                 : (realMats[matKey] || realMats.korpus);
        const mesh = new THREE.Mesh(bufferGeo, mm);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        cacheEntry.threeGeos.push({ bufferGeo, matKey });
      }
    }
  } else {
    // Worker unavailable or failed — sync JSCAD slow path
    if (raw.materials) {
      for (const [matKey, geoms] of Object.entries(raw.materials)) {
        if (!geoms || geoms.length === 0) continue;
        const unifiedGeom = union(geoms);
        const bufferGeo = geom3ToThreeGeometry(unifiedGeom);
        const mm = (matKey && matKey.isMaterial) ? matKey
                 : (realMats[matKey] || realMats.korpus);
        const mesh = new THREE.Mesh(bufferGeo, mm);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        cacheEntry.threeGeos.push({ bufferGeo, matKey });
      }
    }
  }

  _geomCacheSet(cacheKey, cacheEntry);

  group.position.set(posX, posZ, -posY + 0.1);
  group.rotation.y = -rotDeg * (Math.PI / 180);
  return group;
}

function fallbackBox(params) {
  const s = parseFloat(params.s || params.sl || params.dss || 60);
  const v = parseFloat(params.v || 82);
  const d = parseFloat(params.d || 55);
  const g = { materials: {} };
  const mat = new THREE.MeshStandardMaterial({ color: 0x888888, wireframe: true });
  addBox(g, s, d, v, 0, -d, 0, mat);
  return g;
}
