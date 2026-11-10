// The workspace's lists composed as the app mounts them, over the fake engine and the published
// catalogues: a search in one tab offers the other tabs that find the same words and carries the
// words there (U1).
import '../../styles/index.css'; // The page's styles: a hidden panel takes no focus, as in the app.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createShell } from '../../app/regions/shell-test-support.ts';

// The index of published brains is a file of the site, which the test page does not serve.
vi.mock('../../lib/core/assets/published-anatomy.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/core/assets/published-anatomy.ts')>()),
  loadAnatomies: async () => ({ default: 'cdmd', anatomies: [{ id: 'cdmd' }] }),
}));

const shell = createShell();
afterEach(() => shell.close());

const state = () => shell.app.world!.view.current;
const focused = () => document.activeElement as HTMLInputElement;
const regionsField = () =>
  page.getByRole('combobox', { name: /^(Search regions|Rechercher des régions)$/ });

/** Types into a field the reader clicked. */
async function type(field: { element(): Element }, words: string) {
  (field.element() as HTMLElement).focus();
  await userEvent.keyboard(words);
}

describe('from Anatomy', () => {
  test('a symptom is no region: Deficits is offered, said, and the words land in its search', async () => {
    await shell.open();
    await type(regionsField(), 'aphasia');
    const count = shell.app.world!.clinical.search('aphasia', 'en').length;
    await expect.element(page.getByText('No match for “aphasia”')).toBeVisible();
    await expect.element(page.getByText(`${count} matches in Deficits.`)).toBeVisible();
    expect(page.getByText(/^Try another spelling/).elements()).toEqual([]);
    await expect
      .poll(() => shell.announcer.textContent)
      .toBe(`No match for “aphasia”. ${count} matches in Deficits.`);

    await page.getByRole('button', { name: 'Show in Deficits' }).click();
    await expect.poll(() => state().explorer).toBe('deficits');
    expect(state().clinicalQuery).toBe('aphasia');
    expect(focused()).toBe(
      page.getByRole('searchbox', { name: 'Search deficits or cognitive functions' }).element(),
    );
    expect(focused().value).toBe('aphasia');
    await expect.element(page.getByRole('button', { name: /^Aphasia/ }).first()).toBeVisible();
  });

  test('the arcuate nucleus is listed, and the arcuate fasciculus is offered in Tracts', async () => {
    await shell.open();
    await type(regionsField(), 'arcuate');
    await expect
      .element(page.getByRole('option', { name: /^Arcuate nucleus of hypothalamus, left/ }))
      .toBeVisible();
    await expect.element(page.getByText('2 matches in Tracts.')).toBeVisible();
    await page.getByRole('button', { name: 'Show in Tracts' }).click();
    await expect.poll(() => state().explorer).toBe('diffusion');
    expect(focused()).toBe(page.getByRole('searchbox', { name: 'Search tracts' }).element());
    expect(focused().value).toBe('arcuate');
    const shown = [...document.querySelectorAll('#native-tract-bundles section.bundle')]
      .filter((row) => row.checkVisibility())
      .map((row) => row.querySelector('.name')!.id);
    expect(shown).toEqual(['native-tract-row-af']);
  });

  test('in French, the French name finds the French catalogue', async () => {
    await shell.open({ hash: '#lang=fr' });
    await type(regionsField(), 'aphasie');
    await expect
      .element(page.getByText(/^\d+ correspondances dans l’onglet Déficits\.$/))
      .toBeVisible();
    await page.getByRole('button', { name: 'Afficher dans l’onglet Déficits' }).click();
    await expect.poll(() => state().explorer).toBe('deficits');
    expect(state().clinicalQuery).toBe('aphasie');
  });
});

describe('from the other lists', () => {
  test('Tracts offers the regions of the same name, and the words land in the region search', async () => {
    await shell.open({ hash: '#tab=diffusion' });
    await type(page.getByRole('searchbox', { name: 'Search tracts' }), 'arcuate');
    const bridge = page.getByRole('button', { name: 'Anatomy: 2 regions match “arcuate”' });
    await expect.element(bridge).toBeVisible();
    await expect
      .poll(() => shell.announcer.textContent)
      .toBe('2 tract bundles. Anatomy: 2 regions match “arcuate”.');
    await bridge.click();
    await expect.poll(() => state().explorer).toBe('anatomy');
    expect(focused()).toBe(regionsField().element());
    expect(focused().value).toBe('arcuate');
    await expect
      .element(page.getByRole('option', { name: /^Arcuate nucleus of hypothalamus, left/ }))
      .toBeVisible();
  });

  test('Deficits lists every other tab that finds the words, in tab order', async () => {
    await shell.open({ hash: '#tab=deficits' });
    await type(
      page.getByRole('searchbox', { name: 'Search deficits or cognitive functions' }),
      'corticospinal',
    );
    await expect
      .element(page.getByRole('button', { name: /^Anatomy: \d+ regions match/ }))
      .toBeVisible();
    const bridges = [...document.querySelectorAll('#navigator .search-bridge')]
      .filter((bridge) => bridge.checkVisibility())
      .map((bridge) => bridge.textContent!.trim());
    expect(bridges).toEqual([
      'Anatomy: 4 regions match “corticospinal”',
      'Circuits: 1 guided circuit matches “corticospinal”',
      'Tracts: 2 tract bundles match “corticospinal”',
    ]);
  });

  test('the one circuit the words name opens', async () => {
    await shell.open({ hash: '#tab=deficits' });
    await type(
      page.getByRole('searchbox', { name: 'Search deficits or cognitive functions' }),
      'basal ganglia',
    );
    await page
      .getByRole('button', { name: 'Circuits: 1 guided circuit matches “basal ganglia”' })
      .click();
    await expect.poll(() => state().explorer).toBe('circuits');
    await expect.poll(() => state().lesson.circuit).toBe('motor');
  });

  test('Functions offers Deficits as before, now with focus in its search', async () => {
    await shell.open({ hash: '#tab=functions' });
    await type(page.getByRole('searchbox', { name: 'Search functions' }), 'aphasia');
    await page.getByRole('button', { name: /^Deficits: \d+ lesion profiles match/ }).click();
    await expect.poll(() => state().explorer).toBe('deficits');
    expect(focused()).toBe(
      page.getByRole('searchbox', { name: 'Search deficits or cognitive functions' }).element(),
    );
  });
});
