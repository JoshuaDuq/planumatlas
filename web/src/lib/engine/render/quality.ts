import { SLOW_CONNECTIONS } from '../../core/state/boot.ts';
import { detectIntegratedGpu, isCoarse, isPhone, pixelRatioCap } from './device.ts';

/** `navigator.connection` and `deviceMemory` are not in lib.dom. */
interface NavigatorWithHints {
  connection?: { saveData?: boolean; effectiveType?: string };
  deviceMemory?: number;
}

export interface QualityInput {
  phone?: boolean;
  coarse?: boolean;
  saveData?: boolean;
  effectiveType?: string;
  pixelRatio?: number;
  deviceMemory?: number;
  integrated?: boolean;
  appleSilicon?: boolean;
}

export interface QualityProfile {
  mriPixelRatio: number;
  pixelRatio: number;
  /** The highest settled ratio `stepSettledRatio` may reach: a phone's display density, at most 2; else `pixelRatio`. */
  settledCeiling: number;
  motionPixelRatio: number;
  msaaSamples: 2 | 4;
  /** Whether to fetch the other atlas once the reader reaches for the Atlas control, about 13 MB. */
  prefetchLayers: boolean;
  /** Whether to download and build the first cut ahead, about 22 MB on the published anatomy. */
  prefetchCut: boolean;
}

/**
 * How much GPU work this device can take without dropping frames.
 *
 * The anatomy stays full resolution on every device. Only the presentation
 * — pixel ratio, MSAA, what to prefetch — scales.
 * Labels, coordinates and triangle counts do not.
 */
export function qualityProfile(input: QualityInput = {}): QualityProfile {
  const hints = globalThis.navigator as NavigatorWithHints | undefined;
  const phone = input.phone ?? isPhone();
  const coarse = input.coarse ?? isCoarse();
  const saveData = input.saveData ?? Boolean(hints?.connection?.saveData);
  const effectiveType = input.effectiveType ?? hints?.connection?.effectiveType ?? '';
  const pixelRatio = input.pixelRatio ?? globalThis.devicePixelRatio ?? 1;
  const deviceMemory = input.deviceMemory ?? hints?.deviceMemory ?? 8;
  const integrated = input.integrated ?? detectIntegratedGpu();
  const fewerPixels = integrated && !input.appleSilicon;
  const handheld = phone || coarse;
  const constrained = handheld || saveData || deviceMemory <= 4;
  const fillBound = constrained || integrated;
  // A phone starts at one CSS pixel and steps up as its frames allow. Tablets stay at 1.5. The meshes do not change.
  const presentationCap = phone ? 1 : handheld || fewerPixels ? 1.5 : 2;
  const settledRatio =
    input.pixelRatio !== undefined
      ? Math.min(pixelRatio, presentationCap)
      : pixelRatioCap(fewerPixels);
  return {
    mriPixelRatio: pixelRatio,
    pixelRatio: settledRatio,
    // A phone may reach its display's density, but not past the desktop's cap.
    settledCeiling: phone ? Math.min(pixelRatio, 2) : settledRatio,
    // Fill is most of a Retina frame; a picture in motion cannot show the extra pixels anyway.
    motionPixelRatio: Math.min(settledRatio, 1),
    msaaSamples: fillBound ? 2 : 4,
    prefetchLayers: !fillBound,
    // Memory and the connection, not fill: an integrated GPU holds the cut as well as any.
    prefetchCut: !constrained && !SLOW_CONNECTIONS.has(effectiveType),
  };
}

// Device pixels a frame in motion may fill; a 1440×900 window's stage is about 0.9 M at 1×.
const MOTION_PIXEL_BUDGET = 2_000_000;

/** The pixel ratio for a moving camera on a canvas of this CSS size, at most `cap`. */
export function motionRatio(cap: number, width: number, height: number): number {
  if (!width || !height) return cap;
  return Math.round(Math.min(cap, Math.sqrt(MOTION_PIXEL_BUDGET / (width * height))) * 100) / 100;
}

// Past about 4 M device pixels (a 1512×1000 window at 2× is 6 M) the density antialiases what 4× would.
const MSAA_PIXEL_LIMIT = 4_000_000;

/** The MSAA samples for a target of `pixels` device pixels: the device's, but 2 on a large one. */
export function msaaSamplesFor(samples: 2 | 4, pixels: number): 2 | 4 {
  return pixels > MSAA_PIXEL_LIMIT ? 2 : samples;
}

/**
 * The fraction of a frame's size the outline mask is drawn at. At 2× and more the mask is drawn at
 * half resolution, the size OutlinePass finds and blurs the edges at anyway; below it, in full.
 */
export function outlineMaskScale(pixelRatio: number): number {
  return pixelRatio >= 2 ? 0.5 : 1;
}

/** One settled frame: the main thread's submission, and the whole of it until the GPU finished. */
export interface FrameReading {
  cpu: number;
  total: number;
}

/** A phone's settled pixel ratio and what decides its next step. */
export interface SettledStepping {
  ratio: number;
  /** The highest ratio it may step to; lowered for good below a ratio that proved too slow. */
  ceiling: number;
  /** The latest readings at `ratio`, oldest first. */
  readings: readonly FrameReading[];
}

export const SETTLED_STEP = 0.5;
/** Room a settled frame must leave in a 60 Hz refresh, predicted at the next step, to take it. */
export const SETTLED_BUDGET_MS = 12;
/** A settled frame longer than one 60 Hz refresh is too slow. */
export const SETTLED_LIMIT_MS = 1000 / 60;
/** Readings, all within the budget, before a step up. */
export const SETTLED_READINGS = 3;

/** The time a frame read at ratio `from` would take at `to`: only the GPU's part grows with the pixels. */
export function predictedFrameMs({ cpu, total }: FrameReading, from: number, to: number): number {
  return cpu + (total - cpu) * (to / from) ** 2;
}

/**
 * A phone's settled ratio after one more reading. It steps up by `SETTLED_STEP`, at most to the
 * ceiling, once the last `SETTLED_READINGS` readings all predict a frame within `SETTLED_BUDGET_MS` at
 * the next step. Two readings in a row over `SETTLED_LIMIT_MS` step it down, never below 1, and the
 * ratio it left is not tried again. A step clears the readings: they were taken at the old ratio.
 */
export function stepSettledRatio(state: SettledStepping, reading: FrameReading): SettledStepping {
  const readings = [...state.readings, reading].slice(-SETTLED_READINGS);
  const slow = readings.slice(-2).filter(({ total }) => total > SETTLED_LIMIT_MS).length === 2;
  if (slow && state.ratio > 1) {
    const ratio = Math.max(1, state.ratio - SETTLED_STEP);
    return { ratio, ceiling: ratio, readings: [] };
  }
  const next = Math.min(state.ratio + SETTLED_STEP, state.ceiling);
  const roomy =
    readings.length === SETTLED_READINGS &&
    readings.every((each) => predictedFrameMs(each, state.ratio, next) <= SETTLED_BUDGET_MS);
  if (next > state.ratio && roomy) return { ...state, ratio: next, readings: [] };
  return { ...state, readings };
}
