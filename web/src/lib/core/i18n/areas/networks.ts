export const en = {
  heading: 'Functional networks',
  yeo: 'Yeo 7 networks',
  cabNp: 'CAB-NP networks',
  cabNpNote: 'The whole HCP-MMP area is assigned to one network by CAB-NP (Ji et al. 2019).',
  notes: {
    vertices:
      'Shares of assigned source vertices; unassigned vertices excluded. Shares below 5% hidden without rescaling.',
    voxels:
      'Shares of assigned cortical voxels; unassigned voxels excluded. Shares below 5% hidden without rescaling.',
  },
  territory:
    'The striatal voxels whose resting-state connectivity most resembles this cortical network (Choi et al. 2012).',
  striatal: 'Striatal networks (Choi et al. 2012)',
  striatalNote:
    'Share of this structure’s voxels in each network’s striatal territory. Shares below 5% hidden without rescaling.',
  striatalUnassigned: (share: string) => `${share} lies outside the striatum the atlas labels.`,
  striatalCaveat:
    'A group atlas registered onto this brain from FSL’s MNI152 template: borders sit a few millimetres off, and each voxel shows only the network its connectivity most resembles.',
  confidence: (confident: string, low: string, filled: string) =>
    `Choi’s confidence: ${confident} of its labelled voxels confident, ${low} low, ${filled} filled.`,
  confidenceNote: (minimum: string) =>
    `Confident: a share of at least ${minimum} of the voxel’s 25 most correlated cortical vertices lies in its network; low: less; filled: the atlas did not reach it. The cut draws low and filled voxels paler.`,
  putamenCaveat:
    'Choi et al. are least confident around the dorsal putamen, where signal from the adjacent insula is only partly removed: part of its salience share may come from the insula.',
  caveat: 'Group resting-state networks, not measured function in this brain.',
};

export const fr: typeof en = {
  heading: 'Réseaux fonctionnels',
  yeo: 'Réseaux de Yeo (7)',
  cabNp: 'Réseaux CAB-NP',
  cabNpNote: 'L’aire HCP-MMP entière est assignée à un seul réseau par CAB-NP (Ji et al. 2019).',
  notes: {
    vertices:
      'Parts des sommets source assignés\u202f; sommets non assignés exclus. Parts inférieures à 5\u202f% masquées sans renormalisation.',
    voxels:
      'Parts des voxels corticaux assignés\u202f; voxels non assignés exclus. Parts inférieures à 5\u202f% masquées sans renormalisation.',
  },
  territory:
    'Les voxels du striatum dont la connectivité de repos ressemble le plus à ce réseau cortical (Choi et al. 2012).',
  striatal: 'Réseaux striataux (Choi et al. 2012)',
  striatalNote:
    'Part des voxels de cette structure dans le territoire striatal de chaque réseau. Parts inférieures à 5\u202f% masquées sans renormalisation.',
  striatalUnassigned: (share: string) =>
    `${share} se trouve hors du striatum que l’atlas étiquette.`,
  striatalCaveat:
    'Un atlas de groupe recalé sur ce cerveau depuis le gabarit MNI152 de FSL\u202f: les limites sont décalées de quelques millimètres, et chaque voxel ne montre que le réseau auquel sa connectivité ressemble le plus.',
  confidence: (confident: string, low: string, filled: string) =>
    `Confiance de Choi\u202f: ${confident} de ses voxels étiquetés confiants, ${low} faibles, ${filled} comblés.`,
  confidenceNote: (minimum: string) =>
    `Confiant\u202f: une part d’au moins ${minimum} des 25 sommets corticaux les plus corrélés au voxel appartient à son réseau\u202f; faible\u202f: moins\u202f; comblé\u202f: l’atlas ne l’atteignait pas. La coupe dessine les voxels faibles et comblés plus pâles.`,
  putamenCaveat:
    'Choi et al. sont le moins confiants autour du putamen dorsal, où le signal de l’insula voisine n’est que partiellement retiré\u202f: une partie de sa part de saillance peut venir de l’insula.',
  caveat: 'Réseaux de repos de groupe, sans mesure fonctionnelle de ce cerveau.',
};
