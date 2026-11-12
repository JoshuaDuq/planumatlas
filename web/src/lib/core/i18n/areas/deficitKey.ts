import type { KeyGround } from '../../../types/index.ts';

const EN_REGIONS: Record<KeyGround, string> = {
  tissue: 'tissue-coloured regions',
  scan: 'regions where the scan shows',
  grey: 'grey regions',
};
const FR_REGIONS: Record<KeyGround, string> = {
  tissue: 'les régions couleur tissu',
  scan: 'les régions où l’IRM reste visible',
  grey: 'les régions grises',
};

export const en = {
  // `ground` is what shows where nothing is painted.
  keyAll: (ground: KeyGround) =>
    `One colour per finding; a region several findings cite takes the first one’s colour, and ${EN_REGIONS[ground]} are not cited. Choose a finding to show it alone.`,
  keyOne: (ground: KeyGround) =>
    `The regions this finding cites; ${EN_REGIONS[ground]} are not cited.`,
  keyAbsent: 'An outlined finding has no region coloured in this view.',
  keyPicked: 'Only this finding’s regions. Choose it again for every finding.',
};

export const fr: typeof en = {
  keyAll: (ground: KeyGround) =>
    `Une couleur par constat\u202f; une région citée par plusieurs constats prend la couleur du premier, et ${FR_REGIONS[ground]} ne sont pas citées. Choisissez un constat pour l’afficher seul.`,
  keyOne: (ground: KeyGround) =>
    `Les régions que cite ce constat\u202f; ${FR_REGIONS[ground]} ne sont pas citées.`,
  keyAbsent: 'Un constat cerné n’a aucune région colorée dans cette vue.',
  keyPicked:
    'Seulement les régions de ce constat. Choisissez-le de nouveau pour tous les constats.',
};
