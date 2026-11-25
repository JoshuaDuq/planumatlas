// Imported when the first thickness file is asked for: none of it is needed before (BUILD-15).
import { DataTexture, RedFormat, UnsignedByteType } from 'three';
import { byteColours } from '../../core/catalog/cortical-thickness.ts';
import type { CorticalThickness, Region } from '../../types/index.ts';
import type { AnatomicalUserData } from '../render/materials.ts';
import { paletteTexture } from '../render/network-colors.ts';
import type { Layer } from './layers.ts';

/** The colour of each published byte, as the cortex looks it up (`SurfacePalettes.thickness`). */
export const thicknessPalette = (record: CorticalThickness) => paletteTexture(byteColours(record));

/** The widest a mesh's thickness texture is; a larger mesh takes more rows. */
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
 * Give each mesh of an atlas's cortex its vertices' thickness bytes. The build writes them region by
 * region in the published regions' order, each region's vertices in its mesh's order, so a mesh whose
 * vertex count is not its region's, or bytes left over, mean the file and the cortex disagree.
 */
export function attachThickness(
  layer: Pick<Layer, 'meshes'>,
  codes: Uint8Array,
  regions: readonly Region[],
  atlas: string,
): void {
  const meshes = new Map(layer.meshes.map((mesh) => [mesh.userData['region_id'] as string, mesh]));
  const placed: [AnatomicalUserData, Uint8Array, (typeof layer.meshes)[number]][] = [];
  let at = 0;
  for (const region of regions) {
    const mesh = region.atlas === atlas ? meshes.get(region.id) : undefined;
    if (!mesh) continue;
    const count = mesh.geometry.getAttribute('position').count;
    const uniforms = (mesh.material.userData as AnatomicalUserData).thickness;
    if (!uniforms || count !== region.vertex_count || at + count > codes.length)
      throw new Error(`${region.id}: its mesh is not the cortex the thickness was measured on.`);
    placed.push([
      mesh.material.userData as AnatomicalUserData,
      codes.subarray(at, at + count),
      mesh,
    ]);
    at += count;
  }
  if (at !== codes.length) throw new Error(`The ${atlas} thickness does not cover its cortex.`);
  // Only once the whole file fits: a cortex is never drawn with some parcels' thickness and not others'.
  for (const [userData, values, mesh] of placed) {
    const { texture, width } = codeTexture(values);
    const uniforms = userData.thickness!;
    uniforms.thicknessCodes.value = texture;
    uniforms.thicknessWidth.value = width;
    uniforms.thicknessReady.value = true;
    mesh.geometry.addEventListener('dispose', () => texture.dispose());
  }
}
