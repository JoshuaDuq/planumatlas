// The whole route's labels over the fake engine in a real browser: where each dot, number and name sits, that
// they follow the camera and keep clear of each other and the chrome, what they are named, and what they open.
import { afterEach, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import type { ComponentProps } from 'svelte';
import { userEvent } from 'vitest/browser';
import type { ScreenPoint } from '../../lib/engine/api.ts';
import { page } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import '../../styles/index.css';
import RouteMarks from './RouteMarks.svelte';

const REGIONS = ['learning:midline:optic-chiasm', 'learning:left:lateral-geniculate'];
const NAMES = ['Optic chiasm', 'Left lateral geniculate nucleus'];
const marks = REGIONS.map((region, index) => ({
  region,
  name: NAMES[index]!,
  label: `Landmark ${index + 1}: ${NAMES[index]}`,
}));

afterEach(async () => {
  cleanup();
  await page.viewport(1280, 800);
});

/** The stage the marks stand on: 900 × 600 at the page's corner, on the scene's ground, as the stage host is. */
function host() {
  const stage = document.body.appendChild(document.createElement('main'));
  stage.style.cssText =
    'position: absolute; left: 0; top: 0; width: 900px; height: 600px; background: var(--scene-background);';
  return stage;
}

function mount(
  shown = marks,
  engine: ComponentProps<typeof RouteMarks>['engine'] = createFakeEngine({
    manifest: manifest as unknown as Manifest,
    hostSize: { width: 900, height: 600 },
  }),
) {
  const onOpen = vi.fn();
  render(RouteMarks, {
    target: host(),
    props: { engine, marks: shown, label: 'Whole route', onOpen },
  });
  flushSync();
  return { engine, onOpen };
}

/** An engine whose camera projects every landmark to the given points, on a visible stage of `height`. */
function projecting(points: ScreenPoint[], height = 600) {
  const fake = createFakeEngine({ manifest: manifest as unknown as Manifest });
  return {
    on: fake.on,
    model: fake.model,
    camera: {
      project: () => points,
      visibleRect: { x: 0, y: 0, width: 900, height },
    },
  } satisfies ComponentProps<typeof RouteMarks>['engine'];
}

const buttons = () => [...document.querySelectorAll<HTMLElement>('.route-mark')];
const centre = (node: Element) => {
  const box = node.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};
const meet = (a: DOMRect, b: DOMRect) =>
  Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
  Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);

test('each dot sits on its landmark’s anchor as the camera projects it, its number and name beside it, and follows the camera', () => {
  const engine = createFakeEngine({
    manifest: manifest as unknown as Manifest,
    hostSize: { width: 900, height: 600 },
  });
  mount(marks, engine);
  const anchors = REGIONS.map((id) => engine.model.anchorOf(id)!);
  const expectDotsAt = (points: (ScreenPoint | null)[]) =>
    buttons().forEach((button, index) => {
      const dot = centre(button.querySelector('.stage-label-dot')!);
      expect(dot.x).toBeCloseTo(points[index]!.x, 1);
      expect(dot.y).toBeCloseTo(points[index]!.y, 1);
    });
  const before = engine.camera.project(anchors);
  expectDotsAt(before);
  expect(buttons().map((button) => button.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
    '1 Optic chiasm',
    '2 Left lateral geniculate nucleus',
  ]);
  // Its name drawn, a label needs no tooltip.
  expect(buttons().map((button) => button.dataset.tooltip)).toEqual([undefined, undefined]);

  engine.camera.applyView('left');
  const after = engine.camera.project(anchors);
  expect(after).not.toEqual(before);
  expectDotsAt(after);
});

test('crowded anchors get labels whose targets never overlap, at least 24 px each, each by its own dot', () => {
  const crowded = [
    { x: 400, y: 300 },
    { x: 408, y: 304 },
  ];
  mount(marks, projecting(crowded));
  const [a, b] = buttons().map((button) => button.getBoundingClientRect());
  expect(meet(a!, b!)).toBe(false);
  for (const box of [a!, b!]) expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24);
  // Each dot is still on its own anchor.
  buttons().forEach((button, index) => {
    expect(centre(button.querySelector('.stage-label-dot')!).x).toBeCloseTo(crowded[index]!.x, 1);
  });
});

test('a label stands clear of the stage’s chrome where it would otherwise fall', () => {
  mount(marks.slice(0, 1), projecting([{ x: 400, y: 300 }]));
  const beside = buttons()[0]!.getBoundingClientRect();
  cleanup();
  const stage = host();
  const dock = stage.appendChild(document.createElement('div'));
  dock.className = 'stage-dock';
  dock.style.cssText = `position: absolute; left: ${beside.left}px; top: ${beside.top}px; width: ${beside.width}px; height: ${beside.height}px;`;
  render(RouteMarks, {
    target: stage,
    props: {
      engine: projecting([{ x: 400, y: 300 }]),
      marks: marks.slice(0, 1),
      label: 'Whole route',
      onOpen: vi.fn(),
    },
  });
  flushSync();
  expect(meet(buttons()[0]!.getBoundingClientRect(), dock.getBoundingClientRect())).toBe(false);
});

test('following the camera reads no layout; a chrome resize measures the chrome again', async () => {
  const stage = host();
  const dock = stage.appendChild(document.createElement('div'));
  dock.className = 'stage-dock';
  dock.style.cssText = 'position: absolute; left: 0; top: 560px; width: 40px; height: 40px;';
  const engine = createFakeEngine({
    manifest: manifest as unknown as Manifest,
    hostSize: { width: 900, height: 600 },
  });
  render(RouteMarks, {
    target: stage,
    props: { engine, marks: marks.slice(0, 1), label: 'Whole route', onOpen: vi.fn() },
  });
  flushSync();
  // Past the observers' first report.
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  const projected = vi.spyOn(engine.camera, 'project');
  const reads = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  engine.emit('camera', { ...engine.camera.view });
  // Placed again, from the chrome measured before.
  expect(projected).toHaveBeenCalledOnce();
  expect(reads).not.toHaveBeenCalled();
  reads.mockRestore();

  // The dock grows over where the label stands.
  const label = buttons()[0]!.getBoundingClientRect();
  dock.style.cssText = `position: absolute; left: ${label.left}px; top: ${label.top}px; width: ${label.width}px; height: ${label.height}px;`;
  await vi.waitFor(() =>
    expect(meet(buttons()[0]!.getBoundingClientRect(), dock.getBoundingClientRect())).toBe(false),
  );
});

test('on a phone’s short stage the numbers stand alone, and each one’s tooltip names it', async () => {
  await page.viewport(375, 812);
  mount(
    marks,
    projecting(
      [
        { x: 100, y: 200 },
        { x: 250, y: 300 },
      ],
      380,
    ),
  );
  expect(buttons().map((button) => button.dataset.short)).toEqual(['true', 'true']);
  expect(
    buttons().map(
      (button) => getComputedStyle(button.querySelector('.stage-label-name')!).visibility,
    ),
  ).toEqual(['hidden', 'hidden']);
  expect(buttons().map((button) => button.dataset.tooltip)).toEqual(
    marks.map((mark) => mark.label),
  );
  // The accessible name stays whole.
  expect(buttons()[0]!.getAttribute('aria-label')).toBe('Landmark 1: Optic chiasm');
});

test('a named toolbar of buttons, one Tab stop the arrows walk, each opening its landmark', async () => {
  const { onOpen } = mount();
  const group = document.querySelector('.route-marks')!;
  expect(group.getAttribute('role')).toBe('toolbar');
  expect(group.hasAttribute('data-own-keys')).toBe(true);
  expect(buttons().map((button) => button.tabIndex)).toEqual([0, -1]);
  buttons()[0]!.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(document.activeElement).toBe(buttons()[1]);
  expect(group.getAttribute('aria-label')).toBe('Whole route');
  await userEvent.click(buttons()[1]!);
  expect(onOpen).toHaveBeenCalledWith(1);
  await expectAxeClean();
});

test('draws nothing without a route', () => {
  mount([]);
  expect(document.querySelector('.route-marks')).toBeNull();
});
