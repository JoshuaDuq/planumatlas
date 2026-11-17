// The feedback form in Chromium, over a mocked fetch (it never reaches the relay): the checks at the
// fields before a send (COLO-09), the reply address (COLO-10), the words for each way a send fails
// (COLO-11), focus on the thanks after a send (COLO-12), and axe. The popover and the phone dialog
// that hold it are StatusRegion's and MastheadRegion's.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { t } from '../../lib/core/i18n/index.ts';
import type { Language } from '../../lib/types/index.ts';
import { expectAxeClean } from '../../lib/ui/a11y-test-support.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import { FEEDBACK_ADDRESS, TIMEOUT_MS } from './feedback.ts';
import Fixture from './feedback-test-support.svelte';

const en = t('en', 'footer');
const fr = t('fr', 'footer');

let announcer: HTMLElement;
let detach: () => void;
beforeEach(() => {
  announcer = document.body.appendChild(document.createElement('div'));
  detach = attachAnnouncer(announcer);
});
afterEach(() => {
  cleanup();
  detach();
  announcer.remove();
  vi.restoreAllMocks();
});

const mount = (lang: Language = 'en') => render(Fixture, { lang });

const copy = (lang: Language) => (lang === 'fr' ? fr : en);
const field = (name: string) => page.getByRole('textbox', { name });
const send = (lang: Language = 'en') =>
  userEvent.click(page.getByRole('button', { name: copy(lang).feedbackSend }));
/** The failure paragraph's words, with the address that follows them. */
const failure = () =>
  document.querySelector('.feedback-failed')?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const sentBody = (fetch: { mock: { calls: unknown[][] } }) =>
  JSON.parse((fetch.mock.calls[0]![1] as RequestInit).body as string);
/** The ids an element's aria-describedby names, as their text. */
const described = (element: Element) =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)!.textContent);

describe('COLO-11 · each failure says what happened and what to do', () => {
  const reached =
    (status: number, headers: Record<string, string> = {}) =>
    async () =>
      new Response(null, { status, headers });
  const unreachable = async () => {
    throw new TypeError('Failed to fetch');
  };

  test.each([
    ['400', 'en', reached(400), en.feedbackFailed.invalid],
    ['413', 'en', reached(413), en.feedbackFailed.tooLarge],
    [
      '429 with Retry-After',
      'en',
      reached(429, { 'Retry-After': '60' }),
      en.feedbackFailed.rateLimited(60),
    ],
    ['429 without', 'en', reached(429), en.feedbackFailed.rateLimited(null)],
    ['502', 'en', reached(502), en.feedbackFailed.relay],
    ['a network error', 'en', unreachable, en.feedbackFailed.network],
    [
      '429 with Retry-After',
      'fr',
      reached(429, { 'Retry-After': '60' }),
      fr.feedbackFailed.rateLimited(60),
    ],
    ['a network error', 'fr', unreachable, fr.feedbackFailed.network],
  ] as const)('%s, in %s', async (_case, lang, answer, words) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(answer);
    mount(lang);
    await userEvent.fill(field(copy(lang).feedbackMessage), 'Hello');
    await send(lang);
    await expect.poll(failure).toBe(`${words} ${FEEDBACK_ADDRESS}`);
    expect(announcer.textContent).toBe(`${words} ${FEEDBACK_ADDRESS}`);
    // Said once, by the announcer, which says a repeat again; not also by an alert.
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0);
    await expect
      .element(
        page.getByRole('button', {
          name: `${FEEDBACK_ADDRESS}, ${t(lang, 'inspector').copyValue.copy}`,
        }),
      )
      .toBeVisible();
    // The message is kept to be sent again, by the reader: nothing is retried.
    expect((field(copy(lang).feedbackMessage).element() as HTMLTextAreaElement).value).toBe(
      'Hello',
    );
    expect(fetch).toHaveBeenCalledOnce();
    await expect.element(page.getByRole('button', { name: copy(lang).feedbackSend })).toBeVisible();
  });

  test('offline', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockImplementation(unreachable);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    mount();
    await userEvent.fill(field(en.feedbackMessage), 'Hello');
    await send();
    await expect.poll(failure).toBe(`${en.feedbackFailed.offline} ${FEEDBACK_ADDRESS}`);
  });

  test('no answer within the timeout', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // The browser's own timeout signal, shortened; the relay never answers.
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    const asked = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => timeout(20));
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason)),
        ),
    );
    mount();
    await userEvent.fill(field(en.feedbackMessage), 'Hello');
    await send();
    await expect.poll(failure).toBe(`${en.feedbackFailed.timeout} ${FEEDBACK_ADDRESS}`);
    expect(asked).toHaveBeenCalledExactlyOnceWith(TIMEOUT_MS);
  });

  test('the next send clears the failure, and a send that works says thanks', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    mount();
    await userEvent.fill(field(en.feedbackMessage), 'Hello');
    await send();
    await expect.poll(failure).toBe(`${en.feedbackFailed.relay} ${FEEDBACK_ADDRESS}`);
    await send();
    await expect
      .poll(() => document.querySelector('.feedback-said')?.textContent)
      .toBe(en.feedbackSent);
    expect(failure()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('COLO-09 · a message of spaces alone is refused at its field', () => {
  test('nothing is sent; the field is invalid, described by the error and focused', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    mount();
    const message = field(en.feedbackMessage);
    await userEvent.fill(message, '   \n\t  ');
    await send();
    expect(fetch).not.toHaveBeenCalled();
    await expect.element(message).toHaveAttribute('aria-invalid', 'true');
    expect(described(message.element())).toEqual([en.feedbackMessageEmpty]);
    expect(document.activeElement).toBe(message.element());
    // Editing the field takes the error away.
    await userEvent.type(message, 'Hi');
    await expect.element(message).toHaveAttribute('aria-invalid', 'false');
    expect(message.element().hasAttribute('aria-describedby')).toBe(false);
    expect(document.body.textContent).not.toContain(en.feedbackMessageEmpty);
  });

  test('an empty message too, in French', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    mount('fr');
    await send('fr');
    expect(fetch).not.toHaveBeenCalled();
    expect(described(field(fr.feedbackMessage).element())).toEqual([fr.feedbackMessageEmpty]);
  });

  test('the message is sent trimmed', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    mount();
    await userEvent.fill(field(en.feedbackMessage), '  The cut is lovely.\n ');
    await send();
    await expect.poll(() => fetch.mock.calls.length).toBe(1);
    expect(sentBody(fetch).message).toBe('The cut is lovely.');
  });
});

describe('COLO-10 · the reply address', () => {
  test('is an optional email field, held to the relay’s length, that says where it goes', async () => {
    mount();
    const email = field(en.feedbackEmail).element() as HTMLInputElement;
    expect([email.type, email.autocomplete, email.maxLength, email.required]).toEqual([
      'email',
      'email',
      254,
      false,
    ]);
    expect(described(email)).toEqual([en.feedbackEmailNote]);
    // Name, address, then the message, each in its label's order.
    const fields = [...document.querySelectorAll('input, textarea')].map((input) => input.id);
    expect(fields).toEqual([
      field(en.feedbackName).element().id,
      email.id,
      field(en.feedbackMessage).element().id,
    ]);
    // The note on the link to the view stays.
    expect(document.body.textContent).toContain(en.feedbackNote);
  });

  test('is sent trimmed when given', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    mount();
    await userEvent.fill(field(en.feedbackEmail), '  ada@example.org ');
    await userEvent.fill(field(en.feedbackMessage), 'Hello');
    await send();
    await expect.poll(() => fetch.mock.calls.length).toBe(1);
    expect(sentBody(fetch)).toMatchObject({ email: 'ada@example.org', message: 'Hello' });
  });

  test('is left out when blank', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    mount();
    await userEvent.fill(field(en.feedbackEmail), '   ');
    await userEvent.fill(field(en.feedbackMessage), 'Hello');
    await send();
    await expect.poll(() => fetch.mock.calls.length).toBe(1);
    expect(Object.keys(sentBody(fetch))).not.toContain('email');
  });

  test.each([
    ['en', 'ada@'],
    ['en', 'Ada <ada@example.org>'],
    ['en', 'ada@example.org, someone@example.com'],
    ['fr', 'adà@example.org'],
  ] as const)('refuses %s "%s" at its field, and sends nothing', async (lang, address) => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    mount(lang);
    const email = field(copy(lang).feedbackEmail);
    await userEvent.fill(email, address);
    await userEvent.fill(field(copy(lang).feedbackMessage), 'Hello');
    await send(lang);
    expect(fetch).not.toHaveBeenCalled();
    await expect.element(email).toHaveAttribute('aria-invalid', 'true');
    expect(described(email.element())).toEqual([
      copy(lang).feedbackEmailInvalid,
      copy(lang).feedbackEmailNote,
    ]);
    expect(document.activeElement).toBe(email.element());
  });
});

describe('COLO-12 · after a send focus moves to the thanks', () => {
  test('which replaces the form and is read', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    mount();
    await userEvent.fill(field(en.feedbackMessage), 'Hello');
    await send();
    await expect.poll(() => document.activeElement?.textContent).toBe(en.feedbackSent);
    expect(document.activeElement!.matches('p.feedback-said[tabindex="-1"]')).toBe(true);
    expect(document.querySelector('form')).toBeNull();
    // Focus reads it; the announcer does not say it a second time.
    expect(announcer.textContent).toBe('');
  });
});

describe('axe', () => {
  test('is clean with both field errors and a failure shown, in both themes and widths', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 429, headers: { 'Retry-After': '60' } }),
    );
    mount();
    await userEvent.fill(field(en.feedbackMessage), 'Hello');
    await send();
    await expect.poll(failure).not.toBeNull();
    await userEvent.fill(field(en.feedbackEmail), 'ada@');
    await userEvent.fill(field(en.feedbackMessage), ' ');
    await send();
    await expect.element(field(en.feedbackEmail)).toHaveAttribute('aria-invalid', 'true');
    await expect.element(field(en.feedbackMessage)).toHaveAttribute('aria-invalid', 'true');
    await expectAxeClean();
  });

  test('is clean on the thanks, in both themes and widths', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    mount('fr');
    await userEvent.fill(field(fr.feedbackMessage), 'Bonjour');
    await send('fr');
    await expect.poll(() => document.querySelector('.feedback-said')).not.toBeNull();
    await expectAxeClean();
  });
});
