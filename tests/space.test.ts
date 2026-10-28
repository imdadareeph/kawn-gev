import { describe, expect, it } from 'vitest';
import { json2satrec } from 'satellite.js';
import { normalizeOmm } from '../shared/satellites.mjs';
import { positionAt } from '../src/layers/satellites';
import { decodeShare, encodeShare } from '../src/share';
import { defaultProfile, LAYER_IDS } from '../src/state';

// Synthetic near-circular 51.6 degree orbit at roughly ISS altitude. The numbers are made up for the maths, not real data.
const OMM = {
  OBJECT_NAME: 'TEST STATION (ZARYA)', OBJECT_ID: '1998-067A', EPOCH: '2026-10-25T12:00:00.000',
  MEAN_MOTION: 15.5, ECCENTRICITY: 0.0005, INCLINATION: 51.6, RA_OF_ASC_NODE: 120, ARG_OF_PERICENTER: 80,
  MEAN_ANOMALY: 40, BSTAR: 0.00003, MEAN_MOTION_DOT: 0.00002, MEAN_MOTION_DDOT: 0, NORAD_CAT_ID: 25544, ELEMENT_SET_NO: 999, REV_AT_EPOCH: 1000,
};

describe('satellite normaliser', () => {
  it('keeps valid records and drops bad ones', () => {
    const out = normalizeOmm([OMM, { ...OMM, NORAD_CAT_ID: 2, MEAN_MOTION: 'x' }, { ...OMM, NORAD_CAT_ID: 3, ECCENTRICITY: 1.2 }, null, 'junk', { ...OMM, NORAD_CAT_ID: 4, EPOCH: 'nope' }]);
    expect(out.map((o) => o.NORAD_CAT_ID)).toEqual([25544]);
  });
  it('keeps the newest element set per id and respects the cap', () => {
    const newer = { ...OMM, EPOCH: '2026-10-26T00:00:00.000', MEAN_ANOMALY: 99 };
    expect(normalizeOmm([OMM, newer])[0].MEAN_ANOMALY).toBe(99);
    const many = Array.from({ length: 10 }, (_, i) => ({ ...OMM, NORAD_CAT_ID: 100 + i }));
    expect(normalizeOmm(many, 4)).toHaveLength(4);
    expect(normalizeOmm('x')).toEqual([]);
  });
});

describe('SGP4 position', () => {
  const rec = json2satrec(normalizeOmm([OMM])[0] as never);
  it('stays in low Earth orbit within the inclination band', () => {
    for (let h = 0; h < 6; h++) {
      const p = positionAt(rec, new Date(Date.UTC(2026, 9, 25, 12 + h)), null);
      expect(p).not.toBeNull();
      expect(p!.altKm).toBeGreaterThan(300);
      expect(p!.altKm).toBeLessThan(500);
      expect(Math.abs(p!.lat)).toBeLessThanOrEqual(51.7);
    }
  });
  it('reports a low elevation for a far observer and a high one directly below', () => {
    const when = new Date(Date.UTC(2026, 9, 25, 13));
    const p = positionAt(rec, when, null)!;
    const under = positionAt(rec, when, { lat: p.lat, lng: p.lng })!;
    expect(under.elevDeg).toBeGreaterThan(80);
    const far = positionAt(rec, when, { lat: -p.lat, lng: p.lng + 180 })!;
    expect(far.elevDeg).toBeLessThan(0);
  });
});

describe('layers and share links', () => {
  it('round-trips the new layers', () => {
    expect(LAYER_IDS).toContain('satellites');
    expect(LAYER_IDS).toContain('daynight');
    const q = encodeShare({ layers: ['satellites', 'daynight', 'parking'] } as never);
    expect(decodeShare(q)?.layers).toEqual(['satellites', 'daynight', 'parking']);
    expect(defaultProfile().layers.satellites).toBe(false);
  });
});

import { mergeGroups, SAT_CLASS } from '../shared/satellites.mjs';
import { isSunlit, nextPass, sunElevation } from '../src/layers/passes';

describe('groups', () => {
  it('keeps the first group for an object in several', () => {
    const a = normalizeOmm([OMM], 10, 'stations');
    const b = normalizeOmm([OMM, { ...OMM, NORAD_CAT_ID: 7 }], 10, 'visual');
    const merged = mergeGroups([a, b]);
    expect(merged).toHaveLength(2);
    expect(merged.find((o) => o.NORAD_CAT_ID === 25544)?.GROUP).toBe('stations');
    expect(SAT_CLASS.gps).toBe('nav');
    expect(SAT_CLASS.geo).toBe('geo');
  });
  it('respects the merge cap', () => {
    const many = normalizeOmm(Array.from({ length: 20 }, (_, i) => ({ ...OMM, NORAD_CAT_ID: 500 + i })), 50, 'visual');
    expect(mergeGroups([many], 5)).toHaveLength(5);
  });
});

describe('pass finder', () => {
  const rec = json2satrec(normalizeOmm([OMM])[0] as never);
  const from = Date.UTC(2026, 9, 25, 12);
  it('finds an ordered pass with a sensible peak', () => {
    const p = nextPass(rec, { lat: 25.2, lng: 55.27 }, from, { horizonH: 48 });
    expect(p).not.toBeNull();
    expect(p!.setMs).toBeGreaterThan(p!.riseMs ?? from);
    expect(p!.maxElevDeg).toBeGreaterThanOrEqual(10);
    expect(p!.maxElevDeg).toBeLessThanOrEqual(90);
    expect(p!.maxElevMs).toBeGreaterThanOrEqual(p!.riseMs ?? from);
    expect(p!.maxElevMs).toBeLessThanOrEqual(p!.setMs + 30_000);
    // A low-orbit pass lasts minutes, never hours.
    expect(p!.setMs - (p!.riseMs ?? from)).toBeLessThan(20 * 60_000);
  });
  it('reports no pass for a polar observer far outside the inclination', () => {
    expect(nextPass(rec, { lat: 89, lng: 0 }, from, { horizonH: 24 })).toBeNull();
  });
});

describe('sun geometry', () => {
  it('is up at local noon and down at local midnight in Dubai', () => {
    expect(sunElevation(new Date(Date.UTC(2026, 5, 21, 8, 0)), { lat: 25.2, lng: 55.27 })).toBeGreaterThan(60);
    expect(sunElevation(new Date(Date.UTC(2026, 5, 20, 20, 0)), { lat: 25.2, lng: 55.27 })).toBeLessThan(-30);
  });
  it('puts a satellite in shadow on the night side of Earth', () => {
    const rec = json2satrec(normalizeOmm([OMM])[0] as never);
    let lit = 0;
    let dark = 0;
    for (let m = 0; m < 96; m += 4) (isSunlit(rec, new Date(Date.UTC(2026, 9, 25, 12, m))) ? lit++ : dark++);
    expect(lit).toBeGreaterThan(0);
    expect(dark).toBeGreaterThan(0);
  });
});

import { attachOwners } from '../shared/satellites.mjs';
import { expandOwner, ownersFor, ownerLabel } from '../src/data/countries';

describe('countries', () => {
  it('counts a joint programme for every partner', () => {
    expect(expandOwner('ISS')).toEqual(['US', 'CIS', 'JPN', 'ESA', 'CA']);
    expect(expandOwner('PRC')).toEqual(['PRC']);
    expect(ownersFor('ISS', 'stations', 'ISS (ZARYA)')).toContain('JPN');
  });
  it('falls back sensibly when the server sent no owner', () => {
    expect(ownersFor(undefined, 'gps', 'GPS BIIR-2')).toEqual(['US']);
    expect(ownersFor(undefined, 'galileo', 'GALILEO 5')).toEqual(['ESA']);
    expect(ownersFor(undefined, 'stations', 'CSS (TIANHE)')).toEqual(['PRC']);
    expect(ownersFor(undefined, 'visual', 'MYSTERY')).toEqual(['UNK']);
  });
  it('labels known codes and passes unknown ones through', () => {
    expect(ownerLabel('UAE', 'en')).toBe('United Arab Emirates');
    expect(ownerLabel('XYZ', 'en')).toBe('XYZ');
  });
  it('attaches only well-formed owner codes by NORAD id', () => {
    const list = normalizeOmm([OMM, { ...OMM, NORAD_CAT_ID: 9 }], 10, 'visual');
    attachOwners(list, [{ NORAD_CAT_ID: 25544, OWNER: 'ISS' }, { NORAD_CAT_ID: 9, OWNER: '<script>' }, 'junk']);
    expect(list.find((o) => o.NORAD_CAT_ID === 25544)?.OWNER).toBe('ISS');
    expect(list.find((o) => o.NORAD_CAT_ID === 9)?.OWNER).toBeUndefined();
  });
});
