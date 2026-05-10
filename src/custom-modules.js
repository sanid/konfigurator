/**
 * custom-modules.js
 * Custom module library — save frequently-used configurations as reusable presets.
 * Stored in localStorage as JSON array of { name, ime, p } entries.
 */

const STORAGE_KEY = 'mecoCustomModules';

let _customModules = [];

export function getCustomModules() {
  return _customModules;
}

export function loadCustomModules() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _customModules = raw ? JSON.parse(raw) : [];
  } catch {
    _customModules = [];
  }
}

export function saveCustomModule(name, ime, p) {
  _customModules.push({ name, ime, p: { ...p } });
  _save();
}

export function deleteCustomModule(idx) {
  _customModules.splice(idx, 1);
  _save();
}

function _save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_customModules));
}
