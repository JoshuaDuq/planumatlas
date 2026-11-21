import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Manifest, Region } from '../../types/index.ts';
import { createCatalog } from '../catalog/catalog.ts';
import { anatomies, asSettings, readModel } from '../catalog/test-support.ts';
import {
  familyParts,
  groupDisplayName,
  labelledGroups,
  lobeKeyRows,
  matchedAlias,
  matchesElsewhere,
  matchSegments,
  nextEnabledIndex,
  reasonText,
  regionGroup,
  rowStatesReason,
  searchSections,
  searchStructures,
  sectionReasons,
  sharedGroupNames,
  structureRows,
  visibilityStateOf,
  vocabularyOf,
} from './navigator.ts';

const region = (fields: Partial<Region>) => fields as Region;

test('an arrow moves past a row that cannot be chosen', () => {
  assert.equal(nextEnabledIndex([false, true, false], 0, 1), 2);
  assert.equal(nextEnabledIndex([false, true, false], 2, -1), 0);
});

test('an arrow at the end of the list leaves the armed row where it is', () => {
  assert.equal(nextEnabledIndex([false, true], 0, 1), 0);
  assert.equal(nextEnabledIndex([true, false], 1, 1), 1);
  assert.equal(nextEnabledIndex([false], 0, -1), 0);
});

test('the first arrow from an empty field lands on the first choosable row', () => {
  assert.equal(nextEnabledIndex([true, false, false], -1, 1), 1);
});

test('a hidden row says its own reason, names the detail set or colour it is in, or falls back', () => {
  // The hemisphere setting hides the region's own side, which the sentence names.
  assert.equal(
    reasonText('hemisphere', region({ atlas: 'destrieux', hemisphere: 'right' }), 'en'),
    'Right hemisphere hidden',
  );
  assert.equal(
    reasonText('hemisphere', region({ atlas: 'destrieux', hemisphere: 'right' }), 'fr'),
    'Hémisphère droit masqué',
  );
  assert.equal(
    reasonText('other-detail', region({ atlas: 'learning', hemisphere: 'left' }), 'fr'),
    'Dans Ensemble pédagogique',
  );
  // A cut-only region names the colouring or the internal anatomy that puts it on the cut.
  const tissue = (fields: Partial<Region>) => region({ kind: 'tissue-region', ...fields });
  assert.equal(
    reasonText('other-colour', tissue({ atlas: 'nettekoven' }), 'en'),
    'Under Cerebellar functions',
  );
  assert.equal(
    reasonText('other-colour', tissue({ atlas: 'arterial' }), 'fr'),
    'Sous Territoires artériels',
  );
  assert.equal(reasonText('other-detail', tissue({ atlas: 'nextbrain' }), 'en'), 'In NextBrain');
  // Gyral white matter is on every surface atlas's cut: what hides it is said in general.
  const gyral = tissue({ atlas: 'wmparc', cut_atlases: ['destrieux', 'hcp-mmp'] });
  assert.equal(reasonText('other-colour', gyral, 'en'), 'Not under this colour');
  assert.equal(reasonText('other-detail', gyral, 'en'), 'In another detail level');
  assert.equal(reasonText('no-such-reason', undefined, 'en'), 'Hidden');
  // A key of the table that is not a sentence is no reason either.
  assert.equal(reasonText('inDetailSet', undefined, 'fr'), 'Masqué');
});

test('an eye is shown, hidden, or partial, so a group with hidden parts stays in view', () => {
  const hidden = new Set(['a', 'b']);
  assert.equal(visibilityStateOf(['c'], hidden), 'shown');
  assert.equal(visibilityStateOf(['a', 'b'], hidden), 'hidden');
  assert.equal(visibilityStateOf(['a', 'c'], hidden), 'partial');
});

const lobe = region({ kind: 'cortex', atlas: 'destrieux' });
const network = region({ kind: 'cortex', atlas: 'hcp-mmp' });
const structure = region({ kind: 'structure', atlas: 'learning' });
const group = (name: string, rows: Region) => ({ name, kind: 'cortex', rows: [{ region: rows }] });

test('a group name says which vocabulary it is from only when two vocabularies share it', () => {
  assert.equal(vocabularyOf(lobe), 'lobe');
  assert.equal(vocabularyOf(network), 'network');
  assert.equal(vocabularyOf(structure), 'system');
  assert.equal(vocabularyOf(region({ kind: 'tissue-region', atlas: 'nextbrain' })), 'system');
  const shared = sharedGroupNames([
    group('Limbic', lobe),
    group('Frontal', lobe),
    group('Limbic', structure),
    group('Brainstem', structure),
  ]);
  assert.deepEqual([...shared], ['Limbic']);
  assert.equal(groupDisplayName('Limbic', lobe, shared, 'en'), 'Limbic lobe');
  assert.equal(groupDisplayName('Limbic', network, shared, 'en'), 'Limbic network');
  assert.equal(groupDisplayName('Limbic', structure, shared, 'en'), 'Limbic system');
  assert.equal(groupDisplayName('Frontal', lobe, shared, 'en'), 'Frontal');
  assert.equal(groupDisplayName('Limbique', lobe, new Set(['Limbique']), 'fr'), 'Lobe limbique');
  assert.equal(
    groupDisplayName('Limbique', structure, new Set(['Limbique']), 'fr'),
    'Système limbique',
  );
});

test('the stage key names a lobe as the tree does, only where a system shares its name', () => {
  const rows = [
    { id: 'Frontal', label: 'Frontal' },
    { id: 'Limbic', label: 'Limbic' },
  ];
  const groups = [group('Frontal', lobe), group('Limbic', lobe), group('Limbic', structure)];
  assert.deepEqual(
    lobeKeyRows(rows, 'destrieux', groups, 'en').map((row) => [row.id, row.label]),
    [
      ['Frontal', 'Frontal'],
      ['Limbic', 'Limbic lobe'],
    ],
  );
  // With no Limbic system in the tree, the lobe keeps its plain name.
  assert.equal(lobeKeyRows(rows, 'destrieux', groups.slice(0, 2), 'en')[1]!.label, 'Limbic');
});

test('two families in one vocabulary keep their names', () => {
  const tissue = region({ kind: 'tissue-region', atlas: 'nextbrain' });
  assert.equal(sharedGroupNames([group('Limbic', structure), group('Limbic', tissue)]).size, 0);
});

test('a qualified name is sorted by what the list shows, within its family', () => {
  const groups = [
    { ...group('Insula', lobe), kind: 'cortex' },
    { ...group('Limbique', lobe), kind: 'cortex' },
    { ...group('Cervelet', structure), kind: 'structure' },
    { ...group('Limbique', structure), kind: 'structure' },
    { ...group('Tronc cérébral', structure), kind: 'structure' },
  ];
  assert.deepEqual(
    labelledGroups(groups, 'fr').map((entry) => entry.label),
    ['Insula', 'Lobe limbique', 'Cervelet', 'Système limbique', 'Tronc cérébral'],
  );
});

test("a region's group is the one the tree lists it under, qualified as the tree shows it", () => {
  const row = (id: string, fields: Region) => ({ region: { ...fields, id } });
  const groups = [
    { name: 'Limbic', key: 'cortex:Limbic', kind: 'cortex', rows: [row('a', lobe)] },
    {
      name: 'Frontal',
      key: 'cortex:Frontal',
      kind: 'cortex',
      rows: [row('b', lobe), row('c', lobe)],
    },
    { name: 'Limbic', key: 'structure:Limbic', kind: 'structure', rows: [row('d', structure)] },
  ];
  assert.deepEqual(regionGroup(groups, 'c', 'en'), { key: 'cortex:Frontal', label: 'Frontal' });
  assert.deepEqual(regionGroup(groups, 'a', 'en'), { key: 'cortex:Limbic', label: 'Limbic lobe' });
  assert.deepEqual(regionGroup(groups, 'd', 'en'), {
    key: 'structure:Limbic',
    label: 'Limbic system',
  });
  assert.equal(regionGroup(groups, 'elsewhere', 'en'), null);
});

test('a match in another surface atlas offers that atlas, and only one that draws it', () => {
  const atlases = [{ id: 'destrieux' }, { id: 'hcp-mmp' }, { id: 'julich' }];
  const rows = [{ region: region({ id: 'v1', atlas: 'hcp-mmp' }) }];
  assert.deepEqual(
    matchesElsewhere(rows, atlases, 'destrieux').map(({ atlas }) => atlas.id),
    ['hcp-mmp'],
  );
  assert.throws(
    () => matchesElsewhere(rows, atlases.slice(0, 1), 'destrieux'),
    /No other atlas draws v1/,
  );
});

const shown = { visible: true, reason: null };
const hiddenBy = (reason: string) => ({ visible: false, reason });

test('a setting that hides rows is said once per section, in the order met', () => {
  const said = sectionReasons([
    { kind: 'cortex', rows: [hiddenBy('cortex-hidden'), hiddenBy('cortex-hidden')] },
    { kind: 'cortex', rows: [hiddenBy('cortex-hidden'), hiddenBy('hemisphere')] },
    { kind: 'structure', rows: [shown, hiddenBy('removed'), hiddenBy('no-mri')] },
    { kind: 'tissue', rows: [hiddenBy('no-cut')] },
  ]);
  assert.deepEqual(
    [...said],
    [
      ['cortex', ['cortex-hidden', 'hemisphere']],
      ['tissue', ['no-cut']],
    ],
  );
});

test('a hidden row prints only a reason of its own', () => {
  assert.equal(rowStatesReason(shown), false);
  assert.equal(rowStatesReason(hiddenBy('hemisphere')), false, 'the caption says it');
  assert.equal(rowStatesReason(hiddenBy('removed')), false, 'the struck eye says it');
  assert.equal(rowStatesReason(hiddenBy('no-mri')), true);
  assert.equal(rowStatesReason(hiddenBy('below-cut-resolution')), true);
});

test('a match is marked in the name without regard to case or accents', () => {
  assert.deepEqual(matchSegments('Gyrus cingulaire', 'CINGU'), [
    { text: 'Gyrus ', match: false },
    { text: 'cingu', match: true },
    { text: 'laire', match: false },
  ]);
  assert.deepEqual(matchSegments('Écorce', 'eco'), [
    { text: 'Éco', match: true },
    { text: 'rce', match: false },
  ]);
  assert.deepEqual(matchSegments('Insula', 'insula'), [{ text: 'Insula', match: true }]);
});

test('a name with no match, or no query, is one unmarked segment', () => {
  assert.deepEqual(matchSegments('Insula', 'zz'), [{ text: 'Insula', match: false }]);
  assert.deepEqual(matchSegments('Insula', ''), [{ text: 'Insula', match: false }]);
});

test('a row explains a match its name does not hold with its code, then its first alias', () => {
  const label = {
    name: 'Primary visual cortex',
    code: 'V1',
    aliases: ['striate cortex', 'area 17'],
  };
  assert.equal(matchedAlias(label, 'v1'), 'V1');
  assert.equal(matchedAlias(label, 'striate'), 'striate cortex');
  assert.equal(matchedAlias(label, 'area'), 'area 17');
  assert.equal(matchedAlias(label, 'visual'), null, 'the name holds it');
  assert.equal(matchedAlias(label, 'zz'), null);
  assert.equal(
    matchedAlias({ name: 'Insula', code: null, aliases: ['Île de Reil'] }, 'ile'),
    'Île de Reil',
  );
});

test('a decomposed query or name marks the same span as a composed one', () => {
  const composed = [
    { text: 'Cortex ', match: false },
    { text: 'cérébel', match: true },
    { text: 'leux', match: false },
  ];
  const nfd = (text: string) => text.normalize('NFD');
  assert.deepEqual(matchSegments('Cortex cérébelleux', nfd('cérébel')), composed);
  assert.deepEqual(matchSegments(nfd('Cortex cérébelleux'), 'cerebel'), [
    { text: 'Cortex ', match: false },
    { text: nfd('cérébel'), match: true },
    { text: 'leux', match: false },
  ]);
  assert.deepEqual(matchSegments(nfd('Cortex cérébelleux'), nfd('cérébel')), [
    composed[0],
    { text: nfd('cérébel'), match: true },
    composed[2],
  ]);
});

test('a query that folds to nothing marks nothing', () => {
  assert.deepEqual(matchSegments('Insula', '\u0301'), [{ text: 'Insula', match: false }]);
});

test('PANEL-01 a step of zero, or an empty list, leaves the armed row where it is', () => {
  assert.equal(nextEnabledIndex([false, false], 1, 0), 1);
  assert.equal(nextEnabledIndex([], 3, 1), 3);
  assert.equal(nextEnabledIndex([], -1, -1), -1);
});

test('PANEL-09 a group with no parts under it shows its eye', () => {
  assert.equal(visibilityStateOf([], new Set(['a', 'b'])), 'shown');
});

test('the sides of one name share a tree row, in the order the names are first met', () => {
  const row = (id: string, name: string, hemisphere: Region['hemisphere']) => ({
    id,
    region: { hemisphere },
    label: { name },
  });
  const ids = (rows: ReturnType<typeof row>[]) =>
    structureRows(rows).map((sides) => sides.map((side) => side.id));
  assert.deepEqual(
    ids([
      row('pre-l', 'Precentral gyrus', 'left'),
      row('pre-r', 'Precentral gyrus', 'right'),
      row('third', 'Third ventricle', 'midline'),
      row('sup-r', 'Superior frontal gyrus', 'right'),
    ]),
    [['pre-l', 'pre-r'], ['third'], ['sup-r']],
  );
  // Sides that are not adjacent in the group still meet, where the first was listed.
  assert.deepEqual(
    ids([
      row('a-l', 'Area A', 'left'),
      row('b-l', 'Area B', 'left'),
      row('a-r', 'Area A', 'right'),
      row('a-m', 'Area A', 'midline'),
    ]),
    [['a-l', 'a-r', 'a-m'], ['b-l']],
  );
  // Two regions of one name on one side cannot share a row: each would need the same key.
  assert.deepEqual(
    ids([
      row('n-l1', 'Nucleus', 'left'),
      row('n-l2', 'Nucleus', 'left'),
      row('n-r', 'Nucleus', 'right'),
    ]),
    [['n-l1'], ['n-l2'], ['n-r']],
  );
  assert.deepEqual(ids([]), []);
});

test('ANAT-30 a search result is a structure: one name in one atlas and kind, its sides left, right, midline', () => {
  const row = (
    id: string,
    name: string,
    hemisphere: Region['hemisphere'],
    atlas = 'destrieux',
    kind: Region['kind'] = 'cortex',
  ) => ({ id, region: region({ id, hemisphere, atlas, kind }), label: { name }, reason: null });
  const ids = (rows: ReturnType<typeof row>[]) =>
    searchStructures(rows).map((sides) => sides.map((side) => side.id));
  assert.deepEqual(
    ids([
      row('cun-r', 'Cuneus', 'right'),
      row('phg-l', 'Parahippocampal gyrus', 'left'),
      row('cun-l', 'Cuneus', 'left'),
      // The same name in another atlas, or drawn only on a cut, is another structure.
      row('nb-phg-l', 'Parahippocampal gyrus', 'left', 'nextbrain', 'tissue-region'),
      row('phg-r', 'Parahippocampal gyrus', 'right'),
    ]),
    [['cun-l', 'cun-r'], ['phg-l', 'phg-r'], ['nb-phg-l']],
  );
});

test('ANAT-61 the shown set’s structures come first, then each other set’s, under its atlas', () => {
  const row = (id: string, name: string, atlas: string, reason: string | null = null) => ({
    id,
    region: region({ id, hemisphere: 'left', atlas, kind: 'structure' }),
    label: { name },
    reason,
  });
  const sections = (rows: ReturnType<typeof row>[]) =>
    searchSections(rows).map(({ set, structures }) => [
      set,
      structures.map((sides) => sides[0]!.id),
    ]);
  assert.deepEqual(
    sections([
      row('aseg-hip', 'Hippocampus', 'aseg', 'other-detail'),
      row('learn-hip', 'Hippocampal formation', 'learning'),
      row('nb-hip', 'Hippocampal tail', 'nextbrain', 'other-detail'),
      row('aseg-amy', 'Amygdala', 'aseg', 'other-detail'),
      row('learn-amy', 'Amygdala', 'learning', 'internal-hidden'),
    ]),
    [
      [null, ['learn-hip', 'learn-amy']],
      ['aseg', ['aseg-hip', 'aseg-amy']],
      ['nextbrain', ['nb-hip']],
    ],
  );
  // A region another set puts on the cut without being its own is under no set's name.
  const borrowed = {
    ...row('wm', 'White matter of the cuneus', 'wmparc', 'other-detail'),
    region: region({
      id: 'wm',
      hemisphere: 'left',
      atlas: 'wmparc',
      kind: 'tissue-region',
      cut_atlases: ['destrieux'],
    }),
  };
  assert.deepEqual(sections([borrowed]), [['', ['wm']]]);
  assert.deepEqual(sections([]), []);
});

test('ANAT-61 published data: "hippo" lists the teaching set’s formation first, FreeSurfer’s Hippocampus once below', () => {
  const published = anatomies.default;
  const real = readModel<Manifest>(`${published}/manifest.json`);
  const { units } = readModel<{ units: Record<string, string> }>(
    `${published}/neuropsych-domains.json`,
  );
  const found = createCatalog(real, 'en', null, units).search(
    'hippo',
    asSettings({
      atlas: 'destrieux',
      detail: 'learning',
      hemisphere: 'both',
      cortexVisible: true,
      cortexOpacity: 1,
      isolatedRegion: null,
    }),
    Infinity,
  );
  const sections = searchSections(found.rows.filter((row) => row.reason !== 'other-atlas'));
  const [shown, ...others] = sections;
  assert.equal(shown!.set, null);
  assert.deepEqual(
    shown!.structures[0]!.map((side) => side.region.id),
    ['learning:left:hippocampus', 'learning:right:hippocampus'],
  );
  const aseg = others.find(({ set }) => set === 'aseg')!;
  assert.deepEqual(
    aseg.structures
      .filter((sides) => sides[0]!.label.name === 'Hippocampus')
      .map((sides) => sides.map((side) => side.region.id)),
    [['aseg:left:17', 'aseg:right:53']],
  );
  // Every name is listed once per atlas and kind: no side repeats.
  for (const { structures } of sections) {
    for (const sides of structures) {
      const hemispheres = sides.map((side) => side.region.hemisphere);
      assert.equal(new Set(hemispheres).size, hemispheres.length);
    }
  }
});

test('ANAT-60 a family is set apart under its name only where its group lists structures of its own', () => {
  const row = (id: string, subgroup: string | null = null) => ({ id, label: { subgroup } });
  const parts = (rows: ReturnType<typeof row>[]) =>
    familyParts(rows).map(({ family, rows: part }) => [family, part.map((entry) => entry.id)]);
  assert.deepEqual(
    parts([
      row('nextbrain:left:521'),
      row('aseg:midline:16'),
      row('aan:midline:dorsal-raphe', 'Arousal nuclei (Harvard atlas)'),
      row('aan:left:locus-coeruleus', 'Arousal nuclei (Harvard atlas)'),
    ]),
    [
      [null, ['nextbrain:left:521', 'aseg:midline:16']],
      ['Arousal nuclei (Harvard atlas)', ['aan:midline:dorsal-raphe', 'aan:left:locus-coeruleus']],
    ],
  );
  // The cord's families make up its whole group, which stays one list.
  assert.deepEqual(
    parts([row('pam50:left:a', 'Dorsal columns'), row('pam50:left:b', 'Grey matter')]),
    [[null, ['pam50:left:a', 'pam50:left:b']]],
  );
});
