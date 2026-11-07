<!--
  The visual-field map in the Circuits tab's detail: a disc of the visual field on a log scale with the
  dot the reader moves (pointer or arrow keys), its size, the cortex its predicted territory covers in
  each area, the cortex last clicked on the brain, and where the prediction comes from. The stage draws
  the same dot on the cortex (`syncVisualFieldMap`).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import {
    VISUAL_AREAS,
    discRadius,
    dotOutline,
    fromDisc,
    hemisphereFor,
    polar,
    quadrant,
    toDisc,
  } from '../../lib/core/learning/visual-field.ts';
  import type { FieldHemisphere } from '../../lib/core/learning/visual-field.ts';
  import type { VisualFieldPoint } from '../../lib/engine/api.ts';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import RangeField from '../../lib/ui/RangeField.svelte';
  import type { VisualFieldExplorer } from './visual-field-explorer.svelte.ts';

  let { model }: { model: VisualFieldExplorer } = $props();

  const copy = $derived(t(model.lang, 'visualField'));
  const record = $derived(model.retinotopy);
  const maximum = $derived(record.maximum_eccentricity_deg);
  const measured = $derived(record.measured_eccentricity_deg);
  const RINGS = [1, 2, 4, 16, 32];
  // The radius control is logarithmic: 0.1° to 10° over its travel.
  const RADIUS = { min: 0.1, decades: 2 };
  const sliderOf = (radius: number) =>
    (50 * Math.log10(radius / RADIUS.min)) / (RADIUS.decades / 2);
  const radiusOf = (value: number) => RADIUS.min * 10 ** ((value / 50) * (RADIUS.decades / 2));

  // The annulus past the measured eccentricity, which the template extrapolates into.
  const beyondMeasured = $derived.by(() => {
    const r = discRadius(measured, maximum);
    return `M1 0A1 1 0 1 0 -1 0A1 1 0 1 0 1 0ZM${r} 0A${r} ${r} 0 1 0 ${-r} 0A${r} ${r} 0 1 0 ${r} 0Z`;
  });
  const dot = $derived(model.dot);
  const centre = $derived(toDisc(dot, maximum));
  const outline = $derived(
    dotOutline(dot, maximum)
      .map(({ x, y }, index) => `${index ? 'L' : 'M'}${x.toFixed(4)} ${(-y).toFixed(4)}`)
      .join(' ') + 'Z',
  );
  const where = $derived.by(() => {
    const { eccentricity } = polar(dot);
    const { vertical, horizontal } = quadrant(dot);
    return copy.place(eccentricity, vertical, horizontal);
  });
  const beyond = $derived(polar(dot).eccentricity + dot.radius > measured);
  const sides = $derived.by((): FieldHemisphere[] => {
    const territory = model.territory;
    const touched = (['left', 'right'] as const).filter(
      (side) => territory && VISUAL_AREAS.some((area) => territory[side][area] > 0),
    );
    return touched.length ? touched : [hemisphereFor(dot) ?? model.side];
  });
  const reading = $derived(model.reading);
  const agreement = $derived(record.hemispheres[model.side].agreement_dice.V1!);

  // The territories download on the map's first showing; a failure is said in the panel.
  $effect(() => {
    model.loadTerritories().catch((error: unknown) => console.error(error));
  });

  let disc = $state<SVGSVGElement | null>(null);
  let title = $state<HTMLElement | null>(null);
  // The map opened: its title takes focus, as a lesson's does.
  $effect(() => title?.focus({ preventScroll: true }));
  let dragging = false;

  function placeAt(event: PointerEvent) {
    const matrix = disc!.getScreenCTM()!.inverse();
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    move({ x: point.x, y: -point.y });
  }

  function move(place: VisualFieldPoint) {
    const { x, y } = fromDisc(place, maximum);
    model.moveDot({ x, y, radius: dot.radius });
  }

  function onpointerdown(event: PointerEvent) {
    if (event.button !== 0) return;
    dragging = true;
    disc!.setPointerCapture(event.pointerId);
    placeAt(event);
  }

  function onpointermove(event: PointerEvent) {
    if (dragging) placeAt(event);
  }

  function onpointerup(event: PointerEvent) {
    dragging = false;
    if (disc!.hasPointerCapture(event.pointerId)) disc!.releasePointerCapture(event.pointerId);
  }

  // Steps are taken on the disc, so a press moves finely near fixation and coarsely in the periphery.
  const STEP = { small: 0.02, large: 0.08 };
  function onkeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? STEP.large : STEP.small;
    const delta = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    move({ x: centre.x + delta[0]!, y: centre.y + delta[1]! });
  }
</script>

{#if model.open}
  <section class="visual-field" aria-labelledby="visual-field-title">
    <h3 id="visual-field-title" class="title" data-circuit-title tabindex="-1" bind:this={title}>
      {copy.name}
    </h3>
    <p class="intro">{copy.intro}</p>
    {#if model.hidden}
      <p class="note circuit-return">
        {copy.mapHidden}
        <button type="button" class="link" onclick={() => void model.returnToMap()}>
          {copy.returnToMap}
        </button>
      </p>
    {/if}
    {#if model.tours.length}
      <p class="note">
        {t(model.lang, 'circuits').inCircuits}:
        {#each model.tours as tour, index (tour.id)}
          {#if index},{/if}
          <button type="button" class="link" onclick={() => void model.openTour(tour.id)}>
            {tour.name[model.lang]}
          </button>
        {/each}
      </p>
    {/if}

    <svg
      bind:this={disc}
      class="disc"
      viewBox="-1.08 -1.08 2.16 2.16"
      role="group"
      aria-label={copy.disc}
      {onpointerdown}
      {onpointermove}
      {onpointerup}
      onpointercancel={onpointerup}
    >
      <defs>
        <clipPath id="visual-field-clip"><circle r="1" /></clipPath>
      </defs>
      <circle class="field" r="1" />
      <path class="extrapolated" fill-rule="evenodd" d={beyondMeasured} />
      {#each RINGS as ring (ring)}
        <circle class="ring" r={discRadius(ring, maximum)} />
      {/each}
      <circle class="ring measured" r={discRadius(measured, maximum)} />
      <line class="meridian" x1="-1" x2="1" y1="0" y2="0" />
      <line class="meridian" x1="0" x2="0" y1="-1" y2="1" />
      {#each [2, measured, 32] as ring (ring)}
        <!-- Just inside its ring, on the upper-left diagonal. -->
        {@const r = (discRadius(ring, maximum) - 0.06) * Math.SQRT1_2}
        <text class="ring-label" x={-r} y={-r} aria-hidden="true">{copy.ring(ring)}</text>
      {/each}
      <g clip-path="url(#visual-field-clip)">
        <path class="dot-area" d={outline} />
      </g>
      <circle
        class="handle"
        cx={centre.x}
        cy={-centre.y}
        r="0.045"
        tabindex="0"
        role="slider"
        aria-roledescription={copy.dotRole}
        aria-label={copy.dot}
        aria-valuemin={0}
        aria-valuemax={maximum}
        aria-valuenow={Math.round(polar(dot).eccentricity * 10) / 10}
        aria-valuetext={where}
        aria-describedby="visual-field-keys"
        {onkeydown}
      />
    </svg>
    <p id="visual-field-keys" class="visually-hidden">{copy.dotKeys}</p>

    <p class="place">{where} · {copy.radius(dot.radius)}</p>
    <p class="note">{copy.hemisphere(hemisphereFor(dot))}</p>

    <div class="size">
      <RangeField
        label={copy.size}
        value={sliderOf(dot.radius)}
        min={0}
        max={100}
        step={1}
        format={(value) => copy.ring(radiusOf(value))}
        oninput={(value) => model.moveDot({ ...dot, radius: radiusOf(value) })}
      />
    </div>

    <h4 class="heading">{copy.territory}</h4>
    {#if model.territory}
      {@const territory = model.territory}
      <table class="territory">
        <thead>
          <tr>
            <td></td>
            {#each sides as side (side)}
              <th scope="col">{copy.sideHeading(side)}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each VISUAL_AREAS as area (area)}
            <tr>
              <th scope="row">{area}</th>
              {#each sides as side (side)}
                <td>{copy.territoryArea(territory[side][area])}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
      {#if sides.every((side) => VISUAL_AREAS.every((area) => territory[side][area] === 0))}
        <p class="note">{copy.noTerritory}</p>
      {/if}
      <p class="note">{copy.territoryNote}</p>
    {:else}
      <p class="note">{model.failed ? copy.loadFailed : copy.loading}</p>
    {/if}
    {#if beyond}
      <p class="note caution">{copy.extrapolated(measured)}</p>
    {/if}

    <h4 class="heading">{copy.reading}</h4>
    <p class="note" aria-live="polite">
      {#if reading === undefined}
        {copy.clickHint}
      {:else if reading === null}
        {copy.readingNone}
      {:else}
        {@const { eccentricity } = polar(reading)}
        {@const { vertical, horizontal } = quadrant(reading)}
        {copy.readingValue(
          reading.area,
          reading.hemisphere,
          copy.place(eccentricity, vertical, horizontal),
          reading.sigma,
        )}
      {/if}
    </p>

    <ul class="legend">
      <li><span class="swatch core" aria-hidden="true"></span>{copy.legendCore}</li>
      <li><span class="swatch reach" aria-hidden="true"></span>{copy.legendReach}</li>
      <li><span class="swatch line" aria-hidden="true"></span>{copy.legendLine(measured)}</li>
      <li><span class="swatch areas" aria-hidden="true"></span>{copy.legendAreas}</li>
    </ul>

    <p class="note">{copy.provenance}</p>
    <p class="note">{copy.agreement(model.side, agreement['hcp-mmp']!, agreement.julich!)}</p>
    <h4 class="heading">{copy.sources}</h4>
    <ul class="sources">
      {#each [[record.citation, copy.dataset], [record.method_citation, copy.method]] as [href, name] (href)}
        <li>
          <a {href} target="_blank" rel="noreferrer"
            >{name}<span class="visually-hidden">{` ${t(model.lang, 'link').newTab}`}</span
            >{@render iconGraphic('external-link')}</a
          >
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  @layer features {
    .visual-field {
      padding: var(--panel-inset);
      font-size: var(--text-ui);
      line-height: var(--lh-prose);
    }
    .title {
      font-size: var(--text-headline);
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: var(--lh-title);
    }
    .intro {
      margin-top: var(--space-2);
      color: var(--text-secondary);
    }
    .disc {
      display: block;
      width: 100%;
      max-width: 18rem;
      margin: var(--space-4) auto var(--space-2);
      touch-action: none;
      cursor: crosshair;
      user-select: none;
    }
    .field {
      fill: var(--surface-sunken);
      stroke: var(--border-control);
      stroke-width: 0.008;
    }
    .extrapolated {
      fill: var(--surface-tonal);
    }
    .ring,
    .meridian {
      fill: none;
      stroke: var(--border-subtle);
      stroke-width: 0.006;
    }
    .ring.measured {
      stroke: var(--text-tertiary);
      stroke-width: 0.01;
      stroke-dasharray: 0.03 0.02;
    }
    .ring-label {
      fill: var(--text-secondary);
      stroke: var(--surface-sunken);
      stroke-width: 0.025px;
      paint-order: stroke;
      font-size: 0.08px;
      text-anchor: middle;
      dominant-baseline: middle;
    }
    .dot-area {
      fill: color-mix(in srgb, var(--accent) 40%, transparent);
      stroke: var(--accent);
      stroke-width: 0.01;
    }
    .handle {
      fill: var(--accent);
      stroke: var(--surface-base);
      stroke-width: 0.012;
      cursor: grab;
    }
    .handle:focus-visible {
      outline: none;
      stroke: var(--text-primary);
      stroke-width: 0.02;
    }
    .place {
      font-variant-numeric: tabular-nums;
      text-align: center;
    }
    .note {
      margin-top: var(--space-2);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .caution {
      color: var(--text-primary);
    }
    .size {
      margin-top: var(--space-3);
    }
    .heading {
      margin-top: var(--space-5);
      font-size: var(--text-ui);
      font-weight: 600;
    }
    .territory {
      margin-top: var(--space-2);
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }
    .territory th,
    .territory td {
      padding: var(--space-1) var(--space-4) var(--space-1) 0;
      text-align: start;
    }
    .territory thead th {
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 500;
    }
    .territory tbody th {
      font-weight: 500;
    }
    .legend {
      margin: var(--space-4) 0 0;
      padding: 0;
      list-style: none;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .legend li {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-1);
    }
    .swatch {
      flex: none;
      width: 0.875rem;
      height: 0.875rem;
      border-radius: 50%;
    }
    .swatch.core {
      background: var(--overlay-accent);
    }
    .swatch.reach {
      background: color-mix(in srgb, var(--overlay-accent) 45%, #2a2d31);
    }
    /* The stage's own map colours: the measured edge's light line and V1, V2, V3's greys. */
    .swatch.line {
      height: 2px;
      border-radius: 0;
      background: #eee;
    }
    .swatch.areas {
      background: linear-gradient(90deg, #cbcbcb 0 33%, #8e8e8e 33% 66%, #5d5d5d 66%);
    }
    .sources {
      margin: var(--space-1) 0 0;
      padding: 0;
      list-style: none;
      font-size: var(--text-caption);
    }
    .sources a,
    .link {
      color: var(--accent);
    }
    /* Stacked links each keep a 24px target (WCAG 2.5.8). */
    .sources a {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
    }
    .link {
      display: inline;
      min-height: 0;
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .link:hover {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
  }
</style>
