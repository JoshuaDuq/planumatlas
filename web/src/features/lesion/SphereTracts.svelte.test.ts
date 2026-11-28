// A lesion's Tracts section lists the bundles it crosses; the ones it misses fold behind one line.
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { TRANSLATIONS } from '../../lib/core/i18n/index.ts';
import type { LesionStore } from '../../lib/state/lesion.svelte.ts';
import type { Language } from '../../lib/types/index.ts';
import SphereTracts from './SphereTracts.svelte';

afterEach(cleanup);

const NAMES: Record<string, string> = {
  'cst-right': 'Corticospinal tract · right',
  'af-left': 'Arcuate fasciculus · left',
  'af-right': 'Arcuate fasciculus · right',
  mcp: 'Middle cerebellar peduncle',
};

function mount(lang: Language, missed: string[]) {
  const crossings = [
    { id: 'cst-right', crossing: 775, total: 964 },
    ...missed.map((id) => ({ id, crossing: 0, total: 2000 })),
  ];
  const lesion = {
    bundles: crossings.map(({ id }) => id),
    counted: { status: 'ready', crossings },
    tractView: { status: 'idle' },
    selectedTract: null,
    countTracts() {},
    showTract() {},
    clearTract() {},
  } as unknown as LesionStore;
  render(SphereTracts, {
    lesion,
    lang,
    bundleName: (id: string) => NAMES[id]!,
    copy: TRANSLATIONS[lang].lesion,
  });
}

test('the bundles a lesion misses are counted on one line and named only once it is opened', async () => {
  mount('en', ['af-left', 'af-right', 'mcp']);
  await expect
    .element(page.getByRole('button', { name: /Corticospinal tract · right/ }))
    .toBeVisible();
  const summary = page.getByText('3 bundles not reached', { exact: true });
  await expect.element(summary).toBeVisible();
  const missed = [
    'Arcuate fasciculus · left',
    'Arcuate fasciculus · right',
    'Middle cerebellar peduncle',
  ];
  for (const name of missed)
    await expect.element(page.getByText(name, { exact: true })).not.toBeVisible();
  await summary.click();
  for (const name of missed)
    await expect.element(page.getByText(name, { exact: true })).toBeVisible();
});

test('one missed bundle is counted in the singular', async () => {
  mount('fr', ['mcp']);
  await expect.element(page.getByText('1 faisceau non atteint', { exact: true })).toBeVisible();
});
