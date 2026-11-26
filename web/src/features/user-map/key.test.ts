import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { MapDisplay, Statistic } from '../../lib/core/user-map/display.ts';
import type { MapLayer, UserMapStore } from '../../lib/state/user-map.svelte.ts';
import type { CoordinateSpaces, Manifest } from '../../lib/types/index.ts';
import { readRepoJson } from '../../../test/repo.ts';
import { snapshotCaption } from '../snapshot/snapshot.ts';
import { mapCaptions, mapKey, mapKeys } from './key.ts';

const spaces = readRepoJson<Manifest>('public/models/cdmd/manifest.json')
  .coordinate_spaces as CoordinateSpaces;

function store({
  slot = 0,
  name = 'zstat1.nii.gz',
  range = [-5.2, 7.81] as [number, number],
  settings = { threshold: 3.1, max: 7.81, opacity: 1, colours: 'red-yellow' } as MapDisplay,
  space = 'unstated',
  drawn = true,
  title = 'zstat1',
  statistic = 'z' as Statistic | null,
  minVoxels = 0,
  volumes = 1,
  secondsPerVolume = null as number | null,
  volume = 0,
} = {}) {
  return {
    slot,
    state: {
      status: 'ready',
      name,
      summary: {
        shape: [2, 2, 2],
        voxelMm: [2, 2, 2],
        range,
        binary: false,
        volumes,
        secondsPerVolume,
        cortexCovered: 1,
      },
    },
    volume,
    settings,
    space,
    drawn,
    title,
    statistic,
    minVoxels,
  } as unknown as MapLayer;
}

/** The maps as the stage draws them: `drawnMaps` holds those given, the one on top first. */
const maps = (drawn: MapLayer[], surface = 'pial') =>
  ({ drawnMaps: drawn, surface }) as unknown as UserMapStore;
const mapCaption = (map: MapLayer, surface = 'pial') =>
  mapCaptions(maps([map], surface), spaces, 'en')[0]!;

test('the key is titled by the map and has a scale, named by its statistic, for each sign beyond the threshold', () => {
  const both = mapKey(store({ title: 'Faces > Houses' }), 'en')!;
  assert.equal(both.title, 'Faces > Houses');
  assert.deepEqual(
    both.rows.map(({ id, label, ramp }) => [id, label, ramp]),
    [
      ['positive', 'z 3.1 to 7.81', ['rgb(255 0 0)', 'rgb(255 255 0)']],
      ['negative', 'z −3.1 to −7.81', ['rgb(0 0 255)', 'rgb(0 255 255)']],
    ],
  );
  // Its negative values never pass −6, so they draw nothing and have no scale.
  const positive = mapKey(
    store({
      settings: { threshold: 6, max: 7.81, opacity: 1, colours: 'red-yellow' },
      statistic: null,
    }),
    'fr',
  )!;
  assert.deepEqual(
    positive.rows.map(({ label }) => label),
    ['de 6 à 7,81'],
  );
  assert.equal(mapKey(store({ drawn: false }), 'en'), null);
});

test('the caption gives the title, the file when renamed, the template, the scale by its statistic, a partial opacity and a deeper surface', () => {
  const caption = (overlay: ReturnType<typeof mapCaption>) => {
    const [, , , line] = snapshotCaption('en', {
      subject: 'MGH CDMD sub_013',
      atlas: 'destrieux',
      surfaceColor: 'tissue',
      view: 'left',
      overlays: [overlay],
    });
    return line!.map((runs) => runs.map((run) => run.text).join(''));
  };
  assert.deepEqual(
    caption(
      mapCaption(
        store({
          title: 'Faces > Houses',
          space: 'spm12',
          settings: { threshold: 3.1, max: 7.81, opacity: 0.6, colours: 'red-yellow' },
          minVoxels: 20,
        }),
        'mid',
      ),
    ),
    [
      'Faces > Houses',
      'zstat1.nii.gz',
      'from SPM12 (TPM)',
      '|z| > 3.1, colours to 7.81',
      'clusters of 20 voxels or more',
      'opacity 60%',
      'on the mid-thickness surface',
    ],
  );
  // Under the file's own name, the file is not said twice; without a statistic the value is meant.
  assert.deepEqual(caption(mapCaption(store({ statistic: null }))), [
    'zstat1',
    'from MNI, template not stated, read as MNI152NLin2009cAsym',
    '|value| > 3.1, colours to 7.81',
  ]);
  const [, , , line] = snapshotCaption('en', {
    subject: 'MGH CDMD sub_013',
    atlas: 'destrieux',
    surfaceColor: 'tissue',
    view: 'left',
    overlays: [mapCaption(store())],
  });
  assert.equal(line![0]![0]!.strong, true);
});

test('the tract reference shown alone carries no map line', () => {
  const lines = snapshotCaption('en', {
    reference: 'HCP tract reference',
    overlays: [mapCaption(store())],
  });
  assert.equal(lines.length, 1);
});

test('a series names its volume by its time when the header gives one, by its place when not', () => {
  const timed = store({ volumes: 20, secondsPerVolume: 1.5, volume: 4 });
  assert.equal(mapKey(timed, 'en')!.title, 'zstat1 · 6\u202fs');
  assert.equal(mapKey(timed, 'fr')!.title, 'zstat1 · 6\u202fs');
  const untimed = store({ volumes: 20, volume: 4 });
  assert.equal(mapKey(untimed, 'en')!.title, 'zstat1 · 5/20');
  const details = (map: MapLayer) => mapCaption(map).details;
  assert.ok(details(timed).includes('volume 5 of 20 at 6\u202fs'));
  assert.ok(details(untimed).includes('volume 5 of 20'));
  assert.ok(!details(store()).some((detail) => detail.startsWith('volume')));
});

test('FUNC-61 · two drawn maps each have a key in their own colours, and the caption says which is drawn over the other', () => {
  const under = store({ title: 'Faces > Houses' });
  const over = store({
    slot: 1,
    name: 'mask.nii.gz',
    title: 'Mask',
    range: [0, 1],
    settings: { threshold: 0.5, max: 1, opacity: 1, colours: 'green-magenta' },
    statistic: null,
  });
  const drawn = maps([over, under]);
  assert.deepEqual(
    mapKeys(drawn, 'en')!.map(({ slot, title, rows }) => [
      slot,
      title,
      rows.map((row) => row.ramp),
    ]),
    [
      [1, 'Mask', [['rgb(0 153 0)', 'rgb(0 255 0)']]],
      [
        0,
        'Faces > Houses',
        [
          ['rgb(255 0 0)', 'rgb(255 255 0)'],
          ['rgb(0 0 255)', 'rgb(0 255 255)'],
        ],
      ],
    ],
  );
  const lines = snapshotCaption('en', {
    subject: 'MGH CDMD sub_013',
    view: 'left',
    overlays: mapCaptions(drawn, spaces, 'en'),
  }).map((line) => line.map((runs) => runs.map((run) => run.text).join('')));
  assert.deepEqual(lines.slice(-2), [
    [
      'Mask',
      'mask.nii.gz',
      'from MNI, template not stated, read as MNI152NLin2009cAsym',
      '|value| > 0.5, colours to 1',
      'drawn over Faces > Houses',
    ],
    [
      'Faces > Houses',
      'zstat1.nii.gz',
      'from MNI, template not stated, read as MNI152NLin2009cAsym',
      '|z| > 3.1, colours to 7.81',
    ],
  ]);
});
