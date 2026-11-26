import { flushSync } from 'svelte';
import { expect, test } from 'vitest';
import type { NeuropsychDomains } from '../core/catalog/neuropsych-domains.ts';
import { MAP_OVERLAP } from '../core/state/paint.ts';
import type { PaintState } from '../core/state/paint.ts';
import type { MapOverlap as Colours } from '../core/user-map/display.ts';
import type { OverlapAreas } from '../core/user-map/overlap.ts';
import type { EngineMapSlot } from '../engine/api.ts';
import { createMapOverlap } from './map-overlap.svelte.ts';

const domains = {
  atlas: 'hcp-mmp',
  units: {},
  domains: [{ id: 'memory', name: 'Memory', name_fr: 'Mémoire', overview: true, color: [1, 2, 3] }],
  regions: {
    'hcp-mmp:left:1': [{ domain: 'memory', z: 7 }],
    'hcp-mmp:left:2': [{ domain: 'memory', z: 4 }],
  },
  threshold_z: 3,
  region_atlases: [],
  atlas_regions: {},
  z_scale: [
    { from: 3, color: [30, 30, 30] },
    { from: 5, color: [50, 50, 50] },
  ],
} as unknown as NeuropsychDomains;

function setup() {
  const view = $state<{ current: PaintState }>({
    current: {
      explorer: 'functions',
      atlas: 'hcp-mmp',
      selectedFunction: 'memory',
      selectedDeficit: null,
      selectedFinding: null,
      paintLifted: false,
      paintFrom: null,
      connectivitySeed: null,
      disorderShown: null,
      lang: 'en',
    },
  });
  const drawn = (slot: number, title: string) => ({
    slot,
    placed: 1,
    settings: { threshold: 3, max: 8, opacity: 1, colours: 'red-yellow' as const },
    title,
  });
  const userMap = $state({ drawnMaps: [drawn(0, 'zstat1')] });
  const overlaps: (Colours | null)[] = [];
  const asked: {
    slot: number;
    regions: readonly string[];
    resolve: (areas: OverlapAreas) => void;
  }[] = [];
  const engine = {
    setOverlap: (overlap: Colours | null) => void overlaps.push(overlap),
    maps: [0, 1].map((slot) => ({
      overlapAreas: (regions: readonly string[]) =>
        new Promise<OverlapAreas>((resolve) => asked.push({ slot, regions, resolve })),
    })) as unknown as EngineMapSlot[],
  };
  let store!: ReturnType<typeof createMapOverlap>;
  const stop = $effect.root(() => {
    store = createMapOverlap({ engine, view, userMap, domains });
  });
  flushSync();
  return { view, userMap, drawn, overlaps, asked, store, stop };
}

const settled = () => new Promise((resolve) => setTimeout(resolve));

test('FUNC-54 · a drawn map is drawn against one function and measured over the areas it paints', async () => {
  const { view, userMap, overlaps, asked, store, stop } = setup();
  expect(overlaps).toEqual([MAP_OVERLAP]);
  expect(asked.map((ask) => ask.regions)).toEqual([['hcp-mmp:left:1', 'hcp-mmp:left:2']]);
  expect(store.current).toEqual({ title: 'zstat1', threshold: 3, areas: null });
  asked[0]!.resolve({ map: 10, function: 40, both: 5 });
  await settled();
  expect(store.current!.areas).toEqual({ map: 10, function: 40, both: 5 });

  // A raised paint threshold paints, and so measures, fewer areas.
  view.current = { ...view.current, paintFrom: 5 };
  flushSync();
  expect(asked.at(-1)!.regions).toEqual(['hcp-mmp:left:1']);
  expect(store.current!.areas).toBeNull();

  // A new extent is measured again; the answer for the one before it, arriving last, is dropped.
  userMap.drawnMaps[0]!.placed = 2;
  flushSync();
  asked.at(-1)!.resolve({ map: 10, function: 20, both: 2 });
  await settled();
  asked.at(-2)!.resolve({ map: 1, function: 1, both: 1 });
  await settled();
  expect(store.current!.areas).toEqual({ map: 10, function: 20, both: 2 });

  userMap.drawnMaps = [];
  flushSync();
  expect(overlaps.at(-1)).toBeNull();
  expect(store.current).toBeNull();
  stop();
});

test('FUNC-63 · two drawn maps are not drawn against the function; the one left alone is, from its own slot', async () => {
  const { userMap, drawn, overlaps, asked, store, stop } = setup();
  userMap.drawnMaps = [drawn(1, 'mask'), drawn(0, 'zstat1')];
  flushSync();
  expect(overlaps.at(-1)).toBeNull();
  expect(store.current).toBeNull();
  const before = asked.length;
  userMap.drawnMaps = [drawn(1, 'mask')];
  flushSync();
  expect(overlaps.at(-1)).toEqual(MAP_OVERLAP);
  expect(asked.slice(before).map(({ slot }) => slot)).toEqual([1]);
  expect(store.current).toEqual({ title: 'mask', threshold: 3, areas: null });
  stop();
});
