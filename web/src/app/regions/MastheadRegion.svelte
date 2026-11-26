<script lang="ts">
  import { untrack } from 'svelte';
  import { ASSET_BASE } from '../../../build/site.ts';
  import { paintedLayerSources } from '../../lib/core/catalog/cortical-layers.ts';
  import { DISORDER_ATLAS } from '../../lib/core/catalog/disorder-effects.ts';
  import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
  import { isIndependentTractReference } from '../../lib/core/diffusion/presentation.ts';
  import { embedCode, embedTitle } from '../../lib/core/embed.ts';
  import { failureNotice } from '../../lib/core/i18n/errors.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import {
    fetchReferenceLibrary,
    viewCitations,
    type OnScreen,
  } from '../../lib/core/panels/citations.ts';
  import { subjectName } from '../../lib/core/panels/header.ts';
  import type { PaletteSources } from '../../lib/core/panels/palettes.ts';
  import type { ProvenanceLink } from '../../lib/core/panels/provenance.ts';
  import type { View } from '../../lib/state/view.svelte.ts';
  import { visualFieldMapOpen } from '../../lib/state/visual-field-map.svelte.ts';
  import { bodyMapOpen } from '../../lib/state/body-map.svelte.ts';
  import { modelUsable } from '../../lib/core/state/session.ts';
  import type { Explorer, Language, ViewName } from '../../lib/types/index.ts';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import DataBar from '../../features/masthead/DataBar.svelte';
  import Masthead from '../../features/masthead/Masthead.svelte';
  import FeedbackDialog from '../../features/colophon/FeedbackDialog.svelte';
  import ShortcutsDialog from '../../features/shortcuts/ShortcutsDialog.svelte';
  import { ROOM_BESIDE_PLATE_PX } from '../../lib/state/stage-layout.svelte.ts';
  import { getApp } from '../application.svelte.ts';
  import { prefetchOtherAtlas } from '../boot.ts';

  let {
    lang,
    choosing = $bindable(false),
    isFullscreen,
    onFullscreen,
    onSnapshot,
    onCopyImage,
  }: {
    lang: Language;
    /** A data bar field holds a choice still downloading, so the status bar leaves the download to it. */
    choosing?: boolean;
    /** The stage region's, which owns the full-screen state (REGION-12). */
    isFullscreen: () => boolean;
    onFullscreen: () => void;
    /** Save image at `scale` image pixels per CSS pixel of the stage. */
    onSnapshot: (scale: number) => void;
    /** The stage as a captioned PNG, for Copy image; without it Copy image is not offered. */
    onCopyImage?: () => Promise<Blob>;
  } = $props();

  const app = getApp();
  const world = $derived(app.world);

  /** The address of the view on screen, written now rather than after the link writer's delay. */
  function currentLink() {
    if (world && !world.link.held) world.links.write();
    return location.href;
  }

  /** The frame a course page pastes for the view on screen, titled with what it shows. */
  function currentEmbedCode() {
    const href = currentLink();
    if (!world) return embedCode(href, 'Planum');
    const current = world.view.current;
    const { mode } = world.engine.sections.state;
    const title = embedTitle(current.lang, {
      subject: subjectName(world.engine.model.manifest.anatomy),
      atlas: current.atlas,
      view: world.engine.camera.viewHeld ? (current.view as ViewName) : null,
      section: mode === 'off' ? null : mode,
    });
    return embedCode(href, title);
  }
  const status = $derived(app.session.state.status);

  // The open data popover takes a band off the stage's left, as a stage popover does, so the camera
  // frames the anatomy beside it; not on a phone, nor where that would leave the anatomy too little room.
  let dataPanel = $state<{ right: number | null; immediate: boolean }>({
    right: null,
    immediate: false,
  });
  $effect(() => {
    const { right, immediate } = dataPanel;
    const { stage, media } = app;
    const visible = stage.visibleRect;
    const host = document.getElementById('viewport');
    let band = 0;
    if (right !== null && !media.phone && visible && host) {
      const wanted = right - host.getBoundingClientRect().left + stage.gutter - visible.x;
      if (visible.width - wanted >= ROOM_BESIDE_PLATE_PX) band = wanted;
    }
    untrack(() => stage.setDataBand(band, { immediate }));
  });

  // The preference is a plain store: the masthead's switch follows this copy of it.
  let singleKeys = $state(app.keyPreference.enabled);
  let settingsOpen = $state(false);

  let shortcutsOpen = $state(false);
  let shortcutsInstant = $state(false);
  let provenanceOpen = $state(false);
  let provenanceInstant = $state(false);
  let feedbackOpen = $state(false);
  let feedbackInstant = $state(false);

  // The dialog and the sources it lists are a chunk of their own (BUILD-15), fetched when first asked for.
  let Provenance =
    $state<typeof import('../../features/provenance/ProvenanceDialog.svelte').default>();

  /** The colophon's Provenance button, and the phone menu's item. */
  export function openProvenance(event: MouseEvent) {
    provenanceInstant = isKeyboardActivation(event);
    provenanceOpen = true;
    if (Provenance) return;
    import('../../features/provenance/ProvenanceDialog.svelte').then(
      (module) => (Provenance = module.default),
      (error: unknown) => {
        // Closed again, so another press asks again; the failure itself surfaces.
        provenanceOpen = false;
        throw error;
      },
    );
  }

  /**
   * The reader's own atlas while an open function or deficit shows its regions on another: the
   * item open in the tab in front set it, else the one still open in the other evidence tab.
   */
  function borrowedAtlas(current: {
    atlas: string;
    explorer: Explorer;
    selectedFunction: string | null;
    selectedDeficit: string | null;
  }) {
    const own = world?.excursions.heldAtlas;
    if (!own || own === current.atlas) return null;
    if (current.explorer !== 'functions' && current.explorer !== 'deficits') return null;
    const front =
      current.explorer === 'functions' ? current.selectedFunction : current.selectedDeficit;
    const other = current.explorer === 'functions' ? 'deficits' : 'functions';
    return { own, by: front ? current.explorer : other };
  }

  // The skip link: the model's canvas, else the stage, which takes focus when no canvas can (header.js:167-170).
  function skipToModel() {
    const canvas = world?.engine.canvas;
    canvas?.focus({ focusVisible: true });
    if (canvas && document.activeElement === canvas) return;
    document.getElementById('viewport')!.focus();
  }

  let masthead = $state<Masthead>();
  // The ⋯ button takes focus back when the menu item that opened a dialog is gone. A dialog closed
  // as the page unmounts finds the masthead already gone, and with it any button to focus.
  const settingsButton = () => masthead?.settingsButton() ?? null;

  // Another subject reloads the page, which would end the tour: the Subject list waits for it.
  let touring = $state(false);

  async function guide(short = false) {
    // The stops open regions, and with them their groups in the tree: closing folds those back.
    const expanded = new Set(app.session.state.expanded);
    // The tour and driver.js are a chunk of their own, fetched the first time the tour starts.
    let tour: typeof import('../../features/guide/tour.ts');
    try {
      tour = await import('../../features/guide/tour.ts');
    } catch (error) {
      console.error(error);
      app.session.notify(failureNotice(error, lang, 'guide'));
      return;
    }
    tour.startGuide(lang, {
      short,
      animate: !app.media.reducedMotion,
      onClose: ({ pointer }) => {
        touring = false;
        app.session.setExpanded(expanded);
        // A tap or click that ended the tour leaves no ring, and so no tooltip, over the stage.
        settingsButton()?.focus({ focusVisible: !pointer });
      },
      onLanguage: app.chooseLanguage,
      reserve: (band) => app.stage.setGuideInset(band),
      mri: {
        open(region: string) {
          world!.anatomy.selectRegion(region);
          return world!.excursions.openLinkedMri({ atRegion: true, instant: true });
        },
        openPaint: (paint) =>
          'function' in paint
            ? world!.excursions.openFunctionMri(paint.function, { instant: true })
            : world!.excursions.openDeficitMri(paint.deficit, null, { instant: true }),
        close: () => app.ports.closeMpr(),
      },
      onPick: (listener) => world!.engine.on('pick', ({ id }) => listener(id)),
      anchorOf: (region) => world!.engine.model.anchorOf(region),
      sheet: { raise: () => app.ports.revealOnSelect(), lower: () => app.ports.lowerSheet() },
    });
    // After the start: a tour already running closes inside it, and its close clears the flag.
    touring = true;
  }

  // The key that opens the shortcuts sheet, and the first launch's tour (ports.ts).
  $effect(() =>
    app.registerPorts({
      startGuide: guide,
      toggleShortcuts({ instant }) {
        shortcutsInstant = instant;
        shortcutsOpen = !shortcutsOpen;
      },
      shortcutsOpen: () => shortcutsOpen,
    }),
  );

  /** What on screen the provenance sheet's reference list cites. */
  function onScreen(current: View): OnScreen {
    const { clinical, strokeCases, corticalLayers } = world!;
    const deficit =
      current.explorer === 'deficits' && current.selectedDeficit
        ? clinical
            .forDeficit(current.selectedDeficit)
            .flatMap((finding) => finding.evidence)
            .map(({ reference: id }) => `https://doi.org/${clinical.reference(id).doi}`)
        : null;
    const tractsDrawn = current.explorer === 'diffusion' || current.keepTracts;
    return {
      ...current,
      deficit,
      // Each paint is cited only while drawn: not while a masthead choice lifts it, a disorder only
      // on its atlas, the layers only once their file arrives.
      connectivitySeed: current.paintLifted ? null : current.connectivitySeed,
      disorderShown:
        current.paintLifted || current.atlas !== DISORDER_ATLAS ? null : current.disorderShown,
      layers: paintedLayerSources(current, corticalLayers.data),
      tracts: tractsDrawn ? tractCatalog(current.referenceAnatomy).source : null,
      strokeCases: strokeCases.chosen.length > 0,
      visualFieldMap: visualFieldMapOpen(current),
      bodyMap: bodyMapOpen(current),
    };
  }

  /** The tract reference alone: another subject, named by the catalog, with the tracts panel's own links. */
  function reference(referenceAnatomy: string) {
    const catalog = tractCatalog(referenceAnatomy);
    const text = t(lang, 'diffusion');
    const links: ProvenanceLink[] = [
      { href: new URL(catalog.source, location.href).href, text: catalog.text[lang].source },
      {
        href: new URL(`${ASSET_BASE}diffusion/${catalog.brain_outline.provenance}`, location.href)
          .href,
        text: text.outlineProvenance,
      },
    ];
    return { label: catalog.name[lang], description: text.outlineLimit, links };
  }
</script>

<Masthead
  bind:this={masthead}
  {lang}
  themeChoice={app.theme.choice}
  {singleKeys}
  ready={modelUsable(status)}
  fullscreen={isFullscreen()}
  provenanceReady={world !== null}
  settingsDisabled={app.failure !== undefined}
  bind:settingsOpen
  onSkipToModel={skipToModel}
  onLanguage={app.chooseLanguage}
  onTheme={app.theme.choose}
  onSingleKeys={(on) => {
    app.keyPreference.set(on);
    singleKeys = on;
  }}
  {onFullscreen}
  {onSnapshot}
  {onCopyImage}
  {currentLink}
  {currentEmbedCode}
  onProvenance={openProvenance}
  onFeedback={(event) => {
    feedbackInstant = isKeyboardActivation(event);
    feedbackOpen = true;
  }}
  onGuide={() => guide()}
  onShortcuts={(event) => {
    shortcutsInstant = isKeyboardActivation(event);
    shortcutsOpen = true;
  }}
  onStartOver={() => world?.anatomy.startOver()}
>
  {#snippet data()}
    {#if world}
      {@const current = world.view.current}
      {@const { model } = world.engine}
      {@const { anatomy, excursions, commands } = world}
      {@const tractReference = isIndependentTractReference(current)}
      <DataBar
        lang={current.lang}
        status={current.status}
        progress={current.progress}
        atlas={current.atlas}
        surfaceColor={tractReference ? 'tissue' : current.surfaceColor}
        detail={current.detail}
        paint={current.paint}
        atlases={model.manifest.atlases.map(({ id }) => id)}
        detailLevels={model.manifest.detail_levels.map(({ id }) => id)}
        colourings={{
          // The stage key reads it so too (StageRegion.svelte).
          networks: model.manifest.networks as PaletteSources['networks'],
          cabNp: model.cabNp,
          territories: model.manifest.arterial_territories,
          striatal: model.manifest.striatal_networks,
          cerebellar: model.manifest.cerebellar_functions,
          thickness: model.manifest.cortical_thickness,
          sulc: model.manifest.appearance.field_ranges?.['_SULC'],
        }}
        anatomy={model.manifest.anatomy}
        anatomies={world.anatomies}
        reference={tractReference ? reference(current.referenceAnatomy) : null}
        borrowed={borrowedAtlas(current)}
        bind:settingsOpen
        bind:choosing
        onAtlas={(id) => anatomy.chooseLayer(() => excursions.chooseAtlas(id))}
        onAtlasIntent={() => prefetchOtherAtlas(model)}
        onSurfaceColor={(colour) =>
          anatomy.chooseLayer(() => excursions.chooseSurfaceColor(colour))}
        onDetail={(id) => anatomy.chooseLayer(() => commands.chooseDetail(id))}
        onAnatomy={world.links.switchAnatomy}
        {touring}
        onPanel={(right, immediate) => (dataPanel = { right, immediate })}
      />
    {/if}
  {/snippet}
</Masthead>

<ShortcutsDialog
  bind:open={shortcutsOpen}
  bind:instant={shortcutsInstant}
  {lang}
  {singleKeys}
  fallbackFocus={settingsButton}
/>
<FeedbackDialog
  bind:open={feedbackOpen}
  bind:instant={feedbackInstant}
  {lang}
  fallbackFocus={settingsButton}
/>
{#if world && Provenance}
  {@const { model } = world.engine}
  {@const current = world.view.current}
  {@const tractReference = isIndependentTractReference(current)}
  <Provenance
    bind:open={provenanceOpen}
    bind:instant={provenanceInstant}
    lang={current.lang}
    manifest={model.manifest}
    manifestUrl="{ASSET_BASE}models/{model.manifest.anatomy.id}/manifest.json"
    indexUrl="{ASSET_BASE}models/anatomies.json"
    domains={model.domains}
    reference={tractReference ? reference(current.referenceAnatomy) : null}
    fallbackFocus={settingsButton}
    citations={viewCitations(model.manifest, onScreen(current))}
    loadReferences={() => fetchReferenceLibrary(ASSET_BASE)}
  />
{/if}
