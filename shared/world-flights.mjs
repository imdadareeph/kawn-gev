// OpenSky state vectors are untrusted input. Keep only what the map needs, check every number, and thin to a budget.
export const MAX_WORLD = 4000;

/** @typedef {{id:string,cs:string,ctry:string,lat:number,lon:number,alt:number|null,gs:number|null,trk:number|null,vr:number|null,t:number}} WorldAircraft */

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Airborne aircraft from an OpenSky `states/all` body. `t` is the position time in epoch seconds. */
export function parseStates(json) {
  const states = Array.isArray(json?.states) ? json.states : [];
  const fallbackT = num(json?.time) ?? Math.floor(Date.now() / 1000);
  /** @type {WorldAircraft[]} */
  const out = [];
  for (const s of states) {
    if (!Array.isArray(s) || s[8] === true) continue; // on the ground
    const lon = num(s[5]);
    const lat = num(s[6]);
    if (lon === null || lat === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const id = typeof s[0] === 'string' ? s[0].toLowerCase() : '';
    if (!/^[0-9a-f]{6}$/.test(id)) continue;
    out.push({
      id,
      cs: typeof s[1] === 'string' ? s[1].trim().slice(0, 8) : '',
      ctry: typeof s[2] === 'string' ? s[2].slice(0, 40) : '',
      lat,
      lon,
      alt: num(s[13]) ?? num(s[7]),
      gs: num(s[9]),
      trk: num(s[10]),
      vr: num(s[11]),
      t: num(s[3]) ?? fallbackT,
    });
  }
  return out;
}

/** @returns {{lamin:number,lomin:number,lamax:number,lomax:number}|null} null means the whole world. */
export function clampWorldQuery(get) {
  const f = (k) => {
    const raw = get(k);
    if (raw === null || raw === undefined || raw === '') return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : NaN;
  };
  const vals = [f('lamin'), f('lomin'), f('lamax'), f('lomax')];
  const maxRaw = Number(get('max') ?? 1500);
  const max = Math.min(MAX_WORLD, Math.max(50, Number.isFinite(maxRaw) ? Math.round(maxRaw) : 1500));
  if (vals.every((v) => v === null)) return { box: null, max };
  if (vals.some((v) => v === null || Number.isNaN(v))) return null;
  const [lamin, lomin, lamax, lomax] = vals;
  if (lamin < -90 || lamax > 90 || lamin >= lamax || lomin < -180 || lomax > 180 || lomin >= lomax) return null;
  return { box: { lamin, lomin, lamax, lomax }, max };
}

/**
 * Keep at most `max` aircraft inside `box`. When there are more, keep one per grid cell, widening the cell until it fits,
 * so the map stays evenly covered instead of favouring busy corridors.
 */
export function thin(list, box, max) {
  const inBox = box ? list.filter((a) => a.lat >= box.lamin && a.lat <= box.lamax && a.lon >= box.lomin && a.lon <= box.lomax) : list;
  if (inBox.length <= max) return { aircraft: inBox, inView: inBox.length, cellDeg: 0 };
  for (const cell of [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12]) {
    const seen = new Map();
    for (const a of inBox) {
      const k = `${Math.floor(a.lat / cell)}:${Math.floor(a.lon / cell)}`;
      const prev = seen.get(k);
      if (!prev || a.id < prev.id) seen.set(k, a); // deterministic: the same aircraft wins each time
    }
    if (seen.size <= max) return { aircraft: [...seen.values()], inView: inBox.length, cellDeg: cell };
  }
  return { aircraft: inBox.slice(0, max), inView: inBox.length, cellDeg: 12 };
}

/** Cache lifetime from the credits OpenSky says are left. A global call costs 4 credits, so slow down as the day's budget thins. */
export function creditTtlMs(remaining, base = 30_000) {
  if (!Number.isFinite(remaining)) return base;
  if (remaining > 2400) return base;
  if (remaining > 1200) return Math.max(base, 60_000);
  if (remaining > 400) return Math.max(base, 120_000);
  return Math.max(base, 300_000);
}
