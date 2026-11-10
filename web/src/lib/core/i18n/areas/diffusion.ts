import { grouped } from '../../format.ts';

export const en = {
  // The status bar's count, as other tabs count the regions drawn.
  bundlesDrawn: (drawn: number, total: number) =>
    `${drawn} of ${total} tract ${total === 1 ? 'bundle' : 'bundles'} drawn`,
  classes: {
    association: 'Association tracts',
    projection: 'Projection tracts',
    commissural: 'Commissural tracts',
  },
  whole: 'Whole',
  brainOpacity: 'Brain outline opacity',
  minimum: 'Minimum length (mm)',
  cortexOpacity: 'Cortex opacity',
  showOverlay: 'Show tracts with anatomy',
  mriOpen: 'MRI with tracts',
  nativeReference: 'Tracts in their own T1 reference brain.',
  nativeCanvas:
    'Reference brain and tracts. Drag or use arrow keys to rotate, scroll or press plus and minus to zoom. Select tract bundles in the side panel.',
  outlineLimit: 'MRI-derived brain outline; no cortical atlas labels on this outline.',
  mriHint: 'The linked MRI uses the same scan, and a cut slices both layers together.',
  metricsScope:
    'Counts and lengths use complete source streamlines after the length filter. Section cuts affect the view only.',
  outlineProvenance: 'Brain outline method and provenance',
  search: 'Search tracts',
  // Only the dataset's own bundles are listed: a tract it does not reconstruct is not a misspelling.
  noMatchHint: (count: number, dataset: string) =>
    `Only the ${count} tract bundles reconstructed in ${dataset} are listed, and none matches this name.`,
  retry: 'Reload reference dataset',
  tryAgain: 'Try again',
  // Spoken, not shown (decision 42 on #4).
  matches: (count: number) => `${count} tract ${count === 1 ? 'bundle' : 'bundles'}`,
  loaded: (name: string) => `Loaded: ${name}`,
  restored: 'Default tracts restored.',
  exported: 'Lengths CSV exported.',
  ready: 'Reference dataset ready.',
  loading: 'Loading reference dataset…',
  restore: 'Restore default tracts',
  exportMetrics: 'Export lengths CSV',
  streamlines: (shown: number, total: number) =>
    shown === total
      ? `${grouped(total)} ${total === 1 ? 'streamline' : 'streamlines'}`
      : `${grouped(shown)} of ${grouped(total)} streamlines`,
  drawnHeading: 'Drawn bundles',
  mean: 'mean',
  range: 'range',
  noShown: 'No streamlines meet this length filter.',
  source: 'Dataset source · CC0',
  about: 'About this data',
  settings: 'Tract display',
  // Keyed by the code of a failure (diffusion/translations.js:56).
  errors: {
    'asset-fetch':
      'The reference data could not be downloaded. Check the connection, then try again.',
    'asset-updated':
      'A reference data file on the server no longer matches this page; Planum has probably been updated. Reload the page to continue.',
    'invalid-data': 'The reference data could not be read.',
    failed: 'The reference data could not be displayed.',
  },
};

export const fr: typeof en = {
  bundlesDrawn: (drawn: number, total: number) =>
    `${drawn} ${drawn > 1 ? 'faisceaux tracés' : 'faisceau tracé'} sur ${total}`,
  classes: {
    association: 'Faisceaux d’association',
    projection: 'Faisceaux de projection',
    commissural: 'Faisceaux commissuraux',
  },
  whole: 'Entier',
  brainOpacity: 'Opacité du contour cérébral',
  minimum: 'Longueur minimale (mm)',
  cortexOpacity: 'Opacité du cortex',
  showOverlay: 'Afficher les faisceaux avec l’anatomie',
  mriOpen: 'IRM avec faisceaux',
  nativeReference: 'Faisceaux dans leur propre cerveau de référence T1.',
  nativeCanvas:
    'Cerveau de référence et faisceaux. Glisser ou utiliser les flèches pour tourner, défiler ou appuyer sur plus et moins pour zoomer. Sélectionner les faisceaux dans le panneau.',
  outlineLimit: 'Contour cérébral dérivé de l’IRM, sans étiquettes corticales sur ce contour.',
  mriHint: 'L’IRM liée utilise la même image, et une coupe tranche les deux couches ensemble.',
  metricsScope:
    'Les nombres et longueurs utilisent les trajectoires sources complètes après le filtre de longueur. Les coupes modifient seulement la vue.',
  outlineProvenance: 'Méthode et provenance du contour cérébral',
  search: 'Rechercher des faisceaux',
  noMatchHint: (count: number, dataset: string) =>
    `Seuls les ${count} faisceaux reconstruits dans ${dataset} sont listés, et aucun ne correspond à ce nom.`,
  retry: 'Recharger les données de référence',
  tryAgain: 'Réessayer',
  matches: (count: number) => `${count} ${count === 1 ? 'faisceau' : 'faisceaux'}`,
  loaded: (name: string) => `Chargé : ${name}`,
  restored: 'Faisceaux initiaux rétablis.',
  exported: 'CSV des longueurs exporté.',
  ready: 'Données de référence prêtes.',
  loading: 'Chargement des données de référence…',
  restore: 'Rétablir les faisceaux initiaux',
  exportMetrics: 'Exporter les longueurs CSV',
  streamlines: (shown: number, total: number) =>
    shown === total
      ? `${grouped(total)} ${total === 1 ? 'trajectoire' : 'trajectoires'}`
      : `${grouped(shown)} sur ${grouped(total)} trajectoires`,
  drawnHeading: 'Faisceaux tracés',
  mean: 'moyenne',
  range: 'étendue',
  noShown: 'Aucune trajectoire ne satisfait ce filtre de longueur.',
  source: 'Source des données · CC0',
  about: 'À propos de ces données',
  settings: 'Affichage des faisceaux',
  errors: {
    'asset-fetch':
      'Les données de référence n’ont pas pu être téléchargées. Vérifiez la connexion, puis réessayez.',
    'asset-updated':
      'Un fichier de données de référence du serveur ne correspond plus à cette page\u202f; Planum a probablement été mis à jour. Rechargez la page pour continuer.',
    'invalid-data': 'Les données de référence n’ont pas pu être lues.',
    failed: 'Les données de référence n’ont pas pu être affichées.',
  },
};
