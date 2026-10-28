const M_PER_DEG_LAT = 111_320;

export function advance(lng: number, lat: number, headingDeg: number, meters: number): [number, number] {
  const h = (headingDeg * Math.PI) / 180;
  const dLat = (meters * Math.cos(h)) / M_PER_DEG_LAT;
  const dLng = (meters * Math.sin(h)) / (M_PER_DEG_LAT * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  return [lng + dLng, lat + dLat];
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

export function bearingDeg(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const y = Math.sin(((bLng - aLng) * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180);
  const x =
    Math.cos((aLat * Math.PI) / 180) * Math.sin((bLat * Math.PI) / 180) -
    Math.sin((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.cos(((bLng - aLng) * Math.PI) / 180);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

export const KT_TO_MPS = 0.514444;

/** Metres per pixel at a latitude and web-mercator zoom (512 px tiles, as MapLibre uses). */
export function metersPerPixel(lat: number, zoom: number): number {
  return (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
