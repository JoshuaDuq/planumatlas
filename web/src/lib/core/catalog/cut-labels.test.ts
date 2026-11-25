import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { DisplaySettings, Paint, Region } from '../../types/index.ts';
import { anatomies, asRegion, readModel } from './test-support.ts';
import {
  MAP_ATLASES,
  SURFACE_MAPS,
  colourShowing,
  cutAtlasFor,
  cutLabelsReason,
  mapColourOf,
} from './cut-labels.ts';

const PUBLISHED = new Set([
  'destrieux',
  'hcp-mmp',
  'julich',
  'schaefer',
  'desikan',
  'nextbrain',
  'arterial',
  'nettekoven',
  'choi',
]);

type Stage = Pick<DisplaySettings, 'atlas' | 'detail' | 'surfaceColor' | 'paint'>;
const stage = (over: Partial<Stage> = {}): Stage => ({
  atlas: 'destrieux',
  detail: 'learning',
  surfaceColor: 'atlas',
  paint: null,
  ...over,
});
const paint = { id: 'function:language', colors: new Map() } as Paint;

test('a cut is labelled by the surface atlas unless the colouring or the level says otherwise', () => {
  assert.equal(cutAtlasFor(stage(), PUBLISHED), 'destrieux');
  assert.equal(cutAtlasFor(stage({ atlas: 'hcp-mmp' }), PUBLISHED), 'hcp-mmp');
  // Levels without labels of their own leave the surface atlas.
  assert.equal(cutAtlasFor(stage({ detail: 'aseg' }), PUBLISHED), 'destrieux');
  assert.equal(cutAtlasFor(stage({ detail: 'nextbrain' }), PUBLISHED), 'nextbrain');
  // Every colouring that is no map of its own keeps them too.
  for (const surfaceColor of ['tissue', 'mri', 'lobe', 'network', 'cab-np'] as const) {
    assert.equal(cutAtlasFor(stage({ surfaceColor }), PUBLISHED), 'destrieux', surfaceColor);
  }
});

test('a map’s colouring labels the cut by the map, over the level', () => {
  assert.equal(cutAtlasFor(stage({ surfaceColor: 'territory' }), PUBLISHED), 'arterial');
  assert.equal(cutAtlasFor(stage({ surfaceColor: 'striatal' }), PUBLISHED), 'choi');
  assert.equal(
    cutAtlasFor(stage({ surfaceColor: 'cerebellar', detail: 'nextbrain' }), PUBLISHED),
    'nettekoven',
  );
  // A build without the map's volume colours the cut by the surface atlas's labels instead.
  assert.equal(
    cutAtlasFor(stage({ surfaceColor: 'territory' }), new Set(['destrieux'])),
    'destrieux',
  );
});

test('a paint keeps the surface atlas, whose regions it names', () => {
  assert.equal(
    cutAtlasFor(stage({ atlas: 'hcp-mmp', detail: 'nextbrain', paint }), PUBLISHED),
    'hcp-mmp',
  );
  assert.equal(cutAtlasFor(stage({ surfaceColor: 'territory', paint }), PUBLISHED), 'destrieux');
});

test('a surface atlas with no published labels is an error, not a guess', () => {
  assert.throws(
    () => cutAtlasFor(stage({ atlas: 'yeo' }), PUBLISHED),
    /No cut labels are published for the yeo atlas/,
  );
});

test('each map belongs to one colouring', () => {
  assert.equal(mapColourOf('arterial'), 'territory');
  assert.equal(mapColourOf('choi'), 'striatal');
  assert.equal(mapColourOf('nettekoven'), 'cerebellar');
  assert.equal(mapColourOf('nextbrain'), null);
  assert.equal(mapColourOf('destrieux'), null);
});

test('a cut-only region off the cut names the control that would put it there', () => {
  const tissue = (atlas: string, cutAtlases?: string[]) =>
    asRegion({
      id: `${atlas}:left:1`,
      atlas,
      kind: 'tissue-region',
      hemisphere: 'left',
      ...(cutAtlases && { cut_atlases: cutAtlases }),
    });
  assert.equal(cutLabelsReason(tissue('nettekoven'), 'nettekoven'), null);
  assert.equal(cutLabelsReason(tissue('nettekoven'), 'destrieux'), 'other-colour');
  assert.equal(cutLabelsReason(tissue('nextbrain'), 'arterial'), 'other-detail');
  // Gyral white matter is on every surface atlas's cut: what replaces their labels hides it.
  const gyral = tissue('wmparc', ['destrieux', 'hcp-mmp']);
  assert.equal(cutLabelsReason(gyral, 'hcp-mmp'), null);
  assert.equal(cutLabelsReason(gyral, 'choi'), 'other-colour');
  assert.equal(cutLabelsReason(gyral, 'nextbrain'), 'other-detail');
  assert.equal(colourShowing(tissue('choi')), 'striatal');
  assert.equal(colourShowing(gyral), 'atlas');
});

test('the cerebellar map is drawn on the surfaces of exactly the detail levels that draw the structures carrying its shares', () => {
  for (const { id } of anatomies.anatomies) {
    const { regions } = readModel<{ regions: Region[] }>(`${id}/manifest.json`);
    const carriers = new Set(
      regions
        .filter((region) => region.cerebellar_functions?.length)
        .flatMap((region) => [region.atlas, ...(region.also_drawn_in ?? [])]),
    );
    assert.deepEqual([...carriers].sort(), [...SURFACE_MAPS[MAP_ATLASES.cerebellar]!].sort(), id);
  }
});
