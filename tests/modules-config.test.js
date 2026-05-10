import { describe, it, expect } from 'vitest';
import { M, M1, MDF, HDF, RPL, MODULE_GROUPS, COLOR_PRESETS, TEXTURE_PRESETS } from '../src/modules-config.js';

describe('modules-config constants', () => {
  it('M (16mm) is 1.6', () => {
    expect(M).toBe(1.6);
  });

  it('M1 (18mm) is 1.8', () => {
    expect(M1).toBe(1.8);
  });

  it('MDF is 1.8', () => {
    expect(MDF).toBe(1.8);
  });

  it('HDF is 0.3', () => {
    expect(HDF).toBe(0.3);
  });

  it('RPL (worktop) is 3.8', () => {
    expect(RPL).toBe(3.8);
  });
});

describe('MODULE_GROUPS', () => {
  it('has all expected categories', () => {
    expect(Object.keys(MODULE_GROUPS)).toContain('Donji');
    expect(Object.keys(MODULE_GROUPS)).toContain('Ugaoni');
    expect(Object.keys(MODULE_GROUPS)).toContain('Gornji');
    expect(Object.keys(MODULE_GROUPS)).toContain('Visoki');
    expect(Object.keys(MODULE_GROUPS)).toContain('Aparati');
  });

  it('each module has param defs as array of [name, default]', () => {
    for (const [cat, modules] of Object.entries(MODULE_GROUPS)) {
      for (const [name, params] of Object.entries(modules)) {
        expect(Array.isArray(params), `${cat}/${name} params should be array`).toBe(true);
        for (const entry of params) {
          expect(Array.isArray(entry), `${cat}/${name} entry should be array`).toBe(true);
          expect(entry.length, `${cat}/${name} entry should be [name, default]`).toBe(2);
        }
      }
    }
  });

  it('radni_stol has expected params', () => {
    const rs = MODULE_GROUPS['Donji']['radni_stol'];
    const paramNames = rs.map(([n]) => n);
    expect(paramNames).toContain('s');
    expect(paramNames).toContain('v');
    expect(paramNames).toContain('d');
    expect(paramNames).toContain('c');
  });
});

describe('COLOR_PRESETS', () => {
  it('is non-empty array', () => {
    expect(Array.isArray(COLOR_PRESETS)).toBe(true);
    expect(COLOR_PRESETS.length).toBeGreaterThan(0);
  });

  it('each preset has name, label, hex', () => {
    for (const preset of COLOR_PRESETS) {
      expect(preset.name).toBeDefined();
      expect(preset.label).toBeDefined();
      expect(preset.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('TEXTURE_PRESETS', () => {
  it('is non-empty array', () => {
    expect(Array.isArray(TEXTURE_PRESETS)).toBe(true);
    expect(TEXTURE_PRESETS.length).toBeGreaterThan(0);
  });

  it('each preset has name, label, base, grain', () => {
    for (const preset of TEXTURE_PRESETS) {
      expect(preset.name).toBeDefined();
      expect(preset.label).toBeDefined();
      expect(preset.base).toBeDefined();
      expect(preset.grain).toBeDefined();
    }
  });
});
