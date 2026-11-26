// A byte per cortical vertex, read by the shader through gl_VertexID: thickness and the body map.
import { DataTexture, RedFormat, UnsignedByteType } from 'three';
import type { IUniform } from 'three';
import type { Region } from '../../types/index.ts';
import type { AnatomicalUserData } from '../render/materials.ts';
import type { Layer } from './layers.ts';

/** The uniforms a mesh reads its bytes through. */
export interface CodeSlot {
  codes: IUniform<DataTexture | null>;
  width: IUniform<number>;
  ready: IUniform<boolean>;
}

/** The widest a mesh's code texture is; a larger mesh takes more rows. */
const MAXIMUM_WIDTH = 4096;

/** One texel per vertex, row-major, the last row padded. */
function codeTexture(codes: Uint8Array): { texture: DataTexture; width: number } {
  const width = Math.min(MAXIMUM_WIDTH, codes.length);
  const data = new Uint8Array(width * Math.ceil(codes.length / width));
  data.set(codes);
  const texture = new DataTexture(data, width, data.length / width, RedFormat, UnsignedByteType);
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return { texture, width };
}

/**
 * Give each mesh of an atlas's cortex its vertices' bytes. The build writes them region by region in
 * the published regions' order, each region's vertices in its mesh's order, so a mesh whose vertex
 * count is not its region's, or bytes left over, mean the file and the cortex disagree. `what` names
 * the measure in errors.
 */
export function attachVertexCodes(
  layer: Pick<Layer, 'meshes'>,
  codes: Uint8Array,
  regions: readonly Region[],
  atlas: string,
  what: string,
  slotOf: (userData: AnatomicalUserData) => CodeSlot | null,
): void {
  const meshes = new Map(layer.meshes.map((mesh) => [mesh.userData['region_id'] as string, mesh]));
  const placed: [CodeSlot, Uint8Array, (typeof layer.meshes)[number]][] = [];
  let at = 0;
  for (const region of regions) {
    const mesh = region.atlas === atlas ? meshes.get(region.id) : undefined;
    if (!mesh) continue;
    const count = mesh.geometry.getAttribute('position').count;
    const slot = slotOf(mesh.material.userData as AnatomicalUserData);
    if (!slot || count !== region.vertex_count || at + count > codes.length)
      throw new Error(`${region.id}: its mesh is not the cortex the ${what} was measured on.`);
    placed.push([slot, codes.subarray(at, at + count), mesh]);
    at += count;
  }
  if (at !== codes.length) throw new Error(`The ${atlas} ${what} does not cover its cortex.`);
  // Only once the whole file fits: a cortex is never drawn with some parcels' bytes and not others'.
  for (const [slot, values, mesh] of placed) {
    const { texture, width } = codeTexture(values);
    slot.codes.value = texture;
    slot.width.value = width;
    slot.ready.value = true;
    mesh.geometry.addEventListener('dispose', () => texture.dispose());
  }
}
