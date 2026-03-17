import { DEFAULT_MATERIALS, DEFAULT_SETTINGS } from './modules-config.js';

export let state = {
  currentCategory: 'Donji',
  selectedModule: '',
  paramInputs: {},
  materials: { ...DEFAULT_MATERIALS },
  settings: { ...DEFAULT_SETTINGS },
  position: { x: 0, y: 0, z: 0, r: 0 },
  klizac: 'skriveni',
  plan: [],
  occupiedCells: {},
  selectedPlanIdx: -1,
  selectedCell: [2, 1],
  clientName: 'Projekat_Meco',
  matPickerTarget: null,
  prices: { univer: 25, mdf: 45, hdf: 12, radna: 65, kant_k: 1.5, kant_K: 3.5 },
  simplifiedKrojna: false,
  perModuleKrojna: false,
  mprSettings: { D: 18, BRR: 4, EX: 24, F: 20, BRP: 1, TR: 70 },
  wallFixtures: [],
  addingRadnaPloca: false,
  addingCokla: false,
  lightingMode: 'warm',
  showMeasurements: true
};

export let editingPlanIdx = -1;
export function setEditingPlanIdx(v) { editingPlanIdx = v; }

export let pendingMatSel = null;
export function setPendingMatSel(v) { pendingMatSel = v; }

export let isDark = false;
export function setIsDark(v) { isDark = v; }

const HISTORY_MAX = 50;
export const _history = { past: [], future: [] };

export function _clonePlanState() {
  return { plan: JSON.parse(JSON.stringify(state.plan)), occupiedCells: JSON.parse(JSON.stringify(state.occupiedCells)) };
}

export function pushHistory() {
  _history.past.push(_clonePlanState());
  if (_history.past.length > HISTORY_MAX) _history.past.shift();
  _history.future = [];
}
