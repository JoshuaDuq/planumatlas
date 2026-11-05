import { afterAll, expect, onTestFinished, test, vi } from 'vitest';
import '../../styles/tokens.css';
import outlineUrl from '../../../../public/diffusion/cdmd-sub-013/brain-outline.json?url';
import manifestUrl from '../../../../public/models/cdmd/manifest.json?url';
import { defineStageContract } from './fake/contract-suite.ts';
import { createEngine } from './index.ts';
import { SNAPSHOT_PIXEL_RATIO } from './render/scene.ts';

// The tract data is served from the site's `diffusion/` directory, which this project has no public
// directory to answer for: its requests are redirected to the repository's files.
const diffusionRoot = outlineUrl.slice(0, outlineUrl.indexOf('cdmd-sub-013'));
const fetchSite = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const at = url.indexOf('/diffusion/');
  return fetchSite(at < 0 ? input : diffusionRoot + url.slice(at + '/diffusion/'.length), init);
};

// Booting the engine parses 35 MB of GLB on a software GL context. The rest of the engine contract runs
// in the unit project (`index.contract.test.ts`); this file keeps what needs real WebGL.
vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

// The real engine on the CDMD manifest, on real WebGL (SwiftShader), against the contract the fake meets.
// The stage has room: the sheet case shrinks the visible rectangle.
const hosts: HTMLElement[] = [];
afterAll(() => {
  for (const host of hosts) host.remove();
});

async function boot() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:1000px;height:700px';
  document.body.append(host);
  hosts.push(host);
  return createEngine({ host, manifestUrl, theme: 'light' });
}

// The navigator sizes its canvas from the parent it sits in.
const canvas = document.createElement('canvas');
const parent = document.createElement('div');
document.body.append(parent);
parent.append(canvas);

defineStageContract('real engine', boot, { canvas });

test('captures the settled frame, cropped to the stage rectangle asked for, with the brain drawn', async () => {
  const engine = await boot();
  onTestFinished(() => engine.dispose());
  const screen = [engine.canvas.width, engine.canvas.height];
  const { canvas, ratio } = engine.captureSnapshot({ x: 100, y: 50, width: 400, height: 300 });
  expect([canvas.width, canvas.height]).toEqual([Math.round(400 * ratio), Math.round(300 * ratio)]);
  // However few pixels the screen draws, the saved frame has at least two per CSS pixel; the
  // screen keeps its own.
  expect(ratio).toBeGreaterThanOrEqual(SNAPSHOT_PIXEL_RATIO);
  expect([engine.canvas.width, engine.canvas.height]).toEqual(screen);
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  const colours = new Set<number>();
  for (let at = 0; at < pixels.length; at += 4 * 97) {
    colours.add((pixels[at]! << 16) | (pixels[at + 1]! << 8) | pixels[at + 2]!);
  }
  // A uniform stage would be an empty one.
  expect(colours.size).toBeGreaterThan(8);
  expect(engine.canvas.getAttribute('role')).toBe('application');
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
