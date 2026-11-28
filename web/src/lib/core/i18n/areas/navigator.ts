export const en = {
  title: 'Atlas explorer',
  findRegion: 'Find a region',
  clearSearch: 'Clear search',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  downloadTable: 'Download table as CSV',
  tableDownloaded: 'Region table CSV downloaded.',
  searchLabel: 'Search regions',
  searchResults: 'Search results',
  browseAnatomy: 'Browse anatomy',
  cortex: 'Cortex',
  subcortical: 'Subcortical',
  cutOnly: 'On cuts only',
  // Destrieux lobes, HCP-MMP networks and structure systems can share a name.
  groupIn: {
    lobe: (name: string) => `${name} lobe`,
    network: (name: string) => `${name} network`,
    system: (name: string) => `${name} system`,
  },
  scope: 'Browse',
  scopeWhole: 'Whole brain',
  scopeSystem: 'By system',
  system: 'System',
  allSystems: 'All internal structures',
  noMatch: (q: string) => `No match for “${q}”`,
  // Under a list that shows its first rows; the count is every row.
  showAll: (count: number) => `Show all ${count}`,
  noMatchHint:
    'Try another spelling, an abbreviation or a synonym. Symptoms and syndromes are under Deficits.',
  showingCapped: (shown: number, total: string) =>
    `Showing ${shown} of ${total}. Refine the search to narrow it.`,
  matchesInOther: (countText: string, atlas: string) => `${countText} in ${atlas}. `,
  switchAtlas: 'Switch atlas',
  // Matches in another tab, after those in another atlas (U1).
  matchesInTab: (countText: string, tab: string) => `${countText} in ${tab}. `,
  showInTab: (tab: string) => `Show in ${tab}`,
  // An on-screen region found through a part it holds, or a structure it stands in for.
  includes: (name: string) => `includes ${name}`,
  // The heading over the matches another structure set holds, after those on screen.
  alsoIn: (set: string) => `Also in ${set}`,
  rowHiddenAria: (name: string, side: string, reason: string) =>
    `${name}, ${side}: ${reason}. Activate to reveal.`,
  rowUnavailableAria: (name: string, side: string, reason: string) =>
    `${name}, ${side}, not shown: ${reason}.`,
};

export const fr: typeof en = {
  title: 'Explorateur d’atlas',
  findRegion: 'Trouver une région',
  clearSearch: 'Effacer la recherche',
  expandAll: 'Tout déplier',
  collapseAll: 'Tout replier',
  downloadTable: 'Télécharger le tableau en CSV',
  tableDownloaded: 'Fichier CSV du tableau des régions téléchargé.',
  searchLabel: 'Rechercher des régions',
  searchResults: 'Résultats de recherche',
  browseAnatomy: 'Parcourir l’anatomie',
  cortex: 'Cortex',
  subcortical: 'Sous-cortical',
  cutOnly: 'En coupe seulement',
  groupIn: {
    lobe: (name: string) => `Lobe ${name.toLocaleLowerCase('fr')}`,
    network: (name: string) => `Réseau ${name.toLocaleLowerCase('fr')}`,
    system: (name: string) => `Système ${name.toLocaleLowerCase('fr')}`,
  },
  scope: 'Parcourir',
  scopeWhole: 'Cerveau entier',
  scopeSystem: 'Par système',
  system: 'Système',
  allSystems: 'Toutes les structures internes',
  noMatch: (q: string) => `Aucun résultat pour « ${q} »`,
  showAll: (count: number) => `Afficher les ${count}`,
  noMatchHint:
    'Essayez une autre orthographe, une abréviation ou un synonyme. Les symptômes et syndromes sont sous Déficits.',
  showingCapped: (shown: number, total: string) =>
    `Affichage de ${shown} sur ${total}. Affinez la recherche pour restreindre.`,
  matchesInOther: (countText: string, atlas: string) => `${countText} dans ${atlas}. `,
  switchAtlas: 'Changer d’atlas',
  matchesInTab: (countText: string, tab: string) => `${countText} dans l’onglet ${tab}. `,
  showInTab: (tab: string) => `Afficher dans l’onglet ${tab}`,
  includes: (name: string) => `comprend ${name}`,
  alsoIn: (set: string) => `Aussi dans ${set}`,
  rowHiddenAria: (name: string, side: string, reason: string) =>
    `${name}, ${side} : ${reason}. Activer pour afficher.`,
  rowUnavailableAria: (name: string, side: string, reason: string) =>
    `${name}, ${side}, non affiché : ${reason}.`,
};
