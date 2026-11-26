import { Color, NeutralToneMapping, NoToneMapping, PerspectiveCamera, Scene } from 'three';
import type { Box3, Object3D, Plane, Vector3 } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { token } from './tokens.ts';
import { createAnatomicalLighting } from './lighting.ts';
import type { LightingSettings } from './lighting.ts';
import type { Rect, Size } from './effective-viewport.ts';
import type { FitScale } from './camera-views.ts';
import { createCameraMotion } from './camera-motion.ts';
import { outline, themeOutlines, warmOutlines } from './outline-passes.ts';
import { createRenderer } from './renderer.ts';
import type { SnapshotOptions } from '../../types/index.ts';

// How long a camera moved by a gesture must rest before the full-resolution frame is drawn.
const SETTLE_MS = 150;
// A frame at rest drawn this long after the last one has the GPU to itself, so its time is its own.
const QUIET_MS = 100;
/** Under reduced motion a change of view is a dissolve this long, in milliseconds. */
const DISSOLVE_MS = 160;

/** How much of each canvas edge the interface covers, in CSS pixels. */
export interface ChromeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * The bands framing keeps clear: the stage dock's at the bottom, a colour key's at the top or right, an open
 * stage popover's at the left.
 */
export type FramingInset = ChromeInsets;

/** The manifest's `appearance.lighting`: the rig's intensities and the environment's. */
export interface Appearance {
  lighting: LightingSettings & { environment: number };
}

/** A framed destination. */
export interface CameraPlan {
  position: Vector3;
  target: Vector3;
  near: number;
  far: number;
  minDistance: number;
  maxDistance: number;
}

export interface CameraDestination extends CameraPlan {
  up: Vector3;
}

export interface SceneCallbacks {
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onResize?: (change: { canvasChanged: boolean }) => void;
  /** Before the first frame of a camera move and the full-resolution frame at rest. */
  onMotion?: (moving: boolean) => void;
  /** Move the anatomy on to the frame's time; true when it moved, which is drawn as motion is. */
  onFrame?: (now: number) => boolean;
}

export interface Outlined {
  selected?: readonly Object3D[];
  hovered?: readonly Object3D[];
  /** The cut's planes, which the outline's depth and mask are clipped by as the anatomy is. */
  planes?: readonly Plane[];
  /** Drawn on the stage but left out of the outline's depth and mask. */
  leaveOut?: readonly Object3D[];
}

export interface MoveOptions {
  immediate?: boolean;
}

export interface SnapshotCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** `frameTo` from `camera-views.ts`: frames bounds on the camera and returns the orbit target. */
export type FrameTo = (
  camera: PerspectiveCamera,
  controls: OrbitControls,
  bounds: Box3,
  direction: Vector3,
  fit?: FitScale,
  points?: ArrayLike<number> | null,
) => Vector3;

export interface EngineScene {
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  domElement: HTMLCanvasElement;
  applyTheme(): void;
  setAppearance(next: Appearance): void;
  setSize(): void;
  setOutlined(outlined?: Outlined): void;
  moveTo(plan: CameraPlan, options?: MoveOptions): void;
  invalidate(): void;
  /** Draw as a moving camera does, at the motion resolution until SETTLE_MS pass without a call. */
  markMotion(): void;
  /** Compile the outline programs before a pointer reaches a region, off this thread. */
  warmOutlines(root: Object3D): Promise<void>;
  /** Compile the programs `root`'s materials need now, off the frame that first draws them. */
  compile(root: Object3D): Promise<void>;
  /** Declare how much of the canvas the interface covers; `settle` is the sheet springing to a detent. */
  setChromeInsets(
    next: Partial<ChromeInsets>,
    options?: { settle?: boolean; velocity?: number },
  ): void;
  /** Keep framing clear of bands of the visible rectangle. Returns whether it changed. */
  setFramingInset(next?: Partial<FramingInset>, options?: MoveOptions): boolean;
  /** The canvas rectangle the interface leaves uncovered, in CSS pixels. */
  readonly visibleRect: Rect;
  /** The fraction of each frustum axis framing may use, for `planFraming`. */
  readonly viewportFit: { horizontal: number; vertical: number };
  /** Where the camera is headed: a move's plan, or where it already is. */
  readonly destination: CameraDestination;
  /** The canvas's CSS size, as of the last resize. */
  readonly hostSize: Size;
  readonly distanceToTarget: number;
  readonly viewportHeight: number;
  captureSnapshot(
    crop?: SnapshotCrop,
    options?: SnapshotOptions,
  ): { canvas: HTMLCanvasElement; ratio: number };
  setMriAppearance(active: boolean): void;
  dispose(): void;
}

/**
 * The renderer, its passes, and the camera transition, drawn by one frame loop.
 *
 * Owns nothing about the interface: it is handed a host element and told what
 * to outline. Selection and hover are drawn here, over the render, so the
 * model never has to alter a material to show them. Its seams: the renderer and
 * its targets (`renderer.ts`), the controls and camera motion (`camera-motion.ts`)
 * and the outline passes (`outline-passes.ts`).
 */
export function createScene(
  host: HTMLElement,
  { onContextLost, onContextRestored, onResize, onMotion, onFrame }: SceneCallbacks = {},
): EngineScene {
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.001, 10);
  const rendering = createRenderer(host, scene, camera);
  const { renderer, settled, moving, pipelines } = rendering;
  // Read on every camera change and every frame of a sheet drag; the observer
  // below is the only thing that can change it.
  const initial = host.getBoundingClientRect();
  let hostSize: Size = { width: initial.width, height: initial.height };

  scene.add(camera);
  let lighting: ReturnType<typeof createAnatomicalLighting> | null = null;
  let appearance: Appearance | null = null;
  let mriAppearance = false;

  let dirty = true;
  let looping = false;
  let lastMotion = -Infinity;
  let lastDrawn = -Infinity;
  let showingMotion = false;
  let fading: { overlay: HTMLCanvasElement; animation: Animation } | null = null;
  const invalidate = () => {
    dirty = true;
    if (!looping) startLoop();
  };
  const cameraMoved = () => {
    lastMotion = performance.now();
    invalidate();
  };

  const motion = createCameraMotion(camera, renderer.domElement, {
    get hostSize() {
      return hostSize;
    },
    invalidate,
    moving: (now) => {
      lastMotion = now;
    },
    rest: () => {
      lastMotion = -Infinity;
    },
    dissolve,
    onResize,
  });
  const { controls } = motion;

  function setAppearance(next: Appearance) {
    appearance = next;
    lighting?.dispose();
    lighting = createAnatomicalLighting(renderer, camera, appearance.lighting);
    scene.environment = lighting.texture;
    scene.environmentIntensity = appearance.lighting.environment;
    invalidate();
  }

  function applyTheme() {
    scene.background = new Color(token('--scene-background'));
    const raw = token('--scene-exposure');
    const exposure = Number(raw);
    if (raw === '' || !Number.isFinite(exposure))
      throw new Error('The --scene-exposure token is not a number.');
    renderer.toneMappingExposure = exposure;
    themeOutlines(pipelines);
    invalidate();
  }

  function setMriAppearance(active: boolean) {
    if (mriAppearance === active) return;
    mriAppearance = active;
    renderer.toneMapping = active ? NoToneMapping : NeutralToneMapping;
    setSize();
  }

  function setSize() {
    const { width, height } = host.getBoundingClientRect();
    hostSize = { width, height };
    if (!width || !height) return;
    rendering.setSize(width, height, mriAppearance);
    camera.aspect = width / height;
    motion.applyViewOffset();
    camera.updateProjectionMatrix();
    invalidate();
    // The scale bar is derived from the viewport height, so it is stale the
    // moment the viewport changes and cannot wait for the camera to move.
    onResize?.({ canvasChanged: true });
  }

  function setOutlined(outlined: Outlined = {}) {
    outline(pipelines, outlined);
    invalidate();
  }

  /**
   * Under reduced motion a change of view is a dissolve, not a cut and not a move: the frame on
   * screen is copied over the canvas, the change is made and drawn beneath it, and the copy fades.
   * A second change in the same frame keeps the first copy.
   */
  function dissolve(change: () => void) {
    if (!fading?.animation.pending) {
      const source = renderer.domElement;
      // The drawing buffer is not preserved past the task that drew it: draw the frame again to copy it.
      (showingMotion ? moving : settled).composer.render();
      const overlay = document.createElement('canvas');
      overlay.width = source.width;
      overlay.height = source.height;
      const context = overlay.getContext('2d');
      if (!context) throw new Error('A 2D canvas context is unavailable for the dissolve.');
      context.drawImage(source, 0, 0);
      if (fading) {
        // Still fading: the screen shows the last copy over the canvas.
        context.globalAlpha = Number(getComputedStyle(fading.overlay).opacity);
        context.drawImage(fading.overlay, 0, 0, overlay.width, overlay.height);
        fading.overlay.remove();
      }
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.cssText =
        'position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;';
      source.after(overlay);
      const shown = {
        overlay,
        animation: overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DISSOLVE_MS }),
      };
      fading = shown;
      void shown.animation.finished.then(() => {
        overlay.remove();
        if (fading === shown) fading = null;
      });
    }
    change();
    // Drawn now and at full resolution, so the copy fades onto the frame that stays.
    if (showingMotion) onMotion?.(false);
    showingMotion = false;
    lastMotion = -Infinity;
    settled.composer.render();
    lastDrawn = performance.now();
    dirty = false;
  }

  function tick(now: number) {
    const placing = onFrame?.(now) ?? false;
    if (placing) {
      lastMotion = now;
      dirty = true;
    }
    motion.step(now);
    // Solid cuts interleave winding masks and caps in a defined render order.
    renderer.sortObjects = true;
    const inMotion = performance.now() - lastMotion < SETTLE_MS;
    // The camera has come to rest on a reduced frame: redraw it at full resolution.
    if (!inMotion && showingMotion) dirty = true;
    if (!dirty && !motion.animating && !inMotion) {
      renderer.setAnimationLoop(null);
      looping = false;
      return;
    }
    if (!dirty) return;
    if (inMotion !== showingMotion) onMotion?.(inMotion);
    if (inMotion) moving.composer.render();
    else rendering.renderSettled(now - lastDrawn >= QUIET_MS);
    lastDrawn = now;
    showingMotion = inMotion;
    dirty = false;
  }

  function startLoop() {
    looping = true;
    renderer.setAnimationLoop(tick);
  }
  startLoop();

  // Reported upward rather than written to the DOM: the app owns status, and
  // a status written here would be overwritten by the next render.
  const handleLost = (event: Event) => {
    event.preventDefault();
    onContextLost?.();
  };
  const handleRestored = () => {
    // The environment map was rendered on the GPU and has no copy to re-upload: render it again.
    if (appearance) setAppearance(appearance);
    applyTheme();
    setSize();
    onContextRestored?.();
  };
  renderer.domElement.addEventListener('webglcontextlost', handleLost);
  renderer.domElement.addEventListener('webglcontextrestored', handleRestored);

  // Resizing the canvas clears it: drawn in the observer, which runs before paint, the cleared canvas
  // is never shown. Resizes in quick succession (a dragged dock) draw the reduced motion frame, and the
  // full one follows once they stop.
  let lastResize = -Infinity;
  const observer = new ResizeObserver(() => {
    setSize();
    if (!hostSize.width || !hostSize.height) return;
    const now = performance.now();
    if (now - lastResize < SETTLE_MS) lastMotion = now;
    lastResize = now;
    tick(now);
  });
  observer.observe(host);
  // A window moved to another display, or a page zoom, changes devicePixelRatio without a resize. The
  // query matches one ratio, so it is asked again at each new one.
  let pixelRatioQuery: MediaQueryList | undefined;
  const watchPixelRatio = () => {
    pixelRatioQuery = globalThis.matchMedia?.(`(resolution: ${globalThis.devicePixelRatio}dppx)`);
    pixelRatioQuery?.addEventListener('change', pixelRatioChanged, { once: true });
  };
  const pixelRatioChanged = () => {
    rendering.readDensity();
    setSize();
    watchPixelRatio();
  };
  watchPixelRatio();
  controls.addEventListener('change', cameraMoved);

  return {
    scene,
    camera,
    controls,
    domElement: renderer.domElement,
    applyTheme,
    setAppearance,
    setSize,
    setOutlined,
    moveTo: motion.moveTo,
    invalidate,
    markMotion: cameraMoved,
    compile: (root) => rendering.compile(root),
    warmOutlines: (root) =>
      warmOutlines(settled, root, {
        renderer,
        target: settled.composer.readBuffer,
        scene,
        camera,
      }),
    setChromeInsets: motion.setChromeInsets,
    setFramingInset: motion.setFramingInset,

    get visibleRect() {
      return motion.visibleRect;
    },

    get viewportFit() {
      return motion.viewportFit;
    },

    get destination() {
      return motion.destination;
    },

    get hostSize() {
      return hostSize;
    },

    get distanceToTarget() {
      return camera.position.distanceTo(controls.target);
    },
    get viewportHeight() {
      return hostSize.height;
    },

    captureSnapshot(crop = { x: 0, y: 0, ...hostSize }, options = {}) {
      return rendering.captureSnapshot(crop, hostSize, invalidate, options);
    },

    setMriAppearance,

    dispose() {
      renderer.setAnimationLoop(null);
      looping = false;
      observer.disconnect();
      pixelRatioQuery?.removeEventListener('change', pixelRatioChanged);
      controls.removeEventListener('change', cameraMoved);
      motion.dispose();
      fading?.overlay.remove();
      renderer.domElement.removeEventListener('webglcontextlost', handleLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleRestored);
      lighting?.dispose();
      rendering.dispose();
    },
  };
}

/**
 * Where a camera would sit to frame these bounds, without moving it there.
 *
 * `fit` is the fraction of each frustum axis the interface leaves uncovered,
 * from `scene.viewportFit`. It reaches `frameTo` unchanged, so framing fits
 * the anatomy to what the reader can see rather than to the whole canvas.
 */
export function planFraming(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  bounds: Box3,
  direction: Vector3,
  frameTo: FrameTo,
  fit: FitScale,
  points: ArrayLike<number> | null = null,
): CameraPlan {
  const start = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    target: controls.target.clone(),
    near: camera.near,
    far: camera.far,
    minDistance: controls.minDistance,
    maxDistance: controls.maxDistance,
  };
  const target = frameTo(camera, controls, bounds, direction, fit, points);
  const plan = {
    position: camera.position.clone(),
    target: target.clone(),
    near: camera.near,
    far: camera.far,
    minDistance: controls.minDistance,
    maxDistance: controls.maxDistance,
  };
  // A plan is a dry run: the real camera must read exactly as it did before it.
  camera.position.copy(start.position);
  camera.quaternion.copy(start.quaternion);
  controls.target.copy(start.target);
  camera.near = start.near;
  camera.far = start.far;
  controls.minDistance = start.minDistance;
  controls.maxDistance = start.maxDistance;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return plan;
}
