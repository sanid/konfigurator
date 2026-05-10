import { state } from './state.js';
import { computeCuttingList } from './cutting-list.js';
import { computeHardwareBOM } from './hardware.js';

export function initPriceInputs() {
  ['univer', 'mdf', 'hdf', 'radna', 'kant-k', 'kant-K', 'laborPct', 'marginPct'].forEach((id) => {
    const input = document.getElementById(`price-${id}`);
    if (input) {
      const stateKey = id.replace(/-/g, '_');
      input.value = state.prices[stateKey];
      input.addEventListener('input', (e) => {
        state.prices[stateKey] = parseFloat(e.target.value) || 0;
        updateTotalCost();
      });
    }
  });

  const btn = document.getElementById('btn-toggle-prices');
  if (btn) {
    // prices-panel starts hidden, so button starts dimmed
    btn.style.opacity = '0.5';
    btn.onclick = () => {
      const panel = document.getElementById('prices-panel');
      const isHidden = panel.classList.toggle('hidden');
      btn.style.opacity = isHidden ? '0.5' : '1';
    };
  }
}

export function calcKant(kantStr, Lmm, Wmm) {
  if (!kantStr || kantStr === '/') return { k: 0, K: 0 };

  let len_k = 0;
  let len_K = 0;

  // Pattern: N[dk] where d=length, k=width. k=thin, K=thick
  // Example: "1d i 2k", "2KK", "1d"
  const parts = kantStr.split('i').map((s) => s.trim());
  parts.forEach((p) => {
    const match = p.match(/(\d*)\s*([dDkK]+)/);
    if (match) {
      const qty = parseInt(match[1] || '1');
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

export const MATERIAL_PRICE_MAP = [
  [/RADNA PLOCA/i, () => state.prices.radna],
  [/UNIVER/i, () => state.prices.univer],
  [/\bMDF\b/i, () => state.prices.mdf],
  [/\bHDF\b/i, () => state.prices.hdf],
];

export function getPriceForMaterial(materialName) {
  for (const [pattern, getter] of MATERIAL_PRICE_MAP) {
    if (pattern.test(materialName)) return getter();
  }
  return 0;
}

export function computeCostBreakdown(plan) {
  const krojna = computeCuttingList(plan);
  const matAgg = new Map();
  let totalKantThin = 0;
  let totalKantThick = 0;

  for (const part of krojna) {
    const area = (part.L * part.W) / 1000000;
    const sqm = area * part.qty;
    const pricePerM2 = getPriceForMaterial(part.material);
    const cost = sqm * pricePerM2;

    const existing = matAgg.get(part.material);
    if (existing) {
      existing.sqm += sqm;
      existing.cost += cost;
    } else {
      matAgg.set(part.material, { material: part.material, sqm, pricePerM2, cost });
    }

    const k = calcKant(part.kant, part.L, part.W);
    totalKantThin += k.k * state.prices.kant_k * part.qty;
    totalKantThick += k.K * state.prices.kant_K * part.qty;
  }

  const panels = [...matAgg.values()].sort((a, b) => b.cost - a.cost);
  const totalPanels = panels.reduce((s, p) => s + p.cost, 0);
  const totalKant = totalKantThin + totalKantThick;
  const hwBom = computeHardwareBOM(plan);
  const subtotal = totalPanels + totalKant + hwBom.grandTotal;

  const laborPct = state.prices.laborPct || 0;
  const marginPct = state.prices.marginPct || 0;
  const labor = subtotal * (laborPct / 100);
  const margin = (subtotal + labor) * (marginPct / 100);
  const grandTotal = subtotal + labor + margin;

  return {
    panels,
    kantThin: totalKantThin,
    kantThick: totalKantThick,
    totalKant,
    hardware: hwBom.grandTotal,
    hardwareItems: hwBom.items,
    subtotal,
    laborPct,
    marginPct,
    labor,
    margin,
    grandTotal,
    grandTotalRsd: grandTotal * 117,
  };
}

export function updateTotalCost() {
  const bd = computeCostBreakdown(state.plan);

  const totalEl = document.getElementById('price-total');
  if (totalEl) {
    totalEl.textContent = bd.grandTotal.toFixed(2) + ' €';
  }
  const rsdEl = document.getElementById('price-total-rsd');
  if (rsdEl) {
    rsdEl.textContent = bd.grandTotalRsd.toLocaleString('sr-RS') + ' RSD';
  }

  const overlay = document.getElementById('price-overlay');
  if (!overlay) return;

  let breakdown = overlay.querySelector('.price-breakdown');
  if (!breakdown) {
    breakdown = document.createElement('div');
    breakdown.className = 'price-breakdown';
    overlay.appendChild(breakdown);
  }

  const row = (label, val, cls) =>
    `<div class="cbd-row${cls ? ' ' + cls : ''}"><span>${label}</span><span>${val}</span></div>`;

  let html = '';
  for (const p of bd.panels) {
    html += row(p.material, p.cost.toFixed(2) + ' €');
  }
  html += row('Kantovanje (tanko)', bd.kantThin.toFixed(2) + ' €');
  html += row('Kantovanje (debelo)', bd.kantThick.toFixed(2) + ' €');
  html += row('Okov', bd.hardware.toFixed(2) + ' €');

  if (bd.laborPct > 0) {
    html += row('Rad (' + bd.laborPct + '%)', bd.labor.toFixed(2) + ' €');
  }
  if (bd.marginPct > 0) {
    html += row('Marža (' + bd.marginPct + '%)', bd.margin.toFixed(2) + ' €');
  }

  html += row('UKUPNO', bd.grandTotal.toFixed(2) + ' €', 'cbd-total');

  breakdown.innerHTML = html;
}
