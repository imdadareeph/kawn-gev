import { describe, expect, it } from 'vitest';
import { clampRoute, normalizeOsrm, parsePoint } from '../shared/route.mjs';
import { straightRoute } from '../src/route';
import { PARKING_LOTS, cityOfPoint, levelOf, occupancyAt } from '../src/data/parking-sample';

describe('route input', () => {
  it('parses and rejects points strictly', () => {
    expect(parsePoint('25.2048,55.2708')).toEqual({ lat: 25.2048, lng: 55.2708 });
    expect(parsePoint('95,10')).toBeNull();
    expect(parsePoint('a,b')).toBeNull();
    expect(parsePoint('1,2,3')).toBeNull();
  });
  it('keeps trips inside one region and rounds coordinates', () => {
    expect(clampRoute('25.2,55.27', '25.1,55.14')).toEqual({ from: { lat: 25.2, lng: 55.27 }, to: { lat: 25.1, lng: 55.14 } });
    expect(clampRoute('25.2,55.27', '51.5,-0.12')).toBeNull();
  });
  it('normalises an OSRM reply and refuses junk', () => {
    const ok = { code: 'Ok', routes: [{ distance: 1200, duration: 300, geometry: { coordinates: [[55.1, 25.1], [55.2, 25.2]] } }] };
    expect(normalizeOsrm(ok)).toEqual({ distanceM: 1200, durationS: 300, path: [[55.1, 25.1], [55.2, 25.2]] });
    expect(normalizeOsrm({ code: 'NoRoute', routes: [] })).toBeNull();
    expect(normalizeOsrm({ code: 'Ok', routes: [{ distance: 'x', duration: 1, geometry: { coordinates: [[1, 2], [3, 4]] } }] })).toBeNull();
  });
  it('falls back to a labelled straight line', () => {
    const r = straightRoute({ lat: 25.2, lng: 55.27 }, { lat: 25.21, lng: 55.28 });
    expect(r.straight).toBe(true);
    expect(r.path).toHaveLength(2);
    expect(r.distanceM).toBeGreaterThan(1000);
  });
});

describe('parking sample', () => {
  const noon = Date.UTC(2026, 9, 26, 9, 0);
  it('covers Dubai and London with unique ids', () => {
    expect(new Set(PARKING_LOTS.map((l) => l.id)).size).toBe(PARKING_LOTS.length);
    expect(PARKING_LOTS.filter((l) => l.city === 'dubai').length).toBeGreaterThanOrEqual(200);
    expect(PARKING_LOTS.filter((l) => l.city === 'london').length).toBeGreaterThanOrEqual(20);
    for (const l of PARKING_LOTS) expect(cityOfPoint(l.lat, l.lng)).toBe(l.city);
  });
  it('is deterministic and bounded', () => {
    for (const lot of PARKING_LOTS) {
      const a = occupancyAt(lot, noon);
      expect(a).toEqual(occupancyAt(lot, noon));
      expect(a.free).toBeGreaterThanOrEqual(0);
      expect(a.free).toBeLessThanOrEqual(lot.capacity);
      expect(['plenty', 'few', 'full']).toContain(levelOf(a, lot));
    }
  });
  it('changes over the day', () => {
    const lot = PARKING_LOTS[0];
    const night = occupancyAt(lot, Date.UTC(2026, 9, 26, 22, 0)).pct;
    const evening = occupancyAt(lot, Date.UTC(2026, 9, 26, 16, 0)).pct;
    expect(evening).not.toBe(night);
  });
  it('recognises the two start cities', () => {
    expect(cityOfPoint(25.2, 55.27)).toBe('dubai');
    expect(cityOfPoint(51.5, -0.12)).toBe('london');
    expect(cityOfPoint(0, 0)).toBeNull();
  });
});

import { parseZone, tariffNow } from '../src/data/parking-zones';

describe('paid parking zones', () => {
  // Wednesday 2026-10-28, local Dubai time = UTC + 4
  const at = (h: number, day = 28) => Date.UTC(2026, 9, day, h - 4, 0);
  it('parses premium zones', () => {
    expect(parseZone('AP')?.premium).toBe(true);
    expect(parseZone('C')?.premium).toBe(false);
    expect(parseZone('Z')).toBeNull();
  });
  it('charges peak and off-peak rates from the published table', () => {
    expect(tariffNow('A', at(9)).aed).toBe(4);
    expect(tariffNow('AP', at(9)).aed).toBe(6);
    expect(tariffNow('AP', at(12)).aed).toBe(4);
    expect(tariffNow('C', at(12)).aed).toBe(2);
    expect(tariffNow('B', at(12)).aed).toBe(3);
    expect(tariffNow('D', at(17)).band).toBe('peak');
    expect(tariffNow('E', at(12)).aed).toBe(10);
  });
  it('is free at night and on Sundays, except multi-storey', () => {
    expect(tariffNow('A', at(23)).paidNow).toBe(false);
    expect(tariffNow('A', at(7)).paidNow).toBe(false);
    expect(tariffNow('A', at(12, 25)).paidNow).toBe(false); // Sunday 25 Oct 2026
    expect(tariffNow('B', at(23), true).paidNow).toBe(true);
  });
  it('gives every paid Dubai lot a known zone and every free lot none', () => {
    for (const l of PARKING_LOTS) {
      if (l.city !== 'dubai') continue;
      if (l.fee === 'paid') expect(parseZone(l.zone)).not.toBeNull();
      else expect(l.zone).toBeUndefined();
    }
    expect(PARKING_LOTS.some((l) => l.fee === 'free')).toBe(true);
    expect(PARKING_LOTS.some((l) => l.fee === 'paid')).toBe(true);
  });
});

import { parkingCard } from '../src/ui/cards';

describe('parking card', () => {
  it('shows fee, zone and rate for a paid Dubai lot and no rate for a free one', () => {
    const paid = PARKING_LOTS.find((l) => l.fee === 'paid' && l.zone === 'AP');
    const free = PARKING_LOTS.find((l) => l.fee === 'free' && l.city === 'dubai');
    expect(paid && free).toBeTruthy();
    const a = parkingCard(paid!, occupancyAt(paid!, Date.UTC(2026, 9, 28, 5, 0)), null, false, true, Date.UTC(2026, 9, 28, 5, 0));
    expect(a).toContain('Paid');
    expect(a).toContain('AP (premium)');
    expect(a).toContain('6 AED per hour');
    const b = parkingCard(free!, occupancyAt(free!, Date.UTC(2026, 9, 28, 5, 0)), null, false, true);
    expect(b).toContain('Free');
    expect(b).not.toContain('Zone');
  });
});
