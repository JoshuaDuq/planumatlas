export const en = {
  spoken: (name: string, side: string) => `Selected: ${name}, ${side}`,
  selectionCleared: (name: string) => `Selection cleared — ${name} is no longer shown.`,
  // A stage click took the place of a region the reader had opened a section of, or scrolled into.
  pickReplaced: (name: string) => `A click on the brain replaced ${name}.`,
  undoPick: 'Undo',
  cabNpAtlasOnly: (atlas: string) =>
    `CAB-NP colours HCP-MMP areas only, so ${atlas} shows its own region colours.`,
  lobesAtlasOnly: (atlas: string) =>
    `${atlas} groups its areas by network, not by lobe, so it shows its own region colours.`,
};

export const fr: typeof en = {
  spoken: (name: string, side: string) => `Sélectionné : ${name}, ${side}`,
  selectionCleared: (name: string) => `Sélection effacée — ${name} n’est plus visible.`,
  pickReplaced: (name: string) => `Un clic sur le cerveau a remplacé ${name}.`,
  undoPick: 'Annuler',
  cabNpAtlasOnly: (atlas: string) =>
    `CAB-NP ne colore que les aires HCP-MMP : ${atlas} affiche donc les couleurs de ses régions.`,
  lobesAtlasOnly: (atlas: string) =>
    `${atlas} regroupe ses aires par réseau, non par lobe : il affiche donc les couleurs de ses régions.`,
};
