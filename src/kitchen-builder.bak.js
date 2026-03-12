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
import { M, M1, MDF, HDF, RPL } from './modules-config.js';
import { createMaterial } from './materials.js';

// Each mesh gets its own geometry (no cache) to avoid disposal bugs.
function getCachedBox(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

/**
 * addBox — JSCAD-style: place a box with its near-bottom-left corner at (tx, ty, tz).
 * SCAD:  translate([tx, ty, tz]) cube([sx, sy, sz])
 * where sx=width(X), sy=depth(Y-into-wall), sz=height(Z)
 *
 * @param {THREE.Group} group
 * @param {number} sx  - SCAD width (X)
 * @param {number} sy  - SCAD depth (Y)
 * @param {number} sz  - SCAD height (Z)
 * @param {number} tx  - SCAD X offset
 * @param {number} ty  - SCAD Y offset (negative = towards viewer)
 * @param {number} tz  - SCAD Z offset (height)
 * @param {THREE.Material} mat
 */
function addBox(group, sx, sy, sz, tx, ty, tz, mat) {
  if (sx <= 0 || sy <= 0 || sz <= 0) return;
  const geo = getCachedBox(sx, sz, Math.abs(sy));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Three center = (tx + sx/2, tz + sz/2, -(ty + sy/2))
  mesh.position.set(tx + sx / 2, tz + sz / 2, -(ty + sy / 2));
  group.add(mesh);
}

// ─── Corpus box (shared logic for base cabinets) ──────────────────────────────
function buildCorpus(group, s, v, d, c, mKorpus, settings) {
  // Left side
  addBox(group, M1, d, v - c,   0,      -d,  c, mKorpus);
  // Right side
  addBox(group, M1, d, v - c,   s - M1, -d,  c, mKorpus);
  // Bottom
  addBox(group, s - 2 * M1, d, M1, M1, -d, c, mKorpus);
  // Top front cross rail
  addBox(group, s - 2 * M1, 7, M1, M1, -7, v - M1, mKorpus);
  // Top back cross rail (drop down 5cm for back clearance)
  addBox(group, s - 2 * M1, 7, M1, M1, -d, v - M1 - 5, mKorpus);
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

function buildDoors(group, s, v, c, brvr, mFront, settings) {
  if (!settings.front_vrata || brvr <= 0) return;
  const dw = s / brvr - 0.3;
  const dh = v - c - 0.3;
  for (let i = 0; i < brvr; i++) {
    const dx = 0.15 + i * (s / brvr);
    addBox(group, dw, MDF, dh, dx, -d_from_door(s, v, c, brvr), c, mFront);
  }
}

// Helper: doors sit right in front of corpus
function d_from_door(s, v, c, brvr) {
  return 0; // relative offset handled inside buildDoors callers
}

function getHandleX(dx, dw, i, brvr) {
  if (brvr === 1) return dx + dw - 5;
  return (i < brvr / 2) ? dx + dw - 5 : dx + 5;
}

// ─── Handle (decorative bar) ──────────────────────────────────────────────────
function addHandle(group, x, y, z, horizontal = false) {
  const len = 18.6, r = 0.4;
  const geo = new THREE.CylinderGeometry(r, r, len, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xC0C0C0, roughness: 0.2, metalness: 0.9
  });
  const mesh = new THREE.Mesh(geo, mat);
  if (horizontal) {
    mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x + len / 2, z, y);
  } else {
    mesh.position.set(x, z + len / 2, y);
  }
  group.add(mesh);
}

// ─── PVC Legs ─────────────────────────────────────────────────────────────────
function addLegs(group, s, c, depth, customPositions = null) {
  const r = 1.5, h = c;
  const geo = new THREE.CylinderGeometry(r, r, h, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.3, metalness: 0.5 });
  const positions = customPositions || [
    [3, depth - 5.5],
    [s - 3, depth - 5.5],
    [3, 5.5],
    [s - 3, 5.5]
  ];
  for (const [px, py] of positions) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, h / 2, py);
    group.add(m);
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
  const g = new THREE.Group();
  const mK = mats.korpus, mF = mats.front;

  buildCorpus(g, s, v, d, c, mK, settings);
  buildShelves(g, s, v, d, c, brp, mK, settings);

  // Doors
  if (settings.front_vrata && brvr > 0) {
    const dw = s / brvr - 0.3;
    const dh = v - c - 0.3;
    for (let i = 0; i < brvr; i++) {
      const dx = 0.15 + i * (s / brvr);
      addBox(g, dw, MDF, dh, dx, -d - MDF, c, mF);
      // Handle
      let hx = getHandleX(dx, dw, i, brvr);
      addHandle(g, hx, d + MDF + 0.1, c + dh - 18.6 / 2 - 5, false);
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
  const g = new THREE.Group();
  const mK = mats.korpus, mF = mats.front;

  // Corpus
  addBox(g, M1, d, v - c, 0, -d, c, mK);
  addBox(g, M1, d, v - c, s - M1, -d, c, mK);
  addBox(g, s - 2 * M1, d, M1, M1, -d, c, mK);
  addBox(g, s - 2 * M1, 7, M1, M1, -7, v - M1, mK);
  addBox(g, s - 2 * M1, 7, M1, M1, -d, v - M1 - 5, mK);
  if (settings.pozadina) addBox(g, s, HDF, v - c, 0, 0, c, mK);

  buildShelves(g, s, v, d, c, brp, mK, settings);

  if (settings.front_vrata && brvr > 0) {
    const dw = s / brvr - 0.3;
    const dh = v - c - 3.3;
    for (let i = 0; i < brvr; i++) {
      addBox(g, dw, MDF, dh, 0.15 + i * (s / brvr), -d - MDF, c, mF);
    }
  }
  addLegs(g, s, c, d);
  return g;
}

/**
 * fiokar — drawer unit
 */
function build_fiokar(p, mats, settings) {
  const { s, v, d, c, brf = 4, brfp = 2, brfd = 1 } = p;
  const g = new THREE.Group();
  const mK = mats.korpus, mF = mats.front;
  const kl = 50; // drawer depth (cm)

  buildCorpus(g, s, v, d, c, mK, settings);

  // Drawer fronts
  if (settings.celafioka && brf > 0) {
    const fh_deep = (v - c) / brf * 2 - 0.3;
    const fh_shrt = (v - c) / brf - 0.3;
    const fw = s - 0.3;

    // Deep drawer front (bottom)
    addBox(g, fw, MDF, fh_deep, 0.15, -d - MDF, c, mF);
    addHandle(g, s / 2 - 9.3, d + MDF + 0.1, c + fh_deep - 5, true);

    // Shallow drawer fronts (above)
    for (let k = 2; k < brf; k++) {
      const pom = (v - c) / brf;
      addBox(g, fw, MDF, fh_shrt - 0.3, 0.15, -d - MDF, c + k * pom, mF);
      addHandle(g, s / 2 - 9.3, d + MDF + 0.1, c + k * pom + fh_shrt - 5, true);
    }
  }

  // Drawer boxes (visible interior)
  if (settings.fioke) {
    const pom = (v - c) / brf;
    const dboxH = (v - c) / brf * 2 - 5.8;
    const dboxSide = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });

    for (let i = 0; i <= 0; i++) {
      // Sides
      addBox(g, M, kl - 0.8, dboxH, M1 + 0.4, -d, c + 1.2 + i * pom, dboxSide);
      addBox(g, M, kl - 0.8, dboxH, s - M1 - M - 0.4, -d, c + 1.2 + i * pom, dboxSide);
    }
  }

  addLegs(g, s, c, d);
  return g;
}

/**
 * fiokar_gola — bare drawer unit (taller variant)
 */
function build_fiokar_gola(p, mats, settings) {
  const q = { ...p, brf: p.brf || 4, brfp: p.brfp || 2, brfd: p.brfd || 1 };
  return build_fiokar(q, mats, settings); // Same visual structure
}

/**
 * vrata_sudo_masine — dishwasher door panel
 */
function build_vrata_sudo_masine(p, mats, settings) {
  const { s, v, d, c } = p;
  const g = new THREE.Group();
  const mK = mats.korpus;

  // Side walls (open front - dishwasher space)
  addBox(g, M1, d, v - c, 0, -d, c, mK);
  addBox(g, M1, d, v - c, s - M1, -d, c, mK);

  if (settings.front_vrata) {
    const dw = s - 0.3;
    const dh = v - c - 0.3;
    addBox(g, dw, MDF, dh, 0.15, -d - MDF, c, mats.front);
    addHandle(g, s / 2 - 9.3, d + MDF + 0.1, v - 5, true);
  }
  return g;
}

/**
 * radni_stol_rerne — cabinet with oven cutout
 */
function build_radni_stol_rerne(p, mats, settings) {
  const { s, v, d, c, rerna = 58.5 } = p;
  const g = new THREE.Group();
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

  // Drawer front (below oven)
  if (settings.celafioka) {
    const fh = v - c - M1 - rerna - 0.3;
    if (fh > 0) {
      addBox(g, s - 0.3, MDF, fh, 0.15, -d - MDF, c, mF);
      addHandle(g, s / 2 - 9.3, d + MDF + 0.1, c + fh / 2, true);
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
  const g = new THREE.Group();
  const mBody = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.5 });
  const mTop  = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.2 });
  addBox(g, s, d, v, 0, -d, 0, mBody);
  addBox(g, s, d, 0.5, 0, -d, v, mTop);
  return g;
}

/**
 * samostojeci_frizider — standalone fridge placeholder
 */
function build_samostojeci_frizider(p, mats, settings) {
  const { s = 60, v = 185, d = 65 } = p;
  const g = new THREE.Group();
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
  const g = new THREE.Group();
  const mK = mats.korpus, mF = mats.front;

  // Long side corpus
  addBox(g, M1, d, v - c, 0, -d, c, mK);           // left
  addBox(g, M1, d, v - c, dss - M1, -d, c, mK);    // right
  addBox(g, dss - 2 * M1, d, M1, M1, -d, c, mK);   // bottom
  addBox(g, dss - 2 * M1, 7, M1, M1, -7, v - M1, mK); // top front
  addBox(g, dss - 2 * M1, 7, M1, M1, -d, v - M1, mK); // top back

  // Short side corpus (perpendicular)
  addBox(g, d, M1, v - c, 0, -lss, c, mK);         // back of short side
  addBox(g, d, lss - d - M1, M1, 0, -lss + M1, c, mK); // bottom short side
  addBox(g, 7, lss - d - M1, M1, 0, -lss + M1, v - M1, mK); // top left short
  addBox(g, 7, lss - d - M1, M1, d - 7, -lss + M1, v - M1, mK); // top right short

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

  // Doors
  if (settings.front_vrata) {
    // Long side door
    const ldw = dss - d - MDF - 0.3;
    const dh = v - c - 0.3;
    addBox(g, ldw, MDF, dh, 0.15 + d + MDF, -d - MDF, c, mF);
    // Short side door (rotated 90°)
    const sdw = lss - d - MDF - 0.3;
    addBox(g, MDF, sdw, dh, -MDF, -lss + 0.15, c, mF);
    addHandle(g, dss - 5, d + MDF + 0.1, v - 18.6 / 2 - 5, false);
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

// 45° corner cabinet
function build_donji_ugaoni_element_45(p, mats, settings) {
  const { dss, lss, v, d, c } = p;
  const g = new THREE.Group();
  const mK = mats.korpus, mF = mats.front;

  // Two straight sides
  addBox(g, M1, d, v - c, dss - M1, -d, c, mK);
  addBox(g, d, M1, v - c, 0, -lss, c, mK);

  // EXTREME PRECISION: 1:1 SCAD polygon for the bottom
  // SCAD: polygon(points=[[0,0],[0,-lss+m1],[d,-lss+m1],[dss-m1,-d],[dss-m1,0]]);
  const botShape = new THREE.Shape();
  botShape.moveTo(0, 0);
  botShape.lineTo(0, -lss + M1);
  botShape.lineTo(d, -lss + M1);
  botShape.lineTo(dss - M1, -d);
  botShape.lineTo(dss - M1, 0);
  botShape.lineTo(0, 0);

  const extGeo = new THREE.ExtrudeGeometry(botShape, { depth: M1, bevelEnabled: false });
  // Extrude points along +Z, but we want it flat like SCAD (laying on XY and extruded across Z)
  extGeo.rotateX(Math.PI / 2); // Lay it flat
  extGeo.translate(0, c + M1, 0); // Push to 'c' height
  const botMesh = new THREE.Mesh(extGeo, mK);
  extGeo.computeVertexNormals();
  g.add(botMesh);

  // Stranica u uglu (SCAD: cube([150, m1, v-c-2*m1]) @ [0,-m1,c+m1])
  addBox(g, 15, M1, v - c - 2 * M1, 0, -M1, c + M1, mK);

  // Top rails
  // traverzna kraca
  addBox(g, 7, lss - M1, M1, 7, -lss + M1, v - M1, mK);
  // traverzna
  addBox(g, dss - 7 - M1, 7, M1, 7, -7, v - M1, mK);

  if (settings.pozadina) {
    addBox(g, HDF, lss, v - c, -HDF, -lss, c, mK);
    addBox(g, dss, HDF, v - c, 0, 0, c, mK);
  }

  if (settings.polica) {
    addBox(g, d - 5, lss - M1, M1, 0, -lss + M1, c + (v - c) / 2 - M1, mK);
  }

  // Diagonal door (approximate)
  if (settings.front_vrata) {
    const angle = Math.atan2(lss - d, dss - d);
    const dw = Math.sqrt((lss - d) ** 2 + (dss - d) ** 2) - 0.3;
    const dh = v - c - 0.3;
    const geo = getCachedBox(dw, dh, MDF);
    const mesh = new THREE.Mesh(geo, mF);
    mesh.position.set(d + dw / 2 * Math.cos(angle), c + dh / 2, -(d + dw / 2 * Math.sin(angle)) - MDF / 2);
    mesh.rotation.y = angle;
    g.add(mesh);
    
    // Handle
    const len = 18.6, hr = 0.4;
    const hgeo = new THREE.CylinderGeometry(hr, hr, len, 8);
    const hmat = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, roughness: 0.2, metalness: 0.9 });
    const hmesh = new THREE.Mesh(hgeo, hmat);
    hmesh.position.set(dss - 5, v - 5, -(d + 5));
    hmesh.rotation.y = angle;
    g.add(hmesh);
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
  const g = new THREE.Group();
  const mK = mats.korpus, mF = mats.front;

  buildUpperCorpus(g, s, v, d, mK, settings);

  // Shelves
  if (settings.polica && brp > 0) {
    const sp = (v - M1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      addBox(g, s - 2 * M1, d - 3, M1, M1, -d + 3, i * sp, mK);
    }
  }

  // Doors
  if (settings.front_vrata && brvr > 0) {
    const dw = s / brvr - 0.3;
    const dh = v - 0.3;
    for (let i = 0; i < brvr; i++) {
      const dx = 0.15 + i * (s / brvr);
      addBox(g, dw, MDF, dh, dx, -d - MDF, 0, mF);
      let hx = getHandleX(dx, dw, i, brvr);
      addHandle(g, hx, d + MDF + 0.1, 18.6 / 2 + 5, false);
    }
  }
  return g;
}

function build_klasicna_viseca_gola(p, mats, settings) {
  const { s, v, d, brp = 2, brvr = 1 } = p;
  const g = new THREE.Group();
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
 * viseca_na_kipu — flip-up door wall cabinet
 */
function build_viseca_na_kipu(p, mats, settings) {
  const { s, v, d, brp = 2, brvr = 2 } = p;
  const g = new THREE.Group();
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

  // Horizontal flip-up doors
  if (settings.front_vrata) {
    const dh = v / 2 - 0.3;
    const dw = s - 0.3;
    const sp = v / brvr;
    for (let i = 0; i < brvr; i++) {
      addBox(g, dw, MDF, dh, 0.15, -d - MDF, 0.15 + i * sp, mF);
      addHandle(g, s / 2 - 9.3, d + MDF + 0.1, 5 + i * sp, true);
    }
  }
  return g;
}

/**
 * gue90 — corner upper cabinet 90°
 */
function build_gue90(p, mats, settings) {
  const { sl, sd, v, d, brp = 1 } = p;
  const g = new THREE.Group();
  const mK = mats.korpus, mF = mats.front;

  // Long side
  addBox(g, M1, d, v, sl - M1, -d, 0, mK);
  addBox(g, M1, d, v, 0, -d, 0, mK);
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
  const g = new THREE.Group();
  addBox(g, l, d, debljina, 0, -d, 0, mats.radna);
  return g;
}

/**
 * cokla — plinth/kickboard
 */
function build_cokla(p, mats, settings) {
  const { l, h = 9.5, debljina = 1.8 } = p;
  const g = new THREE.Group();
  addBox(g, l, debljina, h, 0, -(debljina + 5.5), 0, mats.cokla);
  return g;
}

/**
 * ormar_visoki — tall wardrobe/larder unit
 */
function build_ormar_visoki(p, mats, settings) {
  const { s, v, d, c, brp = 4, brvr = 2 } = p;
  const g = new THREE.Group();
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
      let hx = getHandleX(dx, dw, i, brvr);
      addHandle(g, hx, d + MDF + 0.1, c + dh - 18.6 / 2 - 5, false);
    }
  }
  addLegs(g, s, c, d);
  return g;
}

function build_radni_stol_pored_stuba(p, mats, settings) {
  const { s, v, d, c, brp = 1, brv = 2, ss = 20, ds = 17, vs = 250 } = p;
  // Simplified: just a base cabinet (stub handling approximate)
  return build_radni_stol({ s, v, d, c, brvr: brv, brp }, mats, settings);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPATCH TABLE
// ═══════════════════════════════════════════════════════════════════════════════

const BUILDERS = {
  radni_stol:                              build_radni_stol,
  gola_radni_stol:                         build_gola_radni_stol,
  fiokar:                                  build_fiokar,
  fiokar_gola:                             build_fiokar_gola,
  vrata_sudo_masine:                       build_vrata_sudo_masine,
  vrata_sudo_masine_gola:                  build_vrata_sudo_masine,
  radni_stol_rerne:                        build_radni_stol_rerne,
  radni_stol_rerne_gola:                   build_radni_stol_rerne,
  sporet:                                  build_sporet,
  samostojeci_frizider:                    build_samostojeci_frizider,
  dug_element_90:                          build_dug_element_90,
  dug_element_90_gola:                     build_dug_element_90,
  donji_ugaoni_element_45_sa_plocom:       build_donji_ugaoni_element_45,
  donji_ugaoni_element_45_sa_plocom_gola:  build_donji_ugaoni_element_45,
  klasicna_viseca:                         build_klasicna_viseca,
  klasicna_viseca_gola:                    build_klasicna_viseca_gola,
  klasicna_viseca_gola_ispod_grede:        build_klasicna_viseca_gola,
  viseca_na_kipu:                          build_viseca_na_kipu,
  viseca_na_kipu_gola:                     build_viseca_na_kipu,
  gue90:                                   build_gue90,
  radni_stol_pored_stuba:                  build_radni_stol_pored_stuba,
  ormar_visoki:                            build_ormar_visoki,
  radna_ploca:                             build_radna_ploca,
  cokla:                                   build_cokla
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
    return fallbackBox(params);
  }

  const mats = {
    front:  createMaterial(materialDefs.front),
    korpus: createMaterial(materialDefs.korpus),
    radna:  createMaterial(materialDefs.radna),
    granc:  createMaterial(materialDefs.granc),
    cokla:  createMaterial(materialDefs.cokla)
  };

  // Convert numeric params
  const p = {};
  for (const [k, v] of Object.entries(params)) {
    const n = parseFloat(v);
    p[k] = isNaN(n) ? v : n;
  }

  const group = builder(p, mats, settings);
  group.name = name;

  // Apply position and rotation
  group.position.set(posX, posZ, -posY); // SCAD → Three.js coord mapping
  group.rotation.y = -rotDeg * (Math.PI / 180);

  return group;
}

function fallbackBox(params) {
  const s = parseFloat(params.s || params.sl || params.dss || 60);
  const v = parseFloat(params.v || 82);
  const d = parseFloat(params.d || 55);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x888888, wireframe: true });
  addBox(g, s, d, v, 0, -d, 0, mat);
  return g;
}
