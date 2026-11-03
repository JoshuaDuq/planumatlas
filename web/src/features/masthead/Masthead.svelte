<!--
  The masthead (index.html:96-153, viewer/ui/chrome/header.js:96-243, styles/masthead.css:1-70,
  308-364, 365-452): the skip link, the brand, the data group H3 supplies as `data`, then
  Full screen, Save image, Copy link and the ⋯ settings panel. Full screen and Save image only
  emit; G6 owns what they do. Copy link copies the address, whose hash holds the whole view. The page mounts one Tooltip (U5) for the `data-tooltip` triggers.
-->
<script lang="ts">
  import { onDestroy, type Snippet } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { ThemeChoice } from '../../lib/state/theme.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { createCopier } from '../../lib/ui/clipboard.svelte.ts';
  import IconButton, { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/ui/keys.ts';
  import SettingsMenu from './SettingsMenu.svelte';

  interface Props {
    lang: Language;
    themeChoice: ThemeChoice;
    singleKeys: boolean;
    /** The anatomy is on screen (status `ready` or `switching`). */
    ready: boolean;
    /** The stage is fullscreen, from `fullscreenchange`: the labels become "Exit full screen". */
    fullscreen: boolean;
    provenanceReady: boolean;
    /** The settings panel; H3's data popover closes it by setting this false. */
    settingsOpen?: boolean;
    /** The start failed: ⋯ is disabled, as legacy leaves it (app.js:183-189). */
    settingsDisabled?: boolean;
    /** The data group (H3), composed in by I3b. */
    data?: Snippet;
    onSkipToModel: () => void;
    onLanguage: (lang: Language) => void;
    onTheme: (choice: ThemeChoice) => void;
    onSingleKeys: (on: boolean) => void;
    onFullscreen: () => void;
    onSnapshot: () => void;
    /** The address of the view on screen, written now rather than after the link writer's delay. */
    currentLink: () => string;
    /** Given the click, so the dialog opens without its entry animation from the keyboard. */
    onProvenance: (event: MouseEvent) => void;
    onGuide: (event: MouseEvent) => void;
    onShortcuts: (event: MouseEvent) => void;
    onStartOver: () => void;
  }

  let {
    lang,
    themeChoice,
    singleKeys,
    ready,
    fullscreen,
    provenanceReady,
    settingsOpen = $bindable(false),
    settingsDisabled = false,
    data,
    onSkipToModel,
    onLanguage,
    onTheme,
    onSingleKeys,
    onFullscreen,
    onSnapshot,
    currentLink,
    onProvenance,
    onGuide,
    onShortcuts,
    onStartOver,
  }: Props = $props();

  let menu: SettingsMenu;
  /** The ⋯ button, for a dialog whose opener has gone to hand focus to. */
  export function settingsButton(): HTMLElement | null {
    return menu.button();
  }

  // Asked once, as legacy does (header.js:192).
  const fullscreenAvailable = document.fullscreenEnabled;

  const viewport = $derived(t(lang, 'viewport'));
  const header = $derived(t(lang, 'header'));
  const fullscreenLabel = $derived(fullscreen ? viewport.exitFullscreen : viewport.fullscreen);

  $effect(() => {
    document.documentElement.dataset.singleKeys = singleKeys ? 'on' : 'off';
  });

  const link = createCopier(() => ({ copied: header.linkCopied, failed: header.linkFailed }));
  onDestroy(link.dispose);
  const copyLink = () => link.copy(currentLink());

  // The href works without script; the model's canvas is the better target (header.js:167-170).
  function skip(event: MouseEvent) {
    event.preventDefault();
    onSkipToModel();
  }
</script>

<header id="masthead" {...{ [OWN_KEYS_ATTRIBUTE]: '' }}>
  <a class="skip-link" href="#viewport" onclick={skip}>{header.skipToModel}</a>
  <div class="identity">
    <span class="brand-mark" aria-hidden="true">{@render iconGraphic('brand')}</span>
    <h1 class="brand">Planum</h1>
  </div>
  {@render data?.()}
  <div class="masthead-end">
    <!-- Disabled until the anatomy is on screen: there is nothing to enlarge or save before. -->
    {#if fullscreenAvailable}
      <IconButton
        class="fullscreen-button"
        icon="fullscreen"
        label={fullscreenLabel}
        data-tooltip={fullscreenLabel}
        disabled={!ready}
        {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
        onclick={onFullscreen}
      />
    {/if}
    <IconButton
      icon="camera"
      label={viewport.snapshot}
      data-tooltip={viewport.snapshot}
      disabled={!ready}
      {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
      onclick={onSnapshot}
    />
    <IconButton
      class="copy-link-button"
      icon={link.state === 'copied' ? 'check' : 'link'}
      data-copied={link.state === 'copied' || undefined}
      label={header.copyLink}
      data-tooltip={header.copyLink}
      {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
      onclick={copyLink}
    />
    <SettingsMenu
      bind:this={menu}
      disabled={settingsDisabled}
      {lang}
      {themeChoice}
      {singleKeys}
      {ready}
      {fullscreenAvailable}
      {fullscreenLabel}
      {provenanceReady}
      bind:open={settingsOpen}
      {onLanguage}
      {onTheme}
      {onSingleKeys}
      {onFullscreen}
      onCopyLink={copyLink}
      {onProvenance}
      {onGuide}
      {onShortcuts}
      {onStartOver}
    />
    {#if link.state !== 'idle'}
      <span class="link-said" aria-hidden="true">
        {link.state === 'copied' ? header.linkCopied : header.linkFailed}
      </span>
    {/if}
  </div>
</header>

<style>
  @layer features {
    /* One compact instrument bar; task navigation belongs to the panel below. */
    #masthead {
      --masthead-gap: var(--panel-inset);
      /* The last icon's glyph, not its ground, ends on the stage gutter, over the stage's own right-hand chrome. */
      --masthead-end: calc(var(--stage-gutter) - (var(--control-height) - 16px) / 2);
      position: relative;
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: calc(var(--rail-width) - 2 * var(--panel-inset)) minmax(0, 1fr) auto;
      grid-template-rows: minmax(0, 1fr);
      align-items: center;
      column-gap: var(--masthead-gap);
      min-width: 0;
      padding: 0 var(--masthead-end) 0 var(--panel-inset);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface-base);
      z-index: 40;
    }
    .identity {
      grid-column: 1;
      grid-row: 1;
      display: flex;
      flex: none;
      align-items: center;
      gap: var(--space-2);
      align-self: stretch;
    }
    .brand-mark {
      display: flex;
      flex: none;
      width: 24px;
      height: 24px;
      color: var(--text-primary);
    }
    .brand-mark :global(svg) {
      width: 100%;
      height: 100%;
    }
    .brand {
      font-size: var(--text-brand);
      font-weight: 600;
      line-height: var(--lh-title);
      letter-spacing: -0.02em;
      white-space: nowrap;
    }
    .masthead-end {
      position: relative;
      grid-column: 3;
      grid-row: 1;
      display: flex;
      flex: none;
      align-items: center;
      gap: var(--space-1);
      margin-left: auto;
      padding-left: var(--space-2);
    }
    /* Said under the commands, over the stage's edge, for as long as the copier holds it. */
    .link-said {
      position: absolute;
      top: calc(100% + var(--space-1));
      right: 0;
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--overlay-border);
      border-radius: var(--radius-control);
      background: var(--overlay-plate);
      color: var(--overlay-ink);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      white-space: nowrap;
      pointer-events: none;
      transition: opacity var(--tooltip-transition) var(--ease-ui);
    }
    @starting-style {
      .link-said {
        opacity: 0;
      }
    }
    .masthead-end :global(.copy-link-button[data-copied]) {
      color: var(--accent);
    }
    /* One ground for everything pointed at in the bar: the selects', the summary's and the icons'. */
    @media (hover: hover) and (pointer: fine) {
      .masthead-end :global(.icon-button:hover:not(:disabled)) {
        background: var(--surface-tonal);
      }
    }

    /* Hidden until a keyboard reaches it: the first stop on the page. */
    .skip-link {
      position: absolute;
      top: var(--space-2);
      left: var(--space-2);
      z-index: 60;
      display: inline-flex;
      align-items: center;
      min-height: var(--control-height);
      padding: var(--space-1) var(--space-3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-control);
      background: var(--surface-base);
      box-shadow: var(--shadow-popover);
      color: var(--accent);
      font-size: var(--text-ui);
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
    }
    .skip-link:not(:focus) {
      width: 1px;
      height: 1px;
      min-height: 0;
      padding: 0;
      border: 0;
      overflow: hidden;
      clip-path: inset(50%);
    }

    /* Phones: the mark alone names the app; Full screen moves into the settings panel. */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      #masthead {
        display: flex;
        --masthead-gap: var(--space-2);
        grid-column: 1;
        grid-row: 1;
        gap: var(--space-2);
        min-height: var(--header-height);
        /* The mark stands on the sheet's text column, inside the safe area as the sheet's text does. */
        padding: env(safe-area-inset-top) max(var(--space-1), env(safe-area-inset-right)) 0
          calc(var(--space-4) + env(safe-area-inset-left));
      }
      .brand {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .identity {
        align-self: center;
      }
      .brand-mark {
        width: 22px;
        height: 22px;
      }
      .masthead-end {
        gap: 0;
        padding-left: 0;
      }
      .masthead-end :global(.fullscreen-button),
      .masthead-end :global(.copy-link-button) {
        display: none;
      }
    }
  }

  @layer a11y {
    @media (forced-colors: active) {
      .link-said {
        border-color: CanvasText;
      }
    }
  }
</style>
