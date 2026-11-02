// Where the route landmarks' labels stand: beside their dots where that is clear, stood off along a leader where
// it is not, reduced to their number last, and never over each other, a dot, the chrome or a leader.
import { describe, expect, test } from 'vitest';
import type { Rect } from '../../lib/engine/api.ts';
import { leaderEnd, placeLabels } from './stage-labels.ts';

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

  test('a point behind the camera has no place', () => {
    expect(placeLabels([{ point: null, sizes: [full] }], bounds, [])).toEqual([null]);
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
