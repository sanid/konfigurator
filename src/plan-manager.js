import { state, setEditingPlanIdx, editingPlanIdx, pushHistory } from './state.js';
import { buildKitchenModule, buildKitchenModuleAsync } from './kitchen-builder.js';
import {
  addModuleGroup,
  removeModuleGroup,
  clearAllGroups,
  highlightModule,
  showMeasurements,
  clearMeasurements,
  clearFixtureMarkers,
  shiftModuleGroups,
  moveModuleGroup,
} from './viewer.js';
import { autoSave } from './project-storage.js';
import { TEXTURE_PRESETS } from './modules-config.js';
import { requestRender } from './viewer.js';

// UI callbacks registered by app.js during init — avoids a circular import
// (plan-manager → app.js → plan-manager). Handlers are no-ops until registered.
const _uiHandlers = {
  refreshParams: () => {},
  refreshParamsForPlanItem: () => {},
  showCtxMenu: () => {},
};

export function setUiHandlers(handlers) {
  Object.assign(_uiHandlers, handlers);
}

export const PLAN_ICONS = {
  radni_stol: '🚪',
  fiokar: '🗄',
  gola_radni_stol: '📦',
  fiokar_gola: '🗄',
  vrata_sudo_masine: '🚿',
  radni_stol_rerne: '🔥',
  radni_stol_rerne_gola: '🔥',
  sporet: '🍳',
  samostojeci_frizider: '❄',
  dug_element_90: '↩',
  dug_element_90_gola: '↩',
  dug_element_90_desni: '↪',
  dug_element_90_desni_gola: '↪',
  donji_ugaoni_element_45_sa_plocom: '◣',
  donji_ugaoni_element_45_sa_plocom_gola: '◣',
  klasicna_viseca: '🗄',
  klasicna_viseca_gola: '🗄',
  gue90: '↩',
  viseca_na_kipu: '⬆',
  viseca_na_kipu_gola: '⬆',
  radna_ploca: '📐',
  cokla: '⬜',
  ormar_visoki: '🚪',
};

export function addToPlan(selectedModule, paramInputs, klizac, getPos, setPos) {
  pushHistory();
  if (!selectedModule) {
    showNotification('Izaberi modul!', 'warning');
    return;
  }

  const pos = getPos();
  const p = { ...paramInputs, tip_klizaca: klizac };
  const [row, col] = state.selectedCell;

  let sirina = 60;
  for (const k of ['s', 'dss', 'sl']) {
    if (p[k]) {
      const n = parseFloat(p[k]);
      if (!isNaN(n)) {
        sirina = n;
        break;
      }
    }
  }

  const entry = { ime: selectedModule, p: { ...p }, pos: [pos.x, pos.y, pos.z], r: pos.r, mat_pos: [row, col], sirina };

  // Magnet logic
  if (state.plan.length > 0) {
    const last = state.plan[state.plan.length - 1];
    if (entry.r === last.r) {
      if (entry.r === 0) {
        entry.pos[0] = last.pos[0] + last.sirina;
        entry.pos[1] = last.pos[1];
        setPos('x', entry.pos[0]);
        setPos('y', entry.pos[1]);
      } else if (entry.r === 90 || entry.r === -90) {
        entry.pos[0] = last.pos[0];
        entry.pos[1] = last.pos[1] - (last.p.d || 55);
        setPos('x', entry.pos[0]);
        setPos('y', entry.pos[1]);
      }
    }
  }

  state.plan.push(entry);
  const idx = state.plan.length - 1;
  state.occupiedCells[`${row},${col}`] = { sirina, ime: selectedModule };
  updateWallGridDisplay();

  try {
    const group = buildKitchenModule(entry.ime, entry.p, state.materials, state.settings, pos.x, pos.y, pos.z, pos.r);
    addModuleGroup(idx, group);
  } catch (e) {
    console.error('3D build failed for', entry.ime, e);
  }

  if (pos.r === 0 && col < 10) {
    selectCell(row, col + 1);
  } else if (pos.r === 90) {
    setPos('y', pos.y + sirina);
  }

  renderPlanList();
  updateTotalCost();
  autoSave();
  showNotification('Dodano: ' + selectedModule, 'success');
}

export function deleteModule(idx) {
  if (idx < 0 || idx >= state.plan.length) return;
  pushHistory();
  const item = state.plan[idx];
  if (item.mat_pos) delete state.occupiedCells[`${item.mat_pos[0]},${item.mat_pos[1]}`];
  state.plan.splice(idx, 1);
  removeModuleGroup(idx);
  shiftModuleGroups(idx);
  state.selectedPlanIdx = -1;
  setEditingPlanIdx(-1);
  _uiHandlers.refreshParams();
  if (state.plan.length === 0) {
    state.occupiedCells = {};
    _setPos('x', 0);
    _setPos('y', 0);
    _setPos('z', 0);
    _setPos('r', 0);
    selectCell(2, 1);
  }
  updateWallGridDisplay();
  renderPlanList();
  updateTotalCost();
}

export function mirrorModule(idx) {
  if (idx < 0 || idx >= state.plan.length) return;
  pushHistory();
  const item = state.plan[idx];
  item.r = item.r % 180 === 0 ? (item.r + 90) % 360 : (item.r + 270) % 360;
  updateModule3D(idx);
  if (idx === state.selectedPlanIdx) _setPos('r', item.r);
  renderPlanList();
  showNotification('Element zrcaljen', 'success');
}

export function duplicateModule(idx) {
  if (idx < 0 || idx >= state.plan.length) return;
  pushHistory();
  const src = state.plan[idx];
  const copy = { ime: src.ime, p: { ...src.p }, pos: [src.pos[0] + 10, src.pos[1], src.pos[2]], r: src.r };
  if (src.mat_pos) copy.mat_pos = [...src.mat_pos];
  if (src.materials) copy.materials = JSON.parse(JSON.stringify(src.materials));
  if (src.sirina) copy.sirina = src.sirina;
  state.plan.push(copy);
  const newIdx = state.plan.length - 1;
  try {
    const group = buildKitchenModule(
      copy.ime,
      copy.p,
      state.materials,
      state.settings,
      copy.pos[0],
      copy.pos[1],
      copy.pos[2],
      copy.r,
    );
    addModuleGroup(newIdx, group);
  } catch (e) {
    console.error('3D build failed for duplicate', e);
  }
  selectModuleByIndex(newIdx);
  renderPlanList();
  showNotification('Element dupliciran', 'success');
}

export function clearPlan() {
  if (state.plan.length === 0) return;
  if (!confirm('Obrisati sve module iz plana?')) return;
  pushHistory();
  state.plan = [];
  state.occupiedCells = {};
  state.selectedPlanIdx = -1;
  setEditingPlanIdx(-1);
  clearAllGroups();
  clearFixtureMarkers();
  state.wallFixtures = [];
  _setPos('x', 0);
  _setPos('y', 0);
  _setPos('z', 0);
  _setPos('r', 0);
  selectCell(2, 1);
  _uiHandlers.refreshParams();
  updateWallGridDisplay();
  renderPlanList();
  updateTotalCost();
  autoSave();
}

export function rebuildAllModules() {
  clearAllGroups();
  const total = state.plan.length;
  if (total === 0) return;
  if (total > 10) _showRebuildProgress(0, total);

  let done = 0;
  Promise.all(
    state.plan.map((item, idx) =>
      buildKitchenModuleAsync(
        item.ime,
        item.p,
        _mergedMaterials(item),
        state.settings,
        item.pos[0],
        item.pos[1],
        item.pos[2],
        item.r || 0,
      )
        .then((group) => {
          addModuleGroup(idx, group);
          done++;
          if (total > 10) _showRebuildProgress(done, total);
        })
        .catch((e) => console.error('3D rebuild failed for', item.ime, e)),
    ),
  ).then(() => {
    if (total > 10) _hideRebuildProgress();
    requestRender();
  });
}

function _showRebuildProgress(done, total) {
  let el = document.getElementById('rebuild-progress');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rebuild-progress';
    el.style.cssText =
      'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:var(--bg-card2);border:1px solid var(--accent);border-radius:var(--radius);padding:8px 18px;z-index:9000;font-size:11px;color:var(--text-primary);';
    document.body.appendChild(el);
  }
  el.textContent = `Gradnja ${done}/${total}...`;
  el.style.display = '';
}

function _hideRebuildProgress() {
  const el = document.getElementById('rebuild-progress');
  if (el) el.style.display = 'none';
}

export function updateModule3D(idx) {
  const item = state.plan[idx];
  const mergedMats = _mergedMaterials(item);
  const group = buildKitchenModule(
    item.ime,
    item.p,
    mergedMats,
    state.settings,
    item.pos[0],
    item.pos[1],
    item.pos[2],
    item.r,
  );
  removeModuleGroup(idx);
  addModuleGroup(idx, group);
}

function _mergedMaterials(item) {
  if (!item.materials) return state.materials;
  return { ...state.materials, ...item.materials };
}

export function updateModuleMeasurements(idx) {
  if (idx < 0) {
    clearMeasurements();
    return;
  }
  const item = state.plan[idx];
  if (!item) return;
  showMeasurements(idx, getModuleSize(item));
}

export function getModuleSize(item) {
  const p = item.p;
  let s = parseFloat(p.s || p.dss || p.sl || p.l || 60);
  let d = parseFloat(p.d || p.sd || 55);
  let v = parseFloat(p.v || 82);
  if (item.ime.includes('dug_element_90')) {
    s = parseFloat(p.dss);
    d = parseFloat(p.lss);
  }
  return { s, v, d };
}

export function selectModuleByIndex(idx) {
  if (idx < 0 || idx >= state.plan.length) return;
  const item = state.plan[idx];
  state.selectedPlanIdx = idx;
  highlightModule(idx);
  _setPos('x', item.pos[0]);
  _setPos('y', item.pos[1]);
  _setPos('z', item.pos[2]);
  _setPos('r', item.r);
  _uiHandlers.refreshParamsForPlanItem(idx);
  if (state.showMeasurements) updateModuleMeasurements(idx);
  renderPlanList();
}

export function renderPlanList() {
  const list = document.getElementById('plan-list');
  const count = document.getElementById('plan-count');
  list.innerHTML = '';
  count.textContent = state.plan.length + ' el.';

  if (state.plan.length === 0) {
    list.innerHTML = '<div class="plan-empty">Dodaj module u plan</div>';
    return;
  }

  state.plan.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = 'plan-item' + (idx === state.selectedPlanIdx ? ' selected' : '');
    el.setAttribute('role', 'listitem');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `[${idx + 1}] ${item.ime.replace(/_/g, ' ')}`);

    const icon = document.createElement('span');
    icon.className = 'plan-item-icon';
    icon.textContent = PLAN_ICONS[item.ime] || '📦';
    icon.setAttribute('aria-hidden', 'true');

    // Material color swatch — shows front material (or korpus for gola modules)
    const isGola = item.ime.includes('_gola') || item.ime === 'gola_radni_stol';
    const matKey = isGola ? 'korpus' : 'front';
    const mergedMat = (item.materials && item.materials[matKey]) || state.materials[matKey] || state.materials.front;
    const swatch = document.createElement('span');
    swatch.className = 'plan-item-swatch';
    if (item.materials && item.materials[matKey]) swatch.classList.add('has-override');
    if (mergedMat.type === 'texture' && mergedMat.textureName) {
      const tp = TEXTURE_PRESETS.find((t) => t.name === mergedMat.textureName);
      if (tp) swatch.style.background = `linear-gradient(135deg, ${tp.base} 0%, ${tp.grain} 100%)`;
      else swatch.style.backgroundColor = mergedMat.color || '#888';
    } else {
      swatch.style.backgroundColor = mergedMat.color || '#888';
    }
    swatch.title = 'Klikni za promjenu materijala: ' + (mergedMat.name || matKey);
    swatch.setAttribute('aria-label', `Materijal: ${mergedMat.name || matKey}`);
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      import('./material-picker.js').then(({ openMaterialPicker }) => openMaterialPicker(matKey, idx));
    });

    const info = document.createElement('div');
    info.className = 'plan-item-info';

    const name = document.createElement('div');
    name.className = 'plan-item-name';
    name.textContent = '[' + (idx + 1) + '] ' + item.ime.replace(/_/g, ' ');

    const meta = document.createElement('div');
    meta.className = 'plan-item-meta';
    const sVal = item.p.s || item.p.l || item.p.dss || item.p.sl || '—';
    meta.textContent = 'X:' + item.pos[0] + ' Z:' + item.pos[2] + ' s:' + sVal + 'cm R:' + item.r + '°';

    info.appendChild(name);
    info.appendChild(meta);
    el.appendChild(icon);
    el.appendChild(swatch);
    el.appendChild(info);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'plan-item-delete';
    deleteBtn.innerHTML = '🗑';
    deleteBtn.title = 'Obrisi';
    deleteBtn.setAttribute('aria-label', `Obriši ${item.ime.replace(/_/g, ' ')}`);
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteModule(idx);
    });
    el.appendChild(deleteBtn);

    el.addEventListener('click', () => selectModuleByIndex(idx));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = e.key === 'ArrowDown' ? Math.min(idx + 1, state.plan.length - 1) : Math.max(idx - 1, 0);
        const items = list.querySelectorAll('.plan-item');
        if (items[next]) {
          items[next].focus();
          selectModuleByIndex(next);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        _uiHandlers.refreshParamsForPlanItem(idx);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteModule(idx);
      }
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      selectModuleByIndex(idx);
      _uiHandlers.showCtxMenu(e.clientX, e.clientY, idx);
    });

    list.appendChild(el);
  });

  updateTotalCost();
  autoSave();
}

function _setPos(axis, val) {
  state.position[axis] = val;
  const el = document.getElementById(`pos-${axis}`);
  if (el) el.value = val;
}
