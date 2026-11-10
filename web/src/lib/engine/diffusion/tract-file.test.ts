import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { NVMeshLoaders } from '@niivue/niivue';
import { afterEach, test, vi } from 'vitest';
import { AssetError } from '../../core/assets/published-assets.ts';
import { tractCatalog } from '../../core/diffusion/catalogs.ts';
import { DiffusionInputError } from '../../core/diffusion/validation.ts';
import { repoRoot } from '../../../../test/repo.ts';
import { readTrk } from './tract-decode.ts';
import { createTractLoader, decodeTractAsset } from './tract-file.ts';

const tract = (file: string) => readFile(resolve(repoRoot, 'public/diffusion', file));
const arrayBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** Points and boundaries as bits, so -0 and NaN compare too. */
function assertSameBits(
  actual: { pts: Float32Array; offsetPt0: Uint32Array },
  expected: { pts: Float32Array; offsetPt0: Uint32Array },
) {
  assert.deepEqual(actual.offsetPt0, expected.offsetPt0);
  assert.deepEqual(new Uint32Array(actual.pts.buffer), new Uint32Array(expected.pts.buffer));
}

/**
 * A TRK v2 file with two scalars per point and one property per streamline, voxels of 0.5 × 0.8 ×
 * 1.25 mm and a rotated, translated vox_to_ras, written in either byte order.
 */
function syntheticTrk(little: boolean): ArrayBuffer {
  const lines = [
    [1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8, 9.9],
    [10.25, 0.5, 3, 11.75, 1.5, 2],
  ];
  const words = lines.reduce((sum, line) => sum + 1 + (line.length / 3) * 5 + 1, 0);
  const buffer = new ArrayBuffer(1000 + words * 4);
  const view = new DataView(buffer);
  new Uint8Array(buffer).set(new TextEncoder().encode('TRACK'));
  [176, 220, 220].forEach((size, axis) => view.setInt16(6 + axis * 2, size, little));
  [0.5, 0.8, 1.25].forEach((size, axis) => view.setFloat32(12 + axis * 4, size, little));
  view.setInt16(36, 2, little);
  view.setInt16(238, 1, little);
  const toRas = [0.6, -0.8, 0, 87.3, 0.8, 0.6, 0, -100.7, 0, 0, 1, -99.9, 0, 0, 0, 1];
  toRas.forEach((value, index) => view.setFloat32(440 + index * 4, value, little));
  view.setInt32(988, lines.length, little);
  view.setInt32(992, 2, little);
  view.setInt32(996, 1000, little);
  let at = 1000;
  for (const line of lines) {
    view.setInt32(at, line.length / 3, little);
    at += 4;
    for (let point = 0; point < line.length; point += 3) {
      for (const value of [...line.slice(point, point + 3), 0.25, -7]) {
        view.setFloat32(at, value, little);
        at += 4;
      }
    }
    view.setFloat32(at, 42, little);
    at += 4;
  }
  return buffer;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// First, before any job has started the module's one worker.
test('DIFF-05 a tract worker script that does not load rejects as asset-updated', async () => {
  const preload = vi.fn();
  vi.stubGlobal('dispatchEvent', preload);
  vi.stubGlobal(
    'Worker',
    class {
      onerror: ((event: Event) => void) | null = null;
      postMessage() {
        queueMicrotask(() => this.onerror?.(new Event('error')));
      }
    },
  );
  const error = await decodeTractAsset(new ArrayBuffer(8)).catch((caught: unknown) => caught);
  assert.ok(error instanceof AssetError, String(error));
  assert.equal(error.code, 'asset-updated');
  assert.deepEqual(
    preload.mock.calls.map(([event]) => [event.type, event.payload]),
    [['vite:preloadError', error]],
  );
});

test('DIFF-04 TRK decoding accepts original gzip files and HTTP-decompressed response bodies', async () => {
  const compressed = await tract('cdmd-sub-013/af.left.trk.gz');
  const gzip = await decodeTractAsset(arrayBuffer(compressed));
  const http = await decodeTractAsset(arrayBuffer(gunzipSync(compressed)));
  assertSameBits(gzip, http);
  assert.equal(http.offsetPt0.length - 1, 3639);
  assert.equal(http.pts.length / 3, 844916);
});

test.each(tractCatalog('cdmd-sub-013').bundles.map((bundle) => [bundle.file]))(
  'DIFF-04 %s decodes to the bits of NiiVue’s readTRK',
  async (file) => {
    const body = arrayBuffer(gunzipSync(await tract(file)));
    assertSameBits(readTrk(body), await NVMeshLoaders.readTRK(body));
  },
);

test('DIFF-04 scalars, properties, voxel sizes and a rotated vox_to_ras read as NiiVue reads them, in either byte order', async () => {
  const expected = await NVMeshLoaders.readTRK(syntheticTrk(true));
  assertSameBits(readTrk(syntheticTrk(true)), expected);
  assertSameBits(readTrk(syntheticTrk(false)), expected);
  assert.deepEqual(expected.offsetPt0, Uint32Array.of(0, 3, 5));
});

test('DIFF-04 a TRK file that breaks the format is refused', () => {
  const header = (edit: (view: DataView) => void) => {
    const buffer = syntheticTrk(true);
    edit(new DataView(buffer));
    return buffer;
  };
  assert.throws(() => readTrk(header((view) => view.setInt32(996, 999, true))), /hdr_size/);
  assert.throws(() => readTrk(header((view) => view.setInt32(992, 1, true))), /version 2/);
  assert.throws(() => readTrk(header((view) => view.setFloat32(500, 0, true))), /vox_to_ras/);
  assert.throws(() => readTrk(header((view) => view.setInt32(988, 3, true))), /counts 3/);
  assert.throws(() => readTrk(syntheticTrk(true).slice(0, -4)), /ends inside/);
});

test('DIFF-05 the 3D lines and the MRI navigator share one download and one decode per tract', async () => {
  const compressed = await tract('cdmd-sub-013/callosum_1.trk.gz');
  let reads = 0;
  const loadTract = createTractLoader(async () => {
    reads += 1;
    return { buffer: arrayBuffer(compressed) };
  });
  const bundle = { file: 'cdmd-sub-013/callosum_1.trk.gz' };
  const [lines, navigator] = await Promise.all([loadTract(bundle), loadTract(bundle)]);
  assert.equal(reads, 1);
  assert.equal(lines, navigator);
  assert.equal(await loadTract(bundle), lines, 'and later requests too');
  assert.equal(lines.lengths.length, lines.offsetPt0.length - 1);
  assert.equal(lines.colors.length, lines.pts.length);
});

test('DIFF-05 a failed tract download is not kept, so a retry downloads it again', async () => {
  let reads = 0;
  const loadTract = createTractLoader(async () => {
    reads += 1;
    throw new Error('HTTP 503');
  });
  const bundle = { file: 'cdmd-sub-013/callosum_1.trk.gz' };
  await assert.rejects(loadTract(bundle), /503/);
  await assert.rejects(loadTract(bundle), /503/);
  assert.equal(reads, 2);
});

test('DIFF-05 a streamline the worker refuses rejects as a diffusion input error', async () => {
  const buffer = syntheticTrk(true);
  const view = new DataView(buffer);
  // The second streamline's two points made equal: zero length.
  for (let axis = 0; axis < 3; axis++) view.setFloat32(1000 + 18 * 4 + 4 * axis, 1, true);
  for (let axis = 0; axis < 3; axis++) view.setFloat32(1000 + 23 * 4 + 4 * axis, 1, true);
  const loadTract = createTractLoader(async () => ({ buffer }));
  const error = await loadTract({ file: 'zero.trk' }).catch((caught: unknown) => caught);
  assert.ok(error instanceof DiffusionInputError, String(error));
  assert.match(error.message, /nonzero length/);
});
