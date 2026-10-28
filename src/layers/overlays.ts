// Everything drawn on the globe: aircraft, transit, estate columns, labels, selection ring and trail.
// Static geometry is built once; moving things are pooled and updated each frame.
import {
  BillboardCollection,
  Cartesian2,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  CylinderGeometry,
  DistanceDisplayCondition,
  GeometryInstance,
  HorizontalOrigin,
  LabelCollection,
  LabelStyle,
  Material,
  PerInstanceColorAppearance,
  PointPrimitive,
  PointPrimitiveCollection,
  PolylineCollection,
  Primitive,
  Transforms,
  VerticalOrigin,
  type Billboard,
  type Label,
  type Polyline,
} from 'cesium';
import type { Lang } from '../brand';
import { AIRPORTS, DISTRICTS } from '../places';
import { ESTATE_SITES } from '../data/estate-sample';
import { TRANSIT_ROUTES } from '../data/transit-sample';
import { KIND_COLOR, PARKING_LOTS, type ParkingKind } from '../data/parking-sample';
import { labelAlpha, type ScopeParams } from '../map/scope';
import type { Globe } from '../map/globe';
import type { Theme } from '../state';
import type { DisplayAircraft } from './flights';
import type { Vehicle } from './transit';

type RGB = [number, number, number];

export const COLORS = {
  accent: [46, 230, 197] as RGB,
  sky: [88, 182, 255] as RGB,
  gold: [224, 177, 90] as RGB,
  danger: [255, 107, 107] as RGB,
  dim: [120, 140, 160] as RGB,
};

export type PickKind = 'flight' | 'transit' | 'estate' | 'parking' | 'satellite' | 'world';

export type FreeLevelName = 'plenty' | 'few' | 'full';

export interface ParkingMark {
  id: string;
  lat: number;
  lng: number;
  level: FreeLevelName;
  kind: ParkingKind;
  /** Already formatted for the current language and numerals, e.g. "128". */
  text: string;
}
export interface PickTag {
  kind: PickKind;
  id: string;
}

export interface OverlayFrame {
  flightsOn: boolean;
  transitOn: boolean;
  estateOn: boolean;
  aircraft: DisplayAircraft[];
  selectedFlight: string | null;
  /** Hide the selected aircraft's own marker (cockpit view: you are inside it). */
  hideSelectedPlane?: boolean;
  selected: PickTag | null;
  trail: [number, number, number][];
  vehicles: Vehicle[];
  scope: ScopeParams | null;
  theme: Theme;
  parkingOn: boolean;
  parking: ParkingMark[];
  me: { lat: number; lng: number } | null;
  /** [lng, lat] vertices of the active route. */
  route: [number, number][] | null;
  routeStraight: boolean;
}

const css = (c: RGB, a = 1) => new Color(c[0] / 255, c[1] / 255, c[2] / 255, a);
const FT = 0.3048;

let planeUrl: string | null = null;
/** One white plane silhouette drawn at runtime and tinted per aircraft (no external assets). */
function planeImage(): string {
  if (planeUrl) return planeUrl;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#fff';
    g.beginPath();
    const pts: [number, number][] = [
      [32, 3], [36, 20], [60, 38], [60, 44], [36, 36], [35, 52], [44, 58], [44, 62], [32, 58],
      [20, 62], [20, 58], [29, 52], [28, 36], [4, 44], [4, 38], [28, 20],
    ];
    pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
    g.closePath();
    g.fill();
  }
  planeUrl = c.toDataURL('image/png');
  return planeUrl;
}

function flightColor(a: DisplayAircraft, selected: boolean): Color {
  if (selected) return css(COLORS.accent);
  if (a.emergency) return css(COLORS.danger);
  if (a.demo) return css(COLORS.gold, 0.92);
  if (a.onGround) return css(COLORS.dim, 0.6);
  return css(COLORS.sky, a.stale ? 0.45 : 0.96);
}

function priceColor(idx: number): Color {
  const t = Math.min(1, Math.max(0, (idx - 20) / 70));
  const lo = COLORS.accent;
  const hi = COLORS.gold;
  return css([lo[0] + (hi[0] - lo[0]) * t, lo[1] + (hi[1] - lo[1]) * t, lo[2] + (hi[2] - lo[2]) * t] as RGB, 0.85);
}

const PLACE_TEXT: Record<Theme, { text: Color; halo: Color; estate: Color; airport: Color }> = {
  dark: { text: Color.fromCssColorString('#e2eaf2'), halo: Color.fromCssColorString('#080c11'), estate: Color.fromCssColorString('#e0b15a'), airport: Color.fromCssColorString('#7cc4ff') },
  contrast: { text: Color.fromCssColorString('#ffffff'), halo: Color.fromCssColorString('#000000'), estate: Color.fromCssColorString('#ffd37a'), airport: Color.fromCssColorString('#8fd0ff') },
  light: { text: Color.fromCssColorString('#1a222c'), halo: Color.fromCssColorString('#f6f4ef'), estate: Color.fromCssColorString('#8a5f10'), airport: Color.fromCssColorString('#0b5a9e') },
};

const MONO = '500 11px "IBM Plex Mono", monospace';

export class Overlays {
  private scene;
  private lines = new PolylineCollection();
  private stops = new PointPrimitiveCollection();
  private vehiclesPts = new PointPrimitiveCollection();
  private vehicleMap = new Map<string, PointPrimitive>();
  private planes = new BillboardCollection({ scene: undefined as never });
  private planeMap = new Map<string, Billboard>();
  private callsigns = new LabelCollection();
  private callsignPool: Label[] = [];
  private airportPts = new PointPrimitiveCollection();
  private airportLabels = new LabelCollection();
  private estateLabels = new LabelCollection();
  private stationLabels = new LabelCollection();
  private estatePrims: Primitive[] = [];
  private ring = new PointPrimitiveCollection();
  private ringPt: PointPrimitive;
  private trailLines = new PolylineCollection();
  private trailLine: Polyline | null = null;
  private trailKey = '';
  private lineObjs: Polyline[] = [];
  private parkPts = new PointPrimitiveCollection();
  private parkLabels = new LabelCollection();
  private parkMap = new Map<string, { pt: PointPrimitive; label: Label }>();
  private mePts = new PointPrimitiveCollection();
  private meDot: PointPrimitive;
  private meRing: PointPrimitive;
  private routeLines = new PolylineCollection();
  private routeKey = '';
  private lang: Lang = 'en';
  private theme: Theme = 'dark';

  constructor(private globe: Globe) {
    this.scene = globe.widget.scene;
    this.planes = new BillboardCollection({ scene: this.scene });
    const p = this.scene.primitives;

    for (const r of TRANSIT_ROUTES) {
      const line = this.lines.add({
        positions: Cartesian3.fromDegreesArrayHeights(r.path.flatMap(([lng, lat]) => [lng, lat, 14])),
        width: 3.2,
        material: Material.fromType('Color', { color: css(r.color, 0.72) }),
      });
      this.lineObjs.push(line);
    }
    const main = TRANSIT_ROUTES[0];
    for (const s of main.stops ?? []) {
      this.stops.add({
        position: Cartesian3.fromDegrees(s.lng, s.lat, 16),
        pixelSize: 8,
        color: Color.fromCssColorString('#0b0f14'),
        outlineColor: css(main.color),
        outlineWidth: 2,
        distanceDisplayCondition: new DistanceDisplayCondition(0, 70_000),
      });
    }

    for (const a of AIRPORTS) {
      this.airportPts.add({
        position: Cartesian3.fromDegrees(a.lng, a.lat, 20),
        pixelSize: 6,
        color: css(COLORS.sky, 0.9),
        outlineColor: Color.BLACK.withAlpha(0.6),
        outlineWidth: 1,
        distanceDisplayCondition: new DistanceDisplayCondition(0, 4_000_000),
      });
    }

    for (const s of ESTATE_SITES) {
      const length = 40 + s.activityIdx * 16;
      const pos = Cartesian3.fromDegrees(s.lng, s.lat, length / 2);
      const prim = new Primitive({
        geometryInstances: new GeometryInstance({
          geometry: new CylinderGeometry({ length, topRadius: 260, bottomRadius: 260, slices: 20, vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT }),
          modelMatrix: Transforms.eastNorthUpToFixedFrame(pos),
          attributes: { color: ColorGeometryInstanceAttribute.fromColor(priceColor(s.priceIdx)) },
          id: { kind: 'estate', id: s.id } satisfies PickTag,
        }),
        appearance: new PerInstanceColorAppearance({ flat: false, translucent: true }),
        asynchronous: false,
        show: false,
      });
      this.estatePrims.push(prim);
      p.add(prim);
    }

    this.ringPt = this.ring.add({
      position: Cartesian3.fromDegrees(0, 0, 0),
      pixelSize: 44,
      color: Color.TRANSPARENT,
      outlineColor: css(COLORS.accent),
      outlineWidth: 2,
      show: false,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });

    this.meRing = this.mePts.add({
      position: Cartesian3.ZERO,
      pixelSize: 34,
      color: css(COLORS.sky, 0.16),
      outlineColor: css(COLORS.sky, 0.8),
      outlineWidth: 2,
      show: false,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
    this.meDot = this.mePts.add({
      position: Cartesian3.ZERO,
      pixelSize: 14,
      color: css(COLORS.sky),
      outlineColor: Color.WHITE,
      outlineWidth: 3,
      show: false,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });

    for (const c of [this.routeLines, this.parkPts, this.parkLabels, this.mePts, this.lines, this.stops, this.airportPts, this.airportLabels, this.estateLabels, this.stationLabels, this.trailLines, this.vehiclesPts, this.planes, this.callsigns, this.ring]) {
      p.add(c);
    }
    this.stops.show = false;
    this.lines.show = false;
    this.vehiclesPts.show = false;
    this.rebuildStatic();
  }

  setLook(lang: Lang, theme: Theme): void {
    this.lang = lang;
    this.theme = theme;
    this.rebuildStatic();
  }

  private font(weight = 600, size = 12): string {
    return this.lang === 'ar' ? `${weight} ${size + 1}px "IBM Plex Sans Arabic", sans-serif` : `${weight} ${size}px "IBM Plex Sans Arabic", sans-serif`;
  }

  private rebuildStatic(): void {
    const pal = PLACE_TEXT[this.theme];
    const ar = this.lang === 'ar';
    const base = {
      style: LabelStyle.FILL_AND_OUTLINE,
      outlineWidth: 3,
      outlineColor: pal.halo,
      verticalOrigin: VerticalOrigin.CENTER,
      horizontalOrigin: HorizontalOrigin.LEFT,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    };
    this.airportLabels.removeAll();
    for (const a of AIRPORTS) {
      this.airportLabels.add({
        ...base,
        position: Cartesian3.fromDegrees(a.lng, a.lat, 20),
        text: `${a.code} · ${ar ? a.ar : a.en}`,
        font: this.font(),
        fillColor: pal.airport,
        pixelOffset: new Cartesian2(10, 0),
        distanceDisplayCondition: new DistanceDisplayCondition(0, 260_000),
      });
    }
    this.estateLabels.removeAll();
    for (const s of ESTATE_SITES) {
      const d = DISTRICTS.find((x) => x.id === s.id);
      this.estateLabels.add({
        ...base,
        position: Cartesian3.fromDegrees(s.lng, s.lat, 40 + s.activityIdx * 16 + 30),
        text: (ar ? d?.ar : d?.en) ?? s.id,
        font: this.font(),
        fillColor: pal.estate,
        pixelOffset: new Cartesian2(0, -4),
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.BOTTOM,
        distanceDisplayCondition: new DistanceDisplayCondition(0, 140_000),
      });
    }
    this.stationLabels.removeAll();
    for (const r of TRANSIT_ROUTES) {
      for (const s of r.stops ?? []) {
        this.stationLabels.add({
          ...base,
          position: Cartesian3.fromDegrees(s.lng, s.lat, 20),
          text: ar ? s.ar : s.en,
          font: this.font(500, 11),
          fillColor: pal.text,
          pixelOffset: new Cartesian2(9, 0),
          distanceDisplayCondition: new DistanceDisplayCondition(0, 16_000),
        });
      }
    }
    for (const l of this.callsignPool) this.callsigns.remove(l);
    this.callsignPool = [];
    this.stops.get(0); // keep reference alive
    const dark = this.theme !== 'light';
    for (let i = 0; i < this.stops.length; i += 1) this.stops.get(i).color = dark ? Color.fromCssColorString('#0b0f14') : Color.WHITE;
  }

  /** Apply the per-layer switches and refresh everything that moves. */
  update(f: OverlayFrame, bearing: number): void {
    this.theme = f.theme;
    this.lines.show = f.transitOn;
    this.stops.show = f.transitOn;
    this.vehiclesPts.show = f.transitOn;
    this.stationLabels.show = f.transitOn;
    this.estateLabels.show = f.estateOn;
    for (const e of this.estatePrims) e.show = f.estateOn;
    this.planes.show = f.flightsOn;
    this.callsigns.show = f.flightsOn;

    this.updateParking(f);
    this.updateRoute(f);
    this.updateVehicles(f);
    this.updatePlanes(f, bearing);
    this.updateTrail(f);
    this.updateRing(f);
  }

  private updateParking(f: OverlayFrame): void {
    const anyPark = f.parkingOn && f.parking.length > 0;
    this.parkPts.show = anyPark;
    this.parkLabels.show = anyPark;
    const me = f.me;
    this.meDot.show = !!me;
    this.meRing.show = !!me;
    if (me) {
      const at = Cartesian3.fromDegrees(me.lng, me.lat, 8);
      this.meDot.position = at;
      this.meRing.position = at;
    }
    if (!anyPark) return;
    const shown = new Set(f.parking.map((m) => m.id));
    for (const [id, e] of this.parkMap) {
      const on = shown.has(id);
      e.pt.show = on;
      e.label.show = on;
    }
    const pal = PLACE_TEXT[f.theme];
    const col: Record<FreeLevelName, Color> = {
      plenty: Color.fromCssColorString('#35d07f'),
      few: Color.fromCssColorString('#e0b15a'),
      full: Color.fromCssColorString('#ff6b6b'),
    };
    for (const m of f.parking) {
      let e = this.parkMap.get(m.id);
      const pos = Cartesian3.fromDegrees(m.lng, m.lat, 25);
      if (!e) {
        const pt = this.parkPts.add({
          position: pos,
          pixelSize: 22,
          color: Color.fromCssColorString(KIND_COLOR[m.kind]),
          outlineColor: col[m.level],
          outlineWidth: 4,
          id: { kind: 'parking', id: m.id } satisfies PickTag,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
        const label = this.parkLabels.add({
          position: pos,
          text: m.text,
          font: '600 12px "IBM Plex Mono", monospace',
          style: LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 3,
          horizontalOrigin: HorizontalOrigin.LEFT,
          verticalOrigin: VerticalOrigin.CENTER,
          pixelOffset: new Cartesian2(16, 0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new DistanceDisplayCondition(0, 60_000),
        });
        e = { pt, label };
        this.parkMap.set(m.id, e);
      }
      e.pt.color = Color.fromCssColorString(KIND_COLOR[m.kind]);
      e.pt.outlineColor = col[m.level];
      e.label.text = m.text;
      e.pt.show = true;
      e.label.show = true;
      e.label.fillColor = pal.text;
      e.label.outlineColor = pal.halo;
    }
  }

  private updateRoute(f: OverlayFrame): void {
    const r = f.route;
    const key = r ? `${r.length}:${r[0][0]}:${r[r.length - 1][0]}:${f.routeStraight}` : '';
    if (key === this.routeKey) return;
    this.routeKey = key;
    this.routeLines.removeAll();
    if (!r) return;
    this.routeLines.add({
      positions: Cartesian3.fromDegreesArrayHeights(r.flatMap(([lng, lat]) => [lng, lat, 22])),
      width: f.routeStraight ? 4 : 7,
      material: f.routeStraight
        ? Material.fromType('PolylineDash', { color: css(COLORS.accent, 0.95), dashLength: 18 })
        : Material.fromType('PolylineGlow', { color: css(COLORS.accent, 0.95), glowPower: 0.22 }),
    });
  }

  private updateVehicles(f: OverlayFrame): void {
    if (!f.transitOn) return;
    const dark = f.theme !== 'light';
    const seen = new Set<string>();
    for (const v of f.vehicles) {
      seen.add(v.id);
      let pt = this.vehicleMap.get(v.id);
      const pos = Cartesian3.fromDegrees(v.lng, v.lat, 18);
      if (!pt) {
        pt = this.vehiclesPts.add({
          position: pos,
          pixelSize: v.mode === 'metro' ? 14 : 12,
          color: css(v.color),
          outlineColor: dark ? Color.WHITE.withAlpha(0.9) : Color.fromCssColorString('#14181d'),
          outlineWidth: 2,
          id: { kind: 'transit', id: v.id } satisfies PickTag,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
        this.vehicleMap.set(v.id, pt);
      } else {
        pt.position = pos;
        pt.outlineColor = dark ? Color.WHITE.withAlpha(0.9) : Color.fromCssColorString('#14181d');
      }
    }
    for (const [id, pt] of this.vehicleMap) {
      if (!seen.has(id)) {
        this.vehiclesPts.remove(pt);
        this.vehicleMap.delete(id);
      }
    }
  }

  private updatePlanes(f: OverlayFrame, bearing: number): void {
    if (!f.flightsOn) return;
    const seen = new Set<string>();
    const zoomed = this.globe.getZoom() >= 8.5;
    const labelled: { d: DisplayAircraft; a: number; x: number }[] = [];
    const w = this.globe.getCanvas().clientWidth;
    const h = this.globe.getCanvas().clientHeight;
    for (const d of f.aircraft) {
      seen.add(d.id);
      const alt = d.onGround || d.altFt == null ? 5 : Math.max(5, d.altFt * FT);
      const pos = Cartesian3.fromDegrees(d.lng, d.lat, alt);
      const selected = d.id === f.selectedFlight;
      const size = selected ? 34 : d.onGround ? 15 : 26;
      let b = this.planeMap.get(d.id);
      if (!b) {
        b = this.planes.add({
          position: pos,
          image: planeImage(),
          id: { kind: 'flight', id: d.id } satisfies PickTag,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        });
        this.planeMap.set(d.id, b);
      }
      b.position = pos;
      b.scale = size / 64;
      b.rotation = -((d.angle - bearing) * Math.PI) / 180;
      b.color = flightColor(d, selected);
      b.show = !(selected && f.hideSelectedPlane);
      if (zoomed) {
        const s = this.globe.project(d.lng, d.lat, alt);
        if (s.x > -20 && s.y > -20 && s.x < w + 20 && s.y < h + 20) {
          const a = selected ? 1 : labelAlpha(s.x, s.y, f.scope);
          if (a > 0.06 && !(selected && f.hideSelectedPlane)) labelled.push({ d, a, x: alt });
        }
      }
    }
    for (const [id, b] of this.planeMap) {
      if (!seen.has(id)) {
        this.planes.remove(b);
        this.planeMap.delete(id);
      }
    }

    labelled.sort((p, q) => q.a - p.a);
    const top = labelled.slice(0, 110);
    const pal = PLACE_TEXT[f.theme];
    while (this.callsignPool.length < top.length) {
      this.callsignPool.push(
        this.callsigns.add({
          position: Cartesian3.ZERO,
          font: MONO,
          style: LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 3,
          horizontalOrigin: HorizontalOrigin.LEFT,
          verticalOrigin: VerticalOrigin.CENTER,
          pixelOffset: new Cartesian2(17, 0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        }),
      );
    }
    this.callsignPool.forEach((l, i) => {
      const it = top[i];
      if (!it) {
        l.show = false;
        return;
      }
      l.show = true;
      l.text = it.d.callsign;
      l.position = Cartesian3.fromDegrees(it.d.lng, it.d.lat, it.x);
      l.fillColor = pal.text.withAlpha(it.a);
      l.outlineColor = pal.halo.withAlpha(Math.min(0.9, it.a));
    });
  }

  private updateTrail(f: OverlayFrame): void {
    const on = f.flightsOn && !!f.selectedFlight && f.trail.length > 1;
    if (!on) {
      if (this.trailLine) this.trailLine.show = false;
      return;
    }
    const key = `${f.selectedFlight}:${f.trail.length}:${f.trail[f.trail.length - 1][0]}`;
    if (key === this.trailKey && this.trailLine) {
      this.trailLine.show = true;
      return;
    }
    this.trailKey = key;
    this.trailLines.removeAll();
    this.trailLine = this.trailLines.add({
      positions: Cartesian3.fromDegreesArrayHeights(f.trail.flatMap((p) => [p[0], p[1], Math.max(40, p[2] * FT)])),
      width: 2.5,
      material: Material.fromType('Color', { color: css(COLORS.accent, 0.82) }),
    });
  }

  private updateRing(f: OverlayFrame): void {
    let at: Cartesian3 | null = null;
    const s = f.selected;
    if (s?.kind === 'flight') {
      const a = f.aircraft.find((x) => x.id === s.id);
      if (a) at = Cartesian3.fromDegrees(a.lng, a.lat, a.onGround || a.altFt == null ? 5 : Math.max(5, a.altFt * FT));
    } else if (s?.kind === 'transit') {
      const v = f.vehicles.find((x) => x.id === s.id);
      if (v) at = Cartesian3.fromDegrees(v.lng, v.lat, 18);
    } else if (s?.kind === 'parking') {
      const l = PARKING_LOTS.find((x) => x.id === s.id);
      if (l) at = Cartesian3.fromDegrees(l.lng, l.lat, 25);
    } else if (s?.kind === 'estate') {
      const e = ESTATE_SITES.find((x) => x.id === s.id);
      if (e) at = Cartesian3.fromDegrees(e.lng, e.lat, 40 + e.activityIdx * 16 + 10);
    }
    this.ringPt.show = !!at && !(f.selected?.kind === 'flight' && f.hideSelectedPlane);
    if (at) this.ringPt.position = at;
  }

  /** What is under a screen point, or null for empty map. */
  pick(x: number, y: number): PickTag | null {
    const hit = this.scene.pick(new Cartesian2(x, y), 10, 10) as { id?: unknown; primitive?: { id?: unknown } } | undefined;
    const id = (hit?.id ?? hit?.primitive?.id) as PickTag | undefined;
    return id && typeof id === 'object' && 'kind' in id && 'id' in id ? id : null;
  }
}
