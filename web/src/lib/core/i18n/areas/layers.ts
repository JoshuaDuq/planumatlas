import type { KeyGround } from '../../../types/index.ts';

const EN_AREAS: Record<KeyGround, string> = {
  tissue: 'Tissue-coloured areas',
  scan: 'Areas where the scan shows',
  grey: 'Grey areas',
};
const FR_AREAS: Record<KeyGround, string> = {
  tissue: 'Les aires couleur de tissu',
  scan: 'Les aires où l’examen apparaît',
  grey: 'Les aires grises',
};

// BigBrain's cortical layers: the region sheet's section and the stage key.
export const en = {
  heading: 'Layers (one histological brain)',
  // The closed section's quiet value: layer IV's share, formatted.
  headingValue: (share: string) => `IV ${share}`,
  tableCaption:
    'Each layer’s share of the cortex’s thickness in this parcel, and the cells counted in it where its area was sampled',
  columns: {
    layer: 'Layer',
    share: 'Share of thickness',
    cells: 'Cells per (0.1 mm)³',
  },
  patches: (count: number, area: string) =>
    `Cells: the mean over ${count} image patches of ${area} cut from the same brain, every cell body counted, not neurons alone.`,
  paint: 'Paint layer IV across the cortex',
  shown: 'On the brain: layer IV’s share of the cortex’s thickness, from BigBrain.',
  note: 'BigBrain’s layers: one brain, a man of 65 examined post mortem, whose six layers a neural network segmented, 83% of points in the right layer. They are shown at the matching place, by registration and by this parcel’s name; nothing here is measured in this brain.',
  basis:
    'A share is the layer’s mean thickness over the parcel divided by the six layers’ sum, so the tissue’s shrinkage does not change it.',
  failed: 'The layers could not be downloaded.',
  retry: 'Retry',
  paper: 'Paper (Wagstyl et al. 2020)',
  collection: 'Layers (BigBrainWarp)',
  cellData: 'Cells (EBRAINS)',
  keyTitle: 'Layer IV’s share of the cortex’s thickness',
  // Numbers arrive formatted; `to` is null for the open top step.
  step: (from: string, to: string | null) => (to ? `${from} to ${to}` : `${from} or more`),
  keyNote: (ground: KeyGround) =>
    `BigBrain, one histological brain; darker is more. ${EN_AREAS[ground]} have no six layers or too little data.`,
};

export const fr: typeof en = {
  heading: 'Couches (un cerveau histologique)',
  headingValue: (share: string) => `IV ${share}`,
  tableCaption:
    'La part de chaque couche dans l’épaisseur du cortex de cette parcelle, et les cellules qui y sont comptées là où son aire a été échantillonnée',
  columns: {
    layer: 'Couche',
    share: 'Part de l’épaisseur',
    cells: 'Cellules par (0,1 mm)³',
  },
  patches: (count: number, area: string) =>
    `Cellules : la moyenne de ${count} images de ${area} découpées dans le même cerveau, chaque corps cellulaire compté, pas seulement les neurones.`,
  paint: 'Peindre la couche IV sur tout le cortex',
  shown: 'Sur le cerveau : la part de la couche IV dans l’épaisseur du cortex, d’après BigBrain.',
  note: 'Les couches de BigBrain : un seul cerveau, celui d’un homme de 65 ans examiné après la mort, dont un réseau de neurones a segmenté les six couches, 83 % des points dans la bonne couche. Elles sont montrées à l’endroit correspondant, par recalage et par le nom de cette parcelle ; rien ici n’est mesuré dans ce cerveau.',
  basis:
    'Une part est l’épaisseur moyenne de la couche sur la parcelle divisée par la somme des six couches, si bien que la rétraction du tissu ne la change pas.',
  failed: 'Les couches n’ont pas pu être téléchargées.',
  retry: 'Réessayer',
  paper: 'Article (Wagstyl et al. 2020)',
  collection: 'Couches (BigBrainWarp)',
  cellData: 'Cellules (EBRAINS)',
  keyTitle: 'Part de la couche IV dans l’épaisseur du cortex',
  step: (from: string, to: string | null) => (to ? `de ${from} à ${to}` : `${from} ou plus`),
  keyNote: (ground: KeyGround) =>
    `BigBrain, un seul cerveau histologique ; plus foncé, plus grande. ${FR_AREAS[ground]} n’ont pas six couches ou trop peu de données.`,
};
