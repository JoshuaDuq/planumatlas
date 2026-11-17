// The reader's highlights listed above the panel, over a real store and plain region records (no
// manifest): what each row says, the colour menu, removal and its focus, and the not-drawn states.
import { flushSync } from 'svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import type { VisibilitySettings } from '../../lib/core/catalog/visibility.ts';
import { createHighlights } from '../../lib/state/highlights.svelte.ts';
import type { HighlightStatus } from '../../lib/state/highlights.svelte.ts';
import type { Region } from '../../lib/types/index.ts';
import { expectAxeClean, expectAxeCleanOnce } from '../../lib/ui/a11y-test-support.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import { FOCUS_TARGETS, registerFocusTarget } from '../../lib/ui/focus.ts';
import HighlightStrip from './HighlightStrip.svelte';

const REGIONS: Record<string, Region> = {
  'destrieux:left:30': {
    id: 'destrieux:left:30',
    hemisphere: 'left',
    kind: 'cortex',
    atlas: 'destrieux',
  } as Region,
  'hcp-mmp:right:1': {
    id: 'hcp-mmp:right:1',
    hemisphere: 'right',
    kind: 'cortex',
    atlas: 'hcp-mmp',
  } as Region,
  'aseg:left:17': {
    id: 'aseg:left:17',
    hemisphere: 'left',
    kind: 'structure',
    atlas: 'aseg',
  } as Region,
};
const NAMES: Record<string, string> = {
  'destrieux:left:30': 'Precentral gyrus',
  'hcp-mmp:right:1': 'V1',
  'aseg:left:17': 'Hippocampus',
};
// Destrieux on the cortex, the teaching set inside it.
const settings: VisibilitySettings = {
  atlas: 'destrieux',
  detail: 'learning',
  internalSystem: null,
  internalConstituents: new Set(),
  cutAtlas: null,
  cutActive: false,
  hemisphere: 'both',
  cortexVisible: true,
  cortexOpacity: 1,
  internalVisible: true,
  spinalCordVisible: false,
  surfaceColor: 'atlas',
  hiddenRegions: new Set(),
  isolatedRegion: null,
};

let announcer: HTMLElement;
let tab: HTMLButtonElement;
const detach: (() => void)[] = [];
beforeEach(() => {
  announcer = document.body.appendChild(document.createElement('p'));
  tab = document.body.appendChild(document.createElement('button'));
  tab.textContent = 'Anatomy';
  // A stand-in for the tab in front, not the strip's: inked so axe judges only the strip in either theme.
  tab.style.cssText = 'color: #000; background: #fff;';
  detach.push(
    attachAnnouncer(announcer),
    registerFocusTarget(FOCUS_TARGETS.activeTab, () => tab),
  );
});
afterEach(() => {
  cleanup();
  for (const undo of detach.splice(0)) undo();
  announcer.remove();
  tab.remove();
});

async function strip(ids: string[], initial: HighlightStatus = 'drawn') {
  const status = $state({ current: initial });
  const showPaint = vi.fn();
  const highlights = createHighlights({ status: () => status.current, showPaint });
  for (const id of ids) highlights.toggle(id);
  await render(HighlightStrip, {
    lang: 'en',
    highlights,
    regions: { get: (id: string) => ({ region: REGIONS[id]! }) },
    name: (id: string) => NAMES[id]!,
    settings,
  });
  return { highlights, status, showPaint };
}

const swatch = (name: string) => page.getByRole('button', { name: `Colour of ${name}` });
/** Each row's drawn name, side letter and not-drawn note. */
const rows = () =>
  [...document.querySelectorAll('.highlight-row')].map((row) => [
    row.querySelector('.highlight-name')!.firstChild!.textContent!.trim(),
    row.querySelector('.highlight-side')!.textContent,
    row.querySelector('.highlight-elsewhere')?.textContent ?? null,
  ]);

test('WORK-32 nothing is listed while nothing is highlighted', async () => {
  await strip([]);
  expect(document.querySelector('.highlight-strip')).toBeNull();
});

test('WORK-32 each highlight is named with its side and colour, and one another atlas or anatomy holds says so', async () => {
  await strip(['destrieux:left:30', 'hcp-mmp:right:1', 'aseg:left:17']);
  await expect.element(page.getByRole('group', { name: 'Your highlights' })).toBeVisible();
  expect(rows()).toEqual([
    ['Precentral gyrus', 'L', null],
    ['V1', 'R', 'Not drawn on this atlas'],
    ['Hippocampus', 'L', 'Not drawn in this internal anatomy'],
  ]);
  await expect.element(swatch('Precentral gyrus, left: blue')).toBeVisible();
  await expect.element(swatch('V1, right: raspberry')).toBeVisible();
  await expect.element(swatch('Hippocampus, left: green')).toBeVisible();
  await expect
    .element(page.getByRole('button', { name: 'Remove the highlight of V1, right' }))
    .toBeVisible();
  // The swatches are the strip's only colour.
  const fills = [...document.querySelectorAll<HTMLElement>('.highlight-swatch .swatch')].map(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(fills).toEqual(['rgb(57, 135, 229)', 'rgb(213, 81, 129)', 'rgb(0, 131, 0)']);
  await expectAxeClean();
});

test('WORK-32 a press on a swatch offers the six colours by name; the one chosen recolours the region', async () => {
  const { highlights } = await strip(['destrieux:left:30']);
  await swatch('Precentral gyrus, left: blue').click();
  const colours = page.getByRole('group', { name: 'Colours' });
  await expect.element(colours).toBeVisible();
  const buttons = [...colours.element().querySelectorAll('button')];
  expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
    'Blue',
    'Raspberry',
    'Green',
    'Amber',
    'Violet',
    'Pink',
  ]);
  expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual([
    'true',
    'false',
    'false',
    'false',
    'false',
    'false',
  ]);
  await expectAxeCleanOnce('light', 1280);
  await page.getByRole('button', { name: 'Violet' }).click();
  expect(highlights.list).toEqual([{ region: 'destrieux:left:30', color: 'violet' }]);
  await expect.element(colours).not.toBeInTheDocument();
  await expect.element(swatch('Precentral gyrus, left: violet')).toHaveFocus();
});

test('WORK-32 a removal is said and hands focus to the next remove, and the last one to the tab in front', async () => {
  const { highlights } = await strip(['destrieux:left:30', 'hcp-mmp:right:1']);
  await page
    .getByRole('button', { name: 'Remove the highlight of Precentral gyrus, left' })
    .click();
  expect(highlights.list.map(({ region }) => region)).toEqual(['hcp-mmp:right:1']);
  expect(announcer.textContent).toBe('Highlight removed: Precentral gyrus, left.');
  const next = page.getByRole('button', { name: 'Remove the highlight of V1, right' });
  await expect.element(next).toHaveFocus();
  await next.click();
  expect(highlights.list).toEqual([]);
  await expect.poll(() => document.activeElement).toBe(tab);
  expect(document.querySelector('.highlight-strip')).toBeNull();
});

test('WORK-32 set aside, the strip says they are not drawn; lifted, it offers to draw them again', async () => {
  const { status, showPaint } = await strip(['destrieux:left:30'], 'aside');
  const show = page.getByRole('button', { name: 'Show on the brain' });
  await expect
    .element(
      page.getByText(
        'Not drawn while this tab shows its evidence; they come back when you leave it.',
      ),
    )
    .toBeVisible();
  await expect.element(show).not.toBeInTheDocument();
  status.current = 'lifted';
  flushSync();
  await expect.element(page.getByText('Not drawn under the colour you chose.')).toBeVisible();
  await expectAxeCleanOnce('dark', 390);
  await show.click();
  expect(showPaint).toHaveBeenCalledOnce();
  status.current = 'drawn';
  flushSync();
  expect(document.querySelector('.highlight-status')).toBeNull();
  await expect.element(show).not.toBeInTheDocument();
});
