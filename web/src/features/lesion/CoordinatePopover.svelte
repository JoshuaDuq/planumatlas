<!--
  The Coordinate popover's body, a published coordinate's entry: the numbers as a paper prints them
  and the template they are in, placed on this brain by that template's field. What cannot be read, or lies beyond the template's brain, is said under the field and not placed.
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import type { CoordinatePlacement } from '../../lib/controller/coordinates.ts';
  import { parseCoordinate } from '../../lib/core/coordinates/parse.ts';
  import { UNSTATED } from '../../lib/core/coordinates/spaces.ts';
  import { formatRas } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { LesionStore } from '../../lib/state/lesion.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';
  import Select from '../../lib/ui/Select.svelte';
  import MethodsLink from '../deficits/MethodsLink.svelte';

  let {
    lesion,
    placement,
    lang,
    onReport,
  }: {
    lesion: LesionStore;
    placement: Pick<CoordinatePlacement, 'metadata' | 'place'>;
    lang: Language;
    /** Open the report in the panel. */
    onReport: () => void;
  } = $props();

  const uid = $props.id();
  const fieldId = `coordinate-field-${uid}`;
  const spaceId = `coordinate-space-${uid}`;
  const noteId = `coordinate-note-${uid}`;
  const errorId = `coordinate-error-${uid}`;

  const copy = $derived(t(lang, 'coordinate'));
  const options = $derived([
    ...placement.metadata.spaces.map(({ id, label, description }) => ({
      value: id,
      label,
      title: description,
    })),
    { value: UNSTATED, label: copy.unstated },
  ]);
  const placed = $derived(lesion.kind === 'coordinate' ? lesion.sphere : null);

  // A coordinate a link placed opens in the field as it was entered.
  let text = $state(untrack(() => lesion.coordinate?.entered.join(', ') ?? ''));
  let space = $state(untrack(() => lesion.coordinate?.space ?? UNSTATED));
  let error = $state<'unreadable' | 'outside' | 'failed' | null>(null);
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const entered = parseCoordinate(text);
    if (!entered) {
      error = 'unreadable';
      return;
    }
    error = null;
    busy = true;
    // The first placement downloads the field, and the reader may edit meanwhile: an answer only
    // speaks for the entry still shown.
    const asked = { text, space };
    const answer = (next: typeof error) => {
      if (text === asked.text && space === asked.space) error = next;
    };
    try {
      if (!(await placement.place(entered, space))) answer('outside');
    } catch (cause) {
      console.error(cause);
      answer('failed');
    } finally {
      busy = false;
    }
  }

  /** The button goes with the coordinate, so focus moves to the field. */
  async function remove(event: MouseEvent) {
    const hadFocus = document.activeElement === event.currentTarget;
    lesion.remove();
    await tick();
    if (hadFocus) document.getElementById(fieldId)!.focus();
  }
</script>

<form novalidate onsubmit={submit}>
  <label class="stage-field-label" for={fieldId}>{copy.field}</label>
  <input
    id={fieldId}
    type="text"
    autocomplete="off"
    spellcheck="false"
    placeholder={copy.example}
    aria-invalid={error === 'unreadable'}
    aria-describedby={error ? `${errorId} ${noteId}` : noteId}
    bind:value={text}
    oninput={() => (error = null)}
  />
  <div class="stage-field">
    <label class="stage-field-label" for={spaceId}>{copy.space}</label>
    <Select id={spaceId} {options} bind:value={space} onchange={() => (error = null)} />
  </div>
  <p id={noteId} class="hint">{copy.note}</p>
  {#if error}
    <p id={errorId} class="error" role="alert">{copy[error]}</p>
  {/if}
  <div class="place">
    <button type="submit" class="stage-command" disabled={busy}>
      {busy ? copy.placing : copy.place}
    </button>
  </div>
  {#if placed}
    <p class="centre">{formatRas(placed.centre, lang)}</p>
    <div class="actions">
      <button type="button" class="stage-command" onclick={onReport}>
        {t(lang, 'lesion').showReport}
      </button>
      <button type="button" class="stage-command stage-command-quiet" onclick={remove}>
        {t(lang, 'lesion').remove}
      </button>
    </div>
  {/if}
</form>
<p class="methods"><MethodsLink page="coordinate" {lang} /></p>

<style>
  @layer features {
    /* Typed and pasted from papers, so its digits line up. */
    input {
      box-sizing: border-box;
      width: 100%;
      height: var(--control-height);
      padding: 0 var(--space-3);
      border: 1px solid var(--border-control);
      border-radius: var(--radius-control);
      background: var(--surface-base);
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-variant-numeric: tabular-nums;
    }
    /* The example in the empty field, at the contrast a search field's has (elements.css). */
    input::placeholder {
      color: var(--text-tertiary);
      opacity: 1;
    }
    input[aria-invalid='true'] {
      border-color: var(--danger);
    }
    @media (hover: hover) and (pointer: fine) {
      input:hover:not(:focus) {
        border-color: var(--text-secondary);
      }
    }
    @media (pointer: coarse) {
      input {
        height: 44px;
      }
    }
    .hint,
    .error {
      margin: var(--space-2) 0 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--overlay-ink-muted);
    }
    .error {
      color: var(--danger);
    }
    .place {
      margin-top: var(--space-3);
    }
    .centre {
      margin: var(--space-3) 0 0;
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
    .methods {
      margin: var(--space-3) 0 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
  }
</style>
