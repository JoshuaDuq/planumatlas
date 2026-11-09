import { Box3, Matrix4, Vector3 } from 'three';
import type { IUniform, Material, Mesh, Object3D } from 'three';
import type { MeshBVH } from 'three-mesh-bvh';

/**
 * Deep pieces expand radially by one common factor, preserving their anatomical directions.
 * Interlocking regions travel together. The hemispheres open along the brain's own left–right
 * axis just far enough to clear them. Every structure keeps its measured shape.
 *
 * Whatever reads the anatomy (a cut, a region lookup, the scan or a map sampled on a surface, a
 * picked coordinate) reads `anatomicalMatrixWorld`, never where the structure is drawn.
 */

/** Clearance, in metres, between an opened hemisphere and the internal anatomy. */
export const HEMISPHERE_GAP = 0.003;

/** Grow distances between internal pieces' centres by 60%, without scaling their surfaces. */
export const DEEP_SPREAD = 0.6;

/**
 * Move internal pieces radially. If that would cross or contain another piece, join them and
 * recompute their common offset. Each pass either reduces the piece count or finishes; no piece
 * is shuffled onto a different axis, and the caller caches this layout between frames.
 */
export function deepShifts(groups: readonly (readonly Mesh[])[]): Map<Mesh, Vector3> {
  const pieces = groups.map((meshes) => {
    const entries = meshes.map((mesh) => {
      const matrix = anatomicalMatrixWorld(mesh);
      return { mesh, box: restBox(mesh), matrix, inverse: matrix.clone().invert() };
    });
    return {
      entries,
      box: entries.reduce((box, entry) => box.union(entry.box), new Box3()),
    };
  });
  const centre = pieces
    .reduce((box, piece) => box.union(piece.box), new Box3())
    .getCenter(new Vector3());
  const shifted = new Box3();
  const relative = new Matrix4();
  let previousCount: number;
  do {
    previousCount = pieces.length;
    for (let i = 0; i < pieces.length; i++) {
      const a = pieces[i]!;
      for (let j = i + 1; j < pieces.length; j++) {
        const b = pieces[j]!;
        const delta = b.box
          .getCenter(new Vector3())
          .sub(a.box.getCenter(new Vector3()))
          .multiplyScalar(DEEP_SPREAD);
        if (!a.box.intersectsBox(shifted.copy(b.box).translate(delta))) continue;
        const overlap = a.entries.some((m) =>
          b.entries.some((n) => {
            shifted.copy(n.box).translate(delta);
            if (!m.box.intersectsBox(shifted)) return false;
            // Surface crossings alone miss a solid entirely enclosed by another.
            if (m.box.containsBox(shifted) || shifted.containsBox(m.box)) return true;
            relative.makeTranslation(delta).premultiply(m.inverse).multiply(n.matrix);
            return (m.mesh.geometry.boundsTree as MeshBVH).intersectsGeometry(
              n.mesh.geometry,
              relative,
            );
          }),
        );
        if (!overlap) continue;
        a.entries.push(...b.entries);
        a.box.union(b.box);
        pieces.splice(j--, 1);
      }
    }
  } while (pieces.length < previousCount);
  const shifts = new Map<Mesh, Vector3>();
  for (const { box, entries } of pieces) {
    const shift = box.getCenter(new Vector3()).sub(centre).multiplyScalar(DEEP_SPREAD);
    for (const { mesh } of entries) shifts.set(mesh, shift);
  }
  return shifts;
}

/**
 * The brain's own left–right axis, a unit vector toward its right: from the left hemisphere's vertex
 * centroid to the right's. On CDMD it is world x turned 2.6° of roll and 1.9° of yaw; the head's rotation
 * in its FreeSurfer MNI305 affine gives 2.6° and 2.4°. Box centres missed that yaw by 2°.
 */
export function leftRightAxis(left: readonly Mesh[], right: readonly Mesh[]): Vector3 {
  const matrix = new Matrix4();
  const centroid = (meshes: readonly Mesh[]) => {
    const sum = new Vector3();
    let count = 0;
    for (const mesh of meshes) {
      const position = mesh.geometry.getAttribute('position');
      const mean = new Vector3();
      for (let i = 0; i < position.count; i++) {
        mean.x += position.getX(i);
        mean.y += position.getY(i);
        mean.z += position.getZ(i);
      }
      mean.divideScalar(position.count).applyMatrix4(anatomicalMatrixWorld(mesh, matrix));
      sum.addScaledVector(mean, position.count);
      count += position.count;
    }
    if (!count) throw new Error('A hemisphere holds no cortical vertices.');
    return sum.divideScalar(count);
  };
  return centroid(right).sub(centroid(left)).normalize();
}

/** A box's extent along a unit axis: the least and greatest projections of its corners. */
function extentAlong(box: Box3, axis: Vector3): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const along = x * axis.x + y * axis.y + z * axis.z;
        min = Math.min(min, along);
        max = Math.max(max, along);
      }
    }
  }
  return [min, max];
}

/**
 * Move each hemisphere outward only as far as needed to leave `HEMISPHERE_GAP` from the deep anatomy.
 */
export function hemisphereShifts(
  left: Box3,
  right: Box3,
  deep: Box3,
  axis: Vector3,
): { left: Vector3; right: Vector3 } {
  const [, leftMax] = extentAlong(left, axis);
  const [rightMin] = extentAlong(right, axis);
  const [deepMin, deepMax] = extentAlong(deep, axis);
  return {
    left: axis.clone().multiplyScalar(Math.min(0, deepMin - HEMISPHERE_GAP - leftMax)),
    right: axis.clone().multiplyScalar(Math.max(0, deepMax + HEMISPHERE_GAP - rightMin)),
  };
}

/** A mesh's box where the anatomy has it. */
export function restBox(mesh: Mesh): Box3 {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox!.clone().applyMatrix4(anatomicalMatrixWorld(mesh));
}

/**
 * The shift a material's mesh is drawn at, in world metres, as the uniform its shaders read: a
 * surface that samples the scan or a map subtracts it to sample where it lies in the anatomy. One
 * material per mesh, so the material carries it.
 */
export function explodeShift(material: Material): IUniform<Vector3> {
  return (material.userData['explodeShift'] ??= { value: new Vector3() }) as IUniform<Vector3>;
}

/** GLSL: the shift's uniform, declared once though the scan and a map both extend one material. */
export const EXPLODE_SHIFT_UNIFORM = `#ifndef EXPLODE_SHIFT
#define EXPLODE_SHIFT
uniform vec3 explodeShift;
#endif
`;

/** GLSL: a vertex's world position in the anatomy, wherever the explode draws it. */
export const ANATOMICAL_WORLD = '((modelMatrix * vec4(transformed, 1.0)).xyz - explodeShift)';

/**
 * Draw `mesh` moved by `shift` (world metres) on top of its own node transform, and record the shift
 * on its material. Its parents are identities (a glTF root, the atlas group), so the shift is world.
 */
export function shiftMesh(mesh: Mesh, shift: Vector3): void {
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  const elements = mesh.matrix.elements;
  elements[12] += shift.x;
  elements[13] += shift.y;
  elements[14] += shift.z;
  explodeShift(mesh.material as Material).value.copy(shift);
}

/** Where `mesh` lies in the anatomy: its world matrix without the explode's shift. */
export function anatomicalMatrixWorld(mesh: Mesh, target = new Matrix4()): Matrix4 {
  mesh.updateWorldMatrix(true, false);
  target.copy(mesh.matrixWorld);
  const shift = (mesh.material as Material).userData['explodeShift'] as
    IUniform<Vector3> | undefined;
  if (shift) {
    target.elements[12] -= shift.value.x;
    target.elements[13] -= shift.value.y;
    target.elements[14] -= shift.value.z;
  }
  return target;
}

/** Where a picked point lies in the anatomy: the point less the shift of the mesh it was found on. */
export function anatomicalPoint({
  point,
  object,
}: {
  point: Vector3;
  object?: Object3D | undefined;
}): Vector3 {
  const material = (object as Mesh | undefined)?.material as Material | undefined;
  const shift = material?.userData['explodeShift'] as IUniform<Vector3> | undefined;
  return shift ? point.clone().sub(shift.value) : point.clone();
}
