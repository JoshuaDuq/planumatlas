import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { afterEach, describe, it, vi } from 'vitest';
import { Raycaster, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { BrainAtlas } from './brain-atlas.ts';
import type { GeometryJob, GeometryReply } from './geometry-worker.ts';
import { modelDirectory, publishedLoader, readManifest } from './test-support.ts';

/** A `Worker` whose far end is `geometry-worker.ts`'s own `onmessage`, run in this thread. */
async function installWorkerShim() {
  const scope = globalThis as unknown as {
    onmessage: ((event: { data: GeometryJob }) => void) | null;
  };
  await import('./geometry-worker.ts');
  const handler = scope.onmessage!;
  const jobs: GeometryJob['type'][] = [];
  // The worker answers within postMessage, so the reply goes to the worker that posted last.
  let reply: ((data: GeometryReply) => void) | null = null;
  vi.stubGlobal(
    'Worker',
    class {
      onmessage: ((event: { data: GeometryReply }) => void) | null = null;
      onerror = null;
      postMessage(job: GeometryJob, transfer: Transferable[]) {
        jobs.push(job.type);
        reply = (data) => this.onmessage!({ data });
        handler({ data: structuredClone(job, { transfer }) });
      }
      terminate() {}
    },
  );
  vi.stubGlobal('postMessage', (message: GeometryReply, transfer: Transferable[]) =>
    reply!(structuredClone(message, { transfer })),
  );
  return jobs;
}

async function load(atlas: string): Promise<BrainAtlas> {
  const model = new BrainAtlas(readManifest('cdmd'), publishedLoader(modelDirectory('cdmd')));
  await model.initialize(atlas);
  await model.ensureEnvelopes();
  return model;
}

const digest = (...arrays: (ArrayBufferView | ArrayBuffer | null | undefined)[]) => {
  const hash = createHash('sha256');
  for (const array of arrays) {
    if (!array) hash.update('none');
    else if (array instanceof ArrayBuffer) hash.update(new Uint8Array(array));
    else hash.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  }
  return hash.digest('hex');
};

/**
 * Every layer's and envelope's geometry, BVH and feathers, digested: none of it may change. Keyed by
 * layer and mesh, since layers land in whichever order their loads finish.
 */
function fingerprint(model: BrainAtlas): Record<string, Record<string, string>> {
  const geometries: [string, BufferGeometry][] = [
    ...[...model.layers].flatMap(([id, layer]) =>
      layer.meshes.map((mesh, i): [string, BufferGeometry] => [`${id}/${i}`, mesh.geometry]),
    ),
    ...model.envelopes!.map((mesh, i): [string, BufferGeometry] => [
      `envelope/${i}`,
      mesh.geometry,
    ]),
  ];
  return Object.fromEntries(
    geometries.map(([key, geometry]) => {
      const bvh = MeshBVH.serialize(geometry.boundsTree as MeshBVH);
      const box = geometry.boundingBox!;
      return [
        key,
        {
          geometry: digest(geometry.getAttribute('position').array, geometry.getIndex()?.array),
          feather: digest(geometry.getAttribute('_feather')?.array),
          box: [...box.min.toArray(), ...box.max.toArray()].join(','),
          bvh: digest(...bvh.roots, bvh.indirectBuffer),
        },
      ];
    }),
  );
}

describe('the geometry worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gives the model the BVHs and border feathers it would compute itself, byte for byte', async () => {
    const here = await load('hcp-mmp');
    const inline = fingerprint(here);
    here.dispose();
    const jobs = await installWorkerShim();
    const there = await load('hcp-mmp');
    // The cortex's BVHs follow its picture; let them land.
    await vi.waitFor(() =>
      assert.ok(there.layers.get('hcp-mmp')!.meshes.every((mesh) => mesh.geometry.boundsTree)),
    );
    assert.ok(jobs.includes('bvh') && jobs.includes('feather'), 'the work went to the worker');
    assert.deepStrictEqual(fingerprint(there), inline);
    there.dispose();
  });

  it('a ray that reaches a parcel before its BVH builds the BVH and finds the same surface', async () => {
    const model = await load('destrieux');
    const raycaster = new Raycaster(new Vector3(0, 0, 0.2), new Vector3(0, 0, -1));
    raycaster.firstHitOnly = true;
    const expected = model.intersect(raycaster)!;
    const geometry = expected.object.geometry;
    geometry.boundsTree = undefined;
    const hit = model.intersect(raycaster)!;
    assert.ok(geometry.boundsTree, 'the ray built it');
    assert.equal(hit.object, expected.object);
    assert.equal(hit.faceIndex, expected.faceIndex);
    assert.ok(hit.point.equals(expected.point));
    model.dispose();
  });
});
