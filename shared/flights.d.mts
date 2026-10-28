export interface FlightsQuery {
  lat: number;
  lon: number;
  r: number;
}

export interface AircraftRecord {
  id: string;
  callsign: string;
  reg: string;
  type: string;
  category: string;
  lat: number;
  lon: number;
  altFt: number | null;
  gsKt: number | null;
  trackDeg: number | null;
  vsFpm: number | null;
  squawk: string | null;
  onGround: boolean;
  emergency: boolean;
  /** Epoch milliseconds of the position fix. */
  posTime: number;
}

export function clampQuery(lat: unknown, lon: unknown, r: unknown): FlightsQuery | null;

export function normalizeAdsb(
  json: unknown,
  fallbackNowMs: number,
): { aircraft: AircraftRecord[]; excludedMilitary: number; upstreamNow: number };
