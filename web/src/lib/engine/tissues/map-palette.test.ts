import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Color, SRGBColorSpace } from 'three';
import { mapPaletteData } from './map-palette.ts';
import type { Label } from './palette.ts';

const label = (region_id: string | null, color: [number, number, number]): Label => ({
  source_label_id: 0,
  name: region_id ?? 'background',
  color,
  hemisphere: 'left',
  kind: 'tissue',
  region_id,
});

test("only the map's own labels are opaque, in the linear colour the cut palette uses", () => {
  const labels = [
    label(null, [0, 0, 0]),
    label('aseg:left:11', [122, 186, 220]),
    label('choi:left:Cont', [230, 148, 34]),
    label('nettekoven:left:m3', [80, 40, 200]),
  ];
  const data = mapPaletteData(labels, 'choi');
  assert.deepEqual([data[3], data[7], data[15]], [0, 0, 0]);
  const linear = new Color().setRGB(230 / 255, 148 / 255, 34 / 255, SRGBColorSpace);
  assert.ok(Math.abs(data[8]! - linear.r) < 1e-6);
  assert.ok(Math.abs(data[9]! - linear.g) < 1e-6);
  assert.ok(Math.abs(data[10]! - linear.b) < 1e-6);
  assert.equal(data[11], 1);
  const cerebellar = mapPaletteData(labels, 'nettekoven');
  assert.deepEqual([cerebellar[11], cerebellar[15]], [0, 1]);
});
