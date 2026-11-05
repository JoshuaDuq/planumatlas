const people = (count: number) => (count === 1 ? 'person' : 'people');
const personnes = (count: number) => (count === 1 ? 'personne' : 'personnes');
const implantations = (count: number) => (count === 1 ? 'implantation' : 'implantations');
const areas = (count: number) => (count === 1 ? 'area' : 'areas');
const aires = (count: number) => (count === 1 ? 'aire' : 'aires');

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
  ftractCounts: (tested: string, count: number) =>
    `${tested} pairs · ${count} ${implantations(count)}`,
  within: 'Within this area',
  more: (count: number) => `${count} more ${areas(count)}`,
  ftractRest: (tooFew: number, untested: number) =>
    `Too few pairs or implantations for a rate: ${tooFew} ${areas(tooFew)}. Never tested: ${untested} ${areas(untested)}.`,
  ftractNote: (people: number, minPairs: number, minImplantations: number) =>
    `Share of stimulation–recording pairs in which a single pulse evoked a response (z-scored signal above 5 within 50 ms), aggregated by F-TRACT over ${people} people with epilepsy; a rate needs ${minPairs} pairs from ${minImplantations} implantations. Not measured in this brain; each hemisphere shows its own values.`,
  ftractBasis: (name: string) =>
    `Matched by name to F-TRACT’s Julich-Brain 3.0 area ${name}. F-TRACT placed contacts with Julich-Brain’s volumetric map in MNI152 space, not on this surface.`,
  ftractDataset: 'F-TRACT dataset (EBRAINS)',
  ftractMethod: 'Method (Trebaul et al. 2018)',
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
  ftractCounts: (tested: string, count: number) =>
    `${tested} paires · ${count} ${implantations(count)}`,
  within: 'Dans cette aire',
  more: (count: number) => `${count} ${aires(count)} de plus`,
  ftractRest: (tooFew: number, untested: number) =>
    `Trop peu de paires ou d’implantations pour un taux : ${tooFew} ${aires(tooFew)}. Jamais testées : ${untested} ${aires(untested)}.`,
  ftractNote: (people: number, minPairs: number, minImplantations: number) =>
    `Part des paires stimulation–enregistrement où une impulsion unique a évoqué une réponse (signal en z supérieur à 5 en moins de 50 ms), agrégée par F-TRACT sur ${people} personnes épileptiques ; un taux exige ${minPairs} paires issues de ${minImplantations} implantations. Non mesuré dans ce cerveau ; chaque hémisphère montre ses propres valeurs.`,
  ftractBasis: (name: string) =>
    `Associée par son nom à l’aire ${name} de Julich-Brain 3.0 dans F-TRACT. F-TRACT a situé les contacts avec la carte volumique de Julich-Brain dans l’espace MNI152, pas sur cette surface.`,
  ftractDataset: 'Jeu de données F-TRACT (EBRAINS)',
  ftractMethod: 'Méthode (Trebaul et al. 2018)',
};
