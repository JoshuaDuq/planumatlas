import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readRepoJson } from '../../../../test/repo.ts';
import type { Manifest } from '../../types/index.ts';
import type { NeuropsychDomains } from '../catalog/neuropsych-domains.ts';
import { methodsHref, oneBrainHref } from '../methods.ts';
import {
  checkedParcels,
  provenanceRows,
  referenceRows,
  shortUrl,
  type ProvenanceRow,
} from './provenance.ts';

const manifest = readRepoJson<Manifest>('public/models/cdmd/manifest.json');
const domains = readRepoJson<NeuropsychDomains>('public/models/cdmd/neuropsych-domains.json');
const urls = {
  manifestUrl: '/neuroatlas/models/cdmd/manifest.json',
  indexUrl: '/neuroatlas/models/anatomies.json',
};

const items = (rows: ProvenanceRow[]) => rows.flatMap((row) => row.items);
const hrefs = (rows: ProvenanceRow[]) =>
  items(rows)
    .map((item) => item.link?.href)
    .filter(Boolean);

test('every link in the provenance sheet comes from the published records', () => {
  const rows = provenanceRows(manifest, { lang: 'en', ...urls });
  const published = JSON.stringify(manifest);
  // A path the manifest publishes relative to itself is still one of its records.
  const beside = urls.manifestUrl.replace(/[^/]*$/, '');
  for (const href of hrefs(rows) as string[]) {
    const relative =
      href.startsWith(beside) && published.includes(`"${href.slice(beside.length)}"`);
    assert.ok(
      published.includes(href) ||
        relative ||
        Object.values(urls).includes(href) ||
        // The app's own methods site.
        href.startsWith(methodsHref()),
      `${href} is not in the manifest`,
    );
  }
  const cabNp = manifest.cab_np as unknown as { license_file: string };
  assert.ok(hrefs(rows).includes(`${beside}${cabNp.license_file}`));
  const hcp = manifest.atlases.find((atlas) => atlas.id === 'hcp-mmp')!;
  assert.ok(hrefs(rows).includes(`${beside}${hcp.license_file}`));
  assert.ok(hrefs(rows).includes(manifest.anatomy.source_url));
  assert.ok(hrefs(rows).includes(urls.manifestUrl));
  assert.ok(hrefs(rows).includes(urls.indexUrl));
});

test('the sheet names the subject, its reconstruction and each atlas citation', () => {
  const rows = provenanceRows(manifest, { lang: 'en', ...urls });
  const texts = items(rows).map((item) => item.text);
  assert.ok(texts.includes(manifest.anatomy.display_name));
  assert.ok(texts.includes(manifest.anatomy.reconstruction));
  for (const atlas of manifest.atlases) assert.ok(hrefs(rows).includes(atlas.citation), atlas.id);
  const functional = manifest.functional_regions as unknown as { citations: string[] };
  for (const citation of functional.citations) {
    assert.ok(hrefs(rows).includes(citation), citation);
  }
  const files = rows.find((row) => row.label === 'Published files')!;
  const sources = (manifest.provenance as { sources: unknown[] }).sources;
  assert.match(files.items[0].note!, new RegExp(`^${sources.length} source files`));
});

test('absent fields leave no empty rows and invent nothing', () => {
  const rows = provenanceRows(
    { anatomy: { display_name: 'X “1”' } as Manifest['anatomy'] },
    { lang: 'fr' },
  );
  assert.deepEqual(
    rows.map((row) => row.label),
    ['Sujet'],
  );
  assert.equal(rows[0].items[0].note, null, 'no kind is claimed without the individual flag');
});

test('labels are translated; the data is not', () => {
  const en = provenanceRows(manifest, { lang: 'en', ...urls }).map((row) => row.label);
  const fr = provenanceRows(manifest, { lang: 'fr', ...urls }).map((row) => row.label);
  assert.equal(en.length, fr.length);
  assert.notDeepEqual(en, fr);
  const reconstruction = (lang: 'en' | 'fr') =>
    items(provenanceRows(manifest, { lang, ...urls })).find((item) => item.mono)?.text;
  assert.equal(reconstruction('fr'), reconstruction('en'));
});

test('a tract reference lists its own sources, not the hidden anatomy', () => {
  const rows = referenceRows(
    { label: 'SNAIL reference', links: [{ href: 'https://example.org/a', text: 'A' }] },
    'en',
  );
  assert.equal(rows[0].items[0].text, 'SNAIL reference');
  assert.deepEqual(rows[1].items, [{ link: { href: 'https://example.org/a', text: 'A' } }]);
});

test('URLs read without their scheme', () => {
  assert.equal(shortUrl('https://doi.org/10.1/x'), 'doi.org/10.1/x');
  assert.equal(shortUrl('https://www.example.org/'), 'www.example.org');
});

const published = (lang: 'en' | 'fr') => provenanceRows(manifest, { lang, ...urls, domains });
const rowOf = (rows: ProvenanceRow[], label: string) => rows.find((row) => row.label === label)!;

test('PROV-01 the published cdmd manifest gives one row per record, in order', () => {
  assert.deepEqual(
    published('en').map((row) => row.label),
    [
      'Subject',
      'Source data',
      'Reconstruction',
      'Cortical atlases',
      'Functional networks',
      'Functional divisions',
      'Receptor fingerprints',
      'Cortical layers (BigBrain)',
      'Stimulation responses',
      'Stimulation responses (F-TRACT)',
      'Functional connectivity (HCP)',
      'Brain differences in disorders (ENIGMA)',
      'Stroke cases',
      'Registered group maps',
      'Neuropsychological domains',
      'Supplemental layers',
      'Published files',
    ],
  );
  assert.deepEqual(provenanceRows({}), []);
  const supplemental = rowOf(published('en'), 'Supplemental layers').items;
  const doi = (id: string) => ({
    link: { href: `https://doi.org/${id}`, text: `doi.org/${id}` },
  });
  assert.deepEqual(supplemental, [
    {
      text: 'PAM50 cord atlas on this spinal cord',
      note: 'MIT · PAM50 template (De Leener et al. 2018) and white-matter atlas (Lévy et al. 2015), registered with the Spinal Cord Toolbox',
    },
    doi('10.1016/j.neuroimage.2017.10.041'),
    doi('10.1016/j.neuroimage.2015.06.040'),
    doi('10.1016/j.media.2025.103473'),
    doi('10.1016/j.neuroimage.2016.10.009'),
    {
      link: {
        href: '/neuroatlas/models/cdmd/../licenses/PAM50.txt',
        text: 'PAM50.txt',
        mono: true,
      },
    },
    {
      text: 'Harvard Ascending Arousal Network Atlas 2.0',
      note: "FreeSurfer Software License · Arousal nuclei segmented on this brain with FreeSurfer 8.2's SegmentAAN (Olchanyi et al. 2025)",
    },
    doi('10.5061/dryad.zw3r228d2'),
    doi('10.1097/NEN.0b013e3182588293'),
    doi('10.1126/scitranslmed.adj4303'),
    doi('10.1002/hbm.70357'),
    {
      link: {
        href: '/neuroatlas/models/cdmd/../licenses/FreeSurfer.html',
        text: 'FreeSurfer.html',
        mono: true,
      },
    },
  ]);
  const licences = items(published('en'))
    .filter((item) => item.link?.mono && item.link.href.includes('/licenses/'))
    .map((item) => item.link!.href);
  assert.deepEqual(licences, [
    '/neuroatlas/models/cdmd/../licenses/HCP-Data-Use-Terms.txt',
    '/neuroatlas/models/cdmd/../licenses/Julich-Brain-CC-BY-NC-SA-4.0.pdf',
    '/neuroatlas/models/cdmd/../licenses/CAB-NP.txt',
    '/neuroatlas/models/cdmd/../licenses/ENIGMA-Toolbox-BSD-3-Clause.txt',
    '/neuroatlas/models/cdmd/../licenses/PAM50.txt',
    '/neuroatlas/models/cdmd/../licenses/FreeSurfer.html',
  ]);
});

test('PROV-03 the subject, its reconstruction and the source files are named in both languages', () => {
  const en = published('en');
  // One brain's note says why and what it costs, and links the methods site's section on it.
  assert.deepEqual(rowOf(en, 'Subject').items, [
    {
      text: 'MGH CDMD “sub_013”',
      note: 'One individual’s MRI reconstruction. Its surface, cuts, MRI and tracts are one person’s, not an average; atlases and group maps are registered onto it, so their borders here are estimates.',
      link: { href: oneBrainHref(), text: 'Why one brain' },
    },
  ]);
  // An averaged template makes no such claim.
  assert.deepEqual(
    provenanceRows({ anatomy: { display_name: 'fsaverage', individual: false } } as never, {
      lang: 'en',
    })[0]!.items,
    [{ text: 'fsaverage', note: 'Averaged reference template' }],
  );
  assert.deepEqual(rowOf(en, 'Reconstruction').items, [
    { text: 'freesurfer-macOS-darwin_arm64-8.2.0-20260314-d932c45', mono: true },
  ]);
  assert.deepEqual(
    rowOf(en, 'Published files').items.map((item) => [item.link!.text, item.note]),
    [
      ['manifest.json', '86 source files, each with a SHA-256 checksum'],
      ['anatomies.json', 'Index of the published anatomies'],
    ],
  );
  const fr = published('fr');
  assert.match(
    rowOf(fr, 'Sujet').items[0].note!,
    /^Reconstruction IRM d’un individu\. .+ estimations\.$/,
  );
  assert.equal(rowOf(fr, 'Sujet').items[0].link!.text, 'Pourquoi un seul cerveau (en anglais)');
  assert.equal(rowOf(fr, 'Fichiers publiés').items[1].note, 'Index des anatomies publiées');
});

test('PROV-04 HCP-MMP and Julich-Brain say they were projected from fsaverage, and Destrieux says nothing', () => {
  const atlases = (lang: 'en' | 'fr') =>
    rowOf(published(lang), lang === 'en' ? 'Cortical atlases' : 'Atlas corticaux').items;
  assert.equal(atlases('en')[0].text, 'Destrieux anatomical atlas');
  assert.equal(atlases('en')[0].note, null);
  assert.equal(atlases('en')[1].text, 'HCP-MMP1.0 multimodal atlas');
  assert.equal(atlases('en')[1].note, 'Projected from fsaverage');
  assert.equal(atlases('fr')[1].note, 'Projeté depuis fsaverage');
  const julich = atlases('en').find(
    (item) => item.text === 'Julich-Brain cytoarchitectonic atlas',
  )!;
  assert.equal(julich.note, 'Projected from fsaverage');
  assert.equal(julich.link?.href, 'https://doi.org/10.1126/science.abb4588');
});

test('PROV-05 each domain lists how much of every lesion-mapped parcel its areas colour', () => {
  const domainItems = rowOf(published('en'), 'Neuropsychological domains').items;
  const text = (label: string) => domainItems.find((item) => item.text === label)!.note;
  assert.equal(
    text('Executive functions: “executive function”'),
    'Lesion check: Executive dysfunction (Gläscher et al. 2012): G_front_middle (L) 0% coloured, G_front_middle (R) 18% coloured, G_and_S_cingul-Ant (L) 0% coloured, G_and_S_cingul-Ant (R) 8% coloured.',
  );
  assert.equal(
    text('Pain: “pain”'),
    'Lesion check: Central post-stroke pain (Sprenger et al. 2012, Karoam et al. 2025): caudal_division_of_ventral_posterior_lateral_nucleus (L), not measured, caudal_division_of_ventral_posterior_lateral_nucleus (R), not measured, anterior_nucleus_of_pulvinar (L), not measured, anterior_nucleus_of_pulvinar (R), not measured.',
  );
  assert.equal(
    text('Working memory: “working memory”'),
    'No lesion study in Planum’s deficit evidence checks this domain.',
  );
  const unchecked = domainItems.filter((item) => item.note?.startsWith('No lesion study'));
  assert.equal(unchecked.length, 26);
  const [executive] = domains.lesion_checks.executive as Parameters<typeof checkedParcels>[0][];
  assert.equal(
    checkedParcels(executive, 'fr'),
    'G_front_middle (G) colorée à 0\u202f%, G_front_middle (D) colorée à 18\u202f%, G_and_S_cingul-Ant (G) colorée à 0\u202f%, G_and_S_cingul-Ant (D) colorée à 8\u202f%',
  );
  const midline = {
    ...executive,
    mappings: [
      { region: 'destrieux:midline:1', source_name: 'M', coverage: 0.5 },
      { region: 'destrieux:left:1', source_name: 'N', coverage: null },
    ],
  };
  assert.equal(checkedParcels(midline, 'fr'), 'M (Méd) colorée à 50\u202f%, N (G), non mesurée');
});

test('PROV-07 a tract reference with no source links has no Sources row, in either language', () => {
  const reference = { label: 'SNAIL reference', links: [] };
  assert.deepEqual(referenceRows(reference, 'en'), [
    { label: 'Tract reference', items: [{ text: 'SNAIL reference' }] },
  ]);
  assert.deepEqual(referenceRows(reference, 'fr'), [
    { label: 'Référence des faisceaux', items: [{ text: 'SNAIL reference' }] },
  ]);
  const linked = { label: 'R', links: [{ href: 'https://example.org/a', text: 'A' }] };
  assert.equal(referenceRows(linked, 'en')[1].label, 'Sources');
  assert.equal(referenceRows(linked)[0].label, 'Tract reference', 'English by default');
});

test('PROV-08 only the http and https schemes and a trailing slash are dropped', () => {
  assert.equal(shortUrl('http://a.b/'), 'a.b');
  assert.equal(shortUrl('ftp://x/'), 'ftp://x');
  assert.equal(shortUrl(''), '');
  const files = rowOf(published('en'), 'Published files').items;
  assert.deepEqual(
    files.map((item) => [item.link!.mono, item.link!.text]),
    [
      [true, 'manifest.json'],
      [true, 'anatomies.json'],
    ],
  );
});

test('PROV-24 the cortical layers row names the layers, their licence and each citation', () => {
  const layers = {
    file: 'cortical-layers.json',
    label: 'Cortical layers (BigBrain, one histological brain)',
    license: 'CC BY-NC-SA 4.0',
    citations: [
      'https://doi.org/10.1371/journal.pbio.3000678',
      'https://doi.org/10.25493/the9-vqu',
    ],
  };
  const rows = provenanceRows({ cortical_layers: layers }, { lang: 'fr' });
  assert.deepEqual(rows, [
    {
      label: 'Couches corticales (BigBrain)',
      items: [
        { text: 'Cortical layers (BigBrain, one histological brain)', note: 'CC BY-NC-SA 4.0' },
        {
          link: {
            href: 'https://doi.org/10.1371/journal.pbio.3000678',
            text: 'doi.org/10.1371/journal.pbio.3000678',
          },
        },
        { link: { href: 'https://doi.org/10.25493/the9-vqu', text: 'doi.org/10.25493/the9-vqu' } },
      ],
    },
  ]);
});

test('PROV-25 registered maps lead with the landing benchmark and its rule, then each map’s own check', () => {
  const checks = {
    subcortical_dice: { 'thalamus-left': 0.8, 'thalamus-right': 0.9, 'caudate-left': 0.86 },
    cortex_dice: 0.7373,
  };
  const registered = {
    landing: {
      space: 'mni152nlin2009casym',
      structures: 1510,
      centroid_mm: { median: 1.16, p90: 2.93 },
      dice_median: 0.37,
      by_volume: [
        { under_mm3: 100, structures: 900, dice_median: 0.2 },
        { under_mm3: 2000, structures: 500, dice_median: 0.6 },
        { under_mm3: null, structures: 110, dice_median: 0.64 },
      ],
      under_mm3: 100,
      radius_mm: 3,
      method: 'm',
    },
    coordinate_spaces: {
      label: 'Published coordinates',
      spaces: [{ id: 'mni152nlin2009casym', label: 'MNI152NLin2009cAsym', registration: checks }],
    },
    arterial_territories: {
      label: 'Arterial territories (Liu et al. 2023)',
      registration: { ventricle_dice: { left: 0.6824, right: 0.7351 } },
    },
    striatal_networks: {
      label: 'Striatal networks (Choi et al. 2012)',
      registration: { striatum_dice_mean: 0.8764 },
    },
    cerebellar_functions: {
      label: 'Functional cerebellar regions (Nettekoven et al. 2024)',
      registration: { lobule_dice_mean: 0.6506 },
    },
  } as unknown as Partial<Manifest>;
  assert.deepEqual(provenanceRows(registered, { lang: 'en' }), [
    {
      label: 'Registered group maps',
      items: [
        {
          text: 'Fine structures through registration (MNI152NLin2009cAsym)',
          note:
            'The template’s own 1\u202f510 fine structures, carried by the published registration, land a median 1.2\u202fmm from this brain’s own, nine in ten within 2.9\u202fmm. An upper bound: it includes the disagreement between two segmentations. ' +
            'Median overlap (Dice) by the structure’s volume: 0.20 under 100\u202fmm³, 0.60 under 2\u202f000\u202fmm³, 0.64 above. ' +
            'A structure under 100\u202fmm³ takes no shares from a registered map: it names what lies within 3\u202fmm of it.',
        },
        {
          text: 'Arterial territories (Liu et al. 2023)',
          note: 'Overlap (Dice) of the atlas’s ventricles with this brain’s: 0.68 left, 0.74 right.',
        },
        {
          text: 'Functional cerebellar regions (Nettekoven et al. 2024)',
          note: 'Overlap (Dice) of the template’s lobules with this brain’s: 0.65 on average.',
        },
        {
          text: 'Striatal networks (Choi et al. 2012)',
          note: 'Overlap (Dice) of the template’s striatum with this brain’s: 0.88 on average.',
        },
        {
          text: 'Published coordinates · MNI152NLin2009cAsym',
          note: 'Overlap (Dice) of the template’s structures with this brain’s: deep structures 0.86 (median), cortex 0.74.',
        },
      ],
    },
  ]);
  const french = provenanceRows(registered, { lang: 'fr' })[0]!;
  assert.equal(french.label, 'Cartes de groupe recalées');
  assert.match(
    french.items[0]!.note!,
    /médiane de 1,2\u202fmm .* neuf sur dix à moins de 2,9\u202fmm/,
  );
  // A benchmark measured in a space the manifest does not publish names nothing to read it against.
  assert.throws(
    () => provenanceRows({ landing: registered.landing! }, { lang: 'en' }),
    /mni152nlin2009casym is not published/,
  );
});
