import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
import { percent } from '../../lib/core/format.ts';
import { t } from '../../lib/core/i18n/index.ts';
import type { CortexSurface } from '../../lib/core/user-map/display.ts';
import type { View } from '../../lib/state/view.svelte.ts';
import type { DisplaySettings } from '../../lib/types/index.ts';

export type DisplayView = Pick<
  View,
  | 'lang'
  | 'explorer'
  | 'anatomy'
  | 'referenceAnatomy'
  | 'hemisphere'
  | 'cortexVisible'
  | 'cortexOpacity'
  | 'exploded'
  | 'internalVisible'
  | 'hiddenRegions'
  | 'isolatedRegion'
  | 'focused'
  | 'selectedRegion'
>;

/** The display a view was prepared with: a lesson's step or route as it set the stage, else the defaults. */
export type PreparedDisplay = Pick<
  DisplaySettings,
  'hemisphere' | 'cortexVisible' | 'cortexOpacity' | 'internalVisible' | 'hiddenRegions' | 'focused'
>;

export const DEFAULT_DISPLAY: PreparedDisplay = {
  hemisphere: 'both',
  cortexVisible: true,
  cortexOpacity: 1,
  internalVisible: true,
  hiddenRegions: new Set(),
  focused: false,
};

export const preparedOf = (settings: PreparedDisplay): PreparedDisplay => ({
  hemisphere: settings.hemisphere,
  cortexVisible: settings.cortexVisible,
  cortexOpacity: settings.cortexOpacity,
  internalVisible: settings.internalVisible,
  hiddenRegions: new Set(settings.hiddenRegions),
  focused: settings.focused,
});

/** Tracts over the anatomy that owns them opens on its see-through cortex, which is its default there. */
export function defaultCortexOpacity(view: DisplayView, prepared: PreparedDisplay): number {
  return view.explorer === 'diffusion' && view.anatomy === view.referenceAnatomy
    ? tractCatalog(view.referenceAnatomy).overlay_cortex_opacity
    : prepared.cortexOpacity;
}

/**
 * The display settings the reader has changed from the prepared display, in the reader's words; empty
 * when none differ. Data choices (atlas, colour, internal anatomy level), the camera, a cut and a lesion
 * are not display. No view prepares a surface other than the pial.
 */
export function displayChanges(
  view: DisplayView,
  prepared: PreparedDisplay,
  surface: CortexSurface,
): string[] {
  const copy = t(view.lang, 'display');
  const changes: string[] = [];
  if (view.hemisphere !== prepared.hemisphere) changes.push(copy.sideShown[view.hemisphere]);
  if (view.cortexVisible !== prepared.cortexVisible) {
    changes.push(view.cortexVisible ? copy.cortexShown : copy.cortexHidden);
  } else if (view.cortexVisible && view.cortexOpacity !== defaultCortexOpacity(view, prepared)) {
    changes.push(copy.cortexAt(percent(view.cortexOpacity, view.lang)));
  }
  if (view.cortexVisible && surface !== 'pial') {
    changes.push(copy.cortexOn(t(view.lang, 'overlay').surfaces[surface]));
  }
  if (view.internalVisible !== prepared.internalVisible) {
    changes.push(view.internalVisible ? copy.internalShown : copy.internalHidden);
  }
  // No view is prepared exploded.
  if (view.exploded) changes.push(copy.explode);
  const hidden = [...view.hiddenRegions].filter((id) => !prepared.hiddenRegions.has(id)).length;
  const shown = [...prepared.hiddenRegions].filter((id) => !view.hiddenRegions.has(id)).length;
  if (hidden) changes.push(t(view.lang, 'dissection').hiddenCount(hidden));
  if (shown) changes.push(copy.shownCount(shown));
  if (view.isolatedRegion) changes.push(copy.regionIsolated);
  // Focus needs a selection: with none, a prepared Focus has simply ended.
  const focusExpected = prepared.focused && view.selectedRegion !== null;
  if (view.focused && !prepared.focused) changes.push(copy.focusOn);
  else if (!view.focused && focusExpected) changes.push(copy.focusOff);
  return changes;
}
