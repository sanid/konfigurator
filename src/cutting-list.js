/**
 * cutting-list.js
 * Computes panel cutting lists (krojna lista) from kitchen plan.
 * Replicates the ECHO statements from moduli.scad in pure JavaScript.
 *
 * All inputs are in cm (UI units).
 * All outputs are in mm (×10 from cm).
 */

const M = 1.8; // 18mm board → 1.8cm (univer 18mm)
const M16 = 1.6; // 16mm board
const MDF = 1.8; // 18mm MDF
const HDF = 0.3; // 3mm HDF

/** Convert cm → mm (integer) */
const mm = v => Math.round(v * 10);

/**
 * Each function returns an array of panel objects:
 * { material, name, L, W, qty, kant }
 * L and W are in mm.
 */

function panels_radni_stol(p) {
  const { s, v, d, c, brvr = 2, brp = 1 } = p;
  const parts = [];
  parts.push({ material: 'UNIVER 18MM', name: 'stranice m1', L: mm(v - c), W: mm(d), qty: 2, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'dno m1', L: mm(s - 2 * M), W: mm(d), qty: 1, kant: '1d' });
  parts.push({ material: 'UNIVER 18MM', name: 'traverzne m1', L: mm(s - 2 * M), W: 70, qty: 1, kant: '2d' });
  parts.push({ material: 'HDF 3MM', name: 'lesonit hdf', L: mm(s), W: mm(v - c), qty: 1, kant: '' });
  if (brp > 0) {
    parts.push({ material: 'UNIVER 18MM', name: 'police m1', L: mm(s - 2 * M), W: mm(d - 5), qty: brp, kant: '1d' });
  }
  if (brvr > 0) {
    parts.push({ material: 'MDF 18MM', name: 'vrata mdf', L: mm(v - c - 0.3), W: mm(s / brvr - 0.3), qty: brvr, kant: '2d i 2k' });
  }
  return parts;
}

function panels_gola_radni_stol(p) {
  const { s, v, d, c, brvr = 2, brp = 1 } = p;
  const parts = [];
  parts.push({ material: 'UNIVER 18MM', name: 'stranice m1', L: mm(v - c), W: mm(d), qty: 2, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'dno m1', L: mm(s - 2 * M), W: mm(d), qty: 1, kant: '1d' });
  parts.push({ material: 'UNIVER 18MM', name: 'traverzne m1', L: mm(s - 2 * M), W: 70, qty: 1, kant: '2d' });
  parts.push({ material: 'HDF 3MM', name: 'lesonit hdf', L: mm(s), W: mm(v - c), qty: 1, kant: '' });
  if (brp > 0) {
    parts.push({ material: 'UNIVER 18MM', name: 'police m1', L: mm(s - 2 * M), W: mm(d - 5), qty: brp, kant: '1d' });
  }
  if (brvr > 0) {
    parts.push({ material: 'MDF 18MM', name: 'vrata mdf', L: mm(v - c - 3.3), W: mm(s / brvr - 0.3), qty: brvr, kant: '2d i 2k' });
  }
  return parts;
}

function panels_fiokar(p) {
  const { s, v, d, c, brf = 4, brfp = 2, brfd = 1 } = p;
  const kl = 50; // drawer depth default
  const parts = [];
  parts.push({ material: 'UNIVER 18MM', name: 'stranice m1', L: mm(v - c), W: mm(d), qty: 2, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'dno m1', L: mm(s - 2 * M), W: mm(d), qty: 1, kant: '1d' });
  parts.push({ material: 'UNIVER 18MM', name: 'traverzne m1', L: mm(s - 2 * M), W: 70, qty: 1, kant: '2d' });
  parts.push({ material: 'HDF 3MM', name: 'lesonit hdf', L: mm(s), W: mm(v - c), qty: 1, kant: '' });
  // Deep drawer front
  if (brfd > 0) {
    parts.push({ material: 'MDF 18MM', name: 'celo_duboke_fioke mdf', L: mm((v - c) / brf * 2 - 0.3), W: mm(s - 0.3), qty: brfd, kant: '2d i 2k' });
    parts.push({ material: 'UNIVER 16MM', name: 'stranica_duboke_fioke m', L: mm((v - c) / brf * 2 - 5.8), W: mm(kl - 0.8), qty: brfd * 2, kant: '2d i 2k' });
    parts.push({ material: 'UNIVER 18MM', name: 'p/z_str_duboke m1', L: mm((v - c) / brf * 2 - 5.8 - 1.2 - M), W: mm(s - 2 * M - 0.8 - 2 * M16), qty: brfd * 2, kant: '1d' });
    parts.push({ material: 'UNIVER 18MM', name: 'dno_duboke_fioke m1', L: mm(kl - 1.0), W: mm(s - 2 * M - 0.8 - 2 * M16), qty: brfd, kant: '2d' });
  }
  // Shallow drawer fronts
  if (brfp > 0) {
    parts.push({ material: 'MDF 18MM', name: 'celo_plitke_fioke mdf', L: mm((v - c) / brf - 0.3), W: mm(s - 0.3), qty: brfp, kant: '2d i 2k' });
    parts.push({ material: 'UNIVER 16MM', name: 'stranica_plitke_fioke m', L: mm((v - c) / brf - 5.8), W: mm(kl - 0.8), qty: brfp * 2, kant: '2d i 2k' });
    parts.push({ material: 'UNIVER 18MM', name: 'p/z_str_plitke m1', L: mm((v - c) / brf - 5.8 - 1.2 - M), W: mm(s - 2 * M - 0.8 - 2 * M16), qty: brfp * 2, kant: '1d' });
    parts.push({ material: 'UNIVER 18MM', name: 'dno_plitke_fioke m1', L: mm(kl - 1.0), W: mm(s - 2 * M - 0.8 - 2 * M16), qty: brfp, kant: '2d' });
  }
  return parts;
}

function panels_fiokar_gola(p) {
  return panels_fiokar(p); // same panels
}

function panels_vrata_sudo_masine(p) {
  const { s, v, d, c } = p;
  return [
    { material: 'MDF 18MM', name: 'vrata_sudo_masine mdf', L: mm(v - c - 0.3), W: mm(s - 0.3), qty: 1, kant: '2d i 2k' }
  ];
}

function panels_radni_stol_rerne(p) {
  const { s, v, d, c, rerna = 58.5 } = p;
  const parts = [];
  parts.push({ material: 'UNIVER 18MM', name: 'stranice m1', L: mm(v - c), W: mm(d), qty: 2, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'dno m1', L: mm(s - 2 * M), W: mm(d), qty: 2, kant: '1d' });
  parts.push({ material: 'UNIVER 18MM', name: 'traverzne m1', L: mm(s - 2 * M), W: 70, qty: 2, kant: '2d' });
  parts.push({ material: 'HDF 3MM', name: 'lesonit hdf', L: mm(s), W: mm(v - c), qty: 1, kant: '' });
  const fh = v - c - M - rerna - 0.3;
  if (fh > 0) {
    parts.push({ material: 'MDF 18MM', name: 'celo_fioke mdf', L: mm(fh), W: mm(s - 0.3), qty: 1, kant: '2d i 2k' });
  }
  return parts;
}

function panels_radni_stol_rerne_gola(p) {
  return panels_radni_stol_rerne(p);
}

function panels_dug_element_90(p) {
  const { dss, lss, v, d, c, brp = 1 } = p;
  const parts = [];
  parts.push({ material: 'UNIVER 18MM', name: 'stranice m1', L: mm(v - c), W: mm(d), qty: 3, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'dno m1', L: mm(dss - 2 * M), W: mm(d), qty: 1, kant: '1d' });
  parts.push({ material: 'UNIVER 18MM', name: 'dno krace m1', L: mm(lss - d - M), W: mm(d), qty: 1, kant: '1d' });
  parts.push({ material: 'UNIVER 18MM', name: 'traverzne m1', L: mm(dss - 2 * M), W: 70, qty: 2, kant: '2d' });
  parts.push({ material: 'HDF 3MM', name: 'lesonit hdf', L: mm(dss), W: mm(v - c), qty: 1, kant: '' });
  parts.push({ material: 'HDF 3MM', name: 'lesonit hdf', L: mm(lss - d + 3.0), W: mm(v - c), qty: 1, kant: '' });
  if (brp > 0) {
    parts.push({ material: 'UNIVER 18MM', name: 'police m1', L: mm(dss - 2 * M), W: mm(d - 5), qty: brp, kant: '1d' });
    parts.push({ material: 'UNIVER 18MM', name: 'police krace m1', L: mm(lss - M - d + 5), W: mm(d - 5), qty: brp, kant: '1d i 1k' });
  }
  const dh = v - c - 0.3;
  parts.push({ material: 'MDF 18MM', name: 'vrata_d mdf', L: mm(dh), W: mm(dss - d - MDF - 0.3), qty: 1, kant: '2d i 2k' });
  parts.push({ material: 'MDF 18MM', name: 'vrata_l mdf', L: mm(dh), W: mm(lss - d - MDF - 0.3), qty: 1, kant: '2d i 2k' });
  return parts;
}

function panels_klasicna_viseca(p) {
  const { s, v, d, brp = 1, brvr = 2 } = p;
  const parts = [];
  parts.push({ material: 'UNIVER 18MM', name: 'stranice m1', L: mm(v), W: mm(d), qty: 2, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'dno i plafon m1', L: mm(s - 2 * M), W: mm(d), qty: 2, kant: '1d' });
  parts.push({ material: 'HDF 3MM', name: 'lesonit hdf', L: mm(s), W: mm(v), qty: 1, kant: '' });
  if (brp > 0) {
    parts.push({ material: 'UNIVER 18MM', name: 'police m1', L: mm(s - 2 * M), W: mm(d - 3), qty: brp, kant: '1d' });
  }
  if (brvr > 0) {
    parts.push({ material: 'MDF 18MM', name: 'vrata mdf', L: mm(v - 0.3), W: mm(s / brvr - 0.3), qty: brvr, kant: '2d i 2k' });
  }
  return parts;
}

function panels_klasicna_viseca_gola(p) {
  const { s, v, d, brp = 2, brvr = 1 } = p;
  const parts = [];
  parts.push({ material: 'UNIVER 18MM', name: 'stranice m1', L: mm(v), W: mm(d), qty: 2, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'dno m1', L: mm(s - 2 * M), W: mm(d - 2.2), qty: 1, kant: '1d' });
  parts.push({ material: 'UNIVER 18MM', name: 'plafon m1', L: mm(s - 2 * M), W: mm(d), qty: 1, kant: '1d' });
  parts.push({ material: 'HDF 3MM', name: 'lesonit hdf', L: mm(s), W: mm(v), qty: 1, kant: '' });
  if (brp > 0) {
    parts.push({ material: 'UNIVER 18MM', name: 'police m1', L: mm(s - 2 * M), W: mm(d - 3), qty: brp, kant: '1d' });
  }
  if (brvr > 0) {
    parts.push({ material: 'MDF 18MM', name: 'vrata mdf', L: mm(v - 0.3), W: mm(s / brvr - 0.3), qty: brvr, kant: '2d i 2k' });
  }
  return parts;
}

function panels_viseca_na_kipu(p) {
  const { s, v, d, brp = 2, brvr = 2 } = p;
  const parts = [];
  parts.push({ material: 'UNIVER 18MM', name: 'stranice m1', L: mm(v), W: mm(d), qty: 2, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'plafon i srednja m1', L: mm(s - 2 * M), W: mm(d), qty: 3, kant: '1d' });
  parts.push({ material: 'HDF 3MM', name: 'lesonit hdf', L: mm(s), W: mm(v), qty: 1, kant: '' });
  if (brp > 0) {
    parts.push({ material: 'UNIVER 18MM', name: 'police m1', L: mm(s - 2 * M), W: mm(d - 3), qty: brp, kant: '1d' });
  }
  if (brvr > 0) {
    parts.push({ material: 'MDF 18MM', name: 'vrata mdf', L: mm(v / 2 - 0.3), W: mm(s - 0.3), qty: brvr, kant: '2d i 2k' });
  }
  return parts;
}

function panels_gue90(p) {
  const { sl, sd, v, d, brp = 1 } = p;
  const parts = [];
  parts.push({ material: 'UNIVER 18MM', name: 'stranice m1', L: mm(v), W: mm(d), qty: 3, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'siri pod i plafon m1', L: mm(sl - 2 * M), W: mm(d), qty: 2, kant: '1d' });
  parts.push({ material: 'UNIVER 18MM', name: 'uzi pod i plafon m1', L: mm(sd - d - M), W: mm(d), qty: 2, kant: '1d i 1k' });
  parts.push({ material: 'HDF 3MM', name: 'pozadina l hdf', L: mm(v), W: mm(sl), qty: 1, kant: '' });
  parts.push({ material: 'HDF 3MM', name: 'pozadina d hdf', L: mm(v), W: mm(sd - d + 2.5), qty: 1, kant: '' });
  if (brp > 0) {
    parts.push({ material: 'UNIVER 18MM', name: 'polica duze m1', L: mm(sl - 2 * M), W: mm(d - 3), qty: brp, kant: '1d i 1k' });
    parts.push({ material: 'UNIVER 18MM', name: 'polica krace m1', L: mm(sd - d + 3 - M), W: mm(d - 3), qty: brp, kant: '1d i 1k' });
  }
  parts.push({ material: 'MDF 18MM', name: 'vrata l mdf', L: mm(v - 0.6), W: mm(sl - d - MDF - HDF - 0.2), qty: 1, kant: '2d i 2k' });
  parts.push({ material: 'MDF 18MM', name: 'vrata d mdf', L: mm(v - 0.6), W: mm(sd - d - MDF - HDF - 0.2), qty: 1, kant: '2d i 2k' });
  return parts;
}

function panels_radna_ploca(p) {
  const { l, d = 60, debljina = 3.8 } = p;
  return [
    { material: 'RADNA PLOCA 38MM', name: 'radna_ploca', L: mm(l), W: mm(d), qty: 1, kant: '/' }
  ];
}

function panels_cokla(p) {
  const { l, h = 9.5, debljina = 1.8 } = p;
  return [
    { material: 'MDF 18MM', name: 'cokla', L: mm(l), W: mm(h), qty: 1, kant: '2d i 2k' }
  ];
}

function panels_ormar_visoki(p) {
  return panels_radni_stol(p); // reuse base cabinet panels as approximation
}

function panels_radni_stol_pored_stuba(p) {
  const { s, v, d, c, brp = 1, brv = 2, ss = 20, ds = 17 } = p;
  const parts = [];
  parts.push({ material: 'UNIVER 18MM', name: 'stranica m1', L: mm(v - c), W: mm(d), qty: 1, kant: '1d i 2k' });
  parts.push({ material: 'MDF 18MM', name: 'stranica do stuba mdf', L: mm(v - c), W: mm(d - ds), qty: 1, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'stranica do stuba bocna m1', L: mm(v - c - 2 * M), W: mm(ds), qty: 1, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'prednja stranica do stuba m1', L: mm(v - c - 2 * M), W: mm(ss), qty: 1, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'dno m1', L: mm(s - 2 * M), W: mm(d), qty: 1, kant: '1d' });
  parts.push({ material: 'UNIVER 18MM', name: 'traverzna m1', L: mm(s - 2 * M), W: 70, qty: 1, kant: '2d' });
  parts.push({ material: 'UNIVER 18MM', name: 'traverzna do stuba m1', L: mm(s - M - ss), W: 70, qty: 1, kant: '2d' });
  parts.push({ material: 'HDF 3MM', name: 'lesonit hdf', L: mm(s - ss), W: mm(v - c), qty: 1, kant: '' });
  if (brp > 0) {
    parts.push({ material: 'UNIVER 18MM', name: 'police m1', L: mm(s - 2 * M), W: mm(d - 5), qty: brp, kant: '1d' });
  }
  if (brv > 0) {
    parts.push({ material: 'MDF 18MM', name: 'vrata mdf', L: mm(v - c - 0.3), W: mm(s / brv - 0.3), qty: brv, kant: '2d i 2k' });
  }
  return parts;
}

function panels_radni_stol_pored_stuba_gola(p) {
  const { s, v, d, c, brp = 1, brv = 2, ss = 20, ds = 17 } = p;
  const parts = [];
  parts.push({ material: 'UNIVER 18MM', name: 'stranica m1', L: mm(v - c), W: mm(d), qty: 1, kant: '1d i 2k' });
  parts.push({ material: 'MDF 18MM', name: 'stranica do stuba mdf', L: mm(v - c), W: mm(d - ds), qty: 1, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'stranica do stuba bocna m1', L: mm(v - c - 2 * M), W: mm(ds), qty: 1, kant: '1d i 2k' });
  parts.push({ material: 'MDF 18MM', name: 'prednja stranica do stuba mdf', L: mm(v - c - 2 * M), W: mm(ss), qty: 1, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'dno m1', L: mm(s - 2 * M), W: mm(d), qty: 1, kant: '1d' });
  parts.push({ material: 'UNIVER 18MM', name: 'traverzna m1', L: mm(s - 2 * M), W: 70, qty: 1, kant: '2d' });
  parts.push({ material: 'UNIVER 18MM', name: 'traverzna do stuba m1', L: mm(s - M - ss), W: 70, qty: 1, kant: '2d' });
  parts.push({ material: 'HDF 3MM', name: 'lesonit hdf', L: mm(s - ss), W: mm(v - c), qty: 1, kant: '' });
  if (brp > 0) {
    parts.push({ material: 'UNIVER 18MM', name: 'police m1', L: mm(s - 2 * M), W: mm(d - 5), qty: brp, kant: '1d' });
  }
  if (brv > 0) {
    parts.push({ material: 'MDF 18MM', name: 'vrata mdf', L: mm(v - c - 3.3), W: mm(s / brv - 0.3), qty: brv, kant: '2d i 2k' });
  }
  return parts;
}

function panels_lijevi_gue90(p) {
  // Same as gue90, but sl/sd roles are swapped in SCAD calls but for cutting list it's identical pieces
  return panels_gue90(p);
}

function panels_visoki_frizider(p, isCombo = false, isGola = false) {
  const { s, v, vde, d, c, brp = 2, brv = 1, frizider = 180 } = p;
  const parts = [];
  parts.push({ material: 'UNIVER 18MM', name: isGola ? 'stranica sa rukohvatom m1' : 'stranica m1', L: mm(v - c - 3 * M), W: mm(isGola ? d - 2.2 : d), qty: 1, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'stranica m1', L: mm(v - c - 3 * M), W: mm(d), qty: 1, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'dno m1', L: mm(s), W: mm(d), qty: 1, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'police vezne m1', L: mm(s - 2 * M), W: mm(d - 3), qty: 2, kant: '1d i 2k' });
  parts.push({ material: 'HDF 3MM', name: 'lesonit hdf', L: mm(s - M), W: mm(v - frizider - c - 1.3), qty: 1, kant: '' });
  if (brp > 0) {
    parts.push({ material: 'UNIVER 18MM', name: 'police m1', L: mm(s - 2 * M), W: mm(d - 8), qty: brp, kant: '1d' });
  }
  const dh_main = v - frizider - 1.3 - c - 3 * M - 0.3;
  parts.push({ material: 'MDF 18MM', name: 'vrata gornja mdf', L: mm(dh_main), W: mm(s / brv - 0.3), qty: brv, kant: '2d i 2k' });
  parts.push({ material: 'MDF 18MM', name: 'vrata donja mdf', L: mm(vde - c - 0.3), W: mm(s - 0.3), qty: 1, kant: '2d i 2k' });
  if (isCombo) {
    const dh_mid = (v - vde) - (v - frizider - 1.3 - c - M) - 0.3;
    parts.push({ material: 'MDF 18MM', name: 'vrata srednja mdf', L: mm(dh_mid), W: mm(s - 0.3), qty: 1, kant: '2d i 2k' });
  }
  return parts;
}

function panels_visoki_rerna(p, hasDrawers = false, hasMicro = false) {
  const { s, v, vde, d, c, brp = 2, brv = 1, rerna = 58.5, mikrovele = 38 } = p;
  const parts = [];
  parts.push({ material: 'UNIVER 18MM', name: 'stranica m1', L: mm(v - c - 3 * M), W: mm(d), qty: 2, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'dno m1', L: mm(s), W: mm(d), qty: 1, kant: '1d i 2k' });
  parts.push({ material: 'UNIVER 18MM', name: 'police vezne m1', L: mm(s - 2 * M), W: mm(d - 3), qty: hasMicro ? 4 : 3, kant: '1k' });
  parts.push({ material: 'HDF 3MM', name: 'lesonit hdf', L: mm(s - M), W: mm(vde - c + M / 2), qty: 1, kant: '' });
  const up_lh = hasMicro ? (v - vde - rerna - mikrovele - 3 * M) : (v - vde - rerna - 2 * M);
  if (up_lh > 0) {
    parts.push({ material: 'HDF 3MM', name: 'lesonit gornji hdf', L: mm(s - M), W: mm(up_lh), qty: 1, kant: '' });
  }
  if (brp > 0) {
    parts.push({ material: 'UNIVER 18MM', name: 'police m1', L: mm(s - 2 * M), W: mm(d - 8), qty: brp + 1, kant: '1d' });
  }
  const dh_up = hasMicro ? (v - vde - rerna - mikrovele - 0.8 - 3 * M - 0.3) : (v - vde - rerna - 3 * M - 0.3);
  if (dh_up > 0) {
    parts.push({ material: 'MDF 18MM', name: 'vrata gornja mdf', L: mm(dh_up), W: mm(s / brv - 0.3), qty: brv, kant: '2d i 2k' });
  }
  if (!hasDrawers) {
    parts.push({ material: 'MDF 18MM', name: 'vrata donja mdf', L: mm(vde - c - 0.3), W: mm(s - 0.3), qty: 1, kant: '2d i 2k' });
  } else {
    const brf = 4;
    const pom = (vde - c) / brf;
    parts.push({ material: 'MDF 18MM', name: 'celo_duboke_fioke mdf', L: mm(pom * 2 - 0.3), W: mm(s - 0.3), qty: 1, kant: '2d i 2k' });
    parts.push({ material: 'MDF 18MM', name: 'celo_plitke_fioke mdf', L: mm(pom - 0.3), W: mm(s - 0.3), qty: 2, kant: '2d i 2k' });
  }
  return parts;
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────
const PANEL_FNS = {
  radni_stol: panels_radni_stol,
  gola_radni_stol: panels_gola_radni_stol,
  fiokar: panels_fiokar,
  fiokar_gola: panels_fiokar_gola,
  vrata_sudo_masine: panels_vrata_sudo_masine,
  vrata_sudo_masine_gola: panels_vrata_sudo_masine,
  radni_stol_rerne: panels_radni_stol_rerne,
  radni_stol_rerne_gola: panels_radni_stol_rerne_gola,
  sporet: () => [],
  samostojeci_frizider: () => [],
  dug_element_90: panels_dug_element_90,
  dug_element_90_gola: panels_dug_element_90,
  donji_ugaoni_element_45_sa_plocom: panels_dug_element_90,
  donji_ugaoni_element_45_sa_plocom_gola: panels_dug_element_90,
  klasicna_viseca: panels_klasicna_viseca,
  klasicna_viseca_gola: panels_klasicna_viseca_gola,
  klasicna_viseca_gola_ispod_grede: panels_klasicna_viseca_gola,
  viseca_na_kipu: panels_viseca_na_kipu,
  viseca_na_kipu_gola: panels_viseca_na_kipu,
  gue90: panels_gue90,
  gue90rotiran: panels_gue90,
  lijevi_gue90: panels_lijevi_gue90,
  radna_ploca: panels_radna_ploca,
  cokla: panels_cokla,
  radni_stol_pored_stuba: panels_radni_stol_pored_stuba,
  radni_stol_pored_stuba_gola: panels_radni_stol_pored_stuba_gola,
  ormar_visoki: panels_ormar_visoki,
  visoki_element_za_kombinovani_frizider: p => panels_visoki_frizider(p, true, false),
  visoki_element_za_kombinovani_frizider_gola: p => panels_visoki_frizider(p, true, true),
  visoki_element_za_frizider: p => panels_visoki_frizider(p, false, false),
  visoki_element_za_frizider_gola: p => panels_visoki_frizider(p, false, true),
  visoki_element_za_rernu: p => panels_visoki_rerna(p, false, false),
  visoki_element_za_rernu_sa_fiokama: p => panels_visoki_rerna(p, true, false),
  visoki_element_za_rernu_i_mikrotalasnu_pec_sa_fiokama: p => panels_visoki_rerna(p, true, true)
};

/**
 * computeCuttingList — aggregate cutting list from the full kitchen plan.
 * @param {Array} plan - Array of module records
 * @returns {Array} sorted by material, then name: [{material, name, L, W, qty, kant}]
 */
export function computeCuttingList(plan) {
  const agg = new Map();

  for (const item of plan) {
    const fn = PANEL_FNS[item.ime];
    if (!fn) continue;

    // Convert params to numbers
    const p = {};
    for (const [k, v] of Object.entries(item.p || {})) {
      const n = parseFloat(v);
      p[k] = isNaN(n) ? v : n;
    }

    const panels = fn(p);
    for (const panel of panels) {
      if (!panel || panel.L <= 0 || panel.W <= 0) continue;
      const key = `${panel.material}||${panel.name}||${panel.L}||${panel.W}||${panel.kant}`;
      const existing = agg.get(key);
      if (existing) {
        existing.qty += panel.qty;
      } else {
        agg.set(key, { ...panel });
      }
    }
  }

  return [...agg.values()].sort((a, b) => {
    const mc = a.material.localeCompare(b.material);
    return mc !== 0 ? mc : a.name.localeCompare(b.name);
  });
}

/**
 * toCsvString — convert cutting list to CSV string (Optimik format).
 */
export function toCsvString(list) {
  const header = 'NAZIV;MATERIJAL;DUZINA;SIRINA;KOMADA;KANTOVANJE\r\n';
  const rows = list.map(r =>
    `${r.name};${r.material};${r.L};${r.W};${r.qty};${r.kant || ''}`
  ).join('\r\n');
  return '\uFEFF' + header + rows; // BOM for Excel UTF-8
}
