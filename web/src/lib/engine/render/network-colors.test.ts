import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  FloatType,
  RGBAFormat,
  SRGBColorSpace,
} from 'three';
import type { Rgb } from '../../types/index.ts';
import {
  PALETTE_SIZE,
  checkTerritories,
  majorityTerritoryColor,
  networkPalette,
  paletteTexture,
} from './network-colors.ts';

const METADATA = {
  networks: ['Vis', 'SomMot', 'DorsAttn', 'SalVentAttn', 'Limbic', 'Cont', 'Default'],
  colors: {
    Vis: [120, 18, 134],
    SomMot: [70, 130, 180],
    DorsAttn: [0, 118, 14],
    SalVentAttn: [196, 58, 250],
    Limbic: [220, 248, 164],
    Cont: [230, 148, 34],
    Default: [205, 62, 78],
  } as Record<string, Rgb>,
};

const texel = (values: Float32Array, index: number) =>
  Array.from(values.slice(index * 4, index * 4 + 4));

/** The texture is float32; Color computes in float64, so they differ in the last bits. */
const assertChannels = (actual: number[], expected: number[]) => {
  expected.forEach((value, channel) => {
    assert.ok(
      Math.abs(actual[channel]! - value) < 1e-6,
      `channel ${channel}: ${actual[channel]} is not ${value}`,
    );
  });
};

const linear = (name: string) => {
  const [red, green, blue] = METADATA.colors[name]!;
  const color = new Color().setRGB(red / 255, green / 255, blue / 255, SRGBColorSpace);
  return [color.r, color.g, color.b];
};

const palette = () => networkPalette(METADATA).image.data as Float32Array;

test('SHADER-08 texel k holds the k-th network’s published colour in linear float, present', () => {
  const texture = networkPalette(METADATA);
  assert.equal(texture.image.width, PALETTE_SIZE);
  assert.equal(texture.image.height, 1);
  assert.equal(texture.format, RGBAFormat);
  // A byte per channel would round the linear colour the vertices drew with before.
  assert.equal(texture.type, FloatType);
  METADATA.networks.forEach((name, index) => {
    assertChannels(texel(palette(), index + 1), [...linear(name), 1]);
  });
  // sRGB 120/255 is 0.47; linear must be darker, or the palette renders washed out.
  assert.ok(texel(palette(), 1)[0]! < 120 / 255);
  // Bit for bit the float32 values the per-vertex attribute held.
  assert.deepEqual(texel(palette(), 7), Array.from(new Float32Array([...linear('Default'), 1])));
});

test('SHADER-09 texel 0 and every texel past the palette are transparent, keeping the region colour', () => {
  const values = palette();
  assert.deepEqual(texel(values, 0), [0, 0, 0, 0]);
  for (const index of [8, 99, PALETTE_SIZE - 1])
    assert.deepEqual(texel(values, index), [0, 0, 0, 0]);
});

test('SHADER-09 a palette holds at most one colour per byte index past 0', () => {
  const colors = Array.from({ length: PALETTE_SIZE }, (): Rgb => [1, 2, 3]);
  assert.throws(() => paletteTexture(colors), RangeError);
  assert.doesNotThrow(() => paletteTexture(colors.slice(1)).dispose());
});

test('SHADER-10 geometry keeps its byte index and gains no per-vertex colour attribute', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('_territory', new BufferAttribute(new Uint8Array([1, 0, 2, 0]), 1));
  checkTerritories(geometry, [{ color: [255, 0, 0] }, { color: [0, 0, 255] }]);
  assert.deepEqual(Object.keys(geometry.attributes), ['_territory']);
});

test('a territory index takes its branch colour, none keeps the region colour, and one past the palette fails', () => {
  const past = new BufferGeometry();
  past.setAttribute('_territory', new BufferAttribute(new Float32Array([1, 3]), 1));
  assert.throws(
    () => checkTerritories(past, [{ color: [255, 0, 0] }, { color: [0, 0, 255] }]),
    /Vertex index 3 has no published territory/,
  );
  const values = paletteTexture([
    [255, 0, 0],
    [0, 0, 255],
  ]).image.data as Float32Array;
  assertChannels(texel(values, 1), [1, 0, 0, 1]);
  assert.deepEqual(texel(values, 0), [0, 0, 0, 0]);
  assertChannels(texel(values, 2), [0, 0, 1, 1]);
  assert.deepEqual(texel(values, 3), [0, 0, 0, 0]);
  assert.doesNotThrow(() => checkTerritories(new BufferGeometry(), [{ color: [1, 2, 3] }]));
});

test('a structure drawn whole takes a majority territory, or the one territory round a small one', () => {
  const territories = [
    { id: 'aca', color: [59, 111, 182] as Rgb },
    { id: 'mca-frontal', color: [47, 143, 91] as Rgb },
  ];
  const shares = (fraction: number) => ({ territories: [{ territory: 'aca', fraction }] });
  assert.deepEqual(majorityTerritoryColor(shares(0.5), territories), [59, 111, 182]);
  assert.equal(majorityTerritoryColor(shares(0.49), territories), null);
  // Too small for shares: coloured only where no border passes near it.
  assert.deepEqual(
    majorityTerritoryColor({ territories_near: ['mca-frontal'] }, territories),
    [47, 143, 91],
  );
  assert.equal(
    majorityTerritoryColor({ territories_near: ['aca', 'mca-frontal'] }, territories),
    null,
  );
  assert.equal(majorityTerritoryColor({}, territories), null);
  assert.throws(() => majorityTerritoryColor({ territories_near: ['pca'] }, territories), /pca/);
});
