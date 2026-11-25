// The thickness ramp and the published per-region file, against fixed values.
import { describe, expect, test } from 'vitest';
import type { Region } from '../../types/index.ts';
import {
  THICKNESS_RAMP,
  byteColours,
  rampColour,
  readRegionThickness,
  thicknessOf,
} from './cortical-thickness.ts';

const record = {
  encoding: { maximum_mm: 5, levels: 255, unmeasured: 0 },
  display_range_mm: [1, 4] as const,
};

describe('THICK-01 the ramp', () => {
  test('runs from viridis at 0.2 to its end, and holds its ends beyond them', () => {
    expect(rampColour(0)).toEqual([65, 68, 135]);
    expect(rampColour(1)).toEqual([253, 231, 37]);
    expect(rampColour(-1)).toEqual(rampColour(0));
    expect(rampColour(2)).toEqual(rampColour(1));
    // Halfway is the fifth of nine stops, viridis at 0.6.
    expect(rampColour(0.5)).toEqual([34, 168, 132]);
    // Between two stops, the even mix of their bytes, rounded.
    expect(rampColour(1 / 16)).toEqual([59, 82, 138]);
  });

  test('each byte draws the thickness it stands for: 1.0 mm and below the first stop, 4.0 mm and above the last', () => {
    expect(thicknessOf(0, record)).toBeNull();
    expect(thicknessOf(51, record)).toBe(1);
    const colours = byteColours(record);
    expect(colours).toHaveLength(255);
    // Byte k is texel k: index k − 1 here.
    expect(colours[51 - 1]).toEqual(THICKNESS_RAMP[0]);
    expect(colours[10 - 1]).toEqual(THICKNESS_RAMP[0]);
    expect(colours[204 - 1]).toEqual(THICKNESS_RAMP.at(-1));
    expect(colours[255 - 1]).toEqual(THICKNESS_RAMP.at(-1));
    // Byte 128 is 2.51 mm, just past halfway along 1–4 mm: just past viridis at 0.6.
    expect(colours[128 - 1]).toEqual([35, 169, 132]);
  });
});

describe('THICK-02 the published regions file', () => {
  const regions = new Map<string, Region>([
    ['desikan:left:24', { id: 'desikan:left:24', kind: 'cortex' } as Region],
    ['desikan:left:-1', { id: 'desikan:left:-1', kind: 'non-region' } as Region],
  ]);

  test('gives each cortical region its mean and standard deviation', () => {
    const read = readRegionThickness({ regions: { 'desikan:left:24': [2.535, 0.512] } }, regions);
    expect(read.get('desikan:left:24')).toEqual({ mean: 2.535, sd: 0.512 });
  });

  test.each([
    [{ regions: { 'desikan:left:-1': [1, 1] } }, 'is not a cortical region'],
    [{ regions: { 'desikan:left:99': [1, 1] } }, 'is not a cortical region'],
    [{ regions: { 'desikan:left:24': [1] } }, 'has no mean'],
    [{ regions: { 'desikan:left:24': [1, null] } }, 'has no mean'],
    [{}, 'No region thickness'],
  ])('refuses %j', (value, message) => {
    expect(() => readRegionThickness(value, regions)).toThrow(message);
  });
});
