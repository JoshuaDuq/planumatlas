export const en = {
  // `scan` is true while the T1 scan shows where nothing is painted.
  keyAll: (scan: boolean) =>
    `One colour per finding; a region several findings cite takes the first one’s colour, and ${scan ? 'regions where the scan shows' : 'tissue-coloured regions'} are not cited. Choose a finding to show it alone.`,
  keyOne: (scan: boolean) =>
    `The regions this finding cites; ${scan ? 'regions where the scan shows' : 'tissue-coloured regions'} are not cited.`,
  keyAbsent: 'An outlined finding has no region coloured in this view.',
  keyPicked: 'Only this finding’s regions. Choose it again for every finding.',
};

export const fr: typeof en = {
  keyAll: (scan: boolean) =>
    `Une couleur par constat\u202f; une région citée par plusieurs constats prend la couleur du premier, et ${scan ? 'les régions où l’IRM reste visible' : 'les régions couleur tissu'} ne sont pas citées. Choisissez un constat pour l’afficher seul.`,
  keyOne: (scan: boolean) =>
    `Les régions que cite ce constat\u202f; ${scan ? 'les régions où l’IRM reste visible' : 'les régions couleur tissu'} ne sont pas citées.`,
  keyAbsent: 'Un constat cerné n’a aucune région colorée dans cette vue.',
  keyPicked:
    'Seulement les régions de ce constat. Choisissez-le de nouveau pour tous les constats.',
};
