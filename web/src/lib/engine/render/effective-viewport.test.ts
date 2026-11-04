import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  clearCorner,
  clearFraming,
  fitScale,
  viewOffset,
  visibleRect,
} from './effective-viewport.ts';

const canvas = { width: 400, height: 800 };

test('an uncovered canvas is entirely visible', () => {
  assert.deepEqual(visibleRect(canvas), { x: 0, y: 0, width: 400, height: 800 });
});

test('a bottom sheet takes height from the bottom only', () => {
  assert.deepEqual(visibleRect(canvas, { bottom: 300 }), { x: 0, y: 0, width: 400, height: 500 });
});

test('a side sheet takes width from the left only', () => {
  assert.deepEqual(visibleRect(canvas, { left: 160 }), { x: 160, y: 0, width: 240, height: 800 });
});

test('a masthead and a sheet both inset the same rectangle', () => {
  assert.deepEqual(visibleRect(canvas, { top: 52, bottom: 148 }), {
    x: 0,
    y: 52,
    width: 400,
    height: 600,
  });
});

test('insets that would consume the canvas are scaled back, never inverted', () => {
  const rect = visibleRect(canvas, { bottom: 900 });
  assert.equal(rect.height, 80, 'a tenth of the canvas is kept');
  assert.ok(rect.height > 0);
  assert.equal(rect.y, 0);
});

test('over-large insets keep their proportions when scaled back', () => {
  const rect = visibleRect(canvas, { top: 400, bottom: 1200 });
  // 1600 requested into 720 allowed: both shrink by the same factor.
  assert.equal(Math.round(rect.y), 180);
  assert.equal(Math.round(rect.height), 80);
});

test('a degenerate canvas reports nothing rather than a negative rectangle', () => {
  assert.deepEqual(visibleRect({ width: 0, height: 0 }), { x: 0, y: 0, width: 0, height: 0 });
  assert.deepEqual(visibleRect(null), { x: 0, y: 0, width: 0, height: 0 });
});

test('negative insets are treated as absent', () => {
  assert.deepEqual(visibleRect(canvas, { bottom: -50 }), { x: 0, y: 0, width: 400, height: 800 });
});

test('fit scale is the fraction of each axis left visible', () => {
  const rect = visibleRect(canvas, { bottom: 400 });
  assert.deepEqual(fitScale(canvas, rect), { horizontal: 1, vertical: 0.5 });
});

test('fit scale of an uncovered canvas leaves framing unchanged', () => {
  assert.deepEqual(fitScale(canvas, visibleRect(canvas)), { horizontal: 1, vertical: 1 });
});

test('a centred rectangle needs no view offset', () => {
  assert.equal(viewOffset(canvas, visibleRect(canvas)), null);
  assert.equal(viewOffset(canvas, visibleRect(canvas, { top: 100, bottom: 100 })), null);
});

test('a bottom sheet shifts the image up by half the covered height', () => {
  const offset = viewOffset(canvas, visibleRect(canvas, { bottom: 300 }))!;
  // Visible centre is 150px above the canvas centre, so the frustum moves down.
  assert.equal(offset.offsetY, 150);
  assert.equal(offset.offsetX, 0);
  assert.equal(offset.fullHeight, 800);
  assert.equal(offset.height, 800, 'the frustum is shifted, never narrowed');
});

test('a left sheet shifts the image right by half the covered width', () => {
  const offset = viewOffset(canvas, visibleRect(canvas, { left: 160 }))!;
  assert.equal(offset.offsetX, -80);
  assert.equal(offset.offsetY, 0);
});

test('a degenerate canvas has no view offset', () => {
  assert.equal(viewOffset({ width: 0, height: 0 }, { x: 0, y: 0, width: 0, height: 0 }), null);
});

/** The anatomy's band, in the visible rectangle, once the scene has applied a clearFraming result. */
function framedBand(
  { height }: { height: number },
  { inset, scale }: ReturnType<typeof clearFraming>,
  fill: number,
) {
  const centre = (height - inset) / 2;
  const half = fill * centre * scale.vertical;
  return { top: centre - half, bottom: centre + half };
}

test('a phone at half height keeps the anatomy off its letters and scale bar', () => {
  // Measured at 390 x 844 with the sheet at half: S ends 52px down, I starts 24px over the dock.
  const rect = { width: 390, height: 329 };
  const clear = { top: 60, bottom: 32, left: 28, right: 28 };
  const framing = clearFraming(rect, 66, clear, 0.8);
  const band = framedBand(rect, framing, 0.8);
  assert.ok(Math.abs(band.top - clear.top) < 1e-9, `top at ${band.top}`);
  assert.ok(
    Math.abs(band.bottom - (rect.height - 66 - clear.bottom)) < 1e-9,
    `bottom at ${band.bottom}`,
  );
  assert.equal(
    framing.scale.horizontal,
    1,
    'the side letters sit outside four fifths of the width',
  );
});

test('a desktop stage keeps four fifths of the room over the dock', () => {
  const rect = { width: 1120, height: 824 };
  const framing = clearFraming(rect, 54, { top: 36, bottom: 32, left: 28, right: 28 }, 0.8);
  const band = framedBand(rect, framing, 0.8);
  assert.ok(Math.abs(band.bottom - band.top - 0.8 * (824 - 54)) < 1e-9);
  assert.equal(framing.scale.horizontal, 1);
});

test('with nothing to clear, framing is the room over the dock', () => {
  const framing = clearFraming(
    { width: 600, height: 500 },
    60,
    { top: 0, bottom: 0, left: 0, right: 0 },
    0.8,
  );
  assert.equal(framing.inset, 60);
  assert.deepEqual(framing.scale, { horizontal: 1, vertical: 1 });
});

test('a stage too short for its markings still frames something', () => {
  const framing = clearFraming(
    { width: 390, height: 90 },
    66,
    { top: 60, bottom: 32, left: 28, right: 28 },
    0.8,
  );
  assert.ok(framing.scale.vertical > 0 && Number.isFinite(framing.scale.vertical));
  assert.ok(framing.inset >= 0);
});

/** The anatomy's centre and half extents in the room, once the scene has applied a clearCorner result. */
function cornerExtents(
  { width, height }: { width: number; height: number },
  { inset, top, right, scale }: ReturnType<typeof clearCorner>,
  fill: number,
) {
  const centre = { x: (width - right) / 2, y: (top + height - inset) / 2 };
  return {
    centre,
    across: (fill * scale.horizontal * (width - right)) / 2,
    half: (fill * scale.vertical * (height - inset - top)) / 2,
  };
}

/** How far outside the ellipse inscribed in the extents the box's nearest point lies; 1 is on it. */
function ellipseReach(
  { centre, across, half }: ReturnType<typeof cornerExtents>,
  box: { x: number; y: number; width: number; height: number },
) {
  const x = Math.max(box.x, Math.min(centre.x, box.x + box.width));
  const y = Math.max(box.y, Math.min(centre.y, box.y + box.height));
  return ((x - centre.x) / across) ** 2 + ((y - centre.y) / half) ** 2;
}

// Measured at 375 x 812 with the sheet at half: the gizmo's glyphs and gap take 246-356 x 21-131.
const phoneRoom = { width: 375, height: 380 };
const phoneFraming = clearFraming(phoneRoom, 70, { top: 64, bottom: 34, left: 32, right: 32 }, 0.8);
const phoneGizmo = { x: 246, y: 21, width: 110, height: 110 };

test('a corner box outside the anatomy leaves the framing as it was', () => {
  const corner = clearCorner(phoneRoom, phoneFraming, { x: 350, y: 0, width: 25, height: 20 }, 0.8);
  assert.equal(corner.size, 1);
  assert.equal(corner.top, 0);
  assert.equal(corner.right, 0);
  assert.deepEqual(corner.scale, phoneFraming.scale);
});

test('a gizmo over a phone half sheet moves the anatomy aside instead of taking the band below it', () => {
  const corner = clearCorner(phoneRoom, phoneFraming, phoneGizmo, 0.8);
  const kept = cornerExtents(phoneRoom, corner, 0.8);
  const whole = cornerExtents(phoneRoom, { ...phoneFraming, top: 0, right: 0, size: 1 }, 0.8);
  // Clear of the gizmo, and only just: any larger and the ellipse would reach it.
  assert.ok(Math.abs(ellipseReach(kept, phoneGizmo) - 1) < 1e-6);
  assert.ok(Math.abs(kept.across / whole.across - corner.size) < 1e-9);
  assert.ok(Math.abs(kept.half / whole.half - corner.size) < 1e-9);
  // Inside the room's own framing, so the markings stay clear.
  assert.ok(kept.centre.x - kept.across >= whole.centre.x - whole.across - 1e-9);
  assert.ok(kept.centre.y + kept.half <= whole.centre.y + whole.half + 1e-9);
  // Ceding the band below the gizmo, as the stage did, kept 72 px of half height.
  const rest = { width: 375, height: 380 - 131 };
  const band = framedBand(
    rest,
    clearFraming(rest, 70, { top: 0, bottom: 34, left: 32, right: 32 }, 0.8),
    0.8,
  );
  assert.ok(kept.half > 1.15 * ((band.bottom - band.top) / 2), `half ${kept.half}`);
});
