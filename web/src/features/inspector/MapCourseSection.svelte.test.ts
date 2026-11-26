import { afterEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { t } from '../../lib/core/i18n/index.ts';
import type { MapCourse } from '../../lib/core/user-map/course.ts';
import type { MapSummary } from '../../lib/core/user-map/display.ts';
import { createFakeUserMap } from '../../lib/engine/fake/user-map.ts';
import { createUserMapStore } from '../../lib/state/user-map.svelte.ts';
import type { Region } from '../../lib/types/index.ts';
import MapCourseSection from './MapCourseSection.svelte';

const copy = t('en', 'overlay');
const summary: MapSummary = {
  shape: [97, 115, 97],
  voxelMm: [2, 2, 2],
  range: [-1, 4],
  binary: false,
  intent: 5,
  description: '',
  volumes: 4,
  secondsPerVolume: 2,
  cortexCovered: 1,
};
const courses: Record<string, MapCourse> = {
  v1: {
    means: Float32Array.of(0.5, 2.25, Number.NaN, -1),
    counts: Uint32Array.of(10, 10, 0, 9),
    points: 12,
  },
  silent: { means: Float32Array.of(NaN, NaN, NaN, NaN), counts: new Uint32Array(4), points: 3 },
};

afterEach(() => {
  cleanup();
});

/** A series read into `slot`; the section is handed both maps, as the region sheet hands them. */
async function shown(region: string, volumes = 4, slot = 0) {
  const engines = createFakeUserMap(true, undefined, (id) => courses[id] ?? null);
  const maps = createUserMapStore({ engine: engines, display: { color: 'atlas', setColor() {} } });
  const map = maps.maps[slot]!;
  const reading = map.open(new File([new Uint8Array(4)], 'fir.nii'));
  await expect.poll(() => engines.maps[slot]!.loading).toBe(true);
  engines.maps[slot]!.settle({ ...summary, volumes });
  await reading;
  map.setStatistic('z');
  await render(MapCourseSection, {
    region: { id: region } as Region,
    lang: 'en',
    maps,
    label: (id: string) => ({ name: id === 'v1' ? 'V1' : id }),
  });
  return map;
}

test('the plot is a slider over the volumes: it says each mean and draws the volume chosen', async () => {
  const map = await shown('v1');
  const plot = page.getByRole('slider', { name: copy.courseLabel('fir', 'V1') });
  await expect.element(plot).toHaveAttribute('aria-valuetext', '0 s: z 0.5');
  await expect
    .element(page.getByText(copy.courseCounts('10', '12'), { exact: true }))
    .toBeInTheDocument();
  await userEvent.click(plot);
  await userEvent.keyboard('{End}');
  expect(map.volume).toBe(3);
  await expect.element(plot).toHaveAttribute('aria-valuetext', '6 s: z −1');
  await userEvent.keyboard('{ArrowLeft}');
  expect(map.volume).toBe(2);
  await expect.element(plot).toHaveAttribute('aria-valuetext', `4 s: ${copy.courseNoValue}`);
});

test('a region without a solid, or where the map has no value, says so instead of a plot', async () => {
  await shown('thalamus');
  await expect.element(page.getByText(copy.courseNone)).toBeInTheDocument();
  cleanup();
  await shown('silent');
  await expect.element(page.getByText(copy.courseEmpty)).toBeInTheDocument();
  await expect.element(page.getByRole('slider')).not.toBeInTheDocument();
});

test('the same region handed in again, as each volume placed hands it, keeps its plot and is not read again', async () => {
  const engines = createFakeUserMap(true, undefined, (id) => courses[id] ?? null);
  const engine = engines.maps[0]!;
  let reads = 0;
  const course = engine.course;
  engine.course = (id) => (reads++, course(id));
  const maps = createUserMapStore({ engine: engines, display: { color: 'atlas', setColor() {} } });
  const map = maps.maps[0]!;
  const reading = map.open(new File([new Uint8Array(4)], 'fir.nii'));
  await expect.poll(() => engine.loading).toBe(true);
  engine.settle(summary);
  await reading;
  const label = (id: string) => ({ name: id });
  const view = await render(MapCourseSection, {
    region: { id: 'v1' } as Region,
    lang: 'en',
    maps,
    label,
  });
  const plot = page.getByRole('slider');
  await expect.element(plot).toBeInTheDocument();
  expect(reads).toBe(1);
  await view.rerender({ region: { id: 'v1' } as Region, lang: 'en', maps, label });
  await expect.element(plot).toBeInTheDocument();
  expect(reads).toBe(1);
});

test('a single map has no course', async () => {
  await shown('v1', 1);
  await expect.element(page.getByText(copy.course)).not.toBeInTheDocument();
});

test('FUNC-62 · a series read into the second slot has its course, read from that slot', async () => {
  const map = await shown('v1', 4, 1);
  const plot = page.getByRole('slider', { name: copy.courseLabel('fir', 'V1') });
  await expect.element(plot).toHaveAttribute('aria-valuetext', '0 s: z 0.5');
  await userEvent.click(plot);
  await userEvent.keyboard('{End}');
  expect(map.volume).toBe(3);
});
