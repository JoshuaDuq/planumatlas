import { expect, test } from 'vitest';
import { SULC_RAMP, sulcExtent } from './sulcal-depth.ts';

/** CIE L* of an sRGB byte colour. */
function lightness([red, green, blue]: readonly number[]): number {
  const linear = (byte: number) => {
    const value = byte / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * linear(red!) + 0.7152 * linear(green!) + 0.0722 * linear(blue!);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}

test('SULC-03 the ramp diverges from a neutral centre, lighter toward it from either end, ends legible on the dark stage', () => {
  const centre = SULC_RAMP[16]!;
  expect(new Set(centre).size).toBe(1);
  const toCentre = (stops: readonly (readonly number[])[]) =>
    stops.map(lightness).every((value, at, all) => at === 0 || value > all[at - 1]!);
  expect(toCentre(SULC_RAMP.slice(0, 17))).toBe(true);
  expect(toCentre(SULC_RAMP.slice(16).reverse())).toBe(true);
  // Both ends near the same lightness, so neither sign reads as more: L* 36–41.
  for (const end of [SULC_RAMP[0]!, SULC_RAMP.at(-1)!]) {
    expect(lightness(end)).toBeGreaterThan(35);
    expect(lightness(end)).toBeLessThan(42);
  }
});

test('SULC-04 the key spans the published depths’ larger end, out to the whole mm, around 0', () => {
  // CDMD and the MNI template as published.
  expect(sulcExtent({ _SULC: [-14.046584129333496, 17.397871017456055] })).toBe(18);
  expect(sulcExtent({ _SULC: [-12.238524436950684, 16.294612884521484] })).toBe(17);
  expect(sulcExtent({ _SULC: [-20.2, 3] })).toBe(21);
  expect(sulcExtent({ _SULC: [-9, 12] })).toBe(12);
  expect(sulcExtent({ _OPENNESS: [0, 1] })).toBeNull();
  expect(sulcExtent(undefined)).toBeNull();
});
