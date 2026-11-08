import type { MapSummary } from './display.ts';
import { MapFileError } from './map-file-error.ts';
import type { InverseField } from './inverse-field.ts';
import { volumeOf } from './nifti.ts';
import type { NiftiImage, NiftiVolume } from './nifti.ts';
import {
  createSampler,
  resample,
  sampleCortex,
  sampleThrough,
  valueAt,
  volumeGrid,
} from './sampling.ts';
import type { Grid } from './sampling.ts';

/** One hemisphere's native pial and white vertices, surface RAS mm, xyz interleaved. */
export interface CortexSurfaces {
  pial: Float32Array;
  white: Float32Array;
}

/** A volume carried onto this brain: on a 1 mm grid for the cuts, and per native cortical vertex. */
export interface CarriedMap {
  grid: Grid;
  /** x fastest, per voxel the sum over the map's voxels with a value and their share (`resample`). */
  volume: Float32Array;
  cortex: { left: Float32Array; right: Float32Array };
}

/** As the sampler counts a voxel: zero and NaN have no value. */
const valued = (value: number) => value !== 0 && !Number.isNaN(value);

function sourceSummary({
  shape,
  voxelToWorld,
  volumes,
  secondsPerVolume,
  intent,
  description,
}: NiftiImage) {
  let low = Infinity;
  let high = -Infinity;
  let binary = true;
  for (const data of volumes) {
    for (const value of data) {
      if (Number.isNaN(value)) continue;
      if (value < low) low = value;
      if (value > high) high = value;
      if (value !== 0 && value !== 1) binary = false;
    }
  }
  if (low === Infinity) throw new MapFileError('noFinite');
  if (low === 0 && high === 0) throw new MapFileError('zeros');
  const voxelMm = [0, 1, 2].map((axis) =>
    Math.hypot(voxelToWorld[0]![axis]!, voxelToWorld[1]![axis]!, voxelToWorld[2]![axis]!),
  ) as [number, number, number];
  return {
    shape,
    voxelMm,
    range: [low, high] as [number, number],
    binary,
    intent,
    description,
    volumes: volumes.length,
    secondsPerVolume,
  };
}

/** Carry one volume of a template-space map onto this brain through the template's inverted field. */
export function carryVolume(
  map: NiftiVolume,
  inverse: InverseField,
  cortex: { left: CortexSurfaces; right: CortexSurfaces },
): CarriedMap {
  const sample = sampleThrough(inverse, createSampler(map));
  const at = valueAt(sample);
  const grid = volumeGrid(inverse);
  return {
    grid,
    volume: resample(grid, sample),
    cortex: {
      left: sampleCortex(cortex.left.pial, cortex.left.white, at),
      right: sampleCortex(cortex.right.pial, cortex.right.white, at),
    },
  };
}

/** 1 where any volume has a value, 0 elsewhere. */
function supportOf(image: NiftiImage): NiftiVolume {
  const data = new Float32Array(image.volumes[0]!.length);
  for (const volume of image.volumes) {
    for (let i = 0; i < data.length; i++) if (valued(volume[i]!)) data[i] = 1;
  }
  return { ...volumeOf(image, 0), data };
}

/**
 * Carry volume `index` of an image onto this brain, with what the reader is told of the image: its
 * range over every volume, and the share of the cortex its voxels reach in any of them. Refused when
 * none reaches this brain.
 */
export function carryImage(
  image: NiftiImage,
  index: number,
  inverse: InverseField,
  cortex: { left: CortexSurfaces; right: CortexSurfaces },
): { map: CarriedMap; summary: MapSummary } {
  const source = sourceSummary(image);
  const map = carryVolume(volumeOf(image, index), inverse, cortex);
  const reach = image.volumes.length > 1 ? carryVolume(supportOf(image), inverse, cortex) : map;
  let covered = 0;
  for (const value of reach.cortex.left) if (!Number.isNaN(value)) covered++;
  for (const value of reach.cortex.right) if (!Number.isNaN(value)) covered++;
  if (!covered && !reach.volume.some((value, n) => n % 2 === 1 && value >= 0.5)) {
    throw new MapFileError('outside');
  }
  const vertices = reach.cortex.left.length + reach.cortex.right.length;
  return { map, summary: { ...source, cortexCovered: covered / vertices } };
}
