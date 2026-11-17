/** Mails feedback sent from planumatlas.com to the owner, through Cloudflare Email Routing. */

interface Mail {
  from: { email: string; name: string };
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}

export interface Env {
  EMAIL: { send(mail: Mail): Promise<{ messageId: string }> };
  LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

const ORIGIN = 'https://planumatlas.com';
const FROM = 'feedback@planumatlas.com';
const TO = 'joshua.duquette.1@ulaval.ca';
const CORS = { 'Access-Control-Allow-Origin': ORIGIN, Vary: 'Origin' };
const MAX_NAME = 200;
const MAX_MESSAGE = 10_000;
const MAX_VIEW = 8_000;
// The longest path an address may have (RFC 5321, 4.5.3.1.3).
const MAX_EMAIL = 254;
// Room for the longest message the form allows in three-byte UTF-8, with the name, address and view.
const MAX_BODY = 48 * 1024;
const CONTROL = /[\u0000-\u001f\u007f]/;
// The HTML standard's valid e-mail address, what <input type="email"> accepts: one @ and no space,
// control character, quote, comma, semicolon or angle bracket, so it can neither end the Reply-To
// header nor add a second address to it. The form holds an address to the same pattern (feedback.ts).
const EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
// The rate limit's period in wrangler.jsonc: the longest a refused reader has to wait.
const RETRY_AFTER = '60';

interface Feedback {
  name: string;
  /** Where the owner's reply goes; absent when the reader gave none. */
  email?: string;
  message: string;
  view: string;
}

function parse(body: unknown): Feedback | null {
  if (typeof body !== 'object' || body === null) return null;
  const { name, email, message, view } = body as Record<string, unknown>;
  if (typeof name !== 'string' || typeof message !== 'string' || typeof view !== 'string') {
    return null;
  }
  // Absent, or an address as sent: never trimmed or repaired before it goes into a header.
  if (email !== undefined && (typeof email !== 'string' || !isEmail(email))) return null;
  const feedback = {
    name: name.replace(/\s+/g, ' ').trim(),
    ...(typeof email === 'string' && { email }),
    message: message.trim(),
    view,
  };
  const fits = feedback.name.length <= MAX_NAME && feedback.message.length <= MAX_MESSAGE;
  const fromPlanum =
    view.length <= MAX_VIEW &&
    !CONTROL.test(view) &&
    URL.canParse(view) &&
    new URL(view).origin === ORIGIN;
  return feedback.message && fits && fromPlanum ? feedback : null;
}

function isEmail(text: string): boolean {
  return text.length <= MAX_EMAIL && EMAIL.test(text);
}

/** The body as text, or null once it passes MAX_BODY bytes; Content-Length can be absent. */
async function readBody(request: Request): Promise<string | null> {
  if (!request.body) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request.body) {
    size += chunk.byteLength;
    if (size > MAX_BODY) return null;
    chunks.push(chunk);
  }
  return new Blob(chunks).text();
}

function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get('Origin') !== ORIGIN) return new Response(null, { status: 403 });
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...CORS,
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    if (request.method !== 'POST') {
      return new Response(null, {
        status: 405,
        headers: { ...CORS, Allow: 'POST, OPTIONS' },
      });
    }
    const ip = request.headers.get('cf-connecting-ip');
    if (!ip) throw new Error('Request without cf-connecting-ip');
    if (!(await env.LIMIT.limit({ key: ip })).success) {
      // Exposed, so the form can say how long to wait.
      return new Response(null, {
        status: 429,
        headers: {
          ...CORS,
          'Retry-After': RETRY_AFTER,
          'Access-Control-Expose-Headers': 'Retry-After',
        },
      });
    }
    if (Number(request.headers.get('Content-Length')) > MAX_BODY) {
      return new Response(null, { status: 413, headers: CORS });
    }
    const text = await readBody(request);
    if (text === null) return new Response(null, { status: 413, headers: CORS });
    const feedback = parse(json(text));
    if (!feedback) return new Response(null, { status: 400, headers: CORS });

    try {
      await env.EMAIL.send({
        from: { email: FROM, name: 'Planum' },
        to: TO,
        ...(feedback.email !== undefined && { replyTo: feedback.email }),
        subject: feedback.name ? `Planum feedback from ${feedback.name}` : 'Planum feedback',
        text: `${feedback.message}\n\n${feedback.name || 'No name given'}\n${feedback.email === undefined ? '' : `Reply to: ${feedback.email}\n`}View: ${feedback.view}\n`,
      });
    } catch (error) {
      // Logged for Workers observability; the form then offers the address instead.
      console.error(error);
      return new Response(null, { status: 502, headers: CORS });
    }
    return new Response(null, { status: 204, headers: CORS });
  },
};
