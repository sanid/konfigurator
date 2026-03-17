import { state } from './state.js';
import { DEFAULT_MATERIALS, DEFAULT_SETTINGS } from './modules-config.js';
import { buildKitchenModuleAsync, clearMaterialCache, clearGeomCache } from './kitchen-builder.js';
import { clearAllGroups, addModuleGroup, addFixtureMarker, clearFixtureMarkers, setLightingMode } from './viewer.js';
import { showNotification } from './notifications.js';
import { updateWallGridDisplay } from './wall-grid.js';
import { renderPlanList } from './plan-manager.js';
import { updateTotalCost } from './price-utils.js';
import { initMaterialsPanel } from './material-picker.js';
import { initToggles } from './app.js';

export const AUTO_SAVE_KEY = 'meco_autosave';

export function autoSave() {
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
      lightingMode: state.lightingMode,
      moduleDefs: state.moduleDefs
    };
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage full or unavailable
  }
}

export function autoRestore() {
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
    state.moduleDefs = data.moduleDefs || {};

    if (data.clientName) {
      state.clientName = data.clientName;
      const el = document.getElementById('client-name');
      if (el) el.value = data.clientName;
    }

    initMaterialsPanel();
    initToggles();

    ['univer', 'mdf', 'hdf', 'radna', 'kant-k', 'kant-K'].forEach(id => {
      const input = document.getElementById(`price-${id}`);
      if (input) input.value = state.prices[id.replace(/-/g, '_')];
    });

    _syncPosInputs();

    clearMaterialCache();
    clearGeomCache();
    clearAllGroups();
    clearFixtureMarkers();
    Promise.all(state.plan.map((entry, idx) =>
      buildKitchenModuleAsync(entry.ime, entry.p, state.materials, state.settings, entry.pos[0], entry.pos[1], entry.pos[2], entry.r || 0)
        .then(group => addModuleGroup(idx, group))
        .catch(e => console.warn('Auto-restore: failed to rebuild module', idx, e))
    ));
    state.wallFixtures.forEach((fixture, idx) => {
      try { addFixtureMarker(idx, fixture); } catch (e) { }
    });

    renderPlanList();
    updateWallGridDisplay();
    updateTotalCost();
    setLightingMode(state.lightingMode);
    const btnLight = document.getElementById('btn-toggle-light');
    if (btnLight) btnLight.style.filter = state.lightingMode === 'warm' ? 'sepia(0.6) saturate(2)' : 'none';
    showNotification('Radni prostor vraćen', 'info');
  } catch (e) {
    console.warn('Auto-restore failed:', e);
  }
}

export async function saveProject() {
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
    lightingMode: state.lightingMode,
    moduleDefs: state.moduleDefs
  };
  const filename = (projectData.clientName || 'projekat').replace(/\s+/g, '_') + '.meco';
  try {
    const res = await window.electronAPI?.saveFile({ filename, ext: 'meco', extName: 'Meco Projekat', content: JSON.stringify(projectData, null, 2), encoding: 'utf-8' });
    if (res?.success) showNotification('Projekat sačuvan!', 'success');
  } catch (err) {
    console.error('Save error:', err);
    showNotification('Greška pri čuvanju projekta', 'error');
  }
}

export async function loadProject() {
  try {
    const res = await window.electronAPI?.openFile({ extName: 'Meco Projekat', ext: 'meco' });
    if (!res?.success) return;
    const data = JSON.parse(res.content);
    if (!data.version || !data.plan) { showNotification('Neispravan fajl projekta', 'error'); return; }

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
    state.moduleDefs = data.moduleDefs || {};

    if (data.clientName) {
      state.clientName = data.clientName;
      const el = document.getElementById('client-name');
      if (el) el.value = data.clientName;
    }

    initMaterialsPanel();
    initToggles();

    ['univer', 'mdf', 'hdf', 'radna', 'kant-k', 'kant-K'].forEach(id => {
      const input = document.getElementById(`price-${id}`);
      if (input) input.value = state.prices[id.replace(/-/g, '_')];
    });

    clearMaterialCache();
    clearGeomCache();
    clearAllGroups();
    clearFixtureMarkers();
    Promise.all(state.plan.map((entry, idx) =>
      buildKitchenModuleAsync(entry.ime, entry.p, state.materials, state.settings, entry.pos[0], entry.pos[1], entry.pos[2], entry.r || 0)
        .then(group => addModuleGroup(idx, group))
        .catch(e => console.warn('Failed to rebuild module', idx, e))
    ));
    state.wallFixtures.forEach((fixture, idx) => {
      try { addFixtureMarker(idx, fixture); } catch (e) { }
    });

    renderPlanList();
    updateWallGridDisplay();
    updateTotalCost();
    setLightingMode(state.lightingMode);
    const btnLight = document.getElementById('btn-toggle-light');
    if (btnLight) btnLight.style.filter = state.lightingMode === 'warm' ? 'sepia(0.6) saturate(2)' : 'none';
    showNotification(`Projekat "${data.clientName}" učitan!`, 'success');
  } catch (err) {
    console.error('Load error:', err);
    showNotification('Greška pri učitavanju projekta', 'error');
  }
}

function _syncPosInputs() {
  ['x', 'y', 'z', 'r'].forEach(axis => {
    const el = document.getElementById(`pos-${axis}`);
    if (el) el.value = state.position[axis] ?? 0;
  });
}
