/** A heading and its paragraphs. */
export type GuideSection = [heading: string, paragraphs: string[]];

export const en = {
  title: 'How to use Planum',
  close: 'Close',
  lead: 'One individual’s brain, reconstructed from MRI, for learning and research. Not clinical anatomy.',
  sections: [
    [
      'The brain',
      [
        'Drag to turn it, scroll or pinch to zoom, and click or tap a region to open it.',
        'The letters at the top right name the anatomical directions: choose one to look from that side, or the centre for the oblique view.',
        'Section cuts the brain on a plane, with its linked MRI slices. Lesion places a sphere and reports what it reaches. Coordinate places a published MNI coordinate. Display sets the cortex, internal anatomy and hemispheres.',
      ],
    ],
    [
      'The top bar',
      [
        'Atlas, Colour and Internal anatomy set what is drawn. Click a caption, or the folded bar, to read what each current choice means.',
      ],
    ],
    [
      'The panel',
      [
        'Anatomy lists every region, across the whole brain or by system. Functions and Deficits paint published evidence on the brain, say what they changed, and offer the way back. Circuits walks through anatomical pathways, landmark by landmark. Tracts shows white-matter bundles reconstructed from diffusion MRI.',
      ],
    ],
    [
      'The medial surface',
      [
        'Show one hemisphere alone (Display, then Hemisphere, or the H key), then look from the other side: the left hemisphere seen from the right shows its inner surface.',
      ],
    ],
  ] as GuideSection[],
  keys: 'Keyboard shortcuts are listed in the settings menu, or press ?.',
};

export const fr: typeof en = {
  title: 'Utiliser Planum',
  close: 'Fermer',
  lead: 'Le cerveau d’une personne, reconstruit par IRM, pour l’apprentissage et la recherche. Ce n’est pas de l’anatomie clinique.',
  sections: [
    [
      'Le cerveau',
      [
        'Faites glisser pour le tourner, utilisez la molette ou pincez pour zoomer, et cliquez ou touchez une région pour l’ouvrir.',
        'Les lettres en haut à droite nomment les directions anatomiques : choisissez-en une pour regarder de ce côté, ou le centre pour la vue oblique.',
        'Coupe sectionne le cerveau selon un plan, avec ses coupes IRM liées. Lésion place une sphère et indique ce qu’elle atteint. Coordonnée place une coordonnée MNI publiée. Affichage règle le cortex, l’anatomie interne et les hémisphères.',
      ],
    ],
    [
      'La barre du haut',
      [
        'Atlas, Couleur et Anatomie interne règlent ce qui est dessiné. Cliquez sur un intitulé, ou sur la barre repliée, pour lire ce que signifie chaque choix actuel.',
      ],
    ],
    [
      'Le panneau',
      [
        'Anatomie liste chaque région, sur tout le cerveau ou par système. Fonctions et Déficits peignent des données publiées sur le cerveau, disent ce qu’ils ont changé et offrent le retour. Circuits parcourt des voies anatomiques, repère par repère. Faisceaux montre des faisceaux de substance blanche reconstruits par IRM de diffusion.',
      ],
    ],
    [
      'La face médiale',
      [
        'Affichez un seul hémisphère (Affichage, puis Hémisphère, ou la touche H), puis regardez depuis l’autre côté : l’hémisphère gauche vu de la droite montre sa face interne.',
      ],
    ],
  ] as GuideSection[],
  keys: 'Les raccourcis clavier sont dans le menu des réglages, ou touche ?.',
};
