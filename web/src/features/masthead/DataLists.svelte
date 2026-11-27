<!--
  The data popover's lists: Atlas, Colour, Internal anatomy and Subject, each an APG Toolbar of
  `aria-pressed` buttons (decision 0003: a choice that downloads is not applied by arrowing past it).
  Each atlas but the shown one has a second toggle in its row that draws its borders over the shown one.
  A chunk of its own (BUILD-15): the data bar fetches it when the reader first points at, focuses or
  opens the summary. The bar holds what is chosen; this draws it and says what each option is.
-->
<script lang="ts">
  import {
    atlasAside,
    colourAside,
    colourGroups,
    loadingText,
    subjectName,
  } from '../../lib/core/panels/header.ts';
  import { defaultDetailOf } from '../../lib/core/catalog/visibility.ts';
  import type { PaletteSources } from '../../lib/core/panels/palettes.ts';
  import type { ModelPort } from '../../lib/core/state/ports.ts';
  import { atlasSwitchLabel, t, templateCopy } from '../../lib/core/i18n/index.ts';
  import { DEFAULTS } from '../../lib/core/state/url-state.ts';
  import type {
    Language,
    LoadProgress,
    ManifestAnatomy,
    Rgb,
    SurfaceColor,
  } from '../../lib/types/index.ts';
  import type { PublishedAnatomy } from '../../lib/core/assets/published-anatomy.ts';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';
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
    /** What a first visit opens on: the manifest's first atlas, the default colour and level. */
    isDefault?: boolean;
    /** How fine a detail level's segmentation is, beside its name. */
    precision?: string;
    /** An atlas whose borders can be drawn over the shown one: whether they are. */
    borders?: boolean;
  }

  interface ChoiceGroup {
    label?: string;
    options: readonly Choice[];
  }

  interface Props {
    lang: Language;
    progress: LoadProgress | null;
    /** What each list shows pressed: the state, or a choice still settling. */
    shown: Record<Field, string>;
    /** Which lists hold a choice still settling, so their pressed option says how far it has loaded. */
    held: Record<Field, boolean>;
    /** The tab's paint kind while one is drawn, shown as the pressed Colour option. */
    painted: string | null;
    /** The value Colour takes while a tab paints. */
    paintValue: string;
    atlases: readonly string[];
    detailLevels: readonly string[];
    colourings: PaletteSources & { striatal?: unknown } & Pick<ModelPort, 'cabNp'>;
    anatomy: ManifestAnatomy;
    anatomies: readonly PublishedAnatomy[];
    borrowed: { own: string; by: 'functions' | 'deficits' } | null;
    /** A download or the tour runs: another subject, another page, would end it, so it waits. */
    holdsSubject: boolean;
    /** A colouring's own colours, in its key's order (palettes.ts). */
    palette: (mode: SurfaceColor) => readonly Rgb[] | null;
    /** The atlas a colouring would need, were `atlas` the one shown. */
    required: (colour: string, atlas: string) => string | null | undefined;
    /** The atlas whose borders are drawn over the shown one, or null. */
    atlasBorders: string | null;
    /** The atlases whose borders each atlas's cortex can draw, by that atlas. */
    bordersOver: ReadonlyMap<string, ReadonlySet<string>>;
    onChoose: (field: Field, value: string) => void;
    /** Draw this atlas's borders over the shown one, or none. */
    onBorders: (atlas: string | null) => void;
    onAnatomy: (id: string) => void;
    onAtlasIntent: () => void;
  }

  let {
    lang,
    progress,
    shown,
    held,
    painted,
    paintValue,
    atlases,
    detailLevels,
    colourings,
    anatomy,
    anatomies,
    borrowed,
    holdsSubject,
    required,
    palette,
    atlasBorders,
    bordersOver,
    onChoose,
    onBorders,
    onAnatomy,
    onAtlasIntent,
  }: Props = $props();

  const uid = $props.id();
  const captionId = (name: string) => `${name}-caption-${uid}`;

  const copy = $derived(t(lang, 'header'));
  const display = $derived(t(lang, 'display'));
  // Notes: what the chosen option is, printed under its name; the other atlases and levels say it in a few words.
  const atlasNote = (id: string) =>
    (copy.notes as Record<string, string | undefined>)[id] ??
    (t(lang, 'atlases') as Record<string, string | undefined>)[id] ??
    '';
  const notes = $derived({
    subject:
      anatomy.individual === false
        ? templateCopy(lang).subjectNote
        : typeof anatomy.individual === 'boolean'
          ? t(lang, 'footer').kind(anatomy.individual)
          : '',
    atlas: borrowed
      ? copy.borrowedNote[borrowed.by](
          atlasSwitchLabel(shown.atlas, lang),
          atlasSwitchLabel(borrowed.own, lang),
        )
      : atlasNote(shown.atlas),
    colour:
      (painted
        ? (display.paintTitles as Record<string, string>)[painted]
        : (display.surfaceColorTitles as Record<string, string | undefined>)[shown.colour]) ?? '',
    detail: atlasNote(shown.detail),
  });
  const brief = (id: string) => (copy.briefs as Record<string, string | undefined>)[id] ?? null;
  const line = (field: 'subject' | Field, value: string, pressed: string, other: string | null) =>
    value === pressed ? notes[field] || null : other;

  // The pressed option says how far it has loaded, or the tab that set an atlas; every other
  // option says what else choosing it would change.
  const aside = (field: Field, value: string, other: string | null) =>
    value !== shown[field]
      ? other
      : held[field]
        ? loadingText(lang, progress)
        : field === 'atlas' && borrowed
          ? copy.borrowedBy[borrowed.by]
          : null;

  const atlasOptions = $derived<Choice[]>(
    atlases.map((id) => ({
      value: id,
      name: atlasSwitchLabel(id, lang),
      aside: aside('atlas', id, atlasAside(lang, id, required(shown.colour, id))),
      note: line('atlas', id, shown.atlas, brief(id)),
      isDefault: id === atlases[0],
      ...(bordersOver.get(shown.atlas)?.has(id) && { borders: id === atlasBorders }),
    })),
  );
  const colourOptions = $derived<ChoiceGroup[]>([
    ...(painted
      ? [
          {
            options: [
              {
                value: paintValue,
                name: display.paints[painted as keyof typeof display.paints],
                aside: null,
                note: notes.colour || null,
              },
            ],
          },
        ]
      : []),
    ...colourGroups(colourings).map(([group, modes]) => ({
      label: group ? copy.colourGroups[group as keyof typeof copy.colourGroups] : undefined,
      options: modes.map((mode) => ({
        value: mode,
        name: display.surfaceColors[mode],
        aside: aside(
          'colour',
          mode,
          colourAside(lang, { atlas: shown.atlas, required: required(mode, shown.atlas) }),
        ),
        note: line('colour', mode, shown.colour, null),
        palette: palette(mode),
        isDefault: mode === DEFAULTS.surfaceColor,
      })),
    })),
  ]);
  const defaultDetail = $derived(defaultDetailOf(detailLevels.map((id) => ({ id }))));
  const detailOptions = $derived<Choice[]>(
    detailLevels.map((id) => ({
      value: id,
      name: atlasSwitchLabel(id, lang),
      aside: aside('detail', id, null),
      note: line('detail', id, shown.detail, brief(id)),
      isDefault: id === defaultDetail,
      precision: copy.precision[id],
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
        {@const groupId = group.label ? `${name}-group-${index}-${uid}` : undefined}
        <div
          class="data-option-group"
          role={group.label ? 'group' : undefined}
          aria-labelledby={groupId}
        >
          {#if group.label}
            <p id={groupId} class="data-group-label">{group.label}</p>
          {/if}
          {#each group.options as option (option.value)}
            {#if option.borders === undefined}
              {@render choice(name, option, pressed, onpress, unavailable)}
            {:else}
              <div class="data-option-row">
                {@render choice(name, option, pressed, onpress, unavailable)}
                <button
                  type="button"
                  class="data-option-borders"
                  aria-pressed={option.borders}
                  aria-label={copy.bordersOf(option.name)}
                  data-tooltip={copy.bordersTip(option.name, atlasSwitchLabel(shown.atlas, lang))}
                  onclick={() => onBorders(option.borders ? null : option.value)}
                >
                  <span class="data-option-line" aria-hidden="true"></span>{copy.borders}
                </button>
              </div>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet choice(
  name: 'subject' | Field,
  option: Choice,
  pressed: string,
  onpress: (value: string) => void,
  unavailable: boolean,
)}
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
    <span class="data-option-name" id="{id}-name">
      {option.name}{#if option.isDefault}{' '}<span class="data-option-default">
          {copy.isDefault}
        </span>{/if}{#if option.precision}{' '}<span class="data-option-default">
          {option.precision}
        </span>{/if}
    </span>
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
{/snippet}

{@render list('atlas', copy.atlas, [{ options: atlasOptions }], shown.atlas, (value) =>
  onChoose('atlas', value),
)}
{@render list('colour', copy.colour, colourOptions, shown.colour, (value) =>
  onChoose('colour', value),
)}
<!-- Another subject reloads the page, so it waits for a download to land and the tour to end. -->
{#if anatomies.length > 1}
  {@render list(
    'subject',
    copy.subject,
    [{ options: subjectOptions }],
    anatomy.id,
    onAnatomy,
    holdsSubject,
  )}
{/if}
{#if detailLevels.length > 1}
  {@render list(
    'detail',
    display.internalAnatomy,
    [{ options: detailOptions }],
    shown.detail,
    (value) => onChoose('detail', value),
  )}
{/if}

<style>
  @layer features {
    /* One list under another, in the order they are read; two columns where there is width (below). */
    .data-field {
      min-width: 0;
      padding: var(--space-3) var(--space-2);
    }
    .data-field + .data-field {
      border-top: 1px solid var(--border-subtle);
    }
    /* Atlas and Colour start together. Subject and Internal anatomy stack under Atlas. */
    @media (min-width: 801px), (max-height: 480px) and (orientation: landscape) {
      .data-field {
        padding-block: var(--space-2);
      }
      .data-field[data-field='atlas'] {
        grid-row: 1;
      }
      .data-field[data-field='subject'] {
        grid-row: 2;
      }
      .data-field[data-field='detail'] {
        grid-row: 3;
      }
      .data-field:not([data-field='colour']) {
        grid-column: 1;
      }
      .data-field[data-field='colour'] {
        grid-row: 1 / -1;
        grid-column: 2;
        border-top: 0;
        border-left: 1px solid var(--border-subtle);
      }
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
      margin-top: var(--space-2);
      padding-top: var(--space-2);
      border-top: 1px solid var(--border-subtle);
    }
    .data-group-label {
      margin: 0 0 var(--space-1);
      padding: 0 var(--space-2);
      font-size: 0.75rem;
      font-weight: 600;
      line-height: var(--lh-caption);
      color: var(--text-tertiary);
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
    /* An atlas's row with its borders toggle at the end of its name's line. */
    .data-option-row {
      display: flex;
      align-items: flex-start;
      gap: var(--space-1);
    }
    .data-option-row > .data-option {
      flex: 1 1 auto;
      min-width: 0;
    }
    .data-option-borders {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: var(--space-1);
      min-height: 30px;
      padding: 0 var(--space-2);
      border: 0;
      border-radius: var(--radius-small);
      background: none;
      color: var(--text-secondary);
      font: inherit;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      cursor: pointer;
    }
    .data-option-borders[aria-pressed='true'] {
      background: var(--surface-pressed);
      color: var(--text-primary);
      font-weight: 600;
    }
    .data-option-borders:focus-visible {
      outline-offset: -2px;
    }
    /* The line the borders are drawn with on the stage (BORDER_INK). */
    .data-option-line {
      width: 12px;
      height: 3px;
      background: #f2f2f2;
      box-shadow: 0 0 0 1px #1b1b1b;
      forced-color-adjust: none;
    }
    @media (hover: hover) and (pointer: fine) {
      .data-option-borders:hover:not([aria-pressed='true']) {
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
    .data-option-default {
      font-weight: 400;
      color: var(--text-tertiary);
    }
    /* The colouring's own colours, as its key draws them, beside its name. */
    .data-option-palette {
      display: flex;
      gap: 1px;
      grid-column: 3;
      grid-row: 1;
      width: 52px;
      height: 10px;
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

    /* Touch targets: 44px options, whatever --control-height is. */
    @media (pointer: coarse), (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .data-option,
      .data-option-borders {
        min-height: 44px;
      }
    }
  }

  @layer a11y {
    @media (forced-colors: active) {
      /* A forced background would paint the strip in one colour; a colouring's colours are data. */
      .data-option-palette {
        forced-color-adjust: none;
        outline: 1px solid CanvasText;
      }
    }
  }
</style>
