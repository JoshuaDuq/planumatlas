import assert from 'node:assert/strict';
import { describe, it, test } from 'vitest';

test('MRI preserves native display pixels even on an integrated GPU', () => {
  const quality = qualityProfile({ integrated: true, pixelRatio: 2 });
  assert.equal(quality.pixelRatio, 1.5);
  assert.equal(quality.mriPixelRatio, 2);
});
import {
  motionRatio,
  msaaSamplesFor,
  outlineMaskScale,
  predictedFrameMs,
  qualityProfile,
  stepSettledRatio,
} from './quality.ts';
import type { FrameReading, SettledStepping } from './quality.ts';

test('a phone starts at one CSS pixel, may step to its density up to 2, and reduces MSAA', () => {
  const quality = qualityProfile({
    phone: true,
    coarse: true,
    saveData: false,
    pixelRatio: 3,
    deviceMemory: 4,
  });
  assert.equal(quality.pixelRatio, 1);
  assert.equal(quality.settledCeiling, 2);
  assert.equal(quality.motionPixelRatio, 1);
  assert.equal(quality.msaaSamples, 2);
  assert.equal(quality.prefetchLayers, false);
  assert.equal(quality.prefetchCut, false);
});

test('a tablet caps pixel ratio at 1.5, does not step, and reduces MSAA', () => {
  const quality = qualityProfile({
    phone: false,
    coarse: true,
    saveData: false,
    pixelRatio: 3,
    deviceMemory: 8,
  });
  assert.equal(quality.pixelRatio, 1.5);
  assert.equal(quality.settledCeiling, 1.5);
  assert.equal(quality.msaaSamples, 2);
  assert.equal(quality.prefetchLayers, false);
  assert.equal(quality.prefetchCut, false);
});

test('a desktop workstation keeps pixel ratio at 2 and 4x MSAA', () => {
  const quality = qualityProfile({
    phone: false,
    coarse: false,
    saveData: false,
    pixelRatio: 3,
    deviceMemory: 16,
    integrated: false,
  });
  assert.equal(quality.pixelRatio, 2);
  assert.equal(quality.settledCeiling, 2);
  assert.equal(quality.msaaSamples, 4);
  assert.equal(quality.prefetchLayers, true);
});

test('a phone’s ceiling is its display density, at most 2; a phone at 1 has nothing to step to', () => {
  const ceiling = (pixelRatio: number) =>
    qualityProfile({ phone: true, coarse: true, pixelRatio, integrated: true }).settledCeiling;
  assert.deepEqual([3, 2.625, 2, 1.75, 1].map(ceiling), [2, 2, 2, 1.75, 1]);
});

test('an integrated GPU spends fewer pixels and uses 2x MSAA', () => {
  const quality = qualityProfile({
    phone: false,
    coarse: false,
    saveData: false,
    pixelRatio: 3,
    deviceMemory: 16,
    integrated: true,
  });
  assert.equal(quality.pixelRatio, 1.5);
  assert.equal(quality.msaaSamples, 2);
  assert.equal(quality.prefetchLayers, false);
});

test('Save-Data drops extra layer and cut prefetch', () => {
  const quality = qualityProfile({
    phone: false,
    coarse: false,
    saveData: true,
    pixelRatio: 2,
    deviceMemory: 8,
  });
  assert.equal(quality.prefetchLayers, false);
  assert.equal(quality.prefetchCut, false);
});

test('low-memory devices drop extra layer and cut prefetch even on a wide screen', () => {
  const quality = qualityProfile({
    phone: false,
    coarse: false,
    saveData: false,
    pixelRatio: 2,
    deviceMemory: 2,
  });
  assert.equal(quality.prefetchLayers, false);
  assert.equal(quality.prefetchCut, false);
});

test('an Apple Silicon Mac renders at its display density but keeps 2x MSAA', () => {
  // Measured on an M5: at 2x pixels an MRI cut misses ~2% of frames; 4x MSAA halves its rate.
  const quality = qualityProfile({
    phone: false,
    coarse: false,
    saveData: false,
    pixelRatio: 2,
    deviceMemory: 16,
    integrated: true,
    appleSilicon: true,
    effectiveType: '4g',
  });
  assert.equal(quality.pixelRatio, 2);
  assert.equal(quality.msaaSamples, 2);
  // The other atlas is a second set of meshes to fill; the cut is downloaded on any desktop.
  assert.equal(quality.prefetchLayers, false);
  assert.equal(quality.prefetchCut, true);
});

test('a slow connection drops cut prefetch on a desktop', () => {
  const quality = qualityProfile({
    phone: false,
    coarse: false,
    saveData: false,
    pixelRatio: 2,
    deviceMemory: 16,
    integrated: false,
    effectiveType: '3g',
  });
  assert.equal(quality.prefetchCut, false);
});

test('an iPad keeps the handheld budget although its GPU is Apple silicon', () => {
  const quality = qualityProfile({
    phone: false,
    coarse: true,
    saveData: false,
    pixelRatio: 2,
    deviceMemory: 8,
    integrated: true,
    appleSilicon: true,
  });
  assert.equal(quality.pixelRatio, 1.5);
});

test('a moving camera renders at most one device pixel per CSS pixel; a settled one keeps the full ratio', () => {
  const retina = qualityProfile({
    phone: false,
    coarse: false,
    pixelRatio: 2,
    integrated: true,
    appleSilicon: true,
  });
  assert.equal(retina.pixelRatio, 2);
  assert.equal(retina.motionPixelRatio, 1);
  const phone = qualityProfile({ phone: true, coarse: true, pixelRatio: 3 });
  assert.equal(phone.motionPixelRatio, phone.pixelRatio);
  const lowDpi = qualityProfile({ phone: false, coarse: false, pixelRatio: 1, integrated: false });
  assert.equal(lowDpi.motionPixelRatio, 1);
});

test('a moving picture keeps to a pixel budget, so a very large canvas drops below one pixel per CSS pixel', () => {
  assert.equal(motionRatio(1, 1120, 824), 1);
  assert.equal(motionRatio(2, 1120, 824), 1.47);
  assert.equal(motionRatio(1, 2240, 1392), 0.8);
  assert.equal(motionRatio(1, 0, 0), 1);
});

test('RENDER-46 a target above 4 M device pixels draws 2× MSAA; a smaller one keeps the device’s', () => {
  // 1512 × 1000 CSS px at 2× is 6 048 000 device pixels; at 1×, 1 512 000.
  assert.equal(msaaSamplesFor(4, 6_048_000), 2);
  assert.equal(msaaSamplesFor(4, 4_000_001), 2);
  assert.equal(msaaSamplesFor(4, 4_000_000), 4);
  assert.equal(msaaSamplesFor(4, 1_512_000), 4);
  assert.equal(msaaSamplesFor(2, 1_512_000), 2);
});

test('RENDER-46 the outline mask is drawn at half resolution from 2× up, in full below', () => {
  assert.deepEqual([0.8, 1, 1.5, 1.75, 2, 3].map(outlineMaskScale), [1, 1, 1, 1, 0.5, 0.5]);
});

test('RENDER-45 a frame predicted at another ratio grows only in its GPU part, with the pixels', () => {
  assert.equal(predictedFrameMs({ cpu: 9, total: 10 }, 1, 1.5), 9 + 1 * 2.25);
  assert.equal(predictedFrameMs({ cpu: 2, total: 10 }, 1, 1.5), 2 + 8 * 2.25);
  assert.equal(predictedFrameMs({ cpu: 4, total: 6 }, 1.5, 2), 4 + (2 * 16) / 9);
});

describe('RENDER-45 a phone’s settled ratio', () => {
  const phone = (ratio = 1, ceiling = 2): SettledStepping => ({ ratio, ceiling, readings: [] });
  const fast: FrameReading = { cpu: 2, total: 4 }; // 6.5 ms at 1.5 from 1; 5.6 ms at 2 from 1.5
  const tight: FrameReading = { cpu: 2, total: 8 }; // 15.5 ms at 1.5: over the budget
  const slow: FrameReading = { cpu: 4, total: 17 }; // over one 60 Hz refresh
  const feed = (state: SettledStepping, readings: FrameReading[]) =>
    readings.reduce(stepSettledRatio, state);

  it('steps up by 0.5 after three readings that all leave room at the next step, and starts counting again', () => {
    assert.equal(feed(phone(), [fast, fast]).ratio, 1);
    const stepped = feed(phone(), [fast, fast, fast]);
    assert.deepEqual(stepped, { ratio: 1.5, ceiling: 2, readings: [] });
    assert.equal(feed(stepped, [fast, fast]).ratio, 1.5);
    assert.equal(feed(stepped, [fast, fast, fast]).ratio, 2);
  });

  it('holds while any of the last three readings would not fit at the next step', () => {
    const held = feed(phone(), [fast, tight, fast, fast]);
    assert.equal(held.ratio, 1);
    assert.deepEqual(held.readings, [tight, fast, fast]);
    assert.equal(stepSettledRatio(held, fast).ratio, 1.5);
  });

  it('stops at its ceiling', () => {
    assert.equal(feed(phone(1.5, 1.75), [fast, fast, fast]).ratio, 1.75);
    const top = feed(phone(2, 2), [fast, fast, fast, fast]);
    assert.equal(top.ratio, 2);
    assert.equal(top.readings.length, 3);
  });

  it('steps down after two slow readings in a row, and never climbs back to the ratio it left', () => {
    assert.equal(feed(phone(2), [slow, fast]).ratio, 2);
    const down = feed(phone(2), [fast, slow, slow]);
    assert.deepEqual(down, { ratio: 1.5, ceiling: 1.5, readings: [] });
    assert.equal(feed(down, [fast, fast, fast, fast, fast, fast]).ratio, 1.5);
    assert.equal(feed(down, [slow, slow]).ratio, 1);
  });

  it('never goes below one pixel per CSS pixel', () => {
    const floor = feed(phone(1), [slow, slow, slow]);
    assert.equal(floor.ratio, 1);
    assert.equal(floor.ceiling, 2);
  });
});
