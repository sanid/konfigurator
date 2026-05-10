/**
 * hardware.js
 * Hardware Bill of Materials — maps cabinet types to fittings requirements.
 *
 * Hardware includes: hinges, drawer slides, handles, shelf pins, dowels, etc.
 * Prices are in EUR per unit.
 */

const HARDWARE_PRICES = {
  hinge: 2.5,
  hinge_soft_close: 4.0,
  drawer_slide_400: 8.0,
  drawer_slide_500: 10.0,
  handle_knob: 1.5,
  handle_bar_128: 3.0,
  handle_bar_160: 3.5,
  handle_bar_192: 4.0,
  shelf_pin: 0.15,
  shelf_pin_clip: 0.3,
  dowel_8x30: 0.05,
  eccentric_connector: 0.35,
  cam_lock: 0.25,
  screw_35: 0.02,
  leveler_leg: 0.8,
  leveler_leg_cover: 0.3,
  back_panel_clip: 0.1,
  gola_profile_60cm: 6.0,
  gola_profile_80cm: 8.0,
  gola_mechanism: 4.5,
  countertop_bracket: 1.2,
  wall_bracket: 1.5,
};

/**
 * Maps module type → hardware requirements.
 * Each entry: { item: string, qtyPerDoor/drawer/shelf/unit: number }
 */
const HARDWARE_RULES = {
  radni_stol: (p) => {
    const brvr = parseInt(p.brvr) || 2;
    const brp = parseInt(p.brp) || 1;
    return [
      { item: 'hinge_soft_close', qty: brvr * 2 },
      { item: 'handle_knob', qty: brvr },
      { item: 'shelf_pin_clip', qty: brp * 4 },
      { item: 'dowel_8x30', qty: 8 },
      { item: 'eccentric_connector', qty: 8 },
      { item: 'leveler_leg', qty: 4 },
      { item: 'leveler_leg_cover', qty: 4 },
      { item: 'back_panel_clip', qty: 4 },
    ];
  },
  gola_radni_stol: (p) => {
    const brvr = parseInt(p.brvr) || 2;
    const brp = parseInt(p.brp) || 1;
    const s = parseFloat(p.s) || 60;
    const profileKey = s >= 70 ? 'gola_profile_80cm' : 'gola_profile_60cm';
    return [
      { item: 'hinge_soft_close', qty: brvr * 2 },
      { item: profileKey, qty: brvr },
      { item: 'gola_mechanism', qty: brvr },
      { item: 'shelf_pin_clip', qty: brp * 4 },
      { item: 'dowel_8x30', qty: 8 },
      { item: 'eccentric_connector', qty: 8 },
      { item: 'leveler_leg', qty: 4 },
      { item: 'leveler_leg_cover', qty: 4 },
      { item: 'back_panel_clip', qty: 4 },
    ];
  },
  fiokar: (p) => {
    const brfp = parseInt(p.brfp) || 2;
    const brfd = parseInt(p.brfd) || 1;
    const brp = parseInt(p.brp) || 0;
    const totalDrawers = brfp + brfd;
    return [
      { item: 'drawer_slide_500', qty: totalDrawers * 2 },
      { item: 'handle_bar_128', qty: totalDrawers },
      { item: 'shelf_pin_clip', qty: brp * 4 },
      { item: 'dowel_8x30', qty: 10 },
      { item: 'eccentric_connector', qty: 10 },
      { item: 'leveler_leg', qty: 4 },
      { item: 'leveler_leg_cover', qty: 4 },
      { item: 'back_panel_clip', qty: 4 },
    ];
  },
  fiokar_gola: (p) => {
    const brfp = parseInt(p.brfp) || 2;
    const brfd = parseInt(p.brfd) || 1;
    const totalDrawers = brfp + brfd;
    return [
      { item: 'drawer_slide_500', qty: totalDrawers * 2 },
      { item: 'gola_mechanism', qty: totalDrawers },
      { item: 'dowel_8x30', qty: 10 },
      { item: 'eccentric_connector', qty: 10 },
      { item: 'leveler_leg', qty: 4 },
      { item: 'leveler_leg_cover', qty: 4 },
      { item: 'back_panel_clip', qty: 4 },
    ];
  },
  vrata_sudo_masine: () => [
    { item: 'hinge_soft_close', qty: 2 },
    { item: 'handle_knob', qty: 1 },
    { item: 'dowel_8x30', qty: 4 },
    { item: 'eccentric_connector', qty: 4 },
    { item: 'leveler_leg', qty: 4 },
    { item: 'leveler_leg_cover', qty: 4 },
  ],
  vrata_sudo_masine_gola: () => [
    { item: 'hinge_soft_close', qty: 2 },
    { item: 'gola_mechanism', qty: 1 },
    { item: 'dowel_8x30', qty: 4 },
    { item: 'eccentric_connector', qty: 4 },
    { item: 'leveler_leg', qty: 4 },
    { item: 'leveler_leg_cover', qty: 4 },
  ],
  radni_stol_rerne: () => [
    { item: 'hinge_soft_close', qty: 2 },
    { item: 'handle_knob', qty: 1 },
    { item: 'drawer_slide_400', qty: 2 },
    { item: 'handle_bar_128', qty: 1 },
    { item: 'dowel_8x30', qty: 12 },
    { item: 'eccentric_connector', qty: 10 },
    { item: 'leveler_leg', qty: 4 },
    { item: 'leveler_leg_cover', qty: 4 },
    { item: 'back_panel_clip', qty: 4 },
  ],
  radni_stol_rerne_gola: () => [
    { item: 'hinge_soft_close', qty: 2 },
    { item: 'gola_mechanism', qty: 1 },
    { item: 'drawer_slide_400', qty: 2 },
    { item: 'dowel_8x30', qty: 12 },
    { item: 'eccentric_connector', qty: 10 },
    { item: 'leveler_leg', qty: 4 },
    { item: 'leveler_leg_cover', qty: 4 },
    { item: 'back_panel_clip', qty: 4 },
  ],
  dug_element_90: () => [
    { item: 'hinge_soft_close', qty: 4 },
    { item: 'handle_knob', qty: 2 },
    { item: 'shelf_pin_clip', qty: 4 },
    { item: 'dowel_8x30', qty: 14 },
    { item: 'eccentric_connector', qty: 12 },
    { item: 'leveler_leg', qty: 4 },
    { item: 'leveler_leg_cover', qty: 4 },
    { item: 'back_panel_clip', qty: 8 },
  ],
  dug_element_90_gola: () => [
    { item: 'hinge_soft_close', qty: 4 },
    { item: 'gola_mechanism', qty: 2 },
    { item: 'shelf_pin_clip', qty: 4 },
    { item: 'dowel_8x30', qty: 14 },
    { item: 'eccentric_connector', qty: 12 },
    { item: 'leveler_leg', qty: 4 },
    { item: 'leveler_leg_cover', qty: 4 },
    { item: 'back_panel_clip', qty: 8 },
  ],
  dug_element_90_desni: () => [
    { item: 'hinge_soft_close', qty: 4 },
    { item: 'handle_knob', qty: 2 },
    { item: 'shelf_pin_clip', qty: 4 },
    { item: 'dowel_8x30', qty: 14 },
    { item: 'eccentric_connector', qty: 12 },
    { item: 'leveler_leg', qty: 4 },
    { item: 'leveler_leg_cover', qty: 4 },
    { item: 'back_panel_clip', qty: 8 },
  ],
  dug_element_90_desni_gola: () => [
    { item: 'hinge_soft_close', qty: 4 },
    { item: 'gola_mechanism', qty: 2 },
    { item: 'shelf_pin_clip', qty: 4 },
    { item: 'dowel_8x30', qty: 14 },
    { item: 'eccentric_connector', qty: 12 },
    { item: 'leveler_leg', qty: 4 },
    { item: 'leveler_leg_cover', qty: 4 },
    { item: 'back_panel_clip', qty: 8 },
  ],
  donji_ugaoni_element_45_sa_plocom: () => [
    { item: 'hinge_soft_close', qty: 4 },
    { item: 'handle_knob', qty: 2 },
    { item: 'shelf_pin_clip', qty: 4 },
    { item: 'dowel_8x30', qty: 14 },
    { item: 'eccentric_connector', qty: 12 },
    { item: 'leveler_leg', qty: 4 },
    { item: 'leveler_leg_cover', qty: 4 },
    { item: 'back_panel_clip', qty: 8 },
  ],
  donji_ugaoni_element_45_sa_plocom_gola: () => [
    { item: 'hinge_soft_close', qty: 4 },
    { item: 'gola_mechanism', qty: 2 },
    { item: 'shelf_pin_clip', qty: 4 },
    { item: 'dowel_8x30', qty: 14 },
    { item: 'eccentric_connector', qty: 12 },
    { item: 'leveler_leg', qty: 4 },
    { item: 'leveler_leg_cover', qty: 4 },
    { item: 'back_panel_clip', qty: 8 },
  ],
  klasicna_viseca: (p) => {
    const brvr = parseInt(p.brvr) || 2;
    const brp = parseInt(p.brp) || 1;
    return [
      { item: 'hinge_soft_close', qty: brvr * 2 },
      { item: 'handle_knob', qty: brvr },
      { item: 'shelf_pin_clip', qty: brp * 4 },
      { item: 'dowel_8x30', qty: 8 },
      { item: 'eccentric_connector', qty: 8 },
      { item: 'wall_bracket', qty: 2 },
      { item: 'back_panel_clip', qty: 4 },
    ];
  },
  klasicna_viseca_gola: (p) => {
    const brvr = parseInt(p.brvr) || 1;
    const brp = parseInt(p.brp) || 2;
    const s = parseFloat(p.s) || 60;
    const profileKey = s >= 70 ? 'gola_profile_80cm' : 'gola_profile_60cm';
    return [
      { item: 'hinge_soft_close', qty: brvr * 2 },
      { item: profileKey, qty: brvr },
      { item: 'gola_mechanism', qty: brvr },
      { item: 'shelf_pin_clip', qty: brp * 4 },
      { item: 'dowel_8x30', qty: 8 },
      { item: 'eccentric_connector', qty: 8 },
      { item: 'wall_bracket', qty: 2 },
      { item: 'back_panel_clip', qty: 4 },
    ];
  },
  viseca_na_kipu: (p) => {
    const brvr = parseInt(p.brvr) || 2;
    const brp = parseInt(p.brp) || 2;
    return [
      { item: 'hinge_soft_close', qty: brvr * 2 },
      { item: 'handle_bar_160', qty: brvr },
      { item: 'shelf_pin_clip', qty: brp * 4 },
      { item: 'dowel_8x30', qty: 10 },
      { item: 'eccentric_connector', qty: 10 },
      { item: 'wall_bracket', qty: 2 },
      { item: 'back_panel_clip', qty: 4 },
    ];
  },
  gue90: () => [
    { item: 'hinge_soft_close', qty: 4 },
    { item: 'handle_knob', qty: 2 },
    { item: 'shelf_pin_clip', qty: 4 },
    { item: 'dowel_8x30', qty: 12 },
    { item: 'eccentric_connector', qty: 10 },
    { item: 'wall_bracket', qty: 2 },
    { item: 'back_panel_clip', qty: 6 },
  ],
  radna_ploca: () => [{ item: 'countertop_bracket', qty: 4 }],
  cokla: () => [{ item: 'screw_35', qty: 6 }],
  ormar_visoki: (p) => {
    const brvr = parseInt(p.brvr) || 1;
    const brp = parseInt(p.brp) || 1;
    return [
      { item: 'hinge_soft_close', qty: brvr * 2 },
      { item: 'handle_knob', qty: brvr },
      { item: 'shelf_pin_clip', qty: brp * 4 },
      { item: 'dowel_8x30', qty: 10 },
      { item: 'eccentric_connector', qty: 10 },
      { item: 'leveler_leg', qty: 4 },
      { item: 'leveler_leg_cover', qty: 4 },
      { item: 'back_panel_clip', qty: 4 },
    ];
  },
};

HARDWARE_RULES.klasicna_viseca_gola_ispod_grede = HARDWARE_RULES.klasicna_viseca_gola;
HARDWARE_RULES.viseca_na_kipu_gola = HARDWARE_RULES.viseca_na_kipu;
HARDWARE_RULES.lijevi_gue90 = HARDWARE_RULES.gue90;
HARDWARE_RULES.gue90rotiran = HARDWARE_RULES.gue90;
HARDWARE_RULES.radni_stol_rerne_gola_bez_fioke = HARDWARE_RULES.radni_stol_rerne_gola;
HARDWARE_RULES.radni_stol_pored_stuba = HARDWARE_RULES.radni_stol;
HARDWARE_RULES.radni_stol_pored_stuba_gola = HARDWARE_RULES.gola_radni_stol;
HARDWARE_RULES.visoki_element_za_kombinovani_frizider = HARDWARE_RULES.ormar_visoki;
HARDWARE_RULES.visoki_element_za_kombinovani_frizider_gola = HARDWARE_RULES.ormar_visoki;
HARDWARE_RULES.visoki_element_za_frizider = HARDWARE_RULES.ormar_visoki;
HARDWARE_RULES.visoki_element_za_frizider_gola = HARDWARE_RULES.ormar_visoki;
HARDWARE_RULES.visoki_element_za_rernu = HARDWARE_RULES.ormar_visoki;
HARDWARE_RULES.visoki_element_za_rernu_sa_fiokama = HARDWARE_RULES.fiokar;
HARDWARE_RULES.visoki_element_za_rernu_i_mikrotalasnu_pec_sa_fiokama = HARDWARE_RULES.fiokar;

/**
 * computeHardwareBOM — compute hardware bill of materials for the entire plan.
 * @param {Array} plan - Array of module records
 * @returns {{ items: Array<{item, name, qty, unitPrice, total}>, grandTotal: number }}
 */
export function computeHardwareBOM(plan) {
  const agg = new Map();

  for (const item of plan) {
    const rule = HARDWARE_RULES[item.ime];
    if (!rule) continue;
    const p = _coerceNumeric(item.p || {});
    const requirements = rule(p);
    for (const req of requirements) {
      const existing = agg.get(req.item);
      if (existing) {
        existing.qty += req.qty;
      } else {
        const price = HARDWARE_PRICES[req.item] || 0;
        agg.set(req.item, { item: req.item, name: _hardwareName(req.item), qty: req.qty, unitPrice: price });
      }
    }
  }

  const items = [...agg.values()]
    .map((entry) => ({
      ...entry,
      total: Math.round(entry.qty * entry.unitPrice * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total);

  const grandTotal = items.reduce((sum, i) => sum + i.total, 0);
  return { items, grandTotal: Math.round(grandTotal * 100) / 100 };
}

export { HARDWARE_PRICES };

const HARDWARE_NAMES = {
  hinge: 'Zglob',
  hinge_soft_close: 'Zglob soft-close',
  drawer_slide_400: 'Vodilica fioka 400mm',
  drawer_slide_500: 'Vodilica fioka 500mm',
  handle_knob: 'Kvaka gumb',
  handle_bar_128: 'Kvaka šipka 128mm',
  handle_bar_160: 'Kvaka šipka 160mm',
  handle_bar_192: 'Kvaka šipka 192mm',
  shelf_pin: 'Nosač police',
  shelf_pin_clip: 'Nosač police clip',
  dowel_8x30: 'Ftič 8×30',
  eccentric_connector: 'Excentar',
  cam_lock: 'Katanac',
  screw_35: 'Šraf 3.5mm',
  leveler_leg: 'Nogar',
  leveler_leg_cover: 'Poklopac nogara',
  back_panel_clip: 'Klip lesonita',
  gola_profile_60cm: 'Gola profil 60cm',
  gola_profile_80cm: 'Gola profil 80cm',
  gola_mechanism: 'Gola mehanizam',
  countertop_bracket: 'Konzola radne ploče',
  wall_bracket: 'Zidni nosač',
};

function _hardwareName(key) {
  return HARDWARE_NAMES[key] || key;
}

function _coerceNumeric(params) {
  const p = {};
  for (const [k, v] of Object.entries(params)) {
    const n = parseFloat(v);
    p[k] = isNaN(n) ? v : n;
  }
  return p;
}
