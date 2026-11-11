<!--
  "About this data" (supervisor review 1.4): what a tab or dock tool shows, where its data come from, and
  its main caution, then its methods page. The one disclosure, closed by default. In a tab it closes the
  list as Tracts' does; in a stage popover it takes the row its methods link took.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { MethodsPage } from '../../lib/core/methods.ts';
  import type { Language } from '../../lib/types/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import MethodsLink from '../deficits/MethodsLink.svelte';

  let {
    place,
    lang,
    host,
    children,
  }: {
    place: MethodsPage;
    lang: Language;
    host: 'list' | 'popover';
    /** What the place says of itself beyond the three parts, before its methods link (Tracts' notes). */
    children?: Snippet;
  } = $props();

  const copy = $derived(t(lang, 'info'));
  const entry = $derived(copy[place]);
</script>

<div class="about-data" data-host={host} data-about={place}>
  <Disclosure summary={copy.about} variant="section">
    <dl class="about-parts">
      <dt>{copy.shows}</dt>
      <dd>{entry.shows}</dd>
      <dt>{copy.source}</dt>
      <dd>{entry.source}</dd>
      <dt>{copy.caution}</dt>
      <dd>{entry.caution}</dd>
    </dl>
    {@render children?.()}
    <p class="about-methods"><MethodsLink page={place} {lang} /></p>
  </Disclosure>
</div>

<style>
  @layer features {
    .about-data :global(details) {
      margin-top: 0;
    }
    .about-data :global(summary) {
      min-height: var(--row-height);
      font-weight: 500;
    }
    /* A tab's list ends with it, ruled off on the text column, as Tracts' settings and notes are. */
    .about-data[data-host='list'] {
      margin: var(--space-6) var(--panel-inset) 0;
      padding-block: var(--space-1) var(--space-4);
      border-top: 1px solid var(--border-subtle);
    }
    /* In a popover it stands where the methods link stood, under the tool's own controls. */
    .about-data[data-host='popover'] {
      margin-top: var(--space-2);
    }
    .about-parts {
      display: grid;
      gap: var(--space-1);
      margin: 0;
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .about-parts dt {
      color: var(--text-primary);
      font-weight: 600;
    }
    .about-parts dt:not(:first-child) {
      margin-top: var(--space-2);
    }
    .about-parts dd {
      margin: 0;
      color: var(--text-secondary);
      text-wrap: pretty;
    }
    .about-methods {
      margin-top: var(--space-3);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
  }
</style>
