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

// mat_pos[0] encoding:
//  Base cabinets:  1=left side, 2=back wall,  3=right side
//  Upper cabinets (Z=140): 11=left side, 20=back wall, 13=right side
//  Tall cabinets  (Z=82):  12=left side, 21=back wall, 14=right side
// Categories allowed per display row index (WALL_ROWS row)
const ROW_CATEGORIES = {
  0: ['Gornji'],          // Z=140: upper wall cabinets
  1: ['Visoki'],          // Z=82:  tall cabinets
  2: ['Donji', 'Ugaoni']  // Z=0:   base cabinets
};

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

      // Each row now has its own independent slot list
      const rowSlots = (section.slotsByRow || {})[rowIdx] || [];

      rowSlots.forEach(slot => {
        const planIdx    = _findPlanIdx(slot.planMatRow, slot.matCol);
        const item       = planIdx >= 0 ? state.plan[planIdx] : null;
        const isSelected = planIdx >= 0 && planIdx === state.selectedPlanIdx;

        const cell = document.createElement('div');
        const widthPx = Math.max(20, Math.round(slot.widthCm * PX_PER_CM));
        cell.style.width  = widthPx + 'px';
        cell.style.height = CELL_H + 'px';

        if (slot.isEmpty) {
          cell.className = 'wg-cell add-slot';
          cell.textContent = '+';
          cell.title = 'Dodaj modul ovdje';
        } else if (slot.isCorner) {
          cell.className = 'wg-cell corner' + (isSelected ? ' selected' : '');
          cell.textContent = slot.cornerLabel || '⌐';
          cell.title = item ? item.ime.replace(/_/g, ' ') : 'Ugaoni element';
        } else if (item) {
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
            state.selectedCell = [slot.planMatRow, slot.matCol];
            _setPos('x', slot.posX ?? 0);
            _setPos('z', WALL_ROWS.find(r => r.row === slot.matRow)?.z ?? 0);
            updateWallGridDisplay();
            _showAddTooltip(cell, slot);
          } else if (planIdx >= 0) {
            state.selectedPlanIdx = planIdx;
            updateWallGridDisplay();
            import('./plan-manager.js').then(m => m.selectModuleByIndex(planIdx));
            _showReplaceTooltip(cell, planIdx, slot.isCorner);
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

// Helper: gather plan items with a given mat_pos row, sorted by col
function _itemsForMatRow(matRow) {
  return state.plan
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => item.mat_pos && item.mat_pos[0] === matRow)
    .sort((a, b) => a.item.mat_pos[1] - b.item.mat_pos[1]);
}

// ── Private: build section descriptors from layout + plan ────────────────────
// Each section now has slotsByRow: { 0: slots, 1: slots, 2: slots }
function _buildSections(layout) {
  const { type = 'galley', side = 'left', isGola = false } = layout;

  // mat_pos row assignments:
  //   Back wall:  base=2, upper(Z=140)=20, tall(Z=82)=21
  //   Left side:  base=1, upper=11, tall=12
  //   Right side: base=3, upper=13, tall=14

  const base2  = _itemsForMatRow(2);
  const upper2 = _itemsForMatRow(20);
  const tall2  = _itemsForMatRow(21);

  if (type === 'galley' || base2.length === 0) {
    return [{
      label: 'Zid',
      slotsByRow: {
        0: _slotsFromItems(upper2, 20, false, 0),
        1: _slotsFromItems(tall2,  21, false, 1),
        2: _slotsFromItems(base2,   2, false, 2)
      }
    }];
  }

  if (type === 'l-shape') {
    if (side === 'left') {
      const left1  = _itemsForMatRow(1);
      const left11 = _itemsForMatRow(11);
      const left12 = _itemsForMatRow(12);
      const cornerSlot = base2.find(({ item }) => CORNER_NAMES.has(item.ime));
      const mainSlots  = base2.filter(({ item }) => !CORNER_NAMES.has(item.ime));
      return [
        {
          label: 'Lijevna strana',
          slotsByRow: {
            0: _slotsFromItems(left11, 11, true, 0),
            1: _slotsFromItems(left12, 12, true, 1),
            2: _slotsFromItems(left1,   1, true, 2)
          }
        },
        {
          label: 'Zadnji zid',
          slotsByRow: {
            0: _slotsFromItems(upper2, 20, false, 0),
            1: _slotsFromItems(tall2,  21, false, 1),
            2: _slotsFromItems([...(cornerSlot ? [cornerSlot] : []), ...mainSlots], 2, false, 2)
          }
        }
      ];
    } else {
      const right3  = _itemsForMatRow(3);
      const right13 = _itemsForMatRow(13);
      const right14 = _itemsForMatRow(14);
      const cornerSlot = base2.find(({ item }) => CORNER_NAMES.has(item.ime));
      const mainSlots  = base2.filter(({ item }) => !CORNER_NAMES.has(item.ime));
      return [
        {
          label: 'Zadnji zid',
          slotsByRow: {
            0: _slotsFromItems(upper2, 20, false, 0),
            1: _slotsFromItems(tall2,  21, false, 1),
            2: _slotsFromItems([...mainSlots, ...(cornerSlot ? [cornerSlot] : [])], 2, false, 2)
          }
        },
        {
          label: 'Desna strana',
          slotsByRow: {
            0: _slotsFromItems(right13, 13, true, 0),
            1: _slotsFromItems(right14, 14, true, 1),
            2: _slotsFromItems(right3,   3, true, 2)
          }
        }
      ];
    }
  }

  if (type === 'u-shape') {
    const left1  = _itemsForMatRow(1);
    const left11 = _itemsForMatRow(11);
    const left12 = _itemsForMatRow(12);
    const right3  = _itemsForMatRow(3);
    const right13 = _itemsForMatRow(13);
    const right14 = _itemsForMatRow(14);
    const leftCorner  = base2.find(({ item }) => item.ime.includes('dug_element_90') && !item.ime.includes('desni'));
    const rightCorner = base2.find(({ item }) => item.ime.includes('dug_element_90_desni'));
    const mainSlots   = base2.filter(({ item }) => !CORNER_NAMES.has(item.ime));
    return [
      {
        label: 'Lijevna strana',
        slotsByRow: {
          0: _slotsFromItems(left11, 11, true, 0),
          1: _slotsFromItems(left12, 12, true, 1),
          2: _slotsFromItems(left1,   1, true, 2)
        }
      },
      {
        label: 'Zadnji zid',
        slotsByRow: {
          0: _slotsFromItems(upper2, 20, false, 0),
          1: _slotsFromItems(tall2,  21, false, 1),
          2: _slotsFromItems([...(leftCorner ? [leftCorner] : []), ...mainSlots, ...(rightCorner ? [rightCorner] : [])], 2, false, 2)
        }
      },
      {
        label: 'Desna strana',
        slotsByRow: {
          0: _slotsFromItems(right13, 13, true, 0),
          1: _slotsFromItems(right14, 14, true, 1),
          2: _slotsFromItems(right3,   3, true, 2)
        }
      }
    ];
  }

  return [{
    label: 'Zid',
    slotsByRow: {
      0: _slotsFromItems(upper2, 20, false, 0),
      1: _slotsFromItems(tall2,  21, false, 1),
      2: _slotsFromItems(base2,   2, false, 2)
    }
  }];
}

// Build slot descriptors from plan items with a given mat_pos row.
// displayRowIdx: WALL_ROWS row index (0=Z140, 1=Z82, 2=Z0) — slots light up in this row.
function _slotsFromItems(itemPairs, matRow, isSideWall = false, displayRowIdx = 2) {
  const displayRow = displayRowIdx;
  const layout = state.activeLayout || {};
  const totalWidth = layout.width || 300;
  const isGola = layout.isGola || false;
  const lss = isGola ? 80 : 90;

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
      posY:        item.pos[1],
      planIdx:     idx,
      isEmpty:     false,
      isSideWall
    };
  });

  // Compute next available matCol and position for the empty add-slot
  const lastItem  = itemPairs.length > 0 ? itemPairs[itemPairs.length - 1].item : null;
  const nextCol   = lastItem ? lastItem.mat_pos[1] + 1 : 1;
  const lastWidth = lastItem ? (lastItem.sirina || parseFloat(lastItem.p.s || lastItem.p.dss || 60)) : 0;

  let addPosX, addPosY;
  if (isSideWall) {
    // Side wall: posX is fixed (0 for left/row1, totalWidth for right/row3)
    // posY steps negatively: each new cabinet goes further into the room
    addPosX = (matRow === 3 || matRow === 13 || matRow === 14) ? totalWidth : 0;
    if (lastItem) {
      // next posY = lastItem.pos[1] - lastWidth (more negative = deeper into room)
      addPosY = lastItem.pos[1] - lastWidth;
    } else {
      // No cabinets yet: first side wall cabinet starts just past the corner short arm (lss + 1 module)
      addPosY = -(lss + 60);
    }
  } else {
    addPosX = lastItem ? lastItem.pos[0] + lastWidth : 0;
    addPosY = 0;
  }

  slots.push({
    matCol:      nextCol,
    matRow:      displayRow,
    planMatRow:  matRow,
    widthCm:     60,
    isCorner:    false,
    cornerLabel: null,
    posX:        addPosX,
    posY:        addPosY,
    planIdx:     -1,
    isEmpty:     true,
    isSideWall
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

  // Filter modules by the categories allowed for this row
  const allowedCats = ROW_CATEGORIES[slot.matRow] || Object.keys(MODULE_GROUPS);
  const moduleNames = [...new Set(
    allowedCats.flatMap(cat => Object.keys(MODULE_GROUPS[cat] || {})).filter(n => !CORNER_NAMES.has(n))
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

  const sirina = parseFloat(p.s || p.sl || p.dss || 60);
  const z = WALL_ROWS.find(r => r.row === slot.matRow)?.z ?? 0;
  // rotation: left side wall = r=270 (planMatRow 1/11/12), right side wall = r=90 (planMatRow 3/13/14), back wall = r=0
  const isLeft  = slot.planMatRow === 1 || slot.planMatRow === 11 || slot.planMatRow === 12;
  const isRight = slot.planMatRow === 3 || slot.planMatRow === 13 || slot.planMatRow === 14;
  const r = isLeft ? 270 : isRight ? 90 : 0;

  // Side wall modules: posX is fixed to wall X (0 or totalWidth), posY steps negatively for depth
  // Back wall modules: posX steps right, posY=0
  const posX = slot.posX ?? 0;
  const posY = slot.isSideWall ? (slot.posY ?? 0) : 0;

  const entry = {
    ime,
    p,
    pos:     [posX, posY, z],
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
