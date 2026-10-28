import { describe, expect, it } from 'vitest';
import { dictionaries } from '../src/i18n';
import { AIRPORTS, EMIRATES, LANDMARKS, regionOf, DEFAULT_CITY } from '../src/places';
import { defaultProfile, sanitizeProfile } from '../src/state';
import { ESTATE_SITES } from '../src/data/estate-sample';
import { buildGeoms, pointAt, vehiclesAt } from '../src/layers/transit';
import { TRANSIT_ROUTES } from '../src/data/transit-sample';
import { DEFAULT_VIEW } from '../src/map/defaults';

describe('owner decisions', () => {
  it('opens on Dubai, top-down, with Scope on and feather at 100', () => {
    expect(DEFAULT_CITY.id).toBe('dubai');
    expect(DEFAULT_VIEW.pitch).toBe(0);
    expect(Math.abs(DEFAULT_VIEW.lng - 55.271)).toBeLessThan(0.01);
    const p = defaultProfile('en-US');
    expect(p.scopeOn).toBe(true);
    expect(p.feather).toBe(100);
  });

  it('has all seven emirates with the agreed fly-to targets', () => {
    expect(EMIRATES.map((e) => e.id)).toEqual(['abudhabi', 'dubai', 'sharjah', 'ajman', 'uaq', 'rak', 'fujairah']);
    const dubai = EMIRATES.find((e) => e.id === 'dubai');
    expect([dubai?.lat, dubai?.lng]).toEqual([25.205, 55.271]);
  });

  it('has the Dubai, UAE and London airport groups with the agreed coordinates', () => {
    const by = (code: string) => AIRPORTS.find((a) => a.code === code);
    expect(AIRPORTS.filter((a) => a.group === 'dubaiAirports').map((a) => a.code)).toEqual(['DXB', 'DWC']);
    expect(AIRPORTS.filter((a) => a.group === 'uaeAirports').map((a) => a.code)).toEqual(['AUH', 'SHJ']);
    expect(AIRPORTS.filter((a) => a.group === 'londonAirports').map((a) => a.code)).toEqual(['LHR', 'LGW', 'STN', 'LCY', 'LTN']);
    expect([by('DXB')?.lat, by('DXB')?.lng]).toEqual([25.253, 55.364]);
    expect([by('LHR')?.lat, by('LHR')?.lng]).toEqual([51.47, -0.454]);
    expect([by('LTN')?.lat, by('LTN')?.lng]).toEqual([51.875, -0.368]);
  });

  it('has five landmarks for each of the three cities', () => {
    for (const city of ['dubai', 'abudhabi', 'sharjah']) {
      expect(LANDMARKS.filter((l) => l.city === city)).toHaveLength(5);
    }
  });

  it('labels Abu Dhabi as the UAE, not by longitude', () => {
    const r = regionOf(54.377, 24.454);
    expect(r?.country.en).toBe('United Arab Emirates');
    expect(r?.area?.en).toBe('Abu Dhabi');
    expect(r?.timeZone).toBe('Asia/Dubai');
    expect(regionOf(-0.454, 51.47)?.timeZone).toBe('Europe/London');
    expect(regionOf(10, 10)).toBeNull();
  });
});

describe('language packs', () => {
  const en = dictionaries.en as Record<string, string>;
  const ar = dictionaries.ar as Record<string, string>;
  const holes = (s: string) => (s.match(/\{\{[^}]+\}\}/g) ?? []).sort().join('|');

  it('Arabic has every English key, no blanks, and the same placeholders', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    for (const k of Object.keys(en)) {
      expect(ar[k].trim().length, k).toBeGreaterThan(0);
      expect(holes(ar[k]), k).toBe(holes(en[k]));
    }
  });
  it('contains Arabic script in the Arabic pack', () => {
    const arabicish = Object.values(ar).filter((s) => /[؀-ۿ]/.test(s)).length;
    expect(arabicish).toBeGreaterThan(Object.keys(en).length * 0.85);
  });
});

describe('profile', () => {
  it('sanitises stored values instead of trusting them', () => {
    const base = defaultProfile('en');
    const dirty = { ...base, theme: 'neon', feather: 900, lang: 'fr', layers: { flights: 'yes' } } as never;
    const clean = sanitizeProfile(dirty, base);
    expect(clean.theme).toBe('dark');
    expect(clean.feather).toBe(100);
    expect(clean.lang).toBe('en');
    expect(clean.layers.flights).toBe(false);
  });
  it('picks Arabic from an Arabic browser language', () => {
    expect(defaultProfile('ar-AE').lang).toBe('ar');
  });
});

describe('sample data is labelled and bounded', () => {
  it('estate indices are deterministic and within 0..100', () => {
    expect(ESTATE_SITES.length).toBeGreaterThan(10);
    for (const s of ESTATE_SITES) {
      for (const v of [s.priceIdx, s.activityIdx, s.readyPct]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
  it('transit vehicles stay on their routes and are deterministic', () => {
    const geoms = buildGeoms();
    const a = vehiclesAt(geoms, 123_456_789);
    const b = vehiclesAt(geoms, 123_456_789);
    expect(a).toEqual(b);
    expect(a.length).toBe(TRANSIT_ROUTES.reduce((n, r) => n + r.vehicles, 0));
    for (const v of a) {
      const g = geoms.find((x) => x.route.id === v.routeId);
      const lngs = g?.route.path.map((p) => p[0]) ?? [];
      const lats = g?.route.path.map((p) => p[1]) ?? [];
      expect(v.lng).toBeGreaterThanOrEqual(Math.min(...lngs) - 1e-9);
      expect(v.lng).toBeLessThanOrEqual(Math.max(...lngs) + 1e-9);
      expect(v.lat).toBeGreaterThanOrEqual(Math.min(...lats) - 1e-9);
      expect(v.lat).toBeLessThanOrEqual(Math.max(...lats) + 1e-9);
    }
  });
  it('pointAt clamps to the route ends', () => {
    const g = buildGeoms()[0];
    expect(pointAt(g, -50).lng).toBeCloseTo(g.route.path[0][0], 9);
    expect(pointAt(g, g.length + 50).lat).toBeCloseTo(g.route.path[g.route.path.length - 1][1], 9);
  });
});
