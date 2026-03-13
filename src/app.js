import * as THREE from 'three';
/**
 * app.js — Main renderer process logic
 * Meco Konfigurator 2026 — Electron/JSCAD Edition
 */

import {
  MODULE_GROUPS, DEFAULT_MATERIALS, DEFAULT_SETTINGS,
  COLOR_PRESETS, TEXTURE_PRESETS
} from './modules-config.js';
import { buildKitchenModule } from './kitchen-builder.js';
import { initViewer, addModuleGroup, removeModuleGroup, clearAllGroups, setCameraView, resetCamera, highlightModule, resizeViewer, setViewerTheme, addFixtureMarker, removeFixtureMarker, clearFixtureMarkers, setLightingMode, getModuleIndexAt, getModuleSnapInfoAt, getModuleGroup } from './viewer.js';
import { computeCuttingList, computeCuttingListByModule, toCsvString } from './cutting-list.js';

// ─── Wall Fixture Types ───────────────────────────────────────────────────────
const FIXTURE_TYPES = [
  { id: 'water', label: 'Vodovod', icon: '💧', color: 0x2196f3 },
  { id: 'drain', label: 'Kanalizacija', icon: '🔩', color: 0x795548 },
  { id: 'power', label: 'Struja (utičnica)', icon: '⚡', color: 0xffc107 },
  { id: 'gas', label: 'Gas', icon: '🔥', color: 0xff5722 },
  { id: 'window', label: 'Prozor', icon: '🪟', color: 0x90caf9 },
  { id: 'door', label: 'Vrata', icon: '🚪', color: 0xa1887f },
  { id: 'column', label: 'Stub', icon: '⬛', color: 0x9e9e9e },
  { id: 'other', label: 'Ostalo', icon: '📍', color: 0xce93d8 },
];

// Material slot labels
const MAT_LABELS = {
  front: 'Front',
  korpus: 'Korpus',
  radna: 'Radna pl.',
  granc: 'Granc',
  cokla: 'Cokla'
};

// Parameter human-readable abbreviations
const PARAM_LABELS = {
  s: 'Širina',
  v: 'Visina',
  d: 'Dubina',
  c: 'Cokla',
  brvr: 'Broj vrata',
  brp: 'Broj polica',
  brf: 'Broj fioka',
  brfp: 'Plitke fioke',
  brfd: 'Duboke fioke',
  brv: 'Broj vrata',
  rerna: 'Širina rerne',
  dss: 'Širina desno',
  lss: 'Širina lijevo',
  sl: 'Širina lijevo',
  sd: 'Širina desno',
  ss: 'Širina stuba',
  ds: 'Dubina stuba',
  vs: 'Visina stuba'
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════════
let state = {
  currentCategory: 'Donji',
  selectedModule: '',
  paramInputs: {},         // { paramName: value }
  materials: { ...DEFAULT_MATERIALS },
  settings: { ...DEFAULT_SETTINGS },
  position: { x: 0, y: 0, z: 0, r: 0 },
  klizac: 'skriveni',
  plan: [],                // Array of { ime, p, pos:[x,y,z], r, mat_pos:[row,col], sirina }
  occupiedCells: {},       // key: "r,c" → { sirina, ime }
  selectedPlanIdx: -1,
  selectedCell: [2, 1],
  clientName: 'Projekat_Meco',
  matPickerTarget: null,   // which material slot is being picked
  prices: {
    univer: 25,
    mdf: 45,
    hdf: 12,
    radna: 65,
    kant_k: 1.5,
    kant_K: 3.5
  },
  simplifiedKrojna: false,
  perModuleKrojna: false,
  wallFixtures: [],   // Array of { type, x, y, label }  — x/y in cm from origin
  addingRadnaPloca: false,
  addingCokla: false,
  lightingMode: 'warm'
};

// Material picker pending selection
let pendingMatSel = null;

// Theme state — shared across toggle and exportPdf
let isDark = false;

// Whether the params panel is currently editing a plan item (vs. a fresh module)
let editingPlanIdx = -1;

// ═══════════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════════
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
  initFixtureModal();
  initOverlayToggles();
  initContextMenu();
  selectCell(2, 1);
  window.addEventListener('resize', resizeViewer);

  // Double click logic (Selection / Snapping / Special items)
  let snapAnchor = null;

  // Expose for context menu "Set as Anchor"
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
            // First click: Set anchor
            snapAnchor = snapInfo;
            selectModuleByIndex(snapInfo.index);
            showNotification("Sidro postavljeno. Klikni na element koji želiš spojiti.", "info");
          } else {
            // Second click: Snap this module using both points
            const sourceIdx = snapInfo.index;
            if (sourceIdx !== snapAnchor.index) {
              snapModuleToSide(sourceIdx, snapAnchor.index, snapAnchor, snapInfo);
            } else {
              // Double click same module twice -> just select it
              selectModuleByIndex(sourceIdx);
            }
            snapAnchor = null;
          }
        }
      } else {
        snapAnchor = null;
      }
    });

    // Single click to select or deselect
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const idx = getModuleIndexAt(x, y);
      
      if (idx === null) {
        // Clicked outside: Deselect
        if (state.selectedPlanIdx !== -1) {
          const item = state.plan[state.selectedPlanIdx];
          const group = getModuleGroup(state.selectedPlanIdx);
          if (group && item) {
            group.updateWorldMatrix(true, true);
            const box = new THREE.Box3().setFromObject(group);
            
            // "Right" side based on module rotation
            if (item.r === 0 || item.r === 180 || item.r === 360) {
              setPos('x', box.max.x); // Continue to the right
              setPos('z', item.pos[2]); // Match height
            } else if (item.r === 90 || item.r === 270) {
              // Rotation 90 means it's along the Y wall-depth axis
              // Three Z maps inversely to UI Y, so 'max Y' in UI is actually min Z in Three
              // wait, Three Z is -UI Y. So UI Y = -Three Z.
              // So max UI Y = - box.min.z
              setPos('y', -box.min.z);
              setPos('z', item.pos[2]);
            }
          }
        }

        state.selectedPlanIdx = -1;
        editingPlanIdx = -1;
        snapAnchor = null; // Clear snapping state
        highlightModule(-1);
        refreshParams();
        renderPlanList();
      } else {
        // Clicked a module: Select it
        selectModuleByIndex(idx);
      }
    });
  }

  // Restore last session from localStorage
  autoRestore();
});

// ─── Prices ───────────────────────────────────────────────────────────────────
function initPriceInputs() {
  ['univer', 'mdf', 'hdf', 'radna', 'kant-k', 'kant-K'].forEach(id => {
    const input = document.getElementById(`price-${id}`);
    if (input) {
      const stateKey = id.replace(/-/g, '_');
      input.value = state.prices[stateKey];
      input.addEventListener('input', e => {
        state.prices[stateKey] = parseFloat(e.target.value) || 0;
        updateTotalCost();
      });
    }
  });

  const btn = document.getElementById('btn-toggle-prices');
  if (btn) {
    btn.onclick = () => {
      const panel = document.getElementById('prices-panel');
      const isHidden = panel.classList.toggle('hidden');
      btn.style.opacity = isHidden ? '0.5' : '1';
    };
  }
}

function calcKant(kantStr, Lmm, Wmm) {
  if (!kantStr || kantStr === '/') return { k: 0, K: 0 };

  let len_k = 0;
  let len_K = 0;

  // Pattern: N[dk] where d=length, k=width. k=thin, K=thick
  // Example: "1d i 2k", "2KK", "1d"
  const parts = kantStr.split('i').map(s => s.trim());
  parts.forEach(p => {
    const match = p.match(/(\d*)\s*([dDkK]+)/);
    if (match) {
      const qty = parseInt(match[1] || "1");
      const code = match[2];
      const isShortSide = code.toLowerCase().includes('k');
      const isBig = code.includes('K');

      const sideLen = isShortSide ? Wmm : Lmm;
      if (isBig) len_K += (sideLen / 1000) * qty;
      else len_k += (sideLen / 1000) * qty;
    }
  });

  return { k: len_k, K: len_K };
}

function getPriceForMaterial(materialName) {
  const matUpper = materialName.toUpperCase();
  if (matUpper.includes('UNIVER')) return state.prices.univer;
  if (matUpper.includes('MDF')) return state.prices.mdf;
  if (matUpper.includes('HDF')) return state.prices.hdf;
  if (matUpper.includes('RADNA PLOCA')) return state.prices.radna;
  return 0;
}

function updateTotalCost() {
  const krojna = computeCuttingList(state.plan);
  let totalMaterial = 0;
  let totalKant = 0;

  for (const part of krojna) {
    // Material cost
    const area = (part.L * part.W) / 1000000;
    const itemTotalSqm = area * part.qty;
    totalMaterial += itemTotalSqm * getPriceForMaterial(part.material);

    // Kant cost
    const k = calcKant(part.kant, part.L, part.W);
    totalKant += (k.k * state.prices.kant_k * part.qty);
    totalKant += (k.K * state.prices.kant_K * part.qty);
  }

  const totalEur = totalMaterial + totalKant;
  const totalRsd = totalEur * 117;

  const totalEl = document.getElementById('price-total');
  if (totalEl) {
    totalEl.textContent = totalEur.toFixed(2) + ' €';
  }
  const rsdEl = document.getElementById('price-total-rsd');
  if (rsdEl) {
    rsdEl.textContent = totalRsd.toLocaleString('sr-RS') + ' RSD';
  }

  // Add breakdown if wrap exists
  const overlay = document.getElementById('price-overlay');
  if (overlay) {
    let breakdown = overlay.querySelector('.price-breakdown');
    if (!breakdown) {
      breakdown = document.createElement('div');
      breakdown.className = 'price-breakdown';
      breakdown.style.fontSize = '9px';
      breakdown.style.marginTop = '4px';
      breakdown.style.color = 'var(--text-secondary)';
      overlay.appendChild(breakdown);
    }
    breakdown.innerHTML = `Mat: ${totalMaterial.toFixed(2)}€ · Kant: <span style="color:var(--accent)">${totalKant.toFixed(2)}€</span>`;
  }
}

// ─── Title bar ────────────────────────────────────────────────────────────────
function initTitlebarControls() {
  document.getElementById('btn-minimize').onclick = () => window.electronAPI?.minimize();
  document.getElementById('btn-maximize').onclick = () => window.electronAPI?.maximize();
  document.getElementById('btn-close').onclick = () => window.electronAPI?.close();

  const themeBtn = document.getElementById('btn-theme');
  themeBtn.addEventListener('click', () => {
    isDark = !isDark;
    if (isDark) {
      document.body.classList.remove('light');
      themeBtn.textContent = '☁️ Dark';
      setViewerTheme('dark');
    } else {
      document.body.classList.add('light');
      themeBtn.textContent = '🌙 Light';
      setViewerTheme('light');
    }
  });
}

function initOverlayToggles() {
  const wallPanel = document.getElementById('wall-grid-panel');
  const toggleBtn = document.getElementById('btn-toggle-wall-grid');
  const pinCheckbox = document.getElementById('pin-wall-grid');

  if (!wallPanel || !toggleBtn || !pinCheckbox) return;

  // Load persistence
  const isPinned = localStorage.getItem('wallGridPinned') === 'true';
  const isCollapsed = localStorage.getItem('wallGridCollapsed') === 'true';

  pinCheckbox.checked = isPinned;

  // Initial state
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
    const currentlyCollapsed = wallPanel.classList.toggle('collapsed');
    toggleBtn.textContent = currentlyCollapsed ? '▲' : '▼';
    localStorage.setItem('wallGridCollapsed', currentlyCollapsed);

    // If we manually open it, maybe we don't change pin, 
    // but if we collapse it, we should probably unpin if they were pinned?
    // User said "fix it so it stays", so checking pinCheckbox is enough.
  });

  pinCheckbox.addEventListener('change', () => {
    localStorage.setItem('wallGridPinned', pinCheckbox.checked);
    if (pinCheckbox.checked) {
      wallPanel.classList.remove('collapsed');
      toggleBtn.textContent = '▼';
    }
  });
}

// ─── Category Tabs ────────────────────────────────────────────────────────────
function initCategoryTabs() {
  document.querySelectorAll('.tab[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab[data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentCategory = btn.dataset.cat;
      populateModuleSelect();
    });
  });
}

// ─── Module Select ────────────────────────────────────────────────────────────
function initModuleSelect() {
  populateModuleSelect();
  document.getElementById('klizac-select').addEventListener('change', e => {
    state.klizac = e.target.value;
  });
  document.getElementById('client-name').addEventListener('input', e => {
    state.clientName = e.target.value;
  });
}

const MODULE_ICONS = {
  // ── Donji (lower base cabinets) ──────────────────────────────────────────

  // Standard worktop cabinet: box + toe kick + 2 doors + handles
  'radni_stol': `
    <rect x="2" y="5" width="20" height="15" rx="1"/>
    <rect x="2" y="19" width="20" height="2" rx="1" opacity=".5"/>
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="2" y1="9" x2="22" y2="9"/>
    <circle cx="9"  cy="14.5" r="1"/>
    <circle cx="15" cy="14.5" r="1"/>`,

  // Open worktop (gola = no doors): same box, shelf visible, no door line
  'gola_radni_stol': `
    <rect x="2" y="5" width="20" height="15" rx="1"/>
    <rect x="2" y="19" width="20" height="2" rx="1" opacity=".5"/>
    <line x1="2" y1="9" x2="22" y2="9"/>
    <line x1="2" y1="14" x2="22" y2="14"/>`,

  // 4-drawer cabinet: box + 4 drawer fronts + 4 handles
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

  // Open drawer cabinet (gola): same but slightly taller
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

  // Dishwasher door panel: single tall door + horizontal handle near top
  'vrata_sudo_masine': `
    <rect x="3" y="3" width="18" height="18" rx="1"/>
    <rect x="3" y="19" width="18" height="2" rx="1" opacity=".5"/>
    <line x1="3" y1="7" x2="21" y2="7"/>
    <line x1="6" y1="5" x2="18" y2="5"/>
    <text x="12" y="15" text-anchor="middle" font-size="5" fill="currentColor" stroke="none" font-family="sans-serif">DW</text>`,

  // Dishwasher door (gola / no-plinth variant)
  'vrata_sudo_masine_gola': `
    <rect x="3" y="2" width="18" height="19" rx="1"/>
    <rect x="3" y="20" width="18" height="2" rx="1" opacity=".5"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="6" y1="4" x2="18" y2="4"/>
    <text x="12" y="15" text-anchor="middle" font-size="5" fill="currentColor" stroke="none" font-family="sans-serif">DW</text>`,

  // Oven cabinet: box + small oven opening + drawer below door above
  'radni_stol_rerne': `
    <rect x="2" y="3" width="20" height="18" rx="1"/>
    <rect x="2" y="20" width="20" height="2" rx="1" opacity=".5"/>
    <rect x="5" y="7" width="14" height="10" rx="1" opacity=".6"/>
    <line x1="2" y1="6" x2="22" y2="6"/>
    <line x1="5" y1="5" x2="19" y2="5"/>`,

  // Oven cabinet (gola)
  'radni_stol_rerne_gola': `
    <rect x="2" y="2" width="20" height="19" rx="1"/>
    <rect x="2" y="20" width="20" height="2" rx="1" opacity=".5"/>
    <rect x="5" y="6" width="14" height="10" rx="1" opacity=".6"/>
    <line x1="2" y1="5" x2="22" y2="5"/>
    <line x1="5" y1="4" x2="19" y2="4"/>`,

  // Hob cabinet (no drawer, no door – just hob on top + open below)
  'radni_stol_rerne_gola_bez_fioke': `
    <rect x="2" y="3" width="20" height="18" rx="1"/>
    <rect x="2" y="20" width="20" height="2" rx=".5" opacity=".5"/>
    <rect x="4" y="1" width="16" height="3" rx=".5" fill="currentColor" opacity=".3"/>
    <circle cx="8"  cy="2.5" r="1" fill="currentColor" stroke="none"/>
    <circle cx="16" cy="2.5" r="1" fill="currentColor" stroke="none"/>
    <line x1="2" y1="7" x2="22" y2="7"/>`,

  // Standalone cooker (freestanding)
  'sporet': `
    <rect x="2" y="5" width="20" height="16" rx="1"/>
    <rect x="4" y="3" width="16" height="3" rx=".5" opacity=".4"/>
    <circle cx="8"  cy="4.5" r="1.2" fill="currentColor" stroke="none" opacity=".7"/>
    <circle cx="12" cy="4.5" r="1.2" fill="currentColor" stroke="none" opacity=".7"/>
    <circle cx="16" cy="4.5" r="1.2" fill="currentColor" stroke="none" opacity=".7"/>
    <rect x="5" y="9" width="14" height="9" rx="1" opacity=".5"/>
    <line x1="5" y1="8" x2="19" y2="8"/>`,

  // Freestanding fridge: tall box, small top freezer divider
  'samostojeci_frizider': `
    <rect x="4" y="1" width="16" height="22" rx="1"/>
    <line x1="4" y1="7" x2="20" y2="7"/>
    <circle cx="18" cy="4"  r=".8" fill="currentColor" stroke="none"/>
    <circle cx="18" cy="15" r=".8" fill="currentColor" stroke="none"/>`,

  // Tall cabinet next to pillar: box + pillar notch top-right
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

  // ── Ugaoni (corner cabinets) ──────────────────────────────────────────────

  // L-shaped 90° corner: two legs visible as an L
  'dug_element_90': `
    <polyline points="3,20 3,4 14,4 14,10 20,10 20,20 3,20"/>
    <line x1="3"  y1="8"  x2="14" y2="8"/>
    <line x1="14" y1="14" x2="20" y2="14"/>
    <circle cx="8.5"  cy="14"  r="1"/>
    <circle cx="17"   cy="12"  r="1"/>`,

  // L-shaped 90° corner (gola)
  'dug_element_90_gola': `
    <polyline points="3,20 3,4 14,4 14,10 20,10 20,20 3,20"/>
    <line x1="3"  y1="8"  x2="14" y2="8"/>
    <line x1="3"  y1="14" x2="14" y2="14"/>
    <line x1="14" y1="14" x2="20" y2="14"/>`,

  // 45° diagonal corner: pentagon shape with diagonal door
  'donji_ugaoni_element_45_sa_plocom': `
    <polygon points="3,20 3,4 15,4 21,10 21,20"/>
    <line x1="3" y1="8" x2="15" y2="8"/>
    <line x1="15" y1="4" x2="21" y2="10"/>
    <line x1="15" y1="8" x2="21" y2="10"/>`,

  // 45° diagonal corner (gola)
  'donji_ugaoni_element_45_sa_plocom_gola': `
    <polygon points="3,20 3,4 15,4 21,10 21,20"/>
    <line x1="3" y1="8" x2="15" y2="8"/>
    <line x1="3" y1="14" x2="21" y2="14"/>
    <line x1="15" y1="4" x2="21" y2="10"/>`,

  // ── Gornji (upper wall cabinets) ─────────────────────────────────────────

  // Classic wall cabinet: narrow box, 2 doors, bar handles at bottom
  'klasicna_viseca': `
    <rect x="2" y="3" width="20" height="17" rx="1"/>
    <line x1="12" y1="3" x2="12" y2="20"/>
    <line x1="2"  y1="9" x2="22" y2="9"/>
    <circle cx="9"  cy="17" r="1"/>
    <circle cx="15" cy="17" r="1"/>`,

  // Classic wall cabinet (gola / no plinth offset)
  'klasicna_viseca_gola': `
    <rect x="2" y="2" width="20" height="18" rx="1"/>
    <line x1="12" y1="2" x2="12" y2="20"/>
    <line x1="2"  y1="7" x2="22" y2="7"/>
    <line x1="2"  y1="13" x2="22" y2="13"/>`,

  // Wall cabinet below beam: shorter usable height + beam notch at top right
  'klasicna_viseca_gola_ispod_grede': `
    <rect x="2" y="5" width="20" height="15" rx="1"/>
    <rect x="15" y="2" width="7" height="4" rx=".5" opacity=".35"/>
    <line x1="12" y1="5" x2="12" y2="20"/>
    <line x1="2"  y1="10" x2="22" y2="10"/>`,

  // Tall wall cabinet on column (kipu): two separate door sections, split middle
  'viseca_na_kipu': `
    <rect x="2" y="1" width="20" height="22" rx="1"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <line x1="2" y1="6"  x2="22" y2="6"/>
    <line x1="2" y1="17" x2="22" y2="17"/>
    <circle cx="12" cy="9.5"  r="1.2"/>
    <circle cx="12" cy="14.5" r="1.2"/>`,

  // Tall wall cabinet on column (gola)
  'viseca_na_kipu_gola': `
    <rect x="2" y="1" width="20" height="22" rx="1"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <line x1="2" y1="6"  x2="22" y2="6"/>
    <line x1="2" y1="17" x2="22" y2="17"/>`,

  // Upper 90° corner cabinet: L-plan top-view icon showing two arms
  'gue90': `
    <polyline points="3,21 3,3 13,3 13,10 21,10 21,21 3,21"/>
    <line x1="3"  y1="7"  x2="13" y2="7"/>
    <line x1="3"  y1="16" x2="13" y2="16"/>
    <line x1="13" y1="15" x2="21" y2="15"/>`,

  // ── Visoki (tall full-height cabinets) ───────────────────────────────────


  // Full-height wardrobe/pantry: tall box, 2 doors, handles
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

function populateModuleSelect() {
  const grid = document.getElementById('module-grid');
  grid.innerHTML = ''; // clear
  const mods = MODULE_GROUPS[state.currentCategory] || {};

  for (const name of Object.keys(mods)) {
    const card = document.createElement('div');
    card.className = 'module-card';
    if (state.selectedModule === name) {
      card.classList.add('selected');
    }

    card.innerHTML = `
      ${getModuleIconSVG(name)}
      <div class="module-card-label">${name.replace(/_/g, ' ')}</div>
    `;

    card.addEventListener('click', () => {
      // Remove selected from siblings
      grid.querySelectorAll('.module-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedModule = name;
      // Leave plan-item edit mode; restore normal params for new additions
      editingPlanIdx = -1;
      refreshParams();
    });

    grid.appendChild(card);
  }

  // Auto-select first if none selected and there are modules
  const firstKey = Object.keys(mods)[0];
  if (!state.selectedModule && firstKey) {
    state.selectedModule = firstKey;
    if (grid.firstChild) grid.firstChild.classList.add('selected');
  } else if (!mods[state.selectedModule]) {
    // If category changed and selected module doesn't exist in new category
    state.selectedModule = '';
  }

  refreshParams();
}

function refreshParams() {
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
    label.textContent = PARAM_LABELS[name] ? `${PARAM_LABELS[name]} (${name})` : name;
    label.title = PARAM_LABELS[name] || name;

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'param-input';
    input.value = defaultVal;
    input.step = '1';
    input.min = '0';

    input.addEventListener('keydown', e => {
      const rows = container.querySelectorAll('.param-input');
      if (e.key === 'ArrowDown' && idx < rows.length - 1) { rows[idx + 1].focus(); e.preventDefault(); }
      if (e.key === 'ArrowUp' && idx > 0) { rows[idx - 1].focus(); e.preventDefault(); }
    });

    state.paramInputs[name] = defaultVal;
    input.addEventListener('input', () => { state.paramInputs[name] = input.value; });

    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  });
}

/**
 * Populate the params panel with values from an existing plan item,
 * wiring each input to write back to item.p and rebuild the 3D module live.
 */
function refreshParamsForPlanItem(planIdx) {
  const item = state.plan[planIdx];
  if (!item) return;

  editingPlanIdx = planIdx;

  // Find the param definitions for this module (search all categories)
  let paramDefs = null;
  for (const cat of Object.values(MODULE_GROUPS)) {
    if (cat[item.ime]) { paramDefs = cat[item.ime]; break; }
  }
  if (!paramDefs) return;

  const container = document.getElementById('params-container');
  container.innerHTML = '';
  // Show a header indicating edit mode
  const header = document.createElement('div');
  header.className = 'params-edit-banner';
  header.textContent = `Editovanje: ${item.ime.replace(/_/g, ' ')}`;
  container.appendChild(header);

  paramDefs.forEach(([name], idx) => {
    const row = document.createElement('div');
    row.className = 'param-row';

    const label = document.createElement('span');
    label.className = 'param-name';
    label.textContent = PARAM_LABELS[name] ? `${PARAM_LABELS[name]} (${name})` : name;
    label.title = PARAM_LABELS[name] || name;

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'param-input';
    input.value = item.p[name] ?? '';
    input.step = '1';
    input.min = '0';

    input.addEventListener('keydown', e => {
      const rows = container.querySelectorAll('.param-input');
      if (e.key === 'ArrowDown' && idx < rows.length - 1) { rows[idx + 1].focus(); e.preventDefault(); }
      if (e.key === 'ArrowUp' && idx > 0) { rows[idx - 1].focus(); e.preventDefault(); }
    });

    input.addEventListener('input', () => {
      const val = input.value;
      item.p[name] = val;

      // If a width param changed, update sirina and cascade X to items on the right
      const WIDTH_PARAMS = ['s', 'dss', 'sl', 'l'];
      if (WIDTH_PARAMS.includes(name) && item.mat_pos) {
        const newSirina = parseFloat(val) || item.sirina;
        item.sirina = newSirina;
        const cellKey = `${item.mat_pos[0]},${item.mat_pos[1]}`;
        if (state.occupiedCells[cellKey]) state.occupiedCells[cellKey].sirina = newSirina;
        shiftRowFrom(item.mat_pos[0], item.mat_pos[1]);
        // If the wall-grid selected cell is in the same row and to the right,
        // recalculate and update the X position input for the next placement
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

      // Rebuild this module's 3D
      try {
        const group = buildKitchenModule(
          item.ime, item.p, state.materials, state.settings,
          item.pos[0], item.pos[1], item.pos[2], item.r
        );
        removeModuleGroup(planIdx);
        addModuleGroup(planIdx, group);
        highlightModule(planIdx);
      } catch (e) {
        console.error('3D rebuild failed for', item.ime, e);
      }
      updateTotalCost();
      renderPlanList();
    });

    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
  });
}

// ─── Wall Grid ────────────────────────────────────────────────────────────────
const WALL_ROWS = [
  { label: 'Z=140', z: 140, row: 0 },
  { label: 'Z=82', z: 82, row: 1 },
  { label: 'Z=0', z: 0, row: 2 }
];
const WALL_COLS = 10;

function initWallGrid() {
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

function selectCell(row, col) {
  // Deselect old
  const old = document.querySelector(`.wall-cell.selected`);
  if (old) old.classList.remove('selected');

  state.selectedCell = [row, col];

  // Calculate X from occupied cells to the left
  let calcX = 0;
  for (let c = 1; c < col; c++) {
    const key = `${row},${c}`;
    if (state.occupiedCells[key]) calcX += state.occupiedCells[key].sirina;
  }

  setPos('x', calcX);
  setPos('z', WALL_ROWS[row]?.z ?? 0);

  const newCell = document.querySelector(`.wall-cell[data-row="${row}"][data-col="${col}"]`);
  if (newCell) newCell.classList.add('selected');
}

function updateWallGridDisplay() {
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

/**
 * Recalculate X positions of all plan items in `row` starting from column
 * `fromCol + 1` (i.e. after the item whose width just changed).
 * Also rebuilds 3D for each shifted item.
 */
function shiftRowFrom(row, fromCol) {
  // Build cumulative X up to fromCol (inclusive — that item's new sirina is already set)
  let x = 0;
  for (let c = 1; c <= WALL_COLS; c++) {
    const key = `${row},${c}`;
    const cell = state.occupiedCells[key];
    if (!cell) continue;

    // Find the plan item for this cell
    const planItem = state.plan.find(
      m => m.mat_pos && m.mat_pos[0] === row && m.mat_pos[1] === c
    );
    if (!planItem) continue;

    if (c <= fromCol) {
      // Accumulate X from items before (and including) the changed one
      x += cell.sirina;
    } else {
      // Shift this item's X to the new cumulative position
      planItem.pos[0] = x;
      x += cell.sirina;

      // Rebuild 3D for this shifted item
      const idx = state.plan.indexOf(planItem);
      try {
        const group = buildKitchenModule(
          planItem.ime, planItem.p, state.materials, state.settings,
          planItem.pos[0], planItem.pos[1], planItem.pos[2], planItem.r
        );
        removeModuleGroup(idx);
        addModuleGroup(idx, group);
      } catch (e) {
        console.error('3D shift rebuild failed for', planItem.ime, e);
      }
    }
  }

  // After shifting base cabinets, sync any countertops that span them
  rebuildCountertopsForRow(row);
}

/**
 * After any cabinet width/position change in a row, find radna_ploca and cokla
 * items that overlap those cabinets and recompute their X start and total length
 * to exactly match the span of the cabinets underneath them.
 */
function rebuildCountertopsForRow(row) {
  // All base cabinet plan items that belong to this wall-grid row
  const rowItems = state.plan.filter(
    m => m.mat_pos && m.mat_pos[0] === row &&
      m.ime !== 'radna_ploca' && m.ime !== 'cokla'
  );
  if (rowItems.length === 0) return;

  let changed = false;

  // Helper that processes either radna_ploca or cokla entries
  const syncSpanning = (typeName) => {
    state.plan.forEach((rp, rpIdx) => {
      if (rp.ime !== typeName) return;

      const rpLen = parseFloat(rp.p.l) || 0;
      const rpX0 = rp.pos[0];
      const rpX1 = rpX0 + rpLen;

      // Find row cabinets with matching rotation that overlap this item's X range
      const under = rowItems.filter(m => {
        if (m.r !== rp.r) return false;
        const mX0 = m.pos[0];
        const mW = parseFloat(m.p.s || m.p.dss || m.sirina || 60);
        const mX1 = mX0 + mW;
        return mX0 < rpX1 + 2 && mX1 > rpX0 - 2; // 2 cm tolerance
      });
      if (under.length === 0) return;

      const newX0 = Math.min(...under.map(m => m.pos[0]));
      const newX1 = Math.max(...under.map(m =>
        m.pos[0] + parseFloat(m.p.s || m.p.dss || m.sirina || 60)
      ));
      const newLen = newX1 - newX0;

      // Skip if nothing actually changed
      if (Math.abs(newX0 - rpX0) < 0.01 && Math.abs(newLen - rpLen) < 0.01) return;

      rp.pos[0] = newX0;
      rp.p.l = String(newLen);

      try {
        const group = buildKitchenModule(
          rp.ime, rp.p, state.materials, state.settings,
          rp.pos[0], rp.pos[1], rp.pos[2], rp.r
        );
        removeModuleGroup(rpIdx);
        addModuleGroup(rpIdx, group);
      } catch (e) {
        console.error(`${typeName} rebuild failed`, e);
      }
      changed = true;
    });
  };

  syncSpanning('radna_ploca');
  syncSpanning('cokla');

  if (changed) renderPlanList();
}

// ─── Materials Panel ──────────────────────────────────────────────────────────
function initMaterialsPanel() {
  const grid = document.getElementById('materials-grid');
  grid.innerHTML = '';

  for (const [key, label] of Object.entries(MAT_LABELS)) {
    const card = document.createElement('div');
    card.className = 'mat-card';
    card.dataset.matKey = key;

    const lbl = document.createElement('span');
    lbl.className = 'mat-card-label';
    lbl.textContent = label;

    const swatch = document.createElement('div');
    swatch.className = 'mat-swatch';
    swatch.id = `swatch-${key}`;

    const name = document.createElement('span');
    name.className = 'mat-name';
    name.id = `matname-${key}`;

    card.appendChild(lbl);
    card.appendChild(swatch);
    card.appendChild(name);

    card.addEventListener('click', () => openMaterialPicker(key));
    grid.appendChild(card);
  }

  refreshMaterialSwatches();
}

function refreshMaterialSwatches() {
  for (const key of Object.keys(MAT_LABELS)) {
    const def = state.materials[key];
    const swatch = document.getElementById(`swatch-${key}`);
    const nameEl = document.getElementById(`matname-${key}`);
    if (swatch) {
      if (def.type === 'texture' && def.textureName) {
        const tp = TEXTURE_PRESETS.find(t => t.name === def.textureName);
        if (tp) {
          swatch.style.background = `linear-gradient(135deg, ${tp.base} 0%, ${tp.grain} 100%)`;
        }
      } else {
        swatch.style.backgroundColor = def.color;
      }
    }
    if (nameEl) nameEl.textContent = def.name;
  }
}

// ─── Toggles ──────────────────────────────────────────────────────────────────
const TOGGLE_LABELS = {
  front_vrata: 'Vrata',
  polica: 'Police',
  pozadina: 'Pozadina',
  celafioka: 'Čela fioka',
  fioke: 'Fioke',
  radna_ploca: 'Radna ploča'
};

function initToggles() {
  const grid = document.getElementById('toggles-grid');
  grid.innerHTML = '';

  for (const [key, label] of Object.entries(TOGGLE_LABELS)) {
    const item = document.createElement('div');
    item.className = 'toggle-item' + (state.settings[key] ? ' active' : '');
    item.dataset.key = key;

    const sw = document.createElement('div');
    sw.className = 'toggle-switch';

    const lbl = document.createElement('span');
    lbl.className = 'toggle-label';
    lbl.textContent = label;

    item.appendChild(sw);
    item.appendChild(lbl);

    item.addEventListener('click', () => {
      state.settings[key] = !state.settings[key];
      item.classList.toggle('active', state.settings[key]);
      rebuildAllModules();
    });

    grid.appendChild(item);
  }
}

// ─── Position Inputs ──────────────────────────────────────────────────────────
function initPositionInputs() {
  ['x', 'y', 'z', 'r'].forEach(axis => {
    document.getElementById(`pos-${axis}`).addEventListener('input', e => {
      const val = parseFloat(e.target.value) || 0;
      state.position[axis] = val;

      // If a module is selected in the plan list, update its position dynamically
      if (state.selectedPlanIdx >= 0) {
        const item = state.plan[state.selectedPlanIdx];

        if (axis === 'x') {
          const oldX = item.pos[0];
          const delta = val - oldX;
          item.pos[0] = val;

          // Shift all items in the same row that are to the right of this one
          if (item.mat_pos && delta !== 0) {
            const [itemRow, itemCol] = item.mat_pos;
            for (let c = itemCol + 1; c <= WALL_COLS; c++) {
              const key = `${itemRow},${c}`;
              const cellData = state.occupiedCells[key];
              if (!cellData) continue;
              const rightItem = state.plan.find(
                m => m.mat_pos && m.mat_pos[0] === itemRow && m.mat_pos[1] === c
              );
              if (!rightItem) continue;
              rightItem.pos[0] += delta;
              const rightIdx = state.plan.indexOf(rightItem);
              try {
                const group = buildKitchenModule(
                  rightItem.ime, rightItem.p, state.materials, state.settings,
                  rightItem.pos[0], rightItem.pos[1], rightItem.pos[2], rightItem.r
                );
                removeModuleGroup(rightIdx);
                addModuleGroup(rightIdx, group);
              } catch (e) {
                console.error('3D shift rebuild failed for', rightItem.ime, e);
              }
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

        // Rebuild and replace just this module efficiently
        try {
          const group = buildKitchenModule(
            item.ime, item.p, state.materials, state.settings,
            item.pos[0], item.pos[1], item.pos[2], item.r
          );
          removeModuleGroup(state.selectedPlanIdx);
          addModuleGroup(state.selectedPlanIdx, group);
          highlightModule(state.selectedPlanIdx);
        } catch (e) {
          console.error('3D rebuild failed for', item.ime, e);
        }
        renderPlanList(); // update label
      }
    });
  });
}

function setPos(axis, val) {
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

// ─── Plan Actions ─────────────────────────────────────────────────────────────
function initPlanActions() {
  document.getElementById('btn-add').addEventListener('click', addToPlan);
  document.getElementById('btn-krojna').addEventListener('click', showKrojnaLista);
  document.getElementById('btn-optimik').addEventListener('click', exportOptimik);
  document.getElementById('btn-pdf').addEventListener('click', exportPdf);

  // Toggle Materials Panel
  const btnToggleMat = document.getElementById('btn-toggle-materials');
  const matPanel = document.getElementById('materials-panel');
  if (btnToggleMat && matPanel) {
    btnToggleMat.addEventListener('click', () => {
      matPanel.classList.toggle('hidden');
    });
  }

  // Wall grid special buttons
  const btnRadna = document.getElementById('btn-radna');
  btnRadna.addEventListener('click', () => {
    state.addingRadnaPloca = !state.addingRadnaPloca;
    if (state.addingRadnaPloca) {
      state.radnaPlocaSelection = [];
      btnRadna.style.backgroundColor = 'var(--accent)';
      btnRadna.style.color = '#fff';
      showNotification('Dvoklikni na početni element, a zatim na krajnji element za spajanje radne ploče.', 'info');
    } else {
      state.radnaPlocaSelection = [];
      import('./viewer.js').then(v => v.highlightModule(-1)); // clear selection just in case
      btnRadna.style.backgroundColor = '';
      btnRadna.style.color = '';
      showNotification('Izašao si iz moda za dodavanje radne ploče.', 'info');
    }
  });

  document.getElementById('btn-cokla').addEventListener('click', () => {
    state.addingCokla = !state.addingCokla;
    const btnCokla = document.getElementById('btn-cokla');
    if (state.addingCokla) {
      state.coklaSelection = [];
      btnCokla.style.backgroundColor = 'var(--accent)';
      btnCokla.style.color = '#fff';
      showNotification('Dvoklikni na početni element, a zatim na krajnji element za spajanje cokle.', 'info');
    } else {
      state.coklaSelection = [];
      import('./viewer.js').then(v => v.highlightModule(-1));
      btnCokla.style.backgroundColor = '';
      btnCokla.style.color = '';
      showNotification('Izašao si iz moda za dodavanje cokle.', 'info');
    }
  });

  // Viewer buttons
  document.getElementById('btn-view-front').addEventListener('click', () => setCameraView('front'));
  document.getElementById('btn-view-iso').addEventListener('click', () => setCameraView('iso'));
  document.getElementById('btn-view-top').addEventListener('click', () => setCameraView('top'));
  document.getElementById('btn-reset-cam').addEventListener('click', resetCamera);

  // Lighting warmth toggle
  const btnLight = document.getElementById('btn-toggle-light');
  if (btnLight) {
    btnLight.style.filter = state.lightingMode === 'warm' ? 'sepia(0.6) saturate(2)' : 'none';
    btnLight.addEventListener('click', (e) => {
      state.lightingMode = state.lightingMode === 'cool' ? 'warm' : 'cool';
      setLightingMode(state.lightingMode);
      btnLight.style.filter = state.lightingMode === 'warm' ? 'sepia(0.6) saturate(2)' : 'none';
      showNotification(`Osvjetljenje: ${state.lightingMode === 'warm' ? 'Toplo' : 'Hladno'}`, 'info');
    });
  }

  // Display toggles popover
  const btnPrikaz = document.getElementById('btn-toggle-prikaz');
  const popover = document.getElementById('prikaz-popover');
  if (btnPrikaz && popover) {
    btnPrikaz.onclick = (e) => {
      e.stopPropagation();
      popover.classList.toggle('hidden');
    };
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && !btnPrikaz.contains(e.target)) {
        popover.classList.add('hidden');
      }
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement.tagName !== 'INPUT' && state.selectedPlanIdx >= 0) {
        deleteModule(state.selectedPlanIdx);
      }
    }
  });

  // Save / Load project
  document.getElementById('btn-save-project')?.addEventListener('click', saveProject);
  document.getElementById('btn-load-project')?.addEventListener('click', loadProject);

  // Clear plan
  document.getElementById('btn-clear-plan')?.addEventListener('click', clearPlan);
}

// ─── Context Menu ──────────────────────────────────────────────────────────────
let ctxTargetIdx = -1;

function showCtxMenu(x, y, idx) {
  ctxTargetIdx = idx;
  const menu = document.getElementById('ctx-menu');
  if (!menu) return;

  // Clamp to viewport
  menu.classList.remove('hidden');
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  const left = Math.min(x, window.innerWidth - mw - 4);
  const top  = Math.min(y, window.innerHeight - mh - 4);
  menu.style.left = left + 'px';
  menu.style.top  = top  + 'px';
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
      // Simulate first dblclick anchor set — expose snapAnchor via a helper
      setSnapAnchorByIndex(ctxTargetIdx);
      showNotification('Sidro postavljeno. Dvaput klikni na element koji želiš spojiti.', 'info');
    }
    hideCtxMenu();
  });
  document.getElementById('ctx-remove')?.addEventListener('click', () => {
    if (ctxTargetIdx >= 0) deleteModule(ctxTargetIdx);
    hideCtxMenu();
  });

  // Close on any click outside
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) hideCtxMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideCtxMenu();
  });

  // Right-click on 3D canvas
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

// ─── Auto-save to localStorage ────────────────────────────────────────────────
const AUTO_SAVE_KEY = 'meco_autosave';

function autoSave() {
  try {
    const data = {
      version: 1,
      plan: state.plan,
      occupiedCells: state.occupiedCells,
      materials: state.materials,
      settings: state.settings,
      prices: state.prices,
      wallFixtures: state.wallFixtures,
      position: state.position,
      selectedCell: state.selectedCell,
      clientName: document.getElementById('client-name')?.value || state.clientName,
      simplifiedKrojna: state.simplifiedKrojna,
      lightingMode: state.lightingMode
    };
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage full or unavailable — silently ignore
  }
}

function autoRestore() {
  try {
    const raw = localStorage.getItem(AUTO_SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data.version || !data.plan || data.plan.length === 0) return;

    state.materials = { ...DEFAULT_MATERIALS, ...data.materials };
    state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    state.prices = { ...state.prices, ...data.prices };
    state.plan = data.plan;
    state.occupiedCells = data.occupiedCells || {};
    state.wallFixtures = data.wallFixtures || [];
    state.position = data.position || { x: 0, y: 0, z: 0, r: 0 };
    state.selectedCell = data.selectedCell || [2, 1];
    state.simplifiedKrojna = data.simplifiedKrojna || false;
    state.lightingMode = data.lightingMode || 'warm';

    if (data.clientName) {
      state.clientName = data.clientName;
      const el = document.getElementById('client-name');
      if (el) el.value = data.clientName;
    }

    initMaterialsPanel();
    initToggles();

    clearAllGroups();
    clearFixtureMarkers();
    state.plan.forEach((entry, idx) => {
      try {
        const group = buildKitchenModule(
          entry.ime, entry.p, state.materials, state.settings,
          entry.pos[0], entry.pos[1], entry.pos[2], entry.r || 0
        );
        addModuleGroup(idx, group);
      } catch (e) { console.warn('Auto-restore: failed to rebuild module', idx, e); }
    });
    state.wallFixtures.forEach((fixture, idx) => {
      try { addFixtureMarker(idx, fixture); } catch (e) { }
    });

    renderPlanList();
    updateWallGridDisplay();
    updateTotalCost();
    setLightingMode(state.lightingMode);
    showNotification('Radni prostor vraćen', 'info');
  } catch (e) {
    console.warn('Auto-restore failed:', e);
  }
}

// ─── Project Save / Load ───────────────────────────────────────────────────────
async function saveProject() {
  const projectData = {
    version: 1,
    savedAt: new Date().toISOString(),
    clientName: document.getElementById('client-name')?.value || state.clientName,
    materials: state.materials,
    settings: state.settings,
    prices: state.prices,
    plan: state.plan,
    occupiedCells: state.occupiedCells,
    wallFixtures: state.wallFixtures,
    position: state.position,
    selectedCell: state.selectedCell,
    simplifiedKrojna: state.simplifiedKrojna,
    lightingMode: state.lightingMode
  };

  const filename = (projectData.clientName || 'projekat').replace(/\s+/g, '_') + '.meco';
  try {
    const res = await window.electronAPI?.saveFile({
      filename,
      ext: 'meco',
      extName: 'Meco Projekat',
      content: JSON.stringify(projectData, null, 2),
      encoding: 'utf-8'
    });
    if (res?.success) showNotification('Projekat sačuvan!', 'success');
  } catch (err) {
    console.error('Save error:', err);
    showNotification('Greška pri čuvanju projekta', 'error');
  }
}

async function loadProject() {
  try {
    const res = await window.electronAPI?.openFile({ extName: 'Meco Projekat', ext: 'meco' });
    if (!res?.success) return;

    const data = JSON.parse(res.content);
    if (!data.version || !data.plan) {
      showNotification('Neispravan fajl projekta', 'error');
      return;
    }

    // Restore state
    state.materials = { ...DEFAULT_MATERIALS, ...data.materials };
    state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    state.prices = { ...state.prices, ...data.prices };
    state.plan = data.plan || [];
    state.occupiedCells = data.occupiedCells || {};
    state.wallFixtures = data.wallFixtures || [];
    state.position = data.position || { x: 0, y: 0, z: 0, r: 0 };
    state.selectedPlanIdx = -1;
    state.simplifiedKrojna = data.simplifiedKrojna || false;
    state.lightingMode = data.lightingMode || 'warm';

    if (data.clientName) {
      state.clientName = data.clientName;
      const el = document.getElementById('client-name');
      if (el) el.value = data.clientName;
    }

    // Restore UI
    initMaterialsPanel();
    initToggles();

    // Update price inputs values without rebinding listeners
    ['univer', 'mdf', 'hdf', 'radna', 'kant-k', 'kant-K'].forEach(id => {
      const input = document.getElementById(`price-${id}`);
      if (input) {
        const stateKey = id.replace(/-/g, '_');
        input.value = state.prices[stateKey];
      }
    });

    // Rebuild 3D scene
    clearAllGroups();
    clearFixtureMarkers();

    state.plan.forEach((entry, idx) => {
      try {
        const group = buildKitchenModule(
          entry.ime, entry.p, state.materials, state.settings,
          entry.pos[0], entry.pos[1], entry.pos[2], entry.r || 0
        );
        addModuleGroup(idx, group);
      } catch (e) {
        console.warn('Failed to rebuild module', idx, e);
      }
    });

    state.wallFixtures.forEach((fixture, idx) => {
      try { addFixtureMarker(idx, fixture); } catch (e) { }
    });

    renderPlanList();
    updateWallGridDisplay();
    updateTotalCost();

    // Sync lighting
    setLightingMode(state.lightingMode);
    const btnLight = document.getElementById('btn-toggle-light');
    if (btnLight) btnLight.style.filter = state.lightingMode === 'warm' ? 'sepia(0.6) saturate(2)' : 'none';

    showNotification(`Projekat "${data.clientName}" učitan!`, 'success');
  } catch (err) {
    console.error('Load error:', err);
    showNotification('Greška pri učitavanju projekta', 'error');
  }
}

function addToPlan() {
  if (!state.selectedModule) {
    showNotification('Izaberi modul!', 'warning');
    return;
  }

  const pos = getPos();
  const p = { ...state.paramInputs, tip_klizaca: state.klizac };
  const [row, col] = state.selectedCell;

  // Determine width for grid tracking
  let sirina = 60;
  for (const k of ['s', 'dss', 'sl']) {
    if (p[k]) { const n = parseFloat(p[k]); if (!isNaN(n)) { sirina = n; break; } }
  }

  const entry = {
    ime: state.selectedModule,
    p: { ...p },
    pos: [pos.x, pos.y, pos.z],
    r: pos.r,
    mat_pos: [row, col],
    sirina
  };

  state.plan.push(entry);
  const idx = state.plan.length - 1;

  // Mark grid cell
  state.occupiedCells[`${row},${col}`] = { sirina, ime: state.selectedModule };
  updateWallGridDisplay();

  // Build 3D and add to scene
  try {
    const group = buildKitchenModule(
      entry.ime, entry.p, state.materials, state.settings,
      pos.x, pos.y, pos.z, pos.r
    );
    addModuleGroup(idx, group);
  } catch (e) {
    console.error('3D build failed for', entry.ime, e);
  }

  // Advance grid selection (auto-step right)
  if (pos.r === 0 && col < 10) {
    selectCell(row, col + 1);
  } else if (pos.r === 90) {
    setPos('y', pos.y + sirina);
  }

  renderPlanList();
  showNotification(`Dodano: ${state.selectedModule}`, 'success');
}

function addSpecialElement(tip) {
  const [selRow, selCol] = state.selectedCell;
  const rowForCheck = (tip === 'radna_ploca' || tip === 'cokla') ? 2 : selRow;

  let totalLen = 0, startX = null, maxV = 0;
  for (let c = selCol; c <= WALL_COLS; c++) {
    const key = `${rowForCheck},${c}`;
    if (state.occupiedCells[key]) {
      const item = state.occupiedCells[key];
      const planItem = state.plan.find(m => m.mat_pos && m.mat_pos[0] === rowForCheck && m.mat_pos[1] === c);
      if (startX === null && planItem) startX = planItem.pos[0];

      // Find the maximum height (v) among the cabinets
      if (planItem && planItem.p && planItem.p.v) {
        let pv = parseFloat(planItem.p.v);
        if (!isNaN(pv) && pv > maxV) maxV = pv;
      }

      totalLen += item.sirina;
    } else {
      break;
    }
  }

  // Fallback to standard base height
  if (maxV === 0) maxV = 82;

  const rot = parseFloat(document.getElementById('pos-r').value) || 0;

  openInputModal(`Dužina ${tip} (cm):`, totalLen || 60, (val) => {
    const finalLen = parseFloat(val) || totalLen || 60;
    const x0 = startX !== null ? startX : (parseFloat(document.getElementById('pos-x').value) || 0);
    const y0 = parseFloat(document.getElementById('pos-y').value) || 0;
    const z0 = parseFloat(document.getElementById('pos-z').value) || 0;

    let p, pos;
    if (tip === 'radna_ploca') {
      const offY = rot === 0 ? -60 : 0;
      const offX = rot === 90 ? 60 : 0;
      p = { l: String(finalLen), d: '60', debljina: '3.8' };
      // Place the worktop ON TOP of the cabinets
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
      const group = buildKitchenModule(
        entry.ime, entry.p, state.materials, state.settings,
        pos[0], pos[1], pos[2], rot
      );
      addModuleGroup(idx, group);
    } catch (e) {
      console.error('3D build failed for', entry.ime, e);
    }
    renderPlanList();
    showNotification(`Dodano: ${tip} L=${finalLen}`, 'success');
  });
}

function addRadnaPlocaToModule(idx) {
  const target = state.plan[idx];
  if (!target || target.ime === 'radna_ploca' || target.ime === 'cokla') return;

  if (!state.radnaPlocaSelection) state.radnaPlocaSelection = [];

  if (state.radnaPlocaSelection.length === 0) {
    state.radnaPlocaSelection.push(idx);
    import('./viewer.js').then(v => v.highlightModule(idx));
    if (isCornerElement(target)) {
      showNotification('Ugaoni element odabran. Dvoklikni isti element ponovo za bočnu ploču uz zid — ili dvoklikni element na glavnom zidu za radnu ploču do ugla.', 'info');
    } else {
      showNotification('Odabran početni element. Dvoklikni na završni element.', 'info');
    }
  } else {
    // Second element
    const idxA = state.radnaPlocaSelection[0];
    const idxB = idx;

    state.radnaPlocaSelection = [];
    state.addingRadnaPloca = false;
    const btnRadna = document.getElementById('btn-radna');
    if (btnRadna) {
      btnRadna.style.backgroundColor = '';
      btnRadna.style.color = '';
    }
    import('./viewer.js').then(v => v.highlightModule(-1));

    createSpanningRadnaPloca(idxA, idxB);
  }
}

const CORNER_ELEMENT_NAMES = new Set([
  'dug_element_90', 'dug_element_90_gola',
  'donji_ugaoni_element_45_sa_plocom', 'donji_ugaoni_element_45_sa_plocom_gola'
]);

function isCornerElement(entry) {
  return CORNER_ELEMENT_NAMES.has(entry.ime);
}

function createSpanningRadnaPloca(idxA, idxB) {
  const tA = state.plan[idxA];
  const tB = state.plan[idxB];

  const aIsCorner = isCornerElement(tA);
  const bIsCorner = isCornerElement(tB);

  // If a corner element is involved, use the split-countertop logic
  if (aIsCorner || bIsCorner) {
    createCornerRadnaPloca(idxA, idxB, aIsCorner ? idxA : idxB);
    return;
  }

  if (tA.r !== tB.r && idxA !== idxB) {
    showNotification('Elementi moraju biti na istom zidu (isti ugao)!', 'error');
    return;
  }

  const wA = parseFloat(tA.p.s || tA.p.l || tA.p.dss || tA.sirina || 60);
  const wB = parseFloat(tB.p.s || tB.p.l || tB.p.dss || tB.sirina || 60);
  const hA = parseFloat(tA.p.v || tA.p.h || 82);
  const hB = parseFloat(tB.p.v || tB.p.h || 82);
  const maxH = Math.max(hA, hB);
  let startElement, endElement, endW, finalL;

  if (idxA === idxB) {
    startElement = tA;
    finalL = wA;
  } else {
    const dx = tB.pos[0] - tA.pos[0];
    const dy = tB.pos[1] - tA.pos[1];
    const rad = tA.r * Math.PI / 180;
    // Project direction vector using the rotation to see which element comes first sequentially
    const proj = dx * Math.cos(rad) + dy * Math.sin(rad);

    if (proj >= -0.01) {
      startElement = tA;
      endElement = tB;
      endW = wB;
    } else {
      startElement = tB;
      endElement = tA;
      endW = wA;
    }

    const dist = Math.hypot(dx, dy);
    finalL = dist + endW;
  }

  const p = { l: String(finalL), d: '60', debljina: '3.8' };
  const pos = [startElement.pos[0], startElement.pos[1], startElement.pos[2] + maxH];

  const entry = { ime: 'radna_ploca', p, pos, r: startElement.r };
  state.plan.push(entry);
  const newIdx = state.plan.length - 1;

  try {
    const group = buildKitchenModule(
      'radna_ploca', entry.p, state.materials, state.settings,
      pos[0], pos[1], pos[2], entry.r
    );
    addModuleGroup(newIdx, group);
  } catch (e) {
    console.error('3D build failed for', entry.ime, e);
  }

  renderPlanList();
  showNotification(`Radna ploča dodana (L=${Math.round(finalL)}cm)!`, 'success');
}

/**
 * Handles countertop creation when a corner element (dug_element_90) is involved.
 *
 * TWO INDEPENDENT OPERATIONS — the user runs these separately:
 *
 * A) Corner selected ALONE (idxA === idxB):
 *    → Wall-side piece: a normal straight countertop covering the lss arm of the corner
 *      cabinet (the arm going into the side wall). This is a plain slab l=lss, d=60
 *      placed at the corner origin and rotated 90° relative to the corner's own rotation
 *      so it runs along the side wall.
 *
 * B) Corner + another cabinet on the main wall:
 *    → Main-wall piece: runs from the other cabinet up to 60cm BEFORE the side wall
 *      (i.e. stops at the corner element's position in the primary-wall direction, not
 *      overlapping the side piece). The slab ends at the corner origin; the remaining
 *      60cm of depth is physically occupied by the side piece coming in from the side wall.
 */
function createCornerRadnaPloca(idxA, idxB, cornerIdx) {
  const cornerEl = state.plan[cornerIdx];
  const otherIdx = cornerIdx === idxA ? idxB : idxA;
  const otherEl = state.plan[otherIdx];

  const dss = parseFloat(cornerEl.p.dss || 80); // corner width along main wall (local +X)
  const lss = parseFloat(cornerEl.p.lss || 90); // corner width along side wall (local -Y)
  const hCorner = parseFloat(cornerEl.p.v || 82);
  const d = 60;
  const debljina = 3.8;

  let topZ = cornerEl.pos[2] + hCorner;
  if (otherIdx !== cornerIdx) {
    const hOther = parseFloat(otherEl.p.v || otherEl.p.h || 82);
    topZ = cornerEl.pos[2] + Math.max(hCorner, hOther);
  }

  // Confirmed coordinate system (from debug logs, corner at r=0, pos=[0,0,0]):
  //   dss arm runs in local +X = world (cosR, sinR)  → at r=0: world +X ✓
  //   lss arm runs in local -Y = world (sinR, -cosR) → at r=0: world -Y ✓
  //     (verified: side cabinet at [0,-150,0] which is world -Y from corner origin)
  //
  // Two non-overlapping slabs:
  //   MAIN-WALL slab: starts at corner origin [0,0], runs dss+otherCabinets in +X (local)
  //                   rotation = cornerEl.r, length = dist(corner→farCabinet) + farCabinetWidth
  //   SIDE-WALL slab: starts at corner origin, runs exactly lss in lss-direction
  //                   rotation = (cornerEl.r + 270) % 360  [so local +X aligns with lss direction]
  //                   length = lss  (covers the full lss footprint including corner square)
  //
  // The two slabs share the d×d corner square — that's fine because they butt up against
  // each other (main slab depth goes into wall, side slab depth goes into other wall).
  // No geometric overlap: they are on perpendicular walls.

  const normaliseR = r => ((r % 360) + 360) % 360;
  const cornerRad = cornerEl.r * Math.PI / 180;
  // lss direction (local -Y in world): (sinR, -cosR)
  // Verified at r=0: lssDir=(0,-1) → plan -Y ✓ (side cabinet was at y=-150)
  const lssDirX =  Math.sin(cornerRad);
  const lssDirY = -Math.cos(cornerRad);

  // Side slab position formula (verified at r=0, corner=[0,0], lss=90, d=60):
  //   r=270, pos=[0,-(d+len)], length=len → covers plan Y=-d..-(d+len)
  //   The main-wall slab owns the d×d corner square (plan X=0..d, Y=0..-d).
  //   Side slab always starts at Y=-d (skipping corner square) and extends further.
  // General: sidePosX/Y = cornerEl.pos + (d + len) * lssDir
  const sideR = normaliseR(cornerEl.r + 270);

  // Helper: build the side slab for a given length
  function makeSideSlab(len) {
    const px = cornerEl.pos[0] + (d + len) * lssDirX;
    const py = cornerEl.pos[1] + (d + len) * lssDirY;
    const entry = {
      ime: 'radna_ploca',
      p: { l: String(len), d: String(d), debljina: String(debljina) },
      pos: [px, py, topZ],
      r: sideR
    };
    state.plan.push(entry);
    try {
      const g = buildKitchenModule(
        'radna_ploca', entry.p, state.materials, state.settings,
        px, py, topZ, sideR
      );
      addModuleGroup(state.plan.length - 1, g);
    } catch (e) { console.error('3D build failed for side radna_ploca', e); }
    return len;
  }

  if (otherIdx === cornerIdx) {
    // ── Op A: Corner alone → side-wall piece covering lss arm (minus corner square) ──
    const sideLen = lss - d;
    if (sideLen <= 0) {
      showNotification('lss nije veći od d, bočna ploča ne može biti kreirana.', 'error');
      return;
    }
    makeSideSlab(sideLen);
    renderPlanList();
    showNotification(`Bočna radna ploča dodana (${Math.round(sideLen)}×${d}cm)`, 'success');

  } else {
    // ── Op B: Corner + other cabinet ─────────────────────────────────────────
    // Detect which wall otherEl is on by comparing its rotation to the corner:
    //   Main wall (dss direction): otherEl.r ≈ cornerEl.r
    //   Side wall (lss direction): otherEl.r ≈ (cornerEl.r + 270) % 360
    const rDiff = normaliseR(otherEl.r - cornerEl.r);
    const onMainWall = rDiff < 45 || rDiff > 315;
    const otherW = parseFloat(otherEl.p.s || otherEl.p.l || otherEl.p.dss || 60);
    const dx = otherEl.pos[0] - cornerEl.pos[0];
    const dy = otherEl.pos[1] - cornerEl.pos[1];
    const dist = Math.hypot(dx, dy);

    if (onMainWall) {
      // Main-wall slab: starts at corner origin, extends through all selected cabinets.
      // Length = dist(corner→otherEl) + otherW
      const mainL = dist + otherW;
      const entry = {
        ime: 'radna_ploca',
        p: { l: String(mainL), d: String(d), debljina: String(debljina) },
        pos: [cornerEl.pos[0], cornerEl.pos[1], topZ],
        r: cornerEl.r
      };
      state.plan.push(entry);
      try {
        const g = buildKitchenModule(
          'radna_ploca', entry.p, state.materials, state.settings,
          cornerEl.pos[0], cornerEl.pos[1], topZ, cornerEl.r
        );
        addModuleGroup(state.plan.length - 1, g);
      } catch (e) { console.error('3D build failed for main-wall radna_ploca', e); }

      renderPlanList();
      showNotification(`Radna ploča (glavni zid) dodana (L=${Math.round(mainL)}cm)`, 'success');

    } else {
      // Side-wall slab: starts after corner square (Y=-d), extends to far edge of selected cabinet.
      // At r=270, local+X = plan+Y, so a cabinet at pos[1]=-150 has its NEAR face at Y=-90
      // and its origin (far end in lss direction) at Y=-150. dist=150 already reaches the far end.
      // Slab length from Y=-d to Y=-dist = dist - d.
      const sideLen = dist - d;
      if (sideLen <= 0) {
        showNotification('Kabinet je preblizu ugaonom elementu.', 'error');
        return;
      }
      makeSideSlab(sideLen);
      renderPlanList();
      showNotification(`Radna ploča (bočni zid) dodana (L=${Math.round(sideLen)}cm)`, 'success');
    }
  }
}

function addCoklaToModule(idx) {
  const target = state.plan[idx];
  if (!target || target.ime === 'radna_ploca' || target.ime === 'cokla') return;

  if (!state.coklaSelection) state.coklaSelection = [];

  if (state.coklaSelection.length === 0) {
    state.coklaSelection.push(idx);
    import('./viewer.js').then(v => v.highlightModule(idx));
    showNotification('Odabran početni element. Dvoklikni na završni element.', 'info');
  } else {
    const idxA = state.coklaSelection[0];
    const idxB = idx;

    state.coklaSelection = [];
    state.addingCokla = false;
    const btnCokla = document.getElementById('btn-cokla');
    if (btnCokla) {
      btnCokla.style.backgroundColor = '';
      btnCokla.style.color = '';
    }
    import('./viewer.js').then(v => v.highlightModule(-1));

    createSpanningCokla(idxA, idxB);
  }
}

function createSpanningCokla(idxA, idxB) {
  const tA = state.plan[idxA];
  const tB = state.plan[idxB];

  if (tA.r !== tB.r && idxA !== idxB) {
    showNotification('Elementi moraju biti na istom zidu (isti ugao)!', 'error');
    return;
  }

  const wA = parseFloat(tA.p.s || tA.p.l || tA.p.dss || tA.sirina || 60);
  const wB = parseFloat(tB.p.s || tB.p.l || tB.p.dss || tB.sirina || 60);

  let startElement, endElement, endW, finalL;

  if (idxA === idxB) {
    startElement = tA;
    finalL = wA;
  } else {
    const dx = tB.pos[0] - tA.pos[0];
    const dy = tB.pos[1] - tA.pos[1];
    const rad = tA.r * Math.PI / 180;
    const proj = dx * Math.cos(rad) + dy * Math.sin(rad);

    if (proj >= -0.01) {
      startElement = tA;
      endElement = tB;
      endW = wB;
    } else {
      startElement = tB;
      endElement = tA;
      endW = wA;
    }

    const dist = Math.hypot(dx, dy);
    finalL = dist + endW;
  }

  const p = { l: String(finalL), h: '9.5', debljina: '1.8' };
  // Y=-46 pushed forward from wall, Z=0 on the floor
  const pos = [startElement.pos[0], -46, 0];

  const entry = { ime: 'cokla', p, pos, r: startElement.r };
  state.plan.push(entry);
  const newIdx = state.plan.length - 1;

  try {
    const group = buildKitchenModule(
      'cokla', entry.p, state.materials, state.settings,
      pos[0], pos[1], pos[2], entry.r
    );
    addModuleGroup(newIdx, group);
  } catch (e) {
    console.error('3D build failed for', entry.ime, e);
  }

  renderPlanList();
  showNotification(`Cokla dodana (L=${Math.round(finalL)}cm)!`, 'success');
}

function deleteModule(idx) {
  if (idx < 0 || idx >= state.plan.length) return;
  const item = state.plan[idx];

  // Free grid cell
  if (item.mat_pos) {
    const key = `${item.mat_pos[0]},${item.mat_pos[1]}`;
    delete state.occupiedCells[key];
  }

  state.plan.splice(idx, 1);
  removeModuleGroup(idx);

  // Remap remaining group indices
  rebuildAllModules();

  state.selectedPlanIdx = -1;
  editingPlanIdx = -1;
  refreshParams();

  // If plan is now empty, reset
  if (state.plan.length === 0) {
    state.occupiedCells = {};
    setPos('x', 0);
    setPos('y', 0);
    setPos('z', 0);
    setPos('r', 0);
    selectCell(2, 1);
  }

  updateWallGridDisplay();
  renderPlanList();
  updateTotalCost();
}

function setSnapAnchorByIndex(idx) {
  // Build a minimal snapInfo from the module's bounding box center face
  // We use the module group directly — the normal will be the front face
  const group = getModuleGroup(idx);
  if (!group) return;
  group.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const info = { index: idx, normal: new THREE.Vector3(0, 0, -1), point: center };
  if (window._setSnapAnchor) window._setSnapAnchor(info);
}

function mirrorModule(idx) {
  if (idx < 0 || idx >= state.plan.length) return;
  const item = state.plan[idx];
  // True mirror of an L-shape: toggle between r and r±90°.
  // Origin = inner corner of the L, so position stays fixed.
  // 0↔90, 180↔270 — flips which arm goes which direction.
  item.r = (item.r % 180 === 0) ? (item.r + 90) % 360 : (item.r + 270) % 360;
  updateModule3D(idx);
  if (idx === state.selectedPlanIdx) setPos('r', item.r);
  renderPlanList();
  showNotification('Element zrcaljen', 'success');
}

function duplicateModule(idx) {
  if (idx < 0 || idx >= state.plan.length) return;
  const src = state.plan[idx];
  // Deep-copy the entry, offset position slightly so it's visible
  const copy = {
    ime: src.ime,
    p: { ...src.p },
    pos: [src.pos[0] + 10, src.pos[1], src.pos[2]],
    r: src.r
  };
  if (src.mat_pos) copy.mat_pos = [...src.mat_pos];
  state.plan.push(copy);
  const newIdx = state.plan.length - 1;
  try {
    const group = buildKitchenModule(
      copy.ime, copy.p, state.materials, state.settings,
      copy.pos[0], copy.pos[1], copy.pos[2], copy.r
    );
    addModuleGroup(newIdx, group);
  } catch (e) { console.error('3D build failed for duplicate', e); }
  selectModuleByIndex(newIdx);
  renderPlanList();
  showNotification('Element dupliciran', 'success');
}

function clearPlan() {
  if (state.plan.length === 0) return;
  if (!confirm('Obrisati sve module iz plana?')) return;
  state.plan = [];
  state.occupiedCells = {};
  state.selectedPlanIdx = -1;
  editingPlanIdx = -1;
  clearAllGroups();
  setPos('x', 0); setPos('y', 0); setPos('z', 0); setPos('r', 0);
  selectCell(2, 1);
  refreshParams();
  updateWallGridDisplay();
  renderPlanList();
  updateTotalCost();
  autoSave();
}

function rebuildAllModules() {
  clearAllGroups();
  state.plan.forEach((item, idx) => {
    try {
      const group = buildKitchenModule(
        item.ime, item.p, state.materials, state.settings,
        item.pos[0], item.pos[1], item.pos[2], item.r
      );
      addModuleGroup(idx, group);
    } catch (e) {
      console.error('3D rebuild failed for', item.ime, e);
    }
  });
}

// ─── Plan List Render ─────────────────────────────────────────────────────────
function updateModule3D(idx) {
  const item = state.plan[idx];
  const group = buildKitchenModule(
    item.ime, item.p, state.materials, state.settings,
    item.pos[0], item.pos[1], item.pos[2], item.r
  );
  removeModuleGroup(idx);
  addModuleGroup(idx, group);
}

function getModuleSize(item) {
  const p = item.p;
  let s = parseFloat(p.s || p.dss || p.sl || p.l || 60);
  let d = parseFloat(p.d || p.sd || 55);
  let v = parseFloat(p.v || 82);
  
  // Custom logic for corner L
  if (item.ime.includes('dug_element_90')) {
    s = parseFloat(p.dss);
    d = parseFloat(p.lss);
  }
  return { s, v, d };
}

function snapModuleToSide(srcIdx, anchorIdx, anchorInfo, sourceInfo) {
  try {
    const anchor = state.plan[anchorIdx];
    const source = state.plan[srcIdx];
    const groupA = getModuleGroup(anchorIdx);
    const groupS = getModuleGroup(srcIdx);
    if (!anchor || !source || !groupA || !groupS) return;

    // Ensure matrices are up to date
    groupA.updateWorldMatrix(true, true);
    groupS.updateWorldMatrix(true, true);

    const nA = anchorInfo.normal.clone();
    const nS = sourceInfo.normal.clone();

    // 1. Auto-Rotate Source Module if both clicked faces are vertical (sides, front, back)
    if (Math.abs(nA.y) < 0.5 && Math.abs(nS.y) < 0.5) {
      // Find angle of normals in XZ plane (Math.atan2(x, z))
      // We want nS to map exactly to -nA
      let angleTarget = Math.atan2(-nA.x, -nA.z);
      let angleSource = Math.atan2(nS.x, nS.z);
      let deltaRad = angleTarget - angleSource;
      
      // Calculate rotation offset in degrees and snap to nearest 90
      let deltaDeg = Math.round((-deltaRad * 180 / Math.PI) / 90) * 90;
      
      source.r = (source.r + deltaDeg) % 360;
      if (source.r < 0) source.r += 360;
      
      // Force update the 3D object's rotation matrix manually to ensure Box3 reads the new rotation
      groupS.rotation.set(0, -source.r * (Math.PI / 180), 0);
      groupS.updateMatrixWorld(true);
    }

    // 2. Exact Bounding Box Face Translation
    const boxA = new THREE.Box3().setFromObject(groupA);
    const boxS = new THREE.Box3().setFromObject(groupS);
    
    // Identify the shift needed to align the appropriate edges
    let shiftX = 0, shiftY = 0, shiftZ = 0;
    
    if (nA.x > 0.5) shiftX = boxA.max.x - boxS.min.x;       // Anchor Right
    else if (nA.x < -0.5) shiftX = boxA.min.x - boxS.max.x; // Anchor Left
    else if (nA.y > 0.5) shiftY = boxA.max.y - boxS.min.y;  // Anchor Top
    else if (nA.y < -0.5) shiftY = boxA.min.y - boxS.max.y; // Anchor Bottom
    else if (nA.z > 0.5) shiftZ = boxA.max.z - boxS.min.z;  // Anchor Back
    else if (nA.z < -0.5) shiftZ = boxA.min.z - boxS.max.z; // Anchor Front

    // Translate UI coordinates directly
    let nx = source.pos[0] + shiftX;
    let ny = source.pos[1] - shiftZ; // Three Z maps inversely to UI Y
    let nz = source.pos[2] + shiftY; // Three Y maps directly to UI Z

    // 3. Smart Flush: Perfectly align the perpendicular axes to the anchor module origins
    if (Math.abs(nA.x) > 0.5) {
      // Snapped left/right: Flush BACK (wall) and BOTTOM (floor)
      let flush_shiftZ = boxA.max.z - boxS.max.z; 
      ny = source.pos[1] - flush_shiftZ; 
      let flush_shiftY = boxA.min.y - boxS.min.y;
      nz = source.pos[2] + flush_shiftY;
    } else if (Math.abs(nA.y) > 0.5) {
      // Snapped top/bottom: Flush sides and BACK (wall)
      let flush_shiftX = boxA.min.x - boxS.min.x;
      nx = source.pos[0] + flush_shiftX;
      let flush_shiftZ = boxA.max.z - boxS.max.z;
      ny = source.pos[1] - flush_shiftZ;
    } else if (Math.abs(nA.z) > 0.5) {
      // Snapped front/back: Flush sides and bottom
      let flush_shiftX = boxA.min.x - boxS.min.x;
      nx = source.pos[0] + flush_shiftX;
      let flush_shiftY = boxA.min.y - boxS.min.y;
      nz = source.pos[2] + flush_shiftY;
    }

    // Ensure values are cleanly rounded to 1 decimal place to prevent drift
    source.pos = [
      Math.round(nx * 10) / 10,
      Math.round(ny * 10) / 10,
      Math.round(nz * 10) / 10
    ];

    updateModule3D(srcIdx);
    
    if (srcIdx === state.selectedPlanIdx) {
      setPos('x', source.pos[0]);
      setPos('y', source.pos[1]);
      setPos('z', source.pos[2]);
      setPos('r', source.r);
    }
    
    renderPlanList();
    showNotification("Elementi precizno spojeni!", "success");
  } catch (err) {
    console.error("Snapping error:", err);
    showNotification("Greška pri spajanju elemenata.", "error");
  }
}

function selectModuleByIndex(idx) {
  if (idx < 0 || idx >= state.plan.length) return;
  const item = state.plan[idx];
  state.selectedPlanIdx = idx;
  highlightModule(idx);

  // Sync the position inputs to the selected module
  setPos('x', item.pos[0]);
  setPos('y', item.pos[1]);
  setPos('z', item.pos[2]);
  setPos('r', item.r);

  // Populate params panel with this item's current values for live editing
  refreshParamsForPlanItem(idx);

  renderPlanList();
}

const PLAN_ICONS = {
  radni_stol: '🚪', fiokar: '🗄', gola_radni_stol: '📦',
  fiokar_gola: '🗄', vrata_sudo_masine: '🚿', radni_stol_rerne: '🔥',
  radni_stol_rerne_gola: '🔥', sporet: '🍳', samostojeci_frizider: '❄',
  dug_element_90: '↩', dug_element_90_gola: '↩',
  donji_ugaoni_element_45_sa_plocom: '◣', donji_ugaoni_element_45_sa_plocom_gola: '◣',
  klasicna_viseca: '🗄', klasicna_viseca_gola: '🗄', gue90: '↩',
  viseca_na_kipu: '⬆', viseca_na_kipu_gola: '⬆',
  radna_ploca: '📐', cokla: '⬜', ormar_visoki: '🚪'
};

function renderPlanList() {
  const list = document.getElementById('plan-list');
  const count = document.getElementById('plan-count');

  list.innerHTML = '';
  count.textContent = `${state.plan.length} el.`;

  if (state.plan.length === 0) {
    list.innerHTML = '<div class="plan-empty">Dodaj module u plan</div>';
    return;
  }

  state.plan.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = 'plan-item' + (idx === state.selectedPlanIdx ? ' selected' : '');

    const icon = document.createElement('span');
    icon.className = 'plan-item-icon';
    icon.textContent = PLAN_ICONS[item.ime] || '📦';

    const info = document.createElement('div');
    info.className = 'plan-item-info';

    const name = document.createElement('div');
    name.className = 'plan-item-name';
    name.textContent = `[${idx + 1}] ${item.ime.replace(/_/g, ' ')}`;

    const meta = document.createElement('div');
    meta.className = 'plan-item-meta';
    const sVal = item.p.s || item.p.l || item.p.dss || item.p.sl || '—';
    meta.textContent = `X:${item.pos[0]} Z:${item.pos[2]} s:${sVal}cm R:${item.r}°`;

    info.appendChild(name);
    info.appendChild(meta);
    el.appendChild(icon);
    el.appendChild(info);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'plan-item-delete';
    deleteBtn.innerHTML = '🗑';
    deleteBtn.title = 'Obriši';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteModule(idx);
    });
    el.appendChild(deleteBtn);

    el.addEventListener('click', () => {
      selectModuleByIndex(idx);
    });

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      selectModuleByIndex(idx);
      showCtxMenu(e.clientX, e.clientY, idx);
    });

    list.appendChild(el);
  });

  updateTotalCost();
  autoSave();
}

// ─── Material Picker Modal ────────────────────────────────────────────────────
function initMaterialPickerModal() {
  // Build color chips
  const colGrid = document.getElementById('mat-colors');
  COLOR_PRESETS.forEach(cp => {
    const chip = document.createElement('div');
    chip.className = 'mat-chip';
    chip.dataset.name = cp.name;
    chip.dataset.color = cp.hex;
    chip.dataset.type = 'color';
    chip.style.backgroundColor = cp.hex;
    chip.style.aspectRatio = '1';
    chip.style.minHeight = '40px';

    const lbl = document.createElement('div');
    lbl.className = 'mat-chip-label';
    lbl.textContent = cp.label;
    chip.appendChild(lbl);

    chip.addEventListener('click', () => {
      pendingMatSel = { name: cp.name, color: cp.hex, type: 'color' };
      document.querySelectorAll('.mat-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      updateMatPreview();
    });

    colGrid.appendChild(chip);
  });

  // Build texture chips
  const texGrid = document.getElementById('mat-textures');
  TEXTURE_PRESETS.forEach(tp => {
    const chip = document.createElement('div');
    chip.className = 'mat-chip';
    chip.dataset.name = tp.name;
    chip.dataset.type = 'texture';
    chip.style.background = `linear-gradient(135deg, ${tp.base} 0%, ${tp.grain} 100%)`;
    chip.style.minHeight = '48px';

    const lbl = document.createElement('div');
    lbl.className = 'mat-chip-label';
    lbl.textContent = tp.label;
    chip.appendChild(lbl);

    chip.addEventListener('click', () => {
      pendingMatSel = { name: tp.label, color: tp.base, textureName: tp.name, type: 'texture' };
      document.querySelectorAll('.mat-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      updateMatPreview();
    });

    texGrid.appendChild(chip);
  });

  // Custom color input
  document.getElementById('mat-custom-color').addEventListener('input', e => {
    const hex = e.target.value;
    pendingMatSel = { name: 'Custom', color: hex, type: 'color' };
    document.querySelectorAll('.mat-chip').forEach(c => c.classList.remove('selected'));
    updateMatPreview();
  });

  document.getElementById('modal-mat-ok').addEventListener('click', () => {
    if (pendingMatSel && state.matPickerTarget) {
      state.materials[state.matPickerTarget] = { ...pendingMatSel };
      refreshMaterialSwatches();
      rebuildAllModules();
    }
    document.getElementById('modal-material').classList.add('hidden');
  });

  const close = () => document.getElementById('modal-material').classList.add('hidden');
  document.getElementById('modal-mat-close').addEventListener('click', close);
  document.getElementById('modal-mat-cancel').addEventListener('click', close);
  document.querySelector('#modal-material .modal-backdrop').addEventListener('click', close);
}

function openMaterialPicker(key) {
  state.matPickerTarget = key;
  pendingMatSel = { ...state.materials[key] };

  // Update title
  document.getElementById('modal-mat-title').textContent =
    `Materijal — ${MAT_LABELS[key]}`;

  // Highlight current selection
  document.querySelectorAll('.mat-chip').forEach(c => c.classList.remove('selected'));
  const curName = state.materials[key].textureName || state.materials[key].name;
  document.querySelectorAll(`.mat-chip[data-name="${curName}"]`).forEach(c => c.classList.add('selected'));

  updateMatPreview();
  document.getElementById('modal-material').classList.remove('hidden');
}

function updateMatPreview() {
  if (!pendingMatSel) return;
  const swatch = document.getElementById('mat-preview-swatch');
  const label = document.getElementById('mat-preview-label');
  if (pendingMatSel.type === 'texture' && pendingMatSel.textureName) {
    const tp = TEXTURE_PRESETS.find(t => t.name === pendingMatSel.textureName);
    swatch.style.background = tp ? `linear-gradient(135deg, ${tp.base} 0%, ${tp.grain} 100%)` : '#888';
  } else {
    swatch.style.backgroundColor = pendingMatSel.color;
    swatch.style.background = pendingMatSel.color;
  }
  label.textContent = pendingMatSel.name;
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

function openInputModal(label, defaultVal, callback) {
  document.getElementById('modal-input-label').textContent = label;
  document.getElementById('modal-input-val').value = defaultVal;
  document.getElementById('modal-input').classList.remove('hidden');
  document.getElementById('modal-input-val').focus();
  document.getElementById('modal-input-val').select();
  _inputModalResolve = callback;
}

// ─── Krojna Lista Modal ───────────────────────────────────────────────────────
function initKrojnaModal() {
  const close = () => document.getElementById('modal-krojna').classList.add('hidden');
  document.getElementById('modal-krojna-close').addEventListener('click', close);
  document.getElementById('btn-modal-close').addEventListener('click', close);
  document.querySelector('#modal-krojna .modal-backdrop').addEventListener('click', close);
  document.getElementById('btn-export-krojna-csv').addEventListener('click', exportOptimik);

  const toggle = document.getElementById('krojna-simplified-toggle');
  if (toggle) {
    toggle.checked = state.simplifiedKrojna;
    toggle.addEventListener('change', e => {
      state.simplifiedKrojna = e.target.checked;
      showKrojnaLista();
    });
  }
  const perModuleToggle = document.getElementById('krojna-per-module-toggle');
  if (perModuleToggle) {
    perModuleToggle.checked = state.perModuleKrojna;
    perModuleToggle.addEventListener('change', e => {
      state.perModuleKrojna = e.target.checked;
      showKrojnaLista();
    });
  }
}

function showKrojnaLista() {
  if (state.plan.length === 0) {
    showNotification('Plan je prazan!', 'warning');
    return;
  }

  const wrap = document.getElementById('krojna-table-wrap');
  const simple = state.simplifiedKrojna;
  const perModule = state.perModuleKrojna;
  let html = '';

  if (perModule) {
    const modules = computeCuttingListByModule(state.plan);
    html = `<div class="krojna-by-module">`;
    
    modules.forEach(m => {
      if (m.panels.length === 0) return;
      
      html += `<div class="krojna-by-module-item">
        <div class="krojna-by-module-header">
           <span>[${m.index}] ${m.moduleName.replace(/_/g, ' ').toUpperCase()}</span>
           <span style="opacity:0.8;">${m.panels.length} elemenata</span>
        </div>
        <table class="krojna-table" style="border:none;">
          <thead><tr>
            <th>Naziv</th>
            ${simple ? '<th>Dimenzije (cm)</th>' : '<th>Dimenzije (mm)</th>'}
            <th style="text-align:center">Kom.</th>
            <th>Materijal</th>
            <th>Code</th>
          </tr></thead><tbody>`;
      
      m.panels.forEach(r => {
        html += `<tr>
          <td>${r.name}</td>
          <td>${simple ? `${(r.L / 10).toFixed(1)} × ${(r.W / 10).toFixed(1)}` : `${r.L} × ${r.W}`}</td>
          <td style="text-align:center">${r.qty}</td>
          <td style="font-size:10px;">${r.material}</td>
          <td style="color:var(--text-secondary); font-size:9px;">${r.kant || ''}</td>
        </tr>`;
      });
      
      html += `</tbody></table></div>`;
    });
    html += `</div>`;
  } else {
    const list = computeCuttingList(state.plan);
    // Group by material
    const groups = {};
    list.forEach(row => {
      if (!groups[row.material]) groups[row.material] = [];
      groups[row.material].push(row);
    });

    html = `<table class="krojna-table">
      <thead><tr>
        <th>Naziv</th>
        ${simple ? '<th>Dimenzije (cm)</th>' : '<th>Dimenzije (mm)</th>'}
        <th style="text-align:center">Kom.</th>
        ${simple ? '' : '<th>Površina (m²)</th><th>Mat (€)</th><th>Kant (€)</th><th>Ukupno (€)</th>'}
        <th>Code</th>
      </tr></thead><tbody>`;

    let totalGrand = 0;
    let totalGrandKant = 0;
    let totalGrandMat = 0;

    for (const [mat, rows] of Object.entries(groups)) {
      const pSqm = getPriceForMaterial(mat);
      const colCount = simple ? 4 : 8;
      html += `<tr class="group-row"><td colspan="${colCount}">▸ ${mat} ${simple ? '' : `(${pSqm.toFixed(2)} €/m²)`}</td></tr>`;

      let groupArea = 0;
      let groupCost = 0;
      let groupKantCost = 0;
      let groupMatCost = 0;

      rows.forEach(r => {
        const area = (r.L * r.W) / 1000000 * r.qty;
        const costMat = area * pSqm;

        const k = calcKant(r.kant, r.L, r.W);
        const costKant = (k.k * state.prices.kant_k + k.K * state.prices.kant_K) * r.qty;
        const costTotal = costMat + costKant;

        groupArea += area;
        groupMatCost += costMat;
        groupKantCost += costKant;
        groupCost += costTotal;

        totalGrandMat += costMat;
        totalGrandKant += costKant;
        totalGrand += costTotal;

        if (simple) {
          html += `<tr>
            <td>${r.name}</td>
            <td>${(r.L / 10).toFixed(1)} × ${(r.W / 10).toFixed(1)}</td>
            <td style="text-align:center">${r.qty}</td>
            <td style="color:var(--text-secondary); font-size:9px;">${r.kant || ''}</td>
          </tr>`;
        } else {
          html += `<tr>
            <td>${r.name}</td>
            <td>${r.L} × ${r.W}</td>
            <td style="text-align:center">${r.qty}</td>
            <td>${area.toFixed(3)}</td>
            <td>${costMat.toFixed(2)}</td>
            <td style="color:var(--accent)">${costKant.toFixed(2)}</td>
            <td style="color:var(--green); font-weight:700;">${costTotal.toFixed(2)}</td>
            <td style="color:var(--text-secondary); font-size:9px;">${r.kant || ''}</td>
          </tr>`;
        }
      });

      if (!simple) {
        html += `<tr style="background:rgba(79,122,255,0.05); font-weight:700;">
          <td colspan="4" style="text-align:right">UKUPNO ZA ${mat}:</td>
          <td>${groupMatCost.toFixed(2)} €</td>
          <td style="color:var(--accent)">${groupKantCost.toFixed(2)} €</td>
          <td colspan="2" style="color:var(--green)">${groupCost.toFixed(2)} €</td>
        </tr>`;
      }
    }

    html += '</tbody></table>';

    // Summary
    const totalPcs = list.reduce((s, r) => s + r.qty, 0);
    if (!simple) {
      html += `<div style="margin-top:12px;padding:12px;background:var(--bg-panel);border:1px solid var(--accent);border-radius:12px;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:11px;color:var(--text-secondary); line-height:1.4;">
          <strong style="color:var(--accent)">Ukupno stavki: ${list.length}</strong> · Komada: ${totalPcs}<br>
          Materijal: <strong>${totalGrandMat.toFixed(2)} €</strong> · 
          <span style="color:var(--accent)">Kantovanje: <strong>${totalGrandKant.toFixed(2)} €</strong></span>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px; color:var(--text-secondary); margin-bottom:2px; font-weight:700; letter-spacing:1px;">UKUPNA VRIJEDNOST</div>
          <div style="font-size:24px; font-weight:900; color:var(--green);">${totalGrand.toFixed(2)} €</div>
          <div style="font-size:12px; font-weight:600; color:var(--text-secondary); opacity:0.7;">${(totalGrand * 117).toLocaleString('sr-RS')} RSD</div>
        </div>
      </div>`;
    } else {
      html += `<div style="margin-top:8px; font-size:10px; color:var(--text-dim); text-align:right;">
         Ukupno komada: ${totalPcs}
       </div>`;
    }
  }

  wrap.innerHTML = html;
  document.getElementById('modal-krojna').classList.remove('hidden');
}

// ─── Export ───────────────────────────────────────────────────────────────────
async function exportOptimik() {
  if (state.plan.length === 0) { showNotification('Plan je prazan!', 'warning'); return; }
  const list = computeCuttingList(state.plan);
  const csv = toCsvString(list);
  const name = state.clientName.replace(/\s+/g, '_');
  const res = await window.electronAPI?.saveFile({
    filename: `Optimik_${name}.csv`,
    ext: 'csv', extName: 'CSV',
    content: csv, encoding: 'utf8'
  });
  if (res?.success) showNotification('CSV sačuvan!', 'success');
}

async function exportPdf() {
  if (state.plan.length === 0) { showNotification('Plan je prazan!', 'warning'); return; }
  try {
    const { jsPDF } = window.jspdf;

    // Theme-aware color palette
    const C = isDark ? {
      pageBg: [13, 13, 23],
      titleText: [230, 230, 240],
      subText: [130, 130, 170],
      sectionText: [79, 122, 255],
      rowFill: [18, 18, 36],
      rowText: [200, 200, 220],
      rowLine: [40, 40, 70],
      headFill: [30, 30, 60],
      headText: [130, 150, 255],
      altFill: [22, 22, 42],
      subtotalText: [255, 255, 255],
      totalText: [34, 197, 94],
    } : {
      pageBg: [248, 248, 252],
      titleText: [20, 20, 40],
      subText: [80, 80, 120],
      sectionText: [42, 91, 232],
      rowFill: [255, 255, 255],
      rowText: [30, 30, 50],
      rowLine: [200, 200, 220],
      headFill: [220, 225, 248],
      headText: [30, 60, 180],
      altFill: [242, 242, 252],
      subtotalText: [20, 20, 40],
      totalText: [22, 163, 74],
    };

    const list = computeCuttingList(state.plan);
    const name = state.clientName.replace(/\s+/g, '_');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'A4' });

    // Header background
    doc.setFillColor(...C.pageBg);
    doc.rect(0, 0, 297, 297, 'F');
    doc.setTextColor(...C.titleText);
    doc.setFontSize(18);
    doc.text(`MECO KONFIGURATOR — ${name.toUpperCase()}`, 15, 20);
    doc.setFontSize(10);
    doc.setTextColor(...C.subText);
    doc.text(`Krojna Lista — ${new Date().toLocaleDateString('bs-BA')}`, 15, 28);

    // 3D viewer screenshot
    const canvas = document.getElementById('three-canvas');
    const imgData = canvas.toDataURL('image/jpeg', 0.8);
    doc.addImage(imgData, 'JPEG', 15, 35, 120, 70);

    // Plan summary
    doc.setFontSize(11);
    doc.setTextColor(...C.sectionText);
    doc.text('PLAN KUHINJE:', 145, 40);
    doc.setTextColor(...C.rowText);
    doc.setFontSize(9);
    state.plan.forEach((item, i) => {
      if (i < 15) doc.text(`${i + 1}. ${item.ime}`, 145, 48 + i * 6);
    });

    // Table page
    doc.addPage();
    doc.setFillColor(...C.pageBg);
    doc.rect(0, 0, 297, 210, 'F');
    // Note: per-page background is handled by willDrawPage in each autoTable call

    const groups = {};
    list.forEach(r => {
      if (!groups[r.material]) groups[r.material] = [];
      groups[r.material].push(r);
    });

    let startY = 20;
    for (const [mat, rows] of Object.entries(groups)) {
      doc.setFontSize(11);
      doc.setTextColor(...C.sectionText);
      doc.text(`▸ ${mat}`, 15, startY);
      startY += 5;

      doc.autoTable({
        startY,
        head: [['Naziv', 'Dimenzije', 'Kom.', 'm²', 'Mat (€)', 'Kant (€)', 'Ukupno (€)', 'Code']],
        body: rows.map(r => {
          const area = (r.L * r.W) / 1000000 * r.qty;
          const k = calcKant(r.kant, r.L, r.W);
          const costKant = (k.k * state.prices.kant_k + k.K * state.prices.kant_K) * r.qty;
          const costMat = (area * getPriceForMaterial(mat));
          const cost = costMat + costKant;
          return [
            r.name,
            `${r.L}x${r.W}`,
            r.qty,
            area.toFixed(2),
            costMat.toFixed(2),
            costKant.toFixed(2),
            cost.toFixed(2) + ' €',
            r.kant || ''
          ];
        }),
        styles: {
          fontSize: 8, cellPadding: 2,
          fillColor: C.rowFill, textColor: C.rowText,
          lineColor: C.rowLine, lineWidth: 0.1
        },
        headStyles: { fillColor: C.headFill, textColor: C.headText, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: C.altFill },
        margin: { left: 15, right: 15 },
        willDrawPage: () => {
          doc.setFillColor(...C.pageBg);
          doc.rect(0, 0, 297, 210, 'F');
        }
      });

      startY = doc.lastAutoTable.finalY + 10;

      const matArea = rows.reduce((s, r) => s + (r.L * r.W / 1000000 * r.qty), 0);
      const matKantCost = rows.reduce((s, r) => {
        const k = calcKant(r.kant, r.L, r.W);
        return s + (k.k * state.prices.kant_k + k.K * state.prices.kant_K) * r.qty;
      }, 0);
      const matCost = (matArea * getPriceForMaterial(mat)) + matKantCost;
      doc.setFontSize(9);
      doc.setTextColor(...C.subtotalText);
      doc.text(`Ukupno za ${mat}: ${matArea.toFixed(2)} m² = ${matCost.toFixed(2)} € (${(matCost * 117).toLocaleString('sr-RS')} RSD)`, 15, startY - 5);

      if (startY > 260) { doc.addPage(); doc.setFillColor(...C.pageBg); doc.rect(0, 0, 297, 210, 'F'); startY = 20; }
    }

    // Grand total
    const list_full = computeCuttingList(state.plan);
    const grandTotalMat = list_full.reduce((s, r) => s + (r.L * r.W / 1000000 * r.qty * getPriceForMaterial(r.material)), 0);
    const grandTotalKant = list_full.reduce((s, r) => {
      const k = calcKant(r.kant, r.L, r.W);
      return s + (k.k * state.prices.kant_k + k.K * state.prices.kant_K) * r.qty;
    }, 0);
    const grandTotalEur = grandTotalMat + grandTotalKant;
    const grandTotalRsd = grandTotalEur * 117;

    doc.setFontSize(10);
    doc.setTextColor(...C.rowText);
    doc.text(`Materijal: ${grandTotalMat.toFixed(2)} € · Kantovanje: ${grandTotalKant.toFixed(2)} €`, 15, startY + 5);

    doc.setFontSize(14);
    doc.setTextColor(...C.totalText);
    doc.text(`UKUPNA VRIJEDNOST PONUDE: ${grandTotalEur.toFixed(2)} € (${grandTotalRsd.toLocaleString('sr-RS')} RSD)`, 15, startY + 15);

    const pdfData = doc.output('arraybuffer');
    const uint8 = new Uint8Array(pdfData);
    let binary = '';
    uint8.forEach(b => binary += String.fromCharCode(b));
    const b64 = btoa(binary);

    const res = await window.electronAPI?.saveFile({
      filename: `Ponuda_${name}.pdf`,
      ext: 'pdf', extName: 'PDF',
      content: b64, encoding: 'base64'
    });
    if (res?.success) showNotification('PDF sačuvan!', 'success');
  } catch (err) {
    console.error('PDF error:', err);
    showNotification('Greška pri generisanju PDF-a', 'error');
  }
}

// ─── Wall Fixtures Popover ────────────────────────────────────────────────────
function initFixtureModal() {
  const popover = document.getElementById('fixture-popover');
  const btnOpen = document.getElementById('btn-add-fixture');

  // Toggle popover on button click
  if (btnOpen && popover) {
    btnOpen.onclick = (e) => {
      e.stopPropagation();
      popover.classList.toggle('hidden');
      if (!popover.classList.contains('hidden')) renderFixtureList();
    };
    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && !btnOpen.contains(e.target)) {
        popover.classList.add('hidden');
      }
    });
  }

  const typeSel = document.getElementById('fixture-type-select');
  const dimsRow = document.getElementById('fixture-dims-row');

  // Populate select
  if (typeSel) {
    typeSel.innerHTML = FIXTURE_TYPES.map(t => `<option value="${t.id}">${t.icon} ${t.label}</option>`).join('');

    // Toggle dimension inputs based on type
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
    showNotification(`Dodan ${fixture.label}`, 'success');
  });
}

function renderFixtureList() {
  const wrap = document.getElementById('fixture-list-wrap');
  if (!wrap) return;

  if (state.wallFixtures.length === 0) {
    wrap.innerHTML = '<div style="font-size:11px; color:var(--text-dim); text-align:center; padding:10px; margin-top:10px; border:1px dashed var(--border); border-radius:8px;">Nema dodanih elemenata</div>';
    return;
  }

  let html = '<div style="margin-top:10px; max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:8px; background:rgba(0,0,0,0.2);">';
  state.wallFixtures.forEach((f, idx) => {
    const typeDef = FIXTURE_TYPES.find(t => t.id === f.type);
    const sizeStr = (f.width && f.height) ? ` (${f.width}×${f.height})` : '';
    html += `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid var(--border); font-size:11px;">
        <div style="display:flex; align-items:center; gap:8px;">
           <span style="font-size:14px;">${typeDef ? typeDef.icon : '📍'}</span>
           <div>
             <div style="font-weight:600; color:var(--text-primary);">${f.label}${sizeStr}</div>
             <div style="font-size:10px; color:var(--text-secondary); opacity:0.7;">X:${f.x} Y:${f.y} cm</div>
           </div>
        </div>
        <button class="btn btn-icon" style="color:var(--red); font-size:14px;" onclick="removeFixture(${idx})">×</button>
      </div>`;
  });
  html += '</div>';
  wrap.innerHTML = html;
}

// Global expose for onclick
window.removeFixture = (idx) => {
  state.wallFixtures.splice(idx, 1);
  removeFixtureMarker(idx);
  // Re-index remaining markers
  clearFixtureMarkers();
  state.wallFixtures.forEach((f, i) => addFixtureMarker(i, f));
  renderFixtureList();
};

// ─── Notification Toast ───────────────────────────────────────────────────────
function showNotification(msg, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background: ${type === 'success' ? 'var(--green)' : type === 'warning' ? 'var(--amber)' : type === 'error' ? 'var(--red)' : 'var(--accent)'};
    color: ${type === 'warning' ? '#000' : '#fff'};
    padding: 10px 22px; border-radius: 99px; font-size: 12px; font-weight: 600;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    z-index: 9999; animation: fadeIn 0.2s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

