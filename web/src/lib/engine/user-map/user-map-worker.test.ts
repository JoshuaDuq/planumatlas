import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import type { NiftiImage, NiftiVolume } from '../../core/user-map/nifti.ts';
import { MapFileError } from '../../core/user-map/map-file-error.ts';
import type { CarryJob, UserMapJob, UserMapReply } from './user-map-worker.ts';

// Each read waits for the test, so carries can finish out of the order they were asked in.
const reads = vi.hoisted(() => new Map<string, (result: unknown) => void>());

vi.mock('../../core/user-map/nifti.ts', () => ({
  readNifti: (file: ArrayBuffer) =>
    new Promise((resolve, reject) => {
      const name = new TextDecoder().decode(file);
      reads.set(name, (result) => (result instanceof Error ? reject(result) : resolve(result)));
    }),
  volumeOf: (image: NiftiImage, index: number) => ({ ...image, data: image.volumes[index] }),
}));
vi.mock('../../core/user-map/inverse-field.ts', () => ({ invertField: () => ({}) }));
vi.mock('../../core/user-map/carry.ts', () => ({
  carryImage: () => ({
    map: {
      volume: new Float32Array(1),
      cortex: { left: new Float32Array(1), right: new Float32Array(1) },
    },
  }),
}));
vi.mock('../../core/user-map/clusters.ts', () => ({
  clusterTable: (map: NiftiVolume) => [{ id: `${map.description} ${map.data[0]}` }],
}));

const posted: UserMapReply[] = [];
vi.stubGlobal('postMessage', (reply: UserMapReply) => posted.push(reply));
await import('./user-map-worker.ts');
const send = (job: UserMapJob) =>
  (globalThis as unknown as { onmessage: (event: { data: UserMapJob }) => void }).onmessage({
    data: job,
  });
const carry = (token: number, name: string): CarryJob => ({
  kind: 'carry',
  token,
  file: new TextEncoder().encode(name).buffer,
  space: 'mni',
  volume: 0,
  field: { record: {} as NonNullable<CarryJob['field']>['record'], data: new Int16Array(1) },
  cortex: {
    left: { pial: new Float32Array(3), white: new Float32Array(3) },
    right: { pial: new Float32Array(3), white: new Float32Array(3) },
  },
});
const image = (description: string) =>
  ({ description, volumes: [Float32Array.of(0), Float32Array.of(1)] }) as unknown as NiftiImage;
const reply = (token: number) =>
  vi.waitFor(() => {
    const found = posted.find((each) => each.token === token);
    if (!found) throw new Error(`No reply to ${token} yet.`);
    return found;
  });

afterEach(() => {
  posted.length = 0;
  reads.clear();
});

test('a carry that finishes after a newer one does not become the map its clusters are found in', async () => {
  send(carry(1, 'older'));
  send(carry(2, 'newer'));
  reads.get('newer')!(image('newer'));
  await reply(2);
  reads.get('older')!(image('older'));
  await reply(1);
  send({ kind: 'clusters', token: 3, volume: 1, threshold: 1, minVoxels: 0 });
  assert.deepEqual(await reply(3), { token: 3, clusters: [{ id: 'newer 1' }] });
});

test('a file that cannot be read is answered with its code and values, for the page to word', async () => {
  send(carry(4, 'stack'));
  reads.get('stack')!(new MapFileError('tooManyVolumes', [300, 61]));
  assert.deepEqual(await reply(4), {
    token: 4,
    error:
      'This file holds 300 volumes; up to 61 of its size can be shown. Save fewer as their own file.',
    file: { code: 'tooManyVolumes', params: [300, 61] },
  });
});
