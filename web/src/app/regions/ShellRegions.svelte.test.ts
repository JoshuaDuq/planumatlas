// The regions mounted together over the fake engine: what the shell hands every region (the one tooltip, the
// stage status in the stage, the dialogs at the app root) and that every port is registered once it has started.
import '../../styles/index.css';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createShell } from './shell-test-support.ts';

vi.mock('../../lib/core/assets/published-anatomy.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/core/assets/published-anatomy.ts')>()),
  loadAnatomies: async () => ({ default: 'cdmd', anatomies: [{ id: 'cdmd' }] }),
}));

const shell = createShell();
afterEach(() => shell.close());

const dialogs = () => [...document.querySelectorAll<HTMLDialogElement>('dialog')];
const titleOf = (dialog: HTMLDialogElement) => dialog.querySelector('h2')?.textContent;

/** Tabs until `target` has focus, as a keyboard reader reaches it. */
async function tabTo(target: Element) {
  for (let step = 0; document.activeElement !== target && step < 200; step++) {
    await userEvent.tab();
  }
  expect(document.activeElement).toBe(target);
}

describe('the stage status', () => {
  test('is in the stage landmark from the first moment: the download, then nothing once ready', async () => {
    await shell.open({ start: false });
    const main = document.querySelector('main#viewport')!;
    shell.app.session.setProgress({ loaded: 34, total: 100 });
    flushSync();
    expect(main.querySelector('progress')!.value).toBe(34);
    expect(shell.announcer.textContent).toBe('Loading anatomy…');

    shell.app.session.setLoaded();
    flushSync();
    expect(main.querySelector('progress')).toBeNull();
    await vi.waitFor(() => expect(shell.announcer.textContent).toBe('Anatomy loaded.'));
  });

  test('says a failed start, from the app’s failure, in the stage', async () => {
    await shell.open({ start: false });
    shell.app.fail(new Error('refused'), { text: 'This anatomy could not be opened.' });
    flushSync();
    const main = document.querySelector('main#viewport')!;
    expect(main.textContent).toContain('This anatomy could not be opened.');
    await vi.waitFor(() =>
      expect(shell.announcer.textContent).toBe('This anatomy could not be opened.'),
    );
  });
});

describe('the one tooltip', () => {
  test('serves the masthead by keyboard focus, and a control of the panels', async () => {
    await shell.open();
    await tabTo(page.getByRole('button', { name: 'More settings' }).element());
    await expect.element(page.getByRole('tooltip')).toHaveTextContent('More settings');
    expect(page.getByRole('tooltip').elements()).toHaveLength(1);

    const panelControl = [
      ...document.querySelectorAll<HTMLElement>('#workspace-panel [data-tooltip]'),
    ].find((control) => control.checkVisibility())!;
    // Keyboard modality, then focus on a control of the panels.
    await userEvent.tab();
    panelControl.focus();
    await expect
      .element(page.getByRole('tooltip'))
      .toHaveTextContent(panelControl.dataset.tooltip!);
    expect(page.getByRole('tooltip').elements()).toHaveLength(1);
  });
});

describe('the one tooltip, when its trigger goes', () => {
  test('a focused trigger that removes itself takes its tooltip with it', async () => {
    await shell.open();
    shell.engine.emit('pick', { id: 'destrieux:left:30', point: null });
    flushSync();
    const clear = document.querySelector<HTMLElement>('.region-detail .selection-clear')!;
    await userEvent.tab();
    clear.focus();
    await expect.element(page.getByRole('tooltip')).toHaveTextContent(clear.dataset.tooltip!);
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => expect(clear.isConnected).toBe(false));
    await vi.waitFor(() => expect(page.getByRole('tooltip').elements()).toHaveLength(0));
  });
});

describe('the dialogs', () => {
  test('four native dialogs are children of the app root, and an open one makes the regions inert', async () => {
    await shell.open();
    expect(dialogs().map(titleOf).sort()).toEqual(
      ['Feedback', 'Keyboard shortcuts', 'Provenance', 'MRI with tracts · MGH CDMD sub_013'].sort(),
    );
    for (const dialog of dialogs()) expect(dialog.parentElement).toBe(shell.target);
    // The Tracts MRI holds no navigator while closed.
    expect(shell.engine.tracts.navigators).toHaveLength(0);

    shell.app.ports.toggleShortcuts({ instant: true });
    flushSync();
    const open = dialogs().find((dialog) => dialog.open)!;
    expect(titleOf(open)).toBe('Keyboard shortcuts');
    expect(open.matches(':modal')).toBe(true);
    // The dialog's own header is not a second banner.
    expect(page.getByRole('banner').elements()).toHaveLength(1);
    const more = page.getByRole('button', { name: 'More settings' }).element() as HTMLElement;
    more.focus();
    expect(document.activeElement).not.toBe(more);
  });
});

describe('the ports', () => {
  test('every command reaches a region once the app has started, and every question is answered by one', async () => {
    await shell.open();
    const { ports } = shell.app;
    const { world } = shell.app;
    // The controllers open the Linked MRI once the scan has loaded.
    await shell.engine.sections.load();
    const commands: [string, unknown[]][] = [
      ['showDetail', []],
      ['showDetailInPlace', []],
      ['showList', []],
      ['revealOnSelect', ['destrieux:left:30']],
      ['back', []],
      ['focusSearch', ['anatomy']],
      ['walkTree', [1]],
      ['openFunction', [world!.engine.model.domains!.domains[0]!.id]],
      ['openDeficit', [world!.clinical.grouped('', 'en')[0]!.deficits[0]!.id]],
      ['openLessonMri', []],
      ['showMri', [{}]],
      ['openPreparedPlane', ['axial', () => true]],
      ['closeMpr', []],
      ['openMpr', [{ instant: true }]],
      ['openDiffusionMri', [{ instant: true }]],
      ['toggleShortcuts', [{ instant: true }]],
    ];
    for (const [name, args] of commands) {
      let outcome: unknown;
      try {
        outcome = (ports as unknown as Record<string, (...args: unknown[]) => unknown>)[name]!(
          ...args,
        );
      } catch (error) {
        // What the command does with these arguments is its feature's own rule.
        expect((error as Error).message, name).not.toMatch(/not mounted/);
      }
      await Promise.resolve(outcome).catch((error: Error) =>
        expect(error.message, name).not.toMatch(/not mounted/),
      );
    }
    expect(ports.shortcutsOpen()).toBe(true);
    expect(ports.diffusionMriOpen()).toBe(true);
    // The docked Linked MRI is open but holds no keys: the shortcuts dialog has focus.
    await vi.waitFor(() => expect(shell.target.querySelector(':scope > .mpr-dock')).not.toBeNull());
    expect(ports.mprOpen()).toBe(false);
  });

  test('a first visit to the plain page opens the guided tour over a drawn stage, follows a pick on the brain, and its close folds the tree back and hands focus to More settings', async () => {
    await shell.open({ hash: '#anatomy=cdmd&lang=en', firstVisit: true });
    const expanded = [...shell.app.session.state.expanded];
    const card = () => document.querySelector<HTMLElement>('.driver-popover');
    const title = () => card()?.querySelector('.driver-popover-title')!.textContent;
    const next = () =>
      card()!.querySelector<HTMLButtonElement>('.driver-popover-next-btn')!.click();
    // The tour's code is fetched as it starts.
    await vi.waitFor(() => expect(title()).toBe('Welcome to Planum'));
    next();
    next();
    expect(title()).toBe('Open a region');
    // A click on the brain opens the region, and with it its group in the tree; the tour hears the
    // pick and moves on to the region's detail (GUIDE-07).
    shell.engine.emit('pick', { id: 'destrieux:left:30', point: null });
    await vi.waitFor(() => expect(title()).toBe('The region in detail'), { timeout: 3000 });
    expect(shell.app.session.state.expanded.size).toBeGreaterThan(expanded.length);
    expect(location.hash).toContain('region=destrieux:left:30');
    card()!.querySelector<HTMLButtonElement>('.driver-popover-close-btn')!.click();
    expect(card()).toBeNull();
    expect([...shell.app.session.state.expanded]).toEqual(expanded);
    expect(document.activeElement).toBe(
      page.getByRole('button', { name: 'More settings' }).element(),
    );
  });

  test('kept tracts stay drawn on Functions, and letting them go gives the cortex back', async () => {
    await shell.open();
    const { engine } = shell;
    await page.getByRole('tab', { name: 'Tracts' }).click();
    await vi.waitFor(() => expect(engine.tracts.streamlinesVisible).toBe(true));
    await page.getByText('Tract display').click();
    const keep = page.getByRole('checkbox', { name: 'Keep tracts on other tabs' });
    await expect.element(keep).not.toBeChecked();
    await keep.click();
    await expect.element(keep).toBeChecked();
    await page.getByRole('tab', { name: 'Functions' }).click();
    expect(engine.tracts.streamlinesVisible).toBe(true);
    expect(engine.model.settings.cortexOpacity).toBe(engine.tracts.defaultOpacity);
    await page.getByRole('tab', { name: 'Tracts' }).click();
    await keep.click();
    await page.getByRole('tab', { name: 'Functions' }).click();
    expect(engine.tracts.streamlinesVisible).toBe(false);
    expect(engine.model.settings.cortexOpacity).toBe(1);
  });

  test('focusInDetail answers true in a region’s detail', async () => {
    await shell.open();
    expect(shell.app.ports.focusInDetail()).toBe(false);
    shell.engine.emit('pick', { id: 'destrieux:left:30', point: null });
    flushSync();
    page.getByRole('button', { name: 'Focus', exact: true }).element().focus();
    expect(shell.app.ports.focusInDetail()).toBe(true);
  });

  test('closing the app withdraws them', async () => {
    await shell.open();
    const { ports } = shell.app;
    ports.toggleShortcuts({ instant: true });
    expect(ports.shortcutsOpen()).toBe(true);
    shell.close();
    expect(() => ports.toggleShortcuts({ instant: true })).toThrow(/not mounted/);
    expect(ports.shortcutsOpen()).toBe(false);
  });
});
