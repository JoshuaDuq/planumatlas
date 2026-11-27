import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { Group } from 'three';
import type { LineSegments } from 'three';
import { afterAll, test, vi } from 'vitest';
import { readDiffusionAsset } from '../../core/assets/diffusion-assets.ts';
import { tractCatalog } from '../../core/diffusion/catalogs.ts';
import type { TractBundle } from '../../core/diffusion/catalogs.ts';
import { lesionBundles } from '../../core/lesion/tracts.ts';
import { readRepoJson, repoRoot } from '../../../../test/repo.ts';
import type { LesionSphere, TractCrossing } from '../api.ts';
import { streamlinesCrossing } from '../lesion/measure.ts';
import { rasToWorld, worldToRas } from '../slices/coordinates.ts';
import { createReferenceTransform } from './reference-space.ts';
import type * as TractDecode from './tract-decode.ts';
import type { TractPoints } from './tract-decode.ts';
import { readPublishedDiffusion } from './test-support.ts';
import { createTracts } from './tracts.ts';

// The unit files share one module cache (isolate: false): import this file's modules afresh under its
// mocks, and leave none built on them to the next file.
vi.hoisted(() => vi.resetModules());
afterAll(() => {
  vi.resetModules();
});

/** The asset reader serves `public/diffusion/` from disk, so the outline and the bundles load in Node. */
vi.mock('../../core/assets/diffusion-assets.ts', async () => {
  const { readPublishedDiffusion } = await import('./test-support.ts');
  return { readDiffusionAsset: vi.fn(readPublishedDiffusion) };
});

/** Every TRK the lesion count decodes, watched; the Tracts tab's decode reads its own. */
vi.mock('./tract-decode.ts', async (original) => {
  const actual = await original<typeof TractDecode>();
  return { ...actual, readTrk: vi.fn(actual.readTrk) };
});

test('setActive loads once, announces readiness once and the reference on another anatomy', async () => {
  const other = setup('another-anatomy');
  const events = () => other.emit.mock.calls.map(([type, event]) => [type, event]);
  const first = other.tracts.setActive(true);
  const second = other.tracts.setActive(true);
  await Promise.all([first, second]);
  assert.deepEqual(events(), [
    ['tractsActive', { active: true }],
    ['tractsReady', undefined],
  ]);
  assert.equal(other.tracts.ready, true);
  assert.equal(other.tracts.streamlinesVisible, true);
  assert.ok(other.tracts.snapshot().length > 0);
  await other.tracts.setActive(false);
  assert.equal(other.tracts.streamlinesVisible, false);
  assert.deepEqual(events().at(-1), ['tractsActive', { active: false }]);

  const own = setup('cdmd');
  await own.tracts.setActive(true);
  assert.deepEqual(
    own.emit.mock.calls.map(([type]) => type),
    ['tractsReady'],
  );
  assert.equal(own.tracts.streamlinesVisible, false, 'hidden until the overlay is on');
}, 60_000);

const setup = (anatomy: string) => {
  const scene = new Group();
  const invalidate = vi.fn();
  const emit = vi.fn();
  const tracts = createTracts({
    anatomy,
    scene: { add: (object) => scene.add(object), invalidate },
    emit,
  });
  return { scene, invalidate, emit, tracts };
};

test('the tracts of their own anatomy overlay it; another anatomy gets the independent reference', () => {
  const own = setup('cdmd');
  assert.equal(own.tracts.anatomy, 'cdmd');
  assert.equal(own.scene.children.length, 1);
  assert.equal(own.tracts.ready, false);
  assert.equal(own.tracts.streamlinesVisible, false);
  own.tracts.setOverlay(true);
  assert.deepEqual(own.emit.mock.calls, [['tractsVisibility', undefined]]);
  assert.equal(own.scene.children[0]!.visible, true);

  const other = setup('another-anatomy');
  assert.equal(other.tracts.anatomy, 'cdmd');
  assert.throws(() => other.tracts.setOverlay(true), /own anatomy/);
  other.tracts.setOverlay(false);
});

test('an unknown bundle is a RangeError', async () => {
  await assert.rejects(setup('cdmd').tracts.loadBundle('missing'), RangeError);
});

test('a landmark draws its own bundle before the Tracts tab loads; the lesion’s and its own clears are apart', async () => {
  const own = setup('cdmd');
  await own.tracts.showLandmarkTract('cst-left');
  assert.equal(own.tracts.ready, false);
  assert.equal(own.tracts.streamlinesVisible, true);
  assert.deepEqual(own.emit.mock.calls.at(-1), ['tractsVisibility', undefined]);
  own.tracts.own!.clearCrossing();
  assert.equal(own.tracts.streamlinesVisible, true, 'the lesion’s clear leaves the landmark’s');
  own.tracts.clearLandmarkTract();
  assert.equal(own.tracts.streamlinesVisible, false);

  await own.tracts.own!.showCrossing('cst-left', { centre: [0, 0, 0], radius: 100 });
  own.tracts.clearLandmarkTract();
  assert.equal(own.tracts.streamlinesVisible, true, 'the landmark’s clear leaves the lesion’s');

  await assert.rejects(own.tracts.showLandmarkTract('missing'), RangeError);
  await assert.rejects(
    setup('another-anatomy').tracts.showLandmarkTract('cst-left'),
    /own anatomy/,
  );
}, 60_000);

test('DIFF-35 a lesion crossing whose bundle fails to download no longer draws the tracts without the overlay, and says so', async () => {
  const [failing, shown] = tractCatalog('cdmd').bundles as readonly [TractBundle, TractBundle];
  const own = setup('cdmd');
  await own.tracts.loadBundle(shown.id);
  const { readPublishedDiffusion } = await import('./test-support.ts');
  vi.mocked(readDiffusionAsset).mockImplementation(async (file) => {
    if (file === failing.file) throw new Error('offline');
    return readPublishedDiffusion(file);
  });
  const said = own.emit.mock.calls.length;
  await assert.rejects(
    own.tracts.own!.showCrossing(failing.id, { centre: [0, 0, 0], radius: 100 }),
    /offline/,
  );
  vi.mocked(readDiffusionAsset).mockImplementation(readPublishedDiffusion);
  assert.equal(own.tracts.streamlinesVisible, false, 'the overlay is off and nothing is isolated');
  assert.deepEqual(own.emit.mock.calls.slice(said), [['tractsVisibility', undefined]]);
}, 60_000);

test('DIFF-35 a landmark whose bundle fails to download no longer draws the tracts without the overlay, and says so', async () => {
  const [failing, shown] = tractCatalog('cdmd').bundles as readonly [TractBundle, TractBundle];
  const own = setup('cdmd');
  await own.tracts.loadBundle(shown.id);
  const { readPublishedDiffusion } = await import('./test-support.ts');
  vi.mocked(readDiffusionAsset).mockImplementation(async (file) => {
    if (file === failing.file) throw new Error('offline');
    return readPublishedDiffusion(file);
  });
  const said = own.emit.mock.calls.length;
  await assert.rejects(own.tracts.showLandmarkTract(failing.id), /offline/);
  vi.mocked(readDiffusionAsset).mockImplementation(readPublishedDiffusion);
  assert.equal(own.tracts.streamlinesVisible, false, 'the overlay is off and nothing is isolated');
  assert.deepEqual(own.emit.mock.calls.slice(said), [['tractsVisibility', undefined]]);
}, 60_000);

const catalog = tractCatalog('cdmd');
const fileOf = (id: string) => catalog.bundles.find((bundle) => bundle.id === id)!.file;
const idsOf = (sphere: LesionSphere) => lesionBundles(catalog.bundles, sphere);

const inflating = new Map<string, Promise<ArrayBuffer>>();
/** A tract file as an HTTP layer that inflates it sends it (DIFF-04); Node's DecompressionStream is slow. */
function inflated(file: string): Promise<ArrayBuffer> {
  if (!inflating.has(file)) {
    inflating.set(
      file,
      readFile(resolve(repoRoot, 'public/diffusion', file)).then((bytes) => {
        const body = gunzipSync(bytes);
        return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
      }),
    );
  }
  return inflating.get(file)!;
}

async function readInflated(file: string) {
  if (!file.endsWith('.trk.gz')) return readPublishedDiffusion(file);
  return { url: file, buffer: (await inflated(file)).slice(0) };
}

const toScanner = createReferenceTransform(
  readRepoJson<{ scanner_ras_to_surface_ras: number[][] }>(
    `public/diffusion/${catalog.reference_space}`,
  ).scanner_ras_to_surface_ras,
).invert();
const decodedExactly = new Map<string, Promise<TractPoints>>();

/** The count as it was made before the worker kept anything: every point of every bundle, here. */
async function exactCount(sphere: LesionSphere): Promise<TractCrossing[]> {
  const { readTrk } = await vi.importActual<typeof TractDecode>('./tract-decode.ts');
  const centre = worldToRas(rasToWorld(sphere.centre).applyMatrix4(toScanner));
  return Promise.all(
    idsOf(sphere).map(async (id) => {
      const file = fileOf(id);
      if (!decodedExactly.has(file)) decodedExactly.set(file, inflated(file).then(readTrk));
      const { pts, offsetPt0 } = await decodedExactly.get(file)!;
      const crossing = streamlinesCrossing(pts, offsetPt0, { centre, radius: sphere.radius });
      return { id, crossing, total: offsetPt0.length - 1 };
    }),
  );
}

/** The tracts on a tract worker that has counted and kept nothing yet, with its reads and decodes. */
async function freshCount() {
  vi.resetModules();
  const { createTracts: create } = await import('./tracts.ts');
  const assets = await import('../../core/assets/diffusion-assets.ts');
  const read = vi.mocked(assets.readDiffusionAsset).mockImplementation(readInflated);
  const decode = vi.mocked((await import('./tract-decode.ts')).readTrk);
  const tracts = create({ anatomy: 'cdmd', scene: { add() {}, invalidate() {} }, emit() {} });
  const reads = () =>
    read.mock.calls.map(([file]) => file).filter((file) => file.endsWith('.trk.gz'));
  return { tracts, own: tracts.own!, read, decode, reads };
}

const LEFT_TPJ: LesionSphere = { centre: [-45, -25, 30], radius: 15 };
const MIDLINE: LesionSphere = { centre: [-5, -20, 25], radius: 10 };

test('DIFF-40 each count equals the exact count over every decoded point, placed, moved, resized and back', async () => {
  const { own } = await freshCount();
  const placements: LesionSphere[] = [
    LEFT_TPJ,
    { centre: [-44, -25, 30], radius: 15 },
    { centre: [-44, -25, 30], radius: 20 },
    MIDLINE,
    { centre: [40, 10, 20], radius: 3 },
    { centre: [30, -40, 10], radius: 30 },
    { centre: [-60, 40, -20], radius: 8 },
    LEFT_TPJ,
  ];
  for (const sphere of placements) {
    assert.deepEqual(
      await own.crossing(sphere, idsOf(sphere)),
      await exactCount(sphere),
      JSON.stringify(sphere),
    );
  }
  // The lesion NumPy counted independently (lesion/published-data.test.ts).
  assert.deepEqual(await own.crossing(LEFT_TPJ, ['af-left']), [
    { id: 'af-left', crossing: 3025, total: 3639 },
  ]);
}, 120_000);

test('DIFF-40 a lesion moved 1 mm downloads and decodes nothing again; a bundle the Tracts tab decoded is not downloaded', async () => {
  const { own, read, decode, reads } = await freshCount();
  await own.crossing(LEFT_TPJ, idsOf(LEFT_TPJ));
  assert.equal(reads().length, 20);
  assert.equal(decode.mock.calls.length, 20);
  read.mockClear();
  decode.mockClear();
  const moved: LesionSphere = { centre: [-44, -25, 30], radius: 15 };
  assert.deepEqual(await own.crossing(moved, idsOf(moved)), await exactCount(moved));
  assert.deepEqual(reads(), []);
  assert.equal(decode.mock.calls.length, 0);

  const tab = await freshCount();
  await tab.tracts.loadBundle('af-left');
  tab.read.mockClear();
  assert.deepEqual(await tab.own.crossing(LEFT_TPJ, idsOf(LEFT_TPJ)), await exactCount(LEFT_TPJ));
  assert.equal(tab.reads().length, 19);
  assert.ok(!tab.reads().includes(fileOf('af-left')));
  assert.equal(tab.decode.mock.calls.length, 19);
}, 120_000);

test('DIFF-41 a bundle the Tracts tab has released is downloaded again by the count, never read from its lines', async () => {
  vi.resetModules();
  const { createTracts: create } = await import('./tracts.ts');
  const assets = await import('../../core/assets/diffusion-assets.ts');
  const read = vi.mocked(assets.readDiffusionAsset).mockImplementation(readInflated);
  const scene = new Group();
  const tracts = create({
    anatomy: 'cdmd',
    scene: { add: (object) => scene.add(object), invalidate() {} },
    emit() {},
  });
  for (const id of ['af-left', 'cst-left', 'uf-left']) await tracts.loadBundle(id);
  const lines = scene.getObjectByName('af-left') as LineSegments;
  const points = lines.geometry.getAttribute('position').array as Float32Array;
  tracts.setVisible('af-left', false);
  tracts.setVisible('cst-left', false);
  assert.equal(tracts.hasBundle('af-left'), false, 'released, its record forgotten');
  assert.equal(lines.parent, null);
  // What was af-left's is spoiled: a count that read it would fail or count otherwise.
  points.fill(Number.NaN);
  read.mockClear();
  assert.deepEqual(await tracts.own!.crossing(LEFT_TPJ, ['af-left']), [
    { id: 'af-left', crossing: 3025, total: 3639 },
  ]);
  const reads = read.mock.calls.map(([file]) => file).filter((file) => file.endsWith('.trk.gz'));
  assert.deepEqual(reads, [fileOf('af-left')]);
}, 120_000);

test('DIFF-39 four bundles at most download at once, each reported as it is counted', async () => {
  const { own, read } = await freshCount();
  const waiting: (() => void)[] = [];
  let reading = 0;
  let most = 0;
  read.mockImplementation(async (file) => {
    if (file.endsWith('.trk.gz')) {
      most = Math.max(most, ++reading);
      await new Promise<void>((resolve) => waiting.push(resolve));
      reading--;
    }
    return readInflated(file);
  });
  const ids = idsOf(MIDLINE);
  assert.equal(ids.length, 33);
  const progress: number[] = [];
  const counting = own.crossing(MIDLINE, ids, (counted, total) => {
    assert.equal(total, 33);
    progress.push(counted);
  });
  for (let released = 0; released < ids.length; released++) {
    // Every lane waits on its download before one is let through.
    await vi.waitFor(() => assert.equal(waiting.length, Math.min(4, ids.length - released)), {
      timeout: 30_000,
      interval: 5,
    });
    waiting.shift()!();
  }
  assert.deepEqual(await counting, await exactCount(MIDLINE));
  assert.equal(most, 4);
  assert.deepEqual(
    progress,
    ids.map((_, index) => index + 1),
  );
}, 120_000);

test('DIFF-39 a bundle that fails to download fails the count; nothing is reported or downloaded after it', async () => {
  const { own, read, decode, reads } = await freshCount();
  const waiting: ((fail: boolean) => void)[] = [];
  read.mockImplementation(async (file) => {
    if (file.endsWith('.trk.gz')) {
      const fail = await new Promise<boolean>((resolve) => waiting.push(resolve));
      if (fail) throw new Error('offline');
    }
    return readInflated(file);
  });
  const progress: number[] = [];
  const failed = assert.rejects(
    own.crossing(LEFT_TPJ, idsOf(LEFT_TPJ), (counted) => progress.push(counted)),
    /offline/,
  );
  const lanesWaiting = () =>
    vi.waitFor(() => assert.equal(waiting.length, 4), { timeout: 30_000, interval: 5 });
  for (let released = 0; released < 5; released++) {
    await lanesWaiting();
    waiting.shift()!(false);
  }
  await lanesWaiting();
  waiting.shift()!(true);
  await failed;
  // The three downloads still under way land and are counted, unreported.
  for (const release of waiting.splice(0)) release(false);
  await vi.waitFor(() => assert.equal(decode.mock.calls.length, 8), {
    timeout: 30_000,
    interval: 5,
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(progress, [1, 2, 3, 4, 5]);
  assert.equal(reads().length, 9);
}, 120_000);
