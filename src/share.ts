import type { Lang } from './brand';
import type { Numerals } from './format';
import { isLook, type LookId } from './looks';
import { LAYER_IDS, type LayerId, type Role, type Theme } from './state';

export interface ViewState {
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface SharePayload {
  view?: ViewState;
  layers?: LayerId[];
  scopeOn?: boolean;
  look?: LookId;
  mapSource?: 'esri' | 'osm';
  hudOn?: boolean;
  detectOn?: boolean;
  feather?: number;
  lang?: Lang;
  numerals?: Numerals;
  theme?: Theme;
  role?: Role | null;
  /** At most one tracked flight can travel in a link, and only as a hand-off. */
  flight?: string;
}

const LAYER_CODE: Record<LayerId, string> = { flights: 'f', transit: 't', estate: 'e', parking: 'k', paid: 'q', satellites: 's', daynight: 'n' };
const CODE_LAYER = Object.fromEntries(Object.entries(LAYER_CODE).map(([k, v]) => [v, k])) as Record<string, LayerId>;

const round = (n: number, d: number) => Number(n.toFixed(d));

export function encodeShare(p: SharePayload): string {
  const q = new URLSearchParams();
  if (p.view) {
    q.set('c', `${round(p.view.lng, 5)},${round(p.view.lat, 5)}`);
    q.set('z', String(round(p.view.zoom, 2)));
    q.set('b', String(Math.round(p.view.bearing)));
    q.set('p', String(Math.round(p.view.pitch)));
  }
  if (p.layers) q.set('l', p.layers.length ? p.layers.map((l) => LAYER_CODE[l]).join('') : '-');
  if (p.scopeOn !== undefined) q.set('s', p.scopeOn ? '1' : '0');
  if (p.look) q.set('lk', p.look);
  if (p.mapSource) q.set('ms', p.mapSource);
  if (p.hudOn !== undefined) q.set('hd', p.hudOn ? '1' : '0');
  if (p.detectOn !== undefined) q.set('dt', p.detectOn ? '1' : '0');
  if (p.feather !== undefined) q.set('sf', String(Math.round(p.feather)));
  if (p.lang) q.set('lg', p.lang);
  if (p.numerals) q.set('nu', p.numerals);
  if (p.theme) q.set('th', p.theme);
  if (p.role !== undefined) q.set('r', p.role ?? '-');
  if (p.flight && /^[0-9a-f~]{6,7}$/.test(p.flight)) q.set('f', p.flight);
  return q.toString();
}

const num = (s: string | null, min: number, max: number): number | undefined => {
  if (s === null || s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

/** Parses a hash or query string. Invalid parts are ignored (fail closed); returns null if nothing usable. */
export function decodeShare(input: string): SharePayload | null {
  const raw = input.startsWith('#') || input.startsWith('?') ? input.slice(1) : input;
  if (!raw) return null;
  const q = new URLSearchParams(raw);
  const out: SharePayload = {};

  const c = q.get('c');
  if (c) {
    const [lngS, latS] = c.split(',');
    const lng = num(lngS ?? null, -180, 180);
    const lat = num(latS ?? null, -85, 85);
    const zoom = num(q.get('z'), -1, 22);
    if (lng !== undefined && lat !== undefined && zoom !== undefined) {
      out.view = {
        lng,
        lat,
        zoom,
        bearing: num(q.get('b'), -360, 360) ?? 0,
        pitch: num(q.get('p'), 0, 85) ?? 0,
      };
    }
  }
  const l = q.get('l');
  if (l !== null) {
    out.layers = l === '-' ? [] : [...new Set([...l].map((ch) => CODE_LAYER[ch]).filter((x): x is LayerId => !!x))];
  }
  const s = q.get('s');
  if (s === '0' || s === '1') out.scopeOn = s === '1';
  const lk = q.get('lk');
  if (isLook(lk)) out.look = lk;
  const ms = q.get('ms');
  if (ms === 'esri' || ms === 'osm') out.mapSource = ms;
  const hd = q.get('hd');
  if (hd === '0' || hd === '1') out.hudOn = hd === '1';
  const dt = q.get('dt');
  if (dt === '0' || dt === '1') out.detectOn = dt === '1';
  const sf = num(q.get('sf'), 0, 100);
  if (sf !== undefined) out.feather = Math.round(sf);
  const lg = q.get('lg');
  if (lg === 'en' || lg === 'ar') out.lang = lg;
  const nu = q.get('nu');
  if (nu === 'latn' || nu === 'arab') out.numerals = nu;
  const th = q.get('th');
  if (th === 'dark' || th === 'light' || th === 'contrast') out.theme = th;
  const r = q.get('r');
  if (r === 'investor' || r === 'visitor' || r === 'government') out.role = r;
  else if (r === '-') out.role = null;
  const f = q.get('f');
  if (f && /^[0-9a-f~]{6,7}$/.test(f)) out.flight = f;

  return Object.keys(out).length ? out : null;
}

export function isValidLayerList(x: unknown): x is LayerId[] {
  return Array.isArray(x) && x.every((v) => LAYER_IDS.includes(v as LayerId));
}
