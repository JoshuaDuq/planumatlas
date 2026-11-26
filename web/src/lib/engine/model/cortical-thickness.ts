// Imported when the first thickness file is asked for: none of it is needed before (BUILD-15).
import { byteColours } from '../../core/catalog/cortical-thickness.ts';
import type { CorticalThickness, Region } from '../../types/index.ts';
import { paletteTexture } from '../render/network-colors.ts';
import type { Layer } from './layers.ts';
import { attachVertexCodes } from './vertex-codes.ts';

/** The colour of each published byte, as the cortex looks it up (`SurfacePalettes.thickness`). */
export const thicknessPalette = (record: CorticalThickness) => paletteTexture(byteColours(record));

/** Give each mesh of an atlas's cortex its vertices' thickness bytes (`attachVertexCodes`). */
export function attachThickness(
  layer: Pick<Layer, 'meshes'>,
  codes: Uint8Array,
  regions: readonly Region[],
  atlas: string,
): void {
  attachVertexCodes(layer, codes, regions, atlas, 'thickness', ({ thickness }) =>
    thickness
      ? {
          codes: thickness.thicknessCodes,
          width: thickness.thicknessWidth,
          ready: thickness.thicknessReady,
        }
      : null,
  );
}
