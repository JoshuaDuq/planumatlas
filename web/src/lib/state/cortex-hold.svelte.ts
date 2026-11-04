/**
 * The cortex made see-through for what is drawn inside it: a lesion's tract, stroke cases. Each asks
 * under its own name; the first to ask while the cortex is opaque takes its opacity, the others join,
 * and the last to let go gives it back, unless the reader has changed it meanwhile.
 */
export function createCortexHold(cortex: {
  readonly opacity: number;
  setOpacity(opacity: number): void;
}) {
  const owners = new Set<string>();
  // The reader's opacity before the first owner, and the see-through one put in its place.
  let held = $state<{ opacity: number; seeThrough: number } | null>(null);
  let count = $state(0);

  return {
    /** The reader's own opacity while the hold still shows the see-through one, for a link to carry. */
    get held(): number | null {
      return held && cortex.opacity === held.seeThrough ? held.opacity : null;
    },
    owns(owner: string): boolean {
      void count;
      return owners.has(owner);
    },
    acquire(owner: string, seeThrough: number): void {
      if (owners.has(owner)) return;
      if (!owners.size && cortex.opacity === 1) {
        held = { opacity: 1, seeThrough };
        cortex.setOpacity(seeThrough);
      }
      owners.add(owner);
      count = owners.size;
    },
    release(owner: string): void {
      if (!owners.delete(owner)) return;
      count = owners.size;
      if (owners.size) return;
      if (held && cortex.opacity === held.seeThrough) cortex.setOpacity(held.opacity);
      held = null;
    },
  };
}

export type CortexHold = ReturnType<typeof createCortexHold>;
