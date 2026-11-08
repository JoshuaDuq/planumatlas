/**
 * Where readers' feedback goes. Planum is a static site, so a Cloudflare Worker of its own
 * (workers/feedback) mails each message on to this address.
 */
export const FEEDBACK_ADDRESS = 'joshua.duquette.1@ulaval.ca';
const RELAY = 'https://feedback.planumatlas.com';

export interface Feedback {
  name: string;
  message: string;
  /** The link to the view on screen, so the report can be opened as it was seen. */
  view: string;
}

/** Mails the feedback on; rejects when the Worker does not accept it. */
export async function sendFeedback(feedback: Feedback): Promise<void> {
  const response = await fetch(RELAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feedback),
  });
  if (!response.ok) throw new Error(`Feedback not accepted (${response.status})`);
}
