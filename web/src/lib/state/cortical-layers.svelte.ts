import { fetchAsset } from '../core/assets/asset-cache.ts';
import { validateCorticalLayers } from '../core/catalog/cortical-layers.ts';
import type { CorticalLayers } from '../core/catalog/cortical-layers.ts';
import type { Region } from '../types/index.ts';

export type CorticalLayersState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; data: CorticalLayers }
  | { status: 'error'; error: unknown };

/**
 * BigBrain's cortical layers, downloaded once, when a cortical region's sheet first asks for them; a
 * failure stays failed until the reader retries it. Without a published file (`url` null) nothing loads.
 */
export function createCorticalLayersStore({
  url,
  regions,
  fetch = fetchAsset,
}: {
  url: URL | null;
  regions: ReadonlyMap<string, Region>;
  fetch?: (url: URL) => Promise<ArrayBuffer>;
}) {
  let state = $state.raw<CorticalLayersState>({ status: 'idle' });

  function download(): void {
    state = { status: 'loading' };
    fetch(url!)
      .then((buffer) =>
        validateCorticalLayers(JSON.parse(new TextDecoder().decode(buffer)), regions),
      )
      .then(
        (data) => (state = { status: 'ready', data }),
        (error: unknown) => {
          state = { status: 'error', error };
          console.error(error);
        },
      );
  }

  return {
    get available() {
      return url !== null;
    },
    get state() {
      return state;
    },
    /** The published layers once downloaded, else null. */
    get data() {
      return state.status === 'ready' ? state.data : null;
    },
    load(): void {
      if (url && state.status === 'idle') download();
    },
    /** The reader's Retry after a failed download. */
    retry(): void {
      if (state.status === 'error') download();
    },
  };
}

export type CorticalLayersStore = ReturnType<typeof createCorticalLayersStore>;
