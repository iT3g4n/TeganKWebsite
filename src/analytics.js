/** @typedef {{ UMAMI_ORIGIN?: string }} AnalyticsEnv */
/** @typedef {(input: string, init?: RequestInit) => Promise<Response>} Fetch */

export const SCRIPT_PATH = '/pv.js';
export const COLLECT_PATH = '/pv';
export const MAX_BODY_BYTES = 16 * 1024;
export const WEBSITE_ID = 'b4a73059-653b-478a-a644-65446019fca2';

const FORWARDED_HEADERS = Object.freeze(['user-agent', 'x-umami-cache', 'x-umami-website-id', 'x-umami-hostname']);

/** @param {string} pathname @returns {boolean} */
export function isAnalyticsPath(pathname) {
  return pathname === SCRIPT_PATH || pathname === COLLECT_PATH;
}

/** @param {AnalyticsEnv} env @returns {string | null} */
function upstreamOrigin(env) {
  try {
    const url = new URL(env.UMAMI_ORIGIN ?? '');
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/** @param {number} status @param {string} message @param {HeadersInit} [headers] */
function plain(status, message, headers = {}) {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

/** Only a 2xx reply of the expected type is relayed, since error pages can name the upstream host. */
function isUsable(upstream, type) {
  return upstream.ok && (upstream.headers.get('content-type') ?? '').includes(type);
}

/** @param {Request} request @returns {Promise<string | null>} null once the body passes MAX_BODY_BYTES */
async function readCapped(request) {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    size += next.value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(next.value);
  }
  return new Blob(chunks).text();
}

/** @param {Request} request @param {string} origin @param {Fetch} fetchImpl */
async function proxyScript(request, origin, fetchImpl) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return plain(405, 'Method not allowed', { allow: 'GET, HEAD' });
  }
  const upstream = await fetchImpl(origin + SCRIPT_PATH, {
    method: 'GET',
    redirect: 'manual',
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!isUsable(upstream, 'javascript')) {
    console.error(`Analytics script upstream returned ${upstream.status}`);
    return plain(502, 'Analytics unavailable');
  }
  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'public, max-age=86400',
      'x-content-type-options': 'nosniff',
    },
  });
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses a tracker event for this site, or returns null. Other website IDs are refused so
 * the relay can't be used to probe which sites share the upstream. */
function parseEvent(raw) {
  try {
    const event = JSON.parse(raw);
    const valid = isPlainObject(event) && typeof event.type === 'string' && isPlainObject(event.payload);
    return valid && event.payload.website === WEBSITE_ID ? event : null;
  } catch {
    return null;
  }
}

/** Swaps any client-supplied IP for the one Cloudflare saw, since Umami trusts payload.ip. */
function withClientIp(event, clientIp) {
  const { ip: _untrusted, ...payload } = event.payload;
  return { ...event, payload: clientIp ? { ...payload, ip: clientIp } : payload };
}

/** @param {Request} request */
function forwardedHeaders(request) {
  const entries = FORWARDED_HEADERS.flatMap((name) => {
    const value = request.headers.get(name);
    return value === null ? [] : [[name, value]];
  });
  return Object.fromEntries([...entries, ['content-type', 'application/json']]);
}

/** @param {Request} request @param {string} origin @param {Fetch} fetchImpl */
async function proxyEvent(request, origin, fetchImpl) {
  if (request.method !== 'POST') {
    return plain(405, 'Method not allowed', { allow: 'POST' });
  }
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
    return plain(413, 'Event too large');
  }
  const raw = await readCapped(request);
  if (raw === null) {
    return plain(413, 'Event too large');
  }
  const event = parseEvent(raw);
  if (!event) {
    return plain(400, 'Malformed event');
  }

  const upstream = await fetchImpl(origin + COLLECT_PATH, {
    method: 'POST',
    redirect: 'manual',
    headers: forwardedHeaders(request),
    body: JSON.stringify(withClientIp(event, request.headers.get('cf-connecting-ip'))),
  });
  if (!isUsable(upstream, 'application/json')) {
    console.error(`Analytics collect upstream returned ${upstream.status}`);
    return plain(502, 'Analytics unavailable');
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

/** Relays the Umami tracker and its events through this site, keeping the upstream host out of the page.
 * @param {Request} request @param {AnalyticsEnv} env @param {Fetch} [fetchImpl] @returns {Promise<Response>} */
export async function handleAnalytics(request, env, fetchImpl = fetch) {
  const origin = upstreamOrigin(env);
  if (!origin) {
    console.error('UMAMI_ORIGIN secret is missing or not an https URL');
    return plain(503, 'Analytics unavailable');
  }
  const { pathname } = new URL(request.url);
  try {
    return pathname === SCRIPT_PATH
      ? await proxyScript(request, origin, fetchImpl)
      : await proxyEvent(request, origin, fetchImpl);
  } catch (error) {
    console.error(`Analytics relay failed for ${pathname}:`, error);
    return plain(502, 'Analytics unavailable');
  }
}
