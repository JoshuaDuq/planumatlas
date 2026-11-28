import { decimal, withUnit } from '../../format.ts';

const megabytes = (bytes: number, unit: 'MB' | 'Mo', lang: 'en' | 'fr') =>
  withUnit(decimal(bytes / 1_048_576, 1, lang), unit, lang);

export const en = {
  navigationHint: 'Drag to rotate · Scroll to zoom · Click to inspect',
  navigationHintTracts: 'Drag to rotate · Scroll to zoom',
  // For a finger rather than a mouse.
  navigationHintTouch: 'Drag to rotate · Pinch to zoom · Tap to inspect',
  navigationHintTractsTouch: 'Drag to rotate · Pinch to zoom',
  // Shown while the model has keyboard focus.
  keyboardHint: '3D view · Arrow keys rotate · + − zoom',
  viewAria: 'Anatomical view',
  // A named view: the orientation gizmo's buttons, and the caption written onto an exported image.
  namedView: (name: string) => `${name} view`,
  sectionTool: 'Section',
  // Add holds the three that bring something onto the brain; its choice is named for a screen reader.
  placeTool: 'Add',
  placeChoice: 'What to add to the brain',
  // Add's tooltip: what it holds, since its one word does not say (2026-11-20 review).
  placeHint: (things: string) => `Add to the brain: ${things}`,
  lesionTool: 'Lesion',
  coordinateTool: 'Coordinate',
  overlayTool: 'Overlay',
  // Add's one line on a phone, whose stage is too narrow for Overlay's controls beside the brain.
  overlayNarrow: 'Overlay, for your own brain map, needs a wider screen.',
  displayTool: 'Display',
  // The stage dock and the orientation gizmo's turn buttons.
  dockLabel: '3D viewer tools',
  orbitGroup: 'Turn the model',
  orbitLeft: 'Turn left',
  orbitRight: 'Turn right',
  orbitUp: 'Turn up',
  orbitDown: 'Turn down',
  // Streamline colour is each segment's local direction: |x| red, |y| green, |z| blue.
  directionKey: {
    title: 'Local streamline direction',
    leftRight: 'Left–right',
    anteriorPosterior: 'Anterior–posterior',
    superiorInferior: 'Superior–inferior',
  },
  // Visually hidden after a stage-key row whose colour is not drawn (WCAG 1.4.1).
  keyAbsent: 'Not shown in this view',
  snapshot: 'Save image (PNG)',
  fullscreen: 'Full screen',
  exitFullscreen: 'Exit full screen',
  snapshotSaved: (file: string) => `Image saved as ${file}.`,
  snapshotSelected: (name: string) => `Selected: ${name}`,
  // Save image's menu: image pixels per pixel of the stage, then the clipboard.
  snapshotAt: (scale: number) => `Save at ${scale}×`,
  copyImage: 'Copy image',
  imageCopied: 'Image copied',
  imageFailed: 'Could not copy the image',
  // An embedded page (embed=1): a still until the reader asks for the brain, and a way out to Planum.
  posterAlt:
    'Still picture of this brain, its regions in colour, with its tracts drawn through them',
  loadBrain: (megabytes: number) => `Load the 3D brain (about ${withUnit(megabytes, 'MB')})`,
  openInPlanum: 'Open in Planum',
  loadingAnatomy: 'Loading anatomy…',
  loadingWithTotal: (l: number, t: number) =>
    `Loading anatomy · ${megabytes(l, 'MB', 'en')} / ${megabytes(t, 'MB', 'en')}`,
  loadingInternal: 'Loading internal anatomy…',
  loadingInternalWithTotal: (l: number, t: number) =>
    `Loading internal anatomy · ${megabytes(l, 'MB', 'en')} / ${megabytes(t, 'MB', 'en')}`,
  progressAria: 'Anatomy download',
  loaded: 'Anatomy loaded.',
  canvasRole: '3D anatomy viewer',
  canvasLabel:
    'Brain model. Drag or use the arrow keys to rotate, Shift and an arrow key to move it, scroll or press plus and minus to zoom, click a region to select.',
  error: 'Something went wrong.',
  retry: 'Retry',
};

export const fr: typeof en = {
  navigationHint: 'Glisser : tourner · Molette : zoom · Clic : inspecter',
  navigationHintTracts: 'Glisser : tourner · Molette : zoom',
  navigationHintTouch: 'Glisser\u202f: tourner · Pincer\u202f: zoom · Toucher\u202f: inspecter',
  navigationHintTractsTouch: 'Glisser\u202f: tourner · Pincer\u202f: zoom',
  keyboardHint: 'Vue 3D · Flèches : tourner · + − : zoom',
  viewAria: 'Vue anatomique',
  namedView: (name: string) => `Vue ${name.toLowerCase()}`,
  sectionTool: 'Coupe',
  placeTool: 'Ajouter',
  placeChoice: 'Quoi ajouter au cerveau',
  placeHint: (things: string) => `Ajouter au cerveau\u202f: ${things}`,
  lesionTool: 'Lésion',
  coordinateTool: 'Coordonnée',
  overlayTool: 'Superposition',
  overlayNarrow:
    'La superposition, pour votre propre carte cérébrale, demande un écran plus large.',
  displayTool: 'Affichage',
  dockLabel: 'Outils du visualiseur 3D',
  orbitGroup: 'Faire pivoter le modèle',
  orbitLeft: 'Tourner à gauche',
  orbitRight: 'Tourner à droite',
  orbitUp: 'Tourner vers le haut',
  orbitDown: 'Tourner vers le bas',
  directionKey: {
    title: 'Direction locale des trajectoires',
    leftRight: 'Gauche–droite',
    anteriorPosterior: 'Antéro-postérieur',
    superiorInferior: 'Supéro-inférieur',
  },
  keyAbsent: 'Absent de cette vue',
  snapshot: 'Enregistrer l’image (PNG)',
  fullscreen: 'Plein écran',
  exitFullscreen: 'Quitter le plein écran',
  snapshotAt: (scale: number) => `Enregistrer en ${scale}×`,
  copyImage: 'Copier l’image',
  imageCopied: 'Image copiée',
  imageFailed: 'Impossible de copier l’image',
  posterAlt: 'Image fixe de ce cerveau, ses régions en couleur, traversées par ses faisceaux',
  loadBrain: (megabytes: number) =>
    `Charger le cerveau en 3D (environ ${withUnit(megabytes, 'Mo', 'fr')})`,
  openInPlanum: 'Ouvrir dans Planum',
  snapshotSaved: (file: string) => `Image enregistrée : ${file}.`,
  snapshotSelected: (name: string) => `Sélection : ${name}`,
  loadingAnatomy: 'Chargement de l’anatomie…',
  loadingWithTotal: (l: number, t: number) =>
    `Chargement de l’anatomie · ${megabytes(l, 'Mo', 'fr')} / ${megabytes(t, 'Mo', 'fr')}`,
  loadingInternal: 'Chargement de l’anatomie interne…',
  loadingInternalWithTotal: (l: number, t: number) =>
    `Chargement de l’anatomie interne · ${megabytes(l, 'Mo', 'fr')} / ${megabytes(t, 'Mo', 'fr')}`,
  progressAria: 'Téléchargement de l’anatomie',
  loaded: 'Anatomie chargée.',
  canvasRole: 'visionneuse anatomique 3D',
  canvasLabel:
    'Modèle du cerveau. Glissez ou utilisez les flèches pour tourner, Maj et une flèche pour le déplacer, défilez ou appuyez sur plus et moins pour zoomer, cliquez sur une région pour la sélectionner.',
  error: 'Une erreur est survenue.',
  retry: 'Réessayer',
};
