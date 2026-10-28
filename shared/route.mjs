// Road-route helpers shared by the server and the tests: strict input checks and a normaliser for OSRM replies.

const num = (v) => {
  if (typeof v !== 'string' || !/^-?\d{1,3}(\.\d{1,7})?$/.test(v.trim())) return null;
  return Number(v);
};

/** "lat,lng" -> { lat, lng }, or null when malformed or out of range. */
export function parsePoint(text) {
  if (typeof text !== 'string') return null;
  const parts = text.split(',');
  if (parts.length !== 2) return null;
  const lat = num(parts[0]);
  const lng = num(parts[1]);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function haversineKm(a, b) {
  const R = 6371;
  const toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR;
  const dLng = (b.lng - a.lng) * toR;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const MAX_ROUTE_KM = 120;

/** Validates both ends and keeps the trip inside one city region. Coordinates are rounded to ~1 m. */
export function clampRoute(fromText, toText) {
  const from = parsePoint(fromText);
  const to = parsePoint(toText);
  if (!from || !to) return null;
  if (haversineKm(from, to) > MAX_ROUTE_KM) return null;
  const r = (n) => Math.round(n * 1e5) / 1e5;
  return { from: { lat: r(from.lat), lng: r(from.lng) }, to: { lat: r(to.lat), lng: r(to.lng) } };
}

/** OSRM route reply -> { distanceM, durationS, path: [[lng, lat], ...] }, or null if unusable. */
export function normalizeOsrm(json) {
  const route = json && json.code === 'Ok' && Array.isArray(json.routes) ? json.routes[0] : null;
  const coords = route?.geometry?.coordinates;
  if (!route || !Array.isArray(coords) || coords.length < 2) return null;
  const path = [];
  for (const c of coords) {
    if (!Array.isArray(c) || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
    path.push([c[0], c[1]]);
  }
  if (!Number.isFinite(route.distance) || !Number.isFinite(route.duration)) return null;
  return { distanceM: route.distance, durationS: route.duration, path: path.length > 4000 ? path.filter((_, i) => i % Math.ceil(path.length / 4000) === 0) : path };
}
