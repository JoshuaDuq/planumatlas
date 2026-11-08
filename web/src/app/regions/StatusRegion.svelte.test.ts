// The status region as the app mounts it, over the fake engine: the colophon, its count and the
// Provenance button that opens the masthead region's dialog.
import '../../styles/index.css';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
import { t } from '../../lib/core/i18n/index.ts';
import { createShell } from './shell-test-support.ts';

vi.mock('../../lib/core/assets/published-anatomy.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/core/assets/published-anatomy.ts')>()),
  loadAnatomies: async () => ({ default: 'cdmd', anatomies: [{ id: 'cdmd' }] }),
}));

const shell = createShell();
afterEach(() => {
  shell.close();
  vi.restoreAllMocks();
});

const colophon = () => document.getElementById('colophon')!;
const count = () => colophon().querySelector('.region-count')!.textContent;
const footer = t('en', 'footer');

describe('what the status region holds', () => {
  test('one contentinfo, #colophon, with the statement, the description, the count and Provenance', async () => {
    await shell.open();
    expect(document.querySelectorAll('footer')).toHaveLength(1);
    expect(page.getByRole('contentinfo').elements()).toEqual([colophon()]);
    expect(colophon().querySelector('.colophon-statement')!.textContent).toBe(
      footer.statementAlone,
    );
    expect(colophon().querySelector('.colophon-description')!.textContent).toBe(
      footer.colophon(
        'MGH CDMD sub_013',
        shell.app.world!.engine.model.manifest.anatomy.individual,
      ),
    );
    expect(count()).toBe(footer.visibleRegions(shell.app.world!.catalog.visibleCount));
    await expect.element(page.getByRole('button', { name: 'Provenance' })).toBeVisible();
  });

  test('before the engine it states what this is and nothing about what is loaded', async () => {
    await shell.open({ start: false });
    expect(colophon().querySelector('.colophon-statement')!.textContent).toBe(
      footer.statementAlone,
    );
    expect(colophon().querySelector('.colophon-description')!.textContent).toBe('');
    expect(count()).toBe('');
    expect(page.getByRole('button', { name: 'Provenance' }).elements()).toHaveLength(0);
  });

  test('before the engine it follows the reader’s language', async () => {
    await shell.open({ start: false });
    shell.app.chooseLanguage('fr');
    flushSync();
    expect(colophon().querySelector('.colophon-statement')!.textContent).toBe(
      t('fr', 'footer').statementAlone,
    );
  });

  test('follows the reader’s language', async () => {
    await shell.open();
    shell.app.chooseLanguage('fr');
    flushSync();
    const fr = t('fr', 'footer');
    expect(colophon().querySelector('.colophon-statement')!.textContent).toBe(fr.statementAlone);
    expect(count()).toBe(fr.visibleRegions(shell.app.world!.catalog.visibleCount));
  });
});

describe('feedback', () => {
  test('sends a name and the feedback, with the view on screen, from inside Planum', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    await shell.open();
    await userEvent.click(page.getByRole('button', { name: 'Feedback' }));
    history.replaceState(null, '', '#atlas=hcp-mmp&lang=en');
    await userEvent.fill(page.getByRole('textbox', { name: 'Your name (optional)' }), 'Ada');
    await userEvent.fill(
      page.getByRole('textbox', { name: 'Your feedback' }),
      'The cut is lovely.',
    );
    await userEvent.click(page.getByRole('button', { name: 'Send' }));
    // Said in the panel, in place of the form, not only by the announcer.
    await expect
      .poll(() => document.querySelector('.feedback-said')?.textContent)
      .toBe('Thank you, your feedback was sent.');
    expect(page.getByRole('textbox', { name: 'Your feedback' }).elements()).toHaveLength(0);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://feedback.planumatlas.com');
    expect(init!.method).toBe('POST');
    const sent = JSON.parse(init!.body as string);
    expect(sent).toMatchObject({ name: 'Ada', message: 'The cut is lovely.' });
    expect(sent.view).toBe(`${location.origin}${location.pathname}#atlas=hcp-mmp&lang=en`);
  });

  test('says when it could not send, and offers the address to write to instead', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 400 }));
    await shell.open();
    await userEvent.click(page.getByRole('button', { name: 'Feedback' }));
    await userEvent.fill(page.getByRole('textbox', { name: 'Your feedback' }), 'Hello');
    await userEvent.click(page.getByRole('button', { name: 'Send' }));
    await expect
      .element(page.getByRole('button', { name: 'joshua.duquette.1@ulaval.ca, Copy' }))
      .toBeVisible();
    // What was typed stays, to be sent again or copied.
    expect(
      (page.getByRole('textbox', { name: 'Your feedback' }).element() as HTMLTextAreaElement).value,
    ).toBe('Hello');
  });

  test('sends nothing without feedback', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    await shell.open();
    await userEvent.click(page.getByRole('button', { name: 'Feedback' }));
    await userEvent.click(page.getByRole('button', { name: 'Send' }));
    expect(fetch).not.toHaveBeenCalledWith('https://feedback.planumatlas.com', expect.anything());
  });

  test('is offered before the engine too, in the reader’s language', async () => {
    await shell.open({ start: false });
    shell.app.chooseLanguage('fr');
    flushSync();
    await expect.element(page.getByRole('button', { name: 'Commentaires' })).toBeVisible();
  });
});

describe('the count', () => {
  test('a download nothing in the data bar holds is shown here', async () => {
    await shell.open();
    shell.app.session.setSwitching({ loaded: 34, total: 100 });
    flushSync();
    expect(count()).toBe(t('en', 'header').loadingProgress('34%'));
    shell.app.session.endSwitching();
    flushSync();
    expect(count()).toBe(footer.visibleRegions(shell.app.world!.catalog.visibleCount));
  });

  test('a download the data bar holds is shown there only', async () => {
    await shell.open();
    const { world } = shell.app;
    const other = world!.engine.model.manifest.detail_levels.find(
      ({ id }) => id !== world!.view.current.detail,
    )!;
    let finish!: () => void;
    const held = new Promise<void>((resolve) => (finish = resolve));
    const { setDetail } = world!.engine.model;
    vi.spyOn(world!.engine.model, 'setDetail').mockImplementation(async (id, progress) => {
      progress?.({ loaded: 34, total: 100 });
      await held;
      await setDetail(id);
    });
    await userEvent.selectOptions(
      page.getByRole('combobox', { name: 'Internal anatomy' }),
      other.id,
    );
    const detailOptions = () =>
      [
        ...page
          .getByRole('combobox', { name: 'Internal anatomy' })
          .element()
          .querySelectorAll('option'),
      ].map((option) => option.textContent);
    await expect
      .poll(() => detailOptions().filter((text) => text?.endsWith(' · Loading 34%')))
      .toHaveLength(1);
    expect(count()).toBe(footer.visibleRegions(world!.catalog.visibleCount));
    finish();
    await vi.waitFor(() => expect(shell.app.session.state.status).toBe('ready'));
    // The next download, started elsewhere, is the count's again.
    shell.app.session.setSwitching({ loaded: 50, total: 100 });
    flushSync();
    expect(count()).toBe(t('en', 'header').loadingProgress('50%'));
  });

  test('in the Tracts tab it counts the bundles drawn; alone, the reference is described as reference data', async () => {
    await shell.open({ tractAnatomy: 'reference-subject' });
    const { excursions, engine } = shell.app.world!;
    excursions.chooseExplorer('diffusion');
    await vi.waitFor(() => expect(engine.tracts.ready).toBe(true));
    flushSync();
    const catalog = tractCatalog('reference-subject');
    const drawn = () => engine.tracts.snapshot().filter((bundle) => bundle.visible);
    const { bundlesDrawn } = t('en', 'diffusion');
    expect(count()).toBe(bundlesDrawn(drawn().length, catalog.bundles.length));
    // Toggling a bundle off changes the count with it.
    const [first] = drawn();
    expect(first).toBeDefined();
    engine.tracts.setVisible(first!.id, false);
    flushSync();
    expect(count()).toBe(bundlesDrawn(drawn().length, catalog.bundles.length));
    expect(drawn().length).toBeLessThan(engine.tracts.snapshot().length);
    expect(colophon().querySelector('.colophon-description')!.textContent).toBe(
      footer.referenceColophon(catalog.name.en),
    );
  });
});

describe('the display settings in effect', () => {
  const readout = () => colophon().querySelector('.display-changes-text')?.textContent ?? null;
  const reset = () => page.getByRole('button', { name: 'Reset display' });

  test('are listed until Reset display gives back their defaults, and nothing else', async () => {
    await shell.open();
    const { world } = shell.app;
    const { anatomy, engine } = world!;
    anatomy.selectRegion('destrieux:left:30');
    anatomy.setHemisphere('left');
    anatomy.setCortexOpacity(0.5);
    anatomy.hideRegions(['destrieux:left:31']);
    anatomy.toggleFocus();
    flushSync();
    expect(readout()).toBe('Left hemisphere · Cortex 50% · 1 part hidden · Region focused');
    const camera = engine.camera.capture();
    const { atlas, detail, surfaceColor } = engine.model.settings;

    reset().element().focus();
    await userEvent.keyboard('{Enter}');
    flushSync();
    const view = world!.view.current;
    expect([view.hemisphere, view.cortexOpacity, view.hiddenRegions.size, view.focused]).toEqual([
      'both',
      1,
      0,
      false,
    ]);
    expect(view.selectedRegion?.id).toBe('destrieux:left:30');
    expect(engine.camera.capture()).toEqual(camera);
    expect({ atlas: view.atlas, detail: view.detail, surfaceColor: view.surfaceColor }).toEqual({
      atlas,
      detail,
      surfaceColor,
    });
    expect(readout()).toBeNull();
    expect(shell.announcer.textContent).toContain(t('en', 'display').displayReset);
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        page.getByRole('button', { name: 'Provenance' }).element(),
      ),
    );
  });

  test('Reset display replaces a standing notice and its action rather than joining them', async () => {
    await shell.open();
    const { anatomy, session } = shell.app.world!;
    anatomy.setCortexVisible(false);
    session.notify({ text: 'Cortex shown.', action: 'restore' });
    flushSync();
    await userEvent.click(reset());
    // Its own action: the display from before the reset, which the old notice's Restore was not.
    expect(session.state.notice).toEqual({
      text: t('en', 'display').displayReset,
      action: 'restore',
    });
    expect(shell.app.world!.view.current.cortexVisible).toBe(true);
    await userEvent.click(page.getByRole('button', { name: t('en', 'clinical').restore }));
    await vi.waitFor(() => expect(shell.app.world!.view.current.cortexVisible).toBe(false));
  });

  test('a lesson step’s own display is not listed; Reset display gives that display back', async () => {
    await shell.open({ hash: '#tab=circuits&circuit=vision&step=3' });
    const { anatomy, view, engine } = shell.app.world!;
    await vi.waitFor(() =>
      expect(view.current.selectedRegion?.id).toBe('learning:left:lateral-geniculate'),
    );
    flushSync();
    const step = { ...engine.model.settings };
    expect([step.hemisphere, step.focused]).toEqual(['left', true]);
    expect(readout()).toBeNull();

    anatomy.setHemisphere('both');
    anatomy.toggleFocus();
    flushSync();
    expect(readout()).toBe('Both hemispheres · Focus off');
    await userEvent.click(reset());
    const { hemisphere, cortexVisible, cortexOpacity, focused, hiddenRegions } =
      engine.model.settings;
    expect({ hemisphere, cortexVisible, cortexOpacity, focused, hiddenRegions }).toEqual({
      hemisphere: step.hemisphere,
      cortexVisible: step.cortexVisible,
      cortexOpacity: step.cortexOpacity,
      focused: step.focused,
      hiddenRegions: step.hiddenRegions,
    });
    expect(readout()).toBeNull();
  });

  test('a hidden cortex is listed, and Reset display shows it again', async () => {
    await shell.open();
    shell.app.world!.anatomy.setCortexVisible(false);
    flushSync();
    expect(readout()).toBe('Cortex hidden');
    await userEvent.click(reset());
    expect(shell.app.world!.view.current.cortexVisible).toBe(true);
    expect(readout()).toBeNull();
  });

  test('Tracts’ see-through cortex is its default, and a reset there keeps it until Tracts closes', async () => {
    await shell.open();
    const { excursions, anatomy, view } = shell.app.world!;
    excursions.chooseExplorer('diffusion');
    flushSync();
    const tractsOpacity = view.current.cortexOpacity;
    expect(tractsOpacity).toBeLessThan(1);
    expect(readout()).toBeNull();
    anatomy.setCortexOpacity(1);
    flushSync();
    expect(readout()).toBe('Cortex 100%');
    await userEvent.click(reset());
    expect(view.current.cortexOpacity).toBe(tractsOpacity);
    excursions.chooseExplorer('anatomy');
    flushSync();
    expect(view.current.cortexOpacity).toBe(1);
    expect(readout()).toBeNull();
  });

  test('the tract reference has no display settings to list', async () => {
    await shell.open({ tractAnatomy: 'reference-subject' });
    const { excursions, anatomy } = shell.app.world!;
    anatomy.setHemisphere('left');
    flushSync();
    expect(readout()).toBe('Left hemisphere');
    excursions.chooseExplorer('diffusion');
    flushSync();
    expect(readout()).toBeNull();
  });
});

describe('Provenance', () => {
  test('is in the reader’s language', async () => {
    await shell.open();
    shell.app.chooseLanguage('fr');
    flushSync();
    await userEvent.click(page.getByRole('button', { name: 'Provenance' }));
    const dialog = [...document.querySelectorAll('dialog')].find((candidate) => candidate.open)!;
    expect(dialog.textContent).toContain(t('fr', 'footer').intendedUse);
  });

  test('opens the dialog with a pointer, animated, and Escape returns focus to the button', async () => {
    await shell.open();
    const opener = page.getByRole('button', { name: 'Provenance' });
    await userEvent.click(opener);
    const dialog = [...document.querySelectorAll('dialog')].find(
      (candidate) => candidate.querySelector('h2')?.textContent === 'Provenance',
    )!;
    await vi.waitFor(() => expect(dialog.open).toBe(true));
    expect(dialog.hasAttribute('data-instant')).toBe(false);
    expect(dialog.textContent).toContain('Neuropsychological domains');
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(dialog.open).toBe(false));
    await vi.waitFor(() => expect(document.activeElement).toBe(opener.element()));
  });

  test('opens instantly from the keyboard', async () => {
    await shell.open();
    page.getByRole('button', { name: 'Provenance' }).element().focus();
    await userEvent.keyboard('{Enter}');
    const dialog = [...document.querySelectorAll('dialog')].find(
      (candidate) => candidate.querySelector('h2')?.textContent === 'Provenance',
    )!;
    await vi.waitFor(() => expect(dialog.open).toBe(true));
    expect(dialog.hasAttribute('data-instant')).toBe(true);
  });
});
