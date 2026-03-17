/**
 * modules-config.js
 * Kitchen module definitions — replaces moduli.scad parameter scanning.
 * Parameters are in cm (matching the original Python app's UI units).
 * Material constants (in cm): M=1.6, M1=1.8, MDF=1.8, HDF=0.3
 */

export const M = 1.6;   // 16mm board
export const M1 = 1.8;   // 18mm board
export const MDF = 1.8;   // 18mm MDF front
export const HDF = 0.3;   // 3mm HDF back panel
export const RPL = 3.8;   // 38mm worktop

// Default display settings
export const DEFAULT_SETTINGS = {
  front_vrata: true,
  polica: true,
  pozadina: true,
  celafioka: true,
  fioke: true,
  radna_ploca: true,
  side_walls: false
};

// Default materials
export const DEFAULT_MATERIALS = {
  front: { name: 'white', color: '#F5F5F5', type: 'color' },
  korpus: { name: 'white', color: '#F5F5F5', type: 'color' },
  radna: { name: 'Moccasin', color: '#D2B48C', type: 'color' },
  granc: { name: 'DimGray', color: '#696969', type: 'color' },
  cokla: { name: 'Silver', color: '#C0C0C0', type: 'color' }
};

/**
 * MODULE_GROUPS: [category][moduleName] = [[paramName, defaultValue], ...]
 * Mirrors the OpenSCAD module signatures, values in cm.
 */
export const MODULE_GROUPS = {
  'Donji': {
    'radni_stol': [
      ['s', '60'],
      ['v', '82'],
      ['d', '55'],
      ['c', '10'],
      ['brvr', '2'],
      ['brp', '1']
    ],
    'fiokar': [
      ['s', '60'],
      ['v', '82'],
      ['d', '55'],
      ['c', '10'],
      ['brf', '4'],
      ['brfp', '2'],
      ['brfd', '1']
    ],
    'gola_radni_stol': [
      ['s', '60'],
      ['v', '88'],
      ['d', '55'],
      ['c', '10'],
      ['brp', '1'],
      ['brvr', '2']
    ],
    'fiokar_gola': [
      ['s', '60'],
      ['v', '88'],
      ['d', '55'],
      ['c', '10'],
      ['brf', '4'],
      ['brfp', '2'],
      ['brfd', '1']
    ],
    'vrata_sudo_masine': [
      ['s', '60'],
      ['v', '82'],
      ['d', '55'],
      ['c', '10']
    ],
    'vrata_sudo_masine_gola': [
      ['s', '60'],
      ['v', '88'],
      ['d', '55'],
      ['c', '10']
    ],
    'radni_stol_rerne': [
      ['s', '60'],
      ['v', '82'],
      ['d', '55'],
      ['c', '10'],
      ['rerna', '58.5']
    ],
    'radni_stol_rerne_gola': [
      ['s', '60'],
      ['v', '88'],
      ['d', '55'],
      ['c', '10'],
      ['rerna', '58.5']
    ],
    'radni_stol_rerne_gola_bez_fioke': [
      ['s', '60'],
      ['v', '88'],
      ['d', '55'],
      ['c', '10'],
      ['rerna', '58.5']
    ],
    'sporet': [
      ['s', '60'],
      ['v', '85'],
      ['d', '60']
    ],
    'samostojeci_frizider': [
      ['s', '60'],
      ['v', '185'],
      ['d', '65']
    ],
    'radni_stol_pored_stuba': [
      ['s', '70'],
      ['v', '82'],
      ['d', '55'],
      ['c', '10'],
      ['brp', '1'],
      ['brv', '2'],
      ['ss', '20'],
      ['ds', '17'],
      ['vs', '250']
    ],
    'radni_stol_pored_stuba_gola': [
      ['s', '70'],
      ['v', '82'],
      ['d', '55'],
      ['c', '10'],
      ['brv', '2'],
      ['ss', '20'],
      ['ds', '17']
    ]
  },
  'Ugaoni': {
    'dug_element_90': [
      ['dss', '80'],
      ['lss', '90'],
      ['v', '82'],
      ['d', '55'],
      ['c', '10'],
      ['brp', '1']
    ],
    'dug_element_90_gola': [
      ['dss', '100'],
      ['lss', '80'],
      ['v', '88'],
      ['d', '55'],
      ['c', '10'],
      ['brp', '1']
    ],
    'dug_element_90_desni': [
      ['dss', '80'],
      ['lss', '90'],
      ['v', '82'],
      ['d', '55'],
      ['c', '10'],
      ['brp', '1']
    ],
    'dug_element_90_desni_gola': [
      ['dss', '100'],
      ['lss', '80'],
      ['v', '88'],
      ['d', '55'],
      ['c', '10'],
      ['brp', '1']
    ],
    'donji_ugaoni_element_45_sa_plocom': [
      ['dss', '90'],
      ['lss', '90'],
      ['v', '82'],
      ['d', '55'],
      ['c', '10']
    ],
    'donji_ugaoni_element_45_sa_plocom_gola': [
      ['dss', '90'],
      ['lss', '90'],
      ['v', '88'],
      ['d', '55'],
      ['c', '10']
    ]
  },
  'Gornji': {
    'klasicna_viseca': [
      ['s', '60'],
      ['v', '72'],
      ['d', '35'],
      ['brp', '1'],
      ['brvr', '2']
    ],
    'klasicna_viseca_gola': [
      ['s', '30'],
      ['v', '80'],
      ['d', '35'],
      ['brp', '2'],
      ['brvr', '1']
    ],
    'klasicna_viseca_gola_ispod_grede': [
      ['s', '35'],
      ['v', '80'],
      ['d', '35'],
      ['brp', '2'],
      ['brvr', '2']
    ],
    'viseca_na_kipu': [
      ['s', '80'],
      ['v', '100'],
      ['d', '35'],
      ['brp', '2'],
      ['brvr', '2']
    ],
    'viseca_na_kipu_gola': [
      ['s', '80'],
      ['v', '80'],
      ['d', '35'],
      ['brp', '2'],
      ['brvr', '2']
    ],
    'gue90': [
      ['sl', '60'],
      ['sd', '60'],
      ['v', '72'],
      ['d', '35'],
      ['brp', '1']
    ],
    'gue90rotiran': [
      ['sl', '60'],
      ['sd', '90'],
      ['v', '80'],
      ['d', '35'],
      ['brp', '2']
    ],
    'lijevi_gue90': [
      ['sl', '70'],
      ['sd', '100'],
      ['v', '80'],
      ['d', '35'],
      ['brp', '2']
    ]
  },
  'Visoki': {
    'ormar_visoki': [
      ['s', '60'],
      ['v', '210'],
      ['d', '55'],
      ['c', '10'],
      ['brp', '4'],
      ['brvr', '2']
    ],
    'visoki_element_za_kombinovani_frizider': [
      ['s', '60'],
      ['v', '250'],
      ['vde', '88'],
      ['d', '60'],
      ['c', '10'],
      ['brp', '2'],
      ['brv', '1'],
      ['frizider', '180']
    ],
    'visoki_element_za_kombinovani_frizider_gola': [
      ['s', '60'],
      ['v', '250'],
      ['vde', '88'],
      ['d', '60'],
      ['c', '10'],
      ['brp', '2'],
      ['brv', '1'],
      ['frizider', '180']
    ],
    'visoki_element_za_frizider': [
      ['s', '60'],
      ['v', '250'],
      ['vde', '88'],
      ['d', '60'],
      ['c', '10'],
      ['brp', '2'],
      ['brv', '1'],
      ['frizider', '180']
    ],
    'visoki_element_za_frizider_gola': [
      ['s', '60'],
      ['v', '250'],
      ['vde', '88'],
      ['d', '60'],
      ['c', '10'],
      ['brp', '2'],
      ['brv', '1'],
      ['frizider', '180']
    ],
    'visoki_element_za_rernu': [
      ['s', '60'],
      ['v', '250'],
      ['vde', '88'],
      ['d', '60'],
      ['c', '10'],
      ['brp', '2'],
      ['brv', '1'],
      ['rerna', '58.5']
    ],
    'visoki_element_za_rernu_sa_fiokama': [
      ['s', '60'],
      ['v', '250'],
      ['vde', '88'],
      ['d', '60'],
      ['c', '10'],
      ['brp', '2'],
      ['brv', '1'],
      ['rerna', '58.5']
    ],
    'visoki_element_za_rernu_i_mikrotalasnu_pec_sa_fiokama': [
      ['s', '60'],
      ['v', '250'],
      ['vde', '88'],
      ['d', '60'],
      ['c', '10'],
      ['brp', '1'],
      ['brv', '1'],
      ['rerna', '58.5'],
      ['mikrovele', '38']
    ]
  },
  'Aparati': {
    'ploca_za_kuvanje': [
      ['x', '58'],
      ['y', '51'],
      ['z', '0.5']
    ],
    'sudopera': [
      ['D', '48'],
      ['h', '18']
    ]
  }
};

/** All named color presets */
export const COLOR_PRESETS = [
  { name: 'white', label: 'Bijela', hex: '#F5F5F5' },
  { name: 'offwhite', label: 'Krem', hex: '#F0EAD6' },
  { name: 'Moccasin', label: 'Moka', hex: '#D4A76A' },
  { name: 'Azure', label: 'Azure', hex: '#D5ECFA' },
  { name: 'BurlyWood', label: 'Orah siv.', hex: '#DEB887' },
  { name: 'chocolate', label: 'Čokolad.', hex: '#D2691E' },
  { name: 'red', label: 'Crvena', hex: '#CC3322' },
  { name: 'blue', label: 'Plava', hex: '#2244AA' },
  { name: 'darkgreen', label: 'Zelena', hex: '#006400' },
  { name: 'Silver', label: 'Siva', hex: '#BDBDBD' },
  { name: 'DimGray', label: 'Tamnosiva', hex: '#696969' },
  { name: 'black', label: 'Crna', hex: '#1A1A1A' },
  { name: 'anthracite', label: 'Antracit', hex: '#3B3B3B' },
  { name: 'navy', label: 'Mornarsko', hex: '#1B3A6B' },
  { name: 'dusty_rose', label: 'Ružičasta', hex: '#C9899A' }
];

/** Texture presets for wood, stone etc. */
export const TEXTURE_PRESETS = [
  { name: 'oak', label: 'Hrast', base: '#C8A060', grain: '#A0784A', type: 'wood' },
  { name: 'walnut', label: 'Orah', base: '#5A3820', grain: '#3A2010', type: 'wood' },
  { name: 'pine', label: 'Bor', base: '#E8C880', grain: '#C8A860', type: 'wood' },
  { name: 'wenge', label: 'Venge', base: '#3A2A18', grain: '#1A0A08', type: 'wood' },
  { name: 'beech', label: 'Bukva', base: '#D0A870', grain: '#B08848', type: 'wood' },
  { name: 'marble_wh', label: 'Mermer bij.', base: '#F0EEE8', grain: '#CCCCCC', type: 'marble' },
  { name: 'marble_gr', label: 'Mermer siv.', base: '#9A9A9A', grain: '#707070', type: 'marble' },
  { name: 'granite', label: 'Granit', base: '#707070', grain: '#404040', type: 'granite' },
  { name: 'concrete', label: 'Beton', base: '#888888', grain: '#666666', type: 'concrete' }
];
