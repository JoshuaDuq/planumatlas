import { expect, test, vi } from 'vitest';
import type { CoordinateSpaces } from '../types/index.ts';
import { createCoordinatePlacement } from './coordinates.ts';

function setup(landing: [number, number, number] | null) {
  let intent = 0;
  const calls: string[] = [];
  const lesion = {
    sphere: null as { centre: [number, number, number]; radius: number } | null,
    coordinate: null as unknown,
    placeCoordinate: vi.fn((placed, [x, y, z]: number[], radius: number) => {
      calls.push('place');
      lesion.coordinate = placed;
      lesion.sphere = { centre: [Math.round(x! * 10) / 10, y!, z!], radius };
    }),
  };
  const engine = {
    sections: { setCrosshair: vi.fn(() => void calls.push('crosshair')) },
    camera: { focusPoint: vi.fn(() => void calls.push('focus')) },
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
      sayLesionReplaced: () => void calls.push('replaced'),
    },
  });
  return { placement, lesion, engine, calls, settle, supersede: () => intent++ };
}

test('places it at the published radius, then brings the cut and the camera to its rounded centre', async () => {
  const { placement, lesion, engine, calls, settle } = setup([-40.04, 20, 7]);
  const placing = placement.place([-42, 22, 6], 'unstated');
  settle();
  expect(await placing).toBe(true);
  expect(lesion.placeCoordinate).toHaveBeenCalledWith(
    { entered: [-42, 22, 6], space: 'unstated' },
    [-40.04, 20, 7],
    5,
  );
  expect(engine.sections.setCrosshair).toHaveBeenCalledWith([-40, 20, 7]);
  expect(engine.camera.focusPoint).toHaveBeenCalledWith([-40, 20, 7]);
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
