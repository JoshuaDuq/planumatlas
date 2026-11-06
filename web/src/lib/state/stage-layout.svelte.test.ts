// The stage-layout store (viewport-chrome.js:137-267, 707-728) against the real DOM it measures.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { FRAME_FILL } from '../engine/render/camera-views.ts';
import { clearFraming } from '../engine/render/effective-viewport.ts';
import { PREF_KEYS } from './prefs.ts';
import { fakeStorage } from './test-support.ts';
import { createStageLayout } from './stage-layout.svelte.ts';

/** Waits for what a `ResizeObserver` delivers: it reports before the next paint, which a loaded machine can delay. */
const eventually = <T>(check: () => T | Promise<T>) => vi.waitFor(check, { timeout: 5000 });

const media = { phone: false };

const rect = (width: number, height: number) => ({ x: 0, y: 0, width, height });

/** A store with a stage of this visible size, a 20 px gutter and a dock of the given size. */
function stageOf(width: number, height: number, dock = { width: 300, height: 38 }) {
  const stage = createStageLayout({ media, storage: null });
  stage.setViewport(rect(width, height), { width, height });
  stage.setGutter(20);
  stage.setDock(dock);
  return stage;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('layout derivations', () => {
  test('the dock and the bar share a line while 48 px of margins and gap fit beside them', () => {
    const stage = stageOf(448, 600);
    stage.setScaleBarWidth(100);
    expect(stage.chrome).toBe('wide');
    stage.setViewport(rect(447, 600), { width: 447, height: 600 });
    expect(stage.chrome).toBe('tight');
  });

  test('a bar reaching the middle of the stage is raised a line higher: stacked', () => {
    const stage = stageOf(400, 600);
    stage.setScaleBarWidth(152);
    expect(stage.chrome).toBe('tight');
    stage.setScaleBarWidth(153);
    expect(stage.chrome).toBe('stacked');
  });

  test('a hidden bar takes no room', () => {
    const stage = stageOf(360, 600);
    stage.setScaleBarWidth(0);
    expect(stage.chrome).toBe('wide');
  });

  test('without a visible rectangle the chrome is wide and the dock not tall', () => {
    const stage = createStageLayout({ media, storage: null });
    stage.setDock({ width: 900, height: 400 });
    expect(stage.chrome).toBe('wide');
    expect(stage.dockTall).toBe(false);
    expect(stage.hintRoom).toBeNull();
  });

  test('the dock is tall once it and the letter above it would pass the middle of the stage', () => {
    const stage = stageOf(800, 400, { width: 300, height: 136 });
    expect(stage.dockTall).toBe(false);
    stage.setDock({ width: 300, height: 137 });
    expect(stage.dockTall).toBe(true);
  });

  test('a hint has half the stage less the right key band, the gutter and the top letter', () => {
    const stage = stageOf(800, 600);
    expect(stage.hintRoom).toBe(800 / 2 - 20 - 20);
    stage.setKeys({ top: 0, right: 100 }, { width: 100, height: 300 });
    expect(stage.hintRoom).toBe((800 - 100) / 2 - 20 - 20);
  });

  test('a key in the top band leaves the hint the width beside it', () => {
    const stage = stageOf(800, 600);
    stage.setKeys({ top: 40, right: 0 }, { width: 220, height: 40 });
    expect(stage.hintRoom).toBe(800 - 3 * 20 - 220);
  });

  test('a stage with no size, or a rectangle already held, changes nothing', () => {
    const stage = stageOf(800, 600);
    const held = stage.visibleRect;
    stage.setViewport(rect(500, 500), { width: 0, height: 0 });
    expect(stage.visibleRect).toBe(held);
    stage.setViewport(rect(800, 600), { width: 800, height: 600 });
    expect(stage.visibleRect).toBe(held);
    stage.setViewport(rect(800, 600), { width: 900, height: 600 });
    expect(stage.hostSize).toEqual({ width: 900, height: 600 });
  });

  test('the dock element is watched, and its size reaches the store', async () => {
    const stage = createStageLayout({ media, storage: null });
    const dock = document.body.appendChild(document.createElement('div'));
    dock.style.cssText = 'position: fixed; width: 321px; height: 45px;';
    const stop = stage.observeDock(dock);
    await eventually(() => expect(stage.dock).toEqual({ width: 321, height: 45 }));
    dock.style.height = '60px';
    await eventually(() => expect(stage.dock.height).toBe(60));
    stop();
  });
});

describe('the section row', () => {
  test('folds its details only where one line would not fit between the gutters', () => {
    const stage = stageOf(500, 600);
    stage.sectionNeed = 460;
    expect(stage.sectionCompact).toBe(false);
    stage.sectionNeed = 461;
    expect(stage.sectionCompact).toBe(true);
    stage.setViewport(rect(600, 600), { width: 600, height: 600 });
    expect(stage.sectionCompact).toBe(false);
  });

  test('is always folded on a phone, and never before the stage has a size', () => {
    const stage = createStageLayout({ media: { phone: true }, storage: null });
    expect(stage.sectionCompact).toBe(false);
    stage.setViewport(rect(500, 600), { width: 500, height: 600 });
    expect(stage.sectionCompact).toBe(true);
  });

  test('counts the webfont arrivals for whoever measured before one', () => {
    const stage = stageOf(500, 600);
    const before = stage.fontEpoch;
    stage.fontsLoaded();
    expect(stage.fontEpoch).toBe(before + 1);
  });
});

describe('the dock and the keys tell the camera', () => {
  test('a dock resize calls onDock once the dock is measured', async () => {
    const calls: number[] = [];
    const stage = createStageLayout({
      media,
      storage: null,
      onDock: () => calls.push(stage.dock.height),
    });
    const dock = document.body.appendChild(document.createElement('div'));
    dock.style.cssText = 'position: fixed; width: 300px; height: 40px;';
    const stop = stage.observeDock(dock);
    await eventually(() => expect(calls).toEqual([40]));
    dock.style.height = '90px';
    await eventually(() => expect(calls).toEqual([40, 90]));
    stop();
  });

  test('a changed key band calls onDock, an unchanged one does not', () => {
    let calls = 0;
    const stage = createStageLayout({ media, storage: null, onDock: () => (calls += 1) });
    stage.setKeys({ top: 0, right: 90 }, { width: 90, height: 200 });
    expect(calls).toBe(1);
    stage.setKeys({ top: 0, right: 90 }, { width: 90, height: 220 });
    expect(calls).toBe(1);
    stage.setKeys({ top: 30, right: 0 }, { width: 200, height: 30 });
    expect(calls).toBe(2);
  });
});

describe('the guided tour’s bands', () => {
  test('widen the framing’s right inset beside the keys’ band and its bottom over the dock, refitting only on a change', () => {
    let calls = 0;
    const stage = createStageLayout({ media, storage: null, onDock: () => (calls += 1) });
    stage.setViewport(rect(1000, 600), { width: 1000, height: 600 });
    stage.setGutter(20);
    stage.setDock({ width: 300, height: 38 });
    stage.setKeys({ top: 0, right: 90 }, { width: 90, height: 200 });
    const without = stage.framing().inset;
    calls = 0;
    stage.setGuideInset({ right: 356, bottom: 0 });
    stage.setGuideInset({ right: 356, bottom: 0 });
    expect(calls).toBe(1);
    expect(stage.framing().inset.right).toBeGreaterThanOrEqual(90 + 356);
    stage.setGuideInset({ right: 0, bottom: 240 });
    expect(calls).toBe(2);
    expect(stage.framing().inset.right).toBe(without.right);
    expect(stage.framing().inset.bottom).toBeGreaterThanOrEqual(38 + 20 + 240);
    stage.setGuideInset({ right: 0, bottom: 0 });
    expect(stage.framing().inset).toEqual(without);
    expect(calls).toBe(3);
  });
});

describe('the key fitter and onDock', () => {
  test('framing runs the fitter without ever calling onDock', () => {
    let calls = 0;
    const stage = createStageLayout({ media, storage: null, onDock: () => (calls += 1) });
    stage.setViewport(rect(800, 600), { width: 800, height: 600 });
    stage.setGutter(20);
    stage.setKeyFitter(() => stage.setKeys({ top: 30, right: 0 }, { width: 200, height: 30 }));
    calls = 0;
    expect(stage.framing().inset.top).toBe(30);
    expect(calls).toBe(0);
  });

  test('a desktop viewport change that moves the key band calls onDock; a phone one does not', () => {
    for (const [phone, expected] of [
      [false, 1],
      [true, 0],
    ] as const) {
      let calls = 0;
      const stage = createStageLayout({
        media: { phone },
        storage: null,
        onDock: () => (calls += 1),
      });
      stage.setKeyFitter(() => stage.setKeys({ top: 30, right: 0 }, { width: 200, height: 30 }));
      stage.setViewport(rect(800, 600), { width: 800, height: 600 });
      expect(calls, `phone ${phone}`).toBe(expected);
    }
  });
});

describe('the key fitter and onDock, unchanged band', () => {
  test('a desktop viewport change that leaves the key band as it was does not call onDock', () => {
    let calls = 0;
    const stage = createStageLayout({ media, storage: null, onDock: () => (calls += 1) });
    stage.setKeyFitter(() => stage.setKeys({ top: 30, right: 0 }, { width: 200, height: 30 }));
    stage.setViewport(rect(800, 600), { width: 800, height: 600 });
    expect(calls).toBe(1);
    stage.setViewport(rect(700, 600), { width: 700, height: 600 });
    expect(calls).toBe(1);
  });
});

describe('framing', () => {
  test('before the stage has a size, the dock alone is cleared', () => {
    const stage = createStageLayout({ media, storage: null });
    stage.setGutter(20);
    stage.setDock({ width: 300, height: 38 });
    expect(stage.framing()).toEqual({
      inset: { top: 0, right: 0, bottom: 58 },
      scale: { horizontal: 1, vertical: 1 },
    });
  });

  test('a raised phone sheet hides the dock, so nothing is cleared under it', () => {
    const stage = stageOf(800, 600);
    stage.sheetFull = true;
    expect(stage.framing().inset.bottom).toBe(0);
    expect(stage.framing().scale).toEqual({ horizontal: 1, vertical: 1 });
  });

  test('the colour keys band stays in the insets, and the key fitter runs first', () => {
    const stage = stageOf(800, 600);
    const order: string[] = [];
    stage.setKeyFitter(() => {
      order.push('fit');
      stage.setKeys({ top: 30, right: 0 }, { width: 200, height: 30 });
    });
    const { inset } = stage.framing();
    expect(order).toEqual(['fit']);
    expect(inset.top).toBe(30);
    expect(inset.right).toBe(0);
  });

  test('without markings it is the dock the rectangle gives up, as clearFraming says', () => {
    const stage = stageOf(800, 600);
    const clear = { top: 0, right: 0, bottom: 0, left: 0 };
    const expected = clearFraming({ width: 800, height: 600 }, 58, clear, FRAME_FILL);
    expect(stage.framing()).toEqual({
      inset: { top: 0, right: 0, bottom: expected.inset },
      scale: expected.scale,
    });
  });

  /** The orientation letters and the scale bar, laid out where the CSS puts them, in a 800 × 600 stage at (0, 0). */
  function markings(stage: ReturnType<typeof stageOf>, bar: { top: number; hidden?: boolean }) {
    document.body.style.margin = '0';
    const frame = document.body.appendChild(document.createElement('div'));
    frame.style.cssText = 'position: absolute; left: 0; top: 0; width: 800px; height: 600px;';
    const letter = (edge: string, css: string) => {
      const node = frame.appendChild(document.createElement('span'));
      node.dataset.edge = edge;
      node.style.cssText = `position: absolute; width: 10px; height: 20px; ${css}`;
    };
    letter('top', 'left: 395px; top: 12px;');
    letter('bottom', 'left: 395px; top: 500px;');
    letter('left', 'left: 12px; top: 250px;');
    letter('right', 'left: 778px; top: 250px;');
    const scale = document.body.appendChild(document.createElement('div'));
    scale.style.cssText = `position: absolute; left: 650px; top: ${bar.top}px; width: 120px; height: 20px;`;
    scale.hidden = bar.hidden ?? false;
    stage.registerOrientation(frame);
    stage.registerScaleBar(scale);
  }

  test('the letters and a bar low in the frame clear the room they take at each edge', () => {
    const stage = stageOf(800, 600);
    markings(stage, { top: 560 });
    // The dock reaches 58 px up, so the floor is at 542: the bottom letter and the bar below it take what passes it.
    const clear = {
      top: 12 + 20 + 8,
      bottom: Math.max(542 - 500 + 8, 542 - 560 + 8, 0),
      left: 12 + 10 + 8,
      right: 800 - 778 + 8,
    };
    const expected = clearFraming({ width: 800, height: 600 }, 58, clear, FRAME_FILL);
    expect(stage.framing()).toEqual({
      inset: { top: 0, right: 0, bottom: expected.inset },
      scale: expected.scale,
    });
  });

  test('a bar in the upper half counts toward the top, and a hidden one counts nowhere', () => {
    const stage = stageOf(800, 600);
    markings(stage, { top: 100 });
    const withBar = stage.framing();
    stage.registerScaleBar(null);
    const without = stage.framing();
    expect(withBar.inset.bottom).toBeLessThan(without.inset.bottom!);

    document.body.replaceChildren();
    markings(stage, { top: 100, hidden: true });
    expect(stage.framing()).toEqual(without);
  });

  test('a tall dock drops the bottom letter from the room it takes', () => {
    const stage = stageOf(800, 600, { width: 300, height: 300 });
    markings(stage, { top: 560, hidden: true });
    expect(stage.dockTall).toBe(true);
    const clear = { top: 12 + 20 + 8, bottom: 0, left: 12 + 10 + 8, right: 800 - 778 + 8 };
    const expected = clearFraming({ width: 800, height: 600 }, 320, clear, FRAME_FILL);
    expect(stage.framing()).toEqual({
      inset: { top: 0, right: 0, bottom: expected.inset },
      scale: expected.scale,
    });
  });

  test('a hidden orientation takes no room, and neither does a raised sheet', () => {
    const stage = stageOf(800, 600);
    markings(stage, { top: 560 });
    const bare = clearFraming(
      { width: 800, height: 600 },
      58,
      { top: 0, right: 0, bottom: 0, left: 0 },
      FRAME_FILL,
    );
    (document.body.firstElementChild as HTMLElement).hidden = true;
    expect(stage.framing().inset.bottom).toBe(bare.inset);
    (document.body.firstElementChild as HTMLElement).hidden = false;
    stage.sheetFull = true;
    expect(stage.framing().inset.bottom).toBe(0);
  });

  describe('the gizmo', () => {
    /** A frame of the room's size with its four letters at the edges, and a gizmo drawn as `drawn` within it. */
    function gizmoIn(
      stage: ReturnType<typeof stageOf>,
      { width, height }: { width: number; height: number },
      drawn: { left: number; top: number; size: number },
    ) {
      document.body.style.margin = '0';
      const frame = document.body.appendChild(document.createElement('div'));
      frame.style.cssText = `position: absolute; left: 0; top: 0; width: ${width}px; height: ${height}px;`;
      for (const [edge, css] of [
        ['top', `left: ${width / 2 - 5}px; top: 12px;`],
        ['bottom', `left: ${width / 2 - 5}px; top: ${height - 100}px;`],
        ['left', `left: 12px; top: ${height / 2}px;`],
        ['right', `left: ${width - 22}px; top: ${height / 2}px;`],
      ]) {
        const node = frame.appendChild(document.createElement('span'));
        node.dataset.edge = edge;
        node.style.cssText = `position: absolute; width: 10px; height: 20px; ${css}`;
      }
      const gizmo = document.body.appendChild(document.createElement('div'));
      // Its box is larger than what it draws: the targets reach past the glyphs and take no room.
      gizmo.style.cssText = `position: absolute; left: ${drawn.left - 30}px; top: ${drawn.top - 30}px; width: ${drawn.size + 60}px; height: ${drawn.size + 60}px;`;
      const axes = gizmo.appendChild(document.createElement('div'));
      axes.className = 'gizmo-axes';
      axes.style.cssText = `position: absolute; left: 30px; top: 30px; width: ${drawn.size}px; height: ${drawn.size}px;`;
      stage.registerOrientation(frame);
      return gizmo;
    }

    /** Whether the ellipse the framed room inscribes reaches the box (in the frame's pixels). */
    function reaches(
      { width, height }: { width: number; height: number },
      { inset, scale }: ReturnType<ReturnType<typeof stageOf>['framing']>,
      box: { left: number; top: number; right: number; bottom: number },
    ) {
      const room = { width: width - inset.right!, height: height - inset.top! - inset.bottom! };
      const centre = { x: room.width / 2, y: inset.top! + room.height / 2 };
      const across = (scale.horizontal * FRAME_FILL * room.width) / 2;
      const half = (scale.vertical * FRAME_FILL * room.height) / 2;
      const x = Math.max(box.left, Math.min(centre.x, box.right));
      const y = Math.max(box.top, Math.min(centre.y, box.bottom));
      // A box the ellipse only touches is clear of it, to rounding.
      return ((x - centre.x) / across) ** 2 + ((y - centre.y) / half) ** 2 < 1 - 1e-9;
    }

    test('on a narrow phone stage it moves the picture out of the gizmo’s corner, keeping more of it than the band below', () => {
      const room = { width: 375, height: 420 };
      const stage = stageOf(room.width, room.height, { width: 340, height: 52 });
      const gizmo = gizmoIn(stage, room, { left: 260, top: 16, size: 100 });
      const bare = stage.framing();
      // Its drawn box with the markings' gap.
      const box = { left: 252, top: 8, right: 368, bottom: 124 };
      expect(reaches(room, bare, box)).toBe(true);

      stage.registerGizmo(gizmo);
      const cleared = stage.framing();
      expect(reaches(room, cleared, box)).toBe(false);
      // Giving up the whole band above the gizmo would leave the room below it; the corner keeps more.
      expect(cleared.inset.top!).toBeLessThan(box.bottom);
      const below = room.height - cleared.inset.bottom! - box.bottom;
      const half =
        (cleared.scale.vertical *
          FRAME_FILL *
          (room.height - cleared.inset.top! - cleared.inset.bottom!)) /
        2;
      expect(half).toBeGreaterThan((FRAME_FILL * below) / 2);
    });

    test('on a wide short stage it gives up the band beside the gizmo instead', () => {
      const room = { width: 1000, height: 320 };
      const stage = stageOf(room.width, room.height);
      const gizmo = gizmoIn(stage, room, { left: 860, top: 20, size: 100 });
      const bare = stage.framing();
      const box = { left: 852, top: 12, right: 968, bottom: 128 };
      stage.registerGizmo(gizmo);
      const cleared = stage.framing();
      expect(reaches(room, bare, box)).toBe(true);
      expect(reaches(room, cleared, box)).toBe(false);
      expect(cleared.inset).toEqual({
        top: 0,
        right: room.width - box.left,
        bottom: expect.any(Number),
      });
    });

    test('a gizmo in a corner the picture never reaches changes nothing, nor does a hidden one', () => {
      const room = { width: 1080, height: 840 };
      const stage = stageOf(room.width, room.height);
      // Either band beside or above it would cost the picture room; the ellipse never reaches it.
      const gizmo = gizmoIn(stage, room, { left: 908, top: 20, size: 152 });
      const bare = stage.framing();
      stage.registerGizmo(gizmo);
      expect(stage.framing()).toEqual(bare);

      document.body.replaceChildren();
      const big = gizmoIn(stage, room, { left: 700, top: 20, size: 360 });
      stage.registerGizmo(big);
      expect(stage.framing()).not.toEqual(bare);
      big.hidden = true;
      expect(stage.framing()).toEqual(bare);
    });
  });

  test('writes the dock variables the moment the dock is measured', () => {
    const stage = stageOf(800, 600);
    const host = document.body.appendChild(document.createElement('div'));
    const stop = stage.attachHost(host);
    stage.setDock({ width: 300, height: 120 });
    expect(host.style.getPropertyValue('--dock-height')).toBe('120px');
    expect(host.dataset.dockTall).toBe('false');
    stage.setDock({ width: 300, height: 300 });
    expect(host.dataset.dockTall).toBe('true');
    stop();
  });

  test('measures the markings against a dock that changed in the same task', () => {
    const stage = stageOf(800, 600);
    const host = document.body.appendChild(document.createElement('div'));
    host.style.cssText =
      'position: absolute; left: 0; top: 0; width: 800px; height: 600px; --dock-height: 38px;';
    const frame = host.appendChild(document.createElement('div'));
    frame.style.cssText = 'position: absolute; inset: 0;';
    const letters = {
      top: 'left: 395px; top: 12px;',
      bottom: 'left: 395px; bottom: calc(20px + var(--dock-height) + 8px);',
      left: 'left: 12px; top: 250px;',
      right: 'left: 778px; top: 250px;',
    };
    for (const [edge, css] of Object.entries(letters)) {
      const node = frame.appendChild(document.createElement('span'));
      node.dataset.edge = edge;
      node.style.cssText = `position: absolute; width: 10px; height: 20px; ${css}`;
    }
    stage.registerOrientation(frame);
    const stop = stage.attachHost(host);
    stage.setDock({ width: 300, height: 38 });
    stage.setDock({ width: 300, height: 120 });
    // Reach is the dock and the 20 px gutter; the bottom letter sits 148 px above the bottom: top at 432.
    const reach = 120 + 20;
    const clear = {
      top: 12 + 20 + 8,
      bottom: 600 - reach - 432 < 0 ? 0 : 600 - reach - 432 + 8,
      left: 12 + 10 + 8,
      right: 800 - 778 + 8,
    };
    const expected = clearFraming({ width: 800, height: 600 }, reach, clear, FRAME_FILL);
    expect(stage.framing()).toEqual({
      inset: { top: 0, right: 0, bottom: expected.inset },
      scale: expected.scale,
    });
    stop();
  });

  test('the dock is measured again at framing, in case the observer has not run', () => {
    const stage = stageOf(800, 600);
    const dock = document.body.appendChild(document.createElement('div'));
    dock.style.cssText = 'position: fixed; width: 300px; height: 70px;';
    const stop = stage.observeDock(dock);
    expect(stage.framing().inset.bottom).toBeGreaterThanOrEqual(90);
    expect(stage.dock.height).toBe(70);
    stop();
  });
});

describe('the navigation hint', () => {
  test('is retired for good by the first retirement, and remembered', () => {
    const storage = fakeStorage();
    const stage = createStageLayout({ media, storage: storage as unknown as Storage });
    expect(stage.hintRetired).toBe(false);
    stage.retireHint();
    expect(stage.hintRetired).toBe(true);
    expect(storage.store[PREF_KEYS.stageHint]).toBe('retired');
    expect(createStageLayout({ media, storage: storage as unknown as Storage }).hintRetired).toBe(
      true,
    );
  });

  test('is already retired when an earlier visit retired it', () => {
    const storage = fakeStorage({ [PREF_KEYS.stageHint]: 'retired' });
    expect(createStageLayout({ media, storage: storage as unknown as Storage }).hintRetired).toBe(
      true,
    );
  });

  test('retires for this visit where site data is blocked', () => {
    const stage = createStageLayout({ media, storage: null });
    stage.retireHint();
    expect(stage.hintRetired).toBe(true);
  });
});
