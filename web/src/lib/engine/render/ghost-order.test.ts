import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { RenderItem } from 'three';
import { GHOST, transparentOrder } from './ghost-order.ts';
import type { Ghost } from './ghost-order.ts';

let id = 0;
const item = (name: string, z: number, ghost?: Ghost, renderOrder = 0) =>
  ({
    id: id++,
    z,
    groupOrder: 0,
    renderOrder,
    object: { name, userData: { ghost } },
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

test('deep ghosts come after other translucent surfaces, nearest first; the cortex ghost last, far to near', () => {
  assert.deepEqual(
    order(
      item('cortex near', 1, GHOST.cortex),
      item('deep far', 3, GHOST.deep),
      item('sphere', 2),
      item('cortex far', 3, GHOST.cortex),
      item('deep near', 1, GHOST.deep),
      item('unfocused', 4, GHOST.none),
    ),
    ['unfocused', 'sphere', 'deep near', 'deep far', 'cortex far', 'cortex near'],
  );
});

test('a render order set on purpose still outranks a ghost', () => {
  assert.deepEqual(order(item('marking', 0, undefined, 1000), item('ghost', 1, GHOST.cortex)), [
    'ghost',
    'marking',
  ]);
});
