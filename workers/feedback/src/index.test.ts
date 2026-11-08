// Run from the repository root: node --test 'workers/feedback/**/*.test.ts'
import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker, { type Env } from './index.ts';

const VIEW = 'https://planumatlas.com/#atlas=hcp-mmp&lang=en';

function relay() {
  const sent: unknown[] = [];
  const env: Env = {
    EMAIL: {
      send: async (mail) => {
        sent.push(mail);
        return { messageId: 'id' };
      },
    },
  };
  return { env, sent };
}

function post(body: string, origin = 'https://planumatlas.com') {
  return new Request('https://feedback.planumatlas.com', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body,
  });
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
  ];
  for (const [request, status] of cases) {
    const { env, sent } = relay();
    assert.equal((await worker.fetch(request, env)).status, status);
    assert.deepEqual(sent, []);
  }
});
