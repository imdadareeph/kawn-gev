import { describe, expect, it } from 'vitest';
import { clampQuery, normalizeAdsb } from '../shared/flights.mjs';
import { deadReckon } from '../src/layers/flights';

describe('flights query', () => {
  it('bounds the radius and snaps coordinates for caching', () => {
    expect(clampQuery('25.26', '55.36', '999')).toEqual({ lat: 25.25, lon: 55.25, r: 250 });
    expect(clampQuery('25.26', '55.36', '1')?.r).toBe(5);
    expect(clampQuery('25.27', '55.30', '100')).toEqual(clampQuery('25.26', '55.36', '100'));
  });
  it('rejects unusable input', () => {
    expect(clampQuery('x', '1', '1')).toBeNull();
    expect(clampQuery('95', '1', '10')).toBeNull();
    expect(clampQuery('10', '190', '10')).toBeNull();
  });
});

describe('aircraft normalisation', () => {
  const now = 1_800_000_000_000;
  const body = {
    now,
    ac: [
      { hex: '7c6b2d', flight: 'UAE123  ', r: 'A6-EDA', t: 'A388', alt_baro: 36000, gs: 480, track: 120, lat: 25.3, lon: 55.4, seen_pos: 2, squawk: '1234' },
      { hex: 'ae1234', flight: 'RCH001', alt_baro: 20000, lat: 25.1, lon: 55.1, dbFlags: 1 },
      { hex: '896abc', flight: 'GRND1', alt_baro: 'ground', gs: 3, lat: 25.25, lon: 55.36 },
      { hex: '896abd', flight: 'MAYDAY', alt_baro: 9000, lat: 25.2, lon: 55.2, squawk: '7700' },
      { hex: 'zzzz', lat: 1, lon: 1 },
      { hex: '896abe', lat: 'bad', lon: 2 },
    ],
  };
  const out = normalizeAdsb(body, now);

  it('keeps civil aircraft, drops military and malformed rows', () => {
    expect(out.aircraft.map((a) => a.id)).toEqual(['7c6b2d', '896abc', '896abd']);
    expect(out.excludedMilitary).toBe(1);
  });
  it('trims callsigns and converts the fix time from the upstream age', () => {
    const a = out.aircraft[0];
    expect(a.callsign).toBe('UAE123');
    expect(a.posTime).toBe(now - 2000);
  });
  it('handles ground traffic and emergency squawks without calling it an incident', () => {
    expect(out.aircraft[1]).toMatchObject({ onGround: true, altFt: 0 });
    expect(out.aircraft[2]).toMatchObject({ emergency: true, squawk: '7700' });
  });
});

describe('dead reckoning', () => {
  const base = {
    id: 'aaaaaa', callsign: 'X', reg: '', type: '', category: '', lat: 25, lon: 55, altFt: 30000, gsKt: 450,
    trackDeg: 90, vsFpm: 0, squawk: null, onGround: false, emergency: false, posTime: 1_000_000,
  };
  it('moves along the track while the fix is fresh', () => {
    const p = deadReckon(base, 1_000_000 + 10_000);
    expect(p.lng).toBeGreaterThan(55);
    expect(Math.abs(p.lat - 25)).toBeLessThan(1e-6);
    expect(p.coasted).toBe(true);
  });
  it('stops coasting after a short time so a dead feed cannot look alive', () => {
    const a = deadReckon(base, 1_000_000 + 45_000);
    const b = deadReckon(base, 1_000_000 + 300_000);
    expect(b.lng).toBeCloseTo(a.lng, 9);
    expect(b.ageSec).toBeGreaterThan(200);
  });
  it('does not move aircraft on the ground', () => {
    const p = deadReckon({ ...base, onGround: true }, 1_000_000 + 20_000);
    expect(p).toMatchObject({ lng: 55, lat: 25, coasted: false });
  });
});
