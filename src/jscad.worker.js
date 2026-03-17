/**
 * jscad.worker.js — Web Worker for JSCAD cylinder/polygon operations
 *
 * Runs JSCAD boolean union + polygon→triangle conversion off the main thread.
 * Receives serialized geometry specs, posts back raw Float32Array buffers that
 * the main thread assembles into THREE.BufferGeometry objects.
 *
 * Message in:
 *   { id, ops: Array<GeomSpec> }
 *   GeomSpec: { type:'cylinder'|'polygon', matKey, ...params }
 *
 * Message out (on success):
 *   { id, results: Array<{ matKey, positions: Float32Array, normals: Float32Array }> }
 *
 * Message out (on error):
 *   { id, error: string }
 */

// Import JSCAD UMD bundle — path is relative to the HTML file in Electron file:// context.
// Workers in Electron inherit the same base URL as the renderer.
importScripts('../node_modules/@jscad/modeling/dist/jscad-modeling.min.js');

const { primitives, transforms, booleans, extrusions } = self.jscadModeling;
const { cylinder, polygon } = primitives;
const { translate, rotateX, rotateY } = transforms;
const { union } = booleans;
const { extrudeLinear } = extrusions;

// ── Geometry spec builders ────────────────────────────────────────────────────

function buildGeomFromSpec(spec) {
  if (spec.type === 'cylinder') {
    let g = cylinder({ radius: spec.radius, height: spec.height, segments: spec.segments || 16 });
    if (spec.rotateX != null) g = rotateX(spec.rotateX, g);
    if (spec.rotateY != null) g = rotateY(spec.rotateY, g);
    if (spec.translate) g = translate(spec.translate, g);
    return g;
  }
  if (spec.type === 'polygon') {
    let g = polygon({ points: spec.points });
    g = extrudeLinear({ height: spec.extrudeHeight }, g);
    if (spec.rotateX != null) g = rotateX(spec.rotateX, g);
    if (spec.translate) g = translate(spec.translate, g);
    return g;
  }
  throw new Error('Unknown geom spec type: ' + spec.type);
}

// ── Polygon→triangle conversion (no THREE dependency) ────────────────────────

function geom3ToBuffers(geom) {
  const polygons = geom.polygons;
  const posArr = [];
  const normArr = [];

  for (let i = 0; i < polygons.length; i++) {
    const verts = polygons[i].vertices;
    if (verts.length < 3) continue;

    // Flat normal via cross product of first two edges
    const ax = verts[1][0] - verts[0][0], ay = verts[1][1] - verts[0][1], az = verts[1][2] - verts[0][2];
    const bx = verts[2][0] - verts[0][0], by = verts[2][1] - verts[0][1], bz = verts[2][2] - verts[0][2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len; ny /= len; nz /= len;

    // Fan triangulation
    for (let j = 1; j < verts.length - 1; j++) {
      posArr.push(
        verts[0][0], verts[0][1], verts[0][2],
        verts[j][0], verts[j][1], verts[j][2],
        verts[j+1][0], verts[j+1][1], verts[j+1][2]
      );
      normArr.push(
        nx, ny, nz,
        nx, ny, nz,
        nx, ny, nz
      );
    }
  }

  return {
    positions: new Float32Array(posArr),
    normals: new Float32Array(normArr)
  };
}

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = function(e) {
  const { id, groups } = e.data;
  // groups: Array<{ matKey, specs: GeomSpec[] }>

  try {
    const results = [];
    const transferables = [];

    for (const group of groups) {
      const geoms = group.specs.map(buildGeomFromSpec);
      if (geoms.length === 0) continue;
      const unified = geoms.length === 1 ? geoms[0] : union(geoms);
      const { positions, normals } = geom3ToBuffers(unified);
      results.push({ matKey: group.matKey, positions, normals });
      transferables.push(positions.buffer, normals.buffer);
    }

    self.postMessage({ id, results }, transferables);
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
