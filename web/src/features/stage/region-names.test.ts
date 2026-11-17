// Which regions the stage names: those facing the reader the camera shows large enough, largest first,
// at most 24, smaller ones as the camera zooms in, the selection whenever it faces the reader (handoff F3),
// lobes under Lobes colour, cut faces at their own points, and when names are drawn at all.
import { describe, expect, test, vi } from 'vitest';
import manifest from '../../../test/fixtures/cdmd-manifest.json' with { type: 'json' };
import { lobeOf } from '../../lib/core/catalog/lobes.ts';
import type { CapAnchor, FacingPoint, Manifest, Region } from '../../lib/types/index.ts';
import { MAX_NAMES, NAMED_SIZE_PX, chooseNames, cutCosine, namesDrawn } from './region-names.ts';
import type { NameSources } from './region-names.ts';

const BOUNDS = { x: 0, y: 0, width: 900, height: 600 };

/** A cortical region whose name would span `side` px at 1 px/mm: a quarter of its surface's square root. */
const region = (id: string, side: number, extra: Partial<Region> = {}): Region => ({
  id,
  label: id,
  hemisphere: 'left',
  kind: 'cortex',
  atlas: 'schaefer',
  surface_area_mm2: (2 * side) ** 2,
  ...extra,
});

/** Every region facing the reader at its own spot on the stage, unless `away` names it. */
function sources(drawn: Region[], overrides: Partial<NameSources> = {}, away: string[] = []) {
  const facing = vi.fn((ids: readonly string[]) =>
    ids.map((id): FacingPoint | null => {
      if (away.includes(id)) return null;
      const at = drawn.findIndex((candidate) => candidate.id === id);
      return { x: 20 + (at % 40) * 20, y: 20 + Math.floor(at / 40) * 20, drawn: [at, 0, 0] };
    }),
  );
  const project = vi.fn((points: readonly (readonly [number, number, number])[]) =>
    points.map(([x, y]) => ({ x, y })),
  );
  const input: NameSources = {
    regions: new Map(drawn.map((entry) => [entry.id, entry])),
    drawn,
    scale: 1,
    selected: null,
    byLobe: false,
    faces: [],
    faceCosine: 0,
    bounds: BOUNDS,
    facing,
    project,
    ...overrides,
  };
  return { input, facing, project };
}

const keys = (named: { key: string }[]) => named.map(({ key }) => key);
const asked = (facing: ReturnType<typeof sources>['facing']) =>
  facing.mock.calls.flatMap(([ids]) => [...ids]);

describe('chooseNames', () => {
  test('names the regions facing the reader that pass the size threshold, largest first, at most 24', () => {
    // 30 pass the threshold, 10 fall short of it.
    const drawn = Array.from({ length: 40 }, (_, at) =>
      region(`r${at}`, at < 30 ? NAMED_SIZE_PX + 100 - at : NAMED_SIZE_PX - 1 - at),
    );
    const { input, facing } = sources([...drawn].reverse());
    const named = chooseNames(input);
    expect(keys(named)).toEqual(drawn.slice(0, MAX_NAMES).map(({ id }) => id));
    expect(named[0]).toEqual({
      key: 'r0',
      region: 'r0',
      lobe: null,
      point: { x: 20 + 39 * 20, y: 20 },
      drawn: [39, 0, 0],
    });
    // One ray a name: the regions too small to name are never asked.
    expect(asked(facing)).toEqual(drawn.slice(0, MAX_NAMES).map(({ id }) => id));
  });

  test('zooming in names regions too small to name before', () => {
    const drawn = [region('large', 120), region('middle', 40), region('small', 30)];
    expect(keys(chooseNames(sources(drawn).input))).toEqual(['large']);
    expect(keys(chooseNames(sources(drawn, { scale: 1.3 }).input))).toEqual(['large', 'middle']);
    expect(keys(chooseNames(sources(drawn, { scale: 2 }).input))).toEqual([
      'large',
      'middle',
      'small',
    ]);
  });

  test('a region turned away gives its place to the next, asked in batches of the names still wanted', () => {
    const drawn = Array.from({ length: 30 }, (_, at) => region(`r${at}`, 200 - at));
    const away = ['r0', 'r3'];
    const { input, facing } = sources(drawn, {}, away);
    const named = chooseNames(input);
    expect(keys(named)).toEqual(
      drawn
        .map(({ id }) => id)
        .filter((id) => !away.includes(id))
        .slice(0, MAX_NAMES),
    );
    expect(facing.mock.calls.map(([ids]) => ids.length)).toEqual([MAX_NAMES, 2]);
  });

  test('the selected region is named first whenever it faces the reader, even below the threshold (handoff F3)', () => {
    const drawn = [region('large', 200), region('tiny', 2)];
    expect(keys(chooseNames(sources(drawn).input))).toEqual(['large']);
    expect(keys(chooseNames(sources(drawn, { selected: 'tiny' }).input))).toEqual([
      'tiny',
      'large',
    ]);
    // Turned away, it is not named.
    expect(keys(chooseNames(sources(drawn, { selected: 'tiny' }, ['tiny']).input))).toEqual([
      'large',
    ]);
  });

  test('a name whose point is off the visible stage is left out', () => {
    const drawn = [region('a', 200), region('b', 190)];
    const { input } = sources(drawn, { bounds: { x: 0, y: 0, width: 30, height: 600 } });
    // `a` stands at x 20, `b` at x 40.
    expect(keys(chooseNames(input))).toEqual(['a']);
  });

  test('under Lobes colour each side’s lobes are named, at their largest facing region, and the selection as itself', () => {
    const published = (manifest as unknown as Manifest).regions;
    const drawn = published.filter(
      (entry) => entry.atlas === 'destrieux' && entry.kind === 'cortex',
    );
    const selected = drawn.find((entry) => entry.hemisphere === 'left')!.id;
    const { input, facing } = sources(drawn, { scale: 2, byLobe: true, selected });
    const named = chooseNames(input);
    expect(named[0]).toMatchObject({ key: selected, region: selected, lobe: null });
    const lobes = named.slice(1);
    expect(lobes.length).toBeGreaterThan(8);
    for (const { key, region: id, lobe } of lobes) {
      expect(id).toBeNull();
      expect(key).toMatch(new RegExp(`^lobe:${lobe}:(left|right)$`));
    }
    expect(new Set(keys(lobes)).size).toBe(lobes.length);
    // A lobe asks only its largest regions, not all 148 parcels.
    expect(asked(facing).length).toBeLessThanOrEqual(3 * lobes.length + 1);
    // The frontal lobe's left name stands on its largest left parcel.
    const frontal = drawn
      .filter((entry) => entry.hemisphere === 'left' && lobeOf(entry) === 'Frontal')
      .sort((a, b) => b.surface_area_mm2! - a.surface_area_mm2!)[0]!;
    expect(named.find(({ key }) => key === 'lobe:Frontal:left')!.drawn[0]).toBe(
      drawn.indexOf(frontal),
    );
  });

  test('a lobe whose largest facing region is off the stage stands on its next largest', () => {
    const left = (manifest as unknown as Manifest).regions.filter(
      (entry) =>
        entry.atlas === 'destrieux' && entry.kind === 'cortex' && entry.hemisphere === 'left',
    );
    const frontal = left
      .filter((entry) => lobeOf(entry) === 'Frontal')
      .sort((a, b) => b.surface_area_mm2! - a.surface_area_mm2!);
    const others = left.filter((entry) => lobeOf(entry) !== 'Frontal');
    // The stage holds the first row of 40 points; the largest frontal parcel stands below it.
    const drawn = [...frontal.slice(1), ...others, frontal[0]!];
    expect(drawn.indexOf(frontal[0]!)).toBeGreaterThanOrEqual(40);
    const { input } = sources(drawn, {
      scale: 2,
      byLobe: true,
      bounds: { x: 0, y: 0, width: 900, height: 30 },
    });
    const lobe = chooseNames(input).find(({ key }) => key === 'lobe:Frontal:left')!;
    expect(lobe.drawn[0]).toBe(drawn.indexOf(frontal[1]!));
  });

  test('a cut face is named at its own point, sized by its area and how squarely it is seen, once with its surface', () => {
    const drawn = [region('cut', 100), region('surface', 90)];
    const faces: CapAnchor[] = [
      { region: 'cut', point: [100, 200, 0], areaMm2: 300 ** 2 },
      { region: 'surface', point: [300, 200, 0], areaMm2: 40 ** 2 },
    ];
    const { input } = sources(drawn, { faces, faceCosine: 1 });
    const named = chooseNames(input);
    // The cut face outranks its own surface, so the region is named once, on the face.
    expect(named.map(({ key, point }) => [key, point])).toEqual([
      ['cut', { x: 100, y: 200 }],
      ['surface', { x: 20 + 20, y: 20 }],
    ]);
    // Seen edge-on, the face is too small to name; its surface is named instead.
    const grazing = chooseNames(sources(drawn, { faces, faceCosine: 0.01 }).input);
    expect(grazing.find(({ key }) => key === 'cut')!.point).toEqual({ x: 20, y: 20 });
  });
});

describe('cutCosine', () => {
  test('is positive from the cut’s open side, negative from the side it keeps, and a reversed cut keeps the other', () => {
    // An axial cut seen from above; the world's y is superior.
    expect(cutCosine([0, 1, 0], [0, 0, 1], false)).toBeCloseTo(1);
    expect(cutCosine([0, 1, 0], [0, 0, 1], true)).toBeCloseTo(-1);
    // A coronal cut seen from the front; the world's z is posterior.
    expect(cutCosine([0, 0, -1], [0, 1, 0], false)).toBeCloseTo(1);
    expect(cutCosine([0, 0, 1], [0, 1, 0], false)).toBeCloseTo(-1);
    // A sagittal cut seen at 60° from its normal.
    expect(cutCosine([0.5, Math.sqrt(3) / 2, 0], [1, 0, 0], false)).toBeCloseTo(0.5);
  });
});

describe('namesDrawn', () => {
  const on = {
    namesShown: true,
    exploded: false,
    tractReference: false,
    routeShown: false,
    mapOpen: false,
  };
  test('draws the names only while the switch is on and the stage names nothing of its own', () => {
    expect(namesDrawn(on)).toBe(true);
    for (const key of ['exploded', 'tractReference', 'routeShown', 'mapOpen'] as const) {
      expect(namesDrawn({ ...on, [key]: true }), key).toBe(false);
    }
    expect(namesDrawn({ ...on, namesShown: false })).toBe(false);
  });
});
