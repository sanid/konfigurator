import { describe, it, expect, vi } from 'vitest';
import { calcKant, computeCostBreakdown } from '../src/price-utils.js';
import { state } from '../src/state.js';

describe('calcKant', () => {
  it('returns zeros for empty kant string', () => {
    expect(calcKant('', 720, 550)).toEqual({ k: 0, K: 0 });
  });

  it('returns zeros for "/" kant string', () => {
    expect(calcKant('/', 720, 550)).toEqual({ k: 0, K: 0 });
  });

  it('parses "1d" — one long side, thin banding', () => {
    const result = calcKant('1d', 720, 550);
    expect(result.k).toBeCloseTo(0.72, 3);
    expect(result.K).toBe(0);
  });

  it('parses "2d" — two long sides, thin banding', () => {
    const result = calcKant('2d', 720, 550);
    expect(result.k).toBeCloseTo(1.44, 3);
    expect(result.K).toBe(0);
  });

  it('parses "1d i 2k" — one long thin + two short thin', () => {
    const result = calcKant('1d i 2k', 720, 550);
    expect(result.k).toBeCloseTo(0.72 + 1.10, 2);
    expect(result.K).toBe(0);
  });

  it('parses "2d i 2k" — two long thin + two short thin', () => {
    const result = calcKant('2d i 2k', 720, 550);
    expect(result.k).toBeCloseTo(1.44 + 1.10, 2);
    expect(result.K).toBe(0);
  });

  it('parses "2KK" — two short sides, thick banding', () => {
    const result = calcKant('2KK', 720, 550);
    expect(result.k).toBe(0);
    expect(result.K).toBeCloseTo(1.10, 2);
  });

  it('parses "1d i 1k" — one long thin + one short thin', () => {
    const result = calcKant('1d i 1k', 720, 550);
    expect(result.k).toBeCloseTo(0.72 + 0.55, 2);
    expect(result.K).toBe(0);
  });

  it('parses "2d i 2K" — two long thin + two short thick', () => {
    const result = calcKant('2d i 2K', 720, 550);
    expect(result.k).toBeCloseTo(1.44, 2);
    expect(result.K).toBeCloseTo(1.10, 2);
  });

  it('handles "2d i 2k" from vrata — typical door panel', () => {
    const result = calcKant('2d i 2k', 717, 297);
    expect(result.k).toBeCloseTo(1.434 + 0.594, 2);
    expect(result.K).toBe(0);
  });

  it('handles mixed "1d i 1K" — one long thin + one short thick', () => {
    const result = calcKant('1d i 1K', 500, 300);
    expect(result.k).toBeCloseTo(0.5, 2);
    expect(result.K).toBeCloseTo(0.3, 2);
  });

  it('handles implicit qty=1 when no digit prefix', () => {
    const result = calcKant('d', 720, 550);
    expect(result.k).toBeCloseTo(0.72, 3);
  });

  it('handles uppercase D same as lowercase d', () => {
    const result = calcKant('1D', 720, 550);
    expect(result.k).toBeCloseTo(0.72, 3);
  });
});

describe('computeCostBreakdown', () => {
  it('returns zero breakdown for empty plan', () => {
    const bd = computeCostBreakdown([]);
    expect(bd.grandTotal).toBe(0);
    expect(bd.panels).toEqual([]);
    expect(bd.hardware).toBe(0);
    expect(bd.totalKant).toBe(0);
  });

  it('computes panel costs by material type', () => {
    const plan = [{ ime: 'radni_stol', p: { s: 60, v: 82, d: 56, c: 10 } }];
    const bd = computeCostBreakdown(plan);
    expect(bd.panels.length).toBeGreaterThan(0);
    expect(bd.grandTotal).toBeGreaterThan(0);
    const univer = bd.panels.find((p) => p.material === 'UNIVER 18MM');
    expect(univer).toBeDefined();
    expect(univer.cost).toBeGreaterThan(0);
  });

  it('includes hardware in breakdown', () => {
    const plan = [{ ime: 'radni_stol', p: { s: 60, v: 82, d: 56, c: 10 } }];
    const bd = computeCostBreakdown(plan);
    expect(bd.hardware).toBeGreaterThan(0);
    expect(bd.subtotal).toBeCloseTo(
      bd.panels.reduce((s, p) => s + p.cost, 0) + bd.totalKant + bd.hardware,
      2,
    );
  });

  it('computes labor when laborPct > 0', () => {
    state.prices.laborPct = 10;
    const plan = [{ ime: 'radni_stol', p: { s: 60, v: 82, d: 56, c: 10 } }];
    const bd = computeCostBreakdown(plan);
    expect(bd.laborPct).toBe(10);
    expect(bd.labor).toBeCloseTo(bd.subtotal * 0.1, 2);
    expect(bd.grandTotal).toBeCloseTo(bd.subtotal + bd.labor, 2);
    state.prices.laborPct = 0;
  });

  it('computes margin on top of labor', () => {
    state.prices.laborPct = 10;
    state.prices.marginPct = 15;
    const plan = [{ ime: 'radni_stol', p: { s: 60, v: 82, d: 56, c: 10 } }];
    const bd = computeCostBreakdown(plan);
    expect(bd.margin).toBeCloseTo((bd.subtotal + bd.labor) * 0.15, 2);
    expect(bd.grandTotal).toBeCloseTo(bd.subtotal + bd.labor + bd.margin, 2);
    state.prices.laborPct = 0;
    state.prices.marginPct = 0;
  });

  it('includes RSD conversion at 117 rate', () => {
    const plan = [{ ime: 'radni_stol', p: { s: 60, v: 82, d: 56, c: 10 } }];
    const bd = computeCostBreakdown(plan);
    expect(bd.grandTotalRsd).toBeCloseTo(bd.grandTotal * 117, 1);
  });
});
