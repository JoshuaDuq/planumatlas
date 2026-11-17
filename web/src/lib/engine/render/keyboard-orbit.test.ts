import assert from 'node:assert/strict';
import { test } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  DOLLY_KEYS,
  ORBIT_KEYS,
  ORBIT_STEP,
  PAN_KEYS,
  PAN_STEP,
  panFromKeyboard,
  turnFromKeyboard,
} from './keyboard-orbit.ts';
import { levelOnOrbit } from './orbit-controls.ts';

const target = new Vector3(0, 0, 0);

/** Undamped controls, as the scene builds them, with the camera at `position` and `up`. */
function controlsAt(position: Vector3, up = new Vector3(0, 1, 0)) {
  const camera = new PerspectiveCamera(35, 1.4, 0.001, 10);
  const controls = new OrbitControls(camera);
  levelOnOrbit(controls);
  camera.up.copy(up);
  camera.position.copy(position);
  controls.target.copy(target);
  controls.update();
  return { camera, controls };
}

type OrbitKey = keyof typeof ORBIT_KEYS;

const press = (key: OrbitKey, position: Vector3, up?: Vector3) => {
  const { camera, controls } = controlsAt(position, up);
  turnFromKeyboard(controls, ORBIT_KEYS[key]);
  return { position: camera.position.clone() };
};

test('an orbit step keeps the camera the same distance from what it looks at', () => {
  for (const key of Object.keys(ORBIT_KEYS) as OrbitKey[]) {
    const { position } = press(key, new Vector3(0, 0, 0.2));
    assert.ok(Math.abs(position.distanceTo(target) - 0.2) < 1e-9, key);
  }
});

test('a press lands at once, by the whole declared step', () => {
  const start = new Vector3(0, 0, 0.2);
  for (const key of Object.keys(ORBIT_KEYS) as OrbitKey[]) {
    const { position } = press(key, start);
    const swept = position.clone().sub(target).angleTo(start.clone().sub(target));
    assert.ok(Math.abs(swept - ORBIT_STEP) < 1e-9, key);
  }
});

test('left and right turn opposite ways', () => {
  const start = new Vector3(0, 0, 0.2);
  const left = press('ArrowLeft', start).position;
  const right = press('ArrowRight', start).position;
  assert.ok(Math.sign(left.x) === -Math.sign(right.x) && Math.abs(left.x) > 1e-6);
});

test('the model follows the arrow, the way it follows a drag', () => {
  // Pressing up tips the model up and brings its underside into view, exactly as dragging up
  // does: OrbitControls turns a drag up into a negative rotateUp.
  const start = new Vector3(0, 0, 0.2);
  const dragged = controlsAt(start);
  dragged.controls.rotateUp(-ORBIT_STEP);
  assert.ok(press('ArrowUp', start).position.distanceTo(dragged.camera.position) < 1e-12);
  assert.ok(press('ArrowUp', start).position.y < 0);
  assert.ok(press('ArrowDown', start).position.y > 0);
});

test('the horizon never flips, however long an arrow is held', () => {
  // Crossing a pole turns the anatomy upside down, and a reader who got there
  // by feel cannot tell which press undoes it.
  for (const [key, side] of [
    ['ArrowUp', -1],
    ['ArrowDown', 1],
  ] as const) {
    const { camera, controls } = controlsAt(new Vector3(0, 0, 0.2));
    for (let i = 0; i < 200; i++) turnFromKeyboard(controls, ORBIT_KEYS[key]);
    assert.ok(Math.sign(camera.position.y) === side, key);
    assert.ok(Math.abs(camera.position.distanceTo(target) - 0.2) < 1e-9, key);
  }
});

test('a view looking straight down spins in place by one step', () => {
  // The superior view sets an anterior up on the superior axis, where the stock controls sat still.
  const { camera, controls } = controlsAt(new Vector3(0, 0.2, 0), new Vector3(0, 0, -1));
  const before = camera.quaternion.clone();
  turnFromKeyboard(controls, ORBIT_KEYS.ArrowLeft);
  assert.ok(Math.abs(camera.position.distanceTo(target) - 0.2) < 1e-9);
  assert.ok(Math.abs(camera.quaternion.angleTo(before) - ORBIT_STEP) < 1e-3, 'it turned one step');
});

test('every arrow and zoom key is bound, and nothing else is', () => {
  const arrows = ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  assert.deepEqual(Object.keys(ORBIT_KEYS).sort(), arrows);
  assert.deepEqual(Object.keys(PAN_KEYS).sort(), arrows);
  assert.deepEqual(Object.keys(DOLLY_KEYS).sort(), ['+', '-', '=']);
});

test('RENDER-22 each zoom key steps the distance by a factor of 1.1', () => {
  assert.equal(DOLLY_KEYS['+'], 1 / 1.1);
  assert.equal(DOLLY_KEYS['='], 1 / 1.1);
  assert.equal(DOLLY_KEYS['-'], 1.1);
});

/** The element OrbitControls listens on, without a DOM: a canvas 600 px tall. */
function canvasSurface() {
  return Object.assign(new EventTarget(), {
    style: {} as Record<string, string>,
    clientHeight: 600,
    ownerDocument: new EventTarget(),
    getRootNode: () => new EventTarget(),
    setPointerCapture() {},
    releasePointerCapture() {},
  });
}

/** Undamped controls on a 600 px canvas, the camera 0.2 m in front of the target. */
function onCanvas() {
  const element = canvasSurface();
  const camera = new PerspectiveCamera(35, 1.4, 0.001, 10);
  const controls = new OrbitControls(camera, element as unknown as HTMLElement);
  levelOnOrbit(controls);
  camera.position.set(0, 0, 0.2);
  controls.target.copy(target);
  controls.update();
  /** A mouse drag of `by` pixels to the right with `button`: 0 turns, 2 pans. */
  const drag = (button: number, by: number) => {
    const mouse = (type: string, x: number) =>
      Object.assign(new Event(type), {
        pointerId: 1,
        pointerType: 'mouse',
        button,
        clientX: x,
        clientY: 300,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      });
    element.dispatchEvent(mouse('pointerdown', 400));
    element.ownerDocument.dispatchEvent(mouse('pointermove', 400 + by));
    element.ownerDocument.dispatchEvent(mouse('pointerup', 400 + by));
  };
  return { camera, controls, drag };
}

test('RENDER-44 Shift with an arrow slides the model 1/72 of the canvas height the way it points', () => {
  for (const [key, right, up] of [
    ['ArrowRight', 1, 0],
    ['ArrowLeft', -1, 0],
    ['ArrowUp', 0, 1],
    ['ArrowDown', 0, -1],
  ] as const) {
    const { camera, controls } = onCanvas();
    const heading = camera.quaternion.clone();
    const looked = controls.target.clone();
    panFromKeyboard(controls, PAN_KEYS[key]);
    // Where the point it looked at is drawn now, in pixels from the centre of the 600 px canvas, up positive.
    camera.updateMatrixWorld();
    const drawn = looked.project(camera);
    assert.ok(Math.abs(drawn.x * 300 * camera.aspect - right * PAN_STEP * 600) < 1e-9, key);
    assert.ok(Math.abs(drawn.y * 300 - up * PAN_STEP * 600) < 1e-9, key);
    // It slides: the heading and the distance are a turn's and a zoom's to change.
    assert.ok(camera.quaternion.angleTo(heading) < 1e-12, key);
    assert.ok(Math.abs(camera.position.distanceTo(controls.target) - 0.2) < 1e-12, key);
  }
});

test('RENDER-44 a pan step is the right-drag as long as the drag that turns one orbit step', () => {
  const length = PAN_STEP * 600;
  const turned = onCanvas();
  turned.drag(0, length);
  const swept = turned.camera.position
    .clone()
    .sub(target)
    .angleTo(new Vector3(0, 0, 0.2));
  assert.ok(Math.abs(swept - ORBIT_STEP) < 1e-9, `${swept} rad`);
  const dragged = onCanvas();
  dragged.drag(2, length);
  const pressed = onCanvas();
  panFromKeyboard(pressed.controls, PAN_KEYS.ArrowRight);
  assert.ok(dragged.camera.position.distanceTo(pressed.camera.position) < 1e-12);
  assert.ok(dragged.controls.target.distanceTo(pressed.controls.target) < 1e-12);
});
