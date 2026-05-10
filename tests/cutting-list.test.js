import { describe, it, expect } from 'vitest';
import { computeCuttingList, computeCuttingListByModule, toCsvString } from '../src/cutting-list.js';
import { M as M16, M1, MDF, HDF } from '../src/modules-config.js';

const M = M1;

describe('computeCuttingList', () => {
  it('returns empty array for empty plan', () => {
    expect(computeCuttingList([])).toEqual([]);
  });

  it('returns empty array for unknown module type', () => {
    expect(computeCuttingList([{ ime: 'nonexistent', p: {} }])).toEqual([]);
  });

  it('returns empty for sporet (no cut panels)', () => {
    expect(computeCuttingList([{ ime: 'sporet', p: {} }])).toEqual([]);
  });

  it('returns empty for samostojeci_frizider', () => {
    expect(computeCuttingList([{ ime: 'samostojeci_frizider', p: {} }])).toEqual([]);
  });

  describe('radni_stol (standard base cabinet)', () => {
    const item = { ime: 'radni_stol', p: { s: 60, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } };
    const panels = computeCuttingList([item]);

    it('produces correct number of panel types', () => {
      expect(panels.length).toBe(6);
    });

    it('computes stranice (side panels) correctly', () => {
      const stranice = panels.find(p => p.name === 'stranice m1');
      expect(stranice).toBeDefined();
      expect(stranice.L).toBe(Math.round((82 - 10) * 10));
      expect(stranice.W).toBe(Math.round(55 * 10));
      expect(stranice.qty).toBe(2);
      expect(stranice.material).toBe('UNIVER 18MM');
    });

    it('computes dno (bottom) correctly', () => {
      const dno = panels.find(p => p.name === 'dno m1');
      expect(dno).toBeDefined();
      expect(dno.L).toBe(Math.round((60 - 2 * M) * 10));
      expect(dno.W).toBe(Math.round(55 * 10));
      expect(dno.qty).toBe(1);
    });

    it('computes traverzne correctly', () => {
      const trav = panels.find(p => p.name === 'traverzne m1');
      expect(trav).toBeDefined();
      expect(trav.L).toBe(Math.round((60 - 2 * M) * 10));
      expect(trav.W).toBe(70);
      expect(trav.kant).toBe('2d');
    });

    it('computes lesonit (back panel) correctly', () => {
      const hdf = panels.find(p => p.name === 'lesonit hdf');
      expect(hdf).toBeDefined();
      expect(hdf.L).toBe(Math.round(60 * 10));
      expect(hdf.W).toBe(Math.round((82 - 10) * 10));
      expect(hdf.material).toBe('HDF 3MM');
      expect(hdf.kant).toBe('');
    });

    it('computes police (shelf) correctly', () => {
      const police = panels.find(p => p.name === 'police m1');
      expect(police).toBeDefined();
      expect(police.qty).toBe(1);
      expect(police.W).toBe(Math.round((55 - 5) * 10));
    });

    it('computes vrata (doors) correctly', () => {
      const vrata = panels.find(p => p.name === 'vrata mdf');
      expect(vrata).toBeDefined();
      expect(vrata.qty).toBe(2);
      expect(vrata.material).toBe('MDF 18MM');
      expect(vrata.L).toBe(Math.round((82 - 10 - 0.3) * 10));
      expect(vrata.W).toBe(Math.round((60 / 2 - 0.3) * 10));
    });
  });

  describe('aggregation', () => {
    it('aggregates identical panels from two modules', () => {
      const plan = [
        { ime: 'radni_stol', p: { s: 60, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } },
        { ime: 'radni_stol', p: { s: 60, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } },
      ];
      const panels = computeCuttingList(plan);
      const stranice = panels.find(p => p.name === 'stranice m1');
      expect(stranice.qty).toBe(4);
    });

    it('does NOT aggregate panels with different dimensions', () => {
      const plan = [
        { ime: 'radni_stol', p: { s: 60, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } },
        { ime: 'radni_stol', p: { s: 80, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } },
      ];
      const panels = computeCuttingList(plan);
      const dnoPanels = panels.filter(p => p.name === 'dno m1');
      expect(dnoPanels.length).toBe(2);
    });
  });

  describe('fiokar (drawer cabinet)', () => {
    const item = { ime: 'fiokar', p: { s: 60, v: 82, d: 55, c: 10, brf: 4, brfp: 2, brfd: 1 } };
    const panels = computeCuttingList([item]);

    it('has drawer front panels', () => {
      const deepFront = panels.find(p => p.name === 'celo_duboke_fioke mdf');
      expect(deepFront).toBeDefined();
      const shallowFront = panels.find(p => p.name === 'celo_plitke_fioke mdf');
      expect(shallowFront).toBeDefined();
    });

    it('computes deep drawer front height as 2x the slot height', () => {
      const deepFront = panels.find(p => p.name === 'celo_duboke_fioke mdf');
      const expectedL = Math.round((82 - 10) / 4 * 2 * 10 - 3);
      expect(deepFront.L).toBe(expectedL);
    });

    it('computes shallow drawer front as single slot', () => {
      const shallowFront = panels.find(p => p.name === 'celo_plitke_fioke mdf');
      const expectedL = Math.round((82 - 10) / 4 * 10 - 3);
      expect(shallowFront.L).toBe(expectedL);
      expect(shallowFront.qty).toBe(2);
    });
  });

  describe('gola_radni_stol (handleless base cabinet)', () => {
    const item = { ime: 'gola_radni_stol', p: { s: 60, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } };
    const panels = computeCuttingList([item]);

    it('door height is reduced by 3cm for gola channel', () => {
      const vrata = panels.find(p => p.name === 'vrata mdf');
      const stdItem = { ime: 'radni_stol', p: { s: 60, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } };
      const stdPanels = computeCuttingList([stdItem]);
      const stdVrata = stdPanels.find(p => p.name === 'vrata mdf');
      expect(vrata.L).toBe(stdVrata.L - Math.round(3.0 * 10));
    });
  });

  describe('dug_element_90 (corner cabinet)', () => {
    const item = { ime: 'dug_element_90', p: { dss: 80, lss: 90, v: 82, d: 55, c: 10, brp: 1 } };
    const panels = computeCuttingList([item]);

    it('has 3 side panels', () => {
      const stranice = panels.find(p => p.name === 'stranice m1');
      expect(stranice.qty).toBe(3);
    });

    it('has two bottoms (main and short arm)', () => {
      const dno = panels.find(p => p.name === 'dno m1');
      const dnoKrace = panels.find(p => p.name === 'dno krace m1');
      expect(dno).toBeDefined();
      expect(dnoKrace).toBeDefined();
      expect(dnoKrace.L).toBe(Math.round((90 - 55 - M) * 10));
    });

    it('has two door panels', () => {
      const vrataD = panels.find(p => p.name === 'vrata_d mdf');
      const vrataL = panels.find(p => p.name === 'vrata_l mdf');
      expect(vrataD).toBeDefined();
      expect(vrataL).toBeDefined();
    });
  });

  describe('radna_ploca (countertop)', () => {
    const item = { ime: 'radna_ploca', p: { l: 120, d: 60 } };
    const panels = computeCuttingList([item]);

    it('produces a single RADNA PLOCA panel', () => {
      expect(panels.length).toBe(1);
      expect(panels[0].material).toBe('RADNA PLOCA 38MM');
      expect(panels[0].L).toBe(1200);
      expect(panels[0].W).toBe(600);
      expect(panels[0].kant).toBe('/');
    });
  });

  describe('cokla (kickplate)', () => {
    const item = { ime: 'cokla', p: { l: 180, h: 9.5 } };
    const panels = computeCuttingList([item]);

    it('produces a single MDF panel', () => {
      expect(panels.length).toBe(1);
      expect(panels[0].material).toBe('MDF 18MM');
      expect(panels[0].L).toBe(1800);
      expect(panels[0].W).toBe(95);
    });
  });

  describe('klasicna_viseca (upper cabinet)', () => {
    const item = { ime: 'klasicna_viseca', p: { s: 60, v: 70, d: 35, brp: 1, brvr: 2 } };
    const panels = computeCuttingList([item]);

    it('has dno i plafon (top and bottom) as qty 2', () => {
      const dnoPlafon = panels.find(p => p.name === 'dno i plafon m1');
      expect(dnoPlafon.qty).toBe(2);
    });

    it('side panel height uses full v (no kickplate subtraction)', () => {
      const stranice = panels.find(p => p.name === 'stranice m1');
      expect(stranice.L).toBe(Math.round(70 * 10));
    });
  });

  describe('string param coercion', () => {
    it('handles string params from UI correctly', () => {
      const item = { ime: 'radni_stol', p: { s: '60', v: '82', d: '55', c: '10', brvr: '2', brp: '1' } };
      const panels = computeCuttingList([item]);
      expect(panels.length).toBeGreaterThan(0);
      const stranice = panels.find(p => p.name === 'stranice m1');
      expect(stranice.L).toBe(Math.round(72 * 10));
    });
  });

  describe('sorting', () => {
    it('sorts by material first, then name', () => {
      const plan = [
        { ime: 'radna_ploca', p: { l: 100, d: 60 } },
        { ime: 'radni_stol', p: { s: 60, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } },
      ];
      const panels = computeCuttingList(plan);
      const materials = panels.map(p => p.material);
      for (let i = 1; i < materials.length; i++) {
        expect(materials[i].localeCompare(materials[i - 1])).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

describe('computeCuttingListByModule', () => {
  it('returns per-module panel lists', () => {
    const plan = [
      { ime: 'radni_stol', p: { s: 60, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } },
      { ime: 'radni_stol', p: { s: 80, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } },
    ];
    const result = computeCuttingListByModule(plan);
    expect(result.length).toBe(2);
    expect(result[0].moduleName).toBe('radni_stol');
    expect(result[0].index).toBe(1);
    expect(result[1].index).toBe(2);
    expect(result[0].panels.length).toBeGreaterThan(0);
  });

  it('returns empty panels for unknown module', () => {
    const result = computeCuttingListByModule([{ ime: 'unknown', p: {} }]);
    expect(result[0].panels).toEqual([]);
  });
});

describe('toCsvString', () => {
  it('produces valid CSV with BOM', () => {
    const list = [
      { name: 'stranice m1', material: 'UNIVER 18MM', L: 720, W: 550, qty: 2, kant: '1d i 2k' },
    ];
    const csv = toCsvString(list);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('NAZIV;MATERIJAL;DUZINA;SIRINA;KOMADA;KANTOVANJE');
    expect(csv).toContain('stranice m1;UNIVER 18MM;720;550;2;1d i 2k');
  });

  it('uses CRLF line endings', () => {
    const csv = toCsvString([{ name: 'test', material: 'MDF 18MM', L: 100, W: 50, qty: 1, kant: '' }]);
    expect(csv).toContain('\r\n');
  });
});
