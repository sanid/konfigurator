/**
 * app.js — Main renderer process logic
 * Meco Konfigurator 2026 — Electron/JSCAD Edition
 */

import {
  MODULE_GROUPS, DEFAULT_MATERIALS, DEFAULT_SETTINGS,
  COLOR_PRESETS, TEXTURE_PRESETS
} from './modules-config.js';
import { buildKitchenModule } from './kitchen-builder.js';
import { initViewer, addModuleGroup, removeModuleGroup, clearAllGroups, setCameraView, resetCamera, highlightModule, resizeViewer, setViewerTheme, addFixtureMarker, removeFixtureMarker, clearFixtureMarkers } from './viewer.js';
import { computeCuttingList, toCsvString } from './cutting-list.js';

// ─── Wall Fixture Types ───────────────────────────────────────────────────────
const FIXTURE_TYPES = [
  { id: 'water',    label: 'Vodovod',          icon: '💧', color: 0x2196f3 },
  { id: 'drain',    label: 'Kanalizacija',      icon: '🔩', color: 0x795548 },
  { id: 'power',    label: 'Struja (utičnica)', icon: '⚡', color: 0xffc107 },
  { id: 'gas',      label: 'Gas',               icon: '🔥', color: 0xff5722 },
  { id: 'window',   label: 'Prozor',            icon: '🪟', color: 0x90caf9 },
  { id: 'door',     label: 'Vrata',             icon: '🚪', color: 0xa1887f },
  { id: 'column',   label: 'Stub',              icon: '⬛', color: 0x9e9e9e },
  { id: 'other',    label: 'Ostalo',            icon: '📍', color: 0xce93d8 },
];

// Material slot labels
const MAT_LABELS = {
  front:  'Front',
  korpus: 'Korpus',
  radna:  'Radna pl.',
  granc:  'Granc',
  cokla:  'Cokla'
};

// Parameter human-readable abbreviations
const PARAM_LABELS = {
  s:     'Širina',
  v:     'Visina',
  d:     'Dubina',
  c:     'Cokla',
  brvr:  'Broj vrata',
  brp:   'Broj polica',
  brf:   'Broj fioka',
  brfp:  'Plitke fioke',
  brfd:  'Duboke fioke',
  brv:   'Broj vrata',
  rerna: 'Širina rerne',
  dss:   'Širina desno',
  lss:   'Širina lijevo',
  sl:    'Širina lijevo',
  sd:    'Širina desno',
  ss:    'Širina stuba',
  ds:    'Dubina stuba',
  vs:    'Visina stuba'
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
  wallFixtures: []   // Array of { type, x, y, label }  — x/y in cm from origin
};

// Material picker pending selection
let pendingMatSel = null;

// Theme state — shared across toggle and exportPdf
let isDark = true;

// Whether the params panel is currently editing a plan item (vs. a fresh module)
let editingPlanIdx = -1;

// ═══════════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initTitlebarControls();
  initViewer(document.getElementById('three-canvas'));
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
  selectCell(2, 1);
  window.addEventListener('resize', resizeViewer);
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
      else      len_k += (sideLen / 1000) * qty;
    }
  });
  
  return { k: len_k, K: len_K };
}

function getPriceForMaterial(materialName) {
  const matUpper = materialName.toUpperCase();
  if (matUpper.includes('UNIVER')) return state.prices.univer;
  if (matUpper.includes('MDF'))    return state.prices.mdf;
  if (matUpper.includes('HDF'))    return state.prices.hdf;
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
  document.getElementById('btn-close').onclick    = () => window.electronAPI?.close();

  const themeBtn = document.getElementById('btn-theme');
  themeBtn.addEventListener('click', () => {
    isDark = !isDark;
    if (isDark) {
      document.body.classList.remove('light');
      themeBtn.textContent = '🌙 Dark';
      setViewerTheme('dark');
    } else {
      document.body.classList.add('light');
      themeBtn.textContent = '☀️ Light';
      setViewerTheme('light');
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

  // Tall cabinet next to pillar: box + pillar notch top-right
  'radni_stol_pored_stuba': `
    <rect x="2" y="2" width="17" height="20" rx="1"/>
    <rect x="17" y="2" width="5" height="12" rx=".5" opacity=".3"/>
    <line x1="2"  y1="8"  x2="19" y2="8"/>
    <line x1="2"  y1="14" x2="19" y2="14"/>
    <circle cx="10.5" cy="11" r="1"/>
    <circle cx="10.5" cy="17" r="1"/>`,

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
      if (e.key === 'ArrowUp'   && idx > 0)               { rows[idx - 1].focus(); e.preventDefault(); }
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
      if (e.key === 'ArrowUp'   && idx > 0)               { rows[idx - 1].focus(); e.preventDefault(); }
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
  { label: 'Z=82',  z: 82,  row: 1 },
  { label: 'Z=0',   z: 0,   row: 2 }
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
}

// ─── Materials Panel ──────────────────────────────────────────────────────────
function initMaterialsPanel() {
  const grid = document.getElementById('materials-grid');
  grid.innerHTML = '';

  for (const [key, label] of Object.entries(MAT_LABELS)) {
    const row = document.createElement('div');
    row.className = 'mat-row';
    row.dataset.matKey = key;

    const lbl = document.createElement('span');
    lbl.className = 'mat-row-label';
    lbl.textContent = label;

    const swatch = document.createElement('div');
    swatch.className = 'mat-swatch';
    swatch.id = `swatch-${key}`;

    const name = document.createElement('span');
    name.className = 'mat-name';
    name.id = `matname-${key}`;

    row.appendChild(lbl);
    row.appendChild(swatch);
    row.appendChild(name);

    row.addEventListener('click', () => openMaterialPicker(key));
    grid.appendChild(row);
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
  polica:      'Police',
  pozadina:    'Pozadina',
  celafioka:   'Čela fioka',
  fioke:       'Fioke',
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
        if (axis === 'x') item.pos[0] = val;
        if (axis === 'y') item.pos[1] = val;
        if (axis === 'z') item.pos[2] = val;
        if (axis === 'r') item.r = val;
        
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
  document.getElementById('btn-delete').addEventListener('click', deleteSelected);
  document.getElementById('btn-krojna').addEventListener('click', showKrojnaLista);
  document.getElementById('btn-optimik').addEventListener('click', exportOptimik);
  document.getElementById('btn-pdf').addEventListener('click', exportPdf);

  // Wall grid special buttons
  document.getElementById('btn-radna').addEventListener('click', () => addSpecialElement('radna_ploca'));
  document.getElementById('btn-cokla').addEventListener('click',  () => addSpecialElement('cokla'));

  // Viewer buttons
  document.getElementById('btn-view-front').addEventListener('click', () => setCameraView('front'));
  document.getElementById('btn-view-iso').addEventListener('click', () => setCameraView('iso'));
  document.getElementById('btn-view-top').addEventListener('click', () => setCameraView('top'));
  document.getElementById('btn-reset-cam').addEventListener('click', resetCamera);

  document.addEventListener('keydown', e => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement.tagName !== 'INPUT') deleteSelected();
    }
  });
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

  let totalLen = 0, startX = null;
  for (let c = selCol; c <= WALL_COLS; c++) {
    const key = `${rowForCheck},${c}`;
    if (state.occupiedCells[key]) {
      const item = state.occupiedCells[key];
      const planItem = state.plan.find(m => m.mat_pos && m.mat_pos[0] === rowForCheck && m.mat_pos[1] === c);
      if (startX === null && planItem) startX = planItem.pos[0];
      totalLen += item.sirina;
    } else {
      break;
    }
  }

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
      pos = [x0 + offX, y0 + offY, z0];
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

function deleteSelected() {
  if (state.selectedPlanIdx < 0) return;
  const idx = state.selectedPlanIdx;
  const item = state.plan[idx];

  // Free grid cell
  if (item.mat_pos) {
    const key = `${item.mat_pos[0]},${item.mat_pos[1]}`;
    delete state.occupiedCells[key];
  }

  state.plan.splice(idx, 1);
  removeModuleGroup(idx);

  // Remap remaining group indices (shift down by 1 for all > idx)
  // Simple approach: rebuild all remaining groups from scratch
  rebuildAllModules();

  state.selectedPlanIdx = -1;
  editingPlanIdx = -1;
  refreshParams(); // restore normal params panel
  updateWallGridDisplay();
  renderPlanList();
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

    el.addEventListener('click', () => {
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
    });

    list.appendChild(el);
  });
  
  updateTotalCost();
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
}

function showKrojnaLista() {
  if (state.plan.length === 0) {
    showNotification('Plan je prazan!', 'warning');
    return;
  }

  const list = computeCuttingList(state.plan);
  const wrap = document.getElementById('krojna-table-wrap');
  const simple = state.simplifiedKrojna;

  // Group by material
  const groups = {};
  list.forEach(row => {
    if (!groups[row.material]) groups[row.material] = [];
    groups[row.material].push(row);
  });

  let html = `<table class="krojna-table">
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
          <td>${(r.L/10).toFixed(1)} × ${(r.W/10).toFixed(1)}</td>
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
  if (!simple) {
    const totalPcs = list.reduce((s, r) => s + r.qty, 0);
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
     const totalPcs = list.reduce((s, r) => s + r.qty, 0);
     html += `<div style="margin-top:8px; font-size:10px; color:var(--text-dim); text-align:right;">
       Ukupno komada: ${totalPcs}
     </div>`;
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
      pageBg:      [13,  13,  23],
      titleText:   [230, 230, 240],
      subText:     [130, 130, 170],
      sectionText: [79,  122, 255],
      rowFill:     [18,  18,  36],
      rowText:     [200, 200, 220],
      rowLine:     [40,  40,  70],
      headFill:    [30,  30,  60],
      headText:    [130, 150, 255],
      altFill:     [22,  22,  42],
      subtotalText:[255, 255, 255],
      totalText:   [34,  197, 94],
    } : {
      pageBg:      [248, 248, 252],
      titleText:   [20,  20,  40],
      subText:     [80,  80,  120],
      sectionText: [42,  91,  232],
      rowFill:     [255, 255, 255],
      rowText:     [30,  30,  50],
      rowLine:     [200, 200, 220],
      headFill:    [220, 225, 248],
      headText:    [30,  60,  180],
      altFill:     [242, 242, 252],
      subtotalText:[20,  20,  40],
      totalText:   [22,  163, 74],
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
      if (i < 15) doc.text(`${i+1}. ${item.ime}`, 145, 48 + i * 6);
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
