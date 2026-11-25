// The Linked MRI's serial sections over the fake engine in a real browser. The fake's labelled box
// runs −60…60, −90…70 and −60…80 mm and its scan is 256 mm at 128 px, so an axial series is eleven
// sections 13 mm apart from −55 to +75 mm, each picture 64 × 84 px. Fixed expected values.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../test/fixtures/cdmd-manifest.json' with { type: 'json' };
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import { createEngineSync } from '../../lib/state/engine-sync.svelte.ts';
import type { Language, Manifest } from '../../lib/types/index.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import { createMprDialog } from './mpr-dialog.svelte.ts';
import type { MprDialogController } from './mpr-dialog.svelte.ts';
import Fixture from './mpr-test-support.svelte';

const SIZE = 128;
const NNBSP = ' ';
const MINUS = '−';
const AXIAL = [-55, -42, -29, -16, -3, 10, 23, 36, 49, 62, 75];
const mm = (value: number) =>
  `${value < 0 ? MINUS : value > 0 ? '+' : ''}${Math.abs(value)}${NNBSP}mm`;

let engine: FakeEngine;
let mpr: MprDialogController;
let live: { lang: Language };
let showPlane: ReturnType<typeof vi.fn<(plane: string) => void>>;

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
  showPlane = vi.fn();
  mpr = createMprDialog({ engine, select: () => {}, showPlane });
});
afterEach(() => {
  mpr.dispose();
  vi.restoreAllMocks();
  cleanup();
});

const shell = (): HTMLElement =>
  document.querySelector<HTMLElement>('.mpr-dock') ?? document.querySelector('dialog')!;
const pictures = () => [...shell().querySelectorAll<HTMLCanvasElement>('.series canvas')];
const names = () => pictures().map((canvas) => canvas.getAttribute('aria-label'));
const section = (position: number) =>
  pictures().find((canvas) =>
    canvas.getAttribute('aria-label')!.startsWith(`Axial section at ${mm(position)}.`),
  )!;
const slices = () =>
  engine.calls.filter((call) => call.domain === 'sections' && call.method === 'slice');
const statusRegion = () => shell().querySelector('[role="status"]') as HTMLElement;

async function series(tracts: { key: string } | null = null) {
  await render(Fixture, {
    engine,
    engineState: createEngineSync(engine),
    mpr,
    live,
    anatomy: { subject: 'sub_013', individual: true },
    tracts,
  });
  await userEvent.click(page.getByRole('button', { name: 'Linked MRI' }));
  await userEvent.click(page.getByRole('radio', { name: 'Serial sections' }));
  await expect.poll(() => pictures().at(-1)?.width).toBe(64);
}

function pixel(canvas: HTMLCanvasElement, x: number, y: number) {
  return [...canvas.getContext('2d')!.getImageData(x, y, 1, 1).data];
}

/** A click at fractions of a picture, exactly, as a pointer would place it. */
function clickAt(canvas: HTMLCanvasElement, x: number, y: number) {
  const box = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      clientX: box.left + x * box.width,
      clientY: box.top + y * box.height,
    }),
  );
}

describe('SECT-40 serial sections', () => {
  test('show the localizer, then eleven sections of the chosen plane named by position, in place of the three planes', async () => {
    await series();
    expect(names()).toEqual([
      `Where the 11 axial sections lie, marked on the sagittal section at 0${NNBSP}mm.`,
      ...AXIAL.map((at) => `Axial section at ${mm(at)}. Click to place the crosshair there.`),
    ]);
    expect(shell().querySelector('.series .spacing')!.textContent!.trim()).toBe(
      `11 sections, 13${NNBSP}mm apart`,
    );
    expect(page.getByRole('heading', { name: /^Axial from above/ }).query()).not.toBeNull();
    await expect.element(page.getByRole('radio', { name: 'Axial' })).toBeChecked();
    for (const plane of ['sagittal', 'coronal', 'axial'])
      expect(shell().querySelector<HTMLElement>(`.plane[data-plane="${plane}"]`)!.hidden).toBe(
        true,
      );
    // Every section is drawn at one scale, the labelled box and 4 mm about it; the localizer at its
    // own, widened to the sections' shape (84 × 110 ≈ 64 × 84).
    expect(pictures().map((canvas) => [canvas.width, canvas.height])).toEqual([
      [84, 110],
      ...AXIAL.map(() => [64, 84]),
    ]);
  });

  test('another plane draws its own series, and each picture samples only what it shows', async () => {
    await series();
    const before = slices().length;
    await userEvent.click(page.getByRole('radio', { name: 'Coronal' }));
    await expect
      .poll(() => names()[1])
      .toBe(`Coronal section at ${mm(-85)}. Click to place the crosshair there.`);
    expect(names().at(-1)).toBe(
      `Coronal section at ${mm(65)}. Click to place the crosshair there.`,
    );
    // The localizer too: the same sagittal, cut to the coronal sections' shape.
    expect(slices().length - before).toBe(12);
    // Coronal: x −64…64 and z −64…84 mm, from the square's corner at (−128, +128), 2 mm a pixel.
    expect(slices().at(-1)!.args[1]).toEqual({ x: 32, y: 22, width: 64, height: 74 });
  });

  test('a new window draws the series again from what it kept, sampling nothing', async () => {
    await series();
    const before = slices().length;
    engine.sections.setWindow(100, 120);
    await expect
      .poll(
        () =>
          engine.calls.filter((call) => call.domain === 'sections' && call.method === 'pixels')
            .length,
      )
      .toBeGreaterThanOrEqual(12);
    expect(slices().length).toBe(before);
  });

  test('in French, the pictures are named in French', async () => {
    live.lang = 'fr';
    await render(Fixture, {
      engine,
      engineState: createEngineSync(engine),
      mpr,
      live,
      anatomy: { subject: 'sub_013', individual: true },
    });
    await userEvent.click(page.getByRole('button', { name: 'Linked MRI' }));
    await userEvent.click(page.getByRole('radio', { name: 'Coupes sériées' }));
    await expect
      .poll(() => names()[0])
      .toBe(`Emplacement des 11 coupes axiales, marqué sur la coupe sagittale à 0${NNBSP}mm.`);
    expect(names()[1]).toBe(`Coupe axiale à ${mm(-55)}. Cliquez pour y placer le réticule.`);
  });
});

describe('SECT-42 a click on a section', () => {
  test('places the crosshair at the point under it, cuts the stage on its plane, and marks it there and on the localizer', async () => {
    await series();
    expect(shell().querySelector('.series .crosshair-across')).toBeNull();
    // The middle of the −55 mm section: x 0 and y (27 + 42) px from the top, −10 mm. The browser
    // rounds a click to a CSS pixel, about a millimetre of a picture this small.
    clickAt(section(-55), 0.5, 0.5);
    const [x, y, z] = engine.sections.state.crosshair;
    expect(z).toBe(-55);
    expect(Math.hypot(x, y + 10)).toBeLessThan(1.5);
    expect(showPlane.mock.calls).toEqual([['axial']]);
    await expect
      .poll(() =>
        [...shell().querySelectorAll('.series .tile')].findIndex((tile) =>
          tile.querySelector('.crosshair-across'),
        ),
      )
      .toBe(1);
    const lines = [...shell().querySelectorAll('.series .line')];
    expect(lines.map((line) => line.classList.contains('lit'))).toEqual(
      AXIAL.map((_, index) => index === 0),
    );
  });

  test('SECT-48 with the crosshair hidden, the section holding it marks nothing and lights no line', async () => {
    mpr.crosshairShown = false;
    await series();
    clickAt(section(-55), 0.5, 0.5);
    expect(engine.sections.state.crosshair[2]).toBe(-55);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(shell().querySelector('.series .crosshair-across')).toBeNull();
    expect(shell().querySelector('.series .line.lit')).toBeNull();
    mpr.crosshairShown = true;
    await expect.poll(() => shell().querySelectorAll('.series .crosshair-across').length).toBe(1);
  });

  test('a click past the scanned square places nothing', async () => {
    // A box reaching z +126 mm: with its margin, the localizer's top row lies above the 256 mm square.
    Object.defineProperty(engine.sections, 'labelBox', {
      value: { min: [-60, -90, -120], max: [60, 70, 126] },
    });
    await series();
    const localizer = pictures()[0]!;
    clickAt(localizer, 0.5, 0.002);
    expect(engine.sections.state.crosshair).toEqual([0, 0, 0]);
    expect(showPlane).not.toHaveBeenCalled();
    clickAt(localizer, 0.5, 0.5);
    expect(showPlane.mock.calls).toEqual([['sagittal']]);
  });
});

describe('SECT-44 the tracts on serial sections', () => {
  test('are taken for the eleven sections in one pass, not for the localizer, and drawn into each section they cross', async () => {
    await engine.tracts.setActive(true);
    engine.tracts.setOverlay(true);
    const onPlanes = vi.spyOn(engine.tracts, 'onPlanes');
    const onPlane = vi.spyOn(engine.tracts, 'onPlane');
    // Opened on the series, so the three planes never draw theirs.
    mpr.layout = 'series';
    await series({ key: 'drawn' });
    expect(onPlanes).toHaveBeenCalledTimes(1);
    expect(onPlanes.mock.calls[0]![0].map((frame) => frame.center[2])).toEqual(AXIAL);
    expect(onPlane).not.toHaveBeenCalled();
    // The fake's red piece runs 10 mm either side of a plane's centre along u, within 50 mm of the
    // origin: square pixels 59–69 on row 64, which is crop row 37.
    expect(pixel(section(10), 32, 37)).toEqual([255, 0, 0, 255]);
    expect(pixel(section(-55), 32, 37)).not.toEqual([255, 0, 0, 255]);
  });
});

describe('SECT-43 Save PNG', () => {
  test('saves the localizer and the sections as one sheet, four to a row at the sections’ size, and says so', async () => {
    const saved: { download: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push({ download: this.download, href: this.href });
    });
    await series();
    await userEvent.click(page.getByRole('button', { name: 'Save PNG, axial series' }));
    expect(saved.map((link) => link.download)).toEqual(['sub_013-axial-series.png']);
    const sheet = new Image();
    sheet.src = saved[0]!.href;
    await sheet.decode();
    // Twelve pictures of 64 × 84 px, four to a row, and a 30 px footer.
    expect([sheet.naturalWidth, sheet.naturalHeight]).toEqual([256, 282]);
    await expect.poll(() => statusRegion().textContent).toBe('Saved the axial series as a PNG.');
  });
});

describe('SECT-45 layout and focus', () => {
  test('on a phone, the series is three pictures to a row in the modal', async () => {
    await page.viewport(390, 844);
    await series();
    expect(document.querySelector('dialog:modal')).not.toBeNull();
    const lefts = new Set(
      pictures().map((canvas) => Math.round(canvas.getBoundingClientRect().left)),
    );
    expect(lefts.size).toBe(3);
  });

  test('the plane picker keeps focus while it chooses, and hands it to the slider when the three planes return', async () => {
    await series();
    const axial = page.getByRole('radio', { name: 'Axial' });
    (axial.element() as HTMLElement).focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(page.getByRole('radio', { name: 'Sagittal' })).toHaveFocus();
    mpr.layout = 'planes';
    await expect
      .element(page.getByRole('slider', { name: 'Sagittal position', exact: true }))
      .toHaveFocus();
  });

  test('passes axe', async () => {
    await series();
    await expectAxeClean();
  });
});
