// The visual areas' names: one per area and hemisphere, keyed so, placed in the engine's order (larger
// areas first) so that a smaller area's name gives way to a larger one's.
import { expect, test } from 'vitest';
import { areaNameBoxes } from './area-names.ts';

const bounds = { x: 0, y: 0, width: 800, height: 600 };
const sizes = new Map([
  ['left:V1v', { width: 40, height: 20 }],
  ['right:V1v', { width: 40, height: 20 }],
  ['left:LO1', { width: 40, height: 20 }],
]);

test('the same area is named on each hemisphere, and the one listed first wins a crowded spot', () => {
  const boxes = areaNameBoxes(
    [
      { name: 'V1v', hemisphere: 'left', point: { x: 500, y: 300 } },
      { name: 'V1v', hemisphere: 'right', point: { x: 300, y: 300 } },
      // LO1 is smaller, so the engine lists it after V1v; 6 px from the left V1v, it gives way.
      { name: 'LO1', hemisphere: 'left', point: { x: 506, y: 300 } },
    ],
    sizes,
    bounds,
    [],
  );
  expect([...boxes]).toEqual([
    ['left:V1v', { x: 480, y: 290, width: 40, height: 20 }],
    ['right:V1v', { x: 280, y: 290, width: 40, height: 20 }],
  ]);
});

test('a name the stage never measured is an error', () => {
  expect(() =>
    areaNameBoxes(
      [{ name: 'FEF', hemisphere: 'left', point: { x: 500, y: 300 } }],
      sizes,
      bounds,
      [],
    ),
  ).toThrow('No name is drawn for the left FEF.');
});
