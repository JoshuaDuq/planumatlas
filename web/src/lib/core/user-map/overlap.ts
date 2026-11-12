/** Cortical surface, in mm², where the map is beyond its threshold, where the function is painted, and both. */
export interface OverlapAreas {
  map: number;
  function: number;
  both: number;
}

/** Each vertex's share of the surface, in the positions' units squared: a third of each triangle it is a corner of. */
export function vertexAreas(faces: ArrayLike<number>, positions: ArrayLike<number>): Float64Array {
  if (faces.length % 3 || positions.length % 3) {
    throw new Error('Vertex areas need whole triangles and whole positions.');
  }
  const areas = new Float64Array(positions.length / 3);
  for (let f = 0; f < faces.length; f += 3) {
    const a = 3 * faces[f]!,
      b = 3 * faces[f + 1]!,
      c = 3 * faces[f + 2]!;
    const ux = positions[b]! - positions[a]!,
      uy = positions[b + 1]! - positions[a + 1]!,
      uz = positions[b + 2]! - positions[a + 2]!;
    const vx = positions[c]! - positions[a]!,
      vy = positions[c + 1]! - positions[a + 1]!,
      vz = positions[c + 2]! - positions[a + 2]!;
    const third = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 6;
    areas[faces[f]!] += third;
    areas[faces[f + 1]!] += third;
    areas[faces[f + 2]!] += third;
  }
  return areas;
}

/**
 * The areas of one hemisphere's cortex, counting only vertices whose parcel is in `cortex`. A vertex is
 * the map's where its value (`sampleCortex`, NaN for none) is above `threshold`, as the stage draws it
 * against a function: positive values only.
 */
export function overlapAreas(
  {
    values,
    labels,
    areas,
  }: { values: ArrayLike<number>; labels: ArrayLike<number>; areas: ArrayLike<number> },
  cortex: ReadonlySet<number>,
  inside: ReadonlySet<number>,
  threshold: number,
): OverlapAreas {
  if (values.length !== labels.length || areas.length !== labels.length) {
    throw new Error('The map, labels and areas must cover the same vertices.');
  }
  const total: OverlapAreas = { map: 0, function: 0, both: 0 };
  for (let v = 0; v < labels.length; v++) {
    const label = labels[v]!;
    if (!cortex.has(label)) continue;
    const mapped = values[v]! > threshold;
    const painted = inside.has(label);
    if (mapped) total.map += areas[v]!;
    if (painted) total.function += areas[v]!;
    if (mapped && painted) total.both += areas[v]!;
  }
  return total;
}
