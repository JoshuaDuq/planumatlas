// The workspace's lists composed as the app mounts them, over the fake engine and the published
// catalogues: a search in one tab offers the other tabs that find the same words and carries the
// words there (U1).
import '../../styles/index.css'; // The page's styles: a hidden panel takes no focus, as in the app.
import { flushSync } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createShell } from '../../app/regions/shell-test-support.ts';
import { sharedGroupNames } from '../../lib/core/panels/navigator.ts';
import { systemOptions } from '../anatomy/system-options.ts';

// The index of published brains is a file of the site, which the test page does not serve.
vi.mock('../../lib/core/assets/published-anatomy.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/core/assets/published-anatomy.ts')>()),
  loadAnatomies: async () => ({ default: 'cdmd', anatomies: [{ id: 'cdmd' }] }),
}));
// The system picker's walk of the regions, watched (WORK-31).
vi.mock('../anatomy/system-options.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../anatomy/system-options.ts')>();
  return { ...actual, systemOptions: vi.fn(actual.systemOptions) };
});

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
      .toBe(
        '2 tract bundles. Anatomy: 2 regions match “arcuate”. Circuits: 1 guided circuit matches “arcuate”.',
      );
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

  test('Circuits receives the bridged search and offers the named circuit', async () => {
    await shell.open({ hash: '#tab=deficits' });
    await type(
      page.getByRole('searchbox', { name: 'Search deficits or cognitive functions' }),
      'basal ganglia',
    );
    await page
      .getByRole('button', { name: 'Circuits: 1 guided circuit matches “basal ganglia”' })
      .click();
    await expect.poll(() => state().explorer).toBe('circuits');
    const search = page.getByRole('searchbox', { name: 'Search circuits' });
    expect(focused()).toBe(search.element());
    expect(focused().value).toBe('basal ganglia');
    await expect
      .element(page.getByRole('button', { name: /^Basal ganglia motor loops/ }))
      .toBeVisible();
    expect(state().lesson.circuit).toBeNull();
  });

  test('slash returns from a circuit overview to the list and focuses its search', async () => {
    await shell.open({ hash: '#tab=circuits' });
    const search = page.getByRole('searchbox', { name: 'Search circuits' });
    await expect.element(search).toBeVisible();
    await type(search, 'left dorsal lateral geniculate nucleus');
    await userEvent.keyboard('{Enter}{Enter}');
    await expect.element(page.getByRole('button', { name: 'Start route' })).toBeVisible();
    await userEvent.keyboard('/');
    expect(focused()).toBe(search.element());
    expect(focused().value).toBe('left dorsal lateral geniculate nucleus');
    expect(focused().selectionStart).toBe(0);
    expect(focused().selectionEnd).toBe(focused().value.length);
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

describe('a new view', () => {
  /** Draws the cut the changes below move. */
  async function drawCut() {
    await shell.engine.sections.setMode('axial');
    flushSync();
  }

  /** A camera preset, a selection and a moved cut, each a new view, with `walked` checked after each. */
  function viewChanges(walked: (change: string) => void) {
    const { engine } = shell;
    const [first, second] = engine.model.manifest.regions.filter(
      (region) => region.kind !== 'non-region' && engine.model.canSelect(region),
    );
    const [low, high] = engine.sections.offsetRange;
    const quarter = (high - low) / 4;
    const changes: Array<[string, () => void]> = [
      [
        'camera preset',
        () => shell.app.session.setView(state().view === 'left' ? 'oblique' : 'left'),
      ],
      [
        'selection',
        () => engine.model.select((state().selectedRegion?.id === first!.id ? second : first)!.id),
      ],
      [
        'cut position',
        () =>
          engine.sections.setOffset(
            engine.sections.offset > (low + high) / 2 ? low + quarter : high - quarter,
          ),
      ],
    ];
    for (const [change, act] of changes) {
      const before = state();
      act();
      flushSync();
      expect(state(), change).not.toBe(before);
      walked(change);
    }
  }

  test('the system picker walks no region on a camera preset, a selection or a moved cut; a hidden region or the language builds it again', async () => {
    await shell.open();
    const world = shell.app.world!;
    await world.anatomy.toggleInternalAnatomy();
    await drawCut();
    const picker = page.getByRole('combobox', { name: 'System' });
    await expect.element(picker).toBeVisible();
    const select = picker.element() as HTMLSelectElement;
    const groups = vi.spyOn(world.regions, 'groups');
    const options = vi.mocked(systemOptions);
    /** The picker's walks since the last call: the groups' and its options'. */
    const walks = () => {
      const made = [groups.mock.calls.length, options.mock.calls.length];
      groups.mockClear();
      options.mockClear();
      return made;
    };
    const listed = () => [...select.options].slice(1).map((option) => option.text);
    /** The systems as the picker listed them on every change before, for the engine's settings. */
    const expected = () => {
      const { detail, lang } = state();
      const everySystem = world.regions.groups({
        ...shell.engine.model.settings,
        internalSystem: null,
        lang,
      });
      const shared = sharedGroupNames(everySystem);
      const labels = systemOptions(shell.engine.model.manifest.regions, detail, lang, shared);
      walks();
      return labels.map((option) => option.label);
    };
    expect(listed()).toEqual(expected());
    const english = listed();
    walks();

    viewChanges((change) => {
      expect(select.isConnected, change).toBe(true);
      expect(walks(), change).toEqual([0, 0]);
      expect(listed(), change).toEqual(english);
    });

    // A hidden structure is a setting the list reads: the picker is built again, to the same systems.
    const hidden = shell.engine.model.manifest.regions.find(
      (region) =>
        region.kind === 'structure' &&
        region.id !== state().selectedRegion?.id &&
        shell.engine.model.canSelect(region),
    )!;
    shell.engine.model.hideRegions([hidden.id]);
    flushSync();
    expect(walks()).toEqual([1, 1]);
    expect(listed()).toEqual(english);

    shell.app.session.setLang('fr');
    flushSync();
    expect(walks()).toEqual([1, 1]);
    expect(listed()).toEqual(expected());
    expect(listed()).not.toEqual(english);
    shell.app.session.setView('oblique');
    flushSync();
    expect(walks()).toEqual([0, 0]);
  });

  test('a search held in Anatomy or counted for another tab is not run again on a camera preset, a selection or a moved cut', async () => {
    await shell.open();
    await drawCut();
    const search = vi.spyOn(shell.app.world!.regions, 'search');
    await type(regionsField(), 'putamen');
    await expect
      .element(page.getByRole('option', { name: /^Putamen, left/ }).first())
      .toBeVisible();
    search.mockClear();
    viewChanges((change) => expect(search, `Anatomy, ${change}`).not.toHaveBeenCalled());

    // A region is selected, so Functions opens on its list.
    await page.getByRole('tab', { name: 'Functions' }).click();
    await type(page.getByRole('searchbox', { name: 'Search functions' }), 'aphasia');
    await expect
      .element(page.getByRole('button', { name: /^Deficits: \d+ lesion profiles match/ }))
      .toBeVisible();
    // The Functions list counted the regions the words name, for its way on to Anatomy.
    expect(search.mock.calls.at(-1)).toEqual([
      'aphasia',
      expect.objectContaining({ lang: 'en' }),
      Infinity,
    ]);
    search.mockClear();
    viewChanges((change) => expect(search, `Functions, ${change}`).not.toHaveBeenCalled());

    // The language finds other names: both searches run again.
    shell.app.session.setLang('fr');
    flushSync();
    expect(search.mock.calls.map(([words]) => words).sort()).toEqual(['aphasia', 'putamen']);
  });
});
