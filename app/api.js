// make.fun public API, GET only. Responses are cached in memory and revalidated
// with ETags: the API binds an ETag to the minute, so a re-request inside the
// same minute answers 304 and costs no fresh body. A short TTL keeps route
// changes from re-hitting the network at all.

export const API_ORIGIN = 'https://make.fun';
export const API_ROOT = `${API_ORIGIN}/api`;

// url -> { etag, body, fetchedAt }. In-flight requests are shared by key.
const cache = new Map();
const inflight = new Map();
const FRESH_MS = 45_000;

function cacheKey(path) {
  return path;
}

async function requestJson(path, { force = false } = {}) {
  const key = cacheKey(path);
  const hit = cache.get(key);
  if (hit && !force && Date.now() - hit.fetchedAt < FRESH_MS) return hit.body;
  if (inflight.has(key)) return inflight.get(key);

  const work = (async () => {
    const headers = { Accept: 'application/json' };
    if (hit?.etag) headers['If-None-Match'] = hit.etag;
    const res = await fetch(API_ROOT + path, { headers });
    if (res.status === 304 && hit) {
      hit.fetchedAt = Date.now();
      return hit.body;
    }
    if (!res.ok) {
      const err = new Error(`make.fun API ${res.status} for ${path}`);
      err.status = res.status;
      throw err;
    }
    const body = await res.json();
    cache.set(key, { etag: res.headers.get('etag'), body, fetchedAt: Date.now() });
    return body;
  })();

  inflight.set(key, work);
  try {
    return await work;
  } finally {
    inflight.delete(key);
  }
}

// The full bounty list. The endpoint answers { items, next_cursor } and
// pages with ?cursor=, so follow cursors until the list is whole (one page
// holds the current 44, but the list grows). One call powers the board; the
// same payload is reused for a bounty page's rewards fallback when the
// single fetch fails.
export async function listBounties() {
  const all = [];
  let cursor = null;
  let seen = new Set();
  for (let page = 0; page < 10; page += 1) {
    const path = cursor ? `/competitions?limit=100&cursor=${encodeURIComponent(cursor)}` : '/competitions?limit=100';
    const data = await requestJson(path);
    const items = Array.isArray(data) ? data : data.items ?? data.competitions ?? [];
    all.push(...items);
    const next = data?.next_cursor;
    if (!next || seen.has(next)) break;
    seen.add(next);
    cursor = next;
  }
  return all;
}

export async function getBounty(slug) {
  return requestJson(`/competitions/${encodeURIComponent(slug)}`);
}

export async function getLeaderboard(slug) {
  return requestJson(`/competitions/${encodeURIComponent(slug)}/leaderboard`);
}

export async function getProfile(handle) {
  return requestJson(`/profiles/${encodeURIComponent(handle)}`);
}

// Avatar paths come back relative ("/api/avatars/..."); make them absolute so
// the browser loads them from make.fun, with crossorigin="anonymous" on the img.
export function absoluteApiUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return API_ORIGIN + path;
}
