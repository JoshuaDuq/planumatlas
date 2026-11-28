import { expect, onTestFinished, test, vi } from 'vitest';
import { annotateSnapshot } from '../../features/snapshot/snapshot.ts';
import type { SnapshotPlan } from '../../features/snapshot/snapshot.ts';
import { bootEngine } from './real-engine-test-support.ts';
import { SNAPSHOT_PIXEL_RATIO } from './render/renderer.ts';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

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

test('captures the settled frame, cropped to the stage rectangle asked for, with the brain drawn', async () => {
  const engine = await bootEngine(1000, 700);
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

test('SNAP-20 a 3× image has three times the pixels and a caption as legible against the anatomy', async () => {
  const engine = await bootEngine(400, 300);
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
  const engine = await bootEngine(400, 300);
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
