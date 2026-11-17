import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  CAMERA_RESPONSE,
  SHEET_RESPONSE,
  angularFrequency,
  noOvershoot,
  springAt,
  springSettled,
} from '../../core/spring.ts';
import type { SpringState } from '../../core/spring.ts';
import { fitScale, viewOffset, visibleRect } from './effective-viewport.ts';
import type { Rect, Size } from './effective-viewport.ts';
import { orbitPath } from './camera-path.ts';
import type { OrbitPath } from './camera-path.ts';
import { coastOnRelease, grabbed, levelOnOrbit, takePending, turnGoal } from './orbit-controls.ts';
import type {
  CameraDestination,
  CameraPlan,
  ChromeInsets,
  FramingInset,
  MoveOptions,
} from './scene.ts';

/** A view change has arrived within this turn, in radians, and this share of its distance to the target. */
const ARRIVED_ANGLE = 1e-3;
const ARRIVED_SHARE = 1e-3;
/** An inset has arrived within half a CSS pixel. */
const ARRIVED_PX = 0.5;

export const prefersReducedMotion = (): boolean =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * A move's progress: a spring started at `started` (a `performance.now()`), or, for a move that rides
 * one already under way, that spring's rest from its value `from`, so both arrive together.
 */
interface Ride {
  started: number;
  response: number;
  velocity: number;
  from: number;
}

function progressAt({ started, response, velocity, from }: Ride, now: number): SpringState {
  const spring = springAt((now - started) / 1000, response, velocity);
  const left = 1 - from;
  if (!(left > 0)) return { value: 1, velocity: 0 };
  return { value: (spring.value - from) / left, velocity: spring.velocity / left };
}

/**
 * The start, in whole moves per second, that carries a motion's `rate` on into a move of `extent`:
 * its share along the new move, never a backing up or an overshoot.
 */
function carried(rate: readonly number[], extent: readonly number[], response: number): number {
  const length = extent.reduce((sum, part) => sum + part * part, 0);
  if (!(length > 0)) return 0;
  const along = rate.reduce((sum, part, i) => sum + part * extent[i]!, 0);
  return noOvershoot(along / length, response);
}

/** A camera move's extent as one vector: its turn in radians, its target's shift and its stretch per `scale`. */
const extentOf = ({ turn, shift, stretch }: OrbitPath, scale: number): number[] => [
  ...turn.toArray(),
  ...shift.toArray().map((part) => part / scale),
  stretch / scale,
];

/** A move between two sets of insets, on a spring. */
interface InsetMove<Sides extends string> {
  from: Record<Sides, number>;
  to: Record<Sides, number>;
  ride: Ride;
}

interface Transition {
  path: OrbitPath;
  plan: CameraDestination;
  ride: Ride;
  arrive: () => void;
}

/** A move between two sets of insets as drawn at `now`, and each side's rate there in pixels per second. */
function insetsAt<Sides extends string>(
  { from, to, ride }: InsetMove<Sides>,
  now: number,
): { insets: Record<Sides, number>; rates: number[]; done: boolean } {
  const sides = Object.keys(to) as Sides[];
  const progress = progressAt(ride, now);
  const extent = Math.max(...sides.map((side) => Math.abs(to[side] - from[side])));
  const done = springSettled(progress, extent, ARRIVED_PX);
  const value = done ? 1 : progress.value;
  const insets = Object.fromEntries(
    sides.map((side) => [side, from[side] + (to[side] - from[side]) * value]),
  ) as Record<Sides, number>;
  const rates = sides.map((side) => (done ? 0 : progress.velocity * (to[side] - from[side])));
  return { insets, rates, done };
}

/** What camera motion needs of the scene that draws it. */
export interface MotionFrames {
  /** The canvas's CSS size, as of the last resize. */
  readonly hostSize: Size;
  invalidate(): void;
  /** The camera moved at `now`: frames draw as motion until it has rested. */
  moving(now: number): void;
  /** The camera is known to be at rest: its full-resolution frame is drawn next. */
  rest(): void;
  /** Under reduced motion, `change` made beneath a fading copy of the frame on screen. */
  dissolve(change: () => void): void;
  onResize?: ((change: { canvasChanged: boolean }) => void) | undefined;
}

export interface CameraMotion {
  readonly controls: OrbitControls;
  /** Whether a move, an inset's slide or a coast is under way. */
  readonly animating: boolean;
  /** Move the camera and the insets on to a frame's `now`; then the controls take their turn. */
  step(now: number): void;
  moveTo(plan: CameraPlan, options?: MoveOptions): void;
  /** Slide the frustum so the anatomy sits in the middle of what is visible. */
  applyViewOffset(): void;
  setChromeInsets(
    next: Partial<ChromeInsets>,
    options?: { settle?: boolean; velocity?: number },
  ): void;
  setFramingInset(next?: Partial<FramingInset>, options?: MoveOptions): boolean;
  readonly visibleRect: Rect;
  readonly viewportFit: { horizontal: number; vertical: number };
  readonly destination: CameraDestination;
  dispose(): void;
}

/**
 * The orbit controls and every way the camera moves: framed moves on the camera's spring, a change
 * of mind or a gesture during one, the coast after a drag, and the image sliding clear of the
 * interface that covers the canvas. Under reduced motion a change of view dissolves instead.
 */
export function createCameraMotion(
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  frames: MotionFrames,
): CameraMotion {
  const controls = new OrbitControls(camera, canvas);
  // The anatomy is draggable and said so only once a pointer had moved over
  // it: picking wrote the cursor, and before that the canvas rested on `auto`.
  // The controls own this inline, including `grabbing` for the duration of an
  // orbit, which nothing else was providing.
  controls.cursorStyle = 'grab';
  // Undamped, so a drag tracks the pointer exactly; a drag let go while moving coasts by time.
  controls.zoomToCursor = true;
  levelOnOrbit(controls);
  const momentum = coastOnRelease(controls);

  /*
   * How much of the canvas the interface is covering. On a phone the sheet
   * sits over the canvas rather than beside it, so the renderer is told what
   * the reader can see instead of being resized: resizing would reallocate
   * the composer target and both outline passes on every frame of a drag.
   */
  let chromeInsets: ChromeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  // Planning reads where the sheet is going; the image is offset by where it is drawn, which
  // rides a settling sheet's spring and tracks a dragged one.
  let chromeShown = chromeInsets;
  let chromeMove: InsetMove<keyof ChromeInsets> | null = null;
  // Framing also clears the stage dock and any colour key, which `chromeInsets` must not include:
  // they are placed by that rectangle and would push themselves along by their own size.
  const NO_INSET: FramingInset = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });
  let framingInset = NO_INSET;
  let framingShown = NO_INSET;
  let insetMove: InsetMove<keyof FramingInset> | null = null;
  const framingRect = (inset = framingInset, chrome = chromeInsets): Rect =>
    visibleRect(frames.hostSize, {
      top: chrome.top + inset.top,
      right: chrome.right + inset.right,
      bottom: chrome.bottom + inset.bottom,
      left: chrome.left + inset.left,
    });

  let transition: Transition | null = null;
  // The camera as the scene last drew it in a move: a zoom made meanwhile is read against it.
  const drawn = { position: new Vector3(), target: new Vector3() };

  /**
   * Slide the frustum so the anatomy sits in the middle of what is visible.
   *
   * The camera is not moved: moving it would drag the orbit target off the
   * anatomy and orbiting would swing the model around a point beside it.
   */
  function applyViewOffset() {
    const { width, height } = frames.hostSize;
    if (!width || !height) return;
    const offset = viewOffset({ width, height }, framingRect(framingShown, chromeShown));
    if (offset) {
      camera.setViewOffset(
        offset.fullWidth,
        offset.fullHeight,
        offset.offsetX,
        offset.offsetY,
        offset.width,
        offset.height,
      );
    } else if (camera.view?.enabled) {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    frames.invalidate();
  }

  /** A new move rides a settling sheet's spring; otherwise it starts on the camera's, at `velocity`. */
  function rideFor(now: number, velocity: number): Ride {
    if (chromeMove) return { ...chromeMove.ride, from: progressAt(chromeMove.ride, now).value };
    return { started: now, response: CAMERA_RESPONSE, velocity, from: 0 };
  }

  /**
   * Head for `plan` from where the camera is drawn now. A move already under way hands on its speed
   * along the new path, so a change of mind turns the camera rather than stopping it dead.
   */
  function head(plan: CameraDestination, arrive: () => void) {
    const now = performance.now();
    const from = transition
      ? transition.path.at(progressAt(transition.ride, now).value)
      : {
          quaternion: camera.quaternion.clone(),
          position: camera.position.clone(),
          target: controls.target.clone(),
        };
    const path = orbitPath(from, plan);
    let velocity = 0;
    if (transition) {
      const scale = from.position.distanceTo(from.target);
      const rate = progressAt(transition.ride, now).velocity;
      const motion = extentOf(transition.path, scale).map((part) => part * rate);
      velocity = carried(motion, extentOf(path, scale), CAMERA_RESPONSE);
    }
    drawn.position.copy(camera.position);
    drawn.target.copy(controls.target);
    transition = { path, plan, arrive, ride: rideFor(now, velocity) };
    frames.invalidate();
  }

  /**
   * Move to a framed destination. Orbit limits are applied on arrival, not on
   * departure: a tighter maxDistance would otherwise yank a distant camera.
   */
  function moveTo(
    { position, target, near, far, minDistance, maxDistance }: CameraPlan,
    { immediate = false }: MoveOptions = {},
  ) {
    const arrive = () => {
      controls.minDistance = minDistance;
      controls.maxDistance = maxDistance;
      controls.update();
    };
    const place = () => {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
      transition = null;
      camera.position.copy(position);
      controls.target.copy(target);
      arrive();
    };
    momentum.stop();
    // The camera begins at the origin, inside the model. Animating the first
    // framing would swoop out of the brain on every load; the first paint
    // should simply be correct.
    if (immediate) {
      place();
      frames.invalidate();
      return;
    }
    if (prefersReducedMotion()) {
      frames.dissolve(place);
      return;
    }
    camera.near = near;
    camera.far = far;
    camera.updateProjectionMatrix();
    // Callers write the destination's up before planning, and between frames it stays theirs.
    head(
      {
        position: position.clone(),
        target: target.clone(),
        up: camera.up.clone(),
        near,
        far,
        minDistance,
        maxDistance,
      },
      arrive,
    );
  }

  /**
   * A zoom, turn or pan the controls were asked for while the camera is moving changes where it is
   * going, and the move goes on there; its orbit limits still wait for arrival.
   */
  function redirect(move: Transition) {
    const { theta, phi, pan, scale } = takePending(controls);
    // The surface zoom has already scaled the drawn camera; the scene keeps drawing the move.
    const zoom =
      (camera.position.distanceTo(controls.target) / drawn.position.distanceTo(drawn.target)) *
      scale;
    camera.position.copy(drawn.position);
    controls.target.copy(drawn.target);
    if (!theta && !phi && !pan.lengthSq() && zoom === 1) return;
    const { plan } = move;
    const next: CameraDestination = {
      ...plan,
      position: plan.position.clone().add(pan),
      target: plan.target.clone().add(pan),
      up: plan.up.clone(),
    };
    turnGoal(next, theta, phi);
    const offset = next.position.clone().sub(next.target);
    const distance = Math.min(Math.max(offset.length() * zoom, plan.minDistance), plan.maxDistance);
    next.position.copy(next.target).addScaledVector(offset.normalize(), distance);
    camera.up.copy(next.up);
    head(next, move.arrive);
  }

  /** The insets' slides and the camera's move, at `now`. */
  function advance(now: number) {
    const easing = Boolean(insetMove || chromeMove);
    if (easing || transition) frames.moving(now);
    if (insetMove) {
      const { insets, done } = insetsAt(insetMove, now);
      framingShown = insets;
      if (done) insetMove = null;
    }
    if (chromeMove) {
      const { insets, done } = insetsAt(chromeMove, now);
      chromeShown = insets;
      if (done) chromeMove = null;
    }
    if (easing) applyViewOffset();
    if (!transition) return;
    const { path, plan, ride, arrive } = transition;
    const progress = progressAt(ride, now);
    const arrived =
      springSettled(progress, path.turn.length(), ARRIVED_ANGLE) &&
      springSettled(
        progress,
        path.shift.length() + Math.abs(path.stretch),
        ARRIVED_SHARE * plan.position.distanceTo(plan.target),
      );
    const pose = path.at(arrived ? 1 : progress.value);
    camera.position.copy(pose.position);
    controls.target.copy(pose.target);
    drawn.position.copy(pose.position);
    drawn.target.copy(pose.target);
    if (arrived) {
      transition = null;
      arrive();
      // The last step can be below the controls' own change threshold; announce arrival.
      controls.dispatchEvent({ type: 'change' });
      atRest();
    } else {
      // The controls stand aside while the scene moves the camera, so the move announces itself,
      // with the up it is drawing for whoever reads the frame; then the destination's is restored.
      camera.quaternion.copy(pose.quaternion);
      camera.up.copy(pose.up);
      controls.dispatchEvent({ type: 'change' });
      camera.up.copy(plan.up);
    }
    frames.invalidate();
  }

  /**
   * A move that has arrived, or a coast that has run out, leaves the camera known to be at rest, so its
   * full-resolution frame is drawn next rather than after the scene's settle time, which waits out a
   * drag's pauses.
   */
  function atRest() {
    if (!insetMove && !chromeMove) frames.rest();
  }

  const update = controls.update.bind(controls);
  controls.update = (deltaTime) => {
    if (!transition) return update(deltaTime);
    redirect(transition);
    return false;
  };

  // A reader who takes hold of the camera mid-orbit keeps it where it is drawn, roll included. A wheel
  // step is no grab: its zoom changes where the move is going.
  const onGrab = () => {
    if (!transition || !grabbed(controls)) return;
    transition = null;
    camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  };
  controls.addEventListener('start', onGrab);
  // Registered after the momentum's own release handler, so it cancels the coast that one starts.
  const stillOnRelease = () => {
    if (prefersReducedMotion()) momentum.stop();
  };
  controls.addEventListener('end', stillOnRelease);

  return {
    controls,

    get animating() {
      return Boolean(transition || insetMove || chromeMove || momentum.coasting);
    },

    step(now) {
      advance(now);
      const coasting = momentum.coasting;
      // Their limits would pull against an orbit in flight; they take over on arrival.
      if (!transition) controls.update();
      if (coasting && !momentum.coasting) atRest();
    },

    moveTo,
    applyViewOffset,

    /**
     * Declare how much of the canvas the interface covers. Reported upward as
     * a resize, because everything derived from the viewport — framing, the
     * markers, the presets — is stale the moment it changes. A `settle` is the
     * sheet springing to a detent from `velocity` (whole moves per second, at most
     * the spring's own rate), which the image's offset rides from this instant;
     * otherwise a finger is moving it and the offset tracks at once.
     */
    setChromeInsets(next, { settle = false, velocity = 0 } = {}) {
      if (!(velocity >= 0 && velocity <= angularFrequency(SHEET_RESPONSE))) {
        throw new RangeError(`A settling sheet cannot start at ${velocity} moves per second.`);
      }
      const merged: ChromeInsets = { top: 0, right: 0, bottom: 0, left: 0, ...next };
      const same = (Object.keys(merged) as (keyof ChromeInsets)[]).every(
        (key) => merged[key] === chromeInsets[key],
      );
      if (same) return;
      chromeInsets = merged;
      const now = performance.now();
      const shown = chromeMove ? insetsAt(chromeMove, now).insets : chromeShown;
      if (!settle) {
        chromeMove = null;
        chromeShown = merged;
        applyViewOffset();
      } else if (prefersReducedMotion()) {
        chromeMove = null;
        frames.dissolve(() => {
          chromeShown = merged;
          applyViewOffset();
        });
      } else {
        const ride = { started: now, response: SHEET_RESPONSE, velocity, from: 0 };
        chromeMove = { from: shown, to: merged, ride };
        frames.invalidate();
      }
      // Not a canvas resize: the sheet reports this on every frame of a drag,
      // and refitting there would fight the finger. The sheet reframes itself
      // when it settles on a detent.
      frames.onResize?.({ canvasChanged: false });
    },

    /**
     * Keep framing clear of bands of the visible rectangle: the dock's at the bottom, a colour
     * key's at the top or right, an open popover's at the left. The image slides on the camera's
     * spring, or rides a settling sheet's. Returns whether it changed.
     */
    setFramingInset({ top = 0, right = 0, bottom = 0, left = 0 } = {}, { immediate = false } = {}) {
      const next: FramingInset = { top, right, bottom, left };
      const sides = Object.keys(next) as (keyof FramingInset)[];
      if (sides.every((side) => next[side] === framingInset[side])) return false;
      framingInset = next;
      if (immediate) {
        insetMove = null;
        framingShown = next;
        applyViewOffset();
      } else if (prefersReducedMotion()) {
        insetMove = null;
        frames.dissolve(() => {
          framingShown = next;
          applyViewOffset();
        });
      } else {
        const now = performance.now();
        let from = framingShown;
        let velocity = 0;
        if (insetMove) {
          const { insets, rates } = insetsAt(insetMove, now);
          from = insets;
          const extent = sides.map((side) => next[side] - insets[side]);
          velocity = carried(rates, extent, CAMERA_RESPONSE);
        }
        insetMove = { from, to: next, ride: rideFor(now, velocity) };
        frames.invalidate();
      }
      return true;
    },

    get visibleRect() {
      return visibleRect(frames.hostSize, chromeInsets);
    },

    get viewportFit() {
      return fitScale(frames.hostSize, framingRect());
    },

    get destination() {
      if (transition) return transition.plan;
      return {
        position: camera.position.clone(),
        target: controls.target.clone(),
        up: camera.up.clone(),
        near: camera.near,
        far: camera.far,
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
      };
    },

    dispose() {
      controls.removeEventListener('start', onGrab);
      controls.removeEventListener('end', stillOnRelease);
      momentum.dispose();
      controls.dispose();
    },
  };
}
