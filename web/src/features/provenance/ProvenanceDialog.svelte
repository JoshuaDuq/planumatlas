<!--
  The provenance sheet (ui/panels/provenance.js, index.html:689-697): what the loaded anatomy's
  own published records say about where it came from, as term/definition rows, then the intended
  use. A tract reference is another subject: it shows its own rows instead. Opened by the shell
  (the colophon's button, the phone menu's item) through `open`; mounted only by I3b (decision
  0008). Native modal Dialog: trap, Escape, inert page, `data-instant` and focus return are U5's.
  - initial focus is the title, not Close (deviations/h4-initial-focus.md);
  - published data is English whatever the UI language: it carries `lang="en"`
    (deviations/h4-lang-of-parts.md);
  - a re-render that removes the focused link moves focus to the title, not to the page
    (deviations/h4-rerender-focus.md).
  Under them, the works behind what is on screen (WP24): read from `references.json` the first time
  the dialog opens, copied as text or saved as BibTeX and RIS.
-->
<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import type { Language, Manifest } from '../../lib/types/index.ts';
  import type { NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import {
    bibtex,
    referenceText,
    ris,
    viewReferences,
    type ReferenceLibrary,
    type ViewCitations,
  } from '../../lib/core/panels/citations.ts';
  import {
    provenanceRows,
    referenceListRows,
    referenceRows,
    type ProvenanceItem,
    type ProvenanceLink,
    type ProvenanceRow,
  } from '../../lib/core/panels/provenance.ts';
  import { methodsHref } from '../../lib/core/methods.ts';
  import { announce } from '../../lib/ui/announcer.svelte.ts';
  import { createCopier } from '../../lib/ui/clipboard.svelte.ts';
  import Dialog from '../../lib/ui/Dialog.svelte';
  import { downloadText } from '../../lib/ui/download.ts';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';

  interface Props {
    open?: boolean;
    instant?: boolean;
    lang: Language;
    manifest: Partial<Manifest>;
    manifestUrl: string;
    indexUrl: string;
    domains: NeuropsychDomains | null;
    /** The tract reference shown instead of the anatomy, with the links of its own sources. */
    reference: { label: string; links: readonly ProvenanceLink[] } | null;
    /** Takes focus on close when the opener is hidden (the phone menu's item): the ⋯ button. */
    fallbackFocus: () => HTMLElement | null;
    /** What on screen cites what (`viewCitations`). */
    citations: ViewCitations;
    /** The records `references.json` carries; asked for when the dialog first opens. */
    loadReferences: () => Promise<ReferenceLibrary>;
  }

  let {
    open = $bindable(false),
    instant = $bindable(false),
    lang,
    manifest,
    manifestUrl,
    indexUrl,
    domains,
    reference,
    fallbackFocus,
    citations,
    loadReferences,
  }: Props = $props();

  const rowsIn = (language: Language): ProvenanceRow[] =>
    reference
      ? referenceRows(reference, language)
      : provenanceRows(manifest, { lang: language, manifestUrl, indexUrl, domains });
  const rows = $derived(rowsIn(lang));
  const copy = $derived(t(lang, 'footer'));
  const uid = $props.id();

  // Rows have the same shape in every language, and a value the sheet does not translate is
  // identical in both: that value is the published English.
  // A tract reference's label arrives in the interface language already, so it is never marked.
  const english = $derived(lang === 'en' || reference ? null : rowsIn('en'));
  const dataLang = (
    text: string | null | undefined,
    row: number,
    item: number,
    field: 'text' | 'note',
    englishRows: ProvenanceRow[] | null,
  ) => (englishRows && text && englishRows[row]?.items[item]?.[field] === text ? 'en' : undefined);

  // The library is asked for once, on the first opening; a failure waits for Retry.
  let library = $state.raw<ReferenceLibrary | null>(null);
  let loading = $state<'idle' | 'loading' | 'failed'>('idle');
  function load() {
    loading = 'loading';
    loadReferences().then(
      (loaded) => {
        library = loaded;
        loading = 'idle';
      },
      (error: unknown) => {
        console.error(error);
        loading = 'failed';
      },
    );
  }
  $effect(() => {
    if (open && !library && untrack(() => loading) === 'idle') load();
  });

  const listed = $derived(library && viewReferences(citations, library));
  const acknowledgement = $derived(library && citations.hcp ? library.hcpAcknowledgement : null);
  const referencesIn = (language: Language) =>
    listed ? referenceListRows(listed, acknowledgement, language) : [];
  const references = $derived(referencesIn(lang));
  const referencesEnglish = $derived(lang === 'en' ? null : referencesIn('en'));

  const copier = createCopier(() => ({
    copied: copy.referencesCopied,
    failed: copy.referencesCopyFailed,
  }));
  onDestroy(copier.dispose);
  const copyLabel = $derived(
    copier.state === 'copied'
      ? copy.referencesCopied
      : copier.state === 'failed'
        ? copy.referencesCopyFailed
        : copy.copyReferences,
  );
  function save(text: string, extension: 'bib' | 'ris', type: string, said: string) {
    downloadText(text, `planum-references.${extension}`, type);
    announce(said);
  }

  let title: HTMLElement;
  $effect(() => {
    void rows;
    void references;
    void loading;
    // The focused link is gone: its node was replaced by the new rows.
    if (untrack(() => open) && !title.closest('dialog')!.contains(document.activeElement)) {
      title.focus();
    }
  });
</script>

{#snippet note(
  item: ProvenanceItem,
  row: number,
  index: number,
  englishRows: ProvenanceRow[] | null,
)}
  {#if item.note}
    <p class="provenance-note" lang={dataLang(item.note, row, index, 'note', englishRows)}>
      {item.note}
    </p>
  {/if}
{/snippet}

{#snippet link(item: ProvenanceItem)}
  {#if item.link}
    <a
      class={['provenance-link', item.link.mono && 'code']}
      href={item.link.href}
      target="_blank"
      rel="noreferrer"
      >{item.link.text}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
      >{@render iconGraphic('external-link')}</a
    >
  {/if}
{/snippet}

{#snippet facts(shown: ProvenanceRow[], englishRows: ProvenanceRow[] | null)}
  <dl class="provenance-facts">
    {#each shown as row, rowIndex}
      <dt>{row.label}</dt>
      <dd>
        {#each row.items as item, itemIndex}
          <div class="provenance-item">
            <!-- A bare link is the item's name; beside a name it is the citation under it. -->
            {#if item.text}
              <p
                class={['provenance-value', item.mono && 'code']}
                lang={dataLang(item.text, rowIndex, itemIndex, 'text', englishRows)}
              >
                {item.text}
              </p>
              {@render note(item, rowIndex, itemIndex, englishRows)}
              {@render link(item)}
            {:else}
              {@render link(item)}
              {@render note(item, rowIndex, itemIndex, englishRows)}
            {/if}
          </div>
        {/each}
      </dd>
    {/each}
  </dl>
{/snippet}

<Dialog bind:open bind:instant {fallbackFocus} isolateKeys closeLabel={copy.close}>
  {#snippet heading(id)}
    <!-- Native modal dialogs focus an `autofocus` descendant on open (HTML standard, dialog focusing steps). -->
    <!-- svelte-ignore a11y_autofocus -->
    <h2 {id} class="provenance-title" tabindex="-1" autofocus bind:this={title}>
      {copy.provenance}
    </h2>
  {/snippet}
  {@render facts(rows, english)}
  <section class="provenance-references" aria-labelledby="{uid}-references">
    <h3 id="{uid}-references" class="provenance-subtitle">{copy.references}</h3>
    {#if listed}
      {@render facts(references, referencesEnglish)}
      <div class="provenance-actions">
        <button type="button" onclick={() => copier.copy(referenceText(listed!, acknowledgement))}
          >{copyLabel}</button
        >
        <button
          type="button"
          onclick={() =>
            save(
              bibtex(listed!),
              'bib',
              'application/x-bibtex;charset=utf-8',
              copy.bibtexDownloaded,
            )}>{copy.downloadBibtex}</button
        >
        <button
          type="button"
          onclick={() =>
            save(
              ris(listed!),
              'ris',
              'application/x-research-info-systems;charset=utf-8',
              copy.risDownloaded,
            )}>{copy.downloadRis}</button
        >
      </div>
    {:else if loading === 'failed'}
      <p class="provenance-note">{copy.referencesFailed}</p>
      <div class="provenance-actions">
        <button type="button" onclick={load}>{copy.referencesRetry}</button>
      </div>
    {:else}
      <p class="provenance-note">{copy.referencesLoading}</p>
    {/if}
  </section>
  <p class="provenance-methods">
    <a class="provenance-link" href={methodsHref()} hreflang="en" target="_blank" rel="noreferrer"
      >{t(lang, 'link').methods}<span class="visually-hidden">{` ${t(lang, 'link').newTab}`}</span
      >{@render iconGraphic('external-link')}</a
    >
  </p>
  <p class="provenance-use">{copy.intendedUse}</p>
</Dialog>

<style>
  @layer features {
    .provenance-title {
      margin: 0;
    }
    /* dialogs.css:112-133 */
    .provenance-facts {
      display: grid;
      grid-template-columns: 148px minmax(0, 1fr);
      margin: 0;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
    }
    .provenance-facts dt,
    .provenance-facts dd {
      margin: 0;
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    .provenance-facts dt {
      padding-right: var(--space-4);
      overflow-wrap: anywhere;
      color: var(--text-secondary);
    }
    .provenance-facts dd {
      display: grid;
      gap: var(--space-3);
      min-width: 0;
    }
    .provenance-item {
      display: grid;
      justify-items: start;
      min-width: 0;
    }
    .provenance-value,
    .provenance-note {
      margin: 0;
    }
    .provenance-value {
      overflow-wrap: anywhere;
    }
    .provenance-note {
      overflow-wrap: anywhere;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    .provenance-link {
      overflow-wrap: anywhere;
      /* A focused link scrolls clear of the sticky header (WCAG 2.4.11). */
      scroll-margin-top: calc(var(--header-height) + env(safe-area-inset-top) + var(--space-2));
    }
    .provenance-link :global(.control-icon) {
      margin-left: var(--space-1);
      vertical-align: -1px;
    }
    .provenance-references {
      margin: var(--space-4) 0 0;
    }
    .provenance-subtitle {
      margin: 0 0 var(--space-1);
      font-size: var(--text-ui);
      font-weight: 600;
      line-height: var(--lh-ui);
    }
    .provenance-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-3);
    }
    .provenance-actions button {
      min-height: var(--control-height);
      padding: var(--space-1) var(--space-3);
      border: 1px solid transparent;
      border-radius: var(--radius-control);
      background: var(--surface-tonal);
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-weight: 500;
      line-height: var(--lh-ui);
      cursor: pointer;
      transition:
        background-color var(--ui-transition) var(--ease-ui),
        transform var(--press-transition) var(--ease-ui);
    }
    .provenance-actions button:active:not(:focus-visible) {
      transform: scale(var(--press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      .provenance-actions button:hover {
        background: var(--surface-tonal-hover);
      }
    }
    @media (pointer: coarse) {
      .provenance-actions button {
        min-height: 44px;
      }
    }
    .provenance-methods {
      margin: var(--space-4) 0 0;
    }
    .provenance-methods + .provenance-use {
      margin-top: var(--space-2);
    }
    .provenance-use {
      margin: var(--space-4) 0 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      color: var(--text-secondary);
    }
    /* dialogs.css:289-294 */
    @media (max-width: 800px), (max-height: 480px) and (orientation: landscape) {
      .provenance-facts {
        grid-template-columns: minmax(0, 1fr);
      }
      .provenance-facts dt {
        padding: calc(var(--space-2) - 1px) 0 0;
        border: 0;
      }
      .provenance-facts dd {
        padding: 0 0 var(--space-2);
      }
    }
  }
</style>
