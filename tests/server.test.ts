import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApiMiddleware, hostAllowed } from '../server/api.mjs';

const upstream = {
  now: Date.now(),
  ac: [
    { hex: '7c6b2d', flight: 'UAE1', alt_baro: 30000, gs: 420, track: 90, lat: 25.3, lon: 55.4, seen_pos: 1 },
    { hex: 'ae1111', flight: 'MIL1', alt_baro: 20000, lat: 25.2, lon: 55.2, dbFlags: 1 },
  ],
};

let server: Server;
let base = '';
const calls: string[] = [];
const realFetch = globalThis.fetch;

beforeAll(async () => {
  vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith('https://api.adsb.lol/')) {
      calls.push(u);
      return new Response(JSON.stringify(upstream), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, init);
  });
  const mw = createApiMiddleware();
  server = createServer((req, res) => mw(req, res, () => res.writeHead(404).end('no')));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await new Promise((r) => server.close(r));
});

describe('api proxy', () => {
  it('accepts loopback hosts only by default', () => {
    expect(hostAllowed('localhost:5173')).toBe(true);
    expect(hostAllowed('127.0.0.1:8787')).toBe(true);
    expect(hostAllowed('evil.example')).toBe(false);
    expect(hostAllowed(undefined)).toBe(false);
  });

  it('rejects bad queries with a sanitised error', async () => {
    const res = await realFetch(`${base}/api/flights?lat=abc&lon=1`);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_query' });
  });

  it('returns normalised civil aircraft, hides military, and caches identical requests', async () => {
    const url = `${base}/api/flights?lat=25.26&lon=55.36&r=120`;
    const a = await (await realFetch(url)).json();
    const b = await (await realFetch(url)).json();
    expect(a.source).toBe('adsb.lol');
    expect(a.aircraft.map((x: { id: string }) => x.id)).toEqual(['7c6b2d']);
    expect(a.excludedMilitary).toBe(1);
    expect(b.cache).toBe('hit');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe('https://api.adsb.lol/v2/point/25.25/55.25/120');
  });

  it('answers unknown API paths with structured JSON, not the front end', async () => {
    const res = await realFetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('refuses non-GET methods', async () => {
    const res = await realFetch(`${base}/api/health`, { method: 'POST' });
    expect(res.status).toBe(405);
  });
});
