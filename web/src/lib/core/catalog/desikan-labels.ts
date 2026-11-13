/**
 * The 34 Desikan-Killiany cortical regions in English, keyed by FreeSurfer's run-together names
 * (`caudalanteriorcingulate`): each region's structure written out, as the white-matter parcels
 * named for it and NextBrain's cortex both use it.
 */
export const DESIKAN_REGIONS: Record<string, { structure: string; aliases?: string[] }> = {
  bankssts: { structure: 'banks of the superior temporal sulcus' },
  caudalanteriorcingulate: { structure: 'caudal anterior cingulate cortex' },
  caudalmiddlefrontal: { structure: 'caudal middle frontal gyrus' },
  cuneus: { structure: 'cuneus' },
  entorhinal: { structure: 'entorhinal cortex' },
  frontalpole: { structure: 'frontal pole' },
  fusiform: { structure: 'fusiform gyrus' },
  inferiorparietal: { structure: 'inferior parietal cortex' },
  inferiortemporal: { structure: 'inferior temporal gyrus' },
  insula: { structure: 'insula' },
  isthmuscingulate: { structure: 'isthmus of the cingulate gyrus' },
  lateraloccipital: { structure: 'lateral occipital cortex' },
  lateralorbitofrontal: { structure: 'lateral orbitofrontal cortex' },
  lingual: { structure: 'lingual gyrus' },
  medialorbitofrontal: { structure: 'medial orbitofrontal cortex' },
  middletemporal: { structure: 'middle temporal gyrus' },
  paracentral: { structure: 'paracentral lobule' },
  parahippocampal: { structure: 'parahippocampal gyrus' },
  parsopercularis: {
    structure: 'opercular part of the inferior frontal gyrus',
    aliases: ['pars opercularis'],
  },
  parsorbitalis: {
    structure: 'orbital part of the inferior frontal gyrus',
    aliases: ['pars orbitalis'],
  },
  parstriangularis: {
    structure: 'triangular part of the inferior frontal gyrus',
    aliases: ['pars triangularis'],
  },
  pericalcarine: { structure: 'pericalcarine cortex' },
  postcentral: { structure: 'postcentral gyrus' },
  posteriorcingulate: { structure: 'posterior cingulate cortex' },
  precentral: { structure: 'precentral gyrus' },
  precuneus: { structure: 'precuneus' },
  rostralanteriorcingulate: { structure: 'rostral anterior cingulate cortex' },
  rostralmiddlefrontal: { structure: 'rostral middle frontal gyrus' },
  superiorfrontal: { structure: 'superior frontal gyrus' },
  superiorparietal: { structure: 'superior parietal lobule' },
  superiortemporal: { structure: 'superior temporal gyrus' },
  supramarginal: { structure: 'supramarginal gyrus' },
  temporalpole: { structure: 'temporal pole' },
  transversetemporal: { structure: 'transverse temporal gyrus', aliases: ['Heschl'] },
};

/**
 * The lobe the Desikan-Killiany atlas's own regions are listed under, the one Destrieux lists the
 * same gyrus under (destrieux-labels.ts), so the atlases share their groups and lobe colours.
 */
const LOBE_REGIONS: Record<string, string[]> = {
  Frontal: [
    'superiorfrontal',
    'rostralmiddlefrontal',
    'caudalmiddlefrontal',
    'parsopercularis',
    'parstriangularis',
    'parsorbitalis',
    'lateralorbitofrontal',
    'medialorbitofrontal',
    'frontalpole',
  ],
  Central: ['precentral', 'postcentral', 'paracentral'],
  Parietal: ['superiorparietal', 'inferiorparietal', 'supramarginal', 'precuneus'],
  Occipital: ['lateraloccipital', 'lingual', 'cuneus', 'pericalcarine'],
  Temporal: [
    'superiortemporal',
    'bankssts',
    'transversetemporal',
    'middletemporal',
    'inferiortemporal',
    'fusiform',
    'temporalpole',
  ],
  Insula: ['insula'],
  Cingulate: [
    'rostralanteriorcingulate',
    'caudalanteriorcingulate',
    'posteriorcingulate',
    'isthmuscingulate',
  ],
  Limbic: ['parahippocampal', 'entorhinal'],
};

export const DESIKAN_LOBES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(LOBE_REGIONS).flatMap(([lobe, names]) => names.map((name) => [name, lobe])),
);
