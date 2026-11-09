import { Box3, Matrix4, Raycaster, Sphere, Vector3 } from 'three';
import type { Intersection, Mesh } from 'three';
import { orbitWithin } from '../core/state/url-state.ts';
import type { ModelState, Orbit, Region, ViewName } from '../types/index.ts';
import type {
  CameraSnapshot,
  CameraView,
  ChromeInsets,
  EngineCamera,
  EngineEvents,
  FrameRegionOptions,
  FramingClearance,
  MoveOptions,
  OrbitTurn,
  Rect,
  Size,
  Vec3,
} from './api.ts';
import type { HeldView } from './held-view.ts';
import type { AtlasMesh } from './model/brain-atlas.ts';
import {
  MIN_CONTEXT_RADIUS,
  REGION_CONTEXT_RADIUS,
  VIEW_DIRECTIONS,
  cutFacingView,
  fitDistance,
  frameTo,
  upFor,
  withContext,
} from './render/camera-views.ts';
import { turnFromKeyboard } from './render/keyboard-orbit.ts';
import { HALF_TURNED, cameraBasis, edgeLabels } from './render/orientation.ts';
import { scaleBar } from './render/scale-bar.ts';
import { planFraming } from './render/scene.ts';
import type { CameraPlan, EngineScene } from './render/scene.ts';
import { rasToWorld } from './slices/coordinates.ts';
import type { Frame } from './slices/coordinates.ts';

export type Emit = <K extends keyof EngineEvents>(type: K, event: EngineEvents[K]) => void;

/** Half the side of the box a cut through the spinal cord is framed in, in metres (app.js:1291). */
const CORD_CUT_HALF_BOX_M = 0.04;
/** How close the camera may come to a point below the brain, e.g. on the cord, in metres (app.js:1790). */
const CORD_MIN_DISTANCE_M = 0.015;
/** Vertices past which framing keeps one in `THINNED_STRIDE` (app.js:325). */
const THINNED_VERTICES = 60000;
const THINNED_STRIDE = 8;
// What `follow` keeps the box's centre inside: the middle third of the visible rectangle.
const FOLLOW_INSET = 1 / 3;
/** A framing fits the whole brain, so the reader's magnification starts at one. */
const WHOLE_ZOOM = 1;
/** Beyond this the up vector differs from the named view's and a link carries it (app.js:821). */
const UP_DIFFERS = 1e-3;
const MM_PER_M = 1000;
/** Surface points tried per mesh of a coloured cortical region when judging whether a framing shows it. */
const SIGHT_SAMPLES = 24;
/** A point is seen when nothing lies this far in front of it, in metres: a shared border is no cover. */
const SIGHT_TOLERANCE_M = 0.0005;
/** The share of a region's sampled points in sight before a framing turns to show it: a sliver is no reason to turn. */
const SIGHT_SHOWN = 0.1;
/** The views a deficit's framing may turn to when its own heading hides coloured regions. */
const SIGHT_VIEWS: readonly ViewName[] = [
  'oblique',
  'left',
  'right',
  'anterior',
  'posterior',
  'superior',
  'inferior',
];

/** What framing reads of the scene. */
export type FramingScene = Pick<
  EngineScene,
  | 'camera'
  | 'controls'
  | 'destination'
  | 'moveTo'
  | 'viewportFit'
  | 'setFramingInset'
  | 'setChromeInsets'
  | 'visibleRect'
  | 'hostSize'
  | 'distanceToTarget'
  | 'viewportHeight'
>;

/** What framing reads of the model: the display state, and what is drawn. */
export interface FramingModel {
  readonly state: ModelState;
  /** The right hemisphere's cortex is turned beside the left's (`BrainAtlas.medialPair`). */
  readonly medialPair: boolean;
  readonly visibleMeshes: readonly AtlasMesh[];
  readonly regions: ReadonlyMap<string, Region>;
  /** Where a mesh is drawn once the exploded view has arrived (`BrainAtlas.settledMatrixWorld`). */
  settledMatrixWorld(mesh: Mesh, target?: Matrix4): Matrix4;
  /** The nearest drawn surface along a ray. */
  intersect(raycaster: Raycaster): Intersection<AtlasMesh> | null;
}

/** What framing reads of the cut. */
export interface FramingSections {
  readonly active: boolean;
  readonly frame: Frame;
  readonly state: { readonly mode: Parameters<typeof cutFacingView>[0]; readonly reverse: boolean };
}

/** The tract reference: shown alone on an anatomy the tracts do not belong to. */
export interface TractReference {
  active: boolean;
  /** Where its streamlines lie; null until the reference has loaded. */
  readonly bounds: Box3 | null;
}

export interface FramingOptions {
  scene: FramingScene;
  model: FramingModel;
  sections: FramingSections;
  held: HeldView;
  /** The whole brain, without the supplemental layers. */
  bounds: Box3;
  reference: TractReference;
  emit: Emit;
}

/** The captured camera `capture` hands out and `restore` takes back (app.js:754-766). */
interface CapturedCamera {
  position: Vector3;
  target: Vector3;
  up: Vector3;
  near: number;
  far: number;
  minDistance: number;
  maxDistance: number;
  zoom: number;
  held: boolean;
}

export interface Framing {
  readonly camera: EngineCamera;
  /** The drawn set changed: the cached bounds and points are stale (app.js:1614). */
  invalidate(): void;
  /** Move the camera onto a point of the surface in world metres: the picker's double click (app.js:1783). */
  focusWorldPoint(point: Vector3): void;
  /** Pan onto a box of world metres once it leaves the middle of the stage. */
  follow(box: Box3): void;
  /** Where zooming out leads the orbit target: what is framed, and the distance it fills the stage from. */
  home(direction: Vector3): { center: Vector3; distance: number };
  /** The stage's canvas resized (app.js:115-125). */
  onResize(change: { canvasChanged: boolean }): void;
  /** The tract reference opened or closed (app.js:1431). */
  onReference(): void;
  /** The tract reference finished loading (app.js:1442). */
  onReferenceReady(): void;
}

const thinned = (vertices: number) => (vertices > THINNED_VERTICES ? THINNED_STRIDE : 1);

/**
 * Where the camera goes and what it keeps (app.js:241-524, 781-822, 1116-1138, 1269-1297, 1495-1550,
 * 1782-1851). It holds the reader's magnification, the framing clearances and the view the camera was
 * last framed on; the held view and the scene are its collaborators.
 */
export function createFraming({
  scene,
  model,
  sections,
  held,
  bounds,
  reference,
  emit,
}: FramingOptions): Framing {
  const { camera, controls } = scene;
  let view: ViewName = 'oblique';
  let framed = false;
  let framingSource: (() => FramingClearance) | null = null;
  // A phone's open stage popover: framing keeps the anatomy above its plate's top edge, on the host.
  let plateTop: number | null = null;
  // The reader's magnification, as a multiple of the distance at which the whole brain just fills the
  // stage. Held across a resize so that a stage which changes shape re-fits instead of clipping the
  // anatomy off its sides or stranding it in the middle of a much larger field.
  let zoom = WHOLE_ZOOM;
  let framingScale = { horizontal: 1, vertical: 1 };
  let cachedBounds: Box3 | null = null;
  let cachedPoints: Float32Array | null = null;
  let orbiting = false;
  let dockPending = false;
  let fitPending: number | null = null;
  // A link's camera stands where it was written, beside the keys its scene brings, which are measured
  // after it is placed: until the camera next moves, a dock change re-reads the magnification instead.
  let linked = false;
  let shown: CameraView = describeCamera();

  function describeCamera(): CameraView {
    const edges = edgeLabels(camera, 'en', controls.target);
    // Each side edge names the hemisphere drawn on that side: the turned one lies toward +z.
    if (model.medialPair) {
      const side = cameraBasis(camera, controls.target).right[2] > 0 ? 'right' : 'left';
      edges[side] = HALF_TURNED[edges[side]];
    }
    return {
      edges,
      scale: scaleBar(camera.fov, scene.distanceToTarget, scene.viewportHeight),
      basis: cameraBasis(camera, controls.target),
    };
  }

  function publishCamera() {
    shown = describeCamera();
    emit('camera', shown);
  }

  function publishViewport() {
    emit('viewport', { visibleRect: { ...scene.visibleRect }, hostSize: { ...scene.hostSize } });
  }

  // Every camera move is a change the link has to follow. A framing chooses its own target, so the pan
  // limit set for the last gesture no longer applies.
  function moveCamera(plan: CameraPlan, options?: MoveOptions) {
    controls.maxTargetRadius = Infinity;
    linked = false;
    scene.moveTo(plan, options);
    emit('cameraSettled', undefined);
  }

  /** The camera's heading where it is going, so a move in flight is read where it lands. */
  const heading = () =>
    scene.destination.position.clone().sub(scene.destination.target).normalize();

  function requireView(name: ViewName): ViewName {
    if (!Object.hasOwn(VIEW_DIRECTIONS, name)) throw new Error(`Unknown view: ${name}`);
    return name;
  }

  const meshesOf = (id: string) =>
    model.visibleMeshes.filter((mesh) => mesh.userData['region_id'] === id);

  // Framing fits where the anatomy is going, so an explode under way is fitted as it will arrive.
  const placed = new Matrix4();
  function settledBox(mesh: Mesh): Box3 {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    return mesh.geometry.boundingBox!.clone().applyMatrix4(model.settledMatrixWorld(mesh, placed));
  }

  function boundsOf(meshes: readonly Mesh[]): Box3 {
    const box = new Box3();
    for (const mesh of meshes) box.union(settledBox(mesh));
    return box;
  }

  function framingBounds(): Box3 {
    if (reference.active && reference.bounds) return reference.bounds;
    const {
      isolatedRegion,
      internalSystem,
      cortexVisible,
      hemisphere,
      spinalCordVisible,
      exploded,
    } = model.state;
    if (isolatedRegion) {
      if (!cachedBounds) {
        const visible = boundsOf(model.visibleMeshes);
        cachedBounds = visible.isEmpty() ? bounds : visible;
      }
      return cachedBounds;
    }
    if (internalSystem === 'Spinal cord') {
      if (!cachedBounds) {
        const cord = boundsOf(
          model.visibleMeshes.filter((mesh) => mesh.userData['atlas'] === 'pam50'),
        );
        cachedBounds = cord.isEmpty() ? bounds : cord;
      }
      return cachedBounds;
    }
    // Exploded, the anatomy reaches far past the box it opened in: fit what is drawn, where it goes.
    if (exploded) {
      if (!cachedBounds) {
        const visible = boundsOf(model.visibleMeshes);
        cachedBounds = visible.isEmpty() ? bounds : visible;
      }
      return cachedBounds;
    }
    // One hemisphere, or the cord added beneath the brain, is not the box the page opened with. Fit
    // what is actually drawn, or the picture keeps a hole where the hidden half was and the cord stays
    // below the frame.
    if (cortexVisible && (hemisphere !== 'both' || spinalCordVisible || model.medialPair)) {
      if (!cachedBounds) {
        const whole = hemisphere === 'both' && !model.medialPair;
        const visible = whole ? bounds.clone() : new Box3();
        for (const mesh of model.visibleMeshes) {
          if (whole && mesh.userData['atlas'] !== 'pam50') continue;
          visible.union(settledBox(mesh));
        }
        cachedBounds = visible.isEmpty() ? bounds : visible;
      }
      return cachedBounds;
    }
    if (cortexVisible) return bounds;
    if (!cachedBounds) {
      const visible = boundsOf(
        model.visibleMeshes.filter((mesh) => mesh.userData['atlas'] !== 'pam50'),
      );
      cachedBounds = visible.isEmpty() ? bounds : visible;
    }
    return cachedBounds;
  }

  /**
   * The vertices framing actually has to contain, in world space.
   *
   * A bounding box is the cheap answer and a loose one: its far corner sticks out past a brain that
   * never reaches it, so an oblique view backs the camera away from a corner rather than from
   * anatomy. Fitting the vertices themselves is exact rather than merely tighter, so it cannot crop
   * anything the box would have kept. Recomputed only when the framed set changes, and sampled where
   * a layer is dense: one vertex in eight of a millimetre-spaced surface still bounds the silhouette
   * far inside the screen margin.
   */
  function framingPoints(): Float32Array | null {
    if (reference.active) return null;
    if (cachedPoints) return cachedPoints;
    const box = framingBounds();
    const meshes = model.visibleMeshes.filter((mesh) => box.intersectsBox(settledBox(mesh)));
    if (!meshes.length) return null;
    const stride = thinned(
      meshes.reduce((total, mesh) => total + mesh.geometry.attributes['position']!.count, 0),
    );
    const kept: number[] = [];
    const point = new Vector3();
    for (const mesh of meshes) {
      const position = mesh.geometry.attributes['position']!;
      model.settledMatrixWorld(mesh, placed);
      for (let i = 0; i < position.count; i += stride) {
        point.fromBufferAttribute(position, i).applyMatrix4(placed);
        // Only what the box already framed. A long supplemental layer can reach into the box and far
        // past it, and framing it would undo the choice of what to frame.
        if (box.containsPoint(point)) kept.push(point.x, point.y, point.z);
      }
    }
    cachedPoints = kept.length ? new Float32Array(kept) : null;
    return cachedPoints;
  }

  /** The scene's fit, narrowed so the anatomy also clears the orientation letters and scale bar. */
  const clearedFit = () => {
    const fit = scene.viewportFit;
    return {
      horizontal: fit.horizontal * framingScale.horizontal,
      vertical: fit.vertical * framingScale.vertical,
    };
  };

  const fittedDistance = (direction: Vector3) =>
    fitDistance(camera, framingBounds(), direction, clearedFit(), framingPoints());

  const isTargetingSpine = () =>
    !reference.active &&
    Boolean(
      model.state.spinalCordVisible &&
      (controls.target.y < bounds.min.y || model.state.internalSystem === 'Spinal cord'),
    );

  /**
   * Framing fits above the stage dock, measured now: the section bar can change it in the same task. An open
   * popover's plate reaches higher than the dock it opens from.
   */
  function applyFraming({ immediate = false }: MoveOptions = {}): boolean {
    const { inset, scale } = framingSource?.() ?? {
      inset: {},
      scale: { horizontal: 1, vertical: 1 },
    };
    const rescaled =
      scale.horizontal !== framingScale.horizontal || scale.vertical !== framingScale.vertical;
    framingScale = scale;
    const { y, height } = scene.visibleRect;
    const cleared =
      plateTop === null
        ? inset
        : { ...inset, bottom: Math.max(inset.bottom ?? 0, y + height - plateTop) };
    return scene.setFramingInset(cleared, { immediate }) || rescaled;
  }

  /** Whether anything framed is drawn below `top` on the host, with the camera as it stands. */
  function drawnBelow(top: number): boolean {
    const { min, max } = framingBounds();
    // The tract reference frames a box, not vertices.
    const points =
      framingPoints() ??
      [min.x, max.x].flatMap((x) => [min.y, max.y].flatMap((y) => [x, y, min.z, x, y, max.z]));
    camera.updateMatrixWorld();
    const point = new Vector3();
    for (let i = 0; i < points.length; i += 3) {
      point.set(points[i]!, points[i + 1]!, points[i + 2]!).project(camera);
      if (point.z <= 1 && ((1 - point.y) / 2) * scene.hostSize.height > top) return true;
    }
    return false;
  }

  function framingFit(options?: MoveOptions) {
    applyFraming(options);
    return clearedFit();
  }

  /** The magnification the camera has where it is going, so a later resize keeps it. */
  function rememberZoom() {
    const plan = scene.destination;
    const fitted = fittedDistance(heading());
    if (fitted > 0) zoom = plan.position.distanceTo(plan.target) / fitted;
  }

  function refitViewport() {
    if (!framed) return;
    const plan = scene.destination;
    const direction = plan.position.clone().sub(plan.target).normalize();
    const fitted = fittedDistance(direction);
    if (!(fitted > 0)) return;
    // Commit through the scene so an in-flight frame cannot restore its old viewport's endpoint.
    scene.moveTo(
      { ...plan, position: plan.target.clone().addScaledVector(direction, fitted * zoom) },
      { immediate: true },
    );
  }

  /** Scale the camera's distance from a fit of `before` to the room it has now, keeping heading and target. */
  function refit(before: number) {
    applyFraming();
    const direction = heading();
    const after = fittedDistance(direction);
    if (!(before > 0 && after > 0) || after === before) return;
    const plan = scene.destination;
    const distance = (plan.position.distanceTo(plan.target) * after) / before;
    moveCamera({ ...plan, position: plan.target.clone().addScaledVector(direction, distance) });
  }

  function refitDock(options?: MoveOptions) {
    if (!framed) return;
    if (orbiting) {
      dockPending = true;
      return;
    }
    const plan = scene.destination;
    const direction = plan.position.clone().sub(plan.target).normalize();
    if (!applyFraming(options)) return;
    const fitted = fittedDistance(direction);
    if (!(fitted > 0)) return;
    if (linked) {
      zoom = plan.position.distanceTo(plan.target) / fitted;
      return;
    }
    // The magnification is the size kept, not the distance: a camera restored while a key was still
    // leaving the stage was placed for the room it lands in, and stays there.
    const distance = fitted * zoom;
    moveCamera(
      { ...plan, position: plan.target.clone().addScaledVector(direction, distance) },
      options,
    );
  }

  /**
   * Frame a named view against the part of the canvas the interface is not covering. Separate from
   * `applyView` because the sheet reframes without changing which view is chosen.
   */
  function frameCurrent(name: ViewName, { immediate = false }: MoveOptions = {}) {
    fitPending = null;
    view = requireView(name);
    const fit = framingFit({ immediate: immediate || !framed });
    camera.up.copy(upFor(view));
    if (isTargetingSpine()) {
      const direction = VIEW_DIRECTIONS[view];
      const target = controls.target.clone();
      const distance =
        scene.distanceToTarget > 0 ? scene.distanceToTarget : fittedDistance(direction);
      moveCamera(
        {
          position: target.clone().addScaledVector(direction, distance),
          target,
          near: camera.near,
          far: camera.far,
          minDistance: controls.minDistance,
          maxDistance: controls.maxDistance,
        },
        { immediate: immediate || !framed },
      );
    } else {
      // A named whole-anatomy frame replaces the old magnification, including on the next resize.
      zoom = WHOLE_ZOOM;
      moveCamera(
        planFraming(
          camera,
          controls,
          framingBounds(),
          VIEW_DIRECTIONS[view],
          frameTo,
          fit,
          framingPoints(),
        ),
        { immediate: immediate || !framed },
      );
    }
    framed = true;
    held.hold();
  }

  function frameLandmark(
    regionIds: string | readonly string[],
    name: ViewName,
    contextMarginMm: number,
    { immediate = false }: MoveOptions = {},
  ): boolean {
    const ids = typeof regionIds === 'string' ? [regionIds] : regionIds;
    const region = boundsOf(ids.flatMap(meshesOf));
    if (region.isEmpty()) return false;
    view = requireView(name);
    held.release();
    camera.up.copy(upFor(view));
    // The meshes use metres; authored anatomical distances use millimetres.
    region.expandByScalar(contextMarginMm / MM_PER_M);
    moveCamera(
      planFraming(
        camera,
        controls,
        withContext(region),
        VIEW_DIRECTIONS[view],
        frameTo,
        framingFit({ immediate }),
      ),
      { immediate },
    );
    rememberZoom();
    return true;
  }

  /** Frame a deficit's drawn regions together, from the side they lie on when they share one. */
  const sight = new Raycaster();
  sight.firstHitOnly = true;

  /** Whether a surface point of region `id` is in sight from `eye`: the first surface the ray meets is its own, or none in front. */
  function inSight(eye: Vector3, point: Vector3, id: string): boolean {
    const toward = point.clone().sub(eye);
    const distance = toward.length();
    sight.set(eye, toward.divideScalar(distance));
    sight.far = distance + SIGHT_TOLERANCE_M;
    const hit = model.intersect(sight);
    return (
      !hit ||
      hit.object.userData['region_id'] === id ||
      hit.distance >= distance - SIGHT_TOLERANCE_M
    );
  }

  /** The share of each cortical region's sampled surface points that `eye` can see. */
  function sightFrom(
    eye: Vector3,
    cortical: ReadonlyMap<string, readonly Mesh[]>,
  ): Map<string, number> {
    const point = new Vector3();
    const shares = new Map<string, number>();
    for (const [id, meshes] of cortical) {
      let sampled = 0;
      let seen = 0;
      for (const mesh of meshes) {
        const position = mesh.geometry.attributes['position']!;
        const stride = Math.max(1, Math.floor(position.count / SIGHT_SAMPLES));
        mesh.updateWorldMatrix(true, false);
        for (let i = 0; i < position.count; i += stride) {
          point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
          sampled += 1;
          if (inSight(eye, point, id)) seen += 1;
        }
      }
      shares.set(id, seen / sampled);
    }
    return shares;
  }

  const clearlyShown = (shares: ReadonlyMap<string, number>) =>
    [...shares.values()].filter((share) => share >= SIGHT_SHOWN).length;

  /** The drawn meshes of the cortical regions among `ids`, by region. */
  function corticalMeshes(ids: ReadonlySet<string>): Map<string, Mesh[]> {
    const cortical = new Map<string, Mesh[]>();
    for (const mesh of model.visibleMeshes) {
      const id = mesh.userData['region_id'] as string;
      if (!ids.has(id) || model.regions.get(id)?.kind !== 'cortex') continue;
      cortical.set(id, [...(cortical.get(id) ?? []), mesh]);
    }
    return cortical;
  }

  /**
   * The framing along `direction`, unless it does not clearly show every one of `cortical`: then the
   * sight view's that clearly shows most. The camera's up is left as the chosen framing needs it.
   */
  function clearestFraming(
    direction: Vector3,
    plan: (heading: Vector3) => ReturnType<typeof planFraming>,
    cortical: ReadonlyMap<string, readonly Mesh[]>,
  ) {
    let chosen = plan(direction);
    let shares = sightFrom(chosen.position, cortical);
    let turned = false;
    const up = camera.up.clone();
    for (const name of SIGHT_VIEWS) {
      if (clearlyShown(shares) === cortical.size) break;
      camera.up.copy(upFor(name));
      const candidate = plan(VIEW_DIRECTIONS[name].clone());
      const candidateShares = sightFrom(candidate.position, cortical);
      if (clearlyShown(candidateShares) > clearlyShown(shares)) {
        chosen = candidate;
        shares = candidateShares;
        turned = true;
        up.copy(upFor(name));
      }
    }
    camera.up.copy(up);
    return { chosen, shares, turned };
  }

  /**
   * Frame a deficit's regions together. When its own heading does not clearly show every coloured
   * cortical region, the view that clearly shows most is taken instead; returns those wholly out of sight.
   */
  function frameRegions(ids: readonly string[]): string[] {
    const wanted = new Set(ids);
    const meshes = model.visibleMeshes.filter((mesh) =>
      wanted.has(mesh.userData['region_id'] as string),
    );
    if (!meshes.length) return [];
    const box = boundsOf(meshes);
    const context = withContext(box);
    // A mapping wide enough to carry its own context is framed with the whole brain, so the lobes
    // around it are not cut off at the stage's edge; a small one keeps the context box.
    const wide = context.equals(box);
    const fitted = wide ? framingBounds() : context;
    const points = wide ? framingPoints() : null;
    const direction = heading();
    const sides = new Set(
      meshes
        .map((mesh) => model.regions.get(mesh.userData['region_id'] as string)?.hemisphere)
        .filter((side) => side === 'left' || side === 'right'),
    );
    // Seen from the other side, a one-sided mapping is framed through the hemisphere in front of it.
    if (sides.size === 1 && Math.sign(direction.x) === (sides.has('left') ? 1 : -1)) {
      direction.x *= -1;
    }
    const fit = framingFit();
    const { chosen, shares } = clearestFraming(
      direction,
      (heading) => planFraming(camera, controls, fitted, heading, frameTo, fit, points),
      corticalMeshes(wanted),
    );
    held.release();
    moveCamera(chosen);
    rememberZoom();
    return [...shares].filter(([, share]) => share === 0).map(([id]) => id);
  }

  function frameRegion(
    id: string,
    { immediate = false, context = false }: FrameRegionOptions = {},
  ): boolean {
    const box = boundsOf(meshesOf(id));
    if (box.isEmpty()) return false;
    const direction = heading();
    held.release();
    const bounds = withContext(box, context ? MIN_CONTEXT_RADIUS : REGION_CONTEXT_RADIUS);
    moveCamera(
      planFraming(camera, controls, bounds, direction, frameTo, framingFit({ immediate })),
      {
        immediate,
      },
    );
    rememberZoom();
    return true;
  }

  function frameInternal() {
    const isCord = model.state.internalSystem === 'Spinal cord';
    const structures = model.visibleMeshes.filter((mesh) => mesh.userData['kind'] === 'structure');
    let internal = boundsOf(
      structures.filter((mesh) => isCord || mesh.userData['atlas'] !== 'pam50'),
    );
    if (internal.isEmpty()) internal = boundsOf(structures);
    if (internal.isEmpty()) return;
    moveCamera(planFraming(camera, controls, internal, heading(), frameTo, framingFit()));
    rememberZoom();
  }

  /** Pull back to the whole brain along the direction the reader already has. */
  function frameWhole(showing: readonly string[] = []): string[] {
    const [bounds, fit, points] = [framingBounds(), framingFit(), framingPoints()];
    const { chosen, shares, turned } = clearestFraming(
      heading(),
      (along) => planFraming(camera, controls, bounds, along, frameTo, fit, points),
      corticalMeshes(new Set(showing)),
    );
    // Turned to show what it was given, the camera has left the view it held.
    if (turned) held.release();
    moveCamera(chosen);
    rememberZoom();
    return [...shares].filter(([, share]) => share === 0).map(([id]) => id);
  }

  function faceCut({ immediate = false }: MoveOptions = {}): ViewName | null {
    if (!sections.active) return null;
    const { frame } = sections;
    const { mode, reverse } = sections.state;
    const center = rasToWorld(frame.center.toArray());
    const direction = rasToWorld(frame.normal.toArray())
      .normalize()
      .multiplyScalar(reverse ? -1 : 1);
    const facing = cutFacingView(mode, reverse)!;
    view = facing;
    // An oblique cut is faced along its own normal, which is no preset's direction.
    if (mode === 'oblique') held.release();
    else held.hold();
    camera.up.copy(rasToWorld(frame.v.toArray()).normalize());
    const cutBounds =
      center.y < bounds.min.y
        ? new Box3(
            center.clone().subScalar(CORD_CUT_HALF_BOX_M),
            center.clone().addScalar(CORD_CUT_HALF_BOX_M),
          )
        : bounds;
    moveCamera(
      planFraming(
        camera,
        controls,
        cutBounds,
        direction,
        frameTo,
        framingFit({ immediate }),
        cutBounds === bounds ? framingPoints() : null,
      ),
      { immediate },
    );
    rememberZoom();
    return facing;
  }

  /**
   * Keep `box` (world metres) in the middle of the stage: once its centre leaves the middle third of
   * the visible rectangle, or it no longer fits, the camera pans onto it, keeping its heading, and
   * backs away only as far as the box needs. Releases the held view.
   */
  function follow(box: Box3) {
    const destination = scene.destination;
    const eye = camera.clone();
    eye.position.copy(destination.position);
    eye.up.copy(destination.up);
    eye.lookAt(destination.target);
    eye.updateMatrixWorld();
    const rect = scene.visibleRect;
    const { width, height } = scene.hostSize;
    const onStage = (point: Vector3) => {
      const at = point.clone().project(eye);
      return { x: ((at.x + 1) / 2) * width, y: ((1 - at.y) / 2) * height, behind: at.z > 1 };
    };
    const centre = box.getCenter(new Vector3());
    const middle = onStage(centre);
    const corners = [box.min, box.max]
      .flatMap((low) =>
        [box.min, box.max].flatMap((mid) =>
          [box.min, box.max].map((high) => new Vector3(low.x, mid.y, high.z)),
        ),
      )
      .map(onStage);
    const inside = (p: { x: number; y: number; behind: boolean }, inset: number) =>
      !p.behind &&
      p.x >= rect.x + inset * rect.width &&
      p.x <= rect.x + (1 - inset) * rect.width &&
      p.y >= rect.y + inset * rect.height &&
      p.y <= rect.y + (1 - inset) * rect.height;
    if (inside(middle, FOLLOW_INSET) && corners.every((corner) => inside(corner, 0))) return;
    held.release();
    const direction = destination.position.clone().sub(destination.target).normalize();
    const distance = Math.max(
      destination.position.distanceTo(destination.target),
      fitDistance(camera, box, direction, clearedFit()),
    );
    moveCamera({
      position: centre.clone().addScaledVector(direction, distance),
      target: centre,
      near: destination.near,
      far: destination.far,
      minDistance: destination.minDistance,
      maxDistance: destination.maxDistance,
    });
  }

  /** Move the camera onto a surface point, in world metres: the camera keeps its distance and heading. */
  function focusWorldPoint(point: Vector3) {
    held.release();
    const delta = point.clone().sub(controls.target);
    const minDistance =
      point.y < bounds.min.y
        ? Math.min(controls.minDistance, CORD_MIN_DISTANCE_M)
        : controls.minDistance;
    moveCamera({
      position: camera.position.clone().add(delta),
      target: point.clone(),
      near: camera.near,
      far: camera.far,
      minDistance,
      maxDistance: controls.maxDistance,
    });
  }

  function capture(): CapturedCamera {
    const { position, target, up, near, far, minDistance, maxDistance } = scene.destination;
    return {
      position: position.clone(),
      target: target.clone(),
      up: up.clone(),
      near,
      far,
      minDistance,
      maxDistance,
      zoom,
      held: held.held,
    };
  }

  const toWorld = ([x, y, z]: readonly [number, number, number]) =>
    new Vector3(x, y, z).divideScalar(MM_PER_M);
  const toMillimetres = ({ x, y, z }: Vector3): [number, number, number] => [
    x * MM_PER_M,
    y * MM_PER_M,
    z * MM_PER_M,
  ];

  // A pan stops where its target would leave what is drawn, so the anatomy cannot be lost off the
  // stage; a target already further out is held there rather than pulled in.
  controls.addEventListener('start', () => {
    orbiting = true;
    linked = false;
    const drawn = framingBounds().getBoundingSphere(new Sphere());
    controls.cursor.copy(drawn.center);
    controls.maxTargetRadius = Math.max(drawn.radius, controls.target.distanceTo(drawn.center));
  });
  // One handler, in the order the work has to run: the zoom the gesture ended on, then the refit it
  // deferred. Legacy registered two and was right only by their order (app.js:1830, 1840).
  controls.addEventListener('end', () => {
    orbiting = false;
    rememberZoom();
    if (fitPending !== null) {
      const before = fitPending;
      fitPending = null;
      refit(before);
      // The zoom read above was taken before this refit; it belongs to where the refit lands.
      rememberZoom();
    }
    if (dockPending) {
      dockPending = false;
      refitDock();
    }
  });
  controls.addEventListener('change', publishCamera);

  const cameraApi: EngineCamera = {
    get viewHeld() {
      return held.held;
    },
    get visibleRect(): Rect {
      return { ...scene.visibleRect };
    },
    get hostSize(): Size {
      return { ...scene.hostSize };
    },
    get view() {
      return shown;
    },

    setFramingSource(source) {
      framingSource = source;
    },
    setChromeInsets(insets: ChromeInsets, motion) {
      scene.setChromeInsets(insets, motion);
      publishViewport();
    },
    refitDock,
    clearPlate(top, options) {
      if (top === plateTop) return;
      // A plate that covers none of the anatomy where it is drawn leaves the camera alone.
      if (top !== null && plateTop === null && !drawnBelow(top)) return;
      plateTop = top;
      refitDock(options);
    },

    frameCurrent,
    applyView: frameCurrent,
    frameRegions,
    frameRegion,
    frameLandmark,
    frameWhole,
    frameInternal,
    faceCut,
    recenter() {
      controls.target.copy(bounds.getCenter(new Vector3()));
    },
    fittedDistance: () => fittedDistance(heading()),
    keepFraming(before) {
      // A tap that selects raises the sheet before its gesture has ended; the refit waits for the lift.
      if (orbiting) fitPending = before;
      else refit(before);
    },
    focusPoint: (point: Vec3) => focusWorldPoint(rasToWorld(point)),
    project(points: readonly Vec3[]) {
      camera.updateMatrixWorld();
      const { width, height } = scene.hostSize;
      return points.map((point) => {
        const at = rasToWorld(point).project(camera);
        // Beyond the far side of normalized depth: behind the camera.
        if (at.z > 1) return null;
        return { x: ((at.x + 1) / 2) * width, y: ((1 - at.y) / 2) * height };
      });
    },

    orbitBy(turn: OrbitTurn) {
      linked = false;
      held.release();
      turnFromKeyboard(controls, turn);
      rememberZoom();
    },
    dolly(factor) {
      linked = false;
      held.release();
      // The same zoom as the wheel's, about the surface in the middle of the view.
      controls.dollyIn(factor);
      rememberZoom();
    },

    capture: () => capture() as unknown as CameraSnapshot,
    restore(name, snapshot, { immediate = false } = {}) {
      const pose = snapshot as unknown as CapturedCamera;
      view = requireView(name);
      framingFit({ immediate });
      camera.up.copy(pose.up);
      moveCamera(
        {
          position: pose.position.clone(),
          target: pose.target.clone(),
          near: pose.near,
          far: pose.far,
          minDistance: pose.minDistance,
          maxDistance: pose.maxDistance,
        },
        { immediate },
      );
      zoom = pose.zoom;
      if (pose.held) held.hold();
      else held.release();
    },
    /** A link's exact camera, placed in the framing just applied; only nearer limits are widened to admit it. */
    placeOrbit({ position, target, up }: Orbit, { immediate = false }: MoveOptions = {}) {
      const plan = scene.destination;
      if (!orbitWithin({ position, target }, plan.maxDistance * MM_PER_M)) {
        throw new RangeError(
          `Camera ${position} → ${target} mm is beyond the orbit limit of ${plan.maxDistance} m.`,
        );
      }
      const pose = { ...plan, position: toWorld(position), target: toWorld(target) };
      const distance = pose.position.distanceTo(pose.target);
      // A camera written at the limit may read back a rounding past it.
      pose.minDistance = Math.min(plan.minDistance, distance);
      pose.maxDistance = Math.max(plan.maxDistance, distance);
      camera.up.copy(up ? new Vector3(...up) : upFor(view));
      held.release();
      moveCamera(pose, { immediate });
      linked = true;
      const fitted = fittedDistance(pose.position.clone().sub(pose.target).normalize());
      if (fitted > 0) zoom = distance / fitted;
    },
    orbitLink() {
      if (held.held || reference.active) return null;
      const { position, target, up } = scene.destination;
      return {
        position: toMillimetres(position),
        target: toMillimetres(target),
        ...(up.distanceTo(upFor(view)) > UP_DIFFERS ? { up: up.toArray() } : {}),
      };
    },
  };

  return {
    camera: cameraApi,
    focusWorldPoint,
    follow,
    home: (direction) => ({
      center: framingBounds().getCenter(new Vector3()),
      distance: fittedDistance(direction),
    }),
    invalidate() {
      cachedBounds = null;
      cachedPoints = null;
    },
    onResize({ canvasChanged }) {
      publishViewport();
      if (canvasChanged) refitViewport();
      publishCamera();
    },
    onReference() {
      cachedBounds = null;
      cachedPoints = null;
      zoom = WHOLE_ZOOM;
      if (!reference.active || reference.bounds) frameCurrent(view, { immediate: true });
    },
    onReferenceReady() {
      if (reference.active) frameCurrent(view, { immediate: true });
    },
  };
}
