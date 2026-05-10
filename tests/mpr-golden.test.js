import { describe, it, expect } from 'vitest';
import { generateMPRContent } from '../src/exports.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

const UPDATE_FIXTURES = process.env.UPDATE_FIXTURES === '1';

function goldenTest(name, content) {
  const filePath = join(FIXTURES_DIR, name);
  if (UPDATE_FIXTURES || !existsSync(filePath)) {
    writeFileSync(filePath, content, 'utf8');
  }
  const expected = readFileSync(filePath, 'utf8');
  expect(content).toBe(expected);
}

describe('MPR golden-file tests', () => {
  it('default panel (720×550, D=18, BRR=4, BRP=1)', () => {
    const content = generateMPRContent(720, 550);
    goldenTest('default_720x550.mpr', content);
  });

  it('wide panel (1200×600, D=18)', () => {
    const content = generateMPRContent(1200, 600);
    goldenTest('wide_1200x600.mpr', content);
  });

  it('small panel with custom settings (400×300, D=16, BRR=6, F=25)', () => {
    const content = generateMPRContent(400, 300, { D: 16, BRR: 6, F: 25 });
    goldenTest('small_custom_400x300.mpr', content);
  });

  it('panel with high shelf count (800×500, BRP=4, TR=80)', () => {
    const content = generateMPRContent(800, 500, { BRP: 4, TR: 80 });
    goldenTest('high_shelf_800x500.mpr', content);
  });

  it('rounded dimensions (720.7×550.3)', () => {
    const content = generateMPRContent(720.7, 550.3);
    goldenTest('rounded_720x550.mpr', content);
  });

  it('minimal panel (100×50, D=16, BRR=2, BRP=0)', () => {
    const content = generateMPRContent(100, 50, { D: 16, BRR: 2, BRP: 0 });
    goldenTest('minimal_100x50.mpr', content);
  });
});
