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
