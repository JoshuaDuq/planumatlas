import type { MapSummary } from './display.ts';
import { MapFileError } from './map-file-error.ts';
import type { InverseField } from './inverse-field.ts';
import type { NiftiVolume } from './nifti.ts';
import { createSampler, resample, sampleCortex, sampleThrough, volumeGrid } from './sampling.ts';
import type { Grid } from './sampling.ts';

/** One hemisphere's native pial and white vertices, surface RAS mm, xyz interleaved. */
export interface CortexSurfaces {
  pial: Float32Array;
  white: Float32Array;
}

/** A map carried onto this brain: on a 1 mm grid for the cuts, and per native cortical vertex. */
export interface CarriedMap {
  grid: Grid;
  /** x fastest; NaN where the map has no value. */
  volume: Float32Array;
  cortex: { left: Float32Array; right: Float32Array };
  summary: MapSummary;
}

function sourceSummary({ shape, voxelToWorld, data, intent, description }: NiftiVolume) {
  let low = Infinity;
  let high = -Infinity;
  let binary = true;
  for (const value of data) {
    if (Number.isNaN(value)) continue;
    if (value < low) low = value;
    if (value > high) high = value;
    if (value !== 0 && value !== 1) binary = false;
  }
  if (low === Infinity) throw new MapFileError('noFinite');
  if (low === 0 && high === 0) throw new MapFileError('zeros');
  const voxelMm = [0, 1, 2].map((axis) =>
    Math.hypot(voxelToWorld[0]![axis]!, voxelToWorld[1]![axis]!, voxelToWorld[2]![axis]!),
  ) as [number, number, number];
  return { shape, voxelMm, range: [low, high] as [number, number], binary, intent, description };
}

/** Carry a template-space map onto this brain through the template's inverted field. */
export function carryMap(
  map: NiftiVolume,
  inverse: InverseField,
  cortex: { left: CortexSurfaces; right: CortexSurfaces },
): CarriedMap {
  const source = sourceSummary(map);
  const at = sampleThrough(inverse, createSampler(map));
  const left = sampleCortex(cortex.left.pial, cortex.left.white, at);
  const right = sampleCortex(cortex.right.pial, cortex.right.white, at);
  let covered = 0;
  for (const value of left) if (!Number.isNaN(value)) covered++;
  for (const value of right) if (!Number.isNaN(value)) covered++;
  const grid = volumeGrid(inverse);
  const volume = resample(grid, at);
  if (!covered && volume.every(Number.isNaN)) {
    throw new MapFileError('outside');
  }
  return {
    grid,
    volume,
    cortex: { left, right },
    summary: { ...source, cortexCovered: covered / (left.length + right.length) },
  };
}
