import type {
  CoordinateField,
  CoordinateSpace,
  CoordinateSpaces,
  NativeSpace,
} from '../../types/index.ts';
import { loadField } from './field.ts';
import type { Field } from './field.ts';
import type { Coordinate } from './parse.ts';

/** The choice for a coordinate whose paper names MNI but not the template. */
export const UNSTATED = 'unstated';

/** The published template a coordinate given in `space` is read in. */
export function readIn(metadata: CoordinateSpaces, space: string): CoordinateSpace {
  const id = space === UNSTATED ? metadata.unstated.reads_as : space;
  const record = metadata.spaces.find((entry) => entry.id === id);
  if (!record) throw new RangeError(`Unknown coordinate space: ${space}`);
  return record;
}

/** The template this brain is itself (the MNI template), or null for a person's brain. */
export const nativeSpace = (metadata: CoordinateSpaces | undefined): NativeSpace | null =>
  metadata?.spaces.find((space) => space.native)?.native ?? null;

/** Where a point of the template lands on its own reconstruction, or null beyond its brain's extent. */
export function placeNative(
  { template_to_surface_ras_mm: affine, bounds_ras_mm: [low, high] }: NativeSpace,
  point: Readonly<Coordinate>,
): Coordinate | null {
  const placed = [0, 1, 2].map(
    (row) =>
      affine[row]![0]! * point[0] +
      affine[row]![1]! * point[1] +
      affine[row]![2]! * point[2] +
      affine[row]![3]!,
  ) as Coordinate;
  return placed.every((value, axis) => value >= low[axis]! && value <= high[axis]!) ? placed : null;
}

/**
 * The anatomy's published coordinate spaces: each template's field downloaded once, when a coordinate
 * in it is first placed, and a coordinate in a template not stated read as `unstated.reads_as`.
 */
export function createCoordinateSpaces(
  metadata: CoordinateSpaces,
  baseUrl: string | URL,
  load: (record: CoordinateField, baseUrl: string | URL) => Promise<Field> = loadField,
) {
  const { radius_mm: radius, spaces, unstated } = metadata;
  if (!(Number.isFinite(radius) && radius > 0)) {
    throw new Error(`A coordinate's sphere needs a positive radius, not ${radius}.`);
  }
  const ids = spaces.map(({ id }) => id);
  if (!ids.length || new Set(ids).size !== ids.length || ids.includes(UNSTATED)) {
    throw new Error('The published coordinate spaces need distinct ids.');
  }
  if (!ids.includes(unstated.reads_as)) {
    throw new Error(
      `An unstated coordinate reads as ${unstated.reads_as}, which is not published.`,
    );
  }
  for (const alternative of unstated.alternatives) {
    if (!alternative.against[unstated.reads_as]) {
      throw new Error(`${alternative.id} was not measured against ${unstated.reads_as}.`);
    }
  }
  const fields = new Map<string, Promise<Field>>();

  return {
    metadata,
    /** Where a coordinate in `space` lands on this brain, or null beyond its template's brain. */
    async map(point: Readonly<Coordinate>, space: string): Promise<Coordinate | null> {
      const record = readIn(metadata, space);
      if (record.native) return placeNative(record.native, point);
      const { id, field } = record;
      let loading = fields.get(id);
      if (!loading) {
        loading = load(field, baseUrl);
        fields.set(id, loading);
        loading.catch(() => fields.delete(id));
      }
      return (await loading).map(point);
    },
  };
}

export type Coordinates = ReturnType<typeof createCoordinateSpaces>;
