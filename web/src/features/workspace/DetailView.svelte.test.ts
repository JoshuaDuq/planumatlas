// The detail view as the app mounts it, over the fake engine and the published catalogues: the search
// of the tab in front stays above it (U2), so typing a name searches instead of pressing shortcuts.
import '../../styles/index.css'; // The page's styles: a hidden panel takes no focus, as in the app.
import { flushSync } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createShell } from '../../app/regions/shell-test-support.ts';
import { expectAxeCleanOnce } from '../../lib/ui/a11y-test-support.ts';

vi.mock('../../lib/core/assets/published-anatomy.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/core/assets/published-anatomy.ts')>()),
  loadAnatomies: async () => ({ default: 'cdmd', anatomies: [{ id: 'cdmd' }] }),
}));

const REGION = 'destrieux:left:30';
const shell = createShell();
afterEach(() => shell.close());

const state = () => shell.app.world!.view.current;
const list = () => document.getElementById('navigator')!;
const detail = () => document.getElementById('inspector')!;
/** The field above the detail: a plain search box, where the list's is a combobox. */
const detailField = (name = 'Search regions') =>
  page.getByRole('searchbox', { name }).element() as HTMLInputElement;
const listField = () => page.getByRole('combobox', { name: 'Search regions' }).element();

async function pick(id = REGION) {
  shell.engine.emit('pick', { id, point: null });
  flushSync();
  await expect.poll(() => detail().hidden).toBe(false);
}

describe('a region’s detail', () => {
  test('keeps the region search above it; typing there shows the list with results, and no shortcut fires', async () => {
    await shell.open();
    await pick();
    const field = detailField();
    expect(detail().contains(field)).toBe(true);
    expect(field.checkVisibility()).toBe(true);
    // Above the region's own heading.
    const heading = page.getByRole('heading', { level: 2, name: /./ }).first().element();
    expect(field.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await userEvent.click(field);
    // `c` is Cortex and `a` nothing; in a field they are letters.
    await userEvent.keyboard('broca');
    expect(list().hidden).toBe(false);
    expect(detail().hidden).toBe(true);
    expect(document.activeElement).toBe(listField());
    expect((listField() as HTMLInputElement).value).toBe('broca');
    expect(state().query).toBe('broca');
    expect(state().cortexVisible).toBe(true);
    expect(state().selectedRegion?.id).toBe(REGION);
    await expect
      .element(
        page.getByRole('option', { name: /^Opercular part of the inferior frontal gyrus/ }).first(),
      )
      .toBeVisible();
  });

  test('Escape in the field clears words it holds, then is Back to the list', async () => {
    await shell.open();
    shell.app.world!.session.setQuery('cun');
    await pick();
    const field = detailField();
    expect(field.value).toBe('cun');
    field.focus();
    await userEvent.keyboard('{Escape}');
    expect(state().query).toBe('');
    expect(detail().hidden).toBe(false);
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => detail().hidden).toBe(true);
    expect(state().selectedRegion?.id).toBe(REGION);
  });

  test('`/` from the field’s detail still focuses the list’s own search', async () => {
    await shell.open();
    await pick();
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(listField());
  });

  test('the `/` hint goes with single-key shortcuts', async () => {
    await shell.open();
    await pick();
    const hint = () => detail().querySelector<HTMLElement>('.search-shortcut')!;
    expect(hint().checkVisibility()).toBe(true);
    document.documentElement.dataset.singleKeys = 'off';
    try {
      expect(hint().checkVisibility()).toBe(false);
    } finally {
      delete document.documentElement.dataset.singleKeys;
    }
  });

  test('axe is clean with the field above the detail, in both themes', async () => {
    await shell.open();
    await pick();
    await expectAxeCleanOnce('light', 1280);
    await expectAxeCleanOnce('dark', 1280);
  });
});

describe('other tabs', () => {
  test('a function’s profile keeps the Functions search above it', async () => {
    await shell.open({ hash: '#tab=functions&function=language' });
    await expect.poll(() => detail().hidden).toBe(false);
    const field = detailField('Search functions');
    await userEvent.click(field);
    await userEvent.keyboard('memory');
    expect(list().hidden).toBe(false);
    expect(state().functionQuery).toBe('memory');
    expect((document.activeElement as HTMLInputElement).value).toBe('memory');
  });

  test('Circuits has no search, so its detail has none', async () => {
    await shell.open();
    const world = shell.app.world!;
    await userEvent.click(page.getByRole('tab', { name: 'Circuits' }));
    await world.excursions.openCircuit(world.circuits.all[0]!.id);
    flushSync();
    await expect.poll(() => detail().hidden).toBe(false);
    expect(detail().querySelector('input[type="search"]')).toBeNull();
  });
});

describe('the phone sheet', () => {
  test('the field is on screen and takes a tap', async () => {
    await shell.open();
    await page.viewport(375, 812);
    await pick();
    const field = detailField();
    await expect.poll(() => field.checkVisibility()).toBe(true);
    // Once the sheet the pick raised has come to rest.
    await expect.poll(() => field.getBoundingClientRect().bottom).toBeLessThanOrEqual(812);
    expect(field.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    await userEvent.click(field);
    await userEvent.keyboard('b');
    expect(document.activeElement).toBe(listField());
    expect(list().hidden).toBe(false);
  });
});
