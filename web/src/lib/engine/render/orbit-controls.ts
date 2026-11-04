import {
  type Intersection,
  type PerspectiveCamera,
  Plane,
  Quaternion,
  Raycaster,
  Spherical,
  Vector2,
  Vector3,
} from 'three';
import type {} from 'three-mesh-bvh'; // types `Raycaster.firstHitOnly`
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const Y_UP = new Vector3(0, 1, 0);

/** Finds the nearest visible hit along a ray, or null. */
export type Intersect = (raycaster: Raycaster) => Pick<Intersection, 'point'> | null;

/** OrbitControls state that exists at runtime but that `@types/three` does not declare. */
interface OrbitInternals {
  _sphericalDelta: Spherical;
  _panOffset: Vector3;
  _scale: number;
  _performCursorZoom: boolean;
  _mouse: Vector2;
  /** The gesture a pointer is making; `NO_GESTURE` between gestures and during a wheel step. */
  state: number;
}

/** OrbitControls' `_STATE.NONE`. */
const NO_GESTURE = -1;

type InternalControls = OrbitControls & OrbitInternals;

/*
 * The adaptations reach into OrbitControls' private state. three is pinned to one release and
 * the tests drive the real controls, so a release that renames these fails there first.
 */
function requirePrivate(
  controls: OrbitControls,
  keys: readonly (keyof OrbitInternals)[],
): asserts controls is InternalControls {
  const missing = keys.filter((key) => !(key in controls));
  if (missing.length) throw new Error(`OrbitControls no longer has ${missing.join(', ')}`);
}

/** How far off the superior axis a top or bottom view steps to take a heading, in radians. */
const POLE_OFFSET = 1e-4;
/** A turn's remaining roll falls by a factor of e in this many milliseconds: a fifth per 60 Hz frame. */
const LEVEL_MS = 75;
/** The most time one update levels for, so the first update after a pause eases the roll too. */
const LEVEL_STEP_MS = 1000 / 30;
/** Below this roll, in radians, the camera is level. */
const LEVELLED = 1e-3;
/** A turn smaller than this per update is the last of a coast, not the reader turning. */
const TURNING = 1e-4;

/** A pointer holds the controls: a drag, pan or pinch, not a wheel step or a call. */
export function grabbed(controls: OrbitControls): boolean {
  requirePrivate(controls, ['state']);
  return controls.state !== NO_GESTURE;
}

/**
 * Turn the brain like a turntable, superior up, whatever roll a framing left the camera at.
 *
 * The superior and inferior views, a faced cut, a linked camera and a grab mid-move can each leave
 * the camera's up off the superior axis. Orbiting about that up carried the roll into every later
 * view: a sideways drag from above laid the brain on its side and kept it there. The controls keep
 * their superior frame, and once the reader turns, the roll eases out over a tenth of a second or so,
 * by time, whatever the display's rate. On a top or bottom view the camera sits on the axis, where the
 * up alone sets the roll; it steps a hair off the axis to the side whose superior up draws the same
 * picture, so a sideways drag spins the view.
 */
export function levelOnOrbit(controls: OrbitControls): void {
  requirePrivate(controls, ['_sphericalDelta']);
  const camera = controls.object;
  const offset = new Vector3();
  const sight = new Vector3();
  const shown = new Vector3();
  const level = new Vector3();
  const axis = new Vector3();
  const roll = new Quaternion();
  // The up this last left; a framing that writes another ends the levelling.
  const written = new Vector3();
  let levelling = false;
  let updated = -Infinity;

  function levelStep(elapsed: number): void {
    offset.subVectors(camera.position, controls.target);
    const length = offset.length();
    shown.copy(Y_UP).applyQuaternion(camera.quaternion);
    if (Math.hypot(offset.x, offset.z) < length * POLE_OFFSET) {
      // Looking along the axis, superior up reads as the horizontal away from the camera's offset
      // from above, and toward it from below.
      const side = Math.sign(offset.y);
      shown.setY(0).normalize();
      camera.position
        .copy(controls.target)
        .addScaledVector(Y_UP, side * length * Math.cos(POLE_OFFSET))
        .addScaledVector(shown, -side * length * Math.sin(POLE_OFFSET));
      camera.up.copy(Y_UP);
      levelling = false;
      return;
    }
    sight.copy(offset).divideScalar(-length);
    level.copy(Y_UP).addScaledVector(sight, -sight.y).normalize();
    // Both lie across the line of sight, so the roll between them is a turn about it.
    const angle = Math.atan2(sight.dot(axis.crossVectors(shown, level)), shown.dot(level));
    if (Math.abs(angle) < LEVELLED) {
      camera.up.copy(Y_UP);
      levelling = false;
      return;
    }
    const share = 1 - Math.exp(-elapsed / LEVEL_MS);
    camera.up.copy(shown).applyQuaternion(roll.setFromAxisAngle(sight, angle * share));
    written.copy(camera.up);
  }

  const update = controls.update.bind(controls);
  controls.update = (deltaTime) => {
    const now = performance.now();
    const elapsed = Math.min(now - updated, LEVEL_STEP_MS);
    updated = now;
    if (levelling && !camera.up.equals(written)) levelling = false;
    const { theta, phi } = controls._sphericalDelta;
    const turning = Math.max(Math.abs(theta), Math.abs(phi)) > TURNING;
    if (turning && !camera.up.equals(Y_UP)) levelling = true;
    if (levelling) levelStep(elapsed);
    return update(deltaTime);
  };
}

/** A drag's speed is read from its last this many milliseconds. */
const THROW_WINDOW_MS = 64;
/** A pointer held still this long before it lifts lets go without a throw. */
const THROW_STILL_MS = 50;
/** A coast slows by a factor of e every this many seconds. */
const COAST_S = 0.1;
/** Below this speed, in radians per second (2°/s), a coast has stopped. */
const COAST_STOP = Math.PI / 90;

export interface Momentum {
  /** The camera is coasting on from a released drag. */
  readonly coasting: boolean;
  /** End a coast where it is. */
  stop(): void;
  dispose(): void;
}

/**
 * Drags track the pointer exactly, and a drag let go while moving coasts on. The stock damping took a
 * tenth of each remaining turn per update, so the camera trailed the pointer by some 80 ms and coasted
 * for twice as long at 60 Hz as at 120. Here the turn and pan the pointer made over its last 64 ms set
 * a speed that decays by time, e^(−t/100 ms), until it falls below 2°/s; a grab catches it.
 */
export function coastOnRelease(controls: OrbitControls): Momentum {
  requirePrivate(controls, ['_sphericalDelta', '_panOffset', 'state']);
  // The drag so far: its turn and pan summed up to each pointer move, from the grab.
  let samples: { at: number; theta: number; phi: number; pan: Vector3 }[] = [];
  let dragging = false;
  let coast: {
    released: number;
    reached: number;
    theta: number;
    phi: number;
    pan: Vector3;
    speed: number;
  } | null = null;

  const onStart = () => {
    if (!grabbed(controls)) return;
    coast = null;
    dragging = true;
    samples = [{ at: performance.now(), theta: 0, phi: 0, pan: new Vector3() }];
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    const released = performance.now();
    const last = samples.at(-1)!;
    if (samples.length < 2 || released - last.at > THROW_STILL_MS) return;
    const from = samples.findLast(({ at }) => at <= released - THROW_WINDOW_MS) ?? samples[0]!;
    const seconds = (released - from.at) / 1000;
    const theta = (last.theta - from.theta) / seconds;
    const phi = (last.phi - from.phi) / seconds;
    const pan = last.pan.clone().sub(from.pan).divideScalar(seconds);
    const distance = controls.object.position.distanceTo(controls.target);
    const speed = Math.max(Math.hypot(theta, phi), pan.length() / distance);
    if (speed >= COAST_STOP) coast = { released, reached: released, theta, phi, pan, speed };
  };
  controls.addEventListener('start', onStart);
  controls.addEventListener('end', onEnd);

  const update = controls.update.bind(controls);
  controls.update = (deltaTime) => {
    const now = performance.now();
    const delta = controls._sphericalDelta;
    if (dragging && (delta.theta || delta.phi || controls._panOffset.lengthSq())) {
      const last = samples.at(-1)!;
      samples.push({
        at: now,
        theta: last.theta + delta.theta,
        phi: last.phi + delta.phi,
        pan: last.pan.clone().add(controls._panOffset),
      });
      // The throw reads back only to the last sample at or before its window.
      while (samples.length > 2 && samples[1]!.at <= now - THROW_WINDOW_MS) samples.shift();
    } else if (coast && !dragging) {
      // The turn the decaying speed covers between the last update and this one.
      const decay = (at: number) => Math.exp(-(at - coast!.released) / 1000 / COAST_S);
      const covered = COAST_S * (decay(coast.reached) - decay(now));
      delta.theta += coast.theta * covered;
      delta.phi += coast.phi * covered;
      controls._panOffset.addScaledVector(coast.pan, covered);
      coast.reached = now;
      if (coast.speed * decay(now) < COAST_STOP) coast = null;
    }
    return update(deltaTime);
  };

  return {
    get coasting() {
      return coast !== null;
    },
    stop() {
      coast = null;
    },
    dispose() {
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
    },
  };
}

/** The turn, pan and zoom the controls hold for their next update, taken from them so it never applies. */
export function takePending(controls: OrbitControls): {
  theta: number;
  phi: number;
  pan: Vector3;
  scale: number;
} {
  requirePrivate(controls, ['_sphericalDelta', '_panOffset', '_scale', '_performCursorZoom']);
  const pending = {
    theta: controls._sphericalDelta.theta,
    phi: controls._sphericalDelta.phi,
    pan: controls._panOffset.clone(),
    scale: controls._scale,
  };
  controls._sphericalDelta.set(0, 0, 0);
  controls._panOffset.set(0, 0, 0);
  controls._scale = 1;
  controls._performCursorZoom = false;
  return pending;
}

/**
 * Turn a destination as the controls turn the camera: `theta` about the superior axis, `phi` toward
 * the inferior pole and never across either. Its up turns with it unless it is superior already, so a
 * top or bottom view spins in place as it does under `levelOnOrbit`.
 */
export function turnGoal(
  goal: { position: Vector3; target: Vector3; up: Vector3 },
  theta: number,
  phi: number,
): void {
  const offset = goal.position.clone().sub(goal.target);
  const length = offset.length();
  const superior = goal.up.equals(Y_UP);
  const spin = new Quaternion().setFromAxisAngle(Y_UP, theta);
  offset.applyQuaternion(spin);
  if (!superior) goal.up.applyQuaternion(spin);
  if (phi) {
    const before = offset.clone().divideScalar(length);
    if (Math.hypot(offset.x, offset.z) < length * POLE_OFFSET) {
      // On the axis the up chooses the side, as `levelOnOrbit` steps off it.
      const side = Math.sign(offset.y);
      const toward = goal.up.clone().setY(0).normalize();
      offset.addScaledVector(toward, -side * length * Math.sin(POLE_OFFSET));
    }
    const spherical = new Spherical().setFromVector3(offset);
    spherical.phi = Math.min(Math.max(spherical.phi + phi, 0), Math.PI);
    spherical.makeSafe();
    offset.setFromSpherical(spherical);
    if (!superior) {
      goal.up.applyQuaternion(
        new Quaternion().setFromUnitVectors(before, offset.clone().normalize()),
      );
    }
  }
  goal.position.copy(goal.target).add(offset);
}

/** Camera and target scaled together about `point`, their distance held within the orbit limits. */
export function zoomAbout(
  position: Vector3,
  target: Vector3,
  point: Vector3,
  scale: number,
  { min, max }: { min: number; max: number },
): { position: Vector3; target: Vector3 } {
  const distance = position.distanceTo(target);
  const factor = Math.min(Math.max(distance * scale, min), max) / distance;
  return {
    position: point.clone().lerp(position, factor),
    target: point.clone().lerp(target, factor),
  };
}

/** Where zooming out leads: the centre of what is framed, and how far back it fills the stage. */
export type Home = (direction: Vector3) => { center: Vector3; distance: number };

/**
 * The share of the way to its home a zoom out from `before` to `after` carries the orbit target.
 *
 * Counted in zoom steps, so the shares compound: from far in, the target is most of the way home
 * as the distance reaches `fill`. Within half a doubling of `fill`, and beyond it, each step takes
 * a share of what is left in proportion to its size, so no step jumps the anatomy across the stage.
 */
export function homeward(before: number, after: number, fill: number): number {
  return Math.min(1, Math.log(after / before) / Math.max(Math.log(fill / before), Math.LN2 / 2));
}

/**
 * Zoom in toward the first surface under the pointer, or in the middle of the view for a zoom key;
 * zoom out straight back, toward the centre of what is framed.
 *
 * OrbitControls scales the distance to its target, which sits inside the anatomy, so zooming onto
 * the cortex carried the camera through it. Scaling camera and target together about the surface
 * point keeps that point still on screen and shrinks only the gap to it: the camera can approach a
 * surface but never pass it. Over empty stage the point is level with the target.
 *
 * Each zoom in carries the target toward the pointer, and zooming out about the pointer carried it
 * further: the anatomy drifted off the stage and swung wide on the next turn. Zooming out instead
 * backs away from the target and leads it home in step with the zoom.
 *
 * `intersect(raycaster)` returns the nearest visible hit, or null.
 */
export function zoomAboutSurface(controls: OrbitControls, intersect: Intersect, home: Home): void {
  requirePrivate(controls, ['_scale', '_performCursorZoom', '_mouse']);
  const camera = controls.object as PerspectiveCamera;
  const raycaster = new Raycaster();
  raycaster.firstHitOnly = true;
  const forward = new Vector3();
  const level = new Plane();
  const update = controls.update.bind(controls);
  controls.update = (deltaTime) => {
    if (controls._scale > 1) {
      const before = camera.position.distanceTo(controls.target);
      const zoomed = zoomAbout(camera.position, controls.target, controls.target, controls._scale, {
        min: controls.minDistance,
        max: controls.maxDistance,
      });
      const after = zoomed.position.distanceTo(zoomed.target);
      const { center, distance } = home(
        forward.subVectors(zoomed.position, zoomed.target).divideScalar(after),
      );
      const shift = center.sub(zoomed.target).multiplyScalar(homeward(before, after, distance));
      camera.position.copy(zoomed.position).add(shift);
      controls.target.copy(zoomed.target).add(shift);
      controls._scale = 1;
      controls._performCursorZoom = false;
    } else if (controls._scale < 1) {
      camera.updateMatrixWorld();
      if (controls._performCursorZoom) {
        raycaster.setFromCamera(controls._mouse, camera);
      } else {
        raycaster.set(
          camera.position,
          forward.subVectors(controls.target, camera.position).normalize(),
        );
      }
      level.setFromNormalAndCoplanarPoint(camera.getWorldDirection(forward), controls.target);
      const point =
        intersect(raycaster)?.point ?? raycaster.ray.intersectPlane(level, new Vector3());
      if (!point) throw new Error('The zoom ray never meets the level plane.');
      const zoomed = zoomAbout(camera.position, controls.target, point, controls._scale, {
        min: controls.minDistance,
        max: controls.maxDistance,
      });
      camera.position.copy(zoomed.position);
      controls.target.copy(zoomed.target);
      controls._scale = 1;
      controls._performCursorZoom = false;
    }
    return update(deltaTime);
  };
}

/**
 * Keep an orbit or pan from carrying the camera into, or flat against, a surface.
 *
 * Close in, the pivot sits under the surface the reader zoomed onto, and turning about it can swing
 * the camera into the tissue around it, or skim it so close that one surface fills the view. The
 * surfaces are single-sided, so a camera already inside one cannot see it; but the camera starts
 * outside, and a surface it nears from outside faces it. A move is refused when it would come
 * within a quarter of the closest zoom of a surface, along its path or along the line of sight,
 * and the camera backs away from the target by as far as the move tried to go instead: pressing
 * into the anatomy zooms out rather than pinning the camera to it. Lifting it out to the outermost
 * surface jumped it across whole lobes in one frame.
 *
 * Backing away is not the reader's zoom. Moves that are free again bring the camera back toward the
 * distance the reader last chose, by as far as each move goes, so it rides over the anatomy and
 * settles where it was.
 */
export function stayOutside(controls: OrbitControls, intersect: Intersect): void {
  const camera = controls.object;
  const raycaster = new Raycaster();
  raycaster.firstHitOnly = true;
  const from = new Vector3();
  const fromTarget = new Vector3();
  const step = new Vector3();
  const sight = new Vector3();
  const back = new Vector3();
  // The reader's distance, and the one this last left the camera at: any other was a zoom or a framing.
  let chosen = 0;
  let left = NaN;
  /** How far along a ray the nearest surface lies, if within `reach`; otherwise Infinity. */
  const room = (origin: Vector3, direction: Vector3, reach: number): number => {
    raycaster.set(origin, direction);
    raycaster.far = reach;
    return intersect(raycaster)?.point.distanceTo(origin) ?? Infinity;
  };

  function keepClear(): void {
    const length = step.subVectors(camera.position, from).length();
    if (length === 0) return;
    const clearance = controls.minDistance / 4;
    const distance = camera.position.distanceTo(controls.target);
    sight.subVectors(controls.target, camera.position).divideScalar(distance);
    if (
      room(from, step.divideScalar(length), length + clearance) < Infinity ||
      room(camera.position, sight, clearance) < Infinity
    ) {
      back.subVectors(from, fromTarget).normalize();
      camera.position.copy(from);
      if (room(from, back, length + clearance) === Infinity) {
        camera.position.addScaledVector(back, length);
      }
      controls.target.copy(fromTarget);
      camera.lookAt(controls.target);
    } else {
      const excess = Math.min(distance - chosen, length);
      if (excess <= 0) return;
      const inward = Math.min(excess, room(camera.position, sight, excess + clearance) - clearance);
      if (inward <= 0) return;
      camera.position.addScaledVector(sight, inward);
    }
    controls.dispatchEvent({ type: 'change' });
  }

  const update = controls.update.bind(controls);
  controls.update = (deltaTime) => {
    // Only the controls' own moves are checked: a framing move places the camera before this runs.
    from.copy(camera.position);
    fromTarget.copy(controls.target);
    const distance = from.distanceTo(fromTarget);
    if (distance !== left) chosen = distance;
    const moved = update(deltaTime);
    if (moved) keepClear();
    left = camera.position.distanceTo(controls.target);
    return moved;
  };
}
