// Run from the repository root: node --test 'workers/feedback/**/*.test.ts'
import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker, { type Env } from './index.ts';

const VIEW = 'https://planumatlas.com/#atlas=hcp-mmp&lang=en';

const IP = '203.0.113.7';

function relay() {
  const sent: unknown[] = [];
  const keys: string[] = [];
  const env: Env = {
    EMAIL: {
      send: async (mail) => {
        sent.push(mail);
        return { messageId: 'id' };
      },
    },
    LIMIT: {
      limit: async ({ key }) => {
        keys.push(key);
        return { success: true };
      },
    },
  };
  return { env, sent, keys };
}

function post(
  body: BodyInit,
  origin = 'https://planumatlas.com',
  headers: Record<string, string> = {},
) {
  return new Request('https://feedback.planumatlas.com', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'cf-connecting-ip': IP,
      ...headers,
    },
    body,
    duplex: 'half',
  } as RequestInit);
}

test('mails the feedback, name and view from planumatlas.com to the owner', async () => {
  const { env, sent } = relay();
  const body = JSON.stringify({
    name: ' Ada\nLovelace ',
    message: ' The cut is lovely. ',
    view: VIEW,
  });
  const response = await worker.fetch(post(body), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://planumatlas.com');
  assert.deepEqual(sent, [
    {
      from: { email: 'feedback@planumatlas.com', name: 'Planum' },
      to: 'joshua.duquette.1@ulaval.ca',
      subject: 'Planum feedback from Ada Lovelace',
      text: `The cut is lovely.\n\nAda Lovelace\nView: ${VIEW}\n`,
    },
  ]);
});

test('lets the browser post JSON from planumatlas.com', async () => {
  const preflight = new Request('https://feedback.planumatlas.com', {
    method: 'OPTIONS',
    headers: { Origin: 'https://planumatlas.com' },
  });
  const response = await worker.fetch(preflight, relay().env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST');
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
});

test('mails nothing for another site or a request that is not feedback from Planum', async () => {
  const cases: [Request, number][] = [
    [post(JSON.stringify({ name: '', message: 'Hi', view: VIEW }), 'https://example.com'), 403],
    [post('not json'), 400],
    [post(JSON.stringify({ name: '', message: '  ', view: VIEW })), 400],
    [
      post(
        JSON.stringify({
          name: '',
          message: 'Hi',
          view: 'https://example.com/',
        }),
      ),
      400,
    ],
    [post(JSON.stringify({ name: '', message: 'x'.repeat(10_001), view: VIEW })), 400],
    [post(JSON.stringify({ message: 'Hi', view: VIEW })), 400],
    [post('null'), 400],
    [post('"Hi"'), 400],
    [post('[]'), 400],
  ];
  for (const [request, status] of cases) {
    const { env, sent } = relay();
    assert.equal((await worker.fetch(request, env)).status, status);
    assert.deepEqual(sent, []);
  }
});

test('turns away every method but POST', async () => {
  const { env, sent } = relay();
  const request = new Request('https://feedback.planumatlas.com', {
    method: 'GET',
    headers: { Origin: 'https://planumatlas.com' },
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'POST, OPTIONS');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://planumatlas.com');
  assert.deepEqual(sent, []);
});

test('mails nothing for a view that is not a plain planumatlas.com link', async () => {
  const views = [
    `${VIEW}\nBcc: someone@example.com`,
    `${VIEW}\u0000`,
    'https://planumatlas.com\t/',
    'https://planumatlas.com@example.com/',
    'https://planumatlas.com.example.com/',
    'http://planumatlas.com/',
    'planumatlas.com/',
  ];
  for (const view of views) {
    const { env, sent } = relay();
    const response = await worker.fetch(
      post(JSON.stringify({ name: '', message: 'Hi', view })),
      env,
    );
    assert.equal(response.status, 400, view);
    assert.deepEqual(sent, []);
  }
});

test('refuses a body over 48 KB, whether or not Content-Length says so', async () => {
  const big = JSON.stringify({ name: '', message: 'x'.repeat(48 * 1024), view: VIEW });
  const unread = new ReadableStream(
    { pull: () => assert.fail('read a body its Content-Length already refused') },
    { highWaterMark: 0 },
  );
  const chunked = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(big));
      controller.close();
    },
  });
  for (const request of [post(unread, undefined, { 'Content-Length': '1000000' }), post(chunked)]) {
    const { env, sent } = relay();
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 413);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://planumatlas.com');
    assert.deepEqual(sent, []);
  }
});

test('mails the longest feedback the form allows, in any script', async () => {
  const { env, sent } = relay();
  const view = VIEW.padEnd(8_000, 'x');
  const body = JSON.stringify({ name: '名'.repeat(200), message: '脳'.repeat(10_000), view });
  const response = await worker.fetch(post(body), env);
  assert.equal(response.status, 204);
  assert.equal(sent.length, 1);
});

test('mails nothing once an address has sent its share for the minute', async () => {
  const { env, sent, keys } = relay();
  env.LIMIT.limit = async ({ key }) => {
    keys.push(key);
    return { success: false };
  };
  const response = await worker.fetch(
    post(JSON.stringify({ name: '', message: 'Hi', view: VIEW })),
    env,
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://planumatlas.com');
  assert.deepEqual(keys, [IP]);
  assert.deepEqual(sent, []);
});

test('says the relay failed, readably by the form, when Email Routing refuses the mail', async (t) => {
  const { env } = relay();
  const refusal = new Error('destination address not verified');
  env.EMAIL.send = async () => {
    throw refusal;
  };
  const logged = t.mock.method(console, 'error', () => {});
  const response = await worker.fetch(
    post(JSON.stringify({ name: '', message: 'Hi', view: VIEW })),
    env,
  );
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://planumatlas.com');
  assert.deepEqual(
    logged.mock.calls.map((call) => call.arguments),
    [[refusal]],
  );
});
