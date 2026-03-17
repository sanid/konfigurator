import { state, pushHistory } from './state.js';
import { buildKitchenModule } from './kitchen-builder.js';
import { addModuleGroup, removeModuleGroup } from './viewer.js';
import { MODULE_GROUPS } from './modules-config.js';

export const WALL_ROWS = [
  { label: 'Z=140', z: 140, row: 0 },
  { label: 'Z=82',  z: 82,  row: 1 },
  { label: 'Z=0',   z: 0,   row: 2 }
];
export const WALL_COLS = 10;

// px per cm for proportional cell widths
const PX_PER_CM = 0.55;
const CELL_H    = 32; // px height of each row cell

const CORNER_NAMES = new Set([
  'dug_element_90', 'dug_element_90_gola',
  'dug_element_90_desni', 'dug_element_90_desni_gola'
]);

// ── Tooltip state ─────────────────────────────────────────────────────────────
let _tooltipActiveIdx = -1;

// ── Public: init (called once on DOMContentLoaded) ───────────────────────────
export function initWallGrid() {
  // initial render — galley (single back wall)
  updateWallGridDisplay();

  // Close tooltip on outside click
  document.addEventListener('click', (e) => {
    const tt = document.getElementById('wg-tooltip');
    if (tt && !tt.contains(e.target)) _hideTooltip();
  });
}

// ── Public: select a plan item cell (used by old cell clicks) ────────────────
export function selectCell(row, col) {
  // Legacy: select the first plan item in this mat_pos
  const item = state.plan.find(m => m.mat_pos && m.mat_pos[0] === row && m.mat_pos[1] === col);
  const idx = item ? state.plan.indexOf(item) : -1;
  state.selectedPlanIdx = idx;
  state.selectedCell = [row, col];

  let calcX = 0;
  for (let c = 1; c < col; c++) {
    const key = `${row},${c}`;
    if (state.occupiedCells[key]) calcX += state.occupiedCells[key].sirina;
  }
  _setPos('x', calcX);
  _setPos('z', WALL_ROWS[row]?.z ?? 0);
  updateWallGridDisplay();
}

// ── Public: rebuild the full visual wall display ──────────────────────────────
export function updateWallGridDisplay() {
  const container = document.getElementById('wall-grid');
  if (!container) return;
  container.innerHTML = '';

  const layout = state.activeLayout || { type: 'galley' };
  const sections = _buildSections(layout);

  sections.forEach((section, si) => {
    if (si > 0) {
      const sep = document.createElement('div');
      sep.className = 'wg-separator';
      container.appendChild(sep);
    }

    const wrap = document.createElement('div');
    wrap.className = 'wg-section';

    const lbl = document.createElement('div');
    lbl.className = 'wg-section-label';
    lbl.textContent = section.label;
    wrap.appendChild(lbl);

    const matrix = document.createElement('div');
    matrix.className = 'wg-matrix';

    WALL_ROWS.forEach(({ label: rowLabel, z, row: rowIdx }) => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'wg-row';

      const rlbl = document.createElement('div');
      rlbl.className = 'wg-row-label';
      rlbl.textContent = rowLabel;
      rowDiv.appendChild(rlbl);

      // Render cells for this section row
      section.slots.forEach(slot => {
        // Use planMatRow for the actual plan lookup, matRow for display highlight row
        const planIdx  = _findPlanIdx(slot.planMatRow, slot.matCol);
        const item     = planIdx >= 0 ? state.plan[planIdx] : null;
        const isSelected = planIdx >= 0 && planIdx === state.selectedPlanIdx;
        const showHere = rowIdx === slot.matRow; // only light up on the display row

        const cell = document.createElement('div');
        const widthPx = Math.max(20, Math.round(slot.widthCm * PX_PER_CM));
        cell.style.width  = widthPx + 'px';
        cell.style.height = CELL_H + 'px';

        if (slot.isEmpty && showHere) {
          cell.className = 'wg-cell add-slot';
          cell.textContent = '+';
          cell.title = 'Dodaj modul ovdje';
        } else if (slot.isEmpty) {
          cell.className = 'wg-cell empty';
          cell.textContent = '—';
        } else if (slot.isCorner && showHere) {
          cell.className = 'wg-cell corner' + (isSelected ? ' selected' : '');
          cell.textContent = slot.cornerLabel || '⌐';
          cell.title = item ? item.ime.replace(/_/g, ' ') : 'Ugaoni element';
        } else if (item && showHere) {
          cell.className = 'wg-cell occupied' + (isSelected ? ' selected' : '');
          cell.textContent = item.ime.substring(0, 3).toUpperCase();
          cell.title = item.ime.replace(/_/g, ' ') + ' (' + slot.widthCm + 'cm)';
        } else {
          cell.className = 'wg-cell empty' + (isSelected ? ' selected' : '');
          cell.textContent = '—';
        }

        // Click handler
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          if (slot.isEmpty) {
            // Empty add-slot: set position and open an add-module tooltip
            state.selectedCell = [slot.planMatRow, slot.matCol];
            _setPos('x', slot.posX ?? 0);
            _setPos('z', WALL_ROWS.find(r => r.row === slot.matRow)?.z ?? 0);
            updateWallGridDisplay();
            if (showHere) _showAddTooltip(cell, slot);
          } else if (planIdx >= 0) {
            state.selectedPlanIdx = planIdx;
            updateWallGridDisplay();
            import('./plan-manager.js').then(m => m.selectModuleByIndex(planIdx));
            if (showHere) _showReplaceTooltip(cell, planIdx, slot.isCorner);
          } else {
            state.selectedCell = [slot.planMatRow, slot.matCol];
            _setPos('x', slot.posX ?? 0);
            _setPos('z', WALL_ROWS.find(r => r.row === slot.matRow)?.z ?? 0);
            updateWallGridDisplay();
          }
        });

        rowDiv.appendChild(cell);
      });

      matrix.appendChild(rowDiv);
    });

    wrap.appendChild(matrix);
    container.appendChild(wrap);
  });
}

// ── Public: shift row modules (unchanged logic) ───────────────────────────────
export function shiftRowFrom(row, fromCol) {
  let x = 0;
  for (let c = 1; c <= WALL_COLS; c++) {
    const key  = `${row},${c}`;
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

// ── Public: rebuild countertops (unchanged) ───────────────────────────────────
export function rebuildCountertopsForRow(row) {
  const rowItems = state.plan.filter(m => m.mat_pos && m.mat_pos[0] === row && m.ime !== 'radna_ploca' && m.ime !== 'cokla');
  if (rowItems.length === 0) return;
  let changed = false;
  const syncSpanning = (typeName) => {
    state.plan.forEach((rp, rpIdx) => {
      if (rp.ime !== typeName) return;
      const rpLen = parseFloat(rp.p.l) || 0;
      const rpX0  = rp.pos[0];
      const rpX1  = rpX0 + rpLen;
      const under = rowItems.filter(m => {
        if (m.r !== rp.r) return false;
        const mX0 = m.pos[0];
        const mW  = parseFloat(m.p.s || m.p.dss || m.sirina || 60);
        const mX1 = mX0 + mW;
        return mX0 < rpX1 + 2 && mX1 > rpX0 - 2;
      });
      if (under.length === 0) return;
      const newX0  = Math.min(...under.map(m => m.pos[0]));
      const newX1  = Math.max(...under.map(m => m.pos[0] + parseFloat(m.p.s || m.p.dss || m.sirina || 60)));
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

// ── Private: build section descriptors from layout + plan ────────────────────
function _buildSections(layout) {
  const { type = 'galley', side = 'left', isGola = false } = layout;
  const dss = isGola ? 100 : 80;
  const lss = isGola ? 80  : 90;

  // Gather row=2 (base) items by mat_col order
  const baseItems = state.plan
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => item.mat_pos && item.mat_pos[0] === 2)
    .sort((a, b) => a.item.mat_pos[1] - b.item.mat_pos[1]);

  if (type === 'galley' || baseItems.length === 0) {
    // Single back wall
    return [{ label: 'Zid', slots: _slotsFromItems(baseItems, 2) }];
  }

  if (type === 'l-shape') {
    if (side === 'left') {
      const leftItems = state.plan
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => item.mat_pos && item.mat_pos[0] === 1)
        .sort((a, b) => a.item.mat_pos[1] - b.item.mat_pos[1]);

      // Back wall: first item is the corner (dss wide), rest are main
      const cornerSlot  = baseItems.find(({ item }) => CORNER_NAMES.has(item.ime));
      const mainSlots   = baseItems.filter(({ item }) => !CORNER_NAMES.has(item.ime));

      return [
        { label: 'Lijevna strana', slots: _slotsFromItems(leftItems, 1, true) },
        { label: 'Zadnji zid',     slots: _slotsFromItems([...(cornerSlot ? [cornerSlot] : []), ...mainSlots], 2) },
      ];
    } else {
      const rightItems = state.plan
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => item.mat_pos && item.mat_pos[0] === 3)
        .sort((a, b) => a.item.mat_pos[1] - b.item.mat_pos[1]);

      const cornerSlot  = baseItems.find(({ item }) => CORNER_NAMES.has(item.ime));
      const mainSlots   = baseItems.filter(({ item }) => !CORNER_NAMES.has(item.ime));

      return [
        { label: 'Zadnji zid',    slots: _slotsFromItems([...mainSlots, ...(cornerSlot ? [cornerSlot] : [])], 2) },
        { label: 'Desna strana',  slots: _slotsFromItems(rightItems, 3, true) },
      ];
    }
  }

  if (type === 'u-shape') {
    const leftItems = state.plan
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.mat_pos && item.mat_pos[0] === 1)
      .sort((a, b) => a.item.mat_pos[1] - b.item.mat_pos[1]);

    const rightItems = state.plan
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.mat_pos && item.mat_pos[0] === 3)
      .sort((a, b) => a.item.mat_pos[1] - b.item.mat_pos[1]);

    const leftCorner  = baseItems.find(({ item }) => item.ime.includes('dug_element_90') && !item.ime.includes('desni'));
    const rightCorner = baseItems.find(({ item }) => item.ime.includes('dug_element_90_desni'));
    const mainSlots   = baseItems.filter(({ item }) => !CORNER_NAMES.has(item.ime));

    return [
      { label: 'Lijevna strana', slots: _slotsFromItems(leftItems, 1, true) },
      { label: 'Zadnji zid',     slots: _slotsFromItems([...(leftCorner ? [leftCorner] : []), ...mainSlots, ...(rightCorner ? [rightCorner] : [])], 2) },
      { label: 'Desna strana',   slots: _slotsFromItems(rightItems, 3, true) },
    ];
  }

  return [{ label: 'Zid', slots: _slotsFromItems(baseItems, 2) }];
}

// Build slot descriptors from plan items with a given mat_pos row.
// displayRow is the WALL_ROWS rowIdx where they should light up (always 2 = Z=0 for base cabinets).
function _slotsFromItems(itemPairs, matRow, isSideWall = false) {
  // All base cabinets (including side-wall ones) are floor-level → display on rowIdx 2 (Z=0)
  const displayRow = 2;

  const slots = itemPairs.map(({ item, idx }) => {
    const isCorner = CORNER_NAMES.has(item.ime);
    const widthCm  = item.sirina || parseFloat(item.p.s || item.p.dss || 60);
    return {
      matCol:      item.mat_pos[1],
      matRow:      displayRow,   // always highlight on the bottom row
      planMatRow:  matRow,       // the actual mat_pos row (for lookups)
      widthCm,
      isCorner,
      cornerLabel: isCorner ? '⌐' : null,
      posX:        item.pos[0],
      planIdx:     idx,
      isEmpty:     false
    };
  });

  // Compute next available matCol and X position for the empty add-slot
  const lastItem  = itemPairs.length > 0 ? itemPairs[itemPairs.length - 1].item : null;
  const nextCol   = lastItem ? lastItem.mat_pos[1] + 1 : 1;
  const lastWidth = lastItem ? (lastItem.sirina || parseFloat(lastItem.p.s || lastItem.p.dss || 60)) : 0;
  const nextX     = lastItem ? lastItem.pos[0] + lastWidth : 0;

  slots.push({
    matCol:     nextCol,
    matRow:     displayRow,
    planMatRow: matRow,
    widthCm:    60,       // default empty slot width
    isCorner:   false,
    cornerLabel: null,
    posX:       nextX,
    planIdx:    -1,
    isEmpty:    true
  });

  return slots;
}

// Find plan index by mat_pos (planMatRow = actual mat_pos[0] value)
function _findPlanIdx(planMatRow, col) {
  if (col == null) return -1;
  const item = state.plan.find(m => m.mat_pos && m.mat_pos[0] === planMatRow && m.mat_pos[1] === col);
  return item ? state.plan.indexOf(item) : -1;
}

// ── Private: add-slot tooltip (empty slot at end of wall) ────────────────────
function _showAddTooltip(anchorEl, slot) {
  // Reuse the same wg-tooltip but in "add" mode — _tooltipActiveIdx = -2 signals add mode
  if (_tooltipActiveIdx === -2) { _hideTooltip(); return; }
  _tooltipActiveIdx = -2;

  const tt   = document.getElementById('wg-tooltip');
  const list = document.getElementById('wg-tooltip-list');
  if (!tt || !list) return;

  list.innerHTML = '';

  const moduleNames = [...new Set(
    Object.values(MODULE_GROUPS).flatMap(g => Object.keys(g)).filter(n => !CORNER_NAMES.has(n))
  )];

  moduleNames.forEach(name => {
    const el = document.createElement('div');
    el.className = 'wg-tooltip-item';
    el.textContent = name.replace(/_/g, ' ');
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      _addModuleAtSlot(slot, name);
      _hideTooltip();
    });
    list.appendChild(el);
  });

  const rect = anchorEl.getBoundingClientRect();
  tt.classList.remove('hidden');
  let top  = rect.bottom + 6;
  let left = rect.left;
  if (top + 260 > window.innerHeight) top = rect.top - 260;
  if (left + 200 > window.innerWidth)  left = window.innerWidth - 206;
  tt.style.top  = top  + 'px';
  tt.style.left = left + 'px';
}

function _addModuleAtSlot(slot, ime) {
  pushHistory();
  const category = Object.keys(MODULE_GROUPS).find(cat => MODULE_GROUPS[cat][ime]);
  if (!category) return;
  const p = Object.fromEntries((MODULE_GROUPS[category][ime] || []).map(([k, v]) => [k, v]));
  p.tip_klizaca = 'skriveni';

  const sirina = parseFloat(p.s || p.dss || 60);
  const z = WALL_ROWS.find(r => r.row === slot.matRow)?.z ?? 0;
  // rotation: side walls use r=270 (left, matRow=1) or r=90 (right, matRow=3), back wall r=0
  const r = slot.planMatRow === 1 ? 270 : slot.planMatRow === 3 ? 90 : 0;

  const entry = {
    ime,
    p,
    pos:     [slot.posX ?? 0, 0, z],
    r,
    mat_pos: [slot.planMatRow, slot.matCol],
    sirina
  };

  state.plan.push(entry);
  const idx = state.plan.length - 1;
  state.occupiedCells[`${slot.planMatRow},${slot.matCol}`] = { sirina, ime };

  try {
    const group = buildKitchenModule(ime, p, state.materials, state.settings, entry.pos[0], entry.pos[1], entry.pos[2], r);
    addModuleGroup(idx, group);
    updateWallGridDisplay();
    import('./plan-manager.js').then(m => { m.renderPlanList(); });
    import('./price-utils.js').then(({ updateTotalCost }) => updateTotalCost());
    import('./notifications.js').then(({ showNotification }) => showNotification('Dodano: ' + ime, 'success'));
    import('./project-storage.js').then(({ autoSave }) => autoSave());
  } catch (e) { console.error('Add from slot failed', e); }
}

// ── Private: replace tooltip ──────────────────────────────────────────────────
function _showReplaceTooltip(anchorEl, planIdx, isCornerSlot) {
  if (_tooltipActiveIdx === planIdx) { _hideTooltip(); return; }
  _tooltipActiveIdx = planIdx;

  const tt = document.getElementById('wg-tooltip');
  const list = document.getElementById('wg-tooltip-list');
  if (!tt || !list) return;

  list.innerHTML = '';
  const currentIme = state.plan[planIdx]?.ime || '';

  let moduleNames;
  if (isCornerSlot) {
    moduleNames = [...CORNER_NAMES];
  } else {
    // All modules from all categories, excluding corners
    moduleNames = Object.values(MODULE_GROUPS)
      .flatMap(group => Object.keys(group))
      .filter(n => !CORNER_NAMES.has(n));
    // deduplicate
    moduleNames = [...new Set(moduleNames)];
  }

  moduleNames.forEach(name => {
    const item = document.createElement('div');
    item.className = 'wg-tooltip-item' + (name === currentIme ? ' selected' : '');
    item.textContent = name.replace(/_/g, ' ');
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      _replaceModule(planIdx, name);
      _hideTooltip();
    });
    list.appendChild(item);
  });

  // Position
  const rect = anchorEl.getBoundingClientRect();
  tt.classList.remove('hidden');
  let top  = rect.bottom + 6;
  let left = rect.left;
  if (top + 260 > window.innerHeight) top = rect.top - 260;
  if (left + 200 > window.innerWidth)  left = window.innerWidth - 206;
  tt.style.top  = top  + 'px';
  tt.style.left = left + 'px';
}

function _hideTooltip() {
  _tooltipActiveIdx = -1;
  document.getElementById('wg-tooltip')?.classList.add('hidden');
}

function _replaceModule(planIdx, newIme) {
  const item = state.plan[planIdx];
  if (!item) return;

  pushHistory();

  // Preserve width but swap module name; reset params to defaults for new module
  const oldSirina = item.sirina;
  const category  = Object.keys(MODULE_GROUPS).find(cat => MODULE_GROUPS[cat][newIme]);
  const defaults  = category ? Object.fromEntries((MODULE_GROUPS[category][newIme] || []).map(([k, v]) => [k, v])) : { ...item.p };

  // Preserve geometry params that should stay (width s/dss, height v, depth d)
  if (item.p.s && defaults.s !== undefined)   defaults.s   = item.p.s;
  if (item.p.v && defaults.v !== undefined)   defaults.v   = item.p.v;
  if (item.p.d && defaults.d !== undefined)   defaults.d   = item.p.d;
  if (item.p.dss && defaults.dss !== undefined) defaults.dss = item.p.dss;
  if (item.p.lss && defaults.lss !== undefined) defaults.lss = item.p.lss;

  item.ime = newIme;
  item.p   = { ...defaults, tip_klizaca: item.p.tip_klizaca || 'skriveni' };
  if (item.mat_pos) {
    state.occupiedCells[`${item.mat_pos[0]},${item.mat_pos[1]}`] = { sirina: oldSirina, ime: newIme };
  }

  try {
    const group = buildKitchenModule(item.ime, item.p, state.materials, state.settings, item.pos[0], item.pos[1], item.pos[2], item.r);
    removeModuleGroup(planIdx);
    addModuleGroup(planIdx, group);
    updateWallGridDisplay();
    import('./plan-manager.js').then(m => { m.renderPlanList(); m.updateModuleMeasurements(planIdx); });
    import('./notifications.js').then(({ showNotification }) => showNotification('Zamijenjeno: ' + newIme, 'success'));
  } catch (e) { console.error('Replace 3D build failed', e); }
}

// ── Public: replace a module and show a picker near an anchor element ─────────
export function openReplaceTooltip(anchorEl, planIdx) {
  const item = state.plan[planIdx];
  if (!item) return;
  const isCorner = CORNER_NAMES.has(item.ime);
  _showReplaceTooltip(anchorEl, planIdx, isCorner);
}

// ── Public: replace a module by index ─────────────────────────────────────────
export function replaceModuleInPlan(planIdx, newIme) {
  _replaceModule(planIdx, newIme);
}

function _setPos(axis, val) {
  state.position[axis] = val;
  const el = document.getElementById(`pos-${axis}`);
  if (el) el.value = val;
}
