// The outline's masks on a cut, in real WebGL: clipped as the anatomy is, hidden by what the cut draws.
import { afterAll, expect, test } from 'vitest';
import {
  BoxGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { createOutlinePasses, outline } from './outline-passes.ts';

const SIZE = 32;

// One context for the file: a context each compiled every program again, and timed out under the full suite.
const renderer = new WebGLRenderer({ canvas: document.createElement('canvas') });
renderer.localClippingEnabled = true;
const camera = new PerspectiveCamera(30, 1, 0.01, 10);
camera.position.set(0, 0, 0.5);
camera.lookAt(0, 0, 0);
afterAll(() => renderer.dispose());

function quad(z: number) {
  const mesh = new Mesh(new PlaneGeometry(0.2, 0.2), new MeshBasicMaterial());
  mesh.position.z = z;
  return mesh;
}

/**
 * The halo's mask at the centre of a frame seen from +z, with the anatomy kept at z ≤ 0 when `cut`:
 * whether the selection was drawn there, and whether it was drawn as hidden behind something.
 */
function maskAtCentre({
  selected,
  others = [],
  cut,
  leaveOut = [],
}: {
  selected: Mesh;
  others?: Object3D[];
  cut: boolean;
  leaveOut?: Object3D[];
}) {
  const scene = new Scene();
  scene.add(selected, ...others);
  const passes = createOutlinePasses(scene, camera);
  passes.halo.setSize(SIZE, SIZE);
  const planes = cut ? [new Plane(new Vector3(0, 0, -1), 0)] : [];
  outline([passes], { selected: [selected], planes, leaveOut });
  const frame = new WebGLRenderTarget(SIZE, SIZE);
  passes.halo.render(renderer, frame, frame, 0, false);
  const pixels = new Uint8Array(4);
  const mask = passes.halo.renderTargetMaskBuffer;
  renderer.readRenderTargetPixels(mask, SIZE / 2, SIZE / 2, 1, 1, pixels);
  frame.dispose();
  for (const pass of [passes.halo, passes.core]) pass.dispose();
  // The pass clears its mask to white and draws the selection with no red, hidden in green.
  return { drawn: pixels[0]! < 128, hidden: pixels[1]! > 128 };
}

test('a cut clips the selection out of the mask where it clips the anatomy', () => {
  expect(maskAtCentre({ selected: quad(0.05), cut: false }).drawn).toBe(true);
  expect(maskAtCentre({ selected: quad(0.05), cut: true }).drawn).toBe(false);
  expect(maskAtCentre({ selected: quad(-0.05), cut: true }).drawn).toBe(true);
});

test('a cap on the plane hides the selection behind it', () => {
  expect(maskAtCentre({ selected: quad(-0.05), cut: true })).toEqual({
    drawn: true,
    hidden: false,
  });
  // A section's vertices land a rounding error to either side of the plane.
  const cap = quad(1e-6);
  expect(maskAtCentre({ selected: quad(-0.05), others: [cap], cut: true })).toEqual({
    drawn: true,
    hidden: true,
  });
});

test('the inside of an opened surface hides the selection beyond it', () => {
  // Cut open at z = 0, so the camera looks onto the inside of its far wall at z = -0.05.
  const opened = new Mesh(
    new BoxGeometry(0.3, 0.3, 0.1),
    new MeshBasicMaterial({ side: DoubleSide }),
  );
  expect(maskAtCentre({ selected: quad(-0.08), others: [opened], cut: true })).toEqual({
    drawn: true,
    hidden: true,
  });
});

test('what the outline leaves out hides nothing', () => {
  const stencilQuad = quad(0);
  expect(
    maskAtCentre({
      selected: quad(-0.05),
      others: [stencilQuad],
      cut: true,
      leaveOut: [stencilQuad],
    }),
  ).toEqual({ drawn: true, hidden: false });
  expect(stencilQuad.visible).toBe(true);
});
