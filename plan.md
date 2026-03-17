# Plan: Split app.js into modules

## Goal
Break src/app.js (3778 lines) into focused, maintainable modules while preserving all functionality.

## New modules to create

1. src/notifications.js  showNotification(msg, type)
2. src/state.js  shared state object + history (pushHistory, historyUndo, historyRedo, _applySnapshot, _clonePlanState)
3. src/price-utils.js  calcKant, getPriceForMaterial, updateTotalCost, initPriceInputs, MATERIAL_PRICE_MAP
4. src/wall-grid.js  initWallGrid, selectCell, updateWallGridDisplay, shiftRowFrom, rebuildCountertopsForRow
5. src/material-picker.js  initMaterialsPanel, initMaterialPickerModal, openMaterialPicker, refreshMaterialSwatches, updateMatPreview, MAT_LABELS
6. src/project-storage.js  autoSave, autoRestore, saveProject, loadProject
7. src/snap.js  setSnapAnchorByIndex, snapModuleToSide, snap anchor state
8. src/special-elements.js  addSpecialElement, addRadnaPlocaToModule, addCoklaToModule, createSpanningRadnaPloca, createCornerRadnaPloca, createSpanningCokla, CORNER_ELEMENT_NAMES
9. src/plan-manager.js  addToPlan, deleteModule, mirrorModule, duplicateModule, clearPlan, renderPlanList, selectModuleByIndex, updateModule3D, updateModuleMeasurements, getModuleSize, PLAN_ICONS
10. src/exports.js  exportOptimik, exportPdf, exportModuleMPR, exportAllMPR, generateMPRContent, getMPRPanel, getMPRSettings, initKrojnaModal, showKrojnaLista

## What stays in app.js
Imports, DOMContentLoaded init, UI wiring functions (initTitlebarControls, initCategoryTabs, initModuleSelect, populateModuleSelect, refreshParams, refreshParamsForPlanItem, initPositionInputs, setPos, getPos, initToggles, initOverlayToggles, initPresetModal, initContextMenu, initLanguageSwitcher, updateUILabels, initFixtureModal, renderFixtureList, keyboard shortcuts), plus constants PARAM_LABELS, PARAM_BOUNDS, MODULE_ICONS, FIXTURE_TYPES, TOGGLE_LABELS and helpers clampParamValue, applyParamInputBounds.

## Approach
- ES module export/import (same pattern as existing modules)
- state.js exports the shared state object by reference
- No event bus  direct function imports
- Same function signatures throughout
