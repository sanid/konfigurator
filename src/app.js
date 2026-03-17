/**
 * app.js — Main renderer process logic
 * Meco Konfigurator 2026 — Electron/JSCAD Edition
 */
import { MODULE_GROUPS, DEFAULT_MATERIALS, DEFAULT_SETTINGS, COLOR_PRESETS, TEXTURE_PRESETS } from './modules-config.js';
import { buildKitchenModule, clearGeomCache } from './kitchen-builder.js';
import { buildDynamicPlan, validatePresetPlan, PRESET_LAYOUTS } from './presets.js';
import { t, setLocale } from './i18n.js';
import { initViewer, addModuleGroup, removeModuleGroup, shiftModuleGroups, moveModuleGroup, clearAllGroups, setCameraView, resetCamera, highlightModule, resizeViewer, setViewerTheme, setLayoutWalls, setSideWallsVisible, addFixtureMarker, removeFixtureMarker, clearFixtureMarkers, setLightingMode, getModuleIndexAt, getModuleSnapInfoAt, getModuleGroup, showMeasurements, clearMeasurements } from './viewer.js';

import { state, isDark, setIsDark, editingPlanIdx, setEditingPlanIdx, pushHistory, _history, _clonePlanState } from './state.js';
import { showNotification } from './notifications.js';
import { initPriceInputs, updateTotalCost, calcKant, getPriceForMaterial } from './price-utils.js';
import { initWallGrid, selectCell, updateWallGridDisplay, shiftRowFrom, rebuildCountertopsForRow, WALL_ROWS, WALL_COLS, openReplaceTooltip } from './wall-grid.js';
import { initMaterialsPanel, refreshMaterialSwatches, initMaterialPickerModal, openMaterialPicker, MAT_LABELS } from './material-picker.js';
import { autoSave, autoRestore, saveProject, loadProject } from './project-storage.js';
import { setSnapAnchorByIndex, snapModuleToSide } from './snap.js';
import { addSpecialElement, addRadnaPlocaToModule, addCoklaToModule, isCornerElement, CORNER_ELEMENT_NAMES } from './special-elements.js';
import { addToPlan, deleteModule, mirrorModule, duplicateModule, clearPlan, rebuildAllModules, updateModule3D, updateModuleMeasurements, selectModuleByIndex, renderPlanList, PLAN_ICONS } from './plan-manager.js';
import { initKrojnaModal, showKrojnaLista, exportOptimik, exportPdf, exportModuleMPR, exportAllMPR } from './exports.js';
import { initModuleManager, openModuleManager } from './module-manager.js';

// ─── Wall Fixture Types ───────────────────────────────────────────────────────
const FIXTURE_TYPES = [
  { id: 'water', label: 'Vodovod', icon: '💧', color: 0x2196f3 },
  { id: 'drain', label: 'Kanalizacija', icon: '🔩', color: 0x795548 },
  { id: 'power', label: 'Struja (uticnica)', icon: '⚡', color: 0xffc107 },
  { id: 'gas', label: 'Gas', icon: '🔥', color: 0xff5722 },
  { id: 'window', label: 'Prozor', icon: '🪟', color: 0x90caf9 },
  { id: 'door', label: 'Vrata', icon: '🚪', color: 0xa1887f },
  { id: 'column', label: 'Stub', icon: '⬛', color: 0x9e9e9e },
  { id: 'other', label: 'Ostalo', icon: '📍', color: 0xce93d8 },
];

// Parameter human-readable abbreviations
const PARAM_LABELS = {
  s:    () => t('params.s'),
  v:    () => t('params.v'),
  d:    () => t('params.d'),
  c:    () => t('params.c'),
  brvr: () => t('params.brvr'),
  brp:  () => t('params.brp'),
  brf:  () => t('params.brf'),
  brfp: () => t('params.brfp'),
  brfd: () => t('params.brfd'),
  brv:  () => t('params.brvr'),
  rerna: () => t('params.rerna'),
  dss:   () => t('params.dss'),
  sl:    () => t('params.sl'),
  sd:    () => t('params.sd'),
  ss:    () => t('params.ss'),
  ds:    () => t('params.ds'),
  vs:    () => t('params.vs')
};

const PARAM_BOUNDS = {
  s:    { min: 10,  max: 400 },
  v:    { min: 10,  max: 300 },
  d:    { min: 10,  max: 150 },
  c:    { min: 0,   max: 30  },
  brvr: { min: 1,   max: 8   },
  brv:  { min: 1,   max: 8   },
  brp:  { min: 0,   max: 10  },
  brf:  { min: 1,   max: 8   },
  brfp: { min: 0,   max: 8   },
  brfd: { min: 0,   max: 8   },
  rerna:{ min: 10,  max: 100 },
  dss:  { min: 10,  max: 400 },
  lss:  { min: 10,  max: 400 },
  sl:   { min: 10,  max: 400 },
  sd:   { min: 10,  max: 400 },
  ss:   { min: 5,   max: 200 },
  ds:   { min: 5,   max: 150 },
  vs:   { min: 5,   max: 300 },
  l:    { min: 10,  max: 600 },
};

function clampParamValue(name, val) {
  const bounds = PARAM_BOUNDS[name] || { min: 0, max: 1000 };
  return Math.min(bounds.max, Math.max(bounds.min, parseFloat(val) || bounds.min));
}

function applyParamInputBounds(input, name) {
  const bounds = PARAM_BOUNDS[name] || { min: 0, max: 1000 };
  input.min = String(bounds.min);
  input.max = String(bounds.max);
  input.addEventListener('blur', () => {
    const clamped = clampParamValue(name, input.value);
    if (String(clamped) !== input.value) input.value = clamped;
  });
}

const MODULE_ICONS = {
  'radni_stol': `
    <rect x="2" y="5" width="20" height="15" rx="1"/>
    <rect x="2" y="19" width="20" height="2" rx="1" opacity=".5"/>
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="2" y1="9" x2="22" y2="9"/>
    <circle cx="9"  cy="14.5" r="1"/>
    <circle cx="15" cy="14.5" r="1"/>`,
  'gola_radni_stol': `
    <rect x="2" y="5" width="20" height="15" rx="1"/>
    <rect x="2" y="19" width="20" height="2" rx="1" opacity=".5"/>
    <line x1="2" y1="9" x2="22" y2="9"/>
    <line x1="2" y1="14" x2="22" y2="14"/>`,
  'fiokar': `
    <rect x="2" y="3" width="20" height="18" rx="1"/>
    <rect x="2" y="20" width="20" height="2" rx="1" opacity=".5"/>
    <line x1="2" y1="7.5"  x2="22" y2="7.5"/>
    <line x1="2" y1="11.5" x2="22" y2="11.5"/>
    <line x1="2" y1="15.5" x2="22" y2="15.5"/>
    <line x1="7"  y1="5.5"  x2="17" y2="5.5"/>
    <line x1="7"  y1="9.5"  x2="17" y2="9.5"/>
    <line x1="7"  y1="13.5" x2="17" y2="13.5"/>
    <line x1="7"  y1="17.5" x2="17" y2="17.5"/>`,
  'fiokar_gola': `
    <rect x="2" y="2" width="20" height="19" rx="1"/>
    <rect x="2" y="20" width="20" height="2" rx="1" opacity=".5"/>
    <line x1="2" y1="6.5"  x2="22" y2="6.5"/>
    <line x1="2" y1="11"   x2="22" y2="11"/>
    <line x1="2" y1="15.5" x2="22" y2="15.5"/>
    <line x1="7"  y1="4.5"  x2="17" y2="4.5"/>
    <line x1="7"  y1="9"    x2="17" y2="9"/>
    <line x1="7"  y1="13.5" x2="17" y2="13.5"/>
    <line x1="7"  y1="18"   x2="17" y2="18"/>`,
  'vrata_sudo_masine': `
    <rect x="3" y="3" width="18" height="18" rx="1"/>
    <rect x="3" y="19" width="18" height="2" rx="1" opacity=".5"/>
    <line x1="3" y1="7" x2="21" y2="7"/>
    <line x1="6" y1="5" x2="18" y2="5"/>
    <text x="12" y="15" text-anchor="middle" font-size="5" fill="currentColor" stroke="none" font-family="sans-serif">DW</text>`,
  'vrata_sudo_masine_gola': `
    <rect x="3" y="2" width="18" height="19" rx="1"/>
    <rect x="3" y="20" width="18" height="2" rx="1" opacity=".5"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="6" y1="4" x2="18" y2="4"/>
    <text x="12" y="15" text-anchor="middle" font-size="5" fill="currentColor" stroke="none" font-family="sans-serif">DW</text>`,
  'radni_stol_rerne': `
    <rect x="2" y="3" width="20" height="18" rx="1"/>
    <rect x="2" y="20" width="20" height="2" rx="1" opacity=".5"/>
    <rect x="5" y="7" width="14" height="10" rx="1" opacity=".6"/>
    <line x1="2" y1="6" x2="22" y2="6"/>
    <line x1="5" y1="5" x2="19" y2="5"/>`,
  'radni_stol_rerne_gola': `
    <rect x="2" y="2" width="20" height="19" rx="1"/>
    <rect x="2" y="20" width="20" height="2" rx="1" opacity=".5"/>
    <rect x="5" y="6" width="14" height="10" rx="1" opacity=".6"/>
    <line x1="2" y1="5" x2="22" y2="5"/>
    <line x1="5" y1="4" x2="19" y2="4"/>`,
  'radni_stol_rerne_gola_bez_fioke': `
    <rect x="2" y="3" width="20" height="18" rx="1"/>
    <rect x="2" y="20" width="20" height="2" rx=".5" opacity=".5"/>
    <rect x="4" y="1" width="16" height="3" rx=".5" fill="currentColor" opacity=".3"/>
    <circle cx="8"  cy="2.5" r="1" fill="currentColor" stroke="none"/>
    <circle cx="16" cy="2.5" r="1" fill="currentColor" stroke="none"/>
    <line x1="2" y1="7" x2="22" y2="7"/>`,
  'sporet': `
    <rect x="2" y="5" width="20" height="16" rx="1"/>
    <rect x="4" y="3" width="16" height="3" rx=".5" opacity=".4"/>
    <circle cx="8"  cy="4.5" r="1.2" fill="currentColor" stroke="none" opacity=".7"/>
    <circle cx="12" cy="4.5" r="1.2" fill="currentColor" stroke="none" opacity=".7"/>
    <circle cx="16" cy="4.5" r="1.2" fill="currentColor" stroke="none" opacity=".7"/>
    <rect x="5" y="9" width="14" height="9" rx="1" opacity=".5"/>
    <line x1="5" y1="8" x2="19" y2="8"/>`,
  'samostojeci_frizider': `
    <rect x="4" y="1" width="16" height="22" rx="1"/>
    <line x1="4" y1="7" x2="20" y2="7"/>
    <circle cx="18" cy="4"  r=".8" fill="currentColor" stroke="none"/>
    <circle cx="18" cy="15" r=".8" fill="currentColor" stroke="none"/>`,
  'radni_stol_pored_stuba': `
    <rect x="2" y="2" width="17" height="20" rx="1"/>
    <rect x="17" y="2" width="5" height="12" rx=".5" opacity=".3"/>
    <line x1="2"  y1="8"  x2="19" y2="8"/>
    <line x1="2"  y1="14" x2="19" y2="14"/>
    <circle cx="10.5" cy="11" r="1"/>
    <circle cx="10.5" cy="17" r="1"/>`,
  'radni_stol_pored_stuba_gola': `
    <rect x="2" y="2" width="17" height="20" rx="1"/>
    <rect x="17" y="2" width="5" height="12" rx=".5" opacity=".3"/>
    <line x1="2"  y1="8"  x2="19" y2="8"/>
    <line x1="2"  y1="14" x2="19" y2="14"/>
    <line x1="2"  y1="20" x2="19" y2="20" opacity=".4"/>`,
  'dug_element_90': `
    <polyline points="3,20 3,4 14,4 14,10 20,10 20,20 3,20"/>
    <line x1="3"  y1="8"  x2="14" y2="8"/>
    <line x1="14" y1="14" x2="20" y2="14"/>
    <circle cx="8.5"  cy="14"  r="1"/>
    <circle cx="17"   cy="12"  r="1"/>`,
  'dug_element_90_gola': `
    <polyline points="3,20 3,4 14,4 14,10 20,10 20,20 3,20"/>
    <line x1="3"  y1="8"  x2="14" y2="8"/>
    <line x1="3"  y1="14" x2="14" y2="14"/>
    <line x1="14" y1="14" x2="20" y2="14"/>`,
  'donji_ugaoni_element_45_sa_plocom': `
    <polygon points="3,20 3,4 15,4 21,10 21,20"/>
    <line x1="3" y1="8" x2="15" y2="8"/>
    <line x1="15" y1="4" x2="21" y2="10"/>
    <line x1="15" y1="8" x2="21" y2="10"/>`,
  'donji_ugaoni_element_45_sa_plocom_gola': `
    <polygon points="3,20 3,4 15,4 21,10 21,20"/>
    <line x1="3" y1="8" x2="15" y2="8"/>
    <line x1="3" y1="14" x2="21" y2="14"/>
    <line x1="15" y1="4" x2="21" y2="10"/>`,
  'klasicna_viseca': `
    <rect x="2" y="3" width="20" height="17" rx="1"/>
    <line x1="12" y1="3" x2="12" y2="20"/>
    <line x1="2"  y1="9" x2="22" y2="9"/>
    <circle cx="9"  cy="17" r="1"/>
    <circle cx="15" cy="17" r="1"/>`,
  'klasicna_viseca_gola': `
    <rect x="2" y="2" width="20" height="18" rx="1"/>
    <line x1="12" y1="2" x2="12" y2="20"/>
    <line x1="2"  y1="7" x2="22" y2="7"/>
    <line x1="2"  y1="13" x2="22" y2="13"/>`,
  'klasicna_viseca_gola_ispod_grede': `
    <rect x="2" y="5" width="20" height="15" rx="1"/>
    <rect x="15" y="2" width="7" height="4" rx=".5" opacity=".35"/>
    <line x1="12" y1="5" x2="12" y2="20"/>
    <line x1="2"  y1="10" x2="22" y2="10"/>`,
  'viseca_na_kipu': `
    <rect x="2" y="1" width="20" height="22" rx="1"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <line x1="2" y1="6"  x2="22" y2="6"/>
    <line x1="2" y1="17" x2="22" y2="17"/>
    <circle cx="12" cy="9.5"  r="1.2"/>
    <circle cx="12" cy="14.5" r="1.2"/>`,
  'viseca_na_kipu_gola': `
    <rect x="2" y="1" width="20" height="22" rx="1"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <line x1="2" y1="6"  x2="22" y2="6"/>
    <line x1="2" y1="17" x2="22" y2="17"/>`,
  'gue90': `
    <polyline points="3,21 3,3 13,3 13,10 21,10 21,21 3,21"/>
    <line x1="3"  y1="7"  x2="13" y2="7"/>
    <line x1="3"  y1="16" x2="13" y2="16"/>
    <line x1="13" y1="15" x2="21" y2="15"/>`,
  'ormar_visoki': `
    <rect x="3" y="1" width="18" height="22" rx="1"/>
    <line x1="12" y1="1" x2="12" y2="23"/>
    <line x1="3"  y1="6" x2="21" y2="6"/>
    <circle cx="9"  cy="14" r="1.2"/>
    <circle cx="15" cy="14" r="1.2"/>`,
};

const ICON_FALLBACK = `
    <rect x="2" y="4" width="20" height="16" rx="1"/>
    <line x1="2" y1="9" x2="22" y2="9"/>
    <line x1="12" y1="9" x2="12" y2="20"/>`;

function getModuleIconSVG(name) {
  const paths = MODULE_ICONS[name] || ICON_FALLBACK;
  return `<svg class="module-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

const TOGGLE_LABELS = {
  front_vrata: 'Vrata',
  polica: 'Police',
  pozadina: 'Pozadina',
  celafioka: 'Cela fioka',
  fioke: 'Fioke',
  radna_ploca: 'Radna ploca',
  side_walls: 'Bočni zidovi'
};
// Keys that only toggle scene visibility, no geometry rebuild needed
const TOGGLE_VISIBILITY_ONLY = new Set(['side_walls']);

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
    if (_inputModalResolve) { _inputModalResolve(val); _inputModalResolve = null; }
  });
  const cancel = () => {
    document.getElementById('modal-input').classList.add('hidden');
    if (_inputModalResolve) { _inputModalResolve(null); _inputModalResolve = null; }
  };
  document.getElementById('modal-input-cancel').addEventListener('click', cancel);
  document.getElementById('modal-input-close').addEventListener('click', cancel);
  document.querySelector('#modal-input .modal-backdrop').addEventListener('click', cancel);
  document.getElementById('modal-input-val').addEventListener('keydown', e => {
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
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.left = Math.min(x, window.innerWidth - mw - 4) + 'px';
  menu.style.top  = Math.min(y, window.innerHeight - mh - 4) + 'px';
}

function hideCtxMenu() {
  document.getElementById('ctx-menu')?.classList.add('hidden');
  ctxTargetIdx = -1;
}

function initContextMenu() {
  const menu = document.getElementById('ctx-menu');
  if (!menu) return;

  document.getElementById('ctx-replace')?.addEventListener('click', (e) => {
    if (ctxTargetIdx < 0) { hideCtxMenu(); return; }
    const idx = ctxTargetIdx;
    hideCtxMenu();
    // Delegate to wall-grid's replace tooltip, anchored at the menu position
    const fakeAnchor = { getBoundingClientRect: () => ({ bottom: parseInt(menu.style.top) || 100, top: parseInt(menu.style.top) || 100, left: parseInt(menu.style.left) || 100, right: parseInt(menu.style.left) + 170 || 270 }) };
    openReplaceTooltip(fakeAnchor, idx);
    e.stopPropagation();
  });

  document.getElementById('ctx-mirror')?.addEventListener('click', () => { if (ctxTargetIdx >= 0) mirrorModule(ctxTargetIdx); hideCtxMenu(); });
  document.getElementById('ctx-duplicate')?.addEventListener('click', () => { if (ctxTargetIdx >= 0) duplicateModule(ctxTargetIdx); hideCtxMenu(); });
  document.getElementById('ctx-anchor')?.addEventListener('click', () => {
    if (ctxTargetIdx >= 0) {
      selectModuleByIndex(ctxTargetIdx);
      setSnapAnchorByIndex(ctxTargetIdx);
      showNotification('Sidro postavljeno. Dvaput klikni na element koji zelis spojiti.', 'info');
    }
    hideCtxMenu();
  });
  document.getElementById('ctx-remove')?.addEventListener('click', () => { if (ctxTargetIdx >= 0) deleteModule(ctxTargetIdx); hideCtxMenu(); });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) hideCtxMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideCtxMenu(); });
  const canvas = document.getElementById('three-canvas');
  canvas?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const idx = getModuleIndexAt(nx, ny);
    if (idx !== null) { selectModuleByIndex(idx); showCtxMenu(e.clientX, e.clientY, idx); }
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
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
  initModuleManager();
  initFixtureModal();
  initPresetModal();
  initOverlayToggles();
  initContextMenu();
  initLanguageSwitcher();
  updateUILabels();
  selectCell(2, 1);
  window.addEventListener('resize', resizeViewer);

  let snapAnchor = null;
  window._setSnapAnchor = (info) => { snapAnchor = info; };
  window._clearSnapAnchor = () => { snapAnchor = null; };

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
            showNotification("Sidro postavljeno. Klikni na element koji zelis spojiti.", "info");
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

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const idx = getModuleIndexAt(x, y);
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
      } else {
        selectModuleByIndex(idx);
      }
    });
  }

  autoRestore();
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
      themeBtn.textContent = '🌙 Light';
      setViewerTheme('dark');
    } else {
      document.body.classList.add('light');
      themeBtn.textContent = '☁️ Dark';
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
  if (isPinned) { wallPanel.classList.remove('collapsed'); toggleBtn.textContent = '▼'; }
  else if (isCollapsed) { wallPanel.classList.add('collapsed'); toggleBtn.textContent = '▲'; }
  else { toggleBtn.textContent = '▼'; }

  toggleBtn.addEventListener('click', () => {
    const collapsed = wallPanel.classList.toggle('collapsed');
    toggleBtn.textContent = collapsed ? '▲' : '▼';
    localStorage.setItem('wallGridCollapsed', collapsed);
  });
  pinCheckbox.addEventListener('change', () => {
    localStorage.setItem('wallGridPinned', pinCheckbox.checked);
    if (pinCheckbox.checked) { wallPanel.classList.remove('collapsed'); toggleBtn.textContent = '▼'; }
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
  const modal      = document.getElementById('modal-presets');
  const closeBtn   = document.getElementById('modal-presets-close');
  const cancelBtn  = document.getElementById('modal-presets-cancel');
  const addBtn     = document.getElementById('preset-add-btn');
  const step1      = document.getElementById('preset-step1');
  const step2      = document.getElementById('preset-step2');
  const grid       = document.getElementById('presets-grid');
  const backBtn    = document.getElementById('preset-back-btn');
  const titleEl    = document.getElementById('preset-step2-title');
  const layoutWrap = document.getElementById('preset-layout-wrap');
  const tooltip    = document.getElementById('preset-mod-tooltip');
  const tooltipList= document.getElementById('preset-mod-tooltip-list');
  const sideWrap   = document.getElementById('preset-side-wrap');
  const countsWrap = document.getElementById('preset-counts-wrap');
  const leftCountWrap  = document.getElementById('preset-left-count-wrap');
  const rightCountWrap = document.getElementById('preset-right-count-wrap');
  if (!btnPresets || !modal || !grid) return;

  // ── state ──────────────────────────────────────────────────────────────────
  let activePresetId = null;
  let activeSide = 'left'; // for l-shape: which side has the corner
  // slotModules: maps slotKey → module name (for overridable slots)
  let slotModules = {};

  // ── helpers ────────────────────────────────────────────────────────────────
  function getOpts() {
    return {
      isGola:     document.getElementById('preset-gola').checked,
      width:      parseFloat(document.getElementById('preset-width-main').value) || 300,
      side:       activeSide,
      leftCount:  parseInt(document.getElementById('preset-left-count').value) || 2,
      rightCount: parseInt(document.getElementById('preset-right-count').value) || 2,
    };
  }

  // All "Donji" module names (excluding corner types which are auto-placed)
  const CORNER_NAMES = new Set(['dug_element_90', 'dug_element_90_gola', 'dug_element_90_desni', 'dug_element_90_desni_gola']);
  function getDonjiFlatList() {
    return Object.keys(MODULE_GROUPS['Donji'] || {}).filter(n => !CORNER_NAMES.has(n));
  }

  // ── step navigation ─────────────────────────────────────────────────────────
  function showStep1() {
    step1.classList.remove('hidden');
    step2.classList.add('hidden');
    addBtn.style.display = 'none';
    hideTooltip();
  }
  function showStep2(preset) {
    activePresetId = preset.id;
    titleEl.textContent = preset.title;
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    addBtn.style.display = '';
    // show/hide side options
    const hasSides = preset.id !== 'galley';
    sideWrap.style.display = hasSides ? '' : 'none';
    countsWrap.style.display = hasSides ? '' : 'none';
    // for u-shape both sides shown; for l-shape only one side shown
    // (left-count = left side, right-count = right side)
    leftCountWrap.style.display  = (preset.id === 'u-shape' || (preset.id === 'l-shape' && activeSide === 'left')) ? '' : 'none';
    rightCountWrap.style.display = (preset.id === 'u-shape' || (preset.id === 'l-shape' && activeSide === 'right')) ? '' : 'none';
    slotModules = {};
    renderLayout();
  }

  // ── shape grid (step 1) ────────────────────────────────────────────────────
  grid.innerHTML = '';
  for (const preset of PRESET_LAYOUTS) {
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.innerHTML = `${preset.svg}<div class="preset-card-title">${preset.title}</div><div class="preset-card-desc">${preset.desc.replace(/\n/g, '<br>')}</div>`;
    card.addEventListener('click', () => showStep2(preset));
    grid.appendChild(card);
  }

  // ── side toggle ────────────────────────────────────────────────────────────
  document.querySelectorAll('.preset-side-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSide = btn.dataset.side;
      document.querySelectorAll('.preset-side-btn').forEach(b => b.classList.toggle('active', b.dataset.side === activeSide));
      // update which count inputs are shown for l-shape
      if (activePresetId === 'l-shape') {
        leftCountWrap.style.display  = activeSide === 'left'  ? '' : 'none';
        rightCountWrap.style.display = activeSide === 'right' ? '' : 'none';
      }
      slotModules = {};
      renderLayout();
    });
  });

  // re-render on any option change
  ['preset-gola', 'preset-width-main', 'preset-left-count', 'preset-right-count'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => { slotModules = {}; renderLayout(); });
  });

  // ── layout renderer ─────────────────────────────────────────────────────────
  // A "slot" is a clickable cabinet cell. Each has a key like "main-2" or "left-1".
  // We describe the grid as rows of slot descriptors:
  //   { key, type: 'corner'|'cabinet'|'empty', label, widthCm }
  function buildSlotRows() {
    const opts = getOpts();
    const { isGola, width, side, leftCount, rightCount } = opts;
    const dss = isGola ? 100 : 80;
    const lss = isGola ? 80  : 90;
    const sw  = 60;
    const suf = isGola ? '_gola' : '';

    // main wall fills: compute count & widths
    function mainSlots(startX, wallLen) {
      const count = Math.max(1, Math.floor(wallLen / sw));
      const remainder = wallLen - (count - 1) * sw;
      const slots = [];
      for (let i = 0; i < count; i++) {
        const w = (i === count - 1) ? remainder : sw;
        const isMiddle = count > 1 && i === Math.floor(count / 2);
        const key = `main-${i}`;
        slots.push({ key, type: 'cabinet', defaultIme: isMiddle ? 'fiokar' + suf : 'radni_stol' + suf, widthCm: w });
      }
      return slots;
    }

    if (activePresetId === 'galley') {
      const main = mainSlots(0, width);
      return [
        { label: 'Glavna strana', slots: main }
      ];
    }

    if (activePresetId === 'l-shape') {
      if (side === 'right') {
        const main = mainSlots(0, width - dss);
        main.push({ key: 'corner-r', type: 'corner', label: '⌐', widthCm: dss });
        const sideSlots = [];
        for (let i = 0; i < rightCount; i++) sideSlots.push({ key: `right-${i}`, type: 'cabinet', defaultIme: 'radni_stol' + suf, widthCm: sw });
        // spacer fills the space under main-wall cabinets (all but last corner slot)
        const mainNonCornerPx = main.slice(0, -1).reduce((a, s) => a + slotWidthPx(s.widthCm) + 4, 0);
        const sidePx = sideSlots.reduce((a, s) => a + slotWidthPx(s.widthCm) + 4, 0);
        const spacerPx = Math.max(0, mainNonCornerPx - sidePx);
        return [
          { label: 'Glavna strana', slots: main },
          { label: 'Desna strana', slots: [{ key: 'spacer-r', type: 'empty', _px: spacerPx }, ...sideSlots] }
        ];
      } else {
        const main = [{ key: 'corner-l', type: 'corner', label: '⌐', widthCm: dss }, ...mainSlots(dss, width - dss)];
        const sideSlots = [];
        for (let i = 0; i < leftCount; i++) sideSlots.push({ key: `left-${i}`, type: 'cabinet', defaultIme: 'radni_stol' + suf, widthCm: sw });
        const mainNonCornerPx = main.slice(1).reduce((a, s) => a + slotWidthPx(s.widthCm) + 4, 0);
        const sidePx = sideSlots.reduce((a, s) => a + slotWidthPx(s.widthCm) + 4, 0);
        const spacerPx = Math.max(0, mainNonCornerPx - sidePx);
        return [
          { label: 'Glavna strana', slots: main },
          { label: 'Lijeva strana', slots: [...sideSlots, { key: 'spacer-l', type: 'empty', _px: spacerPx }] }
        ];
      }
    }

    if (activePresetId === 'u-shape') {
      const mainWallLen = width - dss - lss;
      const main = [
        { key: 'corner-l', type: 'corner', label: '⌐', widthCm: dss },
        ...mainSlots(dss, mainWallLen),
        { key: 'corner-r', type: 'corner', label: '⌐', widthCm: lss }
      ];
      const leftSide = [], rightSide = [];
      for (let i = 0; i < leftCount; i++) leftSide.push({ key: `left-${i}`, type: 'cabinet', defaultIme: 'radni_stol' + suf, widthCm: sw });
      for (let i = 0; i < rightCount; i++) rightSide.push({ key: `right-${i}`, type: 'cabinet', defaultIme: 'radni_stol' + suf, widthCm: sw });
      // spacer fills the middle (between left side and right side) matching the inner main-wall width
      const mainInnerPx = main.slice(1, -1).reduce((a, s) => a + slotWidthPx(s.widthCm) + 4, 0);
      const leftPx  = leftSide.reduce((a, s) => a + slotWidthPx(s.widthCm) + 4, 0);
      const rightPx = rightSide.reduce((a, s) => a + slotWidthPx(s.widthCm) + 4, 0);
      const spacerPx = Math.max(0, mainInnerPx - leftPx - rightPx);
      return [
        { label: 'Glavna strana', slots: main },
        { label: 'Lijevo / Desno', slots: [...leftSide, { key: 'spacer-m', type: 'empty', _px: spacerPx }, ...rightSide] }
      ];
    }

    return [];
  }

  const PX_PER_CM = 0.8; // visual scale factor
  function slotWidthPx(widthCm) {
    return Math.max(36, Math.round(widthCm * PX_PER_CM));
  }
  function rowTotalPx(slots) {
    // 28px label + 32px row-label offset, then sum of slot widths + 4px gap per slot
    return slots.reduce((acc, s) => acc + slotWidthPx(s.widthCm) + 4, 0);
  }

  function renderLayout() {
    if (!activePresetId) return;
    hideTooltip();
    layoutWrap.innerHTML = '';
    const rows = buildSlotRows();
    const donjiFlatList = getDonjiFlatList();

    rows.forEach(({ label, slots }) => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'preset-layout-row';

      const rowLabel = document.createElement('div');
      rowLabel.className = 'preset-layout-row-label';
      rowLabel.textContent = label;
      rowDiv.appendChild(rowLabel);

      slots.forEach(slot => {
        const el = document.createElement('div');
        const px = slot._px != null ? slot._px : slotWidthPx(slot.widthCm || 60);
        el.style.width = px + 'px';

        if (slot.type === 'empty') {
          el.className = 'preset-slot empty-space';
          if (px <= 0) { return; } // skip zero-width spacers
          rowDiv.appendChild(el);
          return;
        }

        if (slot.type === 'corner') {
          el.className = 'preset-slot corner';
          el.textContent = slot.label || 'L';
          el.title = 'Ugaoni element (fiksno)';
          rowDiv.appendChild(el);
          return;
        }

        // cabinet slot
        el.className = 'preset-slot';
        const currentIme = slotModules[slot.key] || slot.defaultIme;
        const shortName = currentIme.replace(/_gola$/, '').replace(/_/g, ' ');
        el.innerHTML = `<span class="preset-slot-name">${shortName}</span><span class="preset-slot-width">${slot.widthCm}cm</span>`;
        el.dataset.slotKey = slot.key;
        el.dataset.defaultIme = slot.defaultIme;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          openSlotTooltip(el, slot, donjiFlatList);
        });

        rowDiv.appendChild(el);
      });

      layoutWrap.appendChild(rowDiv);
    });
  }

  // ── module picker tooltip ──────────────────────────────────────────────────
  let activeSlotKey = null;

  function openSlotTooltip(el, slot, moduleList) {
    if (activeSlotKey === slot.key) { hideTooltip(); return; }
    activeSlotKey = slot.key;
    tooltipList.innerHTML = '';
    const currentIme = slotModules[slot.key] || slot.defaultIme;
    moduleList.forEach(name => {
      const item = document.createElement('div');
      item.className = 'preset-mod-item' + (name === currentIme ? ' selected' : '');
      item.textContent = name.replace(/_/g, ' ');
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        slotModules[slot.key] = name;
        hideTooltip();
        renderLayout();
      });
      tooltipList.appendChild(item);
    });

    // position tooltip near the slot
    const rect = el.getBoundingClientRect();
    tooltip.classList.remove('hidden');
    // try below first, flip up if needed
    let top = rect.bottom + 6;
    if (top + 260 > window.innerHeight) top = rect.top - 260;
    let left = rect.left;
    if (left + 200 > window.innerWidth) left = window.innerWidth - 206;
    tooltip.style.top  = top  + 'px';
    tooltip.style.left = left + 'px';
  }

  function hideTooltip() {
    tooltip.classList.add('hidden');
    activeSlotKey = null;
  }

  document.addEventListener('click', (e) => {
    if (!tooltip.contains(e.target)) hideTooltip();
  });

  // ── apply preset ───────────────────────────────────────────────────────────
  function applyAndClose() {
    const opts = getOpts();
    const { isGola, leftCount, rightCount, width, side } = opts;
    const suf = isGola ? '_gola' : '';

    // Build the dynamic plan using current options
    const dynamicPlan = buildDynamicPlan(activePresetId, { ...opts, slotModules, suf });

    pushHistory();
    const newOccupied = {};
    dynamicPlan.forEach(item => {
      if (item.mat_pos) newOccupied[`${item.mat_pos[0]},${item.mat_pos[1]}`] = { sirina: item.sirina, ime: item.ime };
    });
    state.plan = JSON.parse(JSON.stringify(dynamicPlan));
    state.occupiedCells = newOccupied;
    state.selectedPlanIdx = -1;
    setEditingPlanIdx(-1);
    // Set activeLayout before updateWallGridDisplay so sections render correctly
    state.activeLayout = { type: activePresetId, side, width, leftCount, rightCount, isGola };
    rebuildAllModules();
    refreshParams();
    updateWallGridDisplay();
    renderPlanList();
    updateTotalCost();

    // Update side walls in the viewer
    const lss = isGola ? 80 : 90;
    const sw  = 60;
    setLayoutWalls(activePresetId, {
      side,
      leftDepth:  lss + leftCount  * sw,
      rightDepth: lss + rightCount * sw,
      totalWidth: width,
      isDark,
      sideWallsVisible: state.settings.side_walls
    });

    showNotification('Predlozak primijenjen', 'success');
    closeModal();
  }

  function closeModal() {
    modal.classList.add('hidden');
    hideTooltip();
    showStep1();
  }

  // ── wire up ────────────────────────────────────────────────────────────────
  addBtn.addEventListener('click', applyAndClose);
  backBtn.addEventListener('click', showStep1);
  btnPresets.addEventListener('click', () => { showStep1(); modal.classList.remove('hidden'); });
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);
}

function initLanguageSwitcher() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      setLocale(lang);
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
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
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const localized = t(key);
    if (localized) {
      if (el.children.length === 0) { el.textContent = localized; }
      else {
        for (let node of el.childNodes) {
          if (node.nodeType === 3 && node.textContent.trim().length > 0) node.textContent = localized;
        }
      }
    }
  });
  const searchEl = document.getElementById('module-search');
  if (searchEl) searchEl.placeholder = t('ui.searchPlaceholder');
}

function initCategoryTabs() {
  const tabs = document.querySelectorAll('.tab[data-cat]');
  tabs.forEach(tab => {
    const cat = tab.dataset.cat;
    const label = t(`categories.${cat}`);
    if (label) tab.textContent = label;
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
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
    document.querySelectorAll('.tab[data-cat]').forEach(btn => btn.addEventListener('click', () => { searchEl.value = ''; }));
  }
  document.getElementById('klizac-select').addEventListener('change', e => { state.klizac = e.target.value; });
  document.getElementById('client-name').addEventListener('input', e => { state.clientName = e.target.value; });
}

function populateModuleSelect() {
  const grid = document.getElementById('module-grid');
  grid.innerHTML = '';
  const mods = MODULE_GROUPS[state.currentCategory] || {};
  const searchEl = document.getElementById('module-search');
  const query = (searchEl?.value || '').toLowerCase().replace(/\s+/g, '_');

  for (const name of Object.keys(mods)) {
    if (query && !name.toLowerCase().includes(query)) continue;
    const card = document.createElement('div');
    card.className = 'module-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', name.replace(/_/g, ' '));
    if (state.selectedModule === name) { card.classList.add('selected'); card.setAttribute('aria-pressed', 'true'); }
    else card.setAttribute('aria-pressed', 'false');
    card.innerHTML = `${getModuleIconSVG(name)}<div class="module-card-label">${name.replace(/_/g, ' ')}</div>`;
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
    card.addEventListener('click', () => {
      grid.querySelectorAll('.module-card').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-pressed', 'false'); });
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
      state.selectedModule = name;
      setEditingPlanIdx(-1);
      refreshParams();
    });
    grid.appendChild(card);
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
    const localized = (typeof PARAM_LABELS[name] === 'function') ? PARAM_LABELS[name]() : (PARAM_LABELS[name] || name);
    label.textContent = localized ? `${localized} (${name})` : name;
    label.title = localized || name;
    const input = document.createElement('input');
    input.type = 'number'; input.className = 'param-input'; input.value = defaultVal; input.step = '1';
    input.setAttribute('aria-label', localized ? `${localized} (${name})` : name);
    applyParamInputBounds(input, name);
    input.addEventListener('keydown', e => {
      const rows = container.querySelectorAll('.param-input');
      if (e.key === 'ArrowDown' && idx < rows.length - 1) { rows[idx + 1].focus(); e.preventDefault(); }
      if (e.key === 'ArrowUp' && idx > 0) { rows[idx - 1].focus(); e.preventDefault(); }
    });
    state.paramInputs[name] = defaultVal;
    input.addEventListener('input', () => { state.paramInputs[name] = input.value; });
    row.appendChild(label); row.appendChild(input); container.appendChild(row);
  });
}

export function refreshParamsForPlanItem(planIdx) {
  const item = state.plan[planIdx];
  if (!item) return;
  setEditingPlanIdx(planIdx);
  let paramDefs = null;
  for (const cat of Object.values(MODULE_GROUPS)) {
    if (cat[item.ime]) { paramDefs = cat[item.ime]; break; }
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
    const localized = (typeof PARAM_LABELS[name] === 'function') ? PARAM_LABELS[name]() : (PARAM_LABELS[name] || name);
    label.textContent = localized ? `${localized} (${name})` : name;
    label.title = localized || name;
    const input = document.createElement('input');
    input.type = 'number'; input.className = 'param-input'; input.value = item.p[name] ?? ''; input.step = '1';
    input.setAttribute('aria-label', localized ? `${localized} (${name})` : name);
    applyParamInputBounds(input, name);
    input.addEventListener('keydown', e => {
      const rows = container.querySelectorAll('.param-input');
      if (e.key === 'ArrowDown' && idx < rows.length - 1) { rows[idx + 1].focus(); e.preventDefault(); }
      if (e.key === 'ArrowUp' && idx > 0) { rows[idx - 1].focus(); e.preventDefault(); }
    });
    let _paramSnapshotted = false;
    input.addEventListener('focus', () => { _paramSnapshotted = false; });
    input.addEventListener('blur',  () => { _paramSnapshotted = false; });
    input.addEventListener('input', () => {
      if (!_paramSnapshotted) { pushHistory(); _paramSnapshotted = true; }
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
    row.appendChild(label); row.appendChild(input); container.appendChild(row);
  });
}

export function initToggles() {
  const grids = [document.getElementById('toggles-grid'), document.getElementById('toggles-grid-popover')].filter(Boolean);
  grids.forEach(grid => {
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
      item.appendChild(sw); item.appendChild(lbl);
      item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); } });
      item.addEventListener('click', () => {
        state.settings[key] = !state.settings[key];
        document.querySelectorAll(`.toggle-item[data-key="${key}"]`).forEach(el => {
          el.classList.toggle('active', state.settings[key]);
          el.setAttribute('aria-checked', state.settings[key] ? 'true' : 'false');
        });
        if (TOGGLE_VISIBILITY_ONLY.has(key)) {
          if (key === 'side_walls') setSideWallsVisible(state.settings.side_walls);
        } else {
          clearGeomCache();
          rebuildAllModules();
        }
      });
      grid.appendChild(item);
    }
  });
}

function initPositionInputs() {
  ['x', 'y', 'z', 'r'].forEach(axis => {
    const el = document.getElementById(`pos-${axis}`);
    let _posSnapshotted = false;
    el.addEventListener('focus', () => { _posSnapshotted = false; });
    el.addEventListener('blur',  () => { _posSnapshotted = false; });
    el.addEventListener('input', e => {
      if (state.selectedPlanIdx >= 0 && !_posSnapshotted) { pushHistory(); _posSnapshotted = true; }
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
              const rightItem = state.plan.find(m => m.mat_pos && m.mat_pos[0] === itemRow && m.mat_pos[1] === c);
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
        } else if (axis === 'y') { item.pos[1] = val; }
        else if (axis === 'z') { item.pos[2] = val; }
        else if (axis === 'r') { item.r = val; }
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
    r: parseFloat(document.getElementById('pos-r').value) || 0
  };
}

function initPlanActions() {
  document.getElementById('btn-add').addEventListener('click', () => {
    addToPlan(state.selectedModule, state.paramInputs, state.klizac, getPos, setPos);
  });
  document.getElementById('btn-krojna').addEventListener('click', showKrojnaLista);
  document.getElementById('btn-module-manager').addEventListener('click', openModuleManager);
  document.getElementById('btn-optimik').addEventListener('click', exportOptimik);
  document.getElementById('btn-pdf').addEventListener('click', exportPdf);

  const btnToggleMat = document.getElementById('btn-toggle-materials');
  const matPanel = document.getElementById('materials-panel');
  if (btnToggleMat && matPanel) btnToggleMat.addEventListener('click', () => matPanel.classList.toggle('hidden'));

  const btnRadna = document.getElementById('btn-radna');
  btnRadna.addEventListener('click', () => {
    state.addingRadnaPloca = !state.addingRadnaPloca;
    if (state.addingRadnaPloca) {
      state.radnaPlocaSelection = [];
      btnRadna.style.backgroundColor = 'var(--accent)'; btnRadna.style.color = '#fff';
      showNotification('Dvoklikni na pocetni element, a zatim na krajnji element za spajanje radne ploce.', 'info');
    } else {
      state.radnaPlocaSelection = [];
      import('./viewer.js').then(v => v.highlightModule(-1));
      btnRadna.style.backgroundColor = ''; btnRadna.style.color = '';
      showNotification('Izasao si iz moda za dodavanje radne ploce.', 'info');
    }
  });

  document.getElementById('btn-cokla').addEventListener('click', () => {
    state.addingCokla = !state.addingCokla;
    const btnCokla = document.getElementById('btn-cokla');
    if (state.addingCokla) {
      state.coklaSelection = [];
      btnCokla.style.backgroundColor = 'var(--accent)'; btnCokla.style.color = '#fff';
      showNotification('Dvoklikni na pocetni element, a zatim na krajnji element za spajanje cokle.', 'info');
    } else {
      state.coklaSelection = [];
      import('./viewer.js').then(v => v.highlightModule(-1));
      btnCokla.style.backgroundColor = ''; btnCokla.style.color = '';
      showNotification('Izasao si iz moda za dodavanje cokle.', 'info');
    }
  });

  document.getElementById('btn-view-front').addEventListener('click', () => setCameraView('front'));
  document.getElementById('btn-view-iso').addEventListener('click', () => setCameraView('iso'));
  document.getElementById('btn-view-top').addEventListener('click', () => setCameraView('top'));
  document.getElementById('btn-reset-cam').addEventListener('click', resetCamera);

  const btnLight = document.getElementById('btn-toggle-light');
  if (btnLight) {
    btnLight.style.filter = state.lightingMode === 'warm' ? 'sepia(0.6) saturate(2)' : 'none';
    btnLight.addEventListener('click', () => {
      state.lightingMode = state.lightingMode === 'cool' ? 'warm' : 'cool';
      setLightingMode(state.lightingMode);
      btnLight.style.filter = state.lightingMode === 'warm' ? 'sepia(0.6) saturate(2)' : 'none';
      showNotification('Osvjetljenje: ' + (state.lightingMode === 'warm' ? 'Toplo' : 'Hladno'), 'info');
    });
  }

  const btnPrikaz = document.getElementById('btn-toggle-prikaz');
  const popover = document.getElementById('prikaz-popover');
  if (btnPrikaz && popover) {
    btnPrikaz.onclick = (e) => { e.stopPropagation(); popover.classList.toggle('hidden'); };
    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && !btnPrikaz.contains(e.target)) popover.classList.add('hidden');
    });
  }

  document.addEventListener('keydown', e => {
    const inInput = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA';
    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); historyUndo(); return; }
    if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) || (e.key === 'Z' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); historyRedo(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !inInput && state.selectedPlanIdx >= 0) { deleteModule(state.selectedPlanIdx); return; }
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveProject(); return; }
    if (e.key === 'd' && (e.ctrlKey || e.metaKey) && !inInput && state.selectedPlanIdx >= 0) { e.preventDefault(); duplicateModule(state.selectedPlanIdx); return; }
    if (e.key === 'Escape') {
      document.getElementById('ctx-menu')?.classList.add('hidden');
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
  document.getElementById('btn-clear-plan')?.addEventListener('click', () => { clearPlan(); setLayoutWalls('galley'); });
}

function historyUndo() {
  if (_history.past.length === 0) { showNotification('Nema vise koraka za ponistiti', 'info'); return; }
  _history.future.push(_clonePlanState());
  _applySnapshot(_history.past.pop());
  showNotification('Ponisteno (' + _history.past.length + ' preostalo)', 'info');
}

function historyRedo() {
  if (_history.future.length === 0) { showNotification('Nema vise koraka za ponavljanje', 'info'); return; }
  _history.past.push(_clonePlanState());
  _applySnapshot(_history.future.pop());
  showNotification('Ponavljeno (' + _history.future.length + ' preostalo)', 'info');
}

function _applySnapshot(snapshot) {
  state.plan = snapshot.plan;
  state.occupiedCells = snapshot.occupiedCells;
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
    btnOpen.onclick = (e) => { e.stopPropagation(); popover.classList.toggle('hidden'); if (!popover.classList.contains('hidden')) renderFixtureList(); };
    document.addEventListener('click', (e) => { if (!popover.contains(e.target) && !btnOpen.contains(e.target)) popover.classList.add('hidden'); });
  }
  const typeSel = document.getElementById('fixture-type-select');
  const dimsRow = document.getElementById('fixture-dims-row');
  if (typeSel) {
    typeSel.innerHTML = FIXTURE_TYPES.map(t => `<option value="${t.id}">${t.icon} ${t.label}</option>`).join('');
    typeSel.addEventListener('change', () => {
      const isRect = (typeSel.value === 'window' || typeSel.value === 'door');
      if (dimsRow) dimsRow.classList.toggle('hidden', !isRect);
    });
  }
  document.getElementById('modal-fixture-add')?.addEventListener('click', () => {
    const typeId = typeSel.value;
    const typeDef = FIXTURE_TYPES.find(t => t.id === typeId);
    if (!typeDef) return;
    const fixture = {
      type: typeId,
      label: document.getElementById('fixture-label-input').value || typeDef.label,
      x: parseFloat(document.getElementById('fixture-x-input').value) || 0,
      y: parseFloat(document.getElementById('fixture-y-input').value) || 0,
      color: typeDef.color
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
    wrap.innerHTML = '<div style="font-size:11px;color:var(--text-dim);text-align:center;padding:10px;margin-top:10px;border:1px dashed var(--border);border-radius:8px;">Nema dodanih elemenata</div>';
    return;
  }
  let html = '<div style="margin-top:10px;max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:rgba(0,0,0,0.2);">';
  state.wallFixtures.forEach((f, idx) => {
    const typeDef = FIXTURE_TYPES.find(t => t.id === f.type);
    const sizeStr = (f.width && f.height) ? ` (${f.width}x${f.height})` : '';
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
