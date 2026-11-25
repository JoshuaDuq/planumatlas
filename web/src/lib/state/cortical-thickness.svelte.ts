import { fetchAsset } from '../core/assets/asset-cache.ts';
import type { RegionThickness } from '../core/catalog/cortical-thickness.ts';
import type { Region } from '../types/index.ts';

export type RegionThicknessState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; data: RegionThickness }
  | { status: 'error'; error: unknown };

/**
 * Each cortical region's mean thickness, downloaded once, when a cortical region's measurements are
 * first opened. Without a published file (`url` null) nothing loads.
 */
export function createRegionThicknessStore({
  url,
  regions,
  fetch = fetchAsset,
}: {
  url: URL | null;
  regions: ReadonlyMap<string, Region>;
  fetch?: (url: URL) => Promise<ArrayBuffer>;
}) {
  let state = $state.raw<RegionThicknessState>({ status: 'idle' });
  return {
    get state() {
      return state;
    },
    load(): void {
      if (!url || state.status !== 'idle') return;
      state = { status: 'loading' };
      // The reader comes with the file: nothing of it is needed before (BUILD-15).
      Promise.all([fetch(url), import('../core/catalog/cortical-thickness.ts')])
        .then(([buffer, { readRegionThickness }]) =>
          readRegionThickness(JSON.parse(new TextDecoder().decode(buffer)), regions),
        )
        .then(
          (data) => (state = { status: 'ready', data }),
          (error: unknown) => {
            state = { status: 'error', error };
            console.error(error);
          },
        );
    },
  };
}

export type RegionThicknessStore = ReturnType<typeof createRegionThicknessStore>;
