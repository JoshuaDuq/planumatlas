import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readRepoJson, readRepoYaml } from '../../../../test/repo.ts';
import type { CircuitData } from '../learning/catalog.ts';
import type { Manifest } from '../../types/index.ts';
import { checkLink, type KnownLinkIds } from './link-check.ts';
import { decodeState } from './url-state.ts';
import { publishesSpinalCord } from './scene-commands.ts';

const known: KnownLinkIds = {
  atlases: new Set(['destrieux', 'hcp-mmp']),
  details: new Set(['aseg', 'nextbrain', 'learning']),
  views: new Set(['oblique', 'left', 'right', 'anterior', 'posterior', 'superior', 'inferior']),
  explorers: new Set(['anatomy', 'functions', 'deficits', 'circuits', 'diffusion']),
  // A build without Yeo 7 networks: `network` decodes but is not published.
  surfaceColors: new Set(['tissue', 'mri', 'atlas', 'cab-np']),
  // Destrieux's cortex can draw HCP-MMP's borders; HCP-MMP's draws none.
  borders: new Map([['destrieux', new Set(['hcp-mmp'])]]),
  regions: new Map([
    ['destrieux:left:29', { kind: 'cortex' }],
    ['aseg:left:17', { kind: 'structure' }],
    ['destrieux:left:medial-wall', { kind: 'non-region' }],
  ]),
  functions: new Set(['all', 'language']),
  deficits: new Set(['aphasia']),
  circuits: new Map([['visual', 4]]),
  maps: new Set(['visual-field']),
  spinalCord: true,
  // The left bundle while the sphere reaches the left of the midline.
  coordinateSpaces: new Set(['mni152nlin2009casym', 'unstated']),
  tracts: new Set(['af-left', 'cst-right', 'slf-left']),
  lesionBundles: ({ centre: [x], radius }) => (x - radius < 0 ? ['af-left'] : []),
};

const check = (hash: string) => checkLink(decodeState(hash).state, known);

test('a link naming only what this anatomy publishes passes whole', () => {
  const hash =
    '#atlas=hcp-mmp&detail=aseg&view=left&colors=cab-np&region=destrieux:left:29' +
    '&isolate=aseg:left:17&hidden=destrieux:left:medial-wall&tab=circuits&function=language&deficit=aphasia&circuit=visual&step=4';
  const { state, rejected } = check(hash);
  assert.deepEqual(rejected, []);
  assert.deepEqual(state, decodeState(hash).state);
});

test('each unknown name is dropped and reported under its link parameter', () => {
  const { state, rejected } = check(
    '#atlas=yeo&detail=fine&view=Left&colors=network&region=nope' +
      '&isolate=destrieux:left:medial-wall&hidden=aseg:left:17,nope&tab=diffusion&function=praxis&deficit=x&circuit=y&step=2&hemi=left',
  );
  assert.deepEqual(rejected, [
    'atlas',
    'detail',
    'view',
    'colors',
    'region',
    'isolate',
    'hidden',
    'function',
    'deficit',
    'circuit',
    'step',
  ]);
  assert.deepEqual(state, { explorer: 'diffusion', hemisphere: 'left' });
});

test("BORDER-04 a link's borders are another atlas's that the shown cortex can draw", () => {
  assert.deepEqual(check('#atlas=destrieux&borders=hcp-mmp'), {
    state: { atlas: 'destrieux', atlasBorders: 'hcp-mmp' },
    rejected: [],
  });
  // With no atlas of its own the link opens on the first published, Destrieux.
  assert.deepEqual(check('#borders=hcp-mmp').rejected, []);
  // Its own borders, one with none published for that cortex, and an unknown atlas are refused.
  assert.deepEqual(check('#atlas=destrieux&borders=destrieux').rejected, ['borders']);
  assert.deepEqual(check('#atlas=hcp-mmp&borders=destrieux').rejected, ['borders']);
  assert.deepEqual(check('#borders=yeo&hemi=left').state, { hemisphere: 'left' });
  assert.deepEqual(check('#borders=yeo').rejected, ['borders']);
  // An atlas the link names but this anatomy does not publish falls back to the first, as it opens.
  assert.deepEqual(check('#atlas=yeo&borders=hcp-mmp').rejected, ['atlas']);
});

test('focus needs a selected region that exists', () => {
  assert.deepEqual(check('#focus=1').rejected, ['focus']);
  assert.deepEqual(check('#region=nowhere&focus=1').rejected, ['region', 'focus']);
  assert.deepEqual(check('#region=destrieux:left:29&focus=1').rejected, []);
});

test('a lesson step must exist in its circuit', () => {
  assert.deepEqual(check('#circuit=visual&step=5').rejected, ['step']);
  assert.deepEqual(check('#step=2').rejected, ['step']);
  assert.equal(check('#circuit=visual&step=4').state.circuitStep, 3);
});

test('a whole route needs its circuit', () => {
  assert.deepEqual(check('#route=1').rejected, ['route']);
  assert.deepEqual(check('#circuit=bogus&route=1').rejected, ['circuit', 'route']);
  assert.equal(check('#circuit=visual&route=1').state.circuitRoute, true);
});

test('links to withdrawn tours reject only the circuit and step while retained pathway links still work', () => {
  const active = readRepoYaml<CircuitData>('data/circuits.yaml');
  const archived = readRepoYaml<CircuitData>('data/archived-circuit-tours.yaml');
  const published = {
    ...known,
    circuits: new Map(active.circuits.map((circuit) => [circuit.id, circuit.steps.length])),
  };
  for (const circuit of archived.circuits) {
    const link = decodeState(`#tab=circuits&circuit=${circuit.id}&step=1&lang=fr`).state;
    const result = checkLink(link, published);
    assert.deepEqual(result.rejected, ['circuit', 'step'], circuit.id);
    assert.deepEqual(result.state, { explorer: 'circuits', lang: 'fr' });
  }
  for (const circuit of active.circuits) {
    const link = decodeState(`#tab=circuits&circuit=${circuit.id}&step=1`).state;
    assert.deepEqual(checkLink(link, published), { state: link, rejected: [] });
  }
});

test('the cord field is not applied where the subject publishes no cord; hiding it always is', () => {
  const manifest = readRepoJson<Manifest>('public/models/cdmd/manifest.json');
  // A subject whose scan ends inside the medulla publishes no cord layer.
  const cordless = {
    ...manifest,
    supplemental_layers: (manifest.supplemental_layers ?? []).filter(
      (layer) => layer.id !== 'pam50',
    ),
  };
  assert.equal(publishesSpinalCord(manifest), true);
  const spinalCord = publishesSpinalCord(cordless);
  assert.equal(spinalCord, false);
  const { state, rejected } = checkLink(decodeState('#cord=1&hemi=left').state, {
    ...known,
    spinalCord,
  });
  assert.deepEqual(rejected, ['cord']);
  assert.deepEqual(state, { hemisphere: 'left' });
  assert.deepEqual(checkLink(decodeState('#cord=0').state, { ...known, spinalCord }).rejected, []);
  assert.deepEqual(checkLink(decodeState('#cord=1').state, known).rejected, []);
});

test('a lesion’s colouring and drawn tract need the lesion, and the tract one it reaches', () => {
  assert.deepEqual(
    check('lesion=-30,0,10,8&lesionmode=functions&lesiontract=af-left').rejected,
    [],
  );
  assert.deepEqual(check('lesion=30,0,10,8&lesiontract=af-left').rejected, ['lesiontract']);
  const orphan = check('lesionmode=functions&lesiontract=af-left');
  assert.deepEqual(orphan.rejected, ['lesionmode', 'lesiontract']);
  assert.deepEqual(orphan.state, {});
});

test('ticked tracts are the Tracts tab’s, and only bundles it lists', () => {
  assert.deepEqual(check('tab=diffusion&tracts=slf-left,af-left').rejected, []);
  assert.deepEqual(check('tab=diffusion&tracts=').state.tracts, []);
  assert.deepEqual(check('tab=diffusion&tracts=slf-left,bogus').rejected, ['tracts']);
  const offTab = check('tab=anatomy&tracts=slf-left');
  assert.deepEqual(offTab.rejected, ['tracts']);
  assert.deepEqual(offTab.state, { explorer: 'anatomy' });
  const kept = check('tab=functions&keeptracts=1&tracts=slf-left');
  assert.deepEqual(kept.rejected, []);
  assert.deepEqual(kept.state.tracts, ['slf-left']);
});

test('a coordinate needs a published space, and is never a lesion too', () => {
  assert.deepEqual(check('coord=-42,22,6&space=unstated').rejected, []);
  assert.deepEqual(check('coord=-42,22,6&space=mni152nlin2009casym').rejected, []);
  const unknown = check('coord=-42,22,6&space=talairach');
  assert.deepEqual(unknown.rejected, ['coord', 'space']);
  assert.deepEqual(unknown.state, {});
  assert.deepEqual(check('coord=-42,22,6').rejected, ['coord']);
  assert.deepEqual(check('space=unstated').rejected, ['space']);
  // An anatomy that publishes no spaces takes no coordinate.
  assert.deepEqual(
    checkLink(decodeState('coord=-42,22,6&space=unstated').state, {
      ...known,
      coordinateSpaces: new Set(),
    }).rejected,
    ['coord', 'space'],
  );
  // Both spheres at once: neither is guessed at, and the lesion's colouring goes with it.
  const both = check('lesion=-30,0,10,8&lesionmode=functions&coord=-42,22,6&space=unstated');
  assert.deepEqual(both.rejected, ['lesion', 'coord', 'space', 'lesionmode']);
  assert.deepEqual(both.state, {});
});

test('a map must be one this anatomy shows, never beside a lesson, and its dot needs it', () => {
  assert.deepEqual(check('#tab=circuits&map=visual-field&dot=2,1,1').rejected, []);
  assert.deepEqual(check('#map=somatotopy&dot=2,1,1').rejected, ['map', 'dot']);
  assert.deepEqual(check('#circuit=visual&step=1&map=visual-field').rejected, ['map']);
  assert.deepEqual(check('#dot=2,1,1').rejected, ['dot']);
  const blind = checkLink(decodeState('#map=visual-field').state, { ...known, maps: new Set() });
  assert.deepEqual(blind.rejected, ['map']);
});

test('BODY-04 a link opens the body map without a dot, and refuses one beside it', () => {
  const withBody = { ...known, maps: new Set(['visual-field', 'body-map']) };
  const opened = checkLink(decodeState('#tab=circuits&map=body-map').state, withBody);
  assert.deepEqual(opened.rejected, []);
  assert.equal(opened.state.circuitMap, 'body-map');
  const dotted = checkLink(decodeState('#tab=circuits&map=body-map&dot=2,1,1').state, withBody);
  assert.deepEqual(dotted.rejected, ['dot']);
  // An anatomy that publishes no body map does not open one.
  assert.deepEqual(check('#tab=circuits&map=body-map').rejected, ['map']);
});

test('STATE-70 highlights name regions the reader can select, or the whole set is not applied', () => {
  assert.deepEqual(check('mark=destrieux:left:29:blue,aseg:left:17:amber'), {
    state: {
      highlights: [
        { region: 'destrieux:left:29', color: 'blue' },
        { region: 'aseg:left:17', color: 'amber' },
      ],
    },
    rejected: [],
  });
  for (const unknown of ['destrieux:left:999', 'destrieux:left:medial-wall']) {
    assert.deepEqual(
      check(`mark=destrieux:left:29:blue,${unknown}:pink&hemi=left`),
      { state: { hemisphere: 'left' }, rejected: ['mark'] },
      unknown,
    );
  }
});
