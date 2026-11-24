import { Data3DTexture, RedIntegerFormat, UnsignedShortType, Vector2, Vector3 } from 'three';
import { worldToVoxelMatrix } from '../slices/coordinates.ts';
import { Volume } from '../slices/volume.ts';
import { createMapPalette } from './map-palette.ts';
import type { SurfaceMap } from './map-surface.ts';
import type { Label } from './palette.ts';

const label = (region_id: string | null, color: [number, number, number]): Label => ({
  source_label_id: 0,
  name: region_id ?? 'background',
  color,
  hemisphere: 'left',
  kind: 'tissue',
  region_id,
});

/** Codes: 0 background, 1 a structure the map does not label, 2 and 3 two map regions. */
export const LABELS = [
  label(null, [0, 0, 0]),
  label('aseg:left:8', [230, 148, 34]),
  label('nettekoven:left:m3', [200, 40, 40]),
  label('nettekoven:left:d2', [40, 40, 200]),
];
export const M3 = 2;
export const D2 = 3;

/**
 * A 1 mm label grid in four slabs along anterior, from a = -1.5 to 1.5 mm. A plane at the origin facing +z in
 * world faces posterior (world z is -a), so the two anterior slabs are behind it: `inside` there, `outside` in
 * front.
 */
export function surfaceMap(inside: number, outside: number): SurfaceMap {
  const data = new Uint16Array(16);
  for (let index = 0; index < 16; index++) {
    const anterior = Math.floor(index / 2) % 4;
    data[index] = anterior >= 2 ? inside : outside;
  }
  const volume = new Volume(
    {
      shape: [2, 4, 2],
      order: 'F',
      voxel_to_surface_ras_mm: [
        [1, 0, 0, -0.5],
        [0, 1, 0, -1.5],
        [0, 0, 1, -0.5],
        [0, 0, 0, 1],
      ],
    },
    data,
  );
  const texture = new Data3DTexture(data, 2, 4, 2);
  texture.format = RedIntegerFormat;
  texture.type = UnsignedShortType;
  texture.internalFormat = 'R16UI';
  texture.needsUpdate = true;
  return {
    atlas: 'nettekoven',
    labels: LABELS,
    volume,
    texture,
    worldToVoxel: worldToVoxelMatrix(volume),
    shape: new Vector3(2, 4, 2),
    palette: createMapPalette(LABELS, 'nettekoven'),
    highlightCodes: new Vector2(-1, -1),
    highlightLifts: new Vector2(),
  };
}
