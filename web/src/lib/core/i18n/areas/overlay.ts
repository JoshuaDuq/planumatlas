export const en = {
  intro:
    'Draw a statistical map or mask in an MNI template on this brain. The file is read on this computer and never sent.',
  space: 'Template',
  choose: 'Choose a NIfTI file…',
  another: 'Choose another file…',
  reading: (name: string) => `Reading ${name}…`,
  failed: (name: string) => `${name} could not be shown:`,
  shape: (dims: string, voxel: string) => `${dims} voxels of ${voxel}`,
  range: (low: string, high: string) => `values ${low} to ${high}`,
  mask: 'a mask of 0 and 1',
  reach: (share: string) => `reaches ${share} of the cortex`,
  title: 'Title',
  titleHint: 'Names the map in the key and the saved image.',
  statistic: 'Statistic',
  value: 'Value',
  threshold: 'Threshold',
  thresholdHint:
    'Values whose magnitude is above it are drawn. The map is drawn once a threshold is given; 0 draws every value but zero.',
  max: 'Colours up to',
  invalid: 'Give a threshold of 0 or more, below the top of the scale.',
  opacity: 'Opacity',
  minVoxels: 'Minimum cluster size, voxels',
  minVoxelsHint:
    'Clusters of fewer of the map’s own voxels are neither drawn nor listed, as nilearn’s cluster_threshold.',
  minVoxelsInvalid: 'Give a whole number of voxels, 0 or more.',
  captionMinVoxels: (count: string) => `clusters of ${count} voxels or more`,
  surface: 'Cortex surface',
  surfaces: { pial: 'Pial', mid: 'Mid-thickness', white: 'White' },
  surfaceHint:
    'This brain’s own surfaces, with the same vertices and values: deeper ones open the sulci. A cut draws the pial.',
  captionSurface: (name: string) => `on the ${name.toLowerCase()} surface`,
  show: 'Show on the brain',
  remove: 'Remove',
  caveat:
    'A template-space map carried onto this brain by the template’s registration: its place on this person’s folds, not this person’s data.',
  keyRange: (statistic: string | null, from: string, to: string) =>
    `${statistic ? `${statistic} ` : ''}${from} to ${to}`,
  captionTemplate: (label: string) => `from ${label}`,
  captionUnstated: (label: string) => `from MNI, template not stated, read as ${label}`,
  captionScale: (statistic: string | null, threshold: string, max: string) =>
    `|${statistic ?? 'value'}| > ${threshold}, colours to ${max}`,
  captionOpacity: (share: string) => `opacity ${share}`,
  readout: (title: string, statistic: string | null, value: string) =>
    `${title}: ${statistic ? `${statistic} = ` : ''}${value}`,
  clusters: (count: number) => `Clusters and peaks (${count})`,
  clustersLoading: 'Finding clusters…',
  clustersNone: 'No value passes the threshold.',
  clustersFailed: 'The clusters could not be found.',
  clustersHint:
    'As nilearn’s get_clusters_table, in template millimetres. Choose a peak to place it as a coordinate and see the regions around it on this brain.',
  peak: (label: string, value: string, at: string) => `${label} · ${value} at ${at}`,
  clusterSize: (size: string) => `${size} mm³`,
  morePeaks: (count: number) => `${count} more in the CSV`,
  download: 'Download CSV',
};

export const fr: typeof en = {
  intro:
    'Affichez sur ce cerveau une carte statistique ou un masque dans un gabarit MNI. Le fichier est lu sur cet ordinateur et n’est jamais envoyé.',
  space: 'Gabarit',
  choose: 'Choisir un fichier NIfTI…',
  another: 'Choisir un autre fichier…',
  reading: (name: string) => `Lecture du fichier ${name}…`,
  failed: (name: string) => `${name} n’a pas pu être affiché :`,
  shape: (dims: string, voxel: string) => `${dims} voxels de ${voxel}`,
  range: (low: string, high: string) => `valeurs de ${low} à ${high}`,
  mask: 'un masque de 0 et de 1',
  reach: (share: string) => `couvre ${share} du cortex`,
  title: 'Titre',
  titleHint: 'Nomme la carte dans la légende et l’image enregistrée.',
  statistic: 'Statistique',
  value: 'Valeur',
  threshold: 'Seuil',
  thresholdHint:
    'Les valeurs dont la grandeur le dépasse sont affichées. La carte s’affiche une fois le seuil donné ; 0 affiche toute valeur non nulle.',
  max: 'Couleurs jusqu’à',
  invalid: 'Donnez un seuil de 0 ou plus, sous le haut de l’échelle.',
  opacity: 'Opacité',
  minVoxels: 'Taille minimale des amas, voxels',
  minVoxelsHint:
    'Les amas de moins de voxels de la carte ne sont ni affichés ni listés, comme cluster_threshold de nilearn.',
  minVoxelsInvalid: 'Donnez un nombre entier de voxels, 0 ou plus.',
  captionMinVoxels: (count: string) => `amas de ${count} voxels ou plus`,
  surface: 'Surface du cortex',
  surfaces: { pial: 'Piale', mid: 'Mi-épaisseur', white: 'Blanche' },
  surfaceHint:
    'Les surfaces propres à ce cerveau, aux mêmes sommets et valeurs : les plus profondes ouvrent les sillons. Une coupe affiche la piale.',
  captionSurface: (name: string) => `sur la surface ${name.toLowerCase()}`,
  show: 'Afficher sur le cerveau',
  remove: 'Retirer',
  caveat:
    'Une carte dans l’espace du gabarit, portée sur ce cerveau par le recalage du gabarit : sa place sur les plis de cette personne, pas des données de cette personne.',
  keyRange: (statistic: string | null, from: string, to: string) =>
    `${statistic ? `${statistic} ` : ''}de ${from} à ${to}`,
  captionTemplate: (label: string) => `depuis ${label}`,
  captionUnstated: (label: string) => `depuis MNI, gabarit non précisé, lu comme ${label}`,
  captionScale: (statistic: string | null, threshold: string, max: string) =>
    `|${statistic ?? 'valeur'}| > ${threshold}, couleurs jusqu’à ${max}`,
  captionOpacity: (share: string) => `opacité ${share}`,
  readout: (title: string, statistic: string | null, value: string) =>
    `${title} : ${statistic ? `${statistic} = ` : ''}${value}`,
  clusters: (count: number) => `Amas et pics (${count})`,
  clustersLoading: 'Recherche des amas…',
  clustersNone: 'Aucune valeur ne dépasse le seuil.',
  clustersFailed: 'Les amas n’ont pas pu être trouvés.',
  clustersHint:
    'Comme get_clusters_table de nilearn, en millimètres du gabarit. Choisissez un pic pour le placer comme coordonnée et voir les régions qui l’entourent sur ce cerveau.',
  peak: (label: string, value: string, at: string) => `${label} · ${value} à ${at}`,
  clusterSize: (size: string) => `${size} mm³`,
  morePeaks: (count: number) => `${count} de plus dans le CSV`,
  download: 'Télécharger le CSV',
};
