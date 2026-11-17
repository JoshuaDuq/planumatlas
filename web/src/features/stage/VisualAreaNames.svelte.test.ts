// The visual areas' names over a stand-in engine in a real browser: each centred on its anchor as the engine
// places it, following the camera, a crowded or unseen name left out, and none of it in the accessibility tree.
import { afterEach, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import type { ComponentProps } from 'svelte';
import { page } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../test/fixtures/cdmd-manifest.json' with { type: 'json' };
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest, VisualAreaName } from '../../lib/types/index.ts';
import '../../styles/index.css';
import VisualAreaNames from './VisualAreaNames.svelte';

afterEach(async () => {
  cleanup();
  await page.viewport(1280, 800);
});

/** A 900 × 600 stage whose engine says where each name's anchor stands; `place` moves them as a camera move would. */
function mount(initial: VisualAreaName[], shown = true) {
  const fake = createFakeEngine({
    manifest: manifest as unknown as Manifest,
    hostSize: { width: 900, height: 600 },
  });
  let current = initial;
  const engine = {
    on: fake.on,
    camera: { visibleRect: { x: 0, y: 0, width: 900, height: 600 } },
    visualField: { areaNames: () => current },
  } satisfies ComponentProps<typeof VisualAreaNames>['engine'];
  const stage = document.body.appendChild(document.createElement('main'));
  stage.style.cssText =
    'position: absolute; left: 0; top: 0; width: 900px; height: 600px; background: var(--scene-background);';
  render(VisualAreaNames, { target: stage, props: { engine, shown, names: ['V1v', 'LO1'] } });
  flushSync();
  return {
    place(next: VisualAreaName[]) {
      current = next;
      // The fake camera's move raises `camera`, as a reader's drag does.
      fake.camera.applyView('left');
    },
  };
}

const label = (key: string) =>
  document.querySelector<HTMLElement>(`.area-name[data-name="${key}"]`)!;
const drawn = (key: string) => getComputedStyle(label(key)).visibility === 'visible';
const centre = (key: string) => {
  const box = label(key).getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

test('each name is centred on its anchor, and follows it as the camera moves', () => {
  const { place } = mount([
    { name: 'V1v', hemisphere: 'left', point: { x: 600, y: 300 } },
    { name: 'V1v', hemisphere: 'right', point: { x: 300, y: 300 } },
    { name: 'LO1', hemisphere: 'right', point: { x: 300, y: 150 } },
  ]);
  expect(label('left:V1v').textContent).toBe('V1v');
  for (const [key, x, y] of [
    ['left:V1v', 600, 300],
    ['right:V1v', 300, 300],
    ['right:LO1', 300, 150],
  ] as const) {
    expect(drawn(key)).toBe(true);
    expect(centre(key).x).toBeCloseTo(x, 0);
    expect(centre(key).y).toBeCloseTo(y, 0);
  }
  place([
    { name: 'V1v', hemisphere: 'left', point: { x: 500, y: 420 } },
    { name: 'V1v', hemisphere: 'right', point: { x: 300, y: 300 } },
    { name: 'LO1', hemisphere: 'right', point: { x: 300, y: 150 } },
  ]);
  expect(centre('left:V1v').x).toBeCloseTo(500, 0);
  expect(centre('left:V1v').y).toBeCloseTo(420, 0);
});

test('a name the cortex hides, or one that would cover a larger area’s name, is not drawn', () => {
  mount([
    { name: 'V1v', hemisphere: 'left', point: { x: 600, y: 300 } },
    { name: 'LO1', hemisphere: 'left', point: { x: 604, y: 302 } },
    { name: 'V1v', hemisphere: 'right', point: null },
    { name: 'LO1', hemisphere: 'right', point: { x: 300, y: 150 } },
  ]);
  expect(['left:V1v', 'left:LO1', 'right:V1v', 'right:LO1'].map(drawn)).toEqual([
    true,
    false,
    false,
    true,
  ]);
});

test('the names are pointer-transparent, hidden from assistive technology, and absent while the areas are not named', () => {
  mount([{ name: 'V1v', hemisphere: 'left', point: { x: 600, y: 300 } }]);
  const group = document.querySelector<HTMLElement>('.area-names')!;
  expect(group.getAttribute('aria-hidden')).toBe('true');
  expect(getComputedStyle(group).pointerEvents).toBe('none');
  cleanup();
  mount([{ name: 'V1v', hemisphere: 'left', point: { x: 600, y: 300 } }], false);
  expect(document.querySelector('.area-names')).toBeNull();
});
