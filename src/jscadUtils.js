import * as THREE from 'three';

export function geom3ToThreeGeometry(geom) {
  // JSCAD @jscad/modeling geom3 is a collection of polygons.
  // Each polygon has vertices [x, y, z].
  const polygons = geom.polygons;
  
  const vertices = [];
  const normals = [];

  for (let i = 0; i < polygons.length; i++) {
    const p = polygons[i];
    const pVertices = p.vertices;
    if (pVertices.length < 3) continue;

    // Calculate normal for flat shading, basic cross product using first three vertices
    const v0 = new THREE.Vector3(pVertices[0][0], pVertices[0][1], pVertices[0][2]);
    const v1 = new THREE.Vector3(pVertices[1][0], pVertices[1][1], pVertices[1][2]);
    const v2 = new THREE.Vector3(pVertices[2][0], pVertices[2][1], pVertices[2][2]);
    
    v1.sub(v0);
    v2.sub(v0);
    const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();

    // Triangulate convex polygon (fan triangulation)
    for (let j = 1; j < pVertices.length - 1; j++) {
      vertices.push(
        ...pVertices[0],
        ...pVertices[j],
        ...pVertices[j + 1]
      );
      normals.push(
        normal.x, normal.y, normal.z,
        normal.x, normal.y, normal.z,
        normal.x, normal.y, normal.z
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  return geometry;
}
