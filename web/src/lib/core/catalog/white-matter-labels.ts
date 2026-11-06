/**
 * FreeSurfer wmparc parcels: the white matter nearest each Desikan cortical
 * region, named for that region. The lobe groups are a navigation aid.
 */
const FRONTAL = 'Frontal white matter';
const CENTRAL = 'Central white matter';
const PARIETAL = 'Parietal white matter';
const TEMPORAL = 'Temporal white matter';
const OCCIPITAL = 'Occipital white matter';
const CINGULATE = 'Cingulate white matter';
const LIMBIC = 'Limbic white matter';
const INSULAR = 'Insular white matter';

import { DESIKAN_REGIONS } from './desikan-labels.ts';

export interface WhiteMatterLabel {
  name: string;
  group: string;
  aliases: string[];
}

/** The lobe each parcel is listed under. */
const LOBES: Record<string, string> = {
  bankssts: TEMPORAL,
  caudalanteriorcingulate: CINGULATE,
  caudalmiddlefrontal: FRONTAL,
  cuneus: OCCIPITAL,
  entorhinal: LIMBIC,
  frontalpole: FRONTAL,
  fusiform: TEMPORAL,
  inferiorparietal: PARIETAL,
  inferiortemporal: TEMPORAL,
  insula: INSULAR,
  isthmuscingulate: CINGULATE,
  lateraloccipital: OCCIPITAL,
  lateralorbitofrontal: FRONTAL,
  lingual: OCCIPITAL,
  medialorbitofrontal: FRONTAL,
  middletemporal: TEMPORAL,
  paracentral: CENTRAL,
  parahippocampal: LIMBIC,
  parsopercularis: FRONTAL,
  parsorbitalis: FRONTAL,
  parstriangularis: FRONTAL,
  pericalcarine: OCCIPITAL,
  postcentral: CENTRAL,
  posteriorcingulate: CINGULATE,
  precentral: CENTRAL,
  precuneus: PARIETAL,
  rostralanteriorcingulate: CINGULATE,
  rostralmiddlefrontal: FRONTAL,
  superiorfrontal: FRONTAL,
  superiorparietal: PARIETAL,
  superiortemporal: TEMPORAL,
  supramarginal: PARIETAL,
  temporalpole: TEMPORAL,
  transversetemporal: TEMPORAL,
};

export const WHITE_MATTER_LABELS: Record<string, WhiteMatterLabel> = Object.fromEntries(
  Object.entries(DESIKAN_REGIONS).map(([id, { structure, aliases = [] }]) => [
    id,
    { name: `White matter of the ${structure}`, group: LOBES[id]!, aliases },
  ]),
);
