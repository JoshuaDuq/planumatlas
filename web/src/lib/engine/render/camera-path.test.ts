import assert from 'node:assert/strict';
import { test } from 'vitest';
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VIEW_DIRECTIONS, upFor } from './camera-views.ts';
import { orbitPath } from './camera-path.ts';
import type { ViewName } from '../../types/index.ts';

const target = new Vector3(0.002, -0.011, 0.004);
const DISTANCE = 0.42;

/** A camera and its controls settled on a named view, as scene.moveTo leaves them. */
function settledOn(view: ViewName) {
  const camera = new PerspectiveCamera(35, 1.4, 0.001, 10);
  const controls = new OrbitControls(camera);
  camera.up.copy(upFor(view));
  camera.position.copy(target).addScaledVector(VIEW_DIRECTIONS[view], DISTANCE);
  controls.target.copy(target);
  controls.update();
  return { camera, controls };
}

const destination = (view: ViewName) => ({
  position: target.clone().addScaledVector(VIEW_DIRECTIONS[view], DISTANCE),
  target: target.clone(),
  up: upFor(view),
});

const drawn = ({ camera, controls }: { camera: PerspectiveCamera; controls: OrbitControls }) => ({
  quaternion: camera.quaternion,
  position: camera.position,
  target: controls.target,
});

test('an animated move ends on the very pose an immediate one gives, bit for bit', () => {
  for (const [from, to] of [
    ['left', 'right'],
    ['anterior', 'superior'],
    ['oblique', 'inferior'],
    ['posterior', 'left'],
  ] as const) {
    const immediate = settledOn(from);
    const plan = destination(to);
    immediate.camera.up.copy(plan.up);
    immediate.camera.position.copy(plan.position);
    immediate.controls.target.copy(plan.target);
    immediate.controls.update();

    const animated = settledOn(from);
    const pose = orbitPath(drawn(animated), plan).at(1);
    animated.camera.position.copy(pose.position);
    animated.controls.target.copy(pose.target);
    animated.camera.up.copy(pose.up);
    animated.controls.update();

    for (const key of ['position', 'quaternion', 'up'] as const) {
      assert.deepEqual(
        animated.camera[key].toArray(),
        immediate.camera[key].toArray(),
        `${from} → ${to}: ${key}`,
      );
    }
    assert.deepEqual(animated.controls.target.toArray(), immediate.controls.target.toArray());
  }
});

test('opposite views orbit round the anatomy at a constant distance, never through it', () => {
  const path = orbitPath(drawn(settledOn('left')), destination('right'));
  for (let step = 0; step <= 20; step += 1) {
    const pose = path.at(step / 20);
    assert.ok(
      Math.abs(pose.position.distanceTo(pose.target) - DISTANCE) < 1e-9,
      `distance at ${step / 20}`,
    );
    // Left to right turns about the superior axis: the eye stays level with the target.
    assert.ok(Math.abs(pose.position.y - target.y) < 1e-9, `height at ${step / 20}`);
  }
});

test('the roll turns with the orbit instead of jumping on the first frame', () => {
  const path = orbitPath(drawn(settledOn('anterior')), destination('superior'));
  const first = path.at(0.03);
  // Three per cent of the way, the frame is still almost upright, as the anterior view was.
  assert.ok(first.up.dot(new Vector3(0, 1, 0)) > 0.99);
  let previous = path.at(0).up;
  for (let step = 1; step <= 20; step += 1) {
    const up = path.at(step / 20).up;
    assert.ok(up.angleTo(previous) < Math.PI / 10, `continuous at ${step / 20}`);
    previous = up;
  }
});

test('a move that also travels interpolates the target and the distance', () => {
  const from = settledOn('oblique');
  const to = {
    position: new Vector3(0.1, 0, 0.3),
    target: new Vector3(0.1, 0, 0.2),
    up: new Vector3(0, 1, 0),
  };
  const path = orbitPath(drawn(from), to);
  // The scene moves this very camera along the path, which must not move the path's start.
  from.camera.position.set(1, 1, 1);
  from.controls.target.set(1, 1, 1);
  from.camera.quaternion.set(0, 0, 0, 1);
  const pose = path.at(0.5);
  assert.ok(pose.target.distanceTo(target.clone().lerp(to.target, 0.5)) < 1e-12);
  assert.ok(Math.abs(pose.position.distanceTo(pose.target) - (DISTANCE + 0.1) / 2) < 1e-9);
});

test('the path starts where the camera is drawn', () => {
  const from = settledOn('posterior');
  const pose = orbitPath(drawn(from), destination('anterior')).at(0);
  assert.ok(pose.position.distanceTo(from.camera.position) < 1e-12);
  assert.ok(pose.quaternion.angleTo(from.camera.quaternion) < 1e-9);
});

test('a move reports its extent: the turn about one world axis, the target’s shift and the stretch', () => {
  // Left to right is half a turn about the superior axis, the way a sideways drag turns it.
  const flip = orbitPath(drawn(settledOn('left')), destination('right'));
  assert.ok(Math.abs(flip.turn.length() - Math.PI) < 1e-9);
  assert.ok(Math.abs(Math.abs(flip.turn.y) - Math.PI) < 1e-9, 'about the superior axis');
  assert.ok(flip.shift.length() < 1e-12);
  assert.ok(Math.abs(flip.stretch) < 1e-12);
  // Halfway along, the camera has turned by half the extent, about the same axis.
  const half = flip
    .at(0.5)
    .quaternion.clone()
    .multiply(settledOn('left').camera.quaternion.invert());
  assert.ok(Math.abs(2 * Math.acos(Math.abs(half.w)) - Math.PI / 2) < 1e-9);

  const from = settledOn('anterior');
  const to = {
    position: new Vector3(0.1, 0, 0.3),
    target: new Vector3(0.1, 0, 0.2),
    up: new Vector3(0, 1, 0),
  };
  const travel = orbitPath(drawn(from), to);
  assert.ok(travel.shift.distanceTo(to.target.clone().sub(target)) < 1e-12);
  assert.ok(Math.abs(travel.stretch - (0.1 - DISTANCE)) < 1e-12);
  // The turn is the one that takes the drawn frame to the goal's.
  const turned = from.camera.quaternion
    .clone()
    .premultiply(
      new Quaternion().setFromAxisAngle(travel.turn.clone().normalize(), travel.turn.length()),
    );
  assert.ok(turned.angleTo(travel.at(1).quaternion) < 1e-9);
});

test('a move’s extent takes the shorter way round, whatever the sign the drawn frame carries', () => {
  const from = drawn(settledOn('left'));
  const flipped = {
    ...from,
    quaternion: from.quaternion
      .clone()
      .set(-from.quaternion.x, -from.quaternion.y, -from.quaternion.z, -from.quaternion.w),
  };
  for (const pose of [from, flipped]) {
    const turn = orbitPath(pose, destination('anterior')).turn.length();
    assert.ok(Math.abs(turn - Math.PI / 2) < 1e-9, `${turn} rad`);
  }
});
