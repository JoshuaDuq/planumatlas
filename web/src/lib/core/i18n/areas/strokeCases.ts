import type { AqBand, WabType } from '../../catalog/stroke-cases.ts';

const people = (count: number) => (count === 1 ? 'person' : 'people');
const personnes = (count: number) => (count === 1 ? 'personne' : 'personnes');

export const en = {
  heading: 'Stroke cases',
  lead: (count: string, n: number, share: string, window: string) =>
    `${count} ${people(n)} whose stroke reached at least ${share} of this region, tested ${window}.`,
  none: (share: string) =>
    `No one in the cohort had a lesion reaching ${share} of this region within this test window.`,
  window: 'Tested within',
  windows: { days: (days: number) => `${days} days`, year: '1 year', any: 'Any' },
  windowPhrase: {
    days: (days: number) => `within ${days} days of their scan, before or after`,
    year: 'within a year of their scan, before or after',
    any: 'at any time',
  },
  plot: 'Language score against lesion volume',
  volumeAxis: 'lesion volume, cm³',
  scoreAxis: 'WAB-AQ',
  normal: 'within normal limits',
  dot: (title: string, volume: string, share: string) => `${title}, ${volume} cm³, ${share} of this region`,
  plotHint: 'Each dot is one person. Pick two to compare; the brain shows their lesions.',
  pairs: 'Similar size, different score',
  showPair: 'Show a pair',
  nextPair: 'Next pair',
  pairOf: (index: number, total: number, ratio: string, points: string) =>
    `Pair ${index} of ${total}: lesions within ${ratio} in size, scores ${points} points apart.`,
  exceptions: 'Much of it damaged, mild or no aphasia',
  title: (type: string, aq: string) => `${type} · WAB-AQ ${aq}`,
  facts: (volume: string, share: string, band: string) => `${volume} cm³ lesion · ${share} of this region · ${band}`,
  timing: (months: number, gap: number, later: boolean) =>
    `Scanned ${months} ${months === 1 ? 'month' : 'months'} after the stroke · ${
      gap === 0 ? 'tested the same day' : `tested ${gap} ${gap === 1 ? 'day' : 'days'} ${later ? 'later' : 'earlier'}`
    }`,
  caseId: (id: string) => `ARC ${id}`,
  only: (title: string) => `${title} only`,
  both: 'Both',
  differ: 'Where they differ',
  thisRegion: 'this region',
  exceptionMeta: (share: string, volume: string) => `${share} of it · ${volume} cm³`,
  clear: 'Clear cases',
  loading: 'Loading the cohort…',
  failed: 'The cohort could not be loaded.',
  drawFailed: 'The lesions could not be drawn.',
  note: (total: number) =>
    `Aphasia Recovery Cohort: ${total} people with chronic left-hemisphere stroke, recruited for aphasia studies. People with a lesion here but no aphasia are under-sampled, and no case predicts anyone else’s recovery. Each person has one Western Aphasia Battery score (WAB-AQ, 0–100; 93.8 and above is within normal limits). Lesions were drawn on each person’s MRI and carried onto this brain.`,
  dataset: 'OpenNeuro dataset',
  types: {
    Global: 'Global aphasia',
    Broca: 'Broca’s aphasia',
    TranscorticalMotor: 'Transcortical motor aphasia',
    Wernicke: 'Wernicke’s aphasia',
    Conduction: 'Conduction aphasia',
    Anomic: 'Anomic aphasia',
    None: 'No aphasia',
  } satisfies Record<WabType, string>,
  unrecorded: 'Type not recorded',
  bands: {
    'very-severe': 'very severe',
    severe: 'severe',
    moderate: 'moderate',
    mild: 'mild',
    'within-normal-limits': 'within normal limits',
  } satisfies Record<AqBand['id'], string>,
};

export const fr: typeof en = {
  heading: 'Cas d’AVC',
  lead: (count: string, n: number, share: string, window: string) =>
    `${count} ${personnes(n)} dont l’AVC atteint au moins ${share} de cette région, ${n === 1 ? 'évaluée' : 'évaluées'} ${window}.`,
  none: (share: string) =>
    `Personne dans la cohorte n’a de lésion atteignant ${share} de cette région dans ce délai d’évaluation.`,
  window: 'Délai d’évaluation',
  windows: { days: (days: number) => `${days} jours`, year: '1 an', any: 'Tous' },
  windowPhrase: {
    days: (days: number) => `à moins de ${days} jours de leur examen, avant ou après`,
    year: 'à moins d’un an de leur examen, avant ou après',
    any: 'à tout moment',
  },
  plot: 'Score de langage selon le volume de la lésion',
  volumeAxis: 'volume de la lésion, cm³',
  scoreAxis: 'QA-WAB',
  normal: 'dans les limites de la normale',
  dot: (title: string, volume: string, share: string) => `${title}, ${volume} cm³, ${share} de cette région`,
  plotHint: 'Chaque point est une personne. Choisissez-en deux à comparer ; le cerveau montre leurs lésions.',
  pairs: 'Taille semblable, score différent',
  showPair: 'Montrer une paire',
  nextPair: 'Paire suivante',
  pairOf: (index: number, total: number, ratio: string, points: string) =>
    `Paire ${index} sur ${total} : lésions de taille égale à ${ratio} près, scores séparés de ${points} points.`,
  exceptions: 'Très atteinte, aphasie légère ou absente',
  title: (type: string, aq: string) => `${type} · QA-WAB ${aq}`,
  facts: (volume: string, share: string, band: string) =>
    `Lésion de ${volume} cm³ · ${share} de cette région · ${band}`,
  timing: (months: number, gap: number, later: boolean) =>
    `Examen ${months} mois après l’AVC · ${
      gap === 0 ? 'évaluation le même jour' : `évaluation ${gap} ${gap === 1 ? 'jour' : 'jours'} ${later ? 'plus tard' : 'plus tôt'}`
    }`,
  caseId: (id: string) => `ARC ${id}`,
  only: (title: string) => `${title}, uniquement`,
  both: 'Les deux',
  differ: 'Ce qui les distingue',
  thisRegion: 'cette région',
  exceptionMeta: (share: string, volume: string) => `${share} atteinte · ${volume} cm³`,
  clear: 'Effacer les cas',
  loading: 'Chargement de la cohorte…',
  failed: 'La cohorte n’a pas pu être chargée.',
  drawFailed: 'Les lésions n’ont pas pu être dessinées.',
  note: (total: number) =>
    `Aphasia Recovery Cohort : ${total} personnes ayant subi un AVC chronique de l’hémisphère gauche, recrutées pour des études sur l’aphasie. Les personnes ayant une lésion ici sans aphasie sont sous-représentées, et aucun cas ne prédit le rétablissement de quelqu’un d’autre. Chaque personne a un seul score à la Western Aphasia Battery (QA-WAB, de 0 à 100 ; 93,8 et plus est dans les limites de la normale). Les lésions ont été tracées sur l’IRM de chaque personne, puis reportées sur ce cerveau.`,
  dataset: 'Jeu de données OpenNeuro',
  types: {
    Global: 'Aphasie globale',
    Broca: 'Aphasie de Broca',
    TranscorticalMotor: 'Aphasie transcorticale motrice',
    Wernicke: 'Aphasie de Wernicke',
    Conduction: 'Aphasie de conduction',
    Anomic: 'Aphasie anomique',
    None: 'Sans aphasie',
  },
  unrecorded: 'Type non noté',
  bands: {
    'very-severe': 'très sévère',
    severe: 'sévère',
    moderate: 'modérée',
    mild: 'légère',
    'within-normal-limits': 'dans les limites de la normale',
  },
};
