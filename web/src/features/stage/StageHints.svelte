<!--
  The instructions at the top left of the picture (viewport-chrome.js:56-61, 478-489,
  600-620; stage.css:67-87). The gesture instructions are type on the picture, like its markings, and
  repeated in the canvas's own label for assistive technology. The navigation hint retires for good
  once the reader has rotated, zoomed or clicked the model (StageOverlay hears the gestures); the
  keyboard hint shows only while the canvas has focus (stage-vars.css; the canvas's own outline would
  run under the dock). A hint that would not fit one line clear of the top letter or a key is not drawn.
  The tour invitation's × declines it for good; the settings menu keeps the tour.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import { FOCUS_TARGETS, rescueFocus } from '../../lib/ui/focus.ts';
  import IconButton from '../../lib/ui/IconButton.svelte';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';

  interface Props {
    stage: StageLayout;
    lang: Language;
    /** A finger rather than a mouse: the hints name touch gestures. */
    coarsePointer: boolean;
    /** The tract reference alone is shown: it has no regions to click. */
    tractReference: boolean;
    onGuide?: () => void;
    onDeclineGuide?: () => void;
  }

  let { stage, lang, coarsePointer, tractReference, onGuide, onDeclineGuide }: Props = $props();

  const copy = $derived(t(lang, 'viewport'));
  const navigation = $derived(
    coarsePointer
      ? tractReference
        ? copy.navigationHintTractsTouch
        : copy.navigationHintTouch
      : tractReference
        ? copy.navigationHintTracts
        : copy.navigationHint,
  );

  let navigationNode: HTMLElement;
  let focusNode: HTMLElement;
  // Each hint's own border box: a late webfont, larger text or text spacing changes it, and a width
  // remembered per wording would not follow (WCAG 1.4.4, 1.4.12).
  let navigationWidth = $state(0);
  let focusWidth = $state(0);

  $effect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.borderBoxSize[0]!.inlineSize;
        if (entry.target === navigationNode) navigationWidth = width;
        else focusWidth = width;
      }
    });
    observer.observe(navigationNode);
    observer.observe(focusNode);
    return () => observer.disconnect();
  });

  const room = $derived(stage.hintRoom);
  const navigationFits = $derived(room === null || navigationWidth <= room);
  const focusFits = $derived(room === null || focusWidth <= room);

  async function decline() {
    onDeclineGuide!();
    await tick();
    rescueFocus(FOCUS_TARGETS.activeTab);
  }
</script>

<p
  id="viewport-help"
  class="viewport-help"
  aria-hidden="true"
  bind:this={navigationNode}
  data-dismissed={stage.hintRetired}
  data-room={navigationFits}
>
  {navigation}
</p>
<p
  id="viewport-focus-hint"
  class="viewport-help viewport-focus-hint"
  aria-hidden="true"
  bind:this={focusNode}
  data-room={focusFits}
>
  {copy.keyboardHint}
</p>
{#if onGuide}
  {@const header = t(lang, 'header')}
  <div class="viewport-help viewport-guide" data-below-hint={!stage.hintRetired && navigationFits}>
    <button type="button" class="viewport-guide-start" onclick={onGuide}>
      {header.guideInvitation}
    </button>
    <IconButton
      icon="close"
      class="viewport-guide-decline"
      label={header.guideDecline}
      data-tooltip={header.guideDecline}
      onclick={decline}
    />
  </div>
{/if}

<style>
  @layer features {
    .viewport-help {
      position: absolute;
      z-index: 2;
      top: calc(var(--vis-top) + var(--stage-gutter));
      left: calc(var(--vis-left) + var(--stage-gutter));
      margin: 0;
      color: var(--overlay-ink-muted);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      white-space: nowrap;
      text-shadow:
        0 0 2px var(--overlay-halo-core),
        0 0 4px var(--overlay-halo-core),
        0 0 8px var(--overlay-halo);
      pointer-events: none;
      transition: opacity var(--camera-transition) var(--ease-ui);
    }
    /* Faded out, then out of every box: a retired hint is neither measured nor read. */
    .viewport-help[data-dismissed='true'] {
      opacity: 0;
      visibility: hidden;
      transition:
        opacity var(--camera-transition) var(--ease-ui),
        visibility 0s linear var(--camera-transition);
    }
    /* No room for one line clear of the top letter. */
    .viewport-help[data-room='false'] {
      visibility: hidden;
    }
    .viewport-focus-hint {
      opacity: 0;
      color: var(--overlay-accent);
      transition: none;
    }
    .viewport-guide {
      display: flex;
      align-items: stretch;
      border: 1px solid color-mix(in srgb, var(--overlay-accent) 60%, var(--overlay-accent-wash));
      border-radius: var(--radius-control);
      background: var(--overlay-accent-wash);
      text-shadow: none;
      pointer-events: auto;
      /* A retiring hint fades first; then the invitation rises into its place, never over it. */
      transition: top var(--ui-transition) var(--ease-ui) var(--camera-transition);
    }
    .viewport-guide-start {
      min-height: var(--control-height);
      padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
      border: none;
      border-radius: inherit;
      background: none;
      color: var(--overlay-ink);
      font: inherit;
      font-size: var(--text-stage);
      font-weight: 600;
      line-height: var(--lh-ui);
      cursor: pointer;
    }
    .viewport-guide :global(.viewport-guide-decline) {
      height: auto;
      border-left-color: color-mix(in srgb, var(--overlay-accent) 30%, var(--overlay-accent-wash));
      border-radius: 0 var(--radius-control) var(--radius-control) 0;
      color: var(--overlay-ink-muted);
    }
    .viewport-guide[data-below-hint='true'],
    :global(#viewport:has(> canvas:focus-visible)) .viewport-guide {
      top: calc(var(--vis-top) + var(--stage-gutter) + var(--lh-caption) + var(--space-2));
      transition: none;
    }
    .viewport-guide-start:focus-visible,
    .viewport-guide :global(.viewport-guide-decline:focus-visible) {
      outline-color: var(--overlay-accent);
    }
    @media (hover: hover) and (pointer: fine) {
      .viewport-guide:has(.viewport-guide-start:hover) {
        border-color: var(--overlay-accent);
        background: color-mix(in srgb, var(--overlay-accent-wash), var(--overlay-accent) 12%);
      }
      .viewport-guide :global(.viewport-guide-decline:hover) {
        background: color-mix(in srgb, var(--overlay-accent-wash), var(--overlay-accent) 12%);
        color: var(--overlay-ink);
      }
    }
    :global(#viewport:has(> canvas:focus-visible)) .viewport-focus-hint {
      opacity: 1;
    }
    :global(#viewport:has(> canvas:focus-visible)) #viewport-help {
      opacity: 0;
    }
    /* On phones and compact viewports ScaleBar takes the top-left corner; keep the hint off it. */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      #viewport-help {
        visibility: hidden;
      }
      .viewport-guide {
        display: none;
      }
      .viewport-focus-hint {
        top: calc(
          var(--vis-top) + var(--key-top) + var(--stage-gutter) + var(--lh-caption) + var(--space-1)
        );
      }
    }
  }
  @layer a11y {
    /* Reduced motion: the invitation takes the hint's place once it has faded, without travelling. */
    @media (prefers-reduced-motion: reduce) {
      .viewport-guide {
        transition-duration: 0s;
      }
    }
  }
</style>
