import { state } from './state.js';
import { computeCuttingList } from './cutting-list.js';
import { getBomCostForItem } from './module-manager.js';

export function initPriceInputs() {
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

export const MATERIAL_PRICE_MAP = [
  [/RADNA PLOCA/i,  () => state.prices.radna],
  [/UNIVER/i,       () => state.prices.univer],
  [/\bMDF\b/i,      () => state.prices.mdf],
  [/\bHDF\b/i,      () => state.prices.hdf],
];

export function getPriceForMaterial(materialName) {
  for (const [pattern, getter] of MATERIAL_PRICE_MAP) {
    if (pattern.test(materialName)) return getter();
  }
  return 0;
}

export function updateTotalCost() {
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

  // BOM cost from module manager
  let totalBom = 0;
  for (const item of state.plan) {
    totalBom += getBomCostForItem(item);
  }

  const totalEur = totalMaterial + totalKant + totalBom;
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
    breakdown.innerHTML = `Mat: ${totalMaterial.toFixed(2)}€ · Kant: <span style="color:var(--accent)">${totalKant.toFixed(2)}€</span>${totalBom > 0 ? ` · BOM: <span style="color:var(--green)">${totalBom.toFixed(2)}€</span>` : ''}`;
  }
}
