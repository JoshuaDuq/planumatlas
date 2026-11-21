// CAT-68: the published CDMD manifest holds the values the UI tests were written against. Those tests
// read a frozen cut of it (test/fixtures/cdmd-manifest.json), so a rebuild that changes one of these
// values fails here, once, and is updated here on purpose.
import { expect, test } from 'vitest';
import type { Manifest } from '../src/lib/types/index.ts';
import { readRepoJson } from './repo.ts';

const manifest = readRepoJson<Manifest>('public/models/cdmd/manifest.json');
const regions = new Map(manifest.regions.map((region) => [region.id, region]));

/** Every region the moved UI tests name, with its published label and kind. */
const NAMED = [
  ['arterial:left:aca', 'Anterior cerebral artery · left', 'tissue-region'],
  ['aseg:left:11', 'Left Caudate', 'structure'],
  ['aseg:left:12', 'Left Putamen', 'structure'],
  ['aseg:left:17', 'Left Hippocampus', 'structure'],
  ['aseg:left:18', 'Left Amygdala', 'structure'],
  ['aseg:left:4', 'Left Lateral Ventricle', 'structure'],
  ['aseg:left:8', 'Left Cerebellum Cortex', 'structure'],
  ['choi:left:SomMot', 'Striatum · Somatomotor · left', 'tissue-region'],
  ['desikan:left:18', 'parsopercularis · left', 'cortex'],
  ['destrieux:left:-1', 'Unknown · left', 'non-region'],
  ['destrieux:left:1', 'G and S frontomargin · left', 'cortex'],
  ['destrieux:left:12', 'G front inf-Opercular · left', 'cortex'],
  ['destrieux:left:14', 'G front inf-Triangul · left', 'cortex'],
  ['destrieux:left:17', 'G Ins lg and S cent ins · left', 'cortex'],
  ['destrieux:left:26', 'G pariet inf-Supramar · left', 'cortex'],
  ['destrieux:left:29', 'G precentral · left', 'cortex'],
  ['destrieux:left:30', 'G precuneus · left', 'cortex'],
  ['destrieux:left:31', 'G rectus · left', 'cortex'],
  ['destrieux:left:32', 'G subcallosal · left', 'cortex'],
  ['destrieux:left:38', 'G temporal middle · left', 'cortex'],
  ['destrieux:left:41', 'Lat Fis-post · left', 'cortex'],
  ['hcp-mmp:left:1', 'L V1 ROI · left', 'cortex'],
  ['hcp-mmp:left:50', 'L MIP ROI · left', 'cortex'],
  ['julich:left:1', 'Area 45 (IFG) · left', 'cortex'],
  ['julich:left:117', 'Area 6v1 (PreCG) · left', 'cortex'],
  ['julich:left:2', 'Area 44 (IFG) · left', 'cortex'],
  ['julich:left:3', 'Area Fo1 (OFC) · left', 'cortex'],
  ['julich:left:65', 'Area PF (IPL) · left', 'cortex'],
  ['julich:left:75', 'Area IFS1 (IFS) · left', 'cortex'],
  ['learning:left:accumbens', 'Nucleus accumbens core · left', 'structure'],
  ['learning:left:amygdala', 'Amygdala and transition areas · left', 'structure'],
  ['learning:left:caudate', 'Caudate nucleus · left', 'structure'],
  ['learning:left:hippocampus', 'Hippocampal formation · left', 'structure'],
  [
    'learning:left:innominata',
    'Substantia innominata and basal nucleus of Meynert · left',
    'structure',
  ],
  ['learning:left:lateral-geniculate', 'Lateral geniculate nucleus · left', 'structure'],
  ['learning:left:thalamus', 'Thalamus · left', 'structure'],
  ['learning:midline:optic-chiasm', 'Optic chiasm · midline', 'structure'],
  ['learning:right:hippocampus', 'Hippocampal formation · right', 'structure'],
  ['learning:right:thalamus', 'Thalamus · right', 'structure'],
  ['nettekoven:right:s2', 'S2 · social, linguistic, spatial · right', 'tissue-region'],
  ['nextbrain:left:48', 'head of caudate · left', 'structure'],
  ['nextbrain:left:7', 'white matter of forebrain · left', 'tissue-region'],
  [
    'nextbrain:right:10394',
    'rostral division of ventral posterior lateral nucleus · right',
    'structure',
  ],
  ['pam50:left:gracile-fasciculus', 'Gracile fasciculus · left', 'structure'],
  ['wmparc:left:3001', 'bankssts white matter · left', 'tissue-region'],
] as const;

test('CAT-68: the anatomy, its atlases, detail levels, layers and colourings', () => {
  expect(manifest.anatomy).toMatchObject({
    id: 'cdmd',
    subject: 'sub_013',
    display_name: 'MGH CDMD “sub_013”',
    individual: true,
  });
  expect(manifest.atlases.map(({ id }) => id)).toEqual([
    'destrieux',
    'hcp-mmp',
    'julich',
    'schaefer',
    'desikan',
  ]);
  expect(manifest.detail_levels.map(({ id, region_count }) => [id, region_count])).toEqual([
    ['aseg', 32],
    // NextBrain's 292 nuclei and the teaching set's caudal medulla, which it draws too.
    ['nextbrain', 293],
    ['learning', 106],
  ]);
  expect(manifest.supplemental_layers!.map(({ id, region_count }) => [id, region_count])).toEqual([
    ['pam50', 34],
    ['aan', 16],
  ]);
  expect(manifest.cut_atlases!.map(({ id }) => id)).toEqual([
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
  expect(manifest.networks!.networks).toEqual([
    'Vis',
    'SomMot',
    'DorsAttn',
    'SalVentAttn',
    'Limbic',
    'Cont',
    'Default',
  ]);
  expect(manifest.arterial_territories!.territories.map(({ id }) => id)).toEqual([
    'aca',
    'medial-lenticulostriate',
    'lateral-lenticulostriate',
    'mca-frontal',
    'mca-parietal',
    'mca-temporal',
    'mca-occipital',
    'mca-insular',
    'pca-temporal',
    'pca-occipital',
    'posterior-choroidal-thalamoperforating',
    'anterior-choroidal-thalamoperforating',
    'basilar',
    'superior-cerebellar',
    'inferior-cerebellar',
  ]);
});

test('CAT-68: the regions, counted by atlas and kind', () => {
  const counts: Record<string, number> = {};
  for (const { atlas, kind } of manifest.regions) {
    counts[`${atlas} ${kind}`] = (counts[`${atlas} ${kind}`] ?? 0) + 1;
  }
  expect(manifest.regions).toHaveLength(2126);
  expect(counts).toEqual({
    'aan structure': 16,
    'arterial tissue-region': 30,
    'aseg structure': 32,
    'choi tissue-region': 14,
    'desikan cortex': 68,
    'desikan non-region': 2,
    'destrieux cortex': 148,
    'destrieux non-region': 2,
    'hcp-mmp cortex': 360,
    'hcp-mmp non-region': 2,
    'julich cortex': 278,
    'julich non-region': 18,
    'learning structure': 106,
    'nettekoven tissue-region': 32,
    'nextbrain structure': 292,
    'nextbrain tissue-region': 222,
    'pam50 structure': 34,
    'schaefer cortex': 400,
    'schaefer non-region': 2,
    'wmparc tissue-region': 68,
  });
});

test('CAT-68: each region the UI tests name, with its label and kind', () => {
  expect(
    NAMED.map(([id]) => {
      const region = regions.get(id);
      return region ? [id, region.label, region.kind] : [id, 'not published'];
    }),
  ).toEqual(NAMED);
});

test('CAT-68: the source names and source labels the UI tests read', () => {
  const named = (source: string) =>
    manifest.regions
      .filter(({ source_name }) => source_name === source)
      .map(({ id }) => id)
      .sort();
  expect(named('L_23c_ROI')).toEqual(['hcp-mmp:left:38']);
  expect(named('R_AVI_ROI')).toEqual(['hcp-mmp:right:111']);
  expect(named('Area 44 (IFG)')).toEqual(['julich:left:2', 'julich:right:2']);
  expect(regions.get('learning:left:caudate')!.source_label_ids).toEqual([48, 118, 393]);
  expect(regions.get('learning:left:thalamus')!.source_label_ids).toEqual([
    190, 191, 218, 219, 220, 221, 222, 223, 224, 225, 252, 253, 254, 274, 282, 283, 284, 285, 286,
    303, 312, 313, 314, 350, 378, 379, 380, 381, 382, 394, 395, 396, 397, 398, 399, 423, 424, 425,
    426, 441, 443, 454, 458, 478, 479, 492, 508, 512, 517, 519, 578, 811, 813,
  ]);
});
