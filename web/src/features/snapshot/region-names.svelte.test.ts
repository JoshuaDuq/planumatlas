// A saved image names what the stage names: names on the brain are measured into the snapshot's markings
// as the route's landmark labels are, each with its dot, its leader and its words.
import '../../styles/index.css';
import { afterEach, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import { page } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../test/fixtures/cdmd-manifest.json' with { type: 'json' };
import { createFakeEngine } from '../../lib/engine/fake.ts';
import { createStageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { snapshotMarkings } from './markings.ts';
import type { StageKeysModel } from './markings.ts';
import Fixture from './snapshot-test-support.svelte';

const cleanups: (() => void)[] = [];
afterEach(async () => {
  cleanup();
  for (const stop of cleanups.splice(0)) stop();
  await page.viewport(1280, 800);
});

test('a saved image draws each name on the brain where the stage draws it, and none while they are off', async () => {
  await page.viewport(1280, 900);
  const engine = createFakeEngine({
    manifest: manifest as unknown as Manifest,
    hostSize: { width: 1000, height: 700 },
  });
  const live = $state({
    lang: 'en' as const,
    status: 'ready' as const,
    surfaceColor: 'atlas' as const,
    networks: null,
    legend: null,
    marks: [],
    names: true,
  });
  const handle: { keys?: StageKeysModel } = {};
  let stage!: StageLayout;
  cleanups.push(
    $effect.root(() => {
      stage = createStageLayout({ media: { phone: false }, storage: null });
    }),
  );
  render(Fixture, { engine, stage, live, handle, width: 1000, height: 700 });
  flushSync();
  await vi.waitFor(() => expect(stage.visibleRect).not.toBeNull());
  const host = document.querySelector<HTMLElement>('#viewport')!;
  const names = () =>
    [...host.querySelectorAll<HTMLElement>('.region-name')].filter(
      (node) => node.dataset.placed === 'true',
    );
  await vi.waitFor(() => expect(names().length).toBeGreaterThan(2));

  const markings = () => snapshotMarkings(host, stage.visibleRect!, { stage, keys: handle.keys! });
  const origin = host.getBoundingClientRect();
  const crop = stage.visibleRect!;
  const labels = markings().labels;
  expect(labels).toHaveLength(names().length);
  names().forEach((node, index) => {
    const label = labels[index]!;
    expect(label.lines.map((line) => line.text).join(' ')).toBe(
      node.textContent!.trim().replace(/\s+/g, ' '),
    );
    const dot = node.querySelector('.stage-label-dot')!.getBoundingClientRect();
    expect(label.dot.x).toBeCloseTo(dot.left + dot.width / 2 - origin.left - crop.x, 3);
    expect(label.dot.y).toBeCloseTo(dot.top + dot.height / 2 - origin.top - crop.y, 3);
    expect(label.leader === null).toBe(node.dataset.leader !== 'true');
    // The landmarks' name weight, in the stage's type.
    expect(label.lines[0]!.font).toMatch(/^500 14px/);
  });

  live.names = false;
  flushSync();
  expect(markings().labels).toEqual([]);
});
