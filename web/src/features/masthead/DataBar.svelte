<!--
  The masthead's data group (viewer/ui/chrome/header.js:249-559, index.html:106-135,
  styles/masthead.css:71-307): one summary button naming the atlas and the colour, which opens
  Subject, Atlas, Colour and Internal anatomy as native selects in a popover, each with its note. It
  is one control at every width (2026-11-11): the fields stood inline on a wide bar until then.
  APG Disclosure (decision 14 on #4): the summary keeps focus when it opens, Tab enters the fields,
  Escape, a press elsewhere or focus leaving closes it.
  - the summary names the atlas and the colour; internal anatomy is in its popover and its accessible
    name, and the colour yields too where the atlas would not fit;
  - `data-reference` on the root: the tract reference shows its name alone, with no popover;
  - a download started from a field is announced (WCAG 4.1.3, deviation h3-load-announcements).
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import {
    atlasOption,
    colourGroups,
    colourOption,
    dataSummary,
    loadingText,
    subjectName,
  } from '../../lib/core/panels/header.ts';
  import { paintKind } from '../../lib/core/state/paint.ts';
  import type { ModelPort } from '../../lib/core/state/ports.ts';
  import { requiredAtlas } from '../../lib/core/state/scene-commands.ts';
  import { atlasSwitchLabel, t } from '../../lib/core/i18n/index.ts';
  import {
    type Language,
    type LoadProgress,
    type LoadStatus,
    type ManifestAnatomy,
    type Paint,
    type SurfaceColor,
  } from '../../lib/types/index.ts';
  import { announce } from '../../lib/ui/announcer.svelte.ts';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';

  type Field = 'atlas' | 'colour' | 'detail';

  interface Props {
    lang: Language;
    status: LoadStatus;
    progress: LoadProgress | null;
    atlas: string;
    surfaceColor: SurfaceColor;
    /** Null until the model reports one; the first published level is shown then. */
    detail: string | null;
    /** The tab's paint over the colour chosen here, while one is drawn. */
    paint: Paint | null;
    atlases: readonly string[];
    detailLevels: readonly string[];
    /** What this build publishes: the Colour field offers only these colourings. */
    colourings: { networks?: unknown; territories?: unknown } & Pick<ModelPort, 'cabNp'>;
    anatomy: ManifestAnatomy;
    anatomies: readonly ManifestAnatomy[];
    /** The tract reference, another subject with nothing to choose. */
    reference: { label: string; description?: string } | null;
    /** The reader's own atlas while the tab's open function or deficit shows another; leaving it brings it back. */
    borrowed: { own: string; by: 'functions' | 'deficits' } | null;
    /** The settings panel; opening this popover closes it, and it opening closes this. */
    settingsOpen?: boolean;
    /** A field holds a choice still downloading: the status bar leaves that download to the bar (header.js:538). */
    choosing?: boolean;
    /** S3's `chooseAtlas`. */
    onAtlas: (id: string) => unknown;
    /** The reader points at or focuses the Atlas control, or the summary that holds it. */
    onAtlasIntent: () => void;
    /** The composition lifts the paint first (app.js:633-636), then runs the colour command. */
    onSurfaceColor: (colour: SurfaceColor) => unknown;
    onDetail: (id: string) => unknown;
    /** Another subject is another page: the link is rewritten and the page reloads (S4). */
    onAnatomy: (id: string) => void;
  }

  let {
    lang,
    status,
    progress,
    atlas,
    surfaceColor,
    detail,
    paint,
    atlases,
    detailLevels,
    colourings,
    anatomy,
    anatomies,
    reference,
    borrowed,
    settingsOpen = $bindable(false),
    choosing = $bindable(false),
    onAtlas,
    onAtlasIntent,
    onSurfaceColor,
    onDetail,
    onAnatomy,
  }: Props = $props();

  /** The Colour value while a tab paints; it is never offered. */
  const PAINT = 'paint';

  const uid = $props.id();
  const dataId = `masthead-data-${uid}`;
  const ids = {
    subject: `anatomy-switch-${uid}`,
    atlas: `atlas-switch-${uid}`,
    colour: `surface-switch-${uid}`,
    detail: `detail-${uid}`,
  };
  const noteId = (name: string) => `${name}-note-${uid}`;

  const copy = $derived(t(lang, 'header'));
  const display = $derived(t(lang, 'display'));
  const switching = $derived(status === 'switching');
  const offerAnatomies = $derived(anatomies.length > 1);
  const offersDetail = $derived(detailLevels.length > 1);
  const painted = $derived(reference ? null : paintKind(paint));
  const values = $derived<Record<Field, string>>({
    atlas,
    colour: painted ? PAINT : surfaceColor,
    detail: detail ?? detailLevels[0],
  });

  // What the reader just chose in a field, held in its select while it downloads: once it lands,
  // fails or is overtaken, the select shows the state again.
  let chosen = $state<Record<Field, string | null>>({ atlas: null, colour: null, detail: null });
  $effect.pre(() => {
    for (const field of Object.keys(chosen) as Field[]) {
      if (chosen[field] !== null && (!switching || chosen[field] === values[field])) {
        chosen[field] = null;
      }
    }
    choosing = Object.values(chosen).some((value) => value !== null);
  });
  const shown = (field: Field) => chosen[field] ?? values[field];
  // The atlas a colouring would need, were `atlas` the one shown.
  const required = (colour: string, atlas: string) =>
    requiredAtlas(colourings, colour as SurfaceColor, atlas);

  // The selected option is the field's value, how far it has loaded while it downloads, and the tab
  // that set an atlas; every other option says what else choosing it would change.
  const label = (field: Field, value: string, name: string, other: string) =>
    value !== shown(field)
      ? other
      : chosen[field]
        ? `${name} · ${loadingText(lang, progress)}`
        : field === 'atlas' && borrowed
          ? `${name} · ${copy.borrowedBy[borrowed.by]}`
          : name;

  const atlasOptions = $derived(
    atlases.map((id) => ({
      value: id,
      label: label(
        'atlas',
        id,
        atlasSwitchLabel(id, lang),
        atlasOption(lang, id, required(shown('colour'), id)),
      ),
    })),
  );
  const colourOptions = $derived(
    colourGroups(colourings).map(([group, modes]) => ({
      group,
      options: modes.map((mode) => ({
        value: mode,
        label: label(
          'colour',
          mode,
          display.surfaceColors[mode],
          colourOption(lang, mode, {
            atlas: shown('atlas'),
            required: required(mode, shown('atlas')),
          }),
        ),
      })),
    })),
  );
  const paintLabel = $derived(
    painted ? display.paints[painted as keyof typeof display.paints] : '',
  );
  const detailOptions = $derived(
    detailLevels.map((id) => ({
      value: id,
      label: label('detail', id, atlasSwitchLabel(id, lang), atlasSwitchLabel(id, lang)),
    })),
  );

  const selectedLabel = (field: Field): string =>
    shown(field) === PAINT
      ? paintLabel
      : ((field === 'atlas'
          ? atlasOptions
          : field === 'detail'
            ? detailOptions
            : colourOptions.flatMap(({ options }) => options)
        ).find(({ value }) => value === shown(field))?.label ?? '');

  const summary = $derived(
    dataSummary({
      subject: offerAnatomies ? subjectName(anatomy) : null,
      atlas: selectedLabel('atlas'),
      colour: selectedLabel('colour'),
      detail: offersDetail ? selectedLabel('detail') : null,
      reference: reference?.label,
    }),
  );
  const summarySubject = $derived(summary.filter(({ part }) => part === 'subject'));
  const summarySettings = $derived(summary.filter(({ part }) => part !== 'subject'));
  const summaryLabel = $derived(
    `${copy.dataSummary}: ${summary.map(({ text }) => text).join(' · ')}`,
  );

  // Notes: a field's one-line meaning, printed under it in the popover.
  const atlasNote = (id: string) =>
    (copy.notes as Record<string, string | undefined>)[id] ??
    (t(lang, 'atlases') as Record<string, string | undefined>)[id] ??
    '';
  const kind = $derived(
    typeof anatomy.individual === 'boolean' ? t(lang, 'footer').kind(anatomy.individual) : '',
  );
  const notes = $derived({
    subject: reference ? (reference.description ?? '') : kind,
    atlas: borrowed
      ? copy.borrowedNote[borrowed.by](
          atlasSwitchLabel(shown('atlas'), lang),
          atlasSwitchLabel(borrowed.own, lang),
        )
      : atlasNote(shown('atlas')),
    colour:
      (painted
        ? (display.paintTitles as Record<string, string>)[painted]
        : (display.surfaceColorTitles as Record<string, string | undefined>)[shown('colour')]) ??
      '',
    detail: offersDetail ? atlasNote(shown('detail')) : '',
  });
  // The popover prints each note under its field; the reference's name, which has none, carries its own.
  const tip = (text: string) => (reference && text ? text : undefined);

  let open = $state(false);
  let instant = $state(false);
  let root: HTMLDivElement;
  let toggle: HTMLButtonElement;
  let summaryNode: HTMLSpanElement;
  const selects: Partial<Record<'subject' | Field, HTMLSelectElement>> = $state({});

  // The selects show the state, or the choice being downloaded. Writing the value is also what
  // reverts one that was chosen and did not land.
  function syncSelects() {
    if (selects.subject) selects.subject.value = anatomy.id;
    for (const field of ['atlas', 'colour', 'detail'] as const) {
      const select = selects[field];
      if (select) select.value = shown(field);
    }
  }
  $effect(syncSelects);

  const visible = (element: HTMLElement) => element.checkVisibility();

  /** The next control after the data bar in the masthead, for when the one holding focus goes. */
  function nextControl(): HTMLElement | undefined {
    return [
      ...root
        .closest('header')!
        .querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select:not(:disabled)'),
    ].find(
      (element) =>
        !root.contains(element) &&
        root.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING &&
        visible(element),
    );
  }

  // The summary names the atlas and the colour: internal anatomy stays in the popover and the name,
  // and the colour yields where the atlas would not fit. The atlas stays and truncates if it must.
  function fit() {
    summaryNode.removeAttribute('data-short');
    const context = summaryNode.querySelector<HTMLElement>('.data-summary-context');
    if (!context) return;
    const dropped: string[] = [];
    if (summaryNode.querySelector('[data-part="detail"]')) dropped.push('detail');
    summaryNode.dataset.short = dropped.join(' ');
    if (context.clientWidth >= context.scrollWidth) return;
    if (summaryNode.querySelector('[data-part="colour"]')) dropped.push('colour');
    summaryNode.dataset.short = dropped.join(' ');
  }

  // A new summary or language changes the width; so do the window, the font and the room.
  $effect(() => {
    void [summaryLabel, lang, reference];
    untrack(fit);
  });
  $effect(() => {
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    window.addEventListener('resize', fit);
    let live = true;
    void document.fonts.ready.then(() => live && fit());
    return () => {
      live = false;
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  });

  // A reference hides every control, so focus moves on before they go (deviation h3-focus-never-lost).
  const isReference = $derived(reference !== null);
  $effect.pre(() => {
    if (isReference && root?.contains(document.activeElement)) untrack(nextControl)?.focus();
  });
  // A select that becomes disabled drops focus to the page; the subject waits for a download.
  $effect.pre(() => {
    if (switching && document.activeElement === selects.subject)
      untrack(() => selects.atlas?.focus());
  });

  // The settings panel and this popover are never open together (header.js:174, 398).
  $effect(() => {
    if (settingsOpen) open = false;
  });
  $effect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.contains(event.target as Node)) open = false;
    };
    // Marked handled: the page's own Escape would otherwise go on to clear the selection. On the
    // document, as legacy, so it works when a click on a note left focus on the page.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      instant = true;
      open = false;
      toggle.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  });

  function onToggle(event: MouseEvent) {
    instant = isKeyboardActivation(event);
    open = !open;
    if (open) settingsOpen = false;
  }
  // Tabbing past the last control leaves the popover. No related target means the window lost focus.
  function onfocusout(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (open && next !== null && !root.contains(next)) open = false;
  }

  // What a screen reader hears of a download started here: that it began, and that it landed.
  let pending: { field: Field; value: string } | null = null;
  const separator = $derived(lang === 'fr' ? ' : ' : ': ');
  async function choose(field: Field, value: string, command: (value: string) => unknown) {
    chosen[field] = value;
    command(value);
    await tick();
    syncSelects();
    if (!switching) return;
    pending = { field, value };
    const name =
      field === 'colour'
        ? display.surfaceColors[value as SurfaceColor]
        : atlasSwitchLabel(value, lang);
    announce(`${name}${separator}${copy.loading}`);
  }
  $effect(() => {
    const busy = switching;
    const current = values;
    if (!pending || busy) return;
    if (current[pending.field] === pending.value) announce(t(lang, 'viewport').loaded);
    pending = null;
  });
</script>

<div
  bind:this={root}
  class="data-bar"
  data-reference={reference ? '' : undefined}
  role="presentation"
  {onfocusout}
>
  <button
    bind:this={toggle}
    class="data-toggle"
    type="button"
    aria-expanded={open}
    aria-controls={dataId}
    aria-label={summaryLabel}
    data-tooltip={copy.dataSummary}
    onclick={onToggle}
    onpointerenter={onAtlasIntent}
    onfocus={onAtlasIntent}
  >
    <span bind:this={summaryNode} class="data-summary">
      {#each summarySubject as { text } (text)}
        <span class="data-summary-part" data-part="subject">{text}</span>
      {/each}
      <span class="data-summary-context">
        {#each summarySettings as { part, text }, index (part)}
          {#if index}
            <span class="data-summary-sep" data-part={part} aria-hidden="true">·</span>
          {/if}
          <span class="data-summary-part" data-part={part}>{text}</span>
        {/each}
      </span>
    </span>
  </button>
  <div
    id={dataId}
    class="masthead-data"
    data-open={open ? '' : undefined}
    data-instant={instant ? '' : undefined}
  >
    {#if offerAnatomies || reference}
      <div class="data-field">
        {#if offerAnatomies && !reference}
          <label class="data-label" for={ids.subject}>{copy.subject}</label>
          <span class="select-box"
            ><select
              bind:this={selects.subject}
              id={ids.subject}
              aria-describedby={notes.subject ? noteId('subject') : undefined}
              disabled={switching}
              onchange={(event) => {
                if (event.currentTarget.value !== anatomy.id) onAnatomy(event.currentTarget.value);
              }}
            >
              {#each anatomies as entry (entry.id)}
                <option value={entry.id}>{subjectName(entry)}</option>
              {/each}
            </select></span
          >
        {:else if reference}
          <span class="data-label">{copy.subject}</span>
          <!-- A tooltip trigger is reachable by keyboard (WCAG 1.4.13, 2.1.1: deviation h3-name-description-reachable). -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <p
            class="study-name"
            tabindex={tip(notes.subject) ? 0 : undefined}
            aria-describedby={notes.subject ? noteId('subject') : undefined}
            data-tooltip={tip(notes.subject)}
          >
            {reference.label}
          </p>
        {/if}
        {#if notes.subject}<p class="data-note" id={noteId('subject')}>{notes.subject}</p>{/if}
      </div>
    {/if}
    {#if !reference}
      <div class="data-field">
        <label class="data-label" for={ids.atlas}>{copy.atlas}</label>
        <span class="select-box"
          ><select
            bind:this={selects.atlas}
            id={ids.atlas}
            aria-describedby={notes.atlas ? noteId('atlas') : undefined}
            onchange={(event) => choose('atlas', event.currentTarget.value, onAtlas)}
            onpointerenter={onAtlasIntent}
            onfocus={onAtlasIntent}
          >
            {#each atlasOptions as option (option.value)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select></span
        >
        {#if notes.atlas}<p class="data-note" id={noteId('atlas')}>{notes.atlas}</p>{/if}
      </div>
      <div class="data-field">
        <label class="data-label" for={ids.colour}>{copy.colour}</label>
        <span class="select-box"
          ><select
            bind:this={selects.colour}
            id={ids.colour}
            aria-describedby={notes.colour ? noteId('colour') : undefined}
            onchange={(event) =>
              choose('colour', event.currentTarget.value, (value) =>
                onSurfaceColor(value as SurfaceColor),
              )}
          >
            <!-- Present only while a tab paints, so no empty choice reaches assistive technology. -->
            {#if painted}<option value={PAINT} hidden>{paintLabel}</option>{/if}
            {#each colourOptions as { group, options } (group ?? options[0].value)}
              {#if group}
                <optgroup label={copy.colourGroups[group as keyof typeof copy.colourGroups]}>
                  {#each options as option (option.value)}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </optgroup>
              {:else}
                {#each options as option (option.value)}
                  <option value={option.value}>{option.label}</option>
                {/each}
              {/if}
            {/each}
          </select></span
        >
        {#if notes.colour}<p class="data-note" id={noteId('colour')}>{notes.colour}</p>{/if}
      </div>
      <!-- A build without the optional fine level offers one choice, and so no control. -->
      {#if offersDetail}
        <div class="data-field">
          <label class="data-label" for={ids.detail}>{display.internalAnatomy}</label>
          <span class="select-box"
            ><select
              bind:this={selects.detail}
              id={ids.detail}
              aria-describedby={notes.detail ? noteId('detail') : undefined}
              onchange={(event) => choose('detail', event.currentTarget.value, onDetail)}
            >
              {#each detailOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select></span
          >
          {#if notes.detail}<p class="data-note" id={noteId('detail')}>{notes.detail}</p>{/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  @layer features {
    /* Only settings with a real choice occupy the instrument bar. */
    .data-bar {
      grid-column: 2;
      grid-row: 1;
      position: relative;
      display: flex;
      flex: 1 1 auto;
      align-items: center;
      align-self: stretch;
      min-width: 0;
    }
    :global(#app:is([data-status='loading'], [data-status='error'])) .data-bar {
      visibility: hidden;
    }
    .masthead-data {
      display: flex;
      flex: none;
      align-items: center;
      gap: var(--space-4);
      min-width: 0;
    }
    .data-field {
      display: flex;
      flex: none;
      align-items: baseline;
      gap: var(--space-1);
      min-width: 0;
    }
    .data-label {
      margin: 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-tertiary);
      white-space: nowrap;
    }
    /* One published subject is a name, set where a select's value would sit and on its line. */
    .study-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--text-ui);
      font-weight: 600;
      line-height: var(--lh-ui);
      color: var(--text-primary);
    }

    /* The chevron is two borders, not a background image: forced colours drop images and keep border colours. */
    .select-box {
      --caret-end: var(--space-2);
      position: relative;
      display: flex;
      min-width: 0;
    }
    .select-box::after {
      content: '';
      position: absolute;
      top: calc(50% - 4.5px);
      right: calc(var(--caret-end) + 2px);
      width: 6px;
      height: 6px;
      border-right: 1.5px solid var(--text-secondary);
      border-bottom: 1.5px solid var(--text-secondary);
      transform: rotate(45deg);
      pointer-events: none;
    }
    select {
      appearance: none;
      width: auto;
      max-width: 320px;
      height: auto;
      min-height: var(--control-height);
      field-sizing: content;
      padding: var(--space-1) calc(var(--caret-end) + var(--space-4)) var(--space-1) var(--space-2);
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      background-color: transparent;
      color: var(--text-primary);
      cursor: pointer;
      font-size: var(--text-ui);
      /* Subject identity is the anchor; atlas and rendering remain supporting settings. */
      font-weight: 500;
      line-height: var(--lh-ui);
      /* Loading progress counts up inside the value without shaking it. */
      font-variant-numeric: tabular-nums;
      transition: background-color var(--ui-transition) var(--ease-ui);
    }
    select:is(:focus-visible, :open):not(:disabled) {
      background-color: var(--surface-tonal);
    }
    select:disabled {
      border-color: transparent;
      background-color: transparent;
      color: var(--text-tertiary);
      cursor: default;
    }
    select[id^='anatomy-switch'] {
      font-weight: 600;
    }
    @media (hover: hover) and (pointer: fine) {
      select:hover:not(:disabled) {
        border-color: transparent;
        background-color: var(--surface-tonal);
      }
    }

    /* Popovers grow from their trigger; closing is immediate. */
    .masthead-data[data-open] {
      transition:
        opacity var(--popover-transition) var(--ease-ui),
        transform var(--popover-transition) var(--ease-ui);
    }
    .masthead-data[data-instant] {
      transition: none;
    }
    @starting-style {
      .masthead-data[data-open] {
        opacity: 0;
        transform: scale(0.97);
      }
    }

    /* The summary opens the fields as a popover. */
    /* The full bar height, so the popover drops from the masthead's edge as the settings menu does. */
    .data-bar .data-toggle {
      display: inline-flex;
      flex: 1 1 auto;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
      max-width: 100%;
      min-height: var(--control-height);
      height: auto;
      justify-content: flex-start;
      padding: var(--space-1) var(--space-2);
      border: 0;
      border-radius: var(--radius-control);
      background: transparent;
      color: var(--text-secondary);
      font-weight: 400;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    .data-bar .data-toggle:active:not(:focus-visible) {
      transform: scale(var(--press-scale));
    }
    .data-bar .data-toggle[aria-expanded='true'] {
      background: var(--surface-tonal);
    }
    @media (hover: hover) and (pointer: fine) {
      .data-bar .data-toggle:hover {
        background: var(--surface-tonal);
      }
    }
    .data-bar .data-toggle::after {
      content: '';
      flex: none;
      width: 6px;
      height: 6px;
      margin: 0 4px 0 2px;
      border-right: 1.5px solid var(--text-secondary);
      border-bottom: 1.5px solid var(--text-secondary);
      transform: translateY(-2px) rotate(45deg);
      transition: transform var(--ui-transition) var(--ease-ui);
    }
    .data-bar .data-toggle[aria-expanded='true']::after {
      transform: translateY(1px) rotate(225deg);
    }
    .data-bar .data-summary {
      display: flex;
      flex: 0 1 auto;
      flex-direction: column;
      align-items: flex-start;
      min-width: 0;
      white-space: nowrap;
      text-align: left;
    }
    .data-bar .data-summary > [data-part='subject'] {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-primary);
      font-weight: 600;
      line-height: var(--lh-ui);
    }
    .data-bar .data-summary-context {
      display: flex;
      align-self: stretch;
      align-items: baseline;
      gap: var(--space-2);
      min-width: 0;
      overflow: hidden;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
    }
    .data-bar .data-summary-context > * {
      flex: none;
    }
    .data-bar .data-summary-context > [data-part='atlas'] {
      flex: none;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-primary);
      font-weight: 600;
    }
    .data-bar .data-summary-sep {
      color: var(--text-tertiary);
    }
    .data-bar .data-summary:global([data-short~='detail'] [data-part='detail']),
    .data-bar .data-summary:global([data-short~='colour'] [data-part='colour']) {
      display: none;
    }

    /* The bar turned on its side: one ruled field per row, caption, value, then what it means. */
    .data-bar .masthead-data {
      position: absolute;
      top: calc(100% + var(--space-1));
      /* The available header room ends before its actions, keeping the popover on screen. */
      right: 0;
      left: auto;
      display: none;
      flex-direction: column;
      align-items: stretch;
      gap: 0;
      width: min(320px, calc(100vw - var(--space-6)));
      max-height: calc(100dvh - var(--header-height) - var(--space-4));
      overflow-y: auto;
      background: var(--surface-base);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-panel);
      box-shadow: var(--shadow-popover);
      transform-origin: top right;
    }
    .data-bar .masthead-data[data-open] {
      display: flex;
    }
    /* A labelled stack: caption, a full-width field, then what the choice means. */
    .data-bar .data-field {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-1);
      padding: var(--space-3) var(--space-4) var(--space-4);
    }
    .data-bar .data-field ~ .data-field {
      border-top: 1px solid var(--border-subtle);
    }
    .data-bar .select-box {
      --caret-end: var(--space-3);
    }
    .data-bar select {
      width: 100%;
      max-width: none;
      field-sizing: fixed;
      padding: 0 calc(var(--caret-end) + var(--space-5)) 0 var(--space-3);
      border-color: var(--border-control);
      background-color: var(--surface-base);
    }
    .data-bar select:disabled {
      border-color: var(--border-subtle);
      background-color: var(--surface-sunken);
    }
    @media (hover: hover) and (pointer: fine) {
      .data-bar select:hover:not(:disabled) {
        border-color: var(--text-secondary);
        background-color: var(--surface-base);
      }
    }
    .data-bar .study-name {
      max-width: 100%;
    }
    .data-bar .data-note {
      display: block;
      margin-top: var(--space-1);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }

    /* A tract reference offers no choices: its name sits in the bar, with no popover behind it. */
    .data-bar[data-reference] .data-toggle {
      display: none;
    }
    .data-bar[data-reference] .masthead-data {
      position: static;
      display: flex;
      width: auto;
      max-height: none;
      overflow: visible;
      background: none;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }
    .data-bar[data-reference] .data-field {
      flex-direction: row;
      align-items: center;
      gap: var(--space-2);
      padding: 0;
    }
    .data-bar[data-reference] .data-note {
      display: none;
    }

    /* The first caption stands on the stage gutter; the summary is as wide as its words, and its popover drops from its edge. */
    @media (min-width: 801px) and (min-height: 481px),
      (min-width: 801px) and (orientation: portrait) {
      .data-bar {
        padding-left: var(--stage-gutter);
      }
      .data-bar .data-toggle {
        flex: 0 1 auto;
        margin-left: calc(-1px - var(--space-2));
      }
      .data-bar .masthead-data {
        left: calc(var(--stage-gutter) - 1px - var(--space-2));
        right: auto;
        transform-origin: top left;
      }
    }

    /* Phones: the popover is inset from both screen edges like the settings panel, so the two drop as one width. */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .data-bar {
        position: static;
      }
      .data-bar .data-toggle {
        justify-content: flex-start;
      }
      .data-bar .masthead-data {
        left: max(var(--space-3), env(safe-area-inset-left));
        right: max(var(--space-3), env(safe-area-inset-right));
        width: auto;
        /* Below the text-aware bar, its rule, and a gutter. */
        max-height: calc(
          100dvh - env(safe-area-inset-top) - var(--header-height) - 1px - var(--space-1) -
            var(--space-3)
        );
      }
      .data-bar[data-reference] .data-label {
        display: none;
      }
    }

    /* Touch targets: 44px fields and summary, whatever --control-height is. */
    @media (pointer: coarse), (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      /* 16px, so focusing a field does not zoom the page on iOS. */
      select,
      .data-bar .data-toggle {
        min-height: 44px;
      }
      select {
        font-size: var(--text-title);
      }
    }

    /* A phone on its side has width but little height: two columns, no scrolling. */
    @media (max-height: 480px) and (orientation: landscape) {
      .data-bar .masthead-data {
        width: min(640px, calc(100vw - 2 * var(--space-3)));
      }
      .data-bar .masthead-data[data-open] {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .data-bar .data-field:nth-child(-n + 2) {
        border-top: 0;
      }
      .data-bar .data-field:nth-child(even) {
        border-left: 1px solid var(--border-subtle);
      }
      .data-bar .data-field:last-child:nth-child(odd) {
        grid-column: 1 / -1;
      }
    }
  }

  @layer a11y {
    @media (prefers-reduced-motion: reduce) {
      .masthead-data[data-open] {
        transition-property: opacity;
      }
      .data-bar .data-toggle::after {
        transition: none;
      }
      .data-bar .data-toggle:active {
        transform: none;
      }
    }
    @media (prefers-contrast: more) {
      select,
      .data-bar select:disabled {
        border-color: var(--border-control);
      }
    }
  }
</style>
