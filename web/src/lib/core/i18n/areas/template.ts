/**
 * Wording only the MNI template shows: what an average leaves out, its averaged tracts, and its
 * own space placed without registration. Loaded with that brain alone (`loadTemplateCopy`), off CDMD's first visit (BUILD-15).
 */
export const en = {
  subjectNote:
    'An average of 152 young adults at mean adult size, with an averaged atlas’s tracts and no cerebellar lobules or spinal cord',
  provenance: (scale: string) =>
    `An average of 152 young adults’ MRI, scaled by ${scale} to the mean brain size of the CDMD adults. Averaging smooths its folds and blurs its scan, and it has no cerebellar lobules or spinal cord. Its tracts are an averaged atlas’s (HCP1065), not tracked in it. Coordinates and maps in its own space are placed on it directly, with no registration.`,
  coordinateCaveat:
    'A location on an average brain, placed by scaling alone: not anyone’s own peak, nor what a brain does there.',
  deficitsElsewhere: (count: number) =>
    `${count} more ${count === 1 ? 'profile maps' : 'profiles map'} structures this template does not have, and ${count === 1 ? 'is' : 'are'} on CDMD sub_013 only.`,
  circuitsElsewhere: (count: number) =>
    `${count} more ${count === 1 ? 'circuit needs' : 'circuits need'} tracts or structures this template does not have, and ${count === 1 ? 'is' : 'are'} on CDMD sub_013 only.`,
  anatomy: {
    scope: 'An average of 152 adults’ brains and the atlases drawn on it.',
    shows:
      'Five cortical atlases, Destrieux, Desikan-Killiany, HCP-MMP1.0, Julich-Brain 3.1 and Schaefer 2018, drawn on the template’s pial surface and on cut faces, with a teaching set, FreeSurfer’s aseg and NextBrain inside. Its tracts are an averaged atlas’s, and it has no cerebellar lobules, spinal cord or arousal nuclei.',
    source:
      'The ICBM 152 2009c nonlinear asymmetric template (MNI152NLin2009cAsym), an average of 152 young adults’ MRI, reconstructed with FreeSurfer 8.2 at 0.9 of its size, the mean brain size of the CDMD adults. Destrieux and Desikan-Killiany are its own annotations; HCP-MMP, Julich-Brain and Schaefer are carried from fsaverage through registered spheres.',
    caution:
      'An average, not a person: averaging smooths the folds and blurs small structures, so nobody’s anatomy looks like this. Every segmentation is a model estimate, and clinical accuracy has not been validated.',
  },
  tracts: {
    scope: 'White matter from an averaged atlas, built from 1,065 other people.',
    shows:
      '21 white-matter bundles of a population-averaged atlas, placed on the template by its scale alone, with no registration: the atlas and the template share one space. Colour is local direction: red left–right, green front–back, blue up–down.',
    source:
      'The HCP1065 population-averaged tractography atlas (Yeh 2022; CC BY-SA 4.0), built from the diffusion scans of 1,065 Human Connectome Project young adults. Every fourth streamline is kept, and each is trimmed back into the brain at its ends. The superior longitudinal fasciculus comes in its three parts and the corpus callosum whole.',
    caution:
      'An average over 1,065 people, not tracked in any one brain: nobody’s pathways run exactly here, and an average hides how much they vary. Streamline counts are the atlas’s own density, not axon counts or connection strength. No FA map and no tract profile is published for the template.',
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
    'La moyenne de 152 jeunes adultes à la taille adulte moyenne, avec les faisceaux d’un atlas moyen, sans lobules cérébelleux ni moelle épinière',
  provenance: (scale: string) =>
    `La moyenne des IRM de 152 jeunes adultes, réduite d’un facteur ${scale} à la taille moyenne du cerveau des adultes de CDMD. La moyenne lisse ses plis et brouille son IRM, et il n’a ni lobules cérébelleux ni moelle épinière. Ses faisceaux sont ceux d’un atlas moyen (HCP1065), et n’y ont pas été suivis. Les coordonnées et les cartes dans son propre espace y sont placées directement, sans recalage.`,
  coordinateCaveat:
    'Un emplacement sur un cerveau moyen, placé par une simple mise à l’échelle : ni le pic propre de quelqu’un, ni ce qu’un cerveau fait à cet endroit.',
  deficitsElsewhere: (count: number) =>
    `${count} autres ${count > 1 ? 'profils cartographient' : 'profil cartographie'} des structures que ce gabarit n’a pas, et ne ${count > 1 ? 'sont' : 'est'} que sur CDMD sub_013.`,
  circuitsElsewhere: (count: number) =>
    `${count} autres ${count > 1 ? 'parcours demandent' : 'parcours demande'} des faisceaux ou des structures que ce gabarit n’a pas, et ne ${count > 1 ? 'sont' : 'est'} que sur CDMD sub_013.`,
  anatomy: {
    scope: 'La moyenne des cerveaux de 152 adultes et les atlas tracés dessus.',
    shows:
      'Cinq atlas corticaux, Destrieux, Desikan-Killiany, HCP-MMP1.0, Julich-Brain 3.1 et Schaefer 2018, tracés sur la surface piale du gabarit et sur les faces de coupe, avec à l’intérieur un ensemble pédagogique, l’aseg de FreeSurfer et NextBrain. Ses faisceaux sont ceux d’un atlas moyen, et il n’a ni lobules cérébelleux, ni moelle épinière, ni noyaux de l’éveil.',
    source:
      'Le gabarit ICBM 152 2009c non linéaire asymétrique (MNI152NLin2009cAsym), moyenne des IRM de 152 jeunes adultes, reconstruit avec FreeSurfer 8.2 à 0,9 de sa taille, la taille moyenne du cerveau des adultes de CDMD. Destrieux et Desikan-Killiany sont ses propres annotations ; HCP-MMP, Julich-Brain et Schaefer sont reportés depuis fsaverage par des sphères recalées.',
    caution:
      'Une moyenne, pas une personne : la moyenne lisse les plis et brouille les petites structures, si bien que l’anatomie de personne ne ressemble à ceci. Chaque segmentation est une estimation de modèle, et l’exactitude clinique n’a pas été validée.',
  },
  tracts: {
    scope:
      'La substance blanche d’un atlas moyen, construit à partir de 1\u202f065 autres personnes.',
    shows:
      '21 faisceaux de substance blanche d’un atlas moyen de population, placés sur le gabarit par sa seule mise à l’échelle, sans recalage\u202f: l’atlas et le gabarit partagent un même espace. La couleur suit la direction locale\u202f: rouge gauche–droite, vert avant–arrière, bleu haut–bas.',
    source:
      'L’atlas de tractographie moyen de population HCP1065 (Yeh 2022\u202f; CC BY-SA 4.0), construit à partir des IRM de diffusion de 1\u202f065 jeunes adultes du Human Connectome Project. Une trajectoire sur quatre est conservée, et chacune est raccourcie à ses extrémités pour rester dans le cerveau. Le faisceau longitudinal supérieur y est en trois parties et le corps calleux entier.',
    caution:
      'Une moyenne de 1\u202f065 personnes, qui n’a été suivie dans aucun cerveau\u202f: les voies de personne ne passent exactement ici, et une moyenne cache leur variabilité. Le nombre de trajectoires est la densité propre de l’atlas, et non un nombre d’axones ni la force d’une connexion. Ni carte de FA ni profil de faisceau ne sont publiés pour le gabarit.',
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
