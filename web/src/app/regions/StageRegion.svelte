<script lang="ts">
  import { hasContext, untrack } from 'svelte';
  import { ASSET_BASE } from '../../../build/site.ts';
  import type { Snippet } from 'svelte';
  import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
  import { isIndependentTractReference } from '../../lib/core/diffusion/presentation.ts';
  import { sulcExtent } from '../../lib/core/catalog/sulcal-depth.ts';
  import { visibilityOf } from '../../lib/core/catalog/visibility.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { mapFileReason } from '../../lib/core/user-map/map-file-error.ts';
  import { comparesMap, legendFor, paintFor, paintKind } from '../../lib/core/state/paint.ts';
  import { publishesSpinalCord } from '../../lib/core/state/scene-commands.ts';
  import { modelUsable } from '../../lib/core/state/session.ts';
  import type { CutMode, Explorer, ViewName } from '../../lib/types/index.ts';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/core/keyboard.ts';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import { createMprDialog } from '../../features/sections/mpr-dialog.svelte.ts';
  import type MprDialog from '../../features/sections/MprDialog.svelte';
  import { createSectionControls } from '../../features/sections/section-controls.svelte.ts';
  import SectionBar from '../../features/sections/SectionBar.svelte';
  import type { SnapshotStage, SnapshotSubject } from '../../features/snapshot/snapshot.ts';
  import SectionPopover from '../../features/sections/SectionPopover.svelte';
  import CoordinatePopover from '../../features/lesion/CoordinatePopover.svelte';
  import { mapCaptions, mapKey, mapKeys } from '../../features/user-map/key.ts';
  import LesionPopover from '../../features/lesion/LesionPopover.svelte';
  import Dock from '../../features/stage/Dock.svelte';
  import type { DockCommands } from '../../features/stage/dock-commands.ts';
  import { createFullscreen } from '../../features/stage/fullscreen.ts';
  import type { Fullscreen } from '../../features/stage/fullscreen.ts';
  import type { HoverSources } from '../../features/stage/hover-text.ts';
  import OrientationGizmo from '../../features/stage/OrientationGizmo.svelte';
  import RouteMarks from '../../features/stage/RouteMarks.svelte';
  import RegionNames from '../../features/stage/RegionNames.svelte';
  import { namesDrawn } from '../../features/stage/region-names.ts';
  import VisualAreaNames from '../../features/stage/VisualAreaNames.svelte';
  import { visualFieldMapOpen } from '../../lib/state/visual-field-map.svelte.ts';
  import { bodyMapOpen } from '../../lib/state/body-map.svelte.ts';
  import { keyedSurface } from '../../features/stage/stage-keys.ts';
  import type { ColoredNetworks } from '../../features/stage/stage-keys.ts';
  import StageKeys from '../../features/stage/StageKeys.svelte';
  import StageOverlay from '../../features/stage/StageOverlay.svelte';
  import { APP, getApp } from '../application.svelte.ts';
  import type { World } from '../application.svelte.ts';
  import { casesKey } from '../../lib/core/panels/stroke-cases.ts';
  import { lobeRows } from '../../lib/core/catalog/lobes.ts';
  import { lobeKeyRows } from '../../lib/core/panels/navigator.ts';

  /** `children` is where I3b mounts the stage status, before and after the engine. */
  let { children }: { children?: Snippet } = $props();

  // main.ts always mounts the shell with the app; the shell's own tests mount it bare (H1a).
  const app = hasContext(APP) ? getApp() : null;
  const world = $derived(app?.world ?? null);

  let host = $state<HTMLElement>();
  let keys = $state<StageKeys>();
  let linkedMri = $state<MprDialog>();
  let dock = $state<Dock>();
  // The Linked MRI's code is a chunk of its own, fetched the first time the dialog opens.
  let LinkedMri = $state<typeof MprDialog>();
  let fetchingLinkedMri = false;
  // The network matrix and its wording are a chunk of their own (BUILD-15), fetched when first asked for.
  let NetworkMatrix =
    $state<typeof import('../../features/connectivity/NetworkMatrixDialog.svelte').default>();
  let matrixOpen = $state(false);
  let matrixInstant = $state(false);

  /** What the stage's controls reach, built once for the world they run in. */
  function controllers({ engine, engineState, session, commands, anatomy, excursions }: World) {
    const sections = createSectionControls({
      engine,
      engineState,
      commands,
      session,
      openLinkedMri: excursions.openLinkedMri,
    });
    const mpr = createMprDialog({
      engine,
      select: anatomy.selectRegion,
      showPlane: sections.showMriPlane,
    });
    return { sections, mpr };
  }
  const stage = $derived(world && untrack(() => controllers(world)));

  // Only the stage goes full screen; the masthead's button and the exit control share this one.
  const fullscreen = $derived<Fullscreen | null>(
    host && app
      ? untrack(() =>
          createFullscreen({
            host: host!,
            lang: () => app.language.current,
            notify: app.session.notify,
          }),
        )
      : null,
  );

  /** The masthead's Full screen. */
  export function toggleFullscreen() {
    fullscreen!.toggle();
  }
  /** Something is full screen (follows `fullscreenchange`). */
  export function isFullscreen() {
    return fullscreen?.active ?? false;
  }

  /** Image pixels per CSS pixel of a save that names no size, and of Copy image. */
  const DEFAULT_SCALE = 2;

  // The drawing code is fetched with the first save or copy.
  const snapshotCode = () => import('../../features/snapshot/snapshot.ts');
  // Downloaded the first time the Overlay tool opens, off the first visit's entry (BUILD-15).
  const overlayPopoverCode = () =>
    import('../../features/user-map/OverlayPopover.svelte').catch((error: unknown) => {
      console.error(error);
      throw error;
    });

  /** The masthead's Save image: the visible stage as a captioned PNG (G6), `scale` image pixels per CSS pixel. */
  export async function saveImage(scale = DEFAULT_SCALE) {
    const { commands } = world!;
    // A failed fetch of the drawing code is the save's failure.
    let snapshot: Awaited<ReturnType<typeof snapshotCode>>;
    try {
      snapshot = await snapshotCode();
    } catch (error) {
      commands.fail('snapshot', error);
      return;
    }
    // Read once the code is in, so the caption names the frame the save captures.
    return snapshot.saveSnapshot(
      ...snapshotScene(),
      { fail: commands.fail, notify: app!.session.notify },
      { scale },
    );
  }

  /** The masthead's Copy image: the same PNG at the default size. A failure is the clipboard's to say. */
  export async function imagePng(): Promise<Blob> {
    const snapshot = await snapshotCode();
    return snapshot.snapshotPng(...snapshotScene(), { scale: DEFAULT_SCALE });
  }

  /** The stage a snapshot is taken of, and what its caption says, as they stand now. */
  function snapshotScene(): [SnapshotStage, SnapshotSubject] {
    const { engine, view: store } = world!;
    const view = store.current;
    const { manifest } = engine.model;
    const reference = isIndependentTractReference(view);
    const cut = stage!.sections.current;
    const region = reference ? null : view.selectedRegion;
    return [
      { host: host!, stage: app!.stage, keys: keys!, engine },
      {
        lang: view.lang,
        anatomy: manifest.anatomy,
        atlas: view.atlas,
        // The tract reference and the visual field map draw their own colours, not the masthead's.
        surfaceColor:
          reference || visualFieldMapOpen(view) || bodyMapOpen(view) ? 'tissue' : view.surfaceColor,
        detail: view.detail,
        offersDetail: manifest.detail_levels.length > 1,
        view: view.view as ViewName,
        reference: reference ? tractCatalog(view.referenceAnatomy).name[view.lang] : null,
        // `current` is null while the cut is off, so its plane is a cut plane.
        section: cut && { ...cut, plane: cut.plane as Exclude<CutMode, 'off'> },
        selection:
          region &&
          `${world!.catalog.label(region.id).name}, ${t(view.lang, 'sides').words[region.hemisphere]}`,
        overlays: manifest.coordinate_spaces
          ? mapCaptions(world!.userMap, manifest.coordinate_spaces, view.lang)
          : [],
      },
    ];
  }

  // The tracts' streamline direction is an engine getter: it is read again when the tracts say it changed.
  let tractsEpoch = $state(0);
  $effect(() => {
    if (!world) return;
    const { engine } = world;
    const bump = () => tractsEpoch++;
    const offs = [
      engine.on('tractsReady', bump),
      engine.on('tractsVisibility', bump),
      engine.on('tractsActive', bump),
    ];
    return () => offs.forEach((off) => off());
  });

  const directionShown = $derived.by(() => {
    void tractsEpoch;
    return world?.engine.tracts.streamlinesVisible ?? false;
  });

  /** The hover chip names a region as the catalog and the model's published partitions do. */
  const sources = $derived.by((): HoverSources | null => {
    if (!world) return null;
    const { model } = world.engine;
    return {
      regions: model.regions,
      cabNp: model.cabNp,
      domains: model.domains,
      catalogName: (id) => world.catalog.label(id).name,
      canSelect: model.canSelect,
    };
  });

  // The lobe key walks every region twice, for its lobes and for the names the tree shares, and a
  // camera preset, a selection or a moved cut makes a new view. So it reads the catalog's language
  // and the settings that decide what is on screen, which hold through those (STAGE-70).
  const lobes = $derived.by(() => {
    if (!world) return null;
    const { settings, lang } = world.catalog;
    if (settings.surfaceColor !== 'lobe') return null;
    return lobeKeyRows(
      lobeRows(world.engine.model.regions.values(), settings.atlas, lang),
      settings.atlas,
      world.catalog.everySystem,
      lang,
    );
  });

  /** The structure whose agreement the linked MRI shows, by its union's name and side. */
  function agreementName({ engine, engineState, catalog, view }: World): string | null {
    const code = engineState.sections.agreement;
    if (code === null) return null;
    const structure = engine.model.segmentationAgreement!.structures.find((s) => s.code === code)!;
    const side = t(view.current.lang, 'sides').capitalized[structure.hemisphere];
    return `${catalog.label(structure.regions.learning).name} · ${side}`;
  }

  /** Takes focus when a dialog's opener is gone: the Section tool, else the model. */
  /**
   * The tab whose detail reads a placed sphere's report: Deficits keeps a lesion simulated there while
   * no deficit is open (2026-11-20 review); a coordinate's, and any other, is Anatomy's.
   */
  function reportTab(): Explorer {
    const { explorer, selectedDeficit } = world!.view.current;
    const keeps = explorer === 'deficits' && !selectedDeficit && !world!.lesion.coordinate;
    return keeps ? 'deficits' : 'anatomy';
  }

  function sectionToolOrCanvas(canvas: HTMLElement): HTMLElement {
    const tool = [...document.querySelectorAll<HTMLElement>('#viewport .stage-tool')].find(
      (candidate) => candidate.querySelector('[id^="section-tool-"]'),
    );
    return tool?.checkVisibility() ? tool : canvas;
  }

  /** Yeo's networks' key's command. */
  function openNetworkMatrix(event: MouseEvent) {
    matrixInstant = isKeyboardActivation(event);
    matrixOpen = true;
    if (NetworkMatrix) return;
    import('../../features/connectivity/NetworkMatrixDialog.svelte').then(
      (module) => (NetworkMatrix = module.default),
      (error: unknown) => {
        // Closed again, so another press asks again; the failure itself surfaces.
        matrixOpen = false;
        throw error;
      },
    );
  }

  async function fetchLinkedMri({ mpr }: NonNullable<typeof stage>, { commands }: World) {
    fetchingLinkedMri = true;
    try {
      LinkedMri = (await import('../../features/sections/MprDialog.svelte')).default;
    } catch (error) {
      fetchingLinkedMri = false;
      mpr.close({ instant: true });
      commands.fail('mri', error);
    }
  }
  $effect(() => {
    if (world && stage?.mpr.open && !fetchingLinkedMri) void fetchLinkedMri(stage, world);
  });

  // The stage's part of the interface the controllers and the keymap reach (ports.ts).
  $effect(() => {
    if (!app || !world || !stage) return;
    const { sections, mpr } = stage;
    const withdraw = app.registerPorts({
      showMri: (options) => mpr.show(options),
      openPreparedPlane: (plane, canOpen) => mpr.openPreparedPlane(plane, canOpen),
      // `M` shares the opener's busy guard (legacy `M` clicked the opener); beside the stage the
      // MRI is docked, so the page's keys reach `M` while it is open, and it closes it.
      openMpr: () =>
        mpr.isOpen()
          ? mpr.close({ instant: true })
          : void sections.openLinkedMri({ instant: true }),
      closeMpr: () => mpr.close({ instant: true }),
      openLinkedMri: (options) => void sections.openLinkedMri(options),
      mprOpen: () => linkedMri?.holdsKeys() ?? false,
      mriOpen: () => mpr.isOpen(),
      openStageTool: (tool) => void dock!.openFromPanel(tool),
    });
    const offPick = world.engine.on('pick', ({ point }) => {
      if (point) mpr.follow(point);
    });
    return () => {
      withdraw();
      offPick();
      // A slider frame still queued would run after the dialog is gone.
      mpr.dispose();
    };
  });
</script>

<!-- The main landmark, and the target of the masthead's skip link: tabindex -1 lets it take focus when no canvas can. -->
<main id="viewport" tabindex="-1" bind:this={host} data-sheet-full={app?.stage.sheetFull}>
  {#if app && world && stage && sources}
    {@const current = world.view.current}
    {@const tractReference = isIndependentTractReference(current)}
    {@const { model } = world.engine}
    {@const commands = {
      resetView: world.anatomy.resetView,
      setHemisphere: world.anatomy.setHemisphere,
      setCortexVisible: world.anatomy.setCortexVisible,
      setCortexOpacity: world.anatomy.setCortexOpacity,
      setExploded: world.anatomy.setExploded,
      setCortexSurface: world.anatomy.setCortexSurface,
      setInternalVisible: world.anatomy.setInternalVisible,
      setSpinalCordVisible: world.anatomy.setSpinalCordVisible,
      chooseView(name) {
        if (!app.session.setView(name)) throw new Error(`Unknown view: ${name}`);
        world.engine.camera.applyView(name);
      },
      resetDisplay: world.anatomy.resetDisplay,
      setNamesShown: app.session.setNamesShown,
    } satisfies DockCommands}
    {@const showReport = (close: () => void) => {
      world.excursions.chooseExplorer(reportTab());
      world.anatomy.selectRegion(null);
      app.ports.showDetail();
      // The raised sheet leaves a phone's popover no stage to sit on.
      if (app.media.phone) close();
    }}
    <!-- The report is in the panel beside the stage: its Remove serves, and showing it again would do nothing.
         A phone's sheet may cover it, so a phone keeps the popover's own. -->
    {@const reportShown = () =>
      !app.media.phone &&
      (current.explorer === 'anatomy' || reportTab() === 'deficits') &&
      current.selectedRegion === null &&
      app.ports.detailShown()}
    <StageOverlay
      engine={world.engine}
      stage={app.stage}
      media={app.media}
      lang={current.lang}
      status={current.status}
      {tractReference}
      selectedId={current.selectedRegion?.id ?? null}
      view={current}
      {sources}
    />
    {#snippet overlayPopover({ close }: { close: () => void })}
      {#await overlayPopoverCode() then { default: OverlayPopover }}
        <OverlayPopover
          map={world.userMap}
          spaces={model.manifest.coordinate_spaces!}
          lang={current.lang}
          onPlace={async (mm, space) => {
            if (await world.coordinates!.place(mm, space)) showReport(close);
          }}
        />
      {:catch error}
        <p class="overlay-failed" role="alert">
          {mapFileReason(t(current.lang, 'overlay'), t(current.lang, 'errors'), error)}
        </p>
      {/await}
    {/snippet}
    {#snippet coordinatePopover({ close }: { close: () => void })}
      <CoordinatePopover
        lesion={world.lesion}
        placement={world.coordinates!}
        lang={current.lang}
        {reportShown}
        onReport={() => showReport(close)}
      />
    {/snippet}
    {#if app.embed}
      <!-- A frame has no tools: the row of a section its link opened, on the dock's plate and in its place. -->
      <div
        class="embed-dock"
        {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
        {@attach (node) => app.stage.observeDock(node)}
      >
        <SectionBar
          controls={stage.sections}
          stage={app.stage}
          lang={current.lang}
          view={current}
          {tractReference}
          mriOpen={stage.mpr.open}
        />
      </div>
    {:else}
      <Dock
        bind:this={dock}
        stage={app.stage}
        media={app.media}
        lang={current.lang}
        status={current.status}
        {tractReference}
        view={current}
        cortexSurface={world.userMap.surface}
        prepared={world.excursions.displayBaseline}
        hasSpinalCord={publishesSpinalCord(model.manifest)}
        explodable={!visualFieldMapOpen(current)}
        onLesionPlacing={world.lesion.setPlacing}
        onPlate={world.engine.camera.clearPlate}
        onRoom={() => {
          // A sheet at the side takes none of the stage's height.
          if (!app.media.sideways) app.ports.lowerSheet();
        }}
        {commands}
        coordinatePopover={world.coordinates ? coordinatePopover : undefined}
        overlayPopover={world.userMap.available && model.manifest.coordinate_spaces
          ? overlayPopover
          : undefined}
      >
        {#snippet sectionPopover({ close })}
          <SectionPopover
            controls={stage.sections}
            lang={current.lang}
            phone={app.media.phone}
            {close}
          />
        {/snippet}
        {#snippet sectionBar()}
          <SectionBar
            controls={stage.sections}
            stage={app.stage}
            lang={current.lang}
            view={current}
            {tractReference}
            mriOpen={stage.mpr.open}
          />
        {/snippet}
        {#snippet lesionPopover({ close, placing, setPlacing })}
          <LesionPopover
            lesion={world.lesion}
            lang={current.lang}
            {placing}
            onPlacing={setPlacing}
            {reportShown}
            onReport={() => showReport(close)}
          />
        {/snippet}
      </Dock>
    {/if}
    <RegionNames
      engine={world.engine}
      shown={namesDrawn({
        namesShown: current.namesShown,
        exploded: current.exploded,
        tractReference,
        lessonOpen: current.explorer === 'circuits' && Boolean(current.lesson.circuit),
        mapOpen: visualFieldMapOpen(current) || bodyMapOpen(current),
        focused: current.focused,
        painted:
          current.explorer === 'functions' ||
          current.explorer === 'deficits' ||
          (Boolean(current.paint) && paintKind(current.paint) !== 'highlight'),
        tracts: current.explorer === 'diffusion',
      })}
      selected={current.selectedRegion?.id ?? null}
      lobes={keyedSurface(current) === 'lobe' && !current.paint ? lobes : null}
      nameOf={(id) => {
        const name = world.catalog.label(id).name;
        const side = t(current.lang, 'sides').words[world.regions.get(id)!.region.hemisphere];
        return { name, label: `${name}, ${side}` };
      }}
      label={t(current.lang, 'display').names}
      onSelect={world.anatomy.pickRegion}
    />
    {@const lessonCopy = t(current.lang, 'circuits')}
    <RouteMarks
      engine={world.engine}
      marks={current.explorer === 'circuits' &&
      current.lesson.circuit &&
      current.lesson.route &&
      !current.exploded
        ? world.circuits.get(current.lesson.circuit).steps.map((step, index) => ({
            region: step.region,
            label: lessonCopy.routeMark(index, step.name[current.lang]),
          }))
        : []}
      label={lessonCopy.wholeRoute}
      onOpen={(index) => app.ports.openLessonStep(index)}
    />
    {#if world.engine.model.manifest.retinotopy}
      <VisualAreaNames
        engine={world.engine}
        shown={world.visualFieldMap.areasShown && visualFieldMapOpen(current)}
        names={world.engine.model.manifest.retinotopy.visual_areas.areas.map(({ name }) => name)}
      />
    {/if}
    <OrientationGizmo
      engine={world.engine}
      stage={app.stage}
      lang={current.lang}
      ready={modelUsable(current.status)}
      viewName={current.view}
      {commands}
    />
    {@const mapsDrawn = world.userMap.drawnMaps}
    {@const againstMap = comparesMap(current, mapsDrawn.length === 1, model.domains!)}
    <StageKeys
      bind:this={keys}
      stage={app.stage}
      media={app.media}
      lang={current.lang}
      status={current.status}
      surfaceColor={tractReference || visualFieldMapOpen(current) || bodyMapOpen(current)
        ? 'tissue'
        : keyedSurface(current)}
      networks={(model.manifest.networks as ColoredNetworks | undefined) ?? null}
      cabNp={model.cabNp}
      territories={model.manifest.arterial_territories?.territories ?? null}
      cerebellar={model.manifest.cerebellar_functions?.regions ?? null}
      thickness={model.manifest.cortical_thickness?.display_range_mm ?? null}
      sulc={sulcExtent(model.manifest.appearance.field_ranges)}
      {lobes}
      legend={tractReference || (mapsDrawn.length && !againstMap)
        ? null
        : legendFor(
            // The paint the session asks for, which the model may not show yet (syncPaint runs in
            // the world's own effect root), as legacy keyed the paint it had just set (app.js:1613).
            {
              ...current,
              paint: paintFor(current, {
                domains: model.domains!,
                clinical: world.clinical,
                lesion: world.lesion.paint,
                connectivity: model.connectivity,
                disorders: model.disorders,
                layers: world.corticalLayers.data,
                mapsDrawn: mapsDrawn.length,
                highlights: world.highlights.list,
              }),
            },
            {
              domains: model.domains!,
              clinical: world.clinical,
              drawn: (id) => visibilityOf(world.regions.get(id)!.region, current).visible,
              lesion: world.lesion.paint,
              connectivity: model.connectivity,
              disorders: model.disorders,
              layers: world.corticalLayers.data,
              label: (id) =>
                `${world.catalog.label(id).name} · ${t(current.lang, 'sides').words[world.regions.get(id)!.region.hemisphere]}`,
              named: (id) =>
                `${world.catalog.label(id).name}, ${t(current.lang, 'sides').words[world.regions.get(id)!.region.hemisphere]}`,
              map: againstMap
                ? {
                    title: mapKey(mapsDrawn[0]!, current.lang)!.title,
                    threshold: mapsDrawn[0]!.settings.threshold,
                  }
                : null,
            },
          )}
      cases={!tractReference && world.strokeCases.cohort.status === 'ready'
        ? casesKey(world.strokeCases.cohort.data, world.strokeCases.chosen, current.lang)
        : null}
      maps={tractReference || againstMap ? [] : mapKeys(world.userMap, current.lang)}
      {directionShown}
      onPaintPick={world.excursions.pickPaint}
      networkMatrix={Boolean(model.manifest.network_matrix)}
      onPlateAction={(_, event) => openNetworkMatrix(event)}
    />
  {/if}
  {#if fullscreen}
    <!-- Kept mounted: the attachment shows it in full screen and hands focus over (g6-fullscreen-focus). -->
    <button
      type="button"
      class="exit-fullscreen"
      {@attach fullscreen.exitControl}
      onclick={() => fullscreen.toggle()}
    >
      {@render iconGraphic('fullscreen')}
      {t(world?.view.current.lang ?? app!.language.current, 'viewport').exitFullscreen}
    </button>
  {/if}
  {@render children?.()}
</main>

{#if app && world && stage}
  {@const current = world.view.current}
  {@const engine = world.engine}
  {#if LinkedMri}
    <LinkedMri
      bind:this={linkedMri}
      mpr={stage.mpr}
      engine={world.engine}
      engineState={world.engineState}
      lang={current.lang}
      anatomy={world.engine.model.manifest.anatomy}
      agreementName={agreementName(world)}
      regionName={(id) => world.catalog.label(id).name}
      fallbackFocus={() => sectionToolOrCanvas(engine.canvas)}
      maps={world.userMap.drawn
        ? {
            key: JSON.stringify(
              world.userMap.drawnMaps.map((map) => [map.slot, map.space, map.settings, map.placed]),
            ),
            drawn: world.userMap.drawnMaps.map(({ slot, title, statistic }) => ({
              slot,
              title,
              statistic,
            })),
          }
        : null}
      tracts={current.anatomy === engine.tracts.anatomy
        ? { key: `${tractsEpoch}|${app.tractsMinimum}` }
        : null}
    />
  {/if}
  {@const manifest = world.engine.model.manifest}
  {@const networks = manifest.networks as ColoredNetworks | undefined}
  {#if NetworkMatrix && manifest.network_matrix && networks}
    <NetworkMatrix
      bind:open={matrixOpen}
      bind:instant={matrixInstant}
      lang={current.lang}
      url={new URL(
        manifest.network_matrix.file,
        new URL(`${ASSET_BASE}models/${manifest.anatomy.id}/`, globalThis.location.href),
      )}
      {networks}
      fallbackFocus={() => engine.canvas}
    />
  {/if}
{/if}

<style>
  @layer features {
    /* Where the exit control starts: under the top letter's line. Phones set that letter a line under the scale bar (Orientation.svelte). */
    :global(#viewport) {
      --exit-top: calc(var(--stage-gutter) + var(--lh-caption) + var(--space-2));
    }
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      :global(#viewport) {
        --exit-top: calc(
          var(--stage-gutter) + 2 * var(--lh-caption) + var(--space-1) + var(--space-2)
        );
      }
    }
    /* As the Overlay words a file it cannot read. */
    .overlay-failed {
      margin: 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--danger);
    }
    /* A frame's section row stands where the dock would, on its plate, drawn only while a plane is cut. */
    .embed-dock {
      position: absolute;
      z-index: 3;
      left: calc(var(--vis-left) + var(--stage-gutter));
      bottom: calc(var(--vis-bottom) + var(--stage-gutter));
      width: max-content;
      max-width: calc(100% - var(--vis-left) - var(--vis-right) - 2 * var(--stage-gutter));
      border: 1px solid transparent;
      border-radius: var(--radius-control);
    }
    .embed-dock:has(> :global(.section-bar:is([data-shown], [data-failed]))) {
      border-color: var(--stage-edge);
      background: var(--overlay-plate);
    }
    /* No tools under it to be ruled off from. */
    .embed-dock > :global(.section-bar) {
      border-bottom: 0;
    }
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .embed-dock:has(> :global(.section-bar[data-shown])) {
        width: calc(100% - var(--vis-left) - var(--vis-right) - 2 * var(--stage-gutter));
      }
    }
    /* The exit control: top end of the stage, on an opaque plate, clear of the keys (pushed below it), the letters and the dock (WCAG 2.4.11). */
    .exit-fullscreen {
      position: absolute;
      z-index: 4;
      /* Below the top letter's line, which a wide plate would cover on a phone. */
      top: calc(var(--vis-top) + var(--exit-top));
      right: calc(var(--vis-right) + var(--stage-gutter));
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 24px;
      min-height: var(--control-height);
      padding: 0 var(--space-3);
      border: 1px solid var(--stage-edge);
      border-radius: var(--radius-control);
      background: var(--overlay-plate);
      color: var(--overlay-ink);
      font-size: var(--text-stage);
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    .exit-fullscreen:active:not(:focus-visible) {
      transform: scale(var(--press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      .exit-fullscreen:hover {
        background: var(--overlay-plate-hover);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .exit-fullscreen {
        transition-property: background-color;
      }
      .exit-fullscreen:active:not(:focus-visible) {
        transform: none;
      }
    }
    :global(.exit-fullscreen[hidden]) {
      display: none;
    }
    @media (pointer: coarse) {
      .exit-fullscreen {
        min-height: 44px;
        min-width: 44px;
      }
    }
    :global(#viewport:fullscreen .orientation-gizmo) {
      top: calc(
        var(--vis-top) + var(--key-top) + var(--exit-top) + var(--control-height) + var(--space-2)
      );
    }
    :global(#viewport:fullscreen .stage-keys) {
      top: calc(var(--vis-top) + var(--exit-top) + var(--control-height) + var(--space-2));
      max-height: calc(
        100% - var(--vis-top) - var(--vis-bottom) - 2 * var(--stage-gutter) - var(--dock-height) -
          var(--exit-top) - var(--control-height) - var(--space-2)
      );
    }
    /* A raised phone sheet leaves the picture a strip: the tools and markings would collide in it (stage.css:720-721). */
    :global(
      #viewport[data-sheet-full='true']
        :is(.stage-dock, .scale-bar, .orientation, .orientation-gizmo, .route-marks)
    ) {
      visibility: hidden;
    }
    /* The keys stay over that strip; with the dock hidden, they keep the room it took, so a title is never cut. */
    :global(#viewport[data-sheet-full='true'] .stage-keys) {
      max-height: calc(100% - var(--vis-top) - var(--vis-bottom) - 2 * var(--stage-gutter));
    }
    /* An open popover covers most of the picture; markings left at its edges would label nothing (stage.css:722-725). */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      :global(#viewport:has(.stage-popover:not([hidden])) :is(.scale-bar, .orientation)) {
        visibility: hidden;
      }
    }
  }
</style>
