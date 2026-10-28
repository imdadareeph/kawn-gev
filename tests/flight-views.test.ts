import { describe, expect, it } from 'vitest';
import { advance, altitudeProfile, angleDiff, bearingDeg, distKm, nearest, pathAngle, slewAngle, viewRange, type FlightPose } from '../src/layers/flight-views';

const base: FlightPose = { lng: 55, lat: 25, altM: 3000, track: 90, speed: 200, gamma: 0, at: 0 };

describe('flight views', () => {
  it('takes the short way round for angles', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(-20);
    expect(slewAngle(350, 20, 10)).toBe(0);
    expect(slewAngle(0, 5, 10)).toBe(5);
  });
  it('dead-reckons east for a 090 track and caps the extrapolation', () => {
    const p = advance(base, 2000);
    expect(p.lat).toBeCloseTo(25, 5);
    expect(p.lng).toBeGreaterThan(55);
    const far = advance(base, 60_000);
    expect(far.lng).toBeCloseTo(advance(base, 3000).lng, 8);
  });
  it('derives a bounded path angle', () => {
    expect(pathAngle(null, 300)).toBe(0);
    expect(pathAngle(2000, 300)).toBeGreaterThan(3);
    expect(pathAngle(99999, 40)).toBe(15);
  });
  it('keeps the external range within bounds', () => {
    expect(viewRange('chase', 0, 1)).toBe(260);
    expect(viewRange('orbit', 10000, 1)).toBeGreaterThan(viewRange('chase', 10000, 1));
    expect(viewRange('chase', 0, 1000)).toBe(20000);
  });
  it('finds nearest neighbours', () => {
    const list = [
      { id: 'a', callsign: 'A', lat: 25, lng: 55, altFt: 1 },
      { id: 'b', callsign: 'B', lat: 25.1, lng: 55, altFt: 2 },
      { id: 'c', callsign: 'C', lat: 25.5, lng: 55, altFt: 3 },
      { id: 'd', callsign: 'D', lat: 40, lng: 55, altFt: 4 },
    ];
    const n = nearest(list[0], list, 2);
    expect(n.map((x) => x.id)).toEqual(['b', 'c']);
    expect(n[0].km).toBeCloseTo(distKm(25, 55, 25.1, 55), 5);
    expect(Math.round(bearingDeg(25, 55, 26, 55))).toBe(0);
  });
  it('builds an altitude profile only when there is a trail', () => {
    expect(altitudeProfile([[0, 0, 100]])).toBeNull();
    const p = altitudeProfile([[0, 0, 0], [0, 0, 5000], [0, 0, 10000]]);
    expect(p?.maxFt).toBe(10000);
    expect(p?.pts[0][1]).toBe(1);
    expect(p?.pts[2][1]).toBe(0);
  });
});
