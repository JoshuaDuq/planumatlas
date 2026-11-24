// Where the route landmarks' labels stand: beside their dots where that is clear, stood off along a leader where
// it is not, reduced to their number last, and never over each other, a dot, the chrome or a leader. And where
// names stand beside their dots or centred on them: on a clear side, else left out.
import { describe, expect, test } from 'vitest';
import type { Rect } from '../../lib/engine/api.ts';
import { leaderEnd, placeBeside, placeCentred, placeLabels } from './stage-labels.ts';

const bounds = { x: 0, y: 0, width: 800, height: 600 };
const full = { width: 120, height: 24 };
const number = { width: 24, height: 24 };

const meet = (a: Rect, b: Rect) =>
  Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) &&
  Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);

describe('placeLabels', () => {
  test('a lone label stands above right of its dot, touching it, with no leader', () => {
    const [placed] = placeLabels([{ point: { x: 400, y: 300 }, sizes: [full] }], bounds, []);
    expect(placed).toEqual({
      box: { x: 404, y: 280, width: 120, height: 24 },
      slot: 0,
      variant: 0,
      leader: false,
    });
  });

  test('a label takes the first clear side beside its dot, in a fixed order, before any leader', () => {
    const place = (chrome: Rect) =>
      placeLabels([{ point: { x: 400, y: 300 }, sizes: [full] }], bounds, [chrome])[0];
    // Chrome within 2 px of its place above right: it stands to the right.
    expect(place({ x: 420, y: 250, width: 100, height: 30 })).toEqual({
      box: { x: 406, y: 288, width: 120, height: 24 },
      slot: 1,
      variant: 0,
      leader: false,
    });
    // The whole right covered: above left.
    expect(place({ x: 400, y: 0, width: 400, height: 600 })).toEqual({
      box: { x: 276, y: 280, width: 120, height: 24 },
      slot: 3,
      variant: 0,
      leader: false,
    });
  });

  test('a point behind the camera has no place', () => {
    expect(placeLabels([{ point: null, sizes: [full] }], bounds, [])).toEqual([null]);
  });

  test('a label with no clear slot stands where it overlaps least, at its last size', () => {
    // Chrome under every slot: only the farthest place to the right reaches 4 px past it.
    const chrome = [{ x: 0, y: 0, width: 600, height: 600 }];
    const [placed] = placeLabels(
      [{ point: { x: 470, y: 300 }, sizes: [full, number] }],
      bounds,
      chrome,
    );
    expect(placed).toEqual({
      box: { x: 580, y: 288, width: 24, height: 24 },
      slot: 41,
      variant: 1,
      leader: true,
    });
  });

  test('crowded dots get labels that cover neither each other nor any dot', () => {
    // Six anchors within 20 px, as the basal ganglia's are on the whole route.
    const points = [
      { x: 400, y: 300 },
      { x: 410, y: 304 },
      { x: 404, y: 312 },
      { x: 416, y: 296 },
      { x: 396, y: 316 },
      { x: 412, y: 318 },
    ];
    const placed = placeLabels(
      points.map((point) => ({ point, sizes: [full, number] })),
      bounds,
      [],
    ).map((placement) => placement!);
    for (const [i, a] of placed.entries()) {
      for (const [j, b] of placed.entries())
        if (i < j) expect(meet(a.box, b.box), `${i}, ${j}`).toBe(false);
      for (const [j, point] of points.entries()) {
        if (i === j) continue;
        const dot = { x: point.x - 4, y: point.y - 4, width: 8, height: 8 };
        expect(meet(a.box, dot), `label ${i} over dot ${j}`).toBe(false);
      }
    }
    // Some had to stand off along a leader to fit.
    expect(placed.some((placement) => placement.leader)).toBe(true);
  });

  test('stands off the stage’s chrome and inside the bounds, along a leader', () => {
    const dock = { x: 380, y: 260, width: 200, height: 60 };
    const [placed] = placeLabels([{ point: { x: 790, y: 300 }, sizes: [full] }], bounds, [
      { ...dock, x: 600 },
      { ...dock },
    ]);
    expect(meet(placed!.box, dock)).toBe(false);
    expect(placed!.box.x + placed!.box.width).toBeLessThanOrEqual(800);
    expect(placed!.leader).toBe(true);
  });

  test('a label with no clear place drops to its number before it would overlap', () => {
    // Walls close on every side but a number’s width.
    const walls = [
      { x: 0, y: 0, width: 800, height: 270 },
      { x: 0, y: 330, width: 800, height: 270 },
      { x: 0, y: 270, width: 380, height: 60 },
      { x: 440, y: 270, width: 360, height: 60 },
    ];
    const [placed] = placeLabels(
      [{ point: { x: 410, y: 300 }, sizes: [full, number] }],
      bounds,
      walls,
    );
    expect(placed!.variant).toBe(1);
    for (const wall of walls) expect(meet(placed!.box, wall)).toBe(false);
  });

  test('no leader runs through another label, and no label is placed over a leader', () => {
    const points = [
      { x: 400, y: 300 },
      { x: 402, y: 302 },
      { x: 404, y: 304 },
      { x: 406, y: 306 },
    ];
    const placed = placeLabels(
      points.map((point) => ({ point, sizes: [full] })),
      bounds,
      [],
    ).map((placement) => placement!);
    const crossesBox = (
      from: { x: number; y: number },
      to: { x: number; y: number },
      box: Rect,
    ) => {
      // Sampled along the segment: fine enough for 24 px boxes.
      for (let t = 0; t <= 1; t += 0.01) {
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;
        if (x > box.x && x < box.x + box.width && y > box.y && y < box.y + box.height) return true;
      }
      return false;
    };
    for (const [i, a] of placed.entries()) {
      if (!a.leader) continue;
      const end = leaderEnd(points[i]!, a.box);
      for (const [j, b] of placed.entries()) {
        if (i !== j)
          expect(crossesBox(points[i]!, end, b.box), `leader ${i} through ${j}`).toBe(false);
      }
    }
    expect(placed.filter((placement) => placement.leader).length).toBeGreaterThan(1);
  });
});

describe('leaderEnd', () => {
  test('meets the box at its point nearest the dot', () => {
    const box = { x: 100, y: 100, width: 50, height: 20 };
    expect(leaderEnd({ x: 80, y: 110 }, box)).toEqual({ x: 100, y: 110 });
    expect(leaderEnd({ x: 200, y: 50 }, box)).toEqual({ x: 150, y: 100 });
  });
});

describe('placeBeside', () => {
  const size = { width: 100, height: 20 };
  const point = { x: 400, y: 300 };
  const onRight = { box: { x: 406, y: 290, width: 100, height: 20 }, side: 'right' };
  const onLeft = { box: { x: 294, y: 290, width: 100, height: 20 }, side: 'left' };

  test('a name stands 6 px to the right of its dot, level with it', () => {
    expect(placeBeside([{ point, size }], bounds, [])).toEqual([onRight]);
  });

  test('a point the camera cannot see has no name', () => {
    expect(placeBeside([{ point: null, size }], bounds, [])).toEqual([null]);
  });

  test('a name stands on its dot’s left where chrome is within 2 px of its place on the right', () => {
    const beside = (x: number) =>
      placeBeside([{ point, size }], bounds, [{ x, y: 280, width: 50, height: 40 }])[0];
    // On the right, the name ends at 506.
    expect(beside(507)).toEqual(onLeft);
    expect(beside(508)).toEqual(onRight);
  });

  test('a name stands on its dot’s left where the right would cross the stage’s edge', () => {
    const at = (x: number) => placeBeside([{ point: { x, y: 300 }, size }], bounds, [])[0];
    expect(at(694)).toEqual({ box: { x: 700, y: 290, width: 100, height: 20 }, side: 'right' });
    expect(at(695)).toEqual({ box: { x: 589, y: 290, width: 100, height: 20 }, side: 'left' });
  });

  test('a name covers no dot placed before it, and one whose dot an earlier name covers is left out', () => {
    // A dot 50 px to the right, where the first name's right-hand place would stand.
    const other = { x: 450, y: 300 };
    const besideOther = { box: { x: 456, y: 290, width: 100, height: 20 }, side: 'right' };
    // Listed first, the other is named; the name after it would cover its dot on the right, so it goes left.
    expect(
      placeBeside(
        [
          { point: other, size },
          { point, size },
        ],
        bounds,
        [],
      ),
    ).toEqual([besideOther, onLeft]);
    // Listed second, its dot is under the first name: it is left out, dot and all.
    expect(
      placeBeside(
        [
          { point, size },
          { point: other, size },
        ],
        bounds,
        [],
      ),
    ).toEqual([onRight, null]);
    // Too wide for either side, the other has no name, and a dot that is not drawn blocks nothing.
    const wide = { width: 900, height: 20 };
    expect(
      placeBeside(
        [
          { point: other, size: wide },
          { point, size },
        ],
        bounds,
        [],
      ),
    ).toEqual([null, onRight]);
  });

  test('a place off the stage or over chrome by less than a square pixel is rounding, not a collision', () => {
    // The right-hand box's far edge comes out a rounding error past these bounds.
    const at = { x: 474.62188063972786, y: 404.1419250668321 };
    const [placed] = placeBeside(
      [{ point: at, size: { width: 181, height: 24 } }],
      { x: 4, y: 4, width: 892, height: 592 },
      [],
    );
    expect(placed?.side).toBe('right');
  });

  test('of two names that would touch, the one listed first keeps the right and the other moves left', () => {
    // 18 px lower: the names would stand within 2 px of each other, and neither over the other's dot.
    const lower = { x: 405, y: 318 };
    expect(
      placeBeside(
        [
          { point, size },
          { point: lower, size },
        ],
        bounds,
        [],
      ),
    ).toEqual([onRight, { box: { x: 299, y: 308, width: 100, height: 20 }, side: 'left' }]);
    expect(
      placeBeside(
        [
          { point: lower, size },
          { point, size },
        ],
        bounds,
        [],
      ),
    ).toEqual([{ box: { x: 411, y: 308, width: 100, height: 20 }, side: 'right' }, onLeft]);
  });

  test('a name with its left under a name listed before it and its right off the stage is left out', () => {
    const narrow = { ...bounds, width: 600 };
    const edge = { x: 520, y: 300 };
    expect(
      placeBeside(
        [
          { point, size },
          { point: edge, size },
        ],
        narrow,
        [],
      ),
    ).toEqual([onRight, null]);
    // Listed first, it takes its left, and the other moves off it.
    expect(
      placeBeside(
        [
          { point: edge, size },
          { point, size },
        ],
        narrow,
        [],
      ),
    ).toEqual([{ box: { x: 414, y: 290, width: 100, height: 20 }, side: 'left' }, onLeft]);
  });

  test('a name keeps the side it stood on last while that is clear, and takes the other once it is not', () => {
    expect(placeBeside([{ point, size, side: 'left' }], bounds, [])).toEqual([onLeft]);
    const chrome = [{ x: 300, y: 280, width: 50, height: 40 }];
    expect(placeBeside([{ point, size, side: 'left' }], bounds, chrome)).toEqual([onRight]);
  });

  test('a name with neither side clear is left out, not moved off its dot’s level', () => {
    const chrome = [
      { x: 300, y: 280, width: 50, height: 40 },
      { x: 450, y: 280, width: 50, height: 40 },
    ];
    expect(placeBeside([{ point, size }], bounds, chrome)).toEqual([null]);
  });
});

describe('placeCentred', () => {
  const size = { width: 40, height: 20 };

  test('a name is centred on its point', () => {
    expect(placeCentred([{ point: { x: 400, y: 300 }, size }], bounds, [])).toEqual([
      { x: 380, y: 290, width: 40, height: 20 },
    ]);
  });

  test('a point the camera cannot see has no name', () => {
    expect(placeCentred([{ point: null, size }], bounds, [])).toEqual([null]);
  });

  test('of two names that would touch, the one listed first is kept and the other left out, not moved', () => {
    const placed = placeCentred(
      [
        { point: { x: 400, y: 300 }, size },
        { point: { x: 430, y: 305 }, size },
        // 42 px to the right: clear of the first by the 2 px gap.
        { point: { x: 442, y: 300 }, size },
      ],
      bounds,
      [],
    );
    expect(placed).toEqual([
      { x: 380, y: 290, width: 40, height: 20 },
      null,
      { x: 422, y: 290, width: 40, height: 20 },
    ]);
  });

  test('a name that would cross the bounds or cover the chrome is left out', () => {
    const dock = { x: 600, y: 500, width: 200, height: 100 };
    expect(
      placeCentred(
        [
          { point: { x: 10, y: 300 }, size },
          { point: { x: 650, y: 495 }, size },
          { point: { x: 650, y: 470 }, size },
        ],
        bounds,
        [dock],
      ),
    ).toEqual([null, null, { x: 630, y: 460, width: 40, height: 20 }]);
  });
});
