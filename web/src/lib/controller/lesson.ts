import { beneathCortex } from '../core/catalog/labels.ts';
import type { Circuit, CircuitCatalog, Landmark } from '../core/learning/catalog.ts';
import type { RevealSettings } from '../core/panels/clinical.ts';
import type { ReaderFailure, ReaderState } from '../core/state/reader-state.ts';
import type { SceneCommands } from '../core/state/scene-commands.ts';
import { hemisphereFor } from '../core/learning/visual-field.ts';
import type { Engine, MoveOptions, MprPlane, VisualFieldDot } from '../engine/api.ts';
import type { LessonStore, SessionStore } from '../state/session.svelte.ts';
import type { Explorer } from '../types/index.ts';
import { preparedOf } from '../../features/colophon/display-state.ts';
import type { PreparedDisplay } from '../../features/colophon/display-state.ts';
import { prepareCircuitMri, showCircuitLandmark } from './navigation/learning.ts';

/** Captures and puts back a whole scene (app.js:754-779), which the link restore owns. */
export interface SceneReader {
  capture(): ReaderState;
  apply(target: ReaderState, current: () => boolean): Promise<ReaderFailure[]>;
}

/** What the workspace and the phone sheet do when the controller opens a profile or a list. */
export interface Shell {
  /** The detail in front, and a phone's sheet raised over the stage (app.js:1557-1560). */
  showDetail(): void;
  /** The list in front, the sheet left where it is (workspace.showList). */
  showList(): void;
}

/** The linked MRI dialog (ui/chrome/sections.js:212-237, 585-592). */
export interface MriDialog {
  show(options: { instant: boolean }): void;
  /** Open the dialog on one plane, once the scan is loaded and `canOpen` still holds. */
  openPreparedPlane(plane: MprPlane, canOpen: () => boolean): Promise<void>;
}

/** How much cortex around V1 the visual-field map frames, in millimetres. */
const MAP_CONTEXT_MM = 30;

/**
 * Guided lessons (app.js:1298-1411): a lesson opens over the scene it found, draws and frames its
 * landmarks, and puts the scene back when the reader leaves it. Under a lesson, a landmark's Linked
 * MRI opens the lesson's prepared plane ahead of the plain one.
 */
export function createLessons({
  engine,
  session,
  lesson,
  circuits,
  commands,
  reader,
  shell,
  mri,
  chooseExplorer,
  openMriPanel,
  render,
  prepare,
  stage,
}: {
  engine: Pick<Engine, 'model' | 'sections' | 'camera' | 'visualField'>;
  session: Pick<SessionStore, 'state' | 'setView'>;
  lesson: LessonStore;
  circuits: Pick<CircuitCatalog, 'get' | 'contextMarginMm'>;
  commands: Pick<
    SceneCommands,
    'begin' | 'openRegion' | 'revealRegions' | 'prepareCut' | 'fail' | 'showSpinalCord'
  >;
  reader: SceneReader;
  shell: Shell;
  mri: MriDialog;
  chooseExplorer: (value: Explorer) => void;
  /** The Circuits panel's entry to the lesson's MRI: its busy runner, which calls `openMri` (circuits.js:344). */
  openMriPanel: () => unknown;
  render: () => void;
  /** The display a step or the route set on the stage; null once the lesson is left. */
  prepare: (display: PreparedDisplay | null) => void;
  /** What a step does to the reader's own settings, said in the notice as a deficit's reveal says it. */
  stage: {
    settings: () => RevealSettings;
    /** Says what changed since `before`; false when nothing did. */
    sayChanged: (before: RevealSettings) => boolean;
    sayRestored: () => void;
  };
}) {
  const { model, sections, camera, visualField } = engine;
  // The scene before the open lesson, put back when the reader leaves it. Null for a lesson a link
  // opened on its landmark: that scene is the link's own.
  let beforeLesson: ReaderState | null = null;
  // A step of the open lesson said what it changed, so leaving it says the scene came back.
  let changesSaid = false;
  // The cortex opacity the whole route found, given back when the reader steps on to a landmark.
  let beforeRoute: number | null = null;

  /** The lesson step whose landmark is the selection, while that lesson is the open circuit. */
  function lessonLandmark(): Landmark | null {
    const { circuit, step, route } = lesson.state;
    if (!circuit || route || session.state.explorer !== 'circuits') return null;
    const landmark = circuits.get(circuit).steps[step]!;
    return landmark.region === model.state.selectedRegion?.id ? landmark : null;
  }

  /** A landmark is framed as its lesson authored it: that view, with anatomical context around it. */
  function frameLandmark(step: Landmark, options: MoveOptions = {}): boolean {
    if (!camera.frameLandmark(step.region, step.view, circuits.contextMarginMm, options)) {
      return false;
    }
    session.setView(step.view);
    return true;
  }

  /**
   * Draw, select and frame a lesson's landmark; false once a later command took over. A deep landmark
   * lies inside the internal anatomy drawn around it, so it opens focused, as a hidden pick does.
   */
  async function openLandmark(step: Landmark, current: () => boolean): Promise<boolean> {
    if (!(await commands.openRegion(step.region, current))) return false;
    showCircuitLandmark(model, step);
    model.setFocused(beneathCortex(model.regions.get(step.region)!));
    if (!frameLandmark(step)) throw new Error(`Landmark geometry unavailable: ${step.region}`);
    prepare(preparedOf(model.settings));
    return true;
  }

  /** A lesson's landmark opened as a step the reader took, saying what it changed on the stage. */
  async function stepTo(step: Landmark, current: () => boolean): Promise<boolean> {
    if (beforeRoute !== null) {
      model.setCortexOpacity(beforeRoute);
      beforeRoute = null;
    }
    const before = stage.settings();
    if (!(await openLandmark(step, current))) return false;
    if (stage.sayChanged(before)) changesSaid = true;
    return true;
  }

  /**
   * The whole route at once: nothing selected, no cut, both hemispheres, and the cortex seen through, so
   * the stage's numbered marks at each landmark's anchor in this brain show where it lies. The landmarks'
   * own meshes are not all drawn: their layers (a teaching set, NextBrain, the cord) need not coexist.
   */
  async function showRoute(circuit: Circuit, current: () => boolean): Promise<boolean> {
    const before = stage.settings();
    checkAnchors(circuit);
    await sections.setMode('off');
    if (!current()) return false;
    // The internal anatomy that draws most of its deep landmarks, so they show in colour.
    const structures = circuit.steps
      .map((step) => step.region)
      .filter((id) => model.regions.get(id)!.kind === 'structure');
    if (!(await commands.revealRegions(structures, current))) return false;
    const cord = circuit.steps.some((step) => model.regions.get(step.region)?.atlas === 'pam50');
    if (cord && !(await commands.showSpinalCord(true, current))) return false;
    model.select(null);
    model.clearIsolation();
    model.setHemisphere('both');
    model.showRegions(circuit.steps.flatMap((step) => step.covering_regions ?? []));
    model.setCortexVisible(true);
    seeThroughRoute();
    model.setInternalVisible(true);
    session.setView('oblique');
    camera.applyView('oblique');
    prepare(preparedOf(model.settings));
    if (stage.sayChanged(before)) changesSaid = true;
    return true;
  }

  function checkAnchors(circuit: Circuit) {
    for (const step of circuit.steps) {
      if (!model.anchorOf(step.region)) throw new Error(`Missing landmark anchor: ${step.region}`);
    }
  }

  /** The route's see-through cortex, holding the opacity it found to give back. */
  function seeThroughRoute() {
    beforeRoute ??= model.settings.cortexOpacity;
    model.setCortexOpacity(seeThroughOpacity());
  }

  /**
   * The visual-field map's scene: one hemisphere alone, seen from the midline where V1 lies, uncut,
   * opaque and with nothing selected, so the map the cortex carries is what shows.
   */
  async function showMapSide(hemisphere: 'left' | 'right', current: () => boolean) {
    await sections.setMode('off');
    if (!current()) return false;
    model.select(null);
    model.clearIsolation();
    model.setHemisphere(hemisphere);
    model.setCortexVisible(true);
    model.setCortexOpacity(1);
    model.setInternalVisible(false);
    const view = hemisphere === 'left' ? 'right' : 'left';
    session.setView(view);
    // V1 and the V2 and V3 around it, with the occipital lobe for context.
    const central = visualField.centralRegion(hemisphere);
    if (!camera.frameLandmark(central, view, MAP_CONTEXT_MM)) {
      throw new Error(`The map's central region is not drawn: ${central}`);
    }
    prepare(preparedOf(model.settings));
    return true;
  }

  function seeThroughOpacity() {
    const opacity = model.manifest.appearance.see_through_opacity;
    if (opacity === undefined) throw new Error('This build publishes no see-through opacity.');
    return opacity;
  }

  /** The scene a lesson opens over, unless one is already open and holds it. Focus ends with it. */
  function rememberBeforeLesson() {
    if (!lesson.state.circuit && !lesson.state.map) {
      beforeLesson = reader.capture();
      changesSaid = false;
    }
    if (model.settings.focused) model.setFocused(false);
  }

  /**
   * Leaving a lesson, back to the list or to another tab, ends it and puts back the scene from before
   * it, as a deficit's Restore does. The list stays in front: a restored selection is not a new choice.
   */
  async function leave() {
    const open = lesson.state.circuit || lesson.state.map;
    if (!open || session.state.explorer !== 'circuits') return;
    const before = beforeLesson;
    const said = changesSaid;
    beforeLesson = null;
    changesSaid = false;
    beforeRoute = null;
    prepare(null);
    lesson.close();
    // A deep landmark's Focus is the lesson's; the scene put back has its own.
    if (model.settings.focused) model.setFocused(false);
    render();
    if (!before) return;
    const current = commands.begin();
    const failures = await reader.apply(before, current);
    if (!current()) return;
    shell.showList();
    if (failures.length) {
      commands.fail(
        'restore',
        new AggregateError(
          failures.map(({ error }) => error),
          'The scene from before the lesson was not fully restored.',
        ),
      );
    } else if (said) {
      stage.sayRestored();
    }
    render();
  }

  /** The prepared plane of the lesson's open landmark, centred on this individual's own landmark. */
  async function openLessonMri() {
    const { circuit, step: index, route } = lesson.state;
    if (route) throw new Error('The whole route has no one landmark to open in the MRI.');
    const current = commands.begin();
    const step = circuits.get(circuit!).steps[index]!;
    const canOpen = () => {
      const shown = lesson.state;
      return (
        current() &&
        session.state.explorer === 'circuits' &&
        shown.circuit === circuit &&
        shown.step === index
      );
    };
    await openLandmark(step, current);
    if (!canOpen()) return;
    await commands.prepareCut(current);
    if (!canOpen()) return;
    await prepareCircuitMri(model, sections, step);
    if (!canOpen()) return;
    const faced = camera.faceCut();
    if (faced) {
      session.setView(faced);
      render();
    }
    await mri.openPreparedPlane(step.plane, canOpen);
    render();
  }

  return {
    lessonLandmark,
    openLandmark,
    leave,
    openMri: openLessonMri,

    /**
     * Focus the selection as the open lesson authored it (app.js:510-512): its view, with anatomical
     * context. False when no lesson landmark is selected or it has no drawn mesh, so the caller frames
     * the region as it would any other.
     */
    focusLandmark(options: MoveOptions = {}): boolean {
      const step = lessonLandmark();
      if (!step || !frameLandmark(step, options)) return false;
      render();
      return true;
    },

    /** The scene a lesson holds for its landmark, taken: an excursion that ends the lesson keeps it. */
    takeBeforeLesson(): ReaderState | null {
      const before = beforeLesson;
      beforeLesson = null;
      changesSaid = false;
      beforeRoute = null;
      return before;
    },

    /** A link that opens a lesson on its landmark holds the scene it found, to return to on leaving. */
    holdBeforeLesson() {
      beforeLesson = reader.capture();
    },

    /** The link's scene is the new baseline: nothing from before is held. */
    forgetBeforeLesson() {
      beforeLesson = null;
      beforeRoute = null;
    },

    /**
     * A link's whole route: the link's scene stands, its camera and selection included, and only the
     * cortex is seen through, holding the link's own opacity to give back.
     */
    holdRoute(circuit: Circuit) {
      checkAnchors(circuit);
      seeThroughRoute();
      prepare(preparedOf(model.settings));
    },

    /** The reader's own cortex opacity, while the whole route on screen sees through it. */
    get routeOpacity() {
      return lesson.state.route ? beforeRoute : null;
    },

    /** A circuit opens on its whole route, ahead of its first landmark. */
    async openCircuit(id: string) {
      const current = commands.begin();
      const circuit = circuits.get(id);
      rememberBeforeLesson();
      shell.showDetail();
      if (!(await showRoute(circuit, current))) return;
      lesson.start(id);
      lesson.showRoute();
      render();
      // The route cleared a selection before the lesson began, which returned the panel to the list.
      shell.showDetail();
    },

    /** The visual-field map opens over the scene it found, on the hemisphere that represents the dot. */
    async openMap(dot: VisualFieldDot) {
      const current = commands.begin();
      rememberBeforeLesson();
      shell.showDetail();
      if (!(await showMapSide(hemisphereFor(dot) ?? 'left', current))) return;
      lesson.openMap('visual-field', dot);
      render();
      shell.showDetail();
    },

    /** The open map turns to the other hemisphere, as the dot crosses the vertical meridian. */
    async showMapSide(hemisphere: 'left' | 'right') {
      if (lesson.state.map !== 'visual-field') throw new Error('No visual-field map is open.');
      const current = commands.begin();
      if (!(await showMapSide(hemisphere, current))) return;
      render();
    },

    /** The open lesson goes back to its whole route. */
    async openRoute() {
      const current = commands.begin();
      if (!(await showRoute(circuits.get(lesson.state.circuit!), current))) return;
      lesson.showRoute();
      render();
    },

    /** A lesson opens on one of its landmarks, from another panel's list of related lessons. */
    async openLandmarkOf(id: string, index: number) {
      const current = commands.begin();
      rememberBeforeLesson();
      chooseExplorer('circuits');
      shell.showDetail();
      if (!(await stepTo(circuits.get(id).steps[index]!, current))) return;
      lesson.start(id);
      lesson.go(index);
      render();
    },

    /** The open lesson moves to another landmark. */
    async openStep(index: number) {
      const current = commands.begin();
      const { circuit } = lesson.state;
      const step = circuits.get(circuit!).steps[index];
      if (!step) throw new RangeError(`Invalid landmark index: ${index}`);
      if (!(await stepTo(step, current))) return;
      lesson.go(index);
      render();
      if (session.state.explorer === 'circuits') shell.showDetail();
    },

    /**
     * The Linked MRI. A region's own button (`atRegion`) centres it on that region; under a lesson,
     * on the lesson's landmark, in the plane the lesson authored (app.js:1406-1411).
     */
    async openLinkedMri({ atRegion = false, instant = false } = {}) {
      if (atRegion && lessonLandmark()) {
        openMriPanel();
        return;
      }
      const region = model.state.selectedRegion;
      // The anchor, not the centroid: a curved region's centroid can lie in its neighbour.
      const anchor = region && model.anchorOf(region.id);
      if (anchor) {
        const [x, y, z] = sections.state.crosshair;
        // Not at a region: only a crosshair still at the origin moves to the selection.
        if (atRegion || (Math.abs(x) < 1e-3 && Math.abs(y) < 1e-3 && Math.abs(z) < 1e-3)) {
          sections.setCrosshair(anchor);
        }
      }
      await sections.load();
      mri.show({ instant });
    },
  };
}
