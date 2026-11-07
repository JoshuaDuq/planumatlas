// The Lesion popover's body: what Remove leaves the keyboard on.
import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type { LesionStore } from '../../lib/state/lesion.svelte.ts';
import LesionPopover from './LesionPopover.svelte';

afterEach(() => cleanup());

test('Remove leaves focus on the click chosen, not the page', async () => {
  const lesion = $state({
    kind: 'lesion',
    sphere: { centre: [-35.5, -9.5, 63.5], radius: 10 } as {
      centre: number[];
      radius: number;
    } | null,
    radius: 10,
    previewRadius() {},
    commitRadius() {},
    remove: () => (lesion.sphere = null),
  });
  render(LesionPopover, {
    lesion: lesion as unknown as LesionStore,
    lang: 'en',
    placing: true,
    onPlacing() {},
    onReport() {},
  });
  await page.getByRole('button', { name: 'Remove' }).click();
  expect(lesion.sphere).toBeNull();
  await expect
    .poll(() => document.activeElement)
    .toBe(page.getByRole('radio', { name: 'Places the lesion' }).element());
});
