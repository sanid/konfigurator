import { describe, it, expect } from 'vitest';
import { coerceNumericParams, fmtCm, fmtEur, fmtRsd } from '../src/utils.js';

describe('coerceNumericParams', () => {
  it('converts string numbers to numbers', () => {
    const result = coerceNumericParams({ s: '60', v: '82', d: '55' });
    expect(result).toEqual({ s: 60, v: 82, d: 55 });
  });

  it('preserves non-numeric strings', () => {
    const result = coerceNumericParams({ tip_klizaca: 'skriveni', name: 'test' });
    expect(result).toEqual({ tip_klizaca: 'skriveni', name: 'test' });
  });

  it('handles mixed values', () => {
    const result = coerceNumericParams({ s: '60', v: 82, tip: 'skriveni', flag: true });
    expect(result.s).toBe(60);
    expect(result.v).toBe(82);
    expect(result.tip).toBe('skriveni');
    expect(result.flag).toBe(true);
  });

  it('handles empty strings as NaN → preserves empty string', () => {
    const result = coerceNumericParams({ s: '' });
    expect(result.s).toBe('');
  });

  it('handles floats', () => {
    const result = coerceNumericParams({ rerna: '58.5' });
    expect(result.rerna).toBe(58.5);
  });

  it('returns empty object for empty input', () => {
    expect(coerceNumericParams({})).toEqual({});
  });
});

describe('fmtCm', () => {
  it('formats cm with Serbian locale comma', () => {
    const result = fmtCm(82.5);
    expect(result).toContain(',');
  });

  it('formats integer cm values', () => {
    const result = fmtCm(60);
    expect(result).toContain('60');
  });
});

describe('fmtEur', () => {
  it('formats EUR with 2 decimal places', () => {
    const result = fmtEur(123.5);
    expect(result).toContain('€');
    expect(result).toContain('123,5');
  });
});

describe('fmtRsd', () => {
  it('formats RSD with thousands separator', () => {
    const result = fmtRsd(12345);
    expect(result).toContain('RSD');
    expect(result).toContain('12.345');
  });
});
