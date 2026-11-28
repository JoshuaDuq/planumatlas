import type { KeyGround } from '../../../types/index.ts';

// What shows where no highlight is, as the highlight key's note names it.
const EN_GROUND: Record<KeyGround, string> = {
  tissue: 'Tissue-coloured regions',
  scan: 'Regions where the scan shows',
  grey: 'Grey regions',
};
const FR_GROUND: Record<KeyGround, string> = {
  tissue: 'Les régions couleur tissu',
  scan: 'Les régions où l’IRM reste visible',
  grey: 'Les régions grises',
};

export const en = {
  hemisphere: 'Hemisphere',
  // The region's name arrives capitalized, as the inspector titles it.
  both: 'Both',
  left: 'Left',
  right: 'Right',
  internalAnatomy: 'Internal anatomy',
  visibilitySection: 'Anatomy visibility',
  viewAidsSection: 'View aids',
  showCortex: 'Show cortex',
  cortexOpacity: 'Cortex opacity',
  surfaceHint: 'Deeper surfaces open the sulci. A cut draws the pial.',
  showInternal: 'Show internal anatomy',
  showSpinalCord: 'Show spinal cord',
  spinalCordUnavailable: 'No spinal cord is published for this subject.',
  // Also the change list's entry while it is on: no view is prepared exploded.
  explode: 'Exploded view',
  explodeHint: 'Structures keep their measured shape; only their places change.',
  // Also the stage's group of names.
  names: 'Names on the brain',
  namesHint: 'The regions facing you, largest first; zoom in to name smaller ones.',
  // The masthead's Colour options; the field's note gives the full sense.
  surfaceColors: {
    tissue: 'Tissue',
    mri: 'T1 MRI',
    lobe: 'Lobes',
    atlas: 'Regions',
    network: 'Yeo 7 networks',
    'cab-np': 'CAB-NP networks',
    territory: 'Arterial territories',
    striatal: 'Striatal networks',
    cerebellar: 'Cerebellar functions',
    thickness: 'Cortical thickness',
    sulc: 'Sulcal depth',
  },
  // The Colour field's value while a tab paints the brain; it is never offered as a choice.
  paints: {
    function: 'Functions',
    deficit: 'Deficit',
    lesion: 'Lesion',
    highlight: 'Your highlights',
    connectivity: 'Connectivity',
    disorder: 'Disorder',
    layers: 'Layer IV',
  },
  paintTitles: {
    highlight:
      'Set by you: the regions you highlighted, in the colours you chose; your own marks, not data. Choose a colour to replace it.',
    connectivity:
      'Set by a region’s sheet: the outlined area’s resting functional connectivity with every other (group mean of 200 adults). Choose a colour to replace it.',
    disorder:
      'Set by a region’s sheet: one disorder’s case–control differences (ENIGMA consortium) on Desikan-Killiany. Choose a colour to replace it.',
    layers:
      'Set by a region’s sheet: layer IV’s share of the cortex’s thickness in each parcel, from one histological brain (BigBrain). Choose a colour to replace it.',
    function:
      'Set by the Functions tab: functions on the HCP-MMP areas where studies report activation (Neurosynth). Choose a colour to replace it.',
    deficit:
      'Set by the Deficits tab: the regions the open deficit’s findings cite, one colour per finding. Choose a colour to replace it.',
    lesion:
      'Set by the lesion’s report: the territories of the functions it reaches, or the regions its findings cite. Choose a colour to replace it.',
  },
  surfaceColorTitles: {
    tissue: 'Tissue colours, shaded by T1 brightness',
    mri: 'Registered T1 MRI intensity in greyscale · selected region tinted',
    lobe: 'One colour per lobe, as the Anatomy list groups this atlas’s regions; a lobe’s border is a convention',
    atlas: 'Atlas region colours',
    network: 'Functional networks (Yeo 7)',
    'cab-np': 'Functional networks (CAB-NP, 12) on HCP-MMP areas',
    territory:
      'Typical arterial territories from 1,298 stroke patients (Liu et al. 2023), registered onto this brain; not its own vessels',
  },
  resetView: 'Reset view',
  // The display settings the reader changed from the prepared display, as the status bar and Display list them.
  sideShown: { both: 'Both hemispheres', left: 'Left hemisphere', right: 'Right hemisphere' },
  cortexHidden: 'Cortex hidden',
  cortexShown: 'Cortex shown',
  cortexAt: (opacity: string) => `Cortex ${opacity}`,
  cortexOn: (surface: string) => `Cortex on the ${surface.toLowerCase()} surface`,
  internalHidden: 'Internal anatomy hidden',
  internalShown: 'Internal anatomy shown',
  shownCount: (number: number) => (number === 1 ? '1 part shown' : `${number} parts shown`),
  regionIsolated: 'Region isolated',
  focusOn: 'Region focused',
  focusOff: 'Focus off',
  // Not the gizmo's Reset view: the camera, the data and the selection stay.
  resetDisplay: 'Reset display',
  displayReset: 'Display settings reset.',
  startedOver: 'Back to the opening picture.',
  // Spoken after the Display tool's name on a phone, where the status bar is hidden.
  changed: ', settings changed',
  // The stage key of the reader's highlights, and the saved image's caption line, which say they are the reader's.
  // Under a volumetric map's key: the brain's surfaces stay in tissue colour until it is cut.
  mapOnCuts: 'Drawn on cut faces, voxel by voxel.',
  // The cerebellar map is drawn on the cerebellum's own surface too.
  mapOnCerebellum: 'Drawn on the cerebellum and its cut faces, voxel by voxel.',
  // A measure's key: its range, then what the measure is.
  keyRange: (low: string, high: string) => `${low} to ${high}`,
  // Under Yeo's networks' key: the network matrix, a figure of its own.
  networkMatrix: 'Correlation matrix',
  // Another atlas's borders drawn over the cortex: the key names the atlas, its row the line.
  bordersKey: (atlas: string) => `${atlas} borders`,
  bordersLine: 'Where each area ends',
  atlasComparison: 'Atlas comparison',
  bordersFill: (atlas: string) => `Fill · ${atlas}`,
  bordersOverlay: (atlas: string) => `Lines · ${atlas}`,
  removeBorders: 'Remove borders',
  // The pointer's region in each atlas while another's borders are drawn.
  bordersHover: (atlas: string, name: string, other: string, otherName: string) =>
    `${atlas}: ${name} · ${other}: ${otherName}`,
  thicknessNote:
    'Measured on this scan by FreeSurfer. Densely myelinated cortex, as in the primary motor cortex, reads thinner than under the microscope.',
  sulcNote:
    'FreeSurfer’s depth: how far each point moved as the surface was inflated, outward in sulci (red), inward on gyral crowns (blue), around the hemisphere’s mean.',
  highlightKey: {
    title: 'Your highlights',
    note: (ground: KeyGround) =>
      `Regions you highlighted, in the colours you chose: your own marks, not data. ${EN_GROUND[ground]} are not highlighted.`,
    absent: 'An outlined region is not drawn in this view.',
    marks: 'the reader’s own marks, not data',
  },
};

export const fr: typeof en = {
  hemisphere: 'Hémisphère',
  both: 'Les deux',
  left: 'Gauche',
  right: 'Droite',
  internalAnatomy: 'Anatomie interne',
  visibilitySection: 'Anatomie affichée',
  viewAidsSection: 'Aides visuelles',
  showCortex: 'Afficher le cortex',
  cortexOpacity: 'Opacité du cortex',
  surfaceHint: 'Les surfaces plus profondes ouvrent les sillons. Une coupe affiche la piale.',
  showInternal: 'Afficher l’anatomie interne',
  showSpinalCord: 'Afficher la moelle épinière',
  spinalCordUnavailable: 'Aucune moelle épinière n’est publiée pour ce sujet.',
  explode: 'Vue éclatée',
  explodeHint: 'Les structures gardent leur forme mesurée\u202f; seule leur place change.',
  names: 'Noms sur le cerveau',
  namesHint:
    'Les régions tournées vers vous, les plus grandes d’abord\u202f; zoomez pour nommer les plus petites.',
  surfaceColors: {
    tissue: 'Tissu',
    mri: 'IRM T1',
    lobe: 'Lobes',
    atlas: 'Régions',
    network: 'Réseaux Yeo 7',
    'cab-np': 'Réseaux CAB-NP',
    territory: 'Territoires artériels',
    striatal: 'Réseaux striataux',
    cerebellar: 'Fonctions cérébelleuses',
    thickness: 'Épaisseur corticale',
    sulc: 'Profondeur sulcale',
  },
  paints: {
    function: 'Fonctions',
    deficit: 'Déficit',
    lesion: 'Lésion',
    highlight: 'Vos surlignages',
    connectivity: 'Connectivité',
    disorder: 'Trouble',
    layers: 'Couche IV',
  },
  paintTitles: {
    connectivity:
      'Choisi dans la fiche d’une région : la connectivité fonctionnelle de repos de l’aire entourée avec toutes les autres (moyenne de groupe de 200 adultes). Choisissez une couleur pour la remplacer.',
    disorder:
      'Choisi dans la fiche d’une région : les différences patients-témoins d’un trouble (consortium ENIGMA) sur Desikan-Killiany. Choisissez une couleur pour la remplacer.',
    layers:
      'Choisi dans la fiche d’une région : la part de la couche IV dans l’épaisseur du cortex de chaque parcelle, d’après un seul cerveau histologique (BigBrain). Choisissez une couleur pour la remplacer.',
    highlight:
      'Choisi par vous : les régions que vous avez surlignées, dans les couleurs choisies ; vos marques personnelles, pas des données. Choisissez une couleur pour la remplacer.',
    function:
      'Choisi dans l’onglet Fonctions\u202f: fonctions sur les aires HCP-MMP où les études rapportent une activation (Neurosynth). Choisissez une couleur pour la remplacer.',
    deficit:
      'Choisi dans l’onglet Déficits\u202f: les régions citées par les constats du déficit ouvert, une couleur par constat. Choisissez une couleur pour la remplacer.',
    lesion:
      'Choisi dans le rapport de la lésion\u202f: les territoires des fonctions qu’elle atteint, ou les régions citées par ses constats. Choisissez une couleur pour la remplacer.',
  },
  surfaceColorTitles: {
    tissue: 'Couleurs des tissus, nuancées par la luminosité T1',
    mri: 'Intensité IRM T1 recalée en niveaux de gris · région sélectionnée teintée',
    lobe: 'Une couleur par lobe, tel que la liste Anatomie regroupe les régions de cet atlas\u202f; la limite d’un lobe est une convention',
    atlas: 'Couleurs des régions de l’atlas',
    network: 'Réseaux fonctionnels (Yeo 7)',
    'cab-np': 'Réseaux fonctionnels (CAB-NP, 12) sur les aires HCP-MMP',
    territory:
      'Territoires artériels typiques, issus de 1\u202f298 patients victimes d’AVC (Liu et al. 2023), recalés sur ce cerveau\u202f; pas ses propres vaisseaux',
  },
  resetView: 'Réinitialiser la vue',
  sideShown: { both: 'Les deux hémisphères', left: 'Hémisphère gauche', right: 'Hémisphère droit' },
  cortexHidden: 'Cortex masqué',
  cortexShown: 'Cortex affiché',
  cortexAt: (opacity: string) => `Cortex à ${opacity}`,
  cortexOn: (surface: string) => `Cortex sur la surface ${surface.toLowerCase()}`,
  internalHidden: 'Anatomie interne masquée',
  internalShown: 'Anatomie interne affichée',
  shownCount: (number: number) =>
    number === 1 ? '1 partie affichée' : `${number} parties affichées`,
  regionIsolated: 'Région isolée',
  focusOn: 'Ciblage activé',
  focusOff: 'Ciblage désactivé',
  resetDisplay: 'Réinitialiser l’affichage',
  displayReset: 'Réglages d’affichage réinitialisés.',
  startedOver: 'Retour à l’image de départ.',
  changed: ', réglages modifiés',
  mapOnCuts: 'Tracées sur les faces de coupe, voxel par voxel.',
  mapOnCerebellum: 'Tracées sur le cervelet et ses faces de coupe, voxel par voxel.',
  keyRange: (low: string, high: string) => `${low} à ${high}`,
  networkMatrix: 'Matrice de corrélation',
  bordersKey: (atlas: string) => `Limites de ${atlas}`,
  bordersLine: 'Là où chaque aire s’arrête',
  atlasComparison: 'Comparaison d’atlas',
  bordersFill: (atlas: string) => `Couleurs · ${atlas}`,
  bordersOverlay: (atlas: string) => `Contours · ${atlas}`,
  removeBorders: 'Retirer les contours',
  bordersHover: (atlas: string, name: string, other: string, otherName: string) =>
    `${atlas}\u202f: ${name} · ${other}\u202f: ${otherName}`,
  thicknessNote:
    'Mesurée sur cet examen par FreeSurfer. Le cortex très myélinisé, comme le cortex moteur primaire, y paraît plus mince qu’au microscope.',
  sulcNote:
    'Profondeur selon FreeSurfer : le déplacement de chaque point quand la surface est gonflée, vers l’extérieur dans les sillons (rouge), vers l’intérieur sur les crêtes des gyrus (bleu), autour de la moyenne de l’hémisphère.',
  highlightKey: {
    title: 'Vos surlignages',
    note: (ground: KeyGround) =>
      `Les régions que vous avez surlignées, dans les couleurs choisies : vos marques personnelles, pas des données. ${FR_GROUND[ground]} ne sont pas surlignées.`,
    absent: 'Une région cernée n’est pas affichée dans cette vue.',
    marks: 'marques personnelles, pas des données',
  },
};
