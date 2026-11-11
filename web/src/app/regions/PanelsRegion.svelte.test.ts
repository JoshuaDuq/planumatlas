// The panel region as the app mounts it, over the fake engine: the ports it hands the controllers and
// the keymap, the workspace in the sheet, and the wiring between the explorers and the controllers.
import '../../styles/index.css'; // The page's styles: a hidden panel takes no focus, as in the app.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import manifestFile from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import domainsFile from '../../../../public/models/cdmd/neuropsych-domains.json' with { type: 'json' };
import strokeFile from '../../../../public/models/cdmd/stroke-cases.json' with { type: 'json' };
import {
  domainName,
  domainRecord,
  validateNeuropsychDomains,
} from '../../lib/core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import { t } from '../../lib/core/i18n/index.ts';
import { methodsHref } from '../../lib/core/methods.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import { createApp } from '../application.svelte.ts';
import type { App } from '../application.svelte.ts';
import AppShell from '../App.svelte';
import { shellOptions, startApp } from '../boot.ts';
import { expectAxeCleanFitted } from './shell-test-support.ts';

// The index of published brains is a file of the site, which the test page does not serve.
vi.mock('../../lib/core/assets/published-anatomy.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/core/assets/published-anatomy.ts')>()),
  loadAnatomies: async () => ({ default: 'cdmd', anatomies: [{ id: 'cdmd' }] }),
}));

const manifest = manifestFile as unknown as Manifest;
const domains = validateNeuropsychDomains(
  domainsFile as unknown as NeuropsychDomains,
  new Map(manifest.regions.map((region) => [region.id, region])),
);
const REGION = 'destrieux:left:30';

let engine: FakeEngine;
let app: App;
let shell: Record<string, unknown> | null;
let target: HTMLElement;
let announcer: HTMLElement;
let detach: () => void;

/** Mounts the shell and starts the app on a link, as main.ts does. */
async function boot(hash = '') {
  history.replaceState(null, '', `${location.pathname}${hash}`);
  app = createApp();
  shell = mount(AppShell, { target, ...shellOptions(app) });
  // As the real engine does: its canvas is the stage's first child, which axe reads as an image.
  await startApp(app, async ({ host }) => {
    host.prepend(engine.canvas);
    return engine;
  });
  flushSync();
  return app.world!;
}

const press = (key: string, at: Element = document.body) =>
  at.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const list = () => document.getElementById('navigator')!;
const detail = () => document.getElementById('inspector')!;
const sheet = () => document.getElementById('sheet')!;
const detailOrList = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const cameraCalls = (method: string) =>
  engine.calls.filter((call) => call.domain === 'camera' && call.method === method);
const nameOf = (id: string) => app.world!.catalog.label(id).name;

/** Starts again on a link that needs what the first boot knew (a lesson's landmark). */
async function reboot(hash: string) {
  app.dispose();
  unmount(shell!);
  shell = null;
  engine = createFakeEngine({ manifest, domains: domains as never });
  return boot(hash);
}

beforeEach(async () => {
  await page.viewport(1280, 800);
  engine = createFakeEngine({ manifest, domains: domains as never });
  target = document.body.appendChild(document.createElement('div'));
  target.id = 'app';
  announcer = document.body.appendChild(document.createElement('p'));
  detach = attachAnnouncer(announcer);
  localStorage.clear();
  // The guided tour opens on a first visit; these cases are not one (ShellRegions.svelte.test.ts).
  localStorage.setItem('planum.guide', 'seen');
});
afterEach(() => {
  app.dispose();
  if (shell) unmount(shell);
  shell = null;
  detach();
  announcer.remove();
  target.remove();
  history.replaceState(null, '', location.pathname);
  vi.restoreAllMocks();
});

describe('before the engine', () => {
  test('the landmark holds only the list’s skeleton, hidden from assistive technology', async () => {
    app = createApp();
    shell = mount(AppShell, { target, ...shellOptions(app) });
    flushSync();
    const aside = target.querySelector('aside')!;
    expect(aside.getAttribute('aria-label')).toBe(t('en', 'workspace').panelAria);
    expect(aside.children).toHaveLength(1);
    expect(aside.querySelector('#tree')!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('selection', () => {
  test('a region picked on the model opens its detail, named in the strip of another mode', async () => {
    await boot();
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    expect(list().hidden).toBe(true);
    await expect
      .element(page.getByRole('heading', { level: 2, name: nameOf(REGION) }))
      .toBeVisible();

    await userEvent.click(page.getByRole('tab', { name: 'Functions' }));
    await expect
      .element(page.getByRole('button', { name: `${nameOf(REGION)} L, left` }))
      .toBeVisible();
  });

  test('the tab title names the selected region and its side, and only Planum once it is cleared', async () => {
    const world = await boot();
    expect(document.title).toBe('Planum');
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    expect(document.title).toBe(`${nameOf(REGION)}, left — Planum`);
    world.anatomy.selectRegion(null);
    flushSync();
    expect(document.title).toBe('Planum');
  });

  test('the inspector’s Hide hands focus to the dissection’s Undo in the list', async () => {
    await boot();
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    // Isolate and Hide wait behind More.
    await userEvent.click(page.getByRole('button', { name: 'More', exact: true }));
    await userEvent.click(page.getByRole('button', { name: 'Hide', exact: true }));
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(page.getByRole('button', { name: 'Undo' }).element()),
    );
    expect(list().hidden).toBe(false);
    expect(engine.model.state.hiddenRegions.has(REGION)).toBe(true);
  });

  test('a side hidden from its key in the tree says the part with the count it changed', async () => {
    const world = await boot();
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    app.ports.back();
    flushSync();
    // A neighbour in the selected region's open group: hiding the selection would also clear it.
    const rows = world.catalog.groups.find((group) =>
      group.rows.some((row) => row.region.id === REGION),
    )!.rows;
    const other = rows.find((row) => row.region.id !== REGION && row.region.hemisphere === 'left')!;
    const name = nameOf(other.region.id);
    page
      .getByRole('button', { name: `${name}, left`, exact: true })
      .element()
      .focus();
    await userEvent.keyboard('v');
    await vi.waitFor(() =>
      expect(announcer.textContent).toBe(`Hidden: ${name}, left. 1 part hidden`),
    );
    expect(engine.model.state.hiddenRegions.has(other.region.id)).toBe(true);
  });
});

describe('what each tab shows (1.4)', () => {
  test.each([
    ['Anatomy', 'anatomy'],
    ['Functions', 'functions'],
    ['Deficits', 'deficits'],
    ['Circuits', 'circuits'],
    ['Tracts', 'tracts'],
  ] as const)(
    'the %s list says its scope under its controls and ends with About this data',
    async (name, place) => {
      await boot();
      await userEvent.click(page.getByRole('tab', { name }));
      flushSync();
      const copy = t('en', 'info');
      await expect
        .poll(() => list().querySelector(`[data-scope="${place}"]`)?.textContent)
        .toBe(copy[place].scope);
      const about = list().querySelector<HTMLElement>(`[data-about="${place}"]`)!;
      const details = about.querySelector('details')!;
      expect(details.open).toBe(false);
      await userEvent.click(about.querySelector<HTMLElement>('summary')!);
      expect(details.open).toBe(true);
      expect([...about.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual([
        copy.shows,
        copy.source,
        copy.caution,
      ]);
      const links = [...about.querySelectorAll('a')];
      expect(links.at(-1)!.getAttribute('href')).toBe(methodsHref(place));
    },
  );
});

describe('clinical material in the Deficits list (4.2)', () => {
  const links = () => [...list().querySelectorAll<HTMLElement>('.clinical-links .link-row')];
  const notice = () => document.querySelector('.notice-text')?.textContent ?? null;
  const deficits = async () => {
    await userEvent.click(page.getByRole('tab', { name: 'Deficits' }));
    flushSync();
  };

  test('DEF-37 · Simulate a lesion stands above the groups and opens the Lesion tool', async () => {
    await boot();
    await deficits();
    // No cohort published: the stroke cases row is not offered.
    expect(links().map((row) => row.textContent!.trim())).toEqual(['Simulate a lesion']);
    const first = list().querySelector('.clinical-links')!;
    // The navigator holds every tab's list: the groups are this one's.
    const groups = first.parentElement!.querySelector(':scope > [role="group"][aria-labelledby]')!;
    expect(first.compareDocumentPosition(groups) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(links()[0]!);
    // Add opens on Lesion, whatever it last held.
    const add = document.querySelector<HTMLElement>('.stage-tool[data-tool="place"]')!;
    await expect.poll(() => add.getAttribute('aria-expanded')).toBe('true');
    await expect
      .poll(() => page.getByRole('radio', { name: 'Lesion', exact: true }).element().ariaChecked)
      .toBe('true');
    // A search shows the list alone.
    await userEvent.click(page.getByRole('searchbox', { name: /search deficits/i }));
    await userEvent.keyboard('aphasia');
    await expect.poll(() => links().length).toBe(0);
  });

  test('DEF-38 · Stroke cases says to select a region, then opens the selected region’s cases', async () => {
    engine = createFakeEngine({
      manifest,
      domains: domains as never,
      strokeCases: strokeFile as never,
    });
    await boot();
    await deficits();
    const stroke = () => links().find((row) => row.textContent!.trim() === 'Stroke cases')!;
    await userEvent.click(stroke());
    expect(notice()).toBe('Select a region to see the stroke cases whose lesion reaches it.');
    // The left supramarginal gyrus: one of the regions most cases reach.
    engine.emit('pick', { id: 'destrieux:left:26', point: null });
    flushSync();
    await deficits();
    await userEvent.click(stroke());
    const section = () => detail().querySelector<HTMLDetailsElement>('.stroke-cases details');
    await expect.poll(() => section()?.open).toBe(true);
    await expect.poll(() => document.activeElement).toBe(section()!.querySelector('summary'));
  });
});

describe('a function on the reader’s own atlas (3.1)', () => {
  test('FUNC-48 · on Julich-Brain a function opened from Reported here paints there and keeps the area selected', async () => {
    const area = manifest.regions.find(
      (entry) =>
        entry.atlas === 'julich' &&
        entry.source_name === 'Area 44 (IFG)' &&
        entry.hemisphere === 'left',
    )!;
    const world = await boot('#atlas=julich&lang=en');
    engine.emit('pick', { id: area.id, point: null });
    flushSync();
    await userEvent.click(page.getByRole('tab', { name: 'Functions' }));
    flushSync();
    // Back to the list, where the area's functions lead.
    world.anatomy.selectRegion(area.id);
    app.ports.showList();
    flushSync();
    const row = list().querySelector<HTMLElement>(
      '[data-region-functions] [data-function="language"]',
    )!;
    await userEvent.click(row);
    await expect.poll(() => world.view.current.selectedFunction).toBe('language');
    await expect.poll(() => world.view.current.paint?.id).toBe('function:language');
    expect(world.view.current.atlas).toBe('julich');
    expect(world.view.current.selectedRegion?.id).toBe(area.id);
    expect(
      [...world.view.current.paint!.colors.keys()].every((id) =>
        /^(julich|aseg|learning):/.test(id),
      ),
    ).toBe(true);
    // Not borrowed: the masthead shows no "via Functions".
    expect(document.querySelector('#masthead')!.textContent).not.toContain('via Functions');
  });
});

describe('a tract’s profile (4.3)', () => {
  const profile = () => detail().querySelector<HTMLElement>('.tract-profile');

  test('TRACT-50 · a tract’s name opens its profile under ‹ Tracts: data first, the method last', async () => {
    await boot();
    await userEvent.click(page.getByRole('tab', { name: 'Tracts' }));
    flushSync();
    const name = list().querySelector<HTMLButtonElement>('button.drill#native-tract-row-cst')!;
    expect(name.textContent!.trim()).toBe('Corticospinal tract');
    // The keys still toggle what is drawn: they are not inside the name.
    expect(name.querySelector('input')).toBeNull();
    await userEvent.click(name);
    await expect.poll(profile).not.toBeNull();
    expect(list().hidden).toBe(true);
    expect(document.activeElement).toBe(profile()!.querySelector('h2'));
    expect(profile()!.querySelector('h2')!.textContent).toBe('Corticospinal tract');
    const runs = [...profile()!.querySelectorAll('.runs li')].map((li) => li.textContent!.trim());
    expect(runs).toEqual([
      'Left: 731 streamlines in this tracking run',
      expect.stringMatching(/^Right: [\d,]+ streamlines in this tracking run$/),
    ]);
    const first = profile()!.querySelector('.end-list li')!;
    expect(first.querySelector('.end-name')!.textContent).toBe(nameOf('destrieux:left:29'));
    expect(first.querySelector('.end-share')!.textContent).toBe('18%');
    // Data first, then the command, then how it was counted.
    const children = [...profile()!.children].map((child) => child.className.split(' ')[0]);
    expect(children.slice(-3)).toEqual(['ends', 'primary', 'note']);
    // Back returns to the list, with the tract's row marked as the one opened.
    await userEvent.click(page.getByRole('button', { name: /Tracts/ }).first());
    await expect.poll(() => list().hidden).toBe(false);
    expect(name.getAttribute('aria-current')).toBe('true');
  });

  test('TRACT-51 · a region picked on the stage takes the detail from the profile', async () => {
    await boot();
    await userEvent.click(page.getByRole('tab', { name: 'Tracts' }));
    await userEvent.click(list().querySelector<HTMLButtonElement>('#native-tract-row-af')!);
    await expect.poll(profile).not.toBeNull();
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    expect(profile()).toBeNull();
    await expect
      .element(page.getByRole('heading', { level: 2, name: nameOf(REGION) }))
      .toBeVisible();
  });
});

describe('a stage pick that replaces a region being read', () => {
  const OTHER = 'destrieux:left:12';
  const selected = () => app.world!.view.current.selectedRegion?.id ?? null;
  const body = () => detail().querySelector<HTMLElement>('.detail-body')!;
  const sections = () => [
    ...detail().querySelectorAll<HTMLDetailsElement>('.region-detail details'),
  ];
  const notice = () => document.querySelector<HTMLElement>('.notice');

  test('STAGE-56 · with a section open, a pick says what it replaced, and Undo puts that region back where it was read', async () => {
    await boot();
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    const section = sections().find((element) => !element.open)!;
    section.querySelector('summary')!.click();
    flushSync();
    body().scrollTop = 160;
    const scrolled = body().scrollTop;
    expect(scrolled).toBeGreaterThan(0);

    engine.emit('pick', { id: OTHER, point: null });
    flushSync();
    expect(selected()).toBe(OTHER);
    expect(notice()!.querySelector('.notice-text')!.textContent).toBe(
      `A click on the brain replaced ${nameOf(REGION)}.`,
    );
    const undo = notice()!.querySelector<HTMLElement>('.notice-action')!;
    expect(undo.textContent!.trim()).toBe('Undo');

    await userEvent.click(undo);
    expect(selected()).toBe(REGION);
    expect(section.open).toBe(true);
    await expect.poll(() => body().scrollTop).toBe(scrolled);
    expect(notice()).toBeNull();
  });

  test('STAGE-56 · another choice takes the offer away for good; an Undo no longer in reach does nothing', async () => {
    const THIRD = 'destrieux:left:38';
    await boot();
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    sections()[0]!.querySelector('summary')!.click();
    flushSync();
    engine.emit('pick', { id: OTHER, point: null });
    flushSync();
    expect(notice()!.querySelector('.notice-action')).not.toBeNull();
    // The tree's choice is not the stage's: the offer goes.
    app.world!.anatomy.selectRegion(THIRD);
    flushSync();
    expect(notice()?.querySelector('.notice-action') ?? null).toBeNull();
    // Coming back to the click's region does not bring an old offer back.
    app.world!.anatomy.selectRegion(OTHER);
    flushSync();
    expect(app.world!.anatomy.pickUndoable).toBe(false);
    expect(notice()?.querySelector('.notice-action') ?? null).toBeNull();
    app.world!.anatomy.selectRegion(THIRD);
    app.world!.anatomy.undoPick();
    expect(selected()).toBe(THIRD);
  });

  test('STAGE-57 · a section left open from an earlier region is not the reader’s place in this one', async () => {
    const THIRD = 'destrieux:left:38';
    await boot();
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    sections()[0]!.querySelector('summary')!.click();
    flushSync();
    engine.emit('pick', { id: OTHER, point: null });
    flushSync();
    expect(notice()).not.toBeNull();
    // At the new region the section is still open, as sections are, but the reader opened nothing here.
    engine.emit('pick', { id: THIRD, point: null });
    flushSync();
    expect(selected()).toBe(THIRD);
    expect(notice()).toBeNull();
  });

  test('STAGE-57 · nothing opened or scrolled: a pick replaces the region and says nothing', async () => {
    await boot();
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    expect(sections().every((element) => !element.open)).toBe(true);
    expect(body().scrollTop).toBe(0);
    engine.emit('pick', { id: OTHER, point: null });
    flushSync();
    expect(selected()).toBe(OTHER);
    expect(notice()).toBeNull();
    // The same region again is a request to read it, not a replacement.
    sections()[0]!.querySelector('summary')!.click();
    flushSync();
    engine.emit('pick', { id: OTHER, point: null });
    flushSync();
    expect(notice()).toBeNull();
  });
});

describe('accessibility', () => {
  // Two tests, not one: each state is four whole-panel axe runs (two themes, two widths).
  test('the composed panel passes axe on a region’s detail', async () => {
    await boot();
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    await expectAxeCleanFitted();
  });

  test('the composed panel passes axe on the list it goes back to', async () => {
    await boot();
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    app.ports.back();
    flushSync();
    await expectAxeCleanFitted();
  });
});

describe('the keymap’s ports', () => {
  test('/ from the detail shows the list and focuses the search in front', async () => {
    await boot();
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    expect(detail().hidden).toBe(false);
    press('/');
    expect(document.activeElement).toBe(
      page.getByRole('combobox', { name: 'Search regions' }).element(),
    );
  });

  test('Escape inside the detail is Back to the list', async () => {
    await boot();
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    const focus = page.getByRole('button', { name: 'Focus', exact: true }).element() as HTMLElement;
    focus.focus();
    press('Escape', focus);
    flushSync();
    expect(detail().hidden).toBe(true);
    expect(engine.model.state.selectedRegion?.id).toBe(REGION);
  });
});

describe('the anatomy search', () => {
  test('a cut-label switch that fails is said in the notice, not swallowed', async () => {
    // No cut has chosen its labels yet, so a NextBrain region is found under another cut atlas.
    const cutOnly = 'nextbrain:left:7';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const setCutAtlas = vi
      .spyOn(engine.sections, 'setCutAtlas')
      .mockRejectedValue(new Error('offline'));
    await boot();
    await userEvent.fill(page.getByRole('combobox', { name: 'Search regions' }), nameOf(cutOnly));
    await userEvent.click(page.getByRole('button', { name: 'Switch cut labels' }));
    expect(setCutAtlas).toHaveBeenCalledWith('nextbrain');
    await vi.waitFor(() =>
      expect(app.session.state.notice?.text).toBe(t('en', 'errors').operations.layer('NextBrain')),
    );
  });
  test('a cut-label switch that failed and then succeeds takes its error away', async () => {
    const cutOnly = 'nextbrain:left:7';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const setCutAtlas = vi
      .spyOn(engine.sections, 'setCutAtlas')
      .mockRejectedValueOnce(new Error('offline'));
    await boot();
    await userEvent.fill(page.getByRole('combobox', { name: 'Search regions' }), nameOf(cutOnly));
    await userEvent.click(page.getByRole('button', { name: 'Switch cut labels' }));
    await vi.waitFor(() => expect(app.session.state.notice?.kind).toBe('error'));
    await userEvent.click(page.getByRole('button', { name: 'Switch cut labels' }));
    expect(setCutAtlas).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(app.session.state.notice).toBeNull());
  });
});

describe('the explorers’ entry points', () => {
  test('a link to a function opens its profile through the Functions panel, which focuses its name', async () => {
    const id = domains.domains[0]!.id;
    await boot(`#tab=functions&function=${id}`);
    const title = detail().querySelector<HTMLElement>('[data-function-title]')!;
    await vi.waitFor(() => expect(document.activeElement).toBe(title));
    expect(detail().hidden).toBe(false);
  });

  test('a lesson opened from the Circuits list puts its stepper and its circuit in the location bar', async () => {
    const world = await boot();
    const circuit = world.circuits.all[0]!;
    await userEvent.click(page.getByRole('tab', { name: 'Circuits' }));
    await userEvent.click(detailOrList('[data-circuit]'));
    await expect.element(page.getByRole('group', { name: 'Landmarks' })).toBeVisible();
    await expect
      .element(page.getByRole('navigation', { name: 'Breadcrumb' }))
      .toHaveTextContent(`Circuits ${circuit.name.en}`);
    // It opens on the whole route, which selects nothing; Next opens the first landmark.
    expect(detail().querySelector('.region-detail')).toBeNull();
    await userEvent.click(page.getByRole('button', { name: 'Next landmark' }));
    await expect
      .poll(() => detail().querySelector('.region-detail')?.getAttribute('data-landmark-selected'))
      .toBe('true');
  });

  test('a deficit’s profile sits above the selected region, which reads as a second subject', async () => {
    const world = await boot();
    const deficit = world.clinical.grouped('', 'en')[0]!.deficits[0]!;
    await app.ports.openDeficit(deficit.id);
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    const profile = detail().querySelector('.clinical-profile')!;
    const region = detail().querySelector('.region-detail')!;
    expect(profile.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(region.hasAttribute('data-under-profile')).toBe(true);
  });
});

describe('the Tracts panel’s MRI', () => {
  test('opens the navigator with the entry animation for a pointer, and without it for Enter', async () => {
    await boot();
    await userEvent.click(page.getByRole('tab', { name: 'Tracts' }));
    const opener = page.getByRole('button', { name: t('en', 'diffusion').mriOpen });
    const dialog = () =>
      [...document.querySelectorAll('dialog')].find((candidate) =>
        candidate.querySelector('h2')?.textContent?.startsWith('MRI with tracts'),
      )!;

    await userEvent.click(opener);
    await vi.waitFor(() => expect(dialog().open).toBe(true));
    expect(dialog().hasAttribute('data-instant')).toBe(false);
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(dialog().open).toBe(false));

    (opener.element() as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => expect(dialog().open).toBe(true));
    expect(dialog().hasAttribute('data-instant')).toBe(true);
  });
});

describe('the phone sheet’s strip and its clear', () => {
  // The rails show the strip only for what their list is not showing, and a function, deficit or
  // lesson is held only in its own mode; the sheet's grip names it in front of every panel.
  beforeEach(() => page.viewport(390, 844));
  // A function's or deficit's list row has the same name; the strip is the first, in the sheet's grip.
  const strip = (name: string) => page.getByRole('button', { name, exact: true }).first();
  const clear = () => page.getByRole('button', { name: t('en', 'inspector').clearSelection });

  test('an open function is named in the strip, and its clear closes it', async () => {
    const world = await boot();
    const id = domains.domains[0]!.id;
    await expect.element(clear()).not.toBeInTheDocument();
    await app.ports.openFunction(id);
    app.ports.back(); // the raised detail covers the grip's title
    flushSync();
    await expect.element(strip(domainName(domainRecord(domains, id)!, 'en'))).toBeVisible();
    await userEvent.click(clear());
    expect(world.view.current.selectedFunction).toBeNull();
    await expect.element(clear()).not.toBeInTheDocument();
  });

  test('an open deficit is named in the strip, and its clear closes it', async () => {
    const world = await boot();
    const deficit = world.clinical.grouped('', 'en')[0]!.deficits[0]!;
    await app.ports.openDeficit(deficit.id);
    app.ports.back();
    flushSync();
    await expect.element(strip(deficit.name.en)).toBeVisible();
    await userEvent.click(clear());
    expect(world.view.current.selectedDeficit).toBeNull();
    await expect.element(clear()).not.toBeInTheDocument();
  });

  test('a lesson is named in the strip, which offers no clear', async () => {
    const circuit = (await boot()).circuits.all[0]!;
    const world = await reboot(`#tab=circuits&circuit=${circuit.id}`);
    // A landmark names its region; with none selected the strip names the lesson.
    world.anatomy.selectRegion(null);
    flushSync();
    await expect.element(strip(circuit.name.en)).toBeVisible();
    await expect.element(clear()).not.toBeInTheDocument();
  });
});

describe('the location bar and the notice', () => {
  test('the group crumb clears a search and opens the collapsed group of the selected row', async () => {
    const world = await boot();
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    const group = world.catalog.groups.find((entry) =>
      entry.rows.some((row) => row.region.id === REGION),
    )!;
    if (world.view.current.expanded.has(group.key)) app.session.toggleGroup(group.key);
    app.session.setQuery('gyrus');
    flushSync();
    expect(world.view.current.expanded.has(group.key)).toBe(false);
    await userEvent.click(page.getByRole('button', { name: /, show in the list$/ }));
    expect(world.view.current.query).toBe('');
    expect(world.view.current.expanded.has(group.key)).toBe(true);
  });

  test('a deficit that paints a deep structure sees through the cortex, and leaving it gives it back', async () => {
    const world = await boot();
    await world.excursions.openDeficit('neglect');
    flushSync();
    expect(engine.model.settings.cortexOpacity).toBe(
      engine.model.manifest.appearance.see_through_opacity,
    );
    await world.excursions.chooseExplorer('anatomy');
    flushSync();
    expect(engine.model.settings.cortexOpacity).toBe(1);
  });

  test('Restore previous view is offered once a function is opened from a scene, and not before', async () => {
    await boot();
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    const restore = page.getByRole('button', { name: t('en', 'clinical').restore });
    await expect.element(restore).not.toBeInTheDocument();
    await app.ports.openFunction(domains.domains[0]!.id);
    await expect.element(restore).toBeVisible();
  });
});

describe('the keymap’s tree walk', () => {
  test('ArrowDown from outside the tree moves focus onto one of its rows', async () => {
    await boot();
    expect(document.activeElement).toBe(document.body);
    press('ArrowDown');
    expect(document.activeElement!.closest('[role="row"]')).not.toBeNull();
    expect(list().contains(document.activeElement)).toBe(true);
  });
});

describe('the phone sheet', () => {
  beforeEach(() => page.viewport(390, 844));

  test('showing the list or the detail raises the sheet from peek, and the stage is told the room it has', async () => {
    const world = await boot();
    expect(sheet().dataset.detent).toBe('peek');
    app.ports.showList();
    expect(sheet().dataset.detent).toBe('half');
    const { visibleRect, hostSize } = app.stage;
    expect(visibleRect!.height).toBeLessThan(hostSize!.height);
    expect(visibleRect).toEqual(world.engine.camera.visibleRect);
  });

  test('a held view is reframed where the sheet comes to rest', async () => {
    await boot();
    expect(app.world!.engine.camera.viewHeld).toBe(true);
    const before = cameraCalls('frameCurrent').length;
    await userEvent.click(page.getByRole('button', { name: t('en', 'sheet').expand }));
    expect(cameraCalls('frameCurrent')).toHaveLength(before + 1);
  });

  test('the sheet’s first report, before the start has framed the camera, keeps no framing', async () => {
    // The real camera starts released, which the fake's held opening view stands in for here.
    engine.camera.orbitBy({ azimuth: 0.1 });
    await boot();
    expect(cameraCalls('setChromeInsets').length).toBeGreaterThan(0);
    expect(cameraCalls('keepFraming')).toEqual([]);
  });

  test('a framing of the reader’s own keeps the size the room had before the sheet moved', async () => {
    const world = await boot();
    const { camera } = world.engine;
    camera.orbitBy({ azimuth: 0.1 });
    // The fit depends on the room, as the real camera's does, so before and after differ.
    vi.spyOn(camera, 'fittedDistance').mockImplementation(() => camera.visibleRect.height);
    const before = camera.fittedDistance();
    app.ports.showDetail();
    expect(camera.fittedDistance()).not.toBe(before);
    expect(cameraCalls('keepFraming').map(({ args }) => args[0])).toEqual([before]);
  });

  test('leaving the phone layout clears the sheet’s inset from the stage and the camera', async () => {
    await boot();
    await userEvent.click(page.getByRole('button', { name: t('en', 'sheet').expand }));
    const stage = () => document.getElementById('viewport')!;
    await expect.poll(() => stage().style.getPropertyValue('--vis-bottom')).not.toBe('0px');
    await page.viewport(1280, 800);
    await expect.poll(() => stage().style.getPropertyValue('--vis-bottom')).toBe('0px');
    const insets = cameraCalls('setChromeInsets').at(-1)!.args[0];
    expect({ top: 0, right: 0, bottom: 0, left: 0, ...(insets as object) }).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  test('a function link and a lesson link keep the sheet at peek, where a pick raises it', async () => {
    const circuit = (await boot()).circuits.all[0]!;
    const landmark = circuit.steps[1]!.region;
    const atlas = landmark.split(':')[0];
    const functionId = domains.domains[0]!.id;

    await reboot(`#atlas=hcp-mmp&tab=functions&function=${functionId}`);
    expect(detail().hidden).toBe(false);
    expect(sheet().dataset.detent).toBe('peek');

    await reboot(`#atlas=${atlas}&region=${landmark}&tab=circuits&circuit=${circuit.id}&step=1`);
    expect(detail().hidden).toBe(false);
    expect(sheet().dataset.detent).toBe('peek');

    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    expect(sheet().dataset.detent).toBe('half');
  });

  test('the sheet’s containers carry the home-indicator padding once, not the panels inside them', async () => {
    await boot();
    const bottom = (element: Element) => parseFloat(getComputedStyle(element).paddingBottom);
    engine.emit('pick', { id: REGION, point: null });
    flushSync();
    expect(bottom(detail())).toBeGreaterThan(0);
    expect(bottom(detailOrList('.detail-body'))).toBe(0);
    app.ports.back();
    flushSync();
    await userEvent.click(page.getByRole('tab', { name: 'Functions' }));
    expect(bottom(list())).toBeGreaterThan(0);
    expect(bottom(detailOrList('.functions > .browser'))).toBe(0);
  });
});
