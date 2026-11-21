import { expect, onTestFinished, test, vi } from 'vitest';
import { bootEngine } from './real-engine-test-support.ts';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

test('ATLAS-10 an atlas released two switches back draws the same pixels once it is shown again', async () => {
  // A small stage: the frame is drawn twice on SwiftShader at the snapshot's two pixels per CSS pixel.
  const engine = await bootEngine(360, 280);
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
