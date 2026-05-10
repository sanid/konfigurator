/**
 * app.js — Main renderer process logic
 * Meco Konfigurator 2026 — Electron/JSCAD Edition
 */
import {
  MODULE_GROUPS,
  DEFAULT_MATERIALS,
  DEFAULT_SETTINGS,
  COLOR_PRESETS,
  TEXTURE_PRESETS,
} from './modules-config.js';
import { buildKitchenModule, clearGeomCache } from './kitchen-builder.js';
import { buildDynamicPlan, validatePresetPlan, PRESET_LAYOUTS } from './presets.js';
import { t, setLocale } from './i18n.js';
import {
  initViewer,
  addModuleGroup,
  removeModuleGroup,
  shiftModuleGroups,
  moveModuleGroup,
  clearAllGroups,
  setCameraView,
  resetCamera,
  highlightModule,
  resizeViewer,
  setViewerTheme,
  addFixtureMarker,
  removeFixtureMarker,
  clearFixtureMarkers,
  setLightingMode,
  getModuleIndexAt,
  getModuleSnapInfoAt,
  getModuleGroup,
  showMeasurements,
  clearMeasurements,
  requestRender,
  beginDrag,
  updateDrag,
  endDrag,
  isDragging,
  setPBRMode,
  isPBRMode,
} from './viewer.js';

import {
  state,
  isDark,
  setIsDark,
  editingPlanIdx,
  setEditingPlanIdx,
  pushHistory,
  _history,
  _clonePlanState,
} from './state.js';
import { showNotification } from './notifications.js';
import { initPriceInputs, updateTotalCost, calcKant, getPriceForMaterial } from './price-utils.js';
import {
  initWallGrid,
  selectCell,
  updateWallGridDisplay,
  shiftRowFrom,
  rebuildCountertopsForRow,
  WALL_ROWS,
  WALL_COLS,
} from './wall-grid.js';
import {
  initMaterialsPanel,
  refreshMaterialSwatches,
  initMaterialPickerModal,
  openMaterialPicker,
  MAT_LABELS,
} from './material-picker.js';
import { autoSave, autoRestore, saveProject, loadProject, registerInitToggles } from './project-storage.js';
import { setSnapAnchorByIndex, snapModuleToSide } from './snap.js';
import {
  addSpecialElement,
  addRadnaPlocaToModule,
  addCoklaToModule,
  isCornerElement,
  setOpenInputModal,
  CORNER_ELEMENT_NAMES,
} from './special-elements.js';
import {
  addToPlan,
  deleteModule,
  mirrorModule,
  duplicateModule,
  clearPlan,
  rebuildAllModules,
  updateModule3D,
  updateModuleMeasurements,
  selectModuleByIndex,
  renderPlanList,
  setUiHandlers,
  PLAN_ICONS,
} from './plan-manager.js';
import {
  initKrojnaModal,
  showKrojnaLista,
  exportOptimik,
  exportPdf,
  exportClientPdf,
  exportModuleMPR,
  exportAllMPR,
} from './exports.js';
import { getModuleIconSVG } from './module-icons.js';
import { FIXTURE_TYPES } from './fixtures.js';
import { PARAM_LABELS, PARAM_BOUNDS, clampParamValue, applyParamInputBounds } from './params.js';
import { loadCustomModules, saveCustomModule, getCustomModules, deleteCustomModule } from './custom-modules.js';
import {
  loadTabs,
  getPlanTabs,
  getActiveTab,
  addTab,
  removeTab,
  switchTab,
  renameTab,
  saveCurrentTab,
  loadTabData,
} from './plan-tabs.js';

// ─── Wall Fixture Types (imported from fixtures.js) ────────────────────────────

// Parameter labels (imported from params.js)

// Module icons (imported from module-icons.js)

const TOGGLE_LABELS = {
  front_vrata: 'Vrata',
  polica: 'Police',
  pozadina: 'Pozadina',
  celafioka: 'Cela fioka',
  fioke: 'Fioke',
  radna_ploca: 'Radna ploca',
};

// ─── Param rebuild debounce ────────────────────────────────────────────────────
// Fires geometry rebuild 150ms after the last keystroke instead of per-keystroke.
let _paramDebounceTimer = null;

function _debouncedUpdateModule3D(planIdx) {
  clearTimeout(_paramDebounceTimer);
  _paramDebounceTimer = setTimeout(() => updateModule3D(planIdx), 150);
}

// ─── Input Modal ──────────────────────────────────────────────────────────────
let _inputModalResolve = null;

function initInputModal() {
  document.getElementById('modal-input-ok').addEventListener('click', () => {
    const val = document.getElementById('modal-input-val').value;
    document.getElementById('modal-input').classList.add('hidden');
    if (_inputModalResolve) {
      _inputModalResolve(val);
      _inputModalResolve = null;
    }
  });
  const cancel = () => {
    document.getElementById('modal-input').classList.add('hidden');
    if (_inputModalResolve) {
      _inputModalResolve(null);
      _inputModalResolve = null;
    }
  };
  document.getElementById('modal-input-cancel').addEventListener('click', cancel);
  document.getElementById('modal-input-close').addEventListener('click', cancel);
  document.querySelector('#modal-input .modal-backdrop').addEventListener('click', cancel);
  document.getElementById('modal-input-val').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('modal-input-ok').click();
    if (e.key === 'Escape') cancel();
  });
}

export function openInputModal(label, defaultVal, callback) {
  document.getElementById('modal-input-label').textContent = label;
  document.getElementById('modal-input-val').value = defaultVal;
  document.getElementById('modal-input').classList.remove('hidden');
  document.getElementById('modal-input-val').focus();
  document.getElementById('modal-input-val').select();
  _inputModalResolve = callback;
}

// ─── Context Menu ──────────────────────────────────────────────────────────────
let ctxTargetIdx = -1;

export function showCtxMenu(x, y, idx) {
  ctxTargetIdx = idx;
  const menu = document.getElementById('ctx-menu');
  if (!menu) return;
  menu.classList.remove('hidden');
  const mw = menu.offsetWidth,
    mh = menu.offsetHeight;
  menu.style.left = Math.min(x, window.innerWidth - mw - 4) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - mh - 4) + 'px';
}

function hideCtxMenu() {
  document.getElementById('ctx-menu')?.classList.add('hidden');
  ctxTargetIdx = -1;
}

function initContextMenu() {
  const menu = document.getElementById('ctx-menu');
  if (!menu) return;
  document.getElementById('ctx-mirror')?.addEventListener('click', () => {
    if (ctxTargetIdx >= 0) mirrorModule(ctxTargetIdx);
    hideCtxMenu();
  });
  document.getElementById('ctx-duplicate')?.addEventListener('click', () => {
    if (ctxTargetIdx >= 0) duplicateModule(ctxTargetIdx);
    hideCtxMenu();
  });
  document.getElementById('ctx-anchor')?.addEventListener('click', () => {
    if (ctxTargetIdx >= 0) {
      selectModuleByIndex(ctxTargetIdx);
      setSnapAnchorByIndex(ctxTargetIdx);
      showNotification('Sidro postavljeno. Dvaput klikni na element koji zelis spojiti.', 'info');
    }
    hideCtxMenu();
  });
  document.getElementById('ctx-remove')?.addEventListener('click', () => {
    if (ctxTargetIdx >= 0) deleteModule(ctxTargetIdx);
    hideCtxMenu();
  });
  document.getElementById('ctx-save-preset')?.addEventListener('click', () => {
    if (ctxTargetIdx >= 0 && state.plan[ctxTargetIdx]) {
      const item = state.plan[ctxTargetIdx];
      const presetName = item.ime.replace(/_/g, ' ') + ' ' + (item.p.s || item.p.l || item.p.dss || '') + 'cm';
      saveCustomModule(presetName, item.ime, item.p);
      initCustomModulesUI();
      showNotification('Preset sačuvan: ' + presetName, 'success');
    }
    hideCtxMenu();
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) hideCtxMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideCtxMenu();
  });
  const canvas = document.getElementById('three-canvas');
  canvas?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const idx = getModuleIndexAt(nx, ny);
    if (idx !== null) {
      selectModuleByIndex(idx);
      showCtxMenu(e.clientX, e.clientY, idx);
    }
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setUiHandlers({ refreshParams, refreshParamsForPlanItem, showCtxMenu });
  setOpenInputModal(openInputModal);
  registerInitToggles(initToggles);
  initTitlebarControls();
  initViewer(document.getElementById('three-canvas'));
  setViewerTheme('light');
  setLightingMode('warm');
  initCategoryTabs();
  initModuleSelect();
  initWallGrid();
  initMaterialsPanel();
  initToggles();
  initPriceInputs();
  initPositionInputs();
  initPlanActions();
  initMaterialPickerModal();
  initInputModal();
  initKrojnaModal();
  initFixtureModal();
  initPresetModal();
  initOverlayToggles();
  initContextMenu();
  initLanguageSwitcher();
  updateUILabels();
  selectCell(2, 1);
  window.addEventListener('resize', resizeViewer);

  let snapAnchor = null;
  window._setSnapAnchor = (info) => {
    snapAnchor = info;
  };
  window._clearSnapAnchor = () => {
    snapAnchor = null;
  };

  const canvas = document.getElementById('three-canvas');
  if (canvas) {
    canvas.addEventListener('dblclick', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const snapInfo = getModuleSnapInfoAt(x, y);
      if (snapInfo) {
        if (state.addingRadnaPloca) {
          addRadnaPlocaToModule(snapInfo.index);
        } else if (state.addingCokla) {
          addCoklaToModule(snapInfo.index);
        } else {
          if (!snapAnchor) {
            snapAnchor = snapInfo;
            selectModuleByIndex(snapInfo.index);
            showNotification('Sidro postavljeno. Klikni na element koji zelis spojiti.', 'info');
          } else {
            const sourceIdx = snapInfo.index;
            if (sourceIdx !== snapAnchor.index) {
              snapModuleToSide(sourceIdx, snapAnchor.index, snapAnchor, snapInfo);
            } else {
              selectModuleByIndex(sourceIdx);
            }
            snapAnchor = null;
          }
        }
      } else {
        snapAnchor = null;
      }
    });

    // ─── Click / Drag / Shift-select ────────────────────────────────────────
    let _pointerDownIdx = -1;
    let _pointerDownPos = { x: 0, y: 0 };
    let _didDrag = false;

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      _pointerDownIdx = getModuleIndexAt(nx, ny);
      _pointerDownPos = { x: e.clientX, y: e.clientY };
      _didDrag = false;

      if (_pointerDownIdx >= 0) {
        beginDrag(_pointerDownIdx, nx, ny, (worldX, worldZ) => {
          const item = state.plan[_pointerDownIdx];
          if (!item) return;
          pushHistory();
          item.pos[0] = Math.round(worldX);
          item.pos[1] = Math.round(-worldZ);
          setPos('x', item.pos[0]);
          setPos('y', item.pos[1]);
          if (item.mat_pos) {
            const [row, col] = item.mat_pos;
            const key = `${row},${col}`;
            if (state.occupiedCells[key]) state.occupiedCells[key].sirina = item.sirina;
          }
          renderPlanList();
          autoSave();
        });
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!isDragging()) return;
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const dx = e.clientX - _pointerDownPos.x;
      const dy = e.clientY - _pointerDownPos.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) _didDrag = true;

      updateDrag(nx, ny);
    });

    canvas.addEventListener('pointerup', (e) => {
      if (isDragging()) {
        endDrag();
        if (_didDrag) return;
      }

      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const idx = getModuleIndexAt(nx, ny);

      if (idx === null) {
        if (state.selectedPlanIdx !== -1) {
          state.selectedPlanIdx = -1;
          setEditingPlanIdx(-1);
          snapAnchor = null;
          clearMeasurements();
          highlightModule(-1);
          refreshParams();
          renderPlanList();
        }
      } else if (e.shiftKey && state.selectedPlanIdx >= 0) {
        selectModuleByIndex(idx);
      } else {
        selectModuleByIndex(idx);
      }
    });
  }

  autoRestore();

  loadCustomModules();
  loadTabs();
  initCustomModulesUI();
  initPlanTabs();
  initTour();
});

// ─── Title bar ────────────────────────────────────────────────────────────────
function initTitlebarControls() {
  document.getElementById('btn-minimize').onclick = () => window.electronAPI?.minimize();
  document.getElementById('btn-maximize').onclick = () => window.electronAPI?.maximize();
  document.getElementById('btn-close').onclick = () => window.electronAPI?.close();

  const themeBtn = document.getElementById('btn-theme');
  themeBtn.addEventListener('click', () => {
    setIsDark(!isDark);
    if (isDark) {
      document.body.classList.remove('light');
      themeBtn.textContent = '☀';
      themeBtn.title = 'Switch to light mode';
      setViewerTheme('dark');
    } else {
      document.body.classList.add('light');
      themeBtn.textContent = '🌙';
      themeBtn.title = 'Switch to dark mode';
      setViewerTheme('light');
    }
  });
}

function initOverlayToggles() {
  const wallPanel = document.getElementById('wall-grid-panel');
  const toggleBtn = document.getElementById('btn-toggle-wall-grid');
  const pinCheckbox = document.getElementById('pin-wall-grid');
  if (!wallPanel || !toggleBtn || !pinCheckbox) return;

  const isPinned = localStorage.getItem('wallGridPinned') === 'true';
  const isCollapsed = localStorage.getItem('wallGridCollapsed') === 'true';
  pinCheckbox.checked = isPinned;
  if (isPinned) {
    wallPanel.classList.remove('collapsed');
    toggleBtn.textContent = '▼';
  } else if (isCollapsed) {
    wallPanel.classList.add('collapsed');
    toggleBtn.textContent = '▲';
  } else {
    toggleBtn.textContent = '▼';
  }

  toggleBtn.addEventListener('click', () => {
    const collapsed = wallPanel.classList.toggle('collapsed');
    toggleBtn.textContent = collapsed ? '▲' : '▼';
    localStorage.setItem('wallGridCollapsed', collapsed);
  });
  pinCheckbox.addEventListener('change', () => {
    localStorage.setItem('wallGridPinned', pinCheckbox.checked);
    if (pinCheckbox.checked) {
      wallPanel.classList.remove('collapsed');
      toggleBtn.textContent = '▼';
    }
  });

  const measureBtn = document.getElementById('btn-measure');
  if (measureBtn) {
    if (state.showMeasurements) measureBtn.classList.add('active');
    measureBtn.addEventListener('click', () => {
      state.showMeasurements = !state.showMeasurements;
      measureBtn.classList.toggle('active', state.showMeasurements);
      if (state.showMeasurements && state.selectedPlanIdx >= 0) updateModuleMeasurements(state.selectedPlanIdx);
      else clearMeasurements();
    });
  }
}

function initPresetModal() {
  const btnPresets = document.getElementById('btn-presets');
  const modal = document.getElementById('modal-presets');
  if (!btnPresets || !modal) return;

  const closeBtn = document.getElementById('modal-presets-close');
  const cancelBtn = document.getElementById('modal-presets-cancel');
  const addBtn = document.getElementById('preset-add-btn');
  const shapePillsEl = document.getElementById('presets-grid');
  const planView = document.getElementById('preset-layout-wrap');
  const tooltip = document.getElementById('preset-mod-tooltip');
  const tooltipList = document.getElementById('preset-mod-tooltip-list');
  const sideWrap = document.getElementById('preset-side-wrap');
  const countsWrap = document.getElementById('preset-counts-wrap');
  const leftCountWrap = document.getElementById('preset-left-count-wrap');
  const rightCountWrap = document.getElementById('preset-right-count-wrap');
  const widthInput = document.getElementById('preset-width-main');
  const golaInput = document.getElementById('preset-gola');
  const leftCountInput = document.getElementById('preset-left-count');
  const rightCountInput = document.getElementById('preset-right-count');
  const previewHint = document.getElementById('preset-preview-hint');

  // ── state ──────────────────────────────────────────────────────────────────
  let activePresetId = 'galley';
  let activeSide = 'left';
  let slotModules = {};

  const CORNER_NAMES = new Set([
    'dug_element_90',
    'dug_element_90_gola',
    'dug_element_90_desni',
    'dug_element_90_desni_gola',
  ]);
  const SHAPE_ICONS = {
    galley:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="9" width="18" height="6" rx="1"/></svg>',
    'l-shape':
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5h18M3 5v14M3 19h6M3 5v14"/><rect x="3" y="5" width="18" height="4" rx="0.5" fill="currentColor" opacity="0.18"/><rect x="3" y="9" width="4" height="10" rx="0.5" fill="currentColor" opacity="0.18"/></svg>',
    'u-shape':
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="4" rx="0.5" fill="currentColor" opacity="0.18"/><rect x="3" y="9" width="4" height="10" rx="0.5" fill="currentColor" opacity="0.18"/><rect x="17" y="9" width="4" height="10" rx="0.5" fill="currentColor" opacity="0.18"/></svg>',
  };
  const SHAPE_LABELS = { galley: 'Hodnik', 'l-shape': 'L-oblik', 'u-shape': 'U-oblik' };

  function getOpts() {
    return {
      isGola: golaInput.checked,
      width: parseFloat(widthInput.value) || 300,
      side: activeSide,
      leftCount: parseInt(leftCountInput.value) || 2,
      rightCount: parseInt(rightCountInput.value) || 2,
    };
  }

  function getDonjiFlatList() {
    return Object.keys(MODULE_GROUPS['Donji'] || {}).filter((n) => !CORNER_NAMES.has(n));
  }

  // ── shape pills ────────────────────────────────────────────────────────────
  shapePillsEl.innerHTML = '';
  for (const preset of PRESET_LAYOUTS) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'pp-shape-pill';
    pill.dataset.shape = preset.id;
    pill.setAttribute('role', 'radio');
    pill.innerHTML = `${SHAPE_ICONS[preset.id] || ''}<span class="pp-shape-pill-label">${SHAPE_LABELS[preset.id] || preset.title}</span>`;
    pill.addEventListener('click', () => selectShape(preset.id));
    shapePillsEl.appendChild(pill);
  }

  function selectShape(id) {
    activePresetId = id;
    shapePillsEl.querySelectorAll('.pp-shape-pill').forEach((p) => {
      const active = p.dataset.shape === id;
      p.classList.toggle('active', active);
      p.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    updateOptionVisibility();
    slotModules = {};
    renderPlanView();
  }

  function updateOptionVisibility() {
    const isGalley = activePresetId === 'galley';
    sideWrap.style.display = isGalley ? 'none' : '';
    countsWrap.style.display = isGalley ? 'none' : '';
    if (activePresetId === 'l-shape') {
      leftCountWrap.style.display = activeSide === 'left' ? '' : 'none';
      rightCountWrap.style.display = activeSide === 'right' ? '' : 'none';
    } else if (activePresetId === 'u-shape') {
      leftCountWrap.style.display = '';
      rightCountWrap.style.display = '';
    }
  }

  // ── side toggle (Lijevo/Desno) ─────────────────────────────────────────────
  document.querySelectorAll('.preset-side-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeSide = btn.dataset.side;
      document
        .querySelectorAll('.preset-side-btn')
        .forEach((b) => b.classList.toggle('active', b.dataset.side === activeSide));
      updateOptionVisibility();
      slotModules = {};
      renderPlanView();
    });
  });

  // ── steppers (+/−) ─────────────────────────────────────────────────────────
  document.querySelectorAll('.pp-stepper-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      const step = parseInt(btn.dataset.step, 10) || 1;
      const min = parseInt(target.min, 10) || 1;
      const max = parseInt(target.max, 10) || 99;
      const next = Math.max(min, Math.min(max, (parseInt(target.value, 10) || min) + step));
      if (String(next) !== target.value) {
        target.value = String(next);
        slotModules = {};
        renderPlanView();
      }
    });
  });

  // Re-render on width / gola change
  widthInput.addEventListener('input', () => {
    slotModules = {};
    renderPlanView();
  });
  golaInput.addEventListener('change', () => {
    slotModules = {};
    renderPlanView();
  });

  // ── slot model ─────────────────────────────────────────────────────────────
  // Each slot: { key, type: 'corner'|'cabinet', defaultIme, widthCm }
  function buildSlotModel() {
    const { isGola, width, side, leftCount, rightCount } = getOpts();
    const dss = isGola ? 100 : 80;
    const lss = isGola ? 80 : 90;
    const sw = 60;
    const suf = isGola ? '_gola' : '';

    function mainCabinets(wallLen, keyPrefix = 'main') {
      const count = Math.max(1, Math.floor(wallLen / sw));
      const remainder = wallLen - (count - 1) * sw;
      const out = [];
      for (let i = 0; i < count; i++) {
        const w = i === count - 1 ? remainder : sw;
        const isMiddle = count > 1 && i === Math.floor(count / 2);
        out.push({
          key: `${keyPrefix}-${i}`,
          type: 'cabinet',
          defaultIme: isMiddle ? 'fiokar' + suf : 'radni_stol' + suf,
          widthCm: w,
        });
      }
      return out;
    }
    function sideCabinets(prefix, count) {
      const out = [];
      for (let i = 0; i < count; i++) {
        out.push({ key: `${prefix}-${i}`, type: 'cabinet', defaultIme: 'radni_stol' + suf, widthCm: sw });
      }
      return out;
    }

    const cornerLeft = { key: 'corner-l', type: 'corner', label: 'L', widthCm: dss, isGola };
    const cornerRight = { key: 'corner-r', type: 'corner', label: 'L', widthCm: dss, isGola };

    if (activePresetId === 'galley') {
      return { shape: 'galley', main: mainCabinets(width), left: [], right: [] };
    }
    if (activePresetId === 'l-shape') {
      if (side === 'right') {
        return {
          shape: 'l-right',
          main: [...mainCabinets(width - dss), cornerRight],
          left: [],
          right: sideCabinets('right', rightCount),
        };
      }
      return {
        shape: 'l-left',
        main: [cornerLeft, ...mainCabinets(width - dss)],
        left: sideCabinets('left', leftCount),
        right: [],
      };
    }
    if (activePresetId === 'u-shape') {
      return {
        shape: 'u',
        main: [cornerLeft, ...mainCabinets(width - dss - lss), cornerRight],
        left: sideCabinets('left', leftCount),
        right: sideCabinets('right', rightCount),
      };
    }
    return { shape: 'galley', main: [], left: [], right: [] };
  }

  // ── plan-view renderer (top-down kitchen blueprint) ────────────────────────
  // Main wall is a horizontal row at top. Side walls are vertical columns
  // descending from the corners. This matches how a real kitchen plan looks.
  const PX_PER_CM = 0.55;
  const SLOT_DEPTH_PX = 44;
  const SLOT_GAP = 3;
  function pxFromCm(cm) {
    return Math.max(28, Math.round(cm * PX_PER_CM));
  }

  function renderPlanView() {
    hideTooltip();
    planView.innerHTML = '';
    const model = buildSlotModel();
    const moduleList = getDonjiFlatList();

    // Compute total main wall pixel width for layout sizing
    const mainPx = model.main.reduce((a, s) => a + pxFromCm(s.widthCm), 0) + (model.main.length - 1) * SLOT_GAP;

    // Container scale: if main wall too wide, scale down
    const containerInnerWidth = Math.min(planView.clientWidth || 700, 800);
    const scale = mainPx > 0 && mainPx > containerInnerWidth - 40 ? (containerInnerWidth - 40) / mainPx : 1;

    // Stage div sized to the (possibly scaled) main wall width
    const stage = document.createElement('div');
    stage.className = 'pp-stage';
    stage.style.width = Math.round(mainPx * scale) + 'px';
    stage.style.minHeight = model.left.length || model.right.length ? '220px' : '90px';
    planView.appendChild(stage);

    // Wall lines (decorative — back wall behind main row, side walls along sides)
    const wallTop = document.createElement('div');
    wallTop.className = 'pp-wall pp-wall-top';
    stage.appendChild(wallTop);
    if (model.left.length || model.shape === 'l-left' || model.shape === 'u') {
      const w = document.createElement('div');
      w.className = 'pp-wall pp-wall-left';
      stage.appendChild(w);
    }
    if (model.right.length || model.shape === 'l-right' || model.shape === 'u') {
      const w = document.createElement('div');
      w.className = 'pp-wall pp-wall-right';
      stage.appendChild(w);
    }

    // Main wall row
    const mainRow = document.createElement('div');
    mainRow.className = 'pp-main-row';
    mainRow.style.transform = `scale(${scale})`;
    let cabinetCount = 0;
    model.main.forEach((slot) => {
      mainRow.appendChild(makeSlotEl(slot, moduleList, 'main'));
      if (slot.type === 'cabinet') cabinetCount++;
    });
    stage.appendChild(mainRow);

    // Find x-offset of corners in the main row (used to position side walls)
    const cornerLeftSlot = model.main.find((s) => s.key === 'corner-l');
    const cornerRightSlot = model.main.find((s) => s.key === 'corner-r');

    // Side walls: vertical, anchored to inside edge of corner
    if (model.left.length > 0) {
      const sideCol = document.createElement('div');
      sideCol.className = 'pp-side-col pp-side-left';
      // anchor: just inside the left corner. For l-left, corner is first.
      // The side cabinets' BACK is at x=0 (left wall), so column starts at left edge.
      sideCol.style.top = SLOT_DEPTH_PX + SLOT_GAP + 'px';
      sideCol.style.left = '0px';
      model.left.forEach((slot) => sideCol.appendChild(makeSlotEl(slot, moduleList, 'side')));
      stage.appendChild(sideCol);
      cabinetCount += model.left.length;
    }
    if (model.right.length > 0) {
      const sideCol = document.createElement('div');
      sideCol.className = 'pp-side-col pp-side-right';
      sideCol.style.top = SLOT_DEPTH_PX + SLOT_GAP + 'px';
      sideCol.style.right = '0px';
      model.right.forEach((slot) => sideCol.appendChild(makeSlotEl(slot, moduleList, 'side')));
      stage.appendChild(sideCol);
      cabinetCount += model.right.length;
    }

    // Hint line below preview
    const opts = getOpts();
    const totalCm = opts.width;
    const elementsTxt = `${cabinetCount} ${cabinetCount === 1 ? 'element' : 'elemenata'}`;
    previewHint.textContent = `${SHAPE_LABELS[activePresetId]} · glavni zid ${totalCm}cm · ${elementsTxt}`;
  }

  function makeSlotEl(slot, moduleList, orientation /* 'main' | 'side' */) {
    const el = document.createElement('div');
    el.className = 'pp-slot pp-slot-' + orientation;
    if (slot.type === 'corner') {
      el.classList.add('corner');
      el.title = `Ugaoni element (${slot.widthCm}cm × ${slot.isGola ? 80 : 90}cm, fiksno)`;
      el.innerHTML = `<span class="pp-slot-corner-icon">⌐</span>`;
      // Corner takes its full cm-width on main row; on side wall the vertical slot is fixed
      if (orientation === 'main') {
        el.style.width = pxFromCm(slot.widthCm) + 'px';
        el.style.height = SLOT_DEPTH_PX + 'px';
      }
      return el;
    }
    // cabinet
    const currentIme = slotModules[slot.key] || slot.defaultIme;
    const shortName = currentIme.replace(/_gola$/, '').replace(/_/g, ' ');
    el.dataset.slotKey = slot.key;
    el.innerHTML = `<span class="pp-slot-name">${shortName}</span><span class="pp-slot-dim">${slot.widthCm}cm</span>`;
    if (orientation === 'main') {
      el.style.width = pxFromCm(slot.widthCm) + 'px';
      el.style.height = SLOT_DEPTH_PX + 'px';
    } else {
      // Side: fixed inner dimensions; cm shown in label
      el.style.width = SLOT_DEPTH_PX + 'px';
      el.style.height = pxFromCm(slot.widthCm) + 'px';
    }
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openSlotPicker(el, slot, moduleList);
    });
    return el;
  }

  // ── module picker popover ──────────────────────────────────────────────────
  let activeSlotKey = null;

  function openSlotPicker(anchor, slot, moduleList) {
    if (activeSlotKey === slot.key) {
      hideTooltip();
      return;
    }
    activeSlotKey = slot.key;
    const currentIme = slotModules[slot.key] || slot.defaultIme;
    tooltipList.innerHTML = '';
    moduleList.forEach((name) => {
      const item = document.createElement('div');
      item.className = 'preset-mod-item' + (name === currentIme ? ' selected' : '');
      item.textContent = name.replace(/_gola$/, '').replace(/_/g, ' ');
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        slotModules[slot.key] = name;
        hideTooltip();
        renderPlanView();
      });
      tooltipList.appendChild(item);
    });

    // Position popover relative to viewport, prefer below
    tooltip.classList.remove('hidden');
    const rect = anchor.getBoundingClientRect();
    const popH = tooltip.offsetHeight || 240;
    const popW = tooltip.offsetWidth || 200;
    let top = rect.bottom + 6;
    let left = rect.left + rect.width / 2 - popW / 2;
    if (top + popH > window.innerHeight - 8) top = rect.top - popH - 6;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    if (left < 8) left = 8;
    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
  }

  function hideTooltip() {
    tooltip.classList.add('hidden');
    activeSlotKey = null;
  }

  document.addEventListener('click', (e) => {
    if (modal.classList.contains('hidden')) return;
    if (!tooltip.contains(e.target)) hideTooltip();
  });

  // ── apply / open / close ───────────────────────────────────────────────────
  function applyAndClose() {
    const opts = getOpts();
    const dynamicPlan = buildDynamicPlan(activePresetId, { ...opts, slotModules, suf: opts.isGola ? '_gola' : '' });

    pushHistory();
    const newOccupied = {};
    dynamicPlan.forEach((item) => {
      if (item.mat_pos) newOccupied[`${item.mat_pos[0]},${item.mat_pos[1]}`] = { sirina: item.sirina, ime: item.ime };
    });
    state.plan = JSON.parse(JSON.stringify(dynamicPlan));
    state.occupiedCells = newOccupied;
    state.selectedPlanIdx = -1;
    setEditingPlanIdx(-1);
    rebuildAllModules();
    refreshParams();
    updateWallGridDisplay();
    renderPlanList();
    updateTotalCost();
    showNotification('Predlozak primijenjen', 'success');
    closeModal();
  }

  function openModal() {
    modal.classList.remove('hidden');
    selectShape(activePresetId);
  }
  function closeModal() {
    modal.classList.add('hidden');
    hideTooltip();
  }

  addBtn.addEventListener('click', applyAndClose);
  btnPresets.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);
}

function initLanguageSwitcher() {
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      setLocale(lang);
      document.querySelectorAll('.lang-btn').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
      updateUILabels();
      initCategoryTabs();
      populateModuleSelect();
      if (editingPlanIdx >= 0) refreshParamsForPlanItem(editingPlanIdx);
      else refreshParams();
      renderPlanList();
    });
  });
}

function updateUILabels() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const localized = t(key);
    if (localized) {
      if (el.children.length === 0) {
        el.textContent = localized;
      } else {
        for (let node of el.childNodes) {
          if (node.nodeType === 3 && node.textContent.trim().length > 0) node.textContent = localized;
        }
      }
    }
  });
  const searchEl = document.getElementById('module-search');
  if (searchEl) searchEl.placeholder = t('ui.searchPlaceholder');
  const hintEl = document.getElementById('viewer-hint');
  if (hintEl) {
    const helpLink = hintEl.querySelector('#hint-help-link');
    const helpHtml = helpLink ? helpLink.outerHTML : '<a href="#" id="hint-help-link" style="color:var(--accent);text-decoration:underline;">?</a>';
    hintEl.innerHTML = t('viewerHint') + helpHtml;
    hintEl.querySelector('#hint-help-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      window._showTour?.();
    });
  }
}

function initCategoryTabs() {
  const tabs = document.querySelectorAll('.tab[data-cat]');
  tabs.forEach((tab) => {
    const cat = tab.dataset.cat;
    const label = t(`categories.${cat}`);
    if (label) tab.textContent = label;
    tab.onclick = () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentCategory = cat;
      const searchEl = document.getElementById('module-search');
      if (searchEl) searchEl.value = '';
      populateModuleSelect();
    };
  });
}

function initModuleSelect() {
  populateModuleSelect();
  const searchEl = document.getElementById('module-search');
  if (searchEl) {
    searchEl.addEventListener('input', () => populateModuleSelect());
    searchEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchEl.value = '';
        populateModuleSelect();
        searchEl.blur();
      }
    });
    document.querySelectorAll('.tab[data-cat]').forEach((btn) =>
      btn.addEventListener('click', () => {
        searchEl.value = '';
      }),
    );
  }
  document.getElementById('klizac-select').addEventListener('change', (e) => {
    state.klizac = e.target.value;
  });
  document.getElementById('client-name').addEventListener('input', (e) => {
    state.clientName = e.target.value;
  });
}

function populateModuleSelect() {
  const grid = document.getElementById('module-grid');
  grid.innerHTML = '';

  if (state.currentCategory === 'Custom') {
    populateCustomModules(grid);
    return;
  }

  const mods = MODULE_GROUPS[state.currentCategory] || {};
  const searchEl = document.getElementById('module-search');
  const query = (searchEl?.value || '').toLowerCase().replace(/\s+/g, '_');

  let matchCount = 0;
  for (const name of Object.keys(mods)) {
    if (query && !name.toLowerCase().includes(query)) continue;
    matchCount++;
    const card = document.createElement('div');
    card.className = 'module-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', name.replace(/_/g, ' '));
    if (state.selectedModule === name) {
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
    } else card.setAttribute('aria-pressed', 'false');
    card.innerHTML = `${getModuleIconSVG(name)}<div class="module-card-label">${name.replace(/_/g, ' ')}</div>`;
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
    card.addEventListener('click', () => {
      grid.querySelectorAll('.module-card').forEach((c) => {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
      state.selectedModule = name;
      setEditingPlanIdx(-1);
      refreshParams();
    });
    grid.appendChild(card);
  }

  if (query && matchCount === 0) {
    const empty = document.createElement('div');
    empty.className = 'module-search-empty';
    empty.textContent = `Nije pronađeno (0)`;
    grid.appendChild(empty);
  }

  const firstKey = Object.keys(mods)[0];
  if (!state.selectedModule && firstKey) {
    state.selectedModule = firstKey;
    if (grid.firstChild) grid.firstChild.classList.add('selected');
  } else if (!mods[state.selectedModule]) {
    state.selectedModule = '';
  }
  refreshParams();
}

function populateCustomModules(grid) {
  const customs = getCustomModules();
  if (customs.length === 0) {
    grid.innerHTML =
      '<div class="module-search-empty">Nema sačuvanih presetova. Desni klik na element u planu → "Save as Preset"</div>';
    state.selectedModule = '';
    refreshParams();
    return;
  }

  customs.forEach((preset, idx) => {
    const card = document.createElement('div');
    card.className = 'module-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', preset.name);

    const del = document.createElement('button');
    del.className = 'custom-module-delete';
    del.innerHTML = '×';
    del.title = 'Obriši preset';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCustomModule(idx);
      initCustomModulesUI();
      populateModuleSelect();
      showNotification('Preset obrisan', 'info');
    });

    card.innerHTML = `${getModuleIconSVG(preset.ime)}<div class="module-card-label">${preset.name}</div>`;
    card.appendChild(del);
    card.addEventListener('click', () => {
      grid.querySelectorAll('.module-card').forEach((c) => {
        c.classList.remove('selected');
      });
      card.classList.add('selected');
      state.selectedModule = preset.ime;
      setEditingPlanIdx(-1);
      state.paramInputs = { ...preset.p };
      refreshParamsForCustomPreset(preset);
    });
    grid.appendChild(card);
  });

  if (customs.length > 0 && !state.selectedModule) {
    state.selectedModule = customs[0].ime;
    grid.firstChild?.classList.add('selected');
  }
  refreshParams();
}

function refreshParamsForCustomPreset(preset) {
  const container = document.getElementById('params-container');
  container.innerHTML = '';
  let paramDefs = null;
  for (const cat of Object.values(MODULE_GROUPS)) {
    if (cat[preset.ime]) {
      paramDefs = cat[preset.ime];
      break;
    }
  }
  if (!paramDefs) {
    container.innerHTML = '<div class="params-empty">Parametri nisu dostupni za ovaj modul</div>';
    return;
  }

  paramDefs.forEach(([name]) => {
    const row = document.createElement('div');
    row.className = 'param-row';
    const label = document.createElement('span');
    label.className = 'param-name';
    const localized = typeof PARAM_LABELS[name] === 'function' ? PARAM_LABELS[name]() : PARAM_LABELS[name] || name;
    label.textContent = localized ? `${localized} (${name})` : name;
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'param-input';
    input.value = preset.p[name] ?? '';
    input.step = '1';
    applyParamInputBounds(input, name);
    state.paramInputs[name] = preset.p[name] ?? '';
    input.addEventListener('input', () => {
      state.paramInputs[name] = input.value;
    });
    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  });
}

function initCustomModulesUI() {}

// ─── Multi-Plan Tabs ───────────────────────────────────────────────────────────
function initPlanTabs() {
  renderPlanTabs();

  document.getElementById('btn-add-plan-tab')?.addEventListener('click', () => {
    saveCurrentTab(state.plan, state.occupiedCells, state.wallFixtures);
    const num = getPlanTabs().length + 1;
    addTab('Plan ' + num);
    applyTabData();
    renderPlanTabs();
    showNotification('Novi plan kreiran', 'success');
  });
}

function renderPlanTabs() {
  const container = document.getElementById('plan-tabs');
  if (!container) return;
  container.innerHTML = '';

  const tabs = getPlanTabs();
  const active = getActiveTab();

  tabs.forEach((tab, idx) => {
    const el = document.createElement('button');
    el.className = 'plan-tab' + (idx === active ? ' active' : '');
    el.textContent = tab.name;
    el.title = tab.name;
    el.addEventListener('click', () => {
      if (idx === active) return;
      saveCurrentTab(state.plan, state.occupiedCells, state.wallFixtures);
      switchTab(idx);
      applyTabData();
      renderPlanTabs();
    });

    if (tabs.length > 1) {
      const close = document.createElement('span');
      close.className = 'plan-tab-close';
      close.innerHTML = '×';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm('Obrisati plan "' + tab.name + '"?')) return;
        saveCurrentTab(state.plan, state.occupiedCells, state.wallFixtures);
        const newIdx = removeTab(idx);
        applyTabData();
        renderPlanTabs();
        showNotification('Plan obrisan', 'info');
      });
      el.appendChild(close);
    }

    container.appendChild(el);
  });
}

function applyTabData() {
  const data = loadTabData(getActiveTab());
  if (!data) return;
  state.plan = data.plan;
  state.occupiedCells = data.occupiedCells;
  state.wallFixtures = data.wallFixtures;
  state.selectedPlanIdx = -1;
  setEditingPlanIdx(-1);
  rebuildAllModules();
  refreshParams();
  updateWallGridDisplay();
  renderPlanList();
  updateTotalCost();
  clearFixtureMarkers();
  state.wallFixtures.forEach((f, i) => addFixtureMarker(i, f));
}

export function refreshParams() {
  const container = document.getElementById('params-container');
  container.innerHTML = '';
  state.paramInputs = {};
  const mods = MODULE_GROUPS[state.currentCategory] || {};
  const paramDefs = mods[state.selectedModule];
  if (!paramDefs || paramDefs.length === 0) {
    container.innerHTML = '<div class="params-empty">Izaberi modul za parametre</div>';
    return;
  }
  paramDefs.forEach(([name, defaultVal], idx) => {
    const row = document.createElement('div');
    row.className = 'param-row';
    const label = document.createElement('span');
    label.className = 'param-name';
    const localized = typeof PARAM_LABELS[name] === 'function' ? PARAM_LABELS[name]() : PARAM_LABELS[name] || name;
    label.textContent = localized ? `${localized} (${name})` : name;
    label.title = localized || name;
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'param-input';
    input.value = defaultVal;
    input.step = '1';
    input.setAttribute('aria-label', localized ? `${localized} (${name})` : name);
    applyParamInputBounds(input, name);
    input.addEventListener('keydown', (e) => {
      const rows = container.querySelectorAll('.param-input');
      if (e.key === 'ArrowDown' && idx < rows.length - 1) {
        rows[idx + 1].focus();
        e.preventDefault();
      }
      if (e.key === 'ArrowUp' && idx > 0) {
        rows[idx - 1].focus();
        e.preventDefault();
      }
    });
    state.paramInputs[name] = defaultVal;
    input.addEventListener('input', () => {
      state.paramInputs[name] = input.value;
    });
    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  });
}

export function refreshParamsForPlanItem(planIdx) {
  const item = state.plan[planIdx];
  if (!item) return;
  setEditingPlanIdx(planIdx);
  let paramDefs = null;
  for (const cat of Object.values(MODULE_GROUPS)) {
    if (cat[item.ime]) {
      paramDefs = cat[item.ime];
      break;
    }
  }
  if (!paramDefs) return;

  const container = document.getElementById('params-container');
  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'params-edit-banner';
  header.textContent = 'Editovanje: ' + item.ime.replace(/_/g, ' ');
  container.appendChild(header);

  paramDefs.forEach(([name], idx) => {
    const row = document.createElement('div');
    row.className = 'param-row';
    const label = document.createElement('span');
    label.className = 'param-name';
    const localized = typeof PARAM_LABELS[name] === 'function' ? PARAM_LABELS[name]() : PARAM_LABELS[name] || name;
    label.textContent = localized ? `${localized} (${name})` : name;
    label.title = localized || name;
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'param-input';
    input.value = item.p[name] ?? '';
    input.step = '1';
    input.setAttribute('aria-label', localized ? `${localized} (${name})` : name);
    applyParamInputBounds(input, name);
    input.addEventListener('keydown', (e) => {
      const rows = container.querySelectorAll('.param-input');
      if (e.key === 'ArrowDown' && idx < rows.length - 1) {
        rows[idx + 1].focus();
        e.preventDefault();
      }
      if (e.key === 'ArrowUp' && idx > 0) {
        rows[idx - 1].focus();
        e.preventDefault();
      }
    });
    let _paramSnapshotted = false;
    input.addEventListener('focus', () => {
      _paramSnapshotted = false;
    });
    input.addEventListener('blur', () => {
      _paramSnapshotted = false;
    });
    input.addEventListener('input', () => {
      if (!_paramSnapshotted) {
        pushHistory();
        _paramSnapshotted = true;
      }
      const val = input.value;
      item.p[name] = val;
      const WIDTH_PARAMS = ['s', 'dss', 'sl', 'l'];
      if (WIDTH_PARAMS.includes(name) && item.mat_pos) {
        const newSirina = parseFloat(val) || item.sirina;
        item.sirina = newSirina;
        const cellKey = `${item.mat_pos[0]},${item.mat_pos[1]}`;
        if (state.occupiedCells[cellKey]) state.occupiedCells[cellKey].sirina = newSirina;
        shiftRowFrom(item.mat_pos[0], item.mat_pos[1]);
        const [selRow, selCol] = state.selectedCell;
        if (selRow === item.mat_pos[0] && selCol > item.mat_pos[1]) {
          let calcX = 0;
          for (let c = 1; c < selCol; c++) {
            const k = `${selRow},${c}`;
            if (state.occupiedCells[k]) calcX += state.occupiedCells[k].sirina;
          }
          setPos('x', calcX);
        }
      }
      _debouncedUpdateModule3D(planIdx);
      if (state.showMeasurements) updateModuleMeasurements(planIdx);
      updateTotalCost();
      autoSave();
    });
    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  });
}

export function initToggles() {
  const grids = [document.getElementById('toggles-grid'), document.getElementById('toggles-grid-popover')].filter(
    Boolean,
  );
  grids.forEach((grid) => {
    grid.innerHTML = '';
    for (const [key, label] of Object.entries(TOGGLE_LABELS)) {
      const item = document.createElement('div');
      item.className = 'toggle-item' + (state.settings[key] ? ' active' : '');
      item.dataset.key = key;
      item.setAttribute('role', 'switch');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-checked', state.settings[key] ? 'true' : 'false');
      item.setAttribute('aria-label', label);
      const sw = document.createElement('div');
      sw.className = 'toggle-switch';
      const lbl = document.createElement('span');
      lbl.className = 'toggle-label';
      lbl.textContent = label;
      item.appendChild(sw);
      item.appendChild(lbl);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });
      item.addEventListener('click', () => {
        state.settings[key] = !state.settings[key];
        document.querySelectorAll(`.toggle-item[data-key="${key}"]`).forEach((el) => {
          el.classList.toggle('active', state.settings[key]);
          el.setAttribute('aria-checked', state.settings[key] ? 'true' : 'false');
        });
        clearGeomCache();
        rebuildAllModules();
      });
      grid.appendChild(item);
    }
  });
}

function initPositionInputs() {
  ['x', 'y', 'z', 'r'].forEach((axis) => {
    const el = document.getElementById(`pos-${axis}`);
    let _posSnapshotted = false;
    el.addEventListener('focus', () => {
      _posSnapshotted = false;
    });
    el.addEventListener('blur', () => {
      _posSnapshotted = false;
    });
    el.addEventListener('input', (e) => {
      if (state.selectedPlanIdx >= 0 && !_posSnapshotted) {
        pushHistory();
        _posSnapshotted = true;
      }
      const val = parseFloat(e.target.value) || 0;
      state.position[axis] = val;
      if (state.selectedPlanIdx >= 0) {
        const item = state.plan[state.selectedPlanIdx];
        if (axis === 'x') {
          const oldX = item.pos[0];
          const delta = val - oldX;
          item.pos[0] = val;
          if (item.mat_pos && delta !== 0) {
            const [itemRow, itemCol] = item.mat_pos;
            for (let c = itemCol + 1; c <= WALL_COLS; c++) {
              const key = `${itemRow},${c}`;
              const cellData = state.occupiedCells[key];
              if (!cellData) continue;
              const rightItem = state.plan.find((m) => m.mat_pos && m.mat_pos[0] === itemRow && m.mat_pos[1] === c);
              if (!rightItem) continue;
              rightItem.pos[0] += delta;
              const rightIdx = state.plan.indexOf(rightItem);
              // Position-only change: just move the existing group, no geometry rebuild
              moveModuleGroup(rightIdx, rightItem.pos[0], rightItem.pos[1], rightItem.pos[2], rightItem.r || 0);
            }
            const [selRow, selCol] = state.selectedCell;
            if (selRow === itemRow && selCol > itemCol) {
              let calcX = 0;
              for (let c = 1; c < selCol; c++) {
                const k = `${selRow},${c}`;
                if (state.occupiedCells[k]) calcX += state.occupiedCells[k].sirina;
              }
              state.position['x'] = calcX + delta;
            }
            rebuildCountertopsForRow(itemRow);
          }
        } else if (axis === 'y') {
          item.pos[1] = val;
        } else if (axis === 'z') {
          item.pos[2] = val;
        } else if (axis === 'r') {
          item.r = val;
        }
        // Position/rotation change: move existing group, no geometry rebuild needed
        moveModuleGroup(state.selectedPlanIdx, item.pos[0], item.pos[1], item.pos[2], item.r || 0);
        highlightModule(state.selectedPlanIdx);
        renderPlanList();
      }
    });
  });
}

export function setPos(axis, val) {
  state.position[axis] = val;
  const el = document.getElementById(`pos-${axis}`);
  if (el) el.value = val;
}

function getPos() {
  return {
    x: parseFloat(document.getElementById('pos-x').value) || 0,
    y: parseFloat(document.getElementById('pos-y').value) || 0,
    z: parseFloat(document.getElementById('pos-z').value) || 0,
    r: parseFloat(document.getElementById('pos-r').value) || 0,
  };
}

function initPlanActions() {
  document.getElementById('btn-add').addEventListener('click', () => {
    addToPlan(state.selectedModule, state.paramInputs, state.klizac, getPos, setPos);
  });
  document.getElementById('btn-krojna').addEventListener('click', showKrojnaLista);
  document.getElementById('btn-optimik').addEventListener('click', exportOptimik);
  document.getElementById('btn-pdf').addEventListener('click', exportPdf);
  document.getElementById('btn-client-pdf').addEventListener('click', exportClientPdf);

  const btnToggleMat = document.getElementById('btn-toggle-materials');
  const matPanel = document.getElementById('materials-panel');
  if (btnToggleMat && matPanel) btnToggleMat.addEventListener('click', () => matPanel.classList.toggle('hidden'));

  const btnRadna = document.getElementById('btn-radna');
  btnRadna.addEventListener('click', () => {
    state.addingRadnaPloca = !state.addingRadnaPloca;
    btnRadna.classList.toggle('is-active-mode', state.addingRadnaPloca);
    if (state.addingRadnaPloca) {
      state.radnaPlocaSelection = [];
      showNotification('Dvoklikni na pocetni element, a zatim na krajnji element za spajanje radne ploce.', 'info');
    } else {
      state.radnaPlocaSelection = [];
      import('./viewer.js').then((v) => v.highlightModule(-1));
      showNotification('Izasao si iz moda za dodavanje radne ploce.', 'info');
    }
  });

  document.getElementById('btn-cokla').addEventListener('click', () => {
    state.addingCokla = !state.addingCokla;
    const btnCokla = document.getElementById('btn-cokla');
    btnCokla.classList.toggle('is-active-mode', state.addingCokla);
    if (state.addingCokla) {
      state.coklaSelection = [];
      showNotification('Dvoklikni na pocetni element, a zatim na krajnji element za spajanje cokle.', 'info');
    } else {
      state.coklaSelection = [];
      import('./viewer.js').then((v) => v.highlightModule(-1));
      showNotification('Izasao si iz moda za dodavanje cokle.', 'info');
    }
  });

  document.getElementById('btn-view-front').addEventListener('click', () => setCameraView('front'));
  document.getElementById('btn-view-iso').addEventListener('click', () => setCameraView('iso'));
  document.getElementById('btn-view-top').addEventListener('click', () => setCameraView('top'));
  document.getElementById('btn-reset-cam').addEventListener('click', resetCamera);

  const btnLight = document.getElementById('btn-toggle-light');
  if (btnLight) {
    btnLight.classList.toggle('light-warm', state.lightingMode === 'warm');
    btnLight.addEventListener('click', () => {
      state.lightingMode = state.lightingMode === 'cool' ? 'warm' : 'cool';
      setLightingMode(state.lightingMode);
      btnLight.classList.toggle('light-warm', state.lightingMode === 'warm');
      showNotification('Osvjetljenje: ' + (state.lightingMode === 'warm' ? 'Toplo' : 'Hladno'), 'info');
    });
  }

  const btnPbr = document.getElementById('btn-toggle-pbr');
  if (btnPbr) {
    btnPbr.addEventListener('click', () => {
      const next = !isPBRMode();
      setPBRMode(next);
      btnPbr.classList.toggle('active', next);
      showNotification(next ? 'Fotorealistični prikaz uključen' : 'Standardni prikaz', 'info');
    });
  }

  const btnPrikaz = document.getElementById('btn-toggle-prikaz');
  const popover = document.getElementById('prikaz-popover');
  if (btnPrikaz && popover) {
    btnPrikaz.onclick = (e) => {
      e.stopPropagation();
      popover.classList.toggle('hidden');
    };
    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && !btnPrikaz.contains(e.target)) popover.classList.add('hidden');
    });
  }

  document.addEventListener('keydown', (e) => {
    const inInput = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA';
    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      historyUndo();
      return;
    }
    if (
      (e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
      (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
      (e.key === 'Z' && (e.ctrlKey || e.metaKey))
    ) {
      e.preventDefault();
      historyRedo();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !inInput && state.selectedPlanIdx >= 0) {
      deleteModule(state.selectedPlanIdx);
      return;
    }
    if ((e.key === 'r' || e.key === 'R') && !inInput && state.selectedPlanIdx >= 0) {
      mirrorModule(state.selectedPlanIdx);
      return;
    }
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveProject();
      return;
    }
    if (e.key === 'd' && (e.ctrlKey || e.metaKey) && !inInput && state.selectedPlanIdx >= 0) {
      e.preventDefault();
      duplicateModule(state.selectedPlanIdx);
      return;
    }
    if (e.key === 'Escape') {
      document.getElementById('ctx-menu')?.classList.add('hidden');
      document.querySelectorAll('.modal:not(.hidden)').forEach((m) => m.classList.add('hidden'));
      document.querySelectorAll('.viewer-popover:not(.hidden)').forEach((p) => p.classList.add('hidden'));
      if (state.selectedPlanIdx >= 0) {
        state.selectedPlanIdx = -1;
        setEditingPlanIdx(-1);
        clearMeasurements();
        highlightModule(-1);
        refreshParams();
        renderPlanList();
      }
      return;
    }
  });

  document.getElementById('btn-save-project')?.addEventListener('click', saveProject);
  document.getElementById('btn-load-project')?.addEventListener('click', loadProject);
  document.getElementById('btn-clear-plan')?.addEventListener('click', clearPlan);
}

function historyUndo() {
  if (_history.past.length === 0) {
    showNotification('Nema vise koraka za ponistiti', 'info');
    return;
  }
  _history.future.push(_clonePlanState());
  _applySnapshot(_history.past.pop());
  showNotification('Ponisteno (' + _history.past.length + ' preostalo)', 'info');
}

function historyRedo() {
  if (_history.future.length === 0) {
    showNotification('Nema vise koraka za ponavljanje', 'info');
    return;
  }
  _history.past.push(_clonePlanState());
  _applySnapshot(_history.future.pop());
  showNotification('Ponavljeno (' + _history.future.length + ' preostalo)', 'info');
}

function _applySnapshot(snapshot) {
  state.plan = snapshot.plan;
  state.occupiedCells = snapshot.occupiedCells;
  if (snapshot.materials) {
    state.materials = snapshot.materials;
    import('./material-picker.js').then((m) => m.refreshMaterialSwatches());
  }
  state.selectedPlanIdx = -1;
  setEditingPlanIdx(-1);
  rebuildAllModules();
  refreshParams();
  updateWallGridDisplay();
  renderPlanList();
  updateTotalCost();
}

// ─── Wall Fixtures ────────────────────────────────────────────────────────────
function initFixtureModal() {
  const popover = document.getElementById('fixture-popover');
  const btnOpen = document.getElementById('btn-add-fixture');
  if (btnOpen && popover) {
    btnOpen.onclick = (e) => {
      e.stopPropagation();
      popover.classList.toggle('hidden');
      if (!popover.classList.contains('hidden')) renderFixtureList();
    };
    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && !btnOpen.contains(e.target)) popover.classList.add('hidden');
    });
  }
  const typeSel = document.getElementById('fixture-type-select');
  const dimsRow = document.getElementById('fixture-dims-row');
  if (typeSel) {
    typeSel.innerHTML = FIXTURE_TYPES.map((t) => `<option value="${t.id}">${t.icon} ${t.label}</option>`).join('');
    typeSel.addEventListener('change', () => {
      const isRect = typeSel.value === 'window' || typeSel.value === 'door';
      if (dimsRow) dimsRow.classList.toggle('hidden', !isRect);
    });
  }
  document.getElementById('modal-fixture-add')?.addEventListener('click', () => {
    const typeId = typeSel.value;
    const typeDef = FIXTURE_TYPES.find((t) => t.id === typeId);
    if (!typeDef) return;
    const fixture = {
      type: typeId,
      label: document.getElementById('fixture-label-input').value || typeDef.label,
      x: parseFloat(document.getElementById('fixture-x-input').value) || 0,
      y: parseFloat(document.getElementById('fixture-y-input').value) || 0,
      color: typeDef.color,
    };
    if (typeId === 'window' || typeId === 'door') {
      fixture.width = parseFloat(document.getElementById('fixture-width-input').value) || 80;
      fixture.height = parseFloat(document.getElementById('fixture-height-input').value) || 120;
    }
    state.wallFixtures.push(fixture);
    addFixtureMarker(state.wallFixtures.length - 1, fixture);
    renderFixtureList();
    showNotification('Dodan ' + fixture.label, 'success');
  });
}

function renderFixtureList() {
  const wrap = document.getElementById('fixture-list-wrap');
  if (!wrap) return;
  if (state.wallFixtures.length === 0) {
    wrap.innerHTML =
      '<div style="font-size:11px;color:var(--text-dim);text-align:center;padding:10px;margin-top:10px;border:1px dashed var(--border);border-radius:8px;">Nema dodanih elemenata</div>';
    return;
  }
  let html =
    '<div style="margin-top:10px;max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:rgba(0,0,0,0.2);">';
  state.wallFixtures.forEach((f, idx) => {
    const typeDef = FIXTURE_TYPES.find((t) => t.id === f.type);
    const sizeStr = f.width && f.height ? ` (${f.width}x${f.height})` : '';
    html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border);font-size:11px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:14px;">${typeDef ? typeDef.icon : '📍'}</span>
        <div><div style="font-weight:600;color:var(--text-primary);">${f.label}${sizeStr}</div><div style="font-size:10px;color:var(--text-secondary);opacity:0.7;">X:${f.x} Y:${f.y} cm</div></div>
      </div>
      <button class="btn btn-icon" style="color:var(--red);font-size:14px;" onclick="removeFixture(${idx})">×</button>
    </div>`;
  });
  html += '</div>';
  wrap.innerHTML = html;
}

window.removeFixture = (idx) => {
  state.wallFixtures.splice(idx, 1);
  removeFixtureMarker(idx);
  clearFixtureMarkers();
  state.wallFixtures.forEach((f, i) => addFixtureMarker(i, f));
  renderFixtureList();
};

// ─── First-run Tour ────────────────────────────────────────────────────────────
function initTour() {
  if (localStorage.getItem('mecoTourDone') === '1') return;

  const steps = [
    { target: '#btn-measure', label: 'Mjere', text: 'Prikaži ili sakrij dimenzije odabranog modula u 3D prikazu.' },
    {
      target: '#btn-view-front',
      label: 'Kamera',
      text: 'Brzo prebaci pogled: sprijeda, izometrija, odozgo ili resetuj kameru.',
    },
    {
      target: '#btn-toggle-light',
      label: 'Osvjetljenje',
      text: 'Prebaci između toplog i hladnog osvjetljenja za bolji uvid u materijale.',
    },
    {
      target: '#btn-toggle-pbr',
      label: 'Fotorealizam',
      text: 'Uključi PBR rendering sa HDRI okruženjem za prikaz kvalitetan za klijente.',
    },
    {
      target: '#btn-toggle-prikaz',
      label: 'Prikaz elemenata',
      text: 'Uključi/isključi dijelove modula: vrata, police, pozadinu, fioke, radnu ploču.',
    },
    {
      target: '#btn-add-fixture',
      label: 'Elementi zida',
      text: 'Dodaj oznake za vodu, struju, prozore, vrata i druge elemente na zidu.',
    },
  ];

  const overlay = document.getElementById('tour-overlay');
  const tooltip = document.getElementById('tour-tooltip');
  const stepLabel = document.getElementById('tour-step-label');
  const text = document.getElementById('tour-text');
  const counter = document.getElementById('tour-counter');
  const btnNext = document.getElementById('tour-next');
  const btnSkip = document.getElementById('tour-skip');
  let current = 0;
  let prevHighlight = null;

  function cleanup() {
    if (prevHighlight) prevHighlight.classList.remove('tour-highlight');
    prevHighlight = null;
    overlay.classList.add('hidden');
  }

  function showStep(i) {
    if (prevHighlight) prevHighlight.classList.remove('tour-highlight');
    if (i >= steps.length) {
      cleanup();
      localStorage.setItem('mecoTourDone', '1');
      return;
    }
    current = i;
    const step = steps[i];
    const target = document.querySelector(step.target);
    if (!target) {
      showStep(i + 1);
      return;
    }

    target.classList.add('tour-highlight');
    prevHighlight = target;

    stepLabel.textContent = step.label;
    text.textContent = step.text;
    counter.textContent = `${i + 1} / ${steps.length}`;
    btnNext.textContent = i === steps.length - 1 ? 'Gotovo ✓' : 'Sljedeći →';

    overlay.classList.remove('hidden');

    requestAnimationFrame(() => {
      const rect = target.getBoundingClientRect();
      const ttW = 280;
      let left = rect.left + rect.width / 2 - ttW / 2;
      let top = rect.bottom + 12;
      if (top + 160 > window.innerHeight) top = rect.top - 160;
      if (left < 12) left = 12;
      if (left + ttW > window.innerWidth - 12) left = window.innerWidth - ttW - 12;
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    });
  }

  btnNext.addEventListener('click', () => showStep(current + 1));
  btnSkip.addEventListener('click', () => {
    cleanup();
    localStorage.setItem('mecoTourDone', '1');
  });
  overlay.querySelector('.tour-backdrop').addEventListener('click', () => {
    cleanup();
    localStorage.setItem('mecoTourDone', '1');
  });

  setTimeout(() => showStep(0), 800);

  document.getElementById('hint-help-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('mecoTourDone');
    showStep(0);
  });
}
