import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Region } from '../../types/index.ts';
import { visibilityOf as visibilityOfRegion } from './visibility.ts';
import { asDisplaySettings, asRegion } from './test-support.ts';

const visibilityOf = (region: Region, settings: object) =>
  visibilityOfRegion(region, asDisplaySettings(settings));

const region = (over = {}) =>
  asRegion({ id: 'a:left:1', atlas: 'a', hemisphere: 'left', kind: 'cortex', ...over });

const base = {
  atlas: 'a',
  cutAtlas: 'a',
  cutActive: true,
  detail: 'aseg',
  hemisphere: 'both',
  cortexVisible: true,
  cortexOpacity: 1,
  isolatedRegion: null,
};
const settings = (over = {}) => ({ ...base, ...over });

test('unregistered reference anatomy is unavailable in MRI appearance', () => {
  const cord = region({
    atlas: 'pam50',
    kind: 'structure',
    supplemental: true,
    mri_registered: false,
  });
  assert.deepEqual(visibilityOf(cord, settings({ surfaceColor: 'mri' })), {
    visible: false,
    reason: 'no-mri',
  });
  assert.equal(visibilityOf(cord, settings({ surfaceColor: 'tissue' })).visible, true);
});

test('a cortical region of the active atlas is visible by default', () => {
  assert.deepEqual(visibilityOf(region(), settings()), { visible: true, reason: null });
});

test('explicitly removed regions stay hidden even when isolated', () => {
  const current = region();
  assert.deepEqual(
    visibilityOf(
      current,
      settings({
        hiddenRegions: new Set([current.id]),
        isolatedRegion: current.id,
      }),
    ),
    { visible: false, reason: 'removed' },
  );
});

test('cortex belonging to a different atlas is hidden', () => {
  assert.deepEqual(visibilityOf(region({ atlas: 'b' }), settings()), {
    visible: false,
    reason: 'other-atlas',
  });
});

test('a cut shows no other atlas: cortex of another atlas stays off screen with a cut open', () => {
  const parcel = region({ atlas: 'b' });
  assert.equal(
    visibilityOf(parcel, settings({ cutAtlas: 'a', cutActive: true })).reason,
    'other-atlas',
  );
});

test('the surface atlas never hides a structure, but the detail level does', () => {
  const stem = region({ atlas: 'aseg', hemisphere: 'midline', kind: 'structure' });
  assert.equal(visibilityOf(stem, settings({ atlas: 'b' })).visible, true);
  assert.deepEqual(visibilityOf(stem, settings({ detail: 'n' })), {
    visible: false,
    reason: 'other-detail',
  });
});

test('a structure of the inactive detail level stays off screen with a cut open', () => {
  // Two segmentations of one anatomy: the cut is labelled by the level drawn, never the other.
  const nucleus = region({ atlas: 'n', hemisphere: 'left', kind: 'structure' });
  assert.equal(
    visibilityOf(nucleus, settings({ detail: 'aseg', cutAtlas: 'a', cutActive: true })).reason,
    'other-detail',
  );
});

test('a hemisphere filter hides the opposite hemisphere but keeps midline', () => {
  assert.deepEqual(visibilityOf(region(), settings({ hemisphere: 'right' })), {
    visible: false,
    reason: 'hemisphere',
  });
  assert.equal(
    visibilityOf(region({ hemisphere: 'midline' }), settings({ hemisphere: 'right' })).visible,
    true,
  );
});

test('hiding the cortex hides cortical regions but not structures', () => {
  assert.deepEqual(visibilityOf(region(), settings({ cortexVisible: false })), {
    visible: false,
    reason: 'cortex-hidden',
  });
  const stem = region({ atlas: 'aseg', hemisphere: 'midline', kind: 'structure' });
  assert.equal(visibilityOf(stem, settings({ cortexVisible: false })).visible, true);
});

test('hiding internal anatomy hides structures but keeps cortex', () => {
  const stem = region({ atlas: 'aseg', hemisphere: 'midline', kind: 'structure' });
  assert.deepEqual(visibilityOf(stem, settings({ internalVisible: false })), {
    visible: false,
    reason: 'internal-hidden',
  });
  assert.equal(visibilityOf(region(), settings({ internalVisible: false })).visible, true);
});

test('the medial wall stands in for internal anatomy only while it is hidden', () => {
  const wall = region({ kind: 'non-region', source_name: 'Unknown' });
  assert.deepEqual(visibilityOf(wall, settings()), { visible: false, reason: 'internal-shown' });
  assert.equal(visibilityOf(wall, settings({ internalVisible: false })).visible, true);
  // A gap map is cortex no area has claimed yet, so it stays whatever internal anatomy does.
  const gapMap = region({ kind: 'non-region', source_name: 'GapMap-Frontal-I.1' });
  assert.equal(visibilityOf(gapMap, settings()).visible, true);
});

test('fully transparent cortex counts as hidden', () => {
  assert.deepEqual(visibilityOf(region(), settings({ cortexOpacity: 0 })), {
    visible: false,
    reason: 'cortex-hidden',
  });
});

test('isolating a region hides every other region, structures included', () => {
  const isolated = settings({ isolatedRegion: 'other' });
  assert.deepEqual(visibilityOf(region(), isolated), { visible: false, reason: 'isolated' });
  const stem = region({ atlas: 'aseg', hemisphere: 'midline', kind: 'structure' });
  assert.deepEqual(visibilityOf(stem, isolated), { visible: false, reason: 'isolated' });
  assert.equal(visibilityOf(region(), settings({ isolatedRegion: 'a:left:1' })).visible, true);
});

test('unlabelled cortex follows the cortex rules like any other patch', () => {
  const gapMap = region({ kind: 'non-region', source_name: 'GapMap-Frontal-II' });
  assert.equal(visibilityOf(gapMap, settings()).visible, true);
  assert.deepEqual(visibilityOf(gapMap, settings({ cortexVisible: false })), {
    visible: false,
    reason: 'cortex-hidden',
  });
});

test('reasons are reported in a fixed precedence, most fundamental first', () => {
  const everything = settings({
    hemisphere: 'right',
    cortexVisible: false,
    isolatedRegion: 'other',
  });
  assert.equal(visibilityOf(region({ atlas: 'b' }), everything).reason, 'other-atlas');
  assert.equal(visibilityOf(region(), everything).reason, 'hemisphere');
  assert.equal(visibilityOf(region({ hemisphere: 'midline' }), everything).reason, 'cortex-hidden');
});

test('CAT-21 · each reason beats the next one in the precedence', () => {
  const cord = region({
    atlas: 'pam50',
    kind: 'structure',
    supplemental: true,
    mri_registered: false,
  });
  const removedAndIsolated = {
    surfaceColor: 'mri',
    spinalCordVisible: false,
    hiddenRegions: new Set([cord.id]),
    isolatedRegion: 'other',
  };
  assert.equal(visibilityOf(cord, settings(removedAndIsolated)).reason, 'no-mri');

  const putamen = region({
    id: 'aseg:left:12',
    atlas: 'aseg',
    kind: 'structure',
    source_name: 'Left-Putamen',
  });
  const wrongSystem = settings({
    internalSystem: 'Brainstem',
    hemisphere: 'right',
    hiddenRegions: new Set([putamen.id]),
  });
  assert.equal(visibilityOf(putamen, wrongSystem).reason, 'other-system');

  const left = region();
  const removed = new Set([left.id]);
  assert.equal(
    visibilityOf(left, settings({ hemisphere: 'right', hiddenRegions: removed })).reason,
    'hemisphere',
  );
  assert.equal(
    visibilityOf(left, settings({ cortexVisible: false, hiddenRegions: removed })).reason,
    'cortex-hidden',
  );
  const structure = region({ id: 'aseg:left:12', atlas: 'aseg', kind: 'structure' });
  assert.equal(
    visibilityOf(
      structure,
      settings({ internalVisible: false, hiddenRegions: new Set([structure.id]) }),
    ).reason,
    'internal-hidden',
  );
  const cordOnly = region({
    id: 'pam50:left:1',
    atlas: 'pam50',
    kind: 'structure',
    supplemental: true,
  });
  assert.equal(
    visibilityOf(
      cordOnly,
      settings({ spinalCordVisible: false, hiddenRegions: new Set([cordOnly.id]) }),
    ).reason,
    'spinal-cord-hidden',
  );
});

// --- cut-only regions: no mesh, drawn only where the plane samples them ------

const tissue = (over = {}) =>
  region({ atlas: 'n', kind: 'tissue-region', id: 'n:left:7', ...over });

test('a cut-only region is visible when its atlas is the active cut atlas', () => {
  assert.deepEqual(visibilityOf(tissue(), settings({ cutAtlas: 'n' })), {
    visible: true,
    reason: null,
  });
});

test('the surface atlas never hides a cut-only region', () => {
  // 'a' is the surface atlas and 'n' has no surface at all; only cutAtlas counts.
  assert.equal(visibilityOf(tissue(), settings({ atlas: 'a', cutAtlas: 'n' })).visible, true);
});

test('a cut-only region another level or colouring labels says which control shows it', () => {
  // NextBrain's labels come with its level, a map's with its colouring.
  assert.deepEqual(visibilityOf(tissue(), settings({ cutAtlas: 'a' })), {
    visible: false,
    reason: 'other-detail',
  });
  const territory = tissue({ id: 'arterial:left:aca', atlas: 'arterial' });
  assert.deepEqual(visibilityOf(territory, settings({ cutAtlas: 'a' })), {
    visible: false,
    reason: 'other-colour',
  });
  assert.equal(visibilityOf(territory, settings({ cutAtlas: 'arterial' })).visible, true);
});

test('a region smaller than every block of its cut says so rather than naming another atlas', () => {
  assert.deepEqual(visibilityOf(tissue({ cut_atlases: [] }), settings({ cutAtlas: 'n' })), {
    visible: false,
    reason: 'below-cut-resolution',
  });
});

test('with no cut on screen a cut-only region is nowhere, and says so', () => {
  assert.deepEqual(visibilityOf(tissue(), settings({ cutAtlas: 'n', cutActive: false })), {
    visible: false,
    reason: 'no-cut',
  });
});

test('hiding the cortex leaves cut-only regions alone', () => {
  const hidden = settings({ cutAtlas: 'n', cortexVisible: false });
  assert.equal(visibilityOf(tissue(), hidden).visible, true);
  assert.equal(visibilityOf(region(), hidden).reason, 'cortex-hidden');
});

test('hemisphere and isolation still apply to cut-only regions', () => {
  const cut = settings({ cutAtlas: 'n' });
  assert.equal(visibilityOf(tissue(), { ...cut, hemisphere: 'right' }).reason, 'hemisphere');
  assert.equal(visibilityOf(tissue(), { ...cut, isolatedRegion: 'other' }).reason, 'isolated');
  assert.equal(visibilityOf(tissue(), { ...cut, isolatedRegion: 'n:left:7' }).visible, true);
});

test('the cerebellar map is on show with no cut where the cerebellar surfaces draw it', () => {
  const m3 = tissue({ id: 'nettekoven:left:m3', atlas: 'nettekoven' });
  const uncut = settings({ cutAtlas: 'nettekoven', cutActive: false });
  for (const detail of ['learning', 'aseg']) {
    assert.equal(visibilityOf(m3, { ...uncut, detail }).visible, true, detail);
  }
  // NextBrain draws no cerebellar cortex, and hidden structures draw nothing.
  assert.equal(visibilityOf(m3, { ...uncut, detail: 'nextbrain' }).reason, 'no-cut');
  assert.equal(
    visibilityOf(m3, { ...uncut, detail: 'learning', internalVisible: false }).reason,
    'no-cut',
  );
  // Another colouring takes the map off the surfaces too.
  assert.equal(
    visibilityOf(m3, { ...uncut, cutAtlas: 'a', detail: 'learning' }).reason,
    'other-colour',
  );
  // The striatal networks stay on cut faces alone.
  const striatal = tissue({ id: 'choi:left:Cont', atlas: 'choi' });
  assert.equal(
    visibilityOf(striatal, { ...uncut, cutAtlas: 'choi', detail: 'learning' }).reason,
    'no-cut',
  );
});

test('an isolated cerebellar map region with no cut keeps the lobules that hold it', () => {
  const lobule = (id: string, regions: string[]) =>
    region({
      id,
      atlas: 'learning',
      kind: 'structure',
      cerebellar_functions: regions.map((share) => ({ region: share, fraction: 0.5 })),
    });
  const lobuleV = lobule('learning:lobule-v-left', ['nettekoven:left:m3', 'nettekoven:left:m2']);
  const crusI = lobule('learning:crus-i-left', ['nettekoven:left:d2']);
  const isolated = settings({
    detail: 'learning',
    cutAtlas: 'nettekoven',
    cutActive: false,
    isolatedRegion: 'nettekoven:left:m3',
  });
  assert.equal(visibilityOf(lobuleV, isolated).visible, true);
  assert.equal(visibilityOf(crusI, isolated).reason, 'isolated');
  // A cut shows the region on its face, so isolation hides the lobules as it hides everything else.
  assert.equal(visibilityOf(lobuleV, { ...isolated, cutActive: true }).reason, 'isolated');
});

test('a missing cut atlas hides cut-only regions rather than showing them', () => {
  // Before the sections report their labels there is no cut to show them on.
  assert.deepEqual(visibilityOf(tissue(), { ...base, cutAtlas: undefined }), {
    visible: false,
    reason: 'no-cut',
  });
});

const whiteMatter = () =>
  tissue({ id: 'wmparc:left:3024', atlas: 'wmparc', cut_atlases: ['a', 'b'] });

test('white matter is on the cut of every atlas it lists', () => {
  assert.equal(visibilityOf(whiteMatter(), settings({ cutAtlas: 'a' })).visible, true);
  assert.equal(visibilityOf(whiteMatter(), settings({ cutAtlas: 'b' })).visible, true);
  // A level or a colouring that labels the cut by its own volume replaces the parcels.
  assert.deepEqual(visibilityOf(whiteMatter(), settings({ cutAtlas: 'n' })), {
    visible: false,
    reason: 'other-detail',
  });
  assert.deepEqual(visibilityOf(whiteMatter(), settings({ cutAtlas: 'nettekoven' })), {
    visible: false,
    reason: 'other-colour',
  });
});

test('white matter is drawn with the cortex, so hiding the cortex hides it', () => {
  assert.deepEqual(visibilityOf(whiteMatter(), settings({ cortexVisible: false })), {
    visible: false,
    reason: 'cortex-hidden',
  });
  assert.deepEqual(visibilityOf(whiteMatter(), settings({ cortexOpacity: 0 })), {
    visible: false,
    reason: 'cortex-hidden',
  });
});

test('hiding the spinal cord hides spinal cord regions but leaves other structures alone', () => {
  const cord = region({
    atlas: 'pam50',
    hemisphere: 'midline',
    kind: 'structure',
    supplemental: true,
  });
  assert.equal(visibilityOf(cord, settings()).visible, true);
  assert.deepEqual(visibilityOf(cord, settings({ spinalCordVisible: false })), {
    visible: false,
    reason: 'spinal-cord-hidden',
  });
  const stem = region({ atlas: 'aseg', hemisphere: 'midline', kind: 'structure' });
  assert.equal(visibilityOf(stem, settings({ spinalCordVisible: false })).visible, true);
});
