<!--
  The status bar (index.html:593-597, ui/chrome/header.js:536-542): the statement that this is
  not clinical anatomy never truncates; the description of what is loaded gives way; then the
  display settings away from their defaults with Reset display, the count and the Provenance button. A plain <footer>, no live region (the count changes are
  visual; mode and selection changes announce through the announcer). Phones hide it: the
  statement moves to the sheet grip and Provenance to the ⋯ menu (phone.css:48-49).
  The button exists once the owner supplies `onprovenance` (legacy shipped it hidden until boot).
-->
<script lang="ts">
  import { tick } from 'svelte';
  import type { Language } from '../../lib/types/index.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { colophonParts } from '../../lib/core/panels/header.ts';

  interface Props {
    lang: Language;
    anatomy?: { display_name?: string; subject?: string; id?: string; individual: boolean };
    reference?: { label: string };
    /** The count's text (`regionCountText`); empty hides it. */
    regionCount: string;
    /** The display settings away from their defaults (`displayChanges`); none hides the readout. */
    displayChanges?: readonly string[];
    onresetdisplay?: () => void;
    onprovenance?: (event: MouseEvent) => void;
  }

  let {
    lang,
    anatomy,
    reference,
    regionCount,
    displayChanges = [],
    onresetdisplay,
    onprovenance,
  }: Props = $props();

  const parts = $derived(colophonParts(lang, { anatomy, reference }));

  let provenance = $state<HTMLButtonElement>();

  /** The readout and its button go with the reset, so focus moves on to Provenance. */
  async function reset(event: MouseEvent) {
    const hadFocus = document.activeElement === event.currentTarget;
    onresetdisplay!();
    await tick();
    if (hadFocus) provenance!.focus();
  }
</script>

<footer id="colophon" class="colophon">
  <p class="colophon-text">
    <span class="colophon-statement">{parts.statement}</span>
    <span class="colophon-description">{parts.description}</span>
  </p>
  {#if displayChanges.length && onresetdisplay}
    <span class="display-changes">
      <span class="display-changes-text">{displayChanges.join(' · ')}</span>
      <button type="button" class="reset-display" onclick={reset}>
        {t(lang, 'display').resetDisplay}
      </button>
    </span>
  {/if}
  <span class="region-count">{regionCount}</span>
  {#if onprovenance}
    <button
      bind:this={provenance}
      type="button"
      class="provenance-opener"
      aria-haspopup="dialog"
      onclick={onprovenance}
    >
      {t(lang, 'footer').provenance}
    </button>
  {/if}
</footer>

<style>
  @layer features {
    /* masthead.css:453-509. A compact status line keeps the dataset and its limits in view. */
    .colophon {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: var(--space-4);
      /* Starts on the panel's column and ends on the stage gutter, as the masthead does. */
      padding: 0 var(--stage-gutter) 0 var(--panel-inset);
      border-top: 1px solid var(--border-subtle);
      background: var(--surface-base);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
      white-space: nowrap;
    }
    .colophon-text {
      display: flex;
      flex: 1 1 0;
      align-items: center;
      gap: var(--space-3);
      margin: 0;
    }
    /* The statement never gives way; the description does. */
    .colophon-statement {
      flex: none;
      font-weight: 500;
    }
    /* No width of its own: it takes what the readout and count leave, so it gives way before them. */
    .colophon-description {
      flex: 1 1 auto;
      width: 0;
      min-width: 0;
      padding-left: var(--space-3);
      border-left: 1px solid var(--border-subtle);
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .colophon-description:empty,
    .region-count:empty {
      display: none;
    }
    .region-count {
      flex: none;
      font-variant-numeric: tabular-nums;
    }
    /* The display settings in effect, after a hairline like the description's, then their reset. */
    .display-changes {
      display: flex;
      flex: 0 1 auto;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
      padding-left: var(--space-3);
      border-left: 1px solid var(--border-subtle);
    }
    .display-changes-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* A text link, as Restore previous view is. */
    .reset-display {
      flex: none;
      align-self: stretch;
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .reset-display:hover {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    .provenance-opener {
      flex: none;
      min-height: 24px;
      /* The words, not the ground, end on the stage gutter. */
      margin-right: calc(-1 * var(--space-2));
      padding: 0 var(--space-2);
      border-radius: var(--radius-control);
      background: none;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-weight: 500;
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    .provenance-opener:active:not(:focus-visible) {
      transform: scale(var(--press-scale));
    }
    /* A coarse pointer needs the project's 44px target at any width: the bar grows and the button fills it (deviations/h4-coarse-target.md). */
    @media (pointer: coarse) {
      .provenance-opener {
        /* The bar is 44px here (app/layout.css), and the button fills it. */
        align-self: stretch;
      }
    }
    @media (hover: hover) and (pointer: fine) {
      .provenance-opener:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
    }
    /* phone.css:48-49: the statement is in the sheet grip, Provenance in the ⋯ menu. */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .colophon {
        display: none;
      }
    }
  }
  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      .provenance-opener:active {
        transform: none;
      }
    }
    @media (forced-colors: active) {
      .reset-display {
        color: LinkText;
        text-decoration: underline;
      }
    }
  }
</style>
