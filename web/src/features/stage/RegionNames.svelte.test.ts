// Names on the brain over the fake engine in a real browser: the same camera names the same regions in the
// same places, no name covers the stage's chrome, each name selects its region, the selection is named
// wherever the reader sees it (handoff F3), lobes are drawn only, and a change is named once it rests.
// The names are chosen by looking at the stage, which takes frames: a move stops a look under way. With
// room beside the anatomy the names stand in columns there, short of an open menu; without it, level beside
// their dots. A turn keeps the names still in sight, and a name whose point leaves sight, or whose cut
// closes, fades at once rather than at the rest. A name pointed at marks its region on the stage, and the
// region the stage marks lights its name.
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
import { ANATOMY_GAP_PX, COMFORTABLE_COLUMN_PX, OPEN_COLUMN_PX } from './name-columns.ts';
import RegionNames from './RegionNames.svelte';

type Props = ComponentProps<typeof RegionNames>;

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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
/** The names placed, in the type they are measured in: a late webfont changes their widths and so their places. */
const settled = async () => {
  await vi.waitFor(() => expect(placed().length).toBeGreaterThan(2));
  await document.fonts.ready;
  await frames();
};
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
const callsTo = (engine: FakeEngine, method: string) =>
  engine.calls.filter((call) => call.method === method);
/**
 * Stirs the stage and waits until the names are chosen again. A look at the stage can outlast its frame,
 * and only its end asks which regions a click selects. Frames are waited on, not time: fake timers leave
 * them running, and a held clock stays where the test put it.
 */
async function chosenAfter(engine: FakeEngine, stir: () => void) {
  const before = callsTo(engine, 'canSelect').length;
  stir();
  flushSync();
  const chosen = () => callsTo(engine, 'canSelect').length > before;
  for (let frame = 0; frame < 600 && !chosen(); frame++) await frames(1);
  expect(chosen()).toBe(true);
  flushSync();
}
/** Each region the names asked the stage to mark as pointed at, null to clear the mark, in order. */
const marked = (engine: FakeEngine) => callsTo(engine, 'point').map(({ args }) => args[0]);
/** The pointer at the page's corner, which no name reaches, wherever an earlier test left it. */
const park = () => userEvent.unhover(document.body, { position: { x: 0, y: 0 } });

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
  await chosenAfter(engine, () => engine.emit('cameraSettled', undefined));
  expect(drawn()).toEqual(first);
});

test('a rest looks again at the names shown, which a late explode may have moved', async () => {
  const engine = engineOf();
  mount(engine);
  await settled();
  await frames();
  const shown = namedRegions(engine, [
    ...document.querySelectorAll<HTMLElement>('button.region-name'),
  ]);
  const look = vi.spyOn(engine.model, 'inSight');
  // No camera event since they were chosen: the pieces moved under them on their own.
  await chosenAfter(engine, () => engine.emit('cameraSettled', undefined));
  expect(look).toHaveBeenCalledTimes(1);
  expect(new Set(look.mock.calls[0]![0].map(({ id }) => id))).toEqual(new Set(shown));
});

test('a turn of the camera or a change of the display stops a look under way, and the rest looks again', async () => {
  const engine = engineOf();
  mount(engine);
  await settled();
  await frames();
  const hidden = namedRegions(engine)[0]!;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  // A clock on which every batch of rays spends its frame's share: a look takes a frame a batch.
  let now = performance.now();
  vi.spyOn(performance, 'now').mockImplementation(() => (now += 10));
  const asked = () => callsTo(engine, 'seenAt').length;
  const chosen = () => callsTo(engine, 'canSelect').length;
  const stoppedBy = async (stir: () => void) => {
    const [rays, choices] = [asked(), chosen()];
    engine.emit('cameraSettled', undefined);
    await frames(1);
    // Under way: a batch asked at once and another on the frame, and no names chosen yet.
    expect(asked()).toBe(rays + 2);
    stir();
    await frames(3);
    expect(asked()).toBe(rays + 2);
    expect(chosen()).toBe(choices);
  };
  await stoppedBy(() => engine.emit('camera', engine.camera.view));
  await stoppedBy(() => engine.model.hideRegions([hidden]));
  // The change's rest looks afresh, to its end.
  await chosenAfter(engine, () => vi.advanceTimersByTime(250));
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

test('the pointer or the keyboard on a name marks its region on the stage, and leaving it clears the mark', async () => {
  await park();
  const engine = engineOf();
  mount(engine);
  await settled();
  const [first, second] = placed() as [HTMLElement, HTMLElement];
  const [a, b] = namedRegions(engine);
  await userEvent.hover(first);
  expect(marked(engine)).toEqual([a]);
  // The stage answers with its own event, which lights the name.
  expect(first.hasAttribute('data-hot')).toBe(true);
  await userEvent.hover(second);
  expect(marked(engine)).toEqual([a, null, b]);
  expect(first.hasAttribute('data-hot')).toBe(false);
  expect(second.hasAttribute('data-hot')).toBe(true);
  await park();
  expect(marked(engine)).toEqual([a, null, b, null]);
  expect(document.querySelector('[data-hot]')).toBeNull();
  first.focus();
  expect(marked(engine)).toEqual([a, null, b, null, a]);
  expect(first.hasAttribute('data-hot')).toBe(true);
  first.blur();
  expect(marked(engine)).toEqual([a, null, b, null, a, null]);
  expect(document.querySelector('[data-hot]')).toBeNull();
});

test('the region the stage marks as pointed at lights its name, and no other', async () => {
  await park();
  const engine = engineOf();
  mount(engine);
  await settled();
  const [first, second] = placed() as [HTMLElement, HTMLElement];
  const [a, b] = namedRegions(engine).map((id) => engine.model.regions.get(id)!);
  const lit = () => [...document.querySelectorAll('[data-hot]')];
  expect(lit()).toEqual([]);
  // The pointer on the region itself, not on its name.
  engine.emit('hover', { region: a!, position: { x: 450, y: 300 } });
  expect(lit()).toEqual([first]);
  engine.emit('hover', { region: b!, position: { x: 460, y: 300 } });
  expect(lit()).toEqual([second]);
  engine.emit('hover', { region: null, position: null });
  expect(lit()).toEqual([]);
});

test('a name taken away while pointed at clears the stage’s mark', async () => {
  await park();
  const engine = engineOf();
  mount(engine);
  await settled();
  const node = placed()[0]!;
  const id = namedRegions(engine)[0]!;
  // No pointer stands on it to leave: only the name's going can clear the mark.
  node.dispatchEvent(new PointerEvent('pointerenter'));
  expect(marked(engine)).toEqual([id]);
  engine.model.hideRegions([id]);
  await vi.waitFor(() => expect(node.isConnected).toBe(false));
  expect(marked(engine)).toEqual([id, null]);
});

test('the selected region is named wherever the reader sees it, though the names are full (handoff F3)', async () => {
  const engine = engineOf();
  const { view } = mount(engine);
  await settled();
  const named = new Set(placed().map((node) => node.getAttribute('aria-label')));
  // A small region the reader sees in the middle of the stage, which the full set leaves out.
  const selected = [...engine.model.regions.values()].find((region) => {
    if (region.kind !== 'cortex' && region.kind !== 'structure') return false;
    if (!engine.model.canSelect(region) || named.has(`${region.label}, named`)) return false;
    const [point] = engine.camera.project([engine.model.anchorOf(region.id)!]);
    return (
      point &&
      point.x > 200 &&
      point.x < 700 &&
      point.y > 150 &&
      point.y < 450 &&
      engine.model.seenAt([point])[0]?.id === region.id
    );
  })!;
  expect(selected).toBeDefined();
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

test('a menu opened beside the anatomy ends the column short of it, no name under it', async () => {
  const size = { width: 1800, height: 700 };
  await page.viewport(1840, 740);
  const engine = engineOf(size);
  // The dock stands under the anatomy, clear of both columns.
  const dock = new DOMRect(700, 640, 400, 48);
  const stage = host([{ className: 'stage-dock', box: dock }], size);
  mount(engine, {}, stage);
  await settled();
  // Its menu opens over the left column's far side, a comfortable column left between it and the anatomy.
  const near = engine.camera.anatomyRect()!.x - ANATOMY_GAP_PX;
  const menu = stage.querySelector('.stage-dock')!.appendChild(document.createElement('div'));
  menu.className = 'popover stage-popover';
  menu.style.cssText = `position: absolute; left: ${8 - dock.left}px; top: ${150 - dock.top}px; width: ${near - COMFORTABLE_COLUMN_PX - 16}px; height: 400px;`;
  const box = menu.getBoundingClientRect();
  const under = () => placed().filter((node) => meet(node.getBoundingClientRect(), box));
  // As it opens, names stand where it does.
  expect(under().length).toBeGreaterThan(0);
  await vi.waitFor(() => {
    const left = placed().filter((node) => node.dataset.side === 'left');
    expect(left.length).toBeGreaterThan(2);
    // Above and below the menu too: the column is narrower, not broken round it.
    for (const node of left) {
      expect(node.getBoundingClientRect().left).toBeGreaterThanOrEqual(box.right);
    }
    expect(under()).toEqual([]);
  });
});

test('without room for a column, each name stands level beside its dot, with no leader', async () => {
  const engine = engineOf();
  const stage = host();
  mount(engine, {}, stage);
  await settled();
  const anatomy = engine.camera.anatomyRect()!;
  expect(anatomy.x).toBeLessThan(OPEN_COLUMN_PX);
  expect(900 - (anatomy.x + anatomy.width)).toBeLessThan(OPEN_COLUMN_PX);
  const names = placed().map((node) => ({
    node,
    box: node.getBoundingClientRect(),
    dot: node.querySelector('.stage-label-dot')!.getBoundingClientRect(),
  }));
  for (const { node, box, dot } of names) {
    const at = { x: dot.left + dot.width / 2, y: dot.top + dot.height / 2 };
    expect(node.dataset.leader).toBe('false');
    expect(getComputedStyle(node.querySelector('.stage-label-leader')!).display).toBe('none');
    expect((box.top + box.bottom) / 2).toBeCloseTo(at.y, 1);
    if (node.dataset.side === 'right') expect(box.left - at.x).toBeCloseTo(6, 1);
    else {
      expect(node.dataset.side).toBe('left');
      expect(at.x - box.right).toBeCloseTo(6, 1);
    }
  }
  // Some stand on the left, where the right was taken; none on another.
  expect(new Set(names.map(({ node }) => node.dataset.side))).toEqual(new Set(['left', 'right']));
  for (const [index, { box }] of names.entries()) {
    for (const other of names.slice(index + 1)) expect(meet(box, other.box)).toBe(false);
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
  await chosenAfter(engine, () => {
    engine.model.showRegions(largest);
    vi.advanceTimersByTime(250);
  });
  // Any name the choice dropped has left.
  vi.advanceTimersByTime(160);
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
  const choices = callsTo(engine, 'canSelect').length;
  engine.model.hideRegions([id]);
  await frames();
  // Looked at on the next frame, not chosen again: the rest has not come.
  expect(node.isConnected).toBe(true);
  expect(node.dataset.placed).toBe('false');
  expect(node.inert).toBe(true);
  expect(callsTo(engine, 'canSelect')).toHaveLength(choices);
  await chosenAfter(engine, () => vi.advanceTimersByTime(250));
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
  // The rest names what the closed cut uncovered, in the faces' room.
  await chosenAfter(engine, () => vi.advanceTimersByTime(250));
  await vi.waitFor(() => expect(placed().length).toBeGreaterThan(left));
});
