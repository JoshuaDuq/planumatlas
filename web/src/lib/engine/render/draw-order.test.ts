import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Mesh, MeshStandardMaterial, Plane, Raycaster, SphereGeometry, Vector3 } from 'three';
import type { RenderItem } from 'three';
import { TRANSLUCENT, drawDepthFirst, opaqueOrder, transparentOrder } from './draw-order.ts';
import type { Translucent } from './draw-order.ts';

let id = 0;
const item = (name: string, z: number, translucent?: Translucent, renderOrder = 0) =>
  ({
    id: id++,
    z,
    groupOrder: 0,
    renderOrder,
    object: { name, userData: { translucent } },
  }) as unknown as RenderItem;

const order = (...items: RenderItem[]) =>
  items.sort(transparentOrder).map((entry) => entry.object.name);

test('translucent surfaces keep three.js order, far to near, before any ghost', () => {
  assert.deepEqual(order(item('near', 1), item('far', 3), item('middle', 2)), [
    'far',
    'middle',
    'near',
  ]);
});

test('deep ghosts come after other translucent surfaces, nearest first; then the cortex depth, then the cortex far to near', () => {
  assert.deepEqual(
    order(
      item('cortex near', 1, TRANSLUCENT.cortex),
      item('cortex depth', 1, TRANSLUCENT.cortexDepth),
      item('deep far', 3, TRANSLUCENT.deepGhost),
      item('sphere', 2),
      item('cortex far', 3, TRANSLUCENT.cortex),
      item('deep near', 1, TRANSLUCENT.deepGhost),
      item('unfocused', 4, TRANSLUCENT.surface),
    ),
    ['unfocused', 'sphere', 'deep near', 'deep far', 'cortex depth', 'cortex far', 'cortex near'],
  );
});

test('a render order set on purpose still outranks the cortex', () => {
  assert.deepEqual(
    order(item('marking', 0, undefined, 1000), item('cortex', 1, TRANSLUCENT.cortex)),
    ['cortex', 'marking'],
  );
});

test('a translucent cortex draws its depth first, clipped as it is and never picked', () => {
  const planes = [new Plane(new Vector3(1, 0, 0), 0)];
  const mesh = new Mesh(
    new SphereGeometry(1),
    new MeshStandardMaterial({ clippingPlanes: planes }),
  );
  drawDepthFirst(mesh, true);
  const [twin] = mesh.children as Mesh<SphereGeometry, MeshStandardMaterial>[];
  assert.equal(twin!.geometry, mesh.geometry);
  assert.equal(twin!.userData['translucent'], TRANSLUCENT.cortexDepth);
  assert.deepEqual(
    [twin!.material.colorWrite, twin!.material.depthWrite, twin!.material.transparent],
    [false, true, true],
  );
  assert.equal(twin!.material.clippingPlanes, planes);
  const ray = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
  assert.deepEqual(
    ray.intersectObject(mesh).map((hit) => hit.object),
    [mesh],
  );

  // The cut follows; the same twin comes back once the cortex is opaque and see-through again.
  const cut = [new Plane(new Vector3(0, 1, 0), 0)];
  mesh.material.clippingPlanes = cut;
  drawDepthFirst(mesh, true);
  assert.equal(twin!.material.clippingPlanes, cut);
  drawDepthFirst(mesh, false);
  assert.equal(mesh.children.length, 0);
  drawDepthFirst(mesh, true);
  assert.deepEqual(mesh.children, [twin]);
});

const opaque = (name: string, material: number, cortical?: true, renderOrder = 0) =>
  ({
    id: id++,
    z: 0,
    groupOrder: 0,
    renderOrder,
    material: { id: material },
    materialVariant: 0,
    object: { name, userData: { cortical } },
  }) as unknown as RenderItem;

test('opaque surfaces keep three.js order, except that a cortical atlas comes first in its order', () => {
  const items = [
    opaque('marking', 0, undefined, 1000),
    opaque('tract', 9),
    opaque('cortex', 5, true),
    opaque('nucleus', 1),
  ];
  assert.deepEqual(
    items.sort(opaqueOrder).map((entry) => entry.object.name),
    ['cortex', 'nucleus', 'tract', 'marking'],
  );
});
