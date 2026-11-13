import { untrack } from 'svelte';
import type { createCatalog } from '../core/catalog/catalog.ts';
import {
  ALL_DOMAINS,
  comparedIds,
  domainAreas,
  domainName,
  domainPaint,
  drawnAs,
  groupedDomains,
  matchingTerms,
  paintAtlas,
  revealedRegions,
} from '../core/catalog/neuropsych-domains.ts';
import { DISORDER_ATLAS } from '../core/catalog/disorder-effects.ts';
import type { NeuropsychDomains } from '../core/catalog/neuropsych-domains.ts';
import type { ClinicalCatalog } from '../core/clinical/catalog.ts';
import { t } from '../core/i18n/index.ts';
import type { CircuitCatalog } from '../core/learning/catalog.ts';
import { revealNotice, revealSettings as settingsOf } from '../core/panels/clinical.ts';
import type { RevealSettings } from '../core/panels/clinical.ts';
import { createInvolvement } from '../core/panels/related.ts';
import type { ReaderState } from '../core/state/reader-state.ts';
import { clinicalLayers } from '../core/state/clinical-navigation.ts';
import type { SceneCommands } from '../core/state/scene-commands.ts';
import type { AppContext } from './context.ts';
import { DEFAULT_DISPLAY } from '../../features/colophon/display-state.ts';
import type { PreparedDisplay } from '../../features/colophon/display-state.ts';
import { createLessons } from './lesson.ts';
import type { MriDialog, SceneReader, Shell } from './lesson.ts';
import type { EngineModel } from '../engine/api.ts';
import type { LesionStore } from '../state/lesion.svelte.ts';
import { visibilityOf } from '../core/catalog/visibility.ts';
import { paintKind } from '../core/state/paint.ts';
import type { StrokeCasesStore } from '../state/stroke-cases.svelte.ts';
import type { ViewStore } from '../state/view.svelte.ts';
import { createExplorerChoice, createModes } from './modes.ts';
import type { Explorer, Language } from '../types/index.ts';

export type { MriDialog, SceneReader, Shell } from './lesson.ts';

/** A strongest region within this many, when the cortex hides it, is worth seeing through to. */
const DEEP_RANKS = 5;

/** What the controller reaches outside the stores and the engine for. */
export interface ExcursionDeps {
  /** The core anatomy catalog: a region's label in the language the view shows. */
  anatomy: Pick<ReturnType<typeof createCatalog>, 'get'>;
  domains: NeuropsychDomains;
  clinical: ClinicalCatalog;
  circuits: CircuitCatalog;
  commands: Pick<
    SceneCommands,
    | 'begin'
    | 'fail'
    | 'revealRegions'
    | 'openRegion'
    | 'prepareCut'
    | 'showSpinalCord'
    | 'chooseAtlas'
    | 'chooseSurfaceColor'
  >;
  reader: SceneReader;
  shell: Shell;
  mri: MriDialog;
  /**
   * The panels' entry points, which run a command under their latest-wins or busy runner, scroll and
   * focus the profile, and word a failure (functions.js:157, clinical.js:276, circuits.js:260). Each
   * calls back into this controller. Fired and not awaited, as legacy did.
   */
  panels: {
    openFunction: (id: string) => unknown;
    openDeficit: (id: string) => unknown;
    /** The lesson's Linked MRI: runs `openMri`. */
    openMri: () => unknown;
  };
  /** Apply pending state to the page: the legacy `render()`. Framing reads the page it has drawn. */
  render: () => void;
  lesion: Pick<LesionStore, 'selectedTract' | 'clearTract' | 'heldOpacity'>;
  strokeCases: Pick<StrokeCasesStore, 'chosen' | 'show' | 'clear' | 'heldOpacity' | 'heldColor'>;
}

/**
 * Excursions, lessons and tabs (app.js:822-1102, 1298-1411): the commands that take the reader out
 * of the scene they were in, and bring them back. Create it in a component, beside the stores.
 */
export function createExcursions(
  ctx: Pick<AppContext, 'engine' | 'session' | 'lesson' | 'view'>,
  {
    anatomy,
    domains,
    clinical,
    circuits,
    commands,
    reader,
    shell,
    mri,
    panels,
    render,
    lesion,
    strokeCases,
  }: ExcursionDeps,
) {
  const { engine, session, lesson, view } = ctx;
  const { model, sections, camera } = engine;

  /**
   * How many drawn structures a function or deficit paints beneath the cortical areas it paints; 0
   * for a paint with only one of them. The profile offers to hide the cortex for them: seen through,
   * its areas' colours would blend with what lies behind and no longer read as the key says.
   */
  const beneath = $derived.by(() => {
    const state = view.current;
    if (!state.paint || !['function', 'deficit'].includes(paintKind(state.paint)!)) return 0;
    const painted = [...state.paint.colors.keys()].map((id) => model.regions.get(id)!);
    if (!painted.some((region) => region.kind === 'cortex')) return 0;
    return painted.filter(
      (region) => region.kind === 'structure' && visibilityOf(region, state).visible,
    ).length;
  });
  if (model.domains?.atlas !== domains.atlas) {
    throw new Error('The model publishes no neuropsychological domains for the Functions tab.');
  }

  // The scene before this excursion's first function or deficit. Kept until it is restored or the
  // function or deficit closes, so Restore returns there whatever was changed since, as its label says.
  let beforeExcursion = $state.raw<ReaderState | null>(null);
  // The tab that scene was shown in, which Restore returns to with it.
  let excursionOrigin: Explorer | null = null;
  // The stroke cases that scene showed. The excursion clears them, giving back the display they found,
  // and Restore draws them again over it.
  let casesBefore: readonly string[] = [];
  // The display the open lesson's step or route set on the stage, which its readout and reset start from.
  let lessonDisplay = $state.raw<PreparedDisplay | null>(null);

  const explorerChoice = createExplorerChoice({
    engine,
    session,
    lesion,
    anatomy: () => view.current.anatomy,
    render,
  });
  const { chooseExplorer } = explorerChoice;
  const lessons = createLessons({
    engine,
    session,
    lesson,
    circuits,
    commands,
    reader,
    shell,
    mri,
    chooseExplorer,
    openMriPanel: panels.openMri,
    render,
    prepare: (display) => (lessonDisplay = display),
    stage: {
      settings: revealSettings,
      sayChanged: (before) => sayRevealed(before),
      // What the lesson said it changed is undone, so the confirmation replaces it rather than joining it.
      sayRestored: () => {
        session.notify(null);
        session.notify({ kind: 'info', text: t(lang(), 'clinical').stageRestored });
      },
    },
  });
  const modes = createModes({
    engine,
    session,
    clinical,
    domains,
    chooseExplorer,
    leaveLesson: lessons.leave,
    leaveExcursion,
    excursionHeld: () => beforeExcursion !== null,
    openFunction: panels.openFunction,
    openDeficit: panels.openDeficit,
  });

  const seeThroughOpacity = () => {
    const opacity = model.manifest.appearance.see_through_opacity;
    if (opacity === undefined) throw new Error('This build publishes no see-through opacity.');
    return opacity;
  };
  const lang = (): Language => session.state.lang;

  /** A failure a newer deploy causes also needs the notice's Reload; panels word their own. */
  function offerReload(error: unknown) {
    if ((error as { code?: string } | null)?.code === 'asset-updated') {
      commands.fail('landmark', error);
    }
  }

  /** The scene an excursion leaves, and its tab, held once: later steps of the excursion keep the first. */
  function holdBeforeExcursion(fromLesson: ReaderState | null = null) {
    if (beforeExcursion) return;
    const scene = fromLesson ?? reader.capture();
    excursionOrigin = fromLesson ? 'circuits' : session.state.explorer;
    casesBefore = fromLesson ? [] : [...strokeCases.chosen];
    // Restore draws the cases again over the display they found, not the one they hold.
    beforeExcursion = casesBefore.length
      ? {
          ...scene,
          cortexOpacity: strokeCases.heldOpacity ?? scene.cortexOpacity,
          surfaceColor: strokeCases.heldColor ?? scene.surfaceColor,
        }
      : scene;
    // Not left to the selection's clearing: an excursion that keeps the selection would keep them.
    if (casesBefore.length) strokeCases.clear();
  }

  /** A function or deficit ends Focus, once the scene Restore returns to has it. */
  function leaveForPaint() {
    holdBeforeExcursion(lessons.takeBeforeLesson());
    lesson.close();
    if (model.settings.focused) model.setFocused(false);
  }

  /**
   * Put back the scene from before the first function or deficit, unpainted, in the tab it was shown
   * in; false when a later command overtook it.
   */
  async function restoreBeforeExcursion(): Promise<boolean> {
    if (!beforeExcursion) throw new Error('There is no scene from before an excursion to restore.');
    const current = commands.begin();
    const excursion = session.state.explorer;
    // The tab first, so one that holds a display of its own (Tracts' cortex) holds the reader's.
    if (excursionOrigin && excursionOrigin !== excursion) chooseExplorer(excursionOrigin);
    const failures = await reader.apply(beforeExcursion, current);
    if (!current()) return false;
    if (failures.length) {
      for (const { error } of failures) console.error(error);
      throw new AggregateError(
        failures.map(({ error }) => error),
        'The previous view was not fully restored.',
      );
    }
    beforeExcursion = null;
    excursionOrigin = null;
    // The function or deficit in front opened the excursion, so the view from before it has it closed.
    if (excursion === 'functions') session.setFunction(null);
    else session.setDeficit(null);
    if (casesBefore.length) strokeCases.show(casesBefore);
    session.notify({ kind: 'info', text: t(lang(), 'clinical').stageRestored });
    render();
    return true;
  }

  /**
   * Another tab than Functions or Deficits ends the excursion as leaving a lesson does: the scene from
   * before it comes back, and the open function or deficit stays, drawn again on the way back. The
   * chosen tab opens on its list: the selection that comes back with the scene opens no detail.
   */
  async function leaveExcursion(value: Explorer): Promise<void> {
    const from = session.state.explorer;
    if (!beforeExcursion || from === value) return;
    if (from !== 'functions' && from !== 'deficits') return;
    if (value === 'functions' || value === 'deficits') return;
    await putBack();
  }

  /**
   * The scene from before the excursion, back in the tab in front, which opens on its list. Held until
   * it lands, as Restore holds it, so one a later command overtook can still be restored.
   */
  async function putBack(): Promise<void> {
    const current = commands.begin();
    const failures = await reader.apply(beforeExcursion!, current);
    if (!current()) return;
    beforeExcursion = null;
    excursionOrigin = null;
    if (casesBefore.length) strokeCases.show(casesBefore);
    // Drawn first, so the workspace has drilled into the restored selection before the list replaces it.
    render();
    shell.showList();
    if (failures.length) {
      commands.fail(
        'restore',
        new AggregateError(
          failures.map(({ error }) => error),
          'The scene from before the excursion was not fully restored.',
        ),
      );
      return;
    }
    session.notify({ kind: 'info', text: t(lang(), 'clinical').stageRestored });
  }

  /**
   * Closing a deficit or function ends its excursion as leaving its tab does: the scene from before
   * it, with the reader's own atlas, colour and selection, comes back.
   */
  async function closeDeficit(): Promise<void> {
    session.setDeficit(null);
    if (beforeExcursion) return putBack();
    render();
  }

  async function closeFunction(): Promise<void> {
    session.setFunction(null);
    if (beforeExcursion) return putBack();
    render();
  }

  function revealSettings(): RevealSettings {
    return settingsOf(model.settings, sections.state.cutAtlas);
  }

  /**
   * A paint names regions of the surface atlas, and a cut face can only take a colour its own labels
   * carry, so the cut is labelled by that atlas too where one is published. The reveal has closed
   * any cut, so this downloads nothing.
   */
  function cutLabelsFollowAtlas() {
    const { atlas } = model.settings;
    if (!model.manifest.cut_atlases?.some((entry) => entry.id === atlas)) return;
    void sections.setCutAtlas(atlas);
  }

  /**
   * What a reveal changed, what of it the framing cannot show, and any hint about seeing what it
   * revealed, as one notice; false when there was nothing to say.
   */
  function sayRevealed(before: RevealSettings, unseen: string | null = null): boolean {
    const said = revealNotice(lang(), before, revealSettings());
    if (!said && !unseen) return false;
    session.notify({ kind: 'info', text: [said, unseen].filter(Boolean).join(' '), action: null });
    return true;
  }

  /** Coloured cortical regions the framing could not show, each name once with its sides. */
  function unseenNotice(ids: readonly string[]): string | null {
    if (!ids.length) return null;
    const list = new Intl.ListFormat(lang(), { type: 'conjunction' });
    const sides = new Map<string, string[]>();
    for (const id of ids) {
      const name = anatomy.get(id)!.label.name;
      const side = t(lang(), 'sides').words[model.regions.get(id)!.hemisphere];
      sides.set(name, [...(sides.get(name) ?? []), side]);
    }
    const items = [...sides].map(
      ([name, side]) =>
        `${name.charAt(0).toLocaleUpperCase(lang())}${name.slice(1)} (${list.format(side)})`,
    );
    return t(lang(), 'clinical').unseen(list.format(items));
  }

  /**
   * The profile opens at once; the mapped regions are then drawn together and framed once, on the
   * internal anatomy drawing most of them, each FreeSurfer structure by its teaching-set stand-ins
   * unless FreeSurfer's segmentation is that anatomy.
   */
  async function openDeficit(id: string): Promise<boolean> {
    const current = commands.begin();
    const mapped = clinical.mappedRegions(id);
    const drawnOn = (detail: string) => [
      ...new Set(mapped.flatMap((region) => clinical.drawnAs(region, detail))),
    ];
    const { detail } = clinicalLayers(model, drawnOn(model.settings.detail));
    const regions = drawnOn(detail ?? model.settings.detail);
    // Before the detail opens: on a phone, raising the sheet reframes the camera. A lesson it is
    // opened from ends here and hands over the scene from before it, for Restore to return to.
    leaveForPaint();
    session.setDeficit(id);
    chooseExplorer('deficits');
    render();
    shell.showDetail();
    const before = revealSettings();
    if (!(await commands.revealRegions(regions, current))) return false;
    cutLabelsFollowAtlas();
    // Drawn first, so the framing measures the key this paint brings.
    render();
    const unseen = camera.frameRegions(regions);
    sayRevealed(before, unseenNotice(unseen));
    render();
    return true;
  }

  /**
   * The profile opens at once; the function's HCP-MMP areas and its structures, on the teaching set
   * unless FreeSurfer's segmentation is shown, are then drawn and framed, and painted by the paint effect.
   */
  async function openFunction(id: string): Promise<boolean> {
    const current = commands.begin();
    leaveForPaint();
    session.setFunction(id);
    chooseExplorer('functions');
    render();
    shell.showDetail();
    const before = revealSettings();
    // The reader's own atlas where the function was measured on it; otherwise HCP-MMP is borrowed.
    const atlas = paintAtlas(domains, id, model.settings.atlas);
    const regions = revealedRegions(
      domains,
      domainPaint(domains, id, atlas),
      model.settings.detail,
    );
    if (!(await commands.revealRegions(regions, current))) return false;
    cutLabelsFollowAtlas();
    // A function's map spans the cortex, so the whole brain is framed, clear of the key it brings,
    // from a view that shows its strongest areas; those no view shows are said, as a deficit's are.
    render();
    const unseen = camera.frameWhole(
      id === ALL_DOMAINS
        ? []
        : (comparedIds(id) ?? [id]).flatMap((member) =>
            domainAreas(domains, member, atlas)
              .slice(0, DEEP_RANKS)
              .map(({ region }) => region),
          ),
    );
    sayRevealed(before, unseenNotice(unseen));
    render();
    return true;
  }

  /**
   * The atlas is then the reader's own: closing the excursion no longer replaces it. An atlas the
   * open function was measured on takes its paint; any other holds none of its areas, so the paint lifts.
   */
  function chooseAtlas(id: string) {
    const open = session.state.explorer === 'functions' ? session.state.selectedFunction : null;
    if (!open || paintAtlas(domains, open, id) !== id) session.liftPaint();
    // A connectivity paint names the areas of the atlas it was asked on; a disorder's lie on Desikan-Killiany.
    if (id !== model.settings.atlas) session.setConnectivitySeed(null);
    if (id !== DISORDER_ATLAS) session.setDisorderShown(null);
    beforeExcursion = null;
    excursionOrigin = null;
    render();
    return commands.chooseAtlas(id);
  }

  /** Hides the cortex to frame the structures a paint colours beneath it, or brings it back. */
  function showBeneathCortex(hidden: boolean) {
    model.setCortexVisible(!hidden);
    render();
    if (hidden) camera.frameInternal();
    else camera.frameWhole();
    render();
  }

  /**
   * The Linked MRI centred on the first of a paint's `regions` that has an anchor, with the paint drawn
   * over the scan; with none, it opens where the crosshair is.
   */
  async function openPaintMri(regions: readonly string[], instant: boolean): Promise<void> {
    // The anchor, not the centroid: a curved region's centroid can lie in its neighbour.
    const anchor = regions.map((region) => model.anchorOf(region)).find(Boolean);
    if (anchor) sections.setCrosshair(anchor);
    await sections.load();
    mri.show({ instant });
  }

  /** A function's Linked MRI, at its strongest area; the overview has no one area. */
  async function openFunctionMri(id: string, { instant }: { instant: boolean }): Promise<void> {
    const ranked =
      id === ALL_DOMAINS
        ? []
        : (comparedIds(id) ?? [id]).flatMap((member) =>
            domainAreas(domains, member, paintAtlas(domains, id, model.settings.atlas)).map(
              ({ region }) => region,
            ),
          );
    return openPaintMri(ranked, instant);
  }

  /** A deficit's Linked MRI, at its first finding's first region, or `finding`'s. */
  async function openDeficitMri(
    id: string,
    finding: string | null,
    { instant }: { instant: boolean },
  ): Promise<void> {
    const { colors } = clinical.paint(id, finding).paint;
    const detail = model.settings.detail;
    return openPaintMri(
      [...colors.keys()].flatMap((region) => clinical.drawnAs(region, detail)),
      instant,
    );
  }

  /** A region a function or deficit names: drawn, selected and framed, as an excursion step. */
  async function openListedRegion(id: string): Promise<boolean> {
    const current = commands.begin();
    holdBeforeExcursion();
    const before = revealSettings();
    // A function's or deficit's structure is drawn where its paint is.
    const shown =
      session.state.explorer === 'functions'
        ? drawnAs(domains, id, model.settings.detail)
        : clinical.drawnAs(id, model.settings.detail);
    if (!(await commands.revealRegions(shown, current))) return false;
    model.select(shown[0]!);
    // With the context around it a deficit's regions get, not filling the stage on its own.
    render();
    const unseen = camera.frameRegions(shown);
    // The profile's notice spoke of its own view: this one is said, or that one goes.
    if (!sayRevealed(before, unseenNotice(unseen))) session.notify(null);
    render();
    return true;
  }

  /** A stage key row: one function, or one finding, alone; null returns to all of them. */
  function pickPaint(id: string | null) {
    if (session.state.explorer === 'functions') {
      panels.openFunction(id ?? ALL_DOMAINS);
      return;
    }
    session.setFinding(id);
    render();
  }

  /** A search carried to the other evidence tab opens that tab's list on the same words. */
  function searchIn(mode: 'functions' | 'deficits', query: string): Promise<void> {
    if (mode === 'functions') {
      session.setFunction(null);
      session.setFunctionQuery(query);
    } else {
      session.setDeficit(null);
      session.setClinicalQuery(query);
    }
    beforeExcursion = null;
    excursionOrigin = null;
    return modes.chooseMode(mode);
  }

  const lesionChecks = domains.lesion_checks as Record<string, { deficit: string }[]>;

  return {
    /** Whether the scene from before this excursion's first function or deficit can be put back. */
    get restorable() {
      return beforeExcursion !== null;
    },
    /** The reader's own atlas, which closing the excursion's function or deficit puts back. */
    get heldAtlas() {
      return beforeExcursion?.atlas ?? null;
    },
    /** The tracts are drawn, holding the cortex opacity they will give back. */
    get tractsHeld() {
      return explorerChoice.tractsHeld;
    },
    keepTracts: explorerChoice.keepTracts,
    afterReset: explorerChoice.afterReset,
    /**
     * The display the stage was prepared with, which the reader's changes are counted from and Reset
     * display returns to: the open lesson's, else the defaults; a lesion's drawn bundle sees through
     * the cortex. Tracts' own see-through cortex is `afterReset`'s.
     */
    get displayBaseline(): PreparedDisplay {
      const open = lessonDisplay && lesson.state.circuit && session.state.explorer === 'circuits';
      const prepared = open ? lessonDisplay! : DEFAULT_DISPLAY;
      const held = lesion.heldOpacity !== null;
      return held && prepared.cortexVisible
        ? { ...prepared, cortexOpacity: seeThroughOpacity() }
        : prepared;
    },
    /** The regions a selection shares anatomy with (related lessons and evidence). */
    involved: createInvolvement(model.regions),

    chooseExplorer,
    chooseMode: modes.chooseMode,
    searchIn,

    restoreBeforeExcursion,
    closeDeficit,
    closeFunction,
    openDeficit,
    openFunction,
    /** The structures the paint colours beneath its cortex and whether it is hidden; null for none. */
    get beneath(): { count: number; hidden: boolean } | null {
      return beneath ? { count: beneath, hidden: !view.current.cortexVisible } : null;
    },
    showBeneathCortex,
    openFunctionMri,
    openDeficitMri,
    openListedRegion,
    pickPaint,
    offerReload,

    chooseAtlas,
    /**
     * Paints a disorder's differences on Desikan-Killiany, the atlas they are reported on, choosing it.
     * The deep structure it was asked from stays selected across the switch, which clears a selection;
     * an atlas that fails to load paints nothing.
     */
    async showDisorder(id: string) {
      if (model.settings.atlas !== DISORDER_ATLAS) {
        const selected = model.state.selectedRegion?.id ?? null;
        await chooseAtlas(DISORDER_ATLAS);
        if (model.settings.atlas !== DISORDER_ATLAS) return;
        if (selected) model.select(selected);
      }
      session.setDisorderShown(id);
      render();
    },
    /**
     * The cut's label volume (app.js:564), from the navigator's "switch cut atlas". The cortical surface
     * is untouched. A download can be overtaken by closing the cut, so the rejection reaches the caller,
     * which reports it.
     */
    setCutAtlas: (id: string) => sections.setCutAtlas(id),
    chooseSurfaceColor(value: Parameters<typeof commands.chooseSurfaceColor>[0]) {
      session.liftPaint();
      return commands.chooseSurfaceColor(value);
    },

    /** The curated functions whose lesion checks cite one of a deficit's associations, as the deficit lists them. */
    checkedMaps: (deficit: string, language: Language) =>
      domains.domains
        .filter((domain) => lesionChecks[domain.id]!.some((check) => check.deficit === deficit))
        .map((domain) => ({
          id: domain.id,
          name: domainName(domain, language),
          color: domain.color,
        })),
    /** How many functions and Neurosynth terms the Functions tab finds for the same words. */
    functionsMatching: (query: string, language: Language) =>
      matchingTerms(domains, query).length +
      groupedDomains(domains, query, language).reduce(
        (sum, entry) => sum + entry.domains.length,
        0,
      ),
    /** How many deficits the Deficits tab finds for the same words. */
    deficitsMatching: (query: string, language: Language) =>
      clinical.search(query, language).length,

    lessonLandmark: lessons.lessonLandmark,
    openCircuit: lessons.openCircuit,
    openMap: lessons.openMap,
    showMapScene: lessons.showMapScene,
    openLessonLandmark: lessons.openLandmarkOf,
    openLessonStep: lessons.openStep,
    openLessonRoute: lessons.openRoute,
    openLinkedMri: lessons.openLinkedMri,
    openLessonMri: lessons.openMri,
    focusLandmark: lessons.focusLandmark,
    leaveLesson: lessons.leave,
    openLandmark: lessons.openLandmark,
    holdRoute: lessons.holdRoute,
    holdBeforeLesson: lessons.holdBeforeLesson,
    get routeOpacity() {
      return lessons.routeOpacity;
    },

    /** A link's scene is the new baseline: no excursion or lesson has anything to go back to. */
    forget() {
      beforeExcursion = null;
      excursionOrigin = null;
      lessons.forgetBeforeLesson();
    },
  };
}

export type Excursions = ReturnType<typeof createExcursions>;

/** A whole route in front greys all but its landmarks and covering regions, however it leaves. */
export function syncRouteGhost(
  model: Pick<EngineModel, 'ghostAround' | 'settings'>,
  view: ViewStore,
  circuits: Pick<CircuitCatalog, 'get'>,
) {
  let shown: string | null = null;
  // The ghost the route set, so ending it never ends one Tracts has set since.
  let ghost: ReadonlySet<string> | null = null;
  $effect(() => {
    const { explorer, lesson } = view.current;
    const route = explorer === 'circuits' && lesson.route ? lesson.circuit : null;
    if (route === shown) return;
    shown = route;
    untrack(() => {
      if (route) {
        const { steps } = circuits.get(route);
        model.ghostAround(steps.flatMap((step) => [step.region, ...(step.covering_regions ?? [])]));
        ghost = model.settings.ghostedAround;
        return;
      }
      if (ghost && model.settings.ghostedAround === ghost) model.ghostAround(null);
      ghost = null;
    });
  });
}
