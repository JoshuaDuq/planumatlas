const people = (count: number) => (count === 1 ? 'person' : 'people');
const personnes = (count: number) => (count === 1 ? 'personne' : 'personnes');

export const en = {
  heading: 'Stimulation responses',
  site: 'Thalamic site',
  direction: 'Direction',
  from: 'Stimulated here',
  to: 'Recorded here',
  side: 'Hemisphere',
  same: 'Same side',
  opposite: 'Opposite side',
  counts: (responded: string, tested: string, subjects: number) =>
    `${responded} of ${tested} pairs · ${subjects} ${people(subjects)}`,
  noRate: 'no rate',
  none: 'No pairs tested on this side.',
  untested: (list: string) => `Not tested: ${list}.`,
  note: (subjects: number, min: number, excluded: string) =>
    `Share of stereo-EEG channel pairs in which single-pulse stimulation evoked a response, pooled over ${subjects} people with epilepsy; a rate is drawn only from pairs tested in at least ${min} people. ${excluded} pairs the authors excluded as artefact or noise are not counted. Not measured in this brain; both hemispheres show the same values.`,
  basisContacts: (label: string, share: string, channels: string, subjects: number) =>
    `Takes the authors’ label ${label}: ${share} of the ${channels} cortical channels from ${subjects} ${people(subjects)} that land in this parcel carry it.`,
  basisName: (label: string) => `Matched by name to the authors’ label ${label}.`,
  thalamus:
    'The authors grouped thalamic contacts by position, not by nucleus, so every thalamic structure shows all three sites.',
  dataset: 'Zenodo dataset',
};

export const fr: typeof en = {
  heading: 'Réponses à la stimulation',
  site: 'Site thalamique',
  direction: 'Sens',
  from: 'Stimulé ici',
  to: 'Enregistré ici',
  side: 'Hémisphère',
  same: 'Même côté',
  opposite: 'Côté opposé',
  counts: (responded: string, tested: string, subjects: number) =>
    `${responded} paires sur ${tested} · ${subjects} ${personnes(subjects)}`,
  noRate: 'sans taux',
  none: 'Aucune paire testée de ce côté.',
  untested: (list: string) => `Non testés : ${list}.`,
  note: (subjects: number, min: number, excluded: string) =>
    `Part des paires de canaux de stéréo-EEG où une stimulation à impulsion unique a évoqué une réponse, regroupées sur ${subjects} personnes épileptiques ; un taux n’est tracé que pour les paires testées chez au moins ${min} personnes. Les ${excluded} paires exclues par les auteurs comme artefact ou bruit ne sont pas comptées. Non mesuré dans ce cerveau ; les deux hémisphères montrent les mêmes valeurs.`,
  basisContacts: (label: string, share: string, channels: string, subjects: number) =>
    `Prend l’étiquette ${label} des auteurs : ${share} des ${channels} canaux corticaux de ${subjects} ${personnes(subjects)} situés dans cette parcelle la portent.`,
  basisName: (label: string) => `Associée par son nom à l’étiquette ${label} des auteurs.`,
  thalamus:
    'Les auteurs ont regroupé les contacts thalamiques par position, pas par noyau ; toute structure thalamique montre donc les trois sites.',
  dataset: 'Jeu de données Zenodo',
};
