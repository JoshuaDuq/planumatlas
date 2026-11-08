import { grouped } from '../../format.ts';

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
  series: (count: string, every: string | null) =>
    every ? `${count} volumes, one every ${every}` : `${count} volumes`,
  volume: 'Volume',
  volumeOf: (place: string, count: string, time: string | null) =>
    `${place} of ${count}${time ? ` · ${time}` : ''}`,
  volumeHint:
    'Every volume is drawn at the same threshold and colour scale. Clusters are listed while it is paused.',
  play: 'Play',
  pause: 'Pause',
  keyVolume: (title: string, at: string) => `${title} · ${at}`,
  captionVolume: (place: string, count: string, time: string | null) =>
    `volume ${place} of ${count}${time ? ` at ${time}` : ''}`,
  course: 'Map over time',
  courseIntro: (title: string) =>
    `The mean of ${title} in this region at each volume, before the threshold. Choose a point to draw that volume.`,
  courseCounts: (valued: string, total: string) =>
    `The mean is over the ${valued} of the region’s ${total} whole millimetres where this volume has a value.`,
  courseLoading: 'Reading the region’s volumes…',
  courseFailed: 'The region’s course could not be read.',
  courseNone: 'This region has no solid on the stage to read the map in.',
  courseEmpty: 'The map has no value in this region.',
  courseLabel: (title: string, region: string) => `${title} in ${region} over time`,
  courseValue: (at: string, value: string) => `${at}: ${value}`,
  courseNoValue: 'no value',
  courseTime: 'Time',
  courseValues: 'Values',
  courseMean: (statistic: string | null) => `Mean ${statistic ?? 'value'}`,
  courseValued: 'Millimetres with a value',
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
  settings: 'Map settings',
  everyCluster: 'every cluster',
  settingsLine: (template: string, statistic: string, clusters: string, surface: string) =>
    `${template} · ${statistic} · ${clusters} · ${surface.toLowerCase()} surface`,
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
  unexpected: 'Something unexpected stopped it; the details are in the browser’s console.',
  // Why a file cannot be read or placed, by MapFileError code (core/user-map/map-file-error.ts).
  reasons: {
    header: 'This file ends inside its NIfTI header.',
    pair: 'This is the header of a .hdr/.img pair; save the map as a single .nii file.',
    magic: 'This file is not NIfTI-1: its header has no NIfTI magic.',
    nifti2: 'This is a NIfTI-2 file; save it as NIfTI-1 to open it here.',
    notNifti: 'This file is not a NIfTI image.',
    gzip: 'This .gz file could not be decompressed; it may be truncated or damaged.',
    rank: (rank: number) =>
      `This file is neither a 3-D volume nor a series of them: it has ${rank} ${rank === 1 ? 'dimension' : 'dimensions'}.`,
    emptyAxis: (dims: string) => `This file’s dimensions ${dims} include an empty axis.`,
    dimensions: (dims: string) =>
      `This file’s dimensions are ${dims}; only a series of volumes along the fourth can be shown.`,
    tooManyVolumes: (volumes: number, limit: number) =>
      `This file holds ${grouped(volumes)} volumes; up to ${grouped(limit)} of its size can be shown. Save fewer as their own file.`,
    tooLarge: (dims: string, limit: number) =>
      `This volume is ${dims} voxels, over the limit of ${grouped(limit)}.`,
    storedType: (name: string, code: number) =>
      `This file stores ${name} values (data type ${code}); save the map as float32.`,
    unknownType: (code: number) => `This file’s data type code ${code} is not a NIfTI-1 type.`,
    offset: (offset: number) =>
      `This file’s data offset (vox_offset ${offset}) lies inside its header.`,
    truncated: (needed: number, size: number) =>
      `This file is truncated: its data needs ${grouped(needed)} bytes but the file has ${grouped(size)}.`,
    intercept: (intercept: number) => `This file’s scaling intercept (scl_inter) is ${intercept}.`,
    overflow: (value: number) => `This file holds the value ${value}, beyond the float32 range.`,
    orientation:
      'This file states no orientation (sform and qform codes are 0), so it cannot be placed.',
    affineFinite: 'This file’s affine has a non-finite entry.',
    singular: 'This file’s affine is singular: its voxel axes do not span 3-D space.',
    quaternion: 'This file’s qform quaternion is not a rotation (b² + c² + d² > 1).',
    slice: 'This map is a single slice along one axis; it needs three dimensions.',
    noFinite: 'This map holds no finite values.',
    zeros: 'This map holds only zeros.',
    outside: 'This map does not reach the brain; check the template it is in.',
  },
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
  series: (count: string, every: string | null) =>
    every ? `${count} volumes, un toutes les ${every}` : `${count} volumes`,
  volume: 'Volume',
  volumeOf: (place: string, count: string, time: string | null) =>
    `${place} sur ${count}${time ? ` · ${time}` : ''}`,
  volumeHint:
    'Chaque volume est affiché au même seuil et à la même échelle de couleurs. Les amas sont listés pendant la pause.',
  play: 'Lire',
  pause: 'Pause',
  keyVolume: (title: string, at: string) => `${title} · ${at}`,
  captionVolume: (place: string, count: string, time: string | null) =>
    `volume ${place} sur ${count}${time ? ` à ${time}` : ''}`,
  course: 'Carte dans le temps',
  courseIntro: (title: string) =>
    `La moyenne de ${title} dans cette région à chaque volume, avant le seuil. Choisissez un point pour afficher ce volume.`,
  courseCounts: (valued: string, total: string) =>
    `La moyenne porte sur les ${valued} des ${total} millimètres entiers de la région où ce volume a une valeur.`,
  courseLoading: 'Lecture des volumes de la région…',
  courseFailed: 'Le décours de la région n’a pas pu être lu.',
  courseNone: 'Cette région n’a pas de solide sur la scène où lire la carte.',
  courseEmpty: 'La carte n’a aucune valeur dans cette région.',
  courseLabel: (title: string, region: string) => `${title} dans ${region} au fil du temps`,
  courseValue: (at: string, value: string) => `${at} : ${value}`,
  courseNoValue: 'aucune valeur',
  courseTime: 'Temps',
  courseValues: 'Valeurs',
  courseMean: (statistic: string | null) =>
    `${statistic ?? 'Valeur'} moyen${statistic ? '' : 'ne'}`,
  courseValued: 'Millimètres avec une valeur',
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
  settings: 'Réglages de la carte',
  everyCluster: 'tous les amas',
  settingsLine: (template: string, statistic: string, clusters: string, surface: string) =>
    `${template} · ${statistic} · ${clusters} · surface ${surface.toLowerCase()}`,
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
  unexpected:
    'Une erreur inattendue l’en a empêché ; le détail figure dans la console du navigateur.',
  reasons: {
    header: 'Ce fichier s’arrête au milieu de son en-tête NIfTI.',
    pair: 'Ceci est l’en-tête d’une paire .hdr/.img ; enregistrez la carte en un seul fichier .nii.',
    magic: 'Ce fichier n’est pas au format NIfTI-1 : son en-tête ne porte pas la signature NIfTI.',
    nifti2: 'Ceci est un fichier NIfTI-2 ; enregistrez-le au format NIfTI-1 pour l’ouvrir ici.',
    notNifti: 'Ce fichier n’est pas une image NIfTI.',
    gzip: 'Ce fichier .gz n’a pas pu être décompressé ; il est peut-être tronqué ou endommagé.',
    rank: (rank: number) =>
      `Ce fichier n’est ni un volume 3D ni une série de volumes : il a ${rank} ${rank < 2 ? 'dimension' : 'dimensions'}.`,
    emptyAxis: (dims: string) => `Les dimensions ${dims} de ce fichier comprennent un axe vide.`,
    dimensions: (dims: string) =>
      `Les dimensions de ce fichier sont ${dims} ; seule une série de volumes selon la quatrième peut être affichée.`,
    tooManyVolumes: (volumes: number, limit: number) =>
      `Ce fichier contient ${grouped(volumes)} volumes ; jusqu’à ${grouped(limit)} de cette taille peuvent être affichés. Enregistrez-en moins dans leur propre fichier.`,
    tooLarge: (dims: string, limit: number) =>
      `Ce volume compte ${dims} voxels, au-delà de la limite de ${grouped(limit)}.`,
    storedType: (name: string, code: number) =>
      `Ce fichier stocke des valeurs ${name} (type de données ${code}) ; enregistrez la carte en float32.`,
    unknownType: (code: number) =>
      `Le code de type de données ${code} de ce fichier n’est pas un type NIfTI-1.`,
    offset: (offset: number) =>
      `Le décalage des données de ce fichier (vox_offset ${offset}) tombe dans son en-tête.`,
    truncated: (needed: number, size: number) =>
      `Ce fichier est tronqué : ses données demandent ${grouped(needed)} octets, mais le fichier en compte ${grouped(size)}.`,
    intercept: (intercept: number) =>
      `L’ordonnée à l’origine de la mise à l’échelle (scl_inter) de ce fichier vaut ${intercept}.`,
    overflow: (value: number) =>
      `Ce fichier contient la valeur ${value}, hors de la plage des float32.`,
    orientation:
      'Ce fichier n’indique aucune orientation (codes sform et qform à 0) : il ne peut pas être placé.',
    affineFinite: 'La matrice affine de ce fichier contient une valeur non finie.',
    singular:
      'La matrice affine de ce fichier est singulière : ses axes de voxels n’engendrent pas l’espace 3D.',
    quaternion: 'Le quaternion qform de ce fichier n’est pas une rotation (b² + c² + d² > 1).',
    slice: 'Cette carte n’est qu’une seule coupe selon un axe ; il lui faut trois dimensions.',
    noFinite: 'Cette carte ne contient aucune valeur finie.',
    zeros: 'Cette carte ne contient que des zéros.',
    outside: 'Cette carte n’atteint pas le cerveau ; vérifiez le gabarit dans lequel elle est.',
  },
};
