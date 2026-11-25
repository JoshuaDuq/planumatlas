<!--
  The Linked MRI's serial sections: SERIES_COUNT evenly spaced sections of one plane, cropped to the
  labelled brain so they share one scale, after a localizer on the crossing plane that marks where
  they lie. Pictures are images, as the planes' are (deviations/g5-canvas-not-interactive.md): a click
  places the crosshair, and the section it lands on shows it.
-->
<script lang="ts">
  import { decimal, withUnit } from '../../lib/core/format.ts';
  import * as serialCopy from '../../lib/core/i18n/areas/serial.ts';
  import type {
    EngineSections,
    EngineTracts,
    MprPlane,
    MriDisplay,
    PlaneFrame,
    PlaneTracts,
    SectionsState,
    Vec3,
  } from '../../lib/engine/api.ts';
  import type { Language } from '../../lib/types/index.ts';
  import IconButton from '../../lib/ui/IconButton.svelte';
  import { AXES, edgeLetter } from './mpr-draw.ts';
  import { createPlaneCache } from './mpr-plane-cache.ts';
  import {
    LOCALIZER,
    SERIES_COUNT,
    cropOf,
    frameAt,
    lineOnLocalizer,
    onCrop,
    pointOnCrop,
    seriesPositions,
    seriesSheet,
  } from './mpr-series.ts';
  import { mprCopy, planeName, seenFrom, sideConvention } from './mpr-words.ts';

  interface Props {
    engine: {
      sections: Pick<EngineSections, 'slice' | 'pixels' | 'labelBox'>;
      tracts: Pick<EngineTracts, 'onPlane' | 'onPlanes'>;
    };
    plane: MprPlane;
    /** Each panel as the stage faces its cut: the series takes its plane's orientation. */
    frames: Record<MprPlane, PlaneFrame>;
    display: MriDisplay;
    sections: SectionsState;
    crosshair: Vec3;
    /** Whether the section holding the crosshair marks it, and its line is lit for it. */
    crosshairShown: boolean;
    mapKey: string | undefined;
    tractsKey: string | null;
    faOpacity: number | null;
    fa: () => ((point: Vec3) => number) | null;
    lang: Language;
    subject: string;
    /** A click: the crosshair goes to the point, and the stage cuts on the plane clicked. */
    pick: (plane: MprPlane, point: Vec3) => void;
    announce: (sentence: string) => void;
  }

  let {
    engine,
    plane,
    frames,
    display,
    sections,
    crosshair,
    crosshairShown,
    mapKey,
    tractsKey,
    faOpacity,
    fa,
    lang,
    subject,
    pick,
    announce,
  }: Props = $props();

  const EDGES = ['top', 'right', 'bottom', 'left'] as const;
  const uid = $props.id();
  const copy = $derived(mprCopy(lang));
  const words = $derived(lang === 'fr' ? serialCopy.fr : serialCopy.en);
  const box = $derived.by(() => {
    const labelled = engine.sections.labelBox;
    if (!labelled) throw new Error('The serial sections opened before the segmentation loaded.');
    return labelled;
  });

  const axis = $derived(AXES[plane]);
  const series = $derived(seriesPositions(box, axis));
  const base = $derived(frames[plane]);
  const crop = $derived(cropOf(base, box, display.fieldOfView, display.size));
  const across = $derived(LOCALIZER[plane]);
  const localizerAt = $derived(Math.round((box.min[AXES[across]] + box.max[AXES[across]]) / 2));
  const localizer = $derived(frameAt(frames[across], AXES[across], localizerAt));
  const localizerCrop = $derived(
    cropOf(localizer, box, display.fieldOfView, display.size, crop.width / crop.height),
  );
  const tiles = $derived(
    series.positions.map((position, index) => ({
      id: `section-${index}`,
      position,
      frame: frameAt(base, axis, position),
    })),
  );
  const lines = $derived(
    series.positions.map((position) =>
      lineOnLocalizer(localizer, localizerCrop, axis, position, display.fieldOfView, display.size),
    ),
  );
  const current = $derived(
    series.positions.findIndex((position) => Math.abs(position - crosshair[axis]) < 0.5),
  );
  const convention = $derived(sideConvention(base.edges));
  let hovered = $state<number | null>(null);

  const at = (position: number) =>
    withUnit(decimal(position, 0, lang, { signed: true }), 'mm', lang);

  let canvases = $state<Record<string, HTMLCanvasElement | null>>({});
  // The sections' tracts in one pass within a drawing: the first section to need them takes them all.
  let batch: Map<string, PlaneTracts> | null = null;
  const place = (frame: PlaneFrame) => JSON.stringify([frame.center, frame.u, frame.v]);
  const tracts = {
    onPlane(frame: PlaneFrame): PlaneTracts {
      if (!batch) {
        const frames = tiles.map((tile) => tile.frame);
        const pieces = engine.tracts.onPlanes(frames);
        batch = new Map(frames.map((section, index) => [place(section), pieces[index]!]));
      }
      const pieces = batch.get(place(frame));
      if (!pieces) throw new Error('Tracts were asked for a plane outside the series.');
      return pieces;
    },
  };
  const sectionCache = createPlaneCache<string>({
    engine: () => ({ sections: engine.sections, tracts }),
    fa: () => fa(),
  });
  // The localizer marks where the sections lie: the scan, its labels and paint, without tracts or FA.
  const localizerCache = createPlaneCache<'localizer'>({ engine: () => engine, fa: () => null });
  $effect(() => {
    localizerCache.draw({
      display,
      shown: ['localizer'],
      canvases,
      frames: { localizer },
      crops: { localizer: localizerCrop },
      sections,
      mapKey,
      tractsKey: null,
      faOpacity: null,
    });
  });
  $effect(() => {
    batch = null;
    sectionCache.draw({
      display,
      shown: tiles.map((tile) => tile.id),
      canvases,
      frames: Object.fromEntries(tiles.map((tile) => [tile.id, tile.frame])),
      crops: Object.fromEntries(tiles.map((tile) => [tile.id, crop])),
      sections,
      mapKey,
      tractsKey,
      faOpacity,
    });
    batch = null;
  });
  $effect(() => () => {
    sectionCache.clear();
    localizerCache.clear();
  });

  /** A click on a picture: the point under it, unless it falls past the sampled square. */
  function clicked(name: MprPlane, frame: () => PlaneFrame, part: () => typeof crop) {
    return (canvas: HTMLCanvasElement) => {
      const click = (event: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const region = part();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        const inside = [region.x + x * region.width, region.y + y * region.height].every(
          (pixel) => pixel >= 0 && pixel <= display.size,
        );
        if (!inside) return;
        pick(name, pointOnCrop(frame(), region, x, y, display.fieldOfView, display.size));
      };
      canvas.addEventListener('click', click);
      return () => canvas.removeEventListener('click', click);
    };
  }

  function save() {
    const letters = (edges: readonly string[]) => edges.map((edge) => edgeLetter(edge, lang));
    const link = document.createElement('a');
    link.download = `${subject}-${plane}-series.png`;
    link.href = seriesSheet({
      localizer: {
        canvas: canvases.localizer!,
        label: `${planeName(across, lang)} ${at(localizerAt)}`,
        letters: letters(localizer.edges),
      },
      lines,
      sections: tiles.map((tile, index) => ({
        canvas: canvases[tile.id]!,
        label: at(tile.position),
        ...(index === 0 && {
          letters: letters(base.edges),
          convention: convention && copy.conventionMarks[convention],
        }),
      })),
      footer: [
        subject,
        `${planeName(plane, lang)} ${copy.seenFrom[seenFrom(plane, base.edges)]}`,
        words.spacing(SERIES_COUNT, withUnit(series.spacing, 'mm', lang)),
      ].join(' · '),
    }).toDataURL('image/png');
    link.click();
    announce(words.saved(plane));
  }
</script>

<section class="series" aria-labelledby="{uid}-heading">
  <h3 id="{uid}-heading">
    <span>{planeName(plane, lang)}</span>
    <span class="seen-from">{copy.seenFrom[seenFrom(plane, base.edges)]}</span>{#if convention}<span
        class="visually-hidden">{`· ${copy.conventions[convention]}`}</span
      >{/if}
  </h3>
  <IconButton
    class="save"
    icon="download"
    label={`${copy.savePng}${words.save(plane)}`}
    data-tooltip={`${copy.savePng}${words.save(plane)}`}
    onclick={save}
  />
  <p class="spacing">
    {words.spacing(SERIES_COUNT, withUnit(series.spacing, 'mm', lang))}
  </p>

  <ol class="tiles" style:--tile-aspect="{crop.width} / {crop.height}">
    <li class="tile">
      <div class="picture">
        <!-- A picture of data is an image (ARIA 1.2 img; HTML-AAM allows it on canvas). -->
        <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
        <canvas
          role="img"
          aria-label={words.localizer(SERIES_COUNT, plane, across, at(localizerAt))}
          bind:this={canvases.localizer}
          {@attach clicked(
            across,
            () => localizer,
            () => localizerCrop,
          )}
        ></canvas>
        {#each lines as line, index (index)}
          <div
            class="line"
            class:vertical={line.vertical}
            class:lit={(crosshairShown && index === current) || index === hovered}
            aria-hidden="true"
            style:left={line.vertical ? `${line.at * 100}%` : null}
            style:top={line.vertical ? null : `${line.at * 100}%`}
          ></div>
        {/each}
        {#each EDGES as edge, index (edge)}
          <span class="edge" data-edge={edge} aria-hidden="true"
            >{edgeLetter(localizer.edges[index]!, lang)}</span
          >
        {/each}
        <span class="label" aria-hidden="true">{planeName(across, lang)} {at(localizerAt)}</span>
      </div>
    </li>
    {#each tiles as tile, index (tile.id)}
      <li class="tile">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="picture"
          onpointerenter={() => (hovered = index)}
          onpointerleave={() => (hovered = null)}
        >
          <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
          <canvas
            role="img"
            aria-label={words.picture(plane, at(tile.position))}
            bind:this={canvases[tile.id]}
            {@attach clicked(
              plane,
              () => tile.frame,
              () => crop,
            )}
          ></canvas>
          {#if crosshairShown && index === current}
            {@const [x, y] = onCrop(tile.frame, crop, crosshair, display.fieldOfView, display.size)}
            <div class="crosshair-across" aria-hidden="true" style:top="{y * 100}%"></div>
            <div class="crosshair-down" aria-hidden="true" style:left="{x * 100}%"></div>
          {/if}
          {#if index === 0}
            {#each EDGES as edge, side (edge)}
              <span class="edge" data-edge={edge} aria-hidden="true"
                >{edgeLetter(base.edges[side]!, lang)}</span
              >
            {/each}
            {#if convention}
              <span class="convention" aria-hidden="true">{copy.conventionMarks[convention]}</span>
            {/if}
          {/if}
          <span class="label" aria-hidden="true">{at(tile.position)}</span>
        </div>
      </li>
    {/each}
  </ol>
</section>

<style>
  @layer components {
    .series {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      column-gap: var(--space-3);
      min-width: 0;
      container: mpr-series / inline-size;
    }
    h3 {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      column-gap: var(--space-1);
      margin: 0;
      font-size: var(--text-ui);
      font-weight: 600;
    }
    .seen-from {
      white-space: nowrap;
      color: var(--text-secondary);
      font-weight: 400;
    }
    .series :global(.save) {
      color: var(--text-secondary);
    }
    .spacing {
      grid-column: 1 / -1;
      margin: 0;
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    /* Pictures abut as a research mosaic does, a hairline of the dock between them. */
    .tiles {
      --columns: 3;
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
      gap: 2px;
      margin: var(--space-2) 0 0;
      padding: 0;
      overflow: hidden;
      border-radius: var(--radius-mark);
      list-style: none;
    }
    @container mpr-series (width < 18rem) {
      .tiles {
        --columns: 2;
      }
    }
    @container mpr-series (width >= 30rem) {
      .tiles {
        --columns: 4;
      }
    }
    @container mpr-series (width >= 56rem) {
      .tiles {
        --columns: 6;
      }
    }
    .picture {
      position: relative;
      aspect-ratio: var(--tile-aspect);
      overflow: hidden;
      background: var(--mpr-canvas);
      container: mpr-tile / inline-size;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      cursor: crosshair;
    }
    .line,
    .crosshair-across,
    .crosshair-down {
      position: absolute;
      pointer-events: none;
    }
    /* Eleven lines over a small picture: faint, so the anatomy under them still reads. */
    .line {
      background: color-mix(in srgb, var(--overlay-ink) 40%, transparent);
    }
    .line.lit,
    .crosshair-across,
    .crosshair-down {
      background: var(--crosshair-ink);
      box-shadow: 0 0 0 1px var(--crosshair-ring);
    }
    .line:not(.vertical),
    .crosshair-across {
      left: 0;
      right: 0;
      height: 1px;
      translate: 0 -0.5px;
    }
    .line.vertical,
    .crosshair-down {
      top: 0;
      bottom: 0;
      width: 1px;
      translate: -0.5px 0;
    }
    /* Haloed type, as the planes and the stage mark their pictures (Orientation.svelte). */
    .edge,
    .convention,
    .label {
      position: absolute;
      color: var(--overlay-ink);
      -webkit-text-stroke: 3px var(--overlay-halo-core);
      paint-order: stroke fill;
      text-shadow:
        0 0 1px var(--overlay-halo-core),
        0 0 2px var(--overlay-halo-core),
        0 0 4px var(--overlay-halo-core);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
      letter-spacing: 0.04em;
      pointer-events: none;
    }
    [data-edge='top'],
    [data-edge='bottom'] {
      left: 50%;
      translate: -50% 0;
    }
    [data-edge='top'] {
      top: 2px;
    }
    [data-edge='bottom'] {
      bottom: 2px;
    }
    [data-edge='left'],
    [data-edge='right'] {
      top: 50%;
      translate: 0 -50%;
    }
    [data-edge='left'] {
      left: var(--space-1);
    }
    [data-edge='right'] {
      right: var(--space-1);
    }
    .convention {
      top: 2px;
      left: var(--space-1);
      color: var(--overlay-ink-muted);
      font-weight: 500;
      letter-spacing: 0.02em;
    }
    .label {
      bottom: 2px;
      left: var(--space-1);
      color: var(--overlay-ink-muted);
      font-weight: 500;
      letter-spacing: 0;
      font-variant-numeric: tabular-nums;
    }
    /* A picture too narrow for the convention beside the top letter, or the label beside the bottom
       one, keeps the letters that say which way it faces. */
    @container mpr-tile (width < 9rem) {
      .convention,
      [data-edge='bottom'] {
        display: none;
      }
    }
  }
</style>
