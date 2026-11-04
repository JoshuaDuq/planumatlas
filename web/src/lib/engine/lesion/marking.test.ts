import assert from 'node:assert/strict';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector2,
  Vector3,
} from 'three';
import type { WebGLRenderer } from 'three';
import { test } from 'vitest';
import type { LesionSphere } from '../api.ts';
import { createLesionMarking, cssPixelAt, footprint } from './marking.ts';

/** Two triangles side by side: one centred at x = 0, one at x = 10. */
function strip(matrix = new Matrix4()): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 0, 2, 0, 9, -1, 0, 11, -1, 0, 10, 2, 0], 3),
  );
  const mesh = new Mesh(geometry);
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(matrix);
  mesh.updateMatrixWorld(true);
  return mesh;
}

test('keeps the triangles whose centroid lies within the radius, in world space', () => {
  const { positions } = footprint([strip()], new Vector3(0, 0, 0), 2);
  assert.deepEqual([...positions], [-1, -1, 0, 1, -1, 0, 0, 2, 0]);
});

test('reads a mesh through its world matrix', () => {
  const moved = strip(new Matrix4().makeTranslation(0, 0, 5));
  const { positions } = footprint([moved], new Vector3(0, 0, 5), 2);
  assert.deepEqual([...positions], [-1, -1, 5, 1, -1, 5, 0, 2, 5]);
});

test('reads indexed geometry', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([5, 5, 5, -1, -1, 0, 1, -1, 0, 0, 2, 0], 3),
  );
  geometry.setIndex([1, 2, 3, 0, 0, 0]);
  const mesh = new Mesh(geometry);
  mesh.updateMatrixWorld(true);
  assert.deepEqual(
    [...footprint([mesh], new Vector3(), 2).positions],
    [-1, -1, 0, 1, -1, 0, 0, 2, 0],
  );
});

test('keeps the surface’s own normals, turned with the mesh, so the paint shades as the cortex does', () => {
  const mesh = strip(new Matrix4().makeRotationY(Math.PI / 2));
  const normals = new Float32Array(18);
  for (let i = 0; i < 6; i++) normals.set([0, 0, 1], i * 3);
  mesh.geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  const { normals: kept } = footprint([mesh], new Vector3(), 2);
  // +z turned a quarter about y is +x.
  assert.deepEqual(
    [...kept].map((value) => Math.round(value)),
    [1, 0, 0, 1, 0, 0, 1, 0, 0],
  );
});

test('a CSS pixel spans twice the world length at twice the distance, and a stage half as tall doubles it', () => {
  const camera = new PerspectiveCamera(30, 1, 0.01, 10);
  camera.position.set(0, 0, 0.5);
  camera.updateMatrixWorld(true);
  const near = cssPixelAt(camera, 800, new Vector3(0, 0, 0));
  // 2 · 0.5 m · tan(15°) over 800 px.
  assert.ok(Math.abs(near - (2 * 0.5 * Math.tan(Math.PI / 12)) / 800) < 1e-12);
  assert.ok(Math.abs(cssPixelAt(camera, 800, new Vector3(0, 0, -0.5)) - 2 * near) < 1e-12);
  assert.ok(Math.abs(cssPixelAt(camera, 400, new Vector3(0, 0, 0)) - 2 * near) < 1e-12);
});

test('the ring and the dot each sit on a halo drawn just before them', () => {
  const marking = createLesionMarking();
  const sphere: LesionSphere = { centre: [0, 0, 0], radius: 10 };
  marking.show(sphere, [], [], 1);
  const [, ringHalo, dotHalo, ring, dot] = marking.group.children as Mesh[];
  assert.equal(ringHalo!.renderOrder, ring!.renderOrder - 1);
  assert.equal(dotHalo!.renderOrder, dot!.renderOrder - 1);
  // A band either side of the ring's radius, 10 mm in metres.
  const positions = ringHalo!.geometry.getAttribute('position');
  assert.ok(Math.abs(Math.hypot(positions.getX(0), positions.getY(0)) - 0.01) < 1e-9);
  assert.deepEqual(Array.from(ringHalo!.geometry.getAttribute('side').array.slice(0, 2)), [-1, 1]);
  marking.dispose();
});

test('each marking faces the camera in the frame that draws it, not the next', () => {
  const marking = createLesionMarking();
  marking.show({ centre: [0, 0, 0], radius: 10 }, [], [], 1);
  const camera = new PerspectiveCamera(30, 1, 0.01, 10);
  camera.position.set(1, 0, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  // The renderer settles world matrices first, then calls onBeforeRender and draws with matrixWorld.
  marking.group.updateMatrixWorld(true);
  const renderer = { getSize: (size: Vector2) => size.set(800, 600) } as unknown as WebGLRenderer;
  const [, ...billboards] = marking.group.children as Mesh[];
  const facing = new Quaternion();
  for (const object of billboards) {
    // The markings read only the renderer, the scene and the camera.
    (object.onBeforeRender as (...args: unknown[]) => void)(renderer, new Scene(), camera);
    object.matrixWorld.decompose(new Vector3(), facing, new Vector3());
    assert.ok(facing.angleTo(camera.quaternion) < 1e-6, object.constructor.name);
  }
  marking.dispose();
});
