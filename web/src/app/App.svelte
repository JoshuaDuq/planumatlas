<script lang="ts">
  import './layout.css';
  import { getApp } from './application.svelte.ts';
  import { withEmbed } from '../lib/core/embed.ts';
  import { t } from '../lib/core/i18n/index.ts';
  import { subjectName } from '../lib/core/panels/header.ts';
  import { modelUsable } from '../lib/core/state/session.ts';
  import { decodeState } from '../lib/core/state/url-state.ts';
  import { startLanguage } from '../lib/state/language.svelte.ts';
  import { PREF_KEYS, readPref } from '../lib/state/prefs.ts';
  import type { Language, SessionState } from '../lib/types/index.ts';
  import Tooltip from '../lib/ui/Tooltip.svelte';
  import EmbedLine from '../features/embed/EmbedLine.svelte';
  import EmbedPoster from '../features/embed/EmbedPoster.svelte';
  import StageStatus from '../features/stage/StageStatus.svelte';
  import MastheadRegion from './regions/MastheadRegion.svelte';
  import PanelsRegion from './regions/PanelsRegion.svelte';
  import StageRegion from './regions/StageRegion.svelte';
  import StatusRegion from './regions/StatusRegion.svelte';

  // The status and language follow the app (`shellOptions`); a bare shell starts loading, in the
  // language the head script of index.html already put on <html>.
  let {
    status = 'loading',
    lang = startLanguage(
      decodeState(location.hash).state.lang,
      readPref(PREF_KEYS.language),
      navigator.languages,
    ),
  }: {
    status?: SessionState['status'];
    lang?: Language;
  } = $props();

  const app = getApp();
  const { embed } = app;

  let stage = $state<StageRegion>();
  let masthead = $state<MastheadRegion>();
  let choosing = $state(false);

  // `#app` is the mount point and the grid, so the legacy `#app[data-status]` selectors keep working.
  $effect(() => {
    const root = document.getElementById('app')!;
    root.dataset.status = status;
    root.toggleAttribute('data-embed', embed !== null);
  });

  // A frame mounts no panels, tour or shortcuts sheet: what they would show is not shown.
  $effect(() => {
    if (!embed) return;
    const none = () => {};
    return app.registerPorts({
      showDetail: none,
      showDetailInPlace: none,
      showList: none,
      revealOnSelect: none,
      lowerSheet: none,
      readingPlace: () => null,
      markReadingPlace: none,
      restoreReadingPlace: none,
      back: none,
      focusSearch: none,
      walkTree: none,
      toggleShortcuts: none,
      startGuide: none,
      openFunction: none,
      openDeficit: none,
      openLessonMri: none,
      openLessonStep: none,
      showTracts: async () => {},
    });
  });

  /** The address of the view on screen, written now rather than after the link writer's delay. */
  function currentLink() {
    const { world } = app;
    if (world && !world.link.held) world.links.write();
    return location.href;
  }

  /** What an embedded stage's line names: the subject, and a region the reader picked. */
  const embedded = $derived.by(() => {
    const { world } = app;
    if (!world) return { subject: subjectName(embed?.subject), selection: null };
    const current = world.view.current;
    const region = current.selectedRegion;
    return {
      subject: subjectName(world.engine.model.manifest.anatomy),
      selection:
        region &&
        `${world.catalog.label(region.id).name}, ${t(current.lang, 'sides').words[region.hemisphere]}`,
    };
  });

  // Asked once, as the masthead does.
  const fullscreenAvailable = document.fullscreenEnabled;
</script>

<!-- One tooltip for every `data-tooltip` on the page. -->
<Tooltip />
{#if embed}
  <StageRegion bind:this={stage}>
    {#if embed.invited || app.failure}
      <StageStatus
        {status}
        {lang}
        progress={app.session.state.progress ?? undefined}
        failure={app.failure}
      />
    {:else}
      <EmbedPoster
        {lang}
        onLoad={() => {
          embed.invite();
          // The control goes with the poster; the stage keeps focus for the keys.
          document.getElementById('viewport')!.focus();
        }}
      />
    {/if}
  </StageRegion>
  <EmbedLine
    {lang}
    subject={embedded.subject}
    selection={embedded.selection}
    viewHref={() => withEmbed(currentLink(), false)}
    fullscreen={fullscreenAvailable
      ? {
          active: stage?.isFullscreen() ?? false,
          ready: modelUsable(status),
          toggle: () => stage!.toggleFullscreen(),
        }
      : null}
  />
{:else}
  <MastheadRegion
    bind:this={masthead}
    bind:choosing
    {lang}
    isFullscreen={() => stage?.isFullscreen() ?? false}
    onFullscreen={() => stage!.toggleFullscreen()}
    onSnapshot={(scale) => void stage!.saveImage(scale)}
    onCopyImage={() => stage!.imagePng()}
  />
  <PanelsRegion {lang} />
  <StageRegion bind:this={stage}>
    <StageStatus
      {status}
      {lang}
      progress={app.session.state.progress ?? undefined}
      failure={app.failure}
    />
  </StageRegion>
  <StatusRegion {lang} {choosing} onProvenance={(event) => masthead!.openProvenance(event)} />
{/if}
