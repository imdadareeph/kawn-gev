// Orbital objects: CelesTrak element sets (via the local /api/satellites proxy) propagated in the browser with SGP4.
// Positions are computed from the element set epoch, so they drift as the data ages; the layer says so.
import {
  Cartesian3,
  Color,
  Material,
  Matrix3,
  Matrix4,
  PolylineCollection,
  LabelCollection,
  LabelStyle,
  PointPrimitiveCollection,
  VerticalOrigin,
  Cartesian2,
  type PointPrimitive,
  type Label,
  type Scene,
} from 'cesium';
import { ecfToLookAngles, eciToEcf, eciToGeodetic, gstime, json2satrec, propagate, type SatRec } from 'satellite.js';
import { SAT_CLASS, type OmmRecord } from '../../shared/satellites.mjs';
import { nextPass, type Pass } from './passes';
import { ownersFor } from '../data/countries';

export type SatState = 'idle' | 'loading' | 'live' | 'stale' | 'unavailable';
export interface SatStatus {
  state: SatState;
  count: number;
  /** Objects above the horizon at the map centre. */
  above: number;
  fetchedAt: number | null;
  /** Median age of the element sets, in hours. */
  ageHours: number | null;
  /** Satellites drawn after the country filter. */
  shown: number;
  /** Starlink points mode. */
  dense: 'off' | 'loading' | 'on' | 'unavailable';
  denseCount: number;
}

export type SatClass = 'station' | 'visual' | 'nav' | 'geo' | 'dense';

/** One colour per class: dot, card label and legend swatch all read from here so they cannot disagree. */
export const CLASS_COLOR: Record<SatClass, string> = {
  station: '#ffd37a',
  visual: '#8fd0ff',
  nav: '#7be495',
  geo: '#c9a7ff',
  dense: '#9aa8b8',
};
const CLASS_SIZE: Record<SatClass, number> = { station: 9, visual: 5, nav: 6, geo: 5, dense: 3 };
const classColor = (c: SatClass): Color => Color.fromCssColorString(CLASS_COLOR[c]).withAlpha(c === 'dense' ? 0.75 : 0.95);
const DENSE_CHUNK = 1500;
const DENSE_PASSES = 5;

const STATION = /\b(ISS|ZARYA|CSS|TIANHE|TIANGONG|MENGTIAN|WENTIAN)\b/i;
const TICK_MS = 1000;
const RAD = Math.PI / 180;

interface Sat {
  name: string;
  id: number;
  rec: SatRec;
  station: boolean;
  cls: SatClass;
  owners: string[];
  epochMs: number;
  meanMotion: number;
  inclination: number;
  ecc: number;
  pt: PointPrimitive;
  label: Label | null;
}

export interface SatInfo {
  name: string;
  noradId: number;
  lat: number;
  lng: number;
  altKm: number;
  speedKmS: number;
  periodMin: number;
  inclinationDeg: number;
  elementAgeH: number;
  elevDeg: number;
  station: boolean;
  cls: SatClass;
  owners: string[];
  /** Next pass over the observer: undefined while not computed, null when none within 24 h, 'geo' when it never moves. */
  pass: Pass | null | 'geo' | undefined;
}

export interface SatPosition {
  lat: number;
  lng: number;
  altKm: number;
  /** Speed over the inertial frame, km/s. */
  speedKmS: number;
  /** Degrees above the horizon at the observer, negative when below. */
  elevDeg: number;
}

/** Sub-satellite point and elevation for one element set; null when SGP4 rejects it (decayed, bad elements). */
export function positionAt(rec: SatRec, when: Date, observer: { lat: number; lng: number } | null): SatPosition | null {
  const pv = propagate(rec, when);
  if (!pv || typeof pv !== 'object' || !('position' in pv) || !pv.position) return null;
  const gmst = gstime(when);
  const geo = eciToGeodetic(pv.position, gmst);
  if (![geo.latitude, geo.longitude, geo.height].every(Number.isFinite)) return null;
  let elevDeg = -90;
  if (observer) {
    const look = ecfToLookAngles(
      { latitude: observer.lat * RAD, longitude: observer.lng * RAD, height: 0 },
      eciToEcf(pv.position, gmst),
    );
    elevDeg = look.elevation / RAD;
  }
  const v = pv.velocity as { x: number; y: number; z: number } | undefined;
  const speedKmS = v ? Math.hypot(v.x, v.y, v.z) : 0;
  return { lat: geo.latitude / RAD, lng: geo.longitude / RAD, altKm: geo.height, speedKmS, elevDeg };
}

export class SatelliteLayer {
  private pts = new PointPrimitiveCollection();
  private labels = new LabelCollection();
  private sats: Sat[] = [];
  private on = false;
  private lastTick = 0;
  private started = false;
  private abort: AbortController | null = null;
  private dense = new PointPrimitiveCollection();
  private denseSats: { rec: SatRec; pt: PointPrimitive }[] = [];
  private denseOn = false;
  private country = '';
  private denseStarted = false;
  private denseCursor = 0;
  private bakedGmst = 0;
  private bakedSim = 0;
  private passCache: { key: string; at: number; pass: Pass | null } | null = null;
  private orbit = new PolylineCollection();
  private orbitLine: ReturnType<PolylineCollection['add']> | null = null;
  private selected: Sat | null = null;
  private scale = 1;
  private anchorReal = Date.now();
  private anchorSim = Date.now();
  private lastObserver: { lat: number; lng: number } | null = null;
  private st: SatStatus = { state: 'idle', count: 0, above: 0, fetchedAt: null, ageHours: null, dense: 'off', denseCount: 0, shown: 0 };
  onChange: () => void = () => undefined;

  constructor(private scene: Scene) {
    scene.primitives.add(this.pts);
    scene.primitives.add(this.labels);
    scene.primitives.add(this.orbit);
    scene.primitives.add(this.dense);
    this.dense.show = false;
    this.pts.show = false;
    this.labels.show = false;
  }

  status(): SatStatus {
    return this.st;
  }

  /** The time the satellites are drawn at: real time, or faster when a time-lapse is chosen. */
  simTime(realMs: number = Date.now()): number {
    return this.anchorSim + (realMs - this.anchorReal) * this.scale;
  }

  timeScale(): number {
    return this.scale;
  }

  setTimeScale(scale: number): void {
    const real = Date.now();
    this.anchorSim = this.simTime(real);
    this.anchorReal = real;
    this.scale = scale;
    this.lastTick = 0;
  }

  setSelected(id: string | null): void {
    const sat = id ? (this.sats.find((x) => `sat-${x.id}` === id) ?? null) : null;
    if (this.selected && this.selected !== sat) {
      this.selected.pt.pixelSize = CLASS_SIZE[this.selected.cls];
      this.selected.pt.color = classColor(this.selected.cls);
    }
    this.selected = sat;
    if (sat) {
      sat.pt.pixelSize = 12;
      sat.pt.color = Color.fromCssColorString('#2ee6c5');
    }
    if (this.orbitLine) this.orbitLine.show = !!sat;
    this.passCache = null;
    if (sat) this.bakeOrbit(this.simTime(Date.now()));
  }

  /** Countries present in the loaded catalog with how many satellites each has, most first. A joint programme counts for each partner. */
  countries(): { code: string; count: number }[] {
    const m = new Map<string, number>();
    for (const x of this.sats) for (const c of x.owners) m.set(c, (m.get(c) ?? 0) + 1);
    if (this.denseSats.length) m.set('US', (m.get('US') ?? 0) + this.denseSats.length);
    return [...m].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  }

  /** Show only satellites of one country ('' for all). */
  setCountry(code: string): void {
    this.country = code;
    this.dense.show = this.on && this.denseOn && (!code || code === 'US');
    this.lastTick = 0;
  }

  matches(id: string): boolean {
    if (!this.country) return true;
    const x = this.sats.find((y) => `sat-${y.id}` === id);
    return !!x && x.owners.includes(this.country);
  }

  /** Sub-satellite point only: cheap, used to keep the camera on a followed satellite. */
  where(id: string): { lat: number; lng: number } | null {
    const sat = this.sats.find((x) => `sat-${x.id}` === id);
    const p = sat ? positionAt(sat.rec, new Date(this.simTime(Date.now())), null) : null;
    return p ? { lat: p.lat, lng: p.lng } : null;
  }

  /** Details for the selection card, computed for the current simulated time. */
  info(id: string, observer: { lat: number; lng: number } | null = this.lastObserver): SatInfo | null {
    const sat = this.sats.find((x) => `sat-${x.id}` === id);
    if (!sat) return null;
    const simMs = this.simTime(Date.now());
    const p = positionAt(sat.rec, new Date(simMs), observer);
    if (!p) return null;
    return {
      cls: sat.cls,
      owners: sat.owners,
      pass: this.passFor(sat, observer, simMs),
      name: sat.name,
      noradId: sat.id,
      lat: p.lat,
      lng: p.lng,
      altKm: p.altKm,
      speedKmS: p.speedKmS,
      periodMin: 1440 / sat.meanMotion,
      inclinationDeg: sat.inclination,
      elementAgeH: (simMs - sat.epochMs) / 3.6e6,
      elevDeg: p.elevDeg,
      station: sat.station,
    };
  }

  /** Next pass over the observer. Cached per satellite and rounded location; recomputed once it has gone by. */
  private passFor(sat: Sat, observer: { lat: number; lng: number } | null, simMs: number): Pass | null | 'geo' | undefined {
    if (!observer) return undefined;
    if (sat.cls === 'geo' || sat.meanMotion < 1.2) return 'geo';
    const key = `${sat.id}|${observer.lat.toFixed(1)},${observer.lng.toFixed(1)}`;
    const c = this.passCache;
    if (c && c.key === key && (c.pass === null ? simMs - c.at < 600_000 : simMs < c.pass.setMs)) return c.pass;
    const pass = nextPass(sat.rec, observer, simMs);
    this.passCache = { key, at: simMs, pass };
    return pass;
  }

  /**
   * Bake one full orbit as a closed ring in the Earth-fixed frame of `simMs`. Afterwards only a rotation about the polar axis
   * keeps it aligned with the turning Earth, so the ring is neither rebuilt nor re-propagated each tick.
   */
  private bakeOrbit(simMs: number): void {
    const sat = this.selected;
    if (!sat) return;
    const periodMs = (1440 / sat.meanMotion) * 60_000;
    const gmst = gstime(new Date(simMs));
    const pts: Cartesian3[] = [];
    const N = 180;
    for (let i = 0; i <= N; i++) {
      const pv = propagate(sat.rec, new Date(simMs + (periodMs * i) / N));
      if (!pv || typeof pv !== 'object' || !('position' in pv) || !pv.position) continue;
      const ecf = eciToEcf(pv.position, gmst);
      pts.push(new Cartesian3(ecf.x * 1000, ecf.y * 1000, ecf.z * 1000));
    }
    if (pts.length < 3) return;
    this.bakedGmst = gmst;
    this.bakedSim = simMs;
    if (!this.orbitLine) {
      this.orbitLine = this.orbit.add({
        positions: pts,
        width: 2.5,
        material: Material.fromType('Color', { color: Color.fromCssColorString('#2ee6c5').withAlpha(0.85) }),
      });
    } else {
      this.orbitLine.positions = pts;
      this.orbitLine.show = true;
    }
    this.orbit.modelMatrix = Matrix4.IDENTITY.clone();
  }

  /** Rotate the baked ring to the Earth orientation of `simMs`; rebake when the time has moved far from the bake. */
  private turnOrbit(simMs: number): void {
    if (!this.selected) return;
    if (Math.abs(simMs - this.bakedSim) > 20 * 60_000) {
      this.bakeOrbit(simMs);
      return;
    }
    const delta = gstime(new Date(simMs)) - this.bakedGmst;
    this.orbit.modelMatrix = Matrix4.fromRotationTranslation(Matrix3.fromRotationZ(-delta), Cartesian3.ZERO, this.orbit.modelMatrix);
  }

  setEnabled(on: boolean): void {
    this.on = on;
    this.pts.show = on;
    this.labels.show = on;
    this.dense.show = on && this.denseOn && (!this.country || this.country === 'US');
    if (!on) {
      this.abort?.abort();
      if (this.st.state === 'loading') this.st = { ...this.st, state: 'idle' };
      this.started = false;
      this.onChange();
      return;
    }
    if (!this.started) void this.load();
    if (this.denseOn && !this.denseStarted) void this.loadDense();
  }

  /** Starlink shell as small dim points. Loaded in chunks and propagated a fifth at a time, so the page stays responsive. */
  setDense(on: boolean): void {
    this.denseOn = on;
    this.dense.show = on && this.on && (!this.country || this.country === 'US');
    if (!on) {
      this.st = { ...this.st, dense: 'off' };
      this.onChange();
      return;
    }
    if (this.on && !this.denseStarted) void this.loadDense();
    else this.st = { ...this.st, dense: this.denseSats.length ? 'on' : this.st.dense };
    this.onChange();
  }

  private async loadDense(): Promise<void> {
    this.denseStarted = true;
    this.st = { ...this.st, dense: 'loading' };
    this.onChange();
    try {
      const res = await fetch('/api/satellites?set=dense', { signal: this.abort?.signal });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { satellites: OmmRecord[] };
      this.dense.removeAll();
      this.denseSats = [];
      for (let i = 0; i < body.satellites.length; i += DENSE_CHUNK) {
        for (const o of body.satellites.slice(i, i + DENSE_CHUNK)) {
          try {
            const rec = json2satrec(o as never);
            const pt = this.dense.add({ position: Cartesian3.fromDegrees(0, 0, 500_000), pixelSize: CLASS_SIZE.dense, color: classColor('dense'), show: false });
            this.denseSats.push({ rec, pt });
          } catch {
            /* skip an element set SGP4 cannot read */
          }
        }
        await new Promise((r) => setTimeout(r, 0)); // let the page paint between chunks
        if (!this.denseOn) break;
      }
      this.st = { ...this.st, dense: this.denseOn ? 'on' : 'off', denseCount: this.denseSats.length };
      this.denseCursor = 0;
    } catch {
      this.denseStarted = false;
      this.st = { ...this.st, dense: this.denseOn ? 'unavailable' : 'off' };
    }
    this.onChange();
  }

  private async load(): Promise<void> {
    this.started = true;
    this.st = { ...this.st, state: 'loading' };
    this.onChange();
    this.abort = new AbortController();
    try {
      const res = await fetch('/api/satellites', { signal: this.abort.signal });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { satellites: OmmRecord[]; fetchedAt: number; stale?: boolean };
      this.build(body.satellites);
      const ages = this.sats.map((x) => (Date.now() - x.epochMs) / 3.6e6).sort((x, y) => x - y);
      this.st = {
        ...this.st,
        state: body.stale ? 'stale' : 'live',
        count: this.sats.length,
        above: 0,
        fetchedAt: body.fetchedAt,
        ageHours: ages.length ? ages[Math.floor(ages.length / 2)] : null,
      };
      this.lastTick = 0;
    } catch {
      if (!this.on) return;
      this.started = false;
      this.st = { ...this.st, state: this.sats.length ? 'stale' : 'unavailable', count: this.sats.length, above: 0 };
    }
    this.onChange();
  }

  /** Objects per class, for the legend. */
  classCounts(): Record<SatClass, number> {
    const out: Record<SatClass, number> = { station: 0, visual: 0, nav: 0, geo: 0, dense: this.denseSats.length };
    for (const x of this.sats) out[x.cls]++;
    return out;
  }

  private build(list: OmmRecord[]): void {
    this.pts.removeAll();
    this.labels.removeAll();
    this.sats = [];
    for (const o of list) {
      let rec: SatRec;
      try {
        rec = json2satrec(o as never);
      } catch {
        continue;
      }
      const station = STATION.test(o.OBJECT_NAME);
      const cls: SatClass = station ? 'station' : ((SAT_CLASS[o.GROUP] as SatClass | undefined) ?? 'visual');
      const pt = this.pts.add({
        position: Cartesian3.fromDegrees(0, 0, 400_000),
        id: { kind: 'satellite', id: `sat-${o.NORAD_CAT_ID}` },
        pixelSize: CLASS_SIZE[cls],
        color: classColor(cls),
        outlineColor: Color.BLACK.withAlpha(0.55),
        outlineWidth: station ? 2 : 1,
        show: false,
      });
      let label: Label | null = null;
      if (station) {
        label = this.labels.add({
          position: Cartesian3.fromDegrees(0, 0, 400_000),
          text: o.OBJECT_NAME.replace(/\s*\(.*\)\s*/, ''),
          font: '500 11px "IBM Plex Mono", monospace',
          fillColor: Color.fromCssColorString('#ffe9b8'),
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -10),
          show: false,
        });
      }
      this.sats.push({ name: o.OBJECT_NAME, id: o.NORAD_CAT_ID, rec, station, cls, owners: ownersFor(o.OWNER, o.GROUP, o.OBJECT_NAME), meanMotion: o.MEAN_MOTION, inclination: o.INCLINATION, ecc: o.ECCENTRICITY, epochMs: Date.parse(o.EPOCH.endsWith('Z') ? o.EPOCH : `${o.EPOCH}Z`), pt, label });
    }
  }

  /** Call every frame; the core catalog refreshes once a second (every frame in time-lapse). */
  update(realMs: number, observer: { lat: number; lng: number } | null): void {
    this.lastObserver = observer;
    if (!this.on || realMs - this.lastTick < (this.scale > 1 ? 0 : TICK_MS)) return;
    this.lastTick = realMs;
    const simMs = this.simTime(realMs);
    const when = new Date(simMs);
    this.turnOrbit(simMs);
    let above = 0;
    let shown = 0;
    for (const x of this.sats) {
      if (this.country && !x.owners.includes(this.country)) {
        x.pt.show = false;
        if (x.label) x.label.show = false;
        continue;
      }
      const p = positionAt(x.rec, when, observer);
      if (!p) {
        x.pt.show = false;
        if (x.label) x.label.show = false;
        continue;
      }
      const pos = Cartesian3.fromDegrees(p.lng, p.lat, p.altKm * 1000);
      x.pt.position = pos;
      x.pt.show = true;
      if (x.label) {
        x.label.position = pos;
        x.label.show = true;
      }
      shown++;
      if (p.elevDeg > 0) above++;
    }
    if (this.denseOn && this.dense.show && this.denseSats.length) {
      // A fifth of the shell per tick, round-robin, so a full refresh takes about five ticks.
      const n = Math.ceil(this.denseSats.length / DENSE_PASSES);
      for (let k = 0; k < n; k++) {
        const d = this.denseSats[(this.denseCursor + k) % this.denseSats.length];
        const p = positionAt(d.rec, when, null);
        if (!p) {
          d.pt.show = false;
          continue;
        }
        d.pt.position = Cartesian3.fromDegrees(p.lng, p.lat, p.altKm * 1000);
        d.pt.show = true;
      }
      this.denseCursor = (this.denseCursor + n) % this.denseSats.length;
    }
    if (above !== this.st.above || shown !== this.st.shown) {
      this.st = { ...this.st, above, shown };
      this.onChange();
    }
  }

  destroy(): void {
    this.abort?.abort();
    this.scene.primitives.remove(this.pts);
    this.scene.primitives.remove(this.labels);
    this.scene.primitives.remove(this.orbit);
    this.scene.primitives.remove(this.dense);
  }
}
