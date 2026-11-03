// The Linked MRI dialog over the fake engine in a real browser: what the reader gets from the three
// planes, the keyboard and the pointer, the phone's one-plane mode, the live region and the saved
// PNG. Each test states one rule with fixed expected values; the legacy viewer is not imported
// (decision on #4, 2026-10-26). The engine's own maths are proved in mpr-dialog.test.ts.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import { createEngineSync } from '../../lib/state/engine-sync.svelte.ts';
import type { Language, Manifest } from '../../lib/types/index.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import { createMprDialog } from './mpr-dialog.svelte.ts';
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

async function mount() {
  const result = await render(Fixture, {
    engine,
    engineState: createEngineSync(engine),
    mpr,
    live,
    anatomy,
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

  test('takes a column beside the stage at 1280 px, and the lower half of its column at 1024 px', async () => {
    await opened();
    const stage = document.getElementById('viewport')!;
    expect(box(dock()!).left).toBe(box(stage).right);
    expect(box(dock()!).top).toBe(box(stage).top);
    expect(box(dock()!).height).toBe(box(stage).height);
    // A 2 × 2 of slices: two planes side by side, the third under the first.
    expect(box(canvas('coronal')).top).toBe(box(canvas('sagittal')).top);
    expect(box(canvas('axial')).left).toBe(box(canvas('sagittal')).left);
    await page.viewport(1024, 1000);
    await expect.poll(() => box(dock()!).top).toBe(box(stage).bottom);
    expect(box(dock()!).left).toBe(box(stage).left);
    expect(box(dock()!).width).toBe(box(stage).width);
    // Three planes in a row under the stage.
    expect(box(canvas('axial')).top).toBe(box(canvas('sagittal')).top);
    expect(box(canvas('axial')).left).toBeGreaterThan(box(canvas('coronal')).right);
  });

  test('a window too short to share opens it over the page, and leaves the stage whole', async () => {
    await page.viewport(1024, 768);
    await mount();
    const stage = document.getElementById('viewport')!;
    const whole = box(stage).height;
    await openFromKeyboard();
    await expect.poll(() => dialog()?.open).toBe(true);
    expect(dialog().matches(':modal')).toBe(true);
    expect(dock()).toBeNull();
    expect(box(stage).height).toBe(whole);
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

  test("Tab visits Close, then each plane's slider and Save, then Window, Level and the overlay", async () => {
    await opened();
    const nameOf = (element: HTMLElement) =>
      (element as HTMLInputElement).labels?.[0]?.textContent?.trim() ??
      element.getAttribute('aria-label') ??
      element.textContent!.trim();
    const names: string[] = [];
    for (let stop = 0; stop < 10; stop++) {
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
    await expect.poll(() => calls('pixels').length).toBe(3);
    // The cut atlas is not part of the picture.
    await engine.sections.setCutAtlas(engine.sections.state.cutAtlas);
    engine.sections.setDisplay({ reverse: true });
    await frame();
    await frame();
    expect(calls('pixels')).toHaveLength(3);
    // Right of the midline moves the sagittal slice; the other two only move their crosshair.
    engine.sections.setCrosshair([3, 0, 0]);
    await expect.poll(() => calls('pixels').length).toBe(4);
    expect((calls('pixels').at(-1)!.args[0] as { normal: number[] }).normal).toEqual([1, 0, 0]);
    expect(section('coronal').querySelector<HTMLElement>('.crosshair-down')!.style.left).not.toBe(
      '50%',
    );
    engine.sections.setWindow(100, 180);
    await expect.poll(() => calls('pixels').length).toBe(7);
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

  test('the saved picture carries its own crosshair, edge letters and offset, in the reader’s language', async () => {
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
    expect(drawn).toEqual(['A', 'R', 'P', 'L', 'Axial +12.5 mm']);
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
    expect(drawn).toEqual(['A', 'D', 'P', 'G', 'Axial +12,5 mm']);
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
    const heading = section('axial').querySelector('h3')!.getBoundingClientRect();
    expect(heading.width).toBeLessThanOrEqual(1);
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
