import { STORAGE_KEY, type Lang } from './brand';
import type { Numerals } from './format';
import { isLook, type LookId } from './looks';

export type Theme = 'dark' | 'light' | 'contrast';
export type Role = 'investor' | 'visitor' | 'government';
export type LayerId = 'flights' | 'transit' | 'estate' | 'parking' | 'paid' | 'satellites' | 'daynight';
export const LAYER_IDS: LayerId[] = ['parking', 'paid', 'flights', 'transit', 'estate', 'satellites', 'daynight'];

/** Preferences that survive a reload, per browser profile. */
export interface Profile {
  lang: Lang;
  numerals: Numerals;
  theme: Theme;
  scopeOn: boolean;
  look: LookId;
  mapSource: 'esri' | 'osm';
  hudOn: boolean;
  detectOn: boolean;
  /** 0 to 100. 100 is the smoothest fade with no hard edge. */
  feather: number;
  layers: Record<LayerId, boolean>;
  layersPanelOpen: boolean;
  displayPanelOpen: boolean;
  role: Role | null;
  launcherDismissed: boolean;
}

export function defaultProfile(navLang: string = 'en'): Profile {
  return {
    lang: navLang.toLowerCase().startsWith('ar') ? 'ar' : 'en',
    numerals: 'latn',
    theme: 'dark',
    // Owner decision: Scope view on, feather at its maximum, from the first load.
    scopeOn: true,
    look: 'none',
    mapSource: 'esri',
    // gods-eye-view starts with the tactical HUD and detection boxes on.
    hudOn: true,
    detectOn: true,
    feather: 100,
    layers: { flights: false, transit: false, estate: false, parking: true, paid: true, satellites: false, daynight: false },
    layersPanelOpen: true,
    displayPanelOpen: false,
    role: null,
    launcherDismissed: false,
  };
}

type Listener<T> = (state: T, prev: T) => void;

export class Store<T extends object> {
  private listeners = new Set<Listener<T>>();
  constructor(private state: T) {}
  get(): T {
    return this.state;
  }
  set(patch: Partial<T>): void {
    const prev = this.state;
    this.state = { ...prev, ...patch };
    for (const l of this.listeners) l(this.state, prev);
  }
  subscribe(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export function loadProfile(): Profile {
  const base = defaultProfile(typeof navigator !== 'undefined' ? navigator.language : 'en');
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<Profile>;
    return sanitizeProfile({ ...base, ...p, layers: { ...base.layers, ...(p.layers ?? {}) } }, base);
  } catch {
    return base; // blocked or corrupt storage never breaks start-up
  }
}

export function sanitizeProfile(p: Profile, base: Profile): Profile {
  return {
    lang: p.lang === 'ar' || p.lang === 'en' ? p.lang : base.lang,
    numerals: p.numerals === 'arab' || p.numerals === 'latn' ? p.numerals : base.numerals,
    theme: p.theme === 'light' || p.theme === 'contrast' || p.theme === 'dark' ? p.theme : base.theme,
    scopeOn: typeof p.scopeOn === 'boolean' ? p.scopeOn : base.scopeOn,
    look: isLook(p.look) ? p.look : base.look,
    mapSource: p.mapSource === 'osm' || p.mapSource === 'esri' ? p.mapSource : base.mapSource,
    hudOn: typeof p.hudOn === 'boolean' ? p.hudOn : base.hudOn,
    detectOn: typeof p.detectOn === 'boolean' ? p.detectOn : base.detectOn,
    feather: Number.isFinite(p.feather) ? Math.min(100, Math.max(0, Math.round(p.feather))) : base.feather,
    layers: {
      flights: p.layers.flights === true,
      transit: p.layers.transit === true,
      estate: p.layers.estate === true,
      parking: p.layers.parking === true,
      paid: p.layers.paid === undefined ? base.layers.paid : p.layers.paid === true,
      satellites: p.layers.satellites === true,
      daynight: p.layers.daynight === true,
    },
    layersPanelOpen: typeof p.layersPanelOpen === 'boolean' ? p.layersPanelOpen : base.layersPanelOpen,
    displayPanelOpen: typeof p.displayPanelOpen === 'boolean' ? p.displayPanelOpen : base.displayPanelOpen,
    role: p.role === 'investor' || p.role === 'visitor' || p.role === 'government' ? p.role : null,
    launcherDismissed: p.launcherDismissed === true,
  };
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage blocked: preferences simply stay per session */
  }
}
