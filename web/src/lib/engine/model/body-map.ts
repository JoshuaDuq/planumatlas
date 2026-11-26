// Imported when the body map is first drawn: none of it is needed before (BUILD-15).
import { BODY_PARTS } from '../../types/index.ts';
import type { Region } from '../../types/index.ts';
import type { Layer } from './layers.ts';
import { attachVertexCodes } from './vertex-codes.ts';

/** Give each mesh of an atlas's cortex its vertices' body-map codes (`attachVertexCodes`). */
export function attachBodyMap(
  layer: Pick<Layer, 'meshes'>,
  codes: Uint8Array,
  regions: readonly Region[],
  atlas: string,
): void {
  if (codes.some((code) => code > BODY_PARTS.length)) {
    throw new Error(`The ${atlas} body map holds a code no part has.`);
  }
  attachVertexCodes(layer, codes, regions, atlas, 'body map', ({ bodyMap }) =>
    bodyMap
      ? { codes: bodyMap.bodyMapCodes, width: bodyMap.bodyMapWidth, ready: bodyMap.bodyMapReady }
      : null,
  );
}
