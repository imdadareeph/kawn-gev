// Small key-broker style API: bounded inputs, fixed upstream hosts, caching, coalescing,
// per-IP throttling, sanitised errors. No credentials are needed today; any future secret
// (traffic, transit) stays here and never reaches the browser.
import { readFileSync } from 'node:fs';
import { clampQuery, normalizeAdsb } from '../shared/flights.mjs';
import { clampRoute, normalizeOsrm } from '../shared/route.mjs';
import { clampWorldQuery, creditTtlMs, parseStates, thin } from '../shared/world-flights.mjs';
import { DENSE_GROUP, MAX_DENSE, MAX_SATELLITES, attachOwners, mergeGroups, normalizeOmm, SAT_GROUPS } from '../shared/satellites.mjs';

const brand = JSON.parse(readFileSync(new URL('../brand.json', import.meta.url), 'utf8'));
const ENV = brand.slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_');

const UPSTREAM = 'https://api.adsb.lol/v2/point';
// Public OSRM demo server (OpenStreetMap data, ODbL). Light use only; point this at your own router for real traffic.
const ROUTER = process.env[`${ENV}_ROUTER_URL`] ?? 'https://router.project-osrm.org';
const routeCache = new Map();
const TTL_MS = 8_000;
const STALE_OK_MS = 120_000;
const TIMEOUT_MS = 8_000;
const MAX_BYTES = 8 * 1024 * 1024;
const RATE_PER_MIN = Number.parseInt(process.env[`${ENV}_RATE_PER_MIN`] ?? '90', 10);

const cache = new Map();
const inflight = new Map();
const hits = new Map();

const extraHosts = new Set(
  (process.env[`${ENV}_ALLOWED_HOSTS`] ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h && !h.includes('*')),
);
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

// ---- Worldwide aircraft (OpenSky) ----
// One shared global snapshot serves every browser tab, so credits are spent per refresh, not per viewer. The client secret is
// read here, used only for the token request, and never logged, returned or sent to the browser.
const OPENSKY_STATES = 'https://opensky-network.org/api/states/all';
const OPENSKY_TOKEN = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const OPENSKY_STALE_MS = 10 * 60 * 1000;
let skyCache = null; // { at, aircraft, observedAt, remaining }
let skyInflight = null;
let skyCooldownUntil = 0;
let skyToken = { value: null, exp: 0 };
let skyTokenInflight = null;
let skyAuthWarned = false;

function openskyCredentials() {
  const id = process.env[`${ENV}_OPENSKY_CLIENT_ID`];
  const secret = process.env[`${ENV}_OPENSKY_CLIENT_SECRET`];
  if (id && secret) return { id, secret };
  try {
    const file = process.env[`${ENV}_OPENSKY_CREDENTIALS`] ?? new URL('../credentials.json', import.meta.url);
    const j = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof j.clientId === 'string' && typeof j.clientSecret === 'string' && j.clientId && j.clientSecret) return { id: j.clientId, secret: j.clientSecret };
  } catch {
    /* no credentials file: anonymous access, which has a much smaller daily allowance */
  }
  return null;
}

async function openskyToken() {
  if (skyToken.value && Date.now() < skyToken.exp - 60_000) return skyToken.value;
  const creds = openskyCredentials();
  if (!creds) return null;
  skyTokenInflight ??= (async () => {
    try {
      const res = await fetch(OPENSKY_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'error',
        body: `grant_type=client_credentials&client_id=${encodeURIComponent(creds.id)}&client_secret=${encodeURIComponent(creds.secret)}`,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.access_token !== 'string') {
        if (!skyAuthWarned) console.warn(`[opensky] sign-in failed (HTTP ${res.status}); check the client id in credentials.json matches the OpenSky dashboard. Using anonymous access.`);
        skyAuthWarned = true;
        skyToken = { value: null, exp: 0 };
        return null;
      }
      skyAuthWarned = false;
      const ttl = Number.isFinite(Number(data.expires_in)) ? Number(data.expires_in) : 1800;
      skyToken = { value: data.access_token, exp: Date.now() + ttl * 1000 };
      return skyToken.value;
    } catch {
      return null;
    } finally {
      skyTokenInflight = null;
    }
  })();
  return skyTokenInflight;
}

async function refreshSky() {
  const token = await openskyToken();
  const res = await fetch(OPENSKY_STATES, {
    signal: AbortSignal.timeout(15_000),
    redirect: 'error',
    headers: { Accept: 'application/json', 'User-Agent': `${brand.slug}-app/0.1`, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const remaining = Number(res.headers.get('x-rate-limit-remaining'));
  if (res.status === 429) {
    const wait = Number(res.headers.get('x-rate-limit-retry-after-seconds'));
    skyCooldownUntil = Date.now() + Math.min(30 * 60_000, Math.max(30_000, (Number.isFinite(wait) ? wait : 120) * 1000));
    throw new Error('rate limited');
  }
  if (res.status === 401) skyToken = { value: null, exp: 0 };
  if (!res.ok) throw new Error(`opensky ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 40 * 1024 * 1024) throw new Error('too large');
  const json = JSON.parse(Buffer.from(buf).toString('utf8'));
  skyCache = {
    at: Date.now(),
    aircraft: parseStates(json),
    observedAt: Number.isFinite(Number(json.time)) ? Number(json.time) * 1000 : Date.now(),
    remaining: Number.isFinite(remaining) ? remaining : null,
    authed: !!token,
  };
  return skyCache;
}

async function getSky() {
  const ttl = creditTtlMs(skyCache?.remaining ?? NaN);
  if (skyCache && Date.now() - skyCache.at < ttl) return skyCache;
  if (Date.now() < skyCooldownUntil) {
    if (skyCache && Date.now() - skyCache.at < OPENSKY_STALE_MS) return { ...skyCache, stale: true };
    throw new Error('cooling down');
  }
  skyInflight ??= refreshSky().finally(() => (skyInflight = null));
  try {
    return await skyInflight;
  } catch (e) {
    if (skyCache && Date.now() - skyCache.at < OPENSKY_STALE_MS) return { ...skyCache, stale: true };
    throw e;
  }
}

async function getWorld(query) {
  const snap = await getSky();
  const { aircraft, inView, cellDeg } = thin(snap.aircraft, query.box, query.max);
  return {
    source: 'OpenSky Network',
    observedAt: snap.observedAt,
    fetchedAt: snap.at,
    stale: !!snap.stale,
    signedIn: snap.authed,
    creditsLeft: snap.remaining,
    totalWorld: snap.aircraft.length,
    inView,
    cellDeg,
    // compact rows: [icao24, callsign, country, lat, lon, altM, speed m/s, track, vertical m/s, position time s]
    aircraft: aircraft.map((a) => [a.id, a.cs, a.ctry, a.lat, a.lon, a.alt, a.gs, a.trk, a.vr, a.t]),
  };
}

// CelesTrak asks for no more than one fetch per group every couple of hours, so cache hard and serve stale on failure.
const SAT_TTL_MS = 2 * 60 * 60 * 1000;
const SAT_STALE_MS = 24 * 60 * 60 * 1000;
const satCaches = { core: null, dense: null };
const satInflight = { core: null, dense: null };

async function fetchJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS * 2);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'error', headers: { 'User-Agent': `${brand.slug}-app/0.1`, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`celestrak ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error('too large');
    return JSON.parse(Buffer.from(buf).toString('utf8'));
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGroup(g) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS * 2);
  try {
    const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${g.path}&FORMAT=json`, {
      signal: ctrl.signal,
      redirect: 'error',
      headers: { 'User-Agent': `${brand.slug}-app/0.1`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`celestrak ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error('too large');
    const omms = normalizeOmm(JSON.parse(Buffer.from(buf).toString('utf8')), g === DENSE_GROUP ? MAX_DENSE : MAX_SATELLITES, g.tag);
    // Owning country comes from the SATCAT; if that request fails the orbit data is still returned.
    if (g !== DENSE_GROUP) {
      try {
        attachOwners(omms, await fetchJson(`https://celestrak.org/satcat/records.php?GROUP=${g.path}&FORMAT=json`));
      } catch {
        /* owners stay unknown */
      }
    }
    return omms;
  } finally {
    clearTimeout(timer);
  }
}

async function loadSatellites(kind) {
  let sats;
  if (kind === 'dense') {
    sats = await fetchGroup(DENSE_GROUP);
  } else {
    // A group that fails is skipped, so one bad upstream group does not hide the rest.
    const lists = (await Promise.allSettled(SAT_GROUPS.map(fetchGroup))).map((r) => (r.status === 'fulfilled' ? r.value : []));
    sats = mergeGroups(lists);
  }
  if (!sats.length) throw new Error('no satellites');
  return { source: 'CelesTrak', fetchedAt: Date.now(), satellites: sats };
}

async function getSatellites(kind) {
  const cached = satCaches[kind];
  if (cached && Date.now() - cached.fetchedAt < SAT_TTL_MS) return cached;
  satInflight[kind] ??= loadSatellites(kind)
    .then((v) => (satCaches[kind] = v))
    .finally(() => (satInflight[kind] = null));
  try {
    return await satInflight[kind];
  } catch (e) {
    if (cached && Date.now() - cached.fetchedAt < SAT_STALE_MS) return { ...cached, stale: true };
    throw e;
  }
}

export function hostAllowed(hostHeader) {
  if (!hostHeader) return false;
  const name = hostHeader.toLowerCase().replace(/:\d+$/, '');
  return LOOPBACK.has(name) || extraHosts.has(name);
}

function send(res, status, body, extra = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': status === 200 ? 'public, max-age=5' : 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  });
  res.end(text);
}

function rateLimited(ip) {
  if (!RATE_PER_MIN || RATE_PER_MIN <= 0) return false;
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > 60_000) {
    hits.set(ip, { start: now, count: 1 });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_PER_MIN;
}

async function fetchUpstream(q) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${UPSTREAM}/${q.lat}/${q.lon}/${q.r}`, {
      signal: ctrl.signal,
      redirect: 'error',
      headers: { 'User-Agent': `${brand.slug}-app/0.1`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error('upstream too large');
    const json = JSON.parse(Buffer.from(buf).toString('utf8'));
    const fetchedAt = Date.now();
    const { aircraft, excludedMilitary, upstreamNow } = normalizeAdsb(json, fetchedAt);
    return {
      source: 'adsb.lol',
      license: 'ODbL 1.0',
      fetchedAt,
      upstreamNow,
      count: aircraft.length,
      excludedMilitary,
      query: q,
      aircraft,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getFlights(q) {
  const key = `${q.lat},${q.lon},${q.r}`;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return { ...hit.body, state: 'live', cache: 'hit' };
  let p = inflight.get(key);
  if (!p) {
    p = fetchUpstream(q)
      .then((body) => {
        cache.set(key, { at: Date.now(), body });
        if (cache.size > 200) cache.delete(cache.keys().next().value);
        return body;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  try {
    const body = await p;
    return { ...body, state: 'live', cache: 'miss' };
  } catch (err) {
    if (hit && now - hit.at < STALE_OK_MS) return { ...hit.body, state: 'stale', cache: 'stale' };
    throw err;
  }
}

export async function getRoute(q) {
  const key = `${q.from.lat},${q.from.lng};${q.to.lat},${q.to.lng}`;
  const hit = routeCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return { ...hit.body, cache: 'hit' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = `${ROUTER}/route/v1/driving/${q.from.lng},${q.from.lat};${q.to.lng},${q.to.lat}?overview=full&geometries=geojson&alternatives=false&steps=false`;
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'error', headers: { 'User-Agent': `${brand.slug}-app/0.1`, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`router ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error('router too large');
    const norm = normalizeOsrm(JSON.parse(Buffer.from(buf).toString('utf8')));
    if (!norm) throw new Error('no route');
    const body = { source: 'osrm', license: 'ODbL 1.0', fetchedAt: Date.now(), ...norm };
    routeCache.set(key, { at: Date.now(), body });
    if (routeCache.size > 300) routeCache.delete(routeCache.keys().next().value);
    return { ...body, cache: 'miss' };
  } finally {
    clearTimeout(timer);
  }
}

export async function handleApi(req, res) {
  if (!hostAllowed(req.headers.host)) return send(res, 403, { error: 'forbidden_host' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method_not_allowed' });
  const url = new URL(req.url ?? '/', 'http://local');
  const ip = req.socket.remoteAddress ?? 'unknown';
  if (rateLimited(ip)) return send(res, 429, { error: 'rate_limited' }, { 'Retry-After': '30' });

  if (url.pathname === '/api/health') {
    return send(res, 200, { ok: true, time: Date.now(), sources: ['adsb.lol', 'osrm', 'celestrak', 'opensky'] });
  }
  if (url.pathname === '/api/flights') {
    const q = clampQuery(url.searchParams.get('lat'), url.searchParams.get('lon'), url.searchParams.get('r') ?? '120');
    if (!q) return send(res, 400, { error: 'bad_query' });
    try {
      return send(res, 200, await getFlights(q));
    } catch {
      // Upstream details are never echoed to the client.
      return send(res, 502, { error: 'upstream_unavailable', state: 'unavailable' });
    }
  }
  if (url.pathname === '/api/flights/world') {
    const q = clampWorldQuery((k) => url.searchParams.get(k));
    if (!q) return send(res, 400, { error: 'bad_query' });
    try {
      return send(res, 200, await getWorld(q), { 'Cache-Control': 'public, max-age=5' });
    } catch {
      return send(res, 502, { error: 'upstream_unavailable', state: 'unavailable' });
    }
  }
  if (url.pathname === '/api/satellites') {
    try {
      return send(res, 200, await getSatellites(url.searchParams.get('set') === 'dense' ? 'dense' : 'core'), { 'Cache-Control': 'public, max-age=600' });
    } catch {
      return send(res, 502, { error: 'upstream_unavailable', state: 'unavailable' });
    }
  }
  if (url.pathname === '/api/map-config') {
    // A Cesium ion token is meant for browsers, but use one limited to your site and read-only assets.
    return send(res, 200, { ionToken: process.env[`${ENV}_CESIUM_ION_TOKEN`] ?? '' }, { 'Cache-Control': 'no-store' });
  }
  if (url.pathname === '/api/route') {
    const q = clampRoute(url.searchParams.get('from'), url.searchParams.get('to'));
    if (!q) return send(res, 400, { error: 'bad_query' });
    try {
      return send(res, 200, await getRoute(q));
    } catch {
      return send(res, 502, { error: 'router_unavailable' });
    }
  }
  return send(res, 404, { error: 'not_found' });
}

export function createApiMiddleware() {
  return (req, res, next) => {
    if (!req.url || !req.url.startsWith('/api/')) return next();
    handleApi(req, res).catch(() => send(res, 500, { error: 'internal' }));
  };
}
