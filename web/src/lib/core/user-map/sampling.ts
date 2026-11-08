import { MapFileError } from './map-file-error.ts';
import type { InverseField } from './inverse-field.ts';
import type { NiftiVolume } from './nifti.ts';

/**
 * Samples per vertex between the pial and white surfaces, pial first, as nilearn's `vol_to_surf` takes
 * them with an inner mesh (its default of 10, at `linspace(0, 1, 10)` of the way to white).
 */
export const DEPTH_SAMPLES = 10;

/** The cut faces read the map resampled onto this brain at the spacing of its 1 mm segmentation. */
export const VOLUME_SPACING_MM = 1;

/** Voxels a point may lie beyond the outermost centres and still read them: affine rounding, not data. */
const EDGE = 1e-6;

/**
 * A map read trilinearly at a template point (mm), writing into `out` the weighted sum of the voxels
 * with a value and their share of the weight; both 0 where it has none.
 */
export type Sampler = (x: number, y: number, z: number, out: Float64Array) => void;

/** A voxel without a value: zero (outside a mask or a thresholded map) or NaN. */
const valued = (value: number) => value !== 0 && !Number.isNaN(value);

function invert(m: readonly (readonly number[])[]): number[][] {
  const [a, b, c] = [m[0]!, m[1]!, m[2]!];
  const det =
    a[0]! * (b[1]! * c[2]! - b[2]! * c[1]!) -
    a[1]! * (b[0]! * c[2]! - b[2]! * c[0]!) +
    a[2]! * (b[0]! * c[1]! - b[1]! * c[0]!);
  const r = [
    [b[1]! * c[2]! - b[2]! * c[1]!, a[2]! * c[1]! - a[1]! * c[2]!, a[1]! * b[2]! - a[2]! * b[1]!],
    [b[2]! * c[0]! - b[0]! * c[2]!, a[0]! * c[2]! - a[2]! * c[0]!, a[2]! * b[0]! - a[0]! * b[2]!],
    [b[0]! * c[1]! - b[1]! * c[0]!, a[1]! * c[0]! - a[0]! * c[1]!, a[0]! * b[1]! - a[1]! * b[0]!],
  ].map((row) => row.map((value) => value / det));
  return r.map((row) => [...row, -(row[0]! * a[3]! + row[1]! * b[3]! + row[2]! * c[3]!)]);
}

/**
 * Trilinear interpolation between the map's voxel centres over the voxels with a value. A point beyond
 * the outermost centres has none (nilearn extrapolates the last half voxel past the far edge; a map in
 * template space never needs it).
 */
export function createSampler({ shape, voxelToWorld, data }: NiftiVolume): Sampler {
  const [nx, ny, nz] = shape;
  if (nx < 2 || ny < 2 || nz < 2) {
    throw new MapFileError('slice');
  }
  const m = invert(voxelToWorld);
  const [r0, r1, r2] = [m[0]!, m[1]!, m[2]!];
  return (x, y, z, out) => {
    out[0] = out[1] = 0;
    const u = r0[0]! * x + r0[1]! * y + r0[2]! * z + r0[3]!;
    const v = r1[0]! * x + r1[1]! * y + r1[2]! * z + r1[3]!;
    const w = r2[0]! * x + r2[1]! * y + r2[2]! * z + r2[3]!;
    if (!(u >= -EDGE && v >= -EDGE && w >= -EDGE)) return;
    if (!(u <= nx - 1 + EDGE && v <= ny - 1 + EDGE && w <= nz - 1 + EDGE)) return;
    const bx = Math.max(0, Math.min(Math.floor(u), nx - 2)),
      by = Math.max(0, Math.min(Math.floor(v), ny - 2)),
      bz = Math.max(0, Math.min(Math.floor(w), nz - 2));
    const fx = u - bx,
      fy = v - by,
      fz = w - bz;
    const at = bx + nx * (by + ny * bz);
    for (let corner = 0; corner < 8; corner++) {
      const dx = corner & 1,
        dy = (corner >> 1) & 1,
        dz = corner >> 2;
      const value = data[at + dx + nx * (dy + ny * dz)]!;
      if (!valued(value)) continue;
      const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
      out[0] += weight * value;
      out[1] += weight;
    }
  };
}

/**
 * The value from a sum and share: where the voxels with a value hold at least half the weight, their
 * weighted mean; elsewhere none. The edge of a map's support lies halfway between voxel centres, as the
 * parcel meshes draw a vertex's parents.
 */
export function valueOf(sum: number, share: number): number {
  return share >= 0.5 ? sum / share : NaN;
}

/** A map read at a point of this brain (surface RAS mm) through the inverted field. */
export function sampleThrough(inverse: InverseField, sample: Sampler): Sampler {
  const template = new Float64Array(3);
  return (x, y, z, out) => {
    if (inverse.map(x, y, z, template)) sample(template[0]!, template[1]!, template[2]!, out);
    else out[0] = out[1] = 0;
  };
}

/** A sampler's value at a point, NaN where it has none. */
export function valueAt(sample: Sampler) {
  const out = new Float64Array(2);
  return (x: number, y: number, z: number): number => {
    sample(x, y, z, out);
    return valueOf(out[0]!, out[1]!);
  };
}

/**
 * Each vertex's value: the mean of the samples between its pial and white positions (surface RAS mm,
 * xyz interleaved) that have one, NaN where none has, as nilearn's `vol_to_surf` with `inner_mesh`.
 */
export function sampleCortex(
  pial: Float32Array,
  white: Float32Array,
  at: (x: number, y: number, z: number) => number,
): Float32Array {
  if (pial.length !== white.length || pial.length % 3) {
    throw new Error('The pial and white surfaces need corresponding vertices.');
  }
  const values = new Float32Array(pial.length / 3);
  for (let vertex = 0; vertex < values.length; vertex++) {
    let sum = 0;
    let count = 0;
    for (let step = 0; step < DEPTH_SAMPLES; step++) {
      const depth = step / (DEPTH_SAMPLES - 1);
      const value = at(
        pial[3 * vertex]! + depth * (white[3 * vertex]! - pial[3 * vertex]!),
        pial[3 * vertex + 1]! + depth * (white[3 * vertex + 1]! - pial[3 * vertex + 1]!),
        pial[3 * vertex + 2]! + depth * (white[3 * vertex + 2]! - pial[3 * vertex + 2]!),
      );
      if (Number.isNaN(value)) continue;
      sum += value;
      count++;
    }
    values[vertex] = count ? sum / count : NaN;
  }
  return values;
}

/** An axis-aligned grid of this brain: voxel (i, j, k) centred at origin + spacing·(i, j, k), surface RAS mm. */
export interface Grid {
  shape: [number, number, number];
  origin: [number, number, number];
  spacing: number;
}

/** The 1 mm grid over the inverted field, its centres on whole millimetres as the segmentation's are. */
export function volumeGrid({ origin, shape, spacing }: InverseField): Grid {
  const start = origin.map(Math.ceil) as [number, number, number];
  const end = origin.map((value, axis) => value + spacing * (shape[axis]! - 1));
  return {
    origin: start,
    shape: start.map(
      (value, axis) => Math.floor((end[axis]! - value) / VOLUME_SPACING_MM) + 1,
    ) as Grid['shape'],
    spacing: VOLUME_SPACING_MM,
  };
}

/**
 * The map at every voxel centre of `grid`, x fastest, two values per voxel: the weighted sum over the
 * voxels with a value and their share of the weight, so they are interpolated again as one.
 */
export function resample({ shape, origin, spacing }: Grid, sample: Sampler): Float32Array {
  const [nx, ny, nz] = shape;
  const values = new Float32Array(2 * nx * ny * nz);
  const out = new Float64Array(2);
  for (let k = 0, n = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++, n += 2) {
        sample(origin[0] + spacing * i, origin[1] + spacing * j, origin[2] + spacing * k, out);
        values[n] = out[0]!;
        values[n + 1] = out[1]!;
      }
    }
  }
  return values;
}

/**
 * The map on a grid of this brain as a cut face reads it: sum and share trilinear between the centres,
 * then `valueOf`; NaN beyond the grid.
 */
export function gridSampler({ shape, origin, spacing }: Grid, values: Float32Array) {
  const [nx, ny, nz] = shape;
  if (values.length !== 2 * nx * ny * nz) throw new Error('The map volume does not fill its grid.');
  return (x: number, y: number, z: number): number => {
    const u = (x - origin[0]) / spacing,
      v = (y - origin[1]) / spacing,
      w = (z - origin[2]) / spacing;
    if (!(u >= 0 && v >= 0 && w >= 0 && u <= nx - 1 && v <= ny - 1 && w <= nz - 1)) return NaN;
    const bx = Math.min(Math.floor(u), nx - 2),
      by = Math.min(Math.floor(v), ny - 2),
      bz = Math.min(Math.floor(w), nz - 2);
    const fx = u - bx,
      fy = v - by,
      fz = w - bz;
    let sum = 0;
    let share = 0;
    for (let corner = 0; corner < 8; corner++) {
      const dx = corner & 1,
        dy = (corner >> 1) & 1,
        dz = corner >> 2;
      const at = 2 * (bx + dx + nx * (by + dy + ny * (bz + dz)));
      const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
      sum += weight * values[at]!;
      share += weight * values[at + 1]!;
    }
    return valueOf(sum, share);
  };
}
