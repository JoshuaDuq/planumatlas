<!--
  The reader's highlighted regions, listed above the panel while there are any: each region's
  colour, which a press opens the six colours to change, its name and side, and a remove. A region
  the layers on screen do not hold stays listed and says so. While the tab in front shows evidence,
  or a masthead colour was chosen over them, the strip says the highlights are not drawn, and for
  the second offers to draw them again. The chrome is the panel's; the swatches are its only colour.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { networkCss } from '../../lib/core/catalog/networks.ts';
  import { visibilityOf } from '../../lib/core/catalog/visibility.ts';
  import type { VisibilitySettings } from '../../lib/core/catalog/visibility.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { HIGHLIGHT_RGB } from '../../lib/core/state/paint.ts';
  import type { HighlightsStore } from '../../lib/state/highlights.svelte.ts';
  import { HIGHLIGHT_COLORS } from '../../lib/types/constants.ts';
  import type { Language, Region } from '../../lib/types/index.ts';
  import { announce } from '../../lib/ui/announcer.svelte.ts';
  import { FOCUS_TARGETS, rescueFocus } from '../../lib/ui/focus.ts';
  import IconButton from '../../lib/ui/IconButton.svelte';
  import Popover from '../../lib/ui/Popover.svelte';

  interface Props {
    lang: Language;
    highlights: Pick<HighlightsStore, 'list' | 'status' | 'recolor' | 'remove' | 'show'>;
    /** Every region the anatomy publishes, for a region's side and where it is drawn. */
    regions: { get(id: string): { region: Region } | null };
    /** A region's name in the reader's language. */
    name: (id: string) => string;
    /** What decides what is on screen (`visibilityOf`). */
    settings: VisibilitySettings;
  }

  let { lang, highlights, regions, name, settings }: Props = $props();

  const uid = $props.id();
  const copy = $derived(t(lang, 'inspector'));
  const strip = $derived(copy.highlightStrip);
  const sides = $derived(t(lang, 'sides'));
  let list = $state<HTMLUListElement>();

  const rows = $derived(
    highlights.list.map(({ region: id, color }) => {
      const entry = regions.get(id);
      if (!entry) throw new Error(`No published region ${id} to list as highlighted.`);
      const { hemisphere } = entry.region;
      const reason = visibilityOf(entry.region, settings).reason;
      return {
        id,
        color,
        name: name(id),
        side: sides.glyphs[hemisphere],
        sideWord: sides.words[hemisphere],
        label: `${name(id)}, ${sides.words[hemisphere]}`,
        // Drawn by another atlas, internal anatomy or colour than the one on screen.
        elsewhere:
          reason === 'other-atlas'
            ? ('atlas' as const)
            : reason === 'other-detail'
              ? ('detail' as const)
              : reason === 'other-colour'
                ? ('colour' as const)
                : null,
      };
    }),
  );

  /** Focus moves to the next row's remove, or the last; with none left, to the tab in front. */
  async function remove(id: string, label: string, index: number) {
    highlights.remove(id);
    announce(copy.unhighlighted(label));
    await tick();
    const buttons = list?.querySelectorAll<HTMLElement>('.highlight-remove') ?? [];
    const next = buttons[Math.min(index, buttons.length - 1)];
    if (next) next.focus();
    else rescueFocus(FOCUS_TARGETS.activeTab);
  }
</script>

{#if rows.length}
  <div class="highlight-strip" role="group" aria-labelledby="{uid}-title">
    <div class="highlight-head">
      <span id="{uid}-title" class="highlight-title">{strip.title}</span>
      {#if highlights.status === 'lifted'}
        <button type="button" class="highlight-show" onclick={() => highlights.show()}>
          {strip.show}
        </button>
      {/if}
    </div>
    {#if highlights.status !== 'drawn'}
      <p class="highlight-status">{highlights.status === 'aside' ? strip.aside : strip.lifted}</p>
    {/if}
    <!-- svelte-ignore a11y_no_redundant_roles: list-style: none drops the list in Safari and VoiceOver. -->
    <ul class="highlight-list" role="list" bind:this={list}>
      {#each rows as row, index (row.id)}
        {@const colorName = copy.highlightColors[row.color]}
        <li class="highlight-row">
          <Popover align="start" class="highlight-colors-menu">
            {#snippet trigger({ props })}
              <button
                {...props}
                type="button"
                class="highlight-swatch"
                aria-label={strip.colorOf(row.label, colorName)}
                data-tooltip={colorName}
              >
                <span
                  class="swatch"
                  aria-hidden="true"
                  style:background={networkCss(HIGHLIGHT_RGB[row.color])}
                ></span>
              </button>
            {/snippet}
            {#snippet children({ close })}
              <div class="highlight-colors" role="group" aria-label={strip.colors}>
                {#each HIGHLIGHT_COLORS as color (color)}
                  <button
                    type="button"
                    class="highlight-color"
                    aria-pressed={row.color === color}
                    aria-label={copy.highlightColors[color]}
                    data-tooltip={copy.highlightColors[color]}
                    onclick={() => {
                      highlights.recolor(row.id, color);
                      close();
                    }}
                  >
                    <span
                      class="swatch"
                      aria-hidden="true"
                      style:background={networkCss(HIGHLIGHT_RGB[color])}
                    ></span>
                  </button>
                {/each}
              </div>
            {/snippet}
          </Popover>
          <span class="highlight-name">
            {row.name}<span class="highlight-side" aria-hidden="true">{row.side}</span><span
              class="visually-hidden"
            >
              , {row.sideWord}
            </span>
            {#if row.elsewhere}
              <span class="highlight-elsewhere">{strip.elsewhere[row.elsewhere]}</span>
            {/if}
          </span>
          <IconButton
            class="highlight-remove"
            icon="close"
            label={strip.remove(row.label)}
            data-tooltip={strip.removeHint}
            onclick={() => void remove(row.id, row.label, index)}
          />
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  @layer features {
    /* Above the panel's own content, on its inset, ruled off from it as the selection strip is. */
    .highlight-strip {
      flex: none;
      padding: var(--space-2) var(--panel-inset);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--surface-base);
    }
    .highlight-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }
    .highlight-title {
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
    }
    /* A quiet text command: secondary ink, underlined under a hovering pointer. */
    .highlight-show {
      min-height: 32px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--text-secondary);
      font: inherit;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      cursor: pointer;
    }
    .highlight-status {
      margin: var(--space-1) 0 0;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    /* Twelve rows would push the list off a short panel; past four and a half, they scroll here. */
    .highlight-list {
      max-height: calc(4.5 * var(--row-height));
      margin: var(--space-1) 0 0;
      padding: 0;
      list-style: none;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .highlight-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--row-height);
    }
    .highlight-swatch,
    .highlight-color {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      background: none;
      cursor: pointer;
    }
    .swatch {
      display: block;
      width: 12px;
      height: 12px;
      border-radius: var(--radius-mark);
    }
    .highlight-name {
      flex: 1;
      min-width: 0;
      color: var(--text-primary);
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      overflow-wrap: break-word;
    }
    .highlight-side {
      margin-left: var(--space-2);
      color: var(--text-secondary);
      font-size: var(--text-caption);
    }
    .highlight-elsewhere {
      display: block;
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .highlight-strip :global(.highlight-remove) {
      flex: none;
      color: var(--text-tertiary);
    }
    /* The six colours in one row; the chosen one ringed in ink, never in a colour of its own. */
    .highlight-colors {
      display: flex;
      gap: var(--space-1);
      padding: var(--space-2);
    }
    .highlight-color[aria-pressed='true'] {
      border-color: var(--text-primary);
    }
    @media (hover: hover) and (pointer: fine) {
      .highlight-swatch:hover,
      .highlight-color:hover {
        background: var(--surface-hover);
      }
      .highlight-show:hover {
        color: var(--text-primary);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    @media (pointer: coarse) {
      .highlight-swatch,
      .highlight-color,
      .highlight-show {
        min-width: 44px;
        min-height: 44px;
      }
    }
  }

  @layer a11y {
    @media (forced-colors: active) {
      /* A forced background would paint every swatch alike; the colour is the reader's choice. */
      .swatch {
        forced-color-adjust: none;
        outline: 1px solid CanvasText;
      }
      .highlight-color[aria-pressed='true'] {
        border-color: Highlight;
      }
    }
  }
</style>
