<!--
  The guided circuits that pass through the selected region (viewer/ui/panels/circuits.js:229-257,
  index.html:423), for `RegionDetail`'s `relatedCircuits` slot: one row per landmark, outside the
  Circuits tab only. A row opens that lesson at that landmark, in the Circuits tab. Not a landmark
  region (deviations/x3-no-landmarks.md). The visible words "Name 2 of 5" are the start of the row's
  name, which a hidden "Landmark" completes (WCAG 2.5.3, deviations/x3-label-in-name.md).
-->
<script lang="ts">
  import { decimal } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import type { CircuitExplorer } from './circuits-explorer.svelte.ts';

  let { model }: { model: CircuitExplorer } = $props();

  const copy = $derived(t(model.lang, 'circuits'));

  // Group repeated hits in the same circuit under one heading so identical titles never stack back-to-back.
  const grouped = $derived.by(() => {
    const groups: {
      circuit: (typeof model.related)[number]['circuit'];
      steps: number[];
    }[] = [];
    const byId = new Map<string, (typeof groups)[number]>();
    for (const { circuit, index } of model.related) {
      let group = byId.get(circuit.id);
      if (!group) {
        group = { circuit, steps: [] };
        byId.set(circuit.id, group);
        groups.push(group);
      }
      group.steps.push(index);
    }
    return groups;
  });
</script>

{#if grouped.length}
  <div class="related evidence-section">
    <Disclosure
      variant="section"
      summary={copy.inCircuits}
      value={decimal(grouped.length, 0, model.lang)}
    >
      <ul class="links" role="list">
        {#each grouped as { circuit, steps } (circuit.id)}
          {#if steps.length === 1}
            {@const index = steps[0]!}
            <li>
              <button
                type="button"
                class="circuit-link"
                data-landmark-circuit={circuit.id}
                data-landmark-step={index}
                aria-disabled={model.busy ? 'true' : undefined}
                onclick={() => model.openLandmark(circuit.id, index)}
              >
                <span class="link-name">{circuit.name[model.lang]}</span>
                <span class="link-step">{copy.stepShort(index, circuit.steps.length)}</span>
                <span class="visually-hidden">, {copy.landmark}</span>
                <span class="chevron" aria-hidden="true"></span>
              </button>
            </li>
          {:else}
            <li class="circuit-group">
              <p class="circuit-group-name">{circuit.name[model.lang]}</p>
              <ul class="circuit-substeps" role="list">
                {#each steps as index (`${circuit.id}:${index}`)}
                  {@const step = circuit.steps[index]!}
                  <li>
                    <button
                      type="button"
                      class="circuit-link circuit-sublink"
                      data-landmark-circuit={circuit.id}
                      data-landmark-step={index}
                      aria-disabled={model.busy ? 'true' : undefined}
                      onclick={() => model.openLandmark(circuit.id, index)}
                    >
                      <span class="link-name">{step.name[model.lang]}</span>
                      <span class="link-step">{copy.stepShort(index, circuit.steps.length)}</span>
                      <span class="visually-hidden"
                        >, {circuit.name[model.lang]}, {copy.landmark}</span
                      >
                      <span class="chevron" aria-hidden="true"></span>
                    </button>
                  </li>
                {/each}
              </ul>
            </li>
          {/if}
        {/each}
      </ul>
    </Disclosure>
  </div>
{/if}

<style>
  @layer features {
    .links,
    .circuit-substeps {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .circuit-group {
      padding-block: var(--space-2) var(--space-1);
    }
    .circuit-group-name {
      margin: 0 0 var(--space-1);
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      overflow-wrap: anywhere;
    }
    .circuit-substeps {
      padding-left: var(--space-3);
      border-left: 1px solid var(--border-subtle);
    }
    .circuit-sublink {
      min-height: 28px;
      padding-block: var(--space-1);
      color: var(--text-secondary);
    }
    .circuit-sublink .link-name {
      font-weight: 400;
    }
    .circuit-link {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      min-height: var(--row-height);
      height: auto;
      margin: 0;
      padding: var(--space-2) 0;
      border: 0;
      border-radius: 0;
      background: none;
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-weight: 400;
      line-height: var(--lh-ui);
      text-align: left;
    }
    .circuit-link:focus-visible {
      outline-offset: -2px;
    }
    .circuit-link[aria-disabled='true'] {
      color: var(--text-tertiary);
      cursor: default;
    }
    .link-name {
      flex: 1 1 auto;
      min-width: 0;
      font-weight: 500;
      overflow-wrap: anywhere;
    }
    .link-step {
      flex: none;
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .chevron {
      flex: none;
      width: 6px;
      height: 6px;
      margin: 0 3px;
      color: var(--text-tertiary);
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      transform: translateX(-1.6px) rotate(-45deg);
    }
    @media (hover: hover) and (pointer: fine) {
      .circuit-link:hover:not([aria-disabled='true']) {
        color: var(--accent-hover);
      }
      .circuit-link:hover:not([aria-disabled='true']) .link-name {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    @media (pointer: coarse) {
      .circuit-link {
        min-height: 44px;
      }
    }
  }
</style>
