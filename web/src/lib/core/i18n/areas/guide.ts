/** One stop of the tour: what it points at and what it shows are the tour's (features/guide/tour.ts). */
export interface GuideStop {
  id:
    | 'welcome'
    | 'turn'
    | 'openRegion'
    | 'regionDetail'
    | 'directions'
    | 'section'
    | 'linkedMri'
    | 'medial'
    | 'explode'
    | 'functions'
    | 'deficits'
    | 'circuits'
    | 'tracts'
    | 'lesion'
    | 'coordinate'
    | 'overlay'
    | 'topBar'
    | 'settings'
    | 'finish';
  title: string;
  body: string;
}

export const en = {
  next: 'Next',
  previous: 'Back',
  done: 'Done',
  close: 'Close the tour',
  skip: 'Skip tour',
  start: 'Start tour',
  // The first visit's last button: the tour hands the brain over.
  explore: 'Start exploring',
  progress: '{{current}} of {{total}}',
  // The first visit's last card goes on with the stops it left out.
  rest: (stops: number) => `See the rest (${stops} stops)`,
  // Above a card that waits for the reader to do what it says, and once they have.
  yourTurn: 'Try it',
  didIt: 'Done',
  // Stops only the first visit makes.
  firstVisit: [
    {
      id: 'finish',
      title: 'Over to you',
      body: 'Each tab is a way in: Anatomy lists every region, Functions and Deficits map published evidence, Circuits walks through pathways and Tracts shows white matter.',
    },
  ] as GuideStop[],
  stops: [
    {
      id: 'welcome',
      title: 'Welcome to Planum',
      body: 'One person’s brain, reconstructed from their MRI and mapped region by region, for learning and research. Not clinical anatomy.',
    },
    {
      id: 'turn',
      title: 'Turn the brain',
      body: 'Drag to turn it. Scroll or pinch to zoom.',
    },
    {
      id: 'openRegion',
      title: 'Open a region',
      body: 'Click or tap any region of the brain.',
    },
    {
      id: 'regionDetail',
      title: 'The region in detail',
      body: 'Where it lies, its size and what is known about it. Focus greys out the rest of the brain.',
    },
    {
      id: 'directions',
      title: 'Look from any side',
      body: 'Choose a letter to look from that side, here S for superior. The centre returns to the oblique view.',
    },
    {
      id: 'section',
      title: 'Cut through it',
      body: 'Section cuts the brain on a plane, here coronal. Drag the slider to move through it.',
    },
    {
      id: 'linkedMri',
      title: 'The scan behind it',
      body: 'The MRI this brain was reconstructed from, in three planes. Click the brain and the crosshair follows; click the scan to select what lies there.',
    },
    {
      id: 'medial',
      title: 'The inner surface',
      body: 'Show one hemisphere and look from the other side to see its inner surface: here the left, from the right. Display › Hemisphere, or H.',
    },
    {
      id: 'explode',
      title: 'Pull it apart',
      body: 'The exploded view moves each structure out whole, in its measured shape, so the deep anatomy shows. Display › Exploded view, or E.',
    },
    {
      id: 'functions',
      title: 'Map a function',
      body: 'Functions paints where studies report activation for a function, here language: evidence pooled from many people, drawn on this brain.',
    },
    {
      id: 'deficits',
      title: 'Map a deficit',
      body: 'Deficits paints the regions that lesion studies tie to a deficit, here aphasia.',
    },
    {
      id: 'circuits',
      title: 'Follow a pathway',
      body: 'Circuits walks through a pathway one landmark at a time: here the visual pathway, from the optic chiasm.',
    },
    {
      id: 'tracts',
      title: 'White matter',
      body: 'Tracts draws white-matter bundles reconstructed from this brain’s own diffusion scan, coloured by direction.',
    },
    {
      id: 'lesion',
      title: 'Place a lesion',
      body: 'Add › Lesion places a sphere and lists what it reaches: here one of 10 mm radius in the left precentral gyrus.',
    },
    {
      id: 'coordinate',
      title: 'Find a coordinate',
      body: 'Add › Coordinate places a published MNI coordinate on this brain and names what lies there: here −38, 44, 26, a left prefrontal stimulation target.',
    },
    {
      id: 'overlay',
      title: 'Bring your own map',
      body: 'Add › Overlay draws your own NIfTI map, in MNI space, on this brain and its cuts. The file never leaves your computer.',
    },
    {
      id: 'topBar',
      title: 'What is drawn',
      body: 'This names the atlas and colours on the brain. Open it to change them or the internal anatomy, each with a note on what it shows.',
    },
    {
      id: 'settings',
      title: 'Settings',
      body: 'Language, theme, keyboard shortcuts (press ?) and Start over are here, with this tour whenever you want it again.',
    },
  ] as GuideStop[],
};

export const fr: typeof en = {
  next: 'Suivant',
  previous: 'Retour',
  done: 'Terminé',
  close: 'Fermer la visite',
  skip: 'Passer la visite',
  start: 'Commencer',
  explore: 'Explorer',
  progress: '{{current}} sur {{total}}',
  rest: (stops: number) => `Voir la suite (${stops} étapes)`,
  yourTurn: 'Essayez',
  didIt: 'Fait',
  firstVisit: [
    {
      id: 'finish',
      title: 'À vous',
      body: 'Chaque onglet est une entrée : Anatomie recense chaque région, Fonctions et Déficits cartographient des données publiées, Circuits parcourt des voies et Faisceaux montre la substance blanche.',
    },
  ] as GuideStop[],
  stops: [
    {
      id: 'welcome',
      title: 'Bienvenue dans Planum',
      body: 'Le cerveau d’une personne, reconstruit à partir de son IRM et cartographié région par région, pour l’apprentissage et la recherche. Ce n’est pas de l’anatomie clinique.',
    },
    {
      id: 'turn',
      title: 'Tourner le cerveau',
      body: 'Faites-le glisser pour le tourner. Molette ou pincement pour zoomer.',
    },
    {
      id: 'openRegion',
      title: 'Ouvrir une région',
      body: 'Cliquez ou touchez une région du cerveau.',
    },
    {
      id: 'regionDetail',
      title: 'La région en détail',
      body: 'Où elle se trouve, sa taille et ce que l’on sait d’elle. Cibler grise le reste du cerveau.',
    },
    {
      id: 'directions',
      title: 'Regarder de tous les côtés',
      body: 'Choisissez une lettre pour regarder de ce côté, ici S pour supérieur. Le centre ramène la vue oblique.',
    },
    {
      id: 'section',
      title: 'Couper le cerveau',
      body: 'Coupe tranche le cerveau selon un plan, ici coronal. Faites glisser le curseur pour le parcourir.',
    },
    {
      id: 'linkedMri',
      title: 'L’examen d’origine',
      body: 'L’IRM d’où ce cerveau a été reconstruit, en trois plans. Cliquez le cerveau et le réticule suit ; cliquez l’examen pour sélectionner ce qui s’y trouve.',
    },
    {
      id: 'medial',
      title: 'La face interne',
      body: 'Affichez un hémisphère et regardez depuis l’autre côté pour voir sa face interne : ici le gauche, vu de la droite. Affichage › Hémisphère, ou H.',
    },
    {
      id: 'explode',
      title: 'Écarter les structures',
      body: 'La vue éclatée déplace chaque structure d’un bloc, dans sa forme mesurée, et l’anatomie profonde apparaît. Affichage › Vue éclatée, ou E.',
    },
    {
      id: 'functions',
      title: 'Cartographier une fonction',
      body: 'Fonctions peint les régions où des études rapportent une activation pour une fonction, ici le langage : des données de nombreuses personnes, tracées sur ce cerveau.',
    },
    {
      id: 'deficits',
      title: 'Cartographier un déficit',
      body: 'Déficits peint les régions que les études lésionnelles associent à un déficit, ici l’aphasie.',
    },
    {
      id: 'circuits',
      title: 'Suivre une voie',
      body: 'Circuits parcourt une voie repère par repère : ici la voie visuelle, à partir du chiasma optique.',
    },
    {
      id: 'tracts',
      title: 'La substance blanche',
      body: 'Faisceaux trace les faisceaux de substance blanche reconstruits à partir de l’IRM de diffusion de ce cerveau, colorés selon leur direction.',
    },
    {
      id: 'lesion',
      title: 'Placer une lésion',
      body: 'Ajouter › Lésion place une sphère et liste ce qu’elle atteint : ici une sphère de 10 mm de rayon dans le gyrus précentral gauche.',
    },
    {
      id: 'coordinate',
      title: 'Trouver une coordonnée',
      body: 'Ajouter › Coordonnée place une coordonnée MNI publiée sur ce cerveau et nomme ce qui s’y trouve : ici −38, 44, 26, une cible de stimulation préfrontale gauche.',
    },
    {
      id: 'overlay',
      title: 'Apporter votre carte',
      body: 'Ajouter › Superposition affiche votre propre carte NIfTI, dans l’espace MNI, sur ce cerveau et ses coupes. Le fichier ne quitte jamais votre ordinateur.',
    },
    {
      id: 'topBar',
      title: 'Ce qui est dessiné',
      body: 'Ceci nomme l’atlas et les couleurs du cerveau. Ouvrez-le pour les changer, ou l’anatomie interne, chacun avec une note sur ce qu’il montre.',
    },
    {
      id: 'settings',
      title: 'Réglages',
      body: 'La langue, le thème, les raccourcis clavier (touche ?) et Recommencer sont ici, avec cette visite quand vous voulez la revoir.',
    },
  ] as GuideStop[],
};
