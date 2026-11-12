import assert from 'node:assert/strict';
import { describe, expect, test, vi } from 'vitest';
import {
  ALL_DOMAINS,
  domainAreas,
  domainPaint,
  revealedRegions,
} from '../core/catalog/neuropsych-domains.ts';
import { createScene, sceneBefore } from './excursion-test-support.ts';

const DEFICIT = 'acalculia';
const OTHER_DEFICIT = 'amusia';

describe('an excursion into a deficit', () => {
  test('opens on the internal anatomy drawing most of its structures, not one drawing a few', async () => {
    const scene = createScene();
    await scene.engine.model.setDetail('aseg');
    // Amnesia cites two FreeSurfer hippocampi, the teaching set's fornices and mammillary bodies,
    // and NextBrain's anterior thalamus: FreeSurfer's segmentation draws two of the eight.
    assert.equal(await scene.excursions.openDeficit('amnesia'), true);
    const { settings } = scene.engine.model;
    assert.equal(settings.detail, 'learning');
    for (const id of ['learning:left:fornix', 'learning:right:mammillary']) {
      assert.equal(scene.engine.model.isRegionDrawn(id), true, id);
    }
    assert.equal(scene.excursions.restorable, true);
    assert.notEqual(scene.session.state.notice, null);
  });

  test('holds the scene it found, opens the profile at once, then draws and frames the regions', async () => {
    const scene = createScene();
    const mark = scene.engine.calls.length;
    assert.equal(await scene.excursions.openDeficit(DEFICIT), true);

    assert.equal(scene.reader.capture.mock.calls.length, 1);
    assert.equal(scene.excursions.restorable, true);
    assert.equal(scene.session.state.explorer, 'deficits');
    assert.equal(scene.session.state.selectedDeficit, DEFICIT);

    const timeline = scene.calls(mark);
    // The tab (a render of its own), the profile and its detail, the scene's own changes, then the
    // paint drawn before the framing.
    assert.deepEqual(timeline.slice(0, 3), ['app.render', 'app.render', 'shell.showDetail']);
    assert.deepEqual(timeline.slice(-3), ['app.render', 'camera.frameRegions', 'app.render']);
    const framed = scene.engine.calls.findLast((call) => call.method === 'frameRegions')!;
    assert.deepEqual(framed.args, [scene.clinical.mappedRegions(DEFICIT)]);
  });

  for (const open of ['openDeficit', 'openFunction'] as const) {
    test(`${open} ends Focus, after holding the scene that had it for Restore`, async () => {
      const scene = createScene();
      const { model } = scene.engine;
      // On the atlas the map is drawn on, so the reveal itself does not drop the selection.
      if (open === 'openFunction') await model.setAtlas(scene.domains.atlas);
      const cortex = [...model.regions.values()].find(
        (region) =>
          region.kind === 'cortex' &&
          region.atlas === model.settings.atlas &&
          model.canSelect(region),
      )!;
      model.select(cortex.id);
      model.setFocused(true);
      const focusedWhenHeld: boolean[] = [];
      scene.reader.capture.mockImplementationOnce(() => {
        focusedWhenHeld.push(scene.engine.model.settings.focused);
        return sceneBefore('focused');
      });
      const mark = scene.engine.calls.length;
      await scene.excursions[open](open === 'openDeficit' ? 'neglect' : ALL_DOMAINS);
      assert.deepEqual(focusedWhenHeld, [true]);
      assert.equal(scene.engine.model.settings.focused, false);
      // Before the profile's first render, so the paint is never drawn under a ghost.
      const timeline = scene.calls(mark);
      assert.equal(timeline.filter((call) => call === 'model.setFocused').length, 1);
      assert.ok(timeline.indexOf('model.setFocused') < timeline.indexOf('app.render'));
    });
  }

  test('keeps the first scene across later steps; Restore puts it back and closes the item that opened it', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit(DEFICIT);
    await scene.excursions.openDeficit(OTHER_DEFICIT);
    await scene.excursions.openListedRegion(scene.clinical.mappedRegions(OTHER_DEFICIT)[0]!);
    assert.equal(scene.reader.capture.mock.calls.length, 1);

    assert.equal(await scene.excursions.restoreBeforeExcursion(), true);
    const [target] = scene.reader.apply.mock.calls[0]!;
    assert.equal(target, scene.reader.capture.mock.results[0]!.value);
    assert.equal(scene.excursions.restorable, false);
    assert.equal(scene.session.state.selectedDeficit, null);
    assert.equal(scene.session.state.notice?.text, 'Previous view restored.');
  });

  test('Restore returns to the tab the excursion left, and stays in the list it was opened from', async () => {
    const scene = createScene();
    scene.excursions.chooseExplorer('anatomy');
    await scene.excursions.openDeficit(DEFICIT);
    assert.equal(scene.session.state.explorer, 'deficits');
    await scene.excursions.restoreBeforeExcursion();
    assert.equal(scene.session.state.explorer, 'anatomy');

    scene.excursions.chooseExplorer('deficits');
    await scene.excursions.openDeficit(DEFICIT);
    await scene.excursions.restoreBeforeExcursion();
    assert.equal(scene.session.state.explorer, 'deficits');
  });

  test('another tab ends it on that tab’s list: the scene comes back, and its selection opens no detail', async () => {
    const scene = createScene();
    await scene.excursions.openFunction('language');
    const mark = scene.engine.calls.length;
    await scene.excursions.chooseMode('circuits');

    assert.equal(scene.reader.apply.mock.calls.length, 1);
    // The restored selection is drawn (and drilled into) before the list replaces it, then the tab.
    assert.deepEqual(scene.calls(mark), ['app.render', 'shell.showList', 'app.render']);
    assert.equal(scene.session.state.explorer, 'circuits');
    assert.equal(scene.session.state.selectedFunction, 'language');
  });

  test('Restore to Tracts holds the reader’s own opacity, not the excursion’s', async () => {
    const scene = createScene();
    scene.excursions.chooseExplorer('diffusion');
    await scene.excursions.openDeficit(DEFICIT);
    await scene.excursions.restoreBeforeExcursion();
    assert.equal(scene.session.state.explorer, 'diffusion');
    scene.excursions.chooseExplorer('anatomy');
    assert.equal(scene.engine.model.settings.cortexOpacity, 1);
  });

  test('Restore on Functions closes the open function', async () => {
    const scene = createScene();
    await scene.excursions.openFunction('language');
    await scene.excursions.restoreBeforeExcursion();
    assert.equal(scene.session.state.selectedFunction, null);
  });

  for (const back of ['restore', 'another tab'] as const) {
    test(`${back} draws compared stroke cases again over the display they found`, async () => {
      const scene = createScene();
      scene.reader.capture.mockReturnValueOnce({
        ...sceneBefore('cases'),
        cortexOpacity: 0.15,
        surfaceColor: 'tissue',
      });
      Object.assign(scene.strokeCases, {
        chosen: ['M1', 'M2'],
        heldOpacity: 1,
        heldColor: 'atlas',
      });
      await scene.excursions.openFunction('language');
      // Cleared by the excursion itself, whether or not it kept the selection.
      expect(scene.strokeCases.clear).toHaveBeenCalledOnce();

      if (back === 'restore') await scene.excursions.restoreBeforeExcursion();
      else await scene.excursions.chooseMode('anatomy');
      const [target] = scene.reader.apply.mock.calls[0]!;
      assert.equal(target.cortexOpacity, 1);
      assert.equal(target.surfaceColor, 'atlas');
      expect(scene.strokeCases.show).toHaveBeenCalledExactlyOnceWith(['M1', 'M2']);
    });
  }

  test('a restore with no cases shown draws none', async () => {
    const scene = createScene();
    await scene.excursions.openFunction('language');
    await scene.excursions.restoreBeforeExcursion();
    expect(scene.strokeCases.show).not.toHaveBeenCalled();
  });

  test('a restore that fails in part throws every cause and keeps the scene to try again', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit(DEFICIT);
    const error = new Error('cut failed');
    scene.reader.apply.mockImplementationOnce(async () => [{ fields: ['cut'], error }]);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(scene.excursions.restoreBeforeExcursion()).rejects.toMatchObject({
      name: 'AggregateError',
      errors: [error],
    });
    expect(logged).toHaveBeenCalledWith(error);
    assert.equal(scene.excursions.restorable, true);
    assert.equal(scene.session.state.selectedDeficit, DEFICIT);
  });

  test('a restore a later command overtook changes nothing', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit(DEFICIT);
    scene.reader.apply.mockImplementationOnce(async (_target, current) => {
      scene.commands.begin();
      assert.equal(current(), false);
      return [];
    });
    assert.equal(await scene.excursions.restoreBeforeExcursion(), false);
    assert.equal(scene.excursions.restorable, true);
    assert.equal(scene.session.state.selectedDeficit, DEFICIT);
  });

  test('leaving the tab, overtaken, keeps the scene and its stroke cases for Restore', async () => {
    const scene = createScene();
    scene.strokeCases.chosen = ['M1'];
    await scene.excursions.openFunction('language');
    scene.reader.apply.mockImplementationOnce(async () => {
      scene.commands.begin();
      return [];
    });
    await scene.excursions.chooseMode('anatomy');
    expect(scene.strokeCases.show).not.toHaveBeenCalled();
    assert.equal(scene.excursions.restorable, true);

    await scene.excursions.chooseMode('functions');
    assert.equal(await scene.excursions.restoreBeforeExcursion(), true);
    expect(scene.strokeCases.show).toHaveBeenCalledExactlyOnceWith(['M1']);
  });

  test('there is nothing to restore before an excursion', async () => {
    const scene = createScene();
    await expect(scene.excursions.restoreBeforeExcursion()).rejects.toThrow(/no scene/);
  });

  test('closing the deficit or the function brings back the scene from before it, on the tab’s list', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit(DEFICIT);
    await scene.excursions.closeDeficit();
    assert.equal(scene.excursions.restorable, false);
    assert.equal(scene.session.state.selectedDeficit, null);
    assert.equal(scene.session.state.explorer, 'deficits');
    assert.equal(scene.session.state.notice?.text, 'Previous view restored.');

    await scene.excursions.openFunction('language');
    const mark = scene.engine.calls.length;
    await scene.excursions.closeFunction();
    assert.equal(scene.excursions.restorable, false);
    assert.equal(scene.session.state.selectedFunction, null);
    assert.deepEqual(
      scene.reader.apply.mock.calls.map(([state]) => state),
      [sceneBefore('scene 1'), sceneBefore('scene 2')],
    );
    assert.deepEqual(scene.calls(mark), ['app.render', 'shell.showList']);
  });

  test('closing with no excursion held only closes', async () => {
    const scene = createScene();
    scene.session.setFunction('language');
    await scene.excursions.closeFunction();
    assert.equal(scene.session.state.selectedFunction, null);
    assert.equal(scene.reader.apply.mock.calls.length, 0);
  });

  test('the reader’s own atlas is held while the excursion is, and an atlas the reader chooses ends it', async () => {
    const scene = createScene();
    const own = scene.engine.model.settings.atlas;
    assert.equal(scene.excursions.heldAtlas, null);
    scene.reader.capture.mockReturnValueOnce({ ...sceneBefore('own'), atlas: own });
    await scene.excursions.openFunction('language');
    assert.equal(scene.excursions.heldAtlas, own);

    const other = scene.engine.model.manifest.atlases.find((atlas) => atlas.id !== own)!;
    await scene.excursions.chooseAtlas(other.id);
    assert.equal(scene.excursions.heldAtlas, null);
    assert.equal(scene.excursions.restorable, false);
    await scene.excursions.closeFunction();
    assert.equal(scene.reader.apply.mock.calls.length, 0);
  });

  test('a command that overtakes the reveal stops it before it draws, says or frames anything', async () => {
    const scene = createScene();
    const opening = scene.excursions.openDeficit(DEFICIT);
    scene.commands.begin();
    assert.equal(await opening, false);
    assert.equal(
      scene.engine.calls.some((call) => call.method === 'frameRegions'),
      false,
    );
    assert.equal(scene.session.state.notice, null);
    // The profile opened and the scene is held: the later command owns what happens next.
    assert.equal(scene.excursions.restorable, true);
  });
});

describe('an excursion into a function', () => {
  test('draws the function’s areas and frames the whole brain', async () => {
    const scene = createScene();
    const mark = scene.engine.calls.length;
    assert.equal(await scene.excursions.openFunction('language'), true);
    assert.equal(scene.session.state.explorer, 'functions');
    assert.equal(scene.session.state.selectedFunction, 'language');
    assert.deepEqual(scene.calls(mark).slice(-3), [
      'app.render',
      'camera.frameWhole',
      'app.render',
    ]);
    const shown = [...domainPaint(scene.domains, 'language').colors.keys()];
    assert.ok(shown.every((id) => scene.engine.model.isRegionDrawn(id)));
    // From a view that shows its five strongest areas.
    const framed = scene.engine.calls.findLast((call) => call.method === 'frameWhole')!;
    assert.deepEqual(framed.args, [
      domainAreas(scene.domains, 'language')
        .slice(0, 5)
        .map(({ region }) => region),
    ]);
  });

  test('a strongest area no view shows is said, as a deficit’s out-of-sight regions are', async () => {
    const scene = createScene();
    const [hidden] = domainAreas(scene.domains, 'language').filter(
      ({ region }) => scene.engine.model.regions.get(region)!.kind === 'cortex',
    );
    vi.spyOn(scene.engine.camera, 'frameWhole').mockReturnValue([hidden!.region]);
    assert.equal(await scene.excursions.openFunction('language'), true);
    expect(scene.session.state.notice?.text).toMatch(/out of sight/i);
  });

  for (const [detail, drawnOn] of [
    ['learning', 'learning'],
    ['nextbrain', 'learning'],
    ['aseg', 'aseg'],
  ]) {
    test(`from the ${detail} detail, draws its structures on ${drawnOn}`, async () => {
      const scene = createScene();
      const { model } = scene.engine;
      await model.setDetail(detail);
      await scene.excursions.openFunction('reward');
      assert.equal(model.settings.detail, drawnOn);
      const paint = domainPaint(scene.domains, 'reward');
      const structures = revealedRegions(scene.domains, paint, drawnOn).filter((id) =>
        id.startsWith(`${drawnOn}:`),
      );
      assert.ok(structures.length > 0);
      assert.ok(structures.every((id) => model.isRegionDrawn(id)));
    });
  }

  test('a structure it lists opens as the teaching units that carry its score', async () => {
    const scene = createScene();
    await scene.engine.model.setDetail('nextbrain');
    await scene.excursions.openFunction('motor');
    assert.equal(await scene.excursions.openListedRegion('aseg:left:13'), true);
    assert.equal(scene.engine.model.settings.detail, 'learning');
    assert.equal(scene.engine.model.state.selectedRegion?.id, 'learning:left:pallidum-external');
    const framed = scene.engine.calls.findLast((call) => call.method === 'frameRegions')!;
    assert.deepEqual(framed.args, [
      ['learning:left:pallidum-external', 'learning:left:pallidum-internal'],
    ]);
  });

  test('a lesson it is opened from ends there and hands over the scene from before it', async () => {
    const scene = createScene();
    const [circuit] = scene.circuits.all;
    await scene.excursions.openCircuit(circuit!.id);
    assert.equal(scene.lesson.state.circuit, circuit!.id);
    const held = scene.reader.capture.mock.results[0]!.value;

    await scene.excursions.openFunction('language');
    assert.equal(scene.lesson.state.circuit, null);
    assert.equal(scene.reader.capture.mock.calls.length, 1);
    await scene.excursions.restoreBeforeExcursion();
    assert.equal(scene.reader.apply.mock.calls[0]![0], held);
    // The lesson's scene was handed over: leaving no lesson, there is nothing for it to restore.
    await scene.excursions.leaveLesson();
    assert.equal(scene.reader.apply.mock.calls.length, 1);
  });

  test('CTRL-29 a deficit opened from a lesson ends it and hands over the scene from before it', async () => {
    const scene = createScene();
    const [circuit] = scene.circuits.all;
    await scene.excursions.openCircuit(circuit!.id);
    const held = scene.reader.capture.mock.results[0]!.value;

    await scene.excursions.openDeficit(DEFICIT);
    assert.equal(scene.lesson.state.circuit, null);
    assert.equal(scene.reader.capture.mock.calls.length, 1);
    await scene.excursions.restoreBeforeExcursion();
    assert.equal(scene.reader.apply.mock.calls[0]![0], held);
    await scene.excursions.leaveLesson();
    assert.equal(scene.reader.apply.mock.calls.length, 1);
  });

  test('a lesson step says the side it shows alone, and leaving the lesson says the scene came back', async () => {
    const scene = createScene();
    const circuit = scene.circuits.all.find(
      (entry) => scene.engine.model.regions.get(entry.steps[0]!.region)!.hemisphere === 'left',
    )!;
    scene.excursions.chooseExplorer('circuits');
    await scene.excursions.openCircuit(circuit.id);
    await scene.excursions.openLessonStep(0);
    assert.equal(scene.engine.model.settings.hemisphere, 'left');
    assert.match(scene.session.state.notice!.text, /^left hemisphere shown alone/i);
    await scene.excursions.leaveLesson();
    assert.equal(scene.session.state.notice!.text, 'Previous view restored.');
  });

  test('CTRL-30 opening a function says the atlas it changed, and labels the cut by that atlas', async () => {
    const scene = createScene();
    assert.equal(scene.engine.model.settings.atlas, 'destrieux');
    await scene.excursions.openFunction('language');
    assert.equal(scene.engine.model.settings.atlas, 'hcp-mmp');
    assert.match(scene.session.state.notice!.text, /HCP-MMP/);
    assert.equal(scene.engine.sections.state.cutAtlas, 'hcp-mmp');
  });

  test('a region it names is selected and framed, and holds the scene if none is held', async () => {
    const scene = createScene();
    assert.equal(await scene.excursions.openListedRegion('destrieux:left:25'), true);
    assert.equal(scene.engine.model.state.selectedRegion?.id, 'destrieux:left:25');
    assert.equal(scene.excursions.restorable, true);
    const framed = scene.engine.calls.findLast((call) => call.method === 'frameRegions')!;
    assert.deepEqual(framed.args, [['destrieux:left:25']]);
  });
});

describe('an area opened from a profile', () => {
  test('replaces the profile’s out-of-sight notice: said again for the new view, else cleared', async () => {
    const scene = createScene();
    const [hidden] = domainAreas(scene.domains, 'language').filter(
      ({ region }) => scene.engine.model.regions.get(region)!.kind === 'cortex',
    );
    const frameWhole = vi
      .spyOn(scene.engine.camera, 'frameWhole')
      .mockReturnValue([hidden!.region]);
    await scene.excursions.openFunction('language');
    expect(scene.session.state.notice?.text).toMatch(/out of sight/i);
    frameWhole.mockRestore();
    // Framed on its own, the area is in sight: the notice about the whole-brain view goes.
    vi.spyOn(scene.engine.camera, 'frameRegions').mockReturnValueOnce([]);
    assert.equal(await scene.excursions.openListedRegion(hidden!.region), true);
    expect(scene.session.state.notice).toBeNull();
    // An area no view of it shows is said.
    vi.spyOn(scene.engine.camera, 'frameRegions').mockReturnValueOnce([hidden!.region]);
    await scene.excursions.openListedRegion(hidden!.region);
    expect(scene.session.state.notice?.text).toMatch(/out of sight/i);
  });
});

describe('a deficit’s FreeSurfer structures', () => {
  for (const [detail, drawnOn] of [
    ['learning', 'learning'],
    ['nextbrain', 'learning'],
    ['aseg', 'aseg'],
  ]) {
    test(`from the ${detail} detail, draws its FreeSurfer structures on ${drawnOn}`, async () => {
      const scene = createScene();
      const { model } = scene.engine;
      await model.setDetail(detail);
      await scene.excursions.openDeficit('dystonia');
      assert.equal(model.settings.detail, drawnOn);
      const framed = scene.engine.calls.findLast((call) => call.method === 'frameRegions')!;
      const regions = framed.args[0] as string[];
      assert.ok(regions.every((id) => id.startsWith(`${drawnOn}:`) && model.isRegionDrawn(id)));
      assert.equal(regions.includes('learning:left:pallidum-internal'), drawnOn === 'learning');
    });
  }

  test('a structure with no teaching-set stand-in is still drawn on FreeSurfer’s segmentation', async () => {
    const scene = createScene();
    await scene.engine.model.setDetail('learning');
    await scene.excursions.openDeficit('alien-hand');
    assert.equal(scene.engine.model.settings.detail, 'aseg');
  });

  test('a deficit mapped on structures alone hides the cortex and offers nothing', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit('abulia');
    assert.equal(scene.engine.model.settings.cortexVisible, false);
    assert.equal(scene.session.state.notice?.action ?? null, null);
  });
});

describe('searching in the other evidence tab', () => {
  test('carries the words, closes the open item, forgets the excursion and chooses the tab', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit(DEFICIT);
    await scene.excursions.searchIn('functions', 'memory');
    assert.equal(scene.session.state.explorer, 'functions');
    assert.equal(scene.session.state.functionQuery, 'memory');
    assert.equal(scene.session.state.selectedFunction, null);
    assert.equal(scene.excursions.restorable, false);

    await scene.excursions.openFunction('language');
    await scene.excursions.searchIn('deficits', 'aphasia');
    assert.equal(scene.session.state.explorer, 'deficits');
    assert.equal(scene.session.state.clinicalQuery, 'aphasia');
    assert.equal(scene.session.state.selectedDeficit, null);
  });

  test('counts the matches the other tab would list', () => {
    const scene = createScene();
    const { excursions, clinical } = scene;
    assert.equal(excursions.deficitsMatching('acalc', 'en'), clinical.search('acalc', 'en').length);
    assert.ok(excursions.functionsMatching('memory', 'en') > 0);
    assert.equal(excursions.functionsMatching('qqqqzzzz', 'en'), 0);
  });

  test('lists the curated functions whose lesion checks cite a deficit', () => {
    const scene = createScene();
    const checks = scene.domains.lesion_checks as Record<string, { deficit: string }[]>;
    const [domain, [check]] = Object.entries(checks).find(([, list]) => list.length)!;
    const maps = scene.excursions.checkedMaps(check!.deficit, 'en');
    assert.ok(maps.some((map) => map.id === domain));
    for (const map of maps) {
      assert.ok(checks[map.id]!.some((entry) => entry.deficit === check!.deficit));
    }
  });
});

describe('the stage key', () => {
  test('on Functions a row opens that function, and none returns to all of them', async () => {
    const scene = createScene();
    await scene.excursions.openFunction('language');
    scene.excursions.pickPaint(null);
    await scene.settled();
    assert.equal(scene.session.state.selectedFunction, ALL_DOMAINS);
    scene.excursions.pickPaint('working-memory');
    await scene.settled();
    assert.equal(scene.session.state.selectedFunction, 'working-memory');
  });

  test('on Deficits a row shows one finding alone', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit(DEFICIT);
    scene.excursions.pickPaint('finding');
    assert.equal(scene.session.state.selectedFinding, 'finding');
    scene.excursions.pickPaint(null);
    assert.equal(scene.session.state.selectedFinding, null);
  });

  test('choosing an atlas or a colour lifts the open paint first', async () => {
    const scene = createScene();
    await scene.excursions.openFunction('language');
    await scene.excursions.chooseSurfaceColor('tissue');
    assert.equal(scene.session.state.paintLifted, true);
    assert.equal(scene.engine.model.settings.surfaceColor, 'tissue');

    scene.session.setFunction('language');
    assert.equal(scene.session.state.paintLifted, false);
    const other = scene.engine.model.manifest.atlases.find(
      (atlas) => atlas.id !== scene.engine.model.settings.atlas,
    )!;
    await scene.excursions.chooseAtlas(other.id);
    assert.equal(scene.session.state.paintLifted, true);
    assert.equal(scene.engine.model.settings.atlas, other.id);
  });

  test('STAGE-62 · another atlas ends a connectivity paint; the same one keeps it', async () => {
    const scene = createScene();
    const atlas = scene.engine.model.settings.atlas;
    scene.session.setConnectivitySeed('julich:left:1');
    await scene.excursions.chooseAtlas(atlas);
    assert.equal(scene.session.state.connectivitySeed, 'julich:left:1');
    const other = scene.engine.model.manifest.atlases.find((entry) => entry.id !== atlas)!;
    await scene.excursions.chooseAtlas(other.id);
    assert.equal(scene.session.state.connectivitySeed, null);
  });
});

describe('a failure that needs a newer deploy', () => {
  test('offers the notice’s Reload; any other failure is the panel’s to word', () => {
    const scene = createScene();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    scene.excursions.offerReload(Object.assign(new Error('moved'), { code: 'other' }));
    expect(scene.session.state.notice).toBeNull();
    scene.excursions.offerReload(Object.assign(new Error('moved'), { code: 'asset-updated' }));
    assert.equal(scene.session.state.notice?.action, 'reload');
  });
});

test('a link’s scene is the new baseline: nothing is left to restore', async () => {
  const scene = createScene();
  await scene.excursions.openDeficit(DEFICIT);
  scene.excursions.forget();
  assert.equal(scene.excursions.restorable, false);
});

describe('the cut atlas', () => {
  test('is the sections’ own, and a rejection reaches the caller', async () => {
    const scene = createScene();
    await scene.excursions.setCutAtlas('destrieux');
    assert.equal(scene.engine.sections.state.cutAtlas, 'destrieux');
    vi.spyOn(scene.engine.sections, 'setCutAtlas').mockRejectedValueOnce(new Error('overtaken'));
    await expect(scene.excursions.setCutAtlas('aseg')).rejects.toThrow('overtaken');
  });
});

describe("a function's Linked MRI", () => {
  test('centres on its strongest area, wherever the crosshair was, once the scan has loaded', async () => {
    const scene = createScene();
    await scene.excursions.openFunction('language');
    scene.engine.sections.setCrosshair([1, 2, 3]);
    const strongest = domainAreas(scene.domains, 'language')[0]!.region;
    await scene.excursions.openFunctionMri('language', { instant: true });
    assert.deepEqual(scene.engine.sections.state.crosshair, scene.engine.model.anchorOf(strongest));
    assert.deepEqual(scene.mri.show.mock.calls.at(-1), [{ instant: true }]);
    const timeline = scene.calls();
    assert.ok(timeline.lastIndexOf('sections.load') < timeline.lastIndexOf('mri.show'));
  });

  test('the overview has no one area, so it opens where the crosshair is', async () => {
    const scene = createScene();
    await scene.excursions.openFunction(ALL_DOMAINS);
    scene.engine.sections.setCrosshair([1, 2, 3]);
    await scene.excursions.openFunctionMri(ALL_DOMAINS, { instant: false });
    assert.deepEqual(scene.engine.sections.state.crosshair, [1, 2, 3]);
    assert.deepEqual(scene.mri.show.mock.calls.at(-1), [{ instant: false }]);
  });
});

describe("a deficit's Linked MRI", () => {
  test('centres on its first finding’s first region as this detail level draws it, or the chosen finding’s', async () => {
    const scene = createScene();
    await scene.excursions.openDeficit(DEFICIT);
    scene.engine.sections.setCrosshair([1, 2, 3]);
    const detail = scene.engine.model.settings.detail;
    const first = (finding: string | null) =>
      scene.clinical.drawnAs(
        [...scene.clinical.paint(DEFICIT, finding).paint.colors.keys()][0]!,
        detail,
      )[0]!;
    await scene.excursions.openDeficitMri(DEFICIT, null, { instant: true });
    assert.deepEqual(
      scene.engine.sections.state.crosshair,
      scene.engine.model.anchorOf(first(null)),
    );
    assert.deepEqual(scene.mri.show.mock.calls.at(-1), [{ instant: true }]);

    const findings = scene.clinical.paint(DEFICIT).findings;
    const last = findings.at(-1)!.association.id;
    assert.notDeepEqual(
      first(last),
      first(null),
      'the fixture picks a finding citing another region',
    );
    await scene.excursions.openDeficitMri(DEFICIT, last, { instant: false });
    assert.deepEqual(
      scene.engine.sections.state.crosshair,
      scene.engine.model.anchorOf(first(last)),
    );
  });
});
