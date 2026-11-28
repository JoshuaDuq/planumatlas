<!--
  What a profile says under its heading and meta line (clinical.js:267-295). Mounted once per open
  deficit, so the evidence the reader opened survives a language change and does not carry over to
  another deficit.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import { networkCss } from '../../lib/core/catalog/networks.ts';
  import type { ClinicalDeficit } from '../../lib/core/clinical/types.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language, Rgb } from '../../lib/types/index.ts';
  import Association from './Association.svelte';
  import type { DeficitsExplorer } from './explorer.svelte.ts';
  import LinkRow from '../../lib/ui/LinkRow.svelte';
  import { focusHeading } from '../../lib/ui/focus.ts';
  import MethodsLink from '../info/MethodsLink.svelte';

  let {
    explorer,
    deficit,
    lang,
    side,
    colours,
    selectedFinding,
  }: {
    explorer: DeficitsExplorer;
    deficit: ClinicalDeficit;
    lang: Language;
    /** The one side every finding shares, said under the heading; null when they differ. */
    side: string | null;
    colours: ReadonlyMap<string, Rgb>;
    selectedFinding: string | null;
  } = $props();

  const clinical = $derived(explorer.deps.clinical);
  const anatomy = $derived(explorer.deps.anatomy);
  const text = $derived(t(lang, 'clinical'));
  const found = $derived(clinical.forDeficit(deficit.id));
  const maps = $derived(explorer.checkedMaps(deficit.id, lang));

  let expanded = $state<Record<string, boolean>>({});
  let findingsSection: HTMLElement;
  let findingsHeading: HTMLHeadingElement;

  async function clearFinding() {
    if (explorer.opening || !selectedFinding) return;
    const previous = findingsSection.querySelector<HTMLButtonElement>(
      `[data-association="${CSS.escape(selectedFinding)}"] .finding-pick`,
    );
    explorer.deps.excursions.pickPaint(null);
    await tick();
    if (previous?.checkVisibility()) previous.focus();
    else if (findingsHeading?.checkVisibility()) focusHeading(findingsHeading);
  }
</script>

<p class="kind">{text.evidenceKind(found.length)}</p>
<p class="summary">{deficit.summary[lang]}</p>
<section class="section" bind:this={findingsSection}>
  <div class="findings-heading">
    <h3 class="section-heading" bind:this={findingsHeading} tabindex="-1">{text.associations}</h3>
    {#if selectedFinding}
      <button
        type="button"
        class="all-findings"
        aria-disabled={explorer.opening || undefined}
        onclick={clearFinding}
      >
        {t(lang, 'deficitKey').allFindings}
      </button>
    {/if}
  </div>
  {#each found as association (association.id)}
    <Association
      {association}
      {lang}
      color={colours.get(association.id)!}
      sideOnRow={!side}
      bind:open={
        () => expanded[association.id] ?? false, (open) => (expanded[association.id] = open)
      }
      opening={explorer.opening}
      pressed={association.id === selectedFinding}
      {clinical}
      {anatomy}
      onselect={found.length > 1
        ? () =>
            explorer.deps.excursions.pickPaint(
              selectedFinding === association.id ? null : association.id,
            )
        : undefined}
      onregion={(id, trigger) => explorer.openRegion(id, trigger)}
    />
  {/each}
</section>
{#if maps.length}
  <section class="section">
    <h3 class="section-heading">{text.checkedMaps}</h3>
    <ul>
      {#each maps as map (map.id)}
        <li>
          <LinkRow
            name={map.name}
            colour={networkCss(map.color)}
            onclick={() => explorer.openFunction(map.id)}
          />
        </li>
      {/each}
    </ul>
  </section>
{/if}
<div class="profile-notes">
  <p class="note caveat">{text.referenceOnly}</p>
  <p class="note sources">{text.sources} · {text.revised}: {clinical.revised}</p>
  <p class="note methods"><MethodsLink page="deficits" {lang} /></p>
</div>

<style>
  @layer features {
    p,
    ul {
      margin: 0;
    }
    .kind {
      margin-top: var(--space-4);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .summary {
      margin-top: var(--space-2);
      text-wrap: pretty;
    }
    .note {
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .profile-notes {
      margin-top: var(--space-6);
      padding-top: var(--space-4);
      border-top: 1px solid var(--border-subtle);
    }
    .profile-notes > .note + .note {
      margin-top: var(--space-2);
    }
    .sources {
      color: var(--text-tertiary);
    }
    .section {
      margin-top: var(--space-6);
    }
    .section-heading {
      margin: 0 0 var(--space-2);
      font-size: var(--text-ui);
      font-weight: 600;
      line-height: var(--lh-ui);
      color: var(--text-primary);
    }
    .findings-heading {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-1) var(--space-2);
      margin-bottom: var(--space-2);
    }
    .findings-heading .section-heading {
      margin-bottom: 0;
    }
    .all-findings {
      min-height: 24px;
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;
    }
    .all-findings[aria-disabled='true'] {
      color: var(--text-tertiary);
      cursor: default;
    }
    @media (hover: hover) and (pointer: fine) {
      .all-findings:hover:not([aria-disabled='true']) {
        color: var(--accent-hover);
      }
    }
    @media (pointer: coarse) {
      .all-findings {
        min-height: 44px;
      }
    }
    ul {
      padding: 0;
      list-style: none;
    }
  }
</style>
