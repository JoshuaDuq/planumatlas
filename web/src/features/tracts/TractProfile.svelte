<!--
  A tract's profile (supervisor review 4.3), the Tracts tab's detail: its name, how many streamlines
  this tracking run has on each side or segment and, once drawn, their lengths; the cortical regions
  its ends reach; MRI with tracts; how the ends were counted, last. Data first, method after.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { TractEnds } from '../../lib/core/diffusion/ends.ts';
  import { grouped, percent, withUnit, decimal } from '../../lib/core/format.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { bundleName, isWhole, lengthSummary, tractRowName } from '../../lib/core/tracts.ts';
  import type { TractRow } from '../../lib/core/tracts.ts';
  import type { Engine, TractBundle as LoadedBundle } from '../../lib/engine/api.ts';
  import type { Language } from '../../lib/types/index.ts';

  let {
    row,
    ends,
    lang,
    tracts,
    label,
    onOpenMri,
  }: {
    row: TractRow;
    ends: TractEnds;
    lang: Language;
    tracts: Pick<Engine['tracts'], 'snapshot'>;
    label: (id: string) => { name: string };
    /** Absent where the tracts are another subject's, which this brain's MRI cannot draw. */
    onOpenMri?: (event: MouseEvent) => void;
  } = $props();

  const text = $derived(t(lang, 'diffusion'));
  const sides = $derived(t(lang, 'sides'));
  const name = $derived(tractRowName(row, lang));
  // The part each member is: its side, its segment's name, or the whole callosum.
  const part = (member: TractRow['members'][number]) =>
    row.sided
      ? sides.capitalized[member.part as 'left' | 'right']
      : isWhole(row)
        ? text.whole
        : bundleName(member.bundle, lang);
  let snapshot = $state.raw<LoadedBundle[]>(untrack(() => tracts.snapshot()));
  /** The engine is not reactive: the owner calls this when what is drawn changes. */
  export function refresh() {
    snapshot = tracts.snapshot();
  }
  const drawn = $derived(new Map(snapshot.filter((b) => b.visible).map((b) => [b.catalogId, b])));
  const floor = $derived(percent(ends.minimum_share, lang));

  let heading = $state<HTMLElement>();
  export function focusHeading() {
    heading?.focus();
  }
</script>

<div class="tract-profile" data-tract={row.key}>
  <h2 class="tract-name" tabindex="-1" bind:this={heading}>{name}</h2>
  <ul class="runs">
    {#each row.members as member (member.bundle.id)}
      {@const count = ends.bundles[member.bundle.id]!.ends / 2}
      {@const metrics = drawn.get(member.bundle.id)}
      <li>
        {text.profileRun(
          part(member),
          text.streamlines(count, count),
        )}{#if metrics}{' · '}{lengthSummary(metrics, text, lang)}{/if}
      </li>
    {/each}
  </ul>
  <section class="ends">
    <h3>{text.endsHeading}</h3>
    {#each row.members as member (member.bundle.id)}
      {@const regions = ends.bundles[member.bundle.id]!.regions}
      {#if row.members.length > 1}<h4>{part(member)}</h4>{/if}
      {#if regions.length}
        <ul class="end-list">
          {#each regions as [region, share] (region)}
            <li>
              <span class="end-name">{label(region).name}</span>
              <span class="end-share">{percent(share, lang)}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="note">{text.endsNone(floor)}</p>
      {/if}
    {/each}
  </section>
  {#if onOpenMri}
    <button type="button" class="primary" onclick={onOpenMri}>{text.mriOpen}</button>
  {/if}
  <p class="note method">
    {text.endsNote(withUnit(decimal(ends.radius_mm, 0, lang), 'mm', lang), floor)}
  </p>
</div>

<style>
  @layer features {
    .tract-profile {
      padding: var(--panel-inset);
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
    }
    .tract-name {
      font-size: var(--text-headline);
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: var(--lh-title);
      overflow-wrap: anywhere;
      text-wrap: pretty;
    }
    .runs,
    .end-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .runs {
      margin-top: var(--space-2);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .ends {
      margin-top: var(--space-6);
    }
    .ends h3 {
      margin-bottom: var(--space-2);
      font-size: var(--text-ui);
      font-weight: 600;
    }
    .ends h4 {
      margin: var(--space-3) 0 var(--space-1);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
    }
    .end-list {
      border-top: 1px solid var(--border-subtle);
    }
    .end-list li {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
      min-height: var(--row-height);
      padding: var(--space-1) 0;
      border-bottom: 1px solid var(--border-subtle);
    }
    .end-name {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .end-share {
      flex: none;
      font-size: var(--text-caption);
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }
    .primary {
      margin-top: var(--space-6);
      min-height: var(--control-height);
      padding: 0 var(--space-3);
      border-radius: var(--radius-control);
      background: var(--primary-fill);
      color: var(--primary-ink);
      font-weight: 500;
    }
    @media (hover: hover) and (pointer: fine) {
      .primary:hover {
        background: var(--primary-fill-hover);
      }
    }
    .note {
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .method {
      margin-top: var(--space-4);
    }
  }
</style>
