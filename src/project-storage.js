import { state } from './state.js';
import { DEFAULT_MATERIALS, DEFAULT_SETTINGS } from './modules-config.js';
import { buildKitchenModuleAsync, clearMaterialCache, clearGeomCache } from './kitchen-builder.js';
import { clearAllGroups, addModuleGroup, addFixtureMarker, clearFixtureMarkers, setLightingMode } from './viewer.js';
import { showNotification } from './notifications.js';
import { updateWallGridDisplay } from './wall-grid.js';
import { renderPlanList } from './plan-manager.js';
import { updateTotalCost } from './price-utils.js';
import { initMaterialsPanel } from './material-picker.js';
import { saveCurrentTab } from './plan-tabs.js';

let _initToggles = () => {};
export function registerInitToggles(fn) {
  _initToggles = fn;
}

export const AUTO_SAVE_KEY = 'meco_autosave';

let _autoSaveTimer = null;

export function autoSave() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(_doAutoSave, 500);
}

function _doAutoSave() {
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
    };
    localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(data));
    saveCurrentTab(state.plan, state.occupiedCells, state.wallFixtures);
  } catch (e) {
    showNotification('Auto-save failed — changes not persisted. Use 💾 manually.', 'error');
  }
}

function _applyProjectState(data) {
  state.materials = { ...DEFAULT_MATERIALS, ...data.materials };
  state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
  state.prices = { ...state.prices, ...data.prices };
  state.plan = data.plan || [];
  state.occupiedCells = data.occupiedCells || {};
  state.wallFixtures = data.wallFixtures || [];
  state.position = data.position || { x: 0, y: 0, z: 0, r: 0 };
  state.simplifiedKrojna = data.simplifiedKrojna || false;
  state.lightingMode = data.lightingMode || 'warm';

  if (data.selectedCell) state.selectedCell = data.selectedCell;

  if (data.clientName) {
    state.clientName = data.clientName;
    const el = document.getElementById('client-name');
    if (el) el.value = data.clientName;
  }

  initMaterialsPanel();
  _initToggles();

  ['univer', 'mdf', 'hdf', 'radna', 'kant-k', 'kant-K'].forEach((id) => {
    const input = document.getElementById(`price-${id}`);
    if (input) input.value = state.prices[id.replace(/-/g, '_')];
  });

  _syncPosInputs();

  clearMaterialCache();
  clearGeomCache();
  clearAllGroups();
  clearFixtureMarkers();
  Promise.all(
    state.plan.map((entry, idx) =>
      buildKitchenModuleAsync(
        entry.ime,
        entry.p,
        state.materials,
        state.settings,
        entry.pos[0],
        entry.pos[1],
        entry.pos[2],
        entry.r || 0,
      )
        .then((group) => addModuleGroup(idx, group))
        .catch((e) => console.warn('Rebuild module failed', idx, e)),
    ),
  );
  state.wallFixtures.forEach((fixture, idx) => {
    try {
      addFixtureMarker(idx, fixture);
    } catch (e) {}
  });

  renderPlanList();
  updateWallGridDisplay();
  updateTotalCost();
  setLightingMode(state.lightingMode);

  const btnLight = document.getElementById('btn-toggle-light');
  if (btnLight) btnLight.classList.toggle('light-warm', state.lightingMode === 'warm');
}

export function autoRestore() {
  try {
    const raw = localStorage.getItem(AUTO_SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data.version || !data.plan || data.plan.length === 0) return;

    state.selectedCell = data.selectedCell || [2, 1];
    _applyProjectState(data);
    showNotification('Radni prostor vraćen', 'info');
  } catch (e) {
    console.warn('Auto-restore failed:', e);
  }
}

export async function saveProject() {
  const canvas = document.getElementById('three-canvas');
  let thumbnail = '';
  try {
    if (canvas) thumbnail = canvas.toDataURL('image/jpeg', 0.6);
  } catch {}

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
    thumbnail,
  };
  const filename = (projectData.clientName || 'projekat').replace(/\s+/g, '_') + '.meco';
  try {
    const res = await window.electronAPI?.saveFile({
      filename,
      ext: 'meco',
      extName: 'Meco Projekat',
      content: JSON.stringify(projectData, null, 2),
      encoding: 'utf-8',
    });
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
    if (!data.version || !data.plan) {
      showNotification('Neispravan fajl projekta', 'error');
      return;
    }

    const validation = _validateMecoData(data);
    if (validation.errors.length > 0) {
      showNotification('Upozorenje: ' + validation.errors.join('; '), 'warning');
    }

    if (data.thumbnail) {
      _showThumbnailPreview(data.clientName || 'Projekat', data.thumbnail, data.plan.length, () => {
        state.selectedPlanIdx = -1;
        _applyProjectState(data);
        showNotification(`Projekat "${data.clientName}" učitan!`, 'success');
      });
    } else {
      state.selectedPlanIdx = -1;
      _applyProjectState(data);
      showNotification(`Projekat "${data.clientName}" učitan!`, 'success');
    }
  } catch (err) {
    console.error('Load error:', err);
    showNotification('Greška pri učitavanju projekta', 'error');
  }
}

function _showThumbnailPreview(name, thumbnailDataUrl, moduleCount, onConfirm) {
  let overlay = document.getElementById('thumbnail-preview');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'thumbnail-preview';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);" class="tp-backdrop"></div>
      <div style="position:relative;background:var(--bg-card2);border:1px solid var(--accent);border-radius:var(--radius-lg);padding:20px;max-width:400px;text-align:center;">
        <div style="font-size:14px;font-weight:700;color:var(--accent);margin-bottom:8px;" class="tp-title"></div>
        <img class="tp-img" style="width:100%;border-radius:8px;margin-bottom:8px;" />
        <div style="font-size:11px;color:var(--text-secondary);margin-bottom:12px;" class="tp-meta"></div>
        <div style="display:flex;gap:8px;justify-content:center;">
          <button class="btn" id="tp-cancel">Otkaži</button>
          <button class="btn btn-success" id="tp-confirm">Učitaj</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.tp-backdrop').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
    document.getElementById('tp-cancel')?.addEventListener('click', () => {
      overlay.style.display = 'none';
    });
    document.getElementById('tp-confirm')?.addEventListener('click', () => {
      overlay.style.display = 'none';
      onConfirm();
    });
  }
  overlay.querySelector('.tp-title').textContent = name;
  overlay.querySelector('.tp-img').src = thumbnailDataUrl;
  overlay.querySelector('.tp-meta').textContent = `${moduleCount} elemenata`;
  overlay.style.display = 'flex';
}

function _syncPosInputs() {
  ['x', 'y', 'z', 'r'].forEach((axis) => {
    const el = document.getElementById(`pos-${axis}`);
    if (el) el.value = state.position[axis] ?? 0;
  });
}

function _validateMecoData(data) {
  const errors = [];
  if (!Array.isArray(data.plan)) {
    errors.push('Plan nije niz');
    return { errors };
  }
  data.plan.forEach((item, i) => {
    if (!item.ime || typeof item.ime !== 'string') errors.push(`Element ${i}: nedostaje ime`);
    if (!item.p || typeof item.p !== 'object') errors.push(`Element ${i}: nedostaju parametri`);
    if (!Array.isArray(item.pos) || item.pos.length < 3) {
      item.pos = item.pos || [0, 0, 0];
      while (item.pos.length < 3) item.pos.push(0);
    }
    if (typeof item.r !== 'number') item.r = 0;
  });
  return { errors };
}
