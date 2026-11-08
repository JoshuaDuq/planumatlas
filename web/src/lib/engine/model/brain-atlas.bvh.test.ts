import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { Box3, BoxGeometry, Vector3 } from 'three';
import type { BufferAttribute } from 'three';
import * as bvh from 'three-mesh-bvh';
import { GeometryJobs } from './brain-atlas.ts';
import type { GeometryJob, GeometryReply } from './geometry-worker.ts';

/** Holds each job until the test answers it with a tree built from the copy the job carried. */
class FakeWorker {
  static all: FakeWorker[] = [];
  onmessage: ((event: { data: GeometryReply }) => void) | null = null;
  job: GeometryJob | null = null;
  constructor() {
    FakeWorker.all.push(this);
  }
  static busy() {
    return FakeWorker.all.filter((worker) => worker.job);
  }
  postMessage(job: GeometryJob) {
    this.job = job;
  }
  answer() {
    const { token, geometries } = this.job!;
    const bvhs = geometries.map(({ position, index }) => {
      const copy = new BoxGeometry();
      copy.getAttribute('position').array.set(position);
      copy.getIndex()!.array.set(index!);
      const tree = bvh.MeshBVH.serialize(new bvh.MeshBVH(copy, { indirect: true }));
      tree.index = null;
      return tree;
    });
    this.job = null;
    this.onmessage!({ data: { token, bvhs } });
  }
  terminate() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.all = [];
});

async function buildWhile(change: (geometry: BoxGeometry) => void) {
  vi.stubGlobal('Worker', FakeWorker);
  const geometry = new BoxGeometry();
  const building = new GeometryJobs().bvhs(bvh, [geometry]);
  change(geometry);
  for (const worker of FakeWorker.busy()) worker.answer();
  await building;
  return geometry;
}

test('a tree built from where the cortex was is not installed once it has moved', async () => {
  const moved = await buildWhile((geometry) => {
    geometry.getAttribute('position').needsUpdate = true;
  });
  assert.equal(moved.boundsTree, undefined);
  const still = await buildWhile(() => {});
  assert.ok(still.boundsTree instanceof bvh.MeshBVH);
});

test('a BVH job split between workers gives each geometry the tree of its own vertices', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const geometries = [0, 1, 2, 3].map((x) => new BoxGeometry().translate(x * 10, 0, 0));
  const boxes = geometries.map((geometry) =>
    new Box3().setFromBufferAttribute(geometry.getAttribute('position') as BufferAttribute),
  );
  const building = new GeometryJobs().bvhs(bvh, geometries);
  const busy = FakeWorker.busy();
  assert.equal(busy.length, 2);
  // The later half answers first.
  for (const worker of busy.reverse()) worker.answer();
  await building;
  // A tree's root box is padded by a float step, so the centres are compared.
  geometries.forEach((geometry, at) => {
    const centre = geometry.boundsTree!.getBoundingBox(new Box3()).getCenter(new Vector3());
    assert.ok(
      centre.distanceTo(boxes[at]!.getCenter(new Vector3())) < 1e-6,
      `tree ${at} out of place`,
    );
  });
});
