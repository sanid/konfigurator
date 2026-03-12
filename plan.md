# Plan: Fix OpenSCAD-to-JS Module Accuracy

## Summary of Issues Found

After comparing every OpenSCAD module in `moduli.scad` against the corresponding builder in `kitchen-builder.js`, I found these discrepancies:

---

### 1. `buildCorpus()` shared function — Top rail positions wrong
**SCAD**: Two top rails:
- Back rail: `translate([m1, d-70, v-m1])` -> at depth `d-7`, height `v-M1`
- Front rail: `translate([m1, 0, v-m1])` -> at depth `0` (front), height `v-M1`

**JS (current)**:
- Back rail at depth `-7` (correct — near wall)
- Front rail at depth `-d` and height `v-M1-5` (WRONG — should be full depth at front, not dropped 5cm)

The `buildCorpus` front rail is at `v - M1 - 5` but in SCAD it's at `v - M1` for regular modules, and at `v - 60 = v - 6cm` for gola modules. The shared `buildCorpus` always uses `v-M1-5` which is wrong for both.

**Fix**: Change front rail in `buildCorpus` to `v - M1` (matching regular SCAD). For gola variants that use `v-60`, override or pass a flag.

---

### 2. `fiokar` / `fiokar_gola` — Top front rail position
**SCAD fiokar**: front rail at `translate([m1, 0, v-m1])` -> `v - M1`
**SCAD fiokar_gola**: front rail at `translate([m1, 0, v-60])` -> `v - 6cm`

**JS**: Uses `buildCorpus` which has `v-M1-5` — wrong for both.

**Fix**: `buildCorpus` should use `v-M1`. The gola variants should build their own corpus or pass a rail height override.

---

### 3. `fiokar_gola` — Shallow drawer front positions use float indices [2, 2.92]
**SCAD fiokar_gola**: `for(k=[2,2.92])` — meaning drawers at positions 2*pom and 2.92*pom
**JS**: `for (let k = 2; k < brf; k++)` — integer steps 2, 3 — misses the 2.92 position

**Fix**: Use the precise `[2, 2.92]` multipliers for fiokar_gola shallow drawers.

---

### 4. `fiokar` deep drawer front height formula
**SCAD fiokar**: `celo_duboke_fioke = [s-3, mdf, (v-c)/brf*2-3]`
**SCAD fiokar_gola**: `celo_duboke_fioke = [s-3, mdf, (v-c)/brf*2-30]`

**JS**: `fh_deep = pom * 2 - (settings.isGola ? 3.0 : 0.3)` — Gola uses `-3.0` but SCAD says `-30` which is `-3.0cm`. Wait, SCAD is in mm: `-30mm = -3.0cm`. So the JS value of `3.0` is actually correct. But for regular: SCAD `-3mm = -0.3cm`, and JS uses `0.3`. OK, this is fine.

For shallow fronts:
**SCAD fiokar**: `(v-c)/brf - 3` (mm) = `-0.3` cm. JS: `pom - 0.3`. Correct.
**SCAD fiokar_gola**: `(v-c)/brf - 18` (mm) = `-1.8` cm. JS: `pom - 1.8`. Correct.

---

### 5. `klasicna_viseca_gola_ispod_grede` — Missing beam (greda) logic
**SCAD**: Has `sirina_grede=300; visina_grede=210;` (30cm wide, 21cm tall)
- Plafon placed at `v - visina_grede - m1` instead of `v - m1`
- Lesonit height: `v - visina_grede` instead of `v`
- Police spacing: `(v - visina_grede - m1) / (brp + 1)`
- Door height: `v - visina_grede - 3`

**JS**: Uses `build_klasicna_viseca_gola` — completely ignores the beam cutout.

**Fix**: Create a dedicated `build_klasicna_viseca_gola_ispod_grede` with proper beam logic.

---

### 6. `viseca_na_kipu` — Door distribution
**SCAD**: Doors are distributed vertically (rasporedi_vrata = v/brv), with door height = v/2-3
The doors use `translate([1.5,-mdf, 1.5 + i * rasporedi_vrata])` — stacked vertically.

**JS**: Currently uses `v / brvr` for spacing which seems correct, but handle position in SCAD is at `50 + j * rasporedi_vrata`. JS uses `5 + i * sp` which is `5cm` — matches SCAD's `50mm = 5cm`. OK.

---

### 7. `viseca_na_kipu_gola` — Bottom shelf shallower
**SCAD**: `dno = [s-2*m1, d-22, m1]` — bottom is 2.2cm shallower than full depth
Also has middle shelf `plafon_i_srednja_vezna`.

**JS**: `build_viseca_na_kipu_gola` calls `build_viseca_na_kipu` with `front_vrata: false` then adds doors. But the internal corpus is wrong — it uses `buildUpperCorpus` which has full-depth bottom.

**Fix**: Override bottom shelf in gola variant to be `d-2.2` deep.

---

### 8. `gue90rotiran` — Just passes through to gue90 (no rotation)
**SCAD**: `rotate([0,0,90]) translate([-sl,-d,0]) union() { ... }` — rotates the entire gue90 geometry 90 degrees.

**JS**: `return build_gue90(p, mats, settings)` — no rotation at all!

**Fix**: Apply 90-degree rotation to the result in `build_gue90rotiran`.

---

### 9. Cokla (plinth) rendering per module — Missing from most builders
**SCAD**: Every base module has its own `cokla()` sub-module that creates:
- A front plinth panel: `[s, mdf, c-5]` at `translate([0, 5, 5])`
- Leg cylinders at specific positions

**JS**: Base modules use `addLegs()` for cylinders, but NO plinth PANEL is rendered for any module. The only plinth is the standalone `build_cokla` for the separate "COKLA" button.

**Fix**: Add a front plinth panel (colored as `front` material) to every base cabinet builder that has one in SCAD.

---

### 10. `radni_stol_rerne_gola` — Shelf position off
**SCAD**: `translate([m1, 0, v-60-rerna-m1])` — shelf above oven at `v - 6 - rerna - M1`

**JS**: `shelfY = v - 2 * M1 - rerna - 4` = `v - 3.6 - rerna - 4` = wrong offset.

**Fix**: Use `v - 6 - rerna - M1` to match SCAD.

---

### 11. `radni_stol_rerne` — Regular variant front rail
**SCAD**: Front rail at `v - M1` (not dropped).

**JS**: Uses `buildCorpus` which incorrectly uses `v-M1-5`.

---

### 12. Missing front cokla panel on `radni_stol_rerne_gola_bez_fioke`
**SCAD**: Has `cokla(s, d, c, mdf, dezen_front)` at end.
**JS**: No cokla panel — only `addLegs`.

---

## Implementation Plan

### File: `kitchen-builder.js`

1. **Fix `buildCorpus()`**: Change the front top rail from `v - M1 - 5` to `v - M1`. Add optional `frontRailZ` parameter for gola variants that need different rail height.

2. **Add `addCoklaPanel()` helper**: Renders `[s, MDF, c-0.5]` at `[0, -(MDF+0.5), 0.5]` colored as front material. Call it from every base cabinet builder.

3. **Fix `fiokar_gola` shallow drawer positions**: Use `[2, 2.92]` multipliers instead of integer loop.

4. **Create dedicated `build_klasicna_viseca_gola_ispod_grede`**: Include beam parameters (sirina_grede=30, visina_grede=21) affecting plafon, lesonit, shelves, and doors.

5. **Fix `viseca_na_kipu_gola`**: Build its own corpus with `d-2.2` bottom shelf instead of reusing parent.

6. **Fix `gue90rotiran`**: Apply proper 90-degree rotation to the JSCAD geometry.

7. **Fix `radni_stol_rerne_gola` shelf position**: `v - 6 - rerna - M1`.

8. **Fix `klasicna_viseca_gola` bottom**: Already correct at `d-2.2`.

9. **Add handles to `klasicna_viseca_gola`**: SCAD has no handle in gola. JS doesn't add handles. This is correct.

### Files affected:
- `src/kitchen-builder.js` (all geometry fixes)
