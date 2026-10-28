// Client side of road routing: asks the local API for a drivable path and falls back to a labelled straight line.
import { haversineKm } from './geo';

export interface RoutePath {
  /** [lng, lat] vertices. */
  path: [number, number][];
  distanceM: number;
  durationS: number;
  /** True when no road router answered and this is a straight line. */
  straight: boolean;
}

const FALLBACK_KMH = 30;

export function straightRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }): RoutePath {
  const km = haversineKm(from.lat, from.lng, to.lat, to.lng);
  return {
    path: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
    distanceM: km * 1000,
    durationS: (km / FALLBACK_KMH) * 3600,
    straight: true,
  };
}

export async function fetchRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }, signal?: AbortSignal): Promise<RoutePath> {
  const q = `from=${from.lat.toFixed(5)},${from.lng.toFixed(5)}&to=${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
  try {
    const res = await fetch(`/api/route?${q}`, { signal });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { path?: [number, number][]; distanceM?: number; durationS?: number };
    if (!j.path || j.path.length < 2 || !Number.isFinite(j.distanceM) || !Number.isFinite(j.durationS)) throw new Error('bad reply');
    return { path: j.path, distanceM: j.distanceM as number, durationS: j.durationS as number, straight: false };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return straightRoute(from, to);
  }
}
