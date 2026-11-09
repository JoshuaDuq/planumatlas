import type { Manifest } from '../../types/index.ts';
import { createClinicalCatalog } from './catalog.ts';
import type { ClinicalData } from './types.ts';

// Parsed at build time into a chunk of its own, requested as the entry runs so it downloads beside
// the anatomy rather than inside the entry script.
const records = import('../../../../../data/neuropsychology.yaml');

/** The records are parsed at build time; nothing reads YAML in the browser. */
export const loadClinicalCatalog = async (
  manifest: Pick<Manifest, 'regions'>,
  units: Readonly<Record<string, string>>,
) => createClinicalCatalog((await records).default as ClinicalData, manifest, units);
