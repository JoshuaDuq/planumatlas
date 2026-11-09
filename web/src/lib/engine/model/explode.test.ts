import assert from 'node:assert/strict';
import { afterAll, afterEach, beforeAll, test, vi } from 'vitest';
import { Box3, BoxGeometry, Matrix4, Mesh, Raycaster, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { labelOf } from '../../core/catalog/labels.ts';
import { regionAt } from '../slices/region-at.ts';
import { rasToWorld, worldToRas } from '../slices/coordinates.ts';
import { solidSource } from '../tissues/solid-assets.ts';
import { BrainAtlas } from './brain-atlas.ts';
import { HEMISPHERE_GAP, anatomicalPoint, deepShifts, leftRightAxis, restBox } from './explode.ts';
import { modelDirectory, publishedLoader, readManifest } from './test-support.ts';

const ATLAS = 'destrieux';
/** One model on the published anatomy, assembled again after each case. */
let model: BrainAtlas;

beforeAll(async () => {
  model = new BrainAtlas(readManifest('cdmd'), publishedLoader(modelDirectory('cdmd')));
  await model.initialize(ATLAS);
}, 120_000);

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  model.setCutState({ atlas: null, active: false });
  model.setExploded(false);
  model.stepExplode(Number.MAX_SAFE_INTEGER);
  await model.setDetail('learning');
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

/** Independently moving pieces must neither cross surfaces nor contain one another. */
function assertDeepPiecesClear(list: readonly Mesh[]) {
  const bounds = list.map(drawnBox);
  const shifts = list.map(drawnShift);
  const relative = new Matrix4();
  for (let i = 0; i < list.length; i++) {
    const a = list[i]!;
    for (let j = i + 1; j < list.length; j++) {
      if (shifts[i]!.distanceTo(shifts[j]!) < 1e-12 || !bounds[i]!.intersectsBox(bounds[j]!))
        continue;
      const b = list[j]!;
      relative.copy(a.matrixWorld).invert().multiply(b.matrixWorld);
      assert.ok(
        !bounds[i]!.containsBox(bounds[j]!) &&
          !bounds[j]!.containsBox(bounds[i]!) &&
          !(a.geometry.boundsTree as MeshBVH).intersectsGeometry(b.geometry, relative),
        `${a.userData['region_id']} clips into ${b.userData['region_id']}`,
      );
    }
  }
}

/** Every moved hemisphere clears the internal anatomy, including a loaded spinal cord. */
function assertHemispheresClear() {
  const axis = new Vector3(1, 0, 0).applyQuaternion(model.anatomicalFrame);
  const deep = new Box3();
  const internal = [
    ...meshes(model.settings.detail),
    ...(model.manifest.supplemental_layers ?? []).flatMap(
      (layer) => model.layers.get(layer.id)?.meshes ?? [],
    ),
  ];
  for (const mesh of internal) deep.union(drawnBox(mesh));
  const [deepMin, deepMax] = along(deep, axis);
  for (const side of ['left', 'right']) {
    const half = meshes(ATLAS)
      .filter((mesh) => mesh.userData['hemisphere'] === side)
      .reduce((box, mesh) => box.union(drawnBox(mesh)), new Box3());
    const [min, max] = along(half, axis);
    const gap = side === 'left' ? deepMin - max : min - deepMax;
    assert.ok(Math.abs(gap - HEMISPHERE_GAP) < 1e-12, `${side}: ${gap} m clearance`);
  }
}

/** Explode and let it arrive. */
function explodeNow() {
  at(1000);
  model.setExploded(true);
  model.stepExplode(Number.MAX_SAFE_INTEGER);
}

const close = (a: Vector3, b: Vector3, what: string, tolerance = 1e-12) =>
  assert.ok(a.distanceTo(b) <= tolerance, `${what}: ${a.toArray()} is not ${b.toArray()}`);

/** A box's least and greatest projections onto a unit axis, over its corners. */
function along(box: Box3, axis: Vector3): [number, number] {
  const projections = [box.min.x, box.max.x].flatMap((x) =>
    [box.min.y, box.max.y].flatMap((y) =>
      [box.min.z, box.max.z].map((z) => new Vector3(x, y, z).dot(axis)),
    ),
  );
  return [Math.min(...projections), Math.max(...projections)];
}

const degrees = (radians: number) => (radians * 180) / Math.PI;

test.each(['aseg', 'nextbrain', 'learning'])(
  'the internal anatomy expands compactly in its original directions at %s detail',
  async (detail) => {
    await model.setDetail(detail);
    explodeNow();
    const pieces = new Map<string, { shift: Vector3; box: Box3 }>();
    for (const mesh of meshes(detail)) {
      const shift = drawnShift(mesh);
      const key = shift.toArray().join();
      const piece = pieces.get(key) ?? { shift, box: new Box3() };
      piece.box.union(restBox(mesh));
      pieces.set(key, piece);
    }
    assert.ok(pieces.size >= 6, `${pieces.size} independently moving pieces`);
    const centre = [...pieces.values()]
      .reduce((box, piece) => box.union(piece.box), new Box3())
      .getCenter(new Vector3());
    for (const { shift, box } of pieces.values()) {
      const radial = box.getCenter(new Vector3()).sub(centre);
      assert.ok(shift.length() > 0, 'internal pieces actually move');
      close(shift, radial.multiplyScalar(0.6), 'a modest common radial expansion', 1e-9);
    }
    assertDeepPiecesClear(meshes(detail));
    assertHemispheresClear();
  },
);

test('interlocking and enclosed regions move together instead of being rearranged', () => {
  const box = (size: number, x: number) => {
    const geometry = new BoxGeometry(size, size, size);
    geometry.boundsTree = new MeshBVH(geometry);
    const mesh = new Mesh(geometry);
    mesh.position.x = x;
    return mesh;
  };
  const outer = box(0.02, 0);
  const inner = box(0.005, 0);
  const crossing = box(0.02, 0.008);
  const separate = box(0.01, 0.05);
  const list = [outer, inner, crossing, separate];
  const shifts = deepShifts(list.map((mesh) => [mesh]));
  close(shifts.get(outer)!, shifts.get(inner)!, 'an enclosed region');
  close(shifts.get(outer)!, shifts.get(crossing)!, 'an interlocking region');
  assert.ok(shifts.get(outer)!.x < 0 && shifts.get(separate)!.x > 0, 'the pieces still expand');
  for (const mesh of list) {
    mesh.geometry.dispose();
    (mesh.material as import('three').Material).dispose();
  }
});

test('the brain’s left–right axis is the scan’s x turned as the head lay, and the frame turns x onto it', () => {
  const cortex = meshes(ATLAS);
  const side = (hemisphere: string) =>
    cortex.filter((mesh) => mesh.userData['hemisphere'] === hemisphere);
  const axis = leftRightAxis(side('left'), side('right'));
  // World y is superior and z posterior: the right hemisphere lies lower and further back.
  assert.ok(Math.abs(degrees(Math.atan2(-axis.y, axis.x)) - 2.61) < 0.05, 'roll');
  assert.ok(Math.abs(degrees(Math.atan2(axis.z, axis.x)) - 1.87) < 0.05, 'yaw');
  close(new Vector3(1, 0, 0).applyQuaternion(model.anatomicalFrame), axis, 'the frame', 1e-12);
});

test('each hemisphere slides whole along the brain’s own axis, only far enough to clear the internal anatomy', () => {
  explodeNow();
  const axis = new Vector3(1, 0, 0).applyQuaternion(model.anatomicalFrame);
  for (const side of ['left', 'right'] as const) {
    const halves = meshes(ATLAS).filter((mesh) => mesh.userData['hemisphere'] === side);
    const shift = drawnShift(halves[0]!);
    for (const mesh of halves)
      close(drawnShift(mesh), shift, `${side}: the hemisphere moves whole`);
    assert.ok(shift.clone().cross(axis).length() < 1e-12, `${side} moves along the axis`);
    assert.ok((side === 'left' ? -1 : 1) * shift.dot(axis) > 0, `${side} moves outward`);
  }
  assertHemispheresClear();
});

test('a structure is moved, never reshaped', () => {
  const mesh = meshes(ATLAS)[0]!;
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
  const mesh = meshes(ATLAS)[0]!;
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
  const mesh = meshes(ATLAS)[0]!;
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
  const mesh = meshes(ATLAS)[0]!;
  assert.equal(drawnShift(mesh).length(), 0);
  const settled = new Vector3().setFromMatrixPosition(model.settledMatrixWorld(mesh));
  model.stepExplode(Number.MAX_SAFE_INTEGER);
  close(settled, drawnShift(mesh), 'the settled place is where it arrives');
});

test('a cut, a region lookup and a pick still read the measured anatomy', () => {
  explodeNow();
  const mesh = meshes(ATLAS)[0]!;
  const rest = restBox(mesh);
  assert.ok(drawnShift(mesh).length() > 0.005, 'the cortical parcel moved outward');
  const source = solidSource(mesh);
  close(new Vector3().setFromMatrixPosition(source.matrixWorld), new Vector3(), 'its cut source');
  const dentate = 'learning:left:dentate';
  const anchor = model.anchorOf(dentate)!;
  assert.ok(restBox(meshOf(dentate)).containsPoint(rasToWorld(anchor)));
  assert.equal(regionAt(meshes(model.settings.detail), anchor), dentate);
  // Aim through a real surface vertex so the test does not assume a parcel contains its box centre.
  const vertex = new Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), 0);
  const normal = new Vector3().fromBufferAttribute(mesh.geometry.getAttribute('normal'), 0);
  const drawn = vertex.clone().applyMatrix4(mesh.matrixWorld);
  const ray = new Raycaster(drawn.clone().addScaledVector(normal, 0.01), normal.negate());
  const hit = model.nearestHit(ray, [mesh]);
  assert.ok(hit, 'the drawn cortical parcel is hit');
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

test('a cord loaded while exploded retains its connection to the brainstem', async () => {
  explodeNow();
  await model.ensureSpinalCord();
  for (const detail of model.manifest.detail_levels) {
    await model.setDetail(detail.id);
    assertHemispheresClear();
    const stem = meshes(detail.id).find(
      (mesh) =>
        labelOf(model.regions.get(mesh.userData['region_id'])!, 'en')!.group === 'Brainstem',
    )!;
    const cord = model.manifest.supplemental_layers!.flatMap((layer) => meshes(layer.id));
    assertDeepPiecesClear([...meshes(detail.id), ...cord]);
    for (const mesh of cord) {
      close(drawnShift(mesh), drawnShift(stem), 'the cord stays connected to the brainstem');
    }
  }
});
