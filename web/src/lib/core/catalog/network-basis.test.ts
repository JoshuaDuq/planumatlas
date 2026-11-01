import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Manifest, Region } from '../../types/index.ts';
import * as networks from './networks.ts';
import { anatomies, readModel } from './test-support.ts';

// The legacy file's third test (both languages explain the denominator and the 5 % threshold)
// reads `t('en' | 'fr', 'networks')` from i18n, which C1 owns; C1's tests carry it.

test('cortical surfaces and projected NextBrain compositions declare their different samples', () => {
  assert.equal(networks.networkBasis({ atlas: 'destrieux', kind: 'cortex' }), 'vertices');
  assert.equal(networks.networkBasis({ atlas: 'hcp-mmp', kind: 'cortex' }), 'vertices');
  assert.equal(networks.networkBasis({ atlas: 'nextbrain', kind: 'tissue-region' }), 'voxels');
  assert.equal(networks.networkBasis({ atlas: 'choi', kind: 'tissue-region' }), 'territory');
  assert.throws(() => networks.networkBasis({ atlas: 'unknown', kind: 'unknown' }), /basis/);
});

test('a striatal structure shows its network shares down to 5 %, and nothing else does', () => {
  const region = {
    striatal_networks: [
      { network: 'Cont', fraction: 0.6 },
      { network: 'SomMot', fraction: 0.05 },
      { network: 'Vis', fraction: 0.049 },
    ],
  };
  assert.deepEqual(
    networks.striatalNetworksOf(region).map((share) => share.network),
    ['Cont', 'SomMot'],
  );
  const cortical: Region = {
    id: 'schaefer:left:1',
    label: 'A parcel',
    hemisphere: 'left',
    kind: 'cortex',
    networks: [{ network: 'Cont', fraction: 1 }],
  };
  assert.deepEqual(networks.striatalNetworksOf(cortical), []);
});

test('every published composition has a supported measurement basis', () => {
  for (const anatomy of anatomies.anatomies) {
    const manifest = readModel<Manifest>(`${anatomy.id}/manifest.json`);
    for (const region of manifest.regions.filter((region) => region.networks?.length)) {
      assert.ok(
        ['vertices', 'voxels', 'territory'].includes(networks.networkBasis(region)),
        region.id,
      );
    }
  }
});
