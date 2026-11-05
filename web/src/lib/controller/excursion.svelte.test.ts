import { flushSync } from 'svelte';
import { describe, expect, test } from 'vitest';
import { DEFAULT_DISPLAY, preparedOf } from '../../features/colophon/display-state.ts';
import { syncRouteGhost } from './excursion.svelte.ts';
import { createScene } from './excursion-test-support.ts';

test('whether Restore is offered, and the lesson in front, are reactive', async () => {
  const scene = createScene();
  const seen: [boolean, string | null][] = [];
  const stop = $effect.root(() => {
    $effect(() => {
      seen.push([scene.excursions.restorable, scene.view.current.lesson.circuit]);
    });
  });
  flushSync();
  await scene.excursions.openDeficit('acalculia');
  flushSync();
  await scene.excursions.openCircuit(scene.circuits.all[0]!.id);
  flushSync();
  scene.excursions.closeDeficit();
  flushSync();
  stop();
  expect(seen.at(0)).toEqual([false, null]);
  expect(seen.at(-1)).toEqual([false, scene.circuits.all[0]!.id]);
  expect(seen.some(([restorable]) => restorable)).toBe(true);
});

describe('the whole route’s grey context', () => {
  /** A scene with the route's ghost synced as the app syncs it, on its whole route. */
  async function onRoute() {
    const scene = createScene();
    const stop = $effect.root(() => syncRouteGhost(scene.engine.model, scene.view, scene.circuits));
    // The app's render settles effects, as world.ts's flushSync does.
    scene.render.mockImplementation(() => flushSync());
    scene.session.setExplorer('circuits');
    const circuit = scene.circuits.all.find((entry) =>
      entry.steps.some((step) => step.covering_regions?.length),
    )!;
    await scene.excursions.openCircuit(circuit.id);
    flushSync();
    return { scene, circuit, stop, ghosted: () => scene.engine.model.settings.ghostedAround };
  }

  test('keeps the landmarks, their covering regions and their constituents, until a step', async () => {
    const { scene, circuit, stop, ghosted } = await onRoute();
    const held = circuit.steps
      .flatMap((step) => [step.region, ...(step.covering_regions ?? [])])
      .flatMap((id) => [id, ...(scene.engine.model.regions.get(id)!.constituent_regions ?? [])]);
    expect([...ghosted()!].sort()).toEqual([...new Set(held)].sort());
    await scene.excursions.openLessonStep(0);
    expect(ghosted()).toBeNull();
    await scene.excursions.openLessonRoute();
    expect(ghosted()).not.toBeNull();
    stop();
  });

  test('ends when Anatomy is brought forward, and stays ended on Functions', async () => {
    const { scene, stop, ghosted } = await onRoute();
    scene.excursions.chooseExplorer('anatomy');
    expect(ghosted()).toBeNull();
    await scene.excursions.chooseMode('functions');
    flushSync();
    expect(ghosted()).toBeNull();
    stop();
  });

  test('ends before the scene from before the lesson is put back', async () => {
    const { scene, stop, ghosted } = await onRoute();
    const ghostedWhenRestored: unknown[] = [];
    scene.reader.apply.mockImplementationOnce(async () => {
      ghostedWhenRestored.push(ghosted());
      return [];
    });
    await scene.excursions.leaveLesson();
    expect(ghostedWhenRestored).toEqual([null]);
    stop();
  });

  test('leaves the ghost Tracts set when the route gives way to Tracts', async () => {
    const { scene, stop, ghosted } = await onRoute();
    scene.excursions.chooseExplorer('diffusion');
    expect(ghosted()).toEqual(new Set());
    stop();
  });
});

test('the see-through cortex a painted structure holds is the reset’s, not a change', () => {
  const scene = createScene();
  scene.paintSeeThrough.heldOpacity = 1;
  expect(scene.excursions.displayBaseline.cortexOpacity).toBe(
    scene.engine.model.manifest.appearance.see_through_opacity,
  );
  scene.paintSeeThrough.heldOpacity = null;
  expect(scene.excursions.displayBaseline.cortexOpacity).toBe(1);
});

test('the display a lesion’s drawn bundle sees through is the reset’s, not a change; leaving the lesson drops its own', async () => {
  const scene = createScene();
  const seeThrough = scene.engine.model.manifest.appearance.see_through_opacity;
  expect(scene.excursions.displayBaseline.cortexOpacity).toBe(1);
  scene.lesion.heldOpacity = 1;
  expect(scene.excursions.displayBaseline.cortexOpacity).toBe(seeThrough);
  scene.lesion.heldOpacity = null;

  await scene.excursions.chooseMode('circuits');
  await scene.excursions.openCircuit(scene.circuits.all[0]!.id);
  await scene.excursions.openLessonStep(0);
  // The step's own display, as it set the stage, rather than the defaults.
  expect(scene.excursions.displayBaseline).not.toBe(DEFAULT_DISPLAY);
  expect(scene.excursions.displayBaseline).toEqual(preparedOf(scene.engine.model.settings));
  await scene.excursions.chooseMode('anatomy');
  expect(scene.excursions.displayBaseline).toEqual({
    hemisphere: 'both',
    cortexVisible: true,
    cortexOpacity: 1,
    internalVisible: true,
    hiddenRegions: new Set(),
    focused: false,
  });
});
