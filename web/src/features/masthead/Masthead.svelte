<!--
  The masthead (index.html:96-153, viewer/ui/chrome/header.js:96-243, styles/masthead.css:1-70,
  308-364, 365-452): the skip link, the brand, the data group H3 supplies as `data`, then
  Full screen, Save image, Share, the GitHub link, Contact and the ⋯ settings panel. Full screen and Save image only
  emit; G6 owns what they do. Save image and Share are menus (APG Disclosure, as ⋯ is): Save image
  offers 2× and 3× and Copy image, Share copies the address, whose hash holds the whole view, or
  the frame a course page pastes. The page mounts one Tooltip (U5) for the `data-tooltip` triggers.
-->
<script lang="ts">
  import { onDestroy, type Snippet } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { ThemeChoice } from '../../lib/state/theme.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';
  import { createCopier } from '../../lib/ui/clipboard.svelte.ts';
  import IconButton, { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/core/keyboard.ts';
  import { SOURCE_HREF } from '../../lib/core/methods.ts';
  import Popover from '../../lib/ui/Popover.svelte';
  import ContactMenu from './ContactMenu.svelte';
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
    /** Save image at `scale` image pixels per CSS pixel of the stage. */
    onSnapshot: (scale: number) => void;
    /** The stage as a captioned PNG, for Copy image; without it Copy image is not offered. */
    onCopyImage?: (() => Promise<Blob>) | undefined;
    /** The address of the view on screen, written now rather than after the link writer's delay. */
    currentLink: () => string;
    /** The `<iframe>` a course page pastes for the view on screen. */
    currentEmbedCode: () => string;
    /** Given the click, so the dialog opens without its entry animation from the keyboard. */
    onProvenance: (event: MouseEvent) => void;
    onFeedback: (event: MouseEvent) => void;
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
    onCopyImage,
    currentLink,
    currentEmbedCode,
    onProvenance,
    onFeedback,
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
  // Firefox before 127 has no ClipboardItem, so no way to copy an image.
  const imageCopyable = typeof ClipboardItem === 'function';

  /** Image pixels per CSS pixel of the stage that Save image offers. */
  const SCALES = [2, 3] as const;
  let saveOpen = $state(false);
  let shareOpen = $state(false);

  const viewport = $derived(t(lang, 'viewport'));
  const header = $derived(t(lang, 'header'));
  const link = $derived(t(lang, 'link'));
  const fullscreenLabel = $derived(fullscreen ? viewport.exitFullscreen : viewport.fullscreen);

  $effect(() => {
    document.documentElement.dataset.singleKeys = singleKeys ? 'on' : 'off';
  });

  // One copier for the link, the embed code and the image: what it says is the last one asked for.
  type Copying = 'link' | 'embed' | 'image';
  let copying = $state<Copying>('link');
  const said = $derived({
    link: { copied: header.linkCopied, failed: header.linkFailed },
    embed: { copied: header.embedCopied, failed: header.embedFailed },
    image: { copied: viewport.imageCopied, failed: viewport.imageFailed },
  });
  const copier = createCopier(() => said[copying]);
  onDestroy(copier.dispose);
  function copy(kind: Copying, content: string | Promise<Blob>) {
    copying = kind;
    void copier.copy(content);
  }
  const copyLink = () => copy('link', currentLink());
  // The Share trigger shows the check for what it copied, not for an image.
  const linkCopied = $derived(copier.state === 'copied' && copying !== 'image');

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
    <Popover bind:open={saveOpen} class="masthead-menu">
      {#snippet trigger({ props })}
        <!-- Bits adds aria-haspopup="dialog"; this is a disclosure of plain commands, as ⋯ is. -->
        <IconButton
          {...props}
          aria-haspopup={undefined}
          icon="camera"
          label={viewport.snapshot}
          data-tooltip={viewport.snapshot}
          disabled={!ready}
          {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
        />
      {/snippet}
      {#snippet children({ close })}
        {#each SCALES as scale (scale)}
          <button
            type="button"
            class="menu-item"
            {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
            onclick={() => {
              close();
              onSnapshot(scale);
            }}
          >
            {viewport.snapshotAt(scale)}
          </button>
        {/each}
        {#if onCopyImage && imageCopyable}
          {@const png = onCopyImage}
          <!-- The clipboard is asked inside the press (createCopier), then the menu closes. -->
          <button
            type="button"
            class="menu-item"
            {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
            onclick={() => {
              copy('image', png());
              close();
            }}
          >
            {viewport.copyImage}
          </button>
        {/if}
      {/snippet}
    </Popover>
    <Popover bind:open={shareOpen} class="masthead-menu">
      {#snippet trigger({ props })}
        <IconButton
          {...props}
          aria-haspopup={undefined}
          class="copy-link-button"
          icon={linkCopied ? 'check' : 'link'}
          data-copied={linkCopied || undefined}
          label={header.shareView}
          data-tooltip={header.shareView}
          {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
        />
      {/snippet}
      {#snippet children({ close })}
        <button
          type="button"
          class="menu-item"
          {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
          onclick={() => {
            copyLink();
            close();
          }}
        >
          {header.copyLink}
        </button>
        <button
          type="button"
          class="menu-item"
          {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
          onclick={() => {
            copy('embed', currentEmbedCode());
            close();
          }}
        >
          {header.copyEmbed}
        </button>
      {/snippet}
    </Popover>
    <a
      class="source-link"
      href={SOURCE_HREF}
      target="_blank"
      rel="noreferrer"
      aria-label="{link.source} {link.newTab}"
      data-tooltip={link.source}
      {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
    >
      {@render iconGraphic('github')}
    </a>
    <ContactMenu {lang} />
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
      {onFeedback}
      {onGuide}
      {onShortcuts}
      {onStartOver}
    />
    {#if copier.state !== 'idle'}
      <span class="link-said" aria-hidden="true">
        {said[copying][copier.state]}
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
    .source-link {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: var(--control-height);
      height: var(--control-height);
      border-radius: var(--radius-control);
      color: var(--text-secondary);
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        color var(--ui-transition) var(--ease-ui);
    }
    @media (hover: hover) and (pointer: fine) {
      .source-link:hover {
        background: var(--surface-tonal);
        color: var(--text-primary);
      }
    }
    @media (pointer: coarse) {
      .source-link {
        min-width: 44px;
        min-height: 44px;
      }
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
    /* Save image's and Share's commands, on the ⋯ panel's rows (SettingsMenu.svelte). */
    :global(.popover.masthead-menu) {
      display: flex;
      flex-direction: column;
      width: max-content;
      min-width: 12rem;
    }
    .menu-item {
      display: flex;
      align-items: center;
      width: 100%;
      min-height: calc(var(--control-height) + 2 * var(--space-1));
      padding: var(--space-1) var(--space-3);
      border: 0;
      border-radius: 0;
      background: none;
      color: var(--text-primary);
      font: inherit;
      font-size: var(--text-ui);
      text-align: left;
      white-space: nowrap;
      cursor: pointer;
    }
    .menu-item:not(:last-child) {
      border-bottom: 1px solid var(--border-subtle);
    }
    .menu-item:focus-visible {
      outline-offset: -2px;
    }
    @media (hover: hover) and (pointer: fine) {
      .menu-item:hover {
        background: var(--surface-hover);
      }
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

    /* Phones: the mark alone names the app; Full screen, Share, the source and Contact move into the settings panel. */
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
      .masthead-end :global(.copy-link-button),
      .source-link {
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
