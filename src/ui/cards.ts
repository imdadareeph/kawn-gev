import { t } from '../i18n';
import { getLang } from '../i18n';
import { num, fmtAge, fmtAlt, fmtHeading, fmtIndex, fmtSpeedKt, fmtVertical } from '../format';
import type { Tracked } from '../layers/flights';
import type { Vehicle } from '../layers/transit';
import type { WorldRecord } from '../layers/world-flights';
import { CLASS_COLOR, type SatInfo } from '../layers/satellites';
import { fmtClock } from '../format';
import { ownerLabel } from '../data/countries';
import { TRANSIT_ROUTES } from '../data/transit-sample';
import type { EstateSite } from '../data/estate-sample';
import { levelOf, type Occupancy, type ParkingLot } from '../data/parking-sample';
import { parseZone, tariffNow } from '../data/parking-zones';
import type { RoutePath } from '../route';
import { DISTRICTS, EMIRATES, placeName } from '../places';
import { icon } from './icons';
import { altitudeProfile, type FlightView, type Neighbour } from '../layers/flight-views';

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function row(k: string, v: string): string {
  return `<div class="kv"><dt>${esc(k)}</dt><dd>${v}</dd></div>`;
}

function head(title: string, subtitle: string, iconName: 'plane' | 'train' | 'building' | 'parking' | 'satellite'): string {
  return `<div class="card-head">
    <span class="card-ico">${icon(iconName, 20)}</span>
    <div class="card-title"><h2>${esc(title)}</h2><span>${esc(subtitle)}</span></div>
    <button class="icon-btn small" id="card-close" aria-label="${esc(t('close'))}">${icon('close', 18)}</button>
  </div>`;
}

export interface FlightCardCtx {
  view: FlightView | null;
  near: Neighbour[];
  trail: [number, number, number][];
}

const VIEW_KEY: Record<FlightView, 'viewTop' | 'viewChase' | 'viewOrbit' | 'viewCockpit'> = {
  top: 'viewTop',
  chase: 'viewChase',
  orbit: 'viewOrbit',
  cockpit: 'viewCockpit',
};

function profileSvg(trail: [number, number, number][]): string {
  const p = altitudeProfile(trail);
  if (!p) return `<p class="hint">${esc(t('profileWait'))}</p>`;
  const pts = p.pts.map(([x, y]) => `${(x * 200).toFixed(1)},${(4 + y * 32).toFixed(1)}`).join(' ');
  return `<svg class="profile" viewBox="0 0 200 40" preserveAspectRatio="none" role="img" aria-label="${esc(t('profileTitle'))}"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>
    <div class="profile-axis"><span dir="ltr">${esc(num(p.minFt))} ft</span><span dir="ltr">${esc(num(p.maxFt))} ft</span></div>`;
}

export function flightCard(a: Tracked, nowMs: number, ctx: FlightCardCtx): string {
  const ageSec = Math.max(0, (nowMs - a.posTime) / 1000);
  const stale = ageSec > 25 && !a.demo;
  const badges: string[] = [];
  if (a.demo) badges.push(`<span class="badge gold">${esc(t('demoBadge'))}</span>`);
  if (stale) badges.push(`<span class="badge warn">${esc(t('stale'))}</span>`);
  if (a.emergency) badges.push(`<span class="badge bad">${esc(t('fSquawk'))} ${esc(a.squawk ?? '')}</span>`);
  const title = a.callsign || a.reg || a.id.toUpperCase();
  const rows = [
    row(t('fReg'), esc(a.reg || '—')),
    row(t('fType'), esc(a.type || '—')),
    row(t('fAlt'), esc(fmtAlt(a.altFt, t('onGround'), a.onGround))),
    row(t('fSpeed'), esc(fmtSpeedKt(a.gsKt))),
    row(t('fHeading'), `<span dir="ltr">${esc(fmtHeading(a.trackDeg))}</span>`),
    row(t('fVertical'), `<span dir="ltr">${esc(fmtVertical(a.vsFpm))}</span>`),
    row(t('fSquawk'), `<span dir="ltr">${esc(a.squawk ?? '—')}</span>`),
    row(t('fPosAge'), esc(fmtAge(ageSec))),
    row(t('fRoute'), `<span class="dim">${esc(t('routeNone'))}</span>`),
  ].join('');
  const views = (['top', 'chase', 'orbit', 'cockpit'] as FlightView[])
    .map((v) => {
      const on = ctx.view === v;
      const id = v === 'top' ? 'card-follow' : `card-view-${v}`;
      return `<button class="btn ghost view-btn" id="${id}" data-fview="${v}" aria-pressed="${on}">${esc(t(VIEW_KEY[v]))}</button>`;
    })
    .join('');
  const near = ctx.near.length
    ? `<ul class="near">${ctx.near
        .map(
          (n) =>
            `<li><button class="near-row" data-near="${esc(n.id)}"><span class="near-name">${esc(n.label)}</span><span class="near-d" dir="ltr">${esc(num(n.km, n.km < 10 ? 1 : 0))} km · ${esc(num(n.bearing))}°</span></button></li>`,
        )
        .join('')}</ul>`
    : `<p class="hint">${esc(t('nearbyNone'))}</p>`;
  return `${head(title, t('cardFlight'), 'plane')}
    ${badges.length ? `<div class="badges">${badges.join('')}</div>` : ''}
    ${a.emergency ? `<p class="hint">${esc(t('emergencyNote'))}</p>` : ''}
    <dl class="kvs">${rows}</dl>
    <h3 class="card-sub">${esc(t('viewsLabel'))}</h3>
    <div class="view-row">${views}</div>
    ${ctx.view ? `<p class="hint">${esc(t('viewHint'))}${ctx.view === 'cockpit' ? ` ${esc(t('viewCockpitNote'))}` : ''}</p>` : ''}
    <h3 class="card-sub">${esc(t('profileTitle'))}</h3>
    ${profileSvg(ctx.trail)}
    <h3 class="card-sub">${esc(t('nearbyTitle'))}</h3>
    ${near}`;
}

export function transitCard(v: Vehicle): string {
  const route = TRANSIT_ROUTES.find((r) => r.id === v.routeId);
  const lang = getLang();
  const lineName = route ? (lang === 'ar' ? route.ar : route.en) : v.routeId;
  const modeName = v.mode === 'metro' ? t('modeMetro') : v.mode === 'tram' ? t('modeTram') : t('modeBus');
  return `${head(lineName, t('cardTransit'), 'train')}
    <div class="badges"><span class="badge sample">${esc(t('simBadge'))}</span></div>
    <dl class="kvs">${row(t('fLine'), esc(lineName))}${row(t('fMode'), esc(modeName))}</dl>
    <p class="hint">${esc(t('noteTransit'))}</p>`;
}

export function estateCard(s: EstateSite): string {
  const d = DISTRICTS.find((x) => x.id === s.id);
  const lang = getLang();
  const name = d ? placeName(d, lang) : s.id;
  const em = EMIRATES.find((e) => e.id === (s.city === 'abudhabi' ? 'abudhabi' : s.city));
  return `${head(name, t('cardEstate'), 'building')}
    <div class="badges"><span class="badge sample">${esc(t('sampleBadge'))}</span></div>
    <dl class="kvs">
      ${row(t('fCity'), esc(em ? placeName(em, lang) : s.city))}
      ${row(t('fPriceIdx'), `<span class="meter" style="--v:${s.priceIdx}%"></span>${esc(fmtIndex(s.priceIdx))} / 100`)}
      ${row(t('fActivityIdx'), `<span class="meter" style="--v:${s.activityIdx}%"></span>${esc(fmtIndex(s.activityIdx))} / 100`)}
      ${row(t('fMix'), `${esc(fmtIndex(s.readyPct))}% / ${esc(fmtIndex(100 - s.readyPct))}%`)}
    </dl>
    <p class="hint">${esc(t('sampleSource'))}</p>
    <p class="hint">${esc(t('noteEstate'))}</p>`;
}

function tariffRows(lot: ParkingLot, nowMs: number): string {
  if (lot.fee === 'free') return '';
  const z = parseZone(lot.zone);
  if (!z) return row(t('fRate'), esc(t('rateVaries')));
  const lang = getLang();
  const tf = tariffNow(lot.zone, nowMs, lot.kind === 'garage');
  const zoneName = `${lot.zone}${z.premium ? ' (premium)' : ''} · ${z.def.area}`;
  const rate = tf.paidNow
    ? `${t('rateAed', { n: fmtIndex(tf.aed) })} · ${t(tf.band === 'peak' ? 'bandPeak' : 'bandOff')}`
    : t('rateFreeNow');
  return `${row(t('fZone'), `<span dir="ltr">${esc(lang === 'ar' ? (lot.zone ?? '') : zoneName)}</span>`)}
      ${row(t('fRate'), esc(rate))}
      ${tf.dayRate ? row(t('fDayRate'), esc(`${fmtIndex(tf.dayRate)} ${t('aedShort')}`)) : ''}`;
}

function tariffHint(lot: ParkingLot): string {
  return lot.fee === 'paid' && parseZone(lot.zone) ? `<p class="hint">${esc(t('hoursText'))} ${esc(t('zoneSample'))}</p>` : '';
}

export function parkingCard(lot: ParkingLot, occ: Occupancy, route: RoutePath | null, routing: boolean, hasMe: boolean, nowMs: number = Date.now()): string {
  const lang = getLang();
  const level = levelOf(occ, lot);
  const lvlKey = level === 'plenty' ? 'lvlPlenty' : level === 'few' ? 'lvlFew' : 'lvlFull';
  const kindKey = lot.kind === 'mall' ? 'kindMall' : lot.kind === 'street' ? 'kindStreet' : lot.kind === 'garage' ? 'kindGarage' : 'kindTransit';
  const cityName = lot.city === 'dubai' ? (lang === 'ar' ? 'دبي' : 'Dubai') : lang === 'ar' ? 'لندن' : 'London';
  const freePct = Math.round((occ.free / lot.capacity) * 100);
  const routeRows = route
    ? `${row(t('fDistance'), esc(fmtDistance(route.distanceM)))}${row(t('fEta'), esc(fmtDuration(route.durationS)))}
       <p class="hint">${esc(route.straight ? t('routeStraight') : t('routeRoad'))}</p>`
    : '';
  const action = route
    ? `<button class="btn" id="card-clearroute">${icon('clear', 16)}<span>${esc(t('btnClearRoute'))}</span></button>`
    : `<button class="btn primary" id="card-route" ${routing ? 'disabled' : ''}>${icon('route', 16)}<span>${esc(t('btnRoute'))}</span></button>`;
  return `${head(lang === 'ar' ? lot.ar : lot.en, t('cardParking'), 'parking')}
    <div class="badges"><span class="badge lvl-${level}">${esc(t(lvlKey))}</span><span class="badge sample">${esc(t('simBadge'))}</span></div>
    <dl class="kvs">
      ${row(t('fFree'), `<span class="meter" style="--v:${freePct}%"></span>${esc(fmtIndex(occ.free))} / ${esc(fmtIndex(lot.capacity))}`)}
      ${row(t('fKind'), esc(t(kindKey)))}
      ${row(t('fFee'), esc(t(lot.fee === 'free' ? 'feeFree' : 'feePaid')))}
      ${tariffRows(lot, nowMs)}
      ${row(lang === 'ar' ? 'المدينة' : 'City', esc(cityName))}
      ${routeRows}
    </dl>
    ${tariffHint(lot)}
    ${hasMe || route ? '' : `<p class="hint">${esc(t('needLocation'))}</p>`}
    <div class="card-actions">${action}</div>
    <p class="hint">${esc(t('noteParking'))}</p>`;
}

function fmtDistance(m: number): string {
  const ar = getLang() === 'ar';
  return m >= 1000 ? `${fmtIndex(Math.round(m / 100) / 10)} ${ar ? 'كم' : 'km'}` : `${fmtIndex(Math.round(m))} ${ar ? 'م' : 'm'}`;
}

function fmtDuration(s: number): string {
  const ar = getLang() === 'ar';
  const min = Math.max(1, Math.round(s / 60));
  const h = ar ? 'ساعة' : 'h';
  const mn = ar ? 'د' : 'min';
  return min >= 60 ? `${fmtIndex(Math.floor(min / 60))} ${h} ${fmtIndex(min % 60)} ${mn}` : `${fmtIndex(min)} ${mn}`;
}

const CLASS_KEY = { station: 'clsStation', visual: 'clsVisual', nav: 'clsNav', geo: 'clsGeo', dense: 'clsDense' } as const;

function passText(p: SatInfo['pass'], tz: string): string {
  if (p === undefined) return '—';
  if (p === 'geo') return t('sPassGeo');
  if (p === null) return t('sPassNone');
  const clock = (ms: number) => fmtClock(new Date(ms), tz).slice(0, 5);
  const when = p.riseMs === null ? `${t('sPassNow')}–${clock(p.setMs)}` : `${clock(p.riseMs)}–${clock(p.setMs)}`;
  return `${when} · ${fmtIndex(Math.round(p.maxElevDeg))}° · ${p.visible ? t('sPassVisible') : t('sPassDark')}`;
}

export function satelliteCard(i: SatInfo, following: boolean, scale: number, forMe: boolean, tz: string): string {
  const n1 = (v: number) => num(v, 1);
  const rows = [
    row(t('sClass'), `<span class="swatch" style="background:${CLASS_COLOR[i.cls]}"></span>${esc(t(CLASS_KEY[i.cls]))}`),
    row(t('sCountry'), esc(i.owners.map((c) => ownerLabel(c, getLang() === 'ar' ? 'ar' : 'en')).join(' · '))),
    row(t('sNorad'), `<span dir="ltr">${esc(String(i.noradId))}</span>`),
    row(t('sAlt'), esc(`${fmtIndex(Math.round(i.altKm))} ${t('unitKm')}`)),
    row(t('sSpeed'), esc(`${n1(i.speedKmS)} ${t('unitKmS')}`)),
    row(t('sPos'), `<span dir="ltr">${esc(`${n1(i.lat)}°, ${n1(i.lng)}°`)}</span>`),
    row(t('sPeriod'), esc(`${fmtIndex(Math.round(i.periodMin))} ${t('unitMin')}`)),
    row(t('sIncl'), esc(`${n1(i.inclinationDeg)}°`)),
    row(t('sAbove'), esc(i.elevDeg > 0 ? t('sYes', { deg: fmtIndex(Math.round(i.elevDeg)) }) : t('sNo'))),
    row(forMe ? t('sNextMe') : t('sNextCentre'), `<span dir="ltr">${esc(passText(i.pass, tz))}</span>`),
    row(t('sDataAge'), esc(`${fmtIndex(Math.round(Math.abs(i.elementAgeH)))} ${t('unitHours')}`)),
  ].join('');
  return `${head(i.name.replace(/\s*\(.*\)\s*/, '') || i.name, t('cardSatellite'), 'satellite')}
    <div class="badges"><span class="badge sample">${esc(scale > 1 ? t('sLapse', { n: fmtIndex(scale) }) : t('sComputed'))}</span></div>
    <dl class="kvs">${rows}</dl>
    <p class="hint">${esc(t('sHint'))}</p>
    <div class="card-actions"><button class="btn" id="card-follow" aria-pressed="${following}">${esc(following ? t('unfollow') : t('follow'))}</button></div>`;
}

export function worldFlightCard(a: WorldRecord, nowMs: number): string {
  const ageSec = Math.max(0, (nowMs - a.posMs) / 1000);
  const rows = [
    row(t('fAlt'), esc(fmtAlt(a.altM === null ? null : a.altM / 0.3048, t('onGround'), false))),
    row(t('fSpeed'), esc(fmtSpeedKt(a.gsMps === null ? null : a.gsMps / 0.514444))),
    row(t('fHeading'), `<span dir="ltr">${esc(fmtHeading(a.trackDeg))}</span>`),
    row(t('fVertical'), `<span dir="ltr">${esc(fmtVertical(a.vrMps === null ? null : a.vrMps / 0.00508))}</span>`),
    row(t('fCountry'), esc(a.country || '—')),
    row(t('fPosAge'), esc(fmtAge(ageSec))),
    row(t('fSource'), esc('OpenSky Network')),
  ].join('');
  return `${head(a.callsign || a.id.slice(2).toUpperCase(), t('cardFlight'), 'plane')}
    <div class="badges"><span class="badge sample">${esc(t('worldBadge'))}</span></div>
    <dl class="kvs">${rows}</dl>
    <p class="hint">${esc(t('worldHint'))}</p>
    <div class="card-actions"><button class="btn" id="card-zoom">${esc(t('zoomToIt'))}</button></div>`;
}
