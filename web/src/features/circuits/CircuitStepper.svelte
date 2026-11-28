<!--
  The lesson's place and its landmark steps, for the location bar's `stepper` slot (viewer/ui/panels/
  circuits.js:74-100, index.html:335). Previous and Next are separate named buttons in a labelled
  group (APG Carousel's pair); at an end the control leaves rather than greying out, and a fixed
  three-column grid keeps the count still. Start route opens the first landmark, whose Previous
  returns to the whole route. While a run is in flight a control stays focusable and refuses
  (deviations/x3-busy-keeps-focus.md).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import { stepperTargets } from '../../lib/core/panels/circuits.ts';
  import IconButton from '../../lib/ui/IconButton.svelte';
  import type { CircuitExplorer, Direction } from './circuits-explorer.svelte.ts';

  let { model }: { model: CircuitExplorer } = $props();

  const copy = $derived(t(model.lang, 'circuits'));
  const total = $derived(model.circuit?.steps.length ?? 0);
  const targets = $derived(stepperTargets(model.lesson.step, total));
  // The first landmark's Previous is the whole route.
  const toRoute = $derived(targets.previous === null);
  let root = $state<HTMLElement | null>(null);

  $effect(() => {
    if (root) return model.attachStepper(root);
  });
</script>

{#snippet control(direction: Direction, label: string)}
  {@const routeBack = direction === 'previous' && toRoute}
  <IconButton
    icon={direction}
    {label}
    class="stepper-{direction}"
    data-tooltip={label}
    data-step-direction={direction}
    hidden={targets[direction] === null && !routeBack}
    aria-disabled={model.busy ? 'true' : undefined}
    onclick={() => (routeBack ? model.openRoute() : model.openStep(targets[direction]!, direction))}
  />
{/snippet}

{#if model.exploring && model.circuit}
  <div role="group" aria-label={copy.landmarks} class="circuit-stepper" bind:this={root}>
    {#if model.lesson.route}
      <button
        type="button"
        class="start-route"
        data-step-direction="next"
        aria-disabled={model.busy ? 'true' : undefined}
        onclick={() => model.openStep(0, 'next')}
      >
        {copy.startRoute}
      </button>
    {:else}
      {@render control('previous', toRoute ? copy.wholeRoute : copy.previousLandmark)}
      <p class="progress">
        <span class="visually-hidden">{copy.landmark}{' '}</span>{copy.stepShort(
          model.lesson.step,
          total,
        )}
      </p>
      {@render control('next', copy.nextLandmark)}
    {/if}
  </div>
{/if}

<style>
  @layer features {
    .circuit-stepper {
      flex: none;
      display: grid;
      grid-template-columns: var(--control-height) auto var(--control-height);
      align-items: center;
    }
    .start-route {
      grid-column: 1 / -1;
      min-height: var(--control-height);
      padding: var(--space-1) var(--space-3);
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      background: var(--surface-tonal);
      color: var(--accent);
      font-weight: 600;
      cursor: pointer;
    }
    .start-route[aria-disabled='true'] {
      color: var(--text-tertiary);
      cursor: default;
    }
    @media (hover: hover) and (pointer: fine) {
      .start-route:hover:not([aria-disabled='true']) {
        background: var(--surface-tonal-hover);
      }
    }
    .start-route:active:not([aria-disabled='true']) {
      background: var(--surface-pressed);
    }
    .circuit-stepper :global(.stepper-previous) {
      grid-column: 1;
    }
    .progress {
      grid-column: 2;
      margin: 0;
      padding: 0 var(--space-1);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .circuit-stepper :global(.stepper-next) {
      grid-column: 3;
    }
    .circuit-stepper :global(.icon-button) {
      height: var(--control-height);
    }
    .circuit-stepper :global(.icon-button:focus-visible) {
      outline-offset: -2px;
    }
    /* A run in flight turns the control away without taking it from the Tab order. */
    .circuit-stepper :global(.icon-button[aria-disabled='true']) {
      background: none;
      color: color-mix(in srgb, var(--text-tertiary) 55%, transparent);
      cursor: default;
    }
  }
  @layer a11y {
    @media (prefers-contrast: more) {
      .start-route {
        border-color: var(--border-control);
      }
    }
    @media (forced-colors: active) {
      .start-route {
        border-color: ButtonText;
      }
      .start-route[aria-disabled='true'],
      .circuit-stepper :global(.icon-button[aria-disabled='true']) {
        color: GrayText;
      }
    }
  }
</style>
