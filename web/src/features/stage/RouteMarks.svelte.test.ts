// The whole route's numbered marks over the fake engine in a real browser: where each number sits, that it
// follows the camera, what it is named, and that it opens its landmark.
import { afterEach, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import { userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import '../../styles/index.css';
import RouteMarks from './RouteMarks.svelte';

const REGIONS = ['learning:midline:optic-chiasm', 'learning:left:lateral-geniculate'];
const marks = REGIONS.map((region, index) => ({
  region,
  label: `Landmark ${index + 1}: ${region}`,
}));

afterEach(() => cleanup());

function mount(shown = marks) {
  const engine = createFakeEngine({ manifest: manifest as unknown as Manifest });
  const onOpen = vi.fn();
  render(RouteMarks, { engine, marks: shown, label: 'Whole route', onOpen });
  flushSync();
  return { engine, onOpen };
}

/** Where a mark's button has been moved to, from its inline transform. */
const placed = (button: HTMLElement) =>
  button.style.transform
    .match(/-?[\d.]+/g)!
    .slice(0, 2)
    .map(Number);
const buttons = () => [...document.querySelectorAll<HTMLElement>('.route-mark')];

/** The style serializes a few decimals, so each button is compared to its point to a hundredth. */
function expectPlacedAt(points: readonly ({ x: number; y: number } | null)[]) {
  const shown = buttons().map(placed);
  expect(shown).toHaveLength(points.length);
  points.forEach((point, index) => {
    expect(shown[index]![0]).toBeCloseTo(point!.x, 2);
    expect(shown[index]![1]).toBeCloseTo(point!.y, 2);
  });
}

test('each number sits where the camera projects its landmark’s anchor, and moves with the camera', () => {
  const { engine } = mount();
  const anchors = REGIONS.map((id) => engine.model.anchorOf(id)!);
  const expected = engine.camera.project(anchors);
  expectPlacedAt(expected);
  expect(buttons().map((button) => button.textContent!.trim())).toEqual(['1', '2']);

  engine.camera.applyView('left');
  const moved = engine.camera.project(anchors);
  expect(moved).not.toEqual(expected);
  expectPlacedAt(moved);
});

test('a named group of buttons, each opening its landmark', async () => {
  const { onOpen } = mount();
  const group = document.querySelector('.route-marks')!;
  expect(group.getAttribute('role')).toBe('group');
  expect(group.getAttribute('aria-label')).toBe('Whole route');
  await userEvent.click(buttons()[1]!);
  expect(onOpen).toHaveBeenCalledWith(1);
  await expectAxeClean();
});

test('draws nothing without a route', () => {
  mount([]);
  expect(document.querySelector('.route-marks')).toBeNull();
});
