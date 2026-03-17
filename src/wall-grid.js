import { state } from './state.js';
import { buildKitchenModule } from './kitchen-builder.js';
import { addModuleGroup, removeModuleGroup } from './viewer.js';

export const WALL_ROWS = [
  { label: 'Z=140', z: 140, row: 0 },
  { label: 'Z=82', z: 82, row: 1 },
  { label: 'Z=0', z: 0, row: 2 }
];
export const WALL_COLS = 10;

export function initWallGrid() {
  const grid = document.getElementById('wall-grid');
  grid.innerHTML = '';
  WALL_ROWS.forEach(({ label, z, row }) => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'wall-row';
    const lbl = document.createElement('div');
    lbl.className = 'wall-row-label';
    lbl.textContent = label;
    rowDiv.appendChild(lbl);
    for (let col = 1; col <= WALL_COLS; col++) {
      const cell = document.createElement('div');
      cell.className = 'wall-cell';
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.textContent = '—';
      cell.addEventListener('click', () => selectCell(row, col));
      rowDiv.appendChild(cell);
    }
    grid.appendChild(rowDiv);
  });
}

export function selectCell(row, col) {
  const old = document.querySelector('.wall-cell.selected');
  if (old) old.classList.remove('selected');
  state.selectedCell = [row, col];
  let calcX = 0;
  for (let c = 1; c < col; c++) {
    const key = `${row},${c}`;
    if (state.occupiedCells[key]) calcX += state.occupiedCells[key].sirina;
  }
  _setPos('x', calcX);
  _setPos('z', WALL_ROWS[row]?.z ?? 0);
  const newCell = document.querySelector(`.wall-cell[data-row="${row}"][data-col="${col}"]`);
  if (newCell) newCell.classList.add('selected');
}

export function updateWallGridDisplay() {
  document.querySelectorAll('.wall-cell').forEach(cell => {
    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);
    const key = `${r},${c}`;
    const [selR, selC] = state.selectedCell;
    cell.classList.remove('occupied', 'selected');
    if (state.occupiedCells[key]) {
      cell.classList.add('occupied');
      cell.textContent = state.occupiedCells[key].ime.substring(0, 3).toUpperCase();
    } else {
      cell.textContent = '—';
    }
    if (r === selR && c === selC) cell.classList.add('selected');
  });
}

export function shiftRowFrom(row, fromCol) {
  let x = 0;
  for (let c = 1; c <= WALL_COLS; c++) {
    const key = `${row},${c}`;
    const cell = state.occupiedCells[key];
    if (!cell) continue;
    const planItem = state.plan.find(m => m.mat_pos && m.mat_pos[0] === row && m.mat_pos[1] === c);
    if (!planItem) continue;
    if (c <= fromCol) {
      x += cell.sirina;
    } else {
      planItem.pos[0] = x;
      x += cell.sirina;
      const idx = state.plan.indexOf(planItem);
      try {
        const group = buildKitchenModule(planItem.ime, planItem.p, state.materials, state.settings, planItem.pos[0], planItem.pos[1], planItem.pos[2], planItem.r);
        removeModuleGroup(idx);
        addModuleGroup(idx, group);
      } catch (e) { console.error('3D shift rebuild failed for', planItem.ime, e); }
    }
  }
  rebuildCountertopsForRow(row);
}

export function rebuildCountertopsForRow(row) {
  const rowItems = state.plan.filter(m => m.mat_pos && m.mat_pos[0] === row && m.ime !== 'radna_ploca' && m.ime !== 'cokla');
  if (rowItems.length === 0) return;
  let changed = false;
  const syncSpanning = (typeName) => {
    state.plan.forEach((rp, rpIdx) => {
      if (rp.ime !== typeName) return;
      const rpLen = parseFloat(rp.p.l) || 0;
      const rpX0 = rp.pos[0];
      const rpX1 = rpX0 + rpLen;
      const under = rowItems.filter(m => {
        if (m.r !== rp.r) return false;
        const mX0 = m.pos[0];
        const mW = parseFloat(m.p.s || m.p.dss || m.sirina || 60);
        const mX1 = mX0 + mW;
        return mX0 < rpX1 + 2 && mX1 > rpX0 - 2;
      });
      if (under.length === 0) return;
      const newX0 = Math.min(...under.map(m => m.pos[0]));
      const newX1 = Math.max(...under.map(m => m.pos[0] + parseFloat(m.p.s || m.p.dss || m.sirina || 60)));
      const newLen = newX1 - newX0;
      if (Math.abs(newX0 - rpX0) < 0.01 && Math.abs(newLen - rpLen) < 0.01) return;
      rp.pos[0] = newX0;
      rp.p.l = String(newLen);
      try {
        const group = buildKitchenModule(rp.ime, rp.p, state.materials, state.settings, rp.pos[0], rp.pos[1], rp.pos[2], rp.r);
        removeModuleGroup(rpIdx);
        addModuleGroup(rpIdx, group);
      } catch (e) { console.error(`${typeName} rebuild failed`, e); }
      changed = true;
    });
  };
  syncSpanning('radna_ploca');
  syncSpanning('cokla');
  if (changed) import('./plan-manager.js').then(m => m.renderPlanList());
}

function _setPos(axis, val) {
  state.position[axis] = val;
  const el = document.getElementById(`pos-${axis}`);
  if (el) el.value = val;
}
