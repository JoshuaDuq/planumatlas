import { Box3, Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fetchAsset, sha256Hex } from '../core/assets/asset-cache.ts';
import { validateStrokeCases } from '../core/catalog/stroke-cases.ts';
import type { StrokeCases } from '../core/catalog/stroke-cases.ts';
import { readComparisonGeometry } from '../core/assets/comparison-assets.ts';
import { parseVisualFieldTerritories } from '../core/learning/visual-field.ts';
import type { VisualFieldTerritories } from '../core/learning/visual-field.ts';
import { t } from '../core/i18n/index.ts';
import type {
  CreateEngine,
  Emitter,
  Engine,
  EngineComparison,
  EngineEvents,
  EngineOptions,
  Presentation,
  VisualFieldDot,
} from './api.ts';
import { createEngineModel, createEngineSections } from './adapters.ts';
import { createComparisonOverlay } from './comparison/overlay.ts';
import { tractProgramSamples } from './diffusion/native-viewer.ts';
import { createTracts } from './diffusion/tracts.ts';
import type { Tracts, TractsOptions } from './diffusion/tracts.ts';
import { createFraming } from './framing.ts';
import type { Emit } from './framing.ts';
import { createHeldView } from './held-view.ts';
import { createLesion } from './lesion/lesion.ts';
import { createStrokeCaseSolids } from './lesion/stroke-cases.ts';
import { createUserMap } from './user-map/user-map.ts';
import { BrainAtlas } from './model/brain-atlas.ts';
import { createPresentation } from './presentation.ts';
import { createPicker } from './render/picking.ts';
import { stayOutside, zoomAboutSurface } from './render/orbit-controls.ts';
import { createScene } from './render/scene.ts';
import { token } from './render/tokens.ts';
import type { Appearance as SceneAppearance } from './render/scene.ts';
import { worldToRas } from './slices/coordinates.ts';
import { BrainSections } from './slices/sections.ts';

/** How long the camera must rest before its move counts as settled and the link follows it. */
const CAMERA_REST_MS = 250;

type Listener = (event: unknown) => void;

function createEvents(): Emitter<EngineEvents> & { emit: Emit } {
  const listeners = new Map<keyof EngineEvents, Set<Listener>>();
  return {
    on(type, listener) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener as Listener);
      listeners.set(type, set);
      return () => set.delete(listener as Listener);
    },
    emit(type, event) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}

/** The brain without the supplemental layers: the box the page opens on and framing falls back to. */
function brainBounds(atlas: BrainAtlas): Box3 {
  const box = new Box3();
  for (const [id, layer] of atlas.layers) {
    if (atlas.manifest.supplemental_layers?.some((layer) => layer.id === id)) continue;
    for (const mesh of layer.meshes) box.expandByObject(mesh);
  }
  return box.isEmpty() ? new Box3().setFromObject(atlas.group) : box;
}

/**
 * The real engine: the scene first, then the model, the cut, the tracts and the compiled outline
 * shaders (app.js:118-208, 2122). Everything the application reaches is the contract in `api.ts`; the
 * Three.js, GLTF and NiiVue sides stay behind it.
 */
export const createEngine: CreateEngine = async (options: EngineOptions): Promise<Engine> => {
  const { host, manifestUrl } = options;
  const events = createEvents();
  const cleanups: (() => void)[] = [];
  const dispose = () => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  };

  // Declared before the scene: its resize observer can fire during the model download, which is long.
  let framing: ReturnType<typeof createFraming> | null = null;
  let setTractsMotion: Tracts['setMotion'] | null = null;
  const scene = createScene(host, {
    onContextLost: () => events.emit('contextLost', undefined),
    onContextRestored: () => events.emit('contextRestored', undefined),
    onResize: (change) => framing?.onResize(change),
    onMotion: (moving) => setTractsMotion?.(moving),
  });
  cleanups.push(() => scene.dispose());

  try {
    const atlas = await BrainAtlas.load(manifestUrl, options.atlas, {
      ...(options.detail !== undefined && { detail: options.detail }),
      onProgress: (progress) => {
        if (progress.total) options.onProgress?.(progress);
      },
    });
    cleanups.push(() => atlas.dispose());
    const anatomy = atlas.manifest.anatomy.id;

    scene.applyTheme();
    scene.setSize();
    const { lighting } = atlas.manifest.appearance as { lighting?: SceneAppearance['lighting'] };
    if (!lighting) throw new Error('The manifest publishes no lighting.');
    scene.setAppearance({ lighting });
    const bounds = brainBounds(atlas);
    scene.scene.add(atlas.group);

    const absoluteManifestUrl = new URL(manifestUrl, globalThis.location.href);
    const sections = new BrainSections(atlas, new URL('volumes.json', absoluteManifestUrl));
    cleanups.push(() => sections.dispose());
    scene.scene.add(sections.group);

    const tracts = createTracts({
      anatomy,
      scene: { add: (object) => scene.scene.add(object), invalidate: scene.invalidate },
      emit: events.emit as TractsOptions['emit'],
    });
    cleanups.push(() => tracts.dispose());
    setTractsMotion = tracts.setMotion;
    const lesion = createLesion({
      model: atlas,
      tissues: sections.tissues,
      baseUrl: new URL('volumes.json', absoluteManifestUrl),
      tracts: tracts.own,
      invalidate: scene.invalidate,
    });
    cleanups.push(() => lesion.dispose());
    // A layer of its own, so the tract reference shown alone hides it as it hides the brain.
    const lesionLayer = new Group();
    lesionLayer.add(lesion.group);
    scene.scene.add(lesionLayer);
    const strokeSolids = createStrokeCaseSolids({
      planes: () => atlas.clippingPlanes,
      invalidate: scene.invalidate,
    });
    cleanups.push(() => strokeSolids.dispose());
    lesionLayer.add(strokeSolids.group);

    const reference = {
      active: false,
      get bounds() {
        return tracts.ready ? tracts.bounds : null;
      },
    };

    // Zoom stops short of what the reader is pointing at, and turning never goes beneath a surface;
    // the tract reference has no surface to meet. The zoom wraps the check, so it judges only the turn
    // or pan that follows: a zoom cannot cross.
    const surfaceHit: Parameters<typeof stayOutside>[1] = (raycaster) =>
      reference.active ? null : sections.intersect(raycaster);
    stayOutside(scene.controls, surfaceHit);
    // Framing is created below, before the reader can zoom.
    zoomAboutSurface(scene.controls, surfaceHit, (direction) => framing!.home(direction));

    const held = createHeldView({
      controls: scene.controls,
      host,
      onChange: (isHeld) => events.emit('viewHeld', { held: isHeld }),
    });
    cleanups.push(() => held.dispose());

    // The atlas comparison geometry is named by the call that first asks for it.
    let geometry: { file: string; sha256: string } | null = null;
    const overlay = createComparisonOverlay(async () => {
      const { file, sha256 } = geometry!;
      const buffer = await readComparisonGeometry(new URL(file, absoluteManifestUrl).href, sha256);
      const gltf = await new GLTFLoader().parseAsync(
        buffer,
        new URL('.', absoluteManifestUrl).href,
      );
      return gltf.scene;
    });
    cleanups.push(() => overlay.dispose());
    scene.scene.add(overlay.group);

    const presentation = createPresentation({
      scene,
      model: atlas,
      sections,
      overlay,
      referenceActive: () => reference.active,
      emit: events.emit,
    });
    framing = createFraming({
      scene,
      model: atlas,
      sections,
      held,
      bounds,
      reference,
      emit: events.emit,
    });
    const stage = framing;

    // While the visual-field map is probed, a click reads the cortex there instead of choosing it.
    let probing = false;
    let visualMap: { dot: VisualFieldDot | null } | null = null;
    let territories: Promise<VisualFieldTerritories> | null = null;
    const loadTerritories = () => {
      const published = atlas.manifest.retinotopy;
      if (!published) return Promise.reject(new Error('This anatomy publishes no retinotopy.'));
      territories ??= fetchAsset(new URL(published.file, absoluteManifestUrl))
        .then((buffer) => parseVisualFieldTerritories(JSON.parse(new TextDecoder().decode(buffer))))
        .catch((error: unknown) => {
          territories = null;
          throw error;
        });
      return territories;
    };
    // The cohort and its masks, each read once and checked against the checksum published for it.
    let strokeCases: Promise<StrokeCases> | null = null;
    let strokeMasks: Promise<Uint32Array> | null = null;
    const verified = async (file: string, sha256: string) => {
      const buffer = await fetchAsset(new URL(file, absoluteManifestUrl));
      if ((await sha256Hex(buffer)) !== sha256)
        throw new Error(`${file} does not match its checksum.`);
      return buffer;
    };
    const loadStrokeCases = () => {
      const published = atlas.manifest.stroke_cases;
      if (!published) return Promise.reject(new Error('This anatomy publishes no stroke cases.'));
      strokeCases ??= verified(published.file, published.sha256)
        .then((buffer) =>
          validateStrokeCases(JSON.parse(new TextDecoder().decode(buffer)), atlas.regions),
        )
        .catch((error: unknown) => {
          strokeCases = null;
          throw error;
        });
      return strokeCases;
    };
    const loadStrokeMasks = (data: StrokeCases) => {
      strokeMasks ??= verified(data.masks.file, data.masks.sha256)
        .then((buffer) => {
          const masks = new Uint32Array(buffer);
          const last = data.cases.at(-1);
          if (last && masks.length !== last.runs[0] + last.runs[1]) {
            throw new Error('The stroke-case masks do not hold every case.');
          }
          return masks;
        })
        .catch((error: unknown) => {
          strokeMasks = null;
          throw error;
        });
      return strokeMasks;
    };
    let strokeRequest = 0;
    const showStrokeCases = async (ids: readonly string[]) => {
      const ask = ++strokeRequest;
      if (!ids.length) {
        strokeSolids.clear();
        return;
      }
      const data = await loadStrokeCases();
      const masks = await loadStrokeMasks(data);
      if (ask === strokeRequest) strokeSolids.show(data, masks, ids);
    };
    // Fields and ribbon labels are published beside the manifest.
    const userMap = createUserMap({
      atlas,
      sections,
      baseUrl: absoluteManifestUrl,
      invalidate: scene.invalidate,
    });
    cleanups.push(() => userMap.dispose());
    const showVisualField = (map: typeof visualMap) => {
      atlas.showVisualField(map, token('--overlay-accent'));
      visualMap = map;
      scene.invalidate();
    };

    const picker = createPicker({
      domElement: scene.domElement,
      camera: scene.camera,
      controls: scene.controls,
      model: () =>
        reference.active
          ? { pick: () => null }
          : {
              pick: (ray) => sections.pick(ray) ?? null,
              intersect: (ray) => sections.intersect(ray),
            },
      onHover: presentation.hover,
      onSelect: (id, point) => events.emit('pick', { id, point: point && worldToRas(point) }),
      onFocusPoint: stage.focusWorldPoint,
      placing: () => (lesion.placing || probing) && !reference.active,
      onPlace: (hit) =>
        probing
          ? events.emit('visualFieldPoint', { reading: atlas.visualFieldAt(hit) })
          : events.emit('lesionPoint', { point: worldToRas(hit.point) }),
    });
    cleanups.push(() => picker.dispose());

    // What the last `present()` asked for; every change of the display reapplies it (app.js:1611-1639).
    let shown: Presentation | null = null;
    function refresh() {
      const referenceOnly = shown?.referenceOnly === true;
      const { surfaceColor, paint } = atlas.settings;
      atlas.group.visible = !referenceOnly;
      sections.group.visible = !referenceOnly && sections.active;
      lesionLayer.visible = !referenceOnly;
      if (anatomy === tracts.anatomy) tracts.setClippingPlanes(atlas.clippingPlanes);
      const scanned = surfaceColor === 'mri' && !paint && !referenceOnly;
      scene.setMriAppearance(scanned);
      atlas.userMap.userMapOverScan.value = scanned;
      presentation.outline();
    }

    // The first cut otherwise downloads its anatomy, builds the parcel solids and compiles its
    // programs after the click.
    const prefetchCut = async () => {
      await sections.prefetch();
      if (disposed) return;
      const samples = new Group();
      samples.add(...atlas.cutProgramSamples(), ...sections.tissues.solids.programSamples());
      await scene.compile(samples);
    };
    const engineSections = createEngineSections(sections, prefetchCut);
    const onChange = () => {
      stage.invalidate();
      lesion.refresh();
      strokeSolids.refresh();
      refresh();
      events.emit('change', { model: atlas.state, sections: engineSections.state });
    };
    atlas.addEventListener('change', onChange);
    sections.addEventListener('change', onChange);
    cleanups.push(() => {
      atlas.removeEventListener('change', onChange);
      sections.removeEventListener('change', onChange);
    });
    const onLoadError = (event: Event) =>
      events.emit('loadError', (event as CustomEvent<Error>).detail);
    atlas.addEventListener('loaderror', onLoadError);
    cleanups.push(() => atlas.removeEventListener('loaderror', onLoadError));

    // The camera coasts on after the pointer lifts; it has settled once it has rested.
    let rest: ReturnType<typeof setTimeout> | undefined;
    const onCameraChange = () => {
      clearTimeout(rest);
      rest = setTimeout(() => events.emit('cameraSettled', undefined), CAMERA_REST_MS);
    };
    scene.controls.addEventListener('change', onCameraChange);
    cleanups.push(() => {
      clearTimeout(rest);
      scene.controls.removeEventListener('change', onCameraChange);
    });

    cleanups.push(
      events.on('tractsActive', ({ active }) => {
        reference.active = active;
        presentation.clearHover();
        presentation.outline();
        stage.onReference();
        scene.invalidate();
      }),
      events.on('tractsReady', () => {
        stage.onReferenceReady();
        refresh();
      }),
    );

    const comparison: EngineComparison = {
      async highlight(id, source) {
        geometry = source;
        const applied = await overlay.highlight(id, `${source.file}:${source.sha256}`);
        if (applied) presentation.outline();
        return applied;
      },
      clear() {
        overlay.clear();
        presentation.outline();
      },
      // Redraw the outline too: the overlap's mesh is what it draws while the overlay is shown.
      setVisible(visible) {
        if (overlay.group.visible === visible) return;
        overlay.setVisible(visible);
        presentation.outline();
      },
    };

    // The camera starts inside the brain; frame it before the first layer is asked for more.
    stage.camera.applyView('oblique', { immediate: true });
    scene.warmOutlines(atlas.group);
    stage.onResize({ canvasChanged: false });
    refresh();

    // A first Focus, T1 MRI colour or Tracts tab otherwise compiles its programs in the frame that
    // shows it. The samples are detached: nothing drawn changes.
    const warmPrograms = () => {
      const samples = new Group();
      samples.add(...atlas.programSamples(), ...tractProgramSamples());
      void scene.compile(samples);
    };
    if (typeof requestIdleCallback === 'function') {
      const idle = requestIdleCallback(warmPrograms);
      cleanups.push(() => cancelIdleCallback(idle));
    } else {
      const idle = setTimeout(warmPrograms, 0);
      cleanups.push(() => clearTimeout(idle));
    }

    let disposed = false;
    return {
      on: events.on,
      canvas: scene.domElement,
      model: createEngineModel(atlas),
      sections: engineSections,
      camera: stage.camera,
      comparison,
      tracts,
      lesion: {
        show: lesion.show,
        setPlacing: lesion.setPlacing,
        measure: lesion.measure,
        tractBundles: lesion.tractBundles,
        measureTracts: lesion.measureTracts,
        showTract: lesion.showTract,
        clearTract: lesion.clearTract,
      },
      visualField: {
        available: atlas.visualField !== null,
        show: showVisualField,
        setProbing(next) {
          probing = next;
        },
        territories: loadTerritories,
        centralRegion: (hemisphere) => atlas.visualFieldRegion(hemisphere),
      },
      strokeCases: {
        available: Boolean(atlas.manifest.stroke_cases),
        cases: loadStrokeCases,
        show: showStrokeCases,
      },
      userMap: {
        available: Boolean(atlas.manifest.coordinate_spaces),
        load: userMap.load,
        clusters: userMap.clusters,
        extent: userMap.extent,
        setSurface: userMap.setSurface,
        show: userMap.show,
        clear: userMap.clear,
      },

      applyTheme() {
        scene.applyTheme();
        sections.applyTheme();
        lesion.applyTheme();
        strokeSolids.applyTheme();
        if (visualMap) showVisualField(visualMap);
        refresh();
      },
      present(presentation) {
        if (
          shown?.lang === presentation.lang &&
          shown.referenceOnly === presentation.referenceOnly
        ) {
          return;
        }
        shown = presentation;
        stage.invalidate();
        const viewport = t(presentation.lang, 'viewport');
        scene.domElement.setAttribute(
          'aria-label',
          presentation.referenceOnly
            ? t(presentation.lang, 'diffusion').nativeCanvas
            : viewport.canvasLabel,
        );
        scene.domElement.setAttribute('aria-roledescription', viewport.canvasRole);
        refresh();
      },
      invalidate: scene.invalidate,
      captureSnapshot: (crop) => scene.captureSnapshot(crop),
      dispose() {
        if (disposed) return;
        disposed = true;
        dispose();
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
};
