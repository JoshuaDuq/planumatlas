import { expect, onTestFinished, test, vi } from 'vitest';
import { defineStageContract } from './fake/contract-suite.ts';
import { bootEngine } from './real-engine-test-support.ts';

// Booting the engine parses 35 MB of GLB on a software GL context. The rest of the engine contract runs
// in the unit project (`index.contract.test.ts`); this file, snapshot.svelte.test.ts and
// atlas-reload.svelte.test.ts keep what needs real WebGL, split across files so Vitest shards balance.
vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const boot = () => bootEngine(1000, 700);

defineStageContract('real engine', boot);

test('FACADE-32 the outline programs are compiled before the start ends: a first selection compiles none', async () => {
  // The engine's own idle warm-up (Focus, T1 colour, Tracts) runs first and is not the outline's. It is
  // run by hand: a CI runner drawing on SwiftShader can go minutes without an idle period.
  const idle: (() => void)[] = [];
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => idle.push(callback));
  vi.stubGlobal('cancelIdleCallback', () => {});
  const engine = await boot();
  onTestFinished(() => engine.dispose());
  vi.unstubAllGlobals();
  expect(idle).not.toHaveLength(0);
  for (const run of idle.splice(0)) run();
  const gl = engine.canvas.getContext('webgl2')!;
  const created = vi.spyOn(gl, 'createProgram');
  engine.model.select('destrieux:left:1');
  expect(engine.model.state.selectedRegion?.id).toBe('destrieux:left:1');
  for (let frame = 0; frame < 2; frame++) await new Promise(requestAnimationFrame);
  engine.captureSnapshot();
  expect(created).not.toHaveBeenCalled();
});

test('SCENE-38 after the cut prefetch, the first cut compiles no program of its own', async () => {
  const engine = await boot();
  onTestFinished(() => engine.dispose());
  await engine.sections.prefetch();
  const gl = engine.canvas.getContext('webgl2')!;
  const created = vi.spyOn(gl, 'createProgram');
  await engine.sections.setMode('coronal');
  expect(engine.sections.active).toBe(true);
  // The scene redraws on the frame after a change; the second frame is past it.
  for (let frame = 0; frame < 2; frame++) await new Promise(requestAnimationFrame);
  engine.captureSnapshot();
  expect(created).not.toHaveBeenCalled();
});

test('INSP-45 stroke-case bytes that do not match their checksum fail as asset-updated, for a reload', async () => {
  const engine = await boot();
  onTestFinished(() => engine.dispose());
  const fetching = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const response = await fetching(input, init);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('stroke-cases.json')) return response;
    // One byte more, as a line-ending conversion or a newer deploy would change it.
    return new Response((await response.text()).replace('"cases"', '"cases" '));
  });
  onTestFinished(() => {
    vi.restoreAllMocks();
  });
  await expect(engine.strokeCases.cases()).rejects.toMatchObject({ code: 'asset-updated' });
});
