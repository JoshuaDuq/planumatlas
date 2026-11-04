import { expect, test, vi } from 'vitest';
import type { CoordinateSpaces } from '../types/index.ts';
import { createCoordinatePlacement } from './coordinates.ts';

function setup(landing: [number, number, number] | null, { cut = false } = {}) {
  let intent = 0;
  const calls: string[] = [];
  const lesion = {
    sphere: null as { centre: [number, number, number]; radius: number } | null,
    coordinate: null as unknown,
    replaced: null as unknown,
    // As the store keeps it: a lesion, not a coordinate, is what a coordinate replaces.
    placeCoordinate: vi.fn((placed, [x, y, z]: number[], radius: number) => {
      calls.push('place');
      lesion.replaced = lesion.sphere && !lesion.coordinate ? { sphere: lesion.sphere } : null;
      lesion.coordinate = placed;
      lesion.sphere = { centre: [Math.round(x! * 10) / 10, y!, z!], radius };
    }),
    restoreReplaced: vi.fn(() => void calls.push('restore')),
  };
  const engine = {
    sections: { setCrosshair: vi.fn(() => void calls.push('crosshair')), active: cut },
    camera: {
      focusPoint: vi.fn(() => void calls.push('focus')),
      faceCut: vi.fn(() => (calls.push('face cut'), 'anterior' as const)),
      applyView: vi.fn((view: string) => void calls.push(`view ${view}`)),
    },
  };
  let settle!: () => void;
  const mapped = new Promise<void>((resolve) => (settle = resolve));
  const placement = createCoordinatePlacement({
    coordinates: {
      metadata: { radius_mm: 5 } as CoordinateSpaces,
      map: async () => {
        await mapped;
        return landing;
      },
    },
    lesion: lesion as never,
    engine,
    commands: {
      begin() {
        const mine = ++intent;
        return () => mine === intent;
      },
    },
    ui: {
      showAnatomy: () => void calls.push('anatomy'),
      showDetail: () => void calls.push('detail'),
      showView: (view: string) => void calls.push(`held ${view}`),
      sayLesionReplaced: () => void calls.push('replaced'),
      sayLesionRestored: () => void calls.push('restored'),
    },
  });
  return { placement, lesion, engine, calls, settle, supersede: () => intent++ };
}

test('places it at the published radius, then brings the cut to its rounded centre and faces it', async () => {
  const { placement, lesion, engine, calls, settle } = setup([-40.04, 20, 7], { cut: true });
  const placing = placement.place([-42, 22, 6], 'unstated');
  settle();
  expect(await placing).toBe(true);
  expect(lesion.placeCoordinate).toHaveBeenCalledWith(
    { entered: [-42, 22, 6], space: 'unstated' },
    [-40.04, 20, 7],
    5,
  );
  expect(engine.sections.setCrosshair).toHaveBeenCalledWith([-40, 20, 7]);
  expect(calls).toEqual(['anatomy', 'place', 'crosshair', 'face cut', 'held anterior', 'detail']);
});

test('with no cut, the camera turns to the side of the brain the point lies in', async () => {
  for (const [x, side] of [
    [-40, 'left'],
    [40, 'right'],
  ] as const) {
    const { placement, calls, settle } = setup([x, 20, 7]);
    const placing = placement.place([x, 22, 6], 'unstated');
    settle();
    await placing;
    expect(calls).toEqual([
      'anatomy',
      'place',
      'crosshair',
      `held ${side}`,
      `view ${side}`,
      'detail',
    ]);
  }
});

test('with no cut, a sphere across the midline is focused from where the camera stands', async () => {
  const { placement, engine, calls, settle } = setup([-4, 20, 7]);
  const placing = placement.place([-4, 22, 6], 'unstated');
  settle();
  await placing;
  expect(engine.camera.focusPoint).toHaveBeenCalledWith([-4, 20, 7]);
  expect(calls).toEqual(['anatomy', 'place', 'crosshair', 'focus', 'detail']);
});

test('a coordinate beyond the template’s brain is refused and nothing moves', async () => {
  const { placement, calls, settle } = setup(null);
  const placing = placement.place([90, 0, 0], 'unstated');
  settle();
  expect(await placing).toBe(false);
  expect(calls).toEqual([]);
});

test('a later command while the field downloads takes over', async () => {
  const { placement, calls, settle, supersede } = setup([0, 0, 0]);
  const placing = placement.place([-42, 22, 6], 'unstated');
  supersede();
  settle();
  expect(await placing).toBe(true);
  expect(calls).toEqual([]);
});

test('a lesion the reader placed is said to be replaced, once the coordinate holds the sphere', async () => {
  const { placement, lesion, calls, settle } = setup([0, 0, 0]);
  lesion.sphere = { centre: [10, 10, 10], radius: 5 };
  const placing = placement.place([-42, 22, 6], 'unstated');
  settle();
  await placing;
  expect(calls).toEqual(['anatomy', 'place', 'crosshair', 'focus', 'detail', 'replaced']);
});

test('a coordinate placed over another coordinate replaces no lesion', async () => {
  const { placement, lesion, calls, settle } = setup([0, 0, 0]);
  lesion.sphere = { centre: [10, 10, 10], radius: 5 };
  lesion.coordinate = { entered: [1, 2, 3], space: 'unstated' };
  const placing = placement.place([-42, 22, 6], 'unstated');
  settle();
  await placing;
  expect(calls).not.toContain('replaced');
});

test('the replacement’s undo puts the lesion back, says so, and overtakes a placement still mapping', async () => {
  const { placement, calls, settle } = setup([0, 0, 0]);
  const placing = placement.place([-42, 22, 6], 'unstated');
  placement.undoReplacement();
  settle();
  await placing;
  expect(calls).toEqual(['restore', 'restored']);
});
