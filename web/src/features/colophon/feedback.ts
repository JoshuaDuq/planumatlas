import type { en } from '../../lib/core/i18n/areas/footer.ts';

/**
 * Planum is a static site, so a Cloudflare Worker of its own (workers/feedback) mails each message
 * on to the maintainer's address (CONTACT_ADDRESS).
 */
export const RELAY = 'https://feedback.planumatlas.com';

/**
 * How long a send may take before the reader is told. The largest body the form allows (about
 * 40 KB of three-byte text) crosses a 50 kbit/s link in under 7 s; the rest is room for the
 * connection, the preflight and Email Routing, which answers in well under a second.
 */
export const TIMEOUT_MS = 15_000;

// The Worker's limits on a reply address (workers/feedback/src/index.ts): RFC 5321's longest path,
// and the HTML standard's valid e-mail address. One @, and nothing that could end the Reply-To
// header or add a second address to it.
export const MAX_EMAIL = 254;
export const EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** Whether the Worker takes `text` as a reply address. */
export const isEmail = (text: string): boolean => text.length <= MAX_EMAIL && EMAIL.test(text);

export interface Feedback {
  name: string;
  /** Where a reply can go, set as the mail's Reply-To; absent when the reader gave none. */
  email?: string;
  message: string;
  /** The link to the view on screen, so the report can be opened as it was seen. */
  view: string;
}

/** Why a send failed, as the footer copy words it. */
export type FeedbackFailure = keyof typeof en.feedbackFailed;

/** A send that did not go through: what the relay answered, or why it could not answer. */
export class FeedbackError extends Error {
  readonly reason: FeedbackFailure;
  /** Seconds the relay asked to wait (`Retry-After`) before sending again; rate-limited only. */
  readonly retryAfter: number | null;

  constructor(
    reason: FeedbackFailure,
    message: string,
    { retryAfter = null, cause }: { retryAfter?: number | null; cause?: unknown } = {},
  ) {
    super(message, { cause });
    this.name = 'FeedbackError';
    this.reason = reason;
    this.retryAfter = retryAfter;
  }
}

const REFUSALS: Partial<Record<number, FeedbackFailure>> = {
  400: 'invalid',
  413: 'tooLarge',
  429: 'rateLimited',
};

/**
 * Mails the feedback on, once: a failure is the reader's to retry. Rejects with a FeedbackError
 * for each way it can fail; anything else is a fault here, thrown as it is.
 */
export async function sendFeedback(feedback: Feedback): Promise<void> {
  let response: Response;
  try {
    response = await fetch(RELAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedback),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new FeedbackError('timeout', `No answer within ${TIMEOUT_MS} ms`, { cause: error });
    }
    // fetch's one other rejection: no connection, or an answer the browser would not read.
    if (error instanceof TypeError) {
      const reason = navigator.onLine ? 'network' : 'offline';
      throw new FeedbackError(reason, 'The relay could not be reached', { cause: error });
    }
    throw error;
  }
  if (response.ok) return;
  // Every other status (502 for a send Email Routing refused) is the relay's own failure.
  const reason = REFUSALS[response.status] ?? 'relay';
  throw new FeedbackError(reason, `Feedback not accepted (${response.status})`, {
    retryAfter: reason === 'rateLimited' ? retryAfter(response) : null,
  });
}

/** `Retry-After` in whole seconds, or null when the relay gave none (before it sent one). */
function retryAfter(response: Response): number | null {
  const value = response.headers.get('Retry-After');
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}
