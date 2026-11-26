// The body map's state and commands for the Circuits tab: opening it and the part shown. `BodyMap` draws it.
import { tick } from 'svelte';
import type { Excursions } from '../../lib/controller/excursion.svelte.ts';
import { bodyMapOpen } from '../../lib/state/body-map.svelte.ts';
import type { BodyMapStore } from '../../lib/state/body-map.svelte.ts';
import type { ViewStore } from '../../lib/state/view.svelte.ts';
import type { BodyMap, BodyPart } from '../../lib/types/index.ts';
import { scrollToTop } from '../../lib/ui/scroll.ts';
import { loadBodyMapPanel } from './body-map-panel.svelte.ts';

export interface BodyMapExplorerDeps {
  view: Pick<ViewStore, 'current'>;
  excursions: Pick<Excursions, 'openBodyMap'>;
  store: BodyMapStore;
  /** The manifest's record, or null on an anatomy that publishes no body map. */
  record: BodyMap | null;
}

export function createBodyMapExplorer({ view, excursions, store, record }: BodyMapExplorerDeps) {
  let title: HTMLElement | null = null;
  const open = $derived(bodyMapOpen(view.current));

  return {
    available: record !== null,
    get lang() {
      return view.current.lang;
    },
    get open() {
      return open;
    },
    get record() {
      return record!;
    },
    get part() {
      return store.part;
    },
    choose(part: BodyPart | 'all') {
      store.choose(part);
    },

    /** Opens the map at its top, its title taking focus, as the visual field map does. */
    async openMap() {
      // The panel's code first, so its title is there to take focus once the map opens.
      await loadBodyMapPanel();
      await excursions.openBodyMap();
      await tick();
      // A newer scene command overtook the opening: no map, nothing to focus.
      if (!open) return;
      if (!title) throw new Error('The body map is not mounted.');
      scrollToTop(title);
      title.focus({ preventScroll: true });
    },

    attachTitle(element: HTMLElement) {
      title = element;
      return () => {
        if (title === element) title = null;
      };
    },
  };
}

export type BodyMapExplorer = ReturnType<typeof createBodyMapExplorer>;
