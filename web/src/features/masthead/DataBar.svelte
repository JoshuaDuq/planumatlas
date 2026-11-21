<!--
  The masthead's data group: one button reading "Subject <kind> Atlas <atlas> Colour <colour>", which
  opens every choice of Atlas, Colour, Internal anatomy and Subject as lists (DataLists.svelte, a chunk
  of its own fetched when the reader first points at, focuses or opens the summary: BUILD-15).
  APG Disclosure: the summary keeps focus when it opens, Tab enters the lists,
  Escape, a press elsewhere or focus leaving closes it.
  - where the atlas would be cut short, the colour yields, then the subject; internal anatomy is in the name only;
  - `data-reference` on the root: the tract reference shows its name alone, with no popover;
  - a download started from a list is announced (WCAG 4.1.3, deviation h3-load-announcements).
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { dataSummary, loadingText, type SummaryPart } from '../../lib/core/panels/header.ts';
  import { colourPalette, type PaletteSources } from '../../lib/core/panels/palettes.ts';
  import { paintKind } from '../../lib/core/state/paint.ts';
  import type { ModelPort } from '../../lib/core/state/ports.ts';
  import { requiredAtlas } from '../../lib/core/state/scene-commands.ts';
  import { atlasSwitchLabel, t } from '../../lib/core/i18n/index.ts';
  import {
    type Language,
    type LoadProgress,
    type LoadStatus,
    type ManifestAnatomy,
    type Paint,
    type SurfaceColor,
  } from '../../lib/types/index.ts';
  import type { PublishedAnatomy } from '../../lib/core/assets/published-anatomy.ts';
  import { announce } from '../../lib/ui/announcer.svelte.ts';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import { dataLists, loadLists } from './data-lists.svelte.ts';

  type Field = 'atlas' | 'colour' | 'detail';

  interface Props {
    lang: Language;
    status: LoadStatus;
    progress: LoadProgress | null;
    atlas: string;
    surfaceColor: SurfaceColor;
    /** Null until the model reports one; the first published level is shown then. */
    detail: string | null;
    /** The tab's paint over the colour chosen here, while one is drawn. */
    paint: Paint | null;
    atlases: readonly string[];
    detailLevels: readonly string[];
    /** What this build publishes: the Colour list offers only these colourings, each with its palette. */
    colourings: PaletteSources & { striatal?: unknown } & Pick<ModelPort, 'cabNp'>;
    anatomy: ManifestAnatomy;
    anatomies: readonly PublishedAnatomy[];
    /** The tract reference, another subject with nothing to choose. */
    reference: { label: string; description?: string } | null;
    /** The reader's own atlas while the tab's open function or deficit shows another; leaving it brings it back. */
    borrowed: { own: string; by: 'functions' | 'deficits' } | null;
    /** The settings panel; opening this popover closes it, and it opening closes this. */
    settingsOpen?: boolean;
    /** A list holds a choice still downloading: the status bar leaves that download to the bar (header.js:538). */
    choosing?: boolean;
    /** S3's `chooseAtlas`. */
    onAtlas: (id: string) => unknown;
    /** The reader points at or focuses the Atlas list, or the summary that holds it. */
    onAtlasIntent: () => void;
    /** The composition lifts the paint first (app.js:633-636), then runs the colour command. */
    onSurfaceColor: (colour: SurfaceColor) => unknown;
    onDetail: (id: string) => unknown;
    /** Another subject is another page: the link is rewritten and the page reloads (S4). */
    onAnatomy: (id: string) => void;
    /** The open popover's right edge in the window, so the stage can frame the anatomy beside it; null once closed. */
    onPanel?: (right: number | null, immediate: boolean) => void;
  }

  let {
    lang,
    status,
    progress,
    atlas,
    surfaceColor,
    detail,
    paint,
    atlases,
    detailLevels,
    colourings,
    anatomy,
    anatomies,
    reference,
    borrowed,
    settingsOpen = $bindable(false),
    choosing = $bindable(false),
    onAtlas,
    onAtlasIntent,
    onSurfaceColor,
    onDetail,
    onAnatomy,
    onPanel,
  }: Props = $props();

  /** The Colour value while a tab paints; it is never offered. */
  const PAINT = 'paint';

  const uid = $props.id();
  const dataId = `masthead-data-${uid}`;
  const noteId = `subject-note-${uid}`;

  const copy = $derived(t(lang, 'header'));
  const display = $derived(t(lang, 'display'));
  const switching = $derived(status === 'switching');
  const offersDetail = $derived(detailLevels.length > 1);
  const painted = $derived(reference ? null : paintKind(paint));
  const values = $derived<Record<Field, string>>({
    atlas,
    colour: painted ? PAINT : surfaceColor,
    detail: detail ?? detailLevels[0],
  });

  // What the reader just chose in a list, held as pressed until its command settles: the status
  // turns to switching only once the download starts, so it cannot say when the choice is over.
  let chosen = $state<Record<Field, string | null>>({ atlas: null, colour: null, detail: null });
  $effect.pre(() => {
    for (const field of Object.keys(chosen) as Field[]) {
      if (chosen[field] !== null && chosen[field] === values[field]) chosen[field] = null;
    }
    choosing = Object.values(chosen).some((value) => value !== null);
  });
  const shown = (field: Field) => chosen[field] ?? values[field];

  const paintLabel = $derived(
    painted ? display.paints[painted as keyof typeof display.paints] : '',
  );
  // A value as its list names it, then how far a choice has loaded or the tab that set an atlas.
  const selectedText = (field: Field): string => {
    const value = shown(field);
    const name =
      value === PAINT
        ? paintLabel
        : field === 'colour'
          ? display.surfaceColors[value as SurfaceColor]
          : atlasSwitchLabel(value, lang);
    const extra = chosen[field]
      ? loadingText(lang, progress)
      : field === 'atlas' && borrowed
        ? copy.borrowedBy[borrowed.by]
        : null;
    return [name, extra].filter(Boolean).join(' · ');
  };

  const captions = $derived<Record<SummaryPart, string>>({
    atlas: copy.atlas,
    colour: copy.colour,
    detail: display.internalAnatomy,
    subject: copy.subject,
  });
  // The summary draws what the brain is, the atlas and the colour, which come first in its name.
  const subjectKind = $derived(
    typeof anatomy.individual === 'boolean'
      ? copy.subjectKind[anatomy.individual ? 'individual' : 'template']
      : null,
  );
  const summary = $derived(
    dataSummary({
      subject: subjectKind,
      atlas: selectedText('atlas'),
      colour: selectedText('colour'),
      detail: offersDetail ? selectedText('detail') : null,
      reference: reference?.label,
    }),
  );
  const summaryShown = $derived(summary.filter(({ part }) => part !== 'detail'));
  const summaryLabel = $derived(
    summary.map(({ part, text }) => `${captions[part]} ${text}`).join(', '),
  );

  // The reference's name, which has no popover, carries its description as a tooltip.
  const description = $derived(reference?.description ?? '');

  const Lists = $derived(dataLists.component);
  function intent() {
    onAtlasIntent();
    void loadLists();
  }

  let open = $state(false);
  let instant = $state(false);
  // The same, unreactive: an effect's cleanup reads state as it was when the effect ran.
  let keyed = false;
  let root: HTMLDivElement;
  let toggle: HTMLButtonElement;
  let summaryNode = $state<HTMLSpanElement>();

  const visible = (element: HTMLElement) => element.checkVisibility();

  /** The next control after the data bar in the masthead, for when the one holding focus goes. */
  function nextControl(): HTMLElement | undefined {
    return [
      ...root
        .closest('header')!
        .querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select:not(:disabled)'),
    ].find(
      (element) =>
        !root.contains(element) &&
        root.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING &&
        visible(element),
    );
  }

  // The first arrangement that leaves the atlas whole: all three, without the colour, without the
  // subject, then the atlas alone. The atlas is never dropped.
  const ARRANGEMENTS = [[], ['colour'], ['subject'], ['colour', 'subject']] as const;
  function fit() {
    if (!summaryNode) return;
    const atlas = summaryNode.querySelector<HTMLElement>('[data-part="atlas"] .data-summary-value');
    for (const dropped of ARRANGEMENTS) {
      if (dropped.length) summaryNode.dataset.short = dropped.join(' ');
      else summaryNode.removeAttribute('data-short');
      if (!atlas || atlas.clientWidth >= atlas.scrollWidth) return;
    }
  }

  // A new summary or language changes the width; so do the window, the font and the room.
  $effect(() => {
    void [summaryLabel, lang, reference];
    untrack(fit);
  });
  $effect(() => {
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    window.addEventListener('resize', fit);
    let live = true;
    void document.fonts.ready.then(() => live && fit());
    return () => {
      live = false;
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  });

  // A reference hides every control, so focus moves on before they go (deviation h3-focus-never-lost).
  const isReference = $derived(reference !== null);
  $effect.pre(() => {
    if (isReference && root?.contains(document.activeElement)) untrack(nextControl)?.focus();
  });

  // The settings panel and this popover are never open together (header.js:174, 398).
  $effect(() => {
    if (settingsOpen) open = false;
  });
  $effect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (root.contains(event.target as Node)) return;
      instant = keyed = false;
      open = false;
    };
    // Marked handled: the page's own Escape would otherwise go on to clear the selection. On the
    // document, as legacy, so it works when a click on a note left focus on the page.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      instant = keyed = true;
      open = false;
      toggle.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  });

  // The open popover's right edge, from layout offsets, which its entry scale does not move.
  $effect(() => {
    if (!open || reference || !onPanel) return;
    const report = onPanel;
    const panel = root.querySelector<HTMLElement>('.masthead-data')!;
    const measure = () =>
      report(
        (panel.offsetParent as HTMLElement).getBoundingClientRect().left +
          panel.offsetLeft +
          panel.offsetWidth,
        keyed,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      report(null, keyed);
    };
  });

  async function onToggle(event: MouseEvent) {
    instant = keyed = isKeyboardActivation(event);
    // Opening waits for the lists the first time, if the reader's intent has not fetched them yet.
    if (!open && !dataLists.component) await loadLists();
    open = !open;
    if (open) settingsOpen = false;
  }
  // Tabbing past the last control leaves the popover. No related target means the window lost focus.
  function onfocusout(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (!open || next === null || root.contains(next)) return;
    instant = keyed = true;
    open = false;
  }

  // What a screen reader hears of a download started here: that it began, and that it landed.
  let pending: { field: Field; value: string; begun: boolean } | null = null;
  const separator = $derived(lang === 'fr' ? ' : ' : ': ');
  function begin() {
    if (!pending || pending.begun || !switching) return;
    pending.begun = true;
    const { field, value } = pending;
    const name =
      field === 'colour'
        ? display.surfaceColors[value as SurfaceColor]
        : atlasSwitchLabel(value, lang);
    announce(`${name}${separator}${copy.loading}`);
  }
  async function choose(field: Field, value: string, command: (value: string) => unknown) {
    chosen[field] = value;
    const asked = { field, value, begun: false };
    pending = asked;
    const done = command(value);
    await tick();
    begin();
    try {
      await done;
    } finally {
      if (chosen[field] === value) chosen[field] = null;
      if (pending === asked && !asked.begun) pending = null;
    }
  }
  $effect(() => {
    const busy = switching;
    const current = values;
    if (!pending) return;
    if (busy) return untrack(begin);
    if (!pending.begun) return;
    if (current[pending.field] === pending.value) announce(t(lang, 'viewport').loaded);
    pending = null;
  });
</script>

<div
  bind:this={root}
  class="data-bar"
  data-reference={reference ? '' : undefined}
  role="presentation"
  {onfocusout}
>
  <button
    bind:this={toggle}
    class="data-toggle"
    type="button"
    aria-expanded={open}
    aria-controls={dataId}
    aria-label={summaryLabel}
    data-tooltip={copy.dataSummary}
    onclick={onToggle}
    onpointerenter={intent}
    onfocus={intent}
  >
    <span bind:this={summaryNode} class="data-summary">
      {#each summaryShown as { part, text } (part)}
        <span class="data-summary-part" data-part={part}>
          <span class="data-summary-caption">{captions[part]}</span>
          <span class="data-summary-value">{text}</span>
        </span>
      {/each}
    </span>
  </button>
  <div
    id={dataId}
    class="masthead-data"
    data-open={open ? '' : undefined}
    data-instant={instant ? '' : undefined}
  >
    {#if reference}
      <div class="data-reference">
        <span class="data-label">{copy.subject}</span>
        <!-- A tooltip trigger is reachable by keyboard (WCAG 1.4.13, 2.1.1: deviation h3-name-description-reachable). -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <p
          class="study-name"
          tabindex={description ? 0 : undefined}
          aria-describedby={description ? noteId : undefined}
          data-tooltip={description || undefined}
        >
          {reference.label}
        </p>
        {#if description}<p class="data-note" id={noteId}>{description}</p>{/if}
      </div>
    {:else if Lists}
      <Lists
        {lang}
        {progress}
        shown={{ atlas: shown('atlas'), colour: shown('colour'), detail: shown('detail') }}
        held={{
          atlas: chosen.atlas !== null,
          colour: chosen.colour !== null,
          detail: chosen.detail !== null,
        }}
        {painted}
        paintValue={PAINT}
        {atlases}
        {detailLevels}
        {colourings}
        {anatomy}
        {anatomies}
        {borrowed}
        {switching}
        required={(colour, atlas) => requiredAtlas(colourings, colour as SurfaceColor, atlas)}
        palette={(mode) => colourPalette(mode, colourings)}
        onChoose={(field, value) =>
          choose(
            field,
            value,
            field === 'atlas'
              ? onAtlas
              : field === 'detail'
                ? onDetail
                : (next) => onSurfaceColor(next as SurfaceColor),
          )}
        {onAnatomy}
        {onAtlasIntent}
      />
    {/if}
  </div>
</div>

<style>
  @layer features {
    .data-bar {
      grid-column: 2;
      grid-row: 1;
      position: relative;
      display: flex;
      flex: 1 1 auto;
      align-items: center;
      align-self: stretch;
      min-width: 0;
    }
    :global(#app:is([data-status='loading'], [data-status='error'])) .data-bar {
      visibility: hidden;
    }

    /* The summary: caption and value for the subject, the atlas and the colour, on one line. */
    .data-bar .data-toggle {
      display: inline-flex;
      flex: 1 1 auto;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
      max-width: 100%;
      min-height: var(--control-height);
      height: auto;
      justify-content: flex-start;
      padding: var(--space-1) var(--space-2);
      border: 0;
      border-radius: var(--radius-control);
      background: transparent;
      color: var(--text-secondary);
      font-weight: 400;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    .data-bar .data-toggle:active:not(:focus-visible) {
      transform: scale(var(--press-scale));
    }
    .data-bar .data-toggle[aria-expanded='true'] {
      background: var(--surface-tonal);
    }
    @media (hover: hover) and (pointer: fine) {
      .data-bar .data-toggle:hover {
        background: var(--surface-tonal);
      }
    }
    .data-bar .data-toggle::after {
      content: '';
      flex: none;
      width: 6px;
      height: 6px;
      margin: 0 4px 0 2px;
      border-right: 1.5px solid var(--text-secondary);
      border-bottom: 1.5px solid var(--text-secondary);
      transform: translateY(-2px) rotate(45deg);
      transition: transform var(--ui-transition) var(--ease-ui);
    }
    .data-bar .data-toggle[aria-expanded='true']::after {
      transform: translateY(1px) rotate(225deg);
    }
    .data-summary {
      display: flex;
      flex: 0 1 auto;
      align-items: baseline;
      gap: var(--space-4);
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
    }
    .data-summary-part {
      display: flex;
      flex: none;
      align-items: baseline;
      gap: var(--space-2);
      min-width: 0;
    }
    .data-summary-part[data-part='atlas'] {
      flex: 0 1 auto;
    }
    .data-summary-caption {
      flex: none;
      font-size: var(--text-caption);
      color: var(--text-tertiary);
    }
    .data-summary-value {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-primary);
      font-weight: 600;
      /* Loading progress counts up inside the value without shaking it. */
      font-variant-numeric: tabular-nums;
    }
    .data-summary:global([data-short~='colour'] [data-part='colour']),
    .data-summary:global([data-short~='subject'] [data-part='subject']) {
      display: none;
    }

    /* The popover: the lists side by side, each a caption, its options and the chosen one's note. */
    .masthead-data {
      --data-width: min(34rem, calc(100vw - 2 * var(--space-3)));
      position: absolute;
      top: calc(100% + var(--space-1));
      right: 0;
      display: none;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      width: var(--data-width);
      max-height: calc(100dvh - var(--header-height) - var(--space-4));
      overflow-y: auto;
      overscroll-behavior: contain;
      background: var(--surface-base);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-panel);
      box-shadow: var(--shadow-popover);
      transform-origin: top right;
    }
    .masthead-data[data-open] {
      display: grid;
      transition:
        opacity var(--popover-transition) var(--ease-ui),
        transform var(--popover-transition) var(--ease-ui);
    }
    .masthead-data[data-instant] {
      transition: none;
    }
    @starting-style {
      .masthead-data[data-open] {
        opacity: 0;
        transform: scale(0.97);
      }
    }
    /* The lists' grid: three rows on the left, the colour beside them (DataLists.svelte). */
    .masthead-data {
      grid-template-rows: auto auto 1fr;
    }

    /* A tract reference offers no choices: its name sits in the bar, with no popover behind it. */
    .data-bar[data-reference] .data-toggle {
      display: none;
    }
    .data-bar[data-reference] .masthead-data {
      position: static;
      display: flex;
      width: auto;
      max-height: none;
      overflow: visible;
      background: none;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }
    .data-reference {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
    }
    .data-label {
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-tertiary);
      white-space: nowrap;
    }
    .study-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--text-ui);
      font-weight: 600;
      line-height: var(--lh-ui);
      color: var(--text-primary);
    }
    /* The description is the name's tooltip; this copy is what it is described by. */
    .data-note {
      display: none;
    }

    /* The summary's first caption stands on the stage gutter; the popover drops from its edge and stays on screen. */
    @media (min-width: 801px) and (min-height: 481px),
      (min-width: 801px) and (orientation: portrait) {
      .data-bar {
        padding-left: var(--stage-gutter);
      }
      .data-bar .data-toggle {
        flex: 0 1 auto;
        margin-left: calc(-1px - var(--space-2));
      }
      .masthead-data {
        right: auto;
        left: min(
          calc(var(--stage-gutter) - 1px - var(--space-2)),
          calc(100vw - var(--rail-width) - var(--data-width) - var(--space-3))
        );
        transform-origin: top left;
      }
    }

    /* Phones: one list under another, inset from both screen edges like the settings panel. */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .data-bar {
        position: static;
      }
      .masthead-data {
        left: max(var(--space-3), env(safe-area-inset-left));
        right: max(var(--space-3), env(safe-area-inset-right));
        grid-template-columns: minmax(0, 1fr);
        width: auto;
        /* Below the text-aware bar, its rule, and a gutter. */
        max-height: calc(
          100dvh - env(safe-area-inset-top) - var(--header-height) - 1px - var(--space-1) -
            var(--space-3)
        );
      }
      /* One list, in the order it is read. */
      .masthead-data {
        grid-template-rows: none;
      }
      .data-label {
        display: none;
      }
    }

    /* Touch targets: a 44px summary, whatever --control-height is. */
    @media (pointer: coarse), (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .data-bar .data-toggle {
        min-height: 44px;
      }
    }

    /* A phone on its side has width but little height: the two columns again. */
    @media (max-height: 480px) and (orientation: landscape) {
      .masthead-data {
        right: auto;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        width: min(640px, calc(100vw - 2 * var(--space-3)));
      }
      .masthead-data {
        grid-template-rows: auto auto 1fr;
      }
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      .masthead-data[data-open] {
        transition-property: opacity;
      }
      .data-bar .data-toggle::after {
        transition: none;
      }
      .data-bar .data-toggle:active {
        transform: none;
      }
    }
  }
</style>
