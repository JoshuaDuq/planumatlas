import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Region } from '../../types/index.ts';
import { LOBE_COLORS, groupsByLobe, lobeColor, lobeOf, lobeRows } from './lobes.ts';
import { anatomies, asRegion, readModel } from './test-support.ts';

const regions = readModel<{ regions: Region[] }>(`${anatomies.default}/manifest.json`).regions;
const cortex = (atlas: string) =>
  regions.filter((region) => region.atlas === atlas && region.kind === 'cortex');

test('Destrieux and Julich-Brain group by lobe; the network-grouped atlases do not', () => {
  assert.deepEqual(['destrieux', 'julich', 'hcp-mmp', 'schaefer', null].map(groupsByLobe), [
    true,
    true,
    false,
    false,
    false,
  ]);
});

test('every published cortical region of a lobe atlas takes its lobe’s colour', () => {
  for (const atlas of ['destrieux', 'julich']) {
    const areas = cortex(atlas);
    assert.ok(areas.length > 100, atlas);
    for (const region of areas) {
      const lobe = lobeOf(region);
      assert.ok(lobe, `${region.id} has no lobe`);
      assert.deepEqual(lobeColor(region), LOBE_COLORS[lobe]);
    }
  }
});

test('a region outside the lobes keeps its own colour: structures, the unlabelled wall, other atlases', () => {
  const structure = regions.find((region) => region.kind === 'structure')!;
  const wall = regions.find(
    (region) => region.atlas === 'destrieux' && region.kind === 'non-region',
  )!;
  for (const region of [structure, wall, cortex('hcp-mmp')[0]!, cortex('schaefer')[0]!]) {
    assert.equal(lobeOf(region), null, region.id);
    assert.equal(lobeColor(region), null, region.id);
  }
});

test('a region’s lobe is the group its table lists it under', () => {
  const lobe = (source_name: string) =>
    lobeOf(asRegion({ atlas: 'destrieux', kind: 'cortex', hemisphere: 'left', source_name }));
  assert.equal(lobe('S_central'), 'Central');
  assert.equal(lobe('G_precentral'), 'Frontal');
  assert.equal(lobe('S_calcarine'), 'Occipital');
});

test('the key lists the atlas’s lobes front to back, named as the list names them', () => {
  assert.deepEqual(
    lobeRows(regions, 'destrieux', 'en').map((row) => row.label),
    [
      'Frontal',
      'Central',
      'Parietal',
      'Occipital',
      'Temporal',
      'Lateral fissure',
      'Insula',
      'Cingulate',
      'Limbic',
    ],
  );
  // Julich-Brain names no area in the lateral fissure.
  const julich = lobeRows(regions, 'julich', 'fr');
  assert.ok(!julich.some((row) => row.id === 'Lateral fissure'));
  assert.equal(julich.find((row) => row.id === 'Parietal')!.label, 'Pariétal');
  assert.deepEqual(julich.find((row) => row.id === 'Frontal')!.color, [136, 204, 238]);
  assert.deepEqual(lobeRows(regions, 'hcp-mmp', 'en'), []);
});

test('no two lobes share a colour', () => {
  const colours = Object.values(LOBE_COLORS).map((colour) => colour.join());
  assert.equal(new Set(colours).size, colours.length);
});
