/**
 * viewer.js
 * Three.js 3D scene setup for the kitchen configurator.
 * Uses OrbitControls, PBR lighting, environment lighting, grid.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

let scene, camera, renderer, labelRenderer, controls, animId;
let ambientLight, keyLight, fillLight;
let gridHelper, floorMesh, wallMesh;
let sideWallLeft = null, sideWallRight = null;

// Fixture marker groups keyed by fixture index
const fixtureMarkers = new Map();

// All module groups in the scene (key = plan index)
const moduleGroups = new Map();

/**
 * initViewer — initialize Three.js scene in the given canvas element.
 * @param {HTMLCanvasElement} canvas
 */
export function initViewer(canvas) {
  // ─ Scene ────────────────────────────────────────────────────────────────────
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a14);
  scene.fog = new THREE.Fog(0x0a0a14, 600, 2000);

  // ─ Camera ───────────────────────────────────────────────────────────────────
  const w = canvas.clientWidth || 800;
  const h = canvas.clientHeight || 500;
  camera = new THREE.PerspectiveCamera(45, w / h, 0.5, 5000);
  camera.position.set(250, 200, 400);
  camera.lookAt(150, 90, 0);

  // ─ Renderer ─────────────────────────────────────────────────────────────────
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // ─ Label Renderer ──────────────────────────────────────────────────────────
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(w, h);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.pointerEvents = 'none';
  canvas.parentElement.appendChild(labelRenderer.domElement);

  // ─ Lights ───────────────────────────────────────────────────────────────────
  ambientLight = new THREE.AmbientLight(0x8090c0, 0.6);
  scene.add(ambientLight);

  // Key light (from front-left-above)
  keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(300, 500, 300);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 10;
  keyLight.shadow.camera.far = 2000;
  keyLight.shadow.camera.left = -800;
  keyLight.shadow.camera.right = 800;
  keyLight.shadow.camera.top = 800;
  keyLight.shadow.camera.bottom = -800;
  keyLight.shadow.bias = -0.0003;
  scene.add(keyLight);

  // Fill light (from right)
  fillLight = new THREE.DirectionalLight(0x6080ff, 0.6);
  fillLight.position.set(-200, 200, 100);
  scene.add(fillLight);

  // Back rim light
  const rim = new THREE.DirectionalLight(0xffffff, 0.4);
  rim.position.set(0, 100, -300);
  scene.add(rim);

  // ─ Floor / Grid ─────────────────────────────────────────────────────────────
  const floorGeo = new THREE.PlaneGeometry(2400, 2400);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0d0d20,
    roughness: 0.95,
    metalness: 0.0
  });
  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Wall surface (XZ plane at Y=0 behind cabinets)
  const wallGeo = new THREE.PlaneGeometry(2400, 1200);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f0f22, roughness: 1.0 });
  wallMesh = new THREE.Mesh(wallGeo, wallMat);
  wallMesh.position.set(500, 250, 0);
  wallMesh.receiveShadow = true;
  scene.add(wallMesh);

  // Grid on floor (size 2400 with 40 divisions = 60cm spacing)
  gridHelper = new THREE.GridHelper(2400, 40, 0x1a1a3a, 0x141428);
  gridHelper.position.y = 0.1;
  scene.add(gridHelper);

  // Axis indicator (small, at origin)
  addAxisHelper();

  // ─ Controls ─────────────────────────────────────────────────────────────────
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 + 0.1;
  controls.minDistance = 20;
  controls.maxDistance = 1500;
  controls.target.set(150, 90, 0);
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  };
  controls.update();

  // ─ Resize ───────────────────────────────────────────────────────────────────
  const ro = new ResizeObserver(() => resizeViewer());
  ro.observe(canvas.parentElement);

  // ─ Render Loop ──────────────────────────────────────────────────────────────
  function animate() {
    animId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    if (labelRenderer) labelRenderer.render(scene, camera);
  }
  animate();

  return { scene, camera, renderer, controls };
}

/**
 * setViewerTheme — update 3D scene colors to match dark or light UI theme.
 * @param {'dark'|'light'} theme
 */
export function setViewerTheme(theme) {
  if (!scene || !renderer) return;

  if (theme === 'light') {
    scene.background = new THREE.Color(0xdfe0f0);
    scene.fog = new THREE.Fog(0xdfe0f0, 600, 2000);
    if (floorMesh) floorMesh.material.color.set(0xd0d0e8);
    if (wallMesh) wallMesh.material.color.set(0xe8e8f4);
    if (sideWallLeft) sideWallLeft.material.color.set(0xe8e8f4);
    if (sideWallRight) sideWallRight.material.color.set(0xe8e8f4);
    if (gridHelper) {
      gridHelper.material.color?.set(0xb0b0cc);
      gridHelper.material.opacity = 0.6;
      gridHelper.material.transparent = true;
    }
    scene.traverse(obj => {
      if (obj.isAmbientLight) obj.intensity = 1.2;
      if (obj.isDirectionalLight && obj.position.z > 0) obj.intensity = 1.2;
    });
  } else {
    scene.background = new THREE.Color(0x0a0a14);
    scene.fog = new THREE.Fog(0x0a0a14, 600, 2000);
    if (floorMesh) floorMesh.material.color.set(0x0d0d20);
    if (wallMesh) wallMesh.material.color.set(0x0f0f22);
    if (sideWallLeft) sideWallLeft.material.color.set(0x0f0f22);
    if (sideWallRight) sideWallRight.material.color.set(0x0f0f22);
    if (gridHelper) {
      gridHelper.material.color?.set(0x1a1a3a);
      gridHelper.material.opacity = 1.0;
      gridHelper.material.transparent = false;
    }
    scene.traverse(obj => {
      if (obj.isAmbientLight) obj.intensity = 0.6;
      if (obj.isDirectionalLight && obj.position.z > 0) obj.intensity = 1.8;
    });
  }
}

/**
 * setLayoutWalls — add or remove side walls based on the active layout.
 * @param {'galley'|'l-shape'|'u-shape'} layout
 * @param {{ side?:'left'|'right', leftDepth:number, rightDepth:number, totalWidth:number, isDark:boolean }} opts
 */
export function setLayoutWalls(layout, opts = {}) {
  const { side = 'left', leftDepth = 150, rightDepth = 150, totalWidth = 300, isDark = true } = opts;
  const wallColor = isDark ? 0x0f0f22 : 0xe8e8f4;
  const wallH = 1200;

  function makeSideWall(depth) {
    const geo = new THREE.PlaneGeometry(depth, wallH);
    const mat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 1.0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  // Remove existing side walls
  if (sideWallLeft) { scene.remove(sideWallLeft); sideWallLeft.geometry.dispose(); sideWallLeft.material.dispose(); sideWallLeft = null; }
  if (sideWallRight) { scene.remove(sideWallRight); sideWallRight.geometry.dispose(); sideWallRight.material.dispose(); sideWallRight = null; }

  const needLeft  = layout === 'u-shape' || (layout === 'l-shape' && side === 'left');
  const needRight = layout === 'u-shape' || (layout === 'l-shape' && side === 'right');

  if (needLeft) {
    sideWallLeft = makeSideWall(leftDepth);
    // Plane faces +Z by default. Rotate so it faces +X (toward the room).
    sideWallLeft.rotation.y = Math.PI / 2;
    // Center the plane: X=0 (left wall), Y=wallH/2 (mid height), Z=-leftDepth/2 (into room)
    sideWallLeft.position.set(0, wallH / 2, -leftDepth / 2);
    scene.add(sideWallLeft);
  }

  if (needRight) {
    sideWallRight = makeSideWall(rightDepth);
    // Rotate so it faces -X (toward the room from the right).
    sideWallRight.rotation.y = -Math.PI / 2;
    sideWallRight.position.set(totalWidth, wallH / 2, -rightDepth / 2);
    scene.add(sideWallRight);
  }
}

/** Handle canvas resize */
export function resizeViewer() {
  if (!renderer || !camera) return;
  const canvas = renderer.domElement;
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  if (labelRenderer) labelRenderer.setSize(w, h);
}

/** Add a module group to the scene at a given plan index. */
export function addModuleGroup(index, group) {
  removeModuleGroup(index);
  moduleGroups.set(index, group);
  scene.add(group);
}

/** Remove a module group from the scene. */
export function removeModuleGroup(index) {
  if (moduleGroups.has(index)) {
    const g = moduleGroups.get(index);
    scene.remove(g);
    disposeGroup(g);
    moduleGroups.delete(index);
  }
}

/**
 * moveModuleGroup — update position/rotation of an existing group without rebuilding geometry.
 * Use this instead of buildKitchenModule when only pos/rot changed.
 * @param {number} index - plan index
 * @param {number} posX, posY, posZ - world position in cm
 * @param {number} rotDeg - Y-axis rotation in degrees
 * @returns {boolean} true if the group existed and was moved
 */
export function moveModuleGroup(index, posX, posY, posZ, rotDeg) {
  const g = moduleGroups.get(index);
  if (!g) return false;
  g.position.set(posX, posZ, -posY + 0.1);
  g.rotation.y = -rotDeg * (Math.PI / 180);
  return true;
}

/**
 * shiftModuleGroups — shift indices after a deletion
 * @param {number} deletedIdx
 */
export function shiftModuleGroups(deletedIdx) {
  const indices = Array.from(moduleGroups.keys()).sort((a,b) => a-b);
  for (const idx of indices) {
    if (idx > deletedIdx) {
      const g = moduleGroups.get(idx);
      moduleGroups.delete(idx);
      moduleGroups.set(idx - 1, g);
    }
  }
}

// ─── Fixture Markers ──────────────────────────────────────────────────────────

/**
 * Add or replace a fixture marker in the scene.
 * @param {number} index  - fixture index in state.wallFixtures
 * @param {{ x:number, y:number, width?:number, height?:number, type:string, color:number, label:string }} fixture
 */
export function addFixtureMarker(index, fixture) {
  removeFixtureMarker(index);

  const group = new THREE.Group();
  const w = fixture.width || 80;
  const h = fixture.height || 120;

  if (fixture.type === 'window') {
    // --- Window Glass ---
    const glassGeo = new THREE.PlaneGeometry(w - 4, h - 4);
    const glassMat = new THREE.MeshBasicMaterial({
      color: 0x90caf9,
      opacity: 0.4,
      transparent: true,
      side: THREE.DoubleSide
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(w / 2, h / 2, 0.5);
    group.add(glass);

    // --- Window Frame (White) ---
    const frameMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Outer frame (4 strips)
    const frameThickness = 3;
    const addStrip = (sw, sh, px, py) => {
      const g = new THREE.PlaneGeometry(sw, sh);
      const m = new THREE.Mesh(g, frameMat);
      m.position.set(px, py, 0.6);
      group.add(m);
    };

    addStrip(w, frameThickness, w / 2, frameThickness / 2); // Bottom
    addStrip(w, frameThickness, w / 2, h - frameThickness / 2); // Top
    addStrip(frameThickness, h, frameThickness / 2, h / 2); // Left
    addStrip(frameThickness, h, w - frameThickness / 2, h / 2); // Right

    // Inner Cross
    addStrip(w - 2 * frameThickness, 1, w / 2, h / 2); // Horizontal
    addStrip(1, h - 2 * frameThickness, w / 2, h / 2); // Vertical

    group.position.set(fixture.x, fixture.y, 1);

  } else if (fixture.type === 'door') {
    // --- Door Main Body ---
    const bodyGeo = new THREE.PlaneGeometry(w - 2, h - 1);
    const bodyMat = new THREE.MeshBasicMaterial({
      color: 0x5d4037, // Brighter brownish
      side: THREE.DoubleSide
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(w / 2, h / 2, 0.5);
    group.add(body);

    // --- Door Frame (Darker) ---
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x3e2723 });
    const ft = 2; // Frame thickness
    const addFrame = (sw, sh, px, py) => {
      const g = new THREE.PlaneGeometry(sw, sh);
      const m = new THREE.Mesh(g, frameMat);
      m.position.set(px, py, 0.6);
      group.add(m);
    };
    addFrame(w, ft, w / 2, h - ft / 2); // Top
    addFrame(ft, h, ft / 2, h / 2); // Left
    addFrame(ft, h, w - ft / 2, h / 2); // Right

    // --- Handle (Knob) ---
    const handleGeo = new THREE.SphereGeometry(2, 8, 8);
    const handleMat = new THREE.MeshBasicMaterial({ color: 0xffd54f }); // Gold/Brass
    const handle = new THREE.Mesh(handleGeo, handleMat);
    // Position handle on the right side, mid-height
    handle.position.set(w - 10, h / 2, 2);
    group.add(handle);

    group.position.set(fixture.x, fixture.y, 1);

  } else {
    // Basic marker (disc + line)
    group.position.set(fixture.x, fixture.y, 1);


    // Disc
    const discGeo = new THREE.CircleGeometry(4, 16);
    const discMat = new THREE.MeshBasicMaterial({ color: fixture.color, depthTest: false });
    group.add(new THREE.Mesh(discGeo, discMat));

    // Ring
    const ringGeo = new THREE.RingGeometry(4, 5.5, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, side: THREE.DoubleSide });
    group.add(new THREE.Mesh(ringGeo, ringMat));

    // Vertical dashed line up to floor level (thin box)
    const lineGeo = new THREE.BoxGeometry(0.5, fixture.y, 0.5);
    const lineMat = new THREE.MeshBasicMaterial({ color: fixture.color, opacity: 0.4, transparent: true, depthTest: false });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.set(0, -fixture.y / 2, 0);
    group.add(line);
  }

  scene.add(group);
  fixtureMarkers.set(index, group);
}

export function removeFixtureMarker(index) {
  if (fixtureMarkers.has(index)) {
    const g = fixtureMarkers.get(index);
    scene.remove(g);
    g.traverse(c => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
    fixtureMarkers.delete(index);
  }
}

export function clearFixtureMarkers() {
  for (const idx of [...fixtureMarkers.keys()]) removeFixtureMarker(idx);
}

/** Rebuild all module groups (e.g. after settings change). */
export function clearAllGroups() {
  for (const [, g] of moduleGroups) {
    scene.remove(g);
    disposeGroup(g);
  }
  moduleGroups.clear();
}

/** Camera presets */
export function setCameraView(view) {
  const target = controls.target.clone();
  if (view === 'front') {
    camera.position.set(target.x, target.y + 60, 600);
  } else if (view === 'top') {
    camera.position.set(target.x, 700, target.z);
  } else { // iso
    camera.position.set(target.x + 250, target.y + 200, 400);
  }
  camera.lookAt(target);
  controls.target.copy(target);
  controls.update();
}

export function resetCamera() {
  controls.target.set(150, 90, 0);
  camera.position.set(250, 200, 400);
  camera.lookAt(150, 90, 0);
  controls.update();
}

/** 
 * mode: 'cool' | 'warm'
 */
export function setLightingMode(mode) {
  if (!ambientLight || !fillLight || !keyLight) return;
  if (mode === 'warm') {
    ambientLight.color.setHex(0xfff0dd);
    ambientLight.intensity = 0.8;
    fillLight.color.setHex(0xffccaa);
    fillLight.intensity = 0.5;
    keyLight.intensity = 2.0;
  } else {
    // Original blueish
    ambientLight.color.setHex(0x8090c0);
    ambientLight.intensity = 0.6;
    fillLight.color.setHex(0x6080ff);
    fillLight.intensity = 0.6;
    keyLight.intensity = 1.8;
  }
}

// ─── Highlight selected module ────────────────────────────────────────────────
let _highlightedIdx = -1;
const _originalColors = new Map();

export function highlightModule(index) {
  // Restore previous highlight
  if (_highlightedIdx >= 0 && moduleGroups.has(_highlightedIdx)) {
    restoreHighlight(_highlightedIdx);
  }
  _highlightedIdx = index;

  if (index < 0 || !moduleGroups.has(index)) return;
  const group = moduleGroups.get(index);
  group.traverse(child => {
    if (child.isMesh && child.material) {
      const origColor = child.material.color.clone();
      _originalColors.set(child.uuid, origColor);
      child.material = child.material.clone();
      child.material.emissive = new THREE.Color(0x1133aa);
      child.material.emissiveIntensity = 0.3;
    }
  });
}

function restoreHighlight(index) {
  if (!moduleGroups.has(index)) return;
  const group = moduleGroups.get(index);
  group.traverse(child => {
    if (child.isMesh && child.material) {
      child.material.emissiveIntensity = 0;
      child.material.emissive = new THREE.Color(0x000000);
    }
  });
  _originalColors.clear();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function addAxisHelper() {
  const g = new THREE.Group();

  const mkAxis = (color, dir) => {
    const mat = new THREE.LineBasicMaterial({ color });
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), dir]);
    return new THREE.Line(geo, mat);
  };

  g.add(mkAxis(0xff4444, new THREE.Vector3(30, 0, 0))); // X red
  g.add(mkAxis(0x44ff44, new THREE.Vector3(0, 30, 0))); // Y green
  g.add(mkAxis(0x4444ff, new THREE.Vector3(0, 0, 30))); // Z blue
  g.position.set(0, 1, 0);
  scene.add(g);
}

function disposeGroup(group) {
  group.traverse(child => {
    if (child.isMesh) {
      // Only dispose geometry — materials are shared from cache, do not dispose
      child.geometry?.dispose();
    }
  });
}

/**
 * getModuleGroup — retrieve the THREE.Group for a module index.
 */
export function getModuleGroup(idx) {
  return moduleGroups.get(idx);
}

/**
 * getModuleSnapInfoAt — find module intersection details.
 * @returns { {index:number, normal:THREE.Vector3, point:THREE.Vector3} | null }
 */
export function getModuleSnapInfoAt(x, y) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(x, y);
  raycaster.setFromCamera(mouse, camera);

  const targets = Array.from(moduleGroups.values());
  const intersects = raycaster.intersectObjects(targets, true);

  if (intersects.length > 0) {
    const inter = intersects[0];
    let obj = inter.object;
    let foundIdx = -1;

    // Traverse up to find the group with planIndex or match in moduleGroups
    for (const [idx, group] of moduleGroups.entries()) {
      let isAncestor = false;
      group.traverse(child => { if (child === inter.object) isAncestor = true; });
      if (isAncestor) {
        foundIdx = idx;
        break;
      }
    }

    if (foundIdx === -1) return null;

    // Convert local normal to world normal
    const worldNormal = inter.face.normal.clone();
    worldNormal.transformDirection(inter.object.matrixWorld);

    return { 
      index: foundIdx, 
      normal: worldNormal, 
      point: inter.point 
    };
  }
  return null;
}

/**
 * getModuleIndexAt — find which module is at the given normalized mouse coordinates.
 * @param {number} x - Normalized x (-1 to 1)
 * @param {number} y - Normalized y (-1 to 1)
 * @returns {number|null} index of the module in moduleGroups, or null
 */
export function getModuleIndexAt(x, y) {
  const info = getModuleSnapInfoAt(x, y);
  return info ? info.index : null;
}

// ─── Measurements ─────────────────────────────────────────────────────────────
let activeLabels = [];

/**
 * showMeasurements — display dimension labels for a specific module
 */
export function showMeasurements(index, { s, v, d }) {
  clearMeasurements();
  const group = moduleGroups.get(index);
  if (!group) return;

  // Update world matrices for accurate bounding box
  group.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const mkLabel = (text, pos) => {
    const div = document.createElement('div');
    div.className = 'measure-label';
    div.textContent = text;
    const label = new CSS2DObject(div);
    label.position.copy(pos);
    scene.add(label);
    activeLabels.push(label);
  };

  // Width label (centered above)
  mkLabel(`${Math.round(s)}cm`, new THREE.Vector3(center.x, box.max.y + 8, center.z));

  // Depth label (to the front)
  mkLabel(`${Math.round(d)}cm`, new THREE.Vector3(box.max.x + 8, center.y, center.z));

  // Height label (to the side)
  mkLabel(`${Math.round(v)}cm`, new THREE.Vector3(box.min.x - 12, center.y, center.z));
}

/**
 * clearMeasurements — remove all dimension labels from the scene
 */
export function clearMeasurements() {
  activeLabels.forEach(l => scene.remove(l));
  activeLabels = [];
}
