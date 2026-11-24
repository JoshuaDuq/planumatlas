// Names in columns beside the anatomy: level with their dots where nothing crowds them, wrapped to their
// column, pushed apart in their dots' order where names crowd, moved to the other column where that keeps
// their leaders short and level, ended short of the chrome beside the anatomy or broken round it, and none
// where the anatomy leaves no room.
import { describe, expect, test } from 'vitest';
import type { Rect, Size } from '../../lib/engine/api.ts';
import {
  ANATOMY_GAP_PX,
  COMFORTABLE_COLUMN_PX,
  KEEP_COLUMN_PX,
  OPEN_COLUMN_PX,
  placeColumns as placeWithOpen,
  wrap,
} from './name-columns.ts';
import { calloutEnd } from './stage-labels.ts';
import type { ColumnPlacement, ColumnRequest } from './name-columns.ts';

const bounds = { x: 0, y: 0, width: 1000, height: 600 };
/** The places alone, or null where no column has room. */
const placeColumns = (...args: Parameters<typeof placeWithOpen>) =>
  placeWithOpen(...args)?.placed ?? null;
/** The anatomy in the middle, 284 px of room on either side once the gap is kept. */
const anatomy = { x: 300, y: 100, width: 400, height: 400 };
const fixed = { width: 120, height: 24 };

const name = (x: number, y: number, extra: Partial<ColumnRequest> = {}): ColumnRequest => ({
  point: { x, y },
  size: () => fixed,
  ...extra,
});
/** A name on one line 270 px wide where its column has the room, else on two lines as wide as the column. */
const filling = (width: number): Size =>
  width >= 270 ? { width: 270, height: 24 } : { width, height: 48 };
const middleOf = (box: Rect) => box.y + box.height / 2;
const meet = (a: Rect, b: Rect) =>
  Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) &&
  Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
const turn = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
/** Whether two names' leaders, from their dots to where they meet their names, cross. */
const leadersCross = (
  [a, placedA]: [ColumnRequest, ColumnPlacement],
  [b, placedB]: [ColumnRequest, ColumnPlacement],
) => {
  const [p, q] = [a.point!, calloutEnd(placedA.box, placedA.side)];
  const [r, s] = [b.point!, calloutEnd(placedB.box, placedB.side)];
  return turn(p, q, r) * turn(p, q, s) < 0 && turn(r, s, p) * turn(r, s, q) < 0;
};

describe('wrap', () => {
  test('breaks at spaces where the next word would pass the width, as the browser does', () => {
    const words = { widths: [50, 30, 40, 20], space: 5, line: 18 };
    expect(wrap(words, 1000)).toEqual({ width: 50 + 30 + 40 + 20 + 3 * 5, lines: 1 });
    expect(wrap(words, 90)).toEqual({ width: 85, lines: 2 });
    // A word wider than the width stands alone, wider.
    expect(wrap({ ...words, widths: [120, 10] }, 60)).toEqual({ width: 120, lines: 2 });
  });
});

describe('placeColumns', () => {
  test('a name stands in the column on its dot’s side, level with its dot, against the anatomy', () => {
    const [left, right] = placeColumns([name(350, 200), name(650, 400)], anatomy, bounds, [])!;
    expect(left).toEqual({
      side: 'left',
      box: { x: 300 - ANATOMY_GAP_PX - 120, y: 188, width: 120, height: 24 },
    });
    expect(right).toEqual({
      side: 'right',
      box: { x: 700 + ANATOMY_GAP_PX, y: 388, width: 120, height: 24 },
    });
    // Its leader meets it at the middle of its edge toward the anatomy.
    expect(calloutEnd(left!.box, 'left')).toEqual({ x: 300 - ANATOMY_GAP_PX, y: 200 });
  });

  test('a name is wrapped to its column’s width', () => {
    const asked: number[] = [];
    // Two lines once the room is under 200 px.
    const size = (width: number): Size => {
      asked.push(width);
      return width >= 200 ? { width: 200, height: 24 } : { width: 110, height: 48 };
    };
    const narrow = { ...anatomy, x: 150, width: 550 };
    const [placed] = placeColumns([name(200, 300, { size })], narrow, bounds, [])!;
    expect(asked).toContain(150 - ANATOMY_GAP_PX);
    expect(placed!.box).toMatchObject({ width: 110, height: 48 });
  });

  test('crowded names are pushed apart in their dots’ order, centred on their dots, inside the stage', () => {
    // Five dots within 8 px of each other, given in no order.
    const ys = [304, 300, 308, 296, 302];
    const placed = placeColumns(
      ys.map((y) => name(400, y)),
      anatomy,
      bounds,
      [],
    )!.map((entry) => entry!.box);
    const byDot = ys.map((y, index) => ({ y, box: placed[index]! })).sort((a, b) => a.y - b.y);
    for (let at = 1; at < byDot.length; at++) {
      expect(byDot[at]!.box.y).toBeGreaterThanOrEqual(byDot[at - 1]!.box.y + 24);
    }
    const mean = placed.reduce((sum, box) => sum + middleOf(box), 0) / placed.length;
    expect(mean).toBeCloseTo(ys.reduce((sum, y) => sum + y, 0) / ys.length, 5);
    // Crowded at the stage's foot, they stay on it.
    const low = placeColumns(
      ys.map((y) => name(400, y + 290)),
      anatomy,
      bounds,
      [],
    )!.map((entry) => entry!.box);
    expect(Math.max(...low.map((box) => box.y + box.height))).toBeLessThanOrEqual(600);
  });

  test('names keep their dots’ order down a column that chrome splits, overflowing in order', () => {
    // Chrome leaves the left column a strip for two names, then the stage below a box; eight dots crowd the strip.
    const chrome = [
      { x: 0, y: 0, width: 250, height: 130 },
      { x: 0, y: 200, width: 250, height: 40 },
    ];
    const ys = [150, 154, 158, 162, 166, 170, 174, 178];
    const narrow = { ...anatomy, x: 300, width: 690 };
    const placed = placeColumns(
      ys.map((y) => name(320, y)),
      narrow,
      bounds,
      chrome,
    )!;
    expect(placed.every(Boolean)).toBe(true);
    const tops = placed.map((entry) => entry!.box.y);
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    expect(tops.filter((top) => top < 200)).toHaveLength(2);
    for (const entry of placed) for (const box of chrome) expect(meet(entry!.box, box)).toBe(false);
  });

  test('two neighbours whose leaders would cross change places', () => {
    // No right column; chrome holds the left column's names below both dots.
    const narrow = { ...anatomy, width: 690 };
    const chrome = [{ x: 0, y: 0, width: 300, height: 304 }];
    const requests = [name(480, 280), name(300, 300)];
    const placed = placeColumns(requests, narrow, bounds, chrome)!;
    // The higher dot, far across, has its name below the nearer one's.
    expect(placed[1]!.box.y).toBeLessThan(placed[0]!.box.y);
    expect(leadersCross([requests[0]!, placed[0]!], [requests[1]!, placed[1]!])).toBe(false);
  });

  test('a leader is steered clear of a dot level with its own that it would pass over', () => {
    // Three dots on one level, far from the only column with room: with their names side by side, in any
    // order, a farther name's leader would run within 5 px of the dot before it.
    const wide = { x: 100, y: 100, width: 600, height: 400 };
    const requests = [name(500, 300), name(440, 300), name(380, 300)];
    const placed = placeColumns(requests, wide, bounds, [])!;
    expect(placed.map((entry) => entry?.side)).toEqual(['right', 'right', 'right']);
    const leaders = requests.map((request, index) => ({
      dot: request.point!,
      end: calloutEnd(placed[index]!.box, 'right'),
    }));
    /** How far a dot is from a leader, measured down the stage where the leader passes it. */
    const clearance = (dot: { x: number; y: number }, leader: (typeof leaders)[number]) => {
      const along = (dot.x - leader.dot.x) / (leader.end.x - leader.dot.x);
      return Math.abs(leader.dot.y + along * (leader.end.y - leader.dot.y) - dot.y);
    };
    // The farthest dot's leader passes both nearer dots, the middle one's the nearest.
    expect(clearance(leaders[0]!.dot, leaders[2]!)).toBeGreaterThanOrEqual(9);
    expect(clearance(leaders[1]!.dot, leaders[2]!)).toBeGreaterThanOrEqual(9);
    expect(clearance(leaders[0]!.dot, leaders[1]!)).toBeGreaterThanOrEqual(9);
    for (const [a, b] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ] as const) {
      expect(meet(placed[a]!.box, placed[b]!.box)).toBe(false);
      expect(leadersCross([requests[a]!, placed[a]!], [requests[b]!, placed[b]!])).toBe(false);
    }
  });

  test('a name moves to the other column where its own would push it far off its dot’s level', () => {
    // The right column is blocked down to 300 px; a dot just right of the middle at 120 px goes left.
    const chrome = [{ x: 700, y: 0, width: 300, height: 300 }];
    const [placed] = placeColumns([name(520, 120)], anatomy, bounds, chrome)!;
    expect(placed!.side).toBe('left');
    expect(middleOf(placed!.box)).toBe(120);
    // Unblocked, it stays on its own side.
    expect(placeColumns([name(520, 120)], anatomy, bounds, [])![0]!.side).toBe('right');
  });

  test('while the stage moves, a name keeps its column though the other would now suit it better', () => {
    // As in the test above, the left suits a dot at (520, 120) once the right is blocked; it stood right.
    const chrome = [{ x: 700, y: 0, width: 300, height: 300 }];
    const stood = name(520, 120, { side: 'right' });
    expect(placeColumns([stood], anatomy, bounds, chrome)![0]!.side).toBe('left');
    expect(placeColumns([stood], anatomy, bounds, chrome, [], true)![0]!.side).toBe('right');
  });

  test('a full column leaves out its lowest-priority names', () => {
    // Room for three names in each column, above chrome across both.
    const chrome = [
      { x: 0, y: 80, width: 300, height: 520 },
      { x: 700, y: 80, width: 300, height: 520 },
    ];
    const placed = placeColumns(
      Array.from({ length: 8 }, (_, at) => name(500, 10 + at * 5)),
      anatomy,
      bounds,
      chrome,
    )!;
    expect(placed.map((entry) => entry !== null)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  test('a name never stands in the gutter between chrome and the stage’s edge', () => {
    // A scale bar 32 px over the stage's foot: its strip would hold the name, level with the dot below it.
    const scale = { x: 760, y: 550, width: 230, height: 18 };
    const [placed] = placeColumns([name(650, 590)], anatomy, bounds, [scale])!;
    expect(placed!.side).toBe('right');
    expect(placed!.box.y + placed!.box.height).toBeLessThanOrEqual(scale.y);
    // Chrome standing well off the edge leaves room under it.
    const high = { ...scale, y: 480 };
    const [under] = placeColumns([name(650, 570)], anatomy, bounds, [high])!;
    expect(middleOf(under!.box)).toBe(570);
  });

  test('a chrome box blocks only names wide enough to reach it', () => {
    // A key in the right column, level with the dot, too near the anatomy for the column to end short of it.
    const key = { x: 840, y: 150, width: 100, height: 100 };
    const [narrow] = placeColumns([name(650, 200)], anatomy, bounds, [key])!;
    expect(middleOf(narrow!.box)).toBe(200);
    const wide = { width: 250, height: 24 };
    const [pushed] = placeColumns([name(650, 200, { size: () => wide })], anatomy, bounds, [key])!;
    expect(meet(pushed!.box, key)).toBe(false);
    expect(middleOf(pushed!.box)).not.toBe(200);
  });

  test('a column ends short of chrome at the stage’s edge beside the anatomy, and its names wrap to it', () => {
    // Orientation letters at both edges, level with the anatomy's middle and with two dots on each side.
    const letters = [
      { x: 4, y: 288, width: 24, height: 24 },
      { x: 972, y: 288, width: 24, height: 24 },
    ];
    const size = filling;
    const placed = placeColumns(
      [
        name(400, 296, { size }),
        name(360, 304, { size }),
        name(600, 296, { size }),
        name(640, 304, { size }),
      ],
      anatomy,
      bounds,
      letters,
    );
    // Each column 2 px clear of its letter, its two names together rather than above and below the letter.
    expect(placed).toEqual([
      { side: 'left', box: { x: 30, y: 251, width: 254, height: 48 } },
      { side: 'left', box: { x: 30, y: 301, width: 254, height: 48 } },
      { side: 'right', box: { x: 716, y: 251, width: 254, height: 48 } },
      { side: 'right', box: { x: 716, y: 301, width: 254, height: 48 } },
    ]);
  });

  test('chrome that leaves less than a comfortable column short of it takes rows out of the column instead', () => {
    const requests = [name(600, 296, { size: filling }), name(640, 304, { size: filling })];
    const box = (x: number) => [{ x, y: 288, width: 24, height: 24 }];
    // A comfortable column and the 2 px kept clear of the box: the names wrap to it, together.
    const comfortable = 700 + ANATOMY_GAP_PX + COMFORTABLE_COLUMN_PX + 2;
    expect(placeColumns(requests, anatomy, bounds, box(comfortable))).toEqual([
      { side: 'right', box: { x: 716, y: 251, width: COMFORTABLE_COLUMN_PX, height: 48 } },
      { side: 'right', box: { x: 716, y: 301, width: COMFORTABLE_COLUMN_PX, height: 48 } },
    ]);
    // A pixel nearer, the column keeps its whole width: the names, on one line, stand above and below the box.
    expect(placeColumns(requests, anatomy, bounds, box(comfortable - 1))).toEqual([
      { side: 'right', box: { x: 716, y: 262, width: 270, height: 24 } },
      { side: 'right', box: { x: 716, y: 314, width: 270, height: 24 } },
    ]);
  });

  test('of two boxes a column could end short of, it ends at the nearer, whichever is listed first', () => {
    const letter = { x: 972, y: 288, width: 24, height: 24 };
    const key = { x: 900, y: 120, width: 100, height: 60 };
    for (const chrome of [
      [letter, key],
      [key, letter],
    ]) {
      expect(placeColumns([name(650, 400, { size: filling })], anatomy, bounds, chrome)).toEqual([
        { side: 'right', box: { x: 716, y: 376, width: 182, height: 48 } },
      ]);
    }
  });

  test('chrome along half the anatomy’s height closes its column, however little room it leaves', () => {
    // An open menu 64 px off the anatomy's right; dots beside it, under it and, for the selection, over it.
    const menu = { x: 780, y: 200, width: 220, height: 200 };
    const requests = [name(520, 300), name(650, 480), name(650, 150, { always: true })];
    expect(placeWithOpen(requests, anatomy, bounds, [menu])).toEqual({
      placed: [
        { side: 'left', box: { x: 164, y: 288, width: 120, height: 24 } },
        null,
        { side: 'left', box: { x: 164, y: 138, width: 120, height: 24 } },
      ],
      open: ['left'],
    });
    // A pixel short of half, it only takes its rows: the column stays open over and under it.
    expect(placeWithOpen(requests, anatomy, bounds, [{ ...menu, height: 199 }])).toEqual({
      placed: [
        { side: 'left', box: { x: 164, y: 288, width: 120, height: 24 } },
        { side: 'right', box: { x: 716, y: 468, width: 120, height: 24 } },
        { side: 'right', box: { x: 716, y: 138, width: 120, height: 24 } },
      ],
      open: ['left', 'right'],
    });
  });

  test('chrome above or below the anatomy does not narrow the column beside it', () => {
    // Boxes at the stage's right edge, one ending where the anatomy begins, one beginning where it ends.
    const chrome = [
      { x: 900, y: 40, width: 100, height: 60 },
      { x: 900, y: 500, width: 100, height: 60 },
    ];
    expect(placeColumns([name(650, 300, { size: filling })], anatomy, bounds, chrome)).toEqual([
      { side: 'right', box: { x: 716, y: 288, width: 270, height: 24 } },
    ]);
  });

  test('a dot just past the middle keeps the column it stood in; well past it, it changes', () => {
    const side = (request: ColumnRequest) => placeColumns([request], anatomy, bounds, [])![0]!.side;
    expect(side(name(520, 300))).toBe('right');
    expect(side(name(520, 300, { side: 'left' }))).toBe('left');
    expect(side(name(600, 300, { side: 'left' }))).toBe('right');
  });

  test('a column opens at one room and closes at a smaller one, so names do not flicker at the edge', () => {
    // Room for a column between the two thresholds: closed unless it was open.
    const between = (KEEP_COLUMN_PX + OPEN_COLUMN_PX) / 2;
    const edge = {
      x: ANATOMY_GAP_PX + between,
      y: 100,
      width: 1000 - 2 * (ANATOMY_GAP_PX + between),
      height: 400,
    };
    const short = name(edge.x + 10, 300, { size: () => ({ width: 60, height: 24 }) });
    expect(placeWithOpen([short], edge, bounds, [])).toBeNull();
    const kept = placeWithOpen([short], edge, bounds, [], ['left', 'right'])!;
    expect(kept.open).toEqual(['left', 'right']);
    expect(kept.placed[0]!.side).toBe('left');
    // Below the smaller room, it closes even if it was open.
    const tight = {
      ...edge,
      x: ANATOMY_GAP_PX + KEEP_COLUMN_PX - 1,
      width: 1000 - 2 * (ANATOMY_GAP_PX + KEEP_COLUMN_PX - 1),
    };
    expect(
      placeWithOpen(
        [{ ...short, point: { x: tight.x + 10, y: 300 } }],
        tight,
        bounds,
        [],
        ['left', 'right'],
      ),
    ).toBeNull();
  });

  test('a name crosses to the far column only where its own has no room and its leader reaches', () => {
    // No room on the left: a dot left of the middle is named on the right, one at the far left is left
    // out, unless it is the selection.
    const flush = { ...anatomy, x: ANATOMY_GAP_PX + OPEN_COLUMN_PX - 1 };
    const sides = (requests: ColumnRequest[]) =>
      placeColumns(requests, flush, bounds, [])!.map((entry) => entry?.side ?? null);
    expect(
      sides([name(flush.x + 180, 300), name(flush.x + 10, 350), name(flush.x + 390, 400)]),
    ).toEqual(['right', null, 'right']);
    expect(sides([name(flush.x + 10, 350, { always: true })])).toEqual(['right']);
    // Wider than either column, nor with a dot: no place.
    const wide = { width: 301, height: 24 };
    expect(
      placeColumns(
        [name(350, 300, { size: () => wide }), { point: null, size: () => fixed }],
        anatomy,
        bounds,
        [],
      ),
    ).toEqual([null, null]);
    // The anatomy fills the stage: no column at all, the names stand beside their dots.
    expect(placeColumns([name(500, 300)], bounds, bounds, [])).toBeNull();
  });
});
