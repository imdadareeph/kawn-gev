// Dubai paid-parking tariffs (Parkin zones). Figures are the first-hour rates published in press coverage of the
// April 2025 tariff change (Gulf News, The National). They are SAMPLE inputs for this simulation: confirm with
// Parkin before relying on them. Zone letters for areas the sources do not name are sample assignments.
//
// Rules modelled: paid 08:00 to 22:00, free on Sundays, peak 08-10 and 16-20, off-peak 10-16 and 20-22.
// Multi-storey car parks charge around the clock. Public holidays and event surcharges are not modelled.

export type ZoneBand = 'peak' | 'offpeak' | 'free';

interface ZoneDef {
  /** Where the zone applies, in words, for the card. */
  area: string;
  offStreet: boolean;
  peak: [number, number];
  off: [number, number];
  /** Flat first-hour rate for the special zones (same all day). */
  flat?: number;
  day?: [number, number];
}

// [standard, premium] AED per first hour.
const ZONES: Record<string, ZoneDef> = {
  A: { area: 'On-street', offStreet: false, peak: [4, 6], off: [4, 4] },
  B: { area: 'Off-street lots', offStreet: true, peak: [4, 6], off: [3, 3], day: [30, 40] },
  C: { area: 'On-street', offStreet: false, peak: [4, 6], off: [2, 2] },
  D: { area: 'Off-street lots', offStreet: true, peak: [4, 6], off: [2, 2], day: [20, 30] },
  X: { area: 'Trade Centre', offStreet: false, peak: [4, 4], off: [4, 4], flat: 4 },
  E: { area: 'JLT', offStreet: false, peak: [10, 10], off: [10, 10], flat: 10 },
  I: { area: 'JLT', offStreet: false, peak: [10, 10], off: [10, 10], flat: 10 },
  F: { area: 'Knowledge Village, Media City, Internet City', offStreet: false, peak: [4, 4], off: [4, 4], flat: 4 },
  G: { area: 'Burj Khalifa, Marasi Bay, Healthcare City, Dubai Hills', offStreet: false, peak: [2, 2], off: [2, 2], flat: 2 },
  H: { area: 'Dubai Silicon Oasis', offStreet: false, peak: [4, 4], off: [4, 4], flat: 4 },
  J: { area: 'JLT', offStreet: false, peak: [4, 4], off: [4, 4], flat: 4 },
  K: { area: 'JLT', offStreet: false, peak: [4, 4], off: [4, 4], flat: 4 },
  L: { area: 'JLT', offStreet: false, peak: [4, 4], off: [4, 4], flat: 4 },
};

export interface ParsedZone {
  code: string;
  premium: boolean;
  def: ZoneDef;
}

/** "AP" is premium zone A, "C" is standard zone C. Returns null for an unknown code. */
export function parseZone(zone: string | undefined): ParsedZone | null {
  if (!zone) return null;
  const premium = zone.length === 2 && zone.endsWith('P') && 'ABCD'.includes(zone[0]);
  const code = premium ? zone[0] : zone;
  const def = ZONES[code];
  return def ? { code, premium, def } : null;
}

export interface TariffNow {
  paidNow: boolean;
  band: ZoneBand;
  /** AED per first hour right now; 0 when free. */
  aed: number;
  dayRate: number | null;
}

const DUBAI_UTC_OFFSET_H = 4;

export function tariffNow(zone: string | undefined, nowMs: number, allDay = false): TariffNow {
  const z = parseZone(zone);
  if (!z) return { paidNow: false, band: 'free', aed: 0, dayRate: null };
  const local = new Date(nowMs + DUBAI_UTC_OFFSET_H * 3_600_000);
  const hour = local.getUTCHours() + local.getUTCMinutes() / 60;
  const sunday = local.getUTCDay() === 0;
  const idx = z.premium ? 1 : 0;
  const dayRate = z.def.day ? z.def.day[idx] : null;
  if (!allDay && (sunday || hour < 8 || hour >= 22)) return { paidNow: false, band: 'free', aed: 0, dayRate };
  const peak = (hour >= 8 && hour < 10) || (hour >= 16 && hour < 20);
  if (z.def.flat !== undefined) return { paidNow: true, band: peak ? 'peak' : 'offpeak', aed: z.def.flat, dayRate };
  return { paidNow: true, band: peak ? 'peak' : 'offpeak', aed: (peak ? z.def.peak : z.def.off)[idx], dayRate };
}

export const ZONE_TABLE_NOTE = 'Parkin tariffs as reported in March and April 2025 press coverage';
