export interface LatLng {
  lat: number;
  lng: number;
}
export const MAX_ROUTE_KM: number;
export function parsePoint(text: unknown): LatLng | null;
export function clampRoute(from: unknown, to: unknown): { from: LatLng; to: LatLng } | null;
export function normalizeOsrm(json: unknown): { distanceM: number; durationS: number; path: [number, number][] } | null;
