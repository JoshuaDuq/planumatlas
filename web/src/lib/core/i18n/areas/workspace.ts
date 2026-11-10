export const en = {
  modes: {
    anatomy: 'Anatomy',
    functions: 'Functions',
    deficits: 'Deficits',
    circuits: 'Circuits',
    diffusion: 'Tracts',
  },
  tabsAria: 'Explore the atlas',
  panelAria: 'Atlas panel',
  back: (name: string) => `Back to ${name}`,
  path: 'Breadcrumb',
  showInList: (name: string) => `${name}, show in the list`,
  // A list's way on to another tab; the query arrives as typed.
  bridges: {
    anatomy: (count: number, query: string) =>
      `Anatomy: ${count} ${count === 1 ? 'region matches' : 'regions match'} “${query}”`,
    circuits: (count: number, query: string) =>
      `Circuits: ${count} guided ${count === 1 ? 'circuit matches' : 'circuits match'} “${query}”`,
    diffusion: (count: number, query: string) =>
      `Tracts: ${count} tract ${count === 1 ? 'bundle matches' : 'bundles match'} “${query}”`,
  },
};

export const fr: typeof en = {
  modes: {
    anatomy: 'Anatomie',
    functions: 'Fonctions',
    deficits: 'Déficits',
    circuits: 'Circuits',
    diffusion: 'Faisceaux',
  },
  tabsAria: 'Explorer l’atlas',
  panelAria: 'Panneau de l’atlas',
  back: (name: string) => `Retour : ${name}`,
  path: 'Fil d’Ariane',
  showInList: (name: string) => `${name}, afficher dans la liste`,
  bridges: {
    anatomy: (count: number, query: string) =>
      `Anatomie\u202f: ${count} ${count === 1 ? 'région correspond' : 'régions correspondent'} à «\u00a0${query}\u00a0»`,
    circuits: (count: number, query: string) =>
      `Circuits\u202f: ${count} ${count === 1 ? 'circuit guidé correspond' : 'circuits guidés correspondent'} à «\u00a0${query}\u00a0»`,
    diffusion: (count: number, query: string) =>
      `Faisceaux\u202f: ${count} ${count === 1 ? 'faisceau correspond' : 'faisceaux correspondent'} à «\u00a0${query}\u00a0»`,
  },
};
