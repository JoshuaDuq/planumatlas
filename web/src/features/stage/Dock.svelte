<!--
  The stage dock: one plate of worded tools, Section, Lesion, Coordinate, Overlay and Display, each opening a popover
  (index.html:433-490, stage.css:311-440). APG Toolbar (deviation g2-dock-toolbar): the row is a labelled
  `role="toolbar"` with one Tab stop; ← → ↑ ↓ and Home/End move between the visible tools, Enter and Space
  open. The tract reference has none of them, so the dock is not drawn over it.
  - U5's popover keeps its trigger and its content together, so the popovers' controls sit inside the toolbar
    element. Only the tools rove (`.stage-tool`); keys inside a popover are the popover's own.
  - The popovers are placed above the whole dock on its start edge, inside the visible stage (place-popover.ts).
    One stays open while the reader works beside it, until its tool, Escape or another tool closes it.
  - On a wider screen the open popover takes a band off the stage's left (`stage.setPlateBand`), so the camera
    frames the anatomy beside it, unless that would leave the anatomy less than 320 px (a 1024 px window keeps 352).
  - Section's popover and the section row above the tools are G4's, the Lesion's and Coordinate's bodies the
    lesion feature's: they come in as snippets. Coordinate is offered only with a body (published spaces).
  - Overlay, the reader's own NIfTI map, is offered only with a body, and not on a stage narrower than
    480 px, a phone's, where the other four tools fill one row.
  - A click on the brain places the lesion only while the reader has chosen so in the Lesion popover and it is
    open.
  - The dock root carries `data-own-keys` (decision 7): the page's single-key shortcuts skip its controls.
  - On a phone, which hides the status bar, a mark on Display says its settings are away from their defaults.
  - On a phone an open popover's plate covers most of the stage, so the camera frames the anatomy above it
    (`onPlate`) while it is open. On either screen the camera moves at once when the input that opened,
    changed or closed it was a key.
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import type { Snippet } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { CortexSurface } from '../../lib/core/user-map/display.ts';
  import { displayChanges } from '../colophon/display-state.ts';
  import type { PreparedDisplay } from '../colophon/display-state.ts';
  import type { DisplayView } from '../colophon/display-state.ts';
  import type { Media } from '../../lib/state/media.svelte.ts';
  import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
  import type { View } from '../../lib/state/view.svelte.ts';
  import type { Language, SessionState } from '../../lib/types/index.ts';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/ui/keys.ts';
  import { bindRoving } from '../../lib/ui/roving.ts';
  import type { DockCommands } from './dock-commands.ts';
  import DisplayPopover from './DisplayPopover.svelte';
  import { POPOVER_WIDTH, placePopover } from './place-popover.ts';
  import StagePopover from './StagePopover.svelte';

  interface Props {
    stage: StageLayout;
    media: Pick<Media, 'phone'>;
    lang: Language;
    status: SessionState['status'];
    /** The tract reference alone is shown: it has no sections, lesion or display settings. */
    tractReference: boolean;
    /** The display settings the Display popover shows, and what it says is away from its defaults. */
    view: Omit<DisplayView, 'lang'> & Pick<View, 'spinalCordVisible'>;
    /** The surface the cortex is drawn on, which the Overlay popover also sets. */
    cortexSurface: CortexSurface;
    /** The display the reader's changes are counted from (`excursions.displayBaseline`). */
    prepared: PreparedDisplay;
    /** The subject publishes a spinal cord. */
    hasSpinalCord: boolean;
    commands: Omit<DockCommands, 'chooseView' | 'resetView'>;
    /** G4: the body of the Section popover, and the section row above the tools. */
    sectionPopover: Snippet<[{ close: () => void }]>;
    sectionBar?: Snippet;
    /** The Lesion popover's body, with the choice of what a click on the brain does. */
    lesionPopover: Snippet<
      [{ close: () => void; placing: boolean; setPlacing: (placing: boolean) => void }]
    >;
    /** The Coordinate popover's body; without one the tool is not offered. */
    coordinatePopover?: Snippet<[{ close: () => void }]>;
    /** The Overlay popover's body, the reader's own map; without one the tool is not offered. */
    overlayPopover?: Snippet<[{ close: () => void }]>;
    onLesionPlacing: (placing: boolean) => void;
    /** On a phone, the open popover's top edge on the stage host, or null once it closes (`camera.clearPlate`). */
    onPlate: (top: number | null, options: { immediate: boolean }) => void;
  }

  let {
    stage,
    media,
    lang,
    status,
    tractReference,
    view,
    cortexSurface,
    prepared,
    hasSpinalCord,
    commands,
    sectionPopover,
    sectionBar,
    lesionPopover,
    coordinatePopover,
    overlayPopover,
    onLesionPlacing,
    onPlate,
  }: Props = $props();

  const NARROW_STAGE_PX = 480;
  // The least room a wider screen keeps for the anatomy beside an open popover.
  const ROOM_BESIDE_PLATE_PX = 320;
  const uid = $props.id();
  const sectionLabelId = `section-tool-${uid}`;
  const lesionLabelId = `lesion-tool-${uid}`;
  const coordinateLabelId = `coordinate-tool-${uid}`;
  const overlayLabelId = `overlay-tool-${uid}`;
  // A stage this narrow fits only the other four tools on one row.
  const narrow = $derived((stage.visibleRect?.width ?? Infinity) < NARROW_STAGE_PX);
  const displayLabelId = `display-tool-${uid}`;

  const copy = $derived(t(lang, 'viewport'));
  const changes = $derived(displayChanges({ ...view, lang }, prepared, cortexSurface));
  // A phone hides the status bar, which lists the changes.
  const marked = $derived(media.phone && changes.length > 0);
  // The dock is not drawn while the anatomy loads, failed or lost its context (stage.css:315).
  const shown = $derived(status === 'ready' || status === 'switching');
  // A phone sheet raised over the stage covers it.
  const covered = $derived(!shown || stage.sheetFull);

  let sectionOpen = $state(false);
  let lesionOpen = $state(false);
  let coordinateOpen = $state(false);
  let overlayOpen = $state(false);
  let displayOpen = $state(false);
  const anyOpen = $derived(
    sectionOpen || lesionOpen || coordinateOpen || overlayOpen || displayOpen,
  );
  // Which one, so a swap from one tool to another measures the plate that opened.
  const openTool = $derived(
    [sectionOpen, lesionOpen, coordinateOpen, overlayOpen, displayOpen].findIndex(Boolean),
  );
  // A click places the lesion only while the reader chose so, and only until the Lesion popover closes.
  let placing = $state(false);
  $effect(() => {
    if (!lesionOpen) placing = false;
  });
  $effect(() => onLesionPlacing(lesionOpen && placing && !tractReference));

  let dock: HTMLElement;
  let tools: HTMLElement;

  $effect(() => stage.observeDock(dock));

  // A followed link replaces the whole scene (the app writes its own state with replaceState, which fires
  // no `hashchange`): a popover still open would act on the scene it was opened for.
  $effect(() => {
    const closeAll = () => {
      sectionOpen = lesionOpen = coordinateOpen = overlayOpen = displayOpen = false;
    };
    addEventListener('hashchange', closeAll);
    return () => removeEventListener('hashchange', closeAll);
  });

  function rove(group: HTMLElement) {
    const roving = bindRoving(group, { selector: '.stage-tool' });
    // Inside an open popover the Tab stop is its own tool, so Shift+Tab from its first control returns
    // to the tool with the popover still open (stage-tools.js:114-117), not to the first tool.
    const keepOpenTool = (event: FocusEvent) => {
      const open = group.querySelector<HTMLElement>('.stage-tool[aria-expanded="true"]');
      if (!open || (event.target as Element).closest('.stage-tool')) return;
      for (const tool of group.querySelectorAll<HTMLElement>('.stage-tool')) {
        tool.tabIndex = tool === open ? 0 : -1;
      }
    };
    group.addEventListener('focusin', keepOpenTool);
    return () => {
      group.removeEventListener('focusin', keepOpenTool);
      roving.dispose();
    };
  }

  /** The first tool left, or the model once the tract reference takes them all; runs before they hide. */
  function rescueFocus() {
    const next = tractReference
      ? dock.parentElement!.querySelector<HTMLElement>(':scope > canvas')
      : tools.querySelector<HTMLElement>('.stage-tool:not([hidden])');
    next?.focus({ preventScroll: true });
  }

  // Where the open popover goes: measured once the dock has moved to where the stage's variables put it.
  let spot = $state<ReturnType<typeof placePopover> | null>(null);
  $effect(() => {
    if (!anyOpen) return;
    const { visibleRect } = stage;
    void [stage.hostSize, stage.dock, stage.gutter];
    if (!visibleRect) return;
    const fill = media.phone;
    let current = true;
    tick().then(() => {
      if (!current) return;
      const origin = dock.offsetParent!.getBoundingClientRect();
      const corner = dock.getBoundingClientRect();
      const placed = placePopover({
        toolbar: { left: corner.left - origin.left, top: corner.top - origin.top },
        visible: visibleRect,
        width: POPOVER_WIDTH,
        fill,
        gutter: stage.gutter,
      });
      // `left` is measured from the dock's outer edge; CSS places it inside the dock's border.
      spot = { ...placed, left: placed.left - dock.clientLeft };
    });
    return () => {
      current = false;
    };
  });
  // Whether the reader's last input was a key: a plate that opens, grows or closes on one moves the camera
  // at once. Read in capture, before Bits opens on the key or a tap outside closes the popover.
  let keyed = false;
  $effect(() => {
    const key = () => (keyed = true);
    const point = () => (keyed = false);
    addEventListener('keydown', key, true);
    addEventListener('pointerdown', point, true);
    return () => {
      removeEventListener('keydown', key, true);
      removeEventListener('pointerdown', point, true);
    };
  });
  // Whether framing has a plate to withdraw.
  let plate = false;
  $effect(() => {
    if (openTool < 0 || !media.phone || !spot) return;
    let current = true;
    let observer: ResizeObserver | null = null;
    tick().then(() => {
      if (!current) return;
      const element = dock.querySelector<HTMLElement>('.popover.stage-popover')!;
      plate = true;
      // Laid-out offsets, which the plate's entry scale does not move.
      const top = () => dock.offsetTop + dock.clientTop + element.offsetTop;
      observer = new ResizeObserver(() => onPlate(top(), { immediate: keyed }));
      observer.observe(element);
    });
    return () => {
      current = false;
      observer?.disconnect();
    };
  });
  $effect(() => {
    if (anyOpen && media.phone) return;
    untrack(() => {
      if (!plate) return;
      onPlate(null, { immediate: keyed });
      plate = false;
    });
  });
  // On a wider screen the open plate's band: the visible stage left of its right edge and a gutter.
  $effect(() => {
    if (openTool < 0 || media.phone || !spot) return;
    const { visibleRect } = stage;
    if (!visibleRect) return;
    let current = true;
    tick().then(() => {
      if (!current) return;
      const element = dock.querySelector<HTMLElement>('.popover.stage-popover')!;
      // Laid-out offsets, which the plate's entry scale does not move.
      const right = dock.offsetLeft + dock.clientLeft + element.offsetLeft + element.offsetWidth;
      const band = right + stage.gutter - visibleRect.x;
      const roomy = visibleRect.width - band >= ROOM_BESIDE_PLATE_PX;
      stage.setPlateBand(roomy ? band : 0, { immediate: keyed });
    });
    return () => {
      current = false;
    };
  });
  $effect(() => {
    if (anyOpen && !media.phone) return;
    untrack(() => stage.setPlateBand(0, { immediate: keyed }));
  });

  const popoverStyle = $derived(
    spot
      ? `left: ${spot.left}px; width: ${spot.width}px; max-height: ${spot.maxHeight}px`
      : `width: ${POPOVER_WIDTH}px`,
  );
</script>

<div
  bind:this={dock}
  class="stage-dock"
  data-shown={shown && !tractReference}
  {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
>
  <div
    bind:this={tools}
    class="stage-toolbar"
    role="toolbar"
    aria-label={copy.dockLabel}
    {@attach rove}
  >
    <StagePopover
      bind:open={sectionOpen}
      tool="section"
      hidden={tractReference}
      {covered}
      style={popoverStyle}
      dialogLabelledby={sectionLabelId}
      {rescueFocus}
    >
      {#snippet name()}<span id={sectionLabelId}>{copy.sectionTool}</span>{/snippet}
      {#snippet body({ close })}{@render sectionPopover({ close })}{/snippet}
    </StagePopover>
    <StagePopover
      bind:open={lesionOpen}
      tool="lesion"
      hidden={tractReference}
      {covered}
      style={popoverStyle}
      dialogLabelledby={lesionLabelId}
      {rescueFocus}
    >
      {#snippet name()}<span id={lesionLabelId}>{copy.lesionTool}</span>{/snippet}
      {#snippet body({ close })}
        {@render lesionPopover({ close, placing, setPlacing: (next) => (placing = next) })}
      {/snippet}
    </StagePopover>
    <StagePopover
      bind:open={coordinateOpen}
      tool="coordinate"
      hidden={tractReference || !coordinatePopover}
      {covered}
      style={popoverStyle}
      dialogLabelledby={coordinateLabelId}
      {rescueFocus}
    >
      {#snippet name()}<span id={coordinateLabelId}>{copy.coordinateTool}</span>{/snippet}
      {#snippet body({ close })}{@render coordinatePopover?.({ close })}{/snippet}
    </StagePopover>
    <StagePopover
      bind:open={overlayOpen}
      tool="overlay"
      hidden={tractReference || !overlayPopover || narrow}
      {covered}
      style={popoverStyle}
      dialogLabelledby={overlayLabelId}
      {rescueFocus}
    >
      {#snippet name()}<span id={overlayLabelId}>{copy.overlayTool}</span>{/snippet}
      {#snippet body({ close })}{@render overlayPopover?.({ close })}{/snippet}
    </StagePopover>
    <StagePopover
      bind:open={displayOpen}
      tool="display"
      hidden={tractReference}
      {covered}
      style={popoverStyle}
      dialogLabelledby={displayLabelId}
      ariaLabel={marked ? `${copy.displayTool}${t(lang, 'display').changed}` : undefined}
      {rescueFocus}
    >
      {#snippet name()}
        <span id={displayLabelId}>{copy.displayTool}</span>
        {#if marked}<span class="changed-mark" aria-hidden="true"></span>{/if}
      {/snippet}
      {#snippet body({ scrubbing })}
        <DisplayPopover
          {lang}
          hemisphere={view.hemisphere}
          cortexVisible={view.cortexVisible}
          cortexOpacity={view.cortexOpacity}
          {cortexSurface}
          internalVisible={view.internalVisible}
          spinalCordVisible={view.spinalCordVisible}
          {hasSpinalCord}
          {changes}
          {scrubbing}
          onHemisphere={commands.setHemisphere}
          onCortexVisible={commands.setCortexVisible}
          onCortexOpacity={commands.setCortexOpacity}
          onCortexSurface={commands.setCortexSurface}
          onInternalVisible={commands.setInternalVisible}
          onSpinalCordVisible={commands.setSpinalCordVisible}
          onResetDisplay={commands.resetDisplay}
        />
      {/snippet}
    </StagePopover>
  </div>
  {@render sectionBar?.()}
</div>

<style>
  @layer features {
    /* The dock: one plate, the tools on its bottom line and the section row above them. */
    .stage-dock {
      position: absolute;
      /* Above the markings and keys, so an open popover is never drawn under the scale bar. */
      z-index: 3;
      left: calc(var(--vis-left) + var(--stage-gutter));
      bottom: calc(var(--vis-bottom) + var(--stage-gutter));
      display: flex;
      flex-direction: column-reverse;
      width: max-content;
      max-width: calc(100% - var(--vis-left) - var(--vis-right) - 2 * var(--stage-gutter));
      background: var(--overlay-plate);
      border: 1px solid var(--stage-edge);
      border-radius: var(--radius-control);
    }
    .stage-dock[data-shown='false'] {
      visibility: hidden;
    }
    /* Static, so the popovers inside it are placed against the whole dock and open above the section row. */
    .stage-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1);
    }
    :global(.stage-tool) {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--control-height);
      margin: 0;
      padding: 0 var(--space-3);
      border: 0;
      border-radius: var(--radius-small);
      background: transparent;
      color: var(--overlay-ink);
      font-size: var(--text-stage);
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    /* Pointer presses only: a key that opens a tool answers at once. */
    :global(.stage-tool:active:not(:focus-visible)) {
      transform: scale(var(--press-scale));
    }
    @media (pointer: coarse) {
      :global(.stage-tool) {
        min-height: 44px;
      }
    }
    /*
     * A phone's stage holds the four tools on one row, in French too, down to a 360px screen. A tool has
     * no ground until it opens, so the targets can meet.
     */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .stage-toolbar {
        gap: 0;
      }
      :global(.stage-tool) {
        gap: var(--space-1);
        padding: 0 var(--space-2);
      }
    }
    :global(.stage-tool[hidden]) {
      display: none;
    }
    .changed-mark {
      flex: none;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
    }
    @media (hover: hover) and (pointer: fine) {
      :global(.stage-tool:hover:not(:disabled)) {
        background: var(--overlay-plate-hover);
      }
      :global(.stage-tool[aria-expanded='true']:hover) {
        background: var(--overlay-track);
      }
    }
    :global(.stage-tool[aria-expanded='true']) {
      background: var(--overlay-track);
    }
    /* Drawn, like every disclosure chevron. It points up while its popover is open. */
    :global(.stage-tool-chevron) {
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
    :global([aria-expanded='true'] > .stage-tool-chevron) {
      transform: translateY(4px) rotate(-135deg);
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      /* A chevron points the new way at once (a11y.css:13). */
      :global(.stage-tool-chevron) {
        transition: none;
      }
      :global(.stage-tool) {
        transition-property: background-color;
      }
      :global(.stage-tool:active) {
        transform: none;
      }
    }
    @media (forced-colors: active) {
      .stage-dock,
      :global(.popover.stage-popover) {
        border-color: CanvasText;
      }
      /* Fills are dropped here: the open tool needs a system-colour edge. */
      :global(.stage-tool[aria-expanded='true']) {
        outline: 2px solid Highlight;
        outline-offset: -2px;
      }
    }
  }
</style>
