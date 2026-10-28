// Next pass of a satellite over an observer: rise, set, peak elevation and whether it can be seen with the naked eye.
import { ecfToLookAngles, eciToEcf, gstime, jday, propagate, sunPos, type SatRec } from 'satellite.js';

const RAD = Math.PI / 180;
const AU_KM = 149_597_870.7;
const EARTH_R_KM = 6378.137;

export interface Pass {
  /** null when the satellite is already above the minimum elevation at the start. */
  riseMs: number | null;
  setMs: number;
  maxElevDeg: number;
  maxElevMs: number;
  /** Sunlit satellite over a dark sky (sun at least 6 degrees below the horizon) at the pass peak. */
  visible: boolean;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function sunEci(date: Date): Vec3 {
  const { rsun } = sunPos(jday(date));
  return { x: rsun[0] * AU_KM, y: rsun[1] * AU_KM, z: rsun[2] * AU_KM };
}

/** Cylindrical Earth-shadow test: true when the satellite is in sunlight. */
export function isSunlit(rec: SatRec, date: Date): boolean {
  const pv = propagate(rec, date);
  if (!pv || typeof pv !== 'object' || !('position' in pv) || !pv.position) return false;
  const r = pv.position as Vec3;
  const s = sunEci(date);
  const sm = Math.hypot(s.x, s.y, s.z);
  const u = { x: s.x / sm, y: s.y / sm, z: s.z / sm };
  const along = r.x * u.x + r.y * u.y + r.z * u.z;
  if (along > 0) return true;
  const px = r.x - along * u.x;
  const py = r.y - along * u.y;
  const pz = r.z - along * u.z;
  return Math.hypot(px, py, pz) > EARTH_R_KM;
}

/** Elevation of the sun above the observer's horizon, degrees. */
export function sunElevation(date: Date, obs: { lat: number; lng: number }): number {
  const s = sunEci(date);
  const ecf = eciToEcf(s, gstime(date));
  return ecfToLookAngles({ latitude: obs.lat * RAD, longitude: obs.lng * RAD, height: 0 }, ecf).elevation / RAD;
}

function elevationAt(rec: SatRec, date: Date, obs: { lat: number; lng: number }): number | null {
  const pv = propagate(rec, date);
  if (!pv || typeof pv !== 'object' || !('position' in pv) || !pv.position) return null;
  const ecf = eciToEcf(pv.position, gstime(date));
  return ecfToLookAngles({ latitude: obs.lat * RAD, longitude: obs.lng * RAD, height: 0 }, ecf).elevation / RAD;
}

/** Search the next `horizonH` hours (30 s steps, edges refined to about a second). Null when there is no pass. */
export function nextPass(
  rec: SatRec,
  obs: { lat: number; lng: number },
  fromMs: number,
  { minElevDeg = 10, horizonH = 24, stepS = 30 } = {},
): Pass | null {
  const end = fromMs + horizonH * 3_600_000;
  const refine = (lo: number, hi: number, risingEdge: boolean): number => {
    // lo and hi bracket the crossing of minElevDeg; bisect to ~1 s.
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      const e = elevationAt(rec, new Date(mid), obs);
      const above = e !== null && e >= minElevDeg;
      if (above === risingEdge) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  };
  let t = fromMs;
  let prevT = t;
  let rise: number | null = null;
  let started = false;
  let max = -90;
  let maxMs = t;
  for (; t <= end; t += stepS * 1000) {
    const e = elevationAt(rec, new Date(t), obs);
    const above = e !== null && e >= minElevDeg;
    if (!started) {
      if (above) {
        started = true;
        rise = t === fromMs ? null : refine(prevT, t, true);
        max = e as number;
        maxMs = t;
      }
    } else if (above) {
      if ((e as number) > max) {
        max = e as number;
        maxMs = t;
      }
    } else {
      const setMs = refine(prevT, t, false);
      const when = new Date(maxMs);
      const visible = isSunlit(rec, when) && sunElevation(when, obs) < -6;
      return { riseMs: rise, setMs, maxElevDeg: max, maxElevMs: maxMs, visible };
    }
    prevT = t;
  }
  return null;
}
