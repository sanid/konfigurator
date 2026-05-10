import { describe, it, expect } from 'vitest';
import { generateMPRContent } from '../src/exports.js';

describe('generateMPRContent', () => {
  it('generates MPR string with CRLF endings', () => {
    const content = generateMPRContent(720, 550);
    expect(content).toContain('\r\n');
  });

  it('starts with [H header', () => {
    const content = generateMPRContent(720, 550);
    expect(content.startsWith('[H')).toBe(true);
  });

  it('contains VERSION header', () => {
    const content = generateMPRContent(720, 550);
    expect(content).toContain('VERSION="4.0 Alpha"');
  });

  it('embeds L and B dimensions in [001 section', () => {
    const content = generateMPRContent(720, 550);
    expect(content).toContain('[001');
    expect(content).toContain('L="720"');
    expect(content).toContain('B="550"');
  });

  it('uses default D=18 when not specified', () => {
    const content = generateMPRContent(720, 550);
    expect(content).toContain('D="18"');
  });

  it('uses custom D when provided', () => {
    const content = generateMPRContent(720, 550, { D: 16 });
    expect(content).toContain('D="16"');
  });

  it('uses default BRR=4', () => {
    const content = generateMPRContent(720, 550);
    expect(content).toContain('BRR="4"');
  });

  it('uses custom BRR', () => {
    const content = generateMPRContent(720, 550, { BRR: 6 });
    expect(content).toContain('BRR="6"');
  });

  it('uses default EX=24, F=20, BRP=1, TR=70', () => {
    const content = generateMPRContent(720, 550);
    expect(content).toContain('EX="24"');
    expect(content).toContain('F="20"');
    expect(content).toContain('BRP="1"');
    expect(content).toContain('TR="70"');
  });

  it('uses custom settings', () => {
    const content = generateMPRContent(720, 550, { EX: 30, F: 25, BRP: 3, TR: 80 });
    expect(content).toContain('EX="30"');
    expect(content).toContain('F="25"');
    expect(content).toContain('BRP="3"');
    expect(content).toContain('TR="80"');
  });

  it('sets _BSX, _BSY, _BSZ from dimensions', () => {
    const content = generateMPRContent(720, 550, { D: 18 });
    expect(content).toContain('_BSX=720.000000');
    expect(content).toContain('_BSY=550.000000');
    expect(content).toContain('_BSZ=18.000000');
  });

  it('rounds dimensions to integers', () => {
    const content = generateMPRContent(720.7, 550.3);
    expect(content).toContain('L="721"');
    expect(content).toContain('B="550"');
  });

  it('contains <109 Nuten (groove) section', () => {
    const content = generateMPRContent(720, 550);
    expect(content).toContain('<109 \\Nuten\\');
  });

  it('contains <102 BohrVert (drilling) sections', () => {
    const content = generateMPRContent(720, 550);
    const matches = content.match(/<102 \\BohrVert\\/g);
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });

  it('contains <100 WerkStck (workpiece) section', () => {
    const content = generateMPRContent(720, 550);
    expect(content).toContain('<100 \\WerkStck\\');
  });

  it('ends with ! terminator', () => {
    const content = generateMPRContent(720, 550);
    expect(content.trimEnd()).toMatch(/!$/);
  });

  it('contains ORI entries for each operation', () => {
    const content = generateMPRContent(720, 550);
    const oriMatches = content.match(/ORI="/g);
    expect(oriMatches.length).toBeGreaterThanOrEqual(5);
  });

  it('contains shelf pin drilling with BRP reference', () => {
    const content = generateMPRContent(720, 550, { BRP: 3 });
    expect(content).toContain('BRP="3"');
    expect(content).toContain('AN="BRP"');
    expect(content).toContain('AB="(L-D)/(BRP+1)"');
  });
});
