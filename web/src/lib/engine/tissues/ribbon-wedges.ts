import { BufferAttribute, BufferGeometry } from 'three';

/** A hemisphere's pial and white surfaces, which share triangles and vertex indexing, and a label per vertex. */
export interface RibbonSurfaces {
  faces: ArrayLike<number>;
  pial: Float32Array;
  white: Float32Array;
  labels: Uint16Array;
}

/** The most common label on a triangle; the lowest wins a tie, as the build does. */
function owner(labels: Uint16Array, a: number, b: number, c: number): number {
  if (labels[a] === labels[b] || labels[a] === labels[c]) return labels[a]!;
  if (labels[b] === labels[c]) return labels[b]!;
  return Math.min(labels[a]!, labels[b]!, labels[c]!);
}

/**
 * One closed solid per parcel: its pial patch, its white patch reversed, and a
 * wall joining the two along the patch boundary.
 *
 * A wall triangle has to traverse its shared edge opposite to the patch that
 * owns it. Mirror the two wall triangles and every wedge comes out winding
 * inconsistent, which the stencil counts as a hole rather than a solid.
 *
 * `local` maps a surface vertex to its index in the patch. It holds -1 for
 * every vertex on entry and again on return, so parcels can share it.
 */
function wedge(
  triangles: Uint32Array,
  pial: Float32Array,
  white: Float32Array,
  local: Int32Array,
): BufferGeometry {
  const patch = new Uint32Array(triangles.length);
  const sources = new Uint32Array(triangles.length);
  let count = 0;
  for (let at = 0; at < triangles.length; at++) {
    const source = triangles[at]!;
    let index = local[source]!;
    if (index < 0) {
      index = local[source] = count;
      sources[count++] = source;
    }
    patch[at] = index;
  }

  const position = new Float32Array(count * 6);
  for (let index = 0; index < count; index++) {
    const source = sources[index]!;
    local[source] = -1;
    for (let axis = 0; axis < 3; axis++) {
      position[index * 3 + axis] = pial[source * 3 + axis]!;
      position[(count + index) * 3 + axis] = white[source * 3 + axis]!;
    }
  }

  // Each corner starts a directed edge to the next corner of its triangle,
  // listed by start vertex. An edge no triangle runs backwards is on the boundary.
  const next = (corner: number) => patch[corner - (corner % 3) + ((corner + 1) % 3)]!;
  const first = new Uint32Array(count + 1);
  for (let corner = 0; corner < patch.length; corner++) first[patch[corner]! + 1]!++;
  for (let index = 0; index < count; index++) first[index + 1]! += first[index]!;
  const filled = first.slice(0, count);
  const ends = new Uint32Array(patch.length);
  for (let corner = 0; corner < patch.length; corner++) {
    ends[filled[patch[corner]!]!++] = next(corner);
  }
  const boundary = new Uint8Array(patch.length);
  let walls = 0;
  for (let corner = 0; corner < patch.length; corner++) {
    const start = patch[corner]!;
    const end = next(corner);
    let at = first[end]!;
    const stop = first[end + 1]!;
    while (at < stop && ends[at] !== start) at++;
    if (at === stop) {
      boundary[corner] = 1;
      walls++;
    }
  }

  // The 16-bit type `setIndex` picks for a plain array unless an index reaches 65535.
  const index = new (2 * count - 1 >= 65535 ? Uint32Array : Uint16Array)(
    2 * patch.length + 6 * walls,
  );
  let length = 0;
  for (let i = 0; i < patch.length; i += 3) {
    const [a, b, c] = [patch[i]!, patch[i + 1]!, patch[i + 2]!];
    index[length++] = a;
    index[length++] = b;
    index[length++] = c;
    index[length++] = c + count;
    index[length++] = b + count;
    index[length++] = a + count;
    for (let corner = i; corner < i + 3; corner++) {
      if (!boundary[corner]) continue;
      const start = patch[corner]!;
      const end = next(corner);
      index[length++] = end;
      index[length++] = start;
      index[length++] = start + count;
      index[length++] = end;
      index[length++] = start + count;
      index[length++] = end + count;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setIndex(new BufferAttribute(index, 1));
  geometry.computeBoundingBox();
  return geometry;
}

/**
 * Close the cortical ribbon into one solid per parcel.
 *
 * Pial and white share triangles and vertex indexing, so a patch taken from one
 * is the same patch on the other and the wall is a quad per boundary edge. The
 * parcel boundary is therefore geometry, not a sampled 1 mm grid.
 */
export function buildRibbonWedges({
  faces,
  pial,
  white,
  labels,
}: RibbonSurfaces): Map<number, BufferGeometry> {
  if (pial.length !== white.length || pial.length !== labels.length * 3) {
    throw new Error('Ribbon surfaces must share one labelled vertex set.');
  }
  // Each triangle's parcel, and each parcel's triangles in face order; parcels in the order they first appear.
  const owners = new Uint16Array(faces.length / 3);
  const sizes = new Uint32Array(1 << 16);
  const order: number[] = [];
  for (let triangle = 0; triangle < owners.length; triangle++) {
    const at = triangle * 3;
    const label = owner(labels, faces[at]!, faces[at + 1]!, faces[at + 2]!);
    owners[triangle] = label;
    if (sizes[label]!++ === 0) order.push(label);
  }
  const parcels = new Map(order.map((label) => [label, new Uint32Array(sizes[label]! * 3)]));
  const filled = new Uint32Array(1 << 16);
  for (let triangle = 0; triangle < owners.length; triangle++) {
    const label = owners[triangle]!;
    const triangles = parcels.get(label)!;
    for (let corner = triangle * 3; corner < triangle * 3 + 3; corner++) {
      triangles[filled[label]!++] = faces[corner]!;
    }
  }
  const local = new Int32Array(labels.length).fill(-1);
  return new Map(
    [...parcels].map(([label, triangles]) => [label, wedge(triangles, pial, white, local)]),
  );
}
