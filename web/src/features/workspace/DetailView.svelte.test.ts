// The detail view as the app mounts it, over the fake engine and the published catalogues: the search
// of the tab in front is an icon in its location bar (WORK-29), so the subject's title follows the
// navigation, and the region's sheet leads with what the region is (INSP-61).
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
/** The location bar's search icon. */
const searchIcon = (name = 'Search regions') =>
  page.getByRole('button', { name, exact: true }).element() as HTMLButtonElement;
const listField = () => page.getByRole('combobox', { name: 'Search regions' }).element();

async function pick(id = REGION) {
  shell.engine.emit('pick', { id, point: null });
  flushSync();
  await expect.poll(() => detail().hidden).toBe(false);
}

describe('a region’s detail', () => {
  test('the region search is an icon in the location bar; it shows the list with its field in focus', async () => {
    await shell.open();
    await pick();
    expect(detail().querySelector('input[type="search"]')).toBeNull();
    const icon = searchIcon();
    expect(detail().querySelector('.detail-location')!.contains(icon)).toBe(true);
    expect(icon.getAttribute('aria-keyshortcuts')).toBe('/');
    // The region's title comes right after the navigation.
    const bar = detail().querySelector('.detail-location')!.getBoundingClientRect();
    const title = page.getByRole('heading', { level: 2, name: /./ }).first().element();
    expect(title.getBoundingClientRect().top - bar.bottom).toBeLessThan(40);

    await userEvent.click(icon);
    expect(list().hidden).toBe(false);
    expect(detail().hidden).toBe(true);
    expect(document.activeElement).toBe(listField());
    // `c` is Cortex and `a` nothing; in the field they are letters.
    await userEvent.keyboard('broca');
    expect(state().query).toBe('broca');
    expect(state().cortexVisible).toBe(true);
    expect(state().selectedRegion?.id).toBe(REGION);
  });

  test('`/` from the detail still focuses the list’s own search', async () => {
    await shell.open();
    await pick();
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(listField());
  });

  test('leads with what the region is: its network and the deficits mapped on it', async () => {
    await shell.open();
    // The left precentral gyrus.
    await pick('destrieux:left:29');
    const lead = detail().querySelector('.region-lead')!;
    expect(lead.textContent).toMatch(/^Network: Somatomotor 69\s?%\. Linked deficits: .+\.$/);
    // Before the commands and the folded measurements.
    const focus = page.getByRole('button', { name: 'Focus', exact: true }).element();
    expect(lead.compareDocumentPosition(focus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('axe is clean with the search icon above the detail, in both themes', async () => {
    await shell.open();
    await pick();
    await expectAxeCleanOnce('light', 1280);
    await expectAxeCleanOnce('dark', 1280);
  });
});

describe('other tabs', () => {
  test('a function’s profile has the Functions search icon', async () => {
    await shell.open({ hash: '#tab=functions&function=language' });
    await expect.poll(() => detail().hidden).toBe(false);
    await userEvent.click(searchIcon('Search functions'));
    expect(list().hidden).toBe(false);
    await userEvent.keyboard('memory');
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
    expect(detail().querySelector('.detail-search')).toBeNull();
  });
});

describe('the phone sheet', () => {
  test('the search icon is on screen and takes a tap', async () => {
    await shell.open();
    await page.viewport(375, 812);
    // A pick at peek names the region in the grip; picking it again raises the sheet (REGION-25).
    await pick();
    await pick();
    const icon = searchIcon();
    await expect.poll(() => icon.checkVisibility()).toBe(true);
    // Once the sheet the second pick raised has come to rest.
    await expect.poll(() => icon.getBoundingClientRect().bottom).toBeLessThanOrEqual(812);
    expect(icon.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await userEvent.click(icon);
    expect(document.activeElement).toBe(listField());
    expect(list().hidden).toBe(false);
  });
});
