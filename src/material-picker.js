import { state, pendingMatSel, setPendingMatSel } from './state.js';
import { COLOR_PRESETS, TEXTURE_PRESETS } from './modules-config.js';
import { showNotification } from './notifications.js';

export const MAT_LABELS = {
  front: 'Front',
  korpus: 'Korpus',
  radna: 'Radna pl.',
  granc: 'Granc',
  cokla: 'Cokla'
};

export function initMaterialsPanel() {
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

export function refreshMaterialSwatches() {
  for (const key of Object.keys(MAT_LABELS)) {
    const def = state.materials[key];
    const swatch = document.getElementById(`swatch-${key}`);
    const nameEl = document.getElementById(`matname-${key}`);
    if (swatch) {
      if (def.type === 'texture' && def.textureName) {
        const tp = TEXTURE_PRESETS.find(t => t.name === def.textureName);
        if (tp) swatch.style.background = `linear-gradient(135deg, ${tp.base} 0%, ${tp.grain} 100%)`;
      } else {
        swatch.style.backgroundColor = def.color;
      }
    }
    if (nameEl) nameEl.textContent = def.name;
  }
}

export function initMaterialPickerModal() {
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
      setPendingMatSel({ name: cp.name, color: cp.hex, type: 'color' });
      document.querySelectorAll('.mat-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      updateMatPreview();
    });
    colGrid.appendChild(chip);
  });

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
      setPendingMatSel({ name: tp.label, color: tp.base, textureName: tp.name, type: 'texture' });
      document.querySelectorAll('.mat-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      updateMatPreview();
    });
    texGrid.appendChild(chip);
  });

  document.getElementById('mat-custom-color').addEventListener('input', e => {
    const hex = e.target.value;
    setPendingMatSel({ name: 'Custom', color: hex, type: 'color' });
    document.querySelectorAll('.mat-chip').forEach(c => c.classList.remove('selected'));
    updateMatPreview();
  });

  document.getElementById('modal-mat-ok').addEventListener('click', () => {
    if (pendingMatSel && state.matPickerTarget) {
      state.materials[state.matPickerTarget] = { ...pendingMatSel };
      refreshMaterialSwatches();
      import('./kitchen-builder.js').then(m => m.clearMaterialCache());
      import('./plan-manager.js').then(m => m.rebuildAllModules());
    }
    document.getElementById('modal-material').classList.add('hidden');
  });

  const close = () => document.getElementById('modal-material').classList.add('hidden');
  document.getElementById('modal-mat-close').addEventListener('click', close);
  document.getElementById('modal-mat-cancel').addEventListener('click', close);
  document.querySelector('#modal-material .modal-backdrop').addEventListener('click', close);
}

export function openMaterialPicker(key) {
  state.matPickerTarget = key;
  setPendingMatSel({ ...state.materials[key] });
  document.getElementById('modal-mat-title').textContent = `Materijal — ${MAT_LABELS[key]}`;
  document.querySelectorAll('.mat-chip').forEach(c => c.classList.remove('selected'));
  const curName = state.materials[key].textureName || state.materials[key].name;
  document.querySelectorAll(`.mat-chip[data-name="${curName}"]`).forEach(c => c.classList.add('selected'));
  updateMatPreview();
  document.getElementById('modal-material').classList.remove('hidden');
}

export function updateMatPreview() {
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
