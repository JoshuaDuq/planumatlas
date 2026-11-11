// The Lesion popover's body: what Remove leaves the keyboard on, and where its method is.
import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
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

test('links its English methods page', async () => {
  render(LesionPopover, {
    lesion: { kind: 'lesion', sphere: null, radius: 10 } as unknown as LesionStore,
    lang: 'en',
    placing: false,
    onPlacing() {},
    onReport() {},
  });
  await userEvent.click(page.getByText('About this data'));
  const methods = page.getByRole('link', {
    name: 'Method and limits (opens in a new tab)',
    exact: true,
  });
  await expect.element(methods).toHaveAttribute('href', '/docs/features/lesion-report.html');
  await expect.element(methods).toHaveAttribute('hreflang', 'en');
  await expect.element(methods).toHaveAttribute('target', '_blank');
});
