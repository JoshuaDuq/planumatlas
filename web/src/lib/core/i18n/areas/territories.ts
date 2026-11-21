export const en = {
  heading: 'Typical arterial supply',
  basis: {
    vertices: 'Share of this region’s pial vertices in each territory.',
    voxels: 'Share of this region’s voxels in each territory.',
  },
  unassigned: (share: string) => `${share} lies in no territory the atlas draws.`,
  // A structure too small for shares names the territories round it.
  within: (radius: string) =>
    `Every labelled voxel within ${radius} of this structure lies in this territory.`,
  border: (radius: string) =>
    `A territory border passes within ${radius} of this structure; the territory holding most of that neighbourhood comes first.`,
  small: (floor: string, radius: string) =>
    `A structure under ${floor} is given no shares: registration lands one structure in ten more than ${radius} off.`,
  caveat:
    'Typical territories from where infarcts fell in 1,298 stroke patients (Liu et al. 2023), registered onto this brain: not this brain’s own vessels. Collateral flow and variant anatomy move real territories by centimetres.',
};

export const fr: typeof en = {
  heading: 'Vascularisation artérielle typique',
  basis: {
    vertices: 'Part des sommets piaux de cette région dans chaque territoire.',
    voxels: 'Part des voxels de cette région dans chaque territoire.',
  },
  unassigned: (share: string) => `${share} ne se trouve dans aucun territoire de l’atlas.`,
  within: (radius: string) =>
    `Tous les voxels étiquetés à moins de ${radius} de cette structure se trouvent dans ce territoire.`,
  border: (radius: string) =>
    `Une limite de territoire passe à moins de ${radius} de cette structure\u202f; le territoire qui occupe la plus grande part de ce voisinage vient en premier.`,
  small: (floor: string, radius: string) =>
    `Une structure de moins de ${floor} ne reçoit aucune part\u202f: le recalage place une structure sur dix à plus de ${radius} de sa position.`,
  caveat:
    'Territoires typiques, d’après la localisation des infarctus de 1\u202f298 patients victimes d’AVC (Liu et al. 2023), recalés sur ce cerveau\u202f: pas ses propres vaisseaux. La circulation collatérale et les variantes anatomiques déplacent les territoires réels de plusieurs centimètres.',
};
