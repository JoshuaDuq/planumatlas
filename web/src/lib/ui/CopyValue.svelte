<!--
  A value the reader can take away: the value itself is the button, quiet at rest. A press copies
  it as shown and says "Copied" in place, above the value, so nothing beside it moves.
-->
<script module lang="ts">
  const SLOT = '\u0000';

  /** The words of a sentence before and after its value, so the value alone can be the button. */
  export function aroundValue(sentence: (value: string) => string): [string, string] {
    const [before, after] = sentence(SLOT).split(SLOT);
    if (after === undefined) throw new Error('The sentence does not hold its value.');
    return [before!, after];
  }
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createCopier } from './clipboard.svelte.ts';
  import { iconGraphic } from './IconButton.svelte';

  let {
    value,
    words,
  }: {
    value: string;
    /** The action, and what became of it. */
    words: { copy: string; copied: string; failed: string };
  } = $props();

  const copier = createCopier(() => words);
  onDestroy(copier.dispose);
</script>

<button
  type="button"
  class="copy-value"
  aria-label={`${value}, ${words.copy}`}
  data-state={copier.state}
  data-tooltip={copier.state === 'idle' ? words.copy : undefined}
  onclick={() => copier.copy(value)}
  >{value}<span class="copy-icon" aria-hidden="true">{@render iconGraphic('copy')}</span
  >{#if copier.state !== 'idle'}<span class="copy-said" aria-hidden="true"
      >{words[copier.state]}</span
    >{/if}</button
>

<style>
  @layer components {
    /* The value keeps its place in the line: the press area grows into the margins around it. */
    .copy-value {
      --copy-target: 24px;
      position: relative;
      display: inline-flex;
      align-items: center;
      min-height: var(--copy-target);
      margin: min(0px, (1lh - var(--copy-target)) / 2) -4px;
      padding: 0 4px;
      border: 0;
      border-radius: var(--radius-control);
      background: none;
      color: inherit;
      font: inherit;
      font-variant-numeric: inherit;
      text-align: inherit;
      cursor: pointer;
      transition: background-color var(--ui-transition) var(--ease-ui);
    }
    @media (hover: hover) and (pointer: fine) {
      .copy-value:hover {
        background: var(--surface-hover);
      }
    }
    /* No hover tells a touch reader the value can be taken, so the icon does. */
    .copy-icon {
      display: none;
    }
    @media (pointer: coarse) {
      .copy-value {
        --copy-target: 44px;
      }
      .copy-icon {
        display: inline-flex;
        margin-inline-start: var(--space-1);
        color: var(--text-tertiary);
        vertical-align: -1px;
      }
    }
    .copy-said {
      position: absolute;
      bottom: calc(100% + var(--space-1));
      inset-inline-end: 0;
      z-index: 1;
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--overlay-border);
      border-radius: var(--radius-control);
      background: var(--overlay-plate);
      color: var(--overlay-ink);
      font-size: var(--text-caption);
      font-weight: 400;
      line-height: var(--lh-caption);
      white-space: nowrap;
      pointer-events: none;
      transition: opacity var(--tooltip-transition) var(--ease-ui);
    }
    @starting-style {
      .copy-said {
        opacity: 0;
      }
    }
  }

  @layer a11y {
    @media (forced-colors: active) {
      .copy-said {
        border-color: CanvasText;
      }
    }
  }
</style>
