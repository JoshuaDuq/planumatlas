import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Region } from '../../types/index.ts';
import {
  band,
  differences,
  discordantPairs,
  exceptions,
  reaching,
  validateStrokeCases,
  type StrokeCase,
  type StrokeCases,
} from './stroke-cases.ts';

let at = 0;
const person = (
  id: string,
  aq: number,
  volume_cm3: number,
  regions: Record<string, number>,
  gap = 0,
): StrokeCase => {
  const entry: StrokeCase = {
    id,
    aq,
    type: 'Broca',
    scan_day: 400,
    test_day: 400 + gap,
    volume_cm3,
    regions,
    runs: [at, 2],
  };
  at += 2;
  return entry;
};

const cohort = (cases: StrokeCase[]): StrokeCases => ({
  id: 'stroke_cases',
  source: {
    short: 's',
    citation: 'c',
    doi: 'https://doi.org/10.1/x',
    pmid: 1,
    dataset: 'https://doi.org/10.1/y',
  },
  reaches_min: 0.05,
  test_windows: [90, 365],
  pairs: { volume_ratio_max: 1.25, aq_difference_min: 25 },
  aq_bands: [
    { id: 'very-severe', min: 0 },
    { id: 'severe', min: 26 },
    { id: 'moderate', min: 51 },
    { id: 'mild', min: 76 },
    { id: 'within-normal-limits', min: 93.8 },
  ],
  exceptions: { share_min: 0.4, aq_min: 76, shown: 2 },
  masks: { file: 'm', sha256: '0', shape: [2, 2, 2], order: 'F', voxel_to_surface_ras_mm: [] },
  cases,
});

const IFG = 'destrieux:left:12';

test('a case reaches a region from the threshold share, within the test window', () => {
  at = 0;
  const data = cohort([
    person('A', 20, 50, { [IFG]: 0.05 }),
    person('B', 20, 50, { [IFG]: 0.049 }),
    person('C', 20, 50, { [IFG]: 0.6 }, 91),
  ]);
  assert.deepEqual(
    reaching(data, IFG, 90).map((entry) => entry.id),
    ['A'],
  );
  assert.deepEqual(
    reaching(data, IFG, 365).map((entry) => entry.id),
    ['A', 'C'],
  );
});

test('pairs match volume within the ratio, differ by the score gap, widest first, each person once', () => {
  at = 0;
  const cases = [
    person('low', 10, 100, {}),
    person('high', 95, 110, {}),
    person('mid', 60, 105, {}),
    person('big', 99, 126, {}), // 126 / 100 is past the ratio, so it pairs with mid, not low or near
    person('near', 30, 100, {}),
  ];
  const pairs = discordantPairs(cohort(cases), cases);
  assert.deepEqual(
    pairs.map(([p, q]) => [p.id, q.id]),
    [
      ['low', 'high'],
      ['mid', 'big'],
    ],
  );
});

test('exceptions are much of the region lesioned with a mild aphasia or none, best score first', () => {
  at = 0;
  const cases = [
    person('a', 92, 80, { [IFG]: 0.9 }),
    person('b', 99, 80, { [IFG]: 0.41 }),
    person('c', 75, 80, { [IFG]: 0.95 }), // below the mild floor
    person('d', 98, 80, { [IFG]: 0.39 }), // too little of it
    person('e', 80, 80, { [IFG]: 0.5 }),
  ];
  assert.deepEqual(
    exceptions(cohort(cases), cases, IFG).map((entry) => entry.id),
    ['b', 'a'],
  );
});

test('a score takes the band whose floor it reaches', () => {
  const data = cohort([]);
  assert.equal(band(data, 0), 'very-severe');
  assert.equal(band(data, 25.9), 'very-severe');
  assert.equal(band(data, 93.7), 'mild');
  assert.equal(band(data, 93.8), 'within-normal-limits');
});

test('differences lead with the selected region and keep to its atlas and the deep structures', () => {
  at = 0;
  const a = person('a', 10, 80, {
    [IFG]: 0.3,
    'destrieux:left:40': 0.9,
    'hcp-mmp:left:44': 0.9,
    'aseg:left:12': 0.5,
  });
  const b = person('b', 90, 80, {
    [IFG]: 0.8,
    'destrieux:left:40': 0.85,
    'destrieux:left:3': 0.04,
  });
  const rows = differences(cohort([a, b]), a, b, IFG, 6);
  assert.deepEqual(
    rows.map((row) => row.id),
    [IFG, 'aseg:left:12', 'destrieux:left:40'],
  );
  assert.deepEqual(rows[0], { id: IFG, a: 0.3, b: 0.8 });
});

test('validation refuses a region the manifest does not publish and runs that do not follow on', () => {
  at = 0;
  const regions = new Map([[IFG, { id: IFG } as Region]]);
  validateStrokeCases(cohort([person('a', 10, 80, { [IFG]: 0.3 })]), regions);
  at = 0;
  assert.throws(
    () => validateStrokeCases(cohort([person('a', 10, 80, { 'destrieux:left:99': 0.3 })]), regions),
    /names destrieux:left:99/,
  );
  at = 0;
  const gap = person('a', 10, 80, {});
  const after = { ...person('b', 10, 80, {}), runs: [5, 2] as const };
  assert.throws(() => validateStrokeCases(cohort([gap, after]), regions), /Invalid stroke case b/);
});
