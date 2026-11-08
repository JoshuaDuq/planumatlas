import type { Cluster } from '../../core/user-map/clusters.ts';
import type { MapCourse } from '../../core/user-map/course.ts';
import type { CortexSurface, MapDisplay, MapSummary } from '../../core/user-map/display.ts';
import { validDisplay } from '../../core/user-map/display.ts';
import type { EngineUserMap } from '../api.ts';

export interface FakeUserMap extends EngineUserMap {
  /** The space of the loaded map, the volume it was carried at, and what the stage draws. */
  readonly loaded: string | null;
  readonly loadedVolume: number | null;
  readonly shown: MapDisplay | null;
  /** A `load` is waiting to be settled. */
  readonly loading: boolean;
  /** Each threshold the clusters were asked for, in order. */
  readonly clusterThresholds: readonly number[];
  /** Each [threshold, minVoxels, volume] the clusters and the drawn extent were asked for, in order. */
  readonly clusterSizes: readonly (readonly [number, number, number])[];
  readonly extents: readonly (readonly [number, number, number])[];
  readonly surface: CortexSurface;
  /** Settle the pending `load` with this summary, or reject it with this error. */
  settle(result: MapSummary | Error): void;
}

/** The map without a brain: `load` waits until the test settles it, so its loading state can be seen. */
export function createFakeUserMap(
  available: boolean,
  table: (threshold: number) => Cluster[] = () => [],
  courses: (region: string) => MapCourse | null = () => null,
): FakeUserMap {
  const clusterThresholds: number[] = [];
  const clusterSizes: [number, number, number][] = [];
  const extents: [number, number, number][] = [];
  let loaded: string | null = null;
  let loadedVolume: number | null = null;
  let surface: CortexSurface = 'pial';
  let shown: MapDisplay | null = null;
  let pending: {
    space: string;
    volume: number;
    resolve: (summary: MapSummary) => void;
    reject: (error: Error) => void;
  } | null = null;
  return {
    available,
    get loaded() {
      return loaded;
    },
    get loadedVolume() {
      return loadedVolume;
    },
    get shown() {
      return shown;
    },
    get loading() {
      return pending !== null;
    },
    get clusterThresholds() {
      return clusterThresholds;
    },
    get clusterSizes() {
      return clusterSizes;
    },
    get extents() {
      return extents;
    },
    async extent(threshold, minVoxels, volume) {
      if (!loaded) throw new Error('No map is loaded.');
      extents.push([threshold, minVoxels, volume]);
    },
    async course(region) {
      if (!loaded) throw new Error('No map is loaded.');
      return courses(region);
    },
    get surface() {
      return surface;
    },
    setSurface(next) {
      surface = next;
    },
    async clusters(threshold, minVoxels, volume) {
      if (!loaded) throw new Error('No map is loaded.');
      clusterThresholds.push(threshold);
      clusterSizes.push([threshold, minVoxels, volume]);
      return table(threshold);
    },
    load(_file, space, volume) {
      if (!available)
        return Promise.reject(new Error('This anatomy publishes no template registration.'));
      pending?.reject(Object.assign(new Error('A newer map was opened.'), { name: 'AbortError' }));
      return new Promise((resolve, reject) => {
        pending = { space, volume, resolve, reject };
      });
    },
    settle(result) {
      if (!pending) throw new Error('No map is loading.');
      const { space, volume, resolve, reject } = pending;
      pending = null;
      if (result instanceof Error) {
        reject(result);
        return;
      }
      loaded = space;
      loadedVolume = volume;
      shown = null;
      resolve(result);
    },
    show(display) {
      if (display && !loaded) throw new Error('No map is loaded.');
      if (display && !validDisplay(display)) throw new RangeError('Invalid map display.');
      shown = display;
    },
    clear() {
      loaded = null;
      loadedVolume = null;
      shown = null;
    },
  };
}
