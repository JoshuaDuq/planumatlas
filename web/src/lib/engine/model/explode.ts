import { Box3, Matrix4, Vector3 } from 'three';
import type { IUniform, Material, Mesh, Object3D } from 'three';

/**
 * The exploded view moves each structure whole and never reshapes it, so every surface stays the
 * measured one; only where it is drawn changes. The deep anatomy moves by system and side, each
 * piece's offset from the deep anatomy's own centre grown by `DEEP_SPREAD`: the arrangement is the
 * real one, scaled. The cerebral hemispheres slide apart sideways to stand one gap from the spread
 * anatomy on either side: each moves at least its own width, and the gap is at least `HEMISPHERE_GAP`.
 *
 * Whatever reads the anatomy (a cut, a region lookup, the scan or a map sampled on a surface, a
 * picked coordinate) reads `anatomicalMatrixWorld`, never where the structure is drawn.
 */

/** A deep piece's offset from the deep anatomy's centre grows by this share of itself. */
export const DEEP_SPREAD = 1;

/** The least room, in metres, between a hemisphere and the spread deep anatomy. */
export const HEMISPHERE_GAP = 0.01;

/** Systems that are one organ across the midline, moved whole rather than split by side. */
export const WHOLE_SYSTEMS: ReadonlySet<string> = new Set([
  'Brainstem',
  'Cerebellum',
  'Ventricles and CSF',
]);

/** The piece a deep structure moves with: its system, and its side unless the system is one organ. */
export const pieceOf = (system: string, hemisphere: string): string =>
  WHOLE_SYSTEMS.has(system) ? system : `${system} · ${hemisphere}`;

/**
 * The hemispheres' shifts along x (world x is anatomical right): each stands the same gap from the
 * spread deep anatomy (`deep`, as drawn exploded), the gap at least `HEMISPHERE_GAP` and wide enough that
 * each hemisphere moves at least its own width.
 */
export function hemisphereShifts(
  left: Box3,
  right: Box3,
  deep: Box3,
): { left: Vector3; right: Vector3 } {
  // Moved by its own width, a hemisphere's medial edge lands where its lateral edge lay.
  const gap = Math.max(HEMISPHERE_GAP, deep.min.x - left.min.x, right.max.x - deep.max.x);
  return {
    left: new Vector3(deep.min.x - gap - left.max.x, 0, 0),
    right: new Vector3(deep.max.x + gap - right.min.x, 0, 0),
  };
}

/** A deep piece's shift: its offset from the deep anatomy's centre, times `DEEP_SPREAD`. */
export const deepShift = (piece: Box3, centre: Vector3): Vector3 =>
  piece.getCenter(new Vector3()).sub(centre).multiplyScalar(DEEP_SPREAD);

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
