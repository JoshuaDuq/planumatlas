import { expect, test, vi } from 'vitest';
import type { CoordinateSpaces } from '../types/index.ts';
import { createCoordinatePlacement } from './coordinates.ts';

function setup(landing: [number, number, number] | null, { cut = false, cutFails = false } = {}) {
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
    camera: { faceCut: vi.fn(() => (calls.push('face cut'), 'anterior' as const)) },
  };
  let settle!: () => void;
  const mapped = new Promise<void>((resolve) => (settle = resolve));
  let opened!: () => void;
  const prepared = new Promise<void>((resolve) => (opened = resolve));
  const failure = new Error('asset-fetch');
  const commands = {
    begin() {
      const mine = ++intent;
      return () => mine === intent;
    },
    cut: vi.fn(async (mode: string, current: () => boolean) => {
      calls.push(`cut ${mode}`);
      await prepared;
      if (cutFails) throw failure;
      engine.sections.active = true;
      return current();
    }),
    failIfCurrent: vi.fn((current: () => boolean, operation: string) => {
      if (current()) calls.push(`failed ${operation}`);
    }),
  };
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
    commands: commands as never,
    ui: {
      showAnatomy: () => void calls.push('anatomy'),
      showDetail: () => void calls.push('detail'),
      showView: (view: string) => void calls.push(`held ${view}`),
      sayLesionReplaced: () => void calls.push('replaced'),
      sayLesionRestored: () => void calls.push('restored'),
    },
  });
  const supersede = () => intent++;
  return { placement, lesion, engine, commands, calls, settle, opened, failure, supersede };
}

test('places it at the published radius, then brings the reader’s cut to its rounded centre and faces it', async () => {
  const { placement, lesion, engine, commands, calls, settle } = setup([-40.04, 20, 7], {
    cut: true,
  });
  const placing = placement.place([-42, 22, 6], 'unstated');
  settle();
  expect(await placing).toBe(true);
  expect(lesion.placeCoordinate).toHaveBeenCalledWith(
    { entered: [-42, 22, 6], space: 'unstated' },
    [-40.04, 20, 7],
    5,
  );
  expect(engine.sections.setCrosshair).toHaveBeenCalledWith([-40, 20, 7]);
  expect(commands.cut).not.toHaveBeenCalled();
  expect(calls).toEqual(['anatomy', 'place', 'crosshair', 'detail', 'face cut', 'held anterior']);
});

test('with no cut, a coronal cut opens through the centre and is faced once it is drawn', async () => {
  const { placement, engine, calls, settle, opened } = setup([-40, 20, 7]);
  const placing = placement.place([-42, 22, 6], 'unstated');
  settle();
  await vi.waitFor(() => expect(calls).toContain('cut coronal'));
  expect(engine.camera.faceCut).not.toHaveBeenCalled();
  opened();
  expect(await placing).toBe(true);
  expect(calls).toEqual([
    'anatomy',
    'place',
    'crosshair',
    'detail',
    'cut coronal',
    'face cut',
    'held anterior',
  ]);
});

test('a later command while the cut opens keeps its camera, and the coordinate stays placed', async () => {
  const { placement, calls, settle, opened, supersede } = setup([-40, 20, 7]);
  const placing = placement.place([-42, 22, 6], 'unstated');
  settle();
  await vi.waitFor(() => expect(calls).toContain('cut coronal'));
  supersede();
  opened();
  expect(await placing).toBe(true);
  expect(calls).toEqual(['anatomy', 'place', 'crosshair', 'detail', 'cut coronal']);
});

test('a cut that fails to open is said as the section’s failure, and the coordinate stays placed', async () => {
  const { placement, engine, commands, calls, settle, opened, failure } = setup([-40, 20, 7], {
    cutFails: true,
  });
  const placing = placement.place([-42, 22, 6], 'unstated');
  settle();
  opened();
  expect(await placing).toBe(true);
  expect(commands.failIfCurrent).toHaveBeenCalledWith(expect.any(Function), 'section', failure);
  expect(engine.camera.faceCut).not.toHaveBeenCalled();
  expect(calls).toEqual([
    'anatomy',
    'place',
    'crosshair',
    'detail',
    'cut coronal',
    'failed section',
  ]);
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
  const { placement, lesion, calls, settle } = setup([0, 0, 0], { cut: true });
  lesion.sphere = { centre: [10, 10, 10], radius: 5 };
  const placing = placement.place([-42, 22, 6], 'unstated');
  settle();
  await placing;
  expect(calls).toEqual([
    'anatomy',
    'place',
    'crosshair',
    'detail',
    'replaced',
    'face cut',
    'held anterior',
  ]);
});

test('a coordinate placed over another coordinate replaces no lesion', async () => {
  const { placement, lesion, calls, settle } = setup([0, 0, 0], { cut: true });
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
