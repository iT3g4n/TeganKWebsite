import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLLECT_PATH, MAX_BODY_BYTES, SCRIPT_PATH, WEBSITE_ID, handleAnalytics, isAnalyticsPath } from '../src/analytics.js';

const ENV = { UMAMI_ORIGIN: 'https://stats.example.com' };
const SITE = 'https://site.example';

function fakeFetch(response = new Response('ok')) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (response instanceof Error) throw response;
    return response;
  };
  return { calls, impl };
}

function js(body) {
  return new Response(body, { headers: { 'content-type': 'application/javascript; charset=UTF-8' } });
}

function eventRequest(body, headers = {}) {
  return new Request(SITE + COLLECT_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const EVENT = { type: 'event', payload: { website: WEBSITE_ID, url: '/' } };

test('the relay is pinned to the website ID the page uses', async () => {
  assert.equal(WEBSITE_ID, 'b4a73059-653b-478a-a644-65446019fca2');
});

test('events for any other Umami website never reach upstream', async () => {
  const others = [
    { ...EVENT, payload: { ...EVENT.payload, website: '00000000-0000-4000-8000-000000000000' } },
    { ...EVENT, payload: { url: '/', pixel: WEBSITE_ID } },
  ];
  for (const body of others) {
    const { calls, impl } = fakeFetch();
    const res = await handleAnalytics(eventRequest(body), ENV, impl);
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0);
  }
});

test('only the tracker script and collect paths are analytics routes', () => {
  assert.equal(isAnalyticsPath(SCRIPT_PATH), true);
  assert.equal(isAnalyticsPath(COLLECT_PATH), true);
  assert.equal(isAnalyticsPath('/'), false);
  assert.equal(isAnalyticsPath('/pv/x'), false);
  assert.equal(isAnalyticsPath('/pv.json'), false);
});

test('a missing or non-https upstream returns 503 without calling out', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const env of [{}, { UMAMI_ORIGIN: 'http://stats.example.com' }, { UMAMI_ORIGIN: 'not a url' }]) {
    const { calls, impl } = fakeFetch();
    const res = await handleAnalytics(new Request(SITE + SCRIPT_PATH), env, impl);
    assert.equal(res.status, 503);
    assert.equal(calls.length, 0);
  }
});

test('the tracker script is fetched from upstream and served as cacheable JS', async () => {
  const { calls, impl } = fakeFetch(js('tracker();'));
  const res = await handleAnalytics(new Request(SITE + SCRIPT_PATH), ENV, impl);
  assert.equal(calls[0].url, 'https://stats.example.com/pv.js');
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(calls[0].init.cf.cacheTtl, 3600);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/javascript/);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=86400');
  assert.equal(await res.text(), 'tracker();');
});

test('a script response that is not JavaScript is never served', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { impl } = fakeFetch(new Response('<h1>stats.example.com</h1>', { headers: { 'content-type': 'text/html' } }));
  const res = await handleAnalytics(new Request(SITE + SCRIPT_PATH), ENV, impl);
  assert.equal(res.status, 502);
  assert.doesNotMatch(await res.text(), /stats\.example\.com/);
});

test('the upstream origin keeps only its origin, dropping any path', async () => {
  const { calls, impl } = fakeFetch(js('tracker();'));
  await handleAnalytics(new Request(SITE + SCRIPT_PATH), { UMAMI_ORIGIN: 'https://stats.example.com/x/' }, impl);
  assert.equal(calls[0].url, 'https://stats.example.com/pv.js');
});

test('HEAD on the script returns headers without a body', async () => {
  const { impl } = fakeFetch(js('tracker();'));
  const res = await handleAnalytics(new Request(SITE + SCRIPT_PATH, { method: 'HEAD' }), ENV, impl);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '');
});

test('a failed script fetch returns 502', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { impl } = fakeFetch(new Response('nope', { status: 500 }));
  const res = await handleAnalytics(new Request(SITE + SCRIPT_PATH), ENV, impl);
  assert.equal(res.status, 502);
});

test('the script only answers GET and HEAD', async () => {
  const { calls, impl } = fakeFetch();
  const res = await handleAnalytics(new Request(SITE + SCRIPT_PATH, { method: 'POST' }), ENV, impl);
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET, HEAD');
  assert.equal(calls.length, 0);
});

test('events are relayed with the visitor IP written into the payload', async () => {
  const { calls, impl } = fakeFetch(Response.json({ cache: 'tok' }));
  const req = eventRequest(EVENT, {
    'cf-connecting-ip': '203.0.113.7',
    'user-agent': 'Mozilla/5.0 Test',
    'x-umami-cache': 'old',
    'x-umami-website-id': EVENT.payload.website,
    'x-umami-hostname': 'site.example',
    cookie: 'secret=1',
  });
  const res = await handleAnalytics(req, ENV, impl);

  assert.equal(calls[0].url, 'https://stats.example.com/pv');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.redirect, 'manual');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    type: 'event',
    payload: { ...EVENT.payload, ip: '203.0.113.7' },
  });
  const sent = new Headers(calls[0].init.headers);
  assert.equal(sent.get('user-agent'), 'Mozilla/5.0 Test');
  assert.equal(sent.get('x-umami-cache'), 'old');
  assert.equal(sent.get('x-umami-website-id'), EVENT.payload.website);
  assert.equal(sent.get('x-umami-hostname'), 'site.example');
  assert.equal(sent.get('content-type'), 'application/json');
  assert.equal(sent.get('cookie'), null);

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(await res.json(), { cache: 'tok' });
});

test('a client-supplied IP is never trusted', async () => {
  const spoofed = { ...EVENT, payload: { ...EVENT.payload, ip: '198.51.100.1' } };

  const withIp = fakeFetch(Response.json({}));
  await handleAnalytics(eventRequest(spoofed, { 'cf-connecting-ip': '203.0.113.7' }), ENV, withIp.impl);
  assert.equal(JSON.parse(withIp.calls[0].init.body).payload.ip, '203.0.113.7');

  const withoutIp = fakeFetch(Response.json({}));
  await handleAnalytics(eventRequest(spoofed), ENV, withoutIp.impl);
  assert.equal('ip' in JSON.parse(withoutIp.calls[0].init.body).payload, false);
});

test('upstream errors and non-JSON replies become a generic 502', async (t) => {
  t.mock.method(console, 'error', () => {});
  const replies = [
    Response.json({ error: 'stats.example.com' }, { status: 400 }),
    new Response('<h1>stats.example.com</h1>', { status: 522, headers: { 'content-type': 'text/html' } }),
    new Response('<h1>stats.example.com</h1>', { headers: { 'content-type': 'text/html' } }),
    new Response(null, { status: 302, headers: { location: 'https://stats.example.com/login' } }),
  ];
  for (const reply of replies) {
    const { impl } = fakeFetch(reply);
    const res = await handleAnalytics(eventRequest(EVENT), ENV, impl);
    assert.equal(res.status, 502);
    assert.equal(res.headers.get('location'), null);
    assert.doesNotMatch(await res.text(), /stats\.example\.com/);
  }
});

test('malformed events are rejected before reaching upstream', async () => {
  const bodies = ['{not json', '[]', '"text"', JSON.stringify({ type: 'event' }),
    JSON.stringify({ type: 'event', payload: [] }), JSON.stringify({ type: 1, payload: {} })];
  for (const body of bodies) {
    const { calls, impl } = fakeFetch();
    const res = await handleAnalytics(eventRequest(body), ENV, impl);
    assert.equal(res.status, 400, body);
    assert.equal(calls.length, 0);
  }
});

test('oversized events are rejected with 413', async () => {
  const { calls, impl } = fakeFetch();
  const big = { ...EVENT, payload: { ...EVENT.payload, title: 'x'.repeat(MAX_BODY_BYTES) } };
  const res = await handleAnalytics(eventRequest(big), ENV, impl);
  assert.equal(res.status, 413);
  assert.equal(calls.length, 0);
});

test('oversized streamed events are cut off without buffering them', async () => {
  const { calls, impl } = fakeFetch();
  const chunk = new TextEncoder().encode('x'.repeat(4096));
  let sent = 0;
  const body = new ReadableStream({
    pull(controller) {
      sent += 1;
      if (sent > 64) controller.close();
      else controller.enqueue(chunk);
    },
  });
  const req = new Request(SITE + COLLECT_PATH, { method: 'POST', body, duplex: 'half' });
  const res = await handleAnalytics(req, ENV, impl);
  assert.equal(res.status, 413);
  assert.ok(sent < 64, `read ${sent} chunks`);
  assert.equal(calls.length, 0);
});

test('the collect path only answers POST', async () => {
  const { calls, impl } = fakeFetch();
  const res = await handleAnalytics(new Request(SITE + COLLECT_PATH), ENV, impl);
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'POST');
  assert.equal(calls.length, 0);
});

test('an unreachable upstream returns 502 and is logged', async (t) => {
  const log = t.mock.method(console, 'error', () => {});
  const { impl } = fakeFetch(new Error('connect failed'));
  const res = await handleAnalytics(eventRequest(EVENT), ENV, impl);
  assert.equal(res.status, 502);
  assert.equal(log.mock.callCount(), 1);
});
