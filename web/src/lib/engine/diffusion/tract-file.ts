import { readDiffusionAsset } from '../../core/assets/diffusion-assets.ts';
import type { TractBundle } from '../../core/diffusion/catalogs.ts';
import { DiffusionInputError } from '../../core/diffusion/validation.ts';
import { workerLoadFailure } from '../worker-load.ts';
import { countTract } from './tract-count.ts';
import type { CountJob, CountReply, ScannerSphere } from './tract-count.ts';
import { decodeTract } from './tract-decode.ts';
import type {
  TractFailure,
  TractJob,
  TractLines,
  TractPoints,
  TractReply,
} from './tract-decode.ts';

export type LoadedTract = TractLines;

export type TractLoader = (bundle: Pick<TractBundle, 'file'>) => Promise<LoadedTract>;

type Reply = TractReply | CountReply;

let worker: Worker | null = null;
let token = 0;
const waiting = new Map<
  number,
  { resolve: (reply: Reply) => void; reject: (error: Error) => void }
>();

function start(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./tract-worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }: MessageEvent<Reply>) => {
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
 * Run in the worker, or in this thread where the platform has none. A file's buffer is copied, not
 * transferred: concurrent readers of one published file share it.
 */
async function run<R extends Reply>(job: TractJob | CountJob): Promise<Exclude<R, TractFailure>> {
  const reply =
    typeof Worker === 'undefined'
      ? 'file' in job
        ? await countTract(job)
        : (await decodeTract(job)).reply
      : await new Promise<Reply>((resolve, reject) => {
          waiting.set(job.token, { resolve, reject });
          start().postMessage(job);
        });
  if ('error' in reply) {
    throw reply.code ? new DiffusionInputError(reply.code, reply.error) : new Error(reply.error);
  }
  return reply as Exclude<R, TractFailure>;
}

/**
 * How many of a lesion bundle's streamlines have a point in the sphere, counted in the worker; the
 * page receives only the counts. Without `source` the worker answers from what it keeps of the
 * file, or null when it needs the points again: the published file, or the page's own decode.
 */
export async function countCrossing(
  file: string,
  sphere: ScannerSphere,
  source?: { buffer: ArrayBuffer } | { points: TractPoints },
): Promise<{ crossing: number; total: number } | null> {
  const reply = await run<CountReply>({ token: ++token, file, sphere, ...source });
  return 'missing' in reply ? null : { crossing: reply.crossing, total: reply.total };
}

/**
 * One download and decode per tract file. The decoded points are also the lines' position buffer, so
 * the record is the only copy of them. A failed load is dropped and retried.
 */
export function createTractLoader(
  read: (file: string) => Promise<{ buffer: ArrayBuffer }> = readDiffusionAsset,
) {
  const tracts = new Map<string, Promise<LoadedTract>>();
  const load: TractLoader = (bundle) => {
    let loading = tracts.get(bundle.file);
    if (!loading) {
      loading = read(bundle.file).then(({ buffer }) => run<TractReply>({ token: ++token, buffer }));
      tracts.set(bundle.file, loading);
      loading.catch(() => tracts.delete(bundle.file));
    }
    return loading;
  };
  return Object.assign(load, {
    /** The file's load already started, if any: a lesion's count reads it instead of downloading. */
    started: (file: string): Promise<LoadedTract> | undefined => tracts.get(file),
  });
}
