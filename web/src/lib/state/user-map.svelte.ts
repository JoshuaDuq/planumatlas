import { UNSTATED } from '../core/coordinates/spaces.ts';
import { defaultDisplay, fileStatistic, mapTitle, validDisplay } from '../core/user-map/display.ts';
import type { CortexSurface, MapDisplay, MapSummary, Statistic } from '../core/user-map/display.ts';
import type { Cluster } from '../core/user-map/clusters.ts';
import type { EngineUserMap } from '../engine/api.ts';
import type { SurfaceColor } from '../types/index.ts';

export type UserMapState =
  | { status: 'empty' }
  | { status: 'loading'; name: string }
  | { status: 'ready'; name: string; summary: MapSummary }
  | { status: 'error'; name: string; message: string };

export type ClusterState =
  | { status: 'idle' }
  | { status: 'loading'; threshold: number; minVoxels: number }
  | { status: 'ready'; threshold: number; minVoxels: number; data: Cluster[] }
  | { status: 'error'; threshold: number; minVoxels: number; message: string };

/** Colourings the map is drawn over as they are: the tissue's own, and the achromatic scan. */
const UNDER: readonly SurfaceColor[] = ['tissue', 'mri'];

/**
 * The reader's own map: the file, the template it is in, and how it is drawn. While it is shown, the
 * surface colour is the tissue's, so no atlas colour competes with the map's; hiding or removing it
 * gives back the colour it replaced, unless the reader has changed it meanwhile.
 */
export function createUserMapStore({
  engine,
  display,
}: {
  engine: EngineUserMap;
  display: { readonly color: SurfaceColor; setColor(color: SurfaceColor): void };
}) {
  let state = $state.raw<UserMapState>({ status: 'empty' });
  let space = $state(UNSTATED);
  let settings = $state.raw<MapDisplay>({ threshold: Number.NaN, max: 1, opacity: 1 });
  let shown = $state(true);
  // What the key and caption call the map: its file's name and its statistic until the reader says.
  let title = $state('');
  let statistic = $state<Statistic | null>(null);
  let surface = $state<CortexSurface>('pial');
  let clusters = $state.raw<ClusterState>({ status: 'idle' });
  let clusterRequest = 0;
  // nilearn's cluster_threshold: clusters of fewer voxels are neither drawn nor listed.
  let minVoxels = $state(0);
  let extentRequest = 0;
  // Counts each map the engine has finished placing, carried or trimmed, for what redraws from it.
  let placed = $state(0);
  let heldColor: SurfaceColor | null = null;
  let file: File | null = null;
  let request = 0;

  function hold() {
    if (heldColor !== null || UNDER.includes(display.color)) return;
    heldColor = display.color;
    display.setColor('tissue');
  }

  function release() {
    const color = heldColor;
    heldColor = null;
    if (color !== null && display.color === 'tissue') display.setColor(color);
  }

  /** The table follows the threshold and minimum size the map is drawn at; a newer request wins. */
  function tabulate() {
    const drawn = state.status === 'ready' && shown && validDisplay(settings);
    if (!drawn) {
      clusterRequest++;
      clusters = { status: 'idle' };
      return;
    }
    const { threshold } = settings;
    const size = minVoxels;
    if (
      clusters.status !== 'idle' &&
      clusters.threshold === threshold &&
      clusters.minVoxels === size
    )
      return;
    const ask = ++clusterRequest;
    clusters = { status: 'loading', threshold, minVoxels: size };
    engine.clusters(threshold, size).then(
      (data) => {
        if (ask === clusterRequest)
          clusters = { status: 'ready', threshold, minVoxels: size, data };
      },
      (error: unknown) => {
        if (ask !== clusterRequest) return;
        console.error(error);
        clusters = { status: 'error', threshold, minVoxels: size, message: String(error) };
      },
    );
  }

  /** The drawn map loses its small clusters at the threshold it is drawn at; the engine keeps the last. */
  function trim() {
    const ask = ++extentRequest;
    engine.extent(settings.threshold, minVoxels).then(
      () => {
        if (ask === extentRequest) placed++;
      },
      (error: Error) => {
        if (ask !== extentRequest || error.name === 'AbortError') return;
        console.error(error);
      },
    );
  }

  function draw() {
    const drawn = state.status === 'ready' && shown && validDisplay(settings);
    if (drawn) trim();
    engine.show(drawn ? settings : null);
    if (drawn) hold();
    else release();
    tabulate();
  }

  /** `keep` is how the map was drawn when it is read again in another template. */
  async function read(next: File, nextSpace: string, keep: MapDisplay | null) {
    const ask = ++request;
    engine.clear();
    release();
    clusterRequest++;
    clusters = { status: 'idle' };
    state = { status: 'loading', name: next.name };
    try {
      const summary = await engine.load(await next.arrayBuffer(), nextSpace);
      if (ask !== request) return;
      file = next;
      if (!keep) {
        title = mapTitle(next.name);
        statistic = fileStatistic(summary.intent, summary.description, next.name);
      }
      settings = keep ?? defaultDisplay(summary);
      placed++;
      state = { status: 'ready', name: next.name, summary };
      draw();
    } catch (error) {
      if (ask !== request || (error as Error).name === 'AbortError') return;
      console.error(error);
      file = null;
      state = {
        status: 'error',
        name: next.name,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    get available() {
      return engine.available;
    },
    get state() {
      return state;
    },
    /** The published template the file is read in, or `unstated`. */
    get space() {
      return space;
    },
    get settings() {
      return settings;
    },
    get shown() {
      return shown;
    },
    get title() {
      return title;
    },
    /** The clusters and peaks of the map as drawn, in its own template space. */
    get clusters() {
      return clusters;
    },
    get statistic() {
      return statistic;
    },
    /** An empty title gives the file's own name back. */
    setTitle(next: string): void {
      title = next.trim() || (state.status === 'ready' ? mapTitle(state.name) : '');
    },
    setStatistic(next: Statistic | null): void {
      statistic = next;
    },
    /** Rises each time the engine has placed a new map or a new extent of it. */
    get placed() {
      return placed;
    },
    /** nilearn's cluster_threshold, in the map's own voxels: smaller clusters are not drawn or listed. */
    get minVoxels() {
      return minVoxels;
    },
    setMinVoxels(next: number): void {
      if (!(Number.isInteger(next) && next >= 0)) {
        throw new RangeError(`A minimum cluster size is a whole number of voxels, not ${next}.`);
      }
      minVoxels = next;
      draw();
    },
    /** The surface the cortex is drawn on while the map shows; a cut draws the pial. */
    get surface() {
      return surface;
    },
    setSurface(next: CortexSurface): void {
      surface = next;
      engine.setSurface(next);
    },
    /** The map is on the stage now. */
    get drawn() {
      return state.status === 'ready' && shown && validDisplay(settings);
    },
    /** Read a file in the chosen template; its threshold and scale start at the defaults. */
    open(next: File): Promise<void> {
      return read(next, space, null);
    },
    /** Read the open file again in another template, keeping how it is drawn. */
    setSpace(next: string): Promise<void> {
      space = next;
      return file ? read(file, next, settings) : Promise.resolve();
    },
    /** A threshold, scale or opacity the stage cannot draw keeps the map hidden until it can. */
    setSettings(next: MapDisplay): void {
      settings = next;
      draw();
    },
    setShown(next: boolean): void {
      shown = next;
      draw();
    },
    remove(): void {
      request++;
      clusterRequest++;
      clusters = { status: 'idle' };
      file = null;
      engine.clear();
      release();
      state = { status: 'empty' };
    },
  };
}

export type UserMapStore = ReturnType<typeof createUserMapStore>;
