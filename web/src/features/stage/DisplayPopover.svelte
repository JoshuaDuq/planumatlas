<!--
  The Display popover's body (index.html:473-489, ui/chrome/display.js): how much of the model is drawn.
  - Hemisphere is a radio group (decision 6): arrows move and select. Choosing the side already shown does
    nothing, so a second click never refits the camera and throws away the orbit.
  - The cortex opacity and surface rows are removed, not greyed, while the cortex is hidden; the slider
    does not take the value back while the reader holds the thumb (U4 `RangeField`). The spoken value is
    the percentage. The surface is the Overlay tool's one setting, offered here for the brain alone.
  - The spinal cord is absent, not disabled, when the subject publishes none (the S key says why). The
    exploded view is absent while the visual-field map pairs the hemispheres.
  - Names on the brain is off by default and not counted among the changes: it names the anatomy, it does
    not change it (RegionNames.svelte).
  Every change goes through the controller's commands, which say so when a hidden selection was cleared.
  - Last, at every width, what is away from its default, Focus and hidden parts included, with Reset display
    (matching DESIGN.md). While the opacity slider is held it waits for the release, so the
    plate never grows under the thumb (`scrubbing`, StagePopover).
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import { percent } from '../../lib/core/format.ts';
  import { ARIA_KEYSHORTCUTS, SHORTCUT_KEYS } from '../../lib/controller/keymap.ts';
  import { CORTEX_SURFACES } from '../../lib/core/user-map/display.ts';
  import type { CortexSurface } from '../../lib/core/user-map/display.ts';
  import type { Hemisphere, Language } from '../../lib/types/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import MethodsLink from '../info/MethodsLink.svelte';
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
    exploded: boolean;
    /** The exploded view can be drawn now. */
    explodable: boolean;
    /** The regions facing the reader are named on the stage. */
    namesShown: boolean;
    /** The display settings away from their defaults (`displayChanges`); empty where the status bar lists them. */
    changes: readonly string[];
    /** A pointer holds the slider (StagePopover). */
    scrubbing: boolean;
    onHemisphere: (hemisphere: Hemisphere) => void;
    onCortexVisible: (visible: boolean) => void;
    onCortexOpacity: (opacity: number) => void;
    onCortexSurface: (surface: CortexSurface) => void;
    onInternalVisible: (visible: boolean) => void;
    onSpinalCordVisible: (visible: boolean) => void;
    onExploded: (exploded: boolean) => void;
    onNamesShown: (shown: boolean) => void;
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
    exploded,
    explodable,
    namesShown,
    changes,
    scrubbing,
    onHemisphere,
    onCortexVisible,
    onCortexOpacity,
    onCortexSurface,
    onInternalVisible,
    onSpinalCordVisible,
    onExploded,
    onNamesShown,
    onResetDisplay,
  }: Props = $props();

  const uid = $props.id();
  const hemisphereLabelId = `hemisphere-label-${uid}`;
  const visibilityLabelId = `visibility-label-${uid}`;
  const viewAidsLabelId = `view-aids-label-${uid}`;
  const surfaceId = `display-surface-${uid}`;
  const surfaceHintId = `display-surface-hint-${uid}`;
  const explodeHintId = `display-explode-hint-${uid}`;
  const namesHintId = `display-names-hint-${uid}`;

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

<p id={hemisphereLabelId} class="stage-field-label hemisphere-label">
  <span>{copy.hemisphere}</span>
  <kbd class="key-hint" aria-hidden="true">{SHORTCUT_KEYS.hemisphere}</kbd>
</p>
<ChoiceGroup
  labelledby={hemisphereLabelId}
  class="hemisphere"
  options={sides}
  bind:value={() => hemisphere, onHemisphere}
/>
<div class="display-group" role="group" aria-labelledby={visibilityLabelId}>
  <p class="stage-field-label section-label" id={visibilityLabelId}>{copy.visibilitySection}</p>
  <label class="check">
    <input
      type="checkbox"
      checked={cortexVisible}
      aria-keyshortcuts={ARIA_KEYSHORTCUTS.cortex}
      onchange={(event) => onCortexVisible(event.currentTarget.checked)}
    />
    <span>{copy.showCortex}</span>
    <kbd class="key-hint" aria-hidden="true">{SHORTCUT_KEYS.cortex}</kbd>
  </label>
  {#if cortexVisible}
    <div class="cortex-controls">
      <RangeField
        label={copy.cortexOpacity}
        value={cortexOpacity}
        min={0}
        max={1}
        step={0.05}
        format={(fraction) => percent(fraction, lang)}
        oninput={onCortexOpacity}
      />
      <div class="surface-field">
        <label class="stage-field-label" for={surfaceId} data-tooltip={copy.surfaceHint}>
          {surfaceCopy.surface}
        </label>
        <Select
          id={surfaceId}
          options={surfaces}
          describedby={surfaceHintId}
          bind:value={() => cortexSurface, (surface) => onCortexSurface(surface as CortexSurface)}
        />
      </div>
      <span id={surfaceHintId} class="visually-hidden">{copy.surfaceHint}</span>
    </div>
  {/if}
  <label class="check">
    <input
      type="checkbox"
      checked={internalVisible}
      aria-keyshortcuts={ARIA_KEYSHORTCUTS.internal}
      onchange={(event) => onInternalVisible(event.currentTarget.checked)}
    />
    <span>{copy.showInternal}</span>
    <kbd class="key-hint" aria-hidden="true">{SHORTCUT_KEYS.internal}</kbd>
  </label>
  {#if hasSpinalCord}
    <label class="check">
      <input
        type="checkbox"
        checked={spinalCordVisible}
        aria-keyshortcuts={ARIA_KEYSHORTCUTS.spinalCord}
        onchange={(event) => onSpinalCordVisible(event.currentTarget.checked)}
      />
      <span>{copy.showSpinalCord}</span>
      <kbd class="key-hint" aria-hidden="true">{SHORTCUT_KEYS.spinalCord}</kbd>
    </label>
  {/if}
</div>
<div class="display-group" role="group" aria-labelledby={viewAidsLabelId}>
  <p class="stage-field-label section-label" id={viewAidsLabelId}>{copy.viewAidsSection}</p>
  {#if explodable}
    <label class="check" data-tooltip={copy.explodeHint}>
      <input
        type="checkbox"
        checked={exploded}
        aria-describedby={explodeHintId}
        aria-keyshortcuts={ARIA_KEYSHORTCUTS.explode}
        onchange={(event) => onExploded(event.currentTarget.checked)}
      />
      <span>{copy.explode}</span>
      <kbd class="key-hint" aria-hidden="true">{SHORTCUT_KEYS.explode}</kbd>
    </label>
    <span id={explodeHintId} class="visually-hidden">{copy.explodeHint}</span>
  {/if}
  <label class="check" data-tooltip={copy.namesHint}>
    <input
      type="checkbox"
      checked={namesShown}
      aria-describedby={namesHintId}
      aria-keyshortcuts={ARIA_KEYSHORTCUTS.names}
      onchange={(event) => onNamesShown(event.currentTarget.checked)}
    />
    <span>{copy.names}</span>
    <kbd class="key-hint" aria-hidden="true">{SHORTCUT_KEYS.names}</kbd>
  </label>
  <span id={namesHintId} class="visually-hidden">{copy.namesHint}</span>
</div>
{#if shown.length}
  <div class="changes">
    <p>{shown.join(' · ')}</p>
    <button type="button" class="reset-display" onclick={reset}>{copy.resetDisplay}</button>
  </div>
{/if}
<p class="stage-methods"><MethodsLink page="display" {lang} /></p>

<style>
  @layer features {
    /* Large reader text wraps the choices onto a second row before it breaks a word ("Righ|t"). */
    :global(.segmented.choice-group.hemisphere) {
      flex-wrap: wrap;
      width: 100%;
    }
    :global(.segmented.choice-group.hemisphere [role='radio']) {
      flex: 1;
      height: auto;
      min-height: calc(var(--control-height) - 4px);
      min-width: min-content;
      padding: 0 var(--space-2);
      font-size: var(--text-stage);
      white-space: normal;
    }
    .display-group {
      margin-top: var(--space-2);
      padding-top: var(--space-2);
      border-top: 1px solid var(--overlay-border);
    }
    .section-label {
      margin: 0;
      color: var(--text-primary);
      font-weight: 600;
    }
    /* Indented to the checkbox's words: a 16px box and its 8px gap. */
    .cortex-controls {
      padding: 0 0 var(--space-2) var(--space-6);
    }
    .surface-field {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-1) var(--space-2);
      margin-top: var(--space-1);
    }
    .surface-field > label {
      margin: 0;
    }
    .surface-field > :global(select) {
      flex: 1 1 auto;
      width: auto;
      min-width: 0;
      max-width: 100%;
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
    /* The row's key, at its end as in a menu: gone while single keys are off and on a phone. */
    .hemisphere-label {
      display: flex;
      align-items: center;
    }
    .key-hint {
      flex-shrink: 0;
      min-width: 0;
      margin-left: auto;
      padding: 0;
      color: var(--overlay-ink-faint);
      background: none;
      border: 0;
      box-shadow: none;
    }
    :global(:root[data-single-keys='off']) .key-hint {
      display: none;
    }
    /* The phone layout (PHONE_QUERY; phone.css:26, 46). */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .key-hint {
        display: none;
      }
    }
    /* What is changed and its undo share a line while they fit, so the plate stays inside a 900px window. */
    .changes {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      column-gap: var(--space-3);
      margin-top: var(--space-2);
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
