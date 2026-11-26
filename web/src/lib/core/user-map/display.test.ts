import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  COLOUR_SCALES,
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
  volumes: 1,
  secondsPerVolume: null,
  cortexCovered: 1,
});

test('a value is drawn only when its magnitude is beyond the threshold, as nilearn masks inside it', () => {
  const display = { threshold: 3, max: 7, colours: 'red-yellow' } as const;
  assert.equal(mapColour(3, display), null);
  assert.equal(mapColour(-3, display), null);
  assert.equal(mapColour(Number.NaN, display), null);
  assert.equal(mapColour(0, { threshold: 0, max: 1, colours: 'red-yellow' }), null);
  assert.deepEqual(
    mapColour(3.0001, display)?.map((c) => Math.round(c * 1000) / 1000),
    [1, 0, 0],
  );
});

test('each sign runs its own scale from the threshold to the top, and saturates beyond it', () => {
  const display = { threshold: 2, max: 6, colours: 'red-yellow' } as const;
  assert.deepEqual(mapColour(4, display), [1, 0.5, 0]);
  assert.deepEqual(mapColour(6, display), [1, 1, 0]);
  assert.deepEqual(mapColour(60, display), [1, 1, 0]);
  assert.deepEqual(mapColour(-4, display), [0, 0.5, 1]);
  assert.deepEqual(mapColour(-60, display), [0, 1, 1]);
});

test('FUNC-61 · a map drawn in the second scale runs green for positive values and magenta for negative ones', () => {
  const display = { threshold: 2, max: 6, colours: 'green-magenta' } as const;
  assert.deepEqual(
    mapColour(2.0001, display)?.map((c) => Math.round(c * 1000) / 1000),
    [0, 0.6, 0],
  );
  assert.deepEqual(mapColour(4, display), [0, 0.8, 0]);
  assert.deepEqual(mapColour(60, display), [0, 1, 0]);
  assert.deepEqual(mapColour(-4, display), [0.8, 0, 0.8]);
  assert.deepEqual(mapColour(-60, display), [1, 0, 1]);
});

test('FUNC-52 · against a paint, a positive value beyond the threshold is one colour off it and another on it', () => {
  const display = { threshold: 3, max: 7, colours: 'green-magenta' } as const;
  const colours = { map: [255, 0, 51], both: [0, 102, 0] } as const;
  const off = { colours, painted: false };
  const on = { colours, painted: true };
  assert.deepEqual(mapColour(3.5, display, off), [1, 0, 0.2]);
  assert.deepEqual(mapColour(70, display, on), [0, 0.4, 0]);
  // The threshold itself, negative values and no value are not drawn, painted or not.
  for (const value of [3, -5, Number.NaN]) {
    assert.equal(mapColour(value, display, off), null);
    assert.equal(mapColour(value, display, on), null);
  }
});

test('a display needs a threshold of zero or more below a finite top, and some opacity', () => {
  const drawn = { threshold: 0, max: 1, opacity: 1, colours: 'red-yellow' } as const;
  assert.equal(validDisplay(drawn), true);
  assert.equal(validDisplay({ ...drawn, colours: 'green-magenta' }), true);
  assert.equal(validDisplay({ ...drawn, colours: 'hot' as never }), false);
  assert.equal(validDisplay({ ...drawn, threshold: -1 }), false);
  assert.equal(validDisplay({ ...drawn, threshold: 1 }), false);
  assert.equal(validDisplay({ ...drawn, threshold: Number.NaN }), false);
  assert.equal(validDisplay({ ...drawn, max: Number.POSITIVE_INFINITY }), false);
  assert.equal(validDisplay({ ...drawn, opacity: 0 }), false);
  assert.equal(validDisplay({ ...drawn, opacity: 1.2 }), false);
});

test('a statistical map waits for its threshold, its scale rounded up to three digits; a mask is drawn at its edge', () => {
  assert.deepEqual(defaultDisplay(summary([-5.2, 7.8054]), 'red-yellow'), {
    threshold: Number.NaN,
    max: 7.81,
    opacity: 1,
    colours: 'red-yellow',
  });
  assert.equal(defaultDisplay(summary([-12.31, 3]), 'red-yellow').max, 12.4);
  assert.equal(defaultDisplay(summary([0, 0.3]), 'red-yellow').max, 0.3);
  assert.deepEqual(defaultDisplay(summary([0, 1], true), 'green-magenta'), {
    threshold: 0.5,
    max: 1,
    opacity: 1,
    colours: 'green-magenta',
  });
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

/** OKLab of an sRGB colour (channels 0–1). */
function oklab(rgb: readonly number[]): [number, number, number] {
  const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!);
  const m = Math.cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!);
  const s = Math.cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

test('FUNC-61 · every colour of the second scale keeps at least 0.19 OKLab ΔE from every colour of the first', () => {
  const along = ([low, high]: readonly (readonly number[])[]) =>
    Array.from({ length: 21 }, (_, step) => low!.map((c, k) => c + (step / 20) * (high![k]! - c)));
  const colours = ({ positive, negative }: (typeof COLOUR_SCALES)[keyof typeof COLOUR_SCALES]) =>
    [...along(positive), ...along(negative)].map(oklab);
  const first = colours(COLOUR_SCALES['red-yellow']);
  const second = colours(COLOUR_SCALES['green-magenta']);
  const least = Math.min(
    ...first.flatMap((a) => second.map((b) => Math.hypot(...a.map((c, k) => c - b[k]!)))),
  );
  assert.ok(least >= 0.19, `${least}`);
});
