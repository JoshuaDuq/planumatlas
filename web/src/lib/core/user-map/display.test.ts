import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  defaultDisplay,
  fileStatistic,
  mapColour,
  mapNumber,
  mapTitle,
  validDisplay,
} from './display.ts';
import type { MapSummary } from './display.ts';

const summary = (range: [number, number], binary = false): MapSummary => ({
  shape: [2, 2, 2],
  voxelMm: [2, 2, 2],
  range,
  binary,
  intent: 0,
  description: '',
  cortexCovered: 1,
});

test('a value is drawn only when its magnitude is beyond the threshold, as nilearn masks inside it', () => {
  const display = { threshold: 3, max: 7 };
  assert.equal(mapColour(3, display), null);
  assert.equal(mapColour(-3, display), null);
  assert.equal(mapColour(Number.NaN, display), null);
  assert.equal(mapColour(0, { threshold: 0, max: 1 }), null);
  assert.deepEqual(
    mapColour(3.0001, display)?.map((c) => Math.round(c * 1000) / 1000),
    [1, 0, 0],
  );
});

test('each sign runs its own scale from the threshold to the top, and saturates beyond it', () => {
  const display = { threshold: 2, max: 6 };
  assert.deepEqual(mapColour(4, display), [1, 0.5, 0]);
  assert.deepEqual(mapColour(6, display), [1, 1, 0]);
  assert.deepEqual(mapColour(60, display), [1, 1, 0]);
  assert.deepEqual(mapColour(-4, display), [0, 0.5, 1]);
  assert.deepEqual(mapColour(-60, display), [0, 1, 1]);
});

test('a display needs a threshold of zero or more below a finite top, and some opacity', () => {
  const drawn = { threshold: 0, max: 1, opacity: 1 };
  assert.equal(validDisplay(drawn), true);
  assert.equal(validDisplay({ ...drawn, threshold: -1 }), false);
  assert.equal(validDisplay({ ...drawn, threshold: 1 }), false);
  assert.equal(validDisplay({ ...drawn, threshold: Number.NaN }), false);
  assert.equal(validDisplay({ ...drawn, max: Number.POSITIVE_INFINITY }), false);
  assert.equal(validDisplay({ ...drawn, opacity: 0 }), false);
  assert.equal(validDisplay({ ...drawn, opacity: 1.2 }), false);
});

test('a statistical map waits for its threshold, its scale rounded up to three digits; a mask is drawn at its edge', () => {
  assert.deepEqual(defaultDisplay(summary([-5.2, 7.8054])), {
    threshold: Number.NaN,
    max: 7.81,
    opacity: 1,
  });
  assert.equal(defaultDisplay(summary([-12.31, 3])).max, 12.4);
  assert.equal(defaultDisplay(summary([0, 0.3])).max, 0.3);
  assert.deepEqual(defaultDisplay(summary([0, 1], true)), { threshold: 0.5, max: 1, opacity: 1 });
});

test('the statistic is the intent code’s, else SPM’s description’s, else FSL’s or SPM’s output name’s', () => {
  assert.equal(fileStatistic(5, '', 'map.nii'), 'z');
  assert.equal(fileStatistic(3, 'SPM{F_[1.0,20.0]}', 'zstat1.nii.gz'), 't');
  assert.equal(fileStatistic(0, 'SPM{T_[23.0]} - contrast 1', 'con_0001.nii'), 't');
  assert.equal(fileStatistic(0, 'SPM{F_[1.0,20.0]}', 'x.nii'), 'F');
  assert.equal(fileStatistic(2, '', 'x.nii'), 'r');
  assert.equal(fileStatistic(0, '', 'zstat3.nii.gz'), 'z');
  assert.equal(fileStatistic(0, '', 'zfstat1.nii.gz'), 'z');
  assert.equal(fileStatistic(0, '', 'tstat12.nii.gz'), 't');
  assert.equal(fileStatistic(0, '', 'fstat1.nii.gz'), 'F');
  assert.equal(fileStatistic(0, '', 'spmT_0001.nii'), 't');
  assert.equal(fileStatistic(0, '', 'spmF_0002.nii'), 'F');
  // A contrast estimate or a name that only resembles one says nothing.
  assert.equal(fileStatistic(0, '', 'cope1.nii.gz'), null);
  assert.equal(fileStatistic(0, '', 'my_zstat.nii'), null);
  assert.equal(fileStatistic(1001, 'beta', 'beta_0001.nii'), null);
});

test('a title is the file’s name without its NIfTI extension', () => {
  assert.equal(mapTitle('zstat1.nii.gz'), 'zstat1');
  assert.equal(mapTitle('faces.NII'), 'faces');
  assert.equal(mapTitle('lesion.nii.gz.bak'), 'lesion.nii.gz.bak');
});

test('map numbers keep three significant digits in the reader’s notation', () => {
  assert.equal(mapNumber(7.8054, 'en'), '7.81');
  assert.equal(mapNumber(-3.1, 'fr'), '−3,1');
  assert.equal(mapNumber(1234.5, 'en'), '1235');
  assert.equal(mapNumber(0, 'en'), '0');
  assert.equal(mapNumber(0.000123, 'en'), '0.000123');
});
