import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  discRadius,
  eccentricityAt,
  fromDisc,
  hemisphereFor,
  parseVisualFieldTerritories,
  polar,
  predictedResponse,
  territoryOf,
  toDisc,
} from './visual-field.ts';

const sidecar = (left: Record<string, number[]>) => ({
  areas: { V1: 1, V2: 2, V3: 3 },
  hemispheres: { left, right: { x: [-1], y: [0], area: [1], mm2: [5] } },
});

test('the territory counts each vertex whose pRF centre lies inside the dot, by area and hemisphere', () => {
  const territories = parseVisualFieldTerritories(
    sidecar({ x: [1, 1.9, 2.1, 1], y: [0, 0, 0, 0.5], area: [1, 2, 1, 3], mm2: [2, 3, 7, 11] }),
  );
  assert.deepEqual(territoryOf(territories, { x: 1, y: 0, radius: 1 }), {
    left: { V1: 2, V2: 3, V3: 11 },
    right: { V1: 0, V2: 0, V3: 0 },
  });
  // A dot over the vertical meridian reaches both hemispheres.
  assert.deepEqual(territoryOf(territories, { x: 0, y: 0, radius: 1 }).right.V1, 5);
});

test('a sidecar that codes the areas differently, or lists cortex outside V1–V3, is refused', () => {
  assert.throws(
    () =>
      parseVisualFieldTerritories({
        ...sidecar({ x: [], y: [], area: [], mm2: [] }),
        areas: { V1: 0 },
      }),
    /code V1, V2 and V3/,
  );
  assert.throws(
    () => parseVisualFieldTerritories(sidecar({ x: [0], y: [0], area: [4], mm2: [1] })),
    /outside V1–V3/,
  );
  assert.throws(
    () => parseVisualFieldTerritories(sidecar({ x: [0, 1], y: [0], area: [1], mm2: [1] })),
    /differ in length/,
  );
});

test('the right half-field is the left hemisphere’s, and the meridian is neither’s', () => {
  assert.equal(hemisphereFor({ x: 0.1, y: 3 }), 'left');
  assert.equal(hemisphereFor({ x: -0.1, y: 3 }), 'right');
  assert.equal(hemisphereFor({ x: 0, y: 3 }), null);
});

test('polar angle runs from the upper vertical meridian to the lower on either side', () => {
  assert.deepEqual(polar({ x: 0, y: 2 }), { eccentricity: 2, angle: 0 });
  assert.deepEqual(polar({ x: -3, y: 0 }), { eccentricity: 3, angle: 90 });
  assert.equal(polar({ x: 0, y: -1 }).angle, 180);
});

test('the disc scale is logarithmic, puts the measured 8° near three fifths and inverts exactly', () => {
  assert.equal(discRadius(0, 90), 0);
  assert.equal(discRadius(90, 90), 1);
  assert.ok(Math.abs(discRadius(8, 90) - 0.594) < 0.001);
  // Away from fixation each doubling of eccentricity takes the same width of the disc.
  const doubling = (from: number) => discRadius(2 * from, 90) - discRadius(from, 90);
  assert.ok(Math.abs(doubling(16) / doubling(4) - 1) < 0.05);
  for (const eccentricity of [0.1, 1, 8, 45]) {
    assert.ok(Math.abs(eccentricityAt(discRadius(eccentricity, 90), 90) - eccentricity) < 1e-9);
  }
  const point = { x: 3, y: -4 };
  const back = fromDisc(toDisc(point, 90), 90);
  assert.ok(Math.abs(back.x - 3) < 1e-9 && Math.abs(back.y + 4) < 1e-9);
  // A place past the rim is held at the field's edge.
  assert.ok(Math.abs(polar(fromDisc({ x: 2, y: 0 }, 90)).eccentricity - 90) < 1e-9);
});

test('the predicted response matches the non-central chi-squared share of the pRF inside the dot', () => {
  // [distance, radius, sigma, SciPy ncx2.cdf((r/s)², 2, (d/s)²) / ncx2.cdf((r/s)², 2, 0)]
  const reference = [
    [0, 1.5, 1, 1],
    [1.5, 1.5, 1, 0.5275565739578321],
    [2.5, 1.5, 1, 0.1511086231406696],
    [0.3, 0.05, 0.4, 0.7556681168964344],
    [5, 20, 2, 1],
    [30, 20, 2, 2.320448490633436e-7],
    [0, 0.0001, 3, 1],
  ] as const;
  for (const [distance, radius, sigma, expected] of reference) {
    const got = predictedResponse(distance, radius, sigma);
    assert.ok(Math.abs(got - expected) < 1e-4, `${distance}, ${radius}, ${sigma}: ${got}`);
  }
});

test('the predicted response refuses a pRF without width or a dot of negative radius', () => {
  assert.throws(() => predictedResponse(1, 1, 0), RangeError);
  assert.throws(() => predictedResponse(1, -1, 1), RangeError);
});
