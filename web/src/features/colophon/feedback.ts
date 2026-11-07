/**
 * Where readers' feedback goes. Planum is a static site, so a form relay (FormSubmit) mails each
 * message on; the first one sent asks the owner, by email, to activate the form once.
 */
export const FEEDBACK_ADDRESS = 'joshua.duquette.1@ulaval.ca';
const RELAY = `https://formsubmit.co/ajax/${FEEDBACK_ADDRESS}`;

export interface Feedback {
  name: string;
  message: string;
  /** The link to the view on screen, so the report can be opened as it was seen. */
  view: string;
}

/** Mails the feedback on; rejects with the relay's own reason when it is not accepted. */
export async function sendFeedback(feedback: Feedback, subject: string): Promise<void> {
  const response = await fetch(RELAY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...feedback, _subject: subject, _template: 'table' }),
  });
  const reply = (await response.json()) as { success?: string | boolean; message?: string };
  if (!response.ok || String(reply.success) !== 'true') {
    throw new Error(`Feedback not accepted (${response.status}): ${reply.message ?? 'no reason'}`);
  }
}
