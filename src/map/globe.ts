// The 3D globe: a thin camera facade over CesiumJS that keeps the web-map vocabulary the rest of the app uses
// (centre, zoom, bearing, pitch, bounds, project). Imagery is keyless Esri World Imagery with an OSM fallback.
import { Looks } from '../looks';
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  CesiumWidget,
  Color,
  HeadingPitchRange,
  ImageryLayer,
  Math as CMath,
  Matrix4,
  Rectangle,
  SceneMode,
  SkyBox,
  ArcGisMapServerImageryProvider,
  Cesium3DTileset,
  CesiumTerrainProvider,
  Ion,
  JulianDate,
  IonResource,
  OpenStreetMapImageryProvider,
  type PerspectiveFrustum,
} from 'cesium';
import { haversineKm } from '../geo';
import type { ViewState } from '../share';
import type { ViewInfo } from '../layers/flights';
import type { Theme } from '../state';

export { DEFAULT_VIEW } from './defaults';

const ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';
const OSM = 'https://tile.openstreetmap.org/';
/** Keyless quantized-mesh terrain (Mapterhorn data via Re:Earth, CC BY 4.0). */
const TERRAIN = 'https://terrain.reearth.land/cesium-mesh/ellipsoid';
/** Google Photorealistic 3D Tiles through Cesium ion (needs a Cesium ion token). */
const ION_PHOTOREAL_ASSET = 2275207;
const MPP0 = 78271.517; // metres per pixel at zoom 0 for 512 px tiles on the equator
// Low enough to see the whole geostationary belt (about 42,000 km from Earth's centre) in one frame.
const MIN_ZOOM = -0.8;
const MAX_ZOOM = 19.5;
const rad = CMath.toRadians;
const deg = CMath.toDegrees;

export interface LngLat {
  lng: number;
  lat: number;
}

export interface Bounds {
  getSouth(): number;
  getWest(): number;
  getNorth(): number;
  getEast(): number;
  contains(p: [number, number]): boolean;
}

export interface CameraTarget {
  center?: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
  duration?: number;
}

type Listener = () => void;

const IMAGERY_LOOK: Record<Theme, { brightness: number; contrast: number; saturation: number; gamma: number }> = {
  dark: { brightness: 0.8, contrast: 1.12, saturation: 0.88, gamma: 1 },
  contrast: { brightness: 0.95, contrast: 1.25, saturation: 1, gamma: 1 },
  light: { brightness: 1, contrast: 1, saturation: 1, gamma: 1 },
};

/** A sparse, deterministic star field: black cube faces with a few dozen faint stars each. */
function spaceSkyBox(): SkyBox {
  const size = 1024;
  let seed = 20260;
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const face = (): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    if (!g) return c;
    g.fillStyle = '#000';
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 70; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const bright = 0.35 + rnd() * 0.65;
      const r = bright > 0.9 ? 1.6 : bright > 0.6 ? 1.1 : 0.7;
      const tint = rnd() < 0.2 ? '200,215,255' : rnd() < 0.3 ? '255,235,205' : '255,255,255';
      g.fillStyle = `rgba(${tint},${bright})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    return c;
  };
  return new SkyBox({
    sources: { positiveX: face(), negativeX: face(), positiveY: face(), negativeY: face(), positiveZ: face(), negativeZ: face() },
  });
}

/** A camera placement computed every frame by a driver. Heading and pitch are degrees; pitch is negative looking down. */
export type CameraPose =
  | { mode: 'orbit'; lng: number; lat: number; altM: number; heading: number; pitch: number; range: number }
  | { mode: 'eye'; lng: number; lat: number; altM: number; heading: number; pitch: number };

export class Globe {
  readonly widget: CesiumWidget;
  readonly looks: Looks;
  private esriFailed = false;
  readonly canvas: HTMLCanvasElement;
  private state: ViewState;
  private theme: Theme;
  private listeners = new Map<string, Set<Listener>>();
  private tween: number | null = null;
  private applying = false;
  private driver: (() => CameraPose | null) | null = null;
  private esri: ImageryLayer | null = null;
  private osm: ImageryLayer | null = null;
  private loaded = false;
  private photoreal: Cesium3DTileset | null = null;
  photorealState: 'off' | 'loading' | 'on' | 'failed' = 'off';
  onTilesError: () => void = () => undefined;

  constructor(container: HTMLElement, view: ViewState, theme: Theme) {
    this.state = { ...view };
    this.theme = theme;
    const w = (window as unknown as { CESIUM_BASE_URL?: string });
    w.CESIUM_BASE_URL = `${import.meta.env.BASE_URL}cesium`;

    const credit = document.createElement('div');
    credit.hidden = true;
    this.widget = new CesiumWidget(container, {
      baseLayer: false,
      skyBox: spaceSkyBox(),
      requestRenderMode: false,
      sceneMode: SceneMode.SCENE3D,
      creditContainer: credit,
      contextOptions: { webgl: { powerPreference: 'high-performance' } },
      msaaSamples: 1,
    });
    this.canvas = this.widget.canvas;
    const scene = this.widget.scene;
    scene.backgroundColor = Color.fromCssColorString('#04070b');
    scene.globe.baseColor = Color.fromCssColorString('#0a1118');
    scene.globe.enableLighting = false;
    scene.globe.showGroundAtmosphere = true;
    scene.globe.atmosphereLightIntensity = 6;
    scene.highDynamicRange = false;
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
    if (scene.sun) scene.sun.show = true;
    if (scene.moon) scene.moon.show = true;
    scene.fog.enabled = true;
    scene.fog.density = 0.00012;
    scene.screenSpaceCameraController.minimumZoomDistance = 250; // Esri tiles go blank near 100 m, so stop the camera above that
    scene.screenSpaceCameraController.maximumZoomDistance = 200_000_000;
    scene.screenSpaceCameraController.enableLook = false;
    scene.camera.percentageChanged = 0.0005;
    this.widget.resolutionScale = Math.min(window.devicePixelRatio || 1, 2);

    this.looks = new Looks(scene);
    this.setImagery();
    void this.setTerrain();
    this.applyLook();
    this.writeCamera();

    const cam = scene.camera;
    scene.preRender.addEventListener(() => this.drive());
    cam.changed.addEventListener(() => {
      if (this.driver || this.applying || this.tween !== null) return;
      this.readCamera();
      this.emit('move');
    });
    cam.moveEnd.addEventListener(() => {
      if (this.driver || this.applying || this.tween !== null) return;
      this.readCamera();
      this.emit('moveend');
    });
    scene.globe.tileLoadProgressEvent.addEventListener((n: number) => {
      if (n === 0 && !this.loaded) {
        this.loaded = true;
        this.emit('load');
      }
    });
  }

  // ---- events ----
  on(ev: string, fn: Listener): void {
    if (!this.listeners.has(ev)) this.listeners.set(ev, new Set());
    this.listeners.get(ev)?.add(fn);
  }
  once(ev: string, fn: Listener): void {
    if (ev === 'load' && this.loaded) {
      fn();
      return;
    }
    const wrap = () => {
      this.listeners.get(ev)?.delete(wrap);
      fn();
    };
    this.on(ev, wrap);
  }
  private emit(ev: string): void {
    this.listeners.get(ev)?.forEach((fn) => fn());
  }

  /** Calls `fn` when a person (not a programmatic move) grabs the camera. */
  onUserGesture(fn: () => void): void {
    const go = () => {
      if (this.tween !== null) this.stopTween();
      fn();
    };
    this.canvas.addEventListener('pointerdown', go);
    this.canvas.addEventListener('wheel', go, { passive: true });
  }

  // ---- imagery, terrain and optional 3D ----
  private setImagery(): void {
    const layers = this.widget.scene.imageryLayers;
    this.osm = ImageryLayer.fromProviderAsync(
      Promise.resolve(new OpenStreetMapImageryProvider({ url: OSM, credit: 'OpenStreetMap contributors' })),
    );
    this.osm.show = false;
    let errors = 0;
    const fallback = () => {
      if (this.esri && this.osm && this.esri.show) {
        this.esriFailed = true;
        this.esri.show = false;
        this.osm.show = true;
        this.applyLook();
        this.onTilesError();
      }
    };
    const esriProvider = ArcGisMapServerImageryProvider.fromUrl(ESRI, {
      enablePickFeatures: false,
      credit: 'Powered by Esri. Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    });
    this.esri = ImageryLayer.fromProviderAsync(esriProvider);
    esriProvider.catch(() => fallback());
    layers.add(this.osm);
    layers.add(this.esri);
    this.esri.errorEvent.addEventListener(() => {
      errors += 1;
      if (errors === 4) fallback();
    });
  }

  /** Picks the base imagery. Esri falls back to OpenStreetMap by itself when its tiles fail. */
  setSource(src: 'esri' | 'osm'): void {
    if (!this.esri || !this.osm) return;
    this.esri.show = src === 'esri' && !this.esriFailed;
    this.osm.show = !this.esri.show;
    this.applyLook();
  }

  /**
   * Day/night shading from the real sun position. Lighting fades out below ~3,000 km, so a city view is always fully lit
   * and parking stays readable at night; the terminator only shows from space.
   */
  setDayNight(on: boolean): void {
    const g = this.widget.scene.globe;
    g.enableLighting = on;
    g.lightingFadeOutDistance = 2_500_000;
    g.lightingFadeInDistance = 9_000_000;
    const clock = this.widget.clock;
    clock.shouldAnimate = on;
    if (on) clock.currentTime = JulianDate.now();
  }

  /** Speeds the sun clock up to match a satellite time-lapse (1 is real time). */
  setTimeScale(scale: number): void {
    this.widget.clock.multiplier = scale;
  }

  /** Infrared looks see through haze, so the distance fog goes off while one is active. */
  setFog(on: boolean): void {
    this.widget.scene.fog.enabled = on;
  }

  private async setTerrain(): Promise<void> {
    try {
      const provider = await CesiumTerrainProvider.fromUrl(TERRAIN);
      this.widget.scene.terrainProvider = provider;
    } catch {
      /* flat globe is fine: terrain is relief only */
    }
  }

  /** Photorealistic 3D buildings and terrain. Needs a Cesium ion token (kept on the server, handed over at runtime). */
  async enablePhotoreal(token: string): Promise<boolean> {
    if (!token) return false;
    if (this.photoreal) {
      this.setPhotoreal(true);
      return true;
    }
    this.photorealState = 'loading';
    try {
      Ion.defaultAccessToken = token;
      const resource = await IonResource.fromAssetId(ION_PHOTOREAL_ASSET, { accessToken: token });
      const tileset = await Cesium3DTileset.fromUrl(resource, { maximumScreenSpaceError: 8 });
      this.photoreal = tileset;
      this.widget.scene.primitives.add(tileset);
      this.setPhotoreal(true);
      return true;
    } catch {
      this.photorealState = 'failed';
      return false;
    }
  }

  setPhotoreal(on: boolean): void {
    if (!this.photoreal) return;
    this.photoreal.show = on;
    this.widget.scene.globe.show = !on;
    this.photorealState = on ? 'on' : 'off';
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.applyLook();
  }

  private applyLook(): void {
    const look = IMAGERY_LOOK[this.theme];
    for (const l of [this.esri, this.osm]) {
      if (!l) continue;
      l.brightness = look.brightness;
      l.contrast = look.contrast;
      l.saturation = look.saturation;
      l.gamma = look.gamma;
    }
    const scene = this.widget.scene;
    scene.backgroundColor = Color.fromCssColorString('#02040a'); // space stays dark in every theme
    scene.globe.baseColor = Color.fromCssColorString(this.theme === 'light' ? '#d9e2e8' : '#0a1118');
  }

  // ---- camera <-> state ----
  private metersPerPixel(lat: number, zoom: number): number {
    return (MPP0 * Math.cos(rad(lat))) / 2 ** zoom;
  }

  private fovy(): number {
    return (this.widget.scene.camera.frustum as PerspectiveFrustum).fovy ?? rad(60);
  }

  private rangeFor(lat: number, zoom: number): number {
    const fovy = this.fovy();
    const h = Math.max(200, this.canvas.clientHeight);
    return (this.metersPerPixel(Math.min(80, Math.abs(lat)), zoom) * h) / (2 * Math.tan(fovy / 2));
  }

  private zoomFor(lat: number, range: number): number {
    const fovy = this.fovy();
    const h = Math.max(200, this.canvas.clientHeight);
    const mpp = (range * 2 * Math.tan(fovy / 2)) / h;
    const z = Math.log2((MPP0 * Math.cos(rad(Math.min(80, Math.abs(lat))))) / mpp);
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  }

  private writeCamera(): void {
    const s = this.state;
    const cam = this.widget.scene.camera;
    const target = Cartesian3.fromDegrees(s.lng, s.lat, 0);
    const pitch = rad(-90 + Math.min(80, Math.max(0, s.pitch)));
    this.applying = true;
    cam.lookAt(target, new HeadingPitchRange(rad(s.bearing), pitch, this.rangeFor(s.lat, s.zoom)));
    cam.lookAtTransform(Matrix4.IDENTITY);
    this.applying = false;
  }

  /**
   * Hand the camera to a per-frame driver (flight chase / orbit / cockpit views). Returning null from the driver
   * leaves the camera where it is for that frame. Passing null gives control back to the mouse.
   */
  setDriver(fn: (() => CameraPose | null) | null): void {
    this.stopTween();
    this.driver = fn;
    this.widget.scene.screenSpaceCameraController.enableInputs = fn === null;
  }

  hasDriver(): boolean {
    return this.driver !== null;
  }

  private drive(): void {
    if (!this.driver) return;
    const p = this.driver();
    if (!p) return;
    const cam = this.widget.scene.camera;
    this.applying = true;
    if (p.mode === 'eye') {
      cam.lookAtTransform(Matrix4.IDENTITY);
      cam.setView({
        destination: Cartesian3.fromDegrees(p.lng, p.lat, p.altM),
        orientation: { heading: rad(p.heading), pitch: rad(p.pitch), roll: 0 },
      });
    } else {
      cam.lookAt(Cartesian3.fromDegrees(p.lng, p.lat, p.altM), new HeadingPitchRange(rad(p.heading), rad(p.pitch), p.range));
      cam.lookAtTransform(Matrix4.IDENTITY);
    }
    this.applying = false;
  }

  private readCamera(): void {
    const scene = this.widget.scene;
    const cam = scene.camera;
    const c = new Cartesian2(this.canvas.clientWidth / 2, this.canvas.clientHeight / 2);
    const hit = cam.pickEllipsoid(c, scene.globe.ellipsoid);
    if (!hit) return;
    const carto = Cartographic.fromCartesian(hit);
    const lat = deg(carto.latitude);
    const lng = deg(carto.longitude);
    const range = Cartesian3.distance(cam.positionWC, hit);
    this.state = {
      lng,
      lat,
      zoom: this.zoomFor(lat, range),
      bearing: (deg(cam.heading) + 360) % 360,
      pitch: Math.min(80, Math.max(0, deg(cam.pitch) + 90)),
    };
  }

  // ---- map-like getters ----
  getCenter(): LngLat {
    return { lng: this.state.lng, lat: this.state.lat };
  }
  getZoom(): number {
    return this.state.zoom;
  }
  getBearing(): number {
    return this.state.bearing;
  }
  getPitch(): number {
    return this.state.pitch;
  }
  /** Camera height above the ellipsoid, in metres. */
  cameraAltitude(): number {
    return this.widget.scene.camera.positionCartographic.height;
  }
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
  currentView(): ViewState {
    return { ...this.state };
  }

  getBounds(): Bounds {
    const scene = this.widget.scene;
    let rect: Rectangle | undefined;
    try {
      rect = scene.camera.computeViewRectangle(scene.globe.ellipsoid);
    } catch {
      rect = undefined;
    }
    const west = rect ? deg(rect.west) : -180;
    const east = rect ? deg(rect.east) : 180;
    const south = rect ? deg(rect.south) : -85;
    const north = rect ? deg(rect.north) : 85;
    return {
      getSouth: () => south,
      getWest: () => west,
      getNorth: () => north,
      getEast: () => east,
      contains: ([lng, lat]) => {
        const inLat = lat >= south && lat <= north;
        const inLng = west <= east ? lng >= west && lng <= east : lng >= west || lng <= east;
        return inLat && inLng;
      },
    };
  }

  /** Ground position under a screen point, or null when the point is on the sky. */
  pickLngLat(x: number, y: number): LngLat | null {
    const scene = this.widget.scene;
    const hit = scene.camera.pickEllipsoid(new Cartesian2(x, y), scene.globe.ellipsoid);
    if (!hit) return null;
    const c = Cartographic.fromCartesian(hit);
    return { lng: deg(c.longitude), lat: deg(c.latitude) };
  }

  viewInfo(): ViewInfo {
    const b = this.getBounds();
    const diagKm = haversineKm(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
    return { lng: this.state.lng, lat: this.state.lat, zoom: this.state.zoom, diagKm };
  }

  /** Screen position of a point; far outside the screen when it is hidden behind the globe. */
  project(lng: number, lat: number, heightM = 0): { x: number; y: number } {
    const p = this.widget.scene.cartesianToCanvasCoordinates(Cartesian3.fromDegrees(lng, lat, heightM));
    return p ? { x: p.x, y: p.y } : { x: -99999, y: -99999 };
  }

  // ---- camera moves ----
  jumpTo(t: CameraTarget): void {
    this.stopTween();
    this.state = this.merge(t);
    this.writeCamera();
    this.emit('move');
    this.emit('moveend');
  }

  easeTo(t: CameraTarget): void {
    this.animate(t, false);
  }

  flyTo(t: CameraTarget): void {
    this.animate(t, true);
  }

  private merge(t: CameraTarget): ViewState {
    const s = this.state;
    return {
      lng: t.center ? t.center[0] : s.lng,
      lat: t.center ? t.center[1] : s.lat,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.zoom ?? s.zoom)),
      bearing: t.bearing ?? s.bearing,
      pitch: Math.min(80, Math.max(0, t.pitch ?? s.pitch)),
    };
  }

  private stopTween(): void {
    if (this.tween !== null) {
      cancelAnimationFrame(this.tween);
      this.tween = null;
      this.readCamera();
      this.emit('moveend');
    }
  }

  private animate(t: CameraTarget, arc: boolean): void {
    const ms = t.duration ?? 800;
    if (ms <= 0) {
      this.jumpTo(t);
      return;
    }
    if (this.tween !== null) cancelAnimationFrame(this.tween);
    const a = { ...this.state };
    const b = this.merge(t);
    let dLng = b.lng - a.lng;
    if (dLng > 180) dLng -= 360;
    if (dLng < -180) dLng += 360;
    let dBear = b.bearing - a.bearing;
    if (dBear > 180) dBear -= 360;
    if (dBear < -180) dBear += 360;
    const distKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
    const bump = arc ? Math.min(5, distKm / 450) : 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      this.state = {
        lng: a.lng + dLng * e,
        lat: a.lat + (b.lat - a.lat) * e,
        zoom: a.zoom + (b.zoom - a.zoom) * e - bump * Math.sin(Math.PI * e),
        bearing: (a.bearing + dBear * e + 360) % 360,
        pitch: a.pitch + (b.pitch - a.pitch) * e,
      };
      this.writeCamera();
      this.emit('move');
      if (k < 1) {
        this.tween = requestAnimationFrame(step);
      } else {
        this.tween = null;
        this.state = b;
        this.writeCamera();
        this.emit('moveend');
      }
    };
    this.tween = requestAnimationFrame(step);
  }

  /** Zoom that fits a span of `spanKm` into roughly half of the screen's short side at `lat`. */
  zoomToFit(lat: number, spanKm: number): number {
    const px = Math.max(240, 0.5 * Math.min(this.canvas.clientWidth, this.canvas.clientHeight));
    const mpp = Math.max(0.5, (spanKm * 1000) / px);
    return Math.min(17, Math.max(MIN_ZOOM, Math.log2((MPP0 * Math.cos(rad(Math.min(80, Math.abs(lat))))) / mpp)));
  }

  resize(): void {
    this.widget.resize();
  }
}
