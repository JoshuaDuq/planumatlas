import { readDiffusionAsset } from '../../core/assets/diffusion-assets.ts';
import type { TractBundle } from '../../core/diffusion/catalogs.ts';
import { DiffusionInputError } from '../../core/diffusion/validation.ts';
import { workerLoadFailure } from '../worker-load.ts';
import { decodeTract } from './tract-decode.ts';
import type { TractJob, TractLines, TractPoints, TractReply } from './tract-decode.ts';

export type LoadedTract = TractLines;

export type TractLoader = (bundle: Pick<TractBundle, 'file'>) => Promise<LoadedTract>;

let worker: Worker | null = null;
let token = 0;
const waiting = new Map<
  number,
  { resolve: (reply: TractReply) => void; reject: (error: Error) => void }
>();

function start(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./tract-worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }: MessageEvent<TractReply>) => {
    const job = waiting.get(data.token)!;
    waiting.delete(data.token);
    job.resolve(data);
  };
  worker.onerror = (event) => {
    const failure = workerLoadFailure(event, 'tract');
    // A worker that never loaded drops every later job silently: the next job starts another.
    if (failure) worker = null;
    const error = failure ?? new Error(event.message);
    for (const job of waiting.values()) job.reject(error);
    waiting.clear();
  };
  return worker;
}

/**
 * Inflated and decoded in a worker, or in this thread where the platform has none. The file's
 * buffer is copied, not transferred: concurrent readers of one published file share it.
 */
async function decode(buffer: ArrayBuffer, lines: boolean): Promise<TractPoints | TractLines> {
  const job: TractJob = { token: ++token, buffer, lines };
  const reply =
    typeof Worker === 'undefined'
      ? (await decodeTract(job)).reply
      : await new Promise<TractReply>((resolve, reject) => {
          waiting.set(job.token, { resolve, reject });
          start().postMessage(job);
        });
  if ('error' in reply) {
    throw reply.code ? new DiffusionInputError(reply.code, reply.error) : new Error(reply.error);
  }
  return reply;
}

export async function decodeTractAsset(buffer: ArrayBuffer): Promise<TractPoints> {
  return (await decode(buffer, false)) as TractPoints;
}

/**
 * One download and decode per tract file. The decoded points are also the lines' position buffer, so
 * the record is the only copy of them. A failed load is dropped and retried.
 */
export function createTractLoader(
  read: (file: string) => Promise<{ buffer: ArrayBuffer }> = readDiffusionAsset,
): TractLoader {
  const tracts = new Map<string, Promise<LoadedTract>>();
  return (bundle) => {
    let loading = tracts.get(bundle.file);
    if (!loading) {
      loading = read(bundle.file).then(
        async ({ buffer }) => (await decode(buffer, true)) as LoadedTract,
      );
      tracts.set(bundle.file, loading);
      loading.catch(() => tracts.delete(bundle.file));
    }
    return loading;
  };
}
