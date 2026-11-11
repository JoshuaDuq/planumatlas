import type { LESION_MODES } from './constants.ts';
import type { CutMode, Hemisphere, SurfaceColor } from './display.ts';
import type { Region } from './region.ts';
import type { Explorer, Language } from './session.ts';

/** Camera position, target and optional up vector, in millimetres (state/url-state.js:96). */
export interface Orbit {
  position: [number, number, number];
  target: [number, number, number];
  up?: [number, number, number];
}

/** A placed lesion: its centre in RAS millimetres, to a tenth, and its radius in millimetres. */
export interface LinkLesion {
  centre: [number, number, number];
  radius: number;
}

/** MRI level and window over the scan's uint8 intensities. */
export interface MriWindow {
  center: number;
  width: number;
}

/**
 * The shareable state `decodeState` returns (state/url-state.js:220), as a `Partial`:
 * a field a link omits is absent. `DEFAULTS` (state/url-state.js:8) lists the values
 * encoding leaves out.
 */
export interface LinkState {
  hemisphere: Hemisphere;
  cortexVisible: boolean;
  cortexOpacity: number;
  exploded: boolean;
  internalVisible: boolean;
  spinalCordVisible: boolean;
  surfaceColor: SurfaceColor;
  view: string;
  cut: CutMode;
  cutOffset: number;
  cutReverse: boolean;
  cutTilt: number;
  cutAzimuth: number;
  selectedRegion: string | null;
  isolatedRegion: string | null;
  focused: boolean;
  internalSystem: string | null;
  anatomy: string | null;
  atlas: string;
  cutAtlas: string;
  detail: string;
  explorer: Explorer;
  selectedFunction: string | null;
  /** A raised paint threshold for the open function, or null for the published one. */
  paintFrom: number | null;
  selectedDeficit: string | null;
  circuit: string | null;
  circuitStep: number;
  /** The circuit's whole route is shown, ahead of the step it keeps for the way back in. */
  circuitRoute: boolean;
  /** An interactive map open in the Circuits tab in place of a lesson, and its dot in degrees. */
  circuitMap: string | null;
  mapDot: { x: number; y: number; radius: number } | null;
  orbit: Orbit | null;
  mriWindow: MriWindow | null;
  lang: Language;
  hiddenRegions: string[];
  lesion: LinkLesion | null;
  lesionMode: (typeof LESION_MODES)[number];
  /** The tract bundle whose streamlines through the lesion are drawn. */
  lesionTract: string | null;
  /** A published coordinate the sphere marks, as entered, in the space `coordinateSpace` names. */
  coordinate: [number, number, number] | null;
  /** A published coordinate space's id, or `unstated`. */
  coordinateSpace: string | null;
  /** The stroke cases on the stage: one person, or two compared, first first. */
  strokeCases: string[] | null;
  /** The bundles ticked on the Tracts tab, in catalog order; null for the catalog's initial ones. */
  tracts: string[] | null;
  /** The ticked bundles stay drawn outside the Tracts tab. */
  keepTracts: boolean;
}

/**
 * What `encodeState` takes (state/url-state.js:201; app.js:1773 spreads `model.state`):
 * the selected region may be the model's record, and the hidden regions are a set,
 * since `encodeState` reads `.size`.
 */
export interface LinkInput extends Omit<LinkState, 'selectedRegion' | 'hiddenRegions'> {
  selectedRegion: Region | string | null;
  hiddenRegions: ReadonlySet<string>;
}
