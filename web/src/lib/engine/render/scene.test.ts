import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import {
  Box3,
  FrontSide,
  HalfFloatType,
  Mesh,
  BoxGeometry,
  Color,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';
import type { WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { frameTo } from './camera-views.ts';
import * as outlineEdges from './outline-edges.ts';
import * as outlineOccluders from './outline-occluders.ts';
import { transparentOrder } from './ghost-order.ts';
import { createPipeline, createScene, planFraming } from './scene.ts';
import { orbitPath } from './camera-path.ts';
import { ORBIT_STEP } from './keyboard-orbit.ts';
import {
  CAMERA_RESPONSE,
  SHEET_RESPONSE,
  angularFrequency,
  springAt,
  springSettled,
} from '../../core/spring.ts';

// Only the renderer is replaced, since it needs a GL context.
const calls = vi.hoisted(() => ({
  order: [] as string[],
  canvas: null as EventTarget | null,
  loop: null as ((now: number) => void) | null,
  transparentSort: null as unknown,
  after: [] as unknown[],
}));

vi.mock('three', async (importOriginal) => {
  const original = await importOriginal<typeof import('three')>();
  class FakeRenderer {
    domElement = Object.assign(new EventTarget(), {
      style: {} as Record<string, string>,
      tabIndex: -1,
      clientHeight: 600,
      width: 1600,
      height: 1200,
      setAttribute() {},
      remove() {},
      after(node: unknown) {
        calls.after.push(node);
      },
      setPointerCapture() {},
      releasePointerCapture() {},
      ownerDocument: new EventTarget(),
      getRootNode: () => new EventTarget(),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    });
    ratio = 1;
    toneMapping = 0;
    constructor() {
      calls.canvas = this.domElement;
    }
    getContext = () => null;
    setPixelRatio = (ratio: number) => {
      this.ratio = ratio;
    };
    getPixelRatio = () => this.ratio;
    setTransparentSort(method: unknown) {
      calls.transparentSort = method;
    }
    setSize() {}
    initRenderTarget() {}
    setAnimationLoop(loop: ((now: number) => void) | null) {
      calls.loop = loop;
    }
    dispose() {
      calls.order.push('dispose');
    }
    forceContextLoss() {
      calls.order.push('forceContextLoss');
    }
  }
  return { ...original, WebGLRenderer: FakeRenderer };
});

// The real pipeline construction, without a WebGL context.
function fixture() {
  const renderer = {
    getPixelRatio: () => 2,
    getRenderTarget: () => null,
    setRenderTarget() {},
  } as unknown as WebGLRenderer;
  return createPipeline({
    renderer,
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    msaaSamples: 4,
  });
}

describe('render pipeline', () => {
  it('draws the scene, the halo, the core and the output, in that order', () => {
    const { composer, halo, core } = fixture();
    const [scene, ...rest] = composer.passes;
    assert.ok(scene instanceof RenderPass);
    assert.deepEqual(rest.slice(0, 2), [halo, core]);
    assert.ok(rest[2] instanceof OutputPass);
    assert.equal(composer.passes.length, 4);
    assert.ok(halo instanceof OutlinePass && core instanceof OutlinePass);
  });

  it('gives the halo and the core their thickness, with both outlines off until something is outlined', () => {
    const { halo, core } = fixture();
    assert.deepEqual([halo.edgeThickness, core.edgeThickness], [3, 1]);
    for (const pass of [halo, core]) {
      assert.equal(pass.edgeStrength, 6);
      assert.equal(pass.edgeGlow, 0);
      assert.equal(pass.enabled, false);
      assert.equal(pass.depthMaterial.side, FrontSide);
      assert.equal(pass.prepareMaskMaterial.side, FrontSide);
    }
  });

  it('keeps the output pass from swapping buffers', () => {
    const output = fixture().composer.passes.at(-1) as OutputPass;
    assert.equal(output.needsSwap, false);
  });

  it('keeps one image target across successive frames and never writes to the spare target', () => {
    const { composer, halo, core } = fixture();
    halo.enabled = core.enabled = true;
    const image = composer.readBuffer;
    const destinations: unknown[] = [];
    for (const pass of composer.passes) {
      pass.render = (_renderer, write, read) => {
        destinations.push(pass.renderToScreen ? null : read);
        void write;
      };
    }
    for (let i = 0; i < 3; i++) composer.render(0);
    assert.equal(composer.readBuffer, image);
    assert.ok(destinations.every((target) => target === null || target === image));
    assert.ok(!destinations.includes(composer.writeBuffer));
  });

  it('retains MSAA and cut stencil precision without resolving unused depth', () => {
    const target = fixture().composer.readBuffer;
    assert.equal(target.samples, 4);
    assert.equal(target.texture.type, HalfFloatType);
    assert.equal(target.depthBuffer, true);
    assert.equal(target.stencilBuffer, true);
    assert.equal(target.resolveDepthBuffer, false);
    assert.equal(target.resolveStencilBuffer, false);
  });

  it('paints the core from the halo mask when both outline the same meshes', () => {
    const { halo, core } = fixture();
    const mesh = new Mesh(new BoxGeometry());
    halo.selectedObjects = [mesh];
    core.selectedObjects = [mesh];
    halo.enabled = core.enabled = true;
    const paint = vi.spyOn(outlineEdges, 'paintOutlineEdges').mockImplementation(() => {});
    const occluders = vi.spyOn(outlineOccluders, 'withOutlineOccluders');
    const read = {} as never;
    core.render({} as never, {} as never, read, 0, false);
    assert.equal(paint.mock.calls.length, 1);
    assert.equal(paint.mock.calls[0]![1], halo.renderTargetMaskBuffer.texture);
    assert.equal(paint.mock.calls[0]![3], read);
    assert.equal(occluders.mock.calls.length, 0);
    vi.restoreAllMocks();
  });
});

describe('planFraming', () => {
  it('returns the framed plan and leaves the camera and controls exactly as they were', () => {
    const camera = new PerspectiveCamera(35, 1.6, 0.001, 10);
    camera.position.set(0.2, 0.1, 0.3);
    const controls = new OrbitControls(camera);
    controls.minDistance = 0.02;
    controls.maxDistance = 4;
    const before = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      target: controls.target.clone(),
      near: camera.near,
      far: camera.far,
    };
    const bounds = new Box3(new Vector3(-0.07, -0.1, -0.06), new Vector3(0.07, 0.1, 0.08));
    const plan = planFraming(camera, controls, bounds, new Vector3(1, 0, 0), frameTo, {
      horizontal: 1,
      vertical: 0.45,
    });
    assert.notDeepEqual(plan.position, before.position);
    assert.deepEqual(plan.target, bounds.getCenter(new Vector3()));
    assert.deepEqual(camera.position, before.position);
    assert.ok(camera.quaternion.equals(before.quaternion));
    assert.deepEqual(controls.target, before.target);
    assert.equal(camera.near, before.near);
    assert.equal(camera.far, before.far);
    assert.equal(controls.minDistance, 0.02);
    assert.equal(controls.maxDistance, 4);
  });
});

const host = {
  prepend() {},
  getBoundingClientRect: () => ({ width: 800, height: 600 }),
} as unknown as HTMLElement;

describe('scene lifecycle', () => {
  beforeEach(() => {
    calls.order = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('document', { documentElement: {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('frees the renderer, then releases its context, without reporting a loss', () => {
    const onContextLost = vi.fn();
    const stage = createScene(host, { onContextLost });
    stage.dispose();
    assert.deepEqual(calls.order, ['dispose', 'forceContextLoss']);
    calls.canvas!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    assert.equal(onContextLost.mock.calls.length, 0);
  });

  it('draws translucent surfaces in the order that keeps focus ghosts from piling into a fog', () => {
    const stage = createScene(host);
    assert.equal(calls.transparentSort, transparentOrder);
    stage.dispose();
  });

  it('reports a context lost while the scene is alive', () => {
    const onContextLost = vi.fn();
    const stage = createScene(host, { onContextLost });
    calls.canvas!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    assert.equal(onContextLost.mock.calls.length, 1);
    stage.dispose();
  });

  it('refuses a theme without a numeric exposure', () => {
    const stage = createScene(host);
    for (const exposure of ['', 'bright', '1,2']) {
      vi.stubGlobal('getComputedStyle', () => ({
        getPropertyValue: (name: string) => (name === '--scene-exposure' ? exposure : '#808080'),
      }));
      assert.throws(() => stage.applyTheme(), /--scene-exposure/);
    }
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (name: string) => (name === '--scene-exposure' ? '1.2' : '#808080'),
    }));
    assert.doesNotThrow(() => stage.applyTheme());
    stage.dispose();
  });

  it('adds a hidden outline edge in its own token colour, not edgeStrength times brighter', () => {
    const passes: OutlinePass[] = [];
    const addPass = EffectComposer.prototype.addPass;
    vi.spyOn(EffectComposer.prototype, 'addPass').mockImplementation(function (
      this: EffectComposer,
      pass,
    ) {
      if (pass instanceof OutlinePass) passes.push(pass);
      addPass.call(this, pass);
    });
    const stage = createScene(host);
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (name: string) => (name === '--scene-exposure' ? '1' : '#46505e'),
    }));
    stage.applyTheme();
    assert.equal(passes.length, 4, 'the halo and core of both pipelines');
    const token = new Color('#46505e');
    for (const pass of passes) {
      // OutlinePass's overlay adds edgeStrength × the edge colour.
      const drawn = pass.hiddenEdgeColor.clone().multiplyScalar(pass.edgeStrength);
      assert.ok(Math.abs(drawn.r - token.r) < 1e-9 && Math.abs(drawn.b - token.b) < 1e-9);
    }
    stage.dispose();
  });
});

describe('scene motion', () => {
  let clock = 0;
  // Where `frame` counts from: the clock's start, or where a stage came to rest.
  let origin = 1000;
  let reduced = false;
  let resizeObserved: (() => void) | null = null;
  let composerRatios: number[] = [];
  // Where the camera stood at each render, in order, with the dissolve's copies between them.
  let drawnLog: string[] = [];

  beforeEach(() => {
    clock = 1000;
    origin = 1000;
    reduced = false;
    composerRatios = [];
    drawnLog = [];
    calls.loop = null;
    calls.after = [];
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.spyOn(EffectComposer.prototype, 'render').mockImplementation(function (
      this: EffectComposer,
    ) {
      composerRatios.push((this as unknown as { _pixelRatio: number })._pixelRatio);
      const { camera } = this.passes[0] as RenderPass;
      drawnLog.push(`render ${camera.position.toArray().map((v) => v.toFixed(3))}`);
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeObserved = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
    vi.stubGlobal('document', { documentElement: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const hostOf = (width: number, height: number) =>
    ({
      prepend() {},
      getBoundingClientRect: () => ({ width, height }),
    }) as unknown as HTMLElement;

  const plan = () => ({
    position: new Vector3(0.3, 0.1, 0.4),
    target: new Vector3(0.01, 0, 0),
    near: 0.01,
    far: 5,
    minDistance: 0.05,
    maxDistance: 2,
  });

  /** A plan a quarter or half turn round the superior axis from `plan()`, with limits of its own. */
  const turned = (quarters: number) => {
    const base = plan();
    const offset = base.position.clone().sub(base.target);
    offset.applyAxisAngle(new Vector3(0, 1, 0), (quarters * Math.PI) / 2);
    return {
      ...base,
      position: new Vector3(0.03, 0, 0).add(offset),
      target: new Vector3(0.03, 0, 0),
      minDistance: 0.06,
      maxDistance: 1.5,
    };
  };

  /** One frame of the render loop at `offset` ms after `origin`. */
  const frame = (offset: number) => {
    clock = origin + offset;
    calls.loop!(clock);
  };
  const FRAME_MS = 1000 / 60;

  /** 60 Hz frames from `offset` until `done`, returning the offset of the frame it held at. */
  const until = (offset: number, done: () => boolean) => {
    while (!done()) {
      offset += FRAME_MS;
      assert.ok(offset < 5000, 'it never got there');
      frame(offset);
    }
    return offset;
  };

  const close = (actual: number, expected: number, tolerance = 1e-6) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

  /** A stage resting on `plan()`, its full-resolution frame drawn and its loop stopped. */
  function resting() {
    const stage = createScene(host);
    stage.setSize();
    stage.moveTo(plan(), { immediate: true });
    frame(0);
    frame(200);
    const settledRatio = composerRatios.at(-1)!;
    frame(201);
    assert.equal(calls.loop, null);
    origin = clock;
    return { stage, settledRatio };
  }

  const canvas = () =>
    calls.canvas as EventTarget & { ownerDocument: EventTarget; style: Record<string, string> };
  const mouse = (type: string, x: number) =>
    Object.assign(new Event(type), {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: x,
      clientY: 300,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    });

  it('SCENE-01 a view change rides the camera spring, lands on the plan when it settles and applies its limits there', () => {
    const { stage } = resting();
    const start = {
      quaternion: stage.camera.quaternion.clone(),
      position: stage.camera.position.clone(),
      target: stage.controls.target.clone(),
    };
    const destination = turned(1);
    stage.moveTo(destination);
    frame(120);
    // Every part of the move is linear in the spring's progress: the target goes straight there.
    const progress = springAt(0.12, CAMERA_RESPONSE).value;
    assert.ok(
      stage.controls.target.distanceTo(start.target.clone().lerp(destination.target, progress)) <
        1e-12,
    );
    assert.equal(stage.controls.minDistance, 0.05);
    assert.equal(stage.controls.maxDistance, 2);
    assert.deepEqual(stage.destination.position, destination.position);

    // It arrives on the first frame at which the spring has come within 1e-3 rad and 1e-3 of the distance.
    const path = orbitPath(start, { ...destination, up: new Vector3(0, 1, 0) });
    const reach = destination.position.distanceTo(destination.target);
    const settledAt = (offset: number) => {
      const state = springAt(offset / 1000, CAMERA_RESPONSE);
      return (
        springSettled(state, path.turn.length(), 1e-3) &&
        springSettled(state, path.shift.length() + Math.abs(path.stretch), 1e-3 * reach)
      );
    };
    const arrived = until(120, () => stage.controls.maxDistance === 1.5);
    assert.ok(settledAt(arrived) && !settledAt(arrived - FRAME_MS), `arrived at ${arrived} ms`);
    assert.ok(arrived > 400 && arrived < 800, 'a quarter turn takes the spring’s time, not 240 ms');
    assert.ok(stage.camera.position.distanceTo(destination.position) < 1e-12);
    assert.ok(stage.controls.target.distanceTo(destination.target) < 1e-12);
    assert.equal(stage.controls.minDistance, 0.06);
    stage.dispose();
  });

  it('SCENE-34 a change of mind mid-move carries the camera’s turning speed into the new path', () => {
    const { stage } = resting();
    stage.moveTo(turned(1));
    frame(92);
    const before = stage.camera.quaternion.clone();
    frame(96);
    const at = stage.camera.quaternion.clone();
    const speedBefore = before.angleTo(at) / 4;
    // Further round the same way: the camera keeps turning rather than starting again from rest.
    stage.moveTo(turned(2));
    frame(100);
    const speedAfter = at.angleTo(stage.camera.quaternion) / 4;
    assert.ok(
      speedAfter > 0.8 * speedBefore && speedAfter < 1.3 * speedBefore,
      `${speedBefore} then ${speedAfter} rad/ms`,
    );
    until(100, () => stage.controls.maxDistance === 1.5);
    assert.ok(stage.camera.position.distanceTo(turned(2).position) < 1e-12);
    stage.dispose();
  });

  it('SCENE-35 a wheel zoom or a turn made during a move changes where it goes, and it goes on', () => {
    const { stage } = resting();
    const destination = turned(1);
    stage.moveTo(destination);
    frame(90);
    const drawn = stage.camera.position.clone();
    // A wheel step: start and end with no pointer held, and the zoom between them.
    stage.controls.dispatchEvent({ type: 'start' });
    stage.controls.dollyIn(0.5);
    stage.controls.dispatchEvent({ type: 'end' });
    assert.ok(stage.camera.position.equals(drawn), 'the zoom does not jump the drawn camera');
    const reach = destination.position.distanceTo(destination.target);
    close(stage.destination.position.distanceTo(stage.destination.target), reach / 2, 1e-12);
    // A chevron, mid-move: five degrees further round the superior axis.
    stage.controls.rotateLeft(-ORBIT_STEP);
    const expected = destination.position
      .clone()
      .sub(destination.target)
      .multiplyScalar(0.5)
      .applyAxisAngle(new Vector3(0, 1, 0), ORBIT_STEP)
      .add(destination.target);
    assert.ok(stage.destination.position.distanceTo(expected) < 1e-12);
    frame(106);
    assert.ok(stage.camera.position.distanceTo(drawn) > 1e-4, 'still moving');
    until(106, () => stage.controls.maxDistance === 1.5);
    assert.ok(stage.camera.position.distanceTo(expected) < 1e-12);
    stage.dispose();
  });

  it('SCENE-04 a pointer grab stops a move where it is drawn', () => {
    const { stage } = resting();
    stage.moveTo(turned(1));
    frame(90);
    const drawn = stage.camera.position.clone();
    canvas().dispatchEvent(mouse('pointerdown', 400));
    frame(106);
    frame(400);
    assert.ok(stage.camera.position.distanceTo(drawn) < 1e-12);
    assert.ok(stage.destination.position.distanceTo(drawn) < 1e-12);
    stage.dispose();
  });

  it('SCENE-36 a drag turns the camera with the pointer exactly, coasts after a moving release, and rests at full resolution as it stops', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const { stage, settledRatio } = resting();
    const offset = () => stage.camera.position.clone().sub(stage.controls.target);
    const azimuth = () => Math.atan2(offset().x, offset().z);
    const start = azimuth();
    canvas().dispatchEvent(mouse('pointerdown', 400));
    let x = 400;
    let t = 0;
    for (let i = 0; i < 6; i += 1) {
      t += FRAME_MS;
      clock = origin + t;
      x += 10;
      canvas().ownerDocument.dispatchEvent(mouse('pointermove', x));
      // Each move lands whole, before the frame draws: 2π · 10 / 600 a move.
      close(Math.abs(azimuth() - start), ((i + 1) * 2 * Math.PI * 10) / 600, 1e-9);
      frame(t);
    }
    const atRelease = azimuth();
    canvas().ownerDocument.dispatchEvent(mouse('pointerup', x));
    frame(t + FRAME_MS);
    assert.ok(Math.abs(azimuth() - atRelease) > 1e-3, 'it coasts on');
    composerRatios = [];
    let previous = azimuth();
    let still = 0;
    t = until(t + FRAME_MS, () => {
      still = azimuth() === previous ? still + FRAME_MS : 0;
      previous = azimuth();
      return composerRatios.at(-1) === settledRatio;
    });
    assert.equal(still, 0, 'the full frame is drawn as the coast ends, not after a wait');
    const coasted = Math.abs(azimuth() - atRelease);
    // ω · τ for 10 px per frame on a 600 px canvas, less the tail below 2°/s.
    close(coasted, ((2 * Math.PI * 10) / 600 / (FRAME_MS / 1000)) * 0.1, 0.02);
    assert.ok(composerRatios.slice(0, -1).every((ratio) => ratio < settledRatio));
    frame(t + FRAME_MS);
    assert.equal(calls.loop, null, 'at rest the loop stops');
    stage.dispose();
  });

  it('SCENE-02 under reduced motion a move, a settling sheet and a framing slide dissolve instead of moving', () => {
    reduced = true;
    vi.stubGlobal('devicePixelRatio', 2);
    let opacity = '1';
    const overlays: {
      width: number;
      height: number;
      style: { cssText: string };
      attributes: Record<string, string>;
      animation: { keyframes: unknown; options: unknown; pending: boolean; done: () => void };
      removed: boolean;
    }[] = [];
    vi.stubGlobal('getComputedStyle', () => ({ opacity }));
    vi.stubGlobal('document', {
      documentElement: {},
      createElement(tag: string) {
        assert.equal(tag, 'canvas');
        let done = () => {};
        const finished = new Promise<void>((resolve) => (done = resolve));
        const overlay = {
          width: 0,
          height: 0,
          style: { cssText: '' },
          attributes: {} as Record<string, string>,
          removed: false,
          animation: { keyframes: null as unknown, options: null as unknown, pending: true, done },
          setAttribute(name: string, value: string) {
            overlay.attributes[name] = value;
          },
          getContext: () => ({
            globalAlpha: 1,
            drawImage(this: { globalAlpha: number }, source: unknown) {
              const from =
                source === calls.canvas ? 'canvas' : `overlay ${overlays.indexOf(source as never)}`;
              drawnLog.push(`copy ${from} at ${this.globalAlpha}`);
            },
          }),
          animate(keyframes: unknown, options: unknown) {
            Object.assign(overlay.animation, { keyframes, options });
            return Object.assign(overlay.animation, { finished });
          },
          remove() {
            overlay.removed = true;
          },
        };
        overlays.push(overlay);
        return overlay;
      },
    });
    const { stage, settledRatio } = resting();
    composerRatios = [];
    drawnLog = [];
    stage.moveTo(turned(1));
    // In this task: the frame on screen drawn and copied, then the camera placed and drawn beneath it.
    const there = turned(1)
      .position.toArray()
      .map((v) => v.toFixed(3));
    assert.deepEqual(drawnLog, ['render 0.300,0.100,0.400', 'copy canvas at 1', `render ${there}`]);
    assert.deepEqual(composerRatios, [settledRatio, settledRatio]);
    assert.equal(stage.controls.maxDistance, 1.5);
    const [overlay] = overlays;
    assert.deepEqual(calls.after, [overlay]);
    assert.deepEqual([overlay!.width, overlay!.height], [1600, 1200]);
    assert.match(overlay!.style.cssText, /position: absolute; inset: 0;.*pointer-events: none/);
    assert.equal(overlay!.attributes['aria-hidden'], 'true');
    assert.deepEqual(overlay!.animation.keyframes, [{ opacity: 1 }, { opacity: 0 }]);
    assert.deepEqual(overlay!.animation.options, { duration: 160 });

    // A sheet settling in the same frame keeps that copy: its offset is final at once.
    stage.setChromeInsets({ bottom: 200 }, { settle: true, velocity: 3 });
    assert.equal(overlays.length, 1);
    assert.equal(stage.camera.view?.offsetY, 100);
    // Nothing moves on the frame that follows and nothing is drawn again: the loop stops.
    composerRatios = [];
    frame(FRAME_MS);
    assert.deepEqual(composerRatios, []);
    assert.equal(calls.loop, null);
    assert.ok(stage.camera.position.distanceTo(turned(1).position) < 1e-12);

    // Mid-fade, a framing slide copies what is on screen: the canvas under the last copy at its opacity.
    overlay!.animation.pending = false;
    opacity = '0.4';
    drawnLog = [];
    stage.setFramingInset({ bottom: 80 });
    assert.equal(stage.camera.view?.offsetY, 140);
    assert.deepEqual(drawnLog.slice(1, 3), ['copy canvas at 1', 'copy overlay 0 at 0.4']);
    assert.equal(overlay!.removed, true);
    assert.equal(overlays.length, 2);

    // An immediate move lands without one.
    stage.moveTo(plan(), { immediate: true });
    assert.equal(overlays.length, 2);
    stage.dispose();
  });

  it('SCENE-02 the copy is removed once it has faded', async () => {
    reduced = true;
    const removed: string[] = [];
    let finish = () => {};
    vi.stubGlobal('document', {
      documentElement: {},
      createElement: () => ({
        style: {},
        setAttribute() {},
        getContext: () => ({ drawImage() {} }),
        animate: () => ({
          pending: true,
          finished: new Promise<void>((resolve) => (finish = resolve)),
        }),
        remove: () => removed.push('overlay'),
      }),
    });
    const { stage } = resting();
    stage.moveTo(turned(1));
    assert.deepEqual(removed, []);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(removed, ['overlay']);
    stage.dispose();
  });

  it('SCENE-03 a framing inset slides on the camera spring, and on a settling sheet’s beside one', () => {
    const plain = createScene(host);
    plain.setSize();
    plain.setFramingInset({ bottom: 80 });
    // offsetY = 300 - (600 - 80 · progress) / 2.
    for (const offset of [60, 120, 180]) {
      frame(offset);
      close(plain.camera.view!.offsetY, 40 * springAt(offset / 1000, CAMERA_RESPONSE).value);
    }
    plain.dispose();

    clock = 1000;
    const beside = createScene(host);
    beside.setSize();
    beside.setChromeInsets({ bottom: 300 }, { settle: true, velocity: 4 });
    beside.setFramingInset({ bottom: 80 });
    // Both bands ride the sheet's spring from its velocity: offsetY = (300 + 80) / 2 · progress.
    for (const offset of [60, 120, 180]) {
      frame(offset);
      close(beside.camera.view!.offsetY, 190 * springAt(offset / 1000, SHEET_RESPONSE, 4).value);
    }
    beside.dispose();
  });

  it('SCENE-03 a reframe made while the sheet settles rides the rest of the sheet’s spring', () => {
    const { stage } = resting();
    const from = stage.controls.target.clone();
    stage.setChromeInsets({ bottom: 300 }, { settle: true, velocity: 6 });
    // The sheet's reframe comes 40 ms into its settle.
    clock = origin + 40;
    const destination = turned(1);
    stage.moveTo(destination);
    const sheet = (offset: number) => springAt(offset / 1000, SHEET_RESPONSE, 6).value;
    for (const offset of [80, 160]) {
      frame(offset);
      const share = (sheet(offset) - sheet(40)) / (1 - sheet(40));
      assert.ok(
        stage.controls.target.distanceTo(from.clone().lerp(destination.target, share)) < 1e-12,
        `${offset} ms`,
      );
      close(stage.camera.view!.offsetY, 150 * sheet(offset));
    }
    // A finger on the sheet takes the image's offset at once, and the camera goes on.
    stage.setChromeInsets({ bottom: 250 });
    assert.equal(stage.camera.view!.offsetY, 125);
    until(160, () => stage.controls.maxDistance === 1.5);
    stage.dispose();
  });

  it('SCENE-37 a settling sheet must start within its spring’s rate', () => {
    const { stage } = resting();
    for (const velocity of [-0.5, 21, Number.NaN]) {
      assert.throws(
        () => stage.setChromeInsets({ bottom: 300 }, { settle: true, velocity }),
        RangeError,
      );
    }
    stage.setChromeInsets(
      { bottom: 300 },
      { settle: true, velocity: angularFrequency(SHEET_RESPONSE) },
    );
    stage.dispose();
  });

  it('SCENE-05 the sheet shrinks the visible rectangle, not the canvas, the camera or the target', () => {
    const stage = createScene(hostOf(1000, 700));
    stage.setSize();
    stage.moveTo(plan(), { immediate: true });
    const position = stage.camera.position.toArray();
    const target = stage.controls.target.toArray();
    stage.setChromeInsets({ bottom: 200 });
    assert.equal(stage.visibleRect.height, 500);
    assert.deepEqual(stage.hostSize, { width: 1000, height: 700 });
    assert.equal(stage.camera.view?.enabled, true);
    assert.equal(stage.camera.view?.fullHeight, 700);
    assert.equal(stage.camera.view?.offsetY, 100);
    assert.deepEqual(stage.camera.position.toArray(), position);
    assert.deepEqual(stage.controls.target.toArray(), target);
    stage.dispose();
  });

  it('SCENE-06 a framing inset narrows framing but not the visible rectangle, and reports a change', () => {
    const stage = createScene(host);
    stage.setSize();
    assert.equal(stage.setFramingInset({ bottom: 80 }), true);
    assert.equal(stage.setFramingInset({ bottom: 80 }), false);
    assert.deepEqual(stage.visibleRect, { x: 0, y: 0, width: 800, height: 600 });
    close(stage.viewportFit.vertical, 1 - 80 / 600, 1e-12);
    assert.equal(stage.viewportFit.horizontal, 1);
    assert.equal(stage.setFramingInset({ bottom: 40 }, { immediate: true }), true);
    assert.equal(stage.camera.view?.offsetY, 20);
    stage.dispose();
  });

  it('SCENE-07 a host resize reports a canvas change and a sheet inset does not', () => {
    const onResize = vi.fn();
    const stage = createScene(host, { onResize });
    resizeObserved!();
    assert.deepEqual(onResize.mock.calls, [[{ canvasChanged: true }]]);
    stage.setChromeInsets({ bottom: 100 });
    assert.deepEqual(onResize.mock.calls.at(-1), [{ canvasChanged: false }]);
    const count = onResize.mock.calls.length;
    stage.setChromeInsets({ bottom: 100 });
    assert.equal(onResize.mock.calls.length, count);
    stage.dispose();
  });

  it('SCENE-08 a moving camera draws at the reduced ratio, at full on the frame it arrives, then rests', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const { stage, settledRatio } = resting();
    stage.moveTo(turned(1));
    composerRatios = [];
    frame(120);
    assert.ok(composerRatios.length > 0 && composerRatios.every((ratio) => ratio < settledRatio));
    composerRatios = [];
    const arrived = until(120, () => stage.controls.maxDistance === 1.5);
    assert.equal(composerRatios.at(-1), settledRatio, 'the arrival frame is the full one');
    assert.ok(composerRatios.slice(0, -1).every((ratio) => ratio < settledRatio));
    composerRatios = [];
    frame(arrived + FRAME_MS);
    assert.deepEqual(composerRatios, []);
    assert.equal(calls.loop, null, 'the loop stops until something changes');
    stage.invalidate();
    assert.notEqual(calls.loop, null);
    stage.dispose();
  });

  it('SCENE-08 a drag held still draws at full resolution once it has rested 150 ms, pointer still down', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const { stage, settledRatio } = resting();
    canvas().dispatchEvent(mouse('pointerdown', 400));
    clock = origin + 10;
    canvas().ownerDocument.dispatchEvent(mouse('pointermove', 420));
    composerRatios = [];
    frame(10);
    assert.ok(composerRatios.length === 1 && composerRatios[0]! < settledRatio);
    composerRatios = [];
    frame(100);
    assert.deepEqual(composerRatios, [], 'a pause in a drag is no rest');
    frame(161);
    assert.deepEqual(composerRatios, [settledRatio]);
    stage.dispose();
  });
});
