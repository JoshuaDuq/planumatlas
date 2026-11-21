import type { ManifestAnatomy } from '../../types/index.ts';
import { fetchAsset } from './asset-cache.ts';

/** An anatomy as `anatomies.json` lists it. */
export type PublishedAnatomy = Pick<
  ManifestAnatomy,
  'id' | 'display_name' | 'label' | 'individual'
>;

export interface PublishedAnatomies {
  default: string;
  anatomies: PublishedAnatomy[];
}

/** The anatomy index, taken from the head script's early request when it started one. */
export async function loadAnatomies(url: string | URL): Promise<PublishedAnatomies> {
  return JSON.parse(new TextDecoder().decode(await fetchAsset(url)));
}

/** An omitted choice uses the index default; an explicit choice must be published. */
export function resolveAnatomy(
  published: { default: string; anatomies: readonly { id: string }[] },
  requested?: string,
): string {
  const id = requested === undefined ? published.default : requested;
  if (!published.anatomies.some((anatomy) => anatomy.id === id)) {
    throw new Error(`Unknown anatomy: ${id}`);
  }
  return id;
}
