import { Matrix4, Quaternion, Vector3 } from 'three';

const BACK = new Vector3(0, 0, 1);
const UP = new Vector3(0, 1, 0);

/** The camera as drawn. */
export interface CameraPose {
  quaternion: Quaternion;
  position: Vector3;
  target: Vector3;
}

/** Where a camera move is going. */
export interface CameraGoal {
  position: Vector3;
  target: Vector3;
  up: Vector3;
}

export interface PathPose extends CameraPose {
  up: Vector3;
}

export interface OrbitPath {
  /** The pose at progress `t`; at 1, exactly the goal. */
  at(t: number): PathPose;
  /** The turn, about a fixed world axis: that axis scaled by the angle, in radians. */
  turn: Vector3;
  /** How far the target moves, in metres. */
  shift: Vector3;
  /** How much the distance to the target changes, in metres. */
  stretch: number;
}

/** The orientation `lookAt` gives a camera at `eye` facing `target` with `up`. */
export function frameOf(eye: Vector3, target: Vector3, up: Vector3): Quaternion {
  return new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(eye, target, up));
}

/**
 * A camera move as an orbit. The camera's frame turns by the shortest rotation between its two
 * orientations while its distance and target are interpolated, so it swings round what it looks
 * at instead of cutting through it, and its roll turns with it rather than snapping first.
 *
 * `from` is the camera as drawn; `to` is where it is going. Every part of the move is linear in
 * progress, so its rate at any point is the extent times the rate of progress.
 */
export function orbitPath(from: CameraPose, to: CameraGoal): OrbitPath {
  // Copied: the caller goes on moving its own camera along the path.
  const start = from.quaternion.clone();
  const startTarget = from.target.clone();
  const goal = { position: to.position.clone(), target: to.target.clone(), up: to.up.clone() };
  const end = frameOf(goal.position, goal.target, goal.up);
  const startDistance = from.position.distanceTo(from.target);
  const endDistance = goal.position.distanceTo(goal.target);
  // Slerp takes the shorter way round, about the axis of end × start⁻¹ in the world.
  const relative = end.clone().multiply(start.clone().invert());
  if (relative.w < 0) relative.set(-relative.x, -relative.y, -relative.z, -relative.w);
  const sine = Math.hypot(relative.x, relative.y, relative.z);
  const angle = 2 * Math.atan2(sine, relative.w);
  return {
    at(t) {
      if (t >= 1) {
        return {
          quaternion: end.clone(),
          position: goal.position.clone(),
          target: goal.target.clone(),
          up: goal.up.clone(),
        };
      }
      const quaternion = start.clone().slerp(end, t);
      const target = new Vector3().lerpVectors(startTarget, goal.target, t);
      const distance = startDistance + (endDistance - startDistance) * t;
      return {
        quaternion,
        target,
        up: UP.clone().applyQuaternion(quaternion),
        position: BACK.clone().applyQuaternion(quaternion).multiplyScalar(distance).add(target),
      };
    },
    turn:
      sine > 0
        ? new Vector3(relative.x, relative.y, relative.z).multiplyScalar(angle / sine)
        : new Vector3(),
    shift: goal.target.clone().sub(startTarget),
    stretch: endDistance - startDistance,
  };
}
