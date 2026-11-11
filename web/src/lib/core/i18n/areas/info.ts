/** "About this data": what each tab and dock tool shows, where its data come from, and its main caution (supervisor review 1.4). Every sentence is taken from the docs/features page its methods link opens. */
export const en = {
  about: 'About this data',
  shows: 'Shows',
  source: 'Source',
  caution: 'Caution',
  anatomy: {
    scope: 'One person’s brain and the atlases drawn on it.',
    shows:
      'Four cortical atlases, Destrieux, HCP-MMP1.0, Julich-Brain 3.1 and Schaefer 2018, drawn on one brain’s own pial surface and on cut faces. The deep anatomy has three levels of detail: a teaching set of 106 solids, FreeSurfer’s aseg and NextBrain.',
    source:
      'The brain is MGH CDMD sub_013, reconstructed with FreeSurfer 8.2. Destrieux is this subject’s own FreeSurfer annotation. HCP-MMP, Julich-Brain and Schaefer are group atlases carried from fsaverage onto this brain through registered spheres.',
    caution:
      'One individual: folds, sizes and asymmetries are not normative. The group atlases’ boundaries are projected estimates, not boundaries measured in this brain. Every segmentation is a model estimate from one 1 mm T1, and clinical accuracy has not been validated.',
  },
  functions: {
    scope: 'Where imaging studies of a function report activation.',
    shows:
      'Each of 70 functions is one Neurosynth term: where studies of it consistently report activation, averaged over each HCP-MMP area and 19 FreeSurfer structures, and over each Julich-Brain and Schaefer area for those regions’ lists. An area belongs to a function when its mean z reaches 3. A search offers 277 further terms.',
    source:
      'Neurosynth version 7, the activation literature of healthy groups. Studies are chosen automatically: a study counts when its abstract uses the term often enough (TF-IDF), whatever task it ran. Each map is fitted on the MNI152 template, averaged per area and painted on this brain’s areas.',
    caution:
      'Activation is neither this brain nor what damage there would impair: lesion evidence is in the Deficits tab. Consistency z grows with the number of studies, so large literatures reach more areas. Signal-dropout cortex (orbitofrontal, anterior temporal) reaches few functions.',
  },
  deficits: {
    scope: 'Lesion evidence: where damage is linked to a deficit.',
    shows:
      '131 acquired adult deficits, each mapped onto the atlas regions that published patient studies associate with it. A profile holds one to six findings, each painted in its own colour. Each finding cites supporting and qualifying studies and states its limitation and how the study’s anatomy became atlas parcels.',
    source:
      'A curated selection of 339 PubMed-indexed studies: lesion-mapping studies, case series, case reports and meta-analyses. 252 of them were extracted from the abstract only. The parcels are atlas labels on one reference brain, not lesion volumes.',
    caution:
      'The literature is selected, not systematically reviewed, and the catalogue is not diagnostic or prognostic. Group associations drawn on one reference brain do not predict an individual patient’s deficit. A whole parcel can be drawn where a study implicated part of it; white matter is left uncoloured.',
  },
  circuits: {
    scope: 'Tours of pathways described in the literature.',
    shows:
      'Five tours of anatomical pathways and loop branches, 25 landmarks in all: vision, memory, motor loop, cerebellar output and corticospinal. Each landmark is a labelled region of this brain’s atlases, framed with 12 mm of surrounding anatomy.',
    source:
      'Each tour cites circuit background separately from the patient studies behind its linked deficit. The 23 references are 19 PubMed articles and 4 chapters of Purves et al., Neuroscience. The corticospinal tour draws the left corticospinal bundle tracked in this subject’s diffusion MRI.',
    caution:
      'Apart from the corticospinal streamlines, the tours teach connections described in the literature and measure nothing in this brain. Atlas labels approximate the structures, and some projections are known from monkey tracing. A deficit study supports a region–deficit association, not the pathway’s connections.',
  },
  tracts: {
    scope: 'White matter tracked in this brain’s own diffusion scan.',
    shows:
      '30 white-matter bundles reconstructed from the diffusion scan of the same person whose anatomy is shown, so streamlines, MRI and surfaces share one scanner frame without registration. Colour is local direction: red left–right, green front–back, blue up–down.',
    source:
      'MGH CDMD sub_013 (CC0). Seventeen bundles come from DIPY tractography segmented by RecoBundles; thirteen (SLF I–III and seven callosal segments) from TractSeg. Every streamline is trimmed back into the brain at its ends.',
    caution:
      'One individual and one 2 mm diffusion scan: bundles are reconstructions, not observed axons. Streamline counts are not axon counts, and lengths do not measure connection strength. The corticospinal streamlines end near the caudal medulla, above the decussation.',
  },
  section: {
    shows:
      'A sagittal, coronal, axial or oblique plane cuts the model, and every closed solid is capped where the plane meets it. Each cap is coloured from a published label volume, chosen independently of the surface atlas.',
    source:
      'The caps are this subject’s own pial, white and structure surfaces. The labels are the subject’s 1 mm FreeSurfer grid or 0.8 mm NextBrain blocks; nothing is re-segmented in the browser.',
    caution:
      'Cut labels are 1 mm (0.8 mm for NextBrain), so thin structures are coarser on a cut than on their surfaces. HCP-MMP, Julich-Brain and Schaefer cut labels are projections of surface labels into the grey-matter ribbon, not volumetric atlases. Shading from the T1 is illustrative.',
  },
  lesion: {
    shows:
      'A sphere of 3 to 30 mm radius placed on the brain or a cut face. The report gives the tissue and regions inside it, ranks the functions and deficit findings whose regions it overlaps, and counts the reconstructed streamlines that pass through it.',
    source:
      'Measured in the browser against this subject’s published 1 mm label volumes, the Functions territories, the Deficits findings’ cited regions and this brain’s tracts.',
    caution:
      'It measures overlap on one brain; it predicts no deficit. A sphere ignores the vascular, white-matter and network shape of real lesions. Function territories are activation maps in healthy people, not lesion–deficit maps.',
  },
  coordinate: {
    shows:
      'A coordinate reported in a named MNI template, placed on this brain and marked with a 5 mm sphere. The report gives each region’s share of the sphere, never a single cortical parcel.',
    source:
      'Each template was registered to CDMD sub_013 with FreeSurfer’s SynthMorph. The templates are MNI152NLin2009cAsym and SPM12 (TPM); an unstated “MNI” is read as MNI152NLin2009cAsym. Talairach is not accepted.',
    caution:
      'The landing is a template location on one brain, not where this person’s peak would be and not what this brain does there. A single-parcel lookup from template space agreed with this brain’s own parcellation for only about 60% of template cortex.',
  },
  overlay: {
    shows:
      'Your own NIfTI map in an MNI template, one volume or a series, drawn on the cortex, the deep surfaces and every cut face with a two-sided colour scale. A cluster table is computed as nilearn’s get_clusters_table computes it.',
    source:
      'Your file, read in the browser; it never leaves your computer. It is carried onto CDMD sub_013 through the inverse of the template’s published registration, the one the Coordinate tool uses.',
    caution:
      'The result is a template map on one person’s folds, not that person’s data. Template space only: a native-space or Talairach map lands in the wrong place, and no NIfTI header states which MNI template a map is in. The map is not carried in a link.',
  },
  display: {
    shows:
      'The colour mode, hemisphere, cortex, internal anatomy, spinal cord and exploded view, and the dissection tools: hide, isolate and Focus. Hiding cortical parcels exposes the subject’s own white surface.',
    source:
      'One set of published meshes of this brain. Sulcal depth, cortical openness and ribbon T1 are baked into every cortical vertex at build time and drive fold shading and tissue colour.',
    caution:
      'The shading is illustrative: T1 brightness, fold shading and tissue colours are not measured optical or histological properties. The exploded view moves each structure whole, and some systems still pass through each other where thin structures thread between them.',
  },
};

export const fr: typeof en = {
  about: 'À propos de ces données',
  shows: 'Ce qui est montré',
  source: 'Source',
  caution: 'Prudence',
  anatomy: {
    scope: 'Le cerveau d’une seule personne et les atlas tracés dessus.',
    shows:
      'Quatre atlas corticaux, Destrieux, HCP-MMP1.0, Julich-Brain 3.1 et Schaefer 2018, tracés sur la surface piale propre à un cerveau et sur les faces de coupe. L’anatomie profonde a trois niveaux de détail\u202f: un ensemble pédagogique de 106 solides, l’aseg de FreeSurfer et NextBrain.',
    source:
      'Le cerveau est MGH CDMD sub_013, reconstruit avec FreeSurfer 8.2. Destrieux est l’annotation FreeSurfer propre à ce sujet. HCP-MMP, Julich-Brain et Schaefer sont des atlas de groupe reportés de fsaverage sur ce cerveau par des sphères recalées.',
    caution:
      'Un seul individu\u202f: ses plis, ses tailles et ses asymétries ne sont pas des normes. Les frontières des atlas de groupe sont des estimations projetées, et non des frontières mesurées dans ce cerveau. Chaque segmentation est une estimation de modèle à partir d’une seule IRM T1 de 1\u00a0mm, et l’exactitude clinique n’a pas été validée.',
  },
  functions: {
    scope: 'Là où les études d’imagerie d’une fonction rapportent une activation.',
    shows:
      'Chacune des 70 fonctions est un terme Neurosynth\u202f: là où ses études rapportent une activation constante, moyennée sur chaque aire HCP-MMP et 19 structures FreeSurfer, et sur chaque aire Julich-Brain et Schaefer pour leurs listes. Une aire appartient à une fonction quand son z moyen atteint 3. La recherche propose 277 autres termes.',
    source:
      'Neurosynth version 7, la littérature d’activation chez des groupes en bonne santé. Les études sont choisies automatiquement\u202f: une étude compte quand son résumé emploie assez souvent le terme (TF-IDF), quelle que soit sa tâche. Chaque carte est calculée sur le gabarit MNI152, moyennée par aire et peinte sur les aires de ce cerveau.',
    caution:
      'Une activation n’est ni ce cerveau ni ce qu’une lésion à cet endroit altérerait\u202f: les données lésionnelles sont dans l’onglet Déficits. Le z de constance croît avec le nombre d’études, si bien que les grandes littératures atteignent plus d’aires. Le cortex à perte de signal (orbitofrontal, temporal antérieur) atteint peu de fonctions.',
  },
  deficits: {
    scope: 'Données lésionnelles\u202f: là où une lésion est liée à un déficit.',
    shows:
      '131 déficits acquis de l’adulte, chacun rapporté sur les régions d’atlas que des études de patients publiées y associent. Un profil réunit une à six observations, chacune peinte dans sa propre couleur. Chaque observation cite des études qui l’appuient ou la nuancent, et indique sa limite et la façon dont l’anatomie de l’étude est devenue des parcelles d’atlas.',
    source:
      'Une sélection choisie de 339 études indexées dans PubMed\u202f: cartographies lésionnelles, séries de cas, études de cas et méta-analyses. 252 d’entre elles ont été extraites du seul résumé. Les parcelles sont des étiquettes d’atlas sur un cerveau de référence, et non des volumes lésionnels.',
    caution:
      'La littérature est sélectionnée, sans revue systématique, et le catalogue n’est ni diagnostique ni pronostique. Des associations de groupe tracées sur un seul cerveau de référence ne prédisent pas le déficit d’un patient individuel. Une parcelle peut être tracée entière là où une étude n’en impliquait qu’une partie\u202f; la substance blanche reste sans couleur.',
  },
  circuits: {
    scope: 'Des parcours de voies décrites dans la littérature.',
    shows:
      'Cinq parcours de voies anatomiques et de branches de boucles, 25 repères en tout\u202f: vision, mémoire, boucle motrice, sortie cérébelleuse et voie corticospinale. Chaque repère est une région étiquetée des atlas de ce cerveau, cadrée avec 12\u00a0mm d’anatomie environnante.',
    source:
      'Chaque parcours cite le contexte du circuit à part des études de patients qui fondent son déficit lié. Les 23 références sont 19 articles PubMed et 4 chapitres de Purves et al., Neuroscience. Le parcours corticospinal trace le faisceau corticospinal gauche suivi dans l’IRM de diffusion de ce sujet.',
    caution:
      'Hormis les trajectoires corticospinales, les parcours enseignent des connexions décrites dans la littérature et ne mesurent rien dans ce cerveau. Les étiquettes d’atlas approchent les structures, et certaines projections ne sont connues que par traçage chez le singe. Une étude de déficit appuie une association région–déficit, et non les connexions de la voie.',
  },
  tracts: {
    scope: 'La substance blanche suivie dans l’IRM de diffusion de ce cerveau.',
    shows:
      '30 faisceaux de substance blanche reconstruits à partir de l’IRM de diffusion de la personne dont l’anatomie est montrée\u202f: trajectoires, IRM et surfaces partagent un même repère du scanner, sans recalage. La couleur suit la direction locale\u202f: rouge gauche–droite, vert avant–arrière, bleu haut–bas.',
    source:
      'MGH CDMD sub_013 (CC0). Dix-sept faisceaux viennent d’une tractographie DIPY segmentée par RecoBundles\u202f; treize (SLF I–III et sept segments calleux) de TractSeg. Chaque trajectoire est raccourcie à ses extrémités pour rester dans le cerveau.',
    caution:
      'Un seul individu et une seule IRM de diffusion à 2\u00a0mm\u202f: les faisceaux sont des reconstructions, et non des axones observés. Le nombre de trajectoires n’est pas un nombre d’axones, et leur longueur ne mesure pas la force d’une connexion. Les trajectoires corticospinales s’arrêtent près de la moelle allongée caudale, au-dessus de la décussation.',
  },
  section: {
    shows:
      'Un plan sagittal, coronal, axial ou oblique coupe le modèle, et chaque solide fermé reçoit une face de coupe là où le plan le rencontre. Chaque face est colorée d’après un volume d’étiquettes publié, choisi indépendamment de l’atlas de surface.',
    source:
      'Les faces de coupe sont les surfaces piale, blanche et des structures propres à ce sujet. Les étiquettes sont la grille FreeSurfer de 1\u00a0mm du sujet ou les blocs NextBrain de 0,8\u00a0mm\u202f; rien n’est resegmenté dans le navigateur.',
    caution:
      'Les étiquettes de coupe sont à 1\u00a0mm (0,8\u00a0mm pour NextBrain)\u202f: les structures fines sont plus grossières sur une coupe que sur leur surface. Les étiquettes de coupe HCP-MMP, Julich-Brain et Schaefer sont des projections d’étiquettes de surface dans le ruban de substance grise, et non des atlas volumiques. L’ombrage tiré de la T1 est illustratif.',
  },
  lesion: {
    shows:
      'Une sphère de 3 à 30\u00a0mm de rayon placée sur le cerveau ou sur une face de coupe. Le rapport donne les tissus et les régions qu’elle contient, classe les fonctions et les observations de déficit dont elle recouvre les régions, et compte les trajectoires reconstruites qui la traversent.',
    source:
      'Mesurée dans le navigateur sur les volumes d’étiquettes de 1\u00a0mm publiés pour ce sujet, les territoires de l’onglet Fonctions, les régions citées par les observations de l’onglet Déficits et les faisceaux de ce cerveau.',
    caution:
      'Elle mesure un recouvrement sur un seul cerveau\u202f; elle ne prédit aucun déficit. Une sphère ignore la forme vasculaire, de substance blanche et de réseau des lésions réelles. Les territoires des fonctions sont des cartes d’activation chez des personnes en bonne santé, et non des cartes lésion–déficit.',
  },
  coordinate: {
    shows:
      'Une coordonnée publiée dans un gabarit MNI nommé, placée sur ce cerveau et marquée d’une sphère de 5\u00a0mm. Le rapport donne la part de la sphère dans chaque région, jamais une seule parcelle corticale.',
    source:
      'Chaque gabarit a été recalé sur CDMD sub_013 avec SynthMorph de FreeSurfer. Les gabarits sont MNI152NLin2009cAsym et SPM12 (TPM)\u202f; un «\u00a0MNI\u00a0» sans précision est lu comme MNI152NLin2009cAsym. Talairach n’est pas accepté.',
    caution:
      'Le point d’arrivée est un emplacement du gabarit sur un seul cerveau, et non l’endroit où se trouverait le pic de cette personne ni ce que ce cerveau fait à cet endroit. Chercher une seule parcelle depuis l’espace du gabarit ne concordait avec la parcellisation propre à ce cerveau que pour environ 60\u00a0% du cortex du gabarit.',
  },
  overlay: {
    shows:
      'Votre propre carte NIfTI dans un gabarit MNI, un volume ou une série, tracée sur le cortex, les surfaces profondes et chaque face de coupe avec une échelle de couleurs à deux côtés. Un tableau des amas est calculé comme le calcule get_clusters_table de nilearn.',
    source:
      'Votre fichier, lu dans le navigateur\u202f; il ne quitte jamais votre ordinateur. Il est reporté sur CDMD sub_013 par l’inverse du recalage publié du gabarit, celui qu’utilise l’outil Coordonnée.',
    caution:
      'Le résultat est une carte de gabarit sur les plis d’une seule personne, et non les données de cette personne. Espace de gabarit seulement\u202f: une carte en espace natif ou Talairach tombe au mauvais endroit, et aucun en-tête NIfTI n’indique dans quel gabarit MNI se trouve une carte. La carte n’est pas conservée dans un lien.',
  },
  display: {
    shows:
      'Le mode de couleur, l’hémisphère, le cortex, l’anatomie interne, la moelle épinière et la vue éclatée, et les outils de dissection\u202f: masquer, isoler et cibler. Masquer des parcelles corticales découvre la surface blanche propre au sujet.',
    source:
      'Un seul ensemble de maillages publiés de ce cerveau. La profondeur sulcale, l’ouverture corticale et la T1 du ruban sont précalculées en chaque sommet cortical et règlent l’ombrage des plis et la couleur des tissus.',
    caution:
      'L’ombrage est illustratif\u202f: la luminosité T1, l’ombrage des plis et les couleurs des tissus ne sont pas des propriétés optiques ou histologiques mesurées. La vue éclatée déplace chaque structure d’un bloc, et certains systèmes se traversent encore là où des structures fines passent entre eux.',
  },
};
