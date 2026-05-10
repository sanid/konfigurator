import { describe, it, expect } from 'vitest';
import { computeHardwareBOM, HARDWARE_PRICES } from '../src/hardware.js';

describe('computeHardwareBOM', () => {
  it('returns empty BOM for empty plan', () => {
    const bom = computeHardwareBOM([]);
    expect(bom.items).toEqual([]);
    expect(bom.grandTotal).toBe(0);
  });

  it('returns empty BOM for sporet (appliances have no hardware)', () => {
    const bom = computeHardwareBOM([{ ime: 'sporet', p: {} }]);
    expect(bom.items).toEqual([]);
  });

  it('returns empty BOM for samostojeci_frizider', () => {
    const bom = computeHardwareBOM([{ ime: 'samostojeci_frizider', p: {} }]);
    expect(bom.items).toEqual([]);
  });

  describe('radni_stol (standard base cabinet)', () => {
    const bom = computeHardwareBOM([
      { ime: 'radni_stol', p: { s: 60, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } },
    ]);

    it('includes hinges (2 per door × 2 doors = 4)', () => {
      const hinges = bom.items.find(i => i.item === 'hinge_soft_close');
      expect(hinges).toBeDefined();
      expect(hinges.qty).toBe(4);
    });

    it('includes handles (1 per door × 2 doors)', () => {
      const handles = bom.items.find(i => i.item === 'handle_knob');
      expect(handles).toBeDefined();
      expect(handles.qty).toBe(2);
    });

    it('includes 4 legs', () => {
      const legs = bom.items.find(i => i.item === 'leveler_leg');
      expect(legs).toBeDefined();
      expect(legs.qty).toBe(4);
    });

    it('includes shelf pins (4 per shelf × 1)', () => {
      const pins = bom.items.find(i => i.item === 'shelf_pin_clip');
      expect(pins).toBeDefined();
      expect(pins.qty).toBe(4);
    });

    it('grand total is positive', () => {
      expect(bom.grandTotal).toBeGreaterThan(0);
    });

    it('each item has correct total (qty × unitPrice)', () => {
      for (const item of bom.items) {
        expect(item.total).toBeCloseTo(item.qty * item.unitPrice, 2);
      }
    });
  });

  describe('fiokar (drawer cabinet)', () => {
    const bom = computeHardwareBOM([
      { ime: 'fiokar', p: { s: 60, v: 82, d: 55, c: 10, brf: 4, brfp: 2, brfd: 1 } },
    ]);

    it('includes drawer slides for all drawers', () => {
      const slides = bom.items.find(i => i.item === 'drawer_slide_500');
      expect(slides).toBeDefined();
      expect(slides.qty).toBe(6);
    });

    it('includes handles for all drawers', () => {
      const handles = bom.items.find(i => i.item === 'handle_bar_128');
      expect(handles).toBeDefined();
      expect(handles.qty).toBe(3);
    });
  });

  describe('aggregation across modules', () => {
    it('aggregates identical hardware across two base cabinets', () => {
      const bom = computeHardwareBOM([
        { ime: 'radni_stol', p: { s: 60, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } },
        { ime: 'radni_stol', p: { s: 60, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } },
      ]);
      const hinges = bom.items.find(i => i.item === 'hinge_soft_close');
      expect(hinges.qty).toBe(8);
      const legs = bom.items.find(i => i.item === 'leveler_leg');
      expect(legs.qty).toBe(8);
    });
  });

  describe('gola (handleless) variants', () => {
    it('gola_radni_stol uses gola profile instead of handles', () => {
      const bom = computeHardwareBOM([
        { ime: 'gola_radni_stol', p: { s: 60, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } },
      ]);
      const profile = bom.items.find(i => i.item === 'gola_profile_60cm');
      expect(profile).toBeDefined();
      const handles = bom.items.find(i => i.item === 'handle_knob');
      expect(handles).toBeUndefined();
    });

    it('gola_radni_stol with 80cm width uses 80cm profile', () => {
      const bom = computeHardwareBOM([
        { ime: 'gola_radni_stol', p: { s: 80, v: 82, d: 55, c: 10, brvr: 2, brp: 1 } },
      ]);
      const profile = bom.items.find(i => i.item === 'gola_profile_80cm');
      expect(profile).toBeDefined();
    });
  });

  describe('upper cabinets', () => {
    it('klasicna_viseca uses wall brackets instead of legs', () => {
      const bom = computeHardwareBOM([
        { ime: 'klasicna_viseca', p: { s: 60, v: 70, d: 35, brp: 1, brvr: 2 } },
      ]);
      const brackets = bom.items.find(i => i.item === 'wall_bracket');
      expect(brackets).toBeDefined();
      expect(brackets.qty).toBe(2);
      const legs = bom.items.find(i => i.item === 'leveler_leg');
      expect(legs).toBeUndefined();
    });
  });

  describe('countertop', () => {
    it('radna_ploca has brackets only', () => {
      const bom = computeHardwareBOM([
        { ime: 'radna_ploca', p: { l: 120, d: 60 } },
      ]);
      expect(bom.items.length).toBe(1);
      expect(bom.items[0].item).toBe('countertop_bracket');
      expect(bom.items[0].qty).toBe(4);
    });
  });

  describe('items are sorted by total descending', () => {
    it('most expensive items come first', () => {
      const bom = computeHardwareBOM([
        { ime: 'fiokar', p: { s: 60, v: 82, d: 55, c: 10, brf: 4, brfp: 2, brfd: 1 } },
      ]);
      for (let i = 1; i < bom.items.length; i++) {
        expect(bom.items[i - 1].total).toBeGreaterThanOrEqual(bom.items[i].total);
      }
    });
  });
});
