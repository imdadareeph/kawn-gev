export interface WorldAircraft {
  id: string;
  cs: string;
  ctry: string;
  lat: number;
  lon: number;
  alt: number | null;
  gs: number | null;
  trk: number | null;
  vr: number | null;
  t: number;
}
export interface WorldBox {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}
export const MAX_WORLD: number;
export function parseStates(json: unknown): WorldAircraft[];
export function clampWorldQuery(get: (key: string) => string | null): { box: WorldBox | null; max: number } | null;
export function thin(list: WorldAircraft[], box: WorldBox | null, max: number): { aircraft: WorldAircraft[]; inView: number; cellDeg: number };
export function creditTtlMs(remaining: number, base?: number): number;
