import { flushSync } from 'svelte';
import { describe, expect, test } from 'vitest';
import type { CircuitSessionState } from '../core/learning/session.ts';
import type { BodyPart } from '../types/index.ts';
import { createBodyMapStore, syncBodyMap } from './body-map.svelte.ts';
import type { ViewStore } from './view.svelte.ts';

const CLOSED: CircuitSessionState = { circuit: null, step: 0, visited: [], route: false };
const OPEN: CircuitSessionState = { ...CLOSED, map: 'body-map' };

function fixture(fails = false) {
  const shown: (BodyPart | 'all' | null)[] = [];
  const failures: unknown[] = [];
  const bodyMap = {
    available: true,
    show: async (part: BodyPart | 'all' | null) => {
      shown.push(part);
      if (fails) throw new Error('HTTP 503');
    },
  };
  let current = $state({ explorer: 'anatomy', lesson: CLOSED });
  const view = {
    get current() {
      return current;
    },
  } as unknown as ViewStore;
  const store = createBodyMapStore();
  const stop = $effect.root(() =>
    syncBodyMap(bodyMap, view, store, (error) => failures.push(error)),
  );
  flushSync();
  return {
    shown,
    failures,
    store,
    stop,
    set(explorer: string, lesson: CircuitSessionState) {
      current = { explorer, lesson };
      flushSync();
    },
  };
}

describe('BODY-03 the stage draws the body map exactly while it is open in front, on the part picked', () => {
  test('drawn on opening, redrawn for a new part, lifted when the map closes or another tab comes in front', () => {
    const { shown, store, set, stop } = fixture();
    expect(shown).toEqual([]);
    set('circuits', OPEN);
    expect(shown).toEqual(['all']);
    store.choose('hand');
    flushSync();
    expect(shown).toEqual(['all', 'hand']);
    set('anatomy', OPEN);
    expect(shown).toEqual(['all', 'hand', null]);
    // The part is the reader's, kept for the next opening.
    set('circuits', OPEN);
    expect(shown.at(-1)).toBe('hand');
    set('circuits', { ...CLOSED, map: 'visual-field', dot: { x: 1, y: 1, radius: 1 } });
    expect(shown.at(-1)).toBeNull();
    stop();
  });

  test('another change of the view redraws nothing', () => {
    const { shown, set, stop } = fixture();
    set('circuits', OPEN);
    set('circuits', { ...OPEN });
    expect(shown).toEqual(['all']);
    stop();
  });

  test('a failed download is reported, not swallowed', async () => {
    const { failures, set, stop } = fixture(true);
    set('circuits', OPEN);
    await Promise.resolve();
    await Promise.resolve();
    expect(failures).toHaveLength(1);
    expect((failures[0] as Error).message).toBe('HTTP 503');
    stop();
  });

  test('an anatomy without the map draws nothing', () => {
    const shown: unknown[] = [];
    const view = { current: { explorer: 'circuits', lesson: OPEN } } as unknown as ViewStore;
    const stop = $effect.root(() =>
      syncBodyMap(
        { available: false, show: async (part) => void shown.push(part) },
        view,
        createBodyMapStore(),
        () => undefined,
      ),
    );
    flushSync();
    expect(shown).toEqual([]);
    stop();
  });
});
