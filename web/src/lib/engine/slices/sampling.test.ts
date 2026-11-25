import assert from 'node:assert/strict';
import { expect, test } from 'vitest';
import { readRepoJson } from '../../../../test/repo.ts';
import type { SegmentationAgreement } from '../../core/catalog/segmentation-agreement.ts';
import { createFrame, pointOnFrame, stagedFrame } from './coordinates.ts';
import type { Frame } from './coordinates.ts';
import { sampleSlice, windowSlice } from './sampling.ts';
import type { SliceDisplay, SliceVolumes, SliceWindow } from './sampling.ts';
import { publishedSlices, publishedVolume, referenceSlice } from './slice-test-support.ts';
import { Volume } from './volume.ts';
import type { VolumeFile } from './volume.ts';

/** Sampled and drawn through its window at once, as a plane is the first time the linked MRI draws it. */
const renderSlice = (volumes: SliceVolumes, frame: Frame, display: SliceDisplay & SliceWindow) =>
  windowSlice(sampleSlice(volumes, frame, display), display);

const affine = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];
const metadata = { shape: [4, 4, 4], order: 'F', voxel_to_surface_ras_mm: affine };
const data = new Uint8Array(64);
for (let z = 0; z < 4; z++)
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) data[x + 4 * (y + 4 * z)] = x + 10 * y + 40 * z;
const volumes = {
  mri: new Volume(metadata, data),
  segmentation: new Volume(metadata, new Uint16Array(64).fill(1)),
  metadata: { labels: { 1: { name: 'Test', color: [255, 0, 0] } } },
};
const display = { fieldOfView: 4, size: 4, windowCenter: 127.5, windowWidth: 255, overlay: false };

test('pixel centers, canvas top, and patient left/right agree in axial slices', () => {
  const frame = createFrame('axial', [1.5, 1.5, 1]);
  const pixels = renderSlice(volumes, frame, display);
  assert.deepEqual(Array.from(pixels.slice(0, 4)), [70, 70, 70, 255]);
  assert.deepEqual(Array.from(pixels.slice(-4)), [43, 43, 43, 255]);
  assert.deepEqual(pointOnFrame(frame, 0.125, 0.125, 4), [0, 3, 1]);
});

test('overlay preserves discrete source labels; background is transparent', () => {
  const frame = createFrame('axial', [1.5, 1.5, 1]);
  const pixels = renderSlice(volumes, frame, { ...display, overlay: true });
  assert.ok(pixels[0] > pixels[1]);
  const outside = renderSlice(volumes, createFrame('axial', [1.5, 1.5, 9]), display);
  assert.equal(outside[3], 0);
});

// Axial plane z = 1 at (1.5, 1.5): MRI 70 at the first pixel and 43 at the last (see above).
const frame = createFrame('axial', [1.5, 1.5, 1]);

test('SLICE-12 the grey level is the MRI value mapped through the window and clamped to 0..255', () => {
  // (70 - 90 + 10) * 255 / 20 < 0 and (70 - 40 + 10) * 255 / 20 > 255: both ends clamp.
  const dark = renderSlice(volumes, frame, { ...display, windowCenter: 90, windowWidth: 20 });
  assert.deepEqual(Array.from(dark.slice(0, 3)), [0, 0, 0]);
  const bright = renderSlice(volumes, frame, { ...display, windowCenter: 40, windowWidth: 20 });
  assert.deepEqual(Array.from(bright.slice(0, 3)), [255, 255, 255]);
  // Inside the window: (70 - 60 + 50) * 255 / 100 = 153.
  const inside = renderSlice(volumes, frame, { ...display, windowCenter: 60, windowWidth: 100 });
  assert.deepEqual(Array.from(inside.slice(0, 3)), [153, 153, 153]);
});

test('SLICE-13 a labelled pixel blends 0.55 of the grey with 0.45 of the label colour', () => {
  // Grey 70 under red: 0.55 * 70 + 0.45 * 255 = 153.25 and 0.55 * 70 = 38.5 (ties to even).
  const pixels = renderSlice(volumes, frame, { ...display, overlay: true });
  assert.deepEqual(Array.from(pixels.slice(0, 4)), [153, 38, 38, 255]);
  const plain = renderSlice(volumes, frame, display);
  assert.deepEqual(Array.from(plain.slice(0, 4)), [70, 70, 70, 255]);
});

test('shown agreement inks each voxel of the structure by which segmentation labels it, over the overlay', () => {
  // The structure is aseg label 1 and compared code 3; NextBrain has it where x < 2, and also at
  // x = 3, y = 3, where aseg labels nothing.
  const segmentation = new Uint16Array(64).fill(1);
  const compared = new Uint8Array(64);
  for (let z = 0; z < 4; z++)
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        if (x < 2) compared[x + 4 * (y + 4 * z)] = 3;
        if (x === 3 && y === 3) {
          compared[x + 4 * (y + 4 * z)] = 3;
          segmentation[x + 4 * (y + 4 * z)] = 0;
        }
      }
  const shown = {
    ...volumes,
    segmentation: new Volume(metadata, segmentation),
    agreement: { structure: { code: 3, aseg_label: 1 }, compared: new Volume(metadata, compared) },
  };
  const pixels = renderSlice(shown, frame, { ...display, overlay: true });
  const at = (x: number, y: number) =>
    Array.from(pixels.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4));
  // Row 0 is y = 3, row 3 is y = 0. Grey 70 at (0, 3): 0.55 * 70 + 0.45 * 236 = 144.7.
  assert.deepEqual(at(0, 0), [145, 145, 145, 255]);
  // Grey 43 at (3, 0), aseg only: 0.55 * 43 + 0.45 * [235, 70, 210].
  assert.deepEqual(at(3, 3), [129, 55, 118, 255]);
  // (3, 3) is NextBrain's alone, and drawn although aseg has no label there.
  const [, , blue, alpha] = at(3, 0);
  assert.equal(alpha, 255);
  assert.ok(blue < at(3, 0)[0]!);
});

test('SLICE-14 a size outside 2..2048 or non-integer, a flat field of view or window is a RangeError', () => {
  for (const bad of [
    { size: 1 },
    { size: 2.5 },
    { size: 2049 },
    { fieldOfView: 0 },
    { fieldOfView: Number.NaN },
    { windowCenter: Number.NaN },
    { windowWidth: 0 },
  ]) {
    assert.throws(() => renderSlice(volumes, frame, { ...display, ...bad }), RangeError);
  }
  renderSlice(volumes, frame, { ...display, size: 2 });
});

test('the reader’s map is drawn over the scan where it passes its threshold, by its opacity', () => {
  // x + y in the map: 0 at the first pixel's point (0, 3) is 3, the last's (3, 0) is 3 too, so use z.
  const map = (opacity: number) => ({
    at: (x: number, y: number) => (x === 0 && y === 3 ? 5 : x === 3 && y === 0 ? -5 : Number.NaN),
    display: { threshold: 3, max: 7, opacity },
    overlap: null,
  });
  const full = renderSlice({ ...volumes, map: map(1) }, frame, display);
  // 5 is halfway up the positive scale (red to yellow); −5 halfway up the negative (blue to light blue).
  assert.deepEqual(Array.from(full.slice(0, 4)), [255, 128, 0, 255]);
  assert.deepEqual(Array.from(full.slice(-4)), [0, 128, 255, 255]);
  // Half opacity lets the grey show through: 0.5 * 70 + 0.5 * 255 = 162.5, 0.5 * 70 + 0.5 * 127.5 = 98.75.
  const half = renderSlice({ ...volumes, map: map(0.5) }, frame, display);
  assert.deepEqual(Array.from(half.slice(0, 3)), [162, 99, 35]);
  // Within ±threshold, or without a value, the scan stays as it was.
  const hidden = renderSlice(
    { ...volumes, map: { ...map(1), display: { threshold: 6, max: 7, opacity: 1 } } },
    frame,
    display,
  );
  assert.deepEqual(Array.from(hidden.slice(0, 4)), [70, 70, 70, 255]);
  assert.deepEqual(Array.from(full.slice(4, 8)), Array.from(hidden.slice(4, 8)));
});

test('against a paint, the map’s positive values take one colour off the paint and another on it', () => {
  const labels = new Uint16Array(64);
  for (let index = 0; index < 64; index++) labels[index] = index % 4 >= 2 ? 2 : 1;
  const paint = { volume: new Volume(metadata, labels), colors: [null, null, [10, 200, 30]] };
  const map = {
    at: (x: number) => (x === 0 || x === 3 ? 5 : x === 1 ? -5 : Number.NaN),
    display: { threshold: 3, max: 7, opacity: 1 },
    overlap: { map: [213, 81, 129], both: [0, 131, 0] } as const,
  };
  const pixels = renderSlice({ ...volumes, paint, map }, frame, { ...display, overlay: true });
  const unmapped = renderSlice({ ...volumes, paint }, frame, { ...display, overlay: true });
  // The first row runs x = 0..3; x >= 2 is painted.
  const row = (x: number) => Array.from(pixels.slice(4 * x, 4 * x + 4));
  assert.deepEqual(row(0), [213, 81, 129, 255], 'the map off the paint');
  assert.deepEqual(row(1), Array.from(unmapped.slice(4, 8)), 'a negative value is not drawn');
  assert.deepEqual(row(2), [10, 200, 30, 255], 'the paint without the map');
  assert.deepEqual(row(3), [0, 131, 0, 255], 'both');
});

test("a paint draws each label of the cut atlas's grid in its own colour over the scan, as its cut faces do", () => {
  // Label 2 where x >= 2 is painted; label 1 elsewhere paints nothing.
  const labels = new Uint16Array(64);
  for (let index = 0; index < 64; index++) labels[index] = index % 4 >= 2 ? 2 : 1;
  const paint = { volume: new Volume(metadata, labels), colors: [null, null, [10, 200, 30]] };
  const pixels = renderSlice({ ...volumes, paint }, frame, { ...display, overlay: true });
  // Axial z = 1, rows from anterior: the first row runs x = 0..3 at y = 3.
  assert.deepEqual(
    Array.from(pixels.slice(0, 4)),
    [153, 38, 38, 255],
    'unpainted: scan and overlay',
  );
  assert.deepEqual(
    Array.from(pixels.slice(12, 16)),
    [10, 200, 30, 255],
    'painted: the paint, opaque',
  );
});

test('SLICE-41 a slice sampled once draws, through any window, the bytes that sampling it through that window drew', () => {
  const { volumes, display } = publishedSlices();
  const structure = readRepoJson<SegmentationAgreement>(
    'public/models/cdmd/segmentation-agreement.json',
  ).structures.find((entry) => entry.aseg_label === 12)!;
  const compared = publishedVolume(
    readRepoJson<{ segmentation_agreement: { volume: VolumeFile } }>(
      'public/models/cdmd/manifest.json',
    ).segmentation_agreement.volume,
  );
  // A paint on every third aseg label, and a map of both signs with holes, over and off the paint.
  const paint = {
    volume: volumes.segmentation,
    colors: Array.from({ length: 256 }, (_, label) =>
      label % 3 ? null : [label, 255 - label, (label * 7) % 256],
    ),
  };
  const map = (overlap: { map: number[]; both: number[] } | null) => ({
    at: (x: number, y: number, z: number) =>
      Math.abs(x + 30) < 2 ? Number.NaN : Math.sin(x / 5) * Math.cos(y / 7) + z / 100,
    display: { threshold: 0.3, max: 1.2, opacity: 0.65 },
    overlap: overlap as never,
  });
  const layers: [string, SliceVolumes, boolean][] = [
    ['the scan alone', volumes, false],
    ['labels', volumes, true],
    ['the left putamen’s agreement', { ...volumes, agreement: { structure, compared } }, true],
    ['a paint and a map', { ...volumes, paint, map: map(null) }, true],
    [
      'a map against the paint',
      { ...volumes, paint, map: map({ map: [213, 81, 129], both: [0, 131, 0] }) },
      false,
    ],
  ];
  // The published window, the narrowest the slider gives, a wide one, centres that clamp every pixel
  // to white and to black, and one between whole numbers.
  const windows: SliceWindow[] = [
    [display.window_center, display.window_width],
    [94, 10],
    [127.5, 1000],
    [-300, 40],
    [400, 40],
    [93.7, 187.3],
  ].map(([windowCenter, windowWidth]) => ({
    windowCenter: windowCenter!,
    windowWidth: windowWidth!,
  }));
  const firstDifference = (a: Uint8ClampedArray, b: Uint8ClampedArray) =>
    a.length === b.length ? a.findIndex((value, index) => value !== b[index]) : 0;
  // Through the left putamen, off the voxel grid; the scan's own 0.5 mm pixels over a 64 mm field.
  const crosshair = [-28.3, -8.6, 22.2] as const;
  for (const plane of ['sagittal', 'coronal', 'axial'] as const) {
    const frame = stagedFrame(plane, crosshair, false);
    for (const [name, shown, overlay] of layers) {
      const sampled = { size: 128, fieldOfView: 64, overlay };
      const samples = sampleSlice(shown, frame, sampled);
      for (const window of windows) {
        const expected = referenceSlice(shown, frame, { ...sampled, ...window });
        assert.equal(
          firstDifference(windowSlice(samples, window), expected),
          -1,
          `${plane}, ${name}, window ${window.windowCenter}/${window.windowWidth}`,
        );
      }
    }
  }
});

test('SECT-41 a cropped slice samples only its crop, and there draws the bytes of the whole slice', () => {
  const wide = { ...display, fieldOfView: 8, size: 8, overlay: true };
  const whole = renderSlice(volumes, frame, wide);
  const crop = { x: 2, y: 3, width: 4, height: 6 };
  let reads = 0;
  const counted = {
    ...volumes,
    mri: Object.assign(Object.create(volumes.mri) as Volume, {
      linear: (point: Iterable<number>) => (reads++, volumes.mri.linear(point)),
    }),
  };
  const cropped = windowSlice(sampleSlice(counted, frame, wide, crop), wide);
  // Rows 3–8 of an 8-row square: the crop's last two rows lie past it and are not read.
  expect(reads).toBe(4 * 5);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const index = (y * 8 + x) * 4;
      const inside = x >= 2 && x < 6 && y >= 3;
      const pixel = Array.from(cropped.slice(index, index + 4));
      if (inside) expect(pixel).toEqual(Array.from(whole.slice(index, index + 4)));
      else expect(pixel[3]).toBe(0);
    }
});

/** Label 1 on the two columns x = 2 and 3 of the 4 × 4 × 4 grid, 0 elsewhere. */
const rightHalf = () =>
  new Volume(
    metadata,
    new Uint16Array(64).map((_, index) => (index % 4 >= 2 ? 1 : 0)),
  );
/** The first row of the axial slice at z = 1, RGB only: grey 70 to 73 through the identity window. */
const firstRow = (extra: Partial<SliceVolumes>) =>
  Array.from(renderSlice({ ...volumes, ...extra }, frame, display).slice(0, 16)).filter(
    (_, index) => index % 4 < 3,
  );

test('SECT-46 the 3D view’s colours are mixed into the grey as the overlay’s are: 0.55 grey, 0.45 colour', () => {
  const colours = { volume: rightHalf(), colors: [null, [200, 40, 0]] };
  // x = 2: 72 × 0.55 + (200, 40, 0) × 0.45 = (129.6, 57.6, 39.6).
  expect(firstRow({ colours })).toEqual([70, 70, 70, 71, 71, 71, 130, 58, 40, 130, 58, 40]);
  const paint = { volume: rightHalf(), colors: [null, [1, 2, 3]] };
  expect(() => firstRow({ colours, paint })).toThrow('one grid of cut labels');
});

test('SECT-47 the selection is tinted as the overlay tints, and outlined two pixels wide across its edge', () => {
  const selection = { volume: rightHalf(), codes: new Set([1]), colour: [127, 208, 204] };
  // x = 1 and 2 straddle the edge; x = 3 is inside: 73 × 0.55 + colour × 0.45.
  expect(firstRow({ selection })).toEqual([70, 70, 70, 127, 208, 204, 127, 208, 204, 97, 134, 132]);
  // Over a paint by another grid, the outline is still drawn.
  const paint = {
    volume: new Volume(metadata, new Uint16Array(64).fill(1)),
    colors: [null, [9, 9, 9]],
  };
  expect(firstRow({ selection, paint })).toEqual([9, 9, 9, 127, 208, 204, 127, 208, 204, 9, 9, 9]);
});

test('SECT-47 a shown agreement inks the selected structure itself, so the selection draws nothing over it', () => {
  // aseg labels every voxel 1 and NextBrain the left half 3: aseg only on the right, both on the left.
  const agreement = {
    structure: { code: 3, aseg_label: 1 },
    compared: new Volume(
      metadata,
      new Uint8Array(64).map((_, index) => (index % 4 < 2 ? 3 : 0)),
    ),
  };
  const selection = { volume: rightHalf(), codes: new Set([1]), colour: [127, 208, 204] };
  // Grey 70 to 73: 0.55 grey + 0.45 × both (236, 236, 236) on the left, aseg only (235, 70, 210) on the right.
  const inked = [145, 145, 145, 145, 145, 145, 145, 71, 134, 146, 72, 135];
  expect(firstRow({ agreement })).toEqual(inked);
  expect(firstRow({ agreement, selection })).toEqual(inked);
});
