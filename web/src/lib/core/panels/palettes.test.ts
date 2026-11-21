import assert from 'node:assert/strict';
import { test } from 'vitest';
import { LOBE_COLORS } from '../catalog/lobes.ts';
import { colourPalette } from './palettes.ts';

test('MAST-56 a colouring’s palette is its key’s colours, in its key’s order, and none for the rest', () => {
  const vis = [120, 18, 134] as const;
  const dmn = [205, 62, 78] as const;
  const sources = {
    networks: { networks: ['Vis', 'Default'], colors: { Default: dmn, Vis: vis } },
    cabNp: { networks: ['Default'], colors: { Default: [1, 2, 3] as const } },
    territories: { territories: [{ color: [4, 5, 6] as const }] as never },
    cerebellar: { regions: [{ color: [7, 8, 9] as const }] as never },
  };
  assert.deepEqual(colourPalette('lobe', {}), Object.values(LOBE_COLORS));
  assert.deepEqual(colourPalette('network', sources), [vis, dmn]);
  // The striatal map's networks are Yeo's own.
  assert.deepEqual(colourPalette('striatal', sources), [vis, dmn]);
  assert.deepEqual(colourPalette('cab-np', sources), [[1, 2, 3]]);
  assert.deepEqual(colourPalette('territory', sources), [[4, 5, 6]]);
  assert.deepEqual(colourPalette('cerebellar', sources), [[7, 8, 9]]);
  for (const mode of ['tissue', 'mri', 'atlas'] as const) {
    assert.equal(colourPalette(mode, sources), null, mode);
  }
  assert.equal(colourPalette('network', {}), null, 'a build without the networks');
});
