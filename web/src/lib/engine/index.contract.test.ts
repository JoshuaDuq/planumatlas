import { afterAll, beforeAll, vi } from 'vitest';
import { defineEngineContract } from './fake/contract-suite.ts';
import { bootHeadless, stubHeadlessGlobals, stubPublishedFetch } from './headless-test-support.ts';
import type { HeadlessProbe } from './headless-renderer-test-support.ts';

const probe = vi.hoisted((): HeadlessProbe => ({
  attributes: new Map(),
  rendererDisposed: 0,
  loop: null,
}));
vi.mock('three', async (importOriginal) =>
  (await import('./headless-renderer-test-support.ts')).withHeadlessRenderer(
    await importOriginal<typeof import('three')>(),
    probe,
  ),
);
vi.mock('./render/lighting.ts', () => ({
  createAnatomicalLighting: () => ({ texture: null, dispose() {} }),
}));

// Compiling the outline programs is a draw.
vi.mock('./render/scene.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('./render/scene.ts')>();
  return {
    ...original,
    createScene: (...args: Parameters<typeof original.createScene>) => {
      const scene = original.createScene(...args);
      scene.warmOutlines = async () => {};
      return scene;
    },
  };
});

// Booting parses 35 MB of GLB, and a shared machine is slow.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

beforeAll(() => {
  stubHeadlessGlobals();
  stubPublishedFetch();
});
afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// The MRI navigator needs a canvas and NiiVue's WebGL: `index.svelte.test.ts` runs that case.
defineEngineContract('real engine, headless', bootHeadless, {
  drawFrame: () => probe.loop?.(performance.now() + 1000),
  comparison: {
    id: 'overlap:left:-1:0',
    geometry: {
      file: 'atlas-overlaps.glb',
      sha256: '169fadf83680c282fd64fd778e462d9dc38be8dcb5e6f95dc55f5a5dabda7801',
    },
  },
});
