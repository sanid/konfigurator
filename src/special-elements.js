import { state } from './state.js';
import { pushHistory } from './state.js';
import { buildKitchenModule } from './kitchen-builder.js';
import { addModuleGroup } from './viewer.js';
import { showNotification } from './notifications.js';
import { renderPlanList } from './plan-manager.js';
import { WALL_COLS } from './wall-grid.js';

export const CORNER_ELEMENT_NAMES = new Set([
  'dug_element_90', 'dug_element_90_gola',
  'dug_element_90_desni', 'dug_element_90_desni_gola',
  'donji_ugaoni_element_45_sa_plocom', 'donji_ugaoni_element_45_sa_plocom_gola'
]);

export function isCornerElement(entry) {
  return CORNER_ELEMENT_NAMES.has(entry.ime);
}

export function addSpecialElement(tip) {
  const [selRow, selCol] = state.selectedCell;
  const rowForCheck = (tip === 'radna_ploca' || tip === 'cokla') ? 2 : selRow;
  let totalLen = 0, startX = null, maxV = 0;
  for (let c = selCol; c <= WALL_COLS; c++) {
    const key = `${rowForCheck},${c}`;
    if (state.occupiedCells[key]) {
      const item = state.occupiedCells[key];
      const planItem = state.plan.find(m => m.mat_pos && m.mat_pos[0] === rowForCheck && m.mat_pos[1] === c);
      if (startX === null && planItem) startX = planItem.pos[0];
      if (planItem && planItem.p && planItem.p.v) {
        const pv = parseFloat(planItem.p.v);
        if (!isNaN(pv) && pv > maxV) maxV = pv;
      }
      totalLen += item.sirina;
    } else { break; }
  }
  if (maxV === 0) maxV = 82;
  const rot = parseFloat(document.getElementById('pos-r').value) || 0;

  _openInputModal(`Duzina ${tip} (cm):`, totalLen || 60, (val) => {
    const finalLen = parseFloat(val) || totalLen || 60;
    const x0 = startX !== null ? startX : (parseFloat(document.getElementById('pos-x').value) || 0);
    const y0 = parseFloat(document.getElementById('pos-y').value) || 0;
    const z0 = parseFloat(document.getElementById('pos-z').value) || 0;
    let p, pos;
    if (tip === 'radna_ploca') {
      const offY = rot === 0 ? -60 : 0;
      const offX = rot === 90 ? 60 : 0;
      p = { l: String(finalLen), d: '60', debljina: '3.8' };
      pos = [x0 + offX, y0 + offY, z0 + maxV];
    } else {
      const offY = rot === 0 ? -53 : 0;
      const offX = rot === 90 ? 53 : 0;
      p = { l: String(finalLen), h: '9.5', debljina: '1.8' };
      pos = [x0 + offX, y0 + offY, 0];
    }
    const entry = { ime: tip, p, pos, r: rot };
    state.plan.push(entry);
    const idx = state.plan.length - 1;
    try {
      const group = buildKitchenModule(entry.ime, entry.p, state.materials, state.settings, pos[0], pos[1], pos[2], rot);
      addModuleGroup(idx, group);
    } catch (e) { console.error('3D build failed for', entry.ime, e); }
    renderPlanList();
    showNotification('Dodano: ' + tip + ' L=' + finalLen, 'success');
  });
}

export function addRadnaPlocaToModule(idx) {
  const target = state.plan[idx];
  if (!target || target.ime === 'radna_ploca' || target.ime === 'cokla') return;
  if (!state.radnaPlocaSelection) state.radnaPlocaSelection = [];
  if (state.radnaPlocaSelection.length === 0) {
    state.radnaPlocaSelection.push(idx);
    import('./viewer.js').then(v => v.highlightModule(idx));
    showNotification(isCornerElement(target)
      ? 'Ugaoni element odabran. Dvoklikni isti ponovo za bocnu plocu, ili drugi element za radnu plocu do ugla.'
      : 'Odabran pocetni element. Dvoklikni na zavrsni element.', 'info');
  } else {
    const idxA = state.radnaPlocaSelection[0];
    state.radnaPlocaSelection = [];
    state.addingRadnaPloca = false;
    const btnRadna = document.getElementById('btn-radna');
    if (btnRadna) { btnRadna.style.backgroundColor = ''; btnRadna.style.color = ''; }
    import('./viewer.js').then(v => v.highlightModule(-1));
    createSpanningRadnaPloca(idxA, idx);
  }
}

export function createSpanningRadnaPloca(idxA, idxB) {
  pushHistory();
  const tA = state.plan[idxA];
  const tB = state.plan[idxB];
  const aIsCorner = isCornerElement(tA);
  const bIsCorner = isCornerElement(tB);
  if (aIsCorner || bIsCorner) { createCornerRadnaPloca(idxA, idxB, aIsCorner ? idxA : idxB); return; }
  if (tA.r !== tB.r && idxA !== idxB) { showNotification('Elementi moraju biti na istom zidu!', 'error'); return; }
  const wA = parseFloat(tA.p.s || tA.p.l || tA.p.dss || tA.sirina || 60);
  const wB = parseFloat(tB.p.s || tB.p.l || tB.p.dss || tB.sirina || 60);
  const maxH = Math.max(parseFloat(tA.p.v || tA.p.h || 82), parseFloat(tB.p.v || tB.p.h || 82));
  let startElement, finalL;
  if (idxA === idxB) { startElement = tA; finalL = wA; }
  else {
    const dx = tB.pos[0] - tA.pos[0], dy = tB.pos[1] - tA.pos[1];
    const proj = dx * Math.cos(tA.r * Math.PI / 180) + dy * Math.sin(tA.r * Math.PI / 180);
    let endW;
    if (proj >= -0.01) { startElement = tA; endW = wB; } else { startElement = tB; endW = wA; }
    finalL = Math.hypot(dx, dy) + endW;
  }
  const entry = {
    ime: 'radna_ploca',
    p: { l: String(finalL), d: '60', debljina: '3.8' },
    pos: [startElement.pos[0], startElement.pos[1], startElement.pos[2] + maxH],
    r: startElement.r
  };
  state.plan.push(entry);
  try {
    addModuleGroup(state.plan.length - 1, buildKitchenModule('radna_ploca', entry.p, state.materials, state.settings, entry.pos[0], entry.pos[1], entry.pos[2], entry.r));
  } catch (e) { console.error('3D build failed', e); }
  renderPlanList();
  showNotification('Radna ploca dodana (L=' + Math.round(finalL) + 'cm)!', 'success');
}

export function createCornerRadnaPloca(idxA, idxB, cornerIdx) {
  pushHistory();
  const cornerEl = state.plan[cornerIdx];
  const otherIdx = cornerIdx === idxA ? idxB : idxA;
  const otherEl = state.plan[otherIdx];
  const lss = parseFloat(cornerEl.p.lss || 90);
  const d = 60, debljina = 3.8;
  const hCorner = parseFloat(cornerEl.p.v || 82);
  let topZ = cornerEl.pos[2] + hCorner;
  if (otherIdx !== cornerIdx) topZ = cornerEl.pos[2] + Math.max(hCorner, parseFloat(otherEl.p.v || otherEl.p.h || 82));
  const normaliseR = r => ((r % 360) + 360) % 360;
  const cornerRad = cornerEl.r * Math.PI / 180;
  const lssDirX = Math.sin(cornerRad), lssDirY = -Math.cos(cornerRad);
  const sideR = normaliseR(cornerEl.r + 270);

  function makeSideSlab(len) {
    const px = cornerEl.pos[0] + (d + len) * lssDirX;
    const py = cornerEl.pos[1] + (d + len) * lssDirY;
    const entry = { ime: 'radna_ploca', p: { l: String(len), d: String(d), debljina: String(debljina) }, pos: [px, py, topZ], r: sideR };
    state.plan.push(entry);
    try {
      addModuleGroup(state.plan.length - 1, buildKitchenModule('radna_ploca', entry.p, state.materials, state.settings, px, py, topZ, sideR));
    } catch (e) { console.error('3D build failed for side slab', e); }
  }

  if (otherIdx === cornerIdx) {
    const sideLen = lss - d;
    if (sideLen <= 0) { showNotification('lss nije veci od d!', 'error'); return; }
    makeSideSlab(sideLen);
    renderPlanList();
    showNotification('Bocna radna ploca dodana (' + Math.round(sideLen) + 'x' + d + 'cm)', 'success');
  } else {
    const rDiff = normaliseR(otherEl.r - cornerEl.r);
    const onMainWall = rDiff < 45 || rDiff > 315;
    const otherW = parseFloat(otherEl.p.s || otherEl.p.l || otherEl.p.dss || 60);
    const dx = otherEl.pos[0] - cornerEl.pos[0], dy = otherEl.pos[1] - cornerEl.pos[1];
    const dist = Math.hypot(dx, dy);
    if (onMainWall) {
      const mainL = dist + otherW;
      const entry = { ime: 'radna_ploca', p: { l: String(mainL), d: String(d), debljina: String(debljina) }, pos: [cornerEl.pos[0], cornerEl.pos[1], topZ], r: cornerEl.r };
      state.plan.push(entry);
      try {
        addModuleGroup(state.plan.length - 1, buildKitchenModule('radna_ploca', entry.p, state.materials, state.settings, cornerEl.pos[0], cornerEl.pos[1], topZ, cornerEl.r));
      } catch (e) { console.error('3D build failed for main-wall slab', e); }
      renderPlanList();
      showNotification('Radna ploca (glavni zid) dodana (L=' + Math.round(mainL) + 'cm)', 'success');
    } else {
      const sideLen = dist - d;
      if (sideLen <= 0) { showNotification('Kabinet je preblizu ugaonom elementu.', 'error'); return; }
      makeSideSlab(sideLen);
      renderPlanList();
      showNotification('Radna ploca (bocni zid) dodana (L=' + Math.round(sideLen) + 'cm)', 'success');
    }
  }
}

export function addCoklaToModule(idx) {
  const target = state.plan[idx];
  if (!target || target.ime === 'radna_ploca' || target.ime === 'cokla') return;
  if (!state.coklaSelection) state.coklaSelection = [];
  if (state.coklaSelection.length === 0) {
    state.coklaSelection.push(idx);
    import('./viewer.js').then(v => v.highlightModule(idx));
    showNotification('Odabran pocetni element. Dvoklikni na zavrsni element.', 'info');
  } else {
    const idxA = state.coklaSelection[0];
    state.coklaSelection = [];
    state.addingCokla = false;
    const btnCokla = document.getElementById('btn-cokla');
    if (btnCokla) { btnCokla.style.backgroundColor = ''; btnCokla.style.color = ''; }
    import('./viewer.js').then(v => v.highlightModule(-1));
    createSpanningCokla(idxA, idx);
  }
}

export function createSpanningCokla(idxA, idxB) {
  pushHistory();
  const tA = state.plan[idxA], tB = state.plan[idxB];
  if (tA.r !== tB.r && idxA !== idxB) { showNotification('Elementi moraju biti na istom zidu!', 'error'); return; }
  const wA = parseFloat(tA.p.s || tA.p.l || tA.p.dss || tA.sirina || 60);
  const wB = parseFloat(tB.p.s || tB.p.l || tB.p.dss || tB.sirina || 60);
  let startElement, finalL;
  if (idxA === idxB) { startElement = tA; finalL = wA; }
  else {
    const dx = tB.pos[0] - tA.pos[0], dy = tB.pos[1] - tA.pos[1];
    const proj = dx * Math.cos(tA.r * Math.PI / 180) + dy * Math.sin(tA.r * Math.PI / 180);
    let endW;
    if (proj >= -0.01) { startElement = tA; endW = wB; } else { startElement = tB; endW = wA; }
    finalL = Math.hypot(dx, dy) + endW;
  }
  const entry = { ime: 'cokla', p: { l: String(finalL), h: '9.5', debljina: '1.8' }, pos: [startElement.pos[0], -46, 0], r: startElement.r };
  state.plan.push(entry);
  try {
    addModuleGroup(state.plan.length - 1, buildKitchenModule('cokla', entry.p, state.materials, state.settings, entry.pos[0], -46, 0, entry.r));
  } catch (e) { console.error('3D build failed', e); }
  renderPlanList();
  showNotification('Cokla dodana (L=' + Math.round(finalL) + 'cm)!', 'success');
}

function _openInputModal(label, defaultVal, callback) {
  import('./app.js').then(m => m.openInputModal(label, defaultVal, callback));
}
