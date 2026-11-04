import assert from 'node:assert/strict';
import { test } from 'vitest';
import { angularFrequency, noOvershoot, springAt, springSettled } from './spring.ts';

test('a spring starts at rest at zero and ends at the target', () => {
  assert.deepEqual(springAt(0, 0.4), { value: 0, velocity: 0 });
  const late = springAt(2, 0.4);
  assert.ok(Math.abs(1 - late.value) < 1e-6);
  assert.ok(Math.abs(late.velocity) < 1e-4);
});

test('from rest it never passes the target, and its peak speed is ω/e at t = 1/ω', () => {
  const response = 0.38;
  const omega = angularFrequency(response);
  let peak = { at: 0, speed: 0 };
  for (let ms = 0; ms <= 1500; ms += 1) {
    const { value, velocity } = springAt(ms / 1000, response);
    assert.ok(value <= 1, `passed the target at ${ms} ms`);
    if (velocity > peak.speed) peak = { at: ms / 1000, speed: velocity };
  }
  assert.ok(Math.abs(peak.at - 1 / omega) < 0.001);
  assert.ok(Math.abs(peak.speed - omega / Math.E) < 0.01);
});

test('a thrown start keeps the velocity it was given', () => {
  assert.equal(springAt(0, 0.3, 5).velocity, 5);
  // Numerical derivative agrees with the closed form.
  const h = 1e-6;
  const slope = (springAt(0.05 + h, 0.3, 5).value - springAt(0.05 - h, 0.3, 5).value) / (2 * h);
  assert.ok(Math.abs(slope - springAt(0.05, 0.3, 5).velocity) < 1e-4);
});

test('a start faster than ω overshoots, and noOvershoot caps it there', () => {
  const response = 0.3;
  const omega = angularFrequency(response);
  const peakValue = (velocity: number) =>
    Math.max(
      ...Array.from({ length: 600 }, (_, ms) => springAt(ms / 1000, response, velocity).value),
    );
  assert.ok(peakValue(omega * 2) > 1);
  assert.ok(peakValue(noOvershoot(omega * 2, response)) <= 1);
  assert.equal(noOvershoot(-3, response), 0);
  assert.equal(noOvershoot(2, response), 2);
});

test('settling is judged in the move’s own units', () => {
  const near = springAt(0.5, 0.38);
  // The same instant is at rest for a 2-unit move and still travelling for a 2000-unit one.
  assert.equal(springSettled(near, 2, 0.05), true);
  assert.equal(springSettled(near, 2000, 0.05), false);
});

test('a spring needs a positive response', () => {
  assert.throws(() => springAt(0.1, 0), /response must be positive/);
});
