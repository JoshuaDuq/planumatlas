<!-- One always-visible line under a tab's task controls saying what the tab shows (supervisor review 1.4). -->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import type { Language } from '../../lib/types/index.ts';

  let {
    place,
    lang,
  }: { place: 'anatomy' | 'functions' | 'deficits' | 'circuits' | 'tracts'; lang: Language } =
    $props();
</script>

<p class="scope-line" data-scope={place}>{t(lang, 'info')[place].scope}</p>

<style>
  @layer features {
    .scope-line {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      text-wrap: pretty;
    }
  }
</style>
