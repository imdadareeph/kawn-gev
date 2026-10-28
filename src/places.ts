// Curated places. Fly-to targets for emirates and airports come from the owner decision log;
// landmark and district coordinates are approximate framing points and should be verified before release.

export type PlaceKind = 'emirate' | 'airport' | 'landmark' | 'district';
export type PlaceGroup = 'emirates' | 'dubaiAirports' | 'uaeAirports' | 'londonAirports';

export interface Place {
  id: string;
  kind: PlaceKind;
  group?: PlaceGroup;
  /** Which emirate or city a landmark belongs to (for the tray). */
  city?: string;
  en: string;
  ar: string;
  code?: string;
  lng: number;
  lat: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
  aliases?: string[];
}

const E = (id: string, en: string, ar: string, lat: number, lng: number, aliases: string[] = []): Place => ({
  id,
  kind: 'emirate',
  group: 'emirates',
  en,
  ar,
  lat,
  lng,
  zoom: 11,
  aliases,
});

export const EMIRATES: Place[] = [
  E('abudhabi', 'Abu Dhabi', 'أبوظبي', 24.454, 54.377, ['abu dhabi', 'abudhabi', 'ابو ظبي']),
  E('dubai', 'Dubai', 'دبي', 25.205, 55.271, ['dubayy']),
  E('sharjah', 'Sharjah', 'الشارقة', 25.346, 55.421, ['sharika']),
  E('ajman', 'Ajman', 'عجمان', 25.405, 55.514),
  E('uaq', 'Umm Al Quwain', 'أم القيوين', 25.565, 55.555, ['umm al quwain', 'uaq', 'ام القيوين']),
  E('rak', 'Ras Al Khaimah', 'رأس الخيمة', 25.79, 55.943, ['ras al khaimah', 'rak', 'ras alkhaimah', 'راس الخيمة']),
  E('fujairah', 'Fujairah', 'الفجيرة', 25.129, 56.327, ['fujeirah']),
];

const A = (
  code: string,
  group: PlaceGroup,
  en: string,
  ar: string,
  lat: number,
  lng: number,
  city: string,
): Place => ({
  id: code.toLowerCase(),
  kind: 'airport',
  group,
  city,
  code,
  en,
  ar,
  lat,
  lng,
  zoom: 12.4,
  aliases: [code.toLowerCase()],
});

export const AIRPORTS: Place[] = [
  A('DXB', 'dubaiAirports', 'Dubai International', 'مطار دبي الدولي', 25.253, 55.364, 'dubai'),
  A('DWC', 'dubaiAirports', 'Al Maktoum International', 'مطار آل مكتوم الدولي', 24.896, 55.161, 'dubai'),
  A('AUH', 'uaeAirports', 'Abu Dhabi International', 'مطار أبوظبي الدولي', 24.433, 54.651, 'abudhabi'),
  A('SHJ', 'uaeAirports', 'Sharjah International', 'مطار الشارقة الدولي', 25.329, 55.517, 'sharjah'),
  A('LHR', 'londonAirports', 'Heathrow', 'مطار هيثرو', 51.47, -0.454, 'london'),
  A('LGW', 'londonAirports', 'Gatwick', 'مطار جاتويك', 51.154, -0.182, 'london'),
  A('STN', 'londonAirports', 'Stansted', 'مطار ستانستد', 51.886, 0.239, 'london'),
  A('LCY', 'londonAirports', 'London City', 'مطار لندن سيتي', 51.505, 0.055, 'london'),
  A('LTN', 'londonAirports', 'Luton', 'مطار لوتون', 51.875, -0.368, 'london'),
];

const L = (
  id: string,
  city: string,
  en: string,
  ar: string,
  lat: number,
  lng: number,
  zoom: number,
  pitch = 55,
  bearing = 20,
  aliases: string[] = [],
): Place => ({ id, kind: 'landmark', city, en, ar, lat, lng, zoom, pitch, bearing, aliases });

export const LANDMARKS: Place[] = [
  L('burj-khalifa', 'dubai', 'Burj Khalifa', 'برج خليفة', 25.1972, 55.2744, 15.6, 60, 200),
  L('burj-al-arab', 'dubai', 'Burj Al Arab', 'برج العرب', 25.1412, 55.1853, 15.6, 55, 250),
  L('palm-jumeirah', 'dubai', 'Palm Jumeirah', 'نخلة جميرا', 25.1124, 55.139, 13.6, 45, 330, ['the palm']),
  L('dubai-frame', 'dubai', 'Dubai Frame', 'إطار دبي', 25.2352, 55.3003, 15.8, 55, 110),
  L('museum-future', 'dubai', 'Museum of the Future', 'متحف المستقبل', 25.2194, 55.2818, 16, 55, 300),
  L('grand-mosque', 'abudhabi', 'Sheikh Zayed Grand Mosque', 'جامع الشيخ زايد الكبير', 24.4128, 54.475, 15.4, 50, 160, ['sheikh zayed mosque']),
  L('emirates-palace', 'abudhabi', 'Emirates Palace', 'قصر الإمارات', 24.4614, 54.3174, 15.2, 50, 40),
  L('louvre-ad', 'abudhabi', 'Louvre Abu Dhabi', 'اللوفر أبوظبي', 24.5336, 54.3984, 15.6, 55, 20),
  L('yas-island', 'abudhabi', 'Yas Island', 'جزيرة ياس', 24.4837, 54.607, 13.8, 45, 0),
  L('ad-corniche', 'abudhabi', 'Abu Dhabi Corniche', 'كورنيش أبوظبي', 24.4772, 54.3463, 14.2, 50, 60, ['corniche']),
  L('al-noor', 'sharjah', 'Al Noor Mosque', 'مسجد النور', 25.3573, 55.383, 15.6, 50, 20),
  L('sharjah-heritage', 'sharjah', 'Heritage Area', 'منطقة التراث', 25.3585, 55.3875, 15.6, 50, 340),
  L('al-majaz', 'sharjah', 'Al Majaz Waterfront', 'واجهة المجاز المائية', 25.3267, 55.3829, 15.4, 50, 300),
  L('sharjah-aquarium', 'sharjah', 'Sharjah Aquarium', 'أكواريوم الشارقة', 25.3534, 55.384, 15.6, 50, 0),
  L('aljada', 'sharjah', 'Aljada', 'الجادة', 25.2994, 55.435, 15, 50, 0),
];

const D = (id: string, en: string, ar: string, lat: number, lng: number, aliases: string[] = []): Place => ({
  id,
  kind: 'district',
  en,
  ar,
  lat,
  lng,
  zoom: 14,
  aliases,
});

export const DISTRICTS: Place[] = [
  D('downtown-dubai', 'Downtown Dubai', 'وسط مدينة دبي', 25.195, 55.2744, ['downtown']),
  D('dubai-marina', 'Dubai Marina', 'مرسى دبي', 25.0805, 55.1403, ['marina']),
  D('jbr', 'Jumeirah Beach Residence', 'جميرا بيتش ريزيدنس', 25.0785, 55.1325, ['jbr']),
  D('business-bay', 'Business Bay', 'الخليج التجاري', 25.186, 55.263),
  D('deira', 'Deira', 'ديرة', 25.2697, 55.3095),
  D('bur-dubai', 'Bur Dubai', 'بر دبي', 25.2532, 55.2968),
  D('jumeirah', 'Jumeirah', 'جميرا', 25.205, 55.245),
  D('al-barsha', 'Al Barsha', 'البرشاء', 25.11, 55.2),
  D('jvc', 'Jumeirah Village Circle', 'قرية جميرا الدائرية', 25.06, 55.209, ['jvc']),
  D('dubai-hills', 'Dubai Hills Estate', 'دبي هيلز استيت', 25.107, 55.243),
  D('creek-harbour', 'Dubai Creek Harbour', 'ميناء خور دبي', 25.202, 55.345),
  D('expo-city', 'Expo City Dubai', 'مدينة إكسبو دبي', 24.964, 55.148, ['expo 2020', 'expo']),
  D('silicon-oasis', 'Dubai Silicon Oasis', 'واحة دبي للسيليكون', 25.123, 55.38, ['dso']),
  D('al-reem', 'Al Reem Island', 'جزيرة الريم', 24.498, 54.404, ['reem island']),
  D('saadiyat', 'Saadiyat Island', 'جزيرة السعديات', 24.533, 54.425),
  D('khalifa-city', 'Khalifa City', 'مدينة خليفة', 24.423, 54.58),
  D('al-majaz-district', 'Al Majaz', 'المجاز', 25.327, 55.382),
  D('al-khan', 'Al Khan', 'الخان', 25.34, 55.375),
  D('muwaileh', 'Muwaileh', 'المويلح', 25.295, 55.44),
];

export const ALL_PLACES: Place[] = [...EMIRATES, ...AIRPORTS, ...LANDMARKS, ...DISTRICTS];

export const DEFAULT_CITY = EMIRATES.find((p) => p.id === 'dubai') as Place;

export function placeById(id: string): Place | undefined {
  return ALL_PLACES.find((p) => p.id === id);
}

export function placeName(p: Place, lang: 'en' | 'ar'): string {
  return lang === 'ar' ? p.ar : p.en;
}

/** Landmarks for one city, in tray order. */
export function landmarksFor(city: string): Place[] {
  return LANDMARKS.filter((l) => l.city === city);
}

// ---- region logic owned here (a generic longitude-based region label mislabels Abu Dhabi) ----

export interface Region {
  country: { en: string; ar: string };
  area: { en: string; ar: string } | null;
  timeZone: string;
}

const UAE_BOX = { w: 51.0, s: 22.4, e: 56.6, n: 26.3 };
const LONDON_BOX = { w: -1.1, s: 51.2, e: 0.7, n: 51.85 };

function distKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

export function regionOf(lng: number, lat: number): Region | null {
  if (lng >= UAE_BOX.w && lng <= UAE_BOX.e && lat >= UAE_BOX.s && lat <= UAE_BOX.n) {
    let best: Place = EMIRATES[0];
    let bd = Infinity;
    for (const e of EMIRATES) {
      const d = distKm(lat, lng, e.lat, e.lng);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return {
      country: { en: 'United Arab Emirates', ar: 'الإمارات العربية المتحدة' },
      area: { en: best.en, ar: best.ar },
      timeZone: 'Asia/Dubai',
    };
  }
  if (lng >= LONDON_BOX.w && lng <= LONDON_BOX.e && lat >= LONDON_BOX.s && lat <= LONDON_BOX.n) {
    return {
      country: { en: 'United Kingdom', ar: 'المملكة المتحدة' },
      area: { en: 'London', ar: 'لندن' },
      timeZone: 'Europe/London',
    };
  }
  return null;
}

export function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  return distKm(aLat, aLng, bLat, bLng);
}
