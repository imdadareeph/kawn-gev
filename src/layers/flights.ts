import { clampQuery, normalizeAdsb } from '../../shared/flights.mjs';
import type { AircraftRecord } from '../../shared/flights.mjs';
import { advance, clamp, haversineKm, KT_TO_MPS } from '../geo';
import { AIRPORTS } from '../places';

export type FeedState = 'idle' | 'loading' | 'live' | 'stale' | 'degraded' | 'fallback' | 'unavailable';
export type FeedReason = 'ok' | 'zoom' | 'wait' | 'down' | 'demo' | 'none';

export interface FeedStatus {
  state: FeedState;
  reason: FeedReason;
  count: number;
  fetchedAt: number | null;
  source: string;
}

export interface ViewInfo {
  lng: number;
  lat: number;
  zoom: number;
  /** Diagonal of the visible window in km. */
  diagKm: number;
}

export interface Tracked extends AircraftRecord {
  seenSnapshot: number;
  demo: boolean;
}

export interface DisplayAircraft {
  id: string;
  callsign: string;
  lng: number;
  lat: number;
  angle: number;
  altFt: number | null;
  onGround: boolean;
  emergency: boolean;
  stale: boolean;
  demo: boolean;
  gsKt: number | null;
}

export const MIN_ZOOM = 6;
const POLL_MS = 15_000;
const COAST_MAX_S = 45;
const STALE_AFTER_S = 25;
const DROP_AFTER_MS = 120_000;
const TRAIL_MAX = 400;

/** Position of an aircraft at `nowMs`, coasting along its last track for a short time only. */
export function deadReckon(a: AircraftRecord, nowMs: number): { lng: number; lat: number; ageSec: number; coasted: boolean } {
  const ageSec = Math.max(0, (nowMs - a.posTime) / 1000);
  const moving = !a.onGround && a.gsKt !== null && a.gsKt > 8 && a.trackDeg !== null;
  if (!moving) return { lng: a.lon, lat: a.lat, ageSec, coasted: false };
  const dt = Math.min(ageSec, COAST_MAX_S);
  const [lng, lat] = advance(a.lon, a.lat, a.trackDeg as number, (a.gsKt as number) * KT_TO_MPS * dt);
  return { lng, lat, ageSec, coasted: true };
}

export class FlightsFeed {
  private map = new Map<string, Tracked>();
  private trails = new Map<string, [number, number, number][]>();
  private enabled = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private snapshotNo = 0;
  private failures = 0;
  private everLive = false;
  private mode: 'proxy' | 'direct' = 'proxy';
  private lastQuery: { lat: number; lon: number; r: number; at: number } | null = null;
  private demoState: DemoFlight[] | null = null;
  private inflight: AbortController | null = null;
  private trailTarget: string | null = null;
  private st: FeedStatus = { state: 'idle', reason: 'none', count: 0, fetchedAt: null, source: 'adsb.lol' };

  constructor(
    private getView: () => ViewInfo,
    private onChange: () => void,
  ) {}

  status(): FeedStatus {
    const now = Date.now();
    if (this.st.state === 'live' && this.st.fetchedAt && now - this.st.fetchedAt > 60_000) {
      return { ...this.st, state: 'stale' };
    }
    return { ...this.st, count: this.map.size };
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) {
      this.timer = setInterval(() => {
        if (!document.hidden) void this.refresh(true);
      }, POLL_MS);
      this.st = { ...this.st, state: 'loading', reason: 'wait' };
      this.onChange();
      void this.refresh(true);
    } else {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.inflight?.abort();
      this.st = { ...this.st, state: 'idle', reason: 'none' };
      this.onChange();
    }
  }

  /** Call when the camera settles. Debounced, and skipped when the view mostly overlaps the last request. */
  cameraSettled(): void {
    if (!this.enabled) return;
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.refresh(false), 600);
  }

  setTrailTarget(id: string | null): void {
    this.trailTarget = id;
    if (id && !this.trails.has(id)) {
      const a = this.map.get(id);
      this.trails.set(id, a ? [[a.lon, a.lat, a.altFt ?? 0]] : []);
    }
  }

  trail(id: string): [number, number, number][] {
    return this.trails.get(id) ?? [];
  }

  get(id: string): Tracked | undefined {
    return this.map.get(id);
  }

  list(): Tracked[] {
    return [...this.map.values()];
  }

  /** Aircraft with positions advanced to `nowMs`. */
  snapshot(nowMs: number): DisplayAircraft[] {
    const out: DisplayAircraft[] = [];
    for (const a of this.map.values()) {
      const p = deadReckon(a, nowMs);
      out.push({
        id: a.id,
        callsign: a.callsign || a.reg || a.id.toUpperCase(),
        lng: p.lng,
        lat: p.lat,
        angle: a.trackDeg ?? 0,
        altFt: a.altFt,
        onGround: a.onGround,
        emergency: a.emergency,
        stale: p.ageSec > STALE_AFTER_S,
        demo: a.demo,
        gsKt: a.gsKt,
      });
    }
    return out;
  }

  private shouldSkip(q: { lat: number; lon: number; r: number }, force: boolean): boolean {
    if (force || !this.lastQuery) return false;
    const movedKm = haversineKm(q.lat, q.lon, this.lastQuery.lat, this.lastQuery.lon);
    const overlap = movedKm < this.lastQuery.r * 1.852 * 0.3 && q.r <= this.lastQuery.r * 1.25;
    return overlap && Date.now() - this.lastQuery.at < POLL_MS;
  }

  async refresh(force: boolean): Promise<void> {
    if (!this.enabled) return;
    const v = this.getView();
    if (v.zoom < MIN_ZOOM) {
      this.st = { ...this.st, state: 'idle', reason: 'zoom' };
      this.onChange();
      return;
    }
    const radiusNm = clamp(Math.round((v.diagKm / 2 / 1.852) * 1.25), 20, 250);
    const q = clampQuery(v.lat, v.lng, radiusNm);
    if (!q) return;
    if (this.shouldSkip(q, force)) return;
    this.lastQuery = { ...q, at: Date.now() };

    if (this.demoState) {
      this.stepDemo();
      return;
    }

    this.inflight?.abort();
    const ctrl = new AbortController();
    this.inflight = ctrl;
    if (!this.everLive) {
      this.st = { ...this.st, state: 'loading', reason: 'wait' };
      this.onChange();
    }
    try {
      const recs = await this.fetchRecords(q, ctrl.signal);
      this.merge(recs);
      this.failures = 0;
      this.everLive = true;
      this.st = { state: 'live', reason: 'ok', count: this.map.size, fetchedAt: Date.now(), source: 'adsb.lol' };
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      this.failures += 1;
      if (this.map.size > 0) {
        this.st = { ...this.st, state: 'degraded', reason: 'down' };
      } else if (this.failures >= 2) {
        // Never had real data: show clearly labelled demo traffic so the layer is not a blank map.
        this.startDemo();
        return;
      } else {
        this.st = { ...this.st, state: 'unavailable', reason: 'none' };
      }
    }
    this.onChange();
  }

  private async fetchRecords(q: { lat: number; lon: number; r: number }, signal: AbortSignal): Promise<AircraftRecord[]> {
    if (this.mode === 'proxy') {
      try {
        const res = await fetch(`/api/flights?lat=${q.lat}&lon=${q.lon}&r=${q.r}`, { signal });
        const ct = res.headers.get('content-type') ?? '';
        if (res.status === 404 || res.status === 405 || !ct.includes('json')) {
          this.mode = 'direct'; // static hosting: no server in front
        } else if (res.ok) {
          const body = (await res.json()) as { aircraft?: AircraftRecord[] };
          return body.aircraft ?? [];
        }
        // proxy answered but upstream failed: try the browser route once
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e;
        this.mode = 'direct';
      }
    }
    const res = await fetch(`https://api.adsb.lol/v2/point/${q.lat}/${q.lon}/${q.r}`, { signal });
    if (!res.ok) throw new Error(`direct ${res.status}`);
    return normalizeAdsb(await res.json(), Date.now()).aircraft;
  }

  private merge(recs: AircraftRecord[]): void {
    this.snapshotNo += 1;
    const now = Date.now();
    for (const r of recs) {
      const prev = this.map.get(r.id);
      // Keep the freshest fix if a stale duplicate arrives.
      if (prev && prev.posTime > r.posTime) {
        prev.seenSnapshot = this.snapshotNo;
        continue;
      }
      this.map.set(r.id, { ...r, seenSnapshot: this.snapshotNo, demo: false });
      this.appendTrail(r);
    }
    for (const [id, a] of this.map) {
      if (this.snapshotNo - a.seenSnapshot > 3 || now - a.posTime > DROP_AFTER_MS) this.map.delete(id);
    }
  }

  private appendTrail(r: AircraftRecord): void {
    if (r.id !== this.trailTarget) return;
    const tr = this.trails.get(r.id) ?? [];
    const last = tr[tr.length - 1];
    if (!last || haversineKm(last[1], last[0], r.lat, r.lon) > 0.025) tr.push([r.lon, r.lat, r.altFt ?? 0]);
    if (tr.length > TRAIL_MAX) tr.shift();
    this.trails.set(r.id, tr);
  }

  // ---- clearly labelled demo traffic, used only if the live feed has never answered ----

  private startDemo(): void {
    this.demoState = makeDemo();
    this.map.clear();
    this.stepDemo();
  }

  private stepDemo(): void {
    if (!this.demoState) return;
    const now = Date.now();
    const dtSec = POLL_MS / 1000;
    this.map.clear();
    for (const d of this.demoState) {
      d.step(dtSec);
      const rec = d.record(now);
      this.map.set(rec.id, { ...rec, seenSnapshot: this.snapshotNo, demo: true });
      this.appendTrail(rec);
    }
    this.st = { state: 'fallback', reason: 'demo', count: this.map.size, fetchedAt: now, source: 'demo' };
    this.onChange();
  }
}

class DemoFlight {
  constructor(
    private n: number,
    private apt: { lng: number; lat: number },
    private outBearing: number,
    private departing: boolean,
    private distKm: number,
    private speedKt: number,
  ) {}

  step(dtSec: number): void {
    const dKm = (this.speedKt * KT_TO_MPS * dtSec) / 1000;
    if (this.departing) {
      this.distKm += dKm;
      if (this.distKm > 150) this.distKm = 4;
    } else {
      this.distKm -= dKm;
      if (this.distKm < 3) this.distKm = 140;
    }
  }

  record(now: number): AircraftRecord {
    const [lng, lat] = advance(this.apt.lng, this.apt.lat, this.outBearing, this.distKm * 1000);
    const alt = this.departing ? Math.min(36000, 800 + this.distKm * 260) : Math.min(36000, 600 + this.distKm * 190);
    return {
      id: `d3m${String(this.n).padStart(3, '0')}`.slice(0, 6),
      callsign: `DEMO${String(this.n).padStart(2, '0')}`,
      reg: '',
      type: 'DEMO',
      category: '',
      lat,
      lon: lng,
      altFt: Math.round(alt),
      gsKt: this.speedKt,
      trackDeg: this.departing ? this.outBearing : (this.outBearing + 180) % 360,
      vsFpm: this.departing ? 1800 : -900,
      squawk: null,
      onGround: false,
      emergency: false,
      posTime: now,
    };
  }
}

function makeDemo(): DemoFlight[] {
  const flows = [
    { code: 'DXB', bearing: 300, count: 9 },
    { code: 'DWC', bearing: 280, count: 5 },
    { code: 'AUH', bearing: 310, count: 7 },
    { code: 'SHJ', bearing: 305, count: 3 },
  ];
  const out: DemoFlight[] = [];
  let n = 1;
  for (const f of flows) {
    const apt = AIRPORTS.find((a) => a.code === f.code);
    if (!apt) continue;
    for (let i = 0; i < f.count; i += 1) {
      out.push(new DemoFlight(n, { lng: apt.lng, lat: apt.lat }, f.bearing, i % 2 === 0, 10 + ((i * 37 + n * 13) % 130), 170 + ((i * 29) % 90)));
      n += 1;
    }
  }
  return out;
}
