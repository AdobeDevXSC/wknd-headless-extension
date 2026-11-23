/*
 * Adobe I/O Runtime web action: a read-only CORS proxy for AEM Publish persisted queries.
 *
 * Browser -> https://<namespace>.adobeioruntime.net/api/v1/web/aem-proxy/proxy/graphql/execute.json/<config>/<query>
 *         -> ${AEM_HOST}/graphql/execute.json/<config>/<query>
 *
 * The app picks the AEM host (aemHost, https://*.adobeaemcloud.com only) and sends a Bearer Authorization header.
 * The legacy aemToken query parameter remains supported for older clients.
 * Only GET/HEAD/OPTIONS for /graphql/execute.json/ paths are forwarded, and only
 * HTTPS GitHub Pages, loopback previews, and ALLOWED_ORIGINS get CORS headers.
 */
const ALLOWED_PREFIX = '/graphql/execute.json/';

function isDemoOrigin(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;
  if (url.protocol === 'https:' && /^[a-z0-9-]+\.github\.io$/i.test(url.hostname)) return true;
  return ['http:', 'https:'].includes(url.protocol) &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

function corsHeaders(origin, allowed) {
  if (!origin || (!allowed.includes(origin) && !isDemoOrigin(origin))) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

async function main(params) {
  const allowed = (params.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  const headers = params.__ow_headers || {};
  const method = (params.__ow_method || 'get').toUpperCase();
  const cors = corsHeaders(headers.origin, allowed);
  if (method === 'OPTIONS') return { statusCode: 204, headers: cors };

  // Routing parameters are removed before forwarding; new clients send tokens only in headers.
  const query = new URLSearchParams(params.__ow_query || '');
  const hostParam = query.get('aemHost');
  const token = query.get('aemToken');
  const authorization = headers.authorization || headers.Authorization;
  query.delete('aemHost');
  query.delete('aemToken');
  const forwardQuery = query.toString();
  let host = (params.AEM_HOST || '').replace(/\/+$/, '');
  if (hostParam) {
    let u;
    try { u = new URL(hostParam); } catch (e) { u = null; }
    if (!u || u.protocol !== 'https:' || !/\.adobeaemcloud\.com$/i.test(u.hostname)) {
      return { statusCode: 403, headers: corsHeaders(headers.origin, allowed), body: { error: 'AEM host not allowed' } };
    }
    host = u.origin;
  }
  if (!host) return { statusCode: 500, headers: cors, body: { error: 'AEM_HOST is not configured' } };
  if (method !== 'GET' && method !== 'HEAD') {
    return { statusCode: 405, headers: cors, body: { error: 'Method not allowed' } };
  }

  const path = params.__ow_path || '';
  if (!path.startsWith(ALLOWED_PREFIX) || path.includes('..')) {
    return { statusCode: 403, headers: cors, body: { error: 'Path not allowed' } };
  }

  // The gateway decodes %3B/%3D, but AEM only parses persisted-query parameters reliably when
  // they stay percent-encoded (a raw ';slug=..' that is not the first parameter is ignored).
  const [queryName, ...vars] = path.split(';');
  const encodedPath = queryName + vars.map((v) => {
    const i = v.indexOf('=');
    return i < 0 ? `%3B${encodeURIComponent(v)}` : `%3B${encodeURIComponent(v.slice(0, i))}%3D${encodeURIComponent(v.slice(i + 1))}`;
  }).join('');
  const url = host + encodedPath + (forwardQuery ? `?${forwardQuery}` : '');
  try {
    const upstreamHeaders = { Accept: 'application/json' };
    if (authorization) upstreamHeaders.Authorization = authorization;
    else if (token) upstreamHeaders.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { method, headers: upstreamHeaders });
    const out = { ...cors, 'Content-Type': res.headers.get('content-type') || 'application/json' };
    const text = method === 'HEAD' ? '' : await res.text();
    // Content is live: never let the gateway, CDN or browser cache any response
    out['Cache-Control'] = 'no-store';
    return { statusCode: res.status, headers: out, body: text };
  } catch (e) {
    return { statusCode: 502, headers: cors, body: { error: 'Upstream request failed' } };
  }
}

exports.main = main;
