# Meco Konfigurator — Improvements List

## App Overview

**Meco Konfigurator 2026** is a professional kitchen cabinet configurator — Electron + Three.js + JSCAD — for designing kitchen layouts and generating CNC manufacturing files (MPR/HOMAG), cutting lists, and PDF quotes.

---

## Current State: Solid But Has Gaps

### What works well
- 35+ parametric kitchen modules (base, wall, corner, tall cabinets)
- Real-time 3D viewer with PBR lighting, shadows, orbit controls
- Cutting list (krojna lista) with material costs
- MPR export for CNC machines
- Context menu (mirror, duplicate, set anchor, remove)
- Auto-save via localStorage, project save/load
- Glassmorphic UI with dark/light mode

---

## Improvements by Priority

### Critical — Affects Manufacturing Accuracy
- **12 documented geometry bugs** (see `plan.md`): Most fixed. Remaining: cokla front panels are standalone by design.
- **MPR validation**: ✅ Done — diffed all three JS generators against reference `.mpr` templates. Fixed:
  - `fiokar.mpr` drawer slide rows (ORI=6,7,8): `MI="1"` → `MI="0"` (wrong face would have been drilled)
  - `dno.mpr` header: `UF="STANDARD"` (was generating `UF="20"`)
  - `mprBohrVert` helper now accepts `MI` as a parameter (defaults to `"1"`)
- **Material type detection** in `getPriceForMaterial()`: ✅ Done — replaced `.includes()` chain with a regex pattern map

### High Impact UX Features Missing
- **Undo/Redo**: ✅ Done — snapshot-based history (50 steps), Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z, dirty-flag pattern for param/position inputs
- **Measurement overlays**: ✅ Done — CSS2DRenderer labels (W×D×H in cm) anchored to bounding box, toggle button (⊹) in viewer toolbar, auto-updates on module select, clears on deselect/undo
- **Module search/filter**: ✅ Done — search input above module grid, filters by name in real time
- **Keyboard shortcuts**: ✅ Done — Ctrl+S (save), Ctrl+D (duplicate), Del/Backspace (remove), Ctrl+Z/Y (undo/redo), Escape (deselect)
- **Preset layouts**: ✅ Done — "⬡ PREDLOŠCI RASPOREDA" button opens modal with 3 layout cards (Galley, L-shape, U-shape); each loads a full plan with pushHistory()

### Code Quality / Architecture
- **`src/app.js` is 4,700+ lines** — one monolithic file mixing UI events, business logic, geometry, exports, modals, snapping. Hard to maintain and extend. Should be split into:
  - `planManagement.js`
  - `exporters.js`
  - `materialSystem.js`
  - `ui.js`
- **No tests** anywhere — cutting-list calculations and cost math have zero test coverage
- **Magic numbers** (board thicknesses `M=1.6`, `M1=1.8`) scattered throughout, not centralized
- **No input validation** — negative or excessive values in parameter inputs go unchecked

### Manufacturing / Export Gaps
- **Hardware BOM**: No list of hinges, handles, drawer slides, plugs with part numbers
- **Panel edge detection**: Auto-detect which edges need banding (exposed vs. hidden) instead of manual entry
- **Assembly instructions PDF**: No step-by-step installation export
- **Nesting integration**: CSV export exists but no optimization feedback

### Performance (matters at 15+ modules)
- Every parameter change rebuilds the **entire** JSCAD geometry + Three.js scene — no dirty-flag or incremental update
- No Web Worker offloading for heavy JSCAD calculations
- No geometry instancing for identical repeated modules

### Minor Polish
- All strings are hardcoded in Bosnian (sr-RS) — no i18n structure if the app ever expands
- No ARIA labels or keyboard navigation for accessibility
- No material color swatch visible in the plan list items

---

## Quick Wins (Small Effort, Real Value)

| Improvement | Effort | Status |
|-------------|--------|--------|
| Input validation (clamp negative/excessive values) | Small | ✅ Done |
| Keyboard shortcuts (Del = remove, Ctrl+Z/Y, Ctrl+S/D) | Small | ✅ Done |
| Module search box in the left panel | Small | ✅ Done |
| Show dimension labels in 3D viewer (CSS2DRenderer) | Medium | ✅ Done |
| Centralize board thickness constants to `modules-config.js` | Small | ✅ Done |
| Fix material price string matching → regex map | Small | ✅ Done |
| Fix the 12 documented geometry bugs in `plan.md` | Medium | ✅ Done (mostly; cokla fronts standalone by design) |
| Preset layouts (Galley, L-shape, U-shape) | Medium | ✅ Done |
