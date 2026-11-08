<!--
  The Display popover's body (index.html:473-489, ui/chrome/display.js): how much of the model is drawn.
  - Hemisphere is a radio group (decision 6): arrows move and select. Choosing the side already shown does
    nothing, so a second click never refits the camera and throws away the orbit.
  - The cortex opacity and surface rows are removed, not greyed, while the cortex is hidden; the slider
    does not take the value back while the reader holds the thumb (U4 `RangeField`). The spoken value is
    the percentage. The surface is the Overlay tool's one setting, offered here for the brain alone.
  - The spinal cord is absent, not disabled, when the subject publishes none (the S key says why).
  Every change goes through the controller's commands, which say so when a hidden selection was cleared.
  - Last, what is away from its default, Focus and hidden parts included, with Reset display: on a phone the
    status bar that also says so is hidden. While the opacity slider is held it waits for the release, so the
    plate never grows under the thumb (`scrubbing`, StagePopover).
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import { percent } from '../../lib/core/format.ts';
  import { CORTEX_SURFACES } from '../../lib/core/user-map/display.ts';
  import type { CortexSurface } from '../../lib/core/user-map/display.ts';
  import type { Hemisphere, Language } from '../../lib/types/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import RangeField from '../../lib/ui/RangeField.svelte';
  import Select from '../../lib/ui/Select.svelte';

  interface Props {
    lang: Language;
    hemisphere: Hemisphere;
    cortexVisible: boolean;
    cortexOpacity: number;
    cortexSurface: CortexSurface;
    internalVisible: boolean;
    spinalCordVisible: boolean;
    /** The subject publishes a spinal cord. */
    hasSpinalCord: boolean;
    /** The display settings away from their defaults (`displayChanges`). */
    changes: readonly string[];
    /** A pointer holds the slider (StagePopover). */
    scrubbing: boolean;
    onHemisphere: (hemisphere: Hemisphere) => void;
    onCortexVisible: (visible: boolean) => void;
    onCortexOpacity: (opacity: number) => void;
    onCortexSurface: (surface: CortexSurface) => void;
    onInternalVisible: (visible: boolean) => void;
    onSpinalCordVisible: (visible: boolean) => void;
    onResetDisplay: () => void;
  }

  let {
    lang,
    hemisphere,
    cortexVisible,
    cortexOpacity,
    cortexSurface,
    internalVisible,
    spinalCordVisible,
    hasSpinalCord,
    changes,
    scrubbing,
    onHemisphere,
    onCortexVisible,
    onCortexOpacity,
    onCortexSurface,
    onInternalVisible,
    onSpinalCordVisible,
    onResetDisplay,
  }: Props = $props();

  const uid = $props.id();
  const hemisphereLabelId = `hemisphere-label-${uid}`;
  const surfaceId = `display-surface-${uid}`;
  const surfaceHintId = `display-surface-hint-${uid}`;

  const copy = $derived(t(lang, 'display'));
  // Held at what the press found until the slider is let go.
  let shown = $state.raw<readonly string[]>([]);
  $effect.pre(() => {
    if (!scrubbing) shown = changes;
  });
  const surfaceCopy = $derived(t(lang, 'overlay'));
  const surfaces = $derived(
    CORTEX_SURFACES.map((value) => ({ value, label: surfaceCopy.surfaces[value] })),
  );
  const sides = $derived(
    (['both', 'left', 'right'] as const).map((value) => ({ value, label: copy[value] })),
  );

  /** The button goes with the reset, so focus moves to the hemisphere chosen. */
  async function reset(event: MouseEvent) {
    const hadFocus = document.activeElement === event.currentTarget;
    onResetDisplay();
    await tick();
    if (!hadFocus) return;
    document
      .querySelector<HTMLElement>(`[aria-labelledby="${hemisphereLabelId}"] [aria-checked="true"]`)!
      .focus();
  }
</script>

<p id={hemisphereLabelId} class="stage-field-label">{copy.hemisphere}</p>
<ChoiceGroup
  labelledby={hemisphereLabelId}
  class="hemisphere"
  options={sides}
  bind:value={() => hemisphere, onHemisphere}
/>
<div class="visibility">
  <label class="check">
    <input
      type="checkbox"
      checked={cortexVisible}
      onchange={(event) => onCortexVisible(event.currentTarget.checked)}
    />
    <span>{copy.showCortex}</span>
  </label>
  {#if cortexVisible}
    <div class="opacity">
      <RangeField
        label={copy.cortexOpacity}
        value={cortexOpacity}
        min={0}
        max={1}
        step={0.05}
        format={(fraction) => percent(fraction, lang)}
        oninput={onCortexOpacity}
      />
      <label class="stage-field-label surface-label" for={surfaceId}>{surfaceCopy.surface}</label>
      <Select
        id={surfaceId}
        options={surfaces}
        describedby={surfaceHintId}
        bind:value={() => cortexSurface, (surface) => onCortexSurface(surface as CortexSurface)}
      />
      <p id={surfaceHintId} class="hint">{copy.surfaceHint}</p>
    </div>
  {/if}
  <label class="check">
    <input
      type="checkbox"
      checked={internalVisible}
      onchange={(event) => onInternalVisible(event.currentTarget.checked)}
    />
    <span>{copy.showInternal}</span>
  </label>
  {#if hasSpinalCord}
    <label class="check">
      <input
        type="checkbox"
        checked={spinalCordVisible}
        onchange={(event) => onSpinalCordVisible(event.currentTarget.checked)}
      />
      <span>{copy.showSpinalCord}</span>
    </label>
  {/if}
</div>
{#if shown.length}
  <div class="changes">
    <p>{shown.join(' · ')}</p>
    <button type="button" class="reset-display" onclick={reset}>{copy.resetDisplay}</button>
  </div>
{/if}

<style>
  @layer features {
    :global(.segmented.choice-group.hemisphere) {
      width: 100%;
    }
    :global(.segmented.choice-group.hemisphere [role='radio']) {
      flex: 1;
      height: auto;
      min-height: calc(var(--control-height) - 4px);
      min-width: 0;
      padding: 0 var(--space-2);
      font-size: var(--text-stage);
      white-space: normal;
      overflow-wrap: anywhere;
    }
    /* Spaced, not ruled, like the other popovers' fields; the rows' own padding makes up the field gap. */
    .visibility {
      margin-top: var(--space-3);
    }
    /* Indented to the checkbox's words: a 16px box and its 8px gap. */
    .opacity {
      padding: 0 0 var(--space-2) var(--space-6);
    }
    .surface-label {
      margin-top: var(--space-2);
    }
    .hint {
      margin: var(--space-2) 0 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--overlay-ink-muted);
    }
    .check {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--row-height);
      margin: 0;
      font-size: var(--text-ui);
      color: var(--text-primary);
      cursor: pointer;
    }
    .check span {
      min-width: 0;
    }
    .changes {
      margin-top: var(--space-3);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--overlay-ink-muted);
    }
    .changes p {
      margin: 0;
    }
    /* A text link, as Restore previous view is; the teal is the overlay's here. */
    .reset-display {
      min-height: var(--row-height);
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font-size: var(--text-ui);
      text-align: left;
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .reset-display:hover {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
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
    /* Every choice in a phone popover is a full 44 px target (stage.css:638); the phone query is tokens.css's. */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      :global(.segmented.choice-group.hemisphere [role='radio']) {
        min-height: 44px;
      }
    }
    @media (pointer: coarse) {
      :global(.segmented.choice-group.hemisphere [role='radio']),
      .check,
      .reset-display {
        min-height: 44px;
      }
      /* The tick box itself is 20 px, as the legacy touch rule has it (phone.css:329). */
      input[type='checkbox'] {
        width: 20px;
        height: 20px;
      }
      input[type='checkbox']::before {
        width: 11px;
        height: 6px;
      }
    }
  }

  @layer a11y {
    @media (forced-colors: active) {
      /* The tick would be forced to ink on every box, checked or not: the system control draws itself. */
      input[type='checkbox'] {
        appearance: auto;
        background: Canvas;
        border-color: CanvasText;
      }
      input[type='checkbox']::before {
        content: none;
      }
      .reset-display {
        color: LinkText;
        text-decoration: underline;
      }
    }
  }
</style>
