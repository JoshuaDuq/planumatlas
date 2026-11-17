// COLO-10 and COLO-11: what the form sends to the feedback Worker, and how each way a send can fail
// is told apart. The form's words for each are FeedbackForm.svelte.test.ts's.
import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import {
  EMAIL,
  FeedbackError,
  MAX_EMAIL,
  RELAY,
  TIMEOUT_MS,
  isEmail,
  sendFeedback,
} from './feedback.ts';

const FEEDBACK = { name: '', message: 'Hi', view: 'https://planumatlas.com/' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** What sendFeedback rejected with, given what fetch did. */
async function failure(fetch: () => Promise<Response>, online = true): Promise<FeedbackError> {
  vi.stubGlobal('fetch', vi.fn(fetch));
  vi.stubGlobal('navigator', { onLine: online });
  const error = await sendFeedback(FEEDBACK).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(FeedbackError);
  return error as FeedbackError;
}

test('posts the feedback once as JSON to the relay, under a 15 s timeout', async () => {
  const fetch = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);
  const timeout = vi.spyOn(AbortSignal, 'timeout');
  await sendFeedback({ ...FEEDBACK, email: 'ada@example.org' });
  expect(fetch).toHaveBeenCalledOnce();
  const [url, init] = fetch.mock.calls[0]! as unknown as [string, RequestInit];
  expect(url).toBe(RELAY);
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body as string)).toEqual({ ...FEEDBACK, email: 'ada@example.org' });
  expect(TIMEOUT_MS).toBe(15_000);
  expect(timeout).toHaveBeenCalledExactlyOnceWith(TIMEOUT_MS);
  expect(init.signal).toBe(timeout.mock.results[0]!.value);
});

test.each([
  [400, 'invalid'],
  [413, 'tooLarge'],
  [429, 'rateLimited'],
  [502, 'relay'],
  [500, 'relay'],
  [503, 'relay'],
] as const)('a %i is told as %s, and not sent again', async (status, reason) => {
  const error = await failure(async () => new Response(null, { status }));
  expect([error.reason, error.retryAfter]).toEqual([reason, null]);
  expect(fetch).toHaveBeenCalledOnce();
});

test.each([
  ['60', 60],
  ['1', 1],
  [null, null],
  ['0', null],
  ['soon', null],
  ['Wed, 21 Oct 2026 07:28:00 GMT', null],
] as const)('a 429 with Retry-After %s waits %s seconds', async (header, seconds) => {
  const headers: Record<string, string> = header === null ? {} : { 'Retry-After': header };
  const error = await failure(async () => new Response(null, { status: 429, headers }));
  expect([error.reason, error.retryAfter]).toEqual(['rateLimited', seconds]);
});

test('no answer in time is a timeout', async () => {
  const error = await failure(async () => {
    throw new DOMException('signal timed out', 'TimeoutError');
  });
  expect(error.reason).toBe('timeout');
  expect(error.cause).toBeInstanceOf(DOMException);
});

test('a relay that cannot be reached is a network failure, or offline when the device is', async () => {
  const unreachable = async () => {
    throw new TypeError('Failed to fetch');
  };
  expect((await failure(unreachable, true)).reason).toBe('network');
  expect((await failure(unreachable, false)).reason).toBe('offline');
});

test('anything else is a fault, thrown as it is', async () => {
  const fault = new RangeError('not a fetch failure');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw fault;
    }),
  );
  await expect(sendFeedback(FEEDBACK)).rejects.toBe(fault);
});

test('takes a reply address the Worker takes, and no other', () => {
  for (const address of [
    'ada@example.org',
    'ada.lovelace+planum@example.org',
    "o'brien@example.co.uk",
    'ada@localhost',
    `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`,
  ]) {
    expect(isEmail(address), address).toBe(true);
  }
  for (const address of [
    '',
    'ada',
    'ada@',
    'ada@@example.org',
    'ada lovelace@example.org',
    'ada@example.org ',
    'Ada <ada@example.org>',
    'ada@example.org, someone@example.com',
    'ada@example.org\r\nBcc: someone@example.com',
    'adà@example.org',
    `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`,
  ]) {
    expect(isEmail(address), address).toBe(false);
  }
});

test('holds a reply address to the Worker’s own pattern and length', () => {
  const worker = readFileSync(
    new URL('../../../../workers/feedback/src/index.ts', import.meta.url),
    'utf8',
  );
  expect(worker).toContain(`const MAX_EMAIL = ${MAX_EMAIL};`);
  expect(worker).toContain(`/${EMAIL.source}/;`);
});
