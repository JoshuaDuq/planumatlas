import { describe, expect, test } from 'vitest';
import published from '../../../../../public/models/cdmd/network-connectivity.json';
import { networks } from '../../../../../public/models/cdmd/manifest.json';
import {
  MAGMA,
  cellColour,
  magmaAt,
  networkSpans,
  pairR,
  readNetworkMatrix,
  type NetworkMatrix,
} from './network-matrix.ts';

const YEO = networks.networks;
const matrix = readNetworkMatrix(structuredClone(published), YEO);
const n = matrix.parcels.length;

describe('NETM-01 the published network matrix', () => {
  test('is read whole, and refused when it disagrees with itself or with the brain’s networks', () => {
    expect(n).toBe(200);
    const broken: [string, (data: NetworkMatrix) => void][] = [
      ['networks in another order', (data) => data.networks.reverse()],
      ['a parcel moved out of its network', (data) => data.parcels.push(data.parcels.shift()!)],
      ['a pair missing', (data) => data.r.pop()],
      ['a value past ±100', (data) => (data.r[0] = 101)],
      ['a fractional value', (data) => (data.r[0] = 12.5)],
      ['a block row short', (data) => data.blocks[0]!.pop()],
      ['a scale not from 0', (data) => (data.scale = [0.1, 0.65])],
      ['a negative share of 1', (data) => (data.negative_share = 1)],
    ];
    for (const [what, change] of broken) {
      const data = structuredClone(published) as NetworkMatrix;
      change(data);
      expect(() => readNetworkMatrix(data, YEO), what).toThrow('Invalid network matrix.');
    }
    expect(() => readNetworkMatrix(published, [...YEO].reverse())).toThrow();
  });

  test('runs network by network in Yeo’s order, left before right in each', () => {
    const spans = networkSpans(matrix);
    expect(spans.map(({ network, count }) => [network, count])).toEqual([
      ['Vis', 29],
      ['SomMot', 35],
      ['DorsAttn', 26],
      ['SalVentAttn', 22],
      ['Limbic', 12],
      ['Cont', 30],
      ['Default', 46],
    ]);
    for (const { start, count } of spans) {
      const sides = matrix.parcels.slice(start, start + count).map((p) => p.hemisphere);
      expect(sides).toEqual([...sides].sort());
    }
  });

  test('gives each pair once, the same either way round, and nothing for a parcel with itself', () => {
    expect(pairR(matrix, 3, 3)).toBeNull();
    expect(pairR(matrix, 0, 1)).toBe(matrix.r[0]! / 100);
    expect(pairR(matrix, 0, n - 1)).toBe(matrix.r[n - 2]! / 100);
    expect(pairR(matrix, n - 1, n - 2)).toBe(matrix.r.at(-1)! / 100);
    expect(pairR(matrix, 57, 140)).toBe(pairR(matrix, 140, 57));
  });

  test('has the block means its own pairs give, each network’s within itself on the diagonal', () => {
    // Recomputed from the published, rounded r: the order of `parcels` and of `r` agree.
    const spans = networkSpans(matrix);
    const mean = (a: (typeof spans)[number], b: (typeof spans)[number]) => {
      const z: number[] = [];
      for (let i = a.start; i < a.start + a.count; i += 1)
        for (let j = b.start; j < b.start + b.count; j += 1)
          if (i !== j) z.push(Math.atanh(pairR(matrix, i, j)!));
      return Math.tanh(z.reduce((sum, value) => sum + value, 0) / z.length);
    };
    spans.forEach((a, row) =>
      spans.forEach((b, column) => expect(mean(a, b)).toBeCloseTo(matrix.blocks[row]![column]!, 2)),
    );
    // Six networks correlate most within themselves; limbic does not.
    expect(matrix.within_exceeds).toEqual([true, true, true, true, false, true, true]);
    matrix.blocks.forEach((row, k) =>
      expect(row[k]! > Math.max(...row.filter((_, j) => j !== k))).toBe(matrix.within_exceeds[k]),
    );
  });
});

describe('NETM-02 the matrix’s colours', () => {
  test('run matplotlib’s magma from dark to light over 0 to the scale’s top, holding its ends', () => {
    expect(MAGMA).toHaveLength(33);
    expect(magmaAt(0)).toEqual([0, 0, 4]);
    expect(magmaAt(1)).toEqual([252, 253, 191]);
    expect(magmaAt(0.5)).toEqual(MAGMA[16]);
    // Between two stops: their mean, in sRGB.
    expect(magmaAt(1.5 / 32)).toEqual([7, 6, 26]);
    expect(matrix.scale).toEqual([0, 0.65]);
    expect(cellColour(matrix, -0.1)).toEqual(MAGMA[0]);
    expect(cellColour(matrix, 0.9)).toEqual(MAGMA[32]);
    expect(cellColour(matrix, 0.325)).toEqual(MAGMA[16]);
  });
});
