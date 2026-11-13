// The Lesion popover's body: what Remove leaves the keyboard on, and where its method is.
import { afterEach, expect, test } from 'vitest';
import { cleanup, render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import type { LesionStore } from '../../lib/state/lesion.svelte.ts';
import '../../styles/index.css';
import { POPOVER_WIDTH } from '../stage/place-popover.ts';
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
    reportShown: () => false,
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
    reportShown: () => false,
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

test('the two clicks share one line in the dock popover, in English', async () => {
  await document.fonts.ready;
  render(LesionPopover, {
    lesion: { kind: 'lesion', sphere: null, radius: 10 } as unknown as LesionStore,
    lang: 'en',
    placing: false,
    onPlacing() {},
    reportShown: () => false,
    onReport() {},
  });
  // The popover's 272 px less its two 17 px paddings (Dock.svelte).
  const radio = (name: string) => page.getByRole('radio', { name }).element();
  radio('Selects a region').closest<HTMLElement>('body > *')!.style.width =
    `${POPOVER_WIDTH - 34}px`;
  // Each label's text lays out on one line, both on the same row.
  const lines = (name: string) => {
    const range = document.createRange();
    range.selectNodeContents(radio(name));
    return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
  };
  const select = lines('Selects a region');
  const place = lines('Places the lesion');
  expect(select.size).toBe(1);
  expect(place.size).toBe(1);
  expect([...select]).toEqual([...place]);
});

test('in French at 200 % text the clicks stack rather than run into each other', async () => {
  await document.fonts.ready;
  render(LesionPopover, {
    lesion: { kind: 'lesion', sphere: null, radius: 10 } as unknown as LesionStore,
    lang: 'fr',
    placing: false,
    onPlacing() {},
    reportShown: () => false,
    onReport() {},
  });
  const radio = (name: string) => page.getByRole('radio', { name }).element() as HTMLElement;
  radio('Sélectionne une région').closest<HTMLElement>('body > *')!.style.width =
    `${POPOVER_WIDTH - 34}px`;
  document.documentElement.style.fontSize = '200%';
  try {
    const select = radio('Sélectionne une région').getBoundingClientRect();
    const place = radio('Place la lésion').getBoundingClientRect();
    // "Sélectionne" no longer fits half the row: each click keeps its words inside its own box.
    for (const name of ['Sélectionne une région', 'Place la lésion']) {
      expect(radio(name).scrollWidth, name).toBeLessThanOrEqual(radio(name).clientWidth + 0.5);
    }
    expect(select.right <= place.left || select.bottom <= place.top).toBe(true);
  } finally {
    document.documentElement.style.fontSize = '';
  }
});

test('with the report in the panel in front, it offers neither Show the report nor a second Remove', async () => {
  const placed = {
    kind: 'lesion',
    sphere: { centre: [-35.5, -9.5, 63.5], radius: 10 },
    radius: 10,
  };
  let shown = $state(true);
  render(LesionPopover, {
    lesion: placed as unknown as LesionStore,
    lang: 'en',
    placing: false,
    reportShown: () => shown,
    onPlacing() {},
    onReport() {},
  });
  // The placed centre is still said.
  await expect.element(page.getByText('−35.5, −9.5, +63.5 mm')).toBeVisible();
  expect(page.getByRole('button', { name: 'Show the report' }).query()).toBeNull();
  expect(page.getByRole('button', { name: 'Remove' }).query()).toBeNull();
  shown = false;
  await expect.element(page.getByRole('button', { name: 'Show the report' })).toBeVisible();
  await expect.element(page.getByRole('button', { name: 'Remove' })).toBeVisible();
});
