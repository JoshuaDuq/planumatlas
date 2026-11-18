// Names on the brain over the fake engine in a real browser: the same camera names the same regions in the
// same places, no name covers the stage's chrome, each name selects its region, the selection is named
// whenever it faces the reader (handoff F3), lobes are drawn only, and a change is named once it rests.
// With room beside the anatomy the names stand in columns there; a turn keeps the names still in sight,
// and a name whose point leaves sight, or whose cut closes, fades at once rather than at the rest.
import { afterEach, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import type { ComponentProps } from 'svelte';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../test/fixtures/cdmd-manifest.json' with { type: 'json' };
import { lobeRows } from '../../lib/core/catalog/lobes.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import '../../styles/index.css';
import RegionNames from './RegionNames.svelte';

type Props = ComponentProps<typeof RegionNames>;

afterEach(async () => {
  vi.useRealTimers();
  cleanup();
  await page.viewport(1280, 800);
});

const engineOf = ({ width, height } = { width: 900, height: 600 }) =>
  createFakeEngine({
    manifest: manifest as unknown as Manifest,
    hostSize: { width, height },
  });

/** The stage the names stand on: 900 × 600 at the page's corner, on the scene's ground, with any chrome. */
function host(
  chrome: { className: string; box: DOMRect }[] = [],
  { width = 900, height = 600 } = {},
) {
  const stage = document.body.appendChild(document.createElement('main'));
  stage.style.cssText = `position: absolute; left: 0; top: 0; width: ${width}px; height: ${height}px; background: var(--scene-background);`;
  for (const { className, box } of chrome) {
    const node = stage.appendChild(document.createElement('div'));
    node.className = className;
    node.style.cssText = `position: absolute; left: ${box.left}px; top: ${box.top}px; width: ${box.width}px; height: ${box.height}px;`;
  }
  return stage;
}

function mount(engine: FakeEngine, props: Partial<Props> = {}, target: HTMLElement = host()) {
  const onSelect = vi.fn();
  const view = render(RegionNames, {
    target,
    props: {
      engine,
      shown: true,
      selected: null,
      lobes: null,
      nameOf: (id: string) => {
        const { label } = engine.model.regions.get(id)!;
        return { name: label, label: `${label}, named` };
      },
      label: 'Names on the brain',
      onSelect,
      ...props,
    },
  });
  flushSync();
  return { onSelect, view };
}

const placed = () =>
  [...document.querySelectorAll<HTMLElement>('.region-name')].filter(
    (node) => node.dataset.placed === 'true',
  );
/** Each placed name's words and box, in drawing order. */
const drawn = () =>
  placed().map((node) => ({ text: node.textContent!.trim(), box: node.style.transform }));
const settled = () => vi.waitFor(() => expect(placed().length).toBeGreaterThan(2));
/** Each region name's region, by its accessible name: the placed ones, or all chosen. */
const namedRegions = (engine: FakeEngine, nodes = placed()) =>
  nodes.map((node) => {
    const label = node.getAttribute('aria-label');
    return [...engine.model.regions.values()].find((region) => `${region.label}, named` === label)!
      .id;
  });
const frames = async (count = 2) => {
  for (let at = 0; at < count; at++) await new Promise((done) => requestAnimationFrame(done));
};
const meet = (a: DOMRect, b: DOMRect) =>
  Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
  Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);

test('the same camera names the same regions in the same places', async () => {
  mount(engineOf());
  await settled();
  const first = drawn();
  expect(first.length).toBeLessThanOrEqual(24);
  cleanup();
  const engine = engineOf();
  mount(engine);
  await settled();
  expect(drawn()).toEqual(first);
  // Chosen again at the camera's rest, with nothing moved.
  engine.emit('cameraSettled', undefined);
  flushSync();
  await vi.waitFor(() => expect(drawn()).toEqual(first));
});

test('no name covers the dock, a key or the gizmo, where it would otherwise stand', async () => {
  mount(engineOf());
  await settled();
  const boxes = placed()
    .slice(0, 3)
    .map((node) => node.getBoundingClientRect());
  cleanup();
  const chrome = [
    { className: 'stage-dock', box: boxes[0]! },
    { className: 'stage-key', box: boxes[1]! },
    { className: 'orientation-gizmo', box: boxes[2]! },
  ];
  const stage = host(chrome);
  mount(engineOf(), {}, stage);
  await settled();
  const covers = [...stage.querySelectorAll('.stage-dock, .stage-key, .orientation-gizmo')].map(
    (node) => node.getBoundingClientRect(),
  );
  for (const name of placed()) {
    for (const box of covers) expect(meet(name.getBoundingClientRect(), box)).toBe(false);
  }
});

test('each region’s name is a button in one named toolbar that selects its region', async () => {
  const engine = engineOf();
  const { onSelect } = mount(engine);
  await settled();
  const group = document.querySelector('.region-names')!;
  expect(group.getAttribute('role')).toBe('toolbar');
  expect(group.getAttribute('aria-label')).toBe('Names on the brain');
  expect(group.hasAttribute('data-own-keys')).toBe(true);
  const buttons = placed() as HTMLButtonElement[];
  expect(buttons.every((button) => button.tagName === 'BUTTON')).toBe(true);
  expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);
  buttons[0]!.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(document.activeElement).toBe(buttons[1]);
  await userEvent.click(buttons[1]!);
  const label = buttons[1]!.getAttribute('aria-label')!;
  const id = [...engine.model.regions.values()].find(
    (region) => `${region.label}, named` === label,
  )!.id;
  expect(onSelect).toHaveBeenCalledWith(id);
  await expectAxeClean();
});

test('the selected region is named whenever it faces the reader, though the names are full (handoff F3)', async () => {
  const engine = engineOf();
  const { view } = mount(engine);
  await settled();
  const named = new Set(placed().map((node) => node.getAttribute('aria-label')));
  // A small region facing the reader in the middle of the stage, which the full set leaves out.
  const candidates = [...engine.model.regions.values()].filter(
    (region) =>
      (region.kind === 'cortex' || region.kind === 'structure') &&
      engine.model.canSelect(region) &&
      !named.has(`${region.label}, named`),
  );
  const points = engine.model.facing(candidates.map(({ id }) => id));
  const index = points.findIndex(
    (point) => point && point.x > 200 && point.x < 700 && point.y > 150 && point.y < 450,
  );
  expect(index).toBeGreaterThanOrEqual(0);
  const selected = candidates[index]!;
  await (await view).rerender({ selected: selected.id });
  await vi.waitFor(() =>
    expect(placed()[0]!.getAttribute('aria-label')).toBe(`${selected.label}, named`),
  );
  // Seen from the other side, it is not named.
  engine.camera.applyView(engine.model.anchorOf(selected.id)![0] < 0 ? 'right' : 'left');
  flushSync();
  await vi.waitFor(() =>
    expect(placed().map((node) => node.getAttribute('aria-label'))).not.toContain(
      `${selected.label}, named`,
    ),
  );
});

test('under Lobes colour the lobes are named, drawn only, the key listing them', async () => {
  // The fake scatters its anchors over ±60 × ±40 mm at 10 px/mm: a stage that holds them all, so each of
  // the left hemisphere's lobes, all facing the oblique view, has its largest regions on it.
  const size = { width: 1400, height: 1000 };
  await page.viewport(1440, 1040);
  const engine = engineOf(size);
  const lobes = lobeRows(engine.model.regions.values(), engine.model.settings.atlas, 'en');
  mount(engine, { lobes }, host([], size));
  await settled();
  const names = placed();
  const lobeNames = names.filter((node) => node.classList.contains('lobe-name'));
  expect(lobeNames.length).toBeGreaterThanOrEqual(6);
  expect(new Set(lobeNames.map((node) => node.textContent!.trim())).size).toBe(lobeNames.length);
  for (const node of lobeNames) {
    expect(node.tagName).toBe('SPAN');
    expect(node.getAttribute('aria-hidden')).toBe('true');
    expect(lobes.map(({ label }) => label)).toContain(node.textContent!.trim());
  }
  // Every cortical name is a lobe's; what remains are the internal structures.
  for (const node of names.filter((name) => name.tagName === 'BUTTON')) {
    const label = node.getAttribute('aria-label')!;
    const region = [...engine.model.regions.values()].find(
      (entry) => `${entry.label}, named` === label,
    )!;
    expect(region.kind).toBe('structure');
  }
});

test('a hidden part loses its name once the display has rested', async () => {
  const engine = engineOf();
  mount(engine);
  await settled();
  const first = placed()[0]!.getAttribute('aria-label')!;
  const region = [...engine.model.regions.values()].find(
    (entry) => `${entry.label}, named` === first,
  )!;
  engine.model.hideRegions([region.id]);
  await vi.waitFor(() =>
    expect(placed().map((node) => node.getAttribute('aria-label'))).not.toContain(first),
  );
});

test('names nothing while not shown', () => {
  mount(engineOf(), { shown: false });
  expect(document.querySelector('.region-names')).toBeNull();
});

test('with room beside the anatomy, the names stand in columns outside it, a leader to each dot', async () => {
  const size = { width: 1800, height: 700 };
  await page.viewport(1840, 740);
  const engine = engineOf(size);
  const stage = host([], size);
  mount(engine, {}, stage);
  await settled();
  const anatomy = engine.camera.anatomyRect()!;
  expect(anatomy.width).toBeLessThan(size.width - 400);
  const origin = stage.getBoundingClientRect();
  for (const node of placed()) {
    const box = node.getBoundingClientRect();
    const [left, right] = [box.left - origin.left, box.right - origin.left];
    expect(right <= anatomy.x || left >= anatomy.x + anatomy.width).toBe(true);
    expect(node.dataset.leader).toBe('true');
  }
});

test('names already shown keep their places when larger parts come back into view', async () => {
  // A stage wide enough that the names are full: a newcomer could only push one out.
  const size = { width: 1800, height: 700 };
  await page.viewport(1840, 740);
  const engine = engineOf(size);
  mount(engine, {}, host([], size));
  await settled();
  const chosen = () =>
    namedRegions(engine, [...document.querySelectorAll<HTMLElement>('button.region-name')]);
  const first = chosen();
  expect(first).toHaveLength(24);
  // The eight largest hidden, others fill their places once the display rests.
  const largest = first.slice(0, 8);
  engine.model.hideRegions(largest);
  await vi.waitFor(() => {
    expect(chosen()).toHaveLength(24);
    expect(chosen()).not.toEqual(expect.arrayContaining([largest[0]]));
  });
  const filled = chosen();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  engine.model.showRegions(largest);
  vi.advanceTimersByTime(250);
  flushSync();
  // Chosen again at the rest: the names shown stay, the larger ones back in view wait for room.
  expect(new Set(chosen())).toEqual(new Set(filled));
});

test('a name whose region is hidden fades at once, and leaves once the display has rested', async () => {
  const engine = engineOf();
  mount(engine);
  await settled();
  const node = placed()[0]!;
  const id = namedRegions(engine)[0]!;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  engine.model.hideRegions([id]);
  await frames();
  // Looked at on the next frame, not chosen again: the rest has not come.
  expect(node.isConnected).toBe(true);
  expect(node.dataset.placed).toBe('false');
  expect(node.inert).toBe(true);
  vi.advanceTimersByTime(250);
  flushSync();
  expect(node.isConnected).toBe(true);
  vi.advanceTimersByTime(160);
  flushSync();
  expect(node.isConnected).toBe(false);
});

test('closing the cut fades the names on its faces at once, and they stay out of sight until the rest', async () => {
  // Wide enough that every name chosen stands in a column, the faces' among them.
  const size = { width: 1800, height: 700 };
  await page.viewport(1840, 740);
  const engine = engineOf(size);
  // Open before the names are first chosen: the fake keeps the surface's points in sight through a cut.
  await engine.sections.setMode('coronal');
  engine.camera.faceCut();
  mount(engine, {}, host([], size));
  await settled();
  const shown = placed().length;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  await engine.sections.setMode('off');
  await frames(4);
  const left = placed().length;
  expect(left).toBeGreaterThan(0);
  expect(left).toBeLessThan(shown);
  vi.advanceTimersByTime(250);
  flushSync();
  await vi.waitFor(() => expect(placed().length).toBeGreaterThanOrEqual(left));
});
