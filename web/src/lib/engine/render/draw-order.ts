import { DoubleSide, Mesh, MeshBasicMaterial } from 'three';
import type { BufferGeometry, Material, RenderItem } from 'three';

/**
 * Focus draws everything but the selection as a ghost (brain-atlas.ts). Translucent layers that all
 * blend pile into a fog, so a deep ghost is drawn after every other translucent surface, nearest
 * first and writing depth: each pixel takes one of them. The cortex's ghost comes last, blending over
 * them without writing depth, so what lies beneath it still shows.
 */
export const GHOST = { none: 0, deep: 1, cortex: 2 } as const;
export type Ghost = (typeof GHOST)[keyof typeof GHOST];

/**
 * Where a translucent surface falls among the rest. A translucent cortex, ghost or not, is drawn
 * last, after its depth: its triangles are not sorted, so without that a far fold blended over a
 * near one wherever it came later in the mesh, a speckle that grew with the opacity.
 */
export const TRANSLUCENT = { surface: 0, deepGhost: 1, cortexDepth: 2, cortex: 3 } as const;
export type Translucent = (typeof TRANSLUCENT)[keyof typeof TRANSLUCENT];

const rankOf = (item: RenderItem): Translucent =>
  (item.object.userData['translucent'] as Translucent) ?? TRANSLUCENT.surface;

/** three.js's own translucent order (reversePainterSortStable), with the ranks above. */
export function transparentOrder(a: RenderItem, b: RenderItem): number {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  const rank = rankOf(a);
  if (rank !== rankOf(b)) return rank - rankOf(b);
  if (a.z !== b.z) return rank === TRANSLUCENT.deepGhost ? a.z - b.z : b.z - a.z;
  return a.id - b.id;
}

const depthTwins = new WeakMap<Mesh, Mesh<BufferGeometry, MeshBasicMaterial>>();

/**
 * While `mesh` is a translucent cortex, a child draws its depth alone just before it, so it blends
 * only its nearest fold over what lies beneath. Offset back a step: the two programs need not
 * compute the same depth to the last bit.
 */
export function drawDepthFirst(mesh: Mesh<BufferGeometry, Material>, on: boolean): void {
  let twin = depthTwins.get(mesh);
  if (!on) {
    twin?.removeFromParent();
    return;
  }
  if (!twin) {
    twin = new Mesh(
      mesh.geometry,
      new MeshBasicMaterial({
        colorWrite: false,
        side: DoubleSide,
        transparent: true,
        forceSinglePass: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    twin.userData['translucent'] = TRANSLUCENT.cortexDepth;
    // Picking names regions; the twin has none.
    twin.raycast = () => {};
    depthTwins.set(mesh, twin);
  }
  const { clippingPlanes } = mesh.material;
  if (twin.material.clippingPlanes !== clippingPlanes) {
    twin.material.clippingPlanes = clippingPlanes;
    twin.material.needsUpdate = true;
  }
  if (twin.parent !== mesh) mesh.add(twin);
}

const cortical = (item: RenderItem): number => (item.object.userData['cortical'] ? 0 : 1);
// three.js numbers every material as it is created; its types leave the number out.
const materialId = (item: RenderItem): number => (item.material as unknown as { id: number }).id;

/**
 * three.js's own opaque order (painterSortStable), with a cortical atlas drawn before the rest of its
 * order. Where a structure crosses the cortex, samples tie in depth and the later draw takes them;
 * three.js breaks that tie by material id, which follows whichever layer finished loading first. The
 * structure now takes them, as its cut face does over the ribbon's.
 */
export function opaqueOrder(a: RenderItem, b: RenderItem): number {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  if (cortical(a) !== cortical(b)) return cortical(a) - cortical(b);
  if (materialId(a) !== materialId(b)) return materialId(a) - materialId(b);
  if (a.materialVariant !== b.materialVariant) return a.materialVariant - b.materialVariant;
  if (a.z !== b.z) return a.z - b.z;
  return a.id - b.id;
}
