import { describe, it, expect } from 'vitest';
import { buildDynamicPlan, validatePresetPlan } from '../src/presets.js';

describe('buildDynamicPlan', () => {
  describe('galley layout', () => {
    it('creates modules for a simple galley kitchen', () => {
      const plan = buildDynamicPlan('galley', { width: 300, isGola: false });
      expect(plan.length).toBeGreaterThan(0);
    });

    it('places modules at X=0 with r=0', () => {
      const plan = buildDynamicPlan('galley', { width: 120, isGola: false });
      expect(plan[0].pos[0]).toBe(0);
      expect(plan[0].r).toBe(0);
    });

    it('uses standard module names (not _gola)', () => {
      const plan = buildDynamicPlan('galley', { width: 300, isGola: false });
      plan.forEach(item => {
        expect(item.ime).not.toContain('_gola');
      });
    });

    it('uses _gola suffix when isGola=true', () => {
      const plan = buildDynamicPlan('galley', { width: 300, isGola: true });
      plan.forEach(item => {
        expect(item.ime).toMatch(/_gola$/);
      });
    });

    it('middle module defaults to fiokar', () => {
      const plan = buildDynamicPlan('galley', { width: 300, isGola: false });
      const count = plan.length;
      const middleIdx = Math.floor(count / 2);
      const middle = plan[middleIdx];
      if (count > 1) {
        expect(middle.ime).toBe('fiokar');
      }
    });

    it('last module gets remainder width', () => {
      const plan = buildDynamicPlan('galley', { width: 200, isGola: false });
      const last = plan[plan.length - 1];
      const totalWidth = plan.reduce((sum, item) => sum + item.sirina, 0);
      expect(totalWidth).toBe(200);
    });

    it('respects slotModules overrides', () => {
      const plan = buildDynamicPlan('galley', {
        width: 120,
        isGola: false,
        slotModules: { 'main-0': 'fiokar' },
      });
      expect(plan[0].ime).toBe('fiokar');
    });

    it('all modules have mat_pos', () => {
      const plan = buildDynamicPlan('galley', { width: 300, isGola: false });
      plan.forEach(item => {
        expect(item.mat_pos).toBeDefined();
        expect(item.mat_pos.length).toBe(2);
      });
    });

    it('all modules have sirina', () => {
      const plan = buildDynamicPlan('galley', { width: 300, isGola: false });
      plan.forEach(item => {
        expect(item.sirina).toBeGreaterThan(0);
      });
    });

    it('uses v=82 for standard and v=88 for gola', () => {
      const planStd = buildDynamicPlan('galley', { width: 120, isGola: false });
      expect(planStd[0].p.v).toBe('82');
      const planGola = buildDynamicPlan('galley', { width: 120, isGola: true });
      expect(planGola[0].p.v).toBe('88');
    });
  });

  describe('l-shape layout', () => {
    it('creates left corner + main + side for left', () => {
      const plan = buildDynamicPlan('l-shape', {
        width: 300, isGola: false, side: 'left', leftCount: 2,
      });
      const hasCorner = plan.some(item => item.ime === 'dug_element_90');
      expect(hasCorner).toBe(true);
      const hasSide = plan.some(item => item.r === 270);
      expect(hasSide).toBe(true);
    });

    it('creates main + right corner + side for right', () => {
      const plan = buildDynamicPlan('l-shape', {
        width: 300, isGola: false, side: 'right', rightCount: 2,
      });
      const hasCorner = plan.some(item => item.ime === 'dug_element_90_desni');
      expect(hasCorner).toBe(true);
      const hasSide = plan.some(item => item.r === 90);
      expect(hasSide).toBe(true);
    });

    it('side wall cabinets have correct rotation', () => {
      const planLeft = buildDynamicPlan('l-shape', {
        width: 300, isGola: false, side: 'left', leftCount: 3,
      });
      const leftSideModules = planLeft.filter(item => item.r === 270);
      expect(leftSideModules.length).toBe(3);

      const planRight = buildDynamicPlan('l-shape', {
        width: 300, isGola: false, side: 'right', rightCount: 2,
      });
      const rightSideModules = planRight.filter(item => item.r === 90);
      expect(rightSideModules.length).toBe(2);
    });
  });

  describe('u-shape layout', () => {
    it('creates both corners', () => {
      const plan = buildDynamicPlan('u-shape', {
        width: 400, isGola: false, leftCount: 2, rightCount: 2,
      });
      const hasLeftCorner = plan.some(item => item.ime === 'dug_element_90');
      const hasRightCorner = plan.some(item => item.ime === 'dug_element_90_desni');
      expect(hasLeftCorner).toBe(true);
      expect(hasRightCorner).toBe(true);
    });

    it('has both left and right side walls', () => {
      const plan = buildDynamicPlan('u-shape', {
        width: 400, isGola: false, leftCount: 2, rightCount: 3,
      });
      const leftSide = plan.filter(item => item.r === 270);
      const rightSide = plan.filter(item => item.r === 90);
      expect(leftSide.length).toBe(2);
      expect(rightSide.length).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('handles minimum width (60cm = 1 module)', () => {
      const plan = buildDynamicPlan('galley', { width: 60, isGola: false });
      expect(plan.length).toBe(1);
      expect(plan[0].sirina).toBe(60);
    });

    it('handles very wide wall', () => {
      const plan = buildDynamicPlan('galley', { width: 600, isGola: false });
      const totalWidth = plan.reduce((sum, item) => sum + item.sirina, 0);
      expect(totalWidth).toBe(600);
    });
  });
});

describe('validatePresetPlan', () => {
  it('returns no errors for valid plan', () => {
    const plan = buildDynamicPlan('galley', { width: 300, isGola: false });
    const errors = validatePresetPlan(plan);
    expect(errors).toEqual([]);
  });

  it('detects outward-facing modules', () => {
    const plan = [
      { ime: 'radni_stol', p: {}, pos: [0, 0, 0], r: 180 },
    ];
    const errors = validatePresetPlan(plan);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('r=180');
  });

  it('returns no errors for -180 rotation', () => {
    const plan = [
      { ime: 'radni_stol', p: {}, pos: [0, 0, 0], r: -180 },
    ];
    const errors = validatePresetPlan(plan);
    expect(errors.length).toBe(1);
  });
});
