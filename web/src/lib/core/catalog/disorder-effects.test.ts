import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Region } from '../../types/index.ts';
import {
  dColor,
  disorderPaint,
  effectsOf,
  reportedRegion,
  validateDisorderEffects,
  type DisorderEffects,
} from './disorder-effects.ts';
import { asRegion } from './test-support.ts';

const regions = new Map<string, Region>([
  ['desikan:left:7', asRegion({ atlas: 'desikan', kind: 'cortex' })],
  ['desikan:left:8', asRegion({ atlas: 'desikan', kind: 'cortex' })],
  ['aseg:left:17', asRegion({ atlas: 'aseg', kind: 'structure' })],
  ['destrieux:left:1', asRegion({ atlas: 'destrieux', kind: 'cortex' })],
]);
const measure = { pmid: 1, patients: 100, controls: 120, tested: 3 };
const data = (): DisorderEffects => ({
  id: 'disorder-effects',
  source: {
    short: 's',
    citation: 'c',
    pmid: 1,
    repository: 'https://github.com/x/y',
    commit: 'abc',
  },
  false_discovery_rate: 0.05,
  d_scale: {
    split: 0.2,
    smaller: [
      [1, 1, 1],
      [2, 2, 2],
    ],
    larger: [
      [3, 3, 3],
      [4, 4, 4],
    ],
  },
  regions: ['desikan:left:7', 'desikan:left:8', 'aseg:left:17'],
  disorders: [
    {
      id: 'a',
      name: { en: 'A', fr: 'A' },
      measures: { thickness: measure, volume: measure },
      effects: { 'desikan:left:7': -0.1, 'aseg:left:17': -1.7 },
    },
    {
      id: 'b',
      name: { en: 'B', fr: 'B' },
      measures: { thickness: measure, volume: measure },
      effects: { 'desikan:left:7': 0.45, 'aseg:left:17': 0.2 },
    },
  ],
});

test('INSP-52 · a region’s disorder differences run largest first, a teaching unit reading its structure’s', () => {
  const effects = validateDisorderEffects(data(), regions);
  const of = (id: string, units = {}) =>
    effectsOf(effects, reportedRegion(effects, id, units)!).map(({ disorder, d, measure }) => [
      disorder.id,
      d,
      measure,
    ]);
  assert.deepEqual(of('desikan:left:7'), [
    ['b', 0.45, 'thickness'],
    ['a', -0.1, 'thickness'],
  ]);
  assert.deepEqual(
    of('learning:hippocampus-left', { 'learning:hippocampus-left': 'aseg:left:17' }),
    [
      ['a', -1.7, 'volume'],
      ['b', 0.2, 'volume'],
    ],
  );
  // Reported with nothing significant: no rows, still reported.
  assert.deepEqual(of('desikan:left:8'), []);
  assert.equal(reportedRegion(effects, 'destrieux:left:1', {}), null);
});

test('STAGE-64 · a disorder paint colours each difference by direction and size, its stand-ins too', () => {
  const effects = validateDisorderEffects(data(), regions);
  // The split itself is the darker step.
  assert.deepEqual(dColor(effects, -0.19), [1, 1, 1]);
  assert.deepEqual(dColor(effects, -0.2), [2, 2, 2]);
  assert.deepEqual(dColor(effects, 0.19), [3, 3, 3]);
  assert.deepEqual(dColor(effects, 0.2), [4, 4, 4]);
  const paint = disorderPaint(effects, 'a', (id) =>
    id === 'aseg:left:17' ? ['learning:hippocampus-left'] : [],
  );
  assert.equal(paint.id, 'disorder:a');
  assert.deepEqual(
    [...paint.colors],
    [
      ['desikan:left:7', [1, 1, 1]],
      ['aseg:left:17', [2, 2, 2]],
      ['learning:hippocampus-left', [2, 2, 2]],
    ],
  );
  assert.throws(() => disorderPaint(effects, 'z', () => []), /Unknown disorder/);
});

test('a file naming a region the tables cannot report, or a zero difference, is refused', () => {
  const elsewhere = data();
  elsewhere.regions.push('destrieux:left:1');
  assert.throws(() => validateDisorderEffects(elsewhere, regions), /Invalid disorder effects/);
  const unlisted = data();
  unlisted.regions = unlisted.regions.filter((id) => id !== 'desikan:left:8');
  unlisted.disorders[1]!.effects['desikan:left:8'] = -0.3;
  assert.throws(
    () => validateDisorderEffects(unlisted, regions),
    /Invalid disorder effect of b on desikan:left:8/,
  );
  const zero = data();
  zero.disorders[1]!.effects['aseg:left:17'] = 0;
  assert.throws(() => validateDisorderEffects(zero, regions), /Invalid disorder effect of b/);
});
