import assert from 'node:assert/strict';
import { describe, expect, test, vi } from 'vitest';
import { createScene, sceneBefore } from './excursion-test-support.ts';
import type { Scene } from './excursion-test-support.ts';

const firstCircuit = (scene: Scene) => scene.circuits.all[0]!;
const vision = (scene: Scene) => scene.circuits.get('vision');
const stepOf = (scene: Scene, id: string) =>
  vision(scene).steps.findIndex((step) => step.id === id);

/** A circuit opened on its whole route, then stepped on to its first landmark. */
async function onFirstLandmark(scene: Scene, id = firstCircuit(scene).id) {
  await scene.excursions.openCircuit(id);
  await scene.excursions.openLessonStep(0);
}

describe('opening a lesson', () => {
  test('the corticospinal tour reveals the spinal cord before selecting its final right-sided landmark', async () => {
    const scene = createScene();
    const circuit = scene.circuits.get('corticospinal');
    assert.equal(scene.engine.model.state.spinalCordVisible, false);
    scene.session.setExplorer('circuits');
    await scene.excursions.openCircuit(circuit.id);
    for (let index = 1; index < circuit.steps.length; index++) {
      await scene.excursions.openLessonStep(index);
    }
    assert.equal(scene.lesson.state.step, circuit.steps.length - 1);
    assert.equal(scene.engine.model.state.spinalCordVisible, true);
    assert.equal(scene.engine.model.state.hemisphere, 'right');
    assert.equal(scene.engine.model.state.selectedRegion?.id, circuit.steps.at(-1)!.region);
  });

  test('holds the scene, shows the detail, then starts on the whole route: nothing selected, the cortex seen through, the oblique view', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    scene.engine.model.select('destrieux:left:25');
    const mark = scene.engine.calls.length;
    const started: (string | null)[] = [];
    scene.shell.showDetail.mockImplementation(() => started.push(scene.lesson.state.circuit));
    await scene.excursions.openCircuit(circuit.id);

    assert.equal(scene.reader.capture.mock.calls.length, 1);
    assert.deepEqual(scene.lesson.state, {
      circuit: circuit.id,
      step: 0,
      visited: [0],
      route: true,
    });
    assert.equal(scene.engine.model.state.selectedRegion, null);
    const { settings, manifest } = scene.engine.model;
    assert.equal(settings.cortexVisible, true);
    assert.equal(settings.cortexOpacity, manifest.appearance.see_through_opacity);
    assert.equal(settings.hemisphere, 'both');
    assert.equal(scene.session.state.view, 'oblique');
    // Shown at once, and again once the lesson has begun: clearing the selection on the way
    // returned the panel to the list (the second click a selected region used to need).
    assert.deepEqual(started, [null, circuit.id]);
    const timeline = scene.calls(mark);
    assert.equal(timeline.includes('camera.frameLandmark'), false);
    assert.equal(timeline.at(-1), 'app.render');
  });

  test('stepping on from the route gives the cortex back its opacity; Previous from the first landmark returns to the route', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    scene.engine.model.setCortexOpacity(0.6);
    await scene.excursions.openCircuit(circuit.id);
    await scene.excursions.openLessonStep(0);
    assert.equal(scene.lesson.state.route, false);
    assert.equal(scene.engine.model.state.selectedRegion?.id, circuit.steps[0]!.region);
    assert.equal(scene.engine.model.settings.cortexOpacity, 0.6);
    await scene.excursions.openLessonRoute();
    assert.equal(scene.lesson.state.route, true);
    assert.equal(scene.lesson.state.step, 0);
    assert.equal(scene.engine.model.state.selectedRegion, null);
  });

  test('the whole route holds the cortex opacity it found, which a link’s scene replaces', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    scene.engine.model.setCortexOpacity(0.6);
    await scene.excursions.openCircuit(circuit.id);
    assert.equal(scene.excursions.routeOpacity, 0.6);
    await scene.excursions.openLessonStep(0);
    assert.equal(scene.excursions.routeOpacity, null);
    await scene.excursions.openLessonRoute();
    // A link restored over the route is the new baseline, its own opacity what the route holds.
    scene.excursions.forget();
    scene.engine.model.setCortexOpacity(0.9);
    scene.excursions.holdRoute(circuit);
    assert.equal(scene.excursions.routeOpacity, 0.9);
  });

  test('a lesson opened on a landmark ends Focus, after holding the scene that had it', async () => {
    const scene = createScene();
    // A cortical landmark, its own, so the step's pick alone would carry Focus on.
    const index = vision(scene).steps.findIndex((step) => step.id === 'v1');
    const landmark = vision(scene).steps[index]!.region;
    await scene.commands.revealRegions([landmark], scene.commands.begin());
    scene.engine.model.select(landmark);
    scene.engine.model.setFocused(true);
    const focusedWhenHeld: boolean[] = [];
    scene.reader.capture.mockImplementationOnce(() => {
      focusedWhenHeld.push(scene.engine.model.settings.focused);
      return sceneBefore('focused');
    });
    await scene.excursions.openLessonLandmark('vision', index);
    assert.deepEqual(focusedWhenHeld, [true]);
    assert.equal(scene.engine.model.settings.focused, false);
  });

  test('a deep landmark opens focused, so it shows through the anatomy around it; a cortical one does not', async () => {
    const scene = createScene();
    const { model } = scene.engine;
    await scene.excursions.openCircuit('vision');
    await scene.excursions.openLessonStep(stepOf(scene, 'lgn'));
    assert.equal(model.state.selectedRegion?.id, 'learning:left:lateral-geniculate');
    assert.equal(model.settings.focused, true);
    await scene.excursions.openLessonStep(stepOf(scene, 'v1'));
    assert.equal(model.settings.focused, false);
    await scene.excursions.openLessonStep(stepOf(scene, 'lgn'));
    await scene.excursions.openLessonRoute();
    assert.equal(model.settings.focused, false);
  });

  test('the whole route draws the internal anatomy that holds its deep landmarks', async () => {
    const scene = createScene();
    const { model } = scene.engine;
    await model.setDetail('aseg');
    await scene.excursions.openCircuit('vision');
    assert.equal(model.settings.detail, 'learning');
    for (const step of vision(scene).steps.filter((entry) => entry.id !== 'v1')) {
      assert.equal(model.isRegionDrawn(step.region), true, step.id);
    }
  });

  test('a lesson already open keeps the scene it holds', async () => {
    const scene = createScene();
    const [one, two] = scene.circuits.all;
    await scene.excursions.openCircuit(one!.id);
    await scene.excursions.openCircuit(two!.id);
    assert.equal(scene.reader.capture.mock.calls.length, 1);
  });

  test('a route with a landmark that has no anchor in this brain fails rather than drawing a number nowhere', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    const anchorOf = scene.engine.model.anchorOf.bind(scene.engine.model);
    vi.spyOn(scene.engine.model, 'anchorOf').mockImplementation((id) =>
      id === circuit.steps[1]!.region ? null : anchorOf(id),
    );
    await expect(scene.excursions.openCircuit(circuit.id)).rejects.toThrow(
      `Missing landmark anchor: ${circuit.steps[1]!.region}`,
    );
    assert.equal(scene.lesson.state.circuit, null);
  });

  test('a landmark whose geometry is not drawn is refused, not framed', async () => {
    const scene = createScene();
    await scene.excursions.openCircuit(firstCircuit(scene).id);
    vi.spyOn(scene.engine.camera, 'frameLandmark').mockReturnValue(false);
    await expect(scene.excursions.openLessonStep(0)).rejects.toThrow(
      /Landmark geometry unavailable/,
    );
    assert.equal(scene.lesson.state.route, true);
  });

  test('a command that overtakes it stops it before it frames or starts', async () => {
    const scene = createScene();
    const opening = scene.excursions.openCircuit(firstCircuit(scene).id);
    scene.commands.begin();
    await opening;
    assert.equal(scene.lesson.state.circuit, null);
    assert.equal(
      scene.engine.calls.some((call) => call.method === 'applyView'),
      false,
    );
  });

  test('another panel’s related lesson opens on its landmark in the Circuits tab', async () => {
    const scene = createScene();
    const circuit = scene.circuits.all.find((entry) => entry.steps.length > 2)!;
    await scene.excursions.openLessonLandmark(circuit.id, 2);
    assert.equal(scene.session.state.explorer, 'circuits');
    assert.deepEqual(scene.lesson.state, {
      circuit: circuit.id,
      step: 2,
      visited: [0, 2],
      route: false,
    });
    assert.equal(scene.engine.model.state.selectedRegion?.id, circuit.steps[2]!.region);
  });

  test('a step moves the lesson; one that does not exist is refused', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    await scene.excursions.openCircuit(circuit.id);
    scene.session.setExplorer('circuits');
    const mark = scene.engine.calls.length;
    await scene.excursions.openLessonStep(1);
    assert.equal(scene.lesson.state.step, 1);
    assert.equal(scene.engine.model.state.selectedRegion?.id, circuit.steps[1]!.region);
    assert.deepEqual(scene.calls(mark).slice(-2), ['app.render', 'shell.showDetail']);

    await expect(scene.excursions.openLessonStep(circuit.steps.length)).rejects.toThrow(RangeError);
    assert.equal(scene.lesson.state.step, 1);
  });

  test('the landmark in front is the lesson step whose region is selected', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    assert.equal(scene.excursions.lessonLandmark(), null);
    await scene.excursions.openCircuit(circuit.id);
    scene.session.setExplorer('circuits');
    assert.equal(scene.excursions.lessonLandmark(), null, 'the whole route');
    await scene.excursions.openLessonStep(0);
    scene.session.setExplorer('anatomy');
    assert.equal(scene.excursions.lessonLandmark(), null, 'not on the Circuits tab');
    scene.session.setExplorer('circuits');
    assert.equal(scene.excursions.lessonLandmark(), circuit.steps[0]);
    scene.engine.model.select(null);
    assert.equal(scene.excursions.lessonLandmark(), null);
  });
});

describe('leaving a lesson', () => {
  async function inLesson(scene: Scene) {
    await scene.excursions.openCircuit(firstCircuit(scene).id);
    scene.session.setExplorer('circuits');
  }

  test('ends it and puts back the scene from before it, with the list in front', async () => {
    const scene = createScene();
    await inLesson(scene);
    const held = scene.reader.capture.mock.results[0]!.value;
    const mark = scene.engine.calls.length;
    await scene.excursions.leaveLesson();

    assert.equal(scene.lesson.state.circuit, null);
    assert.equal(scene.reader.apply.mock.calls[0]![0], held);
    assert.deepEqual(scene.calls(mark), ['app.render', 'shell.showList', 'app.render']);
  });

  test('a lesson a link opened on its landmark has no earlier scene to put back', async () => {
    const scene = createScene();
    await inLesson(scene);
    scene.excursions.forget();
    await scene.excursions.leaveLesson();
    assert.equal(scene.lesson.state.circuit, null);
    assert.equal(scene.reader.apply.mock.calls.length, 0);
    assert.equal(
      scene.engine.calls.some((call) => call.method === 'showList'),
      false,
    );
  });

  test('ends a deep landmark’s Focus even with no earlier scene to put back', async () => {
    const scene = createScene();
    await scene.excursions.openCircuit('vision');
    scene.session.setExplorer('circuits');
    await scene.excursions.openLessonStep(stepOf(scene, 'lgn'));
    scene.excursions.forget();
    await scene.excursions.leaveLesson();
    assert.equal(scene.engine.model.state.selectedRegion?.id, 'learning:left:lateral-geniculate');
    assert.equal(scene.engine.model.settings.focused, false);
  });

  test('is nothing when no lesson is open, or its tab is not in front', async () => {
    const scene = createScene();
    await scene.excursions.leaveLesson();
    await scene.excursions.openCircuit(firstCircuit(scene).id);
    await scene.excursions.leaveLesson();
    assert.equal(scene.lesson.state.circuit !== null, true);
    assert.equal(scene.reader.apply.mock.calls.length, 0);
  });

  test('tells the reader what the restore could not put back', async () => {
    const scene = createScene();
    await inLesson(scene);
    const error = new Error('atlas failed');
    scene.reader.apply.mockImplementationOnce(async () => [{ fields: ['atlas'], error }]);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await scene.excursions.leaveLesson();
    assert.ok(scene.session.state.notice?.text);
    assert.equal(scene.lesson.state.circuit, null);
  });

  test('a later command that took over leaves the list where it is', async () => {
    const scene = createScene();
    await inLesson(scene);
    scene.reader.apply.mockImplementationOnce(async () => {
      scene.commands.begin();
      return [];
    });
    await scene.excursions.leaveLesson();
    assert.equal(
      scene.engine.calls.some((call) => call.method === 'showList'),
      false,
    );
  });
});

describe('the Linked MRI', () => {
  test('centres on the selected region from its own button, wherever the crosshair was', async () => {
    const scene = createScene();
    await scene.commands.openRegion('destrieux:left:25', scene.commands.begin());
    scene.engine.model.select('destrieux:left:25');
    scene.engine.sections.setCrosshair([1, 2, 3]);
    const anchor = scene.engine.model.anchorOf('destrieux:left:25')!;
    await scene.excursions.openLinkedMri({ atRegion: true, instant: true });
    assert.deepEqual(scene.engine.sections.state.crosshair, anchor);
    assert.deepEqual(scene.mri.show.mock.calls[0], [{ instant: true }]);
    const timeline = scene.calls();
    assert.ok(timeline.lastIndexOf('sections.load') < timeline.lastIndexOf('mri.show'));
  });

  test('from the cut bar, moves to the selected region only from the origin', async () => {
    const scene = createScene();
    await scene.commands.openRegion('destrieux:left:25', scene.commands.begin());
    const anchor = scene.engine.model.anchorOf('destrieux:left:25')!;
    scene.engine.sections.setCrosshair([1, 2, 3]);
    await scene.excursions.openLinkedMri();
    assert.deepEqual(scene.engine.sections.state.crosshair, [1, 2, 3]);

    scene.engine.sections.setCrosshair([0, 0, 0]);
    await scene.excursions.openLinkedMri();
    assert.deepEqual(scene.engine.sections.state.crosshair, anchor);
    assert.deepEqual(scene.mri.show.mock.calls.at(-1), [{ instant: false }]);
  });

  test('with no selection it opens where the crosshair is', async () => {
    const scene = createScene();
    await scene.excursions.openLinkedMri({ atRegion: true });
    assert.deepEqual(scene.engine.sections.state.crosshair, [0, 0, 0]);
    assert.equal(scene.mri.show.mock.calls.length, 1);
  });

  test('under a lesson, a landmark’s own button opens the lesson’s prepared plane instead', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    const [step] = circuit.steps;
    await onFirstLandmark(scene, circuit.id);
    scene.session.setExplorer('circuits');
    const mark = scene.engine.calls.length;
    await scene.excursions.openLinkedMri({ atRegion: true, instant: true });
    await scene.settled();

    assert.equal(scene.panels.openMri.mock.calls.length, 1);
    assert.equal(scene.mri.show.mock.calls.length, 0);
    assert.deepEqual(scene.mri.openPreparedPlane.mock.calls[0]!.slice(0, 1), [step!.plane]);
    const timeline = scene.calls(mark);
    assert.deepEqual(
      timeline.filter((call) => /setCrosshair|setDisplay|setMode|faceCut|openPrepared/.test(call)),
      [
        'sections.setMode',
        'sections.setCrosshair',
        'sections.setDisplay',
        'sections.setMode',
        'camera.faceCut',
        'mri.openPreparedPlane',
      ],
    );
    // faceCut ends with a render, as legacy's does, before the plane opens.
    assert.equal(timeline[timeline.indexOf('camera.faceCut') + 1], 'app.render');
    assert.deepEqual(
      scene.engine.sections.state.crosshair,
      scene.engine.model.anchorOf(step!.region),
    );
    assert.equal(scene.engine.sections.state.mode, step!.plane);
    assert.equal(scene.engine.sections.state.overlay, true);
  });

  test('the prepared plane waits for nothing a reader has moved on from', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    await onFirstLandmark(scene, circuit.id);
    scene.session.setExplorer('circuits');
    scene.mri.openPreparedPlane.mockImplementationOnce(async (_plane, canOpen) => {
      assert.equal(canOpen(), true);
      await scene.excursions.openLessonStep(1);
      assert.equal(canOpen(), false);
    });
    await scene.excursions.openLinkedMri({ atRegion: true });
    await scene.settled();
    assert.equal(scene.lesson.state.step, 1);
  });

  test('a lesson’s MRI stops where the reader left the Circuits tab', async () => {
    const scene = createScene();
    await onFirstLandmark(scene);
    scene.session.setExplorer('circuits');
    await scene.excursions.openLinkedMri({ atRegion: true });
    scene.session.setExplorer('anatomy');
    await scene.settled();
    assert.equal(scene.mri.openPreparedPlane.mock.calls.length, 0);
  });
});

describe('focusing the open landmark', () => {
  test('frames it as the lesson authored it, with the move options, and renders', async () => {
    const scene = createScene();
    const circuit = firstCircuit(scene);
    await onFirstLandmark(scene, circuit.id);
    scene.session.setExplorer('circuits');
    const mark = scene.engine.calls.length;
    assert.equal(scene.excursions.focusLandmark({ immediate: true }), true);
    const framed = scene.engine.calls.slice(mark).find((call) => call.method === 'frameLandmark')!;
    const [step] = circuit.steps;
    assert.deepEqual(framed.args, [
      step!.region,
      step!.view,
      scene.circuits.contextMarginMm,
      { immediate: true },
    ]);
    assert.equal(scene.calls(mark).at(-1), 'app.render');
  });

  test('is false, and frames nothing, with no lesson landmark selected', async () => {
    const scene = createScene();
    assert.equal(scene.excursions.focusLandmark(), false);
    await scene.commands.openRegion('destrieux:left:25', scene.commands.begin());
    assert.equal(scene.excursions.focusLandmark(), false);
    assert.equal(
      scene.engine.calls.some((call) => call.method === 'frameLandmark'),
      false,
    );
  });
});

describe('the lesson’s MRI, overtaken while the cut is prepared', () => {
  test('opens no plane once a newer command took over', async () => {
    const scene = createScene();
    await onFirstLandmark(scene);
    scene.session.setExplorer('circuits');
    const prepare = scene.commands.prepareCut;
    vi.spyOn(scene.commands, 'prepareCut').mockImplementationOnce(async (current) => {
      scene.commands.begin();
      return prepare(current);
    });
    const mark = scene.engine.calls.length;
    await scene.excursions.openLessonMri();
    assert.equal(scene.mri.openPreparedPlane.mock.calls.length, 0);
    // The landmark's centre and the plane are not set for a lesson the reader has left behind.
    const after = scene.calls(mark);
    assert.equal(after.includes('sections.setCrosshair'), false);
    assert.equal(after.includes('camera.faceCut'), false);
  });
});

describe('the visual-field map', () => {
  // The left half-field is the right hemisphere's, and the right the left's.
  const LEFT_FIELD = { x: -2, y: 1, radius: 1 };
  const RIGHT_FIELD = { x: 2, y: 1, radius: 1 };

  test('opens over the held scene on both hemispheres as a medial pair, uncut, opaque and framed on both V1s', async () => {
    const scene = createScene();
    scene.session.setExplorer('circuits');
    await scene.engine.sections.setMode('axial');
    scene.engine.model.setCortexOpacity(0.3);
    const mark = scene.engine.calls.length;
    await scene.excursions.openMap(LEFT_FIELD);

    assert.equal(scene.reader.capture.mock.calls.length, 1);
    assert.deepEqual(scene.lesson.state, {
      circuit: null,
      step: 0,
      visited: [],
      route: false,
      map: 'visual-field',
      dot: LEFT_FIELD,
    });
    const { settings, state } = scene.engine.model;
    assert.deepEqual(
      [settings.hemisphere, settings.cortexOpacity, settings.internalVisible, state.selectedRegion],
      ['both', 1, false, null],
    );
    assert.equal(scene.engine.sections.state.mode, 'off');
    assert.equal(scene.session.state.view, 'right');
    // The pair stands before it is framed.
    assert.deepEqual(scene.engine.visualField.shown, { dot: LEFT_FIELD });
    const framed = scene.engine.calls
      .slice(mark)
      .find((call) => call.domain === 'camera' && call.method === 'frameLandmark')!;
    assert.deepEqual(framed.args.slice(0, 2), [
      [
        scene.engine.visualField.centralRegion('left'),
        scene.engine.visualField.centralRegion('right'),
      ],
      'right',
    ]);
  });

  test('puts the map’s scene back when asked, and only while the map is open', async () => {
    const scene = createScene();
    scene.session.setExplorer('circuits');
    await expect(scene.excursions.showMapScene()).rejects.toThrow(/No visual-field map/);
    await scene.excursions.openMap(LEFT_FIELD);
    scene.engine.model.setHemisphere('left');
    scene.session.setView('oblique');
    await scene.excursions.showMapScene();
    assert.equal(scene.engine.model.settings.hemisphere, 'both');
    assert.equal(scene.session.state.view, 'right');
  });

  test('leaving it ends the medial pair before the scene from before it is put back', async () => {
    const scene = createScene();
    scene.session.setExplorer('circuits');
    await scene.excursions.openMap(RIGHT_FIELD);
    let pairedAtRestore: unknown = 'not restored';
    scene.reader.apply.mockImplementationOnce(async () => {
      pairedAtRestore = scene.engine.visualField.shown;
      return [];
    });
    await scene.excursions.leaveLesson();
    assert.equal(pairedAtRestore, null);
  });

  test('a lesson opened from it frames its own scene with the medial pair ended', async () => {
    for (const open of [
      (scene: ReturnType<typeof createScene>) => scene.excursions.openCircuit('vision'),
      (scene: ReturnType<typeof createScene>) => scene.excursions.openLessonLandmark('vision', 3),
    ]) {
      const scene = createScene();
      scene.session.setExplorer('circuits');
      await scene.excursions.openMap(RIGHT_FIELD);
      const mark = scene.engine.calls.length;
      const paired: unknown[] = [];
      for (const method of ['applyView', 'frameLandmark'] as const) {
        const frame = scene.engine.camera[method].bind(scene.engine.camera) as (
          ...args: unknown[]
        ) => unknown;
        vi.spyOn(scene.engine.camera, method).mockImplementation((...args: unknown[]) => {
          paired.push(scene.engine.visualField.shown);
          return frame(...args) as never;
        });
      }
      await open(scene);
      assert.ok(scene.engine.calls.length > mark && paired.length > 0, 'the lesson framed');
      assert.deepEqual(
        paired,
        paired.map(() => null),
      );
    }
  });

  test('leaving it puts back the scene from before it; a lesson opened from it keeps that scene', async () => {
    const scene = createScene();
    scene.session.setExplorer('circuits');
    await scene.excursions.openMap(RIGHT_FIELD);
    await scene.excursions.openCircuit('vision');
    assert.equal(scene.lesson.state.map, undefined);
    assert.equal(scene.reader.capture.mock.calls.length, 1);
    await scene.excursions.leaveLesson();
    assert.equal(scene.reader.apply.mock.calls.length, 1);
    assert.equal(scene.reader.apply.mock.calls[0]![0], scene.reader.capture.mock.results[0]!.value);

    await scene.excursions.openMap(RIGHT_FIELD);
    await scene.excursions.leaveLesson();
    assert.deepEqual(scene.lesson.state, { circuit: null, step: 0, visited: [], route: false });
    assert.equal(scene.reader.apply.mock.calls.length, 2);
  });
});
