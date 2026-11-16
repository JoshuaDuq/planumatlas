import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { test } from 'vitest';
import { tractCatalog } from '../../core/diffusion/catalogs.ts';
import { lesionBundles } from '../../core/lesion/tracts.ts';
import { repoRoot } from '../../../../test/repo.ts';
import { streamlinesCrossing } from '../lesion/measure.ts';
import { countTract } from './tract-count.ts';
import type { CountJob, ScannerSphere } from './tract-count.ts';
import { readTrk } from './tract-decode.ts';

let token = 0;
const count = (job: Omit<CountJob, 'token'>) => countTract({ token: ++token, ...job });

const arrayBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
/** A published tract file as an HTTP layer that inflates it sends it; Node's DecompressionStream is slow. */
const inflated = (file: string) =>
  arrayBuffer(gunzipSync(readFileSync(resolve(repoRoot, 'public/diffusion', file))));

test('DIFF-40 the occupancy never rules out a streamline the exact test counts', async () => {
  // One-point streamlines on and beside 2 mm cell edges, near the origin and far from it.
  const edge = (value: number) => [value, Math.fround(value - 1e-5), Math.fround(value + 1e-5)];
  const points = [
    ...edge(2).map((x) => [x, 0, 0]),
    ...edge(-2).map((y) => [0, y, 4]),
    ...edge(-4).map((z) => [-4, -4, z]),
    [100.1, -60.3, 33.7],
    [-87.25, 12.5, -40.125],
  ].map((point) => point.map(Math.fround));
  const pts = new Float32Array(points.flat());
  const offsetPt0 = Uint32Array.from({ length: points.length + 1 }, (_, line) => line);
  const file = 'edges.trk';
  await count({ file, sphere: { centre: [500, 500, 500], radius: 1 }, points: { pts, offsetPt0 } });

  // Spheres whose surface passes through each point, from 26 directions at four radii: exactly,
  // where rounding decides, and 1e-12 mm either way; and the same spheres 5 mm further off.
  let pruned = 0;
  let needed = 0;
  for (const point of points) {
    for (let direction = 0; direction < 27; direction++) {
      const unit = [direction % 3, Math.floor(direction / 3) % 3, Math.floor(direction / 9)].map(
        (step) => step - 1,
      );
      const norm = Math.hypot(...unit);
      if (!norm) continue;
      for (const radius of [0.5, 1, 2, 3.7]) {
        for (const nudge of [-1e-12, 0, 1e-12, 5]) {
          const centre = point.map(
            (value, axis) => value + (unit[axis]! / norm) * (radius + nudge),
          ) as ScannerSphere['centre'];
          const sphere = { centre, radius };
          const exact = streamlinesCrossing(pts, offsetPt0, sphere);
          const reply = await count({ file, sphere });
          if ('missing' in reply) {
            needed++;
            continue;
          }
          assert.ok('crossing' in reply, JSON.stringify(reply));
          assert.equal(exact, 0, `ruled out at ${centre} r ${radius}, but ${exact} cross`);
          assert.equal(reply.crossing, 0);
          pruned++;
        }
      }
    }
  }
  assert.ok(pruned > 0 && needed > 0, `${pruned} ruled out, ${needed} counted on the points`);

  // Lent points are counted, never kept.
  const sphere = { centre: [2, 0, 0] as ScannerSphere['centre'], radius: 0.5 };
  assert.deepEqual(await count({ file, sphere, points: { pts, offsetPt0 } }), {
    token,
    crossing: 3,
    total: points.length,
  });
  assert.deepEqual(await count({ file, sphere }), { token, missing: true });
});

test('DIFF-40 a decoded file is kept while the lesion is within 5 mm of it', async () => {
  const file = 'cdmd-sub-013/uf.left.trk.gz';
  const buffer = inflated(file);
  const { pts, offsetPt0 } = readTrk(buffer);
  const total = offsetPt0.length - 1;
  const far: ScannerSphere = { centre: [300, 0, 0], radius: 10 };
  assert.deepEqual(await count({ file, sphere: far, buffer }), {
    token,
    crossing: 0,
    total,
  });
  const near: ScannerSphere = { centre: [pts[0]!, pts[1]!, pts[2]!], radius: 10 };
  assert.deepEqual(await count({ file, sphere: near }), { token, missing: true }, 'not kept');
  assert.equal(await count({ file, sphere: far }).then((reply) => 'crossing' in reply), true);

  const crossing = streamlinesCrossing(pts, offsetPt0, near);
  assert.ok(crossing > 0);
  assert.deepEqual(await count({ file, sphere: near, buffer }), {
    token,
    crossing,
    total,
  });
  const moved: ScannerSphere = {
    ...near,
    centre: [near.centre[0] + 1, ...near.centre.slice(1)] as ScannerSphere['centre'],
  };
  assert.deepEqual(await count({ file, sphere: moved }), {
    token,
    crossing: streamlinesCrossing(pts, offsetPt0, moved),
    total,
  });
});

test('DIFF-40 at most 64 MiB of decoded points are kept, the least recently used let go first', async () => {
  const files = lesionBundles(tractCatalog('cdmd').bundles, { centre: [0, 0, 0], radius: 1 }).map(
    (id) => tractCatalog('cdmd').bundles.find((bundle) => bundle.id === id)!.file,
  );
  assert.equal(files.length, 29);
  // A sphere every bundle lies inside, so each is near and each is kept in turn.
  const sphere: ScannerSphere = { centre: [0, 0, 0], radius: 300 };
  const bytes: number[] = [];
  for (const file of files) {
    const buffer = inflated(file);
    const reply = await count({ file, sphere, buffer });
    assert.ok('total' in reply);
    assert.equal(reply.crossing, reply.total);
    const { pts, offsetPt0 } = readTrk(buffer);
    bytes.push(pts.byteLength + offsetPt0.byteLength);
  }
  const kept = await Promise.all(
    files.map(async (file) => 'crossing' in (await count({ file, sphere }))),
  );
  const first = kept.indexOf(true);
  assert.ok(first > 0, 'some were let go');
  assert.deepEqual(kept.slice(first), Array(files.length - first).fill(true), 'the latest kept');
  const held = bytes.slice(first).reduce((sum, size) => sum + size, 0);
  assert.ok(held <= 64 * 2 ** 20, `${held} bytes kept`);
  assert.ok(held + bytes[first - 1]! > 64 * 2 ** 20, 'the cap, not less, is filled');
}, 60_000);
