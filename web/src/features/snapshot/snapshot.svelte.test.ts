// The snapshot in a real browser over the fake engine: the markings measured where the stage draws them,
// with what the keys say taken from `keys.model()`; the caption's inputs; the download, its notice
// and its failure.
import '../../styles/index.css';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import manifest from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import type { Legend } from '../../lib/core/state/paint.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import { createStageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import { snapshotMarkings } from './markings.ts';
import type { StageKeysModel } from './markings.ts';
import { saveSnapshot, snapshotPlan } from './snapshot.ts';
import type { SnapshotStage, SnapshotSubject } from './snapshot.ts';
import Fixture from './snapshot-test-support.svelte';

const eventually = <T>(check: () => T | Promise<T>) => vi.waitFor(check, { timeout: 5000 });

const row = (id: string, label: string, extra = {}) => ({
  id,
  color: [40 + id.length * 30, 120, 200] as [number, number, number],
  label,
  pressed: false,
  ...extra,
});
/** A deficit's findings, the first picked: its rows are toggles (G3's toolbar). */
const DEFICIT: Legend = {
  map: 'deficit',
  title: 'Aphasia',
  note: 'Each finding names the regions it cites.',
  rows: [
    row('f1', 'Broca', { pressed: true }),
    row('f22', 'Wernicke', { absent: true }),
    row('f333', 'Arcuate'),
  ],
};

interface Live {
  lang: 'en' | 'fr';
  status: 'ready' | 'loading';
  surfaceColor: 'atlas';
  networks: null;
  legend: Legend | null;
  marks: { region: string; name: string; label: string }[];
}

let engine: FakeEngine;
let stage: StageLayout;
let live: Live;
let handle: { keys?: StageKeysModel };
let cleanups: (() => void)[];

const host = () => document.querySelector<HTMLElement>('#viewport')!;
const keys = () => handle.keys!;
const plate = (name: string) => host().querySelector<HTMLElement>(`[data-name="${name}"]`)!;

async function mount(overrides: Partial<Live> = {}, { width = 1000, height = 700 } = {}) {
  engine = createFakeEngine({
    manifest: manifest as unknown as Manifest,
    hostSize: { width, height },
  });
  const state = $state<Live>({
    lang: 'en',
    status: 'ready',
    surfaceColor: 'atlas',
    networks: null,
    legend: null,
    marks: [],
    ...overrides,
  });
  live = state;
  handle = {};
  cleanups.push(
    $effect.root(() => {
      stage = createStageLayout({ media: { phone: false }, storage: null });
    }),
  );
  render(Fixture, { engine, stage, live, handle, width, height });
  flushSync();
  await eventually(() => expect(stage.visibleRect).not.toBeNull());
}

const markings = () => snapshotMarkings(host(), stage.visibleRect!, { stage, keys: keys() });

const scene = (): SnapshotStage => ({ host: host(), stage, keys: keys(), engine });

const subject = (overrides: Partial<SnapshotSubject> = {}): SnapshotSubject => ({
  lang: 'en',
  anatomy: { display_name: '“CDMD sub_013”' },
  atlas: 'hcp-mmp',
  surfaceColor: 'atlas',
  detail: 'learning',
  offersDetail: true,
  view: 'left',
  reference: null,
  section: null,
  selection: null,
  ...overrides,
});

/** The left edge of `node`'s text, in pixels of the stage. */
const textLeft = (node: Element) => {
  const range = document.createRange();
  range.selectNodeContents(node);
  return range.getBoundingClientRect().left - host().getBoundingClientRect().left;
};

beforeEach(async () => {
  cleanups = [];
  await page.viewport(1280, 900);
});

afterEach(() => {
  cleanup();
  cleanups.forEach((stop) => stop());
  vi.restoreAllMocks();
});

describe('the keys in the image', () => {
  test('a pickable paint key names every row beside its own swatch, the picked one in bold (g6-paint-row-labels)', async () => {
    await mount({ legend: DEFICIT });
    const [mark] = markings().keys;
    const labels = [...plate('paint').querySelectorAll('.stage-key-label')];
    const swatches = [...plate('paint').querySelectorAll('.network-swatch')];
    expect(mark!.texts.map((text) => text.text)).toEqual([
      'Aphasia',
      'Broca',
      'Wernicke',
      'Arcuate',
    ]);
    mark!.texts.slice(1).forEach((text, index) => {
      expect(text.x).toBeCloseTo(textLeft(labels[index]!), 3);
      const swatchRight =
        swatches[index]!.getBoundingClientRect().right - host().getBoundingClientRect().left;
      expect(text.x).toBeGreaterThan(swatchRight);
    });
    expect(mark!.texts.slice(1).map((text) => text.font.split(' ')[0])).toEqual([
      '600',
      '400',
      '400',
    ]);
    // A colour not shown in this view is hollow on screen, so it is not filled in the image either.
    expect(mark!.swatches.map((swatch) => swatch.color)).toEqual([
      'rgb(100, 120, 200)',
      'rgba(0, 0, 0, 0)',
      'rgb(160, 120, 200)',
    ]);
    // The note is not drawn, as in legacy (flagged on #4); the plate keeps its band.
    expect(mark!.texts.some((text) => text.text === DEFICIT.note)).toBe(false);
    const box = plate('paint').getBoundingClientRect();
    expect(mark!.box).toMatchObject({ width: box.width, height: box.height });
  });

  test('a fold draws the title row alone', async () => {
    await mount({ legend: DEFICIT });
    await userEvent.click(plate('paint').querySelector('.stage-key-toggle')!);
    await eventually(() =>
      expect(markings().keys[0]!.texts.map((text) => text.text)).toEqual(['Aphasia']),
    );
    expect(markings().keys[0]!.swatches).toEqual([]);
  });

  test('a plate the model says is folded draws its title alone, though its rows are shown (the fold comes from the model)', async () => {
    await mount({ legend: DEFICIT });
    expect(plate('paint').querySelectorAll('.stage-key-list > li')).toHaveLength(3);
    const folded = {
      model: () =>
        keys()
          .model()
          .map((entry) => ({ ...entry, open: false })),
    } as StageKeysModel;
    const [mark] = snapshotMarkings(host(), stage.visibleRect!, { stage, keys: folded }).keys;
    expect(mark!.texts.map((text) => text.text)).toEqual(['Aphasia']);
    expect(mark!.swatches).toEqual([]);
  });

  test('rows scrolled out of a long key stay out of the image', async () => {
    const long: Legend = {
      ...DEFICIT,
      rows: Array.from({ length: 40 }, (_, i) => row(`r${i}`, `Finding ${i}`)),
    };
    await mount({ legend: long }, { width: 1100, height: 420 });
    // Crowded, it starts folded; the reader opens it.
    await userEvent.click(plate('paint').querySelector('.stage-key-toggle')!);
    await eventually(() => expect(markings().keys[0]!.texts.length).toBeGreaterThan(2));
    const { texts, swatches, box } = markings().keys[0]!;
    expect(texts.length).toBeLessThan(41);
    expect(swatches.length).toBeLessThan(40);
    for (const mark of [...texts, ...swatches]) {
      expect(mark.y).toBeGreaterThanOrEqual(box.y);
      expect(mark.y).toBeLessThanOrEqual(box.y + box.height);
    }
  });
});

describe('the letters and the scale bar', () => {
  test('each letter at the centre it is drawn; the top one on the caption line without a key band; the scale bar in true pixels', async () => {
    await mount();
    const { letters, scale } = markings();
    expect(letters.map((letter) => letter.edge)).toEqual(['top', 'right', 'bottom', 'left']);
    const origin = host().getBoundingClientRect();
    for (const letter of letters) {
      const box = host().querySelector(`[data-edge="${letter.edge}"]`)!.getBoundingClientRect();
      expect(letter.text).toBe(engine.camera.view.edges[letter.edge]);
      expect(letter.x).toBeCloseTo(box.left - origin.left + box.width / 2, 3);
      if (letter.edge !== 'top')
        expect(letter.y).toBeCloseTo(box.top - origin.top + box.height / 2, 3);
    }
    expect(letters[0]!.y).toBe(20);
    expect(scale).toEqual({ pixels: 100, label: '10 mm' });
  });

  test('over a tall dock the bottom letter keeps the line above the statement', async () => {
    await mount();
    stage.setDock({ width: 300, height: 400 });
    flushSync();
    expect(stage.dockTall).toBe(true);
    const bottom = markings().letters.find((letter) => letter.edge === 'bottom')!;
    expect(bottom).toMatchObject({ x: 500, y: 700 - 16 - 32 });
  });

  test('before the anatomy is drawn there are no letters and no scale bar', async () => {
    await mount({ status: 'loading' });
    expect(markings()).toMatchObject({ letters: [], scale: null });
  });
});

describe('the route’s landmarks', () => {
  const LONG = 'A landmark whose name is long enough to wrap onto a second line on the stage';
  const marks = [
    { region: 'learning:midline:optic-chiasm', name: 'Optic chiasm', label: 'Landmark 1' },
    { region: 'learning:left:lateral-geniculate', name: LONG, label: 'Landmark 2' },
  ];

  test('each label’s dot, leader and words where the stage draws them, a long name line by line', async () => {
    await mount({ marks });
    const { labels } = markings();
    const origin = host().getBoundingClientRect();
    const buttons = [...host().querySelectorAll<HTMLElement>('.route-mark')];
    expect(labels).toHaveLength(2);
    labels.forEach((label, index) => {
      const button = buttons[index]!;
      const dot = button.querySelector('.stage-label-dot')!.getBoundingClientRect();
      expect(label.dot.x).toBeCloseTo(dot.left + dot.width / 2 - origin.left, 3);
      expect(label.dot.y).toBeCloseTo(dot.top + dot.height / 2 - origin.top, 3);
      expect(label.leader === null).toBe(button.dataset.leader !== 'true');
      expect(label.lines[0]!.text).toBe(String(index + 1));
      expect(label.lines[0]!.font).toMatch(/^600 14px/);
    });
    const name = (index: number) => labels[index]!.lines.slice(1);
    expect(name(0).map((line) => line.text)).toEqual(['Optic chiasm']);
    // The long name wraps as the stage wraps it: its lines in order, together the whole name.
    expect(name(1).length).toBeGreaterThan(1);
    expect(
      name(1)
        .map((line) => line.text)
        .join(' '),
    ).toBe(LONG);
    expect(new Set(name(1).map((line) => line.x)).size).toBe(1);
    expect(name(1)[1]!.y).toBeGreaterThan(name(1)[0]!.y);
  });

  test('a label reduced to its number draws the number alone, and no route draws no labels', async () => {
    await mount({ marks });
    host().querySelector<HTMLElement>('.route-mark')!.dataset.short = 'true';
    expect(markings().labels[0]!.lines.map((line) => line.text)).toEqual(['1']);
    live.marks = [];
    flushSync();
    expect(markings().labels).toEqual([]);
  });
});

describe('the caption', () => {
  const lines = (plan: ReturnType<typeof snapshotPlan>['plan']) =>
    plan.caption.map((line) => line.map((runs) => runs.map((run) => run.text).join('')));

  test('the internal anatomy only where the masthead offers it, the view only while the camera holds it', async () => {
    await mount();
    expect(lines(snapshotPlan(scene(), subject()).plan)).toEqual([
      ['CDMD sub_013'],
      ['HCP-MMP', 'Regions', 'Teaching set'],
      ['Left view'],
    ]);
    const released = { ...scene(), engine: { ...engine, camera: { viewHeld: false } } };
    expect(lines(snapshotPlan(released, subject({ offersDetail: false })).plan)).toEqual([
      ['CDMD sub_013'],
      ['HCP-MMP', 'Regions'],
    ]);
  });

  test('the tract reference replaces subject and labels and drops the section; a held view is still named', async () => {
    await mount();
    const section = { plane: 'axial', offset: 4, tilt: 0, azimuth: 0 } as const;
    expect(lines(snapshotPlan(scene(), subject({ section })).plan)[2]).toEqual([
      'Axial section',
      '+4.0 mm',
    ]);
    expect(
      lines(snapshotPlan(scene(), subject({ section, reference: 'HCP tract reference' })).plan),
    ).toEqual([['HCP tract reference'], ['Left view']]);
  });
});

describe('saving', () => {
  let region: HTMLElement;
  let links: { download: string; href: string }[];
  const commands = { fail: vi.fn(), notify: vi.fn() };

  beforeEach(() => {
    region = document.body.appendChild(document.createElement('div'));
    cleanups.push(attachAnnouncer(region), () => region.remove());
    links = [];
    commands.fail.mockReset();
    commands.notify.mockReset();
    // The download itself is the browser's; the link it is given is what the test reads.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      links.push({ download: this.download, href: this.href });
    });
  });

  test('downloads planum-<atlas>-<view>.png, a PNG of the visible stage, and shows its name in the reader’s language', async () => {
    await mount({ legend: DEFICIT });
    engine.camera.setChromeInsets({ bottom: 100 }, {});
    flushSync();
    await saveSnapshot(scene(), subject({ lang: 'fr' }), commands);
    expect(commands.fail).not.toHaveBeenCalled();
    expect(links).toHaveLength(1);
    expect(links[0]!.download).toBe('planum-hcp-mmp-left.png');
    const blob = await (await fetch(links[0]!.href)).blob();
    expect(blob.type).toBe('image/png');
    const image = await createImageBitmap(blob);
    expect([image.width, image.height]).toEqual([1000, 600]);
    // The notice is what a sighted reader sees; the announcer speaks notices, not this module.
    expect(commands.notify.mock.calls).toEqual([
      [null],
      [{ kind: 'info', text: 'Image enregistrée : planum-hcp-mmp-left.png.' }],
    ]);
    expect(region.textContent).toBe('');
  });

  test('a cut adds its plane to the name, so saves of the same atlas tell themselves apart', async () => {
    await mount();
    await saveSnapshot(
      scene(),
      subject({
        view: 'anterior',
        section: { plane: 'coronal', offset: -9.5, tilt: 0, azimuth: 0 },
      }),
      commands,
    );
    expect(links.map((link) => link.download)).toEqual(['planum-hcp-mmp-anterior-coronal.png']);
  });

  test('a view the camera has left, as the caption, is not in the name', async () => {
    await mount();
    const released = { ...scene(), engine: { ...engine, camera: { viewHeld: false } } };
    await saveSnapshot(released, subject({ view: 'anterior' }), commands);
    expect(links.map((link) => link.download)).toEqual(['planum-hcp-mmp.png']);
  });

  test('a second request while one is being made joins it: one file', async () => {
    await mount();
    const first = saveSnapshot(scene(), subject({ atlas: null }), commands);
    const second = saveSnapshot(scene(), subject({ atlas: null }), commands);
    expect(second).toBe(first);
    await first;
    expect(links.map((link) => link.download)).toEqual(['planum-brain-left.png']);
    expect(commands.notify.mock.calls).toEqual([
      [null],
      [{ kind: 'info', text: 'Image saved as planum-brain-left.png.' }],
    ]);
    await saveSnapshot(scene(), subject(), commands);
    expect(links).toHaveLength(2);
  });

  test('the object URL is released 40 s after the click, not before', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      const revoke = vi.spyOn(URL, 'revokeObjectURL');
      await mount();
      await saveSnapshot(scene(), subject(), commands);
      expect(links).toHaveLength(1);
      // Read the blob before the URL is released.
      expect((await (await fetch(links[0]!.href)).blob()).type).toBe('image/png');
      expect(revoke).not.toHaveBeenCalled();
      vi.advanceTimersByTime(39_999);
      expect(revoke).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(revoke).toHaveBeenCalledExactlyOnceWith(links[0]!.href);
    } finally {
      vi.useRealTimers();
    }
  });

  test('a failure is the snapshot notice, and nothing is downloaded or reported saved', async () => {
    await mount();
    const lost = new Error('context lost');
    const failing = {
      ...scene(),
      engine: {
        camera: engine.camera,
        captureSnapshot: () => {
          throw lost;
        },
      },
    };
    await saveSnapshot(failing, subject(), commands);
    expect(commands.fail).toHaveBeenCalledExactlyOnceWith('snapshot', lost);
    expect(links).toEqual([]);
    expect(commands.notify).not.toHaveBeenCalled();
    expect(region.textContent).toBe('');
  });
});
