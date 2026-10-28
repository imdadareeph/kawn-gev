// ILLUSTRATIVE geometry only. These routes are approximate sketches used to lay out the interface
// and run a simulation. They are not RTA, ITC or any operator data, and positions are not surveyed.
// Replace with licensed operator feeds (GTFS and realtime) once an agreement exists.

export type TransitMode = 'metro' | 'tram' | 'bus';

export interface Stop {
  en: string;
  ar: string;
  lng: number;
  lat: number;
}

export interface TransitRoute {
  id: string;
  mode: TransitMode;
  en: string;
  ar: string;
  color: [number, number, number];
  /** [lng, lat] vertices. */
  path: [number, number][];
  stops?: Stop[];
  vehicles: number;
  /** Average speed including stops, metres per second. */
  speedMps: number;
}

const S = (en: string, ar: string, lat: number, lng: number): Stop => ({ en, ar, lat, lng });

const RED_STOPS: Stop[] = [
  S('Rashidiya', 'الراشدية', 25.229, 55.391),
  S('Emirates', 'الإمارات', 25.2397, 55.3775),
  S('Airport Terminal 3', 'مطار دبي T3', 25.2447, 55.358),
  S('Airport Terminal 1', 'مطار دبي T1', 25.2517, 55.3643),
  S('GGICO', 'جي جي آي سي أو', 25.258, 55.349),
  S('City Centre Deira', 'سيتي سنتر ديرة', 25.253, 55.331),
  S('Al Rigga', 'الرقة', 25.2625, 55.315),
  S('Union', 'الاتحاد', 25.266, 55.313),
  S('BurJuman', 'برجمان', 25.254, 55.304),
  S('ADCB', 'بنك أبوظبي التجاري', 25.243, 55.299),
  S('Max', 'ماكس', 25.233, 55.293),
  S('World Trade Centre', 'مركز التجارة العالمي', 25.225, 55.287),
  S('Emirates Towers', 'أبراج الإمارات', 25.217, 55.28),
  S('Financial Centre', 'المركز المالي', 25.211, 55.275),
  S('Burj Khalifa / Dubai Mall', 'برج خليفة / دبي مول', 25.201, 55.27),
  S('Business Bay', 'الخليج التجاري', 25.186, 55.2575),
  S('Mall of the Emirates', 'مول الإمارات', 25.118, 55.2005),
  S('Sharaf DG', 'شرف دي جي', 25.109, 55.193),
  S('Dubai Internet City', 'مدينة دبي للإنترنت', 25.095, 55.172),
  S('Nakheel', 'نخيل', 25.08, 55.15),
  S('DAMAC', 'داماك', 25.077, 55.144),
  S('Jumeirah Lakes Towers', 'أبراج بحيرات جميرا', 25.07, 55.14),
  S('Nakheel Harbour & Tower', 'نخيل هاربر آند تاور', 25.056, 55.133),
  S('Ibn Battuta', 'ابن بطوطة', 25.045, 55.118),
  S('Energy', 'إنرجي', 25.031, 55.105),
  S('Danube', 'الدانوب', 25.014, 55.089),
  S('UAE Exchange', 'يو إيه إي إكستشينج', 24.989, 55.064),
];

export const TRANSIT_ROUTES: TransitRoute[] = [
  {
    id: 'metro-red',
    mode: 'metro',
    en: 'Red Line (illustrative)',
    ar: 'الخط الأحمر (توضيحي)',
    color: [255, 107, 107],
    path: RED_STOPS.map((s) => [s.lng, s.lat] as [number, number]),
    stops: RED_STOPS,
    vehicles: 12,
    speedMps: 15,
  },
  {
    id: 'tram-marina',
    mode: 'tram',
    en: 'Marina Tram (illustrative)',
    ar: 'ترام المرسى (توضيحي)',
    color: [255, 180, 84],
    path: [
      [55.1425, 25.0815],
      [55.1385, 25.0775],
      [55.1325, 25.077],
      [55.13, 25.0815],
      [55.127, 25.0885],
      [55.1235, 25.0945],
    ],
    vehicles: 3,
    speedMps: 7,
  },
  {
    id: 'bus-ad-corniche-yas',
    mode: 'bus',
    en: 'Corniche – Saadiyat – Yas (illustrative)',
    ar: 'الكورنيش – السعديات – ياس (توضيحي)',
    color: [88, 182, 255],
    path: [
      [54.34, 24.478],
      [54.365, 24.49],
      [54.399, 24.517],
      [54.425, 24.531],
      [54.47, 24.51],
      [54.54, 24.48],
      [54.607, 24.4837],
    ],
    vehicles: 5,
    speedMps: 9,
  },
  {
    id: 'bus-sharjah',
    mode: 'bus',
    en: 'Rolla – Al Majaz – Muwaileh (illustrative)',
    ar: 'رولة – المجاز – المويلح (توضيحي)',
    color: [165, 139, 255],
    path: [
      [55.3925, 25.3585],
      [55.388, 25.342],
      [55.383, 25.327],
      [55.4, 25.31],
      [55.43, 25.299],
      [55.44, 25.295],
    ],
    vehicles: 4,
    speedMps: 8,
  },
  {
    id: 'bus-dubai-sharjah',
    mode: 'bus',
    en: 'Union – Sharjah (illustrative)',
    ar: 'الاتحاد – الشارقة (توضيحي)',
    color: [159, 227, 255],
    path: [
      [55.313, 25.266],
      [55.345, 25.278],
      [55.38, 25.299],
      [55.396, 25.317],
      [55.383, 25.327],
    ],
    vehicles: 4,
    speedMps: 10,
  },
];
