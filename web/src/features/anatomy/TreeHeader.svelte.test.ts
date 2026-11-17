// The tree header's region table (WP24): the press saves the shown atlas and level as one CSV file.
import { afterEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import type { Region } from '../../lib/types/index.ts';
import Fixture from './anatomy-tree-test-support.svelte';

const area = {
  id: 'destrieux:left:1',
  label: 'G and S frontomargin · left',
  source_name: 'G_and_S_frontomargin',
  atlas: 'destrieux',
  hemisphere: 'left',
  kind: 'cortex',
  surface_area_mm2: 898.744924840933,
  centroid_ras_mm: [-18.193548387096776, 53.51404786680541, 39.37669094693028],
  anchor_ras_mm: [-18, 54, 39],
} as Region;
const table = { anatomy: 'cdmd', atlas: 'destrieux', detail: 'aseg', regions: [area] };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('Download table saves the shown atlas’s regions as one CSV file and says so', async () => {
  const saved: { name: string; href: string }[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push({ name: this.download, href: this.href });
  });
  render(Fixture, { table });
  await userEvent.click(page.getByRole('button', { name: 'Download table (CSV)' }));
  expect(saved.map(({ name }) => name)).toEqual(['planum-regions-cdmd-destrieux-aseg.csv']);
  const lines = (await (await fetch(saved[0]!.href)).text()).split('\r\n');
  expect(lines[1]!.startsWith('destrieux:left:1,destrieux,Frontomarginal gyrus and sulcus,')).toBe(
    true,
  );
  expect(lines).toHaveLength(3);
  expect(document.getElementById('announcer')!.textContent).toBe('Region table CSV downloaded.');
});

test('French names the command in French', () => {
  render(Fixture, { lang: 'fr', table });
  expect(page.getByRole('button', { name: 'Télécharger le tableau (CSV)' }).element()).toBeTruthy();
});
