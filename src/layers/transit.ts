import { bearingDeg, haversineKm } from '../geo';
import { TRANSIT_ROUTES, type TransitMode, type TransitRoute } from '../data/transit-sample';

export interface RouteGeom {
  route: TransitRoute;
  /** Cumulative distance in metres at each vertex. */
  cum: number[];
  length: number;
}

export interface Vehicle {
  id: string;
  routeId: string;
  mode: TransitMode;
  lng: number;
  lat: number;
  angle: number;
  color: [number, number, number];
}

export function buildGeoms(routes: TransitRoute[] = TRANSIT_ROUTES): RouteGeom[] {
  return routes.map((route) => {
    const cum = [0];
    for (let i = 1; i < route.path.length; i += 1) {
      const [aLng, aLat] = route.path[i - 1];
      const [bLng, bLat] = route.path[i];
      cum.push(cum[i - 1] + haversineKm(aLat, aLng, bLat, bLng) * 1000);
    }
    return { route, cum, length: cum[cum.length - 1] };
  });
}

/** Position at distance `s` metres along the route, plus the heading of that segment. */
export function pointAt(g: RouteGeom, s: number): { lng: number; lat: number; heading: number } {
  const d = Math.min(g.length, Math.max(0, s));
  let i = 1;
  while (i < g.cum.length - 1 && g.cum[i] < d) i += 1;
  const [aLng, aLat] = g.route.path[i - 1];
  const [bLng, bLat] = g.route.path[i];
  const segLen = g.cum[i] - g.cum[i - 1] || 1;
  const f = Math.min(1, Math.max(0, (d - g.cum[i - 1]) / segLen));
  return {
    lng: aLng + (bLng - aLng) * f,
    lat: aLat + (bLat - aLat) * f,
    heading: bearingDeg(aLng, aLat, bLng, bLat),
  };
}

/** Simulated vehicles shuttling back and forth. These are NOT live operator positions. */
export function vehiclesAt(geoms: RouteGeom[], tMs: number): Vehicle[] {
  const out: Vehicle[] = [];
  for (const g of geoms) {
    const n = g.route.vehicles;
    const period = 2 * g.length;
    if (period <= 0) continue;
    for (let i = 0; i < n; i += 1) {
      const u = (((tMs / 1000) * g.route.speedMps + (i / n) * period) % period + period) % period;
      const forward = u <= g.length;
      const s = forward ? u : period - u;
      const p = pointAt(g, s);
      out.push({
        id: `${g.route.id}#${i + 1}`,
        routeId: g.route.id,
        mode: g.route.mode,
        lng: p.lng,
        lat: p.lat,
        angle: forward ? p.heading : (p.heading + 180) % 360,
        color: g.route.color,
      });
    }
  }
  return out;
}
