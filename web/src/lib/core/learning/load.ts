import type { Manifest } from '../../types/index.ts';
import type { ClinicalCatalog } from '../clinical/catalog.ts';
import { ownTractIds } from '../diffusion/catalogs.ts';
import { createCircuitCatalog } from './catalog.ts';
import type { CircuitData } from './catalog.ts';

// Parsed at build time into a chunk of its own, requested as the entry runs so it downloads beside
// the anatomy rather than inside the entry script (BUILD-15).
const records = import('../../../../../data/circuits.yaml');

type CatalogInputs = [Pick<Manifest, 'regions' | 'anatomy'>, Pick<ClinicalCatalog, 'search'>];

// A landmark draws only the anatomy's own streamlines, never another subject's.
export const circuitCatalog = (data: CircuitData, ...[manifest, clinical]: CatalogInputs) =>
  createCircuitCatalog(
    data,
    manifest,
    clinical.search('', 'en').map((deficit) => deficit.id),
    ownTractIds(manifest.anatomy.id),
  );

/** The records are parsed at build time; nothing reads YAML in the browser. */
export const loadCircuitCatalog = async (...inputs: CatalogInputs) =>
  circuitCatalog((await records).default as CircuitData, ...inputs);
