// The Linked MRI dialog over the fake engine in a real browser: what the reader gets from the three
// planes, the keyboard and the pointer, the phone's one-plane mode, the live region and the saved
// PNG. Each test states one rule with fixed expected values; the legacy viewer is not imported.
// The engine's own maths are proved in mpr-dialog.test.ts.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../test/fixtures/cdmd-manifest.json' with { type: 'json' };
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import { createEngineSync } from '../../lib/state/engine-sync.svelte.ts';
import type { Language, Manifest } from '../../lib/types/index.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import { createMprDialog } from './mpr-dialog.svelte.ts';
import { VIRIDIS, pointOnPlane } from './mpr-draw.ts';
import type { MprDialogController } from './mpr-dialog.svelte.ts';
import Fixture from './mpr-test-support.svelte';

const SIZE = 128;
const anatomy = { subject: 'sub_013', individual: true };

let engine: FakeEngine;
let mpr: MprDialogController;
let live: { lang: Language };
let announced: string[];
let watcher: MutationObserver | undefined;

function liveState(): { lang: Language } {
  const state = $state<{ lang: Language }>({ lang: 'en' });
  return state;
}

beforeEach(async () => {
  await page.viewport(1280, 900);
  engine = createFakeEngine({
    manifest: manifest as unknown as Manifest,
    mri: { fieldOfView: 256, size: SIZE, windowCenter: 90, windowWidth: 180 },
  });
  live = liveState();
  mpr = createMprDialog({
    engine,
    select: () => {},
    showPlane: () => {},
  });
  announced = [];
});
afterEach(async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  mpr.dispose();
  watcher?.disconnect();
  vi.restoreAllMocks();
  cleanup();
});

let view: { holdsKeys(): boolean };

async function mount(tracts: { key: string } | null = null) {
  const result = await render(Fixture, {
    engine,
    engineState: createEngineSync(engine),
    mpr,
    live,
    anatomy,
    tracts,
  });
  view = result.component as unknown as typeof view;
  return result;
}

/** What the live region is made to say, in order, from the moment it is shown. */
function listen() {
  watcher?.disconnect();
  const status = statusRegion();
  watcher = new MutationObserver(() => {
    if (status.textContent) announced.push(status.textContent);
  });
  watcher.observe(status, { childList: true, characterData: true, subtree: true });
}

const dock = () => document.querySelector<HTMLElement>('.mpr-dock');
const dialog = () => document.querySelector('dialog') as HTMLDialogElement;
/** The docked region beside a desktop stage, the dialog on a phone. */
const shell = (): HTMLElement => dock() ?? dialog();
const shown = () => (dock() ? true : (dialog()?.open ?? false));
const statusRegion = () => shell().querySelector('[role="status"]') as HTMLElement;
const opener = () => page.getByRole('button', { name: 'Linked MRI' }).element() as HTMLElement;
const more = () => page.getByRole('button', { name: 'More' }).element() as HTMLElement;
const section = (plane: string) =>
  shell().querySelector<HTMLElement>(`.plane[data-plane="${plane}"]`)!;
const canvas = (plane: string) => section(plane).querySelector('canvas')!;
const slider = (name: string) => page.getByRole('slider', { name, exact: true });
const sliderElement = (name: string) => slider(name).element() as HTMLInputElement;
const crosshair = () => engine.sections.state.crosshair;
const calls = (method: string) =>
  engine.calls.filter((call) => call.domain === 'sections' && call.method === method);
const box = (element: Element) => element.getBoundingClientRect();

/** Keyboard open, as Enter on the opener does; waits for the MRI. */
async function openFromKeyboard() {
  opener().focus();
  await userEvent.keyboard('{Enter}');
  await expect.poll(shown).toBe(true);
  listen();
}

async function opened() {
  await mount();
  await openFromKeyboard();
}

/** A frame later: the moves a slider makes are coalesced to one a frame. */
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function pixel(target: HTMLCanvasElement, x: number, y: number) {
  return [...target.getContext('2d')!.getImageData(x, y, 1, 1).data];
}

describe('docked beside the stage', () => {
  test('is a region named for what it shows, not a modal: Close takes focus and the page stays live', async () => {
    await opened();
    await expect.element(page.getByRole('region', { name: 'Linked MRI sections' })).toBeVisible();
    expect(document.activeElement).toBe(page.getByRole('button', { name: 'Close' }).element());
    expect(document.querySelector('dialog:modal')).toBeNull();
    expect(more().closest('[inert]')).toBeNull();
    // Tab leaves it for the page, as from any region: there is no trap.
    more().focus();
    expect(document.activeElement).toBe(more());
  });

  test('its width handle says how to use it in the shared tooltip, not a hover-only native title', async () => {
    await opened();
    const handle = page.getByRole('separator', { name: 'Linked MRI width' }).element();
    expect(handle.hasAttribute('title')).toBe(false);
    expect(handle.getAttribute('data-tooltip')).toBe(
      'Drag to resize. Double-click for the usual width.',
    );
  });

  test('takes a column beside the stage at 1280 px, as a 2 × 2 of slices', async () => {
    await opened();
    const stage = document.getElementById('viewport')!;
    expect(box(dock()!).left).toBe(box(stage).right);
    expect(box(dock()!).top).toBe(box(stage).top);
    expect(box(dock()!).height).toBe(box(stage).height);
    expect(box(canvas('coronal')).top).toBe(box(canvas('sagittal')).top);
    expect(box(canvas('axial')).left).toBe(box(canvas('sagittal')).left);
  });

  test('a short, narrower window keeps it beside the stage, its planes stacked, so the anatomy stays in view', async () => {
    await page.viewport(1024, 768);
    await opened();
    const stage = document.getElementById('viewport')!;
    expect(document.querySelector('dialog:modal')).toBeNull();
    expect(box(dock()!).left).toBe(box(stage).right);
    expect(box(dock()!).height).toBe(box(stage).height);
    expect(box(stage).width).toBeGreaterThan(box(dock()!).width);
    expect(box(canvas('coronal')).top).toBeGreaterThan(box(canvas('sagittal')).bottom);
    expect(box(canvas('coronal')).left).toBe(box(canvas('sagittal')).left);
  });

  test('just wider than a phone, where docking would leave the stage under 360 px, it is the modal instead', async () => {
    // The resize lands before the mount, so the layout is the one measured as the MRI opens.
    const resized = new Promise((resolve) => addEventListener('resize', resolve, { once: true }));
    await page.viewport(820, 1180);
    await resized;
    await mount();
    const whole = box(document.getElementById('viewport')!).width;
    await engine.sections.load();
    mpr.show({ instant: true });
    await expect.poll(() => dialog()?.open).toBe(true);
    expect(dialog().matches(':modal')).toBe(true);
    expect(dock()).toBeNull();
    // The stage keeps its width under it, and its tools their row.
    expect(box(document.getElementById('viewport')!).width).toBe(whole);
    // Wide enough again, it docks beside the stage.
    await page.viewport(1024, 768);
    await expect.poll(dock).not.toBeNull();
    expect(box(document.getElementById('viewport')!).width).toBeGreaterThanOrEqual(360);
  });

  test('the stage gets its room back when it closes', async () => {
    await mount();
    const stage = document.getElementById('viewport')!;
    const whole = box(stage).width;
    await openFromKeyboard();
    expect(box(stage).width).toBeLessThan(whole - 300);
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => box(stage).width).toBe(whole);
  });

  test('Escape inside closes it, keeps it from the page, and focus returns to the button that opened it', async () => {
    await opened();
    const reachedPage: boolean[] = [];
    const onKey = (event: KeyboardEvent) => reachedPage.push(event.defaultPrevented);
    window.addEventListener('keydown', onKey);
    try {
      sliderElement('Axial position').focus();
      await userEvent.keyboard('{Escape}');
      await expect.poll(shown).toBe(false);
      // The page's keymap ignores a key a control already handled: Escape does not also clear the selection.
      expect(reachedPage).toEqual([true]);
      await expect.poll(() => document.activeElement).toBe(opener());
    } finally {
      window.removeEventListener('keydown', onKey);
    }
  });

  test('the Close button closes it and focus returns to the opener', async () => {
    await opened();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect.poll(shown).toBe(false);
    await expect.poll(() => document.activeElement).toBe(opener());
  });

  test('closing it while focus is elsewhere leaves focus where it is', async () => {
    await opened();
    more().focus();
    mpr.close({ instant: true });
    await expect.poll(shown).toBe(false);
    expect(document.activeElement).toBe(more());
  });

  test('without the opener, closing hands focus to the fallback', async () => {
    await mount();
    await engine.sections.load();
    mpr.show({ instant: false });
    await expect.poll(shown).toBe(true);
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => document.activeElement).toBe(more());
  });

  test('over the full-screen stage, where a docked region is not drawn, it is the modal on top', async () => {
    await mount();
    const entered = new Promise((resolve) =>
      document.addEventListener('fullscreenchange', resolve, { once: true }),
    );
    await userEvent.click(page.getByRole('button', { name: 'Full screen' }));
    await entered;
    expect(document.fullscreenElement).toBe(document.getElementById('viewport'));
    // As `M` opens it there: the opener outside the stage is not drawn.
    await engine.sections.load();
    mpr.show({ instant: true });
    await expect.poll(() => dialog()?.open).toBe(true);
    expect(dock()).toBeNull();
    expect(dialog().matches(':modal')).toBe(true);
    expect(dialog().contains(document.activeElement)).toBe(true);
    expect(view.holdsKeys()).toBe(true);
    // Leaving full screen docks it beside the stage again.
    await document.exitFullscreen();
    await expect.poll(dock).not.toBeNull();
    expect(dock()!.contains(document.activeElement)).toBe(true);
  });

  test("the page's keys stay out only while focus is inside it", async () => {
    await mount();
    expect(view.holdsKeys()).toBe(false);
    await openFromKeyboard();
    expect(view.holdsKeys()).toBe(true);
    sliderElement('Axial position').focus();
    expect(view.holdsKeys()).toBe(true);
    more().focus();
    expect(view.holdsKeys()).toBe(false);
  });
});

describe('the three planes', () => {
  test('each plane is a named section with a picture, a position slider and its own Save button', async () => {
    await opened();
    // Each names the side it is seen from, as the 3D view faces its cut, and so its convention.
    for (const [plane, label, side] of [
      ['sagittal', 'Sagittal', 'from the right'],
      ['coronal', 'Coronal', 'from the front · radiological'],
      ['axial', 'Axial', 'from above · neurological'],
    ] as const) {
      await expect.element(page.getByRole('region', { name: `${label} ${side}` })).toBeVisible();
      await expect.element(slider(`${label} position`)).toBeVisible();
      await expect
        .element(page.getByRole('button', { name: `Save PNG, ${plane}`, exact: true }))
        .toBeVisible();
      await expect
        .element(page.getByRole('img', { name: new RegExp(`^${label} MRI\\.`) }))
        .toBeVisible();
    }
  });

  test('a picture is an image, not a control: it takes no focus and has no key handler of its own', async () => {
    await opened();
    expect(canvas('axial').tabIndex).toBe(-1);
    // Arrow keys on a picture leave the crosshair alone (the slider is the keyboard route).
    canvas('axial').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await frame();
    expect(crosshair()).toEqual([0, 0, 0]);
  });

  test("Tab visits Close, then each plane's slider and Save, then Window, Level, the overlay and Reset display", async () => {
    await opened();
    const nameOf = (element: HTMLElement) =>
      (element as HTMLInputElement).labels?.[0]?.textContent?.trim() ??
      element.getAttribute('aria-label') ??
      element.textContent!.trim();
    const names: string[] = [];
    for (let stop = 0; stop < 11; stop++) {
      names.push(nameOf(document.activeElement as HTMLElement));
      await userEvent.tab();
    }
    expect(names).toEqual([
      'Close',
      'Sagittal position',
      'Save PNG, sagittal',
      'Coronal position',
      'Save PNG, coronal',
      'Axial position',
      'Save PNG, axial',
      'Window',
      'Level',
      'Segmentation overlay',
      'Reset display',
    ]);
  });
});

describe('moving the crosshair', () => {
  test("a position slider's arrows move one millimetre along its own axis, and its value is read in signed mm", async () => {
    await opened();
    sliderElement('Sagittal position').focus();
    await userEvent.keyboard('{ArrowRight}');
    await frame();
    await frame();
    expect(crosshair()).toEqual([1, 0, 0]);
    expect(sliderElement('Sagittal position').getAttribute('aria-valuetext')).toMatch(
      /^\+1\.0.mm$/,
    );
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await frame();
    await frame();
    expect(crosshair()).toEqual([-1, 0, 0]);
  });

  test('PageUp takes a larger step than an arrow, Home and End go to the ends of the range', async () => {
    await opened();
    sliderElement('Axial position').focus();
    await userEvent.keyboard('{PageUp}');
    await frame();
    await frame();
    // The browser's own page step (a tenth of the range in Chromium).
    expect(crosshair()[2]).toBeGreaterThan(1);
    expect(crosshair()[2]).toBeLessThanOrEqual(26);
    await userEvent.keyboard('{End}');
    await frame();
    await frame();
    expect(crosshair()[2]).toBe(128);
    await userEvent.keyboard('{Home}');
    await frame();
    await frame();
    expect(crosshair()[2]).toBe(-128);
  });

  test("the other planes' sliders follow a move made on one", async () => {
    await opened();
    sliderElement('Sagittal position').focus();
    await userEvent.keyboard('{PageUp}');
    await frame();
    await frame();
    // A different plane's slider shows the shared crosshair on its own axis, unaffected.
    expect(sliderElement('Axial position').value).toBe('0');
    engine.sections.setCrosshair([10, 20, 30]);
    await expect.poll(() => sliderElement('Coronal position').value).toBe('20');
    expect(sliderElement('Axial position').value).toBe('30');
  });

  test('a position slider that has focus still shows the crosshair when the wheel moves it', async () => {
    await opened();
    sliderElement('Axial position').focus();
    for (let notch = 0; notch < 3; notch++) {
      canvas('axial').dispatchEvent(
        new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }),
      );
    }
    await expect.poll(() => sliderElement('Axial position').value).toBe('3');
    expect(sliderElement('Axial position').getAttribute('aria-valuetext')).toMatch(/^\+3\.0.mm$/);
    await userEvent.keyboard('{ArrowUp}');
    await frame();
    await frame();
    expect(crosshair()[2]).toBe(4);
  });

  test('a click on a picture puts the crosshair under it, in that plane', async () => {
    await opened();
    const box = canvas('axial').getBoundingClientRect();
    canvas('axial').dispatchEvent(
      new MouseEvent('click', {
        clientX: box.left + box.width * 0.75,
        clientY: box.top + box.height * 0.25,
        bubbles: true,
      }),
    );
    // A quarter of the 256 mm field across and up, to the pixel the pointer event can report.
    expect(crosshair()[0]).toBeCloseTo(64, -0.5);
    expect(crosshair()[1]).toBeCloseTo(64, -0.5);
    expect(crosshair()[2]).toBe(0);
  });

  test('the wheel over a picture moves one millimetre a notch and keeps the page still', async () => {
    await opened();
    const event = new WheelEvent('wheel', { deltaY: 240, bubbles: true, cancelable: true });
    canvas('coronal').dispatchEvent(event);
    expect(crosshair()).toEqual([0, -1, 0]);
    expect(event.defaultPrevented).toBe(true);
  });

  test("Ctrl and Meta with the wheel are the browser's zoom: the picture does not take them", async () => {
    await opened();
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
      const event = new WheelEvent('wheel', {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
        ...modifier,
      });
      canvas('coronal').dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(crosshair()).toEqual([0, 0, 0]);
  });

  test('the wheel at the end of the range is left to the page, so the region can still scroll', async () => {
    await opened();
    engine.sections.setCrosshair([0, 0, 128]);
    const event = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    canvas('axial').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(crosshair()).toEqual([0, 0, 128]);
  });
});

describe('display', () => {
  test("Window and Level start at the scan's window and their arrows step by one", async () => {
    await opened();
    expect(sliderElement('Window').value).toBe('180');
    expect(sliderElement('Level').value).toBe('90');
    sliderElement('Window').focus();
    await userEvent.keyboard('{ArrowRight}');
    await frame();
    await frame();
    expect(engine.sections.display).toMatchObject({ windowWidth: 181, windowCenter: 90 });
    sliderElement('Level').focus();
    await userEvent.keyboard('{ArrowLeft}');
    await frame();
    await frame();
    expect(engine.sections.display).toMatchObject({ windowWidth: 181, windowCenter: 89 });
  });

  test("the segmentation overlay is a checkbox that sets the sections' overlay", async () => {
    await opened();
    const box = page.getByRole('checkbox', { name: 'Segmentation overlay' });
    await box.click();
    expect(engine.sections.state.overlay).toBe(true);
    await box.click();
    expect(engine.sections.state.overlay).toBe(false);
  });

  test("Reset display returns Window and Level to the scan's window and clears the overlay", async () => {
    await opened();
    engine.sections.setWindow(60, 40);
    await page.getByRole('checkbox', { name: 'Segmentation overlay' }).click();
    // A slider move still waiting for its frame does not undo the reset.
    mpr.setWindow({ width: 120 });
    await page.getByRole('button', { name: 'Reset display' }).click();
    await frame();
    await frame();
    expect(engine.sections.display).toMatchObject({ windowWidth: 180, windowCenter: 90 });
    expect(engine.sections.state.overlay).toBe(false);
    expect(sliderElement('Window').value).toBe('180');
    expect(sliderElement('Level').value).toBe('90');
  });
});

describe('the pictures', () => {
  test("draw the slice alone at the scan's resolution, and mark the crosshair over it at one screen pixel", async () => {
    await mount();
    engine.sections.setCrosshair([1, 1, 0]);
    await openFromKeyboard();
    await expect.poll(() => canvas('axial').width).toBe(SIZE);
    // The fake's slice, untouched where the crosshair falls.
    const index = 40 * SIZE + 64;
    expect(pixel(canvas('axial'), 64, 40)).toEqual([
      index % 256,
      (index * 3) % 256,
      (index * 7) % 256,
      255,
    ]);
    // 1 mm right and 1 mm anterior of the centre of a 256 mm field, seen from above.
    const picture = box(canvas('axial'));
    const down = box(section('axial').querySelector('.crosshair-down')!);
    const across = box(section('axial').querySelector('.crosshair-across')!);
    expect(down.width).toBe(1);
    expect(across.height).toBe(1);
    expect(down.left + 0.5).toBeCloseTo(picture.left + picture.width * (0.5 + 1 / 256), 1);
    expect(across.top + 0.5).toBeCloseTo(picture.top + picture.height * (0.5 - 1 / 256), 1);
  });

  test('every voxel is shown, however the segmentation covers it', async () => {
    // Voxels no label covers come back transparent; the picture still shows their intensity.
    vi.spyOn(engine.sections, 'pixels').mockImplementation(
      () => new Uint8ClampedArray(SIZE * SIZE * 4),
    );
    await opened();
    await expect.poll(() => canvas('sagittal').width).toBe(SIZE);
    expect(pixel(canvas('sagittal'), 5, 5)[3]).toBe(255);
  });

  test("letter each edge as the stage does, in the reader's language: right and left are D and G in French", async () => {
    await opened();
    const letters = () =>
      [...section('axial').querySelectorAll<HTMLElement>('.edge')].map((edge) => [
        edge.dataset.edge,
        edge.textContent,
      ]);
    expect(letters()).toEqual([
      ['top', 'A'],
      ['right', 'R'],
      ['bottom', 'P'],
      ['left', 'L'],
    ]);
    // Type, not part of the bitmap: as legible on a small panel as on the stage.
    const edge = section('axial').querySelector<HTMLElement>('[data-edge="left"]')!;
    expect(getComputedStyle(edge).fontSize).toBe('14px');
    expect(edge.getAttribute('aria-hidden')).toBe('true');
    live.lang = 'fr';
    await expect.poll(letters).toEqual([
      ['top', 'A'],
      ['right', 'D'],
      ['bottom', 'P'],
      ['left', 'G'],
    ]);
  });

  test('a plane is resampled only when its own slice changes', async () => {
    await opened();
    await expect.poll(() => calls('slice').length).toBe(3);
    // Without a paint, the cut's labels are not part of the picture.
    await engine.model.setAtlas('julich');
    engine.sections.setDisplay({ reverse: true });
    await frame();
    await frame();
    expect(calls('slice')).toHaveLength(3);
    // Right of the midline moves the sagittal slice; the other two only move their crosshair.
    engine.sections.setCrosshair([3, 0, 0]);
    await expect.poll(() => calls('slice').length).toBe(4);
    expect((calls('slice').at(-1)!.args[0] as { normal: number[] }).normal).toEqual([1, 0, 0]);
    expect(section('coronal').querySelector<HTMLElement>('.crosshair-down')!.style.left).not.toBe(
      '50%',
    );
  });

  test('SECT-38 Window, Level and FA opacity draw each plane again from what it kept, reading nothing again', async () => {
    // FA counted as it is read: the readout reads it at the crosshair, a plane at each of its pixels.
    let faReads = 0;
    const loadFa = engine.tracts.loadFa;
    vi.spyOn(engine.tracts, 'loadFa').mockImplementation(async () => {
      const fa = await loadFa();
      return (point) => {
        faReads++;
        return fa(point);
      };
    });
    const onPlane = vi.spyOn(engine.tracts, 'onPlane');
    await engine.tracts.setActive(true);
    engine.tracts.setOverlay(true);
    await mount({ key: 'drawn' });
    await openFromKeyboard();
    sliderElement('FA opacity').focus();
    await userEvent.keyboard('{End}');
    await expect.poll(() => faReads).toBeGreaterThanOrEqual(3 * SIZE * SIZE);
    await frame();
    await frame();
    const read = { slice: calls('slice').length, onPlane: onPlane.mock.calls.length, fa: faReads };
    const drawn = calls('pixels').length;
    expect(read.slice).toBe(3);
    engine.sections.setWindow(100, 120);
    await expect.poll(() => calls('pixels').length).toBe(drawn + 3);
    sliderElement('Level').focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(() => calls('pixels').length).toBe(drawn + 6);
    sliderElement('FA opacity').focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(() => calls('pixels').length).toBe(drawn + 9);
    expect(calls('slice')).toHaveLength(read.slice);
    expect(onPlane).toHaveBeenCalledTimes(read.onPlane);
    expect(faReads - read.fa).toBeLessThan(SIZE * SIZE);
    // FA's kept level at 95 % over the fake's slice, where no tract runs.
    const [x, y] = [50, 50];
    const point = pointOnPlane(
      engine.sections.mprFrame('axial'),
      (x + 0.5) / SIZE,
      (y + 0.5) / SIZE,
      256,
    );
    const index = y * SIZE + x;
    const expected = new Uint8ClampedArray(
      [index % 256, (index * 3) % 256, (index * 7) % 256].map(
        (value, channel) =>
          value * (1 - 0.95) + VIRIDIS[Math.round(255 * ((point[0] + 50) / 100))]![channel]! * 0.95,
      ),
    );
    expect(pixel(canvas('axial'), x, y)).toEqual([...expected, 255]);
  });

  test('SECT-38 only the planes shown keep what they sampled, and only while the MRI is open', async () => {
    await opened();
    await expect.poll(() => calls('slice').length).toBe(3);
    // Opened again, each plane is sampled afresh: nothing was kept while the MRI was closed.
    await page.getByRole('button', { name: 'Close' }).click();
    await expect.poll(shown).toBe(false);
    await openFromKeyboard();
    await expect.poll(() => calls('slice').length).toBe(6);
  });

  test('SECT-38 a paint is sampled again when what it draws changes, as a freshly opened MRI draws it', async () => {
    const pictures = () =>
      (['sagittal', 'coronal', 'axial'] as const).map((plane) => {
        const target = canvas(plane);
        return target.getContext('2d')!.getImageData(0, 0, target.width, target.height).data;
      });
    /** The bytes of the planes kept that differ from the planes a closed MRI opened again samples. */
    async function againstFresh(): Promise<number> {
      const kept = pictures();
      const sampled = calls('slice').length;
      await page.getByRole('button', { name: 'Close' }).click();
      await expect.poll(shown).toBe(false);
      await openFromKeyboard();
      await expect.poll(() => calls('slice').length).toBe(sampled + 3);
      const fresh = pictures();
      return kept.reduce(
        (count, data, plane) =>
          count + data.filter((value, index) => value !== fresh[plane]![index]).length,
        0,
      );
    }
    engine.model.setPaint({ id: 'function:language', colors: new Map() });
    await opened();
    await expect.poll(() => calls('slice').length).toBe(3);
    const first = pictures();
    // Another atlas labels the cut, and the paint is drawn by its labels.
    await engine.model.setAtlas('julich');
    await expect.poll(() => calls('slice').length).toBe(6);
    expect(pictures()[2]).not.toEqual(first[2]);
    expect(await againstFresh()).toBe(0);
    // A raised threshold is another paint, and so is another tab's.
    engine.model.setPaint({ id: 'function:language:z5', colors: new Map() });
    await expect.poll(() => calls('slice').length).toBe(12);
    expect(await againstFresh()).toBe(0);
    engine.model.setPaint({ id: 'deficit:aphasia', colors: new Map() });
    await expect.poll(() => calls('slice').length).toBe(18);
    expect(await againstFresh()).toBe(0);
    // Another surface atlas labels the cut by its own regions, so a deficit's paint is drawn by
    // them. (A function's paint takes the atlas into its id, FUNC-46.)
    await engine.model.setAtlas(engine.model.state.atlas === 'hcp-mmp' ? 'destrieux' : 'hcp-mmp');
    await expect.poll(() => calls('slice').length).toBe(24);
    expect(await againstFresh()).toBe(0);
    // A window is drawn from the samples kept.
    const drawn = calls('pixels').length;
    engine.sections.setWindow(100, 120);
    await expect.poll(() => calls('pixels').length).toBe(drawn + 3);
    expect(calls('slice')).toHaveLength(27);
  });

  test('reversing the cut on a plane turns that panel to the side the stage now faces, and redraws it', async () => {
    await opened();
    await engine.sections.setMode('coronal');
    await expect
      .poll(() => section('coronal').querySelector('h3')!.textContent)
      .toMatch(/from the front/);
    const drawn = calls('pixels').length;
    engine.sections.setDisplay({ reverse: true });
    await expect
      .poll(() => section('coronal').querySelector('h3')!.textContent)
      .toMatch(/from behind/);
    await expect.poll(() => calls('pixels').length).toBeGreaterThan(drawn);
    expect(canvas('coronal').getAttribute('aria-label')).toMatch(/patient right at the right/);
  });

  test('an axial or coronal picture marks its convention on the image; a sagittal one has no left or right to mark', async () => {
    await opened();
    const mark = (plane: string) =>
      section(plane).querySelector('.picture .convention')?.textContent ?? null;
    expect([mark('sagittal'), mark('coronal'), mark('axial')]).toEqual([
      null,
      'Radiological',
      'Neurological',
    ]);
    await engine.sections.setMode('coronal');
    engine.sections.setDisplay({ reverse: true });
    await expect.poll(() => mark('coronal')).toBe('Neurological');
    live.lang = 'fr';
    await expect
      .poll(() => [mark('coronal'), mark('axial')])
      .toEqual(['Neurologique', 'Neurologique']);
  });
});

describe('the tracts and FA', () => {
  /** The fake draws each shown bundle across a plane's centre, 10 mm either side along `u`, pure red. */
  async function withTracts() {
    await engine.tracts.setActive(true);
    engine.tracts.setOverlay(true);
    await mount({ key: 'drawn' });
    await openFromKeyboard();
    await expect.poll(() => canvas('axial').width).toBe(SIZE);
  }
  // 5 mm along `u` from the centre of a 256 mm field drawn at SIZE pixels.
  const ON_TRACT = [Math.floor(SIZE / 2 + (5 * SIZE) / 256), SIZE / 2] as const;

  test('are drawn into each slice in their direction colour, so a saved PNG keeps them', async () => {
    await withTracts();
    for (const plane of ['sagittal', 'coronal', 'axial']) {
      expect(pixel(canvas(plane), ...ON_TRACT), plane).toEqual([255, 0, 0, 255]);
    }
  });

  test('another subject’s tracts are not drawn, and FA is not offered', async () => {
    await engine.tracts.setActive(true);
    engine.tracts.setOverlay(true);
    const onPlane = vi.spyOn(engine.tracts, 'onPlane');
    await opened();
    await expect.poll(() => canvas('axial').width).toBe(SIZE);
    const index = ON_TRACT[1] * SIZE + ON_TRACT[0];
    expect(pixel(canvas('axial'), ...ON_TRACT)).toEqual([
      index % 256,
      (index * 3) % 256,
      (index * 7) % 256,
      255,
    ]);
    expect(onPlane).not.toHaveBeenCalled();
    expect(page.getByRole('slider', { name: 'FA opacity' }).query()).toBeNull();
  });

  test('tracts published without an FA map, an averaged atlas’s, are drawn with no FA control or note', async () => {
    Object.defineProperty(engine.tracts, 'hasFa', { value: false });
    await withTracts();
    const notes = shell().querySelector('.note')!.textContent;
    expect(notes).toContain('Tracts: the streamlines the 3D view draws');
    expect(notes).not.toContain('FA');
    expect(page.getByRole('slider', { name: 'FA opacity' }).query()).toBeNull();
    // The scan's own controls are still there.
    expect(page.getByRole('slider', { name: 'Level' }).query()).not.toBeNull();
  });

  test('FA downloads once its opacity leaves zero, is drawn in viridis, and joins the readout', async () => {
    const loadFa = vi.spyOn(engine.tracts, 'loadFa');
    await withTracts();
    expect(loadFa).not.toHaveBeenCalled();
    sliderElement('FA opacity').focus();
    await userEvent.keyboard('{End}');
    // The fake's FA is 0.5 at x = 0.
    await expect
      .poll(() => shell().querySelector('.where')!.textContent)
      .toMatch(/ · FA\u00a00\.50$/);
    expect(loadFa).toHaveBeenCalledTimes(1);
    // At full opacity a pixel off the tract is FA's own colour, (x + 50) / 100 at its centre.
    const [x, y] = [50, 50];
    const frame = engine.sections.mprFrame('axial');
    const point = pointOnPlane(frame, (x + 0.5) / SIZE, (y + 0.5) / SIZE, 256);
    expect(point.every((value) => Math.abs(value) < 50)).toBe(true);
    const level = Math.round(255 * ((point[0] + 50) / 100));
    expect(pixel(canvas('axial'), x, y)).toEqual([...VIRIDIS[level]!, 255]);
  });

  test('Reset display returns FA opacity to zero and takes FA out of the readout', async () => {
    await withTracts();
    sliderElement('FA opacity').focus();
    await userEvent.keyboard('{End}');
    await expect
      .poll(() => shell().querySelector('.where')!.textContent)
      .toMatch(/ · FA\u00a00\.50$/);
    await page.getByRole('button', { name: 'Reset display' }).click();
    expect(sliderElement('FA opacity').value).toBe('0');
    await expect.poll(() => shell().querySelector('.where')!.textContent).not.toMatch(/FA/);
  });
});

describe('the readout', () => {
  test('shows where the crosshair is and what is under it, at once', async () => {
    await opened();
    expect(shell().querySelector('.where')!.textContent).toBe(
      '0.0, 0.0, 0.0 mm — Unlabelled (label 0)',
    );
    engine.sections.setCrosshair([1, -2, 3.5]);
    await expect
      .poll(() => shell().querySelector('.where')!.textContent)
      .toBe('+1.0, −2.0, +3.5 mm — label-1 (label 1)');
  });

  test("is in the reader's language", async () => {
    await opened();
    engine.sections.setCrosshair([1, -2, 3.5]);
    live.lang = 'fr';
    await expect
      .poll(() => shell().querySelector('.where')!.textContent)
      .toBe('+1,0 ; −2,0 ; +3,5 mm — label-1 (étiquette 1)');
  });

  test('is said once the crosshair has rested, and not at all on opening', async () => {
    await opened();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(announced).toEqual([]);
    // Four moves inside the quiet period, whatever the machine's speed.
    for (const x of [1, 2, 3, 4]) {
      engine.sections.setCrosshair([x, 0, 0]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await expect.poll(() => announced.length, { timeout: 2000 }).toBe(1);
    expect(announced).toEqual(['+4.0, 0.0, 0.0\u202fmm — Unlabelled (label 0)']);
  });

  test('is the only live region in the page that can be heard: exactly one, inside the MRI, polite', async () => {
    await opened();
    const live = document.querySelectorAll(
      '[role="status"], [role="alert"], [role="log"], [aria-live]:not([aria-live="off"]), output:not([aria-hidden="true"])',
    );
    expect([...live]).toEqual([statusRegion()]);
    expect(shell().contains(statusRegion())).toBe(true);
    expect(getComputedStyle(statusRegion()).position).toBe('absolute');
  });
});

describe('Save PNG', () => {
  test("saves the plane's picture under subject, plane and offset, and says it did", async () => {
    const clicked: { download: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ download: this.download, href: this.href });
    });
    await mount();
    engine.sections.setCrosshair([0, 0, -7.46]);
    await openFromKeyboard();
    await expect.poll(() => canvas('axial').width).toBe(SIZE);
    await page.getByRole('button', { name: 'Save PNG, axial', exact: true }).click();
    expect(clicked).toHaveLength(1);
    expect(clicked[0]!.download).toBe('sub_013-axial--7.5mm.png');
    expect(clicked[0]!.href.startsWith('data:image/png;base64,')).toBe(true);
    await expect.poll(() => statusRegion().textContent).toBe('Saved the axial section as a PNG.');
  });

  test('the saved picture carries its own crosshair, edge letters, convention and offset, in the reader’s language', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const saved: HTMLCanvasElement[] = [];
    const toDataURL = HTMLCanvasElement.prototype.toDataURL;
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (
      this: HTMLCanvasElement,
      ...args
    ) {
      saved.push(this);
      return toDataURL.apply(this, args);
    });
    const drawn: string[] = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText').mockImplementation(function (
      this: CanvasRenderingContext2D,
      text,
      ...rest
    ) {
      drawn.push(text);
      fillText.call(this, text, ...rest);
    });
    await mount();
    engine.sections.setCrosshair([1, 1, 12.5]);
    await openFromKeyboard();
    await expect.poll(() => canvas('axial').width).toBe(SIZE);
    // The screen's picture has no text drawn into it.
    expect(drawn).toEqual([]);
    await page.getByRole('button', { name: 'Save PNG, axial', exact: true }).click();
    expect(drawn).toEqual(['A', 'R', 'P', 'L', 'Neurological', 'Axial +12.5 mm']);
    // 1 mm of a 256 mm field on 128 pixels: the crosshair is the single column 64, ringed in dark.
    const [image] = saved;
    expect(image!.width).toBe(SIZE);
    expect(pixel(image!, 64, 40)).toEqual([79, 182, 224, 255]);
    expect(pixel(image!, 63, 40)).toEqual([14, 17, 22, 255]);
    expect(pixel(image!, 65, 40)).toEqual([14, 17, 22, 255]);
    drawn.length = 0;
    live.lang = 'fr';
    await expect
      .poll(() => section('axial').querySelector('[data-edge="right"]')!.textContent)
      .toBe('D');
    await page.getByRole('button', { name: 'Enregistrer PNG, axial', exact: true }).click();
    expect(drawn).toEqual(['A', 'D', 'P', 'G', 'Neurologique', 'Axial +12,5 mm']);
  });

  test('saving the same plane twice is spoken twice: the sentence is cleared, then written a moment later', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await opened();
    const writes: { text: string; at: number }[] = [];
    new MutationObserver(() =>
      writes.push({ text: statusRegion().textContent!, at: performance.now() }),
    ).observe(statusRegion(), { childList: true, characterData: true, subtree: true });
    const save = page.getByRole('button', { name: 'Save PNG, axial', exact: true });
    await save.click();
    await expect.poll(() => statusRegion().textContent).toBe('Saved the axial section as a PNG.');
    writes.length = 0;
    await save.click();
    await expect
      .poll(() => writes.map((write) => write.text))
      .toEqual(['', 'Saved the axial section as a PNG.']);
    expect(writes[1]!.at - writes[0]!.at).toBeGreaterThanOrEqual(16);
  });

  test('says so in French', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    live.lang = 'fr';
    await opened();
    await page.getByRole('button', { name: 'Enregistrer PNG, sagittal', exact: true }).click();
    await expect
      .poll(() => statusRegion().textContent)
      .toBe('Coupe sagittale enregistrée au format PNG.');
  });
});

describe('on a phone', () => {
  beforeEach(() => page.viewport(390, 844));

  test('there is no room beside the stage: it is a full-screen modal, Close the first stop', async () => {
    await opened();
    expect(dock()).toBeNull();
    await expect.element(page.getByRole('dialog', { name: 'Linked MRI sections' })).toBeVisible();
    expect(dialog().matches(':modal')).toBe(true);
    expect(box(dialog()).width).toBe(390);
    expect(document.activeElement).toBe(page.getByRole('button', { name: 'Close' }).element());
    expect(view.holdsKeys()).toBe(true);
  });

  test('Escape closes it at once and focus returns to the button that opened it', async () => {
    await opened();
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => dialog().open).toBe(false);
    expect(dialog().hasAttribute('data-instant')).toBe(true);
    await expect.poll(() => document.activeElement).toBe(opener());
  });

  test('a keyboard opening has no transition; a pointer opening does', async () => {
    await mount();
    await openFromKeyboard();
    expect(dialog().hasAttribute('data-instant')).toBe(true);
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => dialog().open).toBe(false);
    await page.getByRole('button', { name: 'Linked MRI' }).click();
    await expect.poll(() => dialog().open).toBe(true);
    expect(dialog().hasAttribute('data-instant')).toBe(false);
  });

  test('is not dismissed by a click on the backdrop', async () => {
    await opened();
    dialog().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await frame();
    expect(dialog().open).toBe(true);
  });

  test('one plane is shown, chosen by a radio group, and only it is drawn', async () => {
    await opened();
    await expect.element(page.getByRole('radiogroup', { name: 'Section plane' })).toBeVisible();
    await expect.element(page.getByRole('radio', { name: 'Axial' })).toBeChecked();
    expect(section('axial').hidden).toBe(false);
    expect(section('sagittal').hidden).toBe(true);
    expect(section('coronal').hidden).toBe(true);
    await expect.poll(() => canvas('axial').width).toBe(SIZE);
    expect(calls('pixels')).toHaveLength(1);
  });

  test('SECT-38 a hidden plane keeps nothing: shown again after a new window, it is sampled afresh', async () => {
    await opened();
    await expect.poll(() => calls('slice').length).toBe(1);
    (page.getByRole('radio', { name: 'Axial' }).element() as HTMLElement).focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(() => calls('slice').length).toBe(2);
    const drawn = calls('pixels').length;
    engine.sections.setWindow(100, 120);
    await expect.poll(() => calls('pixels').length).toBe(drawn + 1);
    expect(calls('slice')).toHaveLength(2);
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(page.getByRole('radio', { name: 'Axial' })).toBeChecked();
    await expect.poll(() => calls('slice').length).toBe(3);
  });

  test('the arrow keys choose the plane, and the plane chosen is drawn at once', async () => {
    await opened();
    (page.getByRole('radio', { name: 'Axial' }).element() as HTMLElement).focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(page.getByRole('radio', { name: 'Coronal' })).toBeChecked();
    expect(document.activeElement).toBe(page.getByRole('radio', { name: 'Coronal' }).element());
    expect(section('coronal').hidden).toBe(false);
    expect(section('axial').hidden).toBe(true);
    await expect.poll(() => canvas('coronal').width).toBe(SIZE);
  });

  test('the plane still has its heading for a screen reader, though the radio names it', async () => {
    await opened();
    await expect
      .element(page.getByRole('heading', { name: 'Axial from above · neurological', level: 3 }))
      .toBeInTheDocument();
    const heading = section('axial').querySelector('h3')!;
    expect(heading.querySelector('.plane-name')!.getBoundingClientRect().width).toBeLessThanOrEqual(
      1,
    );
    // The side the picture is seen from is drawn, on Save's line.
    const seen = heading.querySelector('.seen-from')!.getBoundingClientRect();
    const save = section('axial').querySelector('.save')!.getBoundingClientRect();
    expect(seen.width).toBeGreaterThan(1);
    expect(seen.top).toBeGreaterThanOrEqual(save.top);
    expect(seen.bottom).toBeLessThanOrEqual(save.bottom);
  });

  test("the plane fills the dialog's width, up to 800 px of window", async () => {
    await page.viewport(780, 900);
    await opened();
    const grid = dialog().querySelector('.grid')!.getBoundingClientRect();
    expect(section('axial').getBoundingClientRect().width).toBeGreaterThan(grid.width * 0.9);
  });

  test('focus in a plane that the window then hides goes to the radio group', async () => {
    await page.viewport(1280, 900);
    await opened();
    sliderElement('Coronal position').focus();
    await page.viewport(390, 844);
    // The phone radio group renders after the resize; the locator is retried until it has focus.
    await expect.element(page.getByRole('radio', { name: 'Axial' })).toHaveFocus();
  });

  test("widening the window while a radio has focus keeps focus in the MRI, on the plane's slider", async () => {
    await opened();
    (page.getByRole('radio', { name: 'Axial' }).element() as HTMLElement).focus();
    await page.viewport(1280, 900);
    // The docked region replaces the dialog; the locator is retried until its slider has focus.
    await expect.element(slider('Axial position')).toHaveFocus();
  });

  test('has no horizontal scroll, and the targets are 44 px on a coarse pointer', async () => {
    await opened();
    expect(dialog().scrollWidth).toBeLessThanOrEqual(dialog().clientWidth);
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      for (const element of [
        page.getByRole('button', { name: 'Close' }).element(),
        page.getByRole('radio', { name: 'Axial' }).element(),
        page.getByRole('button', { name: 'Save PNG, axial' }).element(),
        sliderElement('Axial position'),
        sliderElement('Window'),
      ]) {
        expect(
          element.getBoundingClientRect().height,
          element.outerHTML.slice(0, 60),
        ).toBeGreaterThanOrEqual(44);
      }
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
  });
});

describe('the sticky header', () => {
  test('never covers a control that keyboard focus scrolls into view', async () => {
    await page.viewport(390, 500);
    await opened();
    sliderElement('Level').focus();
    sliderElement('Axial position').focus();
    await frame();
    const header = dialog().querySelector('.dialog-header')!.getBoundingClientRect();
    expect(sliderElement('Axial position').getBoundingClientRect().top).toBeGreaterThanOrEqual(
      header.bottom,
    );
  });
});

describe('contrast and colour modes', () => {
  test('the position sliders are drawn exactly as the Window slider: no native appearance, the same box', async () => {
    await opened();
    const drawn = (name: string) => {
      const style = getComputedStyle(sliderElement(name));
      return [
        style.appearance,
        style.height,
        style.marginTop,
        style.accentColor,
        style.backgroundColor,
      ];
    };
    expect(drawn('Window')[0]).toBe('none');
    for (const name of ['Sagittal position', 'Coronal position', 'Axial position']) {
      expect(drawn(name), name).toEqual(drawn('Window'));
    }
  });

  test('forced colours draw the position sliders in system colours', async () => {
    await opened();
    const resolve = (colour: string) => {
      const probe = document.body.appendChild(document.createElement('div'));
      probe.style.color = colour;
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    };
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      const slider = sliderElement('Axial position');
      expect(getComputedStyle(slider).forcedColorAdjust).toBe('none');
      expect(getComputedStyle(slider, '::-webkit-slider-thumb').borderTopColor).toBe(
        resolve('CanvasText'),
      );
    });
  });

  test('forced colours draw the checkbox as a system control', async () => {
    await opened();
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      const box = page.getByRole('checkbox').element();
      expect(getComputedStyle(box).appearance).toBe('auto');
    });
  });

  test('more contrast gives the dialog the stronger text and border colours', async () => {
    await opened();
    const probe = (variable: string) => {
      const element = shell().querySelector('.mpr')!;
      return getComputedStyle(element).getPropertyValue(variable).trim();
    };
    const normal = probe('--border-control');
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], () => {
      expect(probe('--border-control')).toBe(probe('--text-primary'));
      expect(probe('--text-tertiary')).toBe(probe('--text-secondary'));
    });
    expect(probe('--border-control')).toBe(normal);
  });
});

describe('accessibility', () => {
  test('passes axe in light and dark, on a desktop and a phone, in English', async () => {
    await opened();
    await expectAxeClean();
  });

  test('passes axe in French', async () => {
    live.lang = 'fr';
    await opened();
    await expectAxeClean();
  });
});

describe('segmentation agreement', () => {
  const key = () => shell().querySelector<HTMLElement>('.agreement');
  const overlay = () =>
    page.getByRole('checkbox', { name: 'Segmentation overlay' }).element() as HTMLInputElement;

  test('the shown structure is named with the planes’ key; it holds the overlay, and Hide clears it', async () => {
    await render(Fixture, {
      engine,
      engineState: createEngineSync(engine),
      mpr,
      live,
      anatomy,
      agreementName: 'Amygdala and transition areas · Left',
    });
    await userEvent.click(opener());
    expect(key()!.querySelector('.agreement-name')!.textContent).toBe(
      'Agreement: Amygdala and transition areas · Left',
    );
    expect([...key()!.querySelectorAll('li')].map((item) => item.textContent!.trim())).toEqual([
      'Both segmentations',
      'aseg only',
      'NextBrain only',
    ]);
    expect(overlay().disabled).toBe(true);
    await userEvent.click(page.getByRole('button', { name: 'Hide agreement' }));
    expect(calls('setAgreement').map((call) => call.args)).toEqual([[null]]);
    await expectAxeClean();
  });

  test('without a shown structure there is no key and the overlay is free', async () => {
    await mount();
    await userEvent.click(opener());
    expect(key()).toBeNull();
    expect(overlay().disabled).toBe(false);
  });
});
