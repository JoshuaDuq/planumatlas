import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Region } from '../../types/index.ts';
import { manifests } from '../clinical/test-support.ts';
import { anatomies } from './test-support.ts';
import { partsSystem } from './parts.ts';

const manifest = manifests.find(([, entry]) => entry.anatomy.id === anatomies.default)![1];
const regions = new Map(manifest.regions.map((region) => [region.id, region]));
const unit = (id: string) => regions.get(id)!;

test('CAT-71 · the published units that make up most of a NextBrain system', () => {
  const found = manifest.regions
    .filter((region) => region.atlas === 'learning')
    .flatMap((region) => {
      const parts = partsSystem(region, regions);
      return parts ? [`${region.id} > ${parts.detail}:${parts.system}`] : [];
    });
  assert.deepEqual(found, [
    'learning:left:subthalamic > nextbrain:Subthalamus',
    'learning:right:subthalamic > nextbrain:Subthalamus',
    'learning:left:septal > nextbrain:Basal forebrain',
    'learning:right:septal > nextbrain:Basal forebrain',
    'learning:left:thalamus > nextbrain:Thalamus',
    'learning:right:thalamus > nextbrain:Thalamus',
    'learning:left:hypothalamus > nextbrain:Hypothalamus',
    'learning:right:hypothalamus > nextbrain:Hypothalamus',
    'learning:left:hippocampus > nextbrain:Hippocampus',
    'learning:right:hippocampus > nextbrain:Hippocampus',
    'learning:left:amygdala > nextbrain:Limbic',
    'learning:right:amygdala > nextbrain:Limbic',
    'learning:ventricles-left > aseg:Ventricles and CSF',
    'learning:ventricles-right > aseg:Ventricles and CSF',
    'learning:corpus-callosum > aseg:Corpus callosum',
  ]);
});

test('CAT-71 · a unit that is a small share of its system, or has no drawn parts, has no parts view', () => {
  // The substantia nigra is 2 of the brainstem's structures.
  assert.equal(partsSystem(unit('learning:left:substantia-nigra'), regions), null);
  const whole = manifest.regions.find(
    (region) => region.atlas === 'learning' && !region.constituent_regions,
  )!;
  assert.equal(partsSystem(whole, regions), null);
});

test('CAT-71 · parts in two systems or two levels have no single view; a missing part throws', () => {
  const [first, second] = unit('learning:left:thalamus').constituent_regions!;
  const other = manifest.regions.find(
    (region) => region.atlas === 'nextbrain' && region.source_name === 'putamen',
  )!;
  const mixed = { ...unit('learning:left:thalamus'), constituent_regions: [first!, other.id] };
  assert.equal(partsSystem(mixed as Region, regions), null);
  const levels = {
    ...unit('learning:left:thalamus'),
    constituent_regions: [first!, second!, 'learning:left:substantia-nigra'],
  };
  assert.equal(partsSystem(levels as Region, regions), null);
  const missing = { ...unit('learning:left:thalamus'), constituent_regions: ['nextbrain:left:0'] };
  assert.throws(
    () => partsSystem(missing as Region, regions),
    /^Error: Missing learning constituent: nextbrain:left:0$/,
  );
});
