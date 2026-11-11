import { tick } from 'svelte';
import { beneathCortex } from '../core/catalog/labels.ts';
import { openingColour } from '../core/catalog/lobes.ts';
import { visibilityOf } from '../core/catalog/visibility.ts';
import type { HiddenReason } from '../core/catalog/visibility.ts';
import { atlasSwitchLabel, t } from '../core/i18n/index.ts';
import { revealNotice, revealSettings } from '../core/panels/clinical.ts';
import {
  captureBeforeInternal,
  insideInternal,
  leaveInternal,
} from '../core/state/internal-mode.ts';
import type { InternalEntry } from '../core/state/internal-mode.ts';
import type { CortexSurface } from '../core/user-map/display.ts';
import type { ReaderState } from '../core/state/reader-state.ts';
import { publishesSpinalCord, requiredAtlas } from '../core/state/scene-commands.ts';
import type { SceneCommands } from '../core/state/scene-commands.ts';
import type { MoveOptions, Vec3 } from '../engine/api.ts';
import type { Explorer } from '../types/index.ts';
import { FOCUS_TARGETS, requestFocus, rescueFocus } from '../ui/focus.ts';
import type { AppContext } from './context.ts';
import type { PreparedDisplay } from '../../features/colophon/display-state.ts';
import type { SceneReader } from './lesson.ts';
import type { UserMapStore } from '../state/user-map.svelte.ts';

/** What choosing a region does to the interface around the stage (app.js:526-532, 718-720). */
export interface SelectionInterface {
  /** The workspace shows the region's detail tab. */
  showDetail(): void;
  /** The phone sheet rises to show it. */
  revealOnSelect(): void;
  dismissHelp(): void;
  /** The workspace shows the explorer's list. */
  showList(): void;
  /**
   * Where the reader is in the detail in front, when replacing it would lose something: a section
   * they opened, or the detail scrolled past its headline. Null otherwise.
   */
  readingPlace(): ReadingPlace | null;
  /** The detail in front again, at that place. */
  restoreReadingPlace(place: ReadingPlace): void;
  /** A new selection: what is open and the scroll from here on are the reader's doing in it. */
  markReadingPlace(): void;
}

/** A place in the detail, put back by a stage click's Undo; open sections keep themselves. */
export interface ReadingPlace {
  scrollTop: number;
}

/**
 * The selection, the dissection and the display commands over the engine and the stores. `commands`
 * is the scene commands, shared with the masthead so one intent token orders them all.
 */
export function createAnatomyCommands(
  { engine, engineState, session, view, catalog }: AppContext,
  {
    commands,
    reader,
    ui,
    chooseExplorer,
    frameLandmark,
    afterReset,
    displayBaseline,
    cortexSurface,
  }: {
    commands: SceneCommands;
    /** The whole scene, held before a reveal changes the reader's settings and put back by its notice. */
    reader: SceneReader;
    ui: SelectionInterface;
    chooseExplorer: (explorer: Explorer) => void;
    /** Frame the open lesson's landmark as its lesson authored it; false when none is open or it has no drawn mesh. */
    frameLandmark: (options: MoveOptions) => boolean;
    /** What the open tab keeps of its own display once a reset has given the opening one. */
    afterReset: () => void;
    /** The display Reset display returns to (`excursions.displayBaseline`). */
    displayBaseline: () => PreparedDisplay;
    /** The surface the cortex is drawn on, which Overlay also sets; no view prepares any but the pial. */
    cortexSurface: Pick<UserMapStore, 'surface' | 'setSurface'>;
  },
) {
  const { model, sections, camera } = engine;
  const hasSpinalCord = publishesSpinalCord(model.manifest);
  // Taken at each of the two doors into internal anatomy, and spent on the way out.
  let beforeInternal: InternalEntry | null = null;
  // The scene before the last reveal that changed the reader's settings, or the last Reset display
  // or Start over,
  // which its notice's Restore puts back; and the region a reveal opened, for which the location bar
  // offers Restore while it is selected.
  // A reset's surface goes with its scene, which links (and so the scene) do not carry.
  let beforeReveal = $state.raw<{
    scene: ReaderState;
    region: string | null;
    surface?: CortexSurface;
  } | null>(null);

  // The region a stage click replaced while the reader was in its detail, and where they were.
  let replaced = $state.raw<{ region: string; by: string; place: ReadingPlace } | null>(null);

  /** Open the tree branch that holds a region, so a selection is never out of sight. */
  function revealInTree(id: string) {
    const group = catalog.groups.find((entry) => entry.rows.some((row) => row.region.id === id));
    if (group && !view.current.expanded.has(group.key)) session.toggleGroup(group.key);
  }

  /**
   * Frame the selected region from where the camera already is (app.js:516-524). A structure the opaque
   * cortex hides is framed with its surroundings and focused, so it shows in its colour through
   * everything ghosted around it.
   */
  function focusSelection({ immediate = false }: MoveOptions = {}) {
    if (frameLandmark({ immediate })) return;
    const id = engineState.model.selectedRegion?.id;
    if (!id) return;
    const { cortexVisible, cortexOpacity, isolatedRegion } = model.settings;
    const hidden = beneathCortex(model.regions.get(id)!) && cortexVisible && cortexOpacity >= 1;
    if (hidden && !isolatedRegion && !model.settings.focused) model.setFocused(true);
    camera.frameRegion(id, { immediate, context: hidden });
  }

  /** The inspector's Focus and the F key: frame the selection drawn alone in its colour, or end that. */
  function toggleFocus({ immediate = false }: MoveOptions = {}) {
    if (model.settings.focused) {
      model.setFocused(false);
      return;
    }
    model.setFocused(true);
    focusSelection({ immediate });
  }

  /**
   * Choose a region, or none. Choosing the one already selected is also a request to read it. The
   * camera moves only for a new pick from the navigator (`frame`): a click on the model is already
   * where the reader is looking, and moving the camera would throw away the orbit they just made.
   */
  function selectRegion(id: string | null, { frame = false }: { frame?: boolean } = {}) {
    const same = id !== null && id === engineState.model.selectedRegion?.id;
    // Any other choice ends a stage click's offer for good.
    if (replaced && id !== replaced.by) replaced = null;
    model.select(id);
    // What is open and where the detail stands now are not the reader's doing in the new region.
    if (!same) ui.markReadingPlace();
    if (id === null) return;
    revealInTree(id);
    ui.showDetail();
    ui.revealOnSelect();
    ui.dismissHelp();
    if (frame && !same) focusSelection();
  }

  /**
   * A click on the model. When it replaces a region the reader had opened a section of, or scrolled
   * into, the notice names that region and offers Undo; a click on a region left at its headline
   * says nothing, since nearly every click replaces a detail.
   */
  function pickRegion(id: string) {
    const previous = engineState.model.selectedRegion?.id ?? null;
    const place = previous !== null && previous !== id ? ui.readingPlace() : null;
    // The last click's offer goes with this action.
    if (replaced) {
      replaced = null;
      session.notify(null);
    }
    selectRegion(id);
    if (!place) return;
    replaced = { region: previous!, by: id, place };
    session.notify({
      kind: 'info',
      text: t(session.state.lang, 'app').pickReplaced(catalog.label(previous!).name),
      action: 'undo-pick',
    });
  }

  /** The notice's Undo: the replaced region back, where it was read, while the click's choice still stands. */
  function undoPick() {
    const undo = replaced;
    replaced = null;
    session.notify(null);
    if (!undo || engineState.model.selectedRegion?.id !== undo.by) return;
    selectRegion(undo.region);
    ui.restoreReadingPlace(undo.place);
  }

  /** Clear the selection; a control that hid itself with it must not leave focus on the page. */
  async function clearSelection(): Promise<boolean> {
    selectRegion(null);
    await tick();
    return rescueFocus(FOCUS_TARGETS.activeTab);
  }

  function notifyClearedSelection(had: { id: string } | null) {
    if (had && !engineState.model.selectedRegion) {
      const name = catalog.label(had.id).name;
      session.notify({ kind: 'info', text: t(session.state.lang, 'app').selectionCleared(name) });
    }
  }

  /** Apply a display change, and say so if it silently dropped the selection (app.js:221-229). */
  function display(change: () => void) {
    const had = engineState.model.selectedRegion;
    // A display change is the reader's next action, which a standing notice lasts until.
    session.notify(null);
    change();
    notifyClearedSelection(had);
  }

  let explodeRequest = 0;
  /**
   * Pull the structures apart, or put them back, framed whole. The hemispheres part along the left–right
   * axis: seen within 45° of it, they would part toward and away from the reader, so exploding turns to
   * the anterior view. A cut shows the anatomy where it lies, so exploding closes it first; a later
   * choice made while it closes wins.
   */
  async function setExploded(value: boolean) {
    const ask = ++explodeRequest;
    if (value && sections.active) await sections.setMode('off');
    if (ask !== explodeRequest) return;
    display(() => {
      model.setExploded(value);
      if (value && Math.abs(camera.view.basis.back[0]) > Math.SQRT1_2) {
        session.setView('anterior');
        camera.applyView('anterior');
      } else {
        camera.frameWhole();
      }
    });
  }

  const hideRegions = (ids: readonly string[]) => display(() => model.hideRegions(ids));
  const showRegions = (ids: readonly string[]) => display(() => model.showRegions(ids));
  const undoDissection = () => display(() => model.undoDissection());
  const restoreHiddenRegions = () => display(() => model.restoreHiddenRegions());

  const isolateSelection = () =>
    display(() => {
      if (engineState.model.isolatedRegion) {
        model.clearIsolation();
        camera.frameWhole();
      } else {
        model.isolate();
        focusSelection();
      }
    });

  /**
   * The inspector's Hide: hand the selection to the dissection and put focus on its Undo, which the
   * selection's own controls no longer offer. False when focus could not be placed.
   */
  /**
   * The detail's Hide. A part the reader chose to hide, said as the tree's eye says it rather than as
   * a lost selection, and the whole view before it (selection, Focus, camera) held for Restore.
   */
  async function hideSelection(): Promise<boolean> {
    const region = engineState.model.selectedRegion;
    if (!region) return false;
    const scene = reader.capture();
    chooseExplorer('anatomy');
    hideRegions([region.id]);
    const { lang } = session.state;
    beforeReveal = { scene, region: null };
    // In place of the cleared-selection notice the hide raised, which would join this one.
    session.notify(null);
    session.notify({
      kind: 'info',
      text: t(lang, 'dissection').partHidden(
        catalog.label(region.id).name,
        t(lang, 'sides').words[region.hemisphere],
      ),
      action: 'restore',
    });
    ui.showList();
    await tick();
    return requestFocus(FOCUS_TARGETS.dissectionUndo, { fallback: FOCUS_TARGETS.treeStop });
  }

  /** The crosshair for a plane with this normal through a point, clamped to the cut's range. */
  function crosshairThrough(
    point: Vec3,
    normal: Vec3,
    [minimum, maximum]: readonly [number, number],
  ) {
    const offset = point[0] * normal[0] + point[1] * normal[1] + point[2] * normal[2];
    if (![offset, minimum, maximum].every(Number.isFinite)) {
      throw new Error('A cut through a point needs finite coordinates and a finite range.');
    }
    const shift = Math.min(maximum, Math.max(minimum, offset)) - offset;
    return [
      point[0] + shift * normal[0],
      point[1] + shift * normal[1],
      point[2] + shift * normal[2],
    ] as Vec3;
  }

  /** Undo whatever is hiding a region, then select it; false once a later command took over. */
  async function reveal(
    reason: HiddenReason,
    id: string,
    current: () => boolean,
  ): Promise<boolean> {
    if (reason === 'removed') model.showRegions([id]);
    if (reason === 'no-mri') await commands.applySurfaceColor('tissue', current);
    if (reason === 'cortex-hidden') {
      model.setCortexVisible(true);
      model.setCortexOpacity(1);
    }
    if (reason === 'internal-hidden') model.setInternalVisible(true);
    if (reason === 'spinal-cord-hidden') await commands.showSpinalCord(true, current);
    if (reason === 'hemisphere') model.setHemisphere('both');
    if (reason === 'isolated') model.clearIsolation();
    // A cut-only region is nowhere until a plane exists. Coronal is the
    // conventional default, and the panel moves it from there.
    if (reason === 'no-cut') {
      await commands.cut('coronal', current);
      const coordinates = model.anchorOf(id);
      if (current() && coordinates && sections.active) {
        sections.setCrosshair(
          crosshairThrough(coordinates, sections.frame.normal, sections.offsetRange),
        );
      }
    }
    if (reason === 'other-detail')
      await commands.loadDetail(model.regions.get(id)!.atlas!, current);
    if (reason === 'other-system') model.setInternalSystem(null);
    if (!current()) return false;
    const region = model.regions.get(id)!;
    if (!model.canSelect(region)) {
      const next = visibilityOf(region, model.settings).reason;
      if (next === reason) throw new Error(`Cannot reveal ${id}: ${next}`);
      return reveal(next!, id, current);
    }
    selectRegion(id);
    return true;
  }

  const settingsNow = () => revealSettings(model.settings, sections.state.cutAtlas);

  /**
   * The navigator's way to show a region that is not on screen, and frame it once it is. What the
   * reveal changed of the reader's own settings is said, with the way back.
   */
  async function revealRegion(reason: HiddenReason, id: string) {
    const current = commands.begin();
    const scene = reader.capture();
    const before = settingsNow();
    try {
      if (!(await reveal(reason, id, current)) || !id) return;
      commands.succeeded('region');
      // What the reveal changed comes first, so its Restore is the notice's action.
      const said = revealNotice(session.state.lang, before, settingsNow());
      if (said) {
        beforeReveal = { scene, region: id };
        session.notify({ kind: 'info', text: said, action: 'restore' });
      }
      focusSelection();
    } catch (error) {
      commands.failIfCurrent(current, 'region', error, undefined, () => {
        void revealRegion(reason, id);
      });
    }
  }

  /**
   * The reveal notice's Restore: the scene from before the reveal, in place of what it said. Held until
   * it lands, so a Restore a later command overtook can be chosen again.
   */
  async function restoreBeforeReveal() {
    if (!beforeReveal) throw new Error('There is no scene from before a reveal to restore.');
    const { scene, surface } = beforeReveal;
    const current = commands.begin();
    const failures = await reader.apply(scene, current);
    if (!current()) return;
    beforeReveal = null;
    if (surface) cortexSurface.setSurface(surface);
    session.notify(null);
    if (failures.length) {
      commands.fail(
        'restore',
        new AggregateError(
          failures.map(({ error }) => error),
          'The scene from before the reveal was not fully restored.',
        ),
      );
    } else {
      session.notify({ kind: 'info', text: t(session.state.lang, 'clinical').stageRestored });
    }
  }

  /** A constituent of an overview structure: show it with its own layers, then frame it. */
  async function openConstituent(id: string) {
    const current = commands.begin();
    try {
      model.setInternalSystem(null);
      if (await commands.openRegion(id, current)) {
        commands.succeeded('region');
        focusSelection();
      }
    } catch (error) {
      commands.failIfCurrent(current, 'region', error, undefined, () => {
        void openConstituent(id);
      });
    }
  }

  async function enterInternal() {
    const current = commands.begin();
    beforeInternal = captureBeforeInternal(model.settings, model.defaultDetail);
    session.setQuery('');
    try {
      await sections.setMode('off');
      if (!current()) return;
      await commands.loadDetail(model.defaultDetail, current);
      if (!current()) return;
    } catch (error) {
      commands.failIfCurrent(current, 'internal', error, undefined, () => {
        void enterInternal();
      });
      return;
    }
    model.setInternalSystem(null);
    model.setCortexVisible(false);
    model.setSurfaceColor('atlas');
    commands.succeeded('internal');
    camera.frameInternal();
  }

  async function leaveInternalAnatomy() {
    const current = commands.begin();
    const changes = leaveInternal(beforeInternal, model.settings, {
      'cab-np': model.cabNp?.atlas,
      lobe: requiredAtlas(model, 'lobe', model.settings.atlas),
    });
    beforeInternal = null;
    session.setQuery('');
    // Both setters release isolation, which would otherwise hold the cortex
    // hidden behind whichever single structure the reader had isolated.
    model.setInternalSystem(changes.internalSystem);
    model.setCortexVisible(changes.cortexVisible);
    try {
      await commands.applySurfaceColor(changes.surfaceColor, current);
      if (current() && changes.detail) await commands.loadDetail(changes.detail, current);
    } catch (error) {
      commands.failIfCurrent(current, 'wholeBrain', error);
    }
    if (!current()) return;
    if (changes.colourLost) {
      const { lang } = session.state;
      session.notify({
        kind: 'info',
        text: t(lang, 'app')[changes.colourLost === 'lobe' ? 'lobesAtlasOnly' : 'cabNpAtlasOnly'](
          atlasSwitchLabel(model.settings.atlas, lang),
        ),
      });
    }
    camera.frameWhole();
  }

  const toggleInternalAnatomy = () =>
    insideInternal(model.settings) ? leaveInternalAnatomy() : enterInternal();

  /** Show one internal system (null: all of them), entering internal anatomy by this second door. */
  async function chooseInternalSystem(system: string | null) {
    const current = commands.begin();
    try {
      if (system === 'Spinal cord' && !(await commands.showSpinalCord(true, current))) return;
      // The other door in must clear the cortex's network legend as well.
      if (!insideInternal(model.settings)) {
        beforeInternal = captureBeforeInternal(model.settings, model.settings.detail);
        model.setSurfaceColor('atlas');
        model.setCortexVisible(false);
      }
      model.setInternalSystem(system);
      session.setQuery('');
      const group = catalog.groups.find((entry) => entry.kind === 'structure');
      if (system && group && !view.current.expanded.has(group.key)) session.toggleGroup(group.key);
      commands.succeeded('system');
      camera.frameInternal();
    } catch (error) {
      commands.failIfCurrent(current, 'system', error, undefined, () => {
        void chooseInternalSystem(system);
      });
    }
  }

  async function setSpinalCordVisible(visible: boolean) {
    if (!hasSpinalCord) {
      session.notify({
        kind: 'info',
        text: t(session.state.lang, 'display').spinalCordUnavailable,
      });
      return;
    }
    const current = commands.begin();
    const had = engineState.model.selectedRegion;
    try {
      if (!(await commands.showSpinalCord(visible, current))) return;
      notifyClearedSelection(had);
      camera.frameWhole();
    } catch (error) {
      commands.failIfCurrent(current, 'cord', error, undefined, () => {
        void setSpinalCordVisible(visible);
      });
    }
  }

  /** The gizmo's Reset view: the opening camera, and nothing the reader built. */
  function resetView() {
    camera.recenter();
    if (!session.setView('oblique')) throw new Error('Unknown view: oblique');
    camera.applyView('oblique');
  }

  /**
   * Start over, from the settings menu: the opening picture (display, cut, camera, and the list),
   * with the scene before it held for the notice's Restore. Not wrapped in `display`, which would
   * announce the cleared selection as a mishap. A command still loading would land over it, so it
   * is overtaken.
   */
  function startOver() {
    commands.begin();
    const scene = reader.capture();
    session.setQuery('');
    void sections.setMode('off');
    model.reset();
    model.setSurfaceColor(openingColour(model.settings.atlas));
    const surface = cortexSurface.surface;
    cortexSurface.setSurface('pial');
    afterReset();
    resetView();
    beforeReveal = { scene, region: null, surface };
    session.notify({
      kind: 'info',
      text: t(session.state.lang, 'display').startedOver,
      action: 'restore',
    });
  }

  /**
   * Display's settings back to the prepared display (a lesson's, else the defaults); the camera, data
   * choices, selection, cut and lesion stay.
   */
  function resetDisplay() {
    commands.begin();
    // Hidden parts, Focus and isolation can be many choices: the notice offers them back.
    const scene = reader.capture();
    const prepared = displayBaseline();
    // No view is prepared exploded; the brain put back together is framed as the toggle frames it.
    const exploded = model.settings.exploded;
    display(() => {
      model.setHemisphere(prepared.hemisphere);
      model.setCortexVisible(prepared.cortexVisible);
      model.setCortexOpacity(prepared.cortexOpacity);
      model.setExploded(false);
      model.setInternalVisible(prepared.internalVisible);
      model.restoreHiddenRegions();
      if (prepared.hiddenRegions.size) model.hideRegions([...prepared.hiddenRegions]);
      model.clearIsolation();
      model.setFocused(prepared.focused && engineState.model.selectedRegion !== null);
    });
    if (exploded) camera.frameWhole();
    const surface = cortexSurface.surface;
    cortexSurface.setSurface('pial');
    afterReset();
    beforeReveal = { scene, region: null, surface };
    session.notify({
      kind: 'info',
      text: t(session.state.lang, 'display').displayReset,
      action: 'restore',
    });
  }

  return {
    selectRegion,
    pickRegion,
    undoPick,
    /** Whether the notice's Undo of a stage click still applies: the click's region is still the selection. */
    get pickUndoable(): boolean {
      return replaced !== null && engineState.model.selectedRegion?.id === replaced.by;
    },
    clearSelection,
    toggleFocus,
    isolateSelection,
    hideSelection,
    hideRegions,
    showRegions,
    undoDissection,
    restoreHiddenRegions,
    revealRegion,
    restoreBeforeReveal,
    /** The region a reveal opened while the scene from before it is held, else null. */
    get revealedRegion(): string | null {
      return beforeReveal?.region ?? null;
    },
    openConstituent,
    toggleInternalAnatomy,
    chooseInternalSystem,
    setHemisphere: (value: Parameters<typeof model.setHemisphere>[0]) =>
      display(() => {
        model.setHemisphere(value);
        camera.frameWhole();
      }),
    setCortexVisible: (value: boolean) => display(() => model.setCortexVisible(value)),
    setCortexOpacity: (value: number) => display(() => model.setCortexOpacity(value)),
    setExploded,
    setCortexSurface: (value: CortexSurface) => display(() => cortexSurface.setSurface(value)),
    setInternalVisible: (value: boolean) => display(() => model.setInternalVisible(value)),
    setSpinalCordVisible,
    resetView,
    startOver,
    resetDisplay,
  };
}

export type AnatomyCommands = ReturnType<typeof createAnatomyCommands>;
