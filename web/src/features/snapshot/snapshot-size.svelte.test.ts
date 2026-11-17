// Save image at a size, over a stage host built by hand and an engine that draws a flat frame: the engine is
// asked for that many image pixels per CSS pixel, the caption grows with the image, and a size the device
// cannot draw is refused with its reason. The real engine's side is FACADE's (engine-e7.md).
import '../../styles/index.css';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { failureNotice } from '../../lib/core/i18n/errors.ts';
import type { Rect, SnapshotOptions } from '../../lib/engine/api.ts';
import { saveSnapshot } from './snapshot.ts';
import type { SnapshotStage, SnapshotSubject } from './snapshot.ts';

const STAGE = { width: 400, height: 300 };
const FILL = [122, 127, 134] as const;

let host: HTMLElement;
let links: string[];
const ports = { fail: vi.fn(), notify: vi.fn() };

/** An engine drawing a flat frame at the scale it is asked for, refusing a side past `limit`. */
function flatEngine(limit = Infinity) {
  return {
    camera: { viewHeld: true },
    captureSnapshot: vi.fn((crop?: Rect, { scale = 1 }: SnapshotOptions = {}) => {
      const [width, height] = [crop!.width * scale, crop!.height * scale].map(Math.round) as [
        number,
        number,
      ];
      if (width > limit || height > limit) {
        throw Object.assign(new Error(`${width} × ${height} px is past ${limit} px.`), {
          code: 'snapshot-too-large',
        });
      }
      const canvas = Object.assign(document.createElement('canvas'), { width, height });
      const context = canvas.getContext('2d')!;
      context.fillStyle = `rgb(${FILL.join(',')})`;
      context.fillRect(0, 0, width, height);
      return { canvas, ratio: scale };
    }),
  };
}

const scene = (engine: ReturnType<typeof flatEngine>): SnapshotStage => ({
  host,
  stage: { visibleRect: { x: 0, y: 0, ...STAGE }, keyInset: { top: 0, right: 0 }, dockTall: false },
  keys: { model: () => [] },
  engine,
});

const subject: SnapshotSubject = {
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
};

/** The saved PNG's size, and the box of every pixel the caption changed in its top left. */
async function saved(href: string) {
  const image = await createImageBitmap(await (await fetch(href)).blob());
  const canvas = Object.assign(document.createElement('canvas'), {
    width: image.width,
    height: image.height,
  });
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const [width, height] = [image.width / 2, image.height / 4].map(Math.floor) as [number, number];
  const pixels = context.getImageData(0, 0, width, height).data;
  let bottom = 0;
  let right = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = 4 * (y * width + x);
      if (FILL.some((value, channel) => pixels[at + channel] !== value)) {
        bottom = Math.max(bottom, y);
        right = Math.max(right, x);
      }
    }
  }
  return { size: [image.width, image.height], caption: { bottom, right } };
}

beforeEach(() => {
  host = document.body.appendChild(document.createElement('main'));
  host.id = 'viewport';
  host.style.cssText = `position: relative; width: ${STAGE.width}px; height: ${STAGE.height}px`;
  // What the snapshot reads off the stage: no letters, keys or scale bar.
  host.innerHTML =
    '<div id="orientation" hidden></div><div id="stage-keys"></div><div id="scale-bar" hidden></div>';
  links = [];
  ports.fail.mockReset();
  ports.notify.mockReset();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    links.push(this.href);
  });
});

afterEach(() => {
  host.remove();
  vi.restoreAllMocks();
});

describe('a size from the Save image menu', () => {
  test('SNAP-20 a 3× save asks for three image pixels per CSS pixel, and its caption grows with it', async () => {
    const engine = flatEngine();
    await saveSnapshot(scene(engine), subject, ports, { scale: 3 });
    await saveSnapshot(scene(engine), subject, ports, { scale: 1 });
    expect(ports.fail).not.toHaveBeenCalled();
    expect(engine.captureSnapshot.mock.calls.map(([, options]) => options)).toEqual([
      { scale: 3 },
      { scale: 1 },
    ]);
    const [large, small] = await Promise.all(links.map(saved));
    expect(large!.size).toEqual([1200, 900]);
    expect(small!.size).toEqual([400, 300]);
    // The caption is drawn at the image's own scale: as large against the anatomy as on screen. Left at
    // screen size it would end where the small one does.
    expect(small!.caption.bottom).toBeGreaterThan(16);
    for (const edge of ['bottom', 'right'] as const) {
      const grown = large!.caption[edge] / small!.caption[edge];
      expect(grown, edge).toBeGreaterThan(2.85);
      expect(grown, edge).toBeLessThan(3.15);
    }
  });

  test('SNAP-21 a size the device cannot draw is refused with its reason, and nothing is saved', async () => {
    const engine = flatEngine(1000);
    await saveSnapshot(scene(engine), subject, ports, { scale: 3 });
    expect(links).toEqual([]);
    expect(ports.notify).not.toHaveBeenCalled();
    expect(ports.fail).toHaveBeenCalledOnce();
    const [operation, error] = ports.fail.mock.calls[0]!;
    expect(operation).toBe('snapshotSize');
    expect(failureNotice(error, 'en', operation).text).toBe(
      'Could not save the image at this size: it would be larger than this device can draw. Choose a smaller size or make the window smaller.',
    );
    expect(failureNotice(error, 'fr', operation).text).toMatch(
      /^Impossible d’enregistrer l’image à cette taille : /,
    );
    // Another failure is still the plain one.
    const lost = new Error('context lost');
    engine.captureSnapshot.mockImplementationOnce(() => {
      throw lost;
    });
    await saveSnapshot(scene(engine), subject, ports, { scale: 2 });
    expect(ports.fail).toHaveBeenLastCalledWith('snapshot', lost);
  });
});
