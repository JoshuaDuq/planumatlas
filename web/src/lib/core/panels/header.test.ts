import assert from 'node:assert/strict';
import { test } from 'vitest';
import { LOBE_COLORS } from '../catalog/lobes.ts';
import { t } from '../i18n/index.ts';
import {
  atlasAside,
  colophonParts,
  colourAside,
  colourGroups,
  colourPalette,
  dataSummary,
  loadingText,
  subjectName,
} from './header.ts';

test('subject names keep the dataset with the subject, without quotation marks', () => {
  assert.equal(subjectName({ id: 'snail', display_name: 'SNAIL “subj_1”' }), 'SNAIL subj_1');
  assert.equal(
    subjectName({ id: 'aomic', display_name: 'AOMIC-PIOP1 “sub-0022”' }),
    'AOMIC-PIOP1 sub-0022',
  );
  assert.equal(subjectName({ id: 'x', subject: 'x' }), 'x');
  assert.equal(subjectName({ id: 'y' }), 'y');
});

test('the data summary names available choices, or the tract reference alone', () => {
  const texts = (parts: { text: string }[]) => parts.map(({ text }) => text);
  const full = dataSummary({
    subject: 'SNAIL subj_1',
    atlas: 'Destrieux',
    colour: 'Regions',
    detail: 'Teaching set',
  });
  assert.deepEqual(texts(full), ['SNAIL subj_1', 'Destrieux', 'Regions', 'Teaching set']);
  assert.deepEqual(
    full.map(({ part }) => part),
    ['subject', 'atlas', 'colour', 'detail'],
  );
  assert.deepEqual(
    dataSummary({ subject: 'bert', atlas: 'Destrieux', colour: 'Regions', reference: 'SNAIL' }),
    [{ part: 'subject', text: 'SNAIL' }],
  );
  assert.deepEqual(texts(dataSummary({ subject: 'bert', atlas: 'Destrieux', detail: null })), [
    'bert',
    'Destrieux',
  ]);
  assert.deepEqual(
    dataSummary({ subject: null, atlas: 'Destrieux', colour: 'Regions', detail: 'Teaching set' }),
    [
      { part: 'atlas', text: 'Destrieux' },
      { part: 'colour', text: 'Regions' },
      { part: 'detail', text: 'Teaching set' },
    ],
    'an immutable subject can be omitted without adding a blank summary part',
  );
  assert.deepEqual(
    dataSummary({ atlas: 'Destrieux' }),
    [{ part: 'atlas', text: 'Destrieux' }],
    'the atlas still identifies a summary with no subject or supporting settings',
  );
});

test('the status bar keeps the not-clinical statement in every state', () => {
  const anatomy = { display_name: 'SNAIL “subj_1”', individual: true };
  for (const lang of ['en', 'fr'] as const) {
    const loading = colophonParts(lang);
    assert.equal(loading.description, '', 'no dataset is named before one is loaded');
    assert.match(loading.statement, /clinical anatomy|anatomie clinique/i);
    assert.match(
      colophonParts(lang, { anatomy }).description,
      /^SNAIL subj_1 · /,
      'named as the masthead names it',
    );
    assert.match(colophonParts(lang, { anatomy }).statement, /clinical anatomy|anatomie clinique/);
    assert.match(
      colophonParts(lang, { anatomy, reference: { label: 'Ref' } }).statement,
      /clinical anatomy|anatomie clinique/,
    );
  }
});

test('Colour groups appearance, the lobes and atlas regions, networks and blood supply', () => {
  const all = { networks: {}, cabNp: {}, territories: {} };
  assert.deepEqual(colourGroups(all), [
    ['appearance', ['tissue', 'mri']],
    ['parcellation', ['lobe', 'atlas']],
    ['networks', ['network', 'cab-np']],
    ['vascular', ['territory']],
  ]);
  assert.deepEqual(
    colourGroups({ networks: {} }),
    [
      ['appearance', ['tissue', 'mri']],
      ['parcellation', ['lobe', 'atlas']],
      ['networks', ['network']],
    ],
    'a colouring the build does not publish is not offered',
  );
});

test('Lobes on an atlas grouped by network names the lobe atlas it switches to', () => {
  assert.equal(
    colourAside('en', { atlas: 'hcp-mmp', required: 'destrieux' }),
    'Atlas becomes Destrieux',
  );
  assert.equal(colourAside('en', { atlas: 'julich', required: null }), null);
});

test('a colour or atlas option says what else choosing it changes, and nothing when it changes nothing else', () => {
  assert.equal(
    colourAside('en', { atlas: 'destrieux', required: 'hcp-mmp' }),
    'Atlas becomes HCP-MMP',
  );
  assert.equal(colourAside('en', { atlas: 'hcp-mmp', required: 'hcp-mmp' }), null);
  assert.equal(colourAside('en', { atlas: 'destrieux', required: null }), null);
  assert.equal(atlasAside('en', 'destrieux', 'hcp-mmp'), 'Colour becomes Regions');
  assert.equal(atlasAside('en', 'hcp-mmp', 'hcp-mmp'), null);
  assert.equal(atlasAside('en', 'destrieux', undefined), null);
});

test('a download says how far it has come, or that it has started', () => {
  for (const lang of ['en', 'fr'] as const) {
    assert.equal(loadingText(lang), t(lang, 'header').loading);
    assert.equal(loadingText(lang, { loaded: 0, total: 0 }), t(lang, 'header').loading);
    assert.match(loadingText(lang, { loaded: 1, total: 4 }), /25/);
  }
});

test('MAST-28 a name loses its quotation marks and doubled spaces, and may end up empty', () => {
  assert.equal(subjectName({ id: 'x', display_name: 'MGH CDMD “sub_013”' }), 'MGH CDMD sub_013');
  assert.equal(subjectName({ id: 'x', display_name: ' A  "b" ' }), 'A b');
  assert.equal(subjectName({ display_name: '””' }), '');
  assert.equal(subjectName({ id: 'y', subject: 'sub' }), 'sub', 'the subject before the entry id');
});

test('MAST-29 Colour offers only the published colourings, in fixed groups', () => {
  assert.deepEqual(colourGroups({}), [
    ['appearance', ['tissue', 'mri']],
    ['parcellation', ['lobe', 'atlas']],
  ]);
  assert.deepEqual(colourGroups({ cabNp: {} }).slice(2), [['networks', ['cab-np']]]);
});

test('MAST-30 an option names the atlas or colouring it switches to, in both languages', () => {
  assert.equal(
    colourAside('fr', { atlas: 'destrieux', required: 'hcp-mmp' }),
    'L’atlas devient HCP-MMP',
  );
  assert.equal(colourAside('fr', { atlas: 'hcp-mmp', required: 'hcp-mmp' }), null);
  const asides = (lang: 'en' | 'fr') =>
    ['destrieux', 'hcp-mmp', 'aseg'].map((id) => atlasAside(lang, id, 'hcp-mmp'));
  assert.deepEqual(asides('en'), ['Colour becomes Regions', null, 'Colour becomes Regions']);
  assert.deepEqual(asides('fr'), [
    'La couleur devient Régions',
    null,
    'La couleur devient Régions',
  ]);
});

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

test('MAST-32 a download shows its percentage, or that it has started', () => {
  assert.equal(loadingText('en'), 'Loading…');
  assert.equal(loadingText('en', null), 'Loading…');
  assert.equal(loadingText('en', { loaded: 0, total: 0 }), 'Loading…');
  assert.equal(loadingText('en', { loaded: 1, total: 4 }), 'Loading 25%');
  assert.equal(loadingText('en', { loaded: 5, total: 5 }), 'Loading 100%');
  assert.equal(loadingText('fr'), 'Chargement…');
  assert.equal(loadingText('fr', { loaded: 1, total: 4 }), 'Chargement 25 %');
  assert.equal(loadingText('fr', { loaded: 5, total: 5 }), 'Chargement 100 %');
});

test('MAST-38 a summary with a tract reference shows only the reference, and drops empty parts', () => {
  assert.deepEqual(dataSummary({ subject: '', atlas: 'Destrieux', reference: '' }), [
    { part: 'atlas', text: 'Destrieux' },
  ]);
  assert.deepEqual(dataSummary({ subject: 'bert', atlas: null, colour: undefined }), [
    { part: 'subject', text: 'bert' },
  ]);
});

test('COLO-01 the statement is the same in every state, in each language', () => {
  const anatomy = { display_name: 'SNAIL “subj_1”', individual: true };
  for (const parts of [undefined, { anatomy }, { reference: { label: 'Ref' } }]) {
    assert.equal(colophonParts('en', parts).statement, 'Not clinical anatomy');
    assert.equal(colophonParts('fr', parts).statement, 'Pas une anatomie clinique');
  }
});

test('COLO-02 the description names the subject and what kind of anatomy it is', () => {
  const named = (individual: boolean) => ({
    anatomy: { display_name: 'SNAIL “subj_1”', individual },
  });
  assert.equal(
    colophonParts('en', named(true)).description,
    'SNAIL subj_1 · one individual’s MRI reconstruction',
  );
  assert.equal(
    colophonParts('fr', named(true)).description,
    'SNAIL subj_1 · reconstruction IRM d’un individu',
  );
  assert.equal(
    colophonParts('en', named(false)).description,
    'SNAIL subj_1 · averaged reference template',
  );
  assert.equal(
    colophonParts('fr', named(false)).description,
    'SNAIL subj_1 · gabarit de référence moyenné',
  );
  const reference = { reference: { label: 'Ref' } };
  assert.equal(colophonParts('en', reference).description, 'Ref · reference data');
  assert.equal(colophonParts('fr', reference).description, 'Ref · données de référence');
  assert.equal(colophonParts('en').description, '');
});
