import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const SITE = 'https://site.example';

test('analytics paths are handled by the Worker, not the asset store', async (t) => {
  t.mock.method(console, 'error', () => {});
  const assets = { fetch: t.mock.fn(async () => new Response('asset')) };
  const res = await worker.fetch(new Request(SITE + '/pv.js'), { ASSETS: assets });
  assert.equal(res.status, 503);
  assert.equal(assets.fetch.mock.callCount(), 0);
});

test('every other path falls through to static assets', async (t) => {
  const assets = { fetch: t.mock.fn(async () => new Response('asset')) };
  const req = new Request(SITE + '/css/base.css');
  const res = await worker.fetch(req, { ASSETS: assets });
  assert.equal(await res.text(), 'asset');
  assert.equal(assets.fetch.mock.calls[0].arguments[0], req);
});
