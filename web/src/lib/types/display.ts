import type {
  CUTS,
  FUNCTIONAL_LEVELS,
  HEMISPHERES,
  SURFACE_COLORS,
  VIEW_NAMES,
} from './constants.ts';
import type { Paint } from './paint.ts';
import type { Region } from './region.ts';

export type ViewName = (typeof VIEW_NAMES)[number];
export type CutMode = (typeof CUTS)[number];
export type SurfaceColor = (typeof SURFACE_COLORS)[number];
/** What a paint's key says shows where nothing is painted: tissue, the T1 scan, or a ghost's grey. */
export type KeyGround = 'tissue' | 'scan' | 'grey';
export type FunctionalLevel = (typeof FUNCTIONAL_LEVELS)[number];
export type Hemisphere = (typeof HEMISPHERES)[number];

/** The display settings (`BrainAtlas.settings`, model/brain-atlas.js:480). */
export interface DisplaySettings {
  atlas: string;
  detail: string;
  internalSystem: string | null;
  internalConstituents: ReadonlySet<string>;
  /** Null until the sections module sets it (brain-atlas.js:184). */
  cutAtlas: string | null;
  cutActive: boolean;
  hemisphere: Hemisphere;
  cortexVisible: boolean;
  cortexOpacity: number;
  /** The structures drawn pulled apart, each whole: the hemispheres sideways, the deep anatomy by system. */
  exploded: boolean;
  internalVisible: boolean;
  spinalCordVisible: boolean;
  surfaceColor: SurfaceColor;
  paint: Paint | null;
  isolatedRegion: string | null;
  /** The selection drawn alone in its colour, everything else ghosted in tissue grey. */
  focused: boolean;
  /** The regions a whole route or the Tracts view keeps in colour, the rest a grey ghost; null when neither is in front. */
  ghostedAround: ReadonlySet<string> | null;
  hiddenRegions: ReadonlySet<string>;
  dissectionCanUndo: boolean;
}

/** The model's state (`BrainAtlas.state`, model/brain-atlas.js:501): its settings and what is on screen. */
export interface ModelState extends DisplaySettings {
  selectedRegion: Region | null;
  visibleMeshCount: number;
}
