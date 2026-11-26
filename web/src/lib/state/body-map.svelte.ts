import { untrack } from 'svelte';
import type { EngineBodyMap } from '../engine/api.ts';
import type { BodyPart } from '../types/index.ts';
import type { View, ViewStore } from './view.svelte.ts';

/** The body map is drawn while it is open in front on Circuits. */
export const bodyMapOpen = ({ explorer, lesson }: Pick<View, 'explorer' | 'lesson'>) =>
  explorer === 'circuits' && lesson.map === 'body-map';

/** The part the reader picked, every part or one alone, kept as the map closes and opens. */
export function createBodyMapStore() {
  let part = $state<BodyPart | 'all'>('all');
  return {
    get part() {
      return part;
    },
    choose(next: BodyPart | 'all') {
      part = next;
    },
  };
}

export type BodyMapStore = ReturnType<typeof createBodyMapStore>;

/** The stage draws the map, on the part picked, exactly while the map is open in front. */
export function syncBodyMap(
  bodyMap: Pick<EngineBodyMap, 'available' | 'show'>,
  view: Pick<ViewStore, 'current'>,
  store: Pick<BodyMapStore, 'part'>,
  fail: (error: unknown) => void,
) {
  if (!bodyMap.available) return;
  let drawn: BodyPart | 'all' | null = null;
  $effect(() => {
    const part = bodyMapOpen(view.current) ? store.part : null;
    untrack(() => {
      if (part === drawn) return;
      drawn = part;
      bodyMap.show(part).catch(fail);
    });
  });
}
