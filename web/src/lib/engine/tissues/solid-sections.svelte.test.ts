// Cap priority in real WebGL: which coplanar cap shows is decided by priority, never by depth rounding.
import { expect, test } from 'vitest';
import {
  BoxGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { SolidSections } from './solid-sections.ts';
import type { Solid } from './solid-sections.ts';

const SIZE = 32;
const RED = 0xff0000;
const GREEN = 0x00ff00;
const BLUE = 0x0000ff;

function box(size: number, volume: number) {
  const mesh = new Mesh(
    new BoxGeometry(size, size, size),
    new MeshBasicMaterial({ side: DoubleSide }),
  );
  mesh.userData = { segmentation_volume_mm3: volume };
  return mesh;
}

/** The pixel at (x, y) from the bottom left, as 0xRRGGBB. */
function pixel(pixels: Uint8Array, x: number, y: number) {
  const at = (y * SIZE + x) * 4;
  return (pixels[at]! << 16) | (pixels[at + 1]! << 8) | pixels[at + 2]!;
}

/**
 * An enclosing red solid and a nested green one, cut at z = 0 and seen from +z. The red cap, which the
 * green one ranks above, is moved toward the camera by `nudge` metres: what depth rounding does to a
 * long thin triangle of one cap against another cap's.
 */
function render(nudge: number, stencilled: 'none' | 'outer' | 'inner') {
  const renderer = new WebGLRenderer({ canvas: document.createElement('canvas') });
  renderer.localClippingEnabled = true;
  const sections = new SolidSections();
  sections.add(box(0.2, 8000), new MeshBasicMaterial({ color: RED }), 2);
  sections.add(box(0.05, 125), new MeshBasicMaterial({ color: GREEN }), 2);
  sections.update(new Plane(new Vector3(0, 0, -1), 0));
  const [outer, inner] = sections.solids as [Solid, Solid];
  // A non-manifold section keeps the whole-plane stencil quad.
  if (stencilled !== 'none')
    sections.place(stencilled === 'outer' ? outer : inner, { fallback: true });
  outer.cap.position.z += nudge;
  outer.cap.updateMatrix();

  const scene = new Scene();
  scene.add(sections.group);
  // Behind the cut face and drawn after it: the face's depth must hide it.
  const behind = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 1 }),
  );
  behind.position.z = -0.05;
  scene.add(behind);
  const camera = new PerspectiveCamera(30, 1, 0.01, 10);
  camera.position.set(0, 0, 0.5);
  camera.lookAt(0, 0, 0);
  const target = new WebGLRenderTarget(SIZE, SIZE, { stencilBuffer: true });
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
  renderer.setRenderTarget(null);
  target.dispose();
  sections.dispose();
  renderer.dispose();
  return pixels;
}

// About 60 depth units at this distance: well past any spacing of polygon-offset tiers.
const NUDGE_M = 1e-4;

test.each(['none', 'outer', 'inner'] as const)(
  'the higher-ranked cap shows over a nearer lower-ranked one, and the face still hides what is behind (stencil cap: %s)',
  (stencilled) => {
    const pixels = render(NUDGE_M, stencilled);
    const centre = SIZE / 2;
    expect(pixel(pixels, centre, centre).toString(16)).toBe(GREEN.toString(16));
    // Off the nested solid, the enclosing cap is still drawn over the plane behind.
    expect(pixel(pixels, centre + 6, centre).toString(16)).toBe(RED.toString(16));
  },
);
