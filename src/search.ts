import type { Lang } from './brand';
import { ALL_PLACES, type Place } from './places';

export interface SearchHit {
  id: string;
  en: string;
  ar: string;
  lng: number;
  lat: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
  source: 'coords' | 'gazetteer' | 'remote';
  detail?: string;
}

/** Accepts "25.2048, 55.2708", "25.2048 N 55.2708 E", "lat 25.2 lon 55.3". Returns null when it is not a coordinate pair. */
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const s = input.trim().replace(/[°،;]/g, ' ').replace(/,/g, ' ');
  const re = /^(?:lat(?:itude)?\s*)?(-?\d+(?:\.\d+)?)\s*([NSns])?\s+(?:lo?n(?:gitude)?\s*)?(-?\d+(?:\.\d+)?)\s*([EWew])?$/;
  const m = re.exec(s.replace(/\s+/g, ' '));
  if (!m) return null;
  let lat = Number.parseFloat(m[1]);
  let lng = Number.parseFloat(m[3]);
  if (m[2] && m[2].toUpperCase() === 'S') lat = -Math.abs(lat);
  if (m[4] && m[4].toUpperCase() === 'W') lng = -Math.abs(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

const EASTERN = '٠١٢٣٤٥٦٧٨٩';

/** Folds Arabic spelling variants and Eastern digits so "ابو ظبي" matches "أبوظبي". */
export function normalize(input: string): string {
  let s = input.toLowerCase().normalize('NFKD');
  s = s.replace(/[ً-ٰٟـ]/g, ''); // diacritics, tatweel
  s = s.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
  s = s.replace(/[٠-٩]/g, (d) => String(EASTERN.indexOf(d)));
  s = s.replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
  // Latin transliteration folds: "al-" prefixes and doubled vowels do not matter for matching.
  return s.replace(/\s+/g, ' ');
}

function stripArticle(s: string): string {
  return s.replace(/^(al|el)\s+/, '').replace(/^ال/, '').replace(/\sال/g, ' ');
}

function haystack(p: Place): string[] {
  return [p.en, p.ar, p.code ?? '', ...(p.aliases ?? [])].filter(Boolean).map((x) => normalize(x));
}

function score(query: string, hay: string[]): number {
  const q = normalize(query);
  const qs = stripArticle(q);
  if (!q) return 0;
  let best = 0;
  for (const h of hay) {
    const hs = stripArticle(h);
    if (h === q || hs === qs) best = Math.max(best, 100);
    else if (h.startsWith(q) || hs.startsWith(qs)) best = Math.max(best, 80);
    else if (h.split(' ').some((w) => w.startsWith(qs) || stripArticle(w).startsWith(qs))) best = Math.max(best, 60);
    else if (qs.length >= 3 && (h.includes(qs) || hs.includes(qs))) best = Math.max(best, 40);
  }
  return best;
}

function toHit(p: Place, source: SearchHit['source'] = 'gazetteer'): SearchHit {
  return { id: p.id, en: p.en, ar: p.ar, lng: p.lng, lat: p.lat, zoom: p.zoom, pitch: p.pitch, bearing: p.bearing, source };
}

export function searchLocal(query: string, limit = 7): SearchHit[] {
  const c = parseCoordinates(query);
  if (c) {
    const label = `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;
    return [{ id: 'coords', en: label, ar: label, lat: c.lat, lng: c.lng, zoom: 14, source: 'coords' }];
  }
  return ALL_PLACES.map((p) => ({ p, s: score(query, haystack(p)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => toHit(x.p));
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: { name?: string; city?: string; state?: string; country?: string; osm_value?: string; extent?: number[] };
}

/** Best-effort open geocoder (fair use, no bulk). Aborts cleanly when superseded. */
export async function searchRemote(query: string, bias: { lng: number; lat: number }, signal: AbortSignal, lang: Lang): Promise<SearchHit[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  url.searchParams.set('lang', 'en');
  url.searchParams.set('lat', String(bias.lat));
  url.searchParams.set('lon', String(bias.lng));
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const json = (await res.json()) as { features?: PhotonFeature[] };
  const out: SearchHit[] = [];
  for (const f of json.features ?? []) {
    const c = f.geometry?.coordinates;
    const name = f.properties?.name;
    if (!c || !name) continue;
    const detail = [f.properties?.city, f.properties?.state, f.properties?.country].filter(Boolean).join(', ');
    out.push({
      id: `remote:${c[0].toFixed(4)},${c[1].toFixed(4)}`,
      en: name,
      ar: name,
      lng: c[0],
      lat: c[1],
      zoom: lang === 'ar' ? 14 : 14,
      source: 'remote',
      detail,
    });
  }
  return out;
}
