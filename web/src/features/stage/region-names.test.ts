// Which regions the stage names: those facing the reader the camera shows large enough, largest first,
// at most 24, smaller ones as the camera zooms in, the selection whenever it faces the reader (handoff F3),
// lobes under Lobes colour, cut faces at their own points, and when names are drawn at all.
import { describe, expect, test, vi } from 'vitest';
import manifest from '../../../test/fixtures/cdmd-manifest.json' with { type: 'json' };
import { lobeOf } from '../../lib/core/catalog/lobes.ts';
import type { CapAnchor, FacingPoint, Manifest, Region } from '../../lib/types/index.ts';
import {
  DOT_APART_PX,
  KEPT_SIZE_PX,
  MAX_NAMES,
  NAMED_SIZE_PX,
  chooseNames,
  cutCosine,
  namesDrawn,
} from './region-names.ts';
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
  const ids = new Map(drawn.map((entry) => [entry.id, entry]));
  const input: NameSources = {
    regions: new Map(drawn.map((entry) => [entry.id, entry])),
    drawn,
    scale: 1,
    selected: null,
    byLobe: false,
    faces: [],
    faceCosine: 0,
    bounds: BOUNDS,
    kept: [],
    words: ({ region: id, lobe }) => (id ? ids.get(id)!.label : `lobe ${lobe}`),
    // A quarter of each surface, a convex body's mean: the size `region` sets.
    facingArea: (asked) => asked.map((id) => ids.get(id)!.surface_area_mm2! / 4),
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
      on: 'r0',
      face: false,
      point: { x: 20 + 39 * 20, y: 20 },
      drawn: [39, 0, 0],
    });
    // One ray a name: the regions too small to name are never asked.
    expect(asked(facing)).toEqual(drawn.slice(0, MAX_NAMES).map(({ id }) => id));
  });

  test('a region is sized by how much of it is turned toward the reader, and one turned away is not asked', () => {
    const drawn = [region('toward', 30), region('sideways', 120), region('away', 120)];
    // All of `toward`'s small surface faces the reader square, too small at a quarter; a sliver of
    // `sideways`; none of `away`.
    const turned = { toward: (2 * 30) ** 2, sideways: 30, away: 0 } as Record<string, number>;
    const { input, facing } = sources(drawn, {
      facingArea: (asked) => asked.map((id) => turned[id]!),
    });
    expect(keys(chooseNames(input))).toEqual(['toward']);
    expect(asked(facing)).toEqual(['toward']);
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

  test('a name already shown is named again before larger new ones, until it shrinks below the kept size', () => {
    const drawn = Array.from({ length: 30 }, (_, at) => region(`r${at}`, 200 - at));
    // The six smallest were shown, as after a zoom in; the next choice keeps them.
    const shown = drawn.slice(24).map(({ id }) => ({ key: id, on: id, face: false, drawn: null }));
    const named = keys(chooseNames(sources(drawn, { kept: shown }).input));
    expect(named.slice(0, 6)).toEqual(shown.map(({ key }) => key));
    expect(named.slice(6)).toEqual(drawn.slice(0, MAX_NAMES - 6).map(({ id }) => id));
    // A region between the kept and the named sizes is named only while it is kept.
    const between = [region('large', 200), region('between', (KEPT_SIZE_PX + NAMED_SIZE_PX) / 2)];
    expect(keys(chooseNames(sources(between).input))).toEqual(['large']);
    const keptBetween = [{ key: 'between', on: 'between', face: false, drawn: null }];
    expect(keys(chooseNames(sources(between, { kept: keptBetween }).input))).toEqual([
      'between',
      'large',
    ]);
    // Below the kept size it is dropped, and turned away it is dropped whatever its size.
    const small = [region('large', 200), region('between', KEPT_SIZE_PX - 1)];
    expect(keys(chooseNames(sources(small, { kept: keptBetween }).input))).toEqual(['large']);
    expect(keys(chooseNames(sources(between, { kept: keptBetween }, ['between']).input))).toEqual([
      'large',
    ]);
  });

  test('a kept name still in sight stands where it is, asking no ray, and is found again once it is not', () => {
    const drawn = [region('large', 200), region('kept', 100)];
    const stands: [number, number, number] = [300, 200, 0];
    const kept = [{ key: 'kept', on: 'kept', face: false, drawn: stands }];
    const { input, facing } = sources(drawn, { kept });
    expect(chooseNames(input)).toEqual([
      {
        key: 'kept',
        region: 'kept',
        lobe: null,
        on: 'kept',
        face: false,
        point: { x: 300, y: 200 },
        drawn: stands,
      },
      expect.objectContaining({ key: 'large' }),
    ]);
    expect(asked(facing)).toEqual(['large']);
    // Out of sight where it stood, it is asked about again and named at the point found.
    const lost = sources(drawn, { kept: [{ ...kept[0]!, drawn: null }] });
    expect(chooseNames(lost.input)[0]).toMatchObject({ key: 'kept', point: { x: 40, y: 20 } });
    expect(asked(lost.facing)).toEqual(['kept', 'large']);
  });

  test('a name whose dot would stand on another’s is left out, the higher priority kept', () => {
    const drawn = [region('first', 200), region('near', 190), region('clear', 180)];
    const at: Record<string, [number, number]> = {
      first: [100, 100],
      near: [100 + DOT_APART_PX - 1, 100],
      clear: [100 + DOT_APART_PX, 100],
    };
    const { input } = sources(drawn, {
      facing: (ids) =>
        ids.map((id) => ({ x: at[id]![0], y: at[id]![1], drawn: [at[id]![0], at[id]![1], 0] })),
    });
    expect(keys(chooseNames(input))).toEqual(['first', 'clear']);
  });

  test('a name whose point is off the visible stage is left out', () => {
    const drawn = [region('a', 200), region('b', 190)];
    const { input } = sources(drawn, { bounds: { x: 0, y: 0, width: 30, height: 600 } });
    // `a` stands at x 20, `b` at x 40.
    expect(keys(chooseNames(input))).toEqual(['a']);
  });

  test('under Lobes colour each lobe is named once, at its largest facing region, and the selection as itself', () => {
    const published = (manifest as unknown as Manifest).regions;
    const drawn = published.filter(
      (entry) => entry.atlas === 'destrieux' && entry.kind === 'cortex',
    );
    const selected = drawn.find((entry) => entry.hemisphere === 'left')!.id;
    const { input, facing } = sources(drawn, { scale: 2, byLobe: true, selected });
    const named = chooseNames(input);
    expect(named[0]).toMatchObject({ key: selected, region: selected, lobe: null });
    const lobes = named.slice(1);
    expect(lobes.length).toBeGreaterThanOrEqual(6);
    for (const { key, region: id, lobe } of lobes) {
      expect(id).toBeNull();
      expect(key).toMatch(new RegExp(`^lobe:${lobe}:(left|right)$`));
    }
    // One side's name each: the two sides' lobes read the same.
    expect(new Set(lobes.map(({ lobe }) => lobe)).size).toBe(lobes.length);
    // A lobe asks only its largest regions on each side, not all 148 parcels.
    expect(asked(facing).length).toBeLessThanOrEqual(3 * 2 * lobes.length + 1);
    // The frontal lobe's name stands on its side's largest parcel.
    const name = named.find(({ lobe }) => lobe === 'Frontal')!;
    const side = name.key.split(':')[2];
    const frontal = drawn
      .filter((entry) => entry.hemisphere === side && lobeOf(entry) === 'Frontal')
      .sort((a, b) => b.surface_area_mm2! - a.surface_area_mm2!)[0]!;
    expect(name.drawn[0]).toBe(drawn.indexOf(frontal));
  });

  test('a name that reads the same as one already named is not drawn again; the kept or facing one is', () => {
    const twins = [
      region('frontal-left', 120, { label: 'Frontal' }),
      region('frontal-right', 110, { label: 'Frontal', hemisphere: 'right' }),
      region('other', 100),
    ];
    // The larger is named, its twin not.
    expect(keys(chooseNames(sources(twins).input))).toEqual(['frontal-left', 'other']);
    // A kept twin keeps the name, so it does not flip sides.
    const kept = [{ key: 'frontal-right', on: 'frontal-right', face: false, drawn: null }];
    expect(keys(chooseNames(sources(twins, { kept }).input))).toEqual(['frontal-right', 'other']);
    // Turned away, the larger leaves the name to its twin.
    expect(keys(chooseNames(sources(twins, {}, ['frontal-left']).input))).toEqual([
      'frontal-right',
      'other',
    ]);
  });

  test('a kept lobe stands on the region it stood on while that faces the reader', () => {
    const left = (manifest as unknown as Manifest).regions.filter(
      (entry) =>
        entry.atlas === 'destrieux' && entry.kind === 'cortex' && entry.hemisphere === 'left',
    );
    const frontal = left
      .filter((entry) => lobeOf(entry) === 'Frontal')
      .sort((a, b) => b.surface_area_mm2! - a.surface_area_mm2!);
    // Its dot stood on its fifth largest region, which only a kept name asks about.
    const on = frontal[4]!.id;
    const kept = [{ key: 'lobe:Frontal:left', on, face: false, drawn: null }];
    const lobe = (away: string[] = []) =>
      chooseNames(sources(left, { scale: 2, byLobe: true, kept }, away).input).find(
        ({ key }) => key === 'lobe:Frontal:left',
      )!;
    expect(lobe()).toMatchObject({ on, drawn: [left.indexOf(frontal[4]!), 0, 0] });
    // Turned away, the lobe stands on its largest region instead.
    expect(lobe([on]).on).toBe(frontal[0]!.id);
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
    expect(named.map(({ on, face }) => [on, face])).toEqual([
      ['cut', true],
      ['surface', false],
    ]);
  });

  test('a name kept on a cut face is kept there, not on its surface, and the reverse', () => {
    const drawn = [region('a', 100)];
    // The face is between the kept and the named sizes.
    const side = (KEPT_SIZE_PX + NAMED_SIZE_PX) / 2;
    const faces: CapAnchor[] = [{ region: 'a', point: [300, 200, 0], areaMm2: side ** 2 }];
    const where = (face: boolean) =>
      chooseNames(
        sources(drawn, { faces, faceCosine: 1, kept: [{ key: 'a', on: 'a', face, drawn: null }] })
          .input,
      )[0]!;
    expect(where(true)).toMatchObject({ face: true, point: { x: 300, y: 200 } });
    expect(where(false)).toMatchObject({ face: false, point: { x: 20, y: 20 } });
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
