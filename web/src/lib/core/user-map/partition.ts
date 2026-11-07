/** How far (glTF metres) a parcel's vertex may sit from the point its native parents give: float32 rounding. */
const POSITION_TOLERANCE = 1e-6;

/** One hemisphere's native surface: its triangles, its pial positions and each vertex's parcel index. */
export interface NativeSurface {
  faces: ArrayLike<number>;
  pial: ArrayLike<number>;
  labels: ArrayLike<number>;
}

/** Each parcel vertex's native parents: one for a native vertex, two for an edge midpoint, three for a centre. */
export type Parents = Map<number, number[][]>;

/**
 * Where each parcel mesh of a cortical atlas comes from on the native surface.
 *
 * The build tiles the surface into parcels by splitting every triangle whose corners disagree at its edge
 * midpoints and centre (`partition_surface`), and gives an added vertex the mean of its native corners
 * (`partition_vertex_field`). A parcel mesh keeps its native vertices, then its edge midpoints in sorted
 * edge order, then its triangle centres in triangle order (`compact_region`). This repeats that order
 * and checks every position against the native surface, so a mismatch throws rather than mis-paints.
 */
export function partitionParents(
  { faces, pial, labels }: NativeSurface,
  parcels: ReadonlyMap<number, ArrayLike<number>>,
): Parents {
  const count = labels.length;
  if (pial.length !== 3 * count || faces.length % 3) {
    throw new Error('A native surface needs one position per vertex and whole triangles.');
  }
  const mixed: number[] = [];
  for (let f = 0; f < faces.length; f += 3) {
    const a = labels[faces[f]!]!;
    if (labels[faces[f + 1]!] !== a || labels[faces[f + 2]!] !== a) mixed.push(f);
  }
  const keys: number[] = [];
  for (const f of mixed) {
    for (let corner = 0; corner < 3; corner++) {
      const a = faces[f + corner]!,
        b = faces[f + ((corner + 1) % 3)]!;
      keys.push(Math.min(a, b) * count + Math.max(a, b));
    }
  }
  const edges = [...new Set(keys)].sort((x, y) => x - y);

  const natives = new Map<number, number[]>();
  for (let vertex = 0; vertex < count; vertex++) {
    const label = labels[vertex]!;
    if (!parcels.has(label)) continue;
    let list = natives.get(label);
    if (!list) natives.set(label, (list = []));
    list.push(vertex);
  }
  const edgesOf = new Map<number, number[]>();
  for (const key of edges) {
    const a = Math.floor(key / count),
      b = key % count;
    for (const label of new Set([labels[a]!, labels[b]!])) {
      if (parcels.has(label)) (edgesOf.get(label) ?? edgesOf.set(label, []).get(label)!).push(key);
    }
  }
  const centresOf = new Map<number, number[]>();
  for (const f of mixed) {
    const corners = new Set([labels[faces[f]!]!, labels[faces[f + 1]!]!, labels[faces[f + 2]!]!]);
    for (const label of corners) {
      if (parcels.has(label))
        (centresOf.get(label) ?? centresOf.set(label, []).get(label)!).push(f);
    }
  }

  const result: Parents = new Map();
  for (const [label, position] of parcels) {
    const parents = [
      ...(natives.get(label) ?? []).map((vertex) => [vertex]),
      ...(edgesOf.get(label) ?? []).map((key) => [Math.floor(key / count), key % count]),
      ...(centresOf.get(label) ?? []).map((f) => [faces[f]!, faces[f + 1]!, faces[f + 2]!]),
    ];
    if (parents.length * 3 !== position.length) {
      throw new Error(
        `Parcel ${label} has ${position.length / 3} vertices; its native surface gives ${parents.length}.`,
      );
    }
    for (const [at, group] of parents.entries()) {
      for (let axis = 0; axis < 3; axis++) {
        let mean = 0;
        for (const vertex of group) mean += pial[3 * vertex + axis]!;
        if (Math.abs(mean / group.length - position[3 * at + axis]!) > POSITION_TOLERANCE) {
          throw new Error(
            `Parcel ${label}'s vertex ${at} is not where its native surface puts it.`,
          );
        }
      }
    }
    result.set(label, parents);
  }
  return result;
}

/**
 * A native per-vertex field (NaN where it has none) on each parcel: (sum, weight), the mean of the
 * parents' values counting a parent without one as 0, and the share of parents with one. The fragment
 * divides one by the other where the weight is ≥ ½.
 */
export function partitionField(
  parents: Parents,
  values: ArrayLike<number>,
): Map<number, Float32Array> {
  const result = new Map<number, Float32Array>();
  for (const [label, groups] of parents) {
    const field = new Float32Array(groups.length * 2);
    for (const [at, group] of groups.entries()) {
      let sum = 0;
      let valid = 0;
      for (const vertex of group) {
        const value = values[vertex]!;
        if (Number.isNaN(value)) continue;
        sum += value;
        valid++;
      }
      field[2 * at] = sum / group.length;
      field[2 * at + 1] = valid / group.length;
    }
    result.set(label, field);
  }
  return result;
}

/** Native vectors (xyz interleaved) on each parcel as the mean of its parents', made unit length for normals. */
export function partitionPoints(
  parents: Parents,
  native: ArrayLike<number>,
  unit = false,
): Map<number, Float32Array> {
  const result = new Map<number, Float32Array>();
  for (const [label, groups] of parents) {
    const points = new Float32Array(groups.length * 3);
    for (const [at, group] of groups.entries()) {
      let x = 0,
        y = 0,
        z = 0;
      for (const vertex of group) {
        x += native[3 * vertex]!;
        y += native[3 * vertex + 1]!;
        z += native[3 * vertex + 2]!;
      }
      const scale = unit ? 1 / Math.hypot(x, y, z) : 1 / group.length;
      points.set([x * scale, y * scale, z * scale], 3 * at);
    }
    result.set(label, points);
  }
  return result;
}
