import type { Lang } from './brand';

export type Numerals = 'latn' | 'arab';

let lang: Lang = 'en';
let numerals: Numerals = 'latn';

export function setFormat(l: Lang, n: Numerals): void {
  lang = l;
  numerals = n;
}

function locale(): string {
  if (lang === 'ar') return numerals === 'arab' ? 'ar-AE-u-nu-arab' : 'ar-AE-u-nu-latn';
  return 'en-US';
}

export function num(n: number, maxFractionDigits = 0): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: maxFractionDigits }).format(n);
}

/** Aircraft altitude: flight level from 18,000 ft up, feet below. */
export function fmtAlt(ft: number | null, onGroundLabel: string, onGround: boolean): string {
  if (onGround) return onGroundLabel;
  if (ft === null) return '—';
  if (ft >= 18000) return `FL${num(Math.round(ft / 100)).padStart(3, '0')}`;
  return `${num(Math.round(ft))} ${lang === 'ar' ? 'قدم' : 'ft'}`;
}

export function fmtSpeedKt(kt: number | null): string {
  if (kt === null) return '—';
  return `${num(Math.round(kt))} ${lang === 'ar' ? 'عقدة' : 'kt'}`;
}

export function fmtHeading(deg: number | null): string {
  if (deg === null) return '—';
  return `${num(Math.round(deg))}°`;
}

export function fmtVertical(fpm: number | null): string {
  if (fpm === null) return '—';
  const sign = fpm > 0 ? '+' : '';
  return `${sign}${num(Math.round(fpm))} ${lang === 'ar' ? 'قدم/د' : 'ft/min'}`;
}

export function fmtAge(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—';
  if (sec < 2) return lang === 'ar' ? 'الآن' : 'now';
  if (sec < 90) return lang === 'ar' ? `منذ ${num(Math.round(sec))} ث` : `${num(Math.round(sec))} s ago`;
  const m = Math.round(sec / 60);
  return lang === 'ar' ? `منذ ${num(m)} د` : `${num(m)} min ago`;
}

export function fmtCoord(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  const nsAr = lat >= 0 ? 'ش' : 'ج';
  const ewAr = lng >= 0 ? 'ق' : 'غ';
  const a = num(Math.abs(lat), 3);
  const b = num(Math.abs(lng), 3);
  return lang === 'ar' ? `${a}° ${nsAr}  ${b}° ${ewAr}` : `${a}° ${ns}  ${b}° ${ew}`;
}

export function fmtScale(metersPerPixel: number): string {
  // Length of a 100 px ruler, in a friendly unit.
  const m = metersPerPixel * 100;
  if (m >= 1000) return `${num(Math.round(m / 100) / 10, 1)} ${lang === 'ar' ? 'كم' : 'km'}`;
  return `${num(Math.round(m / 10) * 10)} ${lang === 'ar' ? 'م' : 'm'}`;
}

export function fmtClock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(locale(), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
}

export function fmtIndex(n: number): string {
  return num(Math.round(n));
}
