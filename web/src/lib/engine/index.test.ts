import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { LineBasicMaterial, Matrix4, Mesh } from 'three';
import type { Material, Object3D } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { readDiffusionAsset } from '../core/assets/diffusion-assets.ts';
import { tractCatalog } from '../core/diffusion/catalogs.ts';
import { t } from '../core/i18n/index.ts';
import type { LoadProgress } from '../types/index.ts';
import type { Engine } from './api.ts';
import { createEngine } from './index.ts';
import { createMriUniforms } from './render/mri-material.ts';
import { modelDirectory, publishedLoader, readManifest } from './model/test-support.ts';
import type { Outlined } from './render/scene.ts';

// The renderer needs a GL context, the model's files come from disk, and the scene and the overlay's
// geometry are spied on: this is the facade's wiring, not the drawing.
const stage = vi.hoisted(() => ({
  outlined: [] as (Outlined | undefined)[],
  attributes: new Map<string, string>(),
  overlap: null as unknown,
  overlayVisible: [] as boolean[],
  warmFails: false,
  scene: null as import('three').Scene | null,
  mriAppearance: [] as boolean[],
  rendererDisposed: 0,
  model: null as import('./model/brain-atlas.ts').BrainAtlas | null,
  compiled: [] as Object3D[],
  /** The layers in the model when each compile was asked for. */
  compiledLayers: [] as string[][],
  /** Whether each compiled root was on the stage when its compile was asked for. */
  compiledOnStage: [] as boolean[],
  /** Holds each compile while set. */
  compileHeld: null as Promise<void> | null,
  /** Redraws asked for while the internal anatomy was shown but not yet compiled. */
  uncompiledDraws: 0,
  /** Holds the internal anatomy's download while set. */
  detailHeld: null as Promise<void> | null,
}));

vi.mock('three', async (importOriginal) => {
  const original = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    domElement = Object.assign(new EventTarget(), {
      style: {} as Record<string, string>,
      tabIndex: -1,
      clientHeight: 600,
      setAttribute(name: string, value: string) {
        stage.attributes.set(name, value);
      },
      remove() {},
      ownerDocument: new EventTarget(),
      getRootNode: () => new EventTarget(),
      setPointerCapture() {},
      releasePointerCapture() {},
      hasPointerCapture: () => false,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    });
    ratio = 1;
    toneMapping = 0;
    getContext = () => null;
    setPixelRatio = (ratio: number) => {
      this.ratio = ratio;
    };
    getPixelRatio = () => this.ratio;
    setOpaqueSort() {}
    setTransparentSort() {}
    setSize() {}
    initRenderTarget() {}
    setAnimationLoop() {}
    dispose() {
      stage.rendererDisposed++;
    }
    forceContextLoss() {}
  }
  return { ...original, WebGLRenderer: FakeRenderer };
});

// The studio environment is drawn on the GPU.
vi.mock('../core/assets/diffusion-assets.ts', async () => {
  const { readPublishedDiffusion } = await import('./diffusion/test-support.ts');
  return { readDiffusionAsset: vi.fn(readPublishedDiffusion) };
});

vi.mock('./render/lighting.ts', () => ({
  createAnatomicalLighting: () => ({ texture: null, dispose() {} }),
}));

vi.mock('./render/scene.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('./render/scene.ts')>();
  return {
    ...original,
    createScene: (...args: Parameters<typeof original.createScene>) => {
      const scene = original.createScene(...args);
      return new Proxy(scene, {
        get(target, key) {
          if (key === 'setOutlined') {
            return (outlined?: Outlined) => {
              stage.outlined.push(outlined);
              target.setOutlined(outlined);
            };
          }
          if (key === 'setMriAppearance') {
            return (active: boolean) => {
              stage.mriAppearance.push(active);
              target.setMriAppearance(active);
            };
          }
          if (key === 'scene') stage.scene = target.scene;
          if (key === 'compile') {
            return (root: Object3D) => {
              stage.compiled.push(root);
              stage.compiledLayers.push([...(stage.model?.layers.keys() ?? [])]);
              stage.compiledOnStage.push(root.parent !== null);
              return stage.compileHeld ?? Promise.resolve();
            };
          }
          if (key === 'invalidate') {
            return () => {
              const learning = stage.model?.layers.get('learning')?.scene;
              const compiled = stage.compiledLayers.some((layers) => layers.includes('learning'));
              if (learning?.visible && stage.model!.group.parent && !compiled)
                stage.uncompiledDraws++;
              target.invalidate();
            };
          }
          if (key === 'warmOutlines') {
            return async () => {
              if (stage.warmFails) throw new Error('The outline programs did not compile.');
            };
          }
          return Reflect.get(target, key) as unknown;
        },
      });
    },
  };
});

vi.mock('./model/brain-atlas.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('./model/brain-atlas.ts')>();
  class FromDisk extends original.BrainAtlas {
    static override async load(
      _url: string | URL,
      atlas?: string,
      options?: import('./model/brain-atlas.ts').LoadOptions,
    ): Promise<InstanceType<typeof original.BrainAtlas>> {
      const published = publishedLoader(modelDirectory('cdmd'));
      const model = new original.BrainAtlas(readManifest('cdmd'), {
        async loadAsync(file, onProgress) {
          if (file === 'learning.glb') await stage.detailHeld;
          const scene = await published.loadAsync(file);
          onProgress?.({ loaded: 1, total: 1 });
          return scene;
        },
      });
      stage.model = model;
      await model.initialize(atlas, options);
      return model;
    }
  }
  return { ...original, BrainAtlas: FromDisk };
});

// The overlap's geometry is a file only the browser project fetches; its outline is the subject here.
vi.mock('./comparison/overlay.ts', async () => {
  const { Group } = await import('three');
  return {
    createComparisonOverlay: () => {
      const group = new Group();
      let active = false;
      return {
        group,
        get outlined() {
          return active && group.visible ? [stage.overlap as Object3D] : [];
        },
        async highlight() {
          active = true;
          return true;
        },
        clear() {
          active = false;
        },
        setVisible(visible: boolean) {
          group.visible = visible;
          stage.overlayVisible.push(visible);
        },
        dispose() {},
      };
    },
  };
});

beforeEach(() => {
  stage.outlined = [];
  stage.attributes.clear();
  stage.overlap = new Mesh();
  stage.overlayVisible = [];
  stage.warmFails = false;
  stage.mriAppearance = [];
  stage.rendererDisposed = 0;
  stage.model = null;
  stage.compiled = [];
  stage.compiledLayers = [];
  stage.compiledOnStage = [];
  stage.compileHeld = null;
  stage.uncompiledDraws = 0;
  stage.detailHeld = null;
  vi.spyOn(EffectComposer.prototype, 'render').mockImplementation(() => {});
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('document', { documentElement: {} });
  vi.stubGlobal('location', { href: 'http://localhost/' });
  vi.stubGlobal('getComputedStyle', () => ({
    getPropertyValue: (name: string) => (name === '--scene-exposure' ? '1' : '#808080'),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function boot(onProgress?: (progress: LoadProgress) => void): Promise<Engine> {
  const host = Object.assign(new EventTarget(), {
    prepend() {},
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
  });
  return createEngine({
    host: host as unknown as HTMLElement,
    manifestUrl: 'http://localhost/models/cdmd/manifest.json',
    theme: 'light',
    ...(onProgress && { onProgress }),
  });
}

const GEOMETRY = { file: 'atlas-overlaps.glb', sha256: '0'.repeat(64) };

describe('the engine facade', () => {
  it('words the canvas in the reader’s language, and as the reference when it is shown alone', async () => {
    const engine = await boot();
    engine.present({ lang: 'fr', referenceOnly: false });
    assert.equal(stage.attributes.get('aria-label'), t('fr', 'viewport').canvasLabel);
    assert.equal(stage.attributes.get('aria-roledescription'), t('fr', 'viewport').canvasRole);
    engine.present({ lang: 'en', referenceOnly: true });
    assert.equal(stage.attributes.get('aria-label'), t('en', 'diffusion').nativeCanvas);
    assert.equal(stage.attributes.get('aria-roledescription'), t('en', 'viewport').canvasRole);
    engine.dispose();
  });

  it('redraws nothing for a presentation or a comparison visibility the stage already shows', async () => {
    const engine = await boot();
    engine.present({ lang: 'en', referenceOnly: false });
    assert.equal(stage.attributes.get('aria-label'), t('en', 'viewport').canvasLabel);
    stage.outlined = [];
    engine.present({ lang: 'en', referenceOnly: false });
    engine.comparison.setVisible(true);
    assert.equal(stage.outlined.length, 0);
    assert.deepEqual(stage.overlayVisible, []);
    engine.present({ lang: 'fr', referenceOnly: false });
    assert.equal(stage.outlined.length, 1, 'a new language is a new presentation');
    engine.dispose();
  });

  it('draws the overlap in place of the selection, and puts the selection back when it is hidden', async () => {
    const engine = await boot();
    const region = engine.model.manifest.regions.find(
      (candidate) => candidate.kind === 'cortex' && candidate.atlas === engine.model.settings.atlas,
    )!;
    engine.model.select(region.id);
    const drawn = () => stage.outlined.at(-1)!;
    assert.equal(drawn().selected!.length, 1, 'the selection is outlined');
    assert.equal(await engine.comparison.highlight('overlap', GEOMETRY), true);
    assert.deepEqual(drawn().selected, [stage.overlap], 'the overlap replaces the selection');
    // S1 hides the overlay when a cut opens; the outline must follow without another model change.
    stage.outlined = [];
    engine.comparison.setVisible(false);
    assert.deepEqual(stage.overlayVisible, [false]);
    assert.equal(stage.outlined.length, 1, 'setVisible redraws the outline itself');
    assert.equal(drawn().selected!.length, 1);
    assert.notDeepEqual(drawn().selected, [stage.overlap]);
    engine.comparison.setVisible(true);
    assert.deepEqual(drawn().selected, [stage.overlap]);
    engine.comparison.clear();
    assert.notDeepEqual(drawn().selected, [stage.overlap]);
    engine.dispose();
  });

  it('keeps every model change in one change event with the cut’s state beside it', async () => {
    const engine = await boot();
    const changes: unknown[] = [];
    engine.on('change', (change) => changes.push(change));
    engine.model.setHemisphere('left');
    const last = changes.at(-1) as { model: { hemisphere: string }; sections: { mode: string } };
    assert.equal(last.model.hemisphere, 'left');
    assert.equal(last.sections.mode, 'off');
    engine.dispose();
  });

  it('compiles a first Focus’s, T1 colour’s and Tracts tab’s programs at idle, drawing nothing new', async () => {
    const idle: (() => void)[] = [];
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => idle.push(callback));
    vi.stubGlobal('cancelIdleCallback', () => {});
    const engine = await boot();
    const meshes = stage.model!.visibleMeshes;
    const drawn = () =>
      meshes.map(({ material }) => [material.transparent, material.customProgramCacheKey()]);
    const before = drawn();
    const atStart = stage.compiled.length;
    assert.ok(
      stage.compiled.every((root) => root === stage.model!.group),
      'until the page is idle, only what is drawn is compiled',
    );
    for (const run of idle.splice(0)) run();
    assert.equal(stage.compiled.length, atStart + 1);
    const samples = stage.compiled.at(-1)!;
    assert.equal(samples.parent, null, 'the samples are not on the stage');
    const compiled = samples.children.map((child) => (child as Mesh).material as Material);
    const key = (kind: (region: string) => boolean) =>
      meshes
        .find((mesh) => kind(mesh.userData['kind'] as string))!
        .material.customProgramCacheKey();
    const cortex = key((kind) => kind === 'cortex');
    const deep = key((kind) => kind !== 'cortex' && kind !== 'non-region');
    const has = (transparent: boolean, programKey: string) =>
      compiled.some(
        (material) =>
          material.transparent === transparent && material.customProgramCacheKey() === programKey,
      );
    assert.ok(has(true, cortex), 'Focus sees through the cortex');
    assert.ok(has(true, deep), 'and through what lies under it');
    assert.ok(has(false, `${cortex}-mri-surface-mid-thickness`), 'the T1 colour scans the cortex');
    assert.ok(has(false, `${deep}-mri-surface-inside`), 'and the deep structures');
    assert.equal(compiled.filter((material) => material instanceof LineBasicMaterial).length, 2);
    assert.deepEqual(drawn(), before, 'what is drawn keeps its materials');
    engine.dispose();
  });

  it('FACADE-40 draws the cortex while the internal anatomy downloads, and starts only once that is in', async () => {
    let release!: () => void;
    stage.detailHeld = new Promise((resolve) => (release = resolve));
    const reported: LoadProgress[] = [];
    let started = false;
    const starting = boot((progress) => reported.push(progress)).then((engine) => {
      started = true;
      return engine;
    });
    await vi.waitFor(() => assert.ok(reported.some((progress) => progress.internal)));
    assert.equal(
      stage.scene!.children.includes(stage.model!.group),
      true,
      'the cortex is on stage',
    );
    assert.deepEqual(stage.compiledLayers[0], ['destrieux'], 'its programs compiled on their own');
    assert.equal(stage.compiledOnStage[0], false, 'before it is on the stage');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(started, false, 'the engine is not handed over while the internal anatomy loads');
    assert.equal(stage.model!.layers.has('learning'), false);
    release();
    const engine = await starting;
    assert.deepEqual(stage.compiledLayers.at(-1)!.sort(), ['destrieux', 'learning']);
    assert.equal(stage.uncompiledDraws, 0, 'the internal anatomy is not drawn before it compiles');
    assert.ok(
      stage.model!.layers.get('learning')!.meshes.every((mesh) => mesh.geometry.boundsTree),
    );
    engine.dispose();
  });

  it('FACADE-40 a start that fails while the cortex compiles draws and reports nothing more', async () => {
    let fail!: (error: Error) => void;
    stage.detailHeld = new Promise((_resolve, reject) => (fail = reject));
    let compiled!: () => void;
    stage.compileHeld = new Promise((resolve) => (compiled = resolve));
    const reported: LoadProgress[] = [];
    const starting = boot((progress) => reported.push(progress));
    await vi.waitFor(() => assert.equal(stage.compiled.length, 1));
    fail(new Error('learning.glb: HTTP 404'));
    await assert.rejects(starting, /HTTP 404/);
    const heard = reported.length;
    compiled();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(stage.model!.group.parent, null, 'the cortex is not put on the stage');
    assert.equal(reported.length, heard, 'no progress after the failure');
    assert.equal(stage.compiled.length, 1);
    assert.equal(stage.model!.disposed, true);
  });

  // Deviation e7-warm-outlines-fail-fast: legacy logged the failure and started anyway.
  it('leaves the exploded view alone when a lesion tract lands after it was cleared', async () => {
    const engine = await boot();
    const [bundle] = tractCatalog('cdmd').bundles;
    const { readPublishedDiffusion } = await import('./diffusion/test-support.ts');
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    vi.mocked(readDiffusionAsset).mockImplementation(async (file) => {
      if (file === bundle!.file) await held;
      return readPublishedDiffusion(file);
    });
    engine.model.setExploded(true);
    const shown = engine.lesion.showTract(bundle!.id, { centre: [0, 0, 0], radius: 10 });
    engine.lesion.clearTract();
    release();
    await shown;
    vi.mocked(readDiffusionAsset).mockImplementation(readPublishedDiffusion);
    assert.equal(engine.model.settings.exploded, true);
    engine.dispose();
  });

  it('rejects when the outline programs cannot be compiled, freeing the scene and the model', async () => {
    stage.warmFails = true;
    await assert.rejects(boot(), /outline programs did not compile/);
    assert.equal(stage.rendererDisposed, 1);
    assert.equal(stage.model!.disposed, true);
  });

  it('opens with the cut hidden, and keeps the scan under a paint, though not under the reference', async () => {
    const engine = await boot();
    const cut = stage.scene!.children.find((child) => child.name === 'GPU labelled brain sections');
    assert.equal(cut?.visible, false, 'no cut is drawn until one is chosen');
    stage.model!.setMriAnatomy({
      mriUniforms: createMriUniforms({
        texture: null,
        worldToVoxel: new Matrix4(),
        volume: { shape: [1, 1, 1] },
      }),
    });
    engine.model.setSurfaceColor('mri');
    assert.equal(stage.mriAppearance.at(-1), true);
    const region = engine.model.manifest.regions.find((candidate) => candidate.kind === 'cortex')!;
    engine.model.setPaint({ id: 'paint', colors: new Map([[region.id, [1, 2, 3] as const]]) });
    assert.equal(stage.mriAppearance.at(-1), true, 'a paint is drawn over the scan');
    engine.present({ lang: 'en', referenceOnly: true });
    assert.equal(stage.mriAppearance.at(-1), false, 'the reference shows no scan');
    engine.present({ lang: 'en', referenceOnly: false });
    assert.equal(stage.mriAppearance.at(-1), true);
    engine.dispose();
  });
});
