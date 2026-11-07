import { t } from '../../lib/core/i18n/index.ts';
import type { Language } from '../../lib/types/index.ts';

/** Where readers send problems and ideas: an address anyone can write to, with no account. */
const FEEDBACK_ADDRESS = 'joshua.duquette.1@ulaval.ca';

/** A new email, its body naming the view on screen so the report can be opened as it was seen. */
export function feedbackUrl(view: string, lang: Language): string {
  const copy = t(lang, 'footer');
  // Encoded by hand: `mailto:` reads `+` literally, so URLSearchParams' spaces would arrive as `+`.
  const subject = encodeURIComponent(copy.feedbackSubject);
  const body = encodeURIComponent(copy.feedbackBody(view));
  return `mailto:${FEEDBACK_ADDRESS}?subject=${subject}&body=${body}`;
}
