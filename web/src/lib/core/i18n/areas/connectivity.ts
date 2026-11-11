// Resting functional connectivity (plan 4.1): the region sheet's section and the stage key.
export const en = {
  heading: 'Functional connectivity',
  // The closed section's quiet value; the note inside gives the group.
  headingValue: 'resting fMRI',
  strongest: 'Strongest correlations',
  paint: 'Paint on the brain',
  shown: (name: string) => `The brain shows resting connectivity with ${name}.`,
  note: (people: number, ages: string) =>
    `Group average of ${people} healthy adults aged ${ages} (Human Connectome Project) at rest: the correlation between each pair of Julich-Brain areas’ BOLD signals. A correlation is not a connection. Values depend on preprocessing; here no global signal was regressed, so nearly every pair correlates positively.`,
  basis:
    'Measured on Julich-Brain’s volumetric map in MNI152 space, not in this brain; each area takes the parcel of its name.',
  dataset: 'Dataset (EBRAINS)',
  paper: 'Paper (Domhof et al. 2021)',
  keyTitle: (name: string) => `Resting connectivity with ${name}`,
  // Numbers arrive formatted; `to` is null for the open top step.
  step: (from: string, to: string | null) =>
    (to ? `r ${from} to ${to}` : `r ≥ ${from}`).replaceAll(' ', ' '),
  keyNote: (floor: string, scan: boolean) =>
    `Group-mean correlation with the outlined area; darker is stronger. ${scan ? 'Areas where the scan shows' : 'Tissue-coloured areas'} fall below r ${floor}, as half of all pairs do.`,
};

export const fr: typeof en = {
  heading: 'Connectivité fonctionnelle',
  headingValue: 'IRMf de repos',
  strongest: 'Corrélations les plus fortes',
  paint: 'Peindre sur le cerveau',
  shown: (name: string) => `Le cerveau montre la connectivité de repos avec ${name}.`,
  note: (people: number, ages: string) =>
    `Moyenne de groupe de ${people} adultes en bonne santé âgés de ${ages} ans (Human Connectome Project), au repos : la corrélation entre les signaux BOLD de chaque paire d’aires de Julich-Brain. Une corrélation n’est pas une connexion. Les valeurs dépendent du prétraitement ; ici, aucun signal global n’a été régressé, si bien que presque toutes les paires sont corrélées positivement.`,
  basis:
    'Mesurée sur la carte volumique de Julich-Brain dans l’espace MNI152, pas dans ce cerveau ; chaque aire prend la parcelle de son nom.',
  dataset: 'Jeu de données (EBRAINS)',
  paper: 'Article (Domhof et al. 2021)',
  keyTitle: (name: string) => `Connectivité de repos avec ${name}`,
  step: (from: string, to: string | null) =>
    (to ? `r de ${from} à ${to}` : `r ≥ ${from}`).replaceAll(' ', ' '),
  keyNote: (floor: string, scan: boolean) =>
    `Corrélation moyenne de groupe avec l’aire entourée ; plus foncé, plus forte. ${scan ? 'Les aires où l’examen apparaît' : 'Les aires couleur de tissu'} sont sous r ${floor}, comme la moitié de toutes les paires.`,
};
