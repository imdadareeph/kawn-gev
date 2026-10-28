import { brandName, brandTagline, LOG_PREFIX, type Lang } from './brand';
import { getLang, setLang, t, type I18nKey } from './i18n';
import { fmtAge, fmtClock, fmtCoord, fmtScale, num, setFormat } from './format';
import {
  Store,
  loadProfile,
  saveProfile,
  LAYER_IDS,
  type LayerId,
  type Profile,
  type Role,
  type Theme,
} from './state';
import { decodeShare, encodeShare, type SharePayload } from './share';
import { ALL_PLACES, AIRPORTS, EMIRATES, landmarksFor, kmBetween, placeName, regionOf, type Place } from './places';
import { searchLocal, searchRemote, type SearchHit } from './search';
import { metersPerPixel } from './geo';
import { DEFAULT_VIEW, Globe } from './map/globe';
import { ScopeOverlay, type FreeRect } from './map/scope';
import { FlightsFeed, MIN_ZOOM } from './layers/flights';
import { COCKPIT_EYE_UP_M, ORBIT_DEG_PER_S, VIEW_PITCH, advance, clamp, nearest, pathAngle, slewAngle, viewRange, type FlightPose, type FlightView } from './layers/flight-views';
import type { CameraPose } from './map/globe';
import { buildGeoms, vehiclesAt, type Vehicle } from './layers/transit';
import { Overlays, type ParkingMark, type PickTag } from './layers/overlays';
import { PARKING_LOTS, cityOfPoint, levelOf, occupancyAt, type ParkingLot } from './data/parking-sample';
import { tariffNow } from './data/parking-zones';
import { fetchRoute, type RoutePath } from './route';
import { DetectionCanvas, TacticalHud, gsdFromAltitude, niirsFromGsd, sunElevationDeg, type DetectItem } from './ui/tactical';
import { labelAlpha } from './map/scope';
import type { LookId } from './looks';
import { ESTATE_SITES } from './data/estate-sample';
import { shellHtml } from './ui/shell';
import { SatelliteLayer } from './layers/satellites';
import { WorldFlights } from './layers/world-flights';
import { ownerLabel } from './data/countries';
import { estateCard, esc, flightCard, parkingCard, satelliteCard, transitCard, worldFlightCard } from './ui/cards';

type Sel = { kind: 'flight' | 'transit' | 'estate' | 'parking' | 'satellite' | 'world'; id: string } | null;
type SheetState = 'peek' | 'half' | 'full';

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing element ${sel}`);
  return el;
};

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => window.matchMedia('(max-width: 720px)').matches;

const SCOPE_RGB: Record<Theme, string> = { dark: '3,6,10', light: '246,244,239', contrast: '0,0,0' };
const SCOPE_STRENGTH: Record<Theme, number> = { dark: 0.82, light: 0.7, contrast: 0.9 };
const SESSION_LAUNCH_KEY = 'launcher-dismissed';

export function startApp(root: HTMLElement): { ready: Promise<void> } {
  root.innerHTML = shellHtml();

  // ---------- state ----------
  const link: SharePayload | null = decodeShare(window.location.hash || window.location.search);
  const store = new Store<Profile>(loadProfile());
  let fromLink = false;
  if (link) {
    fromLink = true; // a shared link overrides stored preferences for this load without overwriting them
    const p = store.get();
    store.set({
      lang: link.lang ?? p.lang,
      numerals: link.numerals ?? p.numerals,
      theme: link.theme ?? p.theme,
      scopeOn: link.scopeOn ?? p.scopeOn,
      look: link.look ?? p.look,
      mapSource: link.mapSource ?? p.mapSource,
      hudOn: link.hudOn ?? p.hudOn,
      detectOn: link.detectOn ?? p.detectOn,
      feather: link.feather ?? p.feather,
      role: link.role === undefined ? p.role : link.role,
      layers: link.layers
        ? { flights: link.layers.includes('flights'), transit: link.layers.includes('transit'), estate: link.layers.includes('estate'), parking: link.layers.includes('parking'), paid: link.layers.includes('paid'), satellites: link.layers.includes('satellites'), daynight: link.layers.includes('daynight') }
        : p.layers,
    });
  }
  const commit = (patch: Partial<Profile>) => {
    fromLink = false;
    store.set(patch);
  };
  const profile = () => store.get();

  let sel: Sel = null;
  let following = false;
  // Flight camera views (top-down follow, chase, orbit, cockpit)
  let fview: FlightView | null = null;
  let fpose: FlightPose | null = null;
  let viewHeading = 0;
  let viewFactor = 1;
  let lastDrive = 0;
  let trayOpen = false;
  let searchOpen = false;
  let sheet: SheetState = isMobile() ? 'peek' : 'half';
  let pendingFlight: { id: string; until: number } | null = link?.flight ? { id: link.flight, until: Date.now() + 90_000 } : null;
  let tick = 0;
  let dirty = true;
  let lastVehicles: Vehicle[] = [];
  const geoms = buildGeoms();

  // ---------- language, theme ----------
  const applyI18n = () => {
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n as I18nKey);
    });
    document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria as I18nKey)));
    document.querySelectorAll<HTMLInputElement>('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPh as I18nKey)));
    document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => el.setAttribute('title', t(el.dataset.i18nTitle as I18nKey)));
    document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder as I18nKey)));
  };

  const applyLanguage = () => {
    const p = profile();
    setLang(p.lang);
    setFormat(p.lang, p.numerals);
    document.documentElement.lang = p.lang;
    document.documentElement.dir = p.lang === 'ar' ? 'rtl' : 'ltr';
    applyI18n();
    $('#brand-name').textContent = brandName(p.lang);
    $('#brand-tag').textContent = brandTagline(p.lang);
    document.title = `${brandName(p.lang)} — ${brandTagline(p.lang)}`;
    setSeg('#seg-lang', 'langVal', p.lang);
    setSeg('#seg-numerals', 'numVal', p.numerals);
    const fs = $<HTMLFieldSetElement>('#fs-numerals');
    fs.disabled = p.lang !== 'ar';
    $<HTMLSelectElement>('#ctl-role').value = p.role ?? '';
    $('#out-feather').textContent = num(p.feather);
    buildTray();
    updateLayerRows();
    renderCard(true);
    updateHud();
    refreshScope();
  };

  const applyTheme = () => {
    const th = profile().theme;
    document.documentElement.dataset.theme = th;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = th === 'light' ? '#f3f1ec' : th === 'contrast' ? '#000000' : '#0b0f14';
    setSeg('#seg-theme', 'themeVal', th);
  };

  function buildLookParams(look: LookId): void {
    const host = $('#look-params');
    const list = map.looks.params(look);
    host.hidden = list.length === 0;
    host.innerHTML = list
      .map(
        (p) =>
          `<label class="range"><span class="range-top"><span dir="ltr">${esc(p.label)}</span><output dir="ltr">${p.value.toFixed(2)}</output></span><input type="range" data-param="${p.name}" min="${p.min}" max="${p.max}" step="0.01" value="${p.value}" /></label>`,
      )
      .join('');
  }
  $('#look-params').addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    const name = el.dataset.param;
    if (!name) return;
    map.looks.setParam(profile().look, name, Number(el.value));
    const out = el.parentElement?.querySelector('output');
    if (out) out.textContent = Number(el.value).toFixed(2);
  });

  const applyDisplayExtras = (instant = false) => {
    const p = profile();
    setSeg('#seg-look', 'lookVal', p.look);
    map.looks.set(p.look, instant);
    map.looks.setLens(p.scopeOn);
    map.setSource(p.mapSource);
    setSeg('#seg-source', 'sourceVal', p.mapSource);
    tacHud.setLook(p.look);
    buildLookParams(p.look);
    map.setFog(p.look !== 'surveillance' && p.look !== 'thermal'); // infrared looks see through haze
    $('#ctl-hud').setAttribute('aria-checked', String(p.hudOn));
    $('#ctl-detect').setAttribute('aria-checked', String(p.detectOn));
    tacHud.show(p.hudOn);
    if (!p.detectOn) detectCanvas.clear();
    updateHud();
    dirty = true;
  };

  function setSeg(sel: string, key: string, value: string): void {
    document.querySelectorAll<HTMLElement>(`${sel} [role="radio"]`).forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset[key] === value));
    });
  }

  // ---------- map ----------
  const mapEl = $('#map');
  const initialView = link?.view ?? DEFAULT_VIEW;
  const map = new Globe(mapEl, initialView, profile().theme);
  map.onTilesError = () => toast(t('toastTilesDown'), 5000);
  const overlays = new Overlays(map);
  const sats = new SatelliteLayer(map.widget.scene);
  sats.onChange = () => {
    updateLayerRows();
    dirty = true;
  };
  overlays.setLook(profile().lang, profile().theme);
  {
    let down: { x: number; y: number } | null = null;
    map.canvas.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
    });
    map.canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const r = map.canvas.getBoundingClientRect();
      if (tapToSet) {
        const g = map.pickLngLat(e.clientX - r.left, e.clientY - r.top);
        if (g) setMe(g.lat, g.lng, undefined);
        down = null;
        return;
      }
      onPick(overlays.pick(e.clientX - r.left, e.clientY - r.top));
      down = null;
    });
  }
  const scopeOverlay = new ScopeOverlay($('#scope'));
  const tacHud = new TacticalHud($('#tac'));
  const detectCanvas = new DetectionCanvas($<HTMLCanvasElement>('#detect'));

  const feed = new FlightsFeed(
    () => map.viewInfo(),
    () => onFeedChange(),
  );
  const world = new WorldFlights(
    map.widget.scene,
    () => map.viewInfo(),
    () => {
      updateLayerRows();
      dirty = true;
    },
  );

  // ---------- toasts ----------
  function toast(msg: string, ms = 2000): void {
    const host = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    host.appendChild(el);
    window.setTimeout(() => el.remove(), ms);
  }

  // ---------- layers panel ----------
  function layerStatus(id: LayerId): { state: string; word: string; meta: string } {
    const on = profile().layers[id];
    if (!on) return { state: 'off', word: t('stOff'), meta: '' };
    if (id === 'daynight') return { state: 'on', word: t('stOn'), meta: t('metaDayNight') };
    if (id === 'satellites') {
      const s = sats.status();
      if (s.state === 'unavailable') return { state: 'bad', word: t('stUnavailable'), meta: t('metaSatNone') };
      if (s.state === 'loading' || s.state === 'idle') return { state: 'loading', word: t('stLoading'), meta: t('metaSatLoading') };
      const country = $<HTMLSelectElement>('#sat-country').value;
      const meta = country
        ? t('metaSatFiltered', { shown: num(s.shown), count: num(s.count), country: ownerLabel(country, getLang() === 'ar' ? 'ar' : 'en'), above: num(s.above) })
        : t('metaSatellites', { count: num(s.count), above: num(s.above), age: s.ageHours === null ? '—' : num(Math.round(s.ageHours)) });
      return { state: s.state === 'stale' ? 'warn' : 'on', word: s.state === 'stale' ? t('stStale') : t('stOn'), meta };
    }
    if (id !== 'flights') {
      return { state: 'sample', word: t('stSample'), meta: id === 'transit' ? t('metaTransit') : id === 'parking' ? t('metaParking') : id === 'paid' ? t('metaPaid') : t('metaEstate') };
    }
    if (world.active()) {
      const w = world.status();
      const wage = w.fetchedAt ? fmtAge((Date.now() - w.fetchedAt) / 1000) : '—';
      if (w.state === 'loading' || w.state === 'idle') return { state: 'loading', word: t('stLoading'), meta: t('metaWorldWait') };
      if (w.state === 'unavailable') return { state: 'bad', word: t('stUnavailable'), meta: t('metaWorldDown') };
      if (w.state === 'stale') return { state: 'warn', word: t('stStale'), meta: t('metaWorldStale', { shown: num(w.shown) }) };
      return { state: 'on', word: t('stOn'), meta: t('metaWorld', { shown: num(w.shown), total: num(w.total), age: wage }) };
    }
    const s = feed.status();
    const age = s.fetchedAt ? fmtAge((Date.now() - s.fetchedAt) / 1000) : '—';
    const counted = t('metaFlights', { source: s.source, age, count: num(s.count) });
    switch (s.state) {
      case 'idle':
        return { state: 'idle', word: t('stIdle'), meta: s.reason === 'zoom' ? t('metaFlightsZoom') : t('metaFlightsWait') };
      case 'loading':
        return { state: 'loading', word: t('stLoading'), meta: t('metaFlightsWait') };
      case 'live':
        return { state: 'on', word: t('stOn'), meta: counted };
      case 'stale':
        return { state: 'warn', word: t('stStale'), meta: `${counted} · ${t('metaFlightsDown')}` };
      case 'degraded':
        return { state: 'warn', word: t('stDegraded'), meta: `${counted} · ${t('metaFlightsDown')}` };
      case 'fallback':
        return { state: 'fallback', word: t('stFallback'), meta: t('metaFlightsDemo') };
      default:
        return { state: 'bad', word: t('stUnavailable'), meta: t('metaFlightsNone') };
    }
  }

  let countrySig = '';
  /** Fill the country list from the loaded catalog; rebuilt only when it or the language changes, keeping the current choice. */
  function rebuildCountries(): void {
    const list = sats.countries();
    const lang = getLang() === 'ar' ? 'ar' : 'en';
    const sig = `${lang}|${list.map((c) => `${c.code}:${c.count}`).join(',')}`;
    if (sig === countrySig) return;
    countrySig = sig;
    const sel = $<HTMLSelectElement>('#sat-country');
    const keep = sel.value;
    sel.innerHTML = '';
    const all = document.createElement('option');
    all.value = '';
    all.textContent = t('satCountryAll');
    sel.append(all);
    for (const c of list) {
      const o = document.createElement('option');
      o.value = c.code;
      o.textContent = `${ownerLabel(c.code, lang)} (${num(c.count)})`;
      sel.append(o);
    }
    sel.value = list.some((c) => c.code === keep) ? keep : '';
  }

  function updateLayerRows(): void {
    $('#park-legend').hidden = !(profile().layers.parking || profile().layers.paid);
    $('#sat-speed').hidden = !profile().layers.satellites;
    $('#sat-legend').hidden = !profile().layers.satellites;
    $('#sat-country-wrap').hidden = !profile().layers.satellites;
    rebuildCountries();
    {
      const ss = sats.status();
      $('#sat-dense-state').textContent = ss.dense === 'loading' ? t('satDenseLoading') : ss.dense === 'on' ? t('satDenseOn', { n: num(ss.denseCount) }) : ss.dense === 'unavailable' ? t('satDenseDown') : '';
    }
    for (const id of LAYER_IDS) {
      const row = document.querySelector<HTMLElement>(`.layer-row[data-layer="${id}"]`);
      if (!row) continue;
      const on = profile().layers[id];
      const st = layerStatus(id);
      row.dataset.on = String(on);
      $(`#lt-${id}`).setAttribute('aria-checked', String(on));
      const stateEl = row.querySelector<HTMLElement>('.layer-state');
      if (stateEl) {
        stateEl.dataset.state = st.state;
        stateEl.textContent = st.word;
      }
      const meta = $(`#lm-${id}`);
      meta.textContent = st.meta;
      meta.hidden = !st.meta;
    }
  }

  function setLayer(id: LayerId, on: boolean): void {
    commit({ layers: { ...profile().layers, [id]: on } });
  }

  function onFeedChange(): void {
    updateLayerRows();
    const s = feed.status();
    if (pendingFlight) {
      const a = feed.get(pendingFlight.id);
      if (a) {
        select({ kind: 'flight', id: a.id });
        map.easeTo({ center: [a.lon, a.lat], zoom: Math.max(map.getZoom(), 11.5), duration: reduceMotion() ? 0 : 1500 });
        pendingFlight = null;
      } else if (Date.now() > pendingFlight.until) {
        pendingFlight = null;
      }
    }
    if (sel?.kind === 'flight' && !feed.get(sel.id) && s.state !== 'loading') {
      // The aircraft left coverage: keep the card honest rather than showing a ghost.
      select(null);
    }
    dirty = true;
  }

  // ---------- flight camera views ----------
  const FT_M = 0.3048;

  function flightDriver(): CameraPose | null {
    if (!fpose || !fview || fview === 'top') return null;
    const p = advance(fpose, Date.now());
    const nowP = performance.now();
    const dt = clamp((nowP - lastDrive) / 1000, 0, 0.25);
    lastDrive = nowP;
    if (fview === 'orbit') viewHeading = (viewHeading + ORBIT_DEG_PER_S * dt) % 360;
    else viewHeading = slewAngle(viewHeading, p.track, 60 * dt);
    if (fview === 'cockpit') {
      return { mode: 'eye', lng: p.lng, lat: p.lat, altM: p.altM + COCKPIT_EYE_UP_M, heading: viewHeading, pitch: p.gamma - 1 };
    }
    return {
      mode: 'orbit',
      lng: p.lng,
      lat: p.lat,
      altM: p.altM,
      heading: viewHeading,
      pitch: VIEW_PITCH[fview],
      range: viewRange(fview, p.altM, viewFactor),
    };
  }

  /** Leave a chase / orbit / cockpit view. With `restore`, drop to an oblique map view over the aircraft. */
  function poseOf(a: { lng: number; lat: number; altFt: number | null; onGround: boolean; angle: number; gsKt: number | null; id: string }): FlightPose {
    const rec = feed.get(a.id);
    return {
      lng: a.lng,
      lat: a.lat,
      altM: a.onGround || a.altFt == null ? 5 : Math.max(5, a.altFt * FT_M),
      track: a.angle,
      speed: (a.gsKt ?? 0) * 0.514444,
      gamma: pathAngle(rec?.vsFpm ?? null, a.gsKt),
      at: Date.now(),
    };
  }

  function exitView(restore: boolean): void {
    const driven = map.hasDriver();
    fview = null;
    following = false;
    map.setDriver(null);
    if (restore && driven && fpose) {
      const p = advance(fpose, Date.now());
      map.jumpTo({ center: [p.lng, p.lat], zoom: 12.5, pitch: 55, bearing: p.track });
    }
  }

  /** Any map action that moves the camera on its own ends a follow or a driven view. */
  function stopFollow(): void {
    if (fview && fview !== 'top') exitView(false);
    following = false;
    if (fview === 'top') fview = null;
  }

  function setFlightView(v: FlightView): void {
    if (sel?.kind !== 'flight') return;
    if (fview === v) {
      exitView(true);
      renderCard(true);
      return;
    }
    const wasDriven = map.hasDriver();
    fview = v;
    following = v === 'top';
    viewFactor = 1;
    if (v === 'top') {
      if (wasDriven) map.setDriver(null);
      const a = feed.get(sel.id);
      if (a) map.easeTo({ center: [a.lon, a.lat], zoom: Math.max(map.getZoom(), 12.5), pitch: 0, bearing: 0, duration: reduceMotion() ? 0 : 900 });
    } else {
      viewHeading = fpose?.track ?? 0;
      lastDrive = performance.now();
      map.setDriver(flightDriver);
    }
    dirty = true;
    renderCard(true);
  }

  map.getCanvas().addEventListener(
    'wheel',
    (e) => {
      if (!fview || fview === 'top' || fview === 'cockpit') return;
      viewFactor = clamp(viewFactor * Math.exp(e.deltaY * 0.0012), 0.3, 12);
    },
    { passive: true },
  );

  // ---------- selection + info card ----------
  function select(next: Sel): void {
    if (fview && fview !== 'top') exitView(true);
    fpose = null;
    fview = null;
    sel = next;
    following = false;
    feed.setTrailTarget(next?.kind === 'flight' ? next.id : null);
    sats.setSelected(next?.kind === 'satellite' ? next.id : null);
    world.setSelected(next?.kind === 'world' ? next.id : null);
    if (next && isMobile() && sheet === 'peek') setSheet('half');
    renderCard(true);
    refreshScope();
    scheduleUrl();
    dirty = true;
  }

  let lastCardHtml = '';
  /** While a pointer is down on the card, the 1 s refresh must not replace the button under it (the click would be lost). */
  let cardHeld = false;
  $('#card').addEventListener('pointerdown', () => (cardHeld = true));
  window.addEventListener('pointerup', () => (cardHeld = false));
  window.addEventListener('pointercancel', () => (cardHeld = false));
  /** Passes are computed for the user's location when known, otherwise for the map centre. */
  function passObserver(): { lat: number; lng: number } {
    if (me) return me;
    const c = map.getCenter();
    return { lat: c.lat, lng: c.lng };
  }

  function renderCard(force = false): void {
    const card = $('#card');
    let html = '';
    if (sel?.kind === 'flight') {
      const a = feed.get(sel.id);
      if (a) {
        const list = feed.snapshot(Date.now());
        const me2 = list.find((x) => x.id === sel?.id);
        html = flightCard(a, Date.now(), {
          view: fview,
          near: me2 ? nearest(me2, list, 4) : [],
          trail: feed.trail(a.id),
        });
      }
    } else if (sel?.kind === 'transit') {
      const v = lastVehicles.find((x) => x.id === sel?.id);
      if (v) html = transitCard(v);
    } else if (sel?.kind === 'parking') {
      const lot = PARKING_LOTS.find((x) => x.id === sel?.id);
      if (lot) html = parkingCard(lot, occupancyAt(lot, Date.now()), routeLot === lot.id ? route : null, routing, !!me);
    } else if (sel?.kind === 'estate') {
      const s = ESTATE_SITES.find((x) => x.id === sel?.id);
      if (s) html = estateCard(s);
    } else if (sel?.kind === 'world') {
      const a = world.get(sel.id);
      if (a) html = worldFlightCard(a, Date.now());
    } else if (sel?.kind === 'satellite') {
      const i = sats.info(sel.id, passObserver());
      if (i) html = satelliteCard(i, following, sats.timeScale(), !!me, Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
    if (!html) {
      if (!card.hidden) {
        card.hidden = true;
        card.innerHTML = '';
        lastCardHtml = '';
        refreshScope();
      }
      return;
    }
    if (!force && (html === lastCardHtml || cardHeld)) return;
    const activeId = document.activeElement instanceof HTMLElement ? document.activeElement.id : '';
    const wasHidden = card.hidden;
    card.hidden = false;
    card.innerHTML = html;
    lastCardHtml = html;
    if (activeId && card.querySelector(`#${activeId}`)) $<HTMLElement>(`#${activeId}`).focus({ preventScroll: true });
    if (wasHidden) refreshScope();
  }

  $('#card').addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('#card-close')) {
      select(null);
    } else if (target.closest('#card-route') && sel?.kind === 'parking') {
      void requestRoute(sel.id);
    } else if (target.closest('#card-clearroute')) {
      clearRoute();
    } else if (target.closest('#card-zoom') && sel?.kind === 'world') {
      const a = world.get(sel.id);
      if (a) flyTo({ lng: a.lng, lat: a.lat, zoom: 9, pitch: 0, bearing: 0 });
    } else if (target.closest('#card-follow') && sel?.kind === 'satellite') {
      following = !following;
      const i = sats.where(sel.id);
      if (following && i) map.easeTo({ center: [i.lng, i.lat], zoom: Math.min(map.getZoom(), 3), duration: reduceMotion() ? 0 : 900 });
      renderCard(true);
    } else if (target.closest('[data-fview]') && sel?.kind === 'flight') {
      setFlightView((target.closest('[data-fview]') as HTMLElement).dataset.fview as FlightView);
    } else if (target.closest('[data-near]') && sel?.kind === 'flight') {
      const id = (target.closest('[data-near]') as HTMLElement).dataset.near as string;
      const keep = fview && fview !== 'top' ? fview : null;
      select({ kind: 'flight', id });
      const a = feed.get(id);
      if (a) {
        if (keep) {
          const d = feed.snapshot(Date.now()).find((x) => x.id === id);
          if (d) fpose = poseOf(d);
          setFlightView(keep);
        } else {
          map.easeTo({ center: [a.lon, a.lat], zoom: Math.max(map.getZoom(), 11), duration: reduceMotion() ? 0 : 900 });
        }
      }
    }
  });

  function onPick(hit: PickTag | null): void {
    if (hit) select({ kind: hit.kind, id: hit.id });
    else if (sel) select(null); // only a clean click on empty map deselects, and it never moves the camera
  }

  // ---------- parking, my location and routing ----------
  let me: { lat: number; lng: number } | null = null;
  let route: RoutePath | null = null;
  let routeLot: string | null = null;
  let routing = false;
  let tapToSet = false;
  let routeAbort: AbortController | null = null;
  let afterLocate: (() => void) | null = null;

  const lotShown = (l: ParkingLot): boolean => (l.fee === 'free' ? profile().layers.parking : profile().layers.paid);

  /** The number drawn beside a lot: free spaces, plus the hourly rate for paid Dubai lots. */
  function markText(l: ParkingLot, free: number, now: number): string {
    const n = num(free);
    if (l.fee === 'free') return n;
    if (!l.zone) return `${n} · ${t('paidShort')}`;
    const tf = tariffNow(l.zone, now, l.kind === 'garage');
    return tf.paidNow ? `${n} · ${t('aedShort')} ${num(tf.aed)}` : `${n} · ${t('freeShort')}`;
  }

  /** Marks for every lot whose layer is on, in PARKING_LOTS order. */
  function parkingMarks(now: number): ParkingMark[] {
    const out: ParkingMark[] = [];
    for (const l of PARKING_LOTS) {
      if (!lotShown(l)) continue;
      const o = occupancyAt(l, now);
      out.push({ id: l.id, lat: l.lat, lng: l.lng, level: levelOf(o, l), kind: l.kind, text: markText(l, o.free, now) });
    }
    return out;
  }

  function setMe(lat: number, lng: number, then: (() => void) | undefined): void {
    me = { lat, lng };
    tapToSet = false;
    map.canvas.style.cursor = '';
    toast(t('toastLocated'), 3500);
    if (cityOfPoint(lat, lng)) {
      if (!following) map.flyTo({ center: [lng, lat], zoom: 14.2, pitch: 0, bearing: 0, duration: reduceMotion() ? 0 : 1800 });
    } else {
      toast(t('toastOutOfCity'), 5000);
    }
    const cb = then ?? afterLocate;
    afterLocate = null;
    dirty = true;
    renderCard(true);
    if (cb) window.setTimeout(cb, 0);
  }

  function startTapToSet(): void {
    tapToSet = true;
    map.canvas.style.cursor = 'crosshair';
    toast(t('toastLocDenied'), 6000);
  }

  function locate(): void {
    if (!('geolocation' in navigator)) {
      startTapToSet();
      return;
    }
    toast(t('toastLocating'));
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe(pos.coords.latitude, pos.coords.longitude, undefined),
      () => startTapToSet(),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  function clearRoute(): void {
    routeAbort?.abort();
    routeAbort = null;
    route = null;
    routeLot = null;
    routing = false;
    dirty = true;
    renderCard(true);
  }

  async function requestRoute(lotId: string): Promise<void> {
    const lot = PARKING_LOTS.find((x) => x.id === lotId);
    if (!lot) return;
    if (!me) {
      toast(t('needLocation'), 3500);
      afterLocate = () => void requestRoute(lotId);
      locate();
      return;
    }
    routeAbort?.abort();
    const ctrl = new AbortController();
    routeAbort = ctrl;
    routing = true;
    routeLot = lotId;
    route = null;
    renderCard(true);
    toast(t('toastRouting'), 1500);
    let got: RoutePath;
    try {
      got = await fetchRoute(me, lot, ctrl.signal);
    } catch {
      return; // superseded by a newer request
    }
    if (ctrl.signal.aborted) return;
    routing = false;
    route = got;
    if (got.straight) toast(t('toastRouteStraight'), 4500);
    const lats = got.path.map((p) => p[1]);
    const lngs = got.path.map((p) => p[0]);
    const south = Math.min(...lats);
    const north = Math.max(...lats);
    const west = Math.min(...lngs);
    const east = Math.max(...lngs);
    const mid = { lat: (south + north) / 2, lng: (west + east) / 2 };
    const spanKm = kmBetween(south, west, north, east) * 1.3 + 0.4;
    stopFollow();
    map.flyTo({ center: [mid.lng, mid.lat], zoom: map.zoomToFit(mid.lat, spanKm), pitch: 0, bearing: 0, duration: reduceMotion() ? 0 : 1600 });
    dirty = true;
    renderCard(true);
  }

  function findFree(): void {
    if (!me) {
      afterLocate = findFree;
      locate();
      return;
    }
    const city = cityOfPoint(me.lat, me.lng);
    if (!city) {
      toast(t('toastOutOfCity'), 5000);
      return;
    }
    const now = Date.now();
    const here = me;
    const options = PARKING_LOTS.filter((l) => l.city === city && lotShown(l))
      .map((l) => ({ l, o: occupancyAt(l, now), d: kmBetween(here.lat, here.lng, l.lat, l.lng) }))
      .filter((x) => x.o.free >= Math.max(10, x.l.capacity * 0.1))
      .sort((a, b) => a.d - b.d);
    if (!options.length) {
      toast(t('toastNoFree'), 4000);
      return;
    }
    select({ kind: 'parking', id: options[0].l.id });
    void requestRoute(options[0].l.id);
  }
  // Optional photorealistic 3D: only when the server was given a Cesium ion token.
  void fetch('/api/map-config')
    .then((r) => (r.ok ? r.json() : null))
    .then(async (cfg: { ionToken?: string } | null) => {
      if (!cfg?.ionToken) return;
      const ok = await map.enablePhotoreal(cfg.ionToken);
      if (!ok) return;
      $('#ctl-3d-wrap').hidden = false;
      $('#ctl-3d').setAttribute('aria-checked', 'true');
      dirty = true;
    })
    .catch(() => undefined);
  $('#ctl-3d').addEventListener('click', () => {
    const on = $('#ctl-3d').getAttribute('aria-checked') !== 'true';
    $('#ctl-3d').setAttribute('aria-checked', String(on));
    map.setPhotoreal(on);
  });
  $('#btn-locate').addEventListener('click', locate);
  $('#btn-find').addEventListener('click', findFree);

  // ---------- scope ----------
  function visible(el: HTMLElement | null): el is HTMLElement {
    return !!el && !el.hidden && el.getBoundingClientRect().width > 0;
  }

  function freeRect(): FreeRect {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const top = $('.topbar').getBoundingClientRect().bottom;
    const dock = $('#dock').getBoundingClientRect();
    let left = 0;
    let right = W;
    let bottom = dock.top > top ? dock.top : H;
    if (isMobile()) {
      const sh = $('#sheet').getBoundingClientRect();
      if (sh.top > top) bottom = Math.min(bottom, sh.top);
    } else {
      const occupying = [document.getElementById('panel-layers'), document.getElementById('panel-display'), document.getElementById('card')];
      for (const el of occupying) {
        if (!visible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.left + r.width / 2 < W / 2) left = Math.max(left, r.right);
        else right = Math.min(right, r.left);
      }
    }
    if (right - left < 240) {
      left = 0;
      right = W;
    }
    if (bottom - top < 160) bottom = H;
    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  function refreshScope(): void {
    const p = profile();
    scopeOverlay.update(p.scopeOn, freeRect(), p.feather, SCOPE_RGB[p.theme], SCOPE_STRENGTH[p.theme]);
    tick += 1;
    dirty = true;
  }

  // ---------- camera actions ----------
  function flyTo(c: { lng: number; lat: number; zoom: number; pitch?: number; bearing?: number }): void {
    stopFollow();
    map.flyTo({
      center: [c.lng, c.lat],
      zoom: c.zoom,
      pitch: c.pitch ?? 0,
      bearing: c.bearing ?? 0,
      duration: reduceMotion() ? 0 : 2400,
    });
  }

  function flyToPlace(p: Place): void {
    flyTo(p);
    toast(t('toastFlew', { place: placeName(p, getLang()) }));
  }

  function nearestCityCenter(): Place {
    const c = map.getCenter();
    let best = EMIRATES[1];
    let bd = Infinity;
    for (const e of EMIRATES) {
      const d = kmBetween(c.lat, c.lng, e.lat, e.lng);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return bd < 400 ? best : EMIRATES[1];
  }

  const actTilt = () => map.easeTo({ pitch: map.getPitch() < 30 ? 55 : 0, duration: reduceMotion() ? 0 : 650 });
  const actNorth = () => map.easeTo({ bearing: 0, duration: reduceMotion() ? 0 : 500 });
  const actReset = () => {
    const c = nearestCityCenter();
    flyTo({ lng: c.lng, lat: c.lat, zoom: DEFAULT_VIEW.zoom, pitch: 0, bearing: 0 });
  };

  $('#act-tilt').addEventListener('click', actTilt);
  $('#act-north').addEventListener('click', actNorth);
  $('#act-reset').addEventListener('click', actReset);
  // Pull back to a whole-Earth view over the current map centre.
  $('#act-space').addEventListener('click', () => {
    const c = map.getCenter();
    flyTo({ lng: c.lng, lat: c.lat, zoom: 1.6, pitch: 0, bearing: 0 });
  });
  $('#sat-country').addEventListener('change', () => {
    const code = $<HTMLSelectElement>('#sat-country').value;
    sats.setCountry(code);
    // A selected satellite that the filter hides would be a ghost card, so clear it.
    if (sel?.kind === 'satellite' && !sats.matches(sel.id)) select(null);
    updateLayerRows();
    dirty = true;
  });
  $('#sat-dense').addEventListener('click', () => {
    const on = $('#sat-dense').getAttribute('aria-pressed') !== 'true';
    $('#sat-dense').setAttribute('aria-pressed', String(on));
    sats.setDense(on);
    dirty = true;
  });
  $('#sat-speed').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sat-speed]');
    if (!b) return;
    const scale = Number(b.dataset.satSpeed);
    sats.setTimeScale(scale);
    map.setTimeScale(scale);
    $('#sat-speed')
      .querySelectorAll<HTMLElement>('[data-sat-speed]')
      .forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (sel?.kind === 'satellite') renderCard(true);
    dirty = true;
  });
  $('#act-clear').addEventListener('click', () => {
    commit({ layers: { flights: false, transit: false, estate: false, parking: false, paid: false, satellites: false, daynight: false } });
    clearRoute();
    toast(t('toastCleared'));
  });
  $('#act-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      toast(t('toastLinkCopied'));
    } catch {
      toast(t('toastLinkFailed'));
    }
  });

  map.onUserGesture(() => {
    if (following) {
      stopFollow();
      renderCard(true);
    }
  });

  // ---------- share link ----------
  function sharePayload(): SharePayload {
    const p = profile();
    const active = sel?.kind === 'flight' ? feed.get(sel.id) : undefined;
    return {
      view: map.currentView(),
      layers: LAYER_IDS.filter((id) => p.layers[id]),
      scopeOn: p.scopeOn,
      look: p.look,
      mapSource: p.mapSource,
      hudOn: p.hudOn,
      detectOn: p.detectOn,
      feather: p.feather,
      lang: p.lang,
      numerals: p.numerals,
      theme: p.theme,
      role: p.role,
      flight: active && !active.demo ? active.id : undefined,
    };
  }
  function shareUrl(): string {
    return `${window.location.origin}${window.location.pathname}#${encodeShare(sharePayload())}`;
  }
  let urlTimer: number | undefined;
  function scheduleUrl(): void {
    window.clearTimeout(urlTimer);
    urlTimer = window.setTimeout(() => {
      try {
        window.history.replaceState(null, '', `#${encodeShare(sharePayload())}`);
      } catch {
        /* embedded or sandboxed: the copy button still works */
      }
    }, 500);
  }

  // ---------- HUD ----------
  function updateHud(): void {
    const c = map.getCenter();
    const region = regionOf(c.lng, c.lat);
    const lang = getLang();
    $('#hud-place').textContent = region
      ? `${region.area ? (lang === 'ar' ? region.area.ar : region.area.en) : ''} · ${lang === 'ar' ? region.country.ar : region.country.en}`
      : t('hudNoRegion');
    $('#hud-coords').textContent = fmtCoord(c.lat, c.lng);
    $('#hud-scale').textContent = fmtScale(metersPerPixel(c.lat, map.getZoom()));
    $('#hud-time').textContent = fmtClock(new Date(), region?.timeZone ?? 'UTC');
    if (profile().hudOn) {
      const alt = map.cameraAltitude();
      const n = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d, useGrouping: false });
      const iso = new Date().toISOString();
      tacHud.set({
        gsd: `${n(gsdFromAltitude(alt), alt < 2000 ? 2 : 1)} M`,
        niirs: n(niirsFromGsd(gsdFromAltitude(alt)), 1),
        sun: `${n(sunElevationDeg(new Date(), c.lat, c.lng), 1)}°`,
        lat: `${n(Math.abs(c.lat), 4)}°${c.lat >= 0 ? 'N' : 'S'}`,
        lng: `${n(Math.abs(c.lng), 4)}°${c.lng >= 0 ? 'E' : 'W'}`,
        alt: alt >= 10000 ? `${n(alt / 1000)} KM` : `${n(alt)} M`,
        heading: `${n(map.getBearing()).padStart(3, '0')}°`,
        pitch: `${n(map.getPitch())}°`,
        scale: `${n(metersPerPixel(c.lat, map.getZoom()), 1)} M/PX`,
        clock: `${iso.slice(11, 19)}Z`,
        look: profile().look === 'none' ? 'EO · LIVE' : profile().look.toUpperCase(),
      });
    }
  }

  // ---------- location tray ----------
  function placeButton(p: Place): string {
    const name = esc(placeName(p, getLang()));
    return `<button class="place-btn" data-place="${p.id}">${p.code ? `<span class="code" dir="ltr">${p.code}</span>` : ''}<span class="name">${name}</span></button>`;
  }

  function buildTray(): void {
    const city = nearestCityCenter();
    const cityId = ['dubai', 'abudhabi', 'sharjah'].includes(city.id) ? city.id : 'dubai';
    const cityPlace = EMIRATES.find((e) => e.id === cityId) as Place;
    const group = (title: string, items: Place[]) =>
      `<section class="tray-group"><h3>${esc(title)}</h3><div class="tray-grid">${items.map(placeButton).join('')}</div></section>`;
    $('#tray-body').innerHTML = [
      group(t('groupEmirates'), EMIRATES),
      group(`${t('groupLandmarks')} · ${placeName(cityPlace, getLang())}`, landmarksFor(cityId)),
      group(t('groupDubaiAirports'), AIRPORTS.filter((a) => a.group === 'dubaiAirports')),
      group(t('groupUaeAirports'), AIRPORTS.filter((a) => a.group === 'uaeAirports')),
      group(t('groupLondonAirports'), AIRPORTS.filter((a) => a.group === 'londonAirports')),
    ].join('');
  }

  let trayOpener: HTMLElement | null = null;
  function openTray(): void {
    closeSearch();
    buildTray();
    trayOpen = true;
    trayOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    $('#tray-location').hidden = false;
    $('#btn-location').setAttribute('aria-expanded', 'true');
    $<HTMLElement>('#tray-body .place-btn').focus({ preventScroll: true });
  }
  function closeTray(): void {
    if (!trayOpen) return;
    trayOpen = false;
    $('#tray-location').hidden = true;
    $('#btn-location').setAttribute('aria-expanded', 'false');
    trayOpener?.focus({ preventScroll: true });
  }
  $('#btn-location').addEventListener('click', () => (trayOpen ? closeTray() : openTray()));
  $('#tray-close').addEventListener('click', closeTray);
  $('#tray-body').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-place]');
    if (!b) return;
    const p = ALL_PLACES.find((x) => x.id === b.dataset.place);
    if (p) {
      closeTray();
      flyToPlace(p);
    }
  });

  // ---------- search ----------
  let hits: SearchHit[] = [];
  let activeHit = -1;
  let searchSeq = 0;
  let searchAbort: AbortController | null = null;
  let remoteTimer: number | undefined;
  const input = $<HTMLInputElement>('#search-input');

  function renderHits(): void {
    const list = $('#search-list');
    const lang = getLang();
    list.innerHTML = hits
      .map((h, i) => {
        const name = lang === 'ar' ? h.ar : h.en;
        return `<li role="option" id="hit-${i}" data-i="${i}" aria-selected="${i === activeHit}"><span>${esc(name)}</span>${h.detail ? `<small>${esc(h.detail)}</small>` : ''}</li>`;
      })
      .join('');
    input.setAttribute('aria-expanded', String(hits.length > 0));
    if (activeHit >= 0) input.setAttribute('aria-activedescendant', `hit-${activeHit}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function runSearch(q: string): void {
    const seq = (searchSeq += 1);
    searchAbort?.abort();
    window.clearTimeout(remoteTimer);
    const status = $('#search-status');
    if (!q.trim()) {
      hits = [];
      activeHit = -1;
      status.textContent = '';
      renderHits();
      return;
    }
    hits = searchLocal(q);
    activeHit = hits.length ? 0 : -1;
    renderHits();
    if (hits[0]?.source === 'coords') {
      status.textContent = '';
      return;
    }
    if (q.trim().length < 3) {
      status.textContent = hits.length ? '' : t('noResults');
      return;
    }
    status.textContent = t('searching');
    remoteTimer = window.setTimeout(() => {
      const ctrl = new AbortController();
      searchAbort = ctrl;
      const c = map.getCenter();
      searchRemote(q, { lng: c.lng, lat: c.lat }, ctrl.signal, getLang())
        .then((remote) => {
          if (seq !== searchSeq) return; // a newer search replaced this one
          const seen = new Set(hits.map((h) => h.id));
          hits = [...hits, ...remote.filter((r) => !seen.has(r.id))].slice(0, 9);
          if (activeHit < 0 && hits.length) activeHit = 0;
          status.textContent = hits.length ? '' : t('noResults');
          renderHits();
        })
        .catch((err: unknown) => {
          if ((err as Error)?.name === 'AbortError' || seq !== searchSeq) return;
          status.textContent = hits.length ? '' : t('searchFailed');
        });
    }, 350);
  }

  function goHit(h: SearchHit): void {
    closeSearch();
    flyTo(h);
    toast(t('toastFlew', { place: getLang() === 'ar' ? h.ar : h.en }));
  }

  function openSearch(): void {
    closeTray();
    searchOpen = true;
    $('#search-pop').hidden = false;
    $('#btn-search').setAttribute('aria-expanded', 'true');
    input.focus();
    input.select();
  }
  function closeSearch(): void {
    if (!searchOpen) return;
    searchOpen = false;
    searchSeq += 1;
    searchAbort?.abort();
    window.clearTimeout(remoteTimer);
    $('#search-pop').hidden = true;
    $('#btn-search').setAttribute('aria-expanded', 'false');
    $('#btn-search').focus({ preventScroll: true });
  }
  $('#btn-search').addEventListener('click', () => (searchOpen ? closeSearch() : openSearch()));
  $('#search-close').addEventListener('click', closeSearch);
  input.addEventListener('input', () => runSearch(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hits.length) return;
      activeHit = (activeHit + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
      renderHits();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const h = hits[Math.max(0, activeHit)];
      if (h) goHit(h);
    }
  });
  $('#search-list').addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('li[data-i]');
    const h = li ? hits[Number(li.dataset.i)] : undefined;
    if (h) goHit(h);
  });

  // ---------- panels, sheet ----------
  function setPanel(headSel: string, bodySel: string, open: boolean): void {
    $(headSel).setAttribute('aria-expanded', String(open));
    $(bodySel).hidden = !open;
  }
  $('#head-layers').addEventListener('click', () => commit({ layersPanelOpen: !profile().layersPanelOpen }));
  $('#head-display').addEventListener('click', () => commit({ displayPanelOpen: !profile().displayPanelOpen }));
  $('#head-text').addEventListener('click', () => {
    const open = $('#head-text').getAttribute('aria-expanded') !== 'true';
    setPanel('#head-text', '#body-text', open);
    if (open) updateTextList();
    refreshScope();
  });

  function setSheet(next: SheetState): void {
    sheet = next;
    $('#sheet').dataset.sheet = next;
    $('#sheet-handle').setAttribute('aria-expanded', String(next !== 'peek'));
    window.setTimeout(refreshScope, 260);
  }
  $('#sheet-handle').addEventListener('click', () => setSheet(sheet === 'peek' ? 'half' : sheet === 'half' ? 'full' : 'peek'));
  $('#btn-sheet').addEventListener('click', () => setSheet(sheet === 'peek' ? 'half' : 'peek'));
  setSheet(sheet);

  // layer switches
  for (const id of LAYER_IDS) {
    $(`#lt-${id}`).addEventListener('click', () => setLayer(id, !profile().layers[id]));
  }

  // layer search: matches the visible name plus keywords (English and Arabic); Enter toggles a single match
  const layerSearch = $<HTMLInputElement>('#layer-search');
  function filterLayers(): void {
    const q = layerSearch.value.trim().toLowerCase();
    const rows = [...document.querySelectorAll<HTMLElement>('#body-layers .layer-row')];
    let shown = 0;
    for (const row of rows) {
      const hay = `${row.querySelector('.layer-name')?.textContent ?? ''} ${row.dataset.keywords ?? ''}`.toLowerCase();
      const hit = !q || q.split(/\s+/).every((w) => hay.includes(w));
      row.hidden = !hit;
      if (hit) shown++;
    }
    // A group heading stays only while at least one row under it is visible.
    let title: HTMLElement | null = null;
    let any = false;
    const close = () => {
      if (title) title.hidden = !any;
    };
    for (const el of [...document.querySelectorAll<HTMLElement>('#body-layers .group-title, #body-layers .layer-row')]) {
      if (el.classList.contains('group-title')) {
        close();
        title = el;
        any = false;
      } else if (!el.hidden) any = true;
    }
    close();
    $('#layer-empty').hidden = shown > 0;
  }
  layerSearch.addEventListener('input', filterLayers);
  layerSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      layerSearch.value = '';
      filterLayers();
    } else if (e.key === 'Enter') {
      const hits = [...document.querySelectorAll<HTMLElement>('#body-layers .layer-row:not([hidden])')];
      if (hits.length === 1) setLayer(hits[0].dataset.layer as LayerId, !profile().layers[hits[0].dataset.layer as LayerId]);
    }
  });

  // display controls
  // Reference behaviour: CRT, night vision and thermal bring the HUD with them; anime, noir and snow hide it
  // unless the HUD was switched by hand. A sensor look also runs without the scope fade.
  let hudManual = false;
  const MILITARY: LookId[] = ['retro', 'surveillance', 'thermal'];
  function chooseLook(look: LookId): void {
    if (look === 'none') {
      commit({ look });
      return;
    }
    const mil = MILITARY.includes(look);
    commit({ look, scopeOn: false, hudOn: mil ? true : hudManual ? profile().hudOn : false });
  }
  const LOOK_KEYS: Record<string, LookId> = { Digit1: 'none', Digit2: 'retro', Digit3: 'surveillance', Digit4: 'thermal', Digit5: 'anime', Digit6: 'noir', Digit7: 'snow' };
  $('#seg-look').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-look-val]');
    if (b) {
      const look = b.dataset.lookVal as LookId;
      // A sensor look brings the HUD with it and runs without the scope fade, so the full picture shows.
      chooseLook(look);
    }
  });
  $('#seg-source').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-source-val]');
    if (b) commit({ mapSource: b.dataset.sourceVal as 'esri' | 'osm' });
  });
  $('#ctl-hud').addEventListener('click', () => {
    hudManual = true;
    commit({ hudOn: !profile().hudOn });
  });
  $('#ctl-detect').addEventListener('click', () => commit({ detectOn: !profile().detectOn }));
  $('#ctl-scope').addEventListener('click', () => commit({ scopeOn: !profile().scopeOn }));
  const feather = $<HTMLInputElement>('#ctl-feather');
  feather.addEventListener('input', () => commit({ feather: Number(feather.value) }));
  $('#seg-theme').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-theme-val]');
    if (b) commit({ theme: b.dataset.themeVal as Theme });
  });
  $('#seg-lang').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-lang-val]');
    if (b) commit({ lang: b.dataset.langVal as Lang });
  });
  $('#seg-numerals').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-num-val]');
    if (b) commit({ numerals: b.dataset.numVal as Profile['numerals'] });
  });
  $<HTMLSelectElement>('#ctl-role').addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    commit({ role: v === 'investor' || v === 'visitor' || v === 'government' ? v : null });
  });

  // ---------- dialogs ----------
  const dlgLauncher = $<HTMLDialogElement>('#dlg-launcher');
  const dlgCredits = $<HTMLDialogElement>('#dlg-credits');
  const dlgShortcuts = $<HTMLDialogElement>('#dlg-shortcuts');
  for (const d of [dlgLauncher, dlgCredits, dlgShortcuts]) {
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    });
  }
  $('#btn-credits').addEventListener('click', () => dlgCredits.showModal());
  $('#credits-close').addEventListener('click', () => dlgCredits.close());
  $('#btn-shortcuts').addEventListener('click', () => dlgShortcuts.showModal());
  $('#sc-close').addEventListener('click', () => dlgShortcuts.close());

  function chooseRole(role: Role): void {
    const base = { flights: false, transit: false, estate: false, parking: true, paid: true, satellites: false, daynight: false };
    if (role === 'investor') {
      commit({ role, layers: { ...base, estate: true }, launcherDismissed: $<HTMLInputElement>('#launch-never').checked });
      flyTo({ lng: 55.2744, lat: 25.19, zoom: 12.2, pitch: 50, bearing: 20 });
      toast(t('captionInvestor'), 4500);
    } else if (role === 'visitor') {
      commit({ role, layers: { ...base, flights: true, transit: true }, launcherDismissed: $<HTMLInputElement>('#launch-never').checked });
      flyTo({ lng: 55.2744, lat: 25.2, zoom: 11.4, pitch: 0, bearing: 0 });
      toast(t('captionVisitor'), 4500);
    } else {
      commit({ role, layers: { ...base, flights: true, transit: true }, launcherDismissed: $<HTMLInputElement>('#launch-never').checked });
      flyTo({ lng: 55.2, lat: 25.1, zoom: 9.6, pitch: 0, bearing: 0 });
      toast(t('captionGovernment'), 4500);
    }
    sessionStorage.setItem(SESSION_LAUNCH_KEY, '1');
    dlgLauncher.close();
  }
  dlgLauncher.querySelectorAll<HTMLElement>('.tile').forEach((b) => b.addEventListener('click', () => chooseRole(b.dataset.role as Role)));
  $('#launch-manual').addEventListener('click', () => {
    if ($<HTMLInputElement>('#launch-never').checked) commit({ launcherDismissed: true });
    sessionStorage.setItem(SESSION_LAUNCH_KEY, '1');
    dlgLauncher.close();
  });
  dlgLauncher.addEventListener('cancel', () => sessionStorage.setItem(SESSION_LAUNCH_KEY, '1'));

  // ---------- keyboard ----------
  function escapeOne(): boolean {
    if (searchOpen) return closeSearch(), true;
    if (trayOpen) return closeTray(), true;
    if (fview && fview !== 'top') return exitView(true), renderCard(true), true;
    if (sel) return select(null), true;
    if (isMobile() && sheet !== 'peek') return setSheet('peek'), true;
    return false;
  }

  window.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return; // dialogs own the keyboard
    if (e.key === 'Escape') {
      if (escapeOne()) e.preventDefault();
      return;
    }
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target as HTMLElement | null)?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement | null)?.isContentEditable) return;
    // Physical key codes, so Arabic keyboard layouts work too.
    const lookKey = LOOK_KEYS[e.code];
    if (lookKey) {
      chooseLook(lookKey);
      return;
    }
    switch (e.code) {
      case 'KeyS':
        commit({ scopeOn: !profile().scopeOn });
        break;
      case 'KeyH':
        hudManual = true;
        commit({ hudOn: !profile().hudOn });
        break;
      case 'KeyD':
        commit({ detectOn: !profile().detectOn });
        break;
      case 'KeyL':
        commit({ layersPanelOpen: !profile().layersPanelOpen });
        break;
      case 'KeyT':
        actTilt();
        break;
      case 'KeyN':
        actNorth();
        break;
      case 'KeyR':
        actReset();
        break;
      case 'Slash':
        e.preventDefault();
        if (e.shiftKey) dlgShortcuts.showModal();
        else openSearch();
        break;
      default:
    }
  });

  // ---------- text list + screen-reader summary ----------
  function nearestAircraft(limit: number) {
    const c = map.getCenter();
    return feed
      .list()
      .map((a) => ({ a, d: kmBetween(c.lat, c.lng, a.lat, a.lon) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, limit);
  }

  function updateTextList(): void {
    if ($('#head-text').getAttribute('aria-expanded') !== 'true') return;
    const list = $('#text-list');
    const items = profile().layers.flights ? nearestAircraft(15) : [];
    list.innerHTML = items.length
      ? items.map(({ a }) => `<li><button class="text-item" data-fid="${esc(a.id)}">${esc(a.callsign || a.reg || a.id.toUpperCase())}</button></li>`).join('')
      : `<li class="dim">${esc(t('textListEmpty'))}</li>`;
  }
  $('#text-list').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-fid]');
    const a = b?.dataset.fid ? feed.get(b.dataset.fid) : undefined;
    if (a) {
      select({ kind: 'flight', id: a.id });
      map.easeTo({ center: [a.lon, a.lat], zoom: Math.max(map.getZoom(), 11.5), duration: reduceMotion() ? 0 : 900 });
    }
  });

  function updateSummary(): void {
    const b = map.getBounds();
    const n = profile().layers.flights ? feed.list().filter((a) => b.contains([a.lon, a.lat])).length : 0;
    $('#sr-summary').textContent = n ? t('mapSummary', { n: num(n) }) : t('mapSummaryNone');
  }

  // ---------- render loop ----------
  function frame(): void {
    if (document.hidden) return;
    const p = profile();
    const now = Date.now();
    const animated = p.layers.flights || p.layers.transit || p.layers.satellites || p.layers.daynight;
    if (!animated && !dirty) return;
    if (p.layers.satellites) {
      const c = map.getCenter();
      sats.update(now, { lat: c.lat, lng: c.lng });
    }
    world.update(now);
    if (sel?.kind === 'world' && !world.active()) select(null); // zoomed in past the world view
    const aircraft = p.layers.flights ? feed.snapshot(now) : [];
    lastVehicles = p.layers.transit ? vehiclesAt(geoms, now) : [];

    if (following && sel?.kind === 'satellite') {
      const i = sats.where(sel.id);
      if (i) map.jumpTo({ center: [i.lng, i.lat] });
    }
    if (sel?.kind === 'flight') {
      const a = aircraft.find((x) => x.id === sel?.id);
      if (a) fpose = poseOf(a);
      if (a && following) map.jumpTo({ center: [a.lng, a.lat] });
    }
    const selFlight = sel?.kind === 'flight' ? sel.id : null;
    overlays.update(
      {
        flightsOn: p.layers.flights,
        transitOn: p.layers.transit,
        estateOn: p.layers.estate,
        aircraft,
        selectedFlight: selFlight,
        hideSelectedPlane: fview === 'cockpit',
        selected: sel ? { kind: sel.kind, id: sel.id } : null,
        trail: selFlight ? feed.trail(selFlight) : [],
        vehicles: lastVehicles,
        scope: scopeOverlay.current(),
        theme: p.theme,
        parkingOn: p.layers.parking || p.layers.paid,
        parking: p.layers.parking || p.layers.paid ? parkingMarks(now) : [],
        me,
        route: route && routeLot ? route.path : null,
        routeStraight: route?.straight ?? false,
      },
      map.getBearing(),
    );
    if (p.detectOn) drawDetections(p, aircraft, now);
    dirty = false;
  }

  const LEVEL_COLOR: Record<string, string> = { plenty: '#3ddc97', few: '#ffb020', full: '#ff5d5d' };
  /** Non-parking boxes take the tint of the active look (thermal: warm white; night vision: green; CRT: amber). */
  const LOOK_TINT: Partial<Record<LookId, { civil: string; vehicle: string; me: string }>> = {
    thermal: { civil: '#fff1d6', vehicle: '#ffcf9f', me: '#ffd0b0' },
    surveillance: { civil: '#9dff9d', vehicle: '#6bff6b', me: '#c8ffc8' },
    retro: { civil: '#ffd27a', vehicle: '#ffb347', me: '#ffe0a3' },
  };
  function drawDetections(p: Profile, aircraft: ReturnType<FlightsFeed['snapshot']>, now: number): void {
    const tint = LOOK_TINT[p.look];
    const items: DetectItem[] = [];
    const add = (lng: number, lat: number, d: Omit<DetectItem, 'x' | 'y'>): void => {
      const s = map.project(lng, lat);
      items.push({ ...d, x: s.x, y: s.y });
    };
    if (p.layers.parking || p.layers.paid) {
      PARKING_LOTS.forEach((l, idx) => {
        if (!lotShown(l)) return;
        const m = levelOf(occupancyAt(l, now), l);
        const isSel = sel?.kind === 'parking' && sel.id === l.id;
        add(l.lng, l.lat, { tag: `P-${String(idx + 1).padStart(3, '0')}`, text: '', color: LEVEL_COLOR[m] ?? '#3ddc97', r: isSel ? 20 : 15, selected: isSel });
      });
    }
    if (me) add(me.lng, me.lat, { tag: t('youAreHere').slice(0, 14).toUpperCase(), text: '', color: tint?.me ?? '#4dd2ff', r: 12 });
    for (const v of p.layers.transit ? lastVehicles : []) add(v.lng, v.lat, { tag: v.mode.toUpperCase(), text: '', color: tint?.vehicle ?? '#6ea8ff', r: 7 });
    for (const a of aircraft) add(a.lng, a.lat, { tag: a.callsign || a.id, text: a.altFt != null ? `FL${String(Math.round(a.altFt / 100)).padStart(3, '0')}` : '', color: a.emergency ? '#ff5d5d' : (tint?.civil ?? '#e6edf3'), r: 10 });
    const sc = scopeOverlay.current();
    detectCanvas.draw(items, getLang() === 'ar', sc ? (x, y) => labelAlpha(x, y, sc) : undefined);
  }

  window.setInterval(frame, 66);
  window.setInterval(() => {
    updateHud();
    updateLayerRows();
    updateTextList();
    if (sel?.kind === 'flight' || sel?.kind === 'parking' || sel?.kind === 'satellite' || sel?.kind === 'world') renderCard();
  }, 1000);
  window.setInterval(updateSummary, 5000);

  map.on('move', () => {
    tick += 1;
    dirty = true;
  });
  map.on('moveend', () => {
    feed.cameraSettled();
    world.cameraSettled();
    scheduleUrl();
    updateHud();
  });
  map.on('move', () => updateHud());

  // ---------- store reactions ----------
  store.subscribe((next, prev) => {
    if (!fromLink) saveProfile(next);
    if (next.lang !== prev.lang || next.numerals !== prev.numerals) {
      applyLanguage();
      overlays.setLook(next.lang, next.theme);
    }
    if (next.theme !== prev.theme) {
      applyTheme();
      map.setTheme(next.theme);
      overlays.setLook(next.lang, next.theme);
    }
    if (next.look !== prev.look || next.hudOn !== prev.hudOn || next.detectOn !== prev.detectOn || next.scopeOn !== prev.scopeOn) applyDisplayExtras();
    if (next.layers !== prev.layers) {
      feed.setEnabled(next.layers.flights);
      world.setEnabled(next.layers.flights);
      if (sel?.kind === 'world' && !next.layers.flights) select(null);
      sats.setEnabled(next.layers.satellites);
      if (next.layers.daynight !== prev.layers.daynight) map.setDayNight(next.layers.daynight);
      if (sel?.kind === 'flight' && !next.layers.flights) select(null);
      if (sel?.kind === 'satellite' && !next.layers.satellites) select(null);
      if (sel?.kind === 'transit' && !next.layers.transit) select(null);
      if (sel?.kind === 'estate' && !next.layers.estate) select(null);
      if (sel?.kind === 'parking') {
        const lot = PARKING_LOTS.find((x) => x.id === sel?.id);
        if (lot && !(lot.fee === 'free' ? next.layers.parking : next.layers.paid)) select(null);
      }
      updateLayerRows();
      dirty = true;
    }
    if (next.scopeOn !== prev.scopeOn || next.feather !== prev.feather) {
      $('#ctl-scope').setAttribute('aria-checked', String(next.scopeOn));
      feather.value = String(next.feather);
      $('#out-feather').textContent = num(next.feather);
      refreshScope();
    }
    if (next.layersPanelOpen !== prev.layersPanelOpen) {
      setPanel('#head-layers', '#body-layers', next.layersPanelOpen);
      refreshScope();
    }
    if (next.displayPanelOpen !== prev.displayPanelOpen) {
      setPanel('#head-display', '#body-display', next.displayPanelOpen);
      refreshScope();
    }
    if (next.role !== prev.role) $<HTMLSelectElement>('#ctl-role').value = next.role ?? '';
    scheduleUrl();
  });

  // ---------- initial paint ----------
  const p0 = profile();
  applyTheme();
  applyLanguage();
  applyDisplayExtras(true);
  sats.setEnabled(p0.layers.satellites);
  map.setDayNight(p0.layers.daynight);
  $('#ctl-scope').setAttribute('aria-checked', String(p0.scopeOn));
  feather.value = String(p0.feather);
  setPanel('#head-layers', '#body-layers', p0.layersPanelOpen);
  setPanel('#head-display', '#body-display', p0.displayPanelOpen);
  feed.setEnabled(p0.layers.flights);
  world.setEnabled(p0.layers.flights);
  updateLayerRows();
  refreshScope();
  if (link) toast(t('toastRestoring'), 1800);

  new ResizeObserver(() => refreshScope()).observe(document.body);
  window.addEventListener('resize', () => refreshScope());
  window.matchMedia('(max-width: 720px)').addEventListener('change', () => {
    setSheet(isMobile() ? 'peek' : 'half');
    refreshScope();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) dirty = true;
  });

  const ready = new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    map.once('load', finish);
    window.setTimeout(finish, 4500); // tiles may be unreachable; the app still opens
  }).then(() => {
    // First-run launcher: not for share-link arrivals, not once dismissed for good or this session.
    if (!link && !profile().launcherDismissed && !sessionStorage.getItem(SESSION_LAUNCH_KEY)) {
      window.setTimeout(() => {
        if (!document.querySelector('dialog[open]')) dlgLauncher.showModal();
      }, 400);
    }
  });

  console.info(`${LOG_PREFIX} ready (min flights zoom ${MIN_ZOOM})`);
  return { ready };
}
