import assert from 'node:assert/strict';
import { afterAll, afterEach, beforeAll, test, vi } from 'vitest';
import { Box3, Matrix4, Raycaster, Vector3 } from 'three';
import type { Mesh } from 'three';
import type { MeshBVH } from 'three-mesh-bvh';
import { labelOf } from '../../core/catalog/labels.ts';
import { regionAt } from '../slices/region-at.ts';
import { rasToWorld, worldToRas } from '../slices/coordinates.ts';
import { solidSource } from '../tissues/solid-assets.ts';
import { BrainAtlas } from './brain-atlas.ts';
import { HEMISPHERE_GAP, anatomicalPoint, pieceOf, restBox } from './explode.ts';
import { modelDirectory, publishedLoader, readManifest } from './test-support.ts';

const ATLAS = 'destrieux';
/** One model on the published anatomy, assembled again after each case. */
let model: BrainAtlas;

beforeAll(async () => {
  model = new BrainAtlas(readManifest('cdmd'), publishedLoader(modelDirectory('cdmd')));
  await model.initialize(ATLAS);
}, 120_000);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  model.setCutState({ atlas: null, active: false });
  model.setExploded(false);
  model.stepExplode(Number.MAX_SAFE_INTEGER);
});

afterAll(() => model.dispose());

/** `performance.now()` as the model reads it, in milliseconds. */
function at(now: number) {
  vi.spyOn(performance, 'now').mockReturnValue(now);
}

const meshes = (layer: string) => model.layers.get(layer)!.meshes;
const meshOf = (id: string) =>
  meshes(model.settings.detail).find((m) => m.userData['region_id'] === id)!;

/** Where a mesh is drawn, less where the anatomy has it: the published nodes are identities. */
function drawnShift(mesh: Mesh): Vector3 {
  mesh.updateWorldMatrix(true, false);
  return new Vector3().setFromMatrixPosition(mesh.matrixWorld);
}

function drawnBox(mesh: Mesh): Box3 {
  mesh.updateWorldMatrix(true, false);
  return mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
}

/** Explode and let it arrive. */
function explodeNow() {
  at(1000);
  model.setExploded(true);
  model.stepExplode(Number.MAX_SAFE_INTEGER);
}

const close = (a: Vector3, b: Vector3, what: string, tolerance = 1e-12) =>
  assert.ok(a.distanceTo(b) <= tolerance, `${what}: ${a.toArray()} is not ${b.toArray()}`);

test('each hemisphere slides out by at least its own width, both one gap clear of the deep anatomy', () => {
  explodeNow();
  const cortex = meshes(ATLAS);
  for (const side of ['left', 'right'] as const) {
    const halves = cortex.filter((mesh) => mesh.userData['hemisphere'] === side);
    const rest = halves.reduce((box, mesh) => box.union(mesh.geometry.boundingBox!), new Box3());
    const shift = drawnShift(halves[0]!);
    for (const mesh of halves)
      close(drawnShift(mesh), shift, `${side}: the hemisphere moves whole`);
    assert.equal(shift.y, 0);
    assert.equal(shift.z, 0);
    const outward = side === 'left' ? -shift.x : shift.x;
    assert.ok(outward >= rest.max.x - rest.min.x - 1e-12, `${side} moves ${outward} m`);
  }
  const edge = (side: string, end: 'min' | 'max') =>
    cortex
      .filter((mesh) => mesh.userData['hemisphere'] === side)
      .map((mesh) => drawnBox(mesh)[end].x)
      .reduce((a, b) => (end === 'max' ? Math.max(a, b) : Math.min(a, b)));
  const [leftEdge, rightEdge] = [edge('left', 'max'), edge('right', 'min')];
  const deep = meshes(model.settings.detail).reduce(
    (box, mesh) => box.union(drawnBox(mesh)),
    new Box3(),
  );
  assert.ok(
    Math.abs(deep.min.x - leftEdge - (rightEdge - deep.max.x)) < 1e-12,
    'both hemispheres stand one gap from the spread anatomy',
  );
  for (const mesh of meshes(model.settings.detail)) {
    const box = drawnBox(mesh);
    assert.ok(
      box.min.x >= leftEdge + HEMISPHERE_GAP - 1e-12 &&
        box.max.x <= rightEdge - HEMISPHERE_GAP + 1e-12,
      `${mesh.userData['region_id']} (x ${box.min.x}..${box.max.x}) comes within ${HEMISPHERE_GAP} m of a hemisphere`,
    );
  }
});

test('the deep anatomy moves by system about its own centre: a side together, the brainstem and cerebellum whole', () => {
  explodeNow();
  const shift = (id: string) => drawnShift(meshOf(`learning:${id}`));
  close(shift('left:putamen'), shift('left:caudate'), 'the left basal ganglia');
  close(shift('left:pons'), shift('right:pons'), 'the brainstem');
  close(shift('crus-i-left'), shift('crus-i-right'), 'the cerebellum');
  assert.ok(shift('left:putamen').x < 0 && shift('right:putamen').x > 0, 'the sides part');
  // World y is superior and z posterior: the callosum rises, the cerebellum goes down and back.
  assert.ok(shift('corpus-callosum').y > 0, 'the corpus callosum');
  assert.ok(shift('crus-i-left').y < 0 && shift('crus-i-left').z > 0, 'the cerebellum');
  assert.ok(shift('left:pons').y < 0, 'the brainstem');
});

test('spread, the systems pass through each other in no more of their pairs than measured', () => {
  explodeNow();
  const pieces = new Map<string, Mesh[]>();
  for (const mesh of meshes(model.settings.detail)) {
    const region = model.regions.get(mesh.userData['region_id'])!;
    const name = pieceOf(labelOf(region, 'en')!.group, region.hemisphere);
    pieces.set(name, [...(pieces.get(name) ?? []), mesh]);
  }
  const relative = new Matrix4();
  const crossing = (a: Mesh, b: Mesh) => {
    if (!drawnBox(a).intersectsBox(drawnBox(b))) return false;
    relative.copy(a.matrixWorld).invert().multiply(b.matrixWorld);
    return (a.geometry.boundsTree as MeshBVH).intersectsGeometry(b.geometry, relative);
  };
  const names = [...pieces.keys()];
  const crossed = names.flatMap((a, i) =>
    names
      .slice(i + 1)
      .filter((b) => pieces.get(a)!.some((m) => pieces.get(b)!.some((n) => crossing(m, n))))
      .map((b) => `${a} × ${b}`),
  );
  // 23 of 91 at the first spread, 0.6 about the cerebrum's centre; the stria terminalis, the fornix,
  // the claustrum and the fourth ventricle thread between systems at any spread a reader can follow.
  assert.ok(crossed.length <= 13, crossed.join('\n'));
});

test('a structure is moved, never reshaped', () => {
  const mesh = meshOf('learning:left:thalamus');
  const vertices = Array.from(mesh.geometry.attributes['position']!.array);
  explodeNow();
  mesh.updateWorldMatrix(true, false);
  const linear = mesh.matrixWorld.elements.filter((_, index) => index < 12);
  assert.deepEqual(linear, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  assert.deepEqual(Array.from(mesh.geometry.attributes['position']!.array), vertices);
});

test('a change of mind turns the pieces where they are, and they never pass where they are going', () => {
  const mesh = meshes(ATLAS).find((m) => m.userData['hemisphere'] === 'left')!;
  at(1000);
  model.setExploded(true);
  const full = new Vector3().setFromMatrixPosition(model.settledMatrixWorld(mesh)).x;
  const share = (now: number) => {
    model.stepExplode(now);
    return drawnShift(mesh).x / full;
  };
  assert.equal(Math.abs(share(1000)), 0, 'it starts where it was drawn');
  let last = 0;
  for (let now = 1016; now <= 1144; now += 16) {
    const next = share(now);
    assert.ok(next > last && next < 1, `out at ${now} ms: ${next}`);
    last = next;
  }
  at(1144);
  model.setExploded(false);
  assert.equal(share(1144), last, 'the turn does not jump');
  let frames = 0;
  for (let now = 1160; model.stepExplode(now); now += 16) {
    const next = drawnShift(mesh).x / full;
    assert.ok(next <= last && next >= 0, `back at ${now} ms: ${next}`);
    last = next;
    frames += 1;
  }
  assert.equal(Math.abs(drawnShift(mesh).x), 0, 'it arrives exactly');
  assert.ok(frames < 60, `the way back took ${frames} frames`);
});

test('asked again on its way, the explode goes on exactly as it was going', () => {
  const mesh = meshOf('learning:left:putamen');
  const run = (repeatAt: number | null) => {
    model.setExploded(false);
    model.stepExplode(Number.MAX_SAFE_INTEGER);
    at(1000);
    model.setExploded(true);
    return [1050, 1100, 1150, 1200, 1250].map((now) => {
      if (now === repeatAt) {
        at(now);
        model.setExploded(true);
      }
      model.stepExplode(now);
      return drawnShift(mesh).x;
    });
  };
  const straight = run(null);
  run(1100).forEach((x, frame) =>
    assert.ok(
      Math.abs(x - straight[frame]!) < 1e-9,
      `frame ${frame}: ${x} is not ${straight[frame]}`,
    ),
  );
});

test('under reduced motion the brain parts with the next frame, with no way between', () => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
  const mesh = meshOf('learning:left:putamen');
  at(1000);
  model.setExploded(true);
  // A dissolve copies the frame on screen now, so the anatomy is still where it was drawn.
  assert.equal(drawnShift(mesh).length(), 0);
  assert.equal(model.stepExplode(1000), true, 'the next frame moves it');
  const settled = new Vector3().setFromMatrixPosition(model.settledMatrixWorld(mesh));
  close(drawnShift(mesh), settled, 'parted');
  assert.ok(settled.length() > 0);
  assert.equal(model.stepExplode(1016), false, 'nothing is left to move');
});

test('framing reads where the pieces are going before they move', () => {
  at(1000);
  model.setExploded(true);
  const mesh = meshOf('learning:right:hippocampus');
  assert.equal(drawnShift(mesh).length(), 0);
  const settled = new Vector3().setFromMatrixPosition(model.settledMatrixWorld(mesh));
  model.stepExplode(Number.MAX_SAFE_INTEGER);
  close(settled, drawnShift(mesh), 'the settled place is where it arrives');
});

test('a cut, a region lookup and a pick read the anatomy where it lies, not where it is drawn', () => {
  explodeNow();
  const id = 'learning:left:putamen';
  const putamen = meshOf(id);
  const rest = restBox(putamen);
  assert.ok(drawnShift(putamen).length() > 0.005, 'the putamen is drawn away from its place');
  const source = solidSource(putamen);
  close(new Vector3().setFromMatrixPosition(source.matrixWorld), new Vector3(), 'its cut source');
  // The dentate goes with the cerebellum, further than its own size: its drawn box misses its anchor.
  const dentate = 'learning:left:dentate';
  const anchor = model.anchorOf(dentate)!;
  assert.ok(!drawnBox(meshOf(dentate)).containsPoint(rasToWorld(anchor)));
  assert.equal(regionAt(meshes(model.settings.detail), anchor), dentate);
  const centre = drawnBox(putamen).getCenter(new Vector3());
  const ray = new Raycaster(centre.clone().add(new Vector3(-0.3, 0, 0)), new Vector3(1, 0, 0));
  const hit = model.nearestHit(ray, [putamen]);
  assert.ok(hit, 'the drawn putamen is hit');
  assert.ok(!rest.containsPoint(hit.point));
  const point = anatomicalPoint(hit);
  assert.ok(rest.clone().expandByScalar(1e-9).containsPoint(point), `${worldToRas(point)} mm`);
});

test('a cut opens on the brain put back at once', () => {
  explodeNow();
  model.setCutState({ atlas: ATLAS, active: true });
  assert.equal(model.settings.exploded, false);
  assert.equal(model.stepExplode(2000), false, 'nothing is left to move');
  for (const mesh of [...meshes(ATLAS), ...meshes(model.settings.detail)]) {
    assert.equal(drawnShift(mesh).length(), 0, mesh.userData['region_id']);
  }
});
