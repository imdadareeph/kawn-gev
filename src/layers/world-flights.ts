// Aircraft across the whole world from the server's OpenSky snapshot, thinned to a budget that depends on the view.
// Below the detailed-feed zoom only; closer in, the adsb.lol feed takes over with richer data.
import { Cartesian3, Color, PointPrimitiveCollection, type PointPrimitive, type Scene } from 'cesium';
import { advance } from '../geo';
import type { ViewInfo } from './flights';

export type WorldState = 'idle' | 'loading' | 'live' | 'stale' | 'unavailable';
export interface WorldStatus {
  state: WorldState;
  /** Aircraft drawn. */
  shown: number;
  /** Aircraft inside the view before thinning. */
  inView: number;
  /** Airborne aircraft in the whole snapshot. */
  total: number;
  fetchedAt: number | null;
  observedAt: number | null;
  signedIn: boolean;
  creditsLeft: number | null;
}

export interface WorldRecord {
  id: string;
  callsign: string;
  country: string;
  lat: number;
  lng: number;
  altM: number | null;
  gsMps: number | null;
  trackDeg: number | null;
  vrMps: number | null;
  /** Position time, epoch ms. */
  posMs: number;
}

type Row = [string, string, string, number, number, number | null, number | null, number | null, number | null, number];
interface Body {
  aircraft: Row[];
  totalWorld: number;
  inView: number;
  observedAt: number;
  fetchedAt: number;
  stale: boolean;
  signedIn: boolean;
  creditsLeft: number | null;
}

/** Below this zoom the worldwide feed is used. Matches the detailed feed's minimum. */
export const WORLD_MAX_ZOOM = 6;
const POLL_MS = 30_000;
const COAST_MAX_S = 120;
const SKY = Color.fromCssColorString('#8fd0ff').withAlpha(0.95);
const PICKED = Color.fromCssColorString('#2ee6c5');

/** Request window for a view: whole world when zoomed far out, otherwise a generous box around the view. */
export function worldQuery(v: ViewInfo): { box: { lamin: number; lomin: number; lamax: number; lomax: number } | null; max: number } {
  if (v.zoom < 2.5) return { box: null, max: 1500 };
  const half = (v.diagKm / 2 / 111) * 1.15;
  const lamin = Math.max(-90, v.lat - half);
  const lamax = Math.min(90, v.lat + half);
  const lonHalf = half / Math.max(0.2, Math.cos((Math.min(80, Math.abs(v.lat)) * Math.PI) / 180));
  let lomin = v.lng - lonHalf;
  let lomax = v.lng + lonHalf;
  if (lomax - lomin >= 340 || lomin < -180 || lomax > 180) {
    // Crossing the antimeridian or very wide: ask for the world and let the thinning budget cope.
    return { box: null, max: 3000 };
  }
  lomin = Math.max(-180, lomin);
  lomax = Math.min(180, lomax);
  return { box: { lamin, lomin, lamax, lomax }, max: 3000 };
}

export class WorldFlights {
  private pts = new PointPrimitiveCollection();
  private map = new Map<string, { rec: WorldRecord; pt: PointPrimitive }>();
  private enabled = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private inflight: AbortController | null = null;
  private selected: string | null = null;
  private last: { box: ReturnType<typeof worldQuery>['box']; zoomBand: number; at: number } | null = null;
  private st: WorldStatus = { state: 'idle', shown: 0, inView: 0, total: 0, fetchedAt: null, observedAt: null, signedIn: false, creditsLeft: null };

  constructor(
    private scene: Scene,
    private getView: () => ViewInfo,
    private onChange: () => void,
  ) {
    scene.primitives.add(this.pts);
    this.pts.show = false;
  }

  status(): WorldStatus {
    return this.st;
  }

  /** True while the worldwide feed is the one in charge, i.e. the layer is on and the view is zoomed out. */
  active(): boolean {
    return this.enabled && this.getView().zoom < WORLD_MAX_ZOOM;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      this.inflight?.abort();
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.pts.show = false;
      this.st = { ...this.st, state: 'idle' };
      this.onChange();
      return;
    }
    this.timer ??= setInterval(() => void this.refresh(false), POLL_MS);
    void this.refresh(true);
  }

  /** Call when the camera stops moving. */
  cameraSettled(): void {
    if (!this.enabled) return;
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.refresh(false), 600);
  }

  get(id: string): WorldRecord | undefined {
    return this.map.get(id)?.rec;
  }

  setSelected(id: string | null): void {
    const prev = this.selected ? this.map.get(this.selected) : null;
    if (prev) {
      prev.pt.color = SKY;
      prev.pt.pixelSize = 3.5;
    }
    this.selected = id;
    const cur = id ? this.map.get(id) : null;
    if (cur) {
      cur.pt.color = PICKED;
      cur.pt.pixelSize = 8;
    }
  }

  private async refresh(force: boolean): Promise<void> {
    const v = this.getView();
    if (!this.enabled || v.zoom >= WORLD_MAX_ZOOM) return;
    const q = worldQuery(v);
    const band = Math.round(v.zoom * 2);
    const last = this.last;
    if (!force && last && Date.now() - last.at < POLL_MS - 2000 && last.zoomBand === band) {
      const b = last.box;
      const covered = b === null || (q.box !== null && q.box.lamin >= b.lamin && q.box.lamax <= b.lamax && q.box.lomin >= b.lomin && q.box.lomax <= b.lomax);
      if (covered) return;
    }
    this.inflight?.abort();
    this.inflight = new AbortController();
    const params = new URLSearchParams({ max: String(q.max) });
    if (q.box) for (const [k, val] of Object.entries(q.box)) params.set(k, val.toFixed(2));
    if (this.st.state !== 'live') {
      this.st = { ...this.st, state: 'loading' };
      this.onChange();
    }
    try {
      const res = await fetch(`/api/flights/world?${params}`, { signal: this.inflight.signal });
      if (!res.ok) throw new Error(String(res.status));
      this.apply((await res.json()) as Body);
      this.last = { box: q.box, zoomBand: band, at: Date.now() };
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      this.st = { ...this.st, state: this.map.size ? 'stale' : 'unavailable' };
    }
    this.onChange();
  }

  private apply(body: Body): void {
    const seen = new Set<string>();
    for (const r of body.aircraft) {
      const id = `w-${r[0]}`;
      seen.add(id);
      const rec: WorldRecord = { id, callsign: r[1], country: r[2], lat: r[3], lng: r[4], altM: r[5], gsMps: r[6], trackDeg: r[7], vrMps: r[8], posMs: r[9] * 1000 };
      const have = this.map.get(id);
      if (have) {
        have.rec = rec;
      } else {
        const pt = this.pts.add({
          position: Cartesian3.fromDegrees(rec.lng, rec.lat, rec.altM ?? 10_000),
          id: { kind: 'world', id },
          pixelSize: 3.5,
          color: SKY,
          outlineColor: Color.BLACK.withAlpha(0.4),
          outlineWidth: 1,
        });
        this.map.set(id, { rec, pt });
      }
    }
    for (const [id, e] of this.map) {
      if (!seen.has(id) && id !== this.selected) {
        this.pts.remove(e.pt);
        this.map.delete(id);
      }
    }
    this.st = {
      state: body.stale ? 'stale' : 'live',
      shown: body.aircraft.length,
      inView: body.inView,
      total: body.totalWorld,
      fetchedAt: body.fetchedAt,
      observedAt: body.observedAt,
      signedIn: body.signedIn,
      creditsLeft: body.creditsLeft,
    };
    this.setSelected(this.selected);
  }

  /** Move every point along its last track for the time since its fix, up to two minutes. */
  update(nowMs: number): void {
    const show = this.active();
    this.pts.show = show;
    if (!show) return;
    for (const { rec, pt } of this.map.values()) {
      const age = Math.max(0, Math.min(COAST_MAX_S, (nowMs - rec.posMs) / 1000));
      let { lng, lat } = rec;
      if (rec.gsMps !== null && rec.gsMps > 20 && rec.trackDeg !== null) [lng, lat] = advance(rec.lng, rec.lat, rec.trackDeg, rec.gsMps * age);
      pt.position = Cartesian3.fromDegrees(lng, lat, rec.altM ?? 10_000);
    }
  }

  destroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.inflight?.abort();
    this.scene.primitives.remove(this.pts);
  }
}
