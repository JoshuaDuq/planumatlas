import { expect, test } from 'vitest';
import {
  Color,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Plane,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { tractCatalog } from '../../core/diffusion/catalogs.ts';
import { rasToWorld } from '../slices/coordinates.ts';
import type { Ras } from '../slices/coordinates.ts';
import { streamlineLengths } from './streamlines.ts';
import { createNativeTractViewer } from './native-viewer.ts';
import type { LoadedTract } from './tract-file.ts';

// One pixel a millimetre; the points read below sit on pixel centres.
const SIZE = 100;
const CAP = new Color(0x808080);

// Two straight streamlines in scanner RAS mm, one segment each: the first crosses S = 0 between
// A = -10 and 10, the second S = 25 between A = -5 and 5. The reference space is never loaded, so
// scanner and surface coincide.
const pts = new Float32Array([-20.5, -10, -10, -20.5, 10, 10, 20.5, -5, 15, 20.5, 5, 35]);
const offsetPt0 = new Uint32Array([0, 2, 4]);

type Viewer = ReturnType<typeof createNativeTractViewer>;

/** Show the bundle, then cut. */
async function showThenCut(viewer: Viewer, load: () => Promise<void>, plane: Plane) {
  await load();
  viewer.setClippingPlanes([plane]);
}

/**
 * The cut at S = `superior` mm, the part below it cut away, seen from below over an opaque cap: what
 * the face shows at each RAS point once `steps` have shown the bundle and set the cut.
 */
async function faceAt(superior: number, points: Ras[], steps = showThenCut) {
  const catalog = tractCatalog('cdmd-sub-013');
  const viewer = createNativeTractViewer(
    catalog,
    () => {},
    async () =>
      ({ pts: pts.slice(), offsetPt0, lengths: streamlineLengths(pts, offsetPt0) }) as LoadedTract,
  );
  viewer.group.visible = true;
  const plane = new Plane(new Vector3(0, 1, 0), -superior / 1000);
  await steps(viewer, () => viewer.loadBundle(catalog.bundles[0]!), plane);
  const cap = new Mesh(new PlaneGeometry(0.2, 0.2), new MeshBasicMaterial({ color: CAP }));
  cap.rotation.x = Math.PI / 2;
  cap.position.y = superior / 1000;
  const scene = new Scene().add(cap, viewer.group);
  const camera = new OrthographicCamera(-0.05, 0.05, 0.05, -0.05, 0.01, 1);
  camera.position.set(0, -0.5, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const renderer = new WebGLRenderer();
  renderer.localClippingEnabled = true;
  const target = new WebGLRenderTarget(SIZE, SIZE);
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixels = new Uint8Array(4 * SIZE * SIZE);
  renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
  renderer.dispose();
  target.dispose();
  viewer.dispose();
  return points.map((point) => {
    const ndc = rasToWorld(point).project(camera);
    const x = Math.floor(((ndc.x + 1) / 2) * SIZE);
    const y = Math.floor(((ndc.y + 1) / 2) * SIZE);
    return Array.from(pixels.subarray(4 * (y * SIZE + x), 4 * (y * SIZE + x) + 3));
  });
}

// The render target is linear.
const grey = [CAP.r, CAP.g, CAP.b].map((value) => Math.round(255 * value));
const onFace = ([red, green, blue]: number[]) => red! < 40 && green! + blue! > 200;

test('DIFF-38 the cut face shows the tracts within 2 mm of it, over the cap that hides those behind it', async () => {
  const [kept, cutAway, beyondSlab, far] = await faceAt(0, [
    [-20.5, 1.5, 0],
    [-20.5, -1.5, 0],
    [-20.5, 6.5, 0],
    [20.5, 0.5, 0],
  ]);
  // From 1.5 mm behind the face and 1.5 mm of what was cut away; anterior-superior, as the line runs.
  expect(onFace(kept!), `${kept}`).toBe(true);
  expect(onFace(cutAway!), `${cutAway}`).toBe(true);
  // The same segment 6.5 mm along the face is 6.5 mm from the cut, and the other line 15 mm or more.
  expect(beyondSlab).toEqual(grey);
  expect(far).toEqual(grey);
});

test('DIFF-38 the face follows the cut, whether the cut or the bundle came first', async () => {
  const [left, right] = await faceAt(
    25,
    [
      [-20.5, 0.5, 25],
      [20.5, 0.5, 25],
    ],
    async (viewer, load, plane) => {
      viewer.setClippingPlanes([plane]);
      await load();
    },
  );
  expect(left).toEqual(grey);
  expect(onFace(right!), `${right}`).toBe(true);
});

test('DIFF-38 without a cut, or once it closes, there is no face: the cap hides the line behind it', async () => {
  const behind: Ras = [-20.5, 1.5, 0];
  expect(await faceAt(0, [behind], (_, load) => load())).toEqual([grey]);
  expect(
    await faceAt(0, [behind], async (viewer, load, plane) => {
      await showThenCut(viewer, load, plane);
      viewer.setClippingPlanes([]);
    }),
  ).toEqual([grey]);
});
