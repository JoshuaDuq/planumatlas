import type { RenderItem } from 'three';

/**
 * Focus draws everything but the selection as a ghost (brain-atlas.ts). Translucent layers that all
 * blend pile into a fog, so a deep ghost is drawn after every other translucent surface, nearest
 * first and writing depth: each pixel takes one of them. The cortex's ghost comes last, blending over
 * them without writing depth, so what lies beneath it still shows.
 */
export const GHOST = { none: 0, deep: 1, cortex: 2 } as const;
export type Ghost = (typeof GHOST)[keyof typeof GHOST];

const ghostOf = (item: RenderItem): Ghost => (item.object.userData['ghost'] as Ghost) ?? GHOST.none;

/** three.js's own translucent order (reversePainterSortStable), with ghosts drawn as above. */
export function transparentOrder(a: RenderItem, b: RenderItem): number {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  const ghost = ghostOf(a);
  if (ghost !== ghostOf(b)) return ghost - ghostOf(b);
  if (a.z !== b.z) return ghost === GHOST.deep ? a.z - b.z : b.z - a.z;
  return a.id - b.id;
}
