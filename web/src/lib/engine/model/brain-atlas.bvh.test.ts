import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { BoxGeometry } from 'three';
import * as bvh from 'three-mesh-bvh';
import { GeometryJobs } from './brain-atlas.ts';
import type { GeometryJob, GeometryReply } from './geometry-worker.ts';

/** Holds each job until the test answers it with a tree built from the copy the job carried. */
class FakeWorker {
  static last: FakeWorker;
  onmessage: ((event: { data: GeometryReply }) => void) | null = null;
  job: GeometryJob | null = null;
  constructor() {
    FakeWorker.last = this;
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
    this.onmessage!({ data: { token, bvhs } });
  }
  terminate() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function buildWhile(change: (geometry: BoxGeometry) => void) {
  vi.stubGlobal('Worker', FakeWorker);
  const geometry = new BoxGeometry();
  const building = new GeometryJobs().bvhs(bvh, [geometry]);
  change(geometry);
  FakeWorker.last.answer();
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
