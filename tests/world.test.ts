import { afterEach, describe, expect, it, vi } from 'vitest';
import { clampWorldQuery, creditTtlMs, parseStates, thin } from '../shared/world-flights.mjs';
import { worldQuery } from '../src/layers/world-flights';
import brand from '../brand.json';

const ENV = brand.slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_');

const row = (id: string, lat: number, lon: number, extra: Partial<Record<number, unknown>> = {}) => {
  const r: unknown[] = [id, 'ABC123 ', 'Germany', 1700000000, 1700000001, lon, lat, 10000, false, 230, 90, 0, null, 10100, '1000', false, 0];
  for (const [k, v] of Object.entries(extra)) r[Number(k)] = v;
  return r;
};

describe('OpenSky parsing', () => {
  it('keeps airborne aircraft with valid positions and drops the rest', () => {
    const out = parseStates({ time: 1700000005, states: [row('4ca123', 50, 8), row('4ca124', 50, 8, { 8: true }), row('zzz', 50, 8), row('4ca125', 95, 8), row('4ca126', 50, 190), 'junk', row('4ca127', 10, 20, { 5: null })] });
    expect(out.map((a) => a.id)).toEqual(['4ca123']);
    expect(out[0]).toMatchObject({ cs: 'ABC123', ctry: 'Germany', alt: 10100, gs: 230, trk: 90, t: 1700000000 });
  });
  it('survives a body with no states', () => {
    expect(parseStates({})).toEqual([]);
    expect(parseStates(null)).toEqual([]);
  });
});

describe('thinning', () => {
  const grid = Array.from({ length: 4000 }, (_, i) => ({ id: i.toString(16).padStart(6, '0'), cs: '', ctry: '', lat: -60 + (i % 80) * 1.5, lon: -170 + Math.floor(i / 80) * 6.5, alt: 1, gs: 1, trk: 1, vr: 0, t: 1 }));
  it('returns everything when it already fits', () => {
    expect(thin(grid.slice(0, 100), null, 500).aircraft).toHaveLength(100);
  });
  it('thins evenly to the budget and is deterministic', () => {
    const a = thin(grid, null, 500);
    const b = thin(grid, null, 500);
    expect(a.aircraft.length).toBeLessThanOrEqual(500);
    expect(a.aircraft.length).toBeGreaterThan(100);
    expect(a.cellDeg).toBeGreaterThan(0);
    expect(a.aircraft.map((x) => x.id)).toEqual(b.aircraft.map((x) => x.id));
  });
  it('filters to the box before thinning', () => {
    const r = thin(grid, { lamin: 0, lomin: 0, lamax: 20, lomax: 40 }, 4000);
    expect(r.aircraft.every((a) => a.lat >= 0 && a.lat <= 20 && a.lon >= 0 && a.lon <= 40)).toBe(true);
    expect(r.inView).toBe(r.aircraft.length);
  });
});

describe('query and credit rules', () => {
  const q = (o: Record<string, string>) => clampWorldQuery((k) => o[k] ?? null);
  it('accepts a world query and a valid box', () => {
    expect(q({})).toEqual({ box: null, max: 1500 });
    expect(q({ lamin: '10', lomin: '20', lamax: '30', lomax: '60', max: '99999' })).toMatchObject({ max: 4000 });
  });
  it('rejects broken boxes', () => {
    expect(q({ lamin: '10' })).toBeNull();
    expect(q({ lamin: '40', lomin: '0', lamax: '30', lomax: '10' })).toBeNull();
    expect(q({ lamin: 'x', lomin: '0', lamax: '30', lomax: '10' })).toBeNull();
    expect(q({ lamin: '-95', lomin: '0', lamax: '30', lomax: '10' })).toBeNull();
  });
  it('slows polling as credits run low', () => {
    expect(creditTtlMs(3900)).toBe(30_000);
    expect(creditTtlMs(2000)).toBe(60_000);
    expect(creditTtlMs(800)).toBe(120_000);
    expect(creditTtlMs(100)).toBe(300_000);
    expect(creditTtlMs(Number.NaN)).toBe(30_000);
  });
  it('asks for the world when far out and a box when closer', () => {
    expect(worldQuery({ lng: 0, lat: 0, zoom: 1.5, diagKm: 20000 }).box).toBeNull();
    const near = worldQuery({ lng: 55, lat: 25, zoom: 5, diagKm: 1500 });
    expect(near.box).not.toBeNull();
    expect(near.box!.lamin).toBeLessThan(25);
    expect(near.box!.lamax).toBeGreaterThan(25);
  });
});

describe('server endpoint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    delete process.env[`${ENV}_OPENSKY_CLIENT_ID`];
    delete process.env[`${ENV}_OPENSKY_CLIENT_SECRET`];
  });
  it('signs in server-side, thins the answer and never leaks the secret', async () => {
    process.env[`${ENV}_OPENSKY_CLIENT_ID`] = 'test-client';
    process.env[`${ENV}_OPENSKY_CLIENT_SECRET`] = 'TOPSECRETVALUE';
    const calls: { url: string; auth: string | null; body: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      const h = new Headers(init.headers);
      calls.push({ url: String(url), auth: h.get('authorization'), body: String(init.body ?? '') });
      if (String(url).includes('openid-connect')) return new Response(JSON.stringify({ access_token: 'tok123', expires_in: 1800 }), { status: 200 });
      return new Response(JSON.stringify({ time: Math.floor(Date.now() / 1000), states: [row('4ca123', 50, 8), row('4ca124', 51, 9)] }), { status: 200, headers: { 'x-rate-limit-remaining': '3900' } });
    });
    const { handleApi } = await import('../server/api.mjs');
    const out: { status: number; body: string } = { status: 0, body: '' };
    const res = { writeHead: (s: number) => (out.status = s), end: (b: string) => (out.body = b) };
    await handleApi({ method: 'GET', url: '/api/flights/world?max=100', headers: { host: 'localhost:8787' }, socket: { remoteAddress: '127.0.0.1' } } as never, res as never);
    expect(out.status).toBe(200);
    const json = JSON.parse(out.body);
    expect(json).toMatchObject({ source: 'OpenSky Network', signedIn: true, creditsLeft: 3900, totalWorld: 2 });
    expect(json.aircraft[0][0]).toBe('4ca123');
    expect(out.body).not.toContain('TOPSECRETVALUE');
    expect(out.body).not.toContain('tok123');
    expect(calls.find((c) => c.url.includes('states/all'))?.auth).toBe('Bearer tok123');
    expect(calls.find((c) => c.url.includes('openid-connect'))?.body).toContain('client_id=test-client');
  });
  it('rejects a broken box without calling OpenSky', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const { handleApi } = await import('../server/api.mjs');
    const out = { status: 0 };
    await handleApi({ method: 'GET', url: '/api/flights/world?lamin=9', headers: { host: 'localhost' }, socket: { remoteAddress: '1.1.1.1' } } as never, { writeHead: (s: number) => (out.status = s), end: () => undefined } as never);
    expect(out.status).toBe(400);
    expect(f).not.toHaveBeenCalled();
  });
});
