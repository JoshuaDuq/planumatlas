<!--
  The masthead's data group: one button reading "Atlas <atlas> Colour <colour>", which opens every
  choice of Atlas, Colour, Internal anatomy and Subject as lists, each with the chosen option's note.
  APG Disclosure (decision 14 on #4): the summary keeps focus when it opens, Tab enters the lists,
  Escape, a press elsewhere or focus leaving closes it. Each list is an APG Toolbar of `aria-pressed`
  buttons (decision 0003: a choice that downloads is not applied by arrowing past it).
  - the colour yields where the atlas would not fit; internal anatomy and subject are in the name only;
  - `data-reference` on the root: the tract reference shows its name alone, with no popover;
  - a download started from a list is announced (WCAG 4.1.3, deviation h3-load-announcements).
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import {
    atlasAside,
    colourAside,
    colourGroups,
    colourPalette,
    dataSummary,
    loadingText,
    subjectName,
    type PaletteSources,
    type SummaryPart,
  } from '../../lib/core/panels/header.ts';
  import { paintKind } from '../../lib/core/state/paint.ts';
  import type { ModelPort } from '../../lib/core/state/ports.ts';
  import { requiredAtlas } from '../../lib/core/state/scene-commands.ts';
  import { atlasSwitchLabel, t, templateCopy } from '../../lib/core/i18n/index.ts';
  import {
    type Language,
    type LoadProgress,
    type LoadStatus,
    type ManifestAnatomy,
    type Paint,
    type Rgb,
    type SurfaceColor,
  } from '../../lib/types/index.ts';
  import type { PublishedAnatomy } from '../../lib/core/assets/published-anatomy.ts';
  import { announce } from '../../lib/ui/announcer.svelte.ts';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import { isKeyboardActivation } from '../../lib/ui/instant.ts';
  import { roving } from '../../lib/ui/Toolbar.svelte';

  type Field = 'atlas' | 'colour' | 'detail';

  interface Choice {
    value: string;
    name: string;
    /** What else choosing it changes, or how far the chosen one has loaded. */
    aside: string | null;
    /** What it is: the chosen one's note, another's few words, or nothing. */
    note: string | null;
    /** A colouring's own colours, drawn beside its name. */
    palette?: readonly Rgb[] | null;
  }

  interface ChoiceGroup {
    label?: string;
    options: readonly Choice[];
  }

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
    /** What this build publishes: the Colour list offers only these colourings, each with its palette. */
    colourings: PaletteSources & { striatal?: unknown } & Pick<ModelPort, 'cabNp'>;
    anatomy: ManifestAnatomy;
    anatomies: readonly PublishedAnatomy[];
    /** The tract reference, another subject with nothing to choose. */
    reference: { label: string; description?: string } | null;
    /** The reader's own atlas while the tab's open function or deficit shows another; leaving it brings it back. */
    borrowed: { own: string; by: 'functions' | 'deficits' } | null;
    /** The settings panel; opening this popover closes it, and it opening closes this. */
    settingsOpen?: boolean;
    /** A list holds a choice still downloading: the status bar leaves that download to the bar (header.js:538). */
    choosing?: boolean;
    /** S3's `chooseAtlas`. */
    onAtlas: (id: string) => unknown;
    /** The reader points at or focuses the Atlas list, or the summary that holds it. */
    onAtlasIntent: () => void;
    /** The composition lifts the paint first (app.js:633-636), then runs the colour command. */
    onSurfaceColor: (colour: SurfaceColor) => unknown;
    onDetail: (id: string) => unknown;
    /** Another subject is another page: the link is rewritten and the page reloads (S4). */
    onAnatomy: (id: string) => void;
    /** The open popover's right edge in the window, so the stage can frame the anatomy beside it; null once closed. */
    onPanel?: (right: number | null, immediate: boolean) => void;
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
    onPanel,
  }: Props = $props();

  /** The Colour value while a tab paints; it is never offered. */
  const PAINT = 'paint';

  const uid = $props.id();
  const dataId = `masthead-data-${uid}`;
  const captionId = (name: string) => `${name}-caption-${uid}`;
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

  // What the reader just chose in a list, held as pressed until its command settles: the status
  // turns to switching only once the download starts, so it cannot say when the choice is over.
  let chosen = $state<Record<Field, string | null>>({ atlas: null, colour: null, detail: null });
  $effect.pre(() => {
    for (const field of Object.keys(chosen) as Field[]) {
      if (chosen[field] !== null && chosen[field] === values[field]) chosen[field] = null;
    }
    choosing = Object.values(chosen).some((value) => value !== null);
  });
  const shown = (field: Field) => chosen[field] ?? values[field];
  // The atlas a colouring would need, were `atlas` the one shown.
  const required = (colour: string, atlas: string) =>
    requiredAtlas(colourings, colour as SurfaceColor, atlas);

  // Notes: what the chosen option is, printed under its name; the other atlases and levels say it in a few words.
  const atlasNote = (id: string) =>
    (copy.notes as Record<string, string | undefined>)[id] ??
    (t(lang, 'atlases') as Record<string, string | undefined>)[id] ??
    '';
  const kind = $derived(
    anatomy.individual === false
      ? templateCopy(lang).subjectNote
      : typeof anatomy.individual === 'boolean'
        ? t(lang, 'footer').kind(anatomy.individual)
        : '',
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
  const brief = (id: string) => (copy.briefs as Record<string, string | undefined>)[id] ?? null;
  const line = (field: 'subject' | Field, value: string, pressed: string, other: string | null) =>
    value === pressed ? notes[field] || null : other;

  // The pressed option says how far it has loaded, or the tab that set an atlas; every other
  // option says what else choosing it would change.
  const aside = (field: Field, value: string, other: string | null) =>
    value !== shown(field)
      ? other
      : chosen[field]
        ? loadingText(lang, progress)
        : field === 'atlas' && borrowed
          ? copy.borrowedBy[borrowed.by]
          : null;

  const atlasOptions = $derived<Choice[]>(
    atlases.map((id) => ({
      value: id,
      name: atlasSwitchLabel(id, lang),
      aside: aside('atlas', id, atlasAside(lang, id, required(shown('colour'), id))),
      note: line('atlas', id, shown('atlas'), brief(id)),
    })),
  );
  const paintLabel = $derived(
    painted ? display.paints[painted as keyof typeof display.paints] : '',
  );
  const colourOptions = $derived<ChoiceGroup[]>([
    ...(painted
      ? [{ options: [{ value: PAINT, name: paintLabel, aside: null, note: notes.colour || null }] }]
      : []),
    ...colourGroups(colourings).map(([group, modes]) => ({
      label: group ? copy.colourGroups[group as keyof typeof copy.colourGroups] : undefined,
      options: modes.map((mode) => ({
        value: mode,
        name: display.surfaceColors[mode],
        aside: aside(
          'colour',
          mode,
          colourAside(lang, { atlas: shown('atlas'), required: required(mode, shown('atlas')) }),
        ),
        note: line('colour', mode, shown('colour'), null),
        palette: colourPalette(mode, colourings),
      })),
    })),
  ]);
  const detailOptions = $derived<Choice[]>(
    detailLevels.map((id) => ({
      value: id,
      name: atlasSwitchLabel(id, lang),
      aside: aside('detail', id, null),
      note: line('detail', id, shown('detail'), brief(id)),
    })),
  );
  const subjectOptions = $derived<Choice[]>(
    anatomies.map((entry) => ({
      value: entry.id,
      name: subjectName(entry),
      aside: null,
      note: line('subject', entry.id, anatomy.id, null),
    })),
  );

  const selectedText = (field: Field): string => {
    const options =
      field === 'atlas'
        ? atlasOptions
        : field === 'detail'
          ? detailOptions
          : colourOptions.flatMap(({ options }) => options);
    const option = options.find(({ value }) => value === shown(field));
    return option ? [option.name, option.aside].filter(Boolean).join(' · ') : '';
  };

  const captions = $derived<Record<SummaryPart, string>>({
    atlas: copy.atlas,
    colour: copy.colour,
    detail: display.internalAnatomy,
    subject: copy.subject,
  });
  // The summary draws what the brain is, the atlas and the colour, which come first in its name.
  const subjectKind = $derived(
    typeof anatomy.individual === 'boolean'
      ? copy.subjectKind[anatomy.individual ? 'individual' : 'template']
      : null,
  );
  const summary = $derived(
    dataSummary({
      subject: subjectKind,
      atlas: selectedText('atlas'),
      colour: selectedText('colour'),
      detail: offersDetail ? selectedText('detail') : null,
      reference: reference?.label,
    }),
  );
  const summaryShown = $derived(summary.filter(({ part }) => part !== 'detail'));
  const summaryLabel = $derived(
    summary.map(({ part, text }) => `${captions[part]} ${text}`).join(', '),
  );

  // The popover prints each note under its option; the reference's name, which has none, carries its own.
  const tip = (text: string) => (reference && text ? text : undefined);

  let open = $state(false);
  let instant = $state(false);
  // The same, unreactive: an effect's cleanup reads state as it was when the effect ran.
  let keyed = false;
  let root: HTMLDivElement;
  let toggle: HTMLButtonElement;
  let summaryNode = $state<HTMLSpanElement>();

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

  // The first arrangement that leaves the atlas whole: all three, without the colour, without the
  // subject, then the atlas alone. The atlas is never dropped.
  const ARRANGEMENTS = [[], ['colour'], ['subject'], ['colour', 'subject']] as const;
  function fit() {
    if (!summaryNode) return;
    const atlas = summaryNode.querySelector<HTMLElement>('[data-part="atlas"] .data-summary-value');
    for (const dropped of ARRANGEMENTS) {
      if (dropped.length) summaryNode.dataset.short = dropped.join(' ');
      else summaryNode.removeAttribute('data-short');
      if (!atlas || atlas.clientWidth >= atlas.scrollWidth) return;
    }
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

  // The settings panel and this popover are never open together (header.js:174, 398).
  $effect(() => {
    if (settingsOpen) open = false;
  });
  $effect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (root.contains(event.target as Node)) return;
      instant = keyed = false;
      open = false;
    };
    // Marked handled: the page's own Escape would otherwise go on to clear the selection. On the
    // document, as legacy, so it works when a click on a note left focus on the page.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      instant = keyed = true;
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

  // The open popover's right edge, from layout offsets, which its entry scale does not move.
  $effect(() => {
    if (!open || reference || !onPanel) return;
    const report = onPanel;
    const panel = root.querySelector<HTMLElement>('.masthead-data')!;
    const measure = () =>
      report(
        (panel.offsetParent as HTMLElement).getBoundingClientRect().left +
          panel.offsetLeft +
          panel.offsetWidth,
        keyed,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      report(null, keyed);
    };
  });

  function onToggle(event: MouseEvent) {
    instant = keyed = isKeyboardActivation(event);
    open = !open;
    if (open) settingsOpen = false;
  }
  // Tabbing past the last control leaves the popover. No related target means the window lost focus.
  function onfocusout(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (!open || next === null || root.contains(next)) return;
    instant = keyed = true;
    open = false;
  }

  // What a screen reader hears of a download started here: that it began, and that it landed.
  let pending: { field: Field; value: string; begun: boolean } | null = null;
  const separator = $derived(lang === 'fr' ? ' : ' : ': ');
  function begin() {
    if (!pending || pending.begun || !switching) return;
    pending.begun = true;
    const { field, value } = pending;
    const name =
      field === 'colour'
        ? display.surfaceColors[value as SurfaceColor]
        : atlasSwitchLabel(value, lang);
    announce(`${name}${separator}${copy.loading}`);
  }
  async function choose(field: Field, value: string, command: (value: string) => unknown) {
    chosen[field] = value;
    const asked = { field, value, begun: false };
    pending = asked;
    const done = command(value);
    await tick();
    begin();
    try {
      await done;
    } finally {
      if (chosen[field] === value) chosen[field] = null;
      if (pending === asked && !asked.begun) pending = null;
    }
  }
  $effect(() => {
    const busy = switching;
    const current = values;
    if (!pending) return;
    if (busy) return untrack(begin);
    if (!pending.begun) return;
    if (current[pending.field] === pending.value) announce(t(lang, 'viewport').loaded);
    pending = null;
  });
</script>

{#snippet list(
  name: 'subject' | Field,
  caption: string,
  groups: readonly ChoiceGroup[],
  pressed: string,
  onpress: (value: string) => void,
  unavailable = false,
)}
  <div class="data-field" data-field={name}>
    <p class="data-label" id={captionId(name)}>{caption}</p>
    <div
      role="toolbar"
      aria-orientation="vertical"
      aria-labelledby={captionId(name)}
      class="data-options"
      {@attach roving}
    >
      {#each groups as group, index (group.label ?? index)}
        <div
          class="data-option-group"
          role={group.label ? 'group' : undefined}
          aria-label={group.label}
        >
          {#each group.options as option (option.value)}
            {@const id = `${name}-${option.value}-${uid}`}
            <button
              type="button"
              class="data-option"
              aria-labelledby={option.aside ? `${id}-name ${id}-aside` : `${id}-name`}
              aria-describedby={option.note ? `${id}-note` : undefined}
              aria-pressed={option.value === pressed}
              aria-disabled={unavailable || undefined}
              onpointerenter={name === 'atlas' ? onAtlasIntent : undefined}
              onfocus={name === 'atlas' ? onAtlasIntent : undefined}
              onclick={() => {
                if (!unavailable && option.value !== pressed) onpress(option.value);
              }}
            >
              <span class="data-option-check">
                {#if option.value === pressed}{@render iconGraphic('check')}{/if}
              </span>
              <span class="data-option-name" id="{id}-name">{option.name}</span>
              {#if option.palette}
                <span class="data-option-palette" aria-hidden="true">
                  {#each option.palette as [r, g, b], index (index)}
                    <span style:background="rgb({r} {g} {b})"></span>
                  {/each}
                </span>
              {/if}
              {#if option.aside}
                <span class="data-option-aside" id="{id}-aside">{option.aside}</span>
              {/if}
              {#if option.note}
                <span class="data-option-note" id="{id}-note">{option.note}</span>
              {/if}
            </button>
          {/each}
        </div>
      {/each}
    </div>
  </div>
{/snippet}

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
      {#each summaryShown as { part, text } (part)}
        <span class="data-summary-part" data-part={part}>
          <span class="data-summary-caption">{captions[part]}</span>
          <span class="data-summary-value">{text}</span>
        </span>
      {/each}
    </span>
  </button>
  <div
    id={dataId}
    class="masthead-data"
    data-open={open ? '' : undefined}
    data-instant={instant ? '' : undefined}
  >
    {#if reference}
      <div class="data-field">
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
        {#if notes.subject}<p class="data-note" id={noteId('subject')}>{notes.subject}</p>{/if}
      </div>
    {:else}
      {@render list('atlas', copy.atlas, [{ options: atlasOptions }], shown('atlas'), (value) =>
        choose('atlas', value, onAtlas),
      )}
      {@render list('colour', copy.colour, colourOptions, shown('colour'), (value) =>
        choose('colour', value, (next) => onSurfaceColor(next as SurfaceColor)),
      )}
      {#if offersDetail}
        {@render list(
          'detail',
          display.internalAnatomy,
          [{ options: detailOptions }],
          shown('detail'),
          (value) => choose('detail', value, onDetail),
        )}
      {/if}
      <!-- Another subject reloads the page, so it waits for a download to land. -->
      {#if offerAnatomies}
        {@render list(
          'subject',
          copy.subject,
          [{ options: subjectOptions }],
          anatomy.id,
          onAnatomy,
          switching,
        )}
      {/if}
    {/if}
  </div>
</div>

<style>
  @layer features {
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

    /* The summary: caption and value for the subject, the atlas and the colour, on one line. */
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
    .data-summary {
      display: flex;
      flex: 0 1 auto;
      align-items: baseline;
      gap: var(--space-4);
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
    }
    .data-summary-part {
      display: flex;
      flex: none;
      align-items: baseline;
      gap: var(--space-2);
      min-width: 0;
    }
    .data-summary-part[data-part='atlas'] {
      flex: 0 1 auto;
    }
    .data-summary-caption {
      flex: none;
      font-size: var(--text-caption);
      color: var(--text-tertiary);
    }
    .data-summary-value {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-primary);
      font-weight: 600;
      /* Loading progress counts up inside the value without shaking it. */
      font-variant-numeric: tabular-nums;
    }
    .data-summary:global([data-short~='colour'] [data-part='colour']),
    .data-summary:global([data-short~='subject'] [data-part='subject']) {
      display: none;
    }

    /* The popover: the lists side by side, each a caption, its options and the chosen one's note. */
    .masthead-data {
      --data-width: min(34rem, calc(100vw - 2 * var(--space-3)));
      position: absolute;
      top: calc(100% + var(--space-1));
      right: 0;
      display: none;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      width: var(--data-width);
      max-height: calc(100dvh - var(--header-height) - var(--space-4));
      overflow-y: auto;
      overscroll-behavior: contain;
      background: var(--surface-base);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-panel);
      box-shadow: var(--shadow-popover);
      transform-origin: top right;
    }
    .masthead-data[data-open] {
      display: grid;
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
    /* Atlas, internal anatomy and subject down the left; the colour beside them, as tall as they are. */
    .masthead-data {
      grid-template-rows: auto auto 1fr;
    }
    .data-field {
      grid-column: 1;
      min-width: 0;
      padding: var(--space-3) var(--space-2);
    }
    .data-field + .data-field {
      border-top: 1px solid var(--border-subtle);
    }
    .data-field[data-field='colour'] {
      grid-column: 2;
      grid-row: 1 / span 3;
      border-top: 0;
      border-left: 1px solid var(--border-subtle);
    }
    .data-label {
      margin: 0 0 var(--space-1);
      padding: 0 var(--space-2);
      font-size: var(--text-caption);
      font-weight: 500;
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    .data-options {
      display: flex;
      flex-direction: column;
    }
    .data-option-group + .data-option-group {
      margin-top: var(--space-1);
      padding-top: var(--space-1);
      border-top: 1px solid var(--border-subtle);
    }
    .data-option {
      display: grid;
      grid-template-columns: 16px minmax(0, 1fr) auto;
      align-items: center;
      column-gap: var(--space-2);
      width: 100%;
      min-height: 30px;
      padding: var(--space-1) var(--space-2);
      border: 0;
      border-radius: var(--radius-small);
      background: none;
      color: var(--text-primary);
      font: inherit;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      text-align: left;
      cursor: pointer;
    }
    .data-option[aria-pressed='true'] {
      cursor: default;
    }
    .data-option[aria-pressed='true'] .data-option-name {
      font-weight: 600;
    }
    .data-option[aria-disabled='true'] {
      color: var(--text-tertiary);
      cursor: default;
    }
    .data-option:focus-visible {
      outline-offset: -2px;
    }
    @media (hover: hover) and (pointer: fine) {
      .data-option:hover:not([aria-pressed='true'], [aria-disabled='true']) {
        background: var(--surface-hover);
      }
    }
    .data-option-check {
      display: flex;
      grid-row: 1;
    }
    .data-option-name {
      min-width: 0;
      font-variant-numeric: tabular-nums;
    }
    /* The colouring's own colours, as its key draws them, beside its name. */
    .data-option-palette {
      display: flex;
      grid-column: 3;
      grid-row: 1;
      width: 48px;
      height: 8px;
      border-radius: var(--radius-mark);
      overflow: hidden;
    }
    .data-option-palette > span {
      flex: 1;
    }
    .data-option-aside {
      grid-column: 2 / -1;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-tertiary);
      font-variant-numeric: tabular-nums;
    }
    .data-option-note {
      grid-column: 2 / -1;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    /* Under the option names: a 16px check and its gap in from the row's edge. */
    .data-note {
      margin: var(--space-1) 0 0;
      padding: 0 var(--space-2) 0 calc(2 * var(--space-2) + 16px);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    /* One published subject is a name, set where a value would sit. */
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
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
      padding: 0;
    }
    .data-bar[data-reference] .data-label {
      margin: 0;
      padding: 0;
      color: var(--text-tertiary);
      white-space: nowrap;
    }
    .data-bar[data-reference] .data-note {
      display: none;
    }

    /* The summary's first caption stands on the stage gutter; the popover drops from its edge and stays on screen. */
    @media (min-width: 801px) and (min-height: 481px),
      (min-width: 801px) and (orientation: portrait) {
      .data-bar {
        padding-left: var(--stage-gutter);
      }
      .data-bar .data-toggle {
        flex: 0 1 auto;
        margin-left: calc(-1px - var(--space-2));
      }
      .masthead-data {
        right: auto;
        left: min(
          calc(var(--stage-gutter) - 1px - var(--space-2)),
          calc(100vw - var(--rail-width) - var(--data-width) - var(--space-3))
        );
        transform-origin: top left;
      }
    }

    /* Phones: one list under another, inset from both screen edges like the settings panel. */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .data-bar {
        position: static;
      }
      .masthead-data {
        left: max(var(--space-3), env(safe-area-inset-left));
        right: max(var(--space-3), env(safe-area-inset-right));
        grid-template-columns: minmax(0, 1fr);
        width: auto;
        /* Below the text-aware bar, its rule, and a gutter. */
        max-height: calc(
          100dvh - env(safe-area-inset-top) - var(--header-height) - 1px - var(--space-1) -
            var(--space-3)
        );
      }
      /* One list, in the order it is read. */
      .masthead-data {
        grid-template-rows: none;
      }
      .data-field[data-field='colour'] {
        grid-column: 1;
        grid-row: auto;
        border-top: 1px solid var(--border-subtle);
        border-left: 0;
      }
      .data-bar[data-reference] .data-label {
        display: none;
      }
    }

    /* Touch targets: 44px summary and options, whatever --control-height is. */
    @media (pointer: coarse), (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .data-bar .data-toggle,
      .data-option {
        min-height: 44px;
      }
    }

    /* A phone on its side has width but little height: the two columns again. */
    @media (max-height: 480px) and (orientation: landscape) {
      .masthead-data {
        right: auto;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        width: min(640px, calc(100vw - 2 * var(--space-3)));
      }
      .masthead-data {
        grid-template-rows: auto auto 1fr;
      }
      .data-field[data-field='colour'] {
        grid-column: 2;
        grid-row: 1 / span 3;
        border-top: 0;
        border-left: 1px solid var(--border-subtle);
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
    @media (forced-colors: active) {
      /* A forced background would paint the strip in one colour; a colouring's colours are data. */
      .data-option-palette {
        forced-color-adjust: none;
        outline: 1px solid CanvasText;
      }
    }
  }
</style>
