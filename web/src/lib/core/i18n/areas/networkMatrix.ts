// The network matrix dialog's wording, loaded with the dialog rather than with the page (BUILD-15).
const list = (items: string[], and: string) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${and} ${items.at(-1)}`;

export const en = {
  title: 'Resting-state correlation by network',
  about: (people: number, ages: string) =>
    `Schaefer’s 200 cortical parcels, sorted by Yeo’s seven networks, left hemisphere before right within each. Each cell is the correlation of two parcels’ resting fMRI signals, the group mean of ${people} young adults (HCP, ages ${ages}).`,
  loading: 'Loading the matrix…',
  failed: 'The matrix could not be loaded.',
  figure: (count: number) =>
    `Matrix of ${count} by ${count} parcels, sorted by network; the table beside it gives each pair of networks’ mean.`,
  prompt: 'Point at a cell to read its correlation.',
  parcel: (network: string, name: string, side: string) => `${network} ${name}, ${side}`,
  cell: (first: string, second: string, r: string) => `${first} with ${second}: r ${r}`,
  scale: 'Correlation (r)',
  scaleEnds: (top: string) =>
    `Below 0 takes the darkest colour, ${top} and above the lightest; a parcel with itself, the diagonal, is grey.`,
  table: 'Mean correlation between networks',
  tableNote: 'Fisher-z means over each pair of networks’ parcels, a parcel with itself left out.',
  blocks: (apart: string[]) =>
    apart.length
      ? `Each network but ${list(apart, 'and')} correlates more within itself than with any other: its block on the diagonal is the brightest of its row.`
      : 'Each network correlates more within itself than with any other: its block on the diagonal is the brightest of its row.',
  limbic:
    'Limbic parcels lie where fMRI loses signal, in orbitofrontal cortex and the temporal pole, and correlate weakly with everything, themselves included.',
  independent:
    'The networks were drawn from other people’s scans than these correlations, so the blocks are not the networks finding themselves.',
  positive: (share: string) =>
    `Without global signal regression nearly every pair is positive (${share} here). A correlation is not a connection.`,
  dataset: 'Correlations (Domhof et al. 2021)',
  paper: 'Method paper',
  parcels: 'Parcels (Schaefer et al. 2018)',
  save: 'Save PNG',
  saved: 'Saved the matrix as a PNG.',
  sheetTitle: 'Resting-state correlation, Schaefer 200 parcels by Yeo network',
  close: 'Close',
};

export const fr: typeof en = {
  title: 'Corrélation au repos par réseau',
  about: (people: number, ages: string) =>
    `Les 200 parcelles corticales de Schaefer, triées selon les sept réseaux de Yeo, l’hémisphère gauche avant le droit dans chacun. Chaque case est la corrélation des signaux IRMf au repos de deux parcelles, la moyenne de groupe de ${people} jeunes adultes (HCP, ${ages} ans).`,
  loading: 'Chargement de la matrice…',
  failed: 'La matrice n’a pas pu être chargée.',
  figure: (count: number) =>
    `Matrice de ${count} parcelles sur ${count}, triées par réseau ; le tableau voisin donne la moyenne de chaque paire de réseaux.`,
  prompt: 'Pointez une case pour lire sa corrélation.',
  parcel: (network: string, name: string, side: string) => `${network} ${name}, ${side}`,
  cell: (first: string, second: string, r: string) => `${first} avec ${second} : r ${r}`,
  scale: 'Corrélation (r)',
  scaleEnds: (top: string) =>
    `Sous 0, la couleur la plus sombre ; à partir de ${top}, la plus claire ; une parcelle avec elle-même, la diagonale, est grise.`,
  table: 'Corrélation moyenne entre réseaux',
  tableNote:
    'Moyennes en z de Fisher sur les parcelles de chaque paire de réseaux, sans une parcelle avec elle-même.',
  blocks: (apart: string[]) =>
    apart.length
      ? `Chaque réseau sauf ${list(apart, 'et')} est plus corrélé en lui-même qu’avec tout autre : son bloc sur la diagonale est le plus clair de sa ligne.`
      : 'Chaque réseau est plus corrélé en lui-même qu’avec tout autre : son bloc sur la diagonale est le plus clair de sa ligne.',
  limbic:
    'Les parcelles limbiques se trouvent là où l’IRMf perd du signal, dans le cortex orbitofrontal et le pôle temporal, et sont faiblement corrélées avec tout, y compris entre elles.',
  independent:
    'Les réseaux ont été tirés des examens d’autres personnes que ces corrélations : les blocs ne sont pas les réseaux qui se retrouvent eux-mêmes.',
  positive: (share: string) =>
    `Sans régression du signal global, presque toutes les paires sont positives (${share} ici). Une corrélation n’est pas une connexion.`,
  dataset: 'Corrélations (Domhof et al. 2021)',
  paper: 'Article de méthode',
  parcels: 'Parcelles (Schaefer et al. 2018)',
  save: 'Enregistrer en PNG',
  saved: 'Matrice enregistrée en PNG.',
  sheetTitle: 'Corrélation au repos, 200 parcelles de Schaefer par réseau de Yeo',
  close: 'Fermer',
};
