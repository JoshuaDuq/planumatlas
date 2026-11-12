export const en = {
  search: 'Search functions',
  list: 'Functions',
  all: 'All functions',
  allDetail: 'Each area in its strongest core assessment function',
  coverage: (count: number, terms: number) =>
    `${count} ${count === 1 ? 'function, a' : 'functions, each a'} Neurosynth meta-analysis of the activation literature on HCP-MMP areas` +
    (terms
      ? `; searching also finds ${terms} more Neurosynth ${terms === 1 ? 'term or clinical group' : 'terms and clinical groups'}`
      : '') +
    '. A reference map of where studies report activation, not a measure of this brain or of a person’s abilities.',
  noResults:
    'Search a function, task or stimulus, such as “faces” or “reward”, or a clinical group such as “aphasia”.',
  // The study count arrives as words (format.js count).
  term: (term: string, studies: string) =>
    `Activation evidence · Neurosynth term “${term}” · ${studies}`,
  // The atlas arrives as its short name (header.atlasShort): HCP-MMP, or the reader's own where it is painted.
  areas: (areas: number, structures: number, threshold: string, atlas = 'HCP-MMP') =>
    `${areas} ${atlas} ${areas === 1 ? 'area' : 'areas'}` +
    (structures ? ` and ${structures} ${structures === 1 ? 'structure' : 'structures'}` : '') +
    ` at z\u00a0≥\u00a0${threshold}`,
  areasShort: (areas: number, structures: number) =>
    `${areas} ${areas === 1 ? 'area' : 'areas'}` +
    (structures ? `, ${structures} ${structures === 1 ? 'structure' : 'structures'}` : ''),
  none: (threshold: string, atlas = 'HCP-MMP') =>
    `No ${atlas} area or structure reaches z\u00a0${threshold}.`,
  areasHeading: 'Areas and structures, strongest first',
  more: (count: number) => `${count} more ${count === 1 ? 'area' : 'areas'}`,
  openArea: 'Show area',
  overviewHeading: 'Functions',
  lesionHeading: 'Deficits that check this map',
  lesionNote:
    'Share of each cited parcel the map colours, measured on fsaverage. A check of the map against lesion studies, never tuned to pass.',
  loading: (atlas: string) => `Preparing the ${atlas} areas…`,
  failed: (atlas: string) => `The ${atlas} areas could not be shown.`,
  shown: (atlas: string) => `Shown on the ${atlas} areas`,
  lesionsOn: 'Lesion checks are measured on HCP-MMP areas.',
  // The profile's paint threshold (supervisor review 3.2): it changes the paint, the key and the count only.
  paintFrom: 'Paint areas from z ≥',
  paintFromNote: (threshold: string) =>
    `Changes what is painted and counted. The areas listed below, and every region’s list, keep the published z\u00a0≥\u00a0${threshold}.`,
  // The reader's map drawn against this function; numbers arrive formatted.
  mapOverlap: (title: string, threshold: string, inside: string, covered: string) =>
    `${inside} of the cortex where ${title} is above ${threshold} lies in these areas, and it covers ${covered} of their cortex. By surface area on this brain; deep structures are not counted.`,
  mapNowhere: (title: string, threshold: string) =>
    `${title} is above ${threshold} nowhere on the cortex.`,
  mapMeasuring: 'Measuring the overlap with your map…',
  termsHeading: 'Neurosynth terms',
  populationsHeading: 'Neurosynth clinical groups',
  caveat:
    'Where studies of healthy groups report activation: not this brain, and not what damage would impair.',
  consistencyNote:
    'Colour reflects the consistency of reported activation in studies using the map’s term. It does not mean a region serves only that function or that damage there necessarily causes a deficit.',
  // Said of the overview alone: a single function's map is one term's.
  overviewNote: 'The overview combines several term maps.',
  compare: 'Compare',
  compareCancel: 'Cancel',
  // How many of the two are picked.
  comparePrompt: (picked: number): string =>
    picked ? 'Choose one more function or term' : 'Choose two functions or terms to compare',
  compareOpen: 'Compare',
  compareFull: 'Compare takes two. Uncheck one to swap it.',
  // The share arrives as `areasShort` words.
  both: (areas: string, threshold: string) => `Both reach ${areas} at z\u00a0≥\u00a0${threshold}`,
  bothHeading: 'Areas both reach',
  onlyNote: 'Areas the other map does not reach',
  noneShared: (threshold: string) =>
    `The two maps share no area or structure at z\u00a0${threshold}.`,
  noneOnly: 'The other map reaches every area this one does.',
  compareNote:
    'A map’s z grows with the number of studies behind its term, so compare which areas each map reaches, not one map’s z against the other’s.',
  suggest: (name: string) => `Did you mean “${name}”?`,
  // The study count arrives as words (format.js count).
  termDetail: (studies: string, areas: string) => `${studies} · ${areas}`,
  studiesColumn: 'Studies',
  termsMore: (count: number) =>
    `${count} more ${count === 1 ? 'term matches' : 'terms match'}; type more to narrow the list.`,
  termCaveat:
    'A Neurosynth term, not a curated function: chosen for naming a function, task or stimulus, but its map was not checked against what it names or against lesion studies.',
  populationCaveat:
    'A clinical group: its studies mostly compare people with the condition with healthy people. The map shows where they report activation, not where damage causes the condition.',
  // The term arrives as Neurosynth's English.
  neurosynthOpen: (term: string) => `Open “${term}” on Neurosynth`,
  neurosynthNote:
    'Neurosynth.org’s uniformity-test map is the one closest to Planum’s. The site thresholds it at an expected FDR of 0.01; Planum paints the unthresholded map averaged per area, so the two differ.',
  // The selected region's functions, first in the list (supervisor review 1.1).
  reportedHere: 'Reported here',
  reportedNote:
    'Studies of these functions report activation here. That does not make the region specific to them.',
  noneHere: (threshold: string) => `No function reaches z\u00a0${threshold} here.`,
  lesionBridgeHeading: 'Lesion evidence',
  // The query arrives as typed.
  deficitBridge: (count: number, query: string) =>
    `Deficits: ${count} lesion ${count === 1 ? 'profile matches' : 'profiles match'} “${query}”`,
  results: (functions: number, terms: number) =>
    functions + terms
      ? [
          functions && `${functions} ${functions === 1 ? 'function' : 'functions'}`,
          terms && `${terms} Neurosynth ${terms === 1 ? 'term' : 'terms'}`,
        ]
          .filter(Boolean)
          .join(' and ')
      : 'No match',
};

export const fr: typeof en = {
  search: 'Rechercher une fonction',
  list: 'Fonctions',
  all: 'Toutes les fonctions',
  allDetail: 'Chaque aire dans la plus forte des fonctions de base de l’évaluation',
  coverage: (count: number, terms: number) =>
    `${count} ${count > 1 ? 'fonctions, chacune une' : 'fonction, une'} méta-analyse Neurosynth de la littérature d’activation sur les aires HCP-MMP` +
    (terms
      ? `\u202f; la recherche trouve aussi ${terms} ${terms > 1 ? 'autres termes et groupes cliniques' : 'autre terme ou groupe clinique'} Neurosynth`
      : '') +
    '. Une carte de référence des activations rapportées par les études, et non une mesure de ce cerveau ni des capacités d’une personne.',
  noResults:
    'Cherchez une fonction, une tâche ou un stimulus, comme «\u00a0faces\u00a0» ou «\u00a0reward\u00a0», ou un groupe clinique comme «\u00a0aphasia\u00a0».',
  term: (term: string, studies: string) =>
    `Données d’activation · terme Neurosynth «\u00a0${term}\u00a0» · ${studies}`,
  areas: (areas: number, structures: number, threshold: string, atlas = 'HCP-MMP') =>
    `${areas} ${areas === 1 ? 'aire' : 'aires'} ${atlas}` +
    (structures ? ` et ${structures} ${structures === 1 ? 'structure' : 'structures'}` : '') +
    ` à z\u00a0≥\u00a0${threshold}`,
  areasShort: (areas: number, structures: number) =>
    `${areas} ${areas === 1 ? 'aire' : 'aires'}` +
    (structures ? `, ${structures} ${structures === 1 ? 'structure' : 'structures'}` : ''),
  none: (threshold: string, atlas = 'HCP-MMP') =>
    `Aucune aire ${atlas} ni structure n’atteint z\u00a0${threshold}.`,
  areasHeading: 'Aires et structures, de la plus forte à la plus faible',
  more: (count: number) => `${count} ${count === 1 ? 'autre aire' : 'autres aires'}`,
  openArea: 'Afficher l’aire',
  overviewHeading: 'Fonctions',
  lesionHeading: 'Déficits qui vérifient cette carte',
  lesionNote:
    'Part de chaque parcelle citée que la carte colore, mesurée sur fsaverage. Une vérification de la carte par les études lésionnelles, jamais ajustée pour réussir.',
  loading: (atlas: string) => `Préparation des aires ${atlas}…`,
  failed: (atlas: string) => `Les aires ${atlas} n’ont pas pu être affichées.`,
  shown: (atlas: string) => `Affichée sur les aires ${atlas}`,
  lesionsOn: 'Les vérifications lésionnelles sont mesurées sur les aires HCP-MMP.',
  paintFrom: 'Peindre les aires à partir de z ≥',
  paintFromNote: (threshold: string) =>
    `Change ce qui est peint et compté. Les aires listées ci-dessous, et la liste de chaque région, gardent le seuil publié z\u00a0≥\u00a0${threshold}.`,
  mapOverlap: (title: string, threshold: string, inside: string, covered: string) =>
    `${inside} du cortex où ${title} dépasse ${threshold} se trouve dans ces aires, et la carte couvre ${covered} de leur cortex. Par surface sur ce cerveau\u202f; les structures profondes ne sont pas comptées.`,
  mapNowhere: (title: string, threshold: string) =>
    `${title} ne dépasse ${threshold} nulle part sur le cortex.`,
  mapMeasuring: 'Mesure du recouvrement avec votre carte…',
  termsHeading: 'Termes Neurosynth',
  populationsHeading: 'Groupes cliniques Neurosynth',
  caveat:
    'Là où les études de groupes en bonne santé rapportent une activation\u202f: ni ce cerveau, ni ce qu’une lésion altérerait.',
  consistencyNote:
    'La couleur reflète la constance des activations rapportées dans les études utilisant le terme de la carte. Elle ne signifie pas qu’une région sert uniquement cette fonction ni qu’une lésion à cet endroit cause nécessairement un déficit.',
  overviewNote: 'La vue d’ensemble combine plusieurs cartes de termes.',
  compare: 'Comparer',
  compareCancel: 'Annuler',
  comparePrompt: (picked: number) =>
    picked
      ? 'Choisissez encore une fonction ou un terme'
      : 'Choisissez deux fonctions ou termes à comparer',
  compareOpen: 'Comparer',
  compareFull: 'La comparaison en prend deux. Décochez-en une pour la remplacer.',
  both: (areas: string, threshold: string) =>
    `Les deux atteignent ${areas} à z\u00a0≥\u00a0${threshold}`,
  bothHeading: 'Aires atteintes par les deux',
  onlyNote: 'Aires que l’autre carte n’atteint pas',
  noneShared: (threshold: string) =>
    `Les deux cartes ne partagent aucune aire ni structure à z\u00a0${threshold}.`,
  noneOnly: 'L’autre carte atteint toutes les aires de celle-ci.',
  compareNote:
    'Le z d’une carte croît avec le nombre d’études derrière son terme\u202f: comparez les aires que chaque carte atteint, et non le z d’une carte à celui de l’autre.',
  suggest: (name: string) => `Vouliez-vous dire «\u00a0${name}\u00a0»\u202f?`,
  termDetail: (studies: string, areas: string) => `${studies} · ${areas}`,
  studiesColumn: 'Études',
  termsMore: (count: number) =>
    `${count} ${count === 1 ? 'autre terme correspond' : 'autres termes correspondent'}\u202f; précisez la recherche pour réduire la liste.`,
  termCaveat:
    'Un terme Neurosynth, et non une fonction retenue\u202f: choisi parce qu’il désigne une fonction, une tâche ou un stimulus, mais sa carte n’a été vérifiée ni par rapport à ce qu’il désigne ni par des études lésionnelles.',
  populationCaveat:
    'Un groupe clinique\u202f: ses études comparent surtout des personnes atteintes à des personnes en bonne santé. La carte montre où elles rapportent une activation, et non où une lésion cause l’affection.',
  neurosynthOpen: (term: string) => `Ouvrir «\u00a0${term}\u00a0» sur Neurosynth`,
  neurosynthNote:
    'La carte du test d’uniformité de Neurosynth.org est la plus proche de celle de Planum. Le site la seuille à un FDR attendu de 0,01\u202f; Planum peint la carte non seuillée, moyennée par aire\u202f: les deux diffèrent.',
  reportedHere: 'Rapportées ici',
  reportedNote:
    'Les études de ces fonctions rapportent une activation ici. Cela ne signifie pas que la région leur soit propre.',
  noneHere: (threshold: string) => `Aucune fonction n’atteint z\u00a0${threshold} ici.`,
  lesionBridgeHeading: 'Données lésionnelles',
  deficitBridge: (count: number, query: string) =>
    `Déficits\u202f: ${count} ${count === 1 ? 'profil lésionnel correspond' : 'profils lésionnels correspondent'} à «\u00a0${query}\u00a0»`,
  results: (functions: number, terms: number) =>
    functions + terms
      ? [
          functions && `${functions} ${functions === 1 ? 'fonction' : 'fonctions'}`,
          terms && `${terms} ${terms === 1 ? 'terme' : 'termes'} Neurosynth`,
        ]
          .filter(Boolean)
          .join(' et ')
      : 'Aucun résultat',
};
