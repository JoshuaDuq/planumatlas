// What the snapshot draws onto the image, recorded call by call on the canvas: the statement, the caption,
// the letters, the route's landmark labels, the colour keys and the scale bar (SNAP-08 to SNAP-14).
import '../../styles/index.css';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import { page } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import type { Legend } from '../../lib/core/state/paint.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import { createStageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { Manifest } from '../../lib/types/index.ts';
import type { StageKeysModel } from './markings.ts';
import { annotateSnapshot, snapshotFonts, snapshotPlan } from './snapshot.ts';
import type { SnapshotStage } from './snapshot.ts';
import Fixture from './snapshot-test-support.svelte';

/** A deficit's findings, the first picked: its rows are toggles (G3's toolbar). */
const DEFICIT: Legend = {
  map: 'deficit',
  title: 'Aphasia',
  note: 'Each finding names the regions it cites.',
  rows: [
    { id: 'f1', color: [70, 120, 200], label: 'Broca', pressed: true },
    { id: 'f22', color: [100, 120, 200], label: 'Wernicke', pressed: false, absent: true },
    { id: 'f333', color: [160, 120, 200], label: 'Arcuate', pressed: false },
  ],
};

let stopLayout: (() => void) | undefined;

afterEach(() => {
  cleanup();
  stopLayout?.();
  vi.restoreAllMocks();
});

interface TextCall {
  text: string;
  x: number;
  y: number;
  font: string;
  align: CanvasTextAlign;
}
interface Roundrect {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

/** The plan of the 560×520 fixture, drawn at ratio 2 over a flat frame, with every drawing call recorded. */
async function drawFixture(marks: { region: string; name: string; label: string }[] = []) {
  await page.viewport(1280, 900);
  const [width, height] = [560, 520];
  const engine = createFakeEngine({
    manifest: manifest as unknown as Manifest,
    hostSize: { width, height },
  });
  let stage!: StageLayout;
  stopLayout = $effect.root(() => {
    stage = createStageLayout({ media: { phone: false }, storage: null });
  });
  const live = $state({
    lang: 'en' as const,
    status: 'ready' as const,
    surfaceColor: 'atlas' as const,
    networks: null,
    legend: DEFICIT as Legend | null,
    marks,
  });
  const handle: { keys?: StageKeysModel } = {};
  render(Fixture, { engine, stage, live, handle, width, height });
  flushSync();
  await vi.waitFor(() => expect(stage.visibleRect).not.toBeNull(), { timeout: 5000 });
  const scene: SnapshotStage = {
    host: document.querySelector<HTMLElement>('#viewport')!,
    stage,
    keys: handle.keys!,
    engine,
  };
  // A long subject and a section so the caption packs and shortens in a narrow image.
  const { plan } = snapshotPlan(scene, {
    lang: 'en',
    anatomy: { display_name: 'A subject whose name is far too long for the room it has here' },
    atlas: 'hcp-mmp',
    surfaceColor: 'atlas',
    detail: 'learning',
    offersDetail: true,
    view: 'left',
    reference: null,
    section: { plane: 'oblique', offset: -12.34, tilt: 30, azimuth: -45 },
    selection: null,
  });
  const loaded: string[] = [];
  const load = document.fonts.load.bind(document.fonts);
  vi.spyOn(document.fonts, 'load').mockImplementation((font, text) => {
    loaded.push(font);
    return load(font, text);
  });
  await snapshotFonts(plan);

  const texts: TextCall[] = [];
  const rounded: Roundrect[] = [];
  const lines: [number, number][] = [];
  const proto = CanvasRenderingContext2D.prototype;
  const fillText = proto.fillText;
  vi.spyOn(proto, 'fillText').mockImplementation(function (
    this: CanvasRenderingContext2D,
    text,
    x,
    y,
  ) {
    texts.push({ text, x, y, font: this.font, align: this.textAlign });
    fillText.call(this, text, x, y);
  });
  const roundRect = proto.roundRect;
  vi.spyOn(proto, 'roundRect').mockImplementation(function (
    this: CanvasRenderingContext2D,
    x,
    y,
    w,
    h,
    r,
  ) {
    rounded.push({ x, y, width: w, height: h, fill: String(this.fillStyle) });
    roundRect.call(this, x, y, w, h, r);
  });
  const arcs: [number, number, number][] = [];
  const arc = proto.arc;
  vi.spyOn(proto, 'arc').mockImplementation(function (
    this: CanvasRenderingContext2D,
    x,
    y,
    r,
    a,
    b,
  ) {
    arcs.push([x, y, r]);
    arc.call(this, x, y, r, a, b);
  });
  const lineTo = proto.lineTo;
  vi.spyOn(proto, 'lineTo').mockImplementation(function (this: CanvasRenderingContext2D, x, y) {
    lines.push([x, y]);
    lineTo.call(this, x, y);
  });

  const ratio = 2;
  const canvas = document.createElement('canvas');
  canvas.width = plan.width * ratio;
  canvas.height = plan.height * ratio;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#7a7f86';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  annotateSnapshot(canvas, { ...plan, ratio });
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return { plan, texts, rounded, lines, arcs, loaded, pixels, ratio };
}

const ROUTE = [
  { region: 'learning:midline:optic-chiasm', name: 'Optic chiasm', label: 'Landmark 1' },
  { region: 'learning:left:lateral-geniculate', name: 'Lateral geniculate', label: 'Landmark 2' },
];

const measure = (font: string, text: string) => {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = font;
  return ctx.measureText(text).width;
};

describe('what the snapshot draws', () => {
  test('SNAP-09 the statement is drawn at the bottom left of the image', async () => {
    const { texts } = await drawFixture();
    const statement = texts.find((call) => call.text === 'Planum · Not clinical anatomy');
    expect(statement).toBeDefined();
    expect(statement!.x).toBe(16);
    expect(statement!.y).toBe(520 - 24);
    expect(statement!.font).toContain('12px');
  });

  test('SNAP-08 the caption runs from the top left, 24 px down and a line of 16 px apart, and stops short of the top letter', async () => {
    const { plan, texts } = await drawFixture();
    const top = plan.letters.find((letter) => letter.edge === 'top')!;
    const room = top.x - measure(texts.find((c) => c.text === top.text)!.font, top.text) / 2 - 12;
    const caption = texts.filter((call) => call.align === 'left' && call.x < top.x && call.y < 100);
    expect(caption.length).toBeGreaterThan(0);
    expect(caption[0]!.x).toBe(16);
    expect(caption[0]!.y).toBe(24);
    expect(caption[0]!.font).toContain('13px');
    const rows = [...new Set(caption.map((call) => call.y))];
    rows.forEach((y, index) => expect(y).toBe(24 + 16 * index));
    for (const call of caption.filter((c) => c.y > 24)) expect(call.font).toContain('12px');
    for (const call of caption) {
      expect(call.x + measure(call.font, call.text)).toBeLessThanOrEqual(room + 1e-6);
    }
    // The long subject is shortened to fit.
    const first = caption.filter((call) => call.y === 24);
    expect(first.at(-1)!.text.endsWith('…')).toBe(true);
  });

  test('SNAP-10 the scale bracket spans the on-screen bar and its label follows 8 px after', async () => {
    const { plan, texts, lines } = await drawFixture();
    expect(plan.scale).not.toBeNull();
    const { pixels, label } = plan.scale!;
    // The bracket is moveTo(left, foot - 6), lineTo(left, foot), lineTo(right, foot), lineTo(right, foot - 6).
    expect(lines.length).toBe(3);
    const [leftFoot, rightFoot] = lines as [[number, number], [number, number], [number, number]];
    expect(rightFoot[0] - leftFoot[0]).toBe(Math.round(pixels) - 1);
    expect(leftFoot[1]).toBe(rightFoot[1]);
    // On the bottom line of the 560×520 image (y 496), with the foot a pixel below its centre.
    expect(leftFoot[1]).toBe(498.5);
    const drawn = texts.find((call) => call.text === label)!;
    // The bracket is snapped to whole pixels, the label is not.
    expect(Math.abs(drawn.x - (leftFoot[0] - 0.5 + pixels + 8))).toBeLessThanOrEqual(0.5);
    // The bar and its label end at the right gutter, 16 px from the edge.
    expect(Math.abs(drawn.x + measure(drawn.font, label) - 544)).toBeLessThan(1e-6);
  });

  test('SNAP-11 each orientation letter is drawn centred where it is on screen', async () => {
    const { plan, texts } = await drawFixture();
    expect(plan.letters.map((letter) => letter.edge).sort()).toEqual([
      'bottom',
      'left',
      'right',
      'top',
    ]);
    for (const letter of plan.letters) {
      const drawn = texts.find(
        (call) => call.text === letter.text && call.x === letter.x && call.y === letter.y,
      );
      expect(drawn, letter.edge).toBeDefined();
      expect(drawn!.align).toBe('center');
      expect(drawn!.font).toContain('600 13px');
    }
  });

  test('SNAP-12 the key is redrawn with its title and every row beside its own swatch', async () => {
    const { plan, texts, rounded } = await drawFixture();
    const key = plan.keys[0]!;
    expect(key.texts.map((text) => text.text)).toEqual(['Aphasia', 'Broca', 'Wernicke', 'Arcuate']);
    for (const text of key.texts) {
      const drawn = texts.find(
        (call) => call.text === text.text && call.x === text.x && call.y === text.y,
      );
      expect(drawn, text.text).toBeDefined();
      const regular = (font: string) => font.replace(/^400 /, '');
      expect(regular(drawn!.font)).toBe(regular(text.font));
    }
    // The picked row is bold and the others regular.
    const weight = (label: string) =>
      key.texts.find((text) => text.text === label)!.font.split(' ')[0];
    expect([weight('Broca'), weight('Wernicke'), weight('Arcuate')]).toEqual(['600', '400', '400']);
    // The plate, then one swatch per row; a colour not shown in this view is hollow.
    const swatches = rounded.slice(1);
    expect(swatches.length).toBe(3);
    swatches.forEach((swatch, row) => {
      const planned = key.swatches[row]!;
      expect([swatch.x, swatch.y, swatch.width, swatch.height]).toEqual([
        planned.x,
        planned.y,
        planned.width,
        planned.height,
      ]);
    });
    // Broca (70, 120, 200) and Arcuate (160, 120, 200) are filled; Wernicke is not shown in this view.
    expect(swatches.map((swatch) => swatch.fill)).toEqual([
      '#4678c8',
      'rgba(0, 0, 0, 0)',
      '#a078c8',
    ]);
    expect(key.swatches[1]!.color).toBe('rgba(0, 0, 0, 0)');
    // The note is not drawn.
    expect(texts.some((call) => call.text === DEFICIT.note)).toBe(false);
  });

  test('SNAP-14 each route landmark is drawn where it stands: its words, its dot on the anchor, its leader', async () => {
    const { plan, texts, arcs, lines } = await drawFixture(ROUTE);
    expect(plan.labels).toHaveLength(2);
    for (const label of plan.labels) {
      for (const line of label.lines) {
        const drawn = texts.find(
          (call) => call.text === line.text && call.x === line.x && call.y === line.y,
        );
        expect(drawn, line.text).toBeDefined();
        expect(drawn!.align).toBe('left');
        const unquoted = (font: string) => font.replace(/"/g, '');
        expect(unquoted(drawn!.font)).toBe(unquoted(line.font));
      }
      // The dot: its rim, then its ink, both on the anchor.
      expect(
        arcs.filter(([x, y]) => x === label.dot.x && y === label.dot.y).map(([, , r]) => r),
      ).toEqual([4, 2.5]);
      if (label.leader) expect(lines).toContainEqual([label.leader.x, label.leader.y]);
    }
  });

  test('SNAP-15 a label where the image draws its scale bar is drawn clear of it', async () => {
    const { plan, texts } = await drawFixture(ROUTE);
    // Moved to where the image, not the screen, puts the scale bar: the bottom right.
    const [first] = plan.labels;
    const [dx, dy] = [plan.width - 60 - first!.box.x, plan.height - 26 - first!.box.y];
    const moved = {
      ...first!,
      box: { ...first!.box, x: first!.box.x + dx, y: first!.box.y + dy },
      dot: { ...first!.dot, x: first!.dot.x + dx, y: first!.dot.y + dy },
      leader: null,
      lines: first!.lines.map((line) => ({ ...line, x: line.x + dx, y: line.y + dy })),
    };
    const canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    // The fixture's recorder is still listening: these calls are this drawing's.
    const start = texts.length;
    annotateSnapshot(canvas, { ...plan, labels: [moved], ratio: 1 });
    const drawn = texts.slice(start);
    const scale = drawn.find((call) => call.text === plan.scale!.label)!;
    // The bar's rule ends 8 px before its label, a whole line tall.
    const bar = {
      left: scale.x - 8 - plan.scale!.pixels,
      right: scale.x + measure(scale.font, scale.text),
      top: scale.y - 8,
      bottom: scale.y + 8,
    };
    for (const line of moved.lines) {
      const call = drawn.find((c) => c.text === line.text)!;
      const box = {
        left: call.x,
        right: call.x + measure(call.font, call.text),
        top: call.y - 8,
        bottom: call.y + 8,
      };
      const meets =
        Math.min(box.right, bar.right) > Math.max(box.left, bar.left) &&
        Math.min(box.bottom, bar.bottom) > Math.max(box.top, bar.top);
      expect(meets, line.text).toBe(false);
    }
  });

  test('SNAP-13 only marks are added: pixels far from every mark keep the frame, and the fonts are loaded first', async () => {
    const { plan, texts, rounded, lines, arcs, loaded, pixels, ratio } = await drawFixture(ROUTE);
    for (const font of ['400 12px', '400 13px', '600 13px']) {
      expect(
        loaded.some((face) => face.startsWith(font)),
        font,
      ).toBe(true);
    }
    // Every mark's box, grown by the halo's 8 px blur and the stroke.
    const reach = 8 + 3;
    const boxes = [
      ...texts.map((call) => {
        const w = measure(call.font, call.text);
        const left = call.align === 'center' ? call.x - w / 2 : call.x;
        return [left, call.y - 10, left + w, call.y + 10];
      }),
      ...rounded.map((r) => [r.x, r.y, r.x + r.width, r.y + r.height]),
      ...arcs.map(([x, y, r]) => [x - r, y - r, x + r, y + r]),
      ...plan.labels.flatMap(({ dot, leader }) =>
        leader
          ? [
              [
                Math.min(dot.x, leader.x),
                Math.min(dot.y, leader.y),
                Math.max(dot.x, leader.x),
                Math.max(dot.y, leader.y),
              ],
            ]
          : [],
      ),
      [
        Math.min(...lines.map(([x]) => x)),
        Math.min(...lines.map(([, y]) => y)) - 8,
        Math.max(...lines.map(([x]) => x)),
        Math.max(...lines.map(([, y]) => y)) + 8,
      ],
    ].map(([a, b, c, d]) => [a! - reach, b! - reach, c! + reach, d! + reach]);
    let marked = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] === 0x7a && pixels[i + 1] === 0x7f && pixels[i + 2] === 0x86) continue;
      marked++;
      const x = ((i / 4) % (plan.width * ratio)) / ratio;
      const y = Math.floor(i / 4 / (plan.width * ratio)) / ratio;
      expect(boxes.some(([a, b, c, d]) => x >= a! && x <= c! && y >= b! && y <= d!)).toBe(true);
    }
    expect(marked).toBeGreaterThan(5000);
  });
});
