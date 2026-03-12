/**
 * materials.js
 * Three.js material creation with color and procedural texture support.
 */

import * as THREE from 'three';
import { COLOR_PRESETS, TEXTURE_PRESETS } from './modules-config.js';

// Material cache to avoid duplicates
const _matCache = new Map();
const _texCache  = new Map();

/** Map from named color → hex */
export const COLOR_MAP = Object.fromEntries(
  COLOR_PRESETS.map(c => [c.name, c.hex])
);

/**
 * Generate a procedural wood-grain canvas texture.
 */
function makeWoodTexture(baseHex, grainHex) {
  const key = `wood_${baseHex}_${grainHex}`;
  if (_texCache.has(key)) return _texCache.get(key);

  const size = 512;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');

  // Background
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  // Grain lines
  ctx.strokeStyle = grainHex;
  for (let i = 0; i < 60; i++) {
    const y = (size / 60) * i + (Math.random() - 0.5) * 6;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.globalAlpha = 0.3 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(0) * 8);
    for (let x = 0; x <= size; x += 16) {
      ctx.lineTo(x, y + Math.sin(x / 80) * 10 + (Math.random() - 0.5) * 4);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  _texCache.set(key, tex);
  return tex;
}

/**
 * Generate a marble canvas texture.
 */
function makeMarbleTexture(baseHex, veinHex) {
  const key = `marble_${baseHex}_${veinHex}`;
  if (_texCache.has(key)) return _texCache.get(key);

  const size = 512;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  // Marble veins using Perlin-like noise (simple sinusoidal approximation)
  ctx.strokeStyle = veinHex;
  for (let i = 0; i < 12; i++) {
    const offset = Math.random() * size;
    const freq = 0.005 + Math.random() * 0.01;
    ctx.lineWidth = 0.5 + Math.random() * 2;
    ctx.globalAlpha = 0.2 + Math.random() * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, offset);
    for (let x = 0; x <= size; x += 4) {
      const y = offset + Math.sin(x * freq + i) * 60 + Math.sin(x * freq * 3 + i * 2) * 20;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  _texCache.set(key, tex);
  return tex;
}

/**
 * Generate a granite/concrete texture.
 */
function makeGraniteTexture(baseHex, speckHex) {
  const key = `granite_${baseHex}_${speckHex}`;
  if (_texCache.has(key)) return _texCache.get(key);

  const size = 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  // Random speckles
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = speckHex;
    ctx.globalAlpha = Math.random() * 0.5;
    const x = Math.random() * size, y = Math.random() * size;
    const r = Math.random() * 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  _texCache.set(key, tex);
  return tex;
}

/**
 * createMaterial — create a Three.js MeshStandardMaterial from a material definition.
 * @param {Object} def - { name, color (hex string), type: 'color'|'texture', textureName? }
 * @returns {THREE.MeshStandardMaterial}
 */
export function createMaterial(def) {
  if (!def) return new THREE.MeshStandardMaterial({ color: 0xf5f5f5 });

  const cacheKey = JSON.stringify(def);
  if (_matCache.has(cacheKey)) return _matCache.get(cacheKey);

  let mat;

  if (def.type === 'texture' && def.textureName) {
    const tp = TEXTURE_PRESETS.find(t => t.name === def.textureName);
    if (tp) {
      let map;
      if (tp.type === 'wood') {
        map = makeWoodTexture(tp.base, tp.grain);
        mat = new THREE.MeshStandardMaterial({
          map, roughness: 0.75, metalness: 0.0
        });
      } else if (tp.type === 'marble') {
        map = makeMarbleTexture(tp.base, tp.grain);
        mat = new THREE.MeshStandardMaterial({
          map, roughness: 0.15, metalness: 0.05
        });
      } else {
        map = makeGraniteTexture(tp.base, tp.grain);
        mat = new THREE.MeshStandardMaterial({
          map, roughness: 0.85, metalness: 0.0
        });
      }
    }
  }

  if (!mat) {
    // Solid color material
    const hex = def.color || '#F5F5F5';
    const threeColor = new THREE.Color(hex);

    // Determine surface properties by color brightness/name
    const brightness = threeColor.r * 0.299 + threeColor.g * 0.587 + threeColor.b * 0.114;
    const name = (def.name || '').toLowerCase();

    let roughness = 0.45;
    let metalness = 0.0;
    let envMapIntensity = 0.5;

    if (name.includes('silver') || name.includes('steel') || name.includes('chrome')) {
      roughness = 0.15; metalness = 0.85; envMapIntensity = 1.0;
    } else if (name.includes('gloss') || name === 'white' || name === 'black') {
      roughness = 0.1; metalness = 0.0; envMapIntensity = 0.8;
    } else if (name.includes('wood') || name.includes('oak') || name.includes('walnut')) {
      roughness = 0.8; metalness = 0.0;
    } else if (brightness > 0.8) {
      roughness = 0.15; // light colors tend to be gloss lacquer
    }

    mat = new THREE.MeshStandardMaterial({
      color: threeColor,
      roughness,
      metalness,
      envMapIntensity
    });
  }

  _matCache.set(cacheKey, mat);
  return mat;
}

/**
 * Update all materials in a group to new definitions.
 */
export function updateGroupMaterials(group, materialDefs) {
  // This is a full rebuild; simpler approach is to re-build the module.
  // For live updates, traverse and update color on materials.
  group.traverse(child => {
    if (child.isMesh && child.material) {
      // Not trivial to remap — caller should rebuild instead.
    }
  });
}

/** Dispose all cached textures and materials. */
export function disposeAllMaterials() {
  for (const mat of _matCache.values()) mat.dispose();
  for (const tex of _texCache.values()) tex.dispose();
  _matCache.clear();
  _texCache.clear();
}
