<!--
  The colour keys, beside the picture they explain (index.html:533-580; viewport-chrome.js:269-430;
  stage.css:186-290). Each is one plate whose title row names its map and folds its rows: networks,
  the paint a tab draws (rows are toggles that show one alone) and the streamline direction.

  Folds are APG Disclosures, the paint rows an APG Toolbar of toggle
  buttons. The keys are interactive, so they are not inside the `aria-hidden`
  overlay layer. They take a band off the framing rectangle, which the stage-layout store reads
  through the key fitter registered here: built from the sizes the observer caches, so it forces no layout.
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Legend } from '../../lib/core/state/paint.ts';
  import type { Media } from '../../lib/state/media.svelte.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type {
    ArterialTerritory,
    CerebellarFunctionRegion,
    Language,
    LoadStatus,
    SurfaceColor,
  } from '../../lib/types/index.ts';
  import { roving } from '../../lib/ui/Toolbar.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';
  import {
    BORDER_INK,
    KEY_GAP_PX,
    KEY_NOTE_MIN_WIDTH_PX,
    defaultOpen,
    keyBand,
    keyHeight,
    keyPlates,
    swatchColor,
  } from './stage-keys.ts';
  import type { ColoredNetworks, KeyName, KeyPlate, KeyRow, KeySources } from './stage-keys.ts';
  import './stage-vars.css';

  interface Props {
    stage: StageLayout;
    media: Pick<Media, 'phone' | 'coarsePointer'>;
    lang: Language;
    status: LoadStatus;
    surfaceColor: SurfaceColor;
    atlas?: KeySources['atlas'];
    networks: ColoredNetworks | null;
    cabNp: ColoredNetworks | null;
    /** The arterial territories' palette, when the build publishes them. */
    territories?: readonly ArterialTerritory[] | null;
    /** The cerebellar functional regions, when the build publishes them. */
    cerebellar?: readonly CerebellarFunctionRegion[] | null;
    /** The thickness key's ends in mm, when the build publishes this brain's cortical thickness. */
    thickness?: KeySources['thickness'];
    /** The sulcal depth key's half-width in mm (`sulcExtent`). */
    sulc?: KeySources['sulc'];
    /** The build publishes the network matrix, which Yeo's networks' key opens. */
    networkMatrix?: boolean;
    /** The lobes of the atlas on screen, for the lobe colouring's key. */
    lobes?: KeySources['lobes'];
    /** The key of the paint on show (`legendFor`), or null. */
    legend: Legend | null;
    /** The atlas whose borders are drawn over the cortex, or null. */
    borders?: KeySources['borders'];
    /** The stroke cases on the stage, or null. */
    cases?: KeySources['cases'];
    /** The reader's own maps on the stage, the one on top first. */
    maps?: KeySources['maps'];
    directionShown: boolean;
    /** A row alone, or null for every row (`excursions.pickPaint`). */
    onPaintPick: (id: string | null) => void;
    /** A plate's command (`KeyPlate.action`), with the press that asked for it. */
    onPlateAction?: (id: NonNullable<KeyPlate['action']>['id'], event: MouseEvent) => void;
  }

  let {
    stage,
    media,
    lang,
    status,
    surfaceColor,
    atlas,
    networks,
    cabNp,
    territories = null,
    cerebellar = null,
    thickness = null,
    sulc = null,
    networkMatrix = false,
    lobes = null,
    legend,
    borders = null,
    cases = null,
    maps = [],
    directionShown,
    onPaintPick,
    onPlateAction,
  }: Props = $props();

  const plates = $derived(
    keyPlates({
      lang,
      status,
      surfaceColor,
      atlas,
      networks,
      cabNp,
      territories,
      cerebellar,
      thickness,
      sulc,
      networkMatrix,
      lobes,
      legend,
      borders,
      cases,
      maps,
      directionShown,
    }),
  );

  // The reader's fold of a map is kept for the visit; a map never folded follows the crowd default.
  const folds = new SvelteMap<string, boolean>();
  const crowd = new SvelteMap<string, boolean>();
  const isOpen = (plate: KeyPlate) => folds.get(plate.map) ?? crowd.get(plate.map) ?? true;

  let host: HTMLElement | undefined;

  // On phones use the room at the sheet's destination, updated on a resize or a change of detent.
  const sized = $derived(stage.visibleRect !== null);
  $effect.pre(() => {
    void sized;
    const { phone, coarsePointer: coarse } = media;
    const sheetRoom = phone ? stage.sheetRoom : null;
    const current = plates;
    untrack(() => {
      const active = document.activeElement;
      const holder =
        active instanceof HTMLElement ? active.closest<HTMLElement>('.stage-key') : null;
      const rect = sheetRoom ?? stage.visibleRect;
      const room = rect
        ? {
            width: rect.width,
            height: rect.height,
            gutter: stage.gutter,
            dockHeight: stage.dock.height,
          }
        : null;
      // Each plate is weighed under the ones above it, as the reader's folds leave them.
      let above = 0;
      for (const plate of current) {
        // A plate's command takes a row's height.
        const sized = { ...plate, count: plate.rows.length + (plate.action ? 1 : 0) };
        const open = defaultOpen(sized, { phone, coarse }, room, above);
        crowd.set(plate.map, open);
        above += keyHeight(sized, { phone, coarse }, folds.get(plate.map) ?? open) + KEY_GAP_PX;
      }
      if (!holder || !host?.contains(holder)) return;
      // Focus never falls to the page: a row that went leaves it on its plate's toggle, a plate that
      // went on the stage.
      const focused = active as HTMLElement;
      // A frame later, so a command the change came from (a pick that opens a profile) may place focus
      // first; it is taken only if it is still on what went, or on the page.
      void tick().then(() =>
        requestAnimationFrame(() => {
          // The keys were unmounted in the meantime: nothing to hand focus to.
          if (!host || (focused.isConnected && focused.checkVisibility())) return;
          const now = document.activeElement;
          if (now && now !== document.body && now !== focused) return;
          const toggle = host.querySelector<HTMLElement>(
            `[data-name="${holder.dataset.name}"] .stage-key-toggle`,
          );
          (toggle ?? host.closest<HTMLElement>('#viewport')!).focus();
        }),
      );
    });
  });

  /** The plates as drawn, with each one's fold: what the snapshot draws (G6) reads, without scraping. */
  export function model(): (KeyPlate & { open: boolean })[] {
    return plates.map((plate) => ({ ...plate, open: isOpen(plate) }));
  }

  function toggleFold(plate: KeyPlate) {
    folds.set(plate.map, !isOpen(plate));
  }

  // The paint note gives way where the stage is narrow, or where the rows would otherwise be cut short.
  const paint = $derived(plates.find((plate) => plate.name === 'paint'));
  const wide = $derived((stage.visibleRect?.width ?? Infinity) >= KEY_NOTE_MIN_WIDTH_PX);
  const noteShown = $derived(Boolean(paint?.note) && wide && isOpen(paint!));
  $effect(() => {
    void paint;
    void lang;
    void noteShown;
    const list = host!.querySelector<HTMLElement>('#paint-key .stage-key-list');
    const note = host!.querySelector<HTMLElement>('#paint-key .stage-key-note');
    if (!list || !note) return;
    note.removeAttribute('data-clipped');
    if (noteShown && list.scrollHeight > list.clientHeight) note.setAttribute('data-clipped', '');
  });

  /**
   * Watches the keys' box and registers the fitting the store runs on every framing and viewport
   * change. It reads cached sizes and tells the store only what changed.
   */
  function fitting(element: HTMLElement) {
    let size = { width: 0, height: 0 };
    function fit() {
      // Beside an open popover's band, the room left is what the keys weigh their band in.
      const visible = stage.visibleRect;
      const room = visible && { width: visible.width - stage.plateBand, height: visible.height };
      const band = keyBand(size, room, stage.gutter);
      const { keyInset, keySize } = stage;
      if (
        band.top !== keyInset.top ||
        band.right !== keyInset.right ||
        size.width !== keySize.width ||
        size.height !== keySize.height
      ) {
        stage.setKeys(band, size);
      }
    }
    const observer = new ResizeObserver(([entry]) => {
      const box = entry!.borderBoxSize[0]!;
      size = { width: box.inlineSize, height: box.blockSize };
      fit();
    });
    observer.observe(element);
    const release = stage.setKeyFitter(fit);
    return () => {
      release();
      observer.disconnect();
    };
  }
</script>

{#snippet content(row: KeyRow)}
  {#if row.ramp}
    <span
      class="network-swatch stage-key-ramp"
      aria-hidden="true"
      style:background="linear-gradient(to right, {row.ramp.join(', ')})"
    ></span>
  {:else if row.line}
    <span
      class="network-swatch stage-key-line"
      aria-hidden="true"
      style:--line-core={BORDER_INK.core}
      style:--line-casing={BORDER_INK.casing}
    ></span>
  {:else if row.color !== null}
    <Swatch colour={row.absent ? 'transparent' : swatchColor(row.color)} />
  {:else}
    <span class="stage-key-spacer" aria-hidden="true"></span>
  {/if}
  <span class="stage-key-label">{row.label}</span>
  {#if row.absent}<span class="visually-hidden">. {t(lang, 'viewport').keyAbsent}</span>{/if}
{/snippet}

{#snippet rows(plate: KeyPlate)}
  <!-- svelte-ignore a11y_no_redundant_roles: list-style: none drops the list in Safari and VoiceOver. -->
  <ul
    class="stage-key-list"
    role="list"
    aria-labelledby={plate.pickable ? undefined : `${plate.name}-key-title`}
    data-picked={plate.rows.some((row) => row.pressed) || undefined}
  >
    {#each plate.rows as row (row.id)}
      <li data-absent={row.absent || undefined}>
        {#if plate.pickable}
          <button
            type="button"
            aria-pressed={row.pressed}
            onclick={() => onPaintPick(row.pressed ? null : row.id)}
          >
            {@render content(row)}
          </button>
        {:else}
          {@render content(row)}
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<div id="stage-keys" class="stage-keys" bind:this={host} {@attach fitting}>
  {#each plates as plate (plate.name)}
    {@const open = isOpen(plate)}
    <div class="stage-key" id="{plate.name}-key" data-name={plate.name} data-map={plate.map}>
      <div class="stage-key-head">
        <button
          type="button"
          class="stage-key-toggle"
          aria-expanded={open}
          aria-controls="{plate.name}-key-body"
          onclick={() => toggleFold(plate)}
        >
          <span id="{plate.name}-key-title">{plate.title}</span>
          <span class="stage-tool-chevron" aria-hidden="true"></span>
        </button>
      </div>
      <div class="stage-key-body" id="{plate.name}-key-body" hidden={!open}>
        {#if plate.pickable}
          <div
            class="stage-key-rows"
            role="toolbar"
            aria-orientation="vertical"
            aria-label={plate.title}
            {@attach roving}
          >
            {@render rows(plate)}
          </div>
        {:else}
          {@render rows(plate)}
        {/if}
        {#if plate.name === 'paint'}
          <p class="stage-key-note" hidden={!noteShown}>{plate.note}</p>
        {:else if plate.note}
          <p class="stage-key-note">{plate.note}</p>
        {/if}
        {#if plate.action && onPlateAction}
          {@const action = plate.action}
          <button
            type="button"
            class="stage-key-action"
            aria-haspopup={action.id === 'network-matrix' ? 'dialog' : undefined}
            onclick={(event) => onPlateAction(action.id, event)}
          >
            {action.label}
          </button>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  @layer features {
    /*
     * Inside the framing's own band, so neither the anatomy nor a letter is ever under one.
     * A long list scrolls rather than reach the dock's line, where the scale bar sits.
     */
    .stage-keys {
      position: absolute;
      z-index: 2;
      top: calc(var(--vis-top) + var(--stage-gutter));
      right: calc(var(--vis-right) + var(--stage-gutter));
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--space-2);
      max-width: calc(100% - var(--vis-left) - var(--vis-right) - 2 * var(--stage-gutter));
      max-height: calc(
        100% - var(--vis-top) - var(--vis-bottom) - 3 * var(--stage-gutter) - var(--dock-height)
      );
    }
    /* One flat plate. Bounded in pixels, so a note runs in a few full lines. */
    .stage-key {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      max-width: 280px;
      padding: 0 var(--space-3);
      background: var(--overlay-plate);
      border: 1px solid var(--stage-edge);
      border-radius: var(--radius-control);
      color: var(--overlay-ink);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .stage-key-head {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: 32px;
    }
    /* A colour scale reads from its threshold, left, to its top, right. */
    .stage-key-ramp {
      display: block;
      flex: none;
      width: 32px;
      height: 10px;
      margin-top: 5px;
      border-radius: var(--radius-mark);
      forced-color-adjust: none;
    }
    /* The borders' line as the cortex draws it: a light core cased in dark, across the swatch. */
    .stage-key-line {
      display: block;
      flex: none;
      width: 16px;
      height: 4px;
      margin-top: 8px;
      background: var(--line-core);
      box-shadow: 0 0 0 1px var(--line-casing);
      forced-color-adjust: none;
    }
    .stage-key-spacer {
      flex: 0 0 16px;
    }
    /* A title naming an area wraps rather than run under the chevron (the Complete Name Rule). */
    .stage-key-toggle {
      display: inline-flex;
      flex: 1 1 auto;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
      min-height: 32px;
      margin: 0 calc(-1 * var(--space-3));
      padding: var(--space-1) var(--space-3);
      text-align: start;
      border: 0;
      border-radius: var(--radius-control);
      background: transparent;
      color: var(--overlay-ink-muted);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
      cursor: pointer;
    }
    .stage-key-toggle > span:first-child {
      overflow-wrap: anywhere;
    }
    .stage-key-toggle:focus-visible,
    .stage-key-list button:focus-visible {
      outline-offset: -2px;
    }
    @media (hover: hover) and (pointer: fine) {
      .stage-key-toggle:hover {
        color: var(--overlay-ink);
      }
    }
    /* Drawn, like every disclosure chevron; it points up while the plate is open. */
    .stage-tool-chevron {
      flex: none;
      width: 6px;
      height: 6px;
      margin: -4px 0 0;
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      color: var(--overlay-ink-muted);
      transform: rotate(45deg);
      transition: transform var(--ui-transition) var(--ease-ui);
    }
    [aria-expanded='true'] > .stage-tool-chevron {
      transform: translateY(4px) rotate(-135deg);
    }

    .stage-key-body,
    .stage-key-rows {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    /* Every key keeps one rhythm: 24 px rows, a wrapped label running on under its first line beside the swatch. */
    .stage-key-list {
      display: grid;
      min-height: 0;
      margin: 0;
      padding: 0 0 var(--space-2);
      overflow-y: auto;
      overscroll-behavior: contain;
      list-style: none;
    }
    .stage-key-list li,
    .stage-key-list button {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      min-height: 24px;
      padding-block: calc((24px - var(--lh-caption)) / 2);
    }
    .stage-key-list :global(.network-swatch) {
      flex: none;
      margin-top: calc((var(--lh-caption) - 10px) / 2);
    }
    .stage-key-label {
      overflow-wrap: anywhere;
    }
    /* A paint row is a toggle: pressing one shows that row's regions alone, the others step back. */
    .stage-key-list li:has(> button) {
      padding-block: 0;
    }
    .stage-key-list button {
      width: 100%;
      padding-inline: 0;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .stage-key-list[data-picked] button[aria-pressed='false'] {
      color: var(--overlay-ink-muted);
    }
    .stage-key-list button[aria-pressed='true'] {
      font-weight: 600;
    }
    /* A finding with no region coloured in this view: keyed, but faint, its swatch hatched so it never reads as an unchecked box. */
    .stage-key-list li[data-absent] {
      color: var(--overlay-ink-faint);
    }
    .stage-key-list li[data-absent] :global(.network-swatch) {
      background: repeating-linear-gradient(
        -45deg,
        transparent 0 2px,
        rgb(144 150 158 / 0.35) 2px 3px
      );
      box-shadow: inset 0 0 0 1px rgb(144 150 158 / 0.5);
    }
    @media (hover: hover) and (pointer: fine) {
      .stage-key-list button:hover {
        color: var(--overlay-ink);
      }
    }
    .stage-key-note {
      padding: 0 0 var(--space-2);
      color: var(--overlay-ink-muted);
    }
    .stage-key-note:global([data-clipped]) {
      display: none;
    }
    /* A quiet text command at the plate's foot, underlined so it reads as one. */
    .stage-key-action {
      align-self: flex-start;
      min-height: 24px;
      margin-bottom: var(--space-2);
      padding: 0;
      border: 0;
      background: none;
      color: var(--overlay-ink);
      font: inherit;
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;
    }
    .stage-key-action:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    @media (pointer: coarse) {
      .stage-key-action {
        min-height: 44px;
      }
    }

    /* A key's title row is a full target; its rows run in two columns, so the band it takes stays short. */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .stage-key {
        max-width: 100%;
      }
      .stage-key-head,
      .stage-key-toggle {
        min-height: 44px;
      }
      .stage-key:not([data-name='direction']) .stage-key-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: var(--space-3);
      }
      /* A finding is a sentence, not a name, and a highlighted region a name with its side: one per line, or every one wraps. */
      .stage-key:is([data-map='deficit'], [data-map='lesion'], [data-map='highlight'])
        .stage-key-list {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    /* Touch targets follow the stage, never the compact legend. */
    @media (pointer: coarse), (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .stage-key-list button {
        min-height: 44px;
      }
      .stage-key-list button {
        padding-block: calc((44px - var(--lh-caption)) / 2);
      }
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      .stage-tool-chevron {
        transition: none;
      }
    }
    @media (forced-colors: active) {
      .stage-key {
        border-color: CanvasText;
      }
    }
  }
</style>
