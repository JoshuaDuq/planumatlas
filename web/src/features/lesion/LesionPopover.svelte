<!--
  The Lesion popover's body. The reader chooses what a click on the brain does: select a region, or
  place the lesion, which the store tells the engine; the choice holds only while the popover is open.
  The radius redraws as the thumb moves and is measured once let go.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { formatRas, withUnit } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { LesionStore } from '../../lib/state/lesion.svelte.ts';
  import { LESION_RADIUS } from '../../lib/types/constants.ts';
  import type { Language } from '../../lib/types/index.ts';
  import ChoiceGroup from '../../lib/ui/ChoiceGroup.svelte';
  import RangeField from '../../lib/ui/RangeField.svelte';
  import AboutData from '../info/AboutData.svelte';

  let {
    lesion,
    lang,
    placing,
    onPlacing,
    reportShown,
    onReport,
  }: {
    lesion: LesionStore;
    lang: Language;
    /** A click on the brain places the lesion. */
    placing: boolean;
    onPlacing: (placing: boolean) => void;
    /** The report is in the panel in front, with its own Remove. */
    reportShown: () => boolean;
    /** Open the report in the panel. */
    onReport: () => void;
  } = $props();

  const uid = $props.id();
  const clickId = `lesion-click-${uid}`;

  const copy = $derived(t(lang, 'lesion'));
  // A coordinate's sphere has its own section; a click here places a lesion in its stead.
  const placed = $derived(lesion.kind === 'lesion' ? lesion.sphere : null);
  const clicks = $derived(
    (['select', 'place'] as const).map((value) => ({ value, label: copy.clicks[value] })),
  );

  /** The button goes with the lesion, so focus moves to the click chosen. */
  async function remove(event: MouseEvent) {
    const hadFocus = document.activeElement === event.currentTarget;
    lesion.remove();
    await tick();
    if (!hadFocus) return;
    document
      .querySelector<HTMLElement>(`[aria-labelledby="${clickId}"] [aria-checked="true"]`)!
      .focus();
  }
</script>

<p id={clickId} class="stage-field-label">{copy.click}</p>
<ChoiceGroup
  labelledby={clickId}
  class="lesion-click"
  options={clicks}
  bind:value={() => (placing ? 'place' : 'select'), (value) => onPlacing(value === 'place')}
/>
{#if placing}
  <p class="hint">{placed ? copy.moveHint : copy.placeHint}</p>
{/if}
<div class="stage-field">
  <RangeField
    label={copy.radius}
    value={lesion.radius}
    min={LESION_RADIUS.min}
    max={LESION_RADIUS.max}
    format={(radius) => withUnit(radius, 'mm', lang)}
    oninput={lesion.previewRadius}
    onchange={lesion.commitRadius}
  />
</div>
{#if placed}
  <p class="centre">{formatRas(placed.centre, lang)}</p>
  {#if !reportShown()}
    <div class="actions">
      <button type="button" class="stage-command" onclick={onReport}>{copy.showReport}</button>
      <button type="button" class="stage-command stage-command-quiet" onclick={remove}>
        {copy.remove}
      </button>
    </div>
  {/if}
{/if}
<AboutData place="lesion" {lang} host="popover" />

<style>
  @layer features {
    /*
     * The two clicks are sized by their words with the place choice's 6px padding, so English fits one line
     * in the 272px popover; a longer translation wraps and grows the pill instead of leaving it.
     */
    :global(.lesion-click [role='radio']) {
      flex: 1 1 auto;
      padding-inline: 6px;
      height: auto;
      min-height: calc(var(--control-height) - 4px);
      padding-block: var(--space-1);
      white-space: normal;
      text-wrap: balance;
    }
    .hint {
      margin: var(--space-2) 0 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--overlay-ink-muted);
    }
    .centre {
      margin: var(--space-1) 0 0;
      font-size: var(--text-caption);
      font-variant-numeric: tabular-nums;
      color: var(--overlay-ink);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: var(--space-2);
      margin-top: var(--space-3);
      padding-top: var(--space-3);
      border-top: 1px solid var(--overlay-border);
    }
  }
</style>
