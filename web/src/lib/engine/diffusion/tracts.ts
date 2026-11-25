import type { Box3, Matrix4, Object3D, Plane } from 'three';
import { readDiffusionAsset } from '../../core/assets/diffusion-assets.ts';
import { tractCatalog } from '../../core/diffusion/catalogs.ts';
import type { EngineEvents, EngineTracts, LesionSphere, TractCrossing, Vec3 } from '../api.ts';
import { rasToWorld, worldToRas } from '../slices/coordinates.ts';
import { createNativeTractViewer } from './native-viewer.ts';
import { createSampler, valueAt } from '../../core/user-map/sampling.ts';
import { readNifti } from '../../core/user-map/nifti.ts';
import { createReferenceTransform } from './reference-space.ts';
import { countCrossing, createTractLoader } from './tract-file.ts';

type TractEvents = Pick<EngineEvents, 'tractsActive' | 'tractsReady' | 'tractsVisibility'>;

/**
 * Lesion bundles downloaded and counted at once. The downloads overlap the worker's decoding, and
 * at most four files of up to 9 MB are on their way to it.
 */
const COUNT_CONCURRENCY = 4;

export interface TractsOptions {
  /** The anatomy on screen. */
  anatomy: string;
  scene: { add(object: Object3D): void; invalidate(): void };
  emit: <K extends keyof TractEvents>(type: K, event: TractEvents[K]) => void;
}

/** The tracts domain of the engine, with the parts the stage and the facade need beside it. */
export interface Tracts extends EngineTracts {
  readonly bounds: Box3;
  /** The anatomy's own bundles and the lesion count over them; null when the tracts are another subject's. */
  readonly own: {
    readonly bundles: readonly { id: string }[];
    crossing(
      sphere: LesionSphere,
      ids: readonly string[],
      onBundle?: (counted: number, total: number) => void,
    ): Promise<TractCrossing[]>;
    /** One bundle's streamlines that `crossing` counts, shown over the brain whether or not the overlay is. */
    showCrossing(id: string, sphere: LesionSphere): Promise<void>;
    clearCrossing(): void;
  } | null;
  setClippingPlanes(planes: Plane[]): void;
  /** Whether the camera is moving, so the lines it draws are the coarser ones. */
  setMotion(moving: boolean): void;
  dispose(): void;
}

/**
 * The engine half of the tract explorer (native-ui.js:78-294): the native viewer and the shared
 * decode behind the `tracts` domain. The tracts belong to one anatomy; on another, the outline and
 * the streamlines are an independent reference that shows only while the Tracts tab is open.
 */
export function createTracts({ anatomy, scene, emit }: TractsOptions): Tracts {
  const catalog = tractCatalog(anatomy);
  const loadTract = createTractLoader();
  const engine = createNativeTractViewer(catalog, scene.invalidate, loadTract);
  const matchingAnatomy = anatomy === catalog.anatomy;
  scene.add(engine.group);
  engine.setOutlineVisible(!matchingAnatomy);
  let active = false;
  let referenceActive = false;
  let ready = false;
  let loading: Promise<void> | null = null;
  let overlayVisible = false;
  // The lesion's streamlines or a landmark's bundle, drawn alone whether or not the overlay is.
  let isolated: 'lesion' | 'landmark' | null = null;
  let isolation = 0;

  /** Draw `show`'s bundle alone; if its download fails while it is still the latest, nothing is. */
  async function isolate(kind: 'lesion' | 'landmark', show: () => Promise<void>): Promise<void> {
    const ask = ++isolation;
    isolated = kind;
    showGroup();
    try {
      await show();
    } catch (error) {
      if (ask === isolation) {
        isolated = null;
        showGroup();
        // The ordinary tracts are drawn again: said as a shown bundle is, so what was read of the
        // bundle alone, the linked MRI's planes too (SECT-38), is read again.
        emit('tractsVisibility', undefined);
      }
      throw error;
    }
  }

  function showGroup(): void {
    engine.group.visible = matchingAnatomy ? overlayVisible || isolated !== null : active;
    scene.invalidate();
  }

  function bundleOf(id: string) {
    const bundle = catalog.bundles.find((bundle) => bundle.id === id);
    if (!bundle) throw new RangeError(`Unknown tract bundle: ${id}`);
    return bundle;
  }

  // Scanner RAS to the surface's, in millimetres; read apart from the outline, which only the tab loads.
  let toSurface: Promise<number[][]> | null = null;
  function surfaceRows(): Promise<number[][]> {
    toSurface ??= readDiffusionAsset(catalog.reference_space).then(({ buffer }) => {
      const space = JSON.parse(new TextDecoder().decode(buffer)) as {
        anatomy: string;
        scanner_ras_to_surface_ras: number[][];
      };
      if (space.anatomy !== catalog.anatomy) {
        throw new Error('The tract reference space belongs to a different anatomy.');
      }
      // Validates the rows: rigid and orientation-preserving.
      createReferenceTransform(space.scanner_ras_to_surface_ras);
      return space.scanner_ras_to_surface_ras;
    });
    toSurface.catch(() => (toSurface = null));
    return toSurface;
  }
  async function scannerTransform(): Promise<Matrix4> {
    return createReferenceTransform(await surfaceRows()).invert();
  }

  const faMap = matchingAnatomy ? catalog.maps.find((entry) => entry.id === 'fa') : undefined;
  let fa: Promise<(point: Vec3) => number> | null = null;
  /** FA read trilinearly in surface RAS: its voxels carried through the rigid scanner-to-surface rows. */
  function loadFa(): Promise<(point: Vec3) => number> {
    if (!faMap) {
      return Promise.reject(new Error('These tracts have no FA map.'));
    }
    fa ??= Promise.all([readDiffusionAsset(faMap.file), surfaceRows()]).then(
      async ([{ buffer }, rows]) => {
        const image = await readNifti(buffer);
        if (image.volumes.length !== 1) throw new Error('The FA map must be one volume.');
        const voxelToSurface = rows.map((row) =>
          [0, 1, 2, 3].map((column) =>
            row.reduce((sum, value, k) => sum + value * image.voxelToWorld[k]![column]!, 0),
          ),
        );
        const at = valueAt(
          createSampler({
            shape: image.shape,
            voxelToWorld: voxelToSurface,
            data: image.volumes[0]!,
            intent: image.intent,
            description: image.description,
          }),
        );
        return ([x, y, z]: Vec3) => at(x, y, z);
      },
    );
    fa.catch(() => (fa = null));
    return fa;
  }

  /** The points the tract worker needs again: the Tracts tab's decode when it has one, else the file. */
  async function countSource(file: string) {
    const started = loadTract.started(file);
    if (!started) return { buffer: (await readDiffusionAsset(file)).buffer };
    const { pts, offsetPt0 } = await started;
    return { points: { pts, offsetPt0 } };
  }

  /**
   * Each bundle is counted in the tract worker, COUNT_CONCURRENCY at most at once, and only its
   * counts come back. The worker keeps every bundle's occupancy and, up to a byte cap, the points
   * of those near the lesion (tract-count.ts), so a lesion placed again nearby downloads and decodes
   * nothing. A bundle that fails fails the count, and no progress is reported after it.
   */
  async function crossing(
    sphere: LesionSphere,
    ids: readonly string[],
    onBundle?: (counted: number, total: number) => void,
  ): Promise<TractCrossing[]> {
    const centre = worldToRas(rasToWorld(sphere.centre).applyMatrix4(await scannerTransform()));
    const scanner = { centre, radius: sphere.radius };
    const counted: TractCrossing[] = [];
    let next = 0;
    let done = 0;
    let failed = false;
    async function lane(): Promise<void> {
      while (next < ids.length && !failed) {
        const index = next++;
        const id = ids[index]!;
        try {
          const { file } = bundleOf(id);
          const count =
            (await countCrossing(file, scanner)) ??
            (await countCrossing(file, scanner, await countSource(file)))!;
          counted[index] = { id, ...count };
        } catch (error) {
          failed = true;
          throw error;
        }
        if (!failed) onBundle?.(++done, ids.length);
      }
    }
    const lanes = Math.min(COUNT_CONCURRENCY, ids.length);
    await Promise.all(Array.from({ length: lanes }, lane));
    return counted;
  }

  function load(): Promise<void> {
    loading ??= engine
      .load()
      .then(() => {
        ready = true;
        emit('tractsReady', undefined);
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  return {
    anatomy: catalog.anatomy,
    get ready() {
      return ready;
    },
    // A landmark's bundle can show before the Tracts tab ever loads the outline.
    get streamlinesVisible() {
      return engine.group.visible && engine.anyVisible;
    },
    get bounds() {
      return engine.bounds;
    },
    defaultOpacity: catalog.overlay_cortex_opacity,
    hasFa: faMap !== undefined,
    own: matchingAnatomy
      ? {
          bundles: catalog.bundles,
          crossing,
          async showCrossing(id, sphere) {
            const bundle = bundleOf(id);
            await isolate('lesion', () => engine.showLesionTract(bundle, sphere));
            emit('tractsVisibility', undefined);
          },
          clearCrossing() {
            if (isolated !== 'lesion') return;
            isolation++;
            isolated = null;
            engine.clearLesionTract();
            showGroup();
            emit('tractsVisibility', undefined);
          },
        }
      : null,
    snapshot: engine.snapshot,
    hasBundle: engine.hasBundle,

    async setActive(next) {
      if (active !== next) {
        active = next;
        const nextReference = active && !matchingAnatomy;
        if (referenceActive !== nextReference) {
          referenceActive = nextReference;
          emit('tractsActive', { active: referenceActive });
        }
        showGroup();
      }
      if (active && !ready) await load();
    },
    async showLandmarkTract(id) {
      if (!matchingAnatomy) throw new Error('A landmark draws only its own anatomy’s tracts.');
      const bundle = bundleOf(id);
      await isolate('landmark', () => engine.showLandmarkTract(bundle));
      emit('tractsVisibility', undefined);
    },
    clearLandmarkTract() {
      if (isolated !== 'landmark') return;
      isolation++;
      isolated = null;
      engine.clearLandmarkTract();
      showGroup();
      emit('tractsVisibility', undefined);
    },
    async loadBundle(id) {
      await engine.loadBundle(bundleOf(id));
      emit('tractsVisibility', undefined);
    },
    setVisible(id, visible) {
      engine.setVisible(id, visible);
      emit('tractsVisibility', undefined);
    },
    setMinimum: engine.setMinimum,
    setOutlineOpacity: engine.setOpacity,
    setOverlay(visible) {
      if (visible && !matchingAnatomy)
        throw new Error('Tracts can only overlay their own anatomy.');
      overlayVisible = visible;
      showGroup();
      emit('tractsVisibility', undefined);
    },
    onPlane(frame) {
      if (!matchingAnatomy) throw new Error('The linked MRI draws only its own anatomy’s tracts.');
      return engine.onPlane(frame);
    },
    onPlanes(frames) {
      if (!matchingAnatomy) throw new Error('The linked MRI draws only its own anatomy’s tracts.');
      return engine.onPlanes(frames);
    },
    loadFa,
    setClippingPlanes: engine.setClippingPlanes,
    setMotion: engine.setMotion,
    scannerToSurface: (point) => engine.scannerToSurface(point) as Vec3,
    surfaceToScanner: (point) => engine.surfaceToScanner(point) as Vec3,
    dispose: engine.dispose,
  };
}
