import { UNSTATED } from '../core/coordinates/spaces.ts';
import {
  VOLUMES_PER_SECOND,
  defaultDisplay,
  fileStatistic,
  mapTitle,
  validDisplay,
} from '../core/user-map/display.ts';
import type { CortexSurface, MapDisplay, MapSummary, Statistic } from '../core/user-map/display.ts';
import type { Cluster } from '../core/user-map/clusters.ts';
import type { MapCourse } from '../core/user-map/course.ts';
import type { EngineUserMap } from '../engine/api.ts';
import type { SurfaceColor } from '../types/index.ts';

export type UserMapState =
  | { status: 'empty' }
  | { status: 'loading'; name: string }
  | { status: 'ready'; name: string; summary: MapSummary }
  | { status: 'error'; name: string; error: unknown };

type ClusterAsk = { threshold: number; minVoxels: number; volume: number };
export type ClusterState =
  | { status: 'idle' }
  | ({ status: 'loading' } & ClusterAsk)
  | ({ status: 'ready'; data: Cluster[] } & ClusterAsk)
  | ({ status: 'error'; message: string } & ClusterAsk);

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
  // The series' volume drawn, from 0, and whether it steps through them.
  let volume = $state(0);
  let playing = $state(false);
  let playRequest = 0;
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

  /**
   * The table follows the volume, threshold and minimum size the map is drawn at; a newer request
   * wins. A playing series lists none, so its volumes are not held up by tables nobody reads.
   */
  function tabulate() {
    const drawn = state.status === 'ready' && shown && validDisplay(settings);
    if (!drawn || playing) {
      clusterRequest++;
      clusters = { status: 'idle' };
      return;
    }
    const asked: ClusterAsk = { threshold: settings.threshold, minVoxels, volume };
    if (
      clusters.status !== 'idle' &&
      clusters.threshold === asked.threshold &&
      clusters.minVoxels === asked.minVoxels &&
      clusters.volume === asked.volume
    )
      return;
    const ask = ++clusterRequest;
    clusters = { status: 'loading', ...asked };
    engine.clusters(asked.threshold, asked.minVoxels, asked.volume).then(
      (data) => {
        if (ask === clusterRequest) clusters = { status: 'ready', ...asked, data };
      },
      (error: unknown) => {
        if (ask !== clusterRequest) return;
        console.error(error);
        clusters = { status: 'error', ...asked, message: String(error) };
      },
    );
  }

  /**
   * The drawn volume, its small clusters trimmed at the threshold it is drawn at; the engine keeps the
   * last. Settles once it is placed or given up.
   */
  function trim(): Promise<void> {
    const ask = ++extentRequest;
    return engine.extent(settings.threshold, minVoxels, volume).then(
      () => {
        if (ask === extentRequest) placed++;
      },
      (error: Error) => {
        if (ask !== extentRequest || error.name === 'AbortError') return;
        console.error(error);
      },
    );
  }

  function draw(): Promise<void> {
    const drawn = state.status === 'ready' && shown && validDisplay(settings);
    if (!drawn) stop();
    const placing = drawn ? trim() : Promise.resolve();
    engine.show(drawn ? settings : null);
    if (drawn) hold();
    else release();
    tabulate();
    return placing;
  }

  function stop() {
    playRequest++;
    playing = false;
  }

  /** Step to the next volume once the last is placed and its share of a second has passed. */
  async function play(ask: number) {
    while (ask === playRequest && state.status === 'ready') {
      const started = performance.now();
      volume = (volume + 1) % state.summary.volumes;
      await draw();
      const left = 1000 / VOLUMES_PER_SECOND - (performance.now() - started);
      if (left > 0) await new Promise((resolve) => setTimeout(resolve, left));
    }
  }

  /** `keep` is how the map was drawn when it is read again in another template. */
  async function read(next: File, nextSpace: string, keep: MapDisplay | null) {
    const ask = ++request;
    stop();
    const at = keep ? volume : 0;
    engine.clear();
    release();
    clusterRequest++;
    clusters = { status: 'idle' };
    state = { status: 'loading', name: next.name };
    try {
      const summary = await engine.load(await next.arrayBuffer(), nextSpace, at);
      if (ask !== request) return;
      file = next;
      volume = at;
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
      // Worded by the popover in the reader's language (`mapFileReason`).
      state = { status: 'error', name: next.name, error };
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
    /** The volume of a series drawn, from 0; 0 for a single map. */
    get volume() {
      return volume;
    },
    setVolume(next: number): void {
      const count = state.status === 'ready' ? state.summary.volumes : 0;
      if (!(Number.isInteger(next) && next >= 0 && next < count)) {
        throw new RangeError(`The map has no volume ${next}.`);
      }
      volume = next;
      void draw();
    },
    /** A drawn series steps through its volumes, from the one shown, looping until paused. */
    get playing() {
      return playing;
    },
    setPlaying(next: boolean): void {
      if (!next) {
        stop();
        tabulate();
        return;
      }
      if (playing) return;
      if (
        state.status !== 'ready' ||
        !shown ||
        !validDisplay(settings) ||
        state.summary.volumes < 2
      ) {
        throw new Error('Only a drawn series of volumes can play.');
      }
      playing = true;
      tabulate();
      void play(++playRequest);
    },
    /** A region's mean in each volume of the map, or null for a region the engine has no solid for. */
    course(region: string): Promise<MapCourse | null> {
      return engine.course(region);
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
      stop();
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
