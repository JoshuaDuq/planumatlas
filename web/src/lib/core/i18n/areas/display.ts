export const en = {
  hemisphere: 'Hemisphere',
  // The region's name arrives capitalized, as the inspector titles it.
  both: 'Both',
  left: 'Left',
  right: 'Right',
  internalAnatomy: 'Internal anatomy',
  showCortex: 'Show cortex',
  cortexOpacity: 'Cortex opacity',
  surfaceHint: 'Deeper surfaces open the sulci. A cut draws the pial.',
  showInternal: 'Show internal anatomy',
  showSpinalCord: 'Show spinal cord',
  spinalCordUnavailable: 'No spinal cord is published for this subject.',
  // The masthead's Colour options; the field's note gives the full sense.
  surfaceColors: {
    tissue: 'Tissue',
    mri: 'T1 MRI',
    atlas: 'Regions',
    network: 'Yeo 7 networks',
    'cab-np': 'CAB-NP networks',
    territory: 'Arterial territories',
  },
  // The Colour field's value while a tab paints the brain; it is never offered as a choice.
  paints: { function: 'Functions', deficit: 'Deficit', lesion: 'Lesion' },
  paintTitles: {
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
};

export const fr: typeof en = {
  hemisphere: 'Hémisphère',
  both: 'Les deux',
  left: 'Gauche',
  right: 'Droite',
  internalAnatomy: 'Anatomie interne',
  showCortex: 'Afficher le cortex',
  cortexOpacity: 'Opacité du cortex',
  surfaceHint: 'Les surfaces plus profondes ouvrent les sillons. Une coupe affiche la piale.',
  showInternal: 'Afficher l’anatomie interne',
  showSpinalCord: 'Afficher la moelle épinière',
  spinalCordUnavailable: 'Aucune moelle épinière n’est publiée pour ce sujet.',
  surfaceColors: {
    tissue: 'Tissu',
    mri: 'IRM T1',
    atlas: 'Régions',
    network: 'Réseaux Yeo 7',
    'cab-np': 'Réseaux CAB-NP',
    territory: 'Territoires artériels',
  },
  paints: { function: 'Fonctions', deficit: 'Déficit', lesion: 'Lésion' },
  paintTitles: {
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
};
