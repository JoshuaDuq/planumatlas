/**
 * The plain data the engine contract (`engine/api.ts`) passes in and out: points, frames, the sections'
 * snapshot, the camera's options, lesion and visual-field values. They sit here, below the engine, so the
 * state and logic modules can name them without importing the engine; `engine/api.ts` re-exports them.
 */
import type { CutMode, ModelState } from './display.ts';
import type { Region } from './region.ts';
import type { Language, LoadProgress } from './session.ts';

export type Vec3 = readonly [number, number, number];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** An error the engine raises with a machine-readable code (`unknown-layer`, `asset-fetch`, `asset-updated`; brain-atlas.js:50, published-assets.js:8). */
export type EngineError = Error & { code?: string };

/** What the camera shows the stage chrome, derived from the camera (viewport-chrome.js:834). */
export interface CameraView {
  /** Anatomical letter at each stage edge (orientation.js:72). */
  edges: Record<'top' | 'right' | 'bottom' | 'left', 'R' | 'L' | 'S' | 'I' | 'P' | 'A'>;
  /** The scale bar in true millimetres, or null while the stage has no size (scale-bar.js:28). */
  scale: { millimetres: number; pixels: number } | null;
  /**
   * The camera's basis squared to the brain's own left–right axis (`anatomicalBasis`): unit vectors toward
   * screen right, screen up and out of the screen.
   */
  basis: { right: Vec3; up: Vec3; back: Vec3 };
}

/** A point on the canvas, in CSS pixels from its top left. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** What the reader sees at a point of the canvas: the region met first there, on its surface or its cut face, and where in RAS mm. */
export interface SeenPoint {
  id: string;
  /** Met on a cut face, which a moved cut carries. */
  face: boolean;
  drawn: Vec3;
}

/** Where the pointer is over the stage, in CSS pixels relative to the canvas (picking.js:93). */
export interface HoverEvent {
  region: Region | null;
  position: { x: number; y: number } | null;
  /** While another atlas's borders are drawn, its region at the point on the shown cortex. */
  borders?: Region | null;
}

/** The stage's measured size and the part of it the interface leaves uncovered (app.js:122). */
export interface ViewportEvent {
  visibleRect: Rect;
  hostSize: Size;
}

/** The model or the sections changed (app.js:2096-2097: both ran the one render). */
export interface DisplayChange {
  model: ModelState;
  sections: SectionsState;
}

export type SpinalCordLoad = 'unloaded' | 'loading' | 'ready' | 'error';

/** A download's progress callback (brain-atlas.js:221). */
export type OnProgress = (progress: LoadProgress | undefined) => void;

export type SectionsStatus = 'idle' | 'loading' | 'ready' | 'error';

/** The code the sections report for a failed cut (sections.js:461). */
export type SectionsErrorCode = 'asset-fetch' | 'asset-updated' | 'cut-failed';

/** `BrainSections.state` (sections.js:55) as a snapshot: each read or `change` gives a fresh, read-only copy. */
export interface SectionsState {
  readonly mode: CutMode;
  readonly cutAtlas: string;
  /** RAS millimetres. */
  readonly crosshair: Vec3;
  readonly reverse: boolean;
  readonly overlay: boolean;
  /** The compared structure the linked MRI shows agreement for, by its code; null for none. */
  readonly agreement: number | null;
  /**
   * The tab's paint the linked MRI draws once its labels have loaded, null for none: its id, which
   * names its colours (a function's atlas and raised threshold too), and the cut atlas whose labels
   * draw it.
   */
  readonly paint: { readonly id: string; readonly atlas: string } | null;
  /** The linked MRI mixes the colours of the stage's cut faces into the scan; the overlay is then off. */
  readonly colours: boolean;
  /**
   * What the cut atlas's labels draw on the linked MRI besides a paint, once loaded: the cut faces'
   * colours and the selection's outline, named so the planes are sampled again when either changes;
   * null for neither.
   */
  readonly labels: string | null;
  readonly tilt: number;
  readonly azimuth: number;
  readonly status: SectionsStatus;
  readonly error: SectionsErrorCode | null;
}

/** Pixels of a sampled square, from its top-left corner; they may reach past the square. */
export interface SliceCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A plane through the volume, in RAS millimetres (coordinates.js:36). */
export interface PlaneFrame {
  center: Vec3;
  normal: Vec3;
  u: Vec3;
  v: Vec3;
  /** Anatomical letters at top, right, bottom, left; empty for an oblique cut. */
  edges: readonly string[];
}

/** The three orthogonal MPR planes (sections.js chrome AXES, ui/chrome/sections.js). */
export type MprPlane = 'sagittal' | 'coronal' | 'axial';

/** The linked MRI's resolution and window once loaded (sections.js:166). */
export interface MriDisplay {
  fieldOfView: number;
  size: number;
  windowCenter: number;
  windowWidth: number;
}

/** A plane as `slice` sampled it: opaque outside the engine, and only given back to `pixels`. */
declare const planeSlice: unique symbol;
export interface PlaneSlice {
  readonly [planeSlice]: true;
}

/** How much the framing keeps clear of the dock, colour keys, markings and an open popover (viewport-chrome.js:263). */
export interface FramingClearance {
  inset: { top?: number; right?: number; bottom?: number; left?: number };
  scale: { horizontal: number; vertical: number };
}

/** The camera pose a reader state keeps and `restoreCamera` puts back. Opaque to everything but the engine (app.js:754-766). */
declare const cameraSnapshot: unique symbol;
export interface CameraSnapshot {
  readonly [cameraSnapshot]: true;
}

export interface MoveOptions {
  /** No eased move: the camera is there this frame. */
  immediate?: boolean;
}

export interface FrameRegionOptions extends MoveOptions {
  /** Frame with a hidden structure's wider context, as a deficit's regions are; a small region otherwise sits in a lobe-sized neighbourhood. */
  context?: boolean;
}

/** Radians; the turn one arrow key makes (keyboard-orbit.js:19). */
export interface OrbitTurn {
  azimuth?: number;
  polar?: number;
}

/** Shares of the canvas height; the pan one Shift+arrow press makes, the model moving right and up. */
export interface OrbitPan {
  right?: number;
  up?: number;
}

/** The phone sheet's cover of the canvas, in CSS pixels (scene.js:488). */
export interface ChromeInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/**
 * How the cover changes: `settle` is the sheet springing to a detent rather than under the finger;
 * `velocity` is that spring's start in whole moves per second (core/spring.ts), so the image rides it.
 */
export interface ChromeMotion {
  settle?: boolean;
  velocity?: number;
}

/**
 * What `render()` pushes to the stage each time the app state changes (app.js:1618-1634). The paint goes
 * through `model.setPaint` (app.js:1613); the engine words the canvas's label and role from `lang` (decision 28).
 */
export interface Presentation {
  lang: Language;
  /** The tract reference is shown alone: the brain and the cut are hidden (app.js:1618-1620). */
  referenceOnly: boolean;
}

/** One loaded bundle, with its length summary at the current minimum (native-viewer.js:116). */
export interface TractBundle {
  id: string;
  catalogId: string;
  name: string;
  label: Readonly<Record<string, string>>;
  file: string;
  visible: boolean;
  total: number;
  shown: number;
  mean: number | null;
  min: number | null;
  max: number | null;
}

/**
 * The drawn streamlines where they pass within `TRACT_SLAB_MM` of a plane, each piece clipped to that
 * slab and laid flat on it.
 */
export interface PlaneTracts {
  /** Per segment, its two ends as (across, up) millimetres from the plane's centre along `u` and `v`. */
  ends: Float32Array;
  /** Per segment, its direction colour: |R|, |A|, |S| of the scanner-space step, 0–255. */
  colors: Uint8Array;
}

/** A spherical lesion: its centre in RAS millimetres and its radius in millimetres. */
export interface LesionSphere {
  centre: Vec3;
  radius: number;
}

/** What a lesion covers of each tissue, in mm³, on the FreeSurfer segmentation. */
export type LesionTissue = Record<'cortex' | 'white' | 'deep' | 'fluid' | 'outside', number>;

export interface LesionMeasurement {
  /** mm³ of the sphere on the label grid. */
  volume: number;
  tissue: LesionTissue;
  /** Every labelled region it reaches, in mm³: how much lies inside and the region's whole size. */
  regions: ReadonlyMap<string, { inside: number; whole: number }>;
  /** Every labelled region's whole size in mm³, reached or not: what a function's territory adds up to. */
  sizes: ReadonlyMap<string, number>;
  /** The tissue at the centre, and the region labelled there, on the FreeSurfer segmentation. */
  centre: { tissue: keyof LesionTissue; region: string | null };
  /** The tissue class of each region it reaches on the FreeSurfer segmentation (aseg and cortex). */
  tissueOf: ReadonlyMap<string, keyof LesionTissue>;
}

/** One tract bundle's streamlines, and how many have a point inside the lesion. */
export interface TractCrossing {
  id: string;
  crossing: number;
  total: number;
}

/** A point of the visual field in degrees from fixation: x to the right, y up. */
export interface VisualFieldPoint {
  x: number;
  y: number;
}

/** The dot the visual-field map draws: its centre and its radius, in degrees. */
export interface VisualFieldDot extends VisualFieldPoint {
  radius: number;
}

/** What the predicted retinotopy says of one point of the cortex. */
export interface VisualFieldReading extends VisualFieldPoint {
  /** The predicted pRF size (Gaussian sigma), in degrees. */
  sigma: number;
  area: 'V1' | 'V2' | 'V3';
  hemisphere: 'left' | 'right';
}

/** One hemisphere's area of the named visual areas (`manifest.retinotopy.visual_areas`), such as LO1. */
export interface NamedVisualArea {
  name: string;
  hemisphere: 'left' | 'right';
}

/** A named visual area's anchor as the stage shows it now: null behind the camera or hidden by the cortex. */
export interface VisualAreaName extends NamedVisualArea {
  point: ScreenPoint | null;
}

/** A snapshot of the settled frame, copied to a 2D canvas (scene.js:555). */
export interface SnapshotCapture {
  canvas: HTMLCanvasElement;
  /** Pixels in the copy per CSS pixel. */
  ratio: number;
}

export interface SnapshotOptions {
  /**
   * Image pixels per CSS pixel of the stage, whatever the screen's ratio. Without it the frame is drawn
   * at the screen's ratio, and at no fewer than two.
   */
  scale?: number;
}
