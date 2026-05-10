import { t } from './i18n.js';

export const PARAM_LABELS = {
  s: () => t('params.s'),
  v: () => t('params.v'),
  d: () => t('params.d'),
  c: () => t('params.c'),
  brvr: () => t('params.brvr'),
  brp: () => t('params.brp'),
  brf: () => t('params.brf'),
  brfp: () => t('params.brfp'),
  brfd: () => t('params.brfd'),
  brv: () => t('params.brvr'),
  rerna: () => t('params.rerna'),
  dss: () => t('params.dss'),
  sl: () => t('params.sl'),
  sd: () => t('params.sd'),
  ss: () => t('params.ss'),
  ds: () => t('params.ds'),
  vs: () => t('params.vs'),
};

export const PARAM_BOUNDS = {
  s: { min: 10, max: 400 },
  v: { min: 10, max: 300 },
  d: { min: 10, max: 150 },
  c: { min: 0, max: 30 },
  brvr: { min: 1, max: 8 },
  brv: { min: 1, max: 8 },
  brp: { min: 0, max: 10 },
  brf: { min: 1, max: 8 },
  brfp: { min: 0, max: 8 },
  brfd: { min: 0, max: 8 },
  rerna: { min: 10, max: 100 },
  dss: { min: 10, max: 400 },
  lss: { min: 10, max: 400 },
  sl: { min: 10, max: 400 },
  sd: { min: 10, max: 400 },
  ss: { min: 5, max: 200 },
  ds: { min: 5, max: 150 },
  vs: { min: 5, max: 300 },
  l: { min: 10, max: 600 },
};

export function clampParamValue(name, val) {
  const bounds = PARAM_BOUNDS[name] || { min: 0, max: 1000 };
  return Math.min(bounds.max, Math.max(bounds.min, parseFloat(val) || bounds.min));
}

export function applyParamInputBounds(input, name) {
  const bounds = PARAM_BOUNDS[name] || { min: 0, max: 1000 };
  input.min = String(bounds.min);
  input.max = String(bounds.max);
  input.addEventListener('blur', () => {
    const clamped = clampParamValue(name, input.value);
    if (String(clamped) !== input.value) input.value = clamped;
  });
}
