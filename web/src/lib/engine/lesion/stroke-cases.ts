import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import type { Plane } from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { COMPARE_COLORS, SHARED_COLOR } from '../../core/catalog/neuropsych-domains.ts';
import type { StrokeCases } from '../../core/catalog/stroke-cases.ts';
import { token } from '../render/tokens.ts';
import { rasToWorld } from '../slices/coordinates.ts';

// A Gaussian of σ ≈ 0.85 voxel, applied along each axis, rounds the 1 mm staircase. It is then kept
// voxel-safe: every voxel of the set stays above the surface's level and every other voxel below it,
// so smoothing never moves the surface across a voxel centre: a sheet one voxel thin survives, drawn
// thinner than it is, and a one-voxel gap stays open. The bounds sit just either side of the level,
// so they change only voxels smoothing would flip; a 0.75/0.25 pair also moved every flat boundary
// onto the voxel faces and drew a staircase (2026-11-04).
const KERNEL = [0.06, 0.24, 0.4, 0.24, 0.06] as const;
const MARGIN = KERNEL.length;
const ISOLATION = 0.5;
const INSIDE_MIN = 0.55;
const OUTSIDE_MAX = 0.45;

/** One case's voxels, flat Fortran-order indices on the masks' grid, from its runs. */
export function voxelsOf(masks: Uint32Array, runs: readonly [number, number]): Set<number> {
  const set = new Set<number>();
  for (let i = runs[0]; i < runs[0] + runs[1]; i += 2) {
    for (let k = 0; k < masks[i + 1]!; k++) set.add(masks[i]! + k);
  }
  return set;
}

/** Two lesions as the first's voxels alone, the second's alone, and both: three disjoint sets. */
export function partitionPair(
  a: Set<number>,
  b: Set<number>,
): [Set<number>, Set<number>, Set<number>] {
  const onlyA = new Set<number>();
  const both = new Set<number>();
  for (const voxel of a) (b.has(voxel) ? both : onlyA).add(voxel);
  const onlyB = new Set<number>();
  for (const voxel of b) if (!a.has(voxel)) onlyB.add(voxel);
  return [onlyA, onlyB, both];
}

/** Positions (surface RAS, mm) of the smoothed 0.5 surface of a voxel set, as unindexed triangles. */
export function surfaceOf(
  voxels: Set<number>,
  shape: readonly [number, number, number],
  voxelToRas: Matrix4,
): Float32Array {
  const [nx, ny] = shape;
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (const index of voxels) {
    const p = [index % nx, Math.floor(index / nx) % ny, Math.floor(index / (nx * ny))];
    for (let axis = 0; axis < 3; axis++) {
      low[axis] = Math.min(low[axis]!, p[axis]!);
      high[axis] = Math.max(high[axis]!, p[axis]!);
    }
  }
  const size = Math.max(...high.map((h, axis) => h - low[axis]! + 1)) + 2 * MARGIN;
  const origin = low.map((value) => value - MARGIN);
  let field = new Float32Array(size * size * size);
  for (const index of voxels) {
    const x = (index % nx) - origin[0]!;
    const y = (Math.floor(index / nx) % ny) - origin[1]!;
    const z = Math.floor(index / (nx * ny)) - origin[2]!;
    field[x + size * (y + size * z)] = 1;
  }
  const member = field.slice();
  let scratch = new Float32Array(field.length);
  const half = (KERNEL.length - 1) / 2;
  for (const stride of [1, size, size * size]) {
    scratch.fill(0);
    for (let i = 0; i < field.length; i++) {
      let sum = 0;
      for (let k = -half; k <= half; k++) {
        const j = i + k * stride;
        if (j >= 0 && j < field.length) sum += KERNEL[k + half]! * field[j]!;
      }
      scratch[i] = sum;
    }
    [field, scratch] = [scratch, field];
  }
  for (let i = 0; i < field.length; i++) {
    field[i] = member[i] ? Math.max(field[i]!, INSIDE_MIN) : Math.min(field[i]!, OUTSIDE_MAX);
  }
  // The surface runs along the boundary: a few triangles per boundary voxel face.
  const strides = [1, nx, nx * ny];
  let faces = 0;
  for (const index of voxels) {
    for (const stride of strides)
      faces += +!voxels.has(index + stride) + +!voxels.has(index - stride);
  }
  const capacity = 4 * faces + 10_000;
  // Only the geometry is read; the object's own material is never drawn.
  const unused = new MeshBasicMaterial();
  const cubes = new MarchingCubes(size, unused, false, false, capacity);
  cubes.isolation = ISOLATION;
  cubes.field.set(field);
  cubes.update();
  // MarchingCubes writes past its buffer silently; a surface that does not fit would come back cut.
  if (cubes.count > capacity * 3)
    throw new Error(`A lesion surface needs more than ${capacity} triangles.`);
  const positions = new Float32Array(cubes.count * 3);
  const point = new Vector3();
  const middle = size / 2;
  for (let v = 0; v < cubes.count; v++) {
    // The cubes span [-1, 1] over the field: back to the field's voxels, then the masks' grid, then RAS.
    point
      .set(
        cubes.positionArray[v * 3]! * middle + middle + origin[0]!,
        cubes.positionArray[v * 3 + 1]! * middle + middle + origin[1]!,
        cubes.positionArray[v * 3 + 2]! * middle + middle + origin[2]!,
      )
      .applyMatrix4(voxelToRas);
    positions.set([point.x, point.y, point.z], v * 3);
  }
  cubes.geometry.dispose();
  unused.dispose();
  return positions;
}

function solid(positions: Float32Array, color: Color, planes: readonly Plane[]): Mesh {
  const world = new Float32Array(positions.length);
  for (let v = 0; v < positions.length; v += 3) {
    const point = rasToWorld([positions[v]!, positions[v + 1]!, positions[v + 2]!]);
    world.set([point.x, point.y, point.z], v);
  }
  let geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(world, 3));
  geometry = mergeVertices(geometry, 1e-7);
  geometry.computeVertexNormals();
  // Both faces: a cut opens the solid, and its inside should read as the lesion, not as a hole.
  const material = new MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0,
    side: DoubleSide,
  });
  material.clippingPlanes = [...planes];
  return new Mesh(geometry, material);
}

const rgb = ([r, g, b]: readonly number[]) => new Color(`rgb(${r}, ${g}, ${b})`);

/** The stage's stroke lesions: one person's alone, or two as each one's own and their shared voxels. */
export function createStrokeCaseSolids({
  planes,
  invalidate,
}: {
  planes: () => readonly Plane[];
  invalidate: () => void;
}) {
  const group = new Group();
  let single: Mesh | null = null;

  function clear() {
    for (const child of [...group.children] as Mesh[]) {
      group.remove(child);
      child.geometry.dispose();
      (child.material as MeshStandardMaterial).dispose();
    }
    single = null;
  }

  return {
    group,
    show(data: StrokeCases, masks: Uint32Array, ids: readonly string[]) {
      clear();
      const entries = ids.map((id) => {
        const entry = data.cases.find((candidate) => candidate.id === id);
        if (!entry) throw new Error(`No stroke case ${id}.`);
        return voxelsOf(masks, entry.runs);
      });
      if (entries.length > 2) throw new RangeError('At most two stroke cases are drawn at once.');
      const toRas = new Matrix4().set(
        ...(data.masks.voxel_to_surface_ras_mm.flat() as Parameters<Matrix4['set']>),
      );
      const sets: [Set<number>, Color][] =
        entries.length === 1
          ? [[entries[0]!, new Color(token('--overlay-ink'))]]
          : entries.length === 2
            ? partitionPair(entries[0]!, entries[1]!).map(
                (set, index) =>
                  [set, rgb([...COMPARE_COLORS, SHARED_COLOR][index]!)] as [Set<number>, Color],
              )
            : [];
      // Every solid is built before any is shown, so a failure leaves none half drawn.
      const meshes = sets
        .filter(([set]) => set.size)
        .map(([set, color]) => solid(surfaceOf(set, data.masks.shape, toRas), color, planes()));
      group.add(...meshes);
      if (entries.length === 1) single = meshes[0] ?? null;
      invalidate();
    },
    clear() {
      clear();
      invalidate();
    },
    /** The cut moved: the solids are clipped as the cortex is. */
    refresh() {
      for (const child of group.children as Mesh[]) {
        (child.material as MeshStandardMaterial).clippingPlanes = [...planes()];
      }
    },
    applyTheme() {
      (single?.material as MeshStandardMaterial | undefined)?.color.set(token('--overlay-ink'));
    },
    dispose: clear,
  };
}
