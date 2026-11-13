// The stage region as the app mounts it, over the fake engine: what it holds, the ports it hands the
// controllers and the keymap, the Tracts MRI dialog and the docked Linked MRI, and the stage layout
// following the panel and window.
import '../../styles/index.css';
import '../layout.css';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import manifestFile from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import domainsFile from '../../../../public/models/cdmd/neuropsych-domains.json' with { type: 'json' };
import { validateNeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import { ALL_DOMAINS } from '../../lib/core/catalog/neuropsych-domains.ts';
import { createApp, APP } from '../application.svelte.ts';
import type { App } from '../application.svelte.ts';
import { composeWorld } from '../world.ts';
import { isIndependentTractReference } from '../../lib/core/diffusion/presentation.ts';
import * as snapshot from '../../features/snapshot/snapshot.ts';
import StageRegion from './StageRegion.svelte';
import StageRegionFixture from './stage-region-test-support.svelte';

// The real saver, watched: what the region hands it is the rule under test.
vi.mock('../../features/snapshot/snapshot.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/snapshot/snapshot.ts')>();
  return { ...actual, saveSnapshot: vi.fn(actual.saveSnapshot) };
});

const manifest = manifestFile as unknown as Manifest;
const domains = validateNeuropsychDomains(
  domainsFile as unknown as NeuropsychDomains,
  new Map(manifest.regions.map((region) => [region.id, region])),
);

let engine: FakeEngine;
let app: App;
let target: HTMLElement;
let region: Record<string, () => unknown> | null;
let announcer: HTMLElement;
let detach: () => void;

/** Composes the world over the fake engine and mounts only the stage region, as the shell does. */
async function boot(status: 'ready' | 'loading' = 'ready') {
  app = createApp();
  app.attach(await composeWorld(app, engine, 'cdmd'));
  if (status === 'ready') app.session.setLoaded();
  region = mount(StageRegion, { target, context: new Map([[APP, app]]) }) as never;
  // In the page the grid sizes the stage.
  document.getElementById('viewport')!.style.cssText = 'width: 900px; height: 600px';
  // As the real engine does: its canvas is the stage's first child, which axe reads as an image.
  document.getElementById('viewport')!.prepend(engine.canvas);
  flushSync();
}

const dialogs = () => [...document.querySelectorAll<HTMLDialogElement>('dialog')];
const linkedMri = () => target.querySelector<HTMLElement>(':scope > .mpr-dock');
const press = (key: string) =>
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );

beforeEach(async () => {
  await page.viewport(1280, 800);
  engine = createFakeEngine({ manifest, domains: domains as never });
  target = document.body.appendChild(document.createElement('div'));
  target.id = 'app';
  announcer = document.body.appendChild(document.createElement('p'));
  detach = attachAnnouncer(announcer);
  localStorage.clear();
});
afterEach(() => {
  app.dispose();
  if (region) unmount(region as never);
  region = null;
  detach();
  announcer.remove();
  target.remove();
  vi.restoreAllMocks();
});

describe('what the stage region holds', () => {
  test('one main landmark holds the overlay, the dock, the gizmo, the keys and the snippet it is given; no stage control is outside it', async () => {
    app = createApp();
    app.attach(await composeWorld(app, engine, 'cdmd'));
    app.session.setLoaded();
    region = mount(StageRegionFixture, { target, context: new Map([[APP, app]]) }) as never;
    flushSync();
    const mains = document.querySelectorAll('main');
    expect(mains).toHaveLength(1);
    const main = mains[0]!;
    expect(main.id).toBe('viewport');
    expect(main.getAttribute('tabindex')).toBe('-1');
    expect(main.querySelector('.stage-overlay')).not.toBeNull();
    expect(main.querySelector('.stage-dock')).not.toBeNull();
    expect(main.querySelector('.orientation-gizmo')).not.toBeNull();
    expect(main.querySelector('.stage-keys')).not.toBeNull();
    expect(main.querySelector('#stage-status-slot')).not.toBeNull();
    for (const control of document.querySelectorAll(
      '.stage-tool, .stage-keys, .orientation-gizmo',
    )) {
      expect(main.contains(control)).toBe(true);
    }
  });

  test('before the engine the main still holds the snippet', async () => {
    app = createApp();
    region = mount(StageRegionFixture, { target, context: new Map([[APP, app]]) }) as never;
    flushSync();
    const main = document.querySelector('main#viewport')!;
    expect(main.querySelector('#stage-status-slot')).not.toBeNull();
    expect(main.querySelector('.stage-dock')).toBeNull();
    expect(dialogs()).toHaveLength(0);
  });

  test('the docked Linked MRI is drawn only while open, beside the stage', async () => {
    await boot();
    expect(dialogs()).toHaveLength(0);
    // The Linked MRI is a grid item beside the stage, drawn only while open.
    expect(linkedMri()).toBeNull();
    await engine.sections.load();
    app.ports.showMri({ instant: true });
    // Its code is fetched the first time it opens.
    await vi.waitFor(() => expect(linkedMri()).not.toBeNull());
    expect(linkedMri()!.parentElement).toBe(target);
    expect(document.getElementById('viewport')!.contains(linkedMri())).toBe(false);
  });

  test('the exit control is kept mounted and hidden outside full screen, named by its visible text', async () => {
    await boot();
    const exit = document.querySelector<HTMLButtonElement>('.exit-fullscreen')!;
    expect(exit.hidden).toBe(true);
    expect(exit.textContent!.trim()).toBe('Exit full screen');
    expect((region as never as { isFullscreen(): boolean }).isFullscreen()).toBe(false);
  });

  test('the stage passes axe with the dock and the keys', async () => {
    await boot();
    await expectAxeClean();
  });
});

describe('the MRI dialogs', () => {
  test('openMpr docks the Linked MRI beside the stage, not as a modal; mprOpen answers, closeMpr closes it', async () => {
    await boot();
    expect(app.ports.mprOpen()).toBe(false);
    app.ports.openMpr({ instant: true });
    await vi.waitFor(() => expect(app.ports.mprOpen()).toBe(true));
    expect(linkedMri()!.getAttribute('aria-labelledby')).toBeTruthy();
    expect(document.querySelector('dialog:modal')).toBeNull();
    app.ports.closeMpr();
    flushSync();
    expect(app.ports.mprOpen()).toBe(false);
    expect(linkedMri()).toBeNull();
  });

  test('while it is docked the page keeps its keys outside it, and M from the stage closes it', async () => {
    await boot();
    await engine.sections.load();
    app.ports.showMri({ instant: true });
    await vi.waitFor(() => expect(linkedMri()).not.toBeNull());
    const stage = document.getElementById('viewport')!;
    stage.focus();
    // Open, but the keys are the page's: the stage's own shortcuts still reach the keymap.
    expect(app.ports.mprOpen()).toBe(false);
    press('m');
    flushSync();
    expect(linkedMri()).toBeNull();
    expect(document.activeElement).toBe(stage);
  });

  test('showMri opens it from the controllers, and the M key toggles it', async () => {
    await boot();
    // The controllers show the dialog once the scan has loaded.
    await engine.sections.load();
    app.ports.showMri({ instant: true });
    await vi.waitFor(() => expect(app.ports.mprOpen()).toBe(true));
    press('m');
    flushSync();
    expect(app.ports.mprOpen()).toBe(false);
    press('m');
    await vi.waitFor(() => expect(app.ports.mprOpen()).toBe(true));
  });

  test('the section row’s opener opens the same dialog', async () => {
    await boot();
    await userEvent.click(page.getByRole('button', { name: 'Section', exact: true }));
    // A cut is needed before the section row offers the opener.
    await userEvent.click(page.getByRole('button', { name: 'Sagittal', exact: true }));
    await userEvent.click(page.getByRole('button', { name: /Linked MRI/ }));
    await vi.waitFor(() => expect(app.ports.mprOpen()).toBe(true));
  });

  test('openLinkedMri loads the scan and opens the Linked MRI, and a second press leaves it open', async () => {
    await boot();
    app.ports.openLinkedMri({ instant: true });
    await vi.waitFor(() => expect(app.ports.mriOpen()).toBe(true));
    expect(call('sections', 'load').length).toBeGreaterThan(0);
    app.ports.openLinkedMri({ instant: true });
    await new Promise((resolve) => setTimeout(resolve));
    expect(app.ports.mriOpen()).toBe(true);
  });
});

describe('the stage layout', () => {
  test('a desktop resize reaches the stage store through the engine’s viewport event', async () => {
    await boot();
    engine.emit('viewport', {
      visibleRect: { x: 0, y: 0, width: 1000, height: 700 },
      hostSize: { width: 1000, height: 700 },
    });
    flushSync();
    expect(app.stage.visibleRect?.width).toBe(1000);
    engine.emit('viewport', {
      visibleRect: { x: 0, y: 0, width: 800, height: 700 },
      hostSize: { width: 800, height: 700 },
    });
    flushSync();
    expect(app.stage.visibleRect?.width).toBe(800);
    expect(document.getElementById('viewport')!.style.getPropertyValue('--vis-right')).toBe('0px');
  });

  test('a full phone sheet hides the dock, the gizmo, the scale bar and the letters', async () => {
    await boot();
    const dock = document.querySelector<HTMLElement>('.stage-dock')!;
    const gizmo = document.querySelector<HTMLElement>('.orientation-gizmo')!;
    expect(getComputedStyle(dock).visibility).toBe('visible');
    expect(getComputedStyle(gizmo).visibility).toBe('visible');
    app.stage.sheetFull = true;
    flushSync();
    expect(document.getElementById('viewport')!.dataset.sheetFull).toBe('true');
    expect(getComputedStyle(dock).visibility).toBe('hidden');
    expect(getComputedStyle(gizmo).visibility).toBe('hidden');
    expect(getComputedStyle(document.getElementById('orientation')!).visibility).toBe('hidden');
    app.stage.sheetFull = false;
    flushSync();
    expect(getComputedStyle(dock).visibility).toBe('visible');
  });
});

describe('save image', () => {
  test('saves the visible stage as planum-<atlas>-<view>.png and says so', async () => {
    await boot();
    engine.emit('viewport', {
      visibleRect: { x: 0, y: 0, width: 1000, height: 700 },
      hostSize: { width: 1000, height: 700 },
    });
    flushSync();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      const { atlas, view } = app.world!.view.current;
      expect(this.download).toBe(`planum-${atlas}-${view}.png`);
    });
    await (region as never as { saveImage(): Promise<void> }).saveImage();
    expect(click).toHaveBeenCalledOnce();
    const { atlas, view } = app.world!.view.current;
    expect(announcer.textContent).toBe(`Image saved as planum-${atlas}-${view}.png.`);
  });

  test('says a second save of the same file again', async () => {
    await boot();
    engine.emit('viewport', {
      visibleRect: { x: 0, y: 0, width: 1000, height: 700 },
      hostSize: { width: 1000, height: 700 },
    });
    flushSync();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const save = (region as never as { saveImage(): Promise<void> }).saveImage;
    await save();
    const { atlas, view } = app.world!.view.current;
    const said = `Image saved as planum-${atlas}-${view}.png.`;
    await vi.waitFor(() => expect(announcer.textContent).toBe(said));
    announcer.textContent = '';
    await save();
    await vi.waitFor(() => expect(announcer.textContent).toBe(said));
    expect(app.session.state.notice?.text).toBe(said);
  });

  test('the caption is read once the drawing code is in, so it names the scene the save captures', async () => {
    await boot();
    const saving = (region as never as { saveImage(): Promise<void> }).saveImage();
    // Selected while the snapshot's code is still on its way.
    const id = 'destrieux:left:30';
    engine.model.select(id);
    flushSync();
    await saving;
    const subject = vi.mocked(snapshot.saveSnapshot).mock.calls.at(-1)![1];
    expect(subject.selection).toBe(`${app.world!.catalog.label(id).name}, left`);
  });
});

const call = (domain: string, method: string) =>
  engine.calls.filter((entry) => entry.domain === domain && entry.method === method);

describe('the controllers’ entry points', () => {
  test('openPreparedPlane opens the dialog only while the step still wants it', async () => {
    await boot();
    await app.ports.openPreparedPlane('coronal', () => true);
    await vi.waitFor(() => expect(app.ports.mprOpen()).toBe(true));
    app.ports.closeMpr();
    flushSync();
    // The dialog's code has loaded, so a step that no longer wants it would show at once.
    await app.ports.openPreparedPlane('coronal', () => false);
    flushSync();
    expect(app.ports.mprOpen()).toBe(false);
  });

  test('M twice while the scan loads runs one load, and the opener says it is busy', async () => {
    await boot();
    await userEvent.click(page.getByRole('button', { name: 'Section', exact: true }));
    await userEvent.click(page.getByRole('button', { name: 'Sagittal', exact: true }));
    await userEvent.keyboard('{Escape}');
    let finish!: () => void;
    const real = engine.sections.load.bind(engine.sections);
    const load = vi
      .spyOn(engine.sections, 'load')
      .mockImplementation(
        () => new Promise<void>((resolve) => (finish = () => void real().then(resolve))),
      );
    press('m');
    press('m');
    flushSync();
    expect(load).toHaveBeenCalledOnce();
    expect(
      page
        .getByRole('button', { name: /Linked MRI/ })
        .element()
        .getAttribute('aria-disabled'),
    ).toBe('true');
    finish();
    await vi.waitFor(() => expect(app.ports.mprOpen()).toBe(true));
  });

  test('the Linked MRI draws the tracts the stage draws, again when the panel’s length changes', async () => {
    await boot();
    await engine.tracts.setActive(true);
    app.world!.excursions.chooseExplorer('diffusion');
    await engine.sections.load();
    const onPlane = vi.spyOn(engine.tracts, 'onPlane');
    app.ports.showMri({ instant: true });
    // Once the overlay is on, each plane's last draw holds the stage's streamlines.
    await vi.waitFor(() => {
      const last = onPlane.mock.results.slice(-3);
      expect(last).toHaveLength(3);
      expect(last.every(({ value }) => value.colors.length > 0)).toBe(true);
    });
    // The draws have settled: two frames pass with none.
    let before = -1;
    while (before !== onPlane.mock.calls.length) {
      before = onPlane.mock.calls.length;
      for (let frame = 0; frame < 2; frame++)
        await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    app.tractsMinimum = 40;
    await vi.waitFor(() => expect(onPlane).toHaveBeenCalledTimes(before + 3));
  });

  test('over another subject’s tracts the Linked MRI draws none and offers no FA', async () => {
    engine = createFakeEngine({ manifest, domains: domains as never, tractAnatomy: 'another' });
    await boot();
    await engine.sections.load();
    const onPlane = vi.spyOn(engine.tracts, 'onPlane');
    app.ports.showMri({ instant: true });
    await vi.waitFor(() => expect(linkedMri()).not.toBeNull());
    expect(linkedMri()!.textContent).not.toContain('FA opacity');
    expect(onPlane).not.toHaveBeenCalled();
  });

  test('a slider frame queued when the region goes is not run afterwards', async () => {
    await boot();
    await engine.sections.load();
    app.ports.showMri({ instant: true });
    await vi.waitFor(() => expect(linkedMri()).not.toBeNull());
    const slider = linkedMri()!.querySelector<HTMLInputElement>('input[type="range"]')!;
    const before = call('sections', 'setCrosshair').length;
    slider.value = String(Number(slider.value) + 5);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    app.dispose();
    unmount(region as never);
    region = null;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(call('sections', 'setCrosshair')).toHaveLength(before);
  });
});

describe('focus and the crosshair', () => {
  test('a Linked MRI opened from a port returns focus to the Section tool, else to the model', async () => {
    await boot();
    await engine.sections.load();
    (document.activeElement as HTMLElement | null)?.blur();
    app.ports.showMri({ instant: true });
    // Its code is fetched the first time it opens; Escape before then reaches no dialog.
    await vi.waitFor(() => expect(app.ports.mprOpen()).toBe(true));
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        page.getByRole('button', { name: 'Section', exact: true }).element(),
      ),
    );
  });

  test('over the tract reference, where no Section tool is drawn, focus returns to the model', async () => {
    engine = createFakeEngine({ manifest, domains: domains as never, tractAnatomy: 'another' });
    await boot();
    await engine.sections.load();
    engine.canvas.tabIndex = 0;
    app.session.setExplorer('diffusion');
    flushSync();
    (document.activeElement as HTMLElement | null)?.blur();
    app.ports.showMri({ instant: true });
    // Its code is fetched the first time it opens; Escape before then reaches no dialog.
    await vi.waitFor(() => expect(app.ports.mprOpen()).toBe(true));
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(document.activeElement).toBe(engine.canvas));
  });
});

describe('the dock and the keys', () => {
  test('a gizmo letter sets the session’s view and frames it; Reset view resets the camera, not the model', async () => {
    await boot();
    (
      page.getByRole('button', { name: 'Superior view', exact: true }).element() as HTMLElement
    ).click();
    flushSync();
    expect(app.world!.view.current.view).toBe('superior');
    expect(call('camera', 'applyView').at(-1)?.args[0]).toBe('superior');
    expect(
      page
        .getByRole('button', { name: 'Superior view', exact: true })
        .element()
        .getAttribute('aria-pressed'),
    ).toBe('true');
    await userEvent.click(page.getByRole('button', { name: 'Reset view' }));
    expect(call('model', 'reset')).toHaveLength(0);
    expect(call('camera', 'recenter')).toHaveLength(1);
    expect(call('camera', 'applyView').at(-1)?.args[0]).toBe('oblique');
    expect(app.world!.view.current.view).toBe('oblique');
  });

  test('Add offers Coordinate because the anatomy publishes coordinate spaces, and holds each choice’s form', async () => {
    await boot();
    expect(app.world!.coordinates).not.toBeNull();
    await userEvent.click(page.getByRole('button', { name: 'Add', exact: true }));
    const dialog = page.getByRole('dialog', { name: 'Add', exact: true }).element();
    // It opens on Lesion, the first choice.
    expect(dialog.querySelector('input[type="range"]')).not.toBeNull();
    await userEvent.click(page.getByRole('radio', { name: 'Coordinate', exact: true }));
    expect(dialog.querySelector('input[type="text"]')).not.toBeNull();
    expect(dialog.querySelector('select')).not.toBeNull();
    expect(dialog.querySelector('input[type="range"]')).toBeNull();
  });

  test.each([
    [1280, 800],
    [390, 844],
  ])(
    'at %i × %i the gizmo sits top right, clear of the top and right letters',
    async (width, height) => {
      await page.viewport(width, height);
      await boot();
      const viewport = document.getElementById('viewport')!;
      viewport.style.cssText = `width: ${width - 40}px; height: ${height - 100}px`;
      flushSync();
      const gizmo = document.querySelector('.orientation-gizmo')!.getBoundingClientRect();
      const host = viewport.getBoundingClientRect();
      expect(host.right - gizmo.right).toBeLessThan(40);
      expect(gizmo.top - host.top).toBeLessThan(40);
      for (const edge of ['top', 'right']) {
        const letter = document
          .querySelector(`#orientation [data-edge="${edge}"]`)!
          .getBoundingClientRect();
        const apart =
          letter.right <= gizmo.left ||
          letter.left >= gizmo.right ||
          letter.bottom <= gizmo.top ||
          letter.top >= gizmo.bottom;
        expect(apart, edge).toBe(true);
      }
    },
  );

  async function functionsPainted() {
    await engine.model.setAtlas(app.world!.engine.model.domains!.atlas);
    app.session.setExplorer('functions');
    app.session.setFunction(ALL_DOMAINS);
    flushSync();
  }

  test('a functions paint draws its key, and a row press opens that function', async () => {
    await boot();
    const openFunction = vi.fn();
    app.registerPorts({ openFunction });
    await functionsPainted();
    const key = document.getElementById('paint-key')!;
    expect(key.hidden).toBe(false);
    const row = key.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
    row.click();
    expect(openFunction).toHaveBeenCalledOnce();
    expect(typeof openFunction.mock.calls[0]![0]).toBe('string');
  });

  test('streamlines drawn show the direction key', async () => {
    await boot();
    expect(document.getElementById('direction-key')).toBeNull();
    await engine.tracts.setActive(true);
    engine.tracts.setOverlay(true);
    engine.emit('tractsVisibility', undefined);
    flushSync();
    expect(engine.tracts.streamlinesVisible).toBe(true);
    await vi.waitFor(() => expect(document.getElementById('direction-key')).not.toBeNull());
  });
});

describe('the visual field map', () => {
  test('draws its own greys, so the stage keys no surface colour while it is open', async () => {
    await boot();
    engine.model.setSurfaceColor('network');
    flushSync();
    expect(document.getElementById('network-key')).not.toBeNull();
    app.session.setExplorer('circuits');
    app.world!.lesson.openMap('visual-field', { x: 2, y: 2, radius: 1 });
    flushSync();
    expect(app.world!.view.current.lesson.map).toBe('visual-field');
    expect(document.getElementById('network-key')).toBeNull();
  });
});

describe('the tract reference', () => {
  test('the keys read in tissue colour and the snapshot is captioned with the reference', async () => {
    engine = createFakeEngine({
      manifest,
      domains: domains as never,
      tractAnatomy: 'reference-brain',
    });
    await boot();
    engine.model.setSurfaceColor('network');
    flushSync();
    expect(document.getElementById('network-key')).not.toBeNull();
    app.session.setExplorer('diffusion');
    flushSync();
    expect(isIndependentTractReference(app.world!.view.current)).toBe(true);
    expect(document.getElementById('network-key')).toBeNull();
    await (region as never as { saveImage(): Promise<void> }).saveImage();
    const subject = vi.mocked(snapshot.saveSnapshot).mock.calls.at(-1)![1];
    expect(subject.reference).toBe('MGH CDMD · sub_013');
    expect(subject.surfaceColor).toBe('tissue');
  });

  test('the selected region reaches the snapshot subject, named with its side', async () => {
    await boot();
    const id = 'destrieux:left:30';
    engine.model.select(id);
    flushSync();
    await (region as never as { saveImage(): Promise<void> }).saveImage();
    const subject = vi.mocked(snapshot.saveSnapshot).mock.calls.at(-1)![1];
    expect(subject.selection).toBe(`${app.world!.catalog.label(id).name}, left`);
  });

  test('an open cut reaches the snapshot subject', async () => {
    await boot();
    await userEvent.click(page.getByRole('button', { name: 'Section', exact: true }));
    await userEvent.click(page.getByRole('button', { name: 'Sagittal', exact: true }));
    await (region as never as { saveImage(): Promise<void> }).saveImage();
    const subject = vi.mocked(snapshot.saveSnapshot).mock.calls.at(-1)![1];
    expect(subject.section).toEqual({ plane: 'sagittal', offset: 0, tilt: 30, azimuth: 30 });
    expect(subject.reference).toBeNull();
  });
});

describe('the phone', () => {
  test('under a full sheet the scale bar is hidden as well', async () => {
    await boot();
    app.stage.sheetFull = true;
    flushSync();
    expect(getComputedStyle(document.getElementById('scale-bar')!).visibility).toBe('hidden');
  });

  test('under a full sheet the keys keep the dock’s room, so a folded title is never cut', async () => {
    await page.viewport(390, 844);
    await boot();
    engine.model.setSurfaceColor('network');
    flushSync();
    const viewport = document.getElementById('viewport')!;
    // A full sheet leaves the picture a 128 px strip, as on a 390 × 844 phone.
    viewport.style.setProperty('--vis-bottom', `${viewport.clientHeight - 128}px`);
    viewport.style.setProperty('--dock-height', '54px');
    app.stage.sheetFull = true;
    flushSync();
    // Less the hidden dock's 54 px and a third gutter, the strip would leave the plate shorter than its title.
    const plate = document.getElementById('network-key')!;
    const title = plate.querySelector<HTMLElement>('.stage-key-head')!;
    expect(plate.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      title.getBoundingClientRect().height,
    );
  });

  test('an open popover hides the scale bar and the letters, and closing shows them', async () => {
    await page.viewport(390, 844);
    await boot();
    const bar = document.getElementById('scale-bar')!;
    const letters = document.getElementById('orientation')!;
    expect(getComputedStyle(bar).visibility).toBe('visible');
    await userEvent.click(page.getByRole('button', { name: 'Display', exact: true }));
    await vi.waitFor(() => expect(getComputedStyle(bar).visibility).toBe('hidden'));
    expect(getComputedStyle(letters).visibility).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(getComputedStyle(bar).visibility).toBe('visible'));
  });

  test('in French at 390 px the exit control starts below the top letter', async () => {
    await page.viewport(390, 844);
    await boot();
    app.chooseLanguage('fr');
    flushSync();
    const exit = document.querySelector<HTMLElement>('.exit-fullscreen')!;
    exit.hidden = false;
    const control = exit.getBoundingClientRect();
    const letter = document
      .querySelector('#orientation [data-edge="top"]')!
      .getBoundingClientRect();
    expect(exit.textContent!.trim()).toBe('Quitter le plein écran');
    expect(control.top).toBeGreaterThanOrEqual(letter.bottom);
  });
});
