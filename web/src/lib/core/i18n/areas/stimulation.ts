const people = (count: number) => (count === 1 ? 'person' : 'people');
const personnes = (count: number) => (count === 1 ? 'personne' : 'personnes');
const implantations = (count: number) => (count === 1 ? 'implantation' : 'implantations');
const areas = (count: number) => (count === 1 ? 'area' : 'areas');
const aires = (count: number) => (count === 1 ? 'aire' : 'aires');
const delays = (count: number) => (count === 1 ? 'delay' : 'delays');
const délais = (count: number) => (count === 1 ? 'délai' : 'délais');

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
  ftractPeak: (delay: string) => `peak ${delay}`,
  delayHeading: 'Peak delay by distance',
  delayPlot: (count: number) =>
    `Peak delay against the distance between centroids, ${count} ${areas(count)}`,
  distanceAxis: 'Distance between centroids, mm',
  delayAxis: 'Peak delay, ms',
  delayNote: (minResponses: number) =>
    `Peak delay: when a response’s first peak reached its maximum, the median over the pairs that responded, given where at least ${minResponses} did. Distance: between the two areas’ centroids in this brain, not between the contacts. A response may pass through more than one synapse, so a delay is not a conduction time along one fibre. MAD: median absolute deviation.`,
  delayUnplotted: (count: number) =>
    `Not plotted, with no distance in this brain: ${count} ${delays(count)} within this area or with an area it does not carry.`,
  noDelays: (minResponses: number) =>
    `No peak delay on this side: F-TRACT gives one only where at least ${minResponses} pairs responded.`,
  delayTable: 'Delays and distances',
  delayTableCaption:
    'Each area’s peak delay, its median absolute deviation and the distance between centroids',
  delayColumns: { area: 'Area', distance: 'Distance, mm', peak: 'Peak, ms', mad: 'MAD, ms' },
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
    `Trop peu de paires ou d’implantations pour un taux : ${tooFew} ${aires(tooFew)}. Jamais testées : ${untested} ${aires(untested)}.`,
  ftractNote: (people: number, minPairs: number, minImplantations: number) =>
    `Part des paires stimulation–enregistrement où une impulsion unique a évoqué une réponse (signal en z supérieur à 5 en moins de 50 ms), agrégée par F-TRACT sur ${people} personnes épileptiques ; un taux exige ${minPairs} paires issues de ${minImplantations} implantations. Non mesuré dans ce cerveau ; chaque hémisphère montre ses propres valeurs.`,
  ftractBasis: (name: string) =>
    `Associée par son nom à l’aire ${name} de Julich-Brain 3.0 dans F-TRACT. F-TRACT a situé les contacts avec la carte volumique de Julich-Brain dans l’espace MNI152, pas sur cette surface.`,
  ftractDataset: 'Jeu de données F-TRACT (EBRAINS)',
  ftractMethod: 'Méthode (Trebaul et al. 2018)',
  ftractPeak: (delay: string) => `pic à ${delay}`,
  delayHeading: 'Délai du pic selon la distance',
  delayPlot: (count: number) =>
    `Délai du pic selon la distance entre centroïdes, ${count} ${aires(count)}`,
  distanceAxis: 'Distance entre centroïdes, mm',
  delayAxis: 'Délai du pic, ms',
  delayNote: (minResponses: number) =>
    `Délai du pic : le moment où le premier pic d’une réponse a atteint son maximum, médiane des paires qui ont répondu, donnée là où au moins ${minResponses} l’ont fait. Distance : entre les centroïdes des deux aires dans ce cerveau, pas entre les contacts. Une réponse peut passer par plus d’une synapse ; un délai n’est donc pas un temps de conduction le long d’une seule fibre. MAD : écart absolu médian.`,
  delayUnplotted: (count: number) =>
    `Non tracés, faute de distance dans ce cerveau : ${count} ${délais(count)} dans cette aire ou avec une aire qu’il ne porte pas.`,
  noDelays: (minResponses: number) =>
    `Aucun délai de pic de ce côté : F-TRACT n’en donne que là où au moins ${minResponses} paires ont répondu.`,
  delayTable: 'Délais et distances',
  delayTableCaption:
    'Le délai du pic de chaque aire, son écart absolu médian et la distance entre centroïdes',
  delayColumns: { area: 'Aire', distance: 'Distance, mm', peak: 'Pic, ms', mad: 'MAD, ms' },
};
