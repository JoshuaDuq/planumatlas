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

/** A map's value at a template point (mm), trilinear; NaN where it has none. */
export type Sampler = (x: number, y: number, z: number) => number;

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
 * Trilinear interpolation of the map between its voxel centres. A point beyond the outermost centres has
 * no value (nilearn extrapolates the last half voxel past the far edge; a map in template space never
 * needs it), and a NaN corner makes the point NaN whatever its weight, as in nilearn.
 */
export function createSampler({ shape, voxelToWorld, data }: NiftiVolume): Sampler {
  const [nx, ny, nz] = shape;
  if (nx < 2 || ny < 2 || nz < 2) {
    throw new Error('This map is a single slice along one axis; it needs three dimensions.');
  }
  const m = invert(voxelToWorld);
  const [r0, r1, r2] = [m[0]!, m[1]!, m[2]!];
  return (x, y, z) => {
    const u = r0[0]! * x + r0[1]! * y + r0[2]! * z + r0[3]!;
    const v = r1[0]! * x + r1[1]! * y + r1[2]! * z + r1[3]!;
    const w = r2[0]! * x + r2[1]! * y + r2[2]! * z + r2[3]!;
    if (!(u >= -EDGE && v >= -EDGE && w >= -EDGE)) return NaN;
    if (!(u <= nx - 1 + EDGE && v <= ny - 1 + EDGE && w <= nz - 1 + EDGE)) return NaN;
    const bx = Math.max(0, Math.min(Math.floor(u), nx - 2)),
      by = Math.max(0, Math.min(Math.floor(v), ny - 2)),
      bz = Math.max(0, Math.min(Math.floor(w), nz - 2));
    const fx = u - bx,
      fy = v - by,
      fz = w - bz;
    const at = bx + nx * (by + ny * bz);
    const sx = 1,
      sy = nx,
      sz = nx * ny;
    const c00 = data[at]! * (1 - fx) + data[at + sx]! * fx;
    const c10 = data[at + sy]! * (1 - fx) + data[at + sy + sx]! * fx;
    const c01 = data[at + sz]! * (1 - fx) + data[at + sz + sx]! * fx;
    const c11 = data[at + sz + sy]! * (1 - fx) + data[at + sz + sy + sx]! * fx;
    return (c00 * (1 - fy) + c10 * fy) * (1 - fz) + (c01 * (1 - fy) + c11 * fy) * fz;
  };
}

/** A map's value at a point of this brain (surface RAS mm), read through the inverted field. */
export function sampleThrough(inverse: InverseField, sample: Sampler) {
  const template = new Float64Array(3);
  return (x: number, y: number, z: number): number =>
    inverse.map(x, y, z, template) ? sample(template[0]!, template[1]!, template[2]!) : NaN;
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

/** The map at every voxel centre of `grid`, x fastest; NaN where it has no value. */
export function resample(
  { shape, origin, spacing }: Grid,
  at: (x: number, y: number, z: number) => number,
): Float32Array {
  const [nx, ny, nz] = shape;
  const values = new Float32Array(nx * ny * nz);
  for (let k = 0, n = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++, n++) {
        values[n] = at(origin[0] + spacing * i, origin[1] + spacing * j, origin[2] + spacing * k);
      }
    }
  }
  return values;
}

/**
 * The map on a grid of this brain, trilinear between its centres as a cut face reads it: NaN beyond
 * the grid or where a corner has no value.
 */
export function gridSampler({ shape, origin, spacing }: Grid, values: Float32Array) {
  const [nx, ny, nz] = shape;
  if (values.length !== nx * ny * nz) throw new Error('The map volume does not fill its grid.');
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
    const at = bx + nx * (by + ny * bz);
    const sy = nx,
      sz = nx * ny;
    const c00 = values[at]! * (1 - fx) + values[at + 1]! * fx;
    const c10 = values[at + sy]! * (1 - fx) + values[at + sy + 1]! * fx;
    const c01 = values[at + sz]! * (1 - fx) + values[at + sz + 1]! * fx;
    const c11 = values[at + sz + sy]! * (1 - fx) + values[at + sz + sy + 1]! * fx;
    return (c00 * (1 - fy) + c10 * fy) * (1 - fz) + (c01 * (1 - fy) + c11 * fy) * fz;
  };
}
