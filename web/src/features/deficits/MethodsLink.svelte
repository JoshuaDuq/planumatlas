<!-- "Method and limits": the English methods page that documents a tool or feature. -->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import { methodsHref, type MethodsPage } from '../../lib/core/methods.ts';
  import type { Language } from '../../lib/types/index.ts';
  import ExternalLink from './ExternalLink.svelte';

  let { page, lang }: { page: MethodsPage; lang: Language } = $props();
</script>

<ExternalLink href={methodsHref(page)} {lang} hreflang="en"
  >{t(lang, 'link').methodsPage}</ExternalLink
>
