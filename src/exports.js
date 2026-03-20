import { state, isDark } from './state.js';
import { computeCuttingList, computeCuttingListByModule, toCsvString } from './cutting-list.js';
import { showNotification } from './notifications.js';
import { calcKant, getPriceForMaterial } from './price-utils.js';
import { snapshotCanvasFitAll } from './viewer.js';

// ─── Krojna Lista Modal ───────────────────────────────────────────────────────
export function initKrojnaModal() {
  const close = () => document.getElementById('modal-krojna').classList.add('hidden');
  document.getElementById('modal-krojna-close').addEventListener('click', close);
  document.getElementById('btn-modal-close').addEventListener('click', close);
  document.querySelector('#modal-krojna .modal-backdrop').addEventListener('click', close);
  document.getElementById('btn-export-krojna-csv').addEventListener('click', exportOptimik);
  document.getElementById('btn-export-all-mpr').addEventListener('click', exportAllMPR);

  const toggle = document.getElementById('krojna-simplified-toggle');
  if (toggle) {
    toggle.checked = state.simplifiedKrojna;
    toggle.addEventListener('change', e => { state.simplifiedKrojna = e.target.checked; showKrojnaLista(); });
  }
  const perModuleToggle = document.getElementById('krojna-per-module-toggle');
  if (perModuleToggle) {
    perModuleToggle.checked = state.perModuleKrojna;
    perModuleToggle.addEventListener('change', e => { state.perModuleKrojna = e.target.checked; showKrojnaLista(); });
  }

  const mprFields = ['D', 'BRR', 'EX', 'F', 'BRP', 'TR'];
  for (const field of mprFields) {
    const el = document.getElementById(`mpr-${field}`);
    if (el) {
      el.value = state.mprSettings[field];
      el.addEventListener('change', e => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v) && v >= 0) state.mprSettings[field] = v;
      });
    }
  }

  document.getElementById('krojna-table-wrap').addEventListener('click', e => {
    const btn = e.target.closest('.btn-mpr-module');
    if (btn) exportModuleMPR(parseInt(btn.dataset.planIdx, 10));
  });
}

export function showKrojnaLista() {
  if (state.plan.length === 0) { showNotification('Plan je prazan!', 'warning'); return; }
  const wrap = document.getElementById('krojna-table-wrap');
  const simple = state.simplifiedKrojna;
  const perModule = state.perModuleKrojna;
  let html = '';

  if (perModule) {
    const modules = computeCuttingListByModule(state.plan);
    html = '<div class="krojna-by-module">';
    modules.forEach((m, idx) => {
      if (m.panels.length === 0) return;
      const mprPanel = getMPRPanel(m);
      const mprDims = mprPanel ? `${mprPanel.L}x${mprPanel.W}mm` : '';
      html += `<div class="krojna-by-module-item">
        <div class="krojna-by-module-header">
          <span>[${m.index}] ${m.moduleName.replace(/_/g, ' ').toUpperCase()}</span>
          <span style="display:flex;align-items:center;gap:8px;">
            <span style="opacity:0.8;">${m.panels.length} elemenata</span>
            ${mprPanel ? `<button class="btn btn-mpr-module" data-plan-idx="${idx}" style="padding:2px 8px;font-size:9px;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:700;">⚙ MPR ${mprDims}</button>` : ''}
          </span>
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
          <td>${simple ? `${(r.L/10).toFixed(1)} x ${(r.W/10).toFixed(1)}` : `${r.L} x ${r.W}`}</td>
          <td style="text-align:center">${r.qty}</td>
          <td style="font-size:10px;">${r.material}</td>
          <td style="color:var(--text-secondary);font-size:9px;">${r.kant || ''}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    });
    html += '</div>';
  } else {
    const list = computeCuttingList(state.plan);
    const groups = {};
    list.forEach(row => { if (!groups[row.material]) groups[row.material] = []; groups[row.material].push(row); });

    html = `<table class="krojna-table">
      <thead><tr>
        <th>Naziv</th>
        ${simple ? '<th>Dimenzije (cm)</th>' : '<th>Dimenzije (mm)</th>'}
        <th style="text-align:center">Kom.</th>
        ${simple ? '' : '<th>Povrsina (m2)</th><th>Mat (€)</th><th>Kant (€)</th><th>Ukupno (€)</th>'}
        <th>Code</th>
      </tr></thead><tbody>`;

    let totalGrand = 0, totalGrandKant = 0, totalGrandMat = 0;

    for (const [mat, rows] of Object.entries(groups)) {
      const pSqm = getPriceForMaterial(mat);
      const colCount = simple ? 4 : 8;
      html += `<tr class="group-row"><td colspan="${colCount}">▸ ${mat} ${simple ? '' : `(${pSqm.toFixed(2)} €/m²)`}</td></tr>`;

      rows.forEach(r => {
        const area = (r.L * r.W) / 1000000 * r.qty;
        const costMat = area * pSqm;
        const k = calcKant(r.kant, r.L, r.W);
        const costKant = (k.k * state.prices.kant_k + k.K * state.prices.kant_K) * r.qty;
        const costTotal = costMat + costKant;
        totalGrandMat += costMat; totalGrandKant += costKant; totalGrand += costTotal;

        if (simple) {
          html += `<tr><td>${r.name}</td><td>${(r.L/10).toFixed(1)} x ${(r.W/10).toFixed(1)}</td><td style="text-align:center">${r.qty}</td><td style="color:var(--text-secondary);font-size:9px;">${r.kant||''}</td></tr>`;
        } else {
          html += `<tr><td>${r.name}</td><td>${r.L} x ${r.W}</td><td style="text-align:center">${r.qty}</td><td>${area.toFixed(3)}</td><td>${costMat.toFixed(2)}</td><td style="color:var(--accent)">${costKant.toFixed(2)}</td><td style="color:var(--green);font-weight:700;">${costTotal.toFixed(2)}</td><td style="color:var(--text-secondary);font-size:9px;">${r.kant||''}</td></tr>`;
        }
      });

      if (!simple) {
        const gMat = rows.reduce((s,r)=>s+(r.L*r.W/1000000*r.qty*pSqm),0);
        const gKant = rows.reduce((s,r)=>{ const k=calcKant(r.kant,r.L,r.W); return s+(k.k*state.prices.kant_k+k.K*state.prices.kant_K)*r.qty; },0);
        html += `<tr style="background:rgba(79,122,255,0.05);font-weight:700;"><td colspan="4" style="text-align:right">UKUPNO ZA ${mat}:</td><td>${gMat.toFixed(2)} €</td><td style="color:var(--accent)">${gKant.toFixed(2)} €</td><td colspan="2" style="color:var(--green)">${(gMat+gKant).toFixed(2)} €</td></tr>`;
      }
    }

    html += '</tbody></table>';
    const totalPcs = list.reduce((s,r)=>s+r.qty,0);
    if (!simple) {
      html += `<div style="margin-top:12px;padding:12px;background:var(--bg-panel);border:1px solid var(--accent);border-radius:12px;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:11px;color:var(--text-secondary);line-height:1.4;"><strong style="color:var(--accent)">Ukupno stavki: ${list.length}</strong> · Komada: ${totalPcs}<br>Materijal: <strong>${totalGrandMat.toFixed(2)} €</strong> · <span style="color:var(--accent)">Kantovanje: <strong>${totalGrandKant.toFixed(2)} €</strong></span></div>
        <div style="text-align:right;"><div style="font-size:10px;color:var(--text-secondary);margin-bottom:2px;font-weight:700;letter-spacing:1px;">UKUPNA VRIJEDNOST</div><div style="font-size:24px;font-weight:900;color:var(--green);">${totalGrand.toFixed(2)} €</div><div style="font-size:12px;font-weight:600;color:var(--text-secondary);opacity:0.7;">${(totalGrand*117).toLocaleString('sr-RS')} RSD</div></div>
      </div>`;
    } else {
      html += `<div style="margin-top:8px;font-size:10px;color:var(--text-dim);text-align:right;">Ukupno komada: ${totalPcs}</div>`;
    }
  }

  wrap.innerHTML = html;
  document.getElementById('modal-krojna').classList.remove('hidden');
}

// ─── Export functions ─────────────────────────────────────────────────────────
export async function exportOptimik() {
  if (state.plan.length === 0) { showNotification('Plan je prazan!', 'warning'); return; }
  const list = computeCuttingList(state.plan);
  const csv = toCsvString(list);
  const name = state.clientName.replace(/\s+/g, '_');
  const res = await window.electronAPI?.saveFile({ filename: `Optimik_${name}.csv`, ext: 'csv', extName: 'CSV', content: csv, encoding: 'utf8' });
  if (res?.success) showNotification('CSV sacuvan!', 'success');
}

export async function exportPdf() {
  if (state.plan.length === 0) { showNotification('Plan je prazan!', 'warning'); return; }
  try {
    const { jsPDF } = window.jspdf;
    const C = isDark ? {
      pageBg:[13,13,23], titleText:[230,230,240], subText:[130,130,170], sectionText:[79,122,255],
      rowFill:[18,18,36], rowText:[200,200,220], rowLine:[40,40,70], headFill:[30,30,60],
      headText:[130,150,255], altFill:[22,22,42], subtotalText:[255,255,255], totalText:[34,197,94],
    } : {
      pageBg:[248,248,252], titleText:[20,20,40], subText:[80,80,120], sectionText:[42,91,232],
      rowFill:[255,255,255], rowText:[30,30,50], rowLine:[200,200,220], headFill:[220,225,248],
      headText:[30,60,180], altFill:[242,242,252], subtotalText:[20,20,40], totalText:[22,163,74],
    };

    const list = computeCuttingList(state.plan);
    const name = state.clientName.replace(/\s+/g, '_');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'A4' });

    // ── Page 1: full-bleed 3D render with overlays ─────────────────────────────
    const imgData = snapshotCanvasFitAll('image/jpeg', 0.92);
    if (imgData) {
      doc.addImage(imgData, 'JPEG', 0, 0, 210, 297); // full A4 portrait
    } else {
      doc.setFillColor(...C.pageBg); doc.rect(0, 0, 210, 297, 'F');
    }

    // Header bar overlay (top strip)
    const headerH = 32;
    doc.setGState(new doc.GState({ opacity: 0.82 }));
    doc.setFillColor(isDark ? 10 : 240, isDark ? 10 : 240, isDark ? 20 : 252);
    doc.rect(0, 0, 210, headerH, 'F');
    doc.setGState(new doc.GState({ opacity: 1 }));

    doc.setTextColor(...C.titleText); doc.setFontSize(15);
    doc.text(`MECO KONFIGURATOR — ${name.toUpperCase()}`, 12, 14);
    doc.setFontSize(9); doc.setTextColor(...C.subText);
    doc.text('Krojna Lista — ' + new Date().toLocaleDateString('bs-BA'), 12, 24);

    // Plan list panel overlay (bottom strip) — compact height
    const panelH = 10 + Math.ceil(state.plan.length / 3) * 7 + 8;
    const panelX = 0, panelY = 297 - panelH, panelW = 210;
    doc.setGState(new doc.GState({ opacity: 0.82 }));
    doc.setFillColor(isDark ? 10 : 240, isDark ? 10 : 240, isDark ? 20 : 252);
    doc.rect(panelX, panelY, panelW, panelH, 'F');
    doc.setGState(new doc.GState({ opacity: 1 }));

    doc.setFontSize(9); doc.setTextColor(...C.sectionText);
    doc.text('PLAN KUHINJE:', panelX + 10, panelY + 8);
    doc.setTextColor(...C.rowText); doc.setFontSize(8);
    const cols = 3, rowH = 7;
    state.plan.forEach((item, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      doc.text((i + 1) + '. ' + item.ime.replace(/_/g, ' '), panelX + 10 + col * 66, panelY + 15 + row * rowH);
    });

    doc.addPage(); doc.setFillColor(...C.pageBg); doc.rect(0, 0, 210, 297, 'F');

    const groups = {};
    list.forEach(r => { if (!groups[r.material]) groups[r.material]=[]; groups[r.material].push(r); });
    let startY = 20;

    for (const [mat, rows] of Object.entries(groups)) {
      // Ensure room for at least the header + one row before starting a new group
      if (startY + 20 > 272) { doc.addPage(); startY = 20; }

      const matHeaderY = startY; // capture for willDrawPage closure
      doc.autoTable({
        startY: matHeaderY + 7, // leave space above for the section header
        head: [['Naziv', 'Dimenzije', 'Kom.', 'Code']],
        body: rows.map(r => [r.name, r.L + 'x' + r.W, r.qty, r.kant || '']),
        columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 38 }, 2: { cellWidth: 18 }, 3: { cellWidth: 34 } },
        styles: { fontSize:8, cellPadding:2, fillColor:C.rowFill, textColor:C.rowText, lineColor:C.rowLine, lineWidth:0.1 },
        headStyles: { fillColor:C.headFill, textColor:C.headText, fontStyle:'bold' },
        alternateRowStyles: { fillColor:C.altFill },
        margin: { left:15, right:15 },
        willDrawPage: (data) => {
          // Fill page background first
          doc.setFillColor(...C.pageBg); doc.rect(0, 0, 210, 297, 'F');
          // Draw section header on top — only on the first page of this group
          if (data.pageNumber === 1) {
            doc.setFontSize(11); doc.setTextColor(...C.sectionText);
            doc.text('▸ ' + mat, 15, matHeaderY + 5);
          }
        }
      });

      startY = doc.lastAutoTable.finalY + 8;
      const matArea = rows.reduce((s,r)=>s+(r.L*r.W/1000000*r.qty),0);
      const matKantCost = rows.reduce((s,r)=>{ const k=calcKant(r.kant,r.L,r.W); return s+(k.k*state.prices.kant_k+k.K*state.prices.kant_K)*r.qty; },0);
      const matCost = (matArea*getPriceForMaterial(mat))+matKantCost;
      doc.setFontSize(9); doc.setTextColor(...C.subtotalText);
      doc.text('Ukupno za ' + mat + ': ' + matCost.toFixed(2) + ' € (' + (matCost*117).toLocaleString('sr-RS') + ' RSD)', 15, startY);
      startY += 10;
    }

    const grandMat = list.reduce((s,r)=>s+(r.L*r.W/1000000*r.qty*getPriceForMaterial(r.material)),0);
    const grandKant = list.reduce((s,r)=>{ const k=calcKant(r.kant,r.L,r.W); return s+(k.k*state.prices.kant_k+k.K*state.prices.kant_K)*r.qty; },0);
    const grandEur = grandMat+grandKant;
    doc.setFontSize(10); doc.setTextColor(...C.rowText);
    doc.text('Materijal: ' + grandMat.toFixed(2) + ' € · Kantovanje: ' + grandKant.toFixed(2) + ' €', 15, startY+5);
    doc.setFontSize(14); doc.setTextColor(...C.totalText);
    doc.text('UKUPNA VRIJEDNOST PONUDE: ' + grandEur.toFixed(2) + ' € (' + (grandEur*117).toLocaleString('sr-RS') + ' RSD)', 15, startY+15);

    const pdfData = doc.output('arraybuffer');
    const uint8 = new Uint8Array(pdfData);
    let binary = '';
    uint8.forEach(b => binary += String.fromCharCode(b));
    const res = await window.electronAPI?.saveFile({ filename: 'Ponuda_' + name + '.pdf', ext:'pdf', extName:'PDF', content: btoa(binary), encoding:'base64' });
    if (res?.success) showNotification('PDF sacuvan!', 'success');
  } catch (err) {
    console.error('PDF error:', err);
    showNotification('Greska pri generisanju PDF-a', 'error');
  }
}

// ─── MPR Generation ───────────────────────────────────────────────────────────
export function generateMPRContent(L_mm, B_mm, settings = {}) {
  const { D = 18, BRR = 4, EX = 24, F = 20, BRP = 1, TR = 70 } = settings;
  const L = Math.round(L_mm);
  const B = Math.round(B_mm);
  const Dv = Math.round(D);
  const f6 = v => `${Math.round(v)}.000000`;

  const lines = [
    '[H',
    'VERSION="4.0 Alpha"','WW="9.0.152"','OP="1"','WRK2="0"','SCHN="0"','CVR="0"','POI="0"','HSP="0"',
    'O2="0"','O4="0"','O3="0"','O5="0"','SR="0"','FM="1"','ML="2000"','UF="STANDARD"','ZS="20"',
    'DN="STANDARD"','DST="0"','GP="0"','GY="0"','GXY="0"','NP="1"','NE="0"','NA="0"','BFS="0"',
    'US="0"','CB="0"','UP="0"','DW="0"','MAT="HOMAG"','HP_A_O="STANDARD"','OVD_U="1"','OVD="0"',
    'OHD_U="0"','OHD="2"','OOMD_U="0"','EWL="1"','INCH="0"','VIEW="NOMIRROR"','ANZ="1"','BES="0"',
    'ENT="0"','MATERIAL=""','CUSTOMER=""','ORDER=""','ARTICLE=""','PARTID=""','PARTTYPE=""',
    'MPRCOUNT="1"','MPRNUMBER="1"','INFO1=""','INFO2=""','INFO3=""','INFO4=""','INFO5=""',
    `_BSX=${f6(L)}`,`_BSY=${f6(B)}`,`_BSZ=${f6(Dv)}`,
    '_FNX=0.000000','_FNY=0.000000','_RNX=0.000000','_RNY=0.000000','_RNZ=0.000000',
    `_RX=${f6(L)}`,`_RY=${f6(B)}`,'',
    '[001',`L="${L}"`,`B="${B}"`,`D="${Dv}"`,`BRR="${BRR}"`,`EX="${EX}"`,`F="${F}"`,`BRP="${BRP}"`,`TR="${TR}"`,
    'KM="Laenge in X"','KM="Breite in Y"','KM="Dicke in Z"','KM="Broj rupa"','KM="Excentar"',
    'KM="Falc"','KM="Broj polica"','KM="Traverza"','',
    '<100 \\WerkStck\\','LA="L"','BR="B"','DI="D"','FNX="0"','FNY="0"','AX="0"','AY="0"','',
    '<109 \\Nuten\\','XA="0"','YA="_BSY-F"','WI="0"','XE="_BSX"','YE="_BSY-F"',
    'RK="WRKL"','EM="MOD2"','AD="0"','TI="7"','TV="0"','VT="0"','MV="GL"','XY="100"','MN="GL"',
    'BL="0"','OP="0"','AN="0"','F_="5"','MT="0"','HU="0"','UZU="1"','ZU="0"','SM="0"',
    'S_="STANDARD"','HP="0"','SP="0"','YVE="0"',
    'WW="40,41,42,43,45,49,144,145,146,147,152,156,157"','ASG="2"','HP_A_O="STANDARD"',
    'KAT="Nuten"','MNM="Vertical sawing"','ORI="1"',
    'MX="0"','MY="0"','MZ="0"','MXF="1"','MYF="1"','MZF="1"','SYA="0"','SYV="0"','KO="00"','',
    '<102 \\BohrVert\\','XA="D/2"','YA="(B-F)/2"','BM="LS"','TI="14"','DU="8"','AN="BRR-2"',
    'MI="1"','S_="1"','S_P="100"','AB="(B-F)/BRR"','WI="90"','ZT="0"','RM="0"','VW="0"',
    'HP="0"','SP="0"','YVE="0"',
    'WW="60,61,62,86,87,88,90,91,92,148,149,150,191,192"','ASG="2"','HP_A_O="STANDARD"',
    'KAT="Bohren vertikal"','MNM="Vertical drilling"','ORI="2"',
    'MX="0"','MY="0"','MZ="0"','MXF="1"','MYF="1"','MZF="1"','SYA="0"','SYV="0"','KO="00"','',
    '<102 \\BohrVert\\','XA="D/2"','YA="(B-F)/2"','BM="LS"','TI="12"','DU="5"','AN="2"',
    'MI="1"','S_="1"','S_P="100"','AB="(B-F)/BRR*(BRR-1)"','WI="90"','ZT="0"','RM="0"','VW="0"',
    'HP="0"','SP="0"','YVE="0"',
    'WW="60,61,62,86,87,88,90,91,92,148,149,150,191,192"','ASG="2"','HP_A_O="STANDARD"',
    'KAT="Bohren vertikal"','MNM="Vertical drilling"','ORI="3"',
    'MX="0"','MY="0"','MZ="0"','MXF="1"','MYF="1"','MZF="1"','SYA="0"','SYV="0"','KO="00"','',
    '<102 \\BohrVert\\','XA="L-D/2"','YA="TR/2"','BM="LS"','TI="14"','DU="8"','AN="2"',
    'MI="1"','S_="1"','S_P="100"','AB="TR/2"','WI="90"','ZT="0"','RM="0"','VW="0"',
    'HP="0"','SP="0"','YVE="0"',
    'WW="60,61,62,86,87,88,90,91,92,148,149,150,191,192"','ASG="2"','HP_A_O="STANDARD"',
    'KAT="Bohren vertikal"','MNM="Vertical drilling"','ORI="4"',
    'MX="0"','MY="0"','MZ="0"','MXF="1"','MYF="1"','MZF="1"','SYA="0"','SYV="0"','KO="00"','',
    '<102 \\BohrVert\\','XA="L-D/2"','YA="B-F-TR/2"','BM="LS"','TI="14"','DU="8"','AN="2"',
    'MI="1"','S_="1"','S_P="100"','AB="TR/2"','WI="90"','ZT="0"','RM="0"','VW="0"',
    'HP="0"','SP="0"','YVE="0"',
    'WW="60,61,62,86,87,88,90,91,92,148,149,150,191,192"','ASG="2"','HP_A_O="STANDARD"',
    'KAT="Bohren vertikal"','MNM="Vertical drilling"','ORI="5"',
    'MX="0"','MY="0"','MZ="0"','MXF="1"','MYF="1"','MZF="1"','SYA="0"','SYV="0"','KO="00"','',
    '<102 \\BohrVert\\','XA="(L-D)/2"','YA="65"','BM="LS"','TI="12"','DU="5"','AN="BRP"',
    'MI="1"','S_="1"','S_P="100"','AB="(L-D)/(BRP+1)"','WI="900"','ZT="0"','RM="0"','VW="0"',
    'HP="0"','SP="0"','YVE="0"',
    'WW="60,61,62,86,87,88,90,91,92,148,149,150,191,192"','ASG="2"','HP_A_O="STANDARD"',
    'KAT="Bohren vertikal"','MNM="Vertical drilling"','ORI="6"',
    'MX="0"','MY="0"','MZ="0"','MXF="1"','MYF="1"','MZF="1"','SYA="0"','SYV="0"','KO="00"','',
    '<102 \\BohrVert\\','XA="(L-D)/2"','YA="B-F-32"','BM="LS"','TI="12"','DU="5"','AN="BRP"',
    'MI="1"','S_="1"','S_P="100"','AB="(L-D)/(BRP+1)"','WI="900"','ZT="0"','RM="0"','VW="0"',
    'HP="0"','SP="0"','YVE="0"',
    'WW="60,61,62,86,87,88,90,91,92,148,149,150,191,192"','ASG="2"','HP_A_O="STANDARD"',
    'KAT="Bohren vertikal"','MNM="Vertical drilling"','ORI="7"',
    'MX="0"','MY="0"','MZ="0"','MXF="1"','MYF="1"','MZF="1"','SYA="0"','SYV="0"','KO="00"',
    '!'
  ];
  return lines.join('\r\n');
}

export function getMPRPanel(moduleItem) {
  const panels = moduleItem.panels || [];
  return panels.find(p => p.name.includes('stran')) || panels[0] || null;
}

export function getMPRSettings(planIdx) {
  const settings = { ...state.mprSettings };
  const planItem = state.plan[planIdx];
  if (planItem?.p) {
    const brp = parseInt(planItem.p.brp ?? planItem.p.BRP, 10);
    if (!isNaN(brp) && brp >= 0) settings.BRP = brp;
  }
  return settings;
}

export async function exportModuleMPR(planIdx) {
  const modules = computeCuttingListByModule(state.plan);
  const m = modules[planIdx];
  if (!m || m.panels.length === 0) { showNotification('Nema panela za ovaj modul!', 'warning'); return; }
  const panel = getMPRPanel(m);
  if (!panel) { showNotification('Nema stranica za MPR!', 'warning'); return; }
  const settings = getMPRSettings(planIdx);
  const content = generateMPRContent(panel.L, panel.W, settings);
  const safeName = m.moduleName.replace(/[^a-zA-Z0-9_]/g, '_');
  const filename = `${m.index}_${safeName}_${panel.L}x${panel.W}.mpr`;
  const res = await window.electronAPI?.saveFile({ filename, ext:'mpr', extName:'MPR CNC', content, encoding:'utf8' });
  if (res?.success) showNotification('MPR sacuvan: ' + filename + ' (BRP=' + settings.BRP + ')', 'success');
}

export async function exportAllMPR() {
  if (state.plan.length === 0) { showNotification('Plan je prazan!', 'warning'); return; }
  const modules = computeCuttingListByModule(state.plan);
  const files = [];
  modules.forEach((m, idx) => {
    const panel = getMPRPanel(m);
    if (!panel) return;
    const settings = getMPRSettings(idx);
    const content = generateMPRContent(panel.L, panel.W, settings);
    const safeName = m.moduleName.replace(/[^a-zA-Z0-9_]/g, '_');
    files.push({ filename: `${m.index}_${safeName}_${panel.L}x${panel.W}.mpr`, content });
  });
  if (files.length === 0) { showNotification('Nema MPR fajlova za eksport!', 'warning'); return; }
  const res = await window.electronAPI?.saveFilesToFolder({ files });
  if (res?.success) showNotification(res.count + ' MPR fajlova sacuvano u ' + res.folder, 'success');
}
