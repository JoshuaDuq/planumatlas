import { HalfFloatType, NeutralToneMapping, WebGLRenderer, WebGLRenderTarget } from 'three';
import type { Object3D, PerspectiveCamera, Scene } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { gpuRendererName, isAppleSilicon, isIntegratedGpu } from './device.ts';
import { opaqueOrder, transparentOrder } from './draw-order.ts';
import type { Size } from './effective-viewport.ts';
import { createOutlinePasses, scaleOutlines } from './outline-passes.ts';
import type { OutlinePasses } from './outline-passes.ts';
import { motionRatio, msaaSamplesFor, qualityProfile, stepSettledRatio } from './quality.ts';
import type { QualityProfile, SettledStepping } from './quality.ts';
import type { SnapshotCrop } from './scene.ts';
import type { SnapshotOptions } from '../../types/index.ts';

export interface Pipeline extends OutlinePasses {
  composer: EffectComposer;
}

export interface PipelineOptions {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  msaaSamples: number;
}

/** The fewest pixels per CSS pixel a saved image is drawn at, whatever the screen's. */
export const SNAPSHOT_PIXEL_RATIO = 2;

/**
 * The composer for one resolution: scene, a two-tone outline and the output pass.
 * Exported so a test can read the passes and their order without a GL context.
 */
export function createPipeline({
  renderer,
  scene,
  camera,
  msaaSamples,
}: PipelineOptions): Pipeline {
  const composer = new EffectComposer(
    renderer,
    new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      stencilBuffer: true,
      samples: msaaSamples,
      // Caps need these attachments during the scene draw; postprocessing
      // samples only colour, so copying depth and stencil serves no reader.
      resolveDepthBuffer: false,
      resolveStencilBuffer: false,
    }),
  );
  composer.addPass(new RenderPass(scene, camera));
  const { halo, core } = createOutlinePasses(scene, camera);
  composer.addPass(halo);
  composer.addPass(core);
  const output = new OutputPass();
  // Every pass draws into readBuffer or the canvas. Swapping after output
  // would allocate a second full-size MSAA/depth/stencil target next frame.
  output.needsSwap = false;
  composer.addPass(output);
  return { composer, halo, core };
}

/** Give a composer's targets `samples`; one already allocated with others is released and made again. */
function setSamples(composer: EffectComposer, samples: number): void {
  for (const target of [composer.renderTarget1, composer.renderTarget2]) {
    if (target.samples === samples) continue;
    target.samples = samples;
    target.dispose();
  }
}

/** A phone steps its frame at rest from its starting ratio toward its ceiling; anything else holds. */
function startStepping({ pixelRatio, settledCeiling }: QualityProfile): SettledStepping | null {
  return settledCeiling > pixelRatio
    ? { ratio: pixelRatio, ceiling: settledCeiling, readings: [] }
    : null;
}

/** The renderer, its two pipelines and the targets they draw into. */
export interface Renderer {
  renderer: WebGLRenderer;
  /** The pipeline a camera at rest draws through, at the full pixel ratio. */
  settled: Pipeline;
  /** The pipeline a moving camera draws through, at the motion ratio the output pass scales up. */
  moving: Pipeline;
  pipelines: readonly Pipeline[];
  /** Size the canvas and both pipelines to the host's CSS size; the scan is drawn at its own ratio. */
  setSize(width: number, height: number, mri: boolean): void;
  /**
   * Draw the settled pipeline. On a phone, a `quiet` frame (the GPU idle before it) is timed, and
   * the ratio it steps to is taken by the next settled frame, so the canvas is resized and drawn in
   * one task.
   */
  renderSettled(quiet: boolean): void;
  /** Read the display's density again: a window moved to another display, or a page zoom. */
  readDensity(): void;
  /** Compile the programs `root`'s materials need now, into the settled composer's target. */
  compile(root: Object3D): Promise<void>;
  captureSnapshot(
    crop: SnapshotCrop,
    hostSize: Size,
    invalidate: () => void,
    options?: SnapshotOptions,
  ): { canvas: HTMLCanvasElement; ratio: number };
  dispose(): void;
}

/**
 * The renderer, set up for the anatomy and prepended to `host`, with its quality read from its GPU
 * and the display.
 *
 * A moving camera draws through a second, lower-resolution pipeline that the
 * output pass scales to the canvas; the frame after it settles is full
 * resolution. Both stay allocated: resizing targets mid-drag costs 15–50 ms.
 */
export function createRenderer(
  host: HTMLElement,
  scene: Scene,
  camera: PerspectiveCamera,
): Renderer {
  // The composer owns MSAA and the stencil the cut caps use. The default
  // framebuffer cannot do both, so it stays single-sampled and unused for drawing:
  // only the output pass's quad reaches it, which needs no depth buffer.
  const renderer = new WebGLRenderer({
    antialias: false,
    depth: false,
    powerPreference: 'high-performance',
  });
  const gpu = gpuRendererName(renderer.getContext());
  const profile = () =>
    qualityProfile({ integrated: isIntegratedGpu(gpu), appleSilicon: isAppleSilicon(gpu) });
  const quality: QualityProfile = profile();
  renderer.localClippingEnabled = true;
  renderer.setOpaqueSort(opaqueOrder);
  renderer.setTransparentSort(transparentOrder);
  renderer.setPixelRatio(quality.pixelRatio);
  // Khronos PBR Neutral: a surface lit squarely shows its published colour,
  // where ACES shifted hues and bleached atlas and network colours alike.
  renderer.toneMapping = NeutralToneMapping;
  renderer.domElement.tabIndex = 0;
  // It takes the arrow keys itself; a screen reader's browse mode would eat them. The localized
  // aria-label and aria-roledescription are set by the facade from i18n.
  renderer.domElement.setAttribute('role', 'application');
  host.prepend(renderer.domElement);

  const pipelineOptions = { renderer, scene, camera, msaaSamples: quality.msaaSamples };
  const settled = createPipeline(pipelineOptions);
  const moving = createPipeline(pipelineOptions);
  const pipelines = [settled, moving];
  let movingRatio: number | null = null;
  let size: { width: number; height: number; mri: boolean } | null = null;
  let stepping = startStepping(quality);
  const pixel = new Uint8Array(4);

  function setSize(width: number, height: number, mri: boolean) {
    size = { width, height, mri };
    const ratio = mri ? quality.mriPixelRatio : quality.pixelRatio;
    if (renderer.getPixelRatio() !== ratio) {
      renderer.setPixelRatio(ratio);
      settled.composer.setPixelRatio(ratio);
    }
    const reduced = motionRatio(Math.min(ratio, quality.motionPixelRatio), width, height);
    if (movingRatio !== reduced) {
      movingRatio = reduced;
      moving.composer.setPixelRatio(reduced);
    }
    renderer.setSize(width, height);
    for (const [pipeline, pixelRatio] of [
      [settled, ratio],
      [moving, reduced],
    ] as const) {
      scaleOutlines(pipeline, pixelRatio);
      setSamples(
        pipeline.composer,
        msaaSamplesFor(quality.msaaSamples, width * height * pixelRatio ** 2),
      );
      pipeline.composer.setSize(width, height);
    }
    // Allocated now rather than inside the first frame of a drag.
    renderer.initRenderTarget(moving.composer.readBuffer);
  }

  return {
    renderer,
    settled,
    moving,
    pipelines,
    setSize,

    renderSettled(quiet) {
      if (stepping && stepping.ratio !== quality.pixelRatio) {
        quality.pixelRatio = stepping.ratio;
        if (size) setSize(size.width, size.height, size.mri);
      }
      if (!stepping || !quiet || size?.mri) {
        settled.composer.render();
        return;
      }
      const start = performance.now();
      settled.composer.render();
      const cpu = performance.now() - start;
      // One pixel read back waits for the GPU to finish the frame; the composer leaves the canvas bound.
      const gl = renderer.getContext();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      stepping = stepSettledRatio(stepping, { cpu, total: performance.now() - start });
    },

    readDensity() {
      const { pixelRatio, mriPixelRatio, motionPixelRatio, settledCeiling } = profile();
      Object.assign(quality, { pixelRatio, mriPixelRatio, motionPixelRatio, settledCeiling });
      stepping = startStepping(quality);
    },

    // Into the composer's target: a program's key carries the output colour space and tone
    // mapping, which differ there from the canvas, so a canvas compile readies unused programs.
    compile(root) {
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(settled.composer.readBuffer);
      try {
        return renderer.compileAsync(root, camera, scene).then(() => undefined);
      } finally {
        renderer.setRenderTarget(previous);
      }
    },

    /**
     * The settled frame, copied pixel for pixel to a 2D canvas that can be annotated. `crop` is
     * the part of the canvas to keep, in CSS pixels; `ratio` is the copy's pixels per CSS pixel.
     * A screen drawn below `SNAPSHOT_PIXEL_RATIO` (a phone, a tablet, a standard monitor) keeps it
     * for the drag; the one frame saved is drawn at that ratio. Its outline is found and blurred on
     * buffers the screen's size, so it is as wide for the anatomy as on screen: the blur's kernel is
     * fixed, and a thicker one only spreads it fainter.
     *
     * `scale` draws it at that ratio instead, a larger or smaller image of the same frame. A frame past
     * what the device renders is refused before anything is drawn (`snapshot-too-large`).
     */
    captureSnapshot(crop, hostSize, invalidate, { scale: asked } = {}) {
      const { halo, core } = settled;
      const screen = renderer.getPixelRatio();
      const sharper = asked ?? Math.max(screen, SNAPSHOT_PIXEL_RATIO);
      // The composer draws into textures and multisampled renderbuffers the frame's size; three.js
      // sizes the canvas by flooring.
      const gl = renderer.getContext();
      const limit = Math.min(
        gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
        gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      );
      const [frameWidth, frameHeight] = [hostSize.width, hostSize.height].map((side) =>
        Math.floor(side * sharper),
      ) as [number, number];
      const tooLarge = () =>
        Object.assign(
          new RangeError(
            `A ${frameWidth} × ${frameHeight} px frame is past this device’s ${limit} px limit.`,
          ),
          { code: 'snapshot-too-large' },
        );
      if (frameWidth > limit || frameHeight > limit) throw tooLarge();
      const screenSamples = settled.composer.readBuffer.samples;
      const draw = (pixelRatio: number, scale: number, samples: number) => {
        // The mask as a frame at that ratio draws it (RENDER-46), the edges on the screen's buffers.
        scaleOutlines(settled, pixelRatio);
        halo.downSampleRatio = core.downSampleRatio = halo.downSampleRatio * scale;
        setSamples(settled.composer, samples);
        renderer.setPixelRatio(pixelRatio);
        settled.composer.setPixelRatio(pixelRatio);
      };
      if (sharper !== screen) {
        draw(
          sharper,
          sharper / screen,
          msaaSamplesFor(quality.msaaSamples, frameWidth * frameHeight),
        );
      }
      try {
        const source = renderer.domElement;
        // A browser may give the canvas a smaller drawing buffer than asked for, without a word.
        if (gl.drawingBufferWidth !== source.width || gl.drawingBufferHeight !== source.height) {
          throw tooLarge();
        }
        settled.composer.render();
        const ratio = source.width / hostSize.width;
        const [x, y, width, height] = [crop.x, crop.y, crop.width, crop.height].map((value) =>
          Math.round(value * ratio),
        );
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('A 2D canvas context is unavailable for the snapshot.');
        // Read in the same task as the render: the drawing buffer is not preserved past it.
        context.drawImage(source, x, y, width, height, 0, 0, width, height);
        return { canvas, ratio };
      } finally {
        if (sharper !== screen) {
          draw(screen, 1, screenSamples);
          invalidate();
        }
      }
    },

    dispose() {
      for (const { composer } of pipelines) {
        for (const pass of composer.passes) pass.dispose?.();
        composer.dispose();
      }
      renderer.dispose();
      // dispose() frees three.js's objects but not the context; browsers cap live contexts.
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
