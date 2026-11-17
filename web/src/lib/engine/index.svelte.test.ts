import { afterAll, expect, onTestFinished, test, vi } from 'vitest';
import '../../styles/tokens.css';
import manifestUrl from '../../../../public/models/cdmd/manifest.json?url';
import { defineStageContract } from './fake/contract-suite.ts';
import { createEngine } from './index.ts';
import { SNAPSHOT_PIXEL_RATIO } from './render/renderer.ts';
import { annotateSnapshot } from '../../features/snapshot/snapshot.ts';
import type { SnapshotPlan } from '../../features/snapshot/snapshot.ts';

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

defineStageContract('real engine', boot);

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

/** A small stage: a 3× frame of it is drawn quickly on SwiftShader. */
async function bootSmall() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:300px';
  document.body.append(host);
  hosts.push(host);
  return createEngine({ host, manifestUrl, theme: 'light' });
}

/** A caption as the snapshot draws it, on a 400 × 300 stage. */
const CAPTIONED: SnapshotPlan = {
  width: 400,
  height: 300,
  letters: [],
  labels: [],
  names: [],
  keys: [],
  scale: null,
  caption: [
    [[{ text: 'MGH CDMD sub_013', strong: true }]],
    [[{ text: 'Destrieux' }], [{ text: 'Atlas' }]],
  ],
  statement: 'Planum · Not clinical anatomy',
  font: 'sans-serif',
  palette: { ink: '#f1f2f4', halo: '#404040', haloCore: '#404040' },
};

/** The box, in image pixels, of what the caption changed in the frame's top left quarter. */
function captionBox({ canvas, ratio }: { canvas: HTMLCanvasElement; ratio: number }) {
  const read = () => canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  const before = read();
  annotateSnapshot(canvas, { ...CAPTIONED, ratio });
  const after = read();
  let [bottom, right] = [0, 0];
  for (let y = 0; y < canvas.height / 2; y++) {
    for (let x = 0; x < canvas.width / 2; x++) {
      const at = 4 * (y * canvas.width + x);
      if ([0, 1, 2].some((channel) => before[at + channel] !== after[at + channel])) {
        bottom = Math.max(bottom, y);
        right = Math.max(right, x);
      }
    }
  }
  return { bottom, right };
}

test('SNAP-20 a 3× image has three times the pixels and a caption as legible against the anatomy', async () => {
  const engine = await bootSmall();
  onTestFinished(() => engine.dispose());
  const screen = [engine.canvas.width, engine.canvas.height];
  const large = engine.captureSnapshot(undefined, { scale: 3 });
  const small = engine.captureSnapshot(undefined, { scale: 1 });
  expect([large.canvas.width, large.canvas.height, large.ratio]).toEqual([1200, 900, 3]);
  expect([small.canvas.width, small.canvas.height, small.ratio]).toEqual([400, 300, 1]);
  // The screen keeps its own pixels.
  expect([engine.canvas.width, engine.canvas.height]).toEqual(screen);
  const pixels = large.canvas.getContext('2d')!.getImageData(0, 0, 1200, 900).data;
  const colours = new Set<number>();
  for (let at = 0; at < pixels.length; at += 4 * 97) {
    colours.add((pixels[at]! << 16) | (pixels[at + 1]! << 8) | pixels[at + 2]!);
  }
  expect(colours.size).toBeGreaterThan(8);
  await document.fonts.load(`600 13px ${CAPTIONED.font}`, 'MGH CDMD sub_013');
  // Drawn at the image's ratio, the caption grows with it: three times as tall and as wide.
  const [grown, plain] = [captionBox(large), captionBox(small)];
  expect(plain.bottom).toBeGreaterThan(16);
  for (const edge of ['bottom', 'right'] as const) {
    expect(grown[edge] / plain[edge], edge).toBeGreaterThan(2.85);
    expect(grown[edge] / plain[edge], edge).toBeLessThan(3.15);
  }
});

test('SNAP-21 a frame past the device’s renderbuffer limit is refused with its size and the limit, the stage left as it was', async () => {
  const engine = await bootSmall();
  onTestFinished(() => engine.dispose());
  const gl = engine.canvas.getContext('webgl2')!;
  const read = gl.getParameter.bind(gl);
  vi.spyOn(gl, 'getParameter').mockImplementation((name: number) =>
    name === gl.MAX_RENDERBUFFER_SIZE ? 1024 : read(name),
  );
  onTestFinished(() => {
    vi.restoreAllMocks();
  });
  const screen = [engine.canvas.width, engine.canvas.height];
  let refused: unknown = null;
  try {
    engine.captureSnapshot(undefined, { scale: 3 });
  } catch (error) {
    refused = error;
  }
  expect(refused).toMatchObject({
    code: 'snapshot-too-large',
    message: 'A 1200 × 900 px frame is past this device’s 1024 px limit.',
  });
  expect([engine.canvas.width, engine.canvas.height]).toEqual(screen);
  // 800 × 600 fits, and is drawn at its own ratio.
  const { canvas, ratio } = engine.captureSnapshot(undefined, { scale: 2 });
  expect([canvas.width, canvas.height, ratio]).toEqual([800, 600, 2]);
});

test('ATLAS-10 an atlas released two switches back draws the same pixels once it is shown again', async () => {
  // A small stage: the frame is drawn twice on SwiftShader at the snapshot's two pixels per CSS pixel.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:360px;height:280px';
  document.body.append(host);
  hosts.push(host);
  const engine = await createEngine({ host, manifestUrl, theme: 'light' });
  onTestFinished(() => engine.dispose());
  const { model } = engine;
  const [first, second, third] = model.manifest.atlases.map(({ id }) => id) as [
    string,
    string,
    string,
  ];
  // The network colours too: the palette is looked up again by the meshes loaded again.
  model.setSurfaceColor('network');
  const frame = () => {
    const { canvas } = engine.captureSnapshot();
    return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  };
  const before = frame();
  await model.setAtlas(second);
  await model.setAtlas(third);
  expect(model.hasLayer(first)).toBe(false);
  await model.setAtlas(first);
  expect(model.hasLayer(first)).toBe(true);
  const after = frame();
  expect(after.length).toBe(before.length);
  expect(after.filter((value, at) => value !== before[at]).length).toBe(0);
  const colours = new Set<number>();
  for (let at = 0; at < after.length; at += 4 * 31) {
    colours.add((after[at]! << 16) | (after[at + 1]! << 8) | after[at + 2]!);
  }
  expect(colours.size).toBeGreaterThan(8);
}, 600_000);

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
