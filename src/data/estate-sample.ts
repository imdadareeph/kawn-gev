// GENERATED SAMPLE. These indices are deterministic pseudo-random values used to lay out the
// interface. They are not transactions, prices or statistics and must never be presented as real.
// Replace with official open data (for example Land Department transactions) when licensed.

export interface EstateSite {
  id: string;
  lng: number;
  lat: number;
  city: 'dubai' | 'abudhabi' | 'sharjah';
  /** 0 to 100, relative and illustrative. */
  priceIdx: number;
  /** 0 to 100, relative and illustrative. */
  activityIdx: number;
  /** Illustrative share of ready (vs off-plan) stock, percent. */
  readyPct: number;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic 0..1 from a string and a salt. */
export function unit(id: string, salt: string): number {
  return (hash(`${id}:${salt}`) % 10000) / 10000;
}

interface Seed {
  id: string;
  lat: number;
  lng: number;
  city: EstateSite['city'];
  tier: number; // illustrative premium 0..1
}

const SEEDS: Seed[] = [
  { id: 'downtown-dubai', lat: 25.195, lng: 55.2744, city: 'dubai', tier: 0.95 },
  { id: 'dubai-marina', lat: 25.0805, lng: 55.1403, city: 'dubai', tier: 0.85 },
  { id: 'jbr', lat: 25.0785, lng: 55.1325, city: 'dubai', tier: 0.85 },
  { id: 'business-bay', lat: 25.186, lng: 55.263, city: 'dubai', tier: 0.7 },
  { id: 'deira', lat: 25.2697, lng: 55.3095, city: 'dubai', tier: 0.4 },
  { id: 'bur-dubai', lat: 25.2532, lng: 55.2968, city: 'dubai', tier: 0.45 },
  { id: 'jumeirah', lat: 25.205, lng: 55.245, city: 'dubai', tier: 0.9 },
  { id: 'al-barsha', lat: 25.11, lng: 55.2, city: 'dubai', tier: 0.5 },
  { id: 'jvc', lat: 25.06, lng: 55.209, city: 'dubai', tier: 0.4 },
  { id: 'dubai-hills', lat: 25.107, lng: 55.243, city: 'dubai', tier: 0.75 },
  { id: 'creek-harbour', lat: 25.202, lng: 55.345, city: 'dubai', tier: 0.7 },
  { id: 'expo-city', lat: 24.964, lng: 55.148, city: 'dubai', tier: 0.55 },
  { id: 'silicon-oasis', lat: 25.123, lng: 55.38, city: 'dubai', tier: 0.3 },
  { id: 'al-reem', lat: 24.498, lng: 54.404, city: 'abudhabi', tier: 0.65 },
  { id: 'saadiyat', lat: 24.533, lng: 54.425, city: 'abudhabi', tier: 0.85 },
  { id: 'khalifa-city', lat: 24.423, lng: 54.58, city: 'abudhabi', tier: 0.4 },
  { id: 'al-majaz-district', lat: 25.327, lng: 55.382, city: 'sharjah', tier: 0.45 },
  { id: 'al-khan', lat: 25.34, lng: 55.375, city: 'sharjah', tier: 0.4 },
  { id: 'muwaileh', lat: 25.295, lng: 55.44, city: 'sharjah', tier: 0.3 },
];

export const ESTATE_SITES: EstateSite[] = SEEDS.map((s) => ({
  id: s.id,
  lng: s.lng,
  lat: s.lat,
  city: s.city,
  priceIdx: Math.round(20 + 70 * (0.7 * s.tier + 0.3 * unit(s.id, 'price'))),
  activityIdx: Math.round(15 + 80 * unit(s.id, 'activity')),
  readyPct: Math.round(30 + 60 * unit(s.id, 'ready')),
}));
