export const en = {
  title: 'Linked MRI sections',
  subtitle: 'Click to place the crosshair. Arrows move it 1 mm.',
  close: 'Close',
  resize: 'Linked MRI width',
  resizeHint: 'Drag to resize. Double-click for the usual width.',
  savePng: 'Save PNG',
  contrastWindow: 'Window',
  windowCenter: 'Level',
  segmentationOverlay: 'Segmentation overlay',
  resetDisplay: 'Reset display',
  faOpacity: 'FA opacity',
  faFailed: 'The FA map could not be loaded.',
  fa: (value: string) => `FA\u00a0${value}`,
  tracts:
    'Tracts: the streamlines the 3D view draws, within 2 mm of each slice, coloured by direction (red left–right, green front–back, blue up–down). FA: fractional anisotropy of this subject’s own diffusion scan.',
  labels: { sagittal: 'Sagittal', coronal: 'Coronal', axial: 'Axial' },
  planes: 'Section plane',
  positionLabel: (name: string) => `${name} position`,
  sliceAria: (name: string) => `${name} MRI. Click to place crosshair; arrow keys change slice.`,
  sliderAria: (name: string) => `${name} MRI position`,
  note: (anatomy: { individual: boolean }) =>
    `1 mm ${anatomy.individual ? 'single-subject' : 'averaged-template'} grid · surface RAS coordinates. The MRI shows the full volume; cortical atlas areas label the surface only.`,
  readout: (ras: string, name: string, labelId: number) => `${ras} — ${name} (label ${labelId})`,
  asStage:
    'Each plane faces the way its 3D cut does. Neurological: the patient’s left on the screen’s left; radiological: their right there.',
  conventions: { neurological: 'neurological', radiological: 'radiological' },
  conventionMarks: { neurological: 'Neurological', radiological: 'Radiological' },
  seenFrom: {
    right: 'from the right',
    left: 'from the left',
    anterior: 'from the front',
    posterior: 'from behind',
    superior: 'from above',
    inferior: 'from below',
  },
};

export const fr: typeof en = {
  title: 'Coupes IRM liées',
  subtitle: 'Cliquez pour placer le réticule. Les flèches le déplacent de 1 mm.',
  close: 'Fermer',
  resize: 'Largeur de l’IRM liée',
  resizeHint: 'Faites glisser pour redimensionner. Double-cliquez pour la largeur habituelle.',
  savePng: 'Enregistrer PNG',
  contrastWindow: 'Fenêtre',
  windowCenter: 'Niveau',
  segmentationOverlay: 'Superposition de segmentation',
  resetDisplay: 'Réinitialiser l’affichage',
  faOpacity: 'Opacité FA',
  faFailed: 'La carte FA n’a pas pu être chargée.',
  fa: (value: string) => `FA\u00a0${value}`,
  tracts:
    'Faisceaux\u202f: les trajectoires que trace la vue 3D, à moins de 2 mm de chaque coupe, colorées selon leur direction (rouge gauche–droite, vert avant–arrière, bleu haut–bas). FA\u202f: anisotropie fractionnelle de l’image de diffusion de ce même sujet.',
  labels: { sagittal: 'Sagittal', coronal: 'Coronal', axial: 'Axial' },
  planes: 'Plan de coupe',
  positionLabel: (name: string) => {
    const adj = { Sagittal: 'sagittale', Coronal: 'coronale', Axial: 'axiale' }[name] ?? name;
    return `Position ${adj}`;
  },
  sliceAria: (name: string) => {
    const adj = { Sagittal: 'sagittale', Coronal: 'coronale', Axial: 'axiale' }[name] ?? name;
    return `Coupe IRM ${adj}. Cliquez pour placer le réticule ; les touches fléchées changent de coupe.`;
  },
  sliderAria: (name: string) => {
    const adj = { Sagittal: 'sagittale', Coronal: 'coronale', Axial: 'axiale' }[name] ?? name;
    return `Position IRM ${adj}`;
  },
  note: (anatomy: { individual: boolean }) =>
    `Grille 1 mm ${anatomy.individual ? 'd’un sujet unique' : 'd’un gabarit moyenné'} · coordonnées RAS de surface. L’IRM montre le volume entier\u202f; les aires corticales de l’atlas n’étiquettent que la surface.`,
  readout: (ras: string, name: string, labelId: number) =>
    `${ras} — ${name} (étiquette ${labelId})`,
  asStage:
    'Chaque plan est orienté comme sa coupe 3D. Neurologique\u202f: la gauche du patient à gauche de l’écran\u202f; radiologique\u202f: sa droite.',
  conventions: { neurological: 'neurologique', radiological: 'radiologique' },
  conventionMarks: { neurological: 'Neurologique', radiological: 'Radiologique' },
  seenFrom: {
    right: 'depuis la droite',
    left: 'depuis la gauche',
    anterior: 'depuis l’avant',
    posterior: 'depuis l’arrière',
    superior: 'depuis le haut',
    inferior: 'depuis le bas',
  },
};
