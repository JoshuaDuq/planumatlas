/**
 * Wording only the MNI template shows: what an average leaves out, and its own space placed
 * without registration. Loaded with that brain alone (`loadTemplateCopy`), off CDMD's first visit (BUILD-15).
 */
export const en = {
  subjectNote:
    'An average of 152 young adults at mean adult size, with no tracts, cerebellar lobules or spinal cord of its own',
  provenance: (scale: string) =>
    `An average of 152 young adults’ MRI, scaled by ${scale} to the mean brain size of the CDMD adults. Averaging smooths its folds and blurs its scan, and it has no tracts, cerebellar lobules or spinal cord of its own. Coordinates and maps in its own space are placed on it directly, with no registration.`,
  coordinateCaveat:
    'A location on an average brain, placed by scaling alone: not anyone’s own peak, nor what a brain does there.',
  deficitsElsewhere: (count: number) =>
    `${count} more ${count === 1 ? 'profile maps' : 'profiles map'} structures this template does not have, and ${count === 1 ? 'is' : 'are'} on CDMD sub_013 only.`,
  circuitsElsewhere: (count: number) =>
    `${count} more ${count === 1 ? 'circuit needs' : 'circuits need'} tracts or structures this template does not have, and ${count === 1 ? 'is' : 'are'} on CDMD sub_013 only.`,
  anatomy: {
    scope: 'An average of 152 adults’ brains and the atlases drawn on it.',
    shows:
      'Five cortical atlases, Destrieux, Desikan-Killiany, HCP-MMP1.0, Julich-Brain 3.1 and Schaefer 2018, drawn on the template’s pial surface and on cut faces, with a teaching set, FreeSurfer’s aseg and NextBrain inside. It has no tracts, cerebellar lobules, spinal cord or arousal nuclei.',
    source:
      'The ICBM 152 2009c nonlinear asymmetric template (MNI152NLin2009cAsym), an average of 152 young adults’ MRI, reconstructed with FreeSurfer 8.2 at 0.9 of its size, the mean brain size of the CDMD adults. Destrieux and Desikan-Killiany are its own annotations; HCP-MMP, Julich-Brain and Schaefer are carried from fsaverage through registered spheres.',
    caution:
      'An average, not a person: averaging smooths the folds and blurs small structures, so nobody’s anatomy looks like this. Every segmentation is a model estimate, and clinical accuracy has not been validated.',
  },
  coordinate: {
    source:
      'This brain is MNI152NLin2009cAsym itself, so a coordinate in it is placed by scaling it by 0.9, with no registration; an unstated “MNI” is read as MNI152NLin2009cAsym. Other templates are placed only on CDMD sub_013. Talairach is not accepted.',
    caution:
      'The landing is a location on an average brain, not anyone’s peak and not what a brain does there.',
  },
  overlay: {
    source:
      'Your file, read in the browser; it never leaves your computer. A map in MNI152NLin2009cAsym is drawn on this template directly, scaled by 0.9, with no registration.',
    caution:
      'Template space only, and this template’s alone: a map in another template, native space or Talairach lands in the wrong place, and no NIfTI header states which MNI template a map is in. The map is not carried in a link.',
  },
};

export const fr: typeof en = {
  subjectNote:
    'La moyenne de 152 jeunes adultes à la taille adulte moyenne, sans faisceaux, lobules cérébelleux ni moelle épinière qui lui soient propres',
  provenance: (scale: string) =>
    `La moyenne des IRM de 152 jeunes adultes, réduite d’un facteur ${scale} à la taille moyenne du cerveau des adultes de CDMD. La moyenne lisse ses plis et brouille son IRM, et il n’a ni faisceaux, ni lobules cérébelleux, ni moelle épinière qui lui soient propres. Les coordonnées et les cartes dans son propre espace y sont placées directement, sans recalage.`,
  coordinateCaveat:
    'Un emplacement sur un cerveau moyen, placé par une simple mise à l’échelle : ni le pic propre de quelqu’un, ni ce qu’un cerveau fait à cet endroit.',
  deficitsElsewhere: (count: number) =>
    `${count} autres ${count > 1 ? 'profils cartographient' : 'profil cartographie'} des structures que ce gabarit n’a pas, et ne ${count > 1 ? 'sont' : 'est'} que sur CDMD sub_013.`,
  circuitsElsewhere: (count: number) =>
    `${count} autres ${count > 1 ? 'parcours demandent' : 'parcours demande'} des faisceaux ou des structures que ce gabarit n’a pas, et ne ${count > 1 ? 'sont' : 'est'} que sur CDMD sub_013.`,
  anatomy: {
    scope: 'La moyenne des cerveaux de 152 adultes et les atlas tracés dessus.',
    shows:
      'Cinq atlas corticaux, Destrieux, Desikan-Killiany, HCP-MMP1.0, Julich-Brain 3.1 et Schaefer 2018, tracés sur la surface piale du gabarit et sur les faces de coupe, avec à l’intérieur un ensemble pédagogique, l’aseg de FreeSurfer et NextBrain. Il n’a ni faisceaux, ni lobules cérébelleux, ni moelle épinière, ni noyaux de l’éveil.',
    source:
      'Le gabarit ICBM 152 2009c non linéaire asymétrique (MNI152NLin2009cAsym), moyenne des IRM de 152 jeunes adultes, reconstruit avec FreeSurfer 8.2 à 0,9 de sa taille, la taille moyenne du cerveau des adultes de CDMD. Destrieux et Desikan-Killiany sont ses propres annotations ; HCP-MMP, Julich-Brain et Schaefer sont reportés depuis fsaverage par des sphères recalées.',
    caution:
      'Une moyenne, pas une personne : la moyenne lisse les plis et brouille les petites structures, si bien que l’anatomie de personne ne ressemble à ceci. Chaque segmentation est une estimation de modèle, et l’exactitude clinique n’a pas été validée.',
  },
  coordinate: {
    source:
      'Ce cerveau est MNI152NLin2009cAsym lui-même : une coordonnée de cet espace y est placée en la multipliant par 0,9, sans recalage ; un « MNI » sans précision est lu comme MNI152NLin2009cAsym. Les autres gabarits ne sont placés que sur CDMD sub_013. Talairach n’est pas accepté.',
    caution:
      'Le point d’arrivée est un emplacement sur un cerveau moyen, et non le pic de quelqu’un ni ce qu’un cerveau fait à cet endroit.',
  },
  overlay: {
    source:
      'Votre fichier, lu dans le navigateur ; il ne quitte jamais votre ordinateur. Une carte en MNI152NLin2009cAsym est tracée directement sur ce gabarit, multipliée par 0,9, sans recalage.',
    caution:
      'Espace de gabarit seulement, et celui de ce gabarit : une carte dans un autre gabarit, en espace natif ou Talairach tombe au mauvais endroit, et aucun en-tête NIfTI n’indique dans quel gabarit MNI se trouve une carte. La carte n’est pas conservée dans un lien.',
  },
};
