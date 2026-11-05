<!--
  The Linked MRI (ui/chrome/sections.js:264-408, 413-470, 528-588, index.html:600-633): the three
  source-grid planes through the shared crosshair, a window and level, and the segmentation overlay.
  Opened by G4's Linked MRI button, `M` and the region inspector through S3's `openLinkedMri` (which
  loads the scan), or by a lesson; StageRegion mounts it.
  - on a desktop it is a region docked beside the live stage, with no focus trap;
  - on a phone or over the full-screen stage it is the modal Dialog (U5), and a phone shows one plane
    at a time, chosen by a radio group (deviations/g5-plane-radio.md, g5-plane-layout.md); each plane
    is a named section whose heading stays for assistive technology (g5-panel-names.md);
  - the pictures are `canvas role=img`, not focusable and without key handlers; the plane's slider is
    the keyboard route (deviations/g5-canvas-not-interactive.md). The crosshair, letters and an axial
    or coronal panel's convention are marked over the slice, and drawn into the bitmap only when it is
    saved;
  - the readout is said through the region's one live region after the crosshair has rested
    (g5-outputs-not-live.md, g5-unlabelled-sample.md); Save PNG is named by its plane and confirmed
    (g5-save-names.md, g5-save-announce.md); the wheel leaves Ctrl and Meta to the browser's zoom
    (g5-wheel-modifiers.md).
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { on } from 'svelte/events';
  import { MediaQuery, createSubscriber } from 'svelte/reactivity';
  import {
    AGREEMENT_CATEGORIES,
    AGREEMENT_COLORS,
  } from '../../lib/core/catalog/segmentation-agreement.ts';
  import { decimal, formatRas, millimetres } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type {
    EngineSections,
    MprPlane,
    PlaneFrame,
    SectionsState,
  } from '../../lib/engine/api.ts';
  import { PHONE_QUERY } from '../../lib/types/index.ts';
  import type { Language, ManifestAnatomy } from '../../lib/types/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import { REPEAT_GAP_MS } from '../../lib/ui/announcer.svelte.ts';
  import Dialog from '../../lib/ui/Dialog.svelte';
  import { captureInvoker } from '../../lib/ui/focus.ts';
  import IconButton from '../../lib/ui/IconButton.svelte';
  import RangeField from '../../lib/ui/RangeField.svelte';
  import StatusLine from '../../lib/ui/StatusLine.svelte';
  import type { MprDialogController } from './mpr-dialog.svelte.ts';
  import {
    AXES,
    COORDINATE_LIMIT,
    CROSSHAIR_INK,
    CROSSHAIR_RING,
    PLANES,
    annotatedCopy,
    crosshairOnPlane,
    drawSlice,
    edgeLetter,
  } from './mpr-draw.ts';
  import {
    canvasName,
    planeName,
    seenFrom,
    sideConvention,
    pngFileName,
    positionLabel,
    readoutText,
    saveSuffix,
    savedAnnouncement,
  } from './mpr-words.ts';

  interface Props {
    mpr: MprDialogController;
    engine: {
      sections: Pick<EngineSections, 'display' | 'sample' | 'mprFrame' | 'pixels'>;
    };
    /** The sections' display snapshot, replaced on every engine `change` (S1's engine sync). */
    engineState: { readonly sections: SectionsState };
    lang: Language;
    anatomy: Pick<ManifestAnatomy, 'subject' | 'individual'>;
    /** The structure whose segmentation agreement the planes show; null when none is. */
    agreementName: string | null;
    /** A region's name in the reader's language, for the readout. */
    regionName: (id: string) => string;
    /** Takes focus on close when the opener is gone. */
    fallbackFocus?: () => HTMLElement | null;
  }

  let { mpr, engine, engineState, lang, anatomy, agreementName, regionName, fallbackFocus }: Props =
    $props();

  /** The readout waits for the crosshair to rest, so a drag or a held key is not said per step. */
  const READOUT_QUIET_MS = 250;
  const EDGES = ['top', 'right', 'bottom', 'left'] as const;

  const uid = $props.id();
  const copy = $derived(t(lang, 'mpr'));
  const agreementCopy = $derived(t(lang, 'agreement'));
  const phone = new MediaQuery(PHONE_QUERY);
  const fullscreenChange = createSubscriber((update) => on(document, 'fullscreenchange', update));
  // Only the stage goes full screen, so a docked sibling would not be drawn; the modal's top layer is.
  const modal = $derived.by(() => {
    fullscreenChange();
    return phone.current || document.fullscreenElement !== null;
  });
  // The region's one live region: the phone's modal makes the page's announcer inert.
  let said = $state('');
  let quiet: ReturnType<typeof setTimeout> | undefined;

  let root = $state<HTMLElement>();
  let dock = $state<HTMLElement>();
  let canvases = $state<Partial<Record<MprPlane, HTMLCanvasElement>>>({});

  const crosshair = $derived(engineState.sections.crosshair);
  // The engine's getters are not reactive: they are read again with every new snapshot.
  const reading = $derived.by(() => {
    void engineState.sections;
    if (!mpr.open) return null;
    const display = engine.sections.display;
    if (!display) throw new Error('The linked MRI opened before the scan loaded.');
    return { display, sample: engine.sections.sample(crosshair) };
  });
  // Each panel as the stage faces its cut: read again with every snapshot, as the cut's side may change.
  const frames = $derived.by(() => {
    void engineState.sections;
    return Object.fromEntries(
      PLANES.map((plane) => [plane, engine.sections.mprFrame(plane)]),
    ) as Record<MprPlane, PlaneFrame>;
  });
  const visible = $derived(PLANES.filter((plane) => !phone.current || plane === mpr.plane));
  const readout = $derived(
    reading
      ? readoutText(
          formatRas(crosshair, lang),
          reading.sample,
          lang,
          reading.sample.cutRegion && regionName(reading.sample.cutRegion.id),
        )
      : '',
  );

  // A plane is resampled only when its own slice changes: the crosshair moving within it is marked
  // over the picture, not drawn into it. A plane nobody can see is drawn when it is shown
  // (sections.js:315-351), and a canvas that replaced another is drawn afresh.
  const drawn = new Map<MprPlane, { canvas: HTMLCanvasElement; key: string }>();
  $effect(() => {
    if (!reading) return;
    const { display } = reading;
    const { overlay, agreement } = engineState.sections;
    for (const plane of visible) {
      const canvas = canvases[plane]!;
      const frame = frames[plane];
      const key = JSON.stringify([
        frame.center,
        frame.u,
        frame.v,
        overlay,
        agreement,
        display.windowCenter,
        display.windowWidth,
      ]);
      const last = drawn.get(plane);
      if (last?.canvas === canvas && last.key === key) continue;
      drawn.set(plane, { canvas, key });
      untrack(() => drawSlice(canvas, engine.sections.pixels(frame), display.size));
    }
  });

  // Opening says nothing (the region's name does); a later change of what is under the crosshair is
  // said once it has rested.
  let spoken: string | null = null;
  $effect(() => {
    const text = readout;
    clearTimeout(quiet);
    if (!mpr.open) {
      spoken = null;
      said = '';
      return;
    }
    if (spoken !== null && text !== spoken)
      quiet = setTimeout(() => (said = text), READOUT_QUIET_MS);
    spoken = text;
  });
  $effect(() => () => clearTimeout(quiet));

  // The phone dialog's sticky header grows when its title wraps (200 % text, a narrow phone): the
  // focus scroll margin follows its measured height (WCAG 2.4.11).
  $effect(() => {
    const header = root?.closest('dialog')?.querySelector('.dialog-header');
    if (!root || !header) return;
    const target = root;
    const observer = new ResizeObserver(() =>
      target.style.setProperty('--header-clearance', `${header.getBoundingClientRect().height}px`),
    );
    observer.observe(header);
    return () => observer.disconnect();
  });

  // Focus inside what the viewport change removes goes to what replaces it: a plane that becomes
  // hidden hands it to the radio group; the radio group going hands it to the plane's slider.
  let handOff: 'radio' | 'slider' | null = null;
  $effect.pre(() => {
    const isPhone = phone.current;
    const shown = mpr.plane;
    untrack(() => {
      const focused = document.activeElement;
      if (!root?.contains(focused)) return;
      const inPlane = (focused as Element).closest<HTMLElement>('.plane');
      if (isPhone && inPlane && inPlane.dataset.plane !== shown) handOff = 'radio';
      else if (!isPhone && (focused as Element).closest('[role="radiogroup"]')) handOff = 'slider';
    });
  });
  $effect(() => {
    void phone.current;
    void mpr.plane;
    if (!handOff) return;
    const target = handOff;
    handOff = null;
    void tick().then(() => {
      const next =
        target === 'radio'
          ? root?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
          : root?.querySelector<HTMLElement>(
              `.plane[data-plane="${mpr.plane}"] input[type="range"]`,
            );
      next?.focus();
    });
  });

  /** The keymap's `mprOpen`: the modal holds the page's keys; docked, only focus inside it does. */
  export function holdsKeys(): boolean {
    if (!mpr.open) return false;
    return modal || Boolean(dock?.contains(document.activeElement));
  }

  /** Close takes focus on opening; closing with focus inside (now on the body) returns it to the opener. */
  function docked(region: HTMLElement) {
    const returnToOpener = captureInvoker();
    region.querySelector<HTMLElement>('.mpr-dock-close')!.focus();
    const stop = on(region, 'keydown', (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      mpr.close({ instant: true });
    });
    return () => {
      stop();
      const active = document.activeElement;
      if (active && active !== document.body && !region.contains(active)) return;
      if (!returnToOpener()) fallbackFocus?.()?.focus();
    };
  }

  // The dock may be dragged between its narrowest useful width and leaving the stage this much.
  const DOCK_MIN = 240;
  const STAGE_MIN = 360;
  const RESIZE_STEP = 24;
  let dockWidth = $state(0);
  let resizing: { x: number; width: number; max: number } | null = null;

  /** The widest the dock may be now: what it and the stage share, less the stage's minimum. */
  function widest(): number {
    const stage = document.getElementById('viewport')!.getBoundingClientRect().width;
    return Math.max(DOCK_MIN, dockWidth + stage - STAGE_MIN);
  }
  function resizeTo(width: number, max: number) {
    mpr.width = Math.round(Math.min(max, Math.max(DOCK_MIN, width)));
  }
  function startResize(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    resizing = { x: event.clientX, width: dockWidth, max: widest() };
  }
  function moveResize(event: PointerEvent) {
    if (!resizing) return;
    // The dock sits right of the stage, so moving left widens it.
    resizeTo(resizing.width + resizing.x - event.clientX, resizing.max);
  }
  function resizeKey(event: KeyboardEvent) {
    const step = { ArrowLeft: RESIZE_STEP, ArrowRight: -RESIZE_STEP }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    resizeTo(dockWidth + step, widest());
  }

  /** Pointer shortcuts on a picture: a click places the crosshair, the wheel scrolls the slice. The
   * keyboard route is the plane's slider (deviations/g5-canvas-not-interactive.md). */
  function pointer(plane: MprPlane) {
    return (canvas: HTMLCanvasElement) => {
      const stops = [
        on(canvas, 'click', (event) => {
          const rect = canvas.getBoundingClientRect();
          mpr.place(
            plane,
            (event.clientX - rect.left) / rect.width,
            (event.clientY - rect.top) / rect.height,
          );
        }),
        // Not passive: a wheel that moves the slice must not also scroll the page.
        on(
          canvas,
          'wheel',
          (event) => {
            // Ctrl and Meta with the wheel are the browser's zoom (deviations/g5-wheel-modifiers.md).
            if (event.ctrlKey || event.metaKey) return;
            if (mpr.wheel(plane, event.deltaY)) event.preventDefault();
          },
          { passive: false },
        ),
      ];
      return () => stops.forEach((stop) => stop());
    };
  }

  function save(plane: MprPlane) {
    const link = document.createElement('a');
    link.download = pngFileName(anatomy.subject, plane, crosshair[AXES[plane]]);
    link.href = annotatedCopy(canvases[plane]!, {
      plane,
      frame: frames[plane],
      fieldOfView: reading!.display.fieldOfView,
      crosshair,
      lang,
    }).toDataURL('image/png');
    link.click();
    // The same sentence again must change the region to be spoken again: cleared, then written after
    // a gap, as the page announcer does, so the two writes fall in separate rendering updates.
    clearTimeout(quiet);
    said = '';
    const sentence = savedAnnouncement(plane, lang);
    quiet = setTimeout(() => (said = sentence), REPEAT_GAP_MS);
  }
</script>

{#snippet body()}
  <div
    class="mpr"
    bind:this={root}
    style:--crosshair-ink={CROSSHAIR_INK}
    style:--crosshair-ring={CROSSHAIR_RING}
  >
    {#if phone.current}
      <ChoiceGroup
        label={copy.planes}
        options={PLANES.map((plane) => ({ value: plane, label: planeName(plane, lang) }))}
        bind:value={mpr.plane}
      />
    {/if}

    <div class="grid">
      {#each PLANES as plane (plane)}
        {@const frame = frames[plane]}
        {@const convention = sideConvention(frame.edges)}
        <section
          class="plane"
          data-plane={plane}
          hidden={!visible.includes(plane)}
          aria-labelledby="{uid}-{plane}"
        >
          <h3 id="{uid}-{plane}">
            {planeName(plane, lang)}
            <span class="seen-from">{copy.seenFrom[seenFrom(plane, frame.edges)]}</span
            >{#if convention}{' '}<span class="seen-from"
                >{`· ${copy.conventions[convention]}`}</span
              >{/if}
          </h3>
          <div class="picture">
            <!-- A picture of data is an image (ARIA 1.2 img; HTML-AAM allows it on canvas). -->
            <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
            <canvas
              role="img"
              width="512"
              height="512"
              aria-label={canvasName(plane, frame.edges, lang)}
              bind:this={canvases[plane]}
              {@attach pointer(plane)}
            ></canvas>
            {#if reading}
              {@const [across, down] = crosshairOnPlane(
                frame,
                crosshair,
                reading.display.fieldOfView,
              )}
              <!-- The canvas's name says which way each edge faces; these marks are its picture. -->
              <div class="crosshair-across" aria-hidden="true" style:top="{down * 100}%"></div>
              <div class="crosshair-down" aria-hidden="true" style:left="{across * 100}%"></div>
              {#each EDGES as edge, index (edge)}
                <span class="edge" data-edge={edge} aria-hidden="true"
                  >{edgeLetter(frame.edges[index]!, lang)}</span
                >
              {/each}
              {#if convention}
                <!-- The heading says it too, but a row of pictures is scanned, not read. -->
                <span class="convention" aria-hidden="true">{copy.conventionMarks[convention]}</span
                >
              {/if}
            {/if}
          </div>
          <div class="position">
            <label for="{uid}-position-{plane}">{positionLabel(plane, lang)}</label>
            <output class="value" for="{uid}-position-{plane}" aria-hidden="true"
              >{millimetres(crosshair[AXES[plane]], lang)}</output
            >
            <input
              id="{uid}-position-{plane}"
              class="slider"
              type="range"
              min={-COORDINATE_LIMIT}
              max={COORDINATE_LIMIT}
              step="1"
              value={crosshair[AXES[plane]]}
              aria-valuetext={millimetres(crosshair[AXES[plane]], lang)}
              oninput={(event) => mpr.moveTo(plane, event.currentTarget.valueAsNumber)}
            />
          </div>
          <button
            type="button"
            class="save"
            aria-label={`${copy.savePng}${saveSuffix(plane, lang)}`}
            onclick={() => save(plane)}>{copy.savePng}</button
          >
        </section>
      {/each}

      <div class="controls">
        <p class="where measure">{readout}</p>
        {#if agreementName}
          <div class="agreement">
            <p class="agreement-name">{agreementCopy.legend(agreementName)}</p>
            <ul class="agreement-key">
              {#each AGREEMENT_CATEGORIES as category (category)}
                <li>
                  <span
                    class="agreement-swatch"
                    aria-hidden="true"
                    style:background="rgb({AGREEMENT_COLORS[category].join(' ')})"
                  ></span>{agreementCopy.category[category]}
                </li>
              {/each}
            </ul>
            <button type="button" class="save" onclick={() => mpr.hideAgreement()}
              >{agreementCopy.hide}</button
            >
          </div>
        {/if}
        <StatusLine class="visually-hidden" text={said} />

        <div class="display">
          <RangeField
            label={copy.contrastWindow}
            value={reading?.display.windowWidth ?? 0}
            min={10}
            max={256}
            step={1}
            format={(value) => decimal(value, 0, lang)}
            oninput={(width) => mpr.setWindow({ width })}
          />
          <RangeField
            label={copy.windowCenter}
            value={reading?.display.windowCenter ?? 0}
            min={0}
            max={255}
            step={1}
            format={(value) => decimal(value, 0, lang)}
            oninput={(center) => mpr.setWindow({ center })}
          />
          <label class="check">
            <input
              type="checkbox"
              disabled={agreementName !== null}
              checked={engineState.sections.overlay}
              onchange={(event) => mpr.setOverlay(event.currentTarget.checked)}
            />
            <span>{copy.segmentationOverlay}</span>
          </label>
        </div>
      </div>
    </div>

    <div class="note">
      <p>{copy.asStage}</p>
      <p>{copy.subtitle}</p>
      <p>{copy.note(anatomy)}</p>
    </div>
  </div>
{/snippet}

{#if modal}
  <Dialog
    bind:open={mpr.open}
    bind:instant={mpr.instant}
    variant="imaging"
    {fallbackFocus}
    closeLabel={copy.close}
  >
    {#snippet heading(id)}
      <h2 {id}>{copy.title}</h2>
    {/snippet}
    {@render body()}
  </Dialog>
{:else if mpr.open}
  <section
    class="mpr-dock"
    class:sized={mpr.width !== null}
    style:--mpr-dock-width={mpr.width === null ? null : `${mpr.width}px`}
    aria-labelledby="{uid}-title"
    bind:this={dock}
    bind:clientWidth={dockWidth}
    {@attach docked}
  >
    <!-- The dock's left edge: dragged, or moved with the arrow keys; a double click restores the layout's width. -->
    <!-- A focusable separator is a widget (ARIA 1.2 separator), which Svelte's check does not know. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="mpr-dock-resize"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      aria-label={copy.resize}
      aria-valuemin={DOCK_MIN}
      aria-valuemax={Math.round(dockWidth ? widest() : DOCK_MIN)}
      aria-valuenow={Math.round(dockWidth)}
      title={copy.resizeHint}
      onpointerdown={startResize}
      onpointermove={moveResize}
      onpointerup={() => (resizing = null)}
      onpointercancel={() => (resizing = null)}
      ondblclick={() => (mpr.width = null)}
      onkeydown={resizeKey}
    ></div>
    <div class="mpr-dock-header">
      <h2 id="{uid}-title">{copy.title}</h2>
      <IconButton
        class="mpr-dock-close"
        icon="close"
        label={copy.close}
        onclick={() => mpr.close({ instant: false })}
      />
    </div>
    <div class="mpr-dock-body scroll-fade">
      {@render body()}
    </div>
  </section>
{/if}

<style>
  @layer components {
    /* dialogs.css:135-204 */
    .mpr {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-4);
      margin-top: var(--space-4);
      min-width: 0;
    }
    .mpr :global(:is(button, input, canvas)) {
      /* The sticky header must not cover what a keyboard puts in view (WCAG 2.4.11). */
      scroll-margin-top: calc(var(--header-clearance, var(--header-height)) + var(--space-2));
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-4);
    }
    /* Each plane's heading, picture and position on the grid's own rows, so the pictures of a row
       line up when one heading wraps. */
    .plane {
      grid-row: span 3;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-rows: subgrid;
      gap: 0 var(--space-3);
      align-items: center;
      align-content: start;
    }
    .plane[hidden] {
      display: none;
    }
    /* The plane, then the side it is seen from, which wraps whole under it on a narrow panel. */
    h3 {
      grid-column: 1;
      grid-row: 1;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      column-gap: var(--space-1);
      margin: 0;
      font-size: var(--text-ui);
      font-weight: 600;
    }
    /* Which side the picture faces, quieter than the plane it qualifies. */
    .seen-from {
      white-space: nowrap;
      color: var(--text-secondary);
      font-weight: 400;
    }
    .save {
      grid-column: 2;
      grid-row: 1;
      justify-self: end;
      height: var(--control-height);
      padding: 0 var(--space-2);
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      background: none;
      color: var(--text-secondary);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    .save:active:not(:focus-visible) {
      transform: scale(var(--press-scale));
    }
    .picture {
      grid-column: 1 / -1;
      grid-row: 2;
      position: relative;
      margin-top: var(--space-2);
      overflow: hidden;
      border-radius: var(--radius-mark);
      background: var(--mpr-canvas);
      container: mpr-picture / inline-size;
    }
    canvas {
      display: block;
      width: 100%;
      height: auto;
      cursor: crosshair;
    }
    /* The crosshair at one screen pixel, ringed in dark, however small the panel draws the slice. */
    .crosshair-across,
    .crosshair-down {
      position: absolute;
      background: var(--crosshair-ink);
      box-shadow: 0 0 0 1px var(--crosshair-ring);
      pointer-events: none;
    }
    .crosshair-across {
      left: 0;
      right: 0;
      height: 1px;
      translate: 0 -0.5px;
    }
    .crosshair-down {
      top: 0;
      bottom: 0;
      width: 1px;
      translate: -0.5px 0;
    }
    /* The edge letters as the stage marks its own: haloed type, not plates (Orientation.svelte). */
    .edge,
    .convention {
      position: absolute;
      color: var(--overlay-ink);
      -webkit-text-stroke: 3px var(--overlay-halo-core);
      paint-order: stroke fill;
      text-shadow:
        0 0 1px var(--overlay-halo-core),
        0 0 2px var(--overlay-halo-core),
        0 0 4px var(--overlay-halo-core),
        0 0 8px var(--overlay-halo);
      font-size: var(--text-stage);
      font-weight: 600;
      line-height: var(--lh-caption);
      letter-spacing: 0.06em;
      pointer-events: none;
    }
    [data-edge='top'],
    [data-edge='bottom'] {
      left: 50%;
      translate: -50% 0;
    }
    [data-edge='top'] {
      top: var(--space-1);
    }
    [data-edge='bottom'] {
      bottom: var(--space-1);
    }
    [data-edge='left'],
    [data-edge='right'] {
      top: 50%;
      translate: 0 -50%;
    }
    [data-edge='left'] {
      left: var(--space-2);
    }
    [data-edge='right'] {
      right: var(--space-2);
    }
    /* Which way left and right fall, in the corner the top letter leaves free. */
    .convention {
      top: var(--space-1);
      left: var(--space-2);
      font-size: var(--text-caption);
      letter-spacing: 0.02em;
    }
    /* A picture too narrow for the word beside the top letter takes it a line lower. */
    @container mpr-picture (width < 12.5rem) {
      .convention {
        top: calc(var(--space-1) + var(--lh-caption));
      }
    }
    /* The readout and the display controls: a row under the planes, or the fourth cell of a column's 2 × 2. */
    .controls {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-content: start;
      gap: var(--space-4);
      min-width: 0;
    }
    /* The label, its value and the slider, as the legacy label wrapped them: the slider always shows
       the crosshair, which a RangeField holds back while it has focus. */
    .position {
      grid-column: 1 / -1;
      grid-row: 3;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: baseline;
      column-gap: var(--space-3);
      margin-top: var(--space-2);
      font-size: var(--text-ui);
    }
    .position label {
      font-weight: 500;
      color: var(--text-secondary);
    }
    .value {
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .position input {
      grid-column: 1 / -1;
    }
    /* The crosshair's position and label: a tonal readout, not a boxed field. */
    .where {
      margin: 0;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-control);
      background: var(--surface-navigation);
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      overflow-wrap: anywhere;
    }
    /* The agreement shown: what is compared, the planes' key, and the way back to the segmentation. */
    .agreement {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-4);
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
    }
    .agreement-name {
      margin: 0;
      font-weight: 600;
    }
    .agreement-key {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1) var(--space-4);
      margin: 0;
      padding: 0;
      list-style: none;
      color: var(--text-secondary);
    }
    .agreement-key li {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .agreement-swatch {
      width: 10px;
      height: 10px;
      border-radius: var(--radius-mark);
    }
    .agreement .save {
      margin-left: auto;
    }
    .display {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--space-2) var(--space-6);
      padding-top: var(--space-2);
    }
    .check {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--control-height);
      font-size: var(--text-ui);
      cursor: pointer;
    }
    input[type='checkbox'] {
      appearance: none;
      display: grid;
      place-content: center;
      flex: none;
      width: 16px;
      height: 16px;
      margin: 0;
      border: 1px solid var(--border-control);
      border-radius: var(--radius-small);
      background: var(--surface-base);
      cursor: pointer;
    }
    input[type='checkbox']::before {
      content: '';
      width: 8px;
      height: 4px;
      border-left: 1.5px solid transparent;
      border-bottom: 1.5px solid transparent;
      transform: rotate(-45deg) translateY(-1px);
    }
    input[type='checkbox']:checked {
      background: var(--accent);
      border-color: var(--accent);
    }
    input[type='checkbox']:checked::before {
      border-color: var(--surface-base);
    }
    input[type='checkbox']:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .note {
      padding-top: var(--space-3);
      border-top: 1px solid var(--border-subtle);
    }
    .note > p {
      margin: 0;
      max-width: 72ch;
      text-wrap: pretty;
    }
    .note > p + p {
      margin-top: var(--space-1);
    }
    @media (hover: hover) and (pointer: fine) {
      .save:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
      .mpr-dock-resize:hover::after {
        background: var(--overlay-ink-muted);
      }
    }
    @media (pointer: coarse) {
      .save {
        height: 44px;
      }
    }
    @media (max-width: 700px) {
      .display {
        grid-template-columns: 1fr;
      }
    }
    /* The imaging dialog's dark in both themes; layout.css places it. */
    .mpr-dock {
      color-scheme: dark;
      --text-primary: var(--overlay-ink);
      --text-secondary: var(--overlay-ink-muted);
      --text-tertiary: var(--overlay-ink-faint);
      --accent: var(--overlay-accent);
      --accent-hover: var(--overlay-accent-hover);
      --accent-wash: var(--overlay-accent-wash);
      --primary-fill: var(--overlay-primary-fill);
      --primary-fill-hover: var(--overlay-primary-fill-hover);
      --surface-base: var(--overlay-plate);
      --surface-navigation: var(--overlay-track);
      --surface-sunken: var(--scene-background);
      --surface-hover: var(--overlay-plate-hover);
      --surface-raised: var(--overlay-raised);
      --surface-tonal: var(--overlay-track);
      --surface-tonal-hover: var(--overlay-track-hover);
      --border-subtle: var(--overlay-border);
      --border-control: var(--overlay-control-border);
      --thumb-ring: var(--overlay-ink-faint);
      --danger: var(--overlay-danger);
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      background: var(--surface-base);
      color: var(--text-primary);
    }
    .mpr-dock {
      position: relative;
    }
    /* A grip straddling the dock's border; its line shows only under the pointer or the keyboard. */
    .mpr-dock-resize {
      position: absolute;
      inset: 0 auto 0 -5px;
      z-index: 1;
      width: 9px;
      cursor: col-resize;
      touch-action: none;
    }
    .mpr-dock-resize::after {
      content: '';
      position: absolute;
      inset: 0 auto 0 4px;
      width: 1px;
      background: transparent;
      transition: background-color var(--ui-transition) var(--ease-ui);
    }
    .mpr-dock-resize:is(:active, :focus-visible)::after {
      background: var(--overlay-ink-muted);
    }
    .mpr-dock-resize:focus-visible {
      outline-offset: -2px;
    }
    .mpr-dock :focus-visible {
      outline-color: var(--overlay-accent);
    }
    .mpr-dock-header {
      display: flex;
      flex: none;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      min-height: var(--header-height);
      padding: var(--space-1) var(--space-4);
      border-bottom: 1px solid var(--border-subtle);
    }
    .mpr-dock-header h2 {
      min-width: 0;
      margin: 0;
      font-size: var(--text-ui);
      font-weight: 600;
    }
    /* The glyph, not its ground, meets the content edge. */
    .mpr-dock-header :global(.mpr-dock-close) {
      flex: none;
      margin-right: calc((16px - var(--control-height)) / 2);
    }
    /* Its own size decides its shape: a column beside the stage is taller than wide. */
    .mpr-dock-body {
      flex: 1;
      min-height: 0;
      padding: 0 var(--space-4) var(--space-4);
      overflow: auto;
      overscroll-behavior: contain;
      container: mpr-dock / size;
    }
    @container mpr-dock (max-aspect-ratio: 1 / 1) {
      .grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .controls {
        grid-column: auto;
        grid-row: span 3;
      }
      .display {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    /* A narrow column stacks the planes, each as wide as the column. */
    @container mpr-dock (max-width: 400px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    /* The phone layout (PHONE_QUERY; dialogs.css:262-290): one plane, so one column, and the radio
       group names it, so its heading is kept for assistive technology and not drawn (g5-plane-layout.md,
       g5-panel-names.md). */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
      h3 {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      .save {
        transition-property: background-color, color;
        transform: none;
      }
    }
    @media (prefers-contrast: more) {
      .mpr {
        --text-tertiary: var(--text-secondary);
        --border-control: var(--text-primary);
        --border-subtle: var(--border-control);
      }
    }
    @media (forced-colors: active) {
      .save:focus-visible,
      input[type='checkbox']:focus-visible {
        outline: 2px solid Highlight;
      }
      /* The tick would be forced to ink on every box, checked or not: the system control draws itself. */
      input[type='checkbox'] {
        appearance: auto;
        background: Canvas;
        border-color: CanvasText;
      }
      input[type='checkbox']::before {
        content: none;
      }
    }
  }
</style>
