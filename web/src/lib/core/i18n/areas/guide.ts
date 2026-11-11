/** One stop of the tour: what it points at and what it shows are the tour's (features/guide/tour.ts). */
export interface GuideStop {
  id:
    | 'welcome'
    | 'brain'
    | 'directions'
    | 'section'
    | 'linkedMri'
    | 'lesion'
    | 'coordinate'
    | 'overlay'
    | 'medial'
    | 'explode'
    | 'topBar'
    | 'functions'
    | 'deficits'
    | 'circuits'
    | 'tracts'
    | 'settings'
    | 'selectRegion'
    | 'tabs'
    | 'dock';
  title: string;
  body: string;
}

export const en = {
  next: 'Next',
  previous: 'Back',
  done: 'Done',
  close: 'Close the tour',
  skip: 'Skip tour',
  progress: '{{current}} of {{total}}',
  // The last card of a first visit's short tour starts the full one.
  everything: (stops: number) => `See everything (${stops} stops)`,
  // Stops only the first visit's short tour makes (supervisor review 2.3).
  firstVisit: [
    {
      id: 'selectRegion',
      title: 'A region’s detail',
      body: 'A region you open is described here: its side and group, then Focus, Linked MRI and More (Isolate, Hide), what is known about it, and the research data measured on it.',
    },
    {
      id: 'tabs',
      title: 'Five ways in',
      body: 'Anatomy lists every region. Functions and Deficits paint published evidence, Circuits walks through pathways, and Tracts shows white matter from this brain’s own diffusion scan. Each says what it shows; About this data says where it comes from.',
    },
    {
      id: 'dock',
      title: 'Tools on the picture',
      body: 'Section cuts the brain and Display sets what is drawn. Add brings something onto the brain: a lesion of a given size, a published MNI coordinate, or your own map.',
    },
  ] as GuideStop[],
  stops: [
    {
      id: 'welcome',
      title: 'How to use Planum',
      body: 'One individual’s brain, reconstructed from MRI, for learning and research. Not clinical anatomy. The tour opens each feature on the brain, then puts your view back.',
    },
    {
      id: 'brain',
      title: 'The brain',
      body: 'Drag to turn it, scroll or pinch to zoom, and click or tap a region to open it: here the left precentral gyrus, outlined on the brain and described in the panel.',
    },
    {
      id: 'directions',
      title: 'Anatomical directions',
      body: 'The letters name the anatomical directions: choose one to look from that side, as S shows the brain from above, or the centre for the oblique view.',
    },
    {
      id: 'section',
      title: 'Section',
      body: 'Section cuts the brain on a plane, here a coronal one. Drag its slider to move the cut.',
    },
    {
      id: 'linkedMri',
      title: 'Linked MRI',
      body: 'The scan this brain was reconstructed from, in three planes around one crosshair. Click a region on the brain and the crosshair moves to it; click a point on a scan and the brain selects the region there. Drag the panel’s left edge to enlarge it. M opens and closes it.',
    },
    {
      id: 'lesion',
      title: 'Lesion',
      body: 'Lesion places a sphere and reports what it reaches: here 10 mm across the centre of the left precentral gyrus. To try it, open Add, choose Lesion and Places the lesion, then click the brain.',
    },
    {
      id: 'coordinate',
      title: 'Coordinate',
      body: 'Under Add, Coordinate places a published MNI coordinate on this brain and names what lies there: here −38, 44, 26, a left prefrontal stimulation target.',
    },
    {
      id: 'overlay',
      title: 'Overlay',
      body: 'Under Add, Overlay draws your own statistical map or mask, a NIfTI file in an MNI template, on this brain: on the cortex, the deep structures and every cut, with its clusters and peaks. The file is read on this computer and never sent.',
    },
    {
      id: 'medial',
      title: 'The medial surface',
      body: 'Show one hemisphere alone (Display, then Hemisphere, or the H key), then look from the other side: the left hemisphere seen from the right shows its inner surface.',
    },
    {
      id: 'explode',
      title: 'The exploded view',
      body: 'Pull the structures apart (Display, then Exploded view, or the E key): each keeps its measured shape, and the deep anatomy shows between the hemispheres.',
    },
    {
      id: 'topBar',
      title: 'The top bar',
      body: 'Atlas, Colour and Internal anatomy set what is drawn. Click a caption, or the folded bar, to read what each current choice means.',
    },
    {
      id: 'functions',
      title: 'Functions',
      body: 'Functions paints published evidence for a function on the brain, says what it changed, and offers the way back: here language. Its Linked MRI shows the same map on the scan.',
    },
    {
      id: 'deficits',
      title: 'Deficits',
      body: 'Deficits paints the regions that lesion studies tie to a deficit: here aphasia. Its Linked MRI shows them on the scan.',
    },
    {
      id: 'circuits',
      title: 'Circuits',
      body: 'Circuits walks through an anatomical pathway, landmark by landmark: here the visual pathway, starting at the optic chiasm.',
    },
    {
      id: 'tracts',
      title: 'Tracts',
      body: 'Tracts shows white-matter bundles reconstructed from diffusion MRI.',
    },
    {
      id: 'settings',
      title: 'Settings',
      body: 'Language, theme and keyboard shortcuts (or press ?) are here, with Start over and this tour.',
    },
  ] as GuideStop[],
};

export const fr: typeof en = {
  next: 'Suivant',
  previous: 'Retour',
  done: 'Terminé',
  close: 'Fermer la visite',
  skip: 'Passer la visite',
  progress: '{{current}} sur {{total}}',
  everything: (stops: number) => `Tout voir (${stops} étapes)`,
  firstVisit: [
    {
      id: 'selectRegion',
      title: 'Le détail d’une région',
      body: 'Une région ouverte est décrite ici\u202f: son côté et son groupe, puis Cibler, IRM liée et Plus (Isoler, Masquer), ce que l’on sait d’elle et les données de recherche mesurées sur elle.',
    },
    {
      id: 'tabs',
      title: 'Cinq entrées',
      body: 'Anatomie recense chaque région. Fonctions et Déficits peignent des données publiées, Circuits parcourt des voies, et Faisceaux montre la substance blanche tirée de l’IRM de diffusion de ce cerveau. Chacun dit ce qu’il montre\u202f; À propos de ces données dit d’où elles viennent.',
    },
    {
      id: 'dock',
      title: 'Les outils de l’image',
      body: 'Coupe tranche le cerveau et Affichage règle ce qui est tracé. Ajouter apporte quelque chose sur le cerveau\u202f: une lésion de taille donnée, une coordonnée MNI publiée ou votre propre carte.',
    },
  ] as GuideStop[],
  stops: [
    {
      id: 'welcome',
      title: 'Utiliser Planum',
      body: 'Le cerveau d’une personne, reconstruit par IRM, pour l’apprentissage et la recherche. Ce n’est pas de l’anatomie clinique. La visite ouvre chaque fonctionnalité sur le cerveau, puis rétablit votre vue.',
    },
    {
      id: 'brain',
      title: 'Le cerveau',
      body: 'Faites glisser pour le tourner, utilisez la molette ou pincez pour zoomer, et cliquez ou touchez une région pour l’ouvrir : ici le gyrus précentral gauche, souligné sur le cerveau et décrit dans le panneau.',
    },
    {
      id: 'directions',
      title: 'Directions anatomiques',
      body: 'Les lettres nomment les directions anatomiques : choisissez-en une pour regarder de ce côté, comme S montre le cerveau d’en haut, ou le centre pour la vue oblique.',
    },
    {
      id: 'section',
      title: 'Coupe',
      body: 'Coupe sectionne le cerveau selon un plan, ici coronal. Faites glisser son curseur pour déplacer la coupe.',
    },
    {
      id: 'linkedMri',
      title: 'IRM liée',
      body: 'L’examen d’où ce cerveau a été reconstruit, en trois plans autour d’un même réticule. Cliquez une région du cerveau et le réticule s’y place\u202f; cliquez un point d’une coupe et le cerveau sélectionne la région qui s’y trouve. Faites glisser le bord gauche du panneau pour l’agrandir. M l’ouvre et le ferme.',
    },
    {
      id: 'lesion',
      title: 'Lésion',
      body: 'Lésion place une sphère et indique ce qu’elle atteint : ici 10 mm au centre du gyrus précentral gauche. Pour l’essayer, ouvrez Ajouter, choisissez Lésion et Place la lésion, puis cliquez sur le cerveau.',
    },
    {
      id: 'coordinate',
      title: 'Coordonnée',
      body: 'Sous Ajouter, Coordonnée place une coordonnée MNI publiée sur ce cerveau et nomme ce qui s’y trouve : ici −38, 44, 26, une cible de stimulation préfrontale gauche.',
    },
    {
      id: 'overlay',
      title: 'Superposition',
      body: 'Sous Ajouter, Superposition affiche sur ce cerveau votre propre carte statistique ou masque, un fichier NIfTI dans un gabarit MNI : sur le cortex, les structures profondes et chaque coupe, avec ses amas et ses pics. Le fichier est lu sur cet ordinateur et n’est jamais envoyé.',
    },
    {
      id: 'medial',
      title: 'La face médiale',
      body: 'Affichez un seul hémisphère (Affichage, puis Hémisphère, ou la touche H), puis regardez depuis l’autre côté : l’hémisphère gauche vu de la droite montre sa face interne.',
    },
    {
      id: 'explode',
      title: 'La vue éclatée',
      body: 'Écartez les structures (Affichage, puis Vue éclatée, ou la touche E) : chacune garde sa forme mesurée, et l’anatomie profonde apparaît entre les hémisphères.',
    },
    {
      id: 'topBar',
      title: 'La barre du haut',
      body: 'Atlas, Couleur et Anatomie interne règlent ce qui est dessiné. Cliquez sur un intitulé, ou sur la barre repliée, pour lire ce que signifie chaque choix actuel.',
    },
    {
      id: 'functions',
      title: 'Fonctions',
      body: 'Fonctions peint sur le cerveau des données publiées pour une fonction, dit ce qu’elle a changé et offre le retour : ici le langage. Son IRM liée montre la même carte sur l’examen.',
    },
    {
      id: 'deficits',
      title: 'Déficits',
      body: 'Déficits peint les régions que les études lésionnelles associent à un déficit : ici l’aphasie. Son IRM liée les montre sur l’examen.',
    },
    {
      id: 'circuits',
      title: 'Circuits',
      body: 'Circuits parcourt une voie anatomique, repère par repère : ici la voie visuelle, à partir du chiasma optique.',
    },
    {
      id: 'tracts',
      title: 'Faisceaux',
      body: 'Faisceaux montre des faisceaux de substance blanche reconstruits par IRM de diffusion.',
    },
    {
      id: 'settings',
      title: 'Réglages',
      body: 'La langue, le thème et les raccourcis clavier (ou touche ?) sont ici, avec Recommencer et cette visite.',
    },
  ] as GuideStop[],
};
