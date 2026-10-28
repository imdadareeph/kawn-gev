// Flight camera views: pure maths shared by the app and its tests. Own code; the idea of a follow camera
// that sits behind and above the tracked aircraft is common to flight trackers.

export type FlightView = 'top' | 'chase' | 'orbit' | 'cockpit';
export const FLIGHT_VIEWS: FlightView[] = ['top', 'chase', 'orbit', 'cockpit'];

export interface FlightPose {
  lng: number;
  lat: number;
  altM: number;
  /** Ground track in degrees clockwise from north. */
  track: number;
  /** Ground speed in m/s. */
  speed: number;
  /** Flight-path angle in degrees (positive = climbing). */
  gamma: number;
  /** Wall-clock ms of the sample. */
  at: number;
}

const M_PER_DEG = 111_320;
const KT = 0.514444;
const FPM = 0.00508;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Smallest signed difference b - a in degrees, in (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  const d = ((b - a + 540) % 360) - 180;
  return d === -180 ? 180 : d;
}

/** Move `cur` toward `target` by at most `maxStep` degrees along the short way. */
export function slewAngle(cur: number, target: number, maxStep: number): number {
  const d = angleDiff(cur, target);
  return (cur + clamp(d, -maxStep, maxStep) + 360) % 360;
}

/** Flight-path angle from vertical rate (ft/min) and ground speed (kt). */
export function pathAngle(vsFpm: number | null, gsKt: number | null): number {
  if (vsFpm == null || gsKt == null || gsKt < 30) return 0;
  return clamp((Math.atan2(vsFpm * FPM, gsKt * KT) * 180) / Math.PI, -15, 15);
}

/** Dead-reckon a pose forward by the time elapsed since its sample, capped so a dead feed cannot run away. */
export function advance(p: FlightPose, nowMs: number, capMs = 3000): FlightPose {
  const dt = clamp((nowMs - p.at) / 1000, 0, capMs / 1000);
  if (dt === 0 || p.speed <= 0) return p;
  const r = (p.track * Math.PI) / 180;
  const dN = Math.cos(r) * p.speed * dt;
  const dE = Math.sin(r) * p.speed * dt;
  const lat = p.lat + dN / M_PER_DEG;
  const lng = p.lng + dE / (M_PER_DEG * Math.max(0.05, Math.cos((p.lat * Math.PI) / 180)));
  return { ...p, lat, lng, altM: Math.max(0, p.altM + Math.tan((p.gamma * Math.PI) / 180) * p.speed * dt), at: nowMs };
}

/** Camera distance for the external views; `factor` comes from the mouse wheel. */
export function viewRange(view: FlightView, altM: number, factor: number): number {
  const base = clamp(260 + altM * 0.03, 260, 760);
  const r = view === 'orbit' ? base * 1.5 : base;
  return clamp(r * factor, 80, 20_000);
}

export const VIEW_PITCH: Record<'chase' | 'orbit', number> = { chase: -13, orbit: -24 };
export const ORBIT_DEG_PER_S = 9;
export const COCKPIT_EYE_UP_M = 6;

export interface Neighbour {
  id: string;
  label: string;
  km: number;
  bearing: number;
  altFt: number | null;
}

export function distKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r;
  const dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = Math.PI / 180;
  const y = Math.sin((bLng - aLng) * r) * Math.cos(bLat * r);
  const x = Math.cos(aLat * r) * Math.sin(bLat * r) - Math.sin(aLat * r) * Math.cos(bLat * r) * Math.cos((bLng - aLng) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

/** The n aircraft nearest to `from`, excluding it, nearest first. */
export function nearest(
  from: { id: string; lat: number; lng: number },
  all: { id: string; callsign: string; lat: number; lng: number; altFt: number | null }[],
  n = 4,
  maxKm = 250,
): Neighbour[] {
  const out: Neighbour[] = [];
  for (const a of all) {
    if (a.id === from.id) continue;
    const km = distKm(from.lat, from.lng, a.lat, a.lng);
    if (km > maxKm) continue;
    out.push({ id: a.id, label: a.callsign, km, bearing: bearingDeg(from.lat, from.lng, a.lat, a.lng), altFt: a.altFt });
  }
  return out.sort((p, q) => p.km - q.km).slice(0, n);
}

/** Points for a small altitude-profile line (0..1 in x and y) from a trail of [lng, lat, altFt]. */
export function altitudeProfile(trail: [number, number, number][], maxPoints = 60): { pts: [number, number][]; minFt: number; maxFt: number } | null {
  if (trail.length < 3) return null;
  const step = Math.max(1, Math.ceil(trail.length / maxPoints));
  const alts: number[] = [];
  for (let i = 0; i < trail.length; i += step) alts.push(trail[i][2]);
  if (alts[alts.length - 1] !== trail[trail.length - 1][2]) alts.push(trail[trail.length - 1][2]);
  const minFt = Math.min(...alts);
  const maxFt = Math.max(...alts);
  const span = Math.max(500, maxFt - minFt);
  const pts = alts.map((a, i) => [i / (alts.length - 1), 1 - (a - minFt) / span] as [number, number]);
  return { pts, minFt, maxFt };
}
