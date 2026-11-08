import type { InverseField } from './inverse-field.ts';
import { volumeOf } from './nifti.ts';
import type { NiftiImage } from './nifti.ts';
import { createSampler, valueOf } from './sampling.ts';

/** A region's mean value in each volume of a map. */
export interface MapCourse {
  /** NaN in a volume where none of the region's points has a value. */
  means: Float32Array;
  /** The region's points with a value, per volume. */
  counts: Uint32Array;
  points: number;
}

/**
 * A region's mean in each volume over its points (surface RAS mm, xyz interleaved) that have a value
 * there, each read as a cut face reads the map at a centre of its 1 mm grid.
 */
export function regionCourse(
  image: NiftiImage,
  inverse: InverseField,
  points: Float32Array,
): MapCourse {
  if (points.length % 3) throw new Error('Region points are xyz triples.');
  const count = points.length / 3;
  // Each point's template millimetres, found once for every volume.
  const template = new Float64Array(points.length);
  const placed: number[] = [];
  const at = new Float64Array(3);
  for (let p = 0; p < count; p++) {
    if (!inverse.map(points[3 * p]!, points[3 * p + 1]!, points[3 * p + 2]!, at)) continue;
    template.set(at, 3 * p);
    placed.push(p);
  }
  const means = new Float32Array(image.volumes.length);
  const counts = new Uint32Array(image.volumes.length);
  const out = new Float64Array(2);
  for (let v = 0; v < image.volumes.length; v++) {
    const sample = createSampler(volumeOf(image, v));
    let sum = 0;
    let valued = 0;
    for (const p of placed) {
      sample(template[3 * p]!, template[3 * p + 1]!, template[3 * p + 2]!, out);
      const value = valueOf(out[0]!, out[1]!);
      if (Number.isNaN(value)) continue;
      sum += value;
      valued++;
    }
    means[v] = valued ? sum / valued : Number.NaN;
    counts[v] = valued;
  }
  return { means, counts, points: count };
}
