import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { readRepoYaml } from '../../../../test/repo.ts';
import { createClinicalCatalog, findingPaint } from './catalog.ts';
import type { ClinicalCatalog } from './catalog.ts';
import { manifests } from './test-support.ts';
import type { ClinicalData } from './types.ts';

const data = readRepoYaml<ClinicalData>('data/neuropsychology.yaml');

test('every published deficit has a colour for each of its findings', () => {
  for (const deficit of data.deficits) {
    findingPaint(
      deficit.id,
      data.associations.filter((association) => association.deficit === deficit.id),
    );
  }
});

describe('published clinical content resolves to the actual atlas and cited evidence', () => {
  for (const [anatomy, manifest] of manifests) {
    test(anatomy, () => checkAnatomy(createClinicalCatalog(data, manifest, {})));
  }
});

function checkAnatomy(catalog: ClinicalCatalog) {
  assert.deepEqual(
    catalog
      .search('', 'en')
      .map((d) => d.id)
      .sort(),
    [
      'abulia',
      'acalculia',
      'achromatopsia',
      'action-naming',
      'agnosia',
      'agrammatism',
      'agraphia',
      'akinetic-mutism',
      'akinetopsia',
      'alexia',
      'alexithymia',
      'alien-hand',
      'amnesia',
      'amusia',
      'anosognosia',
      'aphantasia',
      'aphasia',
      'apraxia',
      'aprosodia',
      'astasia',
      'asterixis',
      'ataxia',
      'ataxic-hemiparesis',
      'auditory-agnosia',
      'auditory-motion',
      'auditory-short-term-memory',
      'biological-motion',
      'buccofacial-apraxia',
      'callosal-apraxia',
      'central-pain',
      'cerebellar-cognitive',
      'cerebellar-vertigo',
      'coma',
      'confabulation',
      'constructional-apraxia',
      'cortical-deafness',
      'crossed-sensory-loss',
      'decision-making',
      'disinhibition',
      'dysarthria',
      'dysphagia',
      'dystonia',
      'emotion-recognition',
      'emotional-empathy',
      'emotional-facial-paresis',
      'executive',
      'fear-conditioning',
      'finger-agnosia',
      'fluid-intelligence',
      'foreign-accent',
      'gaze-evoked-nystagmus',
      'gesture-recognition',
      'hand-paresis',
      'hemianopia',
      'hemichorea',
      'hemiparesis',
      'holmes-tremor',
      'horizontal-gaze-palsy',
      'hypersomnia',
      'insular-cardiac-dysfunction',
      'interval-timing',
      'language-self-awareness',
      'lateropulsion',
      'left-right-disorientation',
      'line-orientation',
      'locked-in',
      'material-specific-memory',
      'micrographia',
      'mirror-image-discrimination',
      'moral-judgement',
      'motor-adaptation',
      'motor-neglect',
      'multitasking',
      'neglect',
      'olfactory-recognition',
      'optic-ataxia',
      'pain-asymbolia',
      'palinopsia',
      'parkinsonism',
      'pathological-grasping',
      'personal-neglect',
      'phonagnosia',
      'phonological-alexia',
      'post-stroke-cognitive-impairment',
      'post-stroke-depressive-symptoms',
      'post-stroke-hiccups',
      'post-stroke-restless-legs',
      'post-stroke-urinary-retention',
      'prospective-memory',
      'pure-sensory-stroke',
      'recollection-familiarity',
      'reversal-learning',
      'saccadic-dysmetria',
      'semantic-memory',
      'sign-language-aphasia',
      'simultanagnosia',
      'sma-syndrome',
      'smoking-addiction-disruption',
      'smooth-pursuit',
      'somatoparaphrenia',
      'somatosensory',
      'sound-localization',
      'source-memory',
      'spasticity',
      'speech-apraxia',
      'stuttering',
      'surface-alexia',
      'sustained-attention',
      'tactile-agnosia',
      'tactile-extinction',
      'taste-impairment',
      'temporal-disorientation',
      'theory-of-mind',
      'topographical-disorientation',
      'transient-global-amnesia',
      'verbal-fluency',
      'vertical-gaze-palsy',
      'visual-extinction',
      'visual-verticality',
      'word-deafness',
      'working-memory',
    ],
  );
  for (const deficit of data.deficits) {
    assert.ok(catalog.forDeficit(deficit.id).length > 0, deficit.id);
  }
  assert.equal(catalog.forRegion('destrieux:left:38')[0].deficit, 'aphasia');
  assert.equal(catalog.forRegion('destrieux:right:21')[0].deficit, 'agnosia');
  for (const id of ['aseg:left:17', 'aseg:right:53']) {
    assert.equal(catalog.forRegion(id)[0].deficit, 'amnesia');
  }
  assert.deepEqual(catalog.forRegion('destrieux:left:1'), []);
  // Two meta-analyses carve neglect and aphasia differently from the single
  // studies beside them, so a region can carry more than one association.
  assert.deepEqual(
    catalog.forRegion('destrieux:right:38').map((a) => a.id),
    ['neglect-allocentric', 'akinetopsia-lateral'],
  );
  assert.deepEqual(
    catalog
      .forRegion('destrieux:right:26')
      .map((a) => a.id)
      .sort(),
    [
      'aprosodia-frontal-parietal',
      'extinction-temporoparietal',
      'line-orientation-right-hemisphere',
      'neglect-egocentric',
      'neglect-perceptual',
      'personal-neglect-parietal',
      'sound-localization-right-network',
      'tactile-agnosia-persistence',
    ],
  );
  assert.ok(
    data.references.some((r) => r.method === 'meta-analysis'),
    'pooled lesion evidence is present',
  );
  assert.ok(
    catalog
      .forDeficit('akinetopsia')[0]
      .evidence.some((e) => e.reference === 'otsuka-hirota-2014' && e.role === 'qualifying'),
    'the unilateral motion-blindness case qualifies the bilateral-lesion example',
  );
  assert.equal(catalog.search('prosopagnosie', 'fr')[0].id, 'agnosia');
  assert.equal(catalog.search('set shifting', 'en')[0].id, 'executive');
  assert.ok(
    catalog.forDeficit('apraxia').every((a) => a.evidence.some((e) => e.role === 'qualifying')),
    'contrary evidence accompanies apraxia claims',
  );
  // Motor/premotor cases join the earlier insular and frontal findings, with qualifications.
  const speech = catalog.forDeficit('speech-apraxia');
  assert.equal(speech.length, 3);
  assert.ok(speech.every((a) => a.evidence.some((e) => e.role === 'qualifying')));
  assert.deepEqual(
    catalog
      .forRegion('destrieux:left:12')
      .map((a) => a.id)
      .sort(),
    [
      'action-naming-left-frontal',
      'agrammatism-inferior-frontal',
      'agraphia-orthographic-long-term',
      'apraxia-finger',
      'apraxia-pantomime-frontal',
      'dysphagia-insula',
      'emotion-prosody',
      'emotional-empathy-inferior-frontal',
      'fluency-letter',
      'gesture-recognition-correctness',
      'speech-apraxia-frontal',
      'stuttering-cortico-striatal',
    ],
  );
  // Deep landmarks reach into aseg and the learning-anatomy solids.
  assert.equal(catalog.forRegion('aseg:left:18')[0].deficit, 'emotion-recognition');
  assert.equal(catalog.forRegion('learning:right:dentate')[0].deficit, 'ataxia');
  // Histological nuclei carry claims of their own; a thalamic nucleus can serve several.
  assert.deepEqual(
    catalog
      .forRegion('nextbrain:left:458')
      .map((a) => a.deficit)
      .sort(),
    ['central-pain', 'central-pain', 'lateropulsion', 'pure-sensory-stroke'],
  );
  assert.deepEqual(
    catalog.forDeficit('amnesia').map((a) => a.id),
    ['hippocampal-amnesia', 'amnesia-fornix', 'amnesia-diencephalic'],
  );
  assert.ok(catalog.forDeficit('hemichorea')[0].evidence.some((e) => e.role === 'qualifying'));
  assert.deepEqual(
    catalog.forRegion('destrieux:left:38').map((a) => a.deficit),
    [
      'aphasia',
      'apraxia',
      'aphasia',
      'aphasia',
      'akinetopsia',
      'gesture-recognition',
      'surface-alexia',
      'verbal-fluency',
      'agrammatism',
      'sign-language-aphasia',
    ],
  );
  // Lobule VI carries motor, speech and cognitive claims side by side; the anterior lobe no cognitive one.
  const cited = (region: string) =>
    catalog
      .forRegion(region)
      .map((a) => a.deficit)
      .sort();
  assert.deepEqual(cited('learning:lobule-vi-right'), [
    'ataxia',
    'cerebellar-cognitive',
    'dysarthria',
    'motor-adaptation',
  ]);
  assert.deepEqual(cited('learning:lobule-v-right'), ['ataxia', 'dysarthria', 'motor-adaptation']);
  assert.deepEqual(
    catalog.search('champ visuel', 'fr').map((deficit) => deficit.id),
    ['hemianopia'],
  );
  assert.deepEqual(
    catalog.search('reading', 'en').map((deficit) => deficit.id),
    ['phonological-alexia', 'alexia', 'surface-alexia'],
  );
  // Every deficit sits in one group, and the groups are what the list is read by.
  assert.equal(
    catalog.grouped('', 'en').flatMap((entry) => entry.deficits).length,
    data.deficits.length,
  );
  assert.deepEqual(
    catalog.grouped('', 'en').map((entry) => entry.group.id),
    [
      'attention-executive',
      'memory',
      'language-number',
      'perception',
      'sensorimotor',
      'social-emotional',
    ],
  );
  assert.deepEqual(catalog.mappedRegions('aphasia').slice(0, 2), [
    'destrieux:left:38',
    'destrieux:left:34',
  ]);
}

describe('published clinical content: fixed values', () => {
  const [, manifest] = manifests[0];
  const catalog = createClinicalCatalog(data, manifest, {});

  test('CAT-50 · the published records are the revision of 2026-11-02: 6 groups, 121 deficits, 305 references, 193 associations', () => {
    assert.equal(catalog.revised, '2026-11-02');
    assert.equal(data.groups.length, 6);
    assert.equal(data.deficits.length, 121);
    assert.equal(data.references.length, 306);
    assert.equal(data.associations.length, 193);
  });

  test('reviewed motor-neglect and aprosodia findings preserve their mapping limits', () => {
    assert.equal(catalog.paint('motor-neglect', 'motor-neglect-parietal').paint.colors.size, 0);
    assert.deepEqual(catalog.mappedRegions('motor-neglect'), ['aseg:right:51']);
    assert.deepEqual(
      catalog.forDeficit('aprosodia').map((a) => a.id),
      ['aprosodia-frontal-parietal', 'aprosodia-medial-frontal'],
    );
  });

  test('the callosal alien-hand finding highlights anterior subdivisions and leaves posterior callosum uncoloured', () => {
    assert.deepEqual(catalog.mappedRegions('alien-hand'), ['aseg:midline:254', 'aseg:midline:255']);
    assert.ok(!catalog.paint('alien-hand').paint.colors.has('aseg:midline:251'));
  });

  test('the focal coma finding colours its brainstem landmark without colouring connected cortical nodes', () => {
    assert.deepEqual(
      [...catalog.paint('coma', 'coma-dorsolateral-pons').paint.colors.keys()],
      ['learning:left:pons'],
    );
  });

  test('the amusia connectivity finding stays uncoloured while its direct lesion landmarks remain available', () => {
    assert.equal(catalog.paint('amusia', 'amusia-network').paint.colors.size, 0);
    assert.deepEqual(catalog.mappedRegions('amusia'), ['destrieux:right:33', 'destrieux:right:34']);
  });

  test('new findings keep normative connectivity and unresolved clinical locations out of the direct-lesion paint', () => {
    assert.equal(catalog.paint('holmes-tremor', 'holmes-tremor-network').paint.colors.size, 0);
    assert.deepEqual(catalog.mappedRegions('holmes-tremor'), ['aseg:right:49']);
    assert.deepEqual(catalog.mappedRegions('asterixis'), ['aseg:left:10']);
  });

  test('new profiles retain their distinct tasks and bilingual search terms', () => {
    assert.equal(catalog.search('flapping tremor', 'en')[0].id, 'asterixis');
    assert.equal(catalog.search('mouvement biologique', 'fr')[0].id, 'biological-motion');
    assert.equal(catalog.search('backward span', 'en')[0].id, 'working-memory');
    assert.deepEqual(catalog.mappedRegions('biological-motion'), [
      'destrieux:left:74',
      'destrieux:right:74',
    ]);
    assert.deepEqual(
      catalog.forDeficit('working-memory').map((finding) => finding.id),
      ['working-memory-manipulation', 'working-memory-spatial-precision'],
    );
  });

  test('the further additions keep auditory overlap and proposed disconnections out of their parcel mappings', () => {
    assert.deepEqual(catalog.mappedRegions('astasia'), ['aseg:right:49']);
    assert.equal(
      catalog.paint('sustained-attention', 'sustained-attention-vigilance').paint.colors.size,
      0,
    );
    assert.deepEqual(catalog.mappedRegions('sustained-attention'), ['destrieux:right:57']);
    assert.equal(catalog.search('vigilance decrement', 'en')[0].id, 'sustained-attention');
    assert.equal(catalog.search('estimation des durées', 'fr')[0].id, 'interval-timing');
  });

  test('duration and gesture findings preserve the studies’ task-specific distinctions', () => {
    assert.deepEqual(catalog.mappedRegions('gesture-recognition'), [
      'destrieux:left:12',
      'destrieux:left:14',
      'destrieux:left:38',
    ]);
    assert.deepEqual(
      [...catalog.paint('interval-timing', 'interval-timing-inferior-frontal').paint.colors.keys()],
      ['destrieux:right:12'],
    );
    assert.deepEqual(
      [...catalog.paint('interval-timing', 'interval-timing-middle-frontal').paint.colors.keys()],
      ['destrieux:right:15'],
    );
    for (const finding of catalog.forDeficit('gesture-recognition')) {
      assert.equal(finding.evidence.length, 2);
      assert.ok(finding.evidence.some((source) => source.role === 'qualifying'));
    }
  });

  test('November findings keep unresolved structures and connected nodes out of direct-lesion paint', () => {
    assert.equal(
      catalog.paint('visual-verticality', 'visual-verticality-brainstem').paint.colors.size,
      0,
    );
    assert.equal(
      catalog.paint('source-memory', 'source-memory-context-stability').paint.colors.size,
      0,
    );
    for (const deficit of ['visual-verticality', 'source-memory']) {
      assert.ok(
        catalog
          .forDeficit(deficit)
          .every((finding) => finding.evidence.some((source) => source.role === 'qualifying')),
      );
    }
  });

  test('November profiles resolve bilingual terms and only the reviewed cortical landmarks', () => {
    assert.equal(catalog.search('verticale visuelle subjective', 'fr')[0].id, 'visual-verticality');
    assert.equal(catalog.search('mémoire de source', 'fr')[0].id, 'source-memory');
    assert.deepEqual(catalog.mappedRegions('visual-verticality'), [
      'destrieux:left:17',
      'destrieux:right:17',
    ]);
    assert.deepEqual(catalog.mappedRegions('source-memory'), [
      'destrieux:left:15',
      'destrieux:right:15',
    ]);
  });

  test('additional sleep and motor findings retain only their reviewed landmarks', () => {
    assert.deepEqual(catalog.mappedRegions('micrographia'), ['aseg:left:13']);
    assert.deepEqual(catalog.mappedRegions('hypersomnia'), ['aseg:left:10', 'aseg:right:49']);
    assert.deepEqual(catalog.mappedRegions('saccadic-dysmetria'), [
      'learning:left:fastigial',
      'learning:right:fastigial',
      'nextbrain:left:715',
      'nextbrain:right:10715',
    ]);
    assert.deepEqual(catalog.mappedRegions('smooth-pursuit'), [
      'learning:vermis-ix',
      'learning:vermis-viii',
    ]);
    assert.equal(catalog.paint('smooth-pursuit', 'smooth-pursuit-cerebral').paint.colors.size, 0);
    assert.ok(
      catalog
        .forDeficit('hypersomnia')[0]
        .evidence.some(
          (source) => source.reference === 'hansen-2020' && source.role === 'qualifying',
        ),
    );
  });

  test('additional profiles distinguish handwriting, sleep and two eye-movement deficits in bilingual search', () => {
    assert.equal(catalog.search('small handwriting', 'en')[0].id, 'micrographia');
    assert.equal(catalog.search('hypersomnolence', 'en')[0].id, 'hypersomnia');
    assert.equal(catalog.search('hypermétrie saccadique', 'fr')[0].id, 'saccadic-dysmetria');
    assert.equal(catalog.search('poursuite oculaire lente', 'fr')[0].id, 'smooth-pursuit');
    assert.equal(catalog.search('olfactory recognition', 'en')[0].id, 'olfactory-recognition');
  });

  test('reading and mood findings distinguish direct lesions from failed or indirect localizations', () => {
    assert.deepEqual(catalog.mappedRegions('phonological-alexia'), ['destrieux:left:29']);
    assert.equal(
      catalog.paint('phonological-alexia', 'phonological-alexia-general-reading').paint.colors.size,
      0,
    );
    assert.deepEqual(catalog.mappedRegions('post-stroke-depressive-symptoms'), [
      'aseg:right:54',
      'aseg:right:52',
    ]);
    assert.equal(
      catalog.paint('post-stroke-depressive-symptoms', 'post-stroke-depressive-symptoms-network')
        .paint.colors.size,
      0,
    );
    assert.ok(
      data.references.every((reference) => reference.pmid !== '33504189'),
      'the retracted depression article is not included',
    );
  });

  test('reading and mood profiles have distinct bilingual search terms', () => {
    assert.equal(catalog.search('lecture de pseudomots', 'fr')[0].id, 'phonological-alexia');
    assert.equal(
      catalog.search('poststroke depression', 'en')[0].id,
      'post-stroke-depressive-symptoms',
    );
  });

  test('body attention and motion findings retain their localization limits', () => {
    assert.deepEqual(catalog.mappedRegions('surface-alexia'), ['destrieux:left:38']);
    assert.deepEqual(catalog.mappedRegions('personal-neglect'), [
      'destrieux:right:26',
      'destrieux:right:28',
    ]);
    assert.equal(catalog.paint('personal-neglect', 'personal-neglect-medial').paint.colors.size, 0);
    assert.deepEqual(catalog.mappedRegions('auditory-motion'), ['destrieux:right:34']);
  });

  test('body attention and motion profiles are distinct in bilingual search', () => {
    assert.equal(catalog.search('erreurs de régularisation', 'fr')[0].id, 'surface-alexia');
    assert.equal(catalog.search('body neglect', 'en')[0].id, 'personal-neglect');
    assert.equal(catalog.search('surdité au mouvement', 'fr')[0].id, 'auditory-motion');
  });

  test('eye-movement findings retain broad brainstem landmarks and unresolved anatomy', () => {
    assert.deepEqual(catalog.mappedRegions('horizontal-gaze-palsy'), [
      'learning:left:pons',
      'learning:right:pons',
    ]);
    assert.deepEqual(catalog.mappedRegions('vertical-gaze-palsy'), ['learning:left:midbrain']);
    assert.equal(
      catalog.paint('vertical-gaze-palsy', 'vertical-gaze-palsy-thalamic').paint.colors.size,
      0,
    );
    assert.equal(
      catalog.paint('gaze-evoked-nystagmus', 'gaze-evoked-nystagmus-cerebellar').paint.colors.size,
      0,
    );
    assert.deepEqual(catalog.mappedRegions('gaze-evoked-nystagmus'), [
      'learning:left:pons',
      'learning:right:pons',
    ]);
  });

  test('gaze limitation and gaze holding have distinct bilingual search terms', () => {
    assert.equal(
      catalog.search('conjugate horizontal gaze paralysis', 'en')[0].id,
      'horizontal-gaze-palsy',
    );
    assert.equal(
      catalog.search('paralysie de l’élévation du regard', 'fr')[0].id,
      'vertical-gaze-palsy',
    );
    assert.equal(
      catalog.search('déficit de maintien du regard', 'fr')[0].id,
      'gaze-evoked-nystagmus',
    );
  });

  test('awareness and mirror-image findings preserve focal landmarks and leave unresolved results uncoloured', () => {
    assert.deepEqual(catalog.mappedRegions('language-self-awareness'), ['destrieux:left:13']);
    assert.equal(
      catalog.paint('language-self-awareness', 'language-self-awareness-communication').paint.colors
        .size,
      0,
    );
    assert.deepEqual(catalog.mappedRegions('mirror-image-discrimination'), ['destrieux:right:57']);
  });

  test('language awareness and mirror-image profiles remain distinct in bilingual search', () => {
    assert.equal(catalog.search('naming self-appraisal', 'en')[0].id, 'language-self-awareness');
    assert.equal(
      catalog.search('reflected image discrimination', 'en')[0].id,
      'mirror-image-discrimination',
    );
  });

  test('facial and bladder findings keep their broad landmarks and localization limits', () => {
    assert.deepEqual(catalog.mappedRegions('emotional-facial-paresis'), ['learning:right:pons']);
    assert.deepEqual(catalog.mappedRegions('post-stroke-urinary-retention'), [
      'learning:left:medulla',
      'learning:right:medulla',
      'learning:right:pons',
    ]);
    assert.deepEqual(
      [
        ...catalog
          .paint('post-stroke-urinary-retention', 'urinary-retention-pontine')
          .paint.colors.keys(),
      ],
      ['learning:right:pons'],
    );
    assert.ok(data.references.every((reference) => reference.pmid !== '32927900'));
  });

  test('emotional facial movement and urinary retention have distinct bilingual search terms', () => {
    assert.equal(
      catalog.search('sourire spontané asymétrique', 'fr')[0].id,
      'emotional-facial-paresis',
    );
    assert.equal(
      catalog.search('postvoid residual urine', 'en')[0].id,
      'post-stroke-urinary-retention',
    );
  });

  test('memory, fluency, fear and moral findings colour only their reviewed landmarks', () => {
    assert.deepEqual(catalog.mappedRegions('material-specific-memory'), [
      'aseg:left:17',
      'destrieux:left:44',
      'aseg:right:53',
    ]);
    assert.deepEqual(
      [
        ...catalog
          .paint('material-specific-memory', 'spatial-memory-right-hippocampus')
          .paint.colors.keys(),
      ],
      ['aseg:right:53'],
    );
    assert.deepEqual(catalog.mappedRegions('semantic-memory'), [
      'destrieux:left:44',
      'destrieux:right:44',
    ]);
    assert.deepEqual(
      [...catalog.paint('verbal-fluency', 'fluency-superior-medial').paint.colors.keys()],
      ['destrieux:left:16', 'destrieux:right:16'],
    );
    assert.ok(!catalog.mappedRegions('verbal-fluency').includes('destrieux:left:4'));
    assert.deepEqual(catalog.mappedRegions('fear-conditioning'), ['aseg:left:18', 'aseg:right:54']);
    assert.deepEqual(catalog.mappedRegions('moral-judgement'), [
      'destrieux:left:31',
      'destrieux:right:31',
    ]);
  });

  test('memory, fluency, fear and moral profiles have distinct bilingual search terms', () => {
    assert.equal(catalog.search('object location', 'en')[0].id, 'material-specific-memory');
    assert.equal(catalog.search('encéphalite herpétique', 'fr')[0].id, 'semantic-memory');
    assert.equal(catalog.search('category fluency', 'en')[0].id, 'verbal-fluency');
    assert.equal(catalog.search('conditionnement pavlovien', 'fr')[0].id, 'fear-conditioning');
    assert.equal(catalog.search('trolley problem', 'en')[0].id, 'moral-judgement');
  });

  test('reward, reasoning, multitasking, grasping and vertigo findings colour only their reviewed landmarks', () => {
    assert.deepEqual(catalog.mappedRegions('reversal-learning'), [
      'destrieux:left:24',
      'destrieux:right:24',
      'destrieux:left:31',
      'destrieux:right:31',
    ]);
    assert.deepEqual(
      [...catalog.paint('fluid-intelligence', 'fluid-general-left').paint.colors.keys()],
      ['destrieux:left:5'],
    );
    assert.deepEqual(catalog.mappedRegions('multitasking'), [
      'destrieux:right:5',
      'destrieux:left:9',
      'destrieux:left:10',
    ]);
    assert.ok(!catalog.mappedRegions('pathological-grasping').includes('destrieux:left:6'));
    assert.deepEqual(catalog.mappedRegions('cerebellar-vertigo'), ['learning:vermis-x']);
    const woolgar = data.references.find((reference) => reference.id === 'woolgar-2010');
    assert.deepEqual(
      woolgar?.corrections?.map((correction) => correction.doi),
      ['10.1073/pnas.1513862112'],
    );
  });

  test('reward, reasoning, multitasking, grasping and vertigo profiles have distinct bilingual search terms', () => {
    assert.equal(catalog.search('reversal learning', 'en')[0].id, 'reversal-learning');
    assert.equal(catalog.search('raisonnement matriciel', 'fr')[0].id, 'fluid-intelligence');
    assert.equal(catalog.search('Hotel task', 'en')[0].id, 'multitasking');
    assert.equal(catalog.search('réflexe de préhension', 'fr')[0].id, 'pathological-grasping');
    assert.equal(catalog.search('pseudo-vestibular neuritis', 'en')[0].id, 'cerebellar-vertigo');
  });

  test('line orientation, grammar, medullary sensory and smoking findings colour only their reviewed landmarks', () => {
    assert.deepEqual(catalog.mappedRegions('line-orientation'), ['destrieux:right:26']);
    assert.deepEqual(
      [...catalog.paint('agrammatism', 'agrammatism-inferior-frontal').paint.colors.keys()],
      ['destrieux:left:12', 'destrieux:left:14'],
    );
    assert.deepEqual(
      [...catalog.paint('agrammatism', 'paragrammatism-posterior-temporal').paint.colors.keys()],
      ['destrieux:left:34', 'destrieux:left:38'],
    );
    assert.deepEqual(catalog.mappedRegions('crossed-sensory-loss'), [
      'learning:left:medulla',
      'learning:right:medulla',
    ]);
    assert.ok(
      catalog
        .forDeficit('smoking-addiction-disruption')[0]
        .evidence.some((e) => e.reference === 'bienkowski-2010' && e.role === 'qualifying'),
    );
    assert.ok(
      catalog
        .mappedRegions('smoking-addiction-disruption')
        .every((region) => /^destrieux:(left|right):1[78]$/.test(region)),
    );
  });

  test('line orientation, grammar, medullary sensory and smoking profiles have distinct bilingual search terms', () => {
    assert.equal(catalog.search('Benton line orientation', 'en')[0].id, 'line-orientation');
    assert.equal(catalog.search('discours télégraphique', 'fr')[0].id, 'agrammatism');
    assert.equal(catalog.search('Wallenberg syndrome', 'en')[0].id, 'crossed-sensory-loss');
    assert.equal(catalog.search('envie de fumer', 'fr')[0].id, 'smoking-addiction-disruption');
  });

  test('cardiac, hiccup and motor-adaptation findings colour only their reviewed landmarks', () => {
    assert.deepEqual(
      [...catalog.paint('insular-cardiac-dysfunction', 'cardiac-right-insula').paint.colors.keys()],
      ['destrieux:right:17', 'destrieux:right:18'],
    );
    assert.deepEqual(
      [...catalog.paint('insular-cardiac-dysfunction', 'cardiac-left-insula').paint.colors.keys()],
      ['destrieux:left:17', 'destrieux:left:18'],
    );
    assert.deepEqual(catalog.mappedRegions('post-stroke-hiccups'), [
      'learning:left:medulla',
      'learning:right:medulla',
    ]);
    assert.equal(
      catalog.paint('motor-adaptation', 'adaptation-prism-throwing').paint.colors.size,
      0,
    );
    assert.ok(!catalog.mappedRegions('motor-adaptation').includes('learning:lobules-i-iv-left'));
  });

  test('cardiac, hiccup and motor-adaptation profiles have distinct bilingual search terms', () => {
    assert.equal(
      catalog.search('heart rate variability', 'en')[0].id,
      'insular-cardiac-dysfunction',
    );
    assert.equal(catalog.search('singultus', 'en')[0].id, 'post-stroke-hiccups');
    assert.equal(catalog.search('adaptation prismatique', 'fr')[0].id, 'motor-adaptation');
  });

  test('sign language, post-stroke cognition and restless-legs findings colour only their reviewed landmarks', () => {
    assert.deepEqual(catalog.mappedRegions('sign-language-aphasia'), [
      'destrieux:left:34',
      'destrieux:left:38',
    ]);
    assert.equal(
      catalog.paint('sign-language-aphasia', 'sign-aphasia-right-spatial').paint.colors.size,
      0,
    );
    assert.deepEqual(catalog.mappedRegions('post-stroke-cognitive-impairment'), [
      'aseg:left:10',
      'destrieux:left:25',
    ]);
    assert.deepEqual(catalog.mappedRegions('post-stroke-restless-legs'), [
      'learning:left:pons',
      'learning:right:pons',
    ]);
  });

  test('sign language, post-stroke cognition and restless-legs profiles have distinct bilingual search terms', () => {
    assert.equal(catalog.search('British Sign Language', 'en')[0].id, 'sign-language-aphasia');
    assert.equal(
      catalog.search('infarctus stratégique', 'fr')[0].id,
      'post-stroke-cognitive-impairment',
    );
    assert.equal(catalog.search('Willis-Ekbom', 'en')[0].id, 'post-stroke-restless-legs');
  });

  test('transient amnesia, pure sensory and ataxic hemiparesis findings colour only their reviewed landmarks', () => {
    assert.deepEqual(catalog.mappedRegions('transient-global-amnesia'), [
      'aseg:left:17',
      'aseg:right:53',
    ]);
    assert.deepEqual(catalog.mappedRegions('pure-sensory-stroke'), [
      'nextbrain:left:458',
      'nextbrain:right:10458',
      'nextbrain:left:423',
      'nextbrain:right:10423',
    ]);
    assert.deepEqual(catalog.mappedRegions('ataxic-hemiparesis'), [
      'learning:left:pons',
      'learning:right:pons',
    ]);
  });

  test('transient amnesia, pure sensory and ataxic hemiparesis profiles have distinct bilingual search terms', () => {
    assert.equal(catalog.search('ictus amnésique', 'fr')[0].id, 'transient-global-amnesia');
    assert.equal(catalog.search('cheiro-oral syndrome', 'en')[0].id, 'pure-sensory-stroke');
    assert.equal(catalog.search('dysarthrie-main malhabile', 'fr')[0].id, 'ataxic-hemiparesis');
  });

  test('motor-area, recognition-memory and action-naming findings colour only their reviewed landmarks', () => {
    assert.deepEqual(
      [...catalog.paint('sma-syndrome', 'sma-speech').paint.colors.keys()],
      ['destrieux:left:16'],
    );
    assert.deepEqual(catalog.mappedRegions('recollection-familiarity'), [
      'aseg:left:17',
      'aseg:right:53',
      'learning:left:mammillary',
      'learning:right:mammillary',
      'destrieux:left:23',
    ]);
    assert.ok(
      catalog
        .forDeficit('recollection-familiarity')[0]
        .evidence.some((e) => e.reference === 'wais-2006' && e.role === 'qualifying'),
    );
    assert.deepEqual(catalog.mappedRegions('action-naming'), ['destrieux:left:12']);
  });

  test('motor-area, recognition-memory and action-naming profiles have distinct bilingual search terms', () => {
    assert.equal(catalog.search('postoperative mutism', 'en')[0].id, 'sma-syndrome');
    assert.equal(catalog.search('souvenir-savoir', 'fr')[0].id, 'recollection-familiarity');
    assert.equal(catalog.search('noun-verb dissociation', 'en')[0].id, 'action-naming');
  });

  test('praxis findings colour only their reviewed landmarks and keep deep lesions uncoloured', () => {
    const keys = (deficit: string, finding: string) => [
      ...catalog.paint(deficit, finding).paint.colors.keys(),
    ];
    assert.deepEqual(keys('apraxia', 'apraxia-pantomime-frontal'), [
      'destrieux:left:12',
      'destrieux:left:14',
    ]);
    assert.deepEqual(keys('apraxia', 'apraxia-pantomime-posterior'), [
      'destrieux:left:26',
      'destrieux:left:38',
    ]);
    assert.deepEqual(keys('apraxia', 'apraxia-tool-use'), ['destrieux:left:26']);
    assert.deepEqual(keys('apraxia', 'apraxia-deep'), []);
    assert.deepEqual(catalog.mappedRegions('callosal-apraxia'), [
      'aseg:midline:255',
      'aseg:midline:254',
      'aseg:midline:253',
    ]);
    const qualifying = (finding: string) =>
      catalog
        .forDeficit(finding.startsWith('callosal') ? 'callosal-apraxia' : 'apraxia')
        .find((a) => a.id === finding)!
        .evidence.filter((e) => e.role === 'qualifying')
        .map((e) => e.reference);
    assert.deepEqual(qualifying('apraxia-pantomime-frontal'), ['hoeren-2014']);
    assert.deepEqual(qualifying('apraxia-pantomime-posterior'), ['goldenberg-2007']);
    assert.deepEqual(qualifying('apraxia-tool-use'), ['stoll-2022']);
    assert.deepEqual(qualifying('apraxia-deep'), ['de-renzi-1986']);
    assert.deepEqual(qualifying('callosal-apraxia-anterior'), ['watson-1986']);
  });

  test('limb and callosal apraxia have distinct bilingual search terms', () => {
    assert.equal(catalog.search('left-hand apraxia', 'en')[0].id, 'callosal-apraxia');
    assert.equal(catalog.search('callosotomie', 'fr')[0].id, 'callosal-apraxia');
    assert.equal(catalog.search('deep apraxia', 'en')[0].id, 'apraxia');
    assert.equal(catalog.search('utilisation d’outils', 'fr')[0].id, 'apraxia');
  });

  test('CAT-45 · a published search ignores case and accents and ranks the named deficit first', () => {
    const ids = (query: string, lang: 'en' | 'fr') => catalog.search(query, lang).map((d) => d.id);
    assert.deepEqual(ids('amnesia', 'en'), [
      'amnesia',
      'source-memory',
      'transient-global-amnesia',
    ]);
    assert.deepEqual(ids('aphas', 'en'), [
      'aphasia',
      'speech-apraxia',
      'language-self-awareness',
      'sign-language-aphasia',
    ]);
    assert.deepEqual(ids('AMNÉSIA', 'en'), [
      'amnesia',
      'source-memory',
      'transient-global-amnesia',
    ]);
    assert.deepEqual(ids('memory', 'en'), [
      'agraphia',
      'amnesia',
      'auditory-short-term-memory',
      'multitasking',
      'material-specific-memory',
      'olfactory-recognition',
      'prospective-memory',
      'recollection-familiarity',
      'semantic-memory',
      'source-memory',
      'confabulation',
      'transient-global-amnesia',
      'working-memory',
    ]);
    assert.equal(ids('', 'fr').length, 121);
    assert.deepEqual(ids('unlisted', 'en'), []);
  });

  test('CAT-42 · a misspelt published deficit is offered the closest name', () => {
    assert.equal(catalog.nearest('aphasai', 'en'), 'Aphasia');
    assert.equal(catalog.nearest('amnesie', 'fr'), 'Amnésie');
    assert.equal(catalog.nearest('abc', 'en'), null);
  });

  test('CAT-49 · aphasia has the most findings, six, and its paint colours 7 regions', () => {
    const counts = data.deficits.map((d) => catalog.forDeficit(d.id).length);
    assert.equal(Math.max(...counts), 6);
    assert.equal(catalog.forDeficit('aphasia').length, 6);
    assert.equal(catalog.paint('aphasia').paint.colors.size, 7);
    assert.equal(catalog.paint('aphasia').paint.id, 'deficit:aphasia');
  });
});
