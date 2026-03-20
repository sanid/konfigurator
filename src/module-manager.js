/**
 * module-manager.js
 * Module Manager — per-module custom labels and BOM (Bill of Materials).
 *
 * state.moduleDefs structure:
 *   { [moduleName]: { label: string, bom: [{ name, qty, unitCost }] } }
 *
 * BOM cost contribution per plan item:
 *   sum(bom[i].qty * bom[i].unitCost) — added to updateTotalCost in price-utils.js
 */

import { state } from './state.js';
import { MODULE_GROUPS } from './modules-config.js';

// ── Public: open the modal ────────────────────────────────────────────────────
export function openModuleManager() {
  _render();
  document.getElementById('modal-module-manager')?.classList.remove('hidden');
}

// ── Public: get BOM cost for a single plan entry ──────────────────────────────
export function getBomCostForItem(planItem) {
  const def = state.moduleDefs?.[planItem.ime];
  if (!def || !def.bom || def.bom.length === 0) return 0;
  return def.bom.reduce((sum, row) => sum + (parseFloat(row.qty) || 0) * (parseFloat(row.unitCost) || 0), 0);
}

// ── Private state ─────────────────────────────────────────────────────────────
let _selectedModule = null; // currently selected module name

// ── Private: render full modal ────────────────────────────────────────────────
function _render() {
  _renderModuleList();
  if (_selectedModule) {
    _renderEditor(_selectedModule);
  } else {
    document.getElementById('mm-editor').innerHTML =
      '<div class="mm-empty">Odaberi modul s lijeve strane</div>';
  }
}

function _renderModuleList() {
  const list = document.getElementById('mm-module-list');
  if (!list) return;
  list.innerHTML = '';

  // Collect all unique module names from MODULE_GROUPS
  const allModules = [];
  for (const [cat, mods] of Object.entries(MODULE_GROUPS)) {
    for (const name of Object.keys(mods)) {
      allModules.push({ name, cat });
    }
  }

  // Group by category
  const grouped = {};
  allModules.forEach(({ name, cat }) => {
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(name);
  });

  for (const [cat, names] of Object.entries(grouped)) {
    const catEl = document.createElement('div');
    catEl.className = 'mm-cat-header';
    catEl.textContent = cat;
    list.appendChild(catEl);

    names.forEach(name => {
      const def = state.moduleDefs?.[name];
      const hasBom = def?.bom?.length > 0;
      const hasLabel = def?.label;

      const row = document.createElement('div');
      row.className = 'mm-module-row' + (name === _selectedModule ? ' selected' : '');
      row.title = name;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'mm-module-name';
      nameSpan.textContent = hasLabel ? def.label : name.replace(/_/g, ' ');
      if (hasLabel) nameSpan.title = name;

      const badge = document.createElement('span');
      badge.className = 'mm-bom-badge' + (hasBom ? ' has-bom' : '');
      badge.textContent = hasBom ? `${def.bom.length} BOM` : '—';

      row.appendChild(nameSpan);
      row.appendChild(badge);
      row.addEventListener('click', () => {
        _selectedModule = name;
        _render();
      });
      list.appendChild(row);
    });
  }
}

function _renderEditor(moduleName) {
  const editor = document.getElementById('mm-editor');
  if (!editor) return;

  if (!state.moduleDefs) state.moduleDefs = {};
  if (!state.moduleDefs[moduleName]) {
    state.moduleDefs[moduleName] = { label: '', bom: [] };
  }
  const def = state.moduleDefs[moduleName];

  editor.innerHTML = '';

  // ── Module name / label ───────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'mm-editor-header';
  header.innerHTML = `
    <div class="mm-editor-title">${moduleName.replace(/_/g, ' ')}</div>
    <div class="mm-field-row">
      <label class="mm-field-label">Naziv (prikazni):</label>
      <input type="text" class="mm-input" id="mm-label-input"
        placeholder="${moduleName.replace(/_/g, ' ')}"
        value="${def.label || ''}">
    </div>
  `;
  editor.appendChild(header);

  header.querySelector('#mm-label-input').addEventListener('input', e => {
    def.label = e.target.value.trim();
    _renderModuleList();
  });

  // ── BOM section ───────────────────────────────────────────────────────────
  const bomSection = document.createElement('div');
  bomSection.className = 'mm-bom-section';

  const bomTitle = document.createElement('div');
  bomTitle.className = 'mm-bom-title';
  bomTitle.textContent = 'Specifikacija (BOM)';
  bomSection.appendChild(bomTitle);

  const bomDesc = document.createElement('div');
  bomDesc.className = 'mm-bom-desc';
  bomDesc.textContent = 'Cijena po modulu = suma (kolicina × cijena stavke)';
  bomSection.appendChild(bomDesc);

  // Table header
  const tableWrap = document.createElement('div');
  tableWrap.className = 'mm-bom-table-wrap';

  const thead = document.createElement('div');
  thead.className = 'mm-bom-row mm-bom-thead';
  thead.innerHTML = `
    <span class="mm-bom-col-name">Stavka</span>
    <span class="mm-bom-col-qty">Kol.</span>
    <span class="mm-bom-col-cost">Cijena (€)</span>
    <span class="mm-bom-col-total">Ukupno</span>
    <span class="mm-bom-col-del"></span>
  `;
  tableWrap.appendChild(thead);

  const tbody = document.createElement('div');
  tbody.className = 'mm-bom-tbody';
  tableWrap.appendChild(tbody);

  function renderBomRows() {
    tbody.innerHTML = '';
    let totalBom = 0;

    def.bom.forEach((row, i) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'mm-bom-row';

      const rowTotal = (parseFloat(row.qty) || 0) * (parseFloat(row.unitCost) || 0);
      totalBom += rowTotal;

      rowEl.innerHTML = `
        <input class="mm-input mm-bom-col-name" type="text"
          placeholder="npr. Korisnica klizača" value="${row.name || ''}">
        <input class="mm-input mm-bom-col-qty" type="number"
          min="0" step="0.01" placeholder="1" value="${row.qty ?? ''}">
        <input class="mm-input mm-bom-col-cost" type="number"
          min="0" step="0.01" placeholder="0.00" value="${row.unitCost ?? ''}">
        <span class="mm-bom-col-total mm-row-total">${rowTotal.toFixed(2)} €</span>
        <button class="mm-del-btn" title="Ukloni stavku" aria-label="Ukloni stavku">×</button>
      `;

      rowEl.querySelector('.mm-bom-col-name').addEventListener('input', e => {
        def.bom[i].name = e.target.value;
      });
      rowEl.querySelector('.mm-bom-col-qty').addEventListener('input', e => {
        def.bom[i].qty = parseFloat(e.target.value) || 0;
        const rowTotal = def.bom[i].qty * (parseFloat(def.bom[i].unitCost) || 0);
        rowEl.querySelector('.mm-row-total').textContent = rowTotal.toFixed(2) + ' €';
        _updateBomTotal();
      });
      rowEl.querySelector('.mm-bom-col-cost').addEventListener('input', e => {
        def.bom[i].unitCost = parseFloat(e.target.value) || 0;
        const rowTotal = (parseFloat(def.bom[i].qty) || 0) * def.bom[i].unitCost;
        rowEl.querySelector('.mm-row-total').textContent = rowTotal.toFixed(2) + ' €';
        _updateBomTotal();
      });
      rowEl.querySelector('.mm-del-btn').addEventListener('click', () => {
        def.bom.splice(i, 1);
        renderBomRows();
        _renderModuleList();
        _updateBomTotal();
      });

      tbody.appendChild(rowEl);
    });

    // Total row
    const totalRow = document.createElement('div');
    totalRow.className = 'mm-bom-row mm-bom-total-row';
    totalRow.innerHTML = `
      <span class="mm-bom-col-name" style="font-weight:700">Cijena po modulu:</span>
      <span class="mm-bom-col-qty"></span>
      <span class="mm-bom-col-cost"></span>
      <span class="mm-bom-col-total mm-total-val">${totalBom.toFixed(2)} €</span>
      <span class="mm-bom-col-del"></span>
    `;
    tbody.appendChild(totalRow);
  }

  renderBomRows();
  bomSection.appendChild(tableWrap);

  // Add row button
  const addBtn = document.createElement('button');
  addBtn.className = 'mm-add-bom-btn';
  addBtn.textContent = '+ Dodaj stavku';
  addBtn.addEventListener('click', () => {
    def.bom.push({ name: '', qty: 1, unitCost: 0 });
    renderBomRows();
    _renderModuleList();
  });
  bomSection.appendChild(addBtn);

  // Usage in plan
  const usageCount = state.plan.filter(item => item.ime === moduleName).length;
  if (usageCount > 0) {
    const usage = document.createElement('div');
    usage.className = 'mm-usage';
    const bomTotal = def.bom.reduce((s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.unitCost) || 0), 0);
    usage.id = 'mm-usage-line';
    usage.innerHTML = `
      <span>Koristi se u planu: <strong>${usageCount}×</strong></span>
      <span>BOM ukupno: <strong>${(bomTotal * usageCount).toFixed(2)} €</strong></span>
    `;
    bomSection.appendChild(usage);
  }

  editor.appendChild(bomSection);
}

function _updateBomTotal() {
  // Refresh usage line
  if (!_selectedModule) return;
  const def = state.moduleDefs?.[_selectedModule];
  if (!def) return;
  const bomTotal = def.bom.reduce((s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.unitCost) || 0), 0);
  const totalVal = document.querySelector('.mm-bom-total-row .mm-total-val');
  if (totalVal) totalVal.textContent = bomTotal.toFixed(2) + ' €';
  const usageCount = state.plan.filter(item => item.ime === _selectedModule).length;
  const usage = document.getElementById('mm-usage-line');
  if (usage && usageCount > 0) {
    usage.innerHTML = `
      <span>Koristi se u planu: <strong>${usageCount}×</strong></span>
      <span>BOM ukupno: <strong>${(bomTotal * usageCount).toFixed(2)} €</strong></span>
    `;
  }
  // Trigger price recalc
  import('./price-utils.js').then(({ updateTotalCost }) => updateTotalCost());
  import('./project-storage.js').then(({ autoSave }) => autoSave());
}

// ── Public: init (called once on DOMContentLoaded) ────────────────────────────
export function initModuleManager() {
  const modal = document.getElementById('modal-module-manager');
  if (!modal) return;

  document.getElementById('modal-module-manager-close')?.addEventListener('click', () => {
    modal.classList.add('hidden');
    import('./price-utils.js').then(({ updateTotalCost }) => updateTotalCost());
    import('./project-storage.js').then(({ autoSave }) => autoSave());
  });

  modal.querySelector('.modal-backdrop')?.addEventListener('click', () => {
    modal.classList.add('hidden');
    import('./price-utils.js').then(({ updateTotalCost }) => updateTotalCost());
    import('./project-storage.js').then(({ autoSave }) => autoSave());
  });
}
