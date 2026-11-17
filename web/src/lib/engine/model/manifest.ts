import type { Manifest, ManifestAppearance } from '../../types/index.ts';
import type { CabNpPartition } from '../../core/catalog/networks.ts';
import type { FunctionalRegions } from '../../core/catalog/functional-regions.ts';
import type { NeuropsychDomains, NeurosynthTerms } from '../../core/catalog/neuropsych-domains.ts';
import type { BoundaryCertainty } from '../../core/catalog/boundary-certainty.ts';
import type { SegmentationAgreement } from '../../core/catalog/segmentation-agreement.ts';
import type { ReceptorFingerprints } from '../../core/catalog/receptor-fingerprints.ts';
import type { FunctionalConnectivity } from '../../core/catalog/functional-connectivity.ts';
import type { DisorderEffects } from '../../core/catalog/disorder-effects.ts';
import type { StimulationFtract } from '../../core/catalog/stimulation-ftract.ts';
import type { StimulationResponses } from '../../core/catalog/stimulation-responses.ts';
import { fetchAsset } from '../../core/assets/asset-cache.ts';
import type { Appearance } from '../render/materials.ts';
import type { NetworkMetadata } from '../render/network-colors.ts';

/**
 * What the model reads of the published `manifest.json`: the shared manifest type with the
 * appearance and networks the materials need typed as they read them.
 */
export interface AtlasManifest extends Omit<Manifest, 'appearance' | 'networks'> {
  appearance: Appearance & Pick<ManifestAppearance, 'see_through_opacity'>;
  networks?: NetworkMetadata;
}

/** The files a manifest names beside it, in the order `BrainAtlas` takes them; null where it names none. */
export type Companions = [
  cabNp: CabNpPartition | null,
  functionalRegions: FunctionalRegions | null,
  domains: NeuropsychDomains | null,
  terms: NeurosynthTerms | null,
  boundaryCertainty: BoundaryCertainty | null,
  receptors: ReceptorFingerprints | null,
  segmentationAgreement: SegmentationAgreement | null,
  stimulation: StimulationResponses | null,
  ftract: StimulationFtract | null,
  connectivity: FunctionalConnectivity | null,
  disorders: DisorderEffects | null,
];

/** The published manifest at `url`, then every companion file it names, read together. */
export async function fetchManifest(
  url: URL,
): Promise<{ manifest: AtlasManifest; companions: Companions }> {
  const readJson = async <T>(address: string | URL) =>
    JSON.parse(new TextDecoder().decode(await fetchAsset(address))) as T;
  const manifest = await readJson<AtlasManifest>(url.href);
  const companions = await Promise.all([
    manifest.cab_np ? readJson<CabNpPartition>(new URL(manifest.cab_np.file, url)) : null,
    manifest.functional_regions
      ? readJson<FunctionalRegions>(new URL(manifest.functional_regions.file, url))
      : null,
    manifest.neuropsych_domains
      ? readJson<NeuropsychDomains>(new URL(manifest.neuropsych_domains.file, url))
      : null,
    manifest.neurosynth_terms
      ? readJson<NeurosynthTerms>(new URL(manifest.neurosynth_terms.file, url))
      : null,
    manifest.boundary_certainty
      ? readJson<BoundaryCertainty>(new URL(manifest.boundary_certainty.file, url))
      : null,
    manifest.receptor_fingerprints
      ? readJson<ReceptorFingerprints>(new URL(manifest.receptor_fingerprints.file, url))
      : null,
    manifest.segmentation_agreement
      ? readJson<SegmentationAgreement>(new URL(manifest.segmentation_agreement.file, url))
      : null,
    manifest.stimulation_responses
      ? readJson<StimulationResponses>(new URL(manifest.stimulation_responses.file, url))
      : null,
    manifest.stimulation_ftract
      ? readJson<StimulationFtract>(new URL(manifest.stimulation_ftract.file, url))
      : null,
    manifest.functional_connectivity
      ? readJson<FunctionalConnectivity>(new URL(manifest.functional_connectivity.file, url))
      : null,
    manifest.disorder_effects
      ? readJson<DisorderEffects>(new URL(manifest.disorder_effects.file, url))
      : null,
  ]);
  return { manifest, companions };
}

export function validateManifest(manifest: AtlasManifest): void {
  // Named individually because these fail together for one boring reason — a
  // manifest cached from an earlier deploy — and "expected schema version 1"
  // sends the reader to look at the version, which was never the problem.
  const seeThroughOpacity = manifest.appearance?.see_through_opacity;
  const missing = [
    ['schema_version 1', manifest.schema_version === 1],
    ['atlases', manifest.atlases?.length > 0],
    ['regions', Array.isArray(manifest.regions)],
    ['detail_levels', manifest.detail_levels?.length > 0],
    ['appearance', Boolean(manifest.appearance?.tissue && manifest.appearance?.folds)],
    ['native tissue envelopes', Boolean(manifest.solid_envelopes?.file)],
    [
      'appearance.see_through_opacity',
      !manifest.neuropsych_domains || (seeThroughOpacity! > 0 && seeThroughOpacity! < 1),
    ],
    [
      'anatomy',
      Boolean(manifest.anatomy?.subject && manifest.anatomy?.display_name) &&
        typeof manifest.anatomy.individual === 'boolean',
    ],
  ]
    .filter(([, present]) => !present)
    .map(([field]) => field);
  if (missing.length) {
    throw new Error(
      `Invalid brain model manifest: missing or invalid ${missing.join(', ')}. ` +
        'A stale cached copy will do this; reload ignoring the cache.',
    );
  }
  const ids = new Set<string>();
  for (const region of manifest.regions) {
    if (
      !region.id ||
      ids.has(region.id) ||
      !region.label ||
      !['left', 'right', 'midline'].includes(region.hemisphere) ||
      !['cortex', 'structure', 'non-region', 'tissue-region'].includes(region.kind)
    ) {
      throw new Error(`Invalid or duplicate region metadata: ${region.id}`);
    }
    ids.add(region.id);
  }
}
