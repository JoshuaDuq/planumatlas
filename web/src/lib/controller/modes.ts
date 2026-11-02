import type { NeuropsychDomains } from '../core/catalog/neuropsych-domains.ts';
import type { ClinicalCatalog } from '../core/clinical/catalog.ts';
import type { Engine } from '../engine/api.ts';
import type { LesionStore } from '../state/lesion.svelte.ts';
import type { SessionStore } from '../state/session.svelte.ts';
import type { Explorer } from '../types/index.ts';

/**
 * The tab in front (app.js:1035-1060). Leaving Tracts gives the cortex back the opacity it had when
 * Tracts opened; opening Tracts on the anatomy that owns the tracts draws them over its own cortex,
 * made see-through if it was opaque, and over every region but the selection in grey.
 */
export function createExplorerChoice({
  engine,
  session,
  lesion,
  anatomy,
  render,
}: {
  engine: Pick<Engine, 'model' | 'tracts'>;
  session: Pick<SessionStore, 'state' | 'setExplorer'>;
  /** The lesion's streamlines belong to its report on Anatomy. */
  lesion: Pick<LesionStore, 'selectedTract' | 'clearTract'>;
  /** The brain on screen. */
  anatomy: () => string;
  render: () => void;
}) {
  let beforeTractsOpacity: number | null = null;
  return {
    /** The Tracts excursion is open: the cortex opacity it will give back is held. */
    get tractsHeld() {
      return beforeTractsOpacity !== null;
    },
    /**
     * A reset gives the opening display, and under Tracts that is the see-through cortex over the
     * tracts, with the reset's opaque cortex the one to give back.
     */
    afterReset() {
      if (beforeTractsOpacity === null) return;
      beforeTractsOpacity = engine.model.settings.cortexOpacity;
      engine.model.setCortexOpacity(engine.tracts.defaultOpacity);
      engine.model.ghostAround([]);
    },
    chooseExplorer(value: Explorer) {
      const previous = session.state.explorer;
      // Before Tracts holds the opacity, so it holds the reader's own.
      if (value !== 'anatomy' && lesion.selectedTract !== null) lesion.clearTract();
      session.setExplorer(value);
      if (previous === 'diffusion' && value !== 'diffusion' && beforeTractsOpacity !== null) {
        const opacity = beforeTractsOpacity;
        beforeTractsOpacity = null;
        engine.tracts.setOverlay(false);
        engine.model.ghostAround(null);
        engine.model.setCortexOpacity(opacity);
      }
      if (
        previous !== 'diffusion' &&
        value === 'diffusion' &&
        anatomy() === engine.tracts.anatomy
      ) {
        beforeTractsOpacity = engine.model.settings.cortexOpacity;
        engine.tracts.setOverlay(true);
        engine.model.ghostAround([]);
        if (engine.model.settings.cortexOpacity === 1) {
          engine.model.setCortexOpacity(engine.tracts.defaultOpacity);
        }
      }
      render();
    },
  };
}

/**
 * A tab chosen during a lesson, or away from Functions and Deficits, waits for the scene from before
 * it to come back; a later choice wins (app.js:1335-1350). Back on Functions or Deficits after that
 * scene came back, or after another tab changed the atlas, the open item's regions are drawn again,
 * so its key never describes a brain that does not carry them.
 */
export function createModes({
  engine,
  session,
  clinical,
  domains,
  chooseExplorer,
  leaveLesson,
  leaveExcursion,
  excursionHeld,
  openFunction,
  openDeficit,
}: {
  engine: Pick<Engine, 'model'>;
  session: Pick<SessionStore, 'state' | 'holdNotices' | 'releaseNotices'>;
  clinical: Pick<ClinicalCatalog, 'mappedRegions'>;
  /** The neuropsychological domains' atlas, and the internal layers that draw their structures. */
  domains: Pick<NeuropsychDomains, 'atlas' | 'structure_atlas' | 'unit_atlas'>;
  chooseExplorer: (value: Explorer) => void;
  leaveLesson: () => Promise<void>;
  /** Puts back the scene from before a function or deficit when the tab chosen is neither. */
  leaveExcursion: (value: Explorer) => Promise<void>;
  /** The scene from before a function or deficit is still held, so the open item is still drawn. */
  excursionHeld: () => boolean;
  /** The panels' entry points (busy state, failure wording), fired and not awaited, as legacy did. */
  openFunction: (id: string) => unknown;
  openDeficit: (id: string) => unknown;
}) {
  let wanted: Explorer | null = null;
  return {
    async chooseMode(value: Explorer) {
      wanted = value;
      const previous = session.state.explorer;
      // What leaving says (the scene put back) outlasts the tab change, which clears a standing notice.
      session.holdNotices();
      try {
        await leaveLesson();
        await leaveExcursion(value);
        if (wanted !== value) return;
        chooseExplorer(value);
      } finally {
        session.releaseNotices();
      }
      const { selectedFunction, selectedDeficit } = session.state;
      const putBack = previous !== value && !excursionHeld();
      const { regions, settings } = engine.model;
      const shownAtlas = settings.atlas;
      const structuresDrawn = [domains.structure_atlas, domains.unit_atlas].includes(
        settings.detail,
      );
      if (
        value === 'functions' &&
        selectedFunction &&
        (putBack || shownAtlas !== domains.atlas || !structuresDrawn)
      ) {
        openFunction(selectedFunction);
      }
      if (
        value === 'deficits' &&
        selectedDeficit &&
        (putBack ||
          clinical.mappedRegions(selectedDeficit).some((id) => {
            const region = regions.get(id)!;
            return region.kind === 'cortex' && region.atlas !== shownAtlas;
          }))
      ) {
        openDeficit(selectedDeficit);
      }
    },
  };
}
