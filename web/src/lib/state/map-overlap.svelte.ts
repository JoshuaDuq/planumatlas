import { domainPaint } from '../core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains } from '../core/catalog/neuropsych-domains.ts';
import { comparesMap, MAP_OVERLAP } from '../core/state/paint.ts';
import type { PaintState } from '../core/state/paint.ts';
import type { OverlapAreas } from '../core/user-map/overlap.ts';
import type { EngineUserMap } from '../engine/api.ts';
import type { UserMapStore } from './user-map.svelte.ts';

/** What the open function's profile says of the reader's map drawn against it. */
export interface MapOverlapFacts {
  title: string;
  threshold: number;
  /** Null until measured for the map, threshold and paint drawn now. */
  areas: OverlapAreas | null;
}

/**
 * The reader's drawn map against the open function: the engine draws it in the overlap colours while
 * `comparesMap` holds, and the cortex both cover is measured for each map, threshold and paint drawn.
 */
export function createMapOverlap({
  engine,
  view,
  userMap,
  domains,
}: {
  engine: Pick<EngineUserMap, 'setOverlap' | 'overlapAreas'>;
  view: { readonly current: PaintState };
  userMap: Pick<UserMapStore, 'drawn' | 'placed' | 'settings' | 'title'>;
  domains: NeuropsychDomains;
}) {
  const on = $derived(comparesMap(view.current, userMap.drawn, domains));
  // The painted areas, as `paintFor` paints them, and what a measurement is of.
  const asked = $derived.by(() => {
    if (!on) return null;
    const { selectedFunction, atlas, paintFrom } = view.current;
    const paint = domainPaint(domains, selectedFunction!, atlas, paintFrom ?? domains.threshold_z);
    return {
      key: JSON.stringify([paint.id, atlas, userMap.placed, userMap.settings.threshold]),
      regions: [...paint.colors.keys()],
    };
  });
  let measured = $state.raw<{ key: string; areas: OverlapAreas } | null>(null);

  $effect.pre(() => engine.setOverlap(on ? MAP_OVERLAP : null));
  $effect(() => {
    if (!asked) return;
    const { key, regions } = asked;
    let current = true;
    engine.overlapAreas(regions).then(
      (areas) => {
        if (current) measured = { key, areas };
      },
      (error: unknown) => {
        if (current) console.error(error);
      },
    );
    return () => {
      current = false;
    };
  });

  return {
    get current(): MapOverlapFacts | null {
      if (!asked) return null;
      return {
        title: userMap.title,
        threshold: userMap.settings.threshold,
        areas: measured?.key === asked.key ? measured.areas : null,
      };
    },
  };
}

export type MapOverlap = ReturnType<typeof createMapOverlap>;
