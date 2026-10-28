// SAMPLE parking lots for the "find an empty space" simulation. Positions are approximate points near well-known
// places; capacities and occupancy are modelled, not read from any operator. Swap `occupancyAt` for a real feed
// (operator API, sensors, or camera counts) and everything else keeps working.

export type ParkingCity = 'dubai' | 'london';
export type ParkingKind = 'mall' | 'street' | 'garage' | 'transit';

export interface ParkingLot {
  id: string;
  city: ParkingCity;
  en: string;
  ar: string;
  lat: number;
  lng: number;
  capacity: number;
  kind: ParkingKind;
  /** Sample classification: paid lots follow a Parkin-style zone in Dubai. */
  fee: ParkingFee;
  /** Dubai paid lots only. "AP" is premium zone A. */
  zone?: string;
}

export type ParkingFee = 'free' | 'paid';

/** Zone and fee overrides for the hand-placed lots; everything else follows the type rules in `classify`. */
const OVERRIDE: Record<string, { fee?: ParkingFee; zone?: string }> = {
  'dub-burjblvd': { zone: 'G' },
  'dub-bizbay': { zone: 'AP' },
  'dub-jlt': { zone: 'J' },
  'dub-kitebeach': { zone: 'CP' },
  'dub-sportscity': { zone: 'C' },
  'dub-rigga': { zone: 'AP' },
  'dub-burdubai': { zone: 'AP' },
  'dub-zabeel': { zone: 'C' },
  'dub-jumeirah1': { zone: 'CP' },
  'dub-jbr': { zone: 'C' },
  'dub-globalvillage': { fee: 'free' },
  'dub-mamzar': { fee: 'free' },
  'dub-dic': { zone: 'F' },
  'dxb-jlt': { zone: 'J' },
};

/** Dubai: malls and park-and-ride free, street parking paid on-street zone C, garages paid off-street zone B. London: all paid. */
function classify(id: string, city: ParkingCity, kind: ParkingKind): { fee: ParkingFee; zone?: string } {
  const o = OVERRIDE[id] ?? {};
  if (city === 'london') return { fee: o.fee ?? 'paid' };
  const fee: ParkingFee = o.fee ?? (kind === 'street' || kind === 'garage' ? 'paid' : 'free');
  if (fee === 'free') return { fee };
  return { fee, zone: o.zone ?? (kind === 'garage' ? 'B' : 'C') };
}

const L = (id: string, city: ParkingCity, en: string, ar: string, lat: number, lng: number, capacity: number, kind: ParkingKind): ParkingLot => ({
  id, city, en, ar, lat, lng, capacity, kind, ...classify(id, city, kind),
});

const HAND_LOTS: ParkingLot[] = [
  L('dxb-downtown', 'dubai', 'Parking near Downtown Dubai', 'مواقف بالقرب من وسط دبي', 25.1985, 55.2784, 1800, 'mall'),
  L('dxb-moe', 'dubai', 'Parking near Mall of the Emirates', 'مواقف بالقرب من مول الإمارات', 25.1181, 55.2004, 1500, 'mall'),
  L('dxb-marina', 'dubai', 'Parking near Dubai Marina', 'مواقف بالقرب من دبي مارينا', 25.0775, 55.1403, 600, 'garage'),
  L('dxb-deira', 'dubai', 'Parking near Deira City Centre', 'مواقف بالقرب من ديرة سيتي سنتر', 25.2536, 55.3319, 1200, 'mall'),
  L('dxb-burjuman', 'dubai', 'Parking near BurJuman', 'مواقف بالقرب من برجمان', 25.2542, 55.3043, 700, 'garage'),
  L('dxb-festival', 'dubai', 'Parking near Festival City', 'مواقف بالقرب من فستيفال سيتي', 25.2214, 55.3512, 900, 'mall'),
  L('dxb-difc', 'dubai', 'Parking near DIFC', 'مواقف بالقرب من مركز دبي المالي', 25.2138, 55.2812, 450, 'garage'),
  L('dxb-jlt', 'dubai', 'Street parking near JLT', 'مواقف الشارع بالقرب من أبراج بحيرات الجميرا', 25.0693, 55.1442, 220, 'street'),
  L('dxb-metro-rashidiya', 'dubai', 'Park and ride near Rashidiya Metro', 'مواقف الركن والانتقال بالقرب من مترو الراشدية', 25.2297, 55.3919, 800, 'transit'),
  L('dxb-bluewaters', 'dubai', 'Parking near Bluewaters', 'مواقف بالقرب من بلو ووترز', 25.0792, 55.1209, 500, 'garage'),
  L('lon-whitecity', 'london', 'Parking near White City', 'مواقف بالقرب من وايت سيتي', 51.5073, -0.2217, 4500, 'mall'),
  L('lon-stratford', 'london', 'Parking near Stratford', 'مواقف بالقرب من ستراتفورد', 51.5434, -0.0092, 4000, 'mall'),
  L('lon-brentcross', 'london', 'Parking near Brent Cross', 'مواقف بالقرب من برنت كروس', 51.5766, -0.2234, 7000, 'mall'),
  L('lon-soho', 'london', 'Garage near Soho', 'مرآب بالقرب من سوهو', 51.5139, -0.1318, 600, 'garage'),
  L('lon-canarywharf', 'london', 'Parking near Canary Wharf', 'مواقف بالقرب من كاناري وارف', 51.5054, -0.0235, 900, 'garage'),
  L('lon-kingscross', 'london', "Garage near King's Cross", 'مرآب بالقرب من كينغز كروس', 51.5347, -0.124, 500, 'garage'),
  L('lon-victoria', 'london', 'Garage near Victoria', 'مرآب بالقرب من فيكتوريا', 51.4965, -0.1447, 450, 'garage'),
  L('lon-greenwich', 'london', 'Street parking near Greenwich', 'مواقف الشارع بالقرب من غرينتش', 51.4826, -0.0077, 260, 'street'),
  L('lon-wimbledon', 'london', 'Park and ride near Wimbledon', 'مواقف الركن والانتقال بالقرب من ويمبلدون', 51.4214, -0.2064, 700, 'transit'),
  L('dub-burjblvd', 'dubai', 'Parking near Burj Khalifa Boulevard', 'مواقف بالقرب من بوليفارد برج خليفة', 25.193, 55.274, 180, 'street'),
  L('dub-bizbay', 'dubai', 'Street parking in Business Bay', 'مواقف بالقرب من الخليج التجاري', 25.185, 55.264, 300, 'street'),
  L('dub-bayave', 'dubai', 'Garage near Bay Avenue', 'مواقف بالقرب من باي أفنيو', 25.1858, 55.271, 400, 'garage'),
  L('dub-citywalk', 'dubai', 'Parking near City Walk', 'مواقف بالقرب من سيتي ووك', 25.2084, 55.2625, 600, 'mall'),
  L('dub-lamer', 'dubai', 'Garage near La Mer', 'مواقف بالقرب من لا مير', 25.2342, 55.2639, 500, 'garage'),
  L('dub-kitebeach', 'dubai', 'Street parking near Kite Beach', 'مواقف بالقرب من كايت بيتش', 25.1412, 55.195, 250, 'street'),
  L('dub-mercato', 'dubai', 'Parking near Mercato Mall', 'مواقف بالقرب من ميركاتو', 25.2178, 55.2528, 700, 'mall'),
  L('dub-dubaihills', 'dubai', 'Parking near Dubai Hills Mall', 'مواقف بالقرب من دبي هيلز مول', 25.101, 55.242, 3000, 'mall'),
  L('dub-ibnbattuta', 'dubai', 'Parking near Ibn Battuta Mall', 'مواقف بالقرب من ابن بطوطة مول', 25.0446, 55.1177, 4000, 'mall'),
  L('dub-jbr', 'dubai', 'Street parking near JBR', 'مواقف بالقرب من جي بي آر', 25.079, 55.133, 300, 'street'),
  L('dub-creekharbour', 'dubai', 'Garage near Dubai Creek Harbour', 'مواقف بالقرب من ميناء خور دبي', 25.2, 55.345, 400, 'garage'),
  L('dub-ghurair', 'dubai', 'Parking near Al Ghurair Centre', 'مواقف بالقرب من مركز الغرير', 25.2653, 55.318, 1300, 'mall'),
  L('dub-wafi', 'dubai', 'Parking near Wafi Mall', 'مواقف بالقرب من وافي مول', 25.2287, 55.3186, 1500, 'mall'),
  L('dub-airport-t1', 'dubai', 'Garage near Dubai Airport Terminal 1', 'مواقف بالقرب من المبنى 1 بمطار دبي', 25.2532, 55.3657, 2000, 'garage'),
  L('dub-airport-t3', 'dubai', 'Garage near Dubai Airport Terminal 3', 'مواقف بالقرب من المبنى 3 بمطار دبي', 25.248, 55.36, 2500, 'garage'),
  L('dub-globalvillage', 'dubai', 'Open lots near Global Village', 'مواقف بالقرب من القرية العالمية', 25.07, 55.307, 2000, 'street'),
  L('dub-expo', 'dubai', 'Park and ride near Expo City Metro', 'مواقف بالقرب من مترو مدينة إكسبو', 24.9633, 55.148, 1500, 'transit'),
  L('dub-d3', 'dubai', 'Garage near Dubai Design District', 'مواقف بالقرب من حي دبي للتصميم', 25.185, 55.301, 600, 'garage'),
  L('dub-dic', 'dubai', 'Garage near Dubai Internet City', 'مواقف بالقرب من مدينة دبي للإنترنت', 25.098, 55.165, 400, 'garage'),
  L('dub-sportscity', 'dubai', 'Street parking near Sports City', 'مواقف بالقرب من مدينة دبي الرياضية', 25.042, 55.219, 200, 'street'),
  L('dub-nakheel', 'dubai', 'Parking near Nakheel Mall', 'مواقف بالقرب من نخيل مول', 25.1124, 55.139, 1000, 'mall'),
  L('dub-atlantis', 'dubai', 'Garage near Atlantis The Palm', 'مواقف بالقرب من أتلانتس النخلة', 25.1304, 55.1171, 700, 'garage'),
  L('dub-madinat', 'dubai', 'Garage near Madinat Jumeirah', 'مواقف بالقرب من مدينة جميرا', 25.133, 55.185, 800, 'garage'),
  L('dub-rigga', 'dubai', 'Street parking near Al Rigga', 'مواقف بالقرب من الرقة', 25.264, 55.319, 200, 'street'),
  L('dub-burdubai', 'dubai', 'Street parking in Bur Dubai', 'مواقف بالقرب من بر دبي', 25.264, 55.297, 150, 'street'),
  L('dub-zabeel', 'dubai', 'Parking near Zabeel Park', 'مواقف بالقرب من حديقة زعبيل', 25.23, 55.2995, 500, 'street'),
  L('dub-jumeirah1', 'dubai', 'Street parking in Jumeirah 1', 'مواقف بالقرب من جميرا 1', 25.215, 55.258, 220, 'street'),
  L('dub-dragonmart', 'dubai', 'Parking near Dragon Mart', 'مواقف بالقرب من دراغون مارت', 25.177, 55.413, 7000, 'mall'),
  L('dub-mirdif', 'dubai', 'Parking near City Centre Mirdif', 'مواقف بالقرب من سيتي سنتر مردف', 25.2168, 55.4085, 4000, 'mall'),
  L('dub-mamzar', 'dubai', 'Parking near Al Mamzar Beach', 'مواقف بالقرب من شاطئ الممزر', 25.2967, 55.343, 800, 'street'),
  L('lon-wembley', 'london', 'Garage near Wembley', 'مواقف بالقرب من ويمبلي', 51.556, -0.2796, 1000, 'garage'),
  L('lon-o2', 'london', 'Garage near The O2', 'مواقف بالقرب من أو تو', 51.503, 0.0032, 2000, 'garage'),
  L('lon-lhr-t5', 'london', 'Garage near Heathrow Terminal 5', 'مواقف بالقرب من المبنى 5 في هيثرو', 51.47, -0.488, 3000, 'garage'),
  L('lon-lhr-t2', 'london', 'Garage near Heathrow Terminal 2', 'مواقف بالقرب من المبنى 2 في هيثرو', 51.4713, -0.4543, 3000, 'garage'),
  L('lon-coventgarden', 'london', 'Garage near Covent Garden', 'مواقف بالقرب من كوفنت غاردن', 51.5129, -0.1243, 1000, 'garage'),
  L('lon-westminster', 'london', 'Street parking near Westminster', 'مواقف بالقرب من وستمنستر', 51.4994, -0.127, 150, 'street'),
  L('lon-marblearch', 'london', 'Garage near Marble Arch', 'مواقف بالقرب من ماربل آرتش', 51.5136, -0.1586, 900, 'garage'),
  L('lon-kensington', 'london', 'Street parking in Kensington', 'مواقف بالقرب من كنسينغتون', 51.501, -0.19, 200, 'street'),
  L('lon-southbank', 'london', 'Street parking on the South Bank', 'مواقف بالقرب من ساوث بانك', 51.5055, -0.116, 250, 'street'),
  L('lon-camden', 'london', 'Street parking in Camden', 'مواقف بالقرب من كامدن', 51.539, -0.1426, 200, 'street'),
  L('lon-richmond', 'london', 'Park and ride near Richmond', 'مواقف بالقرب من ريتشموند', 51.4613, -0.3037, 600, 'transit'),
  L('lon-croydon', 'london', 'Parking near Croydon', 'مواقف بالقرب من كرويدون', 51.375, -0.098, 1000, 'mall'),
  L('lon-kingston', 'london', 'Parking near Kingston', 'مواقف بالقرب من كينغستون', 51.4096, -0.3064, 1000, 'mall'),
  L('lon-battersea', 'london', 'Garage near Battersea Power Station', 'مواقف بالقرب من محطة باترسي للطاقة', 51.4818, -0.1445, 700, 'garage'),
  L('lon-excel', 'london', 'Garage near ExCeL London', 'مواقف بالقرب من إكسيل لندن', 51.508, 0.0295, 2000, 'garage'),
  L('lon-cockfosters', 'london', 'Park and ride near Cockfosters', 'مواقف بالقرب من كوكفوسترز', 51.6517, -0.1496, 400, 'transit'),
];


// ---- Street and lot parking spread across Dubai districts (sample positions and capacities) ----
// [slug, English, Arabic, lat, lng, zone, paid street groups]
type District = [string, string, string, number, number, string, number];
const DISTRICTS: District[] = [
  ['alrigga', 'Al Rigga', 'الرقة', 25.264, 55.319, 'AP', 6],
  ['naif', 'Naif', 'نايف', 25.271, 55.31, 'AP', 5],
  ['baniyas', 'Baniyas Square', 'ميدان بني ياس', 25.267, 55.305, 'AP', 5],
  ['alras', 'Al Ras', 'الراس', 25.27, 55.298, 'AP', 4],
  ['muraqqabat', 'Al Muraqqabat', 'المرقبات', 25.26, 55.335, 'C', 5],
  ['alfahidi', 'Al Fahidi', 'الفهيدي', 25.263, 55.297, 'AP', 5],
  ['mankhool', 'Al Mankhool', 'المنخول', 25.248, 55.296, 'AP', 5],
  ['karama', 'Al Karama', 'الكرامة', 25.245, 55.303, 'CP', 6],
  ['oudmetha', 'Oud Metha', 'عود ميثاء', 25.237, 55.31, 'C', 4],
  ['umhurair', 'Umm Hurair', 'أم هرير', 25.229, 55.32, 'C', 3],
  ['jaddaf', 'Al Jaddaf', 'الجداف', 25.215, 55.33, 'C', 4],
  ['garhoud', 'Al Garhoud', 'القرهود', 25.242, 55.35, 'C', 4],
  ['festival', 'Festival City', 'فستيفال سيتي', 25.22, 55.351, 'D', 3],
  ['satwa', 'Al Satwa', 'السطوة', 25.229, 55.27, 'CP', 6],
  ['jumeirah1', 'Jumeirah 1', 'جميرا 1', 25.215, 55.258, 'CP', 5],
  ['jumeirah2', 'Jumeirah 2', 'جميرا 2', 25.203, 55.247, 'CP', 5],
  ['jumeirah3', 'Jumeirah 3', 'جميرا 3', 25.188, 55.238, 'CP', 4],
  ['umsuqeim', 'Umm Suqeim', 'أم سقيم', 25.15, 55.2, 'C', 4],
  ['alwasl', 'Al Wasl Road', 'شارع الوصل', 25.197, 55.24, 'AP', 6],
  ['alsafa', 'Al Safa', 'الصفا', 25.179, 55.235, 'C', 4],
  ['quoz1', 'Al Quoz 1', 'القوز 1', 25.156, 55.238, 'C', 4],
  ['quozind', 'Al Quoz Industrial', 'القوز الصناعية', 25.145, 55.23, 'D', 4],
  ['barsha1', 'Al Barsha 1', 'البرشاء 1', 25.112, 55.198, 'C', 5],
  ['barshasouth', 'Al Barsha South', 'البرشاء الجنوب', 25.09, 55.24, 'D', 3],
  ['downtown', 'Downtown Dubai', 'وسط دبي', 25.195, 55.276, 'AP', 6],
  ['businessbay', 'Business Bay', 'الخليج التجاري', 25.185, 55.268, 'AP', 6],
  ['difc', 'DIFC', 'مركز دبي المالي', 25.213, 55.28, 'AP', 4],
  ['tradecentre', 'Trade Centre', 'المركز التجاري', 25.223, 55.287, 'X', 4],
  ['marasi', 'Marasi Bay', 'مراسي باي', 25.183, 55.27, 'G', 3],
  ['healthcare', 'Healthcare City', 'مدينة دبي الطبية', 25.233, 55.317, 'G', 3],
  ['dubaihills', 'Dubai Hills', 'دبي هيلز', 25.101, 55.242, 'G', 4],
  ['marina', 'Dubai Marina', 'دبي مارينا', 25.08, 55.14, 'C', 6],
  ['jbr', 'JBR', 'جي بي آر', 25.078, 55.134, 'C', 5],
  ['jltj', 'JLT cluster J', 'أبراج بحيرات جميرا ج', 25.069, 55.144, 'J', 4],
  ['jltk', 'JLT cluster K', 'أبراج بحيرات جميرا ك', 25.074, 55.152, 'K', 4],
  ['jlte', 'JLT cluster E', 'أبراج بحيرات جميرا هـ', 25.068, 55.15, 'E', 3],
  ['mediacity', 'Media City', 'مدينة دبي للإعلام', 25.095, 55.153, 'F', 4],
  ['internetcity', 'Internet City', 'مدينة دبي للإنترنت', 25.098, 55.165, 'F', 4],
  ['knowledge', 'Knowledge Village', 'القرية المعرفية', 25.102, 55.163, 'F', 3],
  ['palm', 'Palm Jumeirah', 'نخلة جميرا', 25.112, 55.139, 'C', 5],
  ['siliconoasis', 'Silicon Oasis', 'واحة دبي للسيليكون', 25.121, 55.38, 'H', 5],
  ['mirdif', 'Mirdif', 'مردف', 25.22, 55.42, 'D', 5],
  ['alnahda', 'Al Nahda', 'النهدة', 25.29, 55.37, 'C', 5],
  ['qusais', 'Al Qusais', 'القصيص', 25.275, 55.385, 'C', 5],
  ['hoalanz', 'Hor Al Anz', 'هور العنز', 25.28, 55.328, 'C', 4],
  ['mamzar', 'Al Mamzar', 'الممزر', 25.297, 55.343, 'D', 3],
  ['warqa', 'Al Warqa', 'الورقاء', 25.19, 55.415, 'D', 4],
  ['motorcity', 'Motor City', 'مدينة السيارات', 25.05, 55.238, 'D', 3],
  ['furjan', 'Al Furjan', 'الفرجان', 25.027, 55.145, 'D', 3],
];

const jit = (id: string, k: number): number => hash(id, k);

function districtLots(): ParkingLot[] {
  const out: ParkingLot[] = [];
  for (const [slug, en, ar, lat, lng, zone, n] of DISTRICTS) {
    const mPerLng = 111_320 * Math.cos((lat * Math.PI) / 180);
    for (let i = 0; i < n + 1; i += 1) {
      const id = `dub-${slug}-${i + 1}`;
      const ang = (2 * Math.PI * i) / (n + 1) + jit(id, 1) * 0.9;
      const r = 130 + 330 * jit(id, 2);
      const free = i === n; // the last lot in each district is a free one
      out.push({
        id,
        city: 'dubai',
        en: free ? `Free lot near ${en}` : `Street parking in ${en} · ${i + 1}`,
        ar: free ? `موقف مجاني بالقرب من ${ar}` : `مواقف الشارع في ${ar} · ${i + 1}`,
        lat: lat + (r * Math.sin(ang)) / 111_320,
        lng: lng + (r * Math.cos(ang)) / mPerLng,
        capacity: Math.round(40 + 140 * jit(id, 3)),
        kind: 'street',
        fee: free ? 'free' : 'paid',
        ...(free ? {} : { zone }),
      });
    }
  }
  return out;
}

export const PARKING_LOTS: ParkingLot[] = [...HAND_LOTS, ...districtLots()];

const UTC_OFFSET_H: Record<ParkingCity, number> = { dubai: 4, london: 0 };

function hash(str: string, slot: number): number {
  let h = 2166136261;
  const s = `${str}:${slot}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Typical share of spaces taken by local hour (0..23); busy at lunch and in the evening. */
function demand(hour: number, kind: ParkingKind, weekend: boolean): number {
  const bump = (c: number, w: number) => Math.exp(-(((hour - c) / w) ** 2));
  if (kind === 'transit') return 0.15 + 0.8 * bump(9, 2.2) + 0.15 * bump(18, 2);
  if (kind === 'street') return 0.3 + 0.55 * bump(13, 4) + 0.1 * bump(20, 2);
  const lunch = weekend ? 0.55 : 0.4;
  const evening = weekend ? 0.7 : 0.5;
  return 0.12 + lunch * bump(13.5, 2.6) + evening * bump(20, 2.2);
}

export interface Occupancy {
  free: number;
  taken: number;
  pct: number;
}

/** Modelled occupancy: smooth daily pattern plus slow, deterministic noise that changes every two minutes. */
export function occupancyAt(lot: ParkingLot, nowMs: number): Occupancy {
  const local = new Date(nowMs + UTC_OFFSET_H[lot.city] * 3_600_000);
  const hour = local.getUTCHours() + local.getUTCMinutes() / 60;
  const weekend = [0, 6].includes(local.getUTCDay());
  const slot = Math.floor(nowMs / 120_000);
  const wobble = (hash(lot.id, slot) - 0.5) * 0.22 + (hash(lot.id, 0) - 0.5) * 0.3;
  const share = Math.min(1, Math.max(0.02, demand(hour, lot.kind, weekend) + wobble));
  const taken = Math.round(lot.capacity * share);
  return { free: lot.capacity - taken, taken, pct: share };
}

export type FreeLevel = 'plenty' | 'few' | 'full';

export function levelOf(o: Occupancy, lot: ParkingLot): FreeLevel {
  const f = o.free / lot.capacity;
  if (f >= 0.2) return 'plenty';
  if (f >= 0.06) return 'few';
  return 'full';
}

export function cityOfPoint(lat: number, lng: number): ParkingCity | null {
  if (Math.abs(lat - 25.2) < 0.9 && Math.abs(lng - 55.27) < 1.0) return 'dubai';
  if (Math.abs(lat - 51.5) < 0.6 && Math.abs(lng + 0.1) < 0.8) return 'london';
  return null;
}

/** One colour per lot type, used on the map and in the legend. */
export const KIND_COLOR: Record<ParkingKind, string> = {
  mall: '#b48cff',
  garage: '#58b6ff',
  street: '#ff9f43',
  transit: '#2ee6c5',
};
