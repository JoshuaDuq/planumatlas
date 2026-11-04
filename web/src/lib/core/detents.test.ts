// Ported from viewer/ui/chrome/detents.test.js, case for case.
import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  DETENTS,
  SIDEWAYS_DETENTS,
  UPRIGHT_DETENTS,
  clampDrag,
  detentHeights,
  nearestDetent,
  releaseVelocity,
  settleDetent,
  stepDetent,
  type Detent,
} from './detents.ts';

const heights = detentHeights(800, UPRIGHT_DETENTS);

test('heights rise through the three rests', () => {
  assert.deepEqual(heights, { peek: 132, half: 400, full: 672 });
});

test('a measured grip is the peek rest', () => {
  assert.equal(detentHeights(784, { ...UPRIGHT_DETENTS, peek: 101 }).peek, 101);
});

test('full leaves the same band of picture on a tall phone and a short one', () => {
  for (const available of [784, 607]) {
    assert.equal(
      available - detentHeights(available, UPRIGHT_DETENTS).full,
      UPRIGHT_DETENTS.picture,
    );
  }
});

test('a short screen keeps the rests distinct and ordered', () => {
  const short = detentHeights(200, UPRIGHT_DETENTS);
  assert.ok(short.peek <= short.half && short.half <= short.full);
  assert.ok(short.full <= 200);
});

test('a screen shorter than the peek height never overflows it', () => {
  const tiny = detentHeights(80, UPRIGHT_DETENTS);
  assert.equal(tiny.peek, 80);
  assert.ok(tiny.full <= 80);
});

test('nearest detent picks the closest rest', () => {
  assert.equal(nearestDetent(140, heights), 'peek');
  assert.equal(nearestDetent(430, heights), 'half');
  assert.equal(nearestDetent(700, heights), 'full');
});

test('a slow drag settles by position', () => {
  assert.equal(settleDetent(420, heights, 0), 'half');
  assert.equal(settleDetent(150, heights, 0.1), 'peek');
  // Just under the flick threshold, moving away from the nearest rest, position still decides.
  assert.equal(settleDetent(450, heights, -0.39), 'half');
});

test('a flick lands on the rest nearest where it would coast to', () => {
  // 0.5 px/ms coasts 250 px: from just above peek that is half, though 140 px is nearest peek.
  assert.equal(settleDetent(140, heights, 0.5), 'half');
  assert.equal(settleDetent(460, heights, -0.5), 'peek');
  // One hard throw from peek crosses half to full.
  assert.equal(settleDetent(140, heights, 1.2), 'full');
  assert.equal(settleDetent(640, heights, -1.2), 'peek');
});

// The rests the phone measured (sheet.json): peek 95, half 396, full 664 at 390 x 844.
const measured = { peek: 95, half: 396, full: 664 };

test('a swipe from peek released at 545 px still moving up goes on to full, not back to half', () => {
  assert.equal(settleDetent(545, measured, 0.5), 'full');
  assert.equal(settleDetent(545, measured, 0.9), 'full');
});

test('peek to full is one throw', () => {
  assert.equal(settleDetent(215, measured, 0.9), 'full');
  assert.equal(settleDetent(365, measured, 3), 'full');
});

test('dragged from full to 92 px and flicked down, the sheet goes to peek, not back up to half', () => {
  assert.equal(settleDetent(92, measured, -0.9), 'peek');
});

test('a throw never lands on a rest behind it, even when that rest is nearer where it would coast', () => {
  // With full far away, a short flick just past half coasts nearer half than full.
  const far = { peek: 100, half: 200, full: 1000 };
  assert.equal(settleDetent(210, far, 0.4), 'full');
  assert.equal(settleDetent(990, far, -0.4), 'half');
});

test('a flick at the end of the range stays there rather than wrapping', () => {
  assert.equal(settleDetent(700, heights, 1.2), 'full');
  assert.equal(settleDetent(120, heights, -1.2), 'peek');
});

test('drag is free between the rests', () => {
  assert.equal(clampDrag(440, heights), 440);
  assert.equal(clampDrag(132, heights), 132);
  assert.equal(clampDrag(heights.full, heights), heights.full);
});

test('drag past a limit resists rather than stopping dead', () => {
  const over = clampDrag(heights.full + 100, heights);
  assert.ok(
    over > heights.full && over < heights.full + 100,
    'keeps moving, but not with the finger',
  );
  const under = clampDrag(32, heights);
  assert.ok(under < 132 && under > 32);
});

test('stepping walks the rests and stops at the ends', () => {
  assert.equal(stepDetent('peek', 1), 'half');
  assert.equal(stepDetent('half', 1), 'full');
  assert.equal(stepDetent('full', 1), 'full');
  assert.equal(stepDetent('full', -1), 'half');
  assert.equal(stepDetent('peek', -1), 'peek');
});

test('an unknown rest falls back to the lowest', () => {
  assert.equal(stepDetent('nonsense' as Detent, 1), 'peek');
  assert.deepEqual(DETENTS, ['peek', 'half', 'full']);
});

test('both working rests leave half the screen to the anatomy', () => {
  const upright = detentHeights(812, UPRIGHT_DETENTS);
  const sideways = detentHeights(812, SIDEWAYS_DETENTS);
  assert.equal(upright.half, 406);
  assert.equal(sideways.half, upright.half);
  assert.ok(sideways.full < upright.full);
  assert.ok(
    sideways.peek > upright.peek,
    'the narrowest side rail still holds the name, the statement and the handle',
  );
});

test('sideways, the measured row of tabs is peek and half still opens past it', () => {
  // The French tab row, with and without an iPhone's 47px notch inset, on a 844 and a 667 screen.
  for (const [available, row] of [
    [844, 299 + 47],
    [844, 299],
    [667, 299],
  ]) {
    const sideways = detentHeights(available, { ...SIDEWAYS_DETENTS, peek: row });
    assert.equal(sideways.peek, row);
    assert.ok(
      sideways.half > sideways.peek && sideways.full > sideways.half,
      `${available}px: three distinct rests`,
    );
  }
});

test('sideways rests stay ordered and inside the screen', () => {
  const sideways = detentHeights(812, SIDEWAYS_DETENTS);
  assert.ok(sideways.peek <= sideways.half && sideways.half <= sideways.full);
  assert.ok(sideways.full <= 812);
});

test('release velocity reads only the throw just before the finger lifts', () => {
  const throwUp = [
    { at: 0, span: 132 },
    { at: 400, span: 150 },
    { at: 450, span: 190 },
    { at: 480, span: 220 },
  ];
  assert.ok(Math.abs(releaseVelocity(throwUp, 480) - 70 / 80) < 1e-9);
});

test('a finger that stopped before lifting has no velocity', () => {
  assert.equal(
    releaseVelocity(
      [
        { at: 0, span: 132 },
        { at: 40, span: 300 },
      ],
      400,
    ),
    0,
  );
  assert.equal(releaseVelocity([{ at: 0, span: 132 }], 0), 0);
});

test('resistance past a limit never exceeds the overshoot however far the finger goes', () => {
  const near = clampDrag(heights.full + 20, heights) - heights.full;
  const far = clampDrag(heights.full + 2000, heights) - heights.full;
  assert.ok(near > 8 && near < 20, 'starts at about half the finger');
  assert.ok(far < 72 && far > near);
});
