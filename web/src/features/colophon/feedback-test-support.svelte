<!-- Fixture for the feedback form tests: the form with a draft of its own, as its owners hold one. Not shipped. -->
<script lang="ts">
  import type { Language } from '../../lib/types/index.ts';
  import FeedbackForm, { FeedbackDraft } from './FeedbackForm.svelte';

  let { lang }: { lang: Language } = $props();

  const draft = new FeedbackDraft();
</script>

<FeedbackForm {lang} {draft} />
