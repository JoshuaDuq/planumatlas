<!--
  The body map in the Circuits tab's detail: the part shown, each part's area on the strip per
  hemisphere, which is also the map's key, and what the map leaves out. The stage draws it (`syncBodyMap`).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import * as words from '../../lib/core/i18n/areas/bodyMapPanel.ts';
  import { BODY_PART_COLORS } from '../../lib/core/learning/body-map.ts';
  import { BODY_PARTS } from '../../lib/types/index.ts';
  import type { BodyPart } from '../../lib/types/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';
  import type { BodyMapExplorer } from './body-map-explorer.svelte.ts';

  let { model }: { model: BodyMapExplorer } = $props();

  const copy = $derived(model.lang === 'fr' ? words.fr : words.en);
  const name = $derived(t(model.lang, 'bodyMap').name);
  const record = $derived(model.record);
  const SIDES = ['left', 'right'] as const;
  const options = $derived([
    { value: 'all' as const, label: copy.all },
    ...BODY_PARTS.map((part) => ({ value: part, label: copy.parts[part] })),
  ]);
  const footOffStrip = $derived(SIDES.map((side) => record.hemispheres[side].off_strip_share.foot));
  const sources = $derived<[string, string][]>([
    ['https://neurovault.org/collections/457/', copy.dataset],
    [record.citations[0]!, copy.task],
    [record.citations[1]!, copy.project],
    [record.citations[2]!, copy.registration],
  ]);

  let title = $state<HTMLElement | null>(null);
  $effect(() => {
    if (title) return model.attachTitle(title);
  });
</script>

{#if model.open}
  <section class="body-map" aria-labelledby="body-map-title">
    <h3 id="body-map-title" class="title" data-circuit-title tabindex="-1" bind:this={title}>
      {name}
    </h3>
    <p class="intro">{copy.intro}</p>
    <ChoiceGroup
      class="parts"
      label={copy.part}
      {options}
      bind:value={() => model.part, (next: BodyPart | 'all') => model.choose(next)}
    />

    <table class="areas">
      <caption>{copy.table}</caption>
      <thead>
        <tr>
          <th scope="col">{copy.partColumn}</th>
          {#each SIDES as side (side)}
            <th scope="col">{copy.side(side)}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each BODY_PARTS as part, index (part)}
          {@const [red, green, blue] = BODY_PART_COLORS[index]!}
          <tr>
            <th scope="row">
              <span class="part">
                <Swatch colour="rgb({red} {green} {blue})" />{copy.parts[part]}
              </span>
            </th>
            {#each SIDES as side (side)}
              <td>{copy.area(record.hemispheres[side].area_mm2[part])}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="note">{copy.sides}</p>

    <h4 class="heading">{copy.limits}</h4>
    <ul class="limits">
      <li>{copy.group(record.people)}</li>
      <li>{copy.floor(record.floor.d)}</li>
      <li>{copy.strip(Math.min(...footOffStrip), Math.max(...footOffStrip))}</li>
      <li>{copy.sensorimotor}</li>
      <li>{copy.five}</li>
    </ul>

    <h4 class="heading">{copy.sources}</h4>
    <ul class="sources">
      {#each sources as [href, name] (href)}
        <li>
          <a {href} target="_blank" rel="noreferrer">
            {name}<span class="visually-hidden">
              {` ${t(model.lang, 'link').newTab}`}
            </span>{@render iconGraphic('external-link')}
          </a>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  @layer features {
    .body-map {
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
    .body-map :global(.parts) {
      margin-top: var(--space-4);
    }
    .areas {
      margin-top: var(--space-4);
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }
    .areas caption {
      padding-bottom: var(--space-1);
      font-weight: 600;
      text-align: start;
    }
    .areas th,
    .areas td {
      padding: var(--space-1) var(--space-4) var(--space-1) 0;
      text-align: start;
    }
    .areas thead th {
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 500;
    }
    .areas tbody th {
      font-weight: 400;
    }
    .part {
      display: flex;
      gap: var(--space-2);
      align-items: flex-start;
    }
    .note {
      margin-top: var(--space-2);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .heading {
      /* All four sides: an h4 keeps the browser's 1.33em below it, which outweighs what follows. */
      margin: var(--space-5) 0 0;
      font-size: var(--text-ui);
      font-weight: 600;
    }
    .limits,
    .sources {
      margin: var(--space-2) 0 0;
      padding-inline-start: var(--space-4);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .limits li + li,
    .sources li + li {
      margin-top: var(--space-1);
    }
  }
</style>
