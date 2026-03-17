import * as THREE from 'three';
import { state } from './state.js';
import { pushHistory } from './state.js';
import { getModuleGroup, showMeasurements } from './viewer.js';
import { showNotification } from './notifications.js';
import { renderPlanList, updateModule3D } from './plan-manager.js';

export function setSnapAnchorByIndex(idx) {
  const group = getModuleGroup(idx);
  if (!group) return;
  group.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const info = { index: idx, normal: new THREE.Vector3(0, 0, -1), point: center };
  if (window._setSnapAnchor) window._setSnapAnchor(info);
}

export function snapModuleToSide(srcIdx, anchorIdx, anchorInfo, sourceInfo) {
  pushHistory();
  try {
    const anchor = state.plan[anchorIdx];
    const source = state.plan[srcIdx];
    const groupA = getModuleGroup(anchorIdx);
    const groupS = getModuleGroup(srcIdx);
    if (!anchor || !source || !groupA || !groupS) return;

    groupA.updateWorldMatrix(true, true);
    groupS.updateWorldMatrix(true, true);

    const nA = anchorInfo.normal.clone();
    const nS = sourceInfo.normal.clone();

    if (Math.abs(nA.y) < 0.5 && Math.abs(nS.y) < 0.5) {
      let angleTarget = Math.atan2(-nA.x, -nA.z);
      let angleSource = Math.atan2(nS.x, nS.z);
      let deltaRad = angleTarget - angleSource;
      let deltaDeg = Math.round((-deltaRad * 180 / Math.PI) / 90) * 90;
      source.r = (source.r + deltaDeg) % 360;
      if (source.r < 0) source.r += 360;
      groupS.rotation.set(0, -source.r * (Math.PI / 180), 0);
      groupS.updateMatrixWorld(true);
    }

    const boxA = new THREE.Box3().setFromObject(groupA);
    const boxS = new THREE.Box3().setFromObject(groupS);

    let shiftX = 0, shiftY = 0, shiftZ = 0;
    if (nA.x > 0.5)       shiftX = boxA.max.x - boxS.min.x;
    else if (nA.x < -0.5) shiftX = boxA.min.x - boxS.max.x;
    else if (nA.y > 0.5)  shiftY = boxA.max.y - boxS.min.y;
    else if (nA.y < -0.5) shiftY = boxA.min.y - boxS.max.y;
    else if (nA.z > 0.5)  shiftZ = boxA.max.z - boxS.min.z;
    else if (nA.z < -0.5) shiftZ = boxA.min.z - boxS.max.z;

    let nx = source.pos[0] + shiftX;
    let ny = source.pos[1] - shiftZ;
    let nz = source.pos[2] + shiftY;

    if (Math.abs(nA.x) > 0.5) {
      let flush_shiftZ = boxA.max.z - boxS.max.z;
      ny = source.pos[1] - flush_shiftZ;
      let flush_shiftY = boxA.min.y - boxS.min.y;
      nz = source.pos[2] + flush_shiftY;
    } else if (Math.abs(nA.y) > 0.5) {
      let flush_shiftX = boxA.min.x - boxS.min.x;
      nx = source.pos[0] + flush_shiftX;
      let flush_shiftZ = boxA.max.z - boxS.max.z;
      ny = source.pos[1] - flush_shiftZ;
    } else if (Math.abs(nA.z) > 0.5) {
      let flush_shiftX = boxA.min.x - boxS.min.x;
      nx = source.pos[0] + flush_shiftX;
      let flush_shiftY = boxA.min.y - boxS.min.y;
      nz = source.pos[2] + flush_shiftY;
    }

    source.pos = [Math.round(nx * 10) / 10, Math.round(ny * 10) / 10, Math.round(nz * 10) / 10];

    updateModule3D(srcIdx);

    if (srcIdx === state.selectedPlanIdx) {
      const el_x = document.getElementById('pos-x');
      const el_y = document.getElementById('pos-y');
      const el_z = document.getElementById('pos-z');
      const el_r = document.getElementById('pos-r');
      if (el_x) el_x.value = source.pos[0];
      if (el_y) el_y.value = source.pos[1];
      if (el_z) el_z.value = source.pos[2];
      if (el_r) el_r.value = source.r;
    }

    renderPlanList();
    showNotification("Elementi precizno spojeni!", "success");
  } catch (err) {
    console.error("Snapping error:", err);
    showNotification("Greška pri spajanju elemenata.", "error");
  }
}
