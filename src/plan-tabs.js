/**
 * plan-tabs.js
 * Multi-plan tab system — named plan slots with tab bar to switch.
 * Plans stored in localStorage under 'mecoPlanTabs'.
 */

const STORAGE_KEY = 'mecoPlanTabs';

let _tabs = [];
let _activeTab = 0;

export function getPlanTabs() {
  return _tabs;
}
export function getActiveTab() {
  return _activeTab;
}

export function loadTabs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      _tabs = data.tabs || [{ name: 'Plan 1', plan: [], occupiedCells: {}, wallFixtures: [] }];
      _activeTab = Math.min(data.activeTab || 0, _tabs.length - 1);
    } else {
      _tabs = [{ name: 'Plan 1', plan: [], occupiedCells: {}, wallFixtures: [] }];
      _activeTab = 0;
    }
  } catch {
    _tabs = [{ name: 'Plan 1', plan: [], occupiedCells: {}, wallFixtures: [] }];
    _activeTab = 0;
  }
}

export function saveTabs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs: _tabs, activeTab: _activeTab }));
}

export function addTab(name) {
  _tabs.push({ name, plan: [], occupiedCells: {}, wallFixtures: [] });
  _activeTab = _tabs.length - 1;
  saveTabs();
  return _activeTab;
}

export function removeTab(idx) {
  if (_tabs.length <= 1) return;
  _tabs.splice(idx, 1);
  if (_activeTab >= _tabs.length) _activeTab = _tabs.length - 1;
  saveTabs();
  return _activeTab;
}

export function switchTab(idx) {
  if (idx < 0 || idx >= _tabs.length) return _activeTab;
  _activeTab = idx;
  saveTabs();
  return _activeTab;
}

export function renameTab(idx, name) {
  if (_tabs[idx]) _tabs[idx].name = name;
  saveTabs();
}

export function saveCurrentTab(plan, occupiedCells, wallFixtures) {
  const tab = _tabs[_activeTab];
  if (!tab) return;
  tab.plan = JSON.parse(JSON.stringify(plan));
  tab.occupiedCells = JSON.parse(JSON.stringify(occupiedCells));
  tab.wallFixtures = JSON.parse(JSON.stringify(wallFixtures || []));
  saveTabs();
}

export function loadTabData(idx) {
  const tab = _tabs[idx];
  if (!tab) return null;
  return {
    plan: JSON.parse(JSON.stringify(tab.plan)),
    occupiedCells: JSON.parse(JSON.stringify(tab.occupiedCells)),
    wallFixtures: JSON.parse(JSON.stringify(tab.wallFixtures || [])),
  };
}
