/** Mails feedback sent from planumatlas.com to the owner, through Cloudflare Email Routing. */

interface Mail {
  from: { email: string; name: string };
  to: string;
  subject: string;
  text: string;
}

export interface Env {
  EMAIL: { send(mail: Mail): Promise<{ messageId: string }> };
}

const ORIGIN = 'https://planumatlas.com';
const FROM = 'feedback@planumatlas.com';
const TO = 'joshua.duquette.1@ulaval.ca';
const CORS = { 'Access-Control-Allow-Origin': ORIGIN, Vary: 'Origin' };

interface Feedback {
  name: string;
  message: string;
  view: string;
}

function parse(body: unknown): Feedback | null {
  if (typeof body !== 'object' || body === null) return null;
  const { name, message, view } = body as Record<string, unknown>;
  if (typeof name !== 'string' || typeof message !== 'string' || typeof view !== 'string') {
    return null;
  }
  const feedback = {
    name: name.replace(/\s+/g, ' ').trim(),
    message: message.trim(),
    view,
  };
  const fits = feedback.name.length <= 200 && feedback.message.length <= 10_000;
  const fromPlanum = view.length <= 8_000 && view.startsWith(`${ORIGIN}/`);
  return feedback.message && fits && fromPlanum ? feedback : null;
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
    const feedback = parse(await request.json().catch(() => null));
    if (!feedback) return new Response(null, { status: 400, headers: CORS });

    // A failed send throws, so Cloudflare logs it and the form offers the address instead.
    await env.EMAIL.send({
      from: { email: FROM, name: 'Planum' },
      to: TO,
      subject: feedback.name ? `Planum feedback from ${feedback.name}` : 'Planum feedback',
      text: `${feedback.message}\n\n${feedback.name || 'No name given'}\nView: ${feedback.view}\n`,
    });
    return new Response(null, { status: 204, headers: CORS });
  },
};
