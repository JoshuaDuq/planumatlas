// Which regions the stage names, and where: those a grid of rays shows large enough, largest first, at most
// 24, the selection wherever it shows (handoff F3), lobes under Lobes colour, cut faces as themselves and
// their structures first; each dot in the middle of the widest part of what shows, a kept name where it
// stands; the grid itself; and when names are drawn at all.
import { describe, expect, test, vi } from 'vitest';
import manifest from '../../../test/fixtures/cdmd-manifest.json' with { type: 'json' };
import { lobeOf } from '../../lib/core/catalog/lobes.ts';
import type { Manifest, Region, ScreenPoint, SeenPoint, Vec3 } from '../../lib/types/index.ts';
import {
  DOT_APART_PX,
  MAX_NAMES,
  chooseNames,
  namesDrawn,
  sightGrid,
  sightPoints,
} from './region-names.ts';
import type { Kept, NameSources, Sight } from './region-names.ts';

const region = (id: string, extra: Partial<Region> = {}): Region => ({
  id,
  label: id,
  hemisphere: 'left',
  kind: 'cortex',
  atlas: 'schaefer',
  ...extra,
});

/**
 * A stage of square cells from the origin, 10 px a side unless said, with nothing in sight until painted.
 * The fake's world is the screen: what shows at (x, y) is drawn at [x, y, 0].
 */
function stage(columns: number, rows: number, cell = 10) {
  const seen: (SeenPoint | null)[] = Array.from({ length: columns * rows }, () => null);
  const sight: Sight = { x: cell / 2, y: cell / 2, cell, columns, rows, seen };
  /** Shows `id` over `width` × `height` cells from the cell at (`column`, `row`). */
  const paint = (
    id: string,
    column: number,
    row: number,
    width: number,
    height: number,
    face = false,
  ) => {
    if (column + width > columns || row + height > rows) throw new Error(`${id} is off the stage`);
    for (let down = row; down < row + height; down++) {
      for (let across = column; across < column + width; across++) {
        const drawn: Vec3 = [across * cell + cell / 2, down * cell + cell / 2, 0];
        seen[down * columns + across] = { id, face, drawn };
      }
    }
  };
  return { sight, paint };
}

/** Every region drawn, the whole grid in bounds, and a ray between cells meeting what the cell it falls in shows. */
function sources(regions: Region[], sight: Sight, overrides: Partial<NameSources> = {}) {
  const byId = new Map(regions.map((entry) => [entry.id, entry]));
  const project = vi.fn((points: readonly Vec3[]) =>
    points.map(([x, y]): ScreenPoint | null => ({ x, y })),
  );
  const seenAt = vi.fn((points: readonly ScreenPoint[]) =>
    points.map(({ x, y }): SeenPoint | null => {
      const column = Math.floor(x / sight.cell);
      const shown = sight.seen[Math.floor(y / sight.cell) * sight.columns + column];
      return shown ? { ...shown, drawn: [x, y, 0] } : null;
    }),
  );
  const input: NameSources = {
    regions: byId,
    drawn: regions,
    sight,
    selected: null,
    selectedAt: null,
    byLobe: false,
    bounds: { x: 0, y: 0, width: sight.columns * sight.cell, height: sight.rows * sight.cell },
    kept: [],
    words: ({ region: id, lobe }) => (id ? byId.get(id)!.label : `lobe ${lobe}`),
    project,
    seenAt,
    ...overrides,
  };
  return { input, project, seenAt };
}

const keys = (named: { key: string }[]) => named.map(({ key }) => key);
const points = (named: { key: string; point: ScreenPoint }[]) =>
  named.map(({ key, point }) => [key, point]);
/** A name shown now, out of sight where it stood unless `drawn` says where it stands. */
const kept = (key: string, drawn: Vec3 | null = null, face = false): Kept => ({
  key,
  on: key,
  face,
  drawn,
});

describe('sightGrid', () => {
  test('tiles the stage with at most 2000 square cells, the first centred half a cell in', () => {
    // 2000 cells 20 px a side fill 1000 × 800 px exactly.
    const grid = sightGrid({ x: 100, y: 50, width: 1000, height: 800 });
    expect(grid).toEqual({ x: 110, y: 60, cell: 20, columns: 50, rows: 40 });
    const centres = sightPoints(grid);
    expect(centres).toHaveLength(2000);
    expect(centres.at(-1)).toEqual({ x: 1090, y: 840 });
    // A stage the cells do not divide leaves its last strip unasked, never asking more.
    expect(sightGrid({ x: 0, y: 0, width: 1200, height: 700 })).toMatchObject({
      columns: 58,
      rows: 34,
    });
  });

  test('asks no finer than 10 px on a small stage, and nothing of an empty one', () => {
    expect(sightGrid({ x: 20, y: 30, width: 95, height: 38 })).toEqual({
      x: 25,
      y: 35,
      cell: 10,
      columns: 9,
      rows: 3,
    });
    expect(sightPoints(sightGrid({ x: 20, y: 30, width: 0, height: 0 }))).toEqual([]);
  });
});

describe('sightPoints', () => {
  test('lists each cell’s centre row by row', () => {
    expect(sightPoints({ x: 110, y: 60, cell: 20, columns: 3, rows: 2 })).toEqual([
      { x: 110, y: 60 },
      { x: 130, y: 60 },
      { x: 150, y: 60 },
      { x: 110, y: 80 },
      { x: 130, y: 80 },
      { x: 150, y: 80 },
    ]);
  });
});

describe('chooseNames', () => {
  test('names a region once what shows of it would fill a 40 px square', () => {
    const shown = (width: number, height: number, cell?: number) => {
      const { sight, paint } = stage(6, 6, cell);
      paint('a', 1, 1, width, height);
      return keys(chooseNames(sources([region('a')], sight).input));
    };
    // 16 cells of 10 px are a 40 px square's worth; 15 fall short.
    expect(shown(4, 4)).toEqual(['a']);
    expect(shown(5, 3)).toEqual([]);
    // A larger stage's cells are larger: four of 20 px are as much.
    expect(shown(2, 2, 20)).toEqual(['a']);
    expect(shown(2, 2)).toEqual([]);
  });

  test('names the regions that pass the size threshold, largest first, at most 24', () => {
    // Bands four cells deep, the smallest at the top: `r4` to `r29` are 4 to 29 cells long, 26 that pass the
    // threshold; the first four are 3 long and fall short.
    const { sight, paint } = stage(30, 120);
    const drawn = Array.from({ length: 30 }, (_, at) => region(`r${at}`));
    drawn.forEach(({ id }, at) => paint(id, 0, 4 * at, at < 4 ? 3 : at, 4));
    const named = chooseNames(sources(drawn, sight).input);
    expect(keys(named)).toEqual(Array.from({ length: MAX_NAMES }, (_, at) => `r${29 - at}`));
    // `r29` shows over x 0–290, y 1160–1200.
    expect(named[0]).toEqual({
      key: 'r29',
      region: 'r29',
      lobe: null,
      on: 'r29',
      face: false,
      point: { x: 145, y: 1180 },
      drawn: [145, 1180, 0],
    });
  });

  test('regions showing as much are named in key order, whichever the grid meets first', () => {
    const { sight, paint } = stage(9, 4);
    paint('b', 0, 0, 4, 4);
    paint('a', 5, 0, 4, 4);
    expect(keys(chooseNames(sources([region('b'), region('a')], sight).input))).toEqual(['a', 'b']);
  });

  test('a region no cell shows is not named, though it is drawn, kept and selected', () => {
    const { sight, paint } = stage(5, 5);
    paint('front', 0, 0, 5, 5);
    const { input } = sources([region('front'), region('behind')], sight, {
      selected: 'behind',
      kept: [kept('behind', [5, 5, 0])],
    });
    expect(keys(chooseNames(input))).toEqual(['front']);
  });

  test('a surface names only a region drawn to be selected; a cut face names whatever it cuts', () => {
    const regions = [region('cortex'), region('deep', { kind: 'structure' })];
    const shown = (face: boolean) => {
      const { sight, paint } = stage(11, 5);
      paint('deep', 0, 0, 5, 5, face);
      paint('cortex', 6, 0, 5, 5);
      return chooseNames(sources(regions, sight, { drawn: [regions[0]!] }).input);
    };
    expect(keys(shown(false))).toEqual(['cortex']);
    expect(shown(true)).toEqual([
      {
        key: 'deep',
        region: 'deep',
        lobe: null,
        on: 'deep',
        face: true,
        point: { x: 25, y: 25 },
        drawn: [25, 25, 0],
      },
      expect.objectContaining({ key: 'cortex', face: false }),
    ]);
  });

  test('a structure a cut shows is named from an 18 px face, before larger regions and kept names', () => {
    // 24 gyri of 40 px on the surface fill the names; `deep` shows to the right of them.
    const gyri = Array.from({ length: MAX_NAMES }, (_, at) => region(`g${at}`));
    const shown = (
      width: number,
      height: number,
      { face = true, kind = 'structure' as Region['kind'], names = [] as Kept[] } = {},
    ) => {
      const { sight, paint } = stage(4 * MAX_NAMES + 3, 4);
      gyri.forEach(({ id }, at) => paint(id, 4 * at, 0, 4, 4));
      paint('deep', 4 * MAX_NAMES + 1, 0, width, height, face);
      const regions = [...gyri, region('deep', { kind })];
      return keys(chooseNames(sources(regions, sight, { kept: names }).input));
    };
    // Four cells of 10 px are a 20 px square's worth; three, 17 px, fall short.
    expect(shown(2, 2)).toEqual([
      'deep',
      ...gyri
        .map(({ id }) => id)
        .sort()
        .slice(0, -1),
    ]);
    expect(shown(1, 3)).not.toContain('deep');
    // Kept, it stays from two cells, before the kept gyri.
    expect(shown(1, 2, { names: [kept('g5'), kept('deep')] }).slice(0, 2)).toEqual(['deep', 'g5']);
    expect(shown(1, 1, { names: [kept('deep')] })).not.toContain('deep');
    // Its surface, or a gyrus on the face, waits its turn by size as anything else.
    expect(shown(2, 2, { face: false })).not.toContain('deep');
    expect(shown(2, 2, { kind: 'cortex' })).not.toContain('deep');
  });

  test('a region the anatomy does not hold throws', () => {
    const cut = stage(1, 1);
    cut.paint('ghost', 0, 0, 1, 1, true);
    expect(() => chooseNames(sources([], cut.sight).input)).toThrow('Unknown region: ghost');
    const surface = stage(1, 1);
    surface.paint('ghost', 0, 0, 1, 1);
    const { input } = sources([], surface.sight, { drawn: [region('ghost')] });
    expect(() => chooseNames(input)).toThrow('Unknown region: ghost');
  });

  test('the dot stands in the middle of the widest part of what shows, not of all of it', () => {
    // A 5 × 5 square with a tail ten cells long off its top row: the cells' mean lies at (46, 19).
    const tailed = stage(15, 5);
    tailed.paint('a', 0, 0, 5, 5);
    tailed.paint('a', 5, 0, 10, 1);
    const tail = sources([region('a')], tailed.sight);
    expect(points(chooseNames(tail.input))).toEqual([['a', { x: 25, y: 25 }]]);
    expect(tail.seenAt).not.toHaveBeenCalled();
    // An L: an arm two cells wide down to a foot of 7 × 5, over x 0–70, y 50–100.
    const bent = stage(7, 10);
    bent.paint('a', 0, 0, 2, 5);
    bent.paint('a', 0, 5, 7, 5);
    expect(points(chooseNames(sources([region('a')], bent.sight).input))).toEqual([
      ['a', { x: 35, y: 75 }],
    ]);
  });

  test('where the widest part is two cells across the dot stands between them, if a ray there meets the region', () => {
    // 5 × 4 cells over x 0–50, y 0–40: its middle is the line between the second and third rows.
    const { sight, paint } = stage(5, 4);
    paint('a', 0, 0, 5, 4);
    const regions = [region('a'), region('other')];
    const met = (seen: SeenPoint | null) => {
      const seenAt = vi.fn(() => [seen]);
      const named = chooseNames(sources(regions, sight, { seenAt }).input);
      expect(seenAt).toHaveBeenCalledExactlyOnceWith([{ x: 25, y: 20 }]);
      expect(keys(named)).toEqual(['a']);
      return named[0]!;
    };
    expect(met({ id: 'a', face: false, drawn: [1, 2, 3] })).toMatchObject({
      on: 'a',
      point: { x: 25, y: 20 },
      drawn: [1, 2, 3],
    });
    // A ray that meets nothing there, or another region, leaves the dot on one of the two middle cells.
    for (const miss of [null, { id: 'other', face: false, drawn: [1, 2, 3] as Vec3 }]) {
      const { on, point, drawn } = met(miss);
      expect(on).toBe('a');
      expect(point.x).toBe(25);
      expect([15, 25]).toContain(point.y);
      expect(drawn).toEqual([25, point.y, 0]);
    }
  });

  test('the selected region is named first wherever it shows, even below the threshold (handoff F3)', () => {
    const { sight, paint } = stage(8, 5);
    paint('large', 0, 0, 5, 5);
    paint('tiny', 7, 4, 1, 1);
    const regions = [region('large'), region('tiny')];
    expect(keys(chooseNames(sources(regions, sight).input))).toEqual(['large']);
    expect(points(chooseNames(sources(regions, sight, { selected: 'tiny' }).input))).toEqual([
      ['tiny', { x: 75, y: 45 }],
      ['large', { x: 25, y: 25 }],
    ]);
  });

  test('a selection no cell falls on is named where a ray at its own anchor meets it', () => {
    const { sight, paint } = stage(8, 5);
    paint('large', 0, 0, 5, 5);
    const regions = [region('large'), region('tiny')];
    const selectedAt = { x: 72, y: 38, id: 'tiny', face: true, drawn: [1, 2, 3] as Vec3 };
    const named = chooseNames(sources(regions, sight, { selected: 'tiny', selectedAt }).input);
    expect(named).toEqual([
      {
        key: 'tiny',
        region: 'tiny',
        lobe: null,
        on: 'tiny',
        face: true,
        point: { x: 72, y: 38 },
        drawn: [1, 2, 3],
      },
      expect.objectContaining({ key: 'large' }),
    ]);
    // A cell that shows it places it instead.
    paint('tiny', 7, 4, 1, 1);
    const shown = chooseNames(sources(regions, sight, { selected: 'tiny', selectedAt }).input);
    expect(shown[0]).toMatchObject({ key: 'tiny', face: false, point: { x: 75, y: 45 } });
  });

  test('a name already shown is named again before larger new ones, until it shrinks below 30 px', () => {
    const shown = (width: number, height: number, names: Kept[]) => {
      const { sight, paint } = stage(11, 6);
      paint('large', 0, 0, 6, 6);
      paint('small', 7, 0, width, height);
      const regions = [region('large'), region('small')];
      return keys(chooseNames(sources(regions, sight, { kept: names }).input));
    };
    expect(shown(4, 4, [])).toEqual(['large', 'small']);
    expect(shown(4, 4, [kept('small')])).toEqual(['small', 'large']);
    // Nine cells, a 30 px square's worth, name it only while it is kept; eight do not.
    expect(shown(3, 3, [])).toEqual(['large']);
    expect(shown(3, 3, [kept('small')])).toEqual(['small', 'large']);
    expect(shown(4, 2, [kept('small')])).toEqual(['large']);
  });

  test('a kept name still in sight stands where it is, asking no ray, and is placed afresh once it is not', () => {
    // The region's cut face shows down the first column, its surface over the rest.
    const { sight, paint } = stage(5, 4);
    paint('a', 0, 0, 5, 4);
    paint('a', 0, 0, 1, 4, true);
    const stands: Vec3 = [4, 12, 0];
    const held = sources([region('a')], sight, { kept: [kept('a', stands, true)] });
    expect(chooseNames(held.input)).toEqual([
      {
        key: 'a',
        region: 'a',
        lobe: null,
        on: 'a',
        face: true,
        point: { x: 4, y: 12 },
        drawn: stands,
      },
    ]);
    expect(held.project).toHaveBeenCalledExactlyOnceWith([stands]);
    expect(held.seenAt).not.toHaveBeenCalled();
    // Out of sight where it stood, it moves to the middle of what shows, on the surface.
    const lost = sources([region('a')], sight, { kept: [kept('a', null, true)] });
    expect(chooseNames(lost.input)).toEqual([
      expect.objectContaining({ face: false, point: { x: 25, y: 20 }, drawn: [25, 20, 0] }),
    ]);
    expect(lost.project).toHaveBeenCalledExactlyOnceWith([]);
  });

  test('kept names in and out of sight each stand at their own point', () => {
    const { sight, paint } = stage(17, 4);
    paint('long', 0, 0, 7, 3);
    paint('middle', 8, 0, 5, 3);
    paint('short', 14, 0, 3, 3);
    const regions = [region('short'), region('middle'), region('long')];
    const names = [kept('short', [145, 5, 0]), kept('middle'), kept('long', [5, 25, 0])];
    const { input, project } = sources(regions, sight, { kept: names });
    expect(points(chooseNames(input))).toEqual([
      ['long', { x: 5, y: 25 }],
      ['middle', { x: 105, y: 15 }],
      ['short', { x: 145, y: 5 }],
    ]);
    expect(project).toHaveBeenCalledExactlyOnceWith([
      [5, 25, 0],
      [145, 5, 0],
    ]);
  });

  test('a kept name left on the rim of a patch three cells deep moves back to its middle', () => {
    const where = (side: number, stands: Vec3) => {
      const { sight, paint } = stage(8, 5);
      paint('a', 0, 0, side, side);
      paint('b', 6, 0, 2, 5);
      const { input, seenAt } = sources([region('a'), region('b')], sight, {
        kept: [kept('a', stands)],
      });
      const named = chooseNames(input);
      expect(seenAt).not.toHaveBeenCalled();
      return points(named);
    };
    // On the 5 × 5 patch's first column; one cell in; and off the patch, over another region.
    expect(where(5, [6, 24, 0])).toEqual([['a', { x: 25, y: 25 }]]);
    expect(where(5, [14, 24, 0])).toEqual([['a', { x: 14, y: 24 }]]);
    expect(where(5, [66, 24, 0])).toEqual([['a', { x: 25, y: 25 }]]);
    // A 4 × 4 patch is two cells deep: its rim is never far from its middle.
    expect(where(4, [6, 24, 0])).toEqual([['a', { x: 6, y: 24 }]]);
  });

  test('a name that reads the same as one already named is not drawn again; the kept or shown one is', () => {
    const twins = [
      region('frontal-left', { label: 'Frontal' }),
      region('frontal-right', { label: 'Frontal', hemisphere: 'right' }),
      region('other'),
    ];
    const shown = (left: boolean, names: Kept[] = []) => {
      const { sight, paint } = stage(16, 5);
      if (left) paint('frontal-left', 0, 0, 5, 5);
      paint('frontal-right', 6, 0, 4, 4);
      paint('other', 11, 0, 5, 4);
      return keys(chooseNames(sources(twins, sight, { kept: names }).input));
    };
    // The larger is named, its twin not.
    expect(shown(true)).toEqual(['frontal-left', 'other']);
    // A kept twin keeps the name, so it does not flip sides.
    expect(shown(true, [kept('frontal-right')])).toEqual(['frontal-right', 'other']);
    // Out of sight, the larger leaves the name to its twin.
    expect(shown(false)).toEqual(['other', 'frontal-right']);
  });

  test('a name whose dot would stand on another’s is left out, the higher priority kept', () => {
    const { sight, paint } = stage(8, 5);
    paint('large', 0, 0, 5, 5);
    const regions = [region('large'), region('tiny')];
    // `large` stands at (25, 25); the selection, named first, at its own anchor beside it.
    const beside = (apart: number) => {
      const selectedAt = {
        x: 25 + apart,
        y: 25,
        id: 'tiny',
        face: false,
        drawn: [0, 0, 0] as Vec3,
      };
      return keys(chooseNames(sources(regions, sight, { selected: 'tiny', selectedAt }).input));
    };
    expect(beside(DOT_APART_PX - 1)).toEqual(['tiny']);
    expect(beside(DOT_APART_PX)).toEqual(['tiny', 'large']);
  });

  test('a name whose point is off the visible stage is left out, and a kept one held there placed afresh', () => {
    // Two strips 3 × 7 cells, two cells deep, so the rim rule moves neither.
    const { sight, paint } = stage(7, 7);
    paint('a', 0, 0, 3, 7);
    paint('b', 4, 0, 3, 7);
    const regions = [region('a'), region('b')];
    expect(points(chooseNames(sources(regions, sight).input))).toEqual([
      ['a', { x: 15, y: 35 }],
      ['b', { x: 55, y: 35 }],
    ]);
    const bounds = { x: 0, y: 0, width: 40, height: 70 };
    expect(keys(chooseNames(sources(regions, sight, { bounds }).input))).toEqual(['a']);
    // Held at x 200, beyond the 70 px stage; and where the camera no longer places it.
    const names = [kept('b', [200, 35, 0])];
    expect(points(chooseNames(sources(regions, sight, { kept: names }).input))).toEqual([
      ['b', { x: 55, y: 35 }],
      ['a', { x: 15, y: 35 }],
    ]);
    const project = () => [null];
    expect(points(chooseNames(sources(regions, sight, { kept: names, project }).input))).toEqual([
      ['b', { x: 55, y: 35 }],
      ['a', { x: 15, y: 35 }],
    ]);
  });

  describe('under Lobes colour', () => {
    const cortex = (manifest as unknown as Manifest).regions.filter(
      (entry) => entry.atlas === 'destrieux' && entry.kind === 'cortex',
    );
    const of = (lobe: string, hemisphere: string) =>
      cortex.filter((entry) => entry.hemisphere === hemisphere && lobeOf(entry) === lobe);
    const [wide, strip, edge] = of('Frontal', 'left') as [Region, Region, Region];
    const occipital = of('Occipital', 'left')[0]!;
    const right = of('Frontal', 'right')[0]!;
    /**
     * Three left frontal regions side by side over x 0–50, y 0–50, none large enough alone; a left
     * occipital one, larger; and a right frontal one, smaller.
     */
    const lobes = () => {
      const { sight, paint } = stage(17, 7);
      paint(wide.id, 0, 0, 3, 5);
      paint(strip.id, 3, 0, 1, 5);
      paint(edge.id, 4, 0, 1, 5);
      paint(occipital.id, 6, 0, 7, 5);
      paint(right.id, 14, 0, 3, 7);
      return sight;
    };

    test('the regions of a lobe that show are named once, as their lobe, and the selection as itself too', () => {
      expect(keys(chooseNames(sources(cortex, lobes()).input))).toEqual([occipital.id, right.id]);
      const { input } = sources(cortex, lobes(), { byLobe: true, selected: edge.id });
      // The two sides' frontal lobes read the same: the larger is written.
      expect(chooseNames(input)).toEqual([
        {
          key: edge.id,
          region: edge.id,
          lobe: null,
          on: edge.id,
          face: false,
          point: { x: 45, y: 25 },
          drawn: [45, 25, 0],
        },
        {
          key: 'lobe:Occipital:left',
          region: null,
          lobe: 'Occipital',
          on: occipital.id,
          face: false,
          point: { x: 95, y: 25 },
          drawn: [95, 25, 0],
        },
        {
          key: 'lobe:Frontal:left',
          region: null,
          lobe: 'Frontal',
          on: wide.id,
          face: false,
          point: { x: 25, y: 25 },
          drawn: [25, 25, 0],
        },
      ]);
    });

    test('each side’s lobe is its own name, and a kept one keeps it', () => {
      const names = [kept('lobe:Frontal:right')];
      const named = chooseNames(sources(cortex, lobes(), { byLobe: true, kept: names }).input);
      expect(keys(named)).toEqual(['lobe:Frontal:right', 'lobe:Occipital:left']);
      expect(named[0]).toMatchObject({ lobe: 'Frontal', on: right.id, point: { x: 155, y: 35 } });
    });

    test('a kept lobe stands on the region it stood on while that is in sight', () => {
      const stood = (drawn: Vec3 | null) => {
        const names = [{ key: 'lobe:Frontal:left', on: strip.id, face: false, drawn }];
        const named = chooseNames(sources(cortex, lobes(), { byLobe: true, kept: names }).input);
        expect(named[0]!.key).toBe('lobe:Frontal:left');
        return [named[0]!.on, named[0]!.point];
      };
      expect(stood([35, 15, 0])).toEqual([strip.id, { x: 35, y: 15 }]);
      expect(stood(null)).toEqual([wide.id, { x: 25, y: 25 }]);
    });

    test('a lobe’s dot between cells stands on whichever of its regions the ray there meets', () => {
      // Two regions of one lobe, two columns each: the middle of the four is the line between them.
      const { sight, paint } = stage(4, 4);
      paint(wide.id, 0, 0, 2, 4);
      paint(strip.id, 2, 0, 2, 4);
      const seenAt = vi.fn(() => [{ id: strip.id, face: false, drawn: [1, 2, 3] as Vec3 }]);
      const { input } = sources(cortex, sight, { byLobe: true, seenAt });
      expect(chooseNames(input)).toMatchObject([
        { key: 'lobe:Frontal:left', on: strip.id, point: { x: 20, y: 20 }, drawn: [1, 2, 3] },
      ]);
      expect(seenAt).toHaveBeenCalledExactlyOnceWith([{ x: 20, y: 20 }]);
    });

    test('a region of no lobe keeps its own name', () => {
      const { sight, paint } = stage(4, 4);
      paint('deep', 0, 0, 4, 4);
      const { input } = sources([region('deep', { kind: 'structure' })], sight, { byLobe: true });
      expect(chooseNames(input)).toMatchObject([{ key: 'deep', region: 'deep', lobe: null }]);
    });
  });
});

describe('namesDrawn', () => {
  const on = {
    namesShown: true,
    exploded: false,
    tractReference: false,
    lessonOpen: false,
    mapOpen: false,
    focused: false,
    painted: false,
    tracts: false,
  };
  test('draws the names only while the switch is on and no focused/mode overlay is directing attention', () => {
    expect(namesDrawn(on)).toBe(true);
    for (const key of [
      'exploded',
      'tractReference',
      'lessonOpen',
      'mapOpen',
      'focused',
      'painted',
      'tracts',
    ] as const) {
      expect(namesDrawn({ ...on, [key]: true }), key).toBe(false);
    }
    expect(namesDrawn({ ...on, namesShown: false })).toBe(false);
  });
});
