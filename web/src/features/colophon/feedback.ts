import { t } from '../../lib/core/i18n/index.ts';
import type { Language } from '../../lib/types/index.ts';

/** Where readers report problems and ideas: the project's public issue tracker. */
const NEW_ISSUE = 'https://github.com/JoshuaDuq/planumatlas/issues/new';

/** A new issue, its body naming the view on screen so the report can be opened as it was seen. */
export function feedbackUrl(view: string, lang: Language): string {
  const url = new URL(NEW_ISSUE);
  url.searchParams.set('body', t(lang, 'footer').feedbackBody(view));
  return url.href;
}
