// Orbit data (CelesTrak OMM JSON) is untrusted input: keep only the fields SGP4 needs, check every number.
const NUM_KEYS = [
  'MEAN_MOTION', 'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE', 'ARG_OF_PERICENTER', 'MEAN_ANOMALY',
  'BSTAR', 'MEAN_MOTION_DOT', 'MEAN_MOTION_DDOT', 'NORAD_CAT_ID', 'ELEMENT_SET_NO', 'REV_AT_EPOCH',
];
export const MAX_SATELLITES = 1000;
export const MAX_DENSE = 3000;
/** Core groups in dedupe-priority order: an object in several groups keeps the first (most specific) tag. */
export const SAT_GROUPS = [
  { tag: 'stations', path: 'stations' },
  { tag: 'visual', path: 'visual' },
  { tag: 'gps', path: 'gps-ops' },
  { tag: 'glonass', path: 'glo-ops' },
  { tag: 'galileo', path: 'galileo' },
  { tag: 'geo', path: 'geo' },
];
export const DENSE_GROUP = { tag: 'dense', path: 'starlink' };
/** Display class for a group tag. */
export const SAT_CLASS = { stations: 'station', visual: 'visual', gps: 'nav', glonass: 'nav', galileo: 'nav', geo: 'geo', dense: 'dense' };

/** @returns {object[]} sanitised OMM records, newest element set wins per NORAD id. */
export function normalizeOmm(list, cap = MAX_SATELLITES, group = '') {
  if (!Array.isArray(list)) return [];
  const byId = new Map();
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const name = typeof raw.OBJECT_NAME === 'string' ? raw.OBJECT_NAME.trim().slice(0, 40) : '';
    const epoch = typeof raw.EPOCH === 'string' ? raw.EPOCH : '';
    if (!name || !Number.isFinite(Date.parse(epoch + (epoch.endsWith('Z') ? '' : 'Z')))) continue;
    const out = { GROUP: group, OBJECT_NAME: name, OBJECT_ID: typeof raw.OBJECT_ID === 'string' ? raw.OBJECT_ID.slice(0, 20) : '', EPOCH: epoch };
    if (typeof raw.OWNER === 'string' && /^[A-Z0-9]{1,8}$/.test(raw.OWNER)) out.OWNER = raw.OWNER;
    let ok = true;
    for (const k of NUM_KEYS) {
      const v = Number(raw[k]);
      if (!Number.isFinite(v)) {
        if (k === 'REV_AT_EPOCH') continue;
        ok = false;
        break;
      }
      out[k] = v;
    }
    if (!ok || out.MEAN_MOTION <= 0 || out.ECCENTRICITY < 0 || out.ECCENTRICITY >= 1) continue;
    const prev = byId.get(out.NORAD_CAT_ID);
    if (!prev || Date.parse(out.EPOCH) > Date.parse(prev.EPOCH)) byId.set(out.NORAD_CAT_ID, out);
  }
  return [...byId.values()].slice(0, cap);
}

/** Merge per-group lists (already normalised, in priority order); an id keeps its first group. */
export function mergeGroups(lists, cap = MAX_SATELLITES) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const o of list) {
      if (seen.has(o.NORAD_CAT_ID)) continue;
      seen.add(o.NORAD_CAT_ID);
      out.push(o);
      if (out.length >= cap) return out;
    }
  }
  return out;
}

/** Copy the owning country code from SATCAT rows onto orbit records, matched by NORAD id. */
export function attachOwners(omms, satcat) {
  if (!Array.isArray(satcat)) return omms;
  const owner = new Map();
  for (const r of satcat) {
    const id = Number(r?.NORAD_CAT_ID);
    if (Number.isFinite(id) && typeof r.OWNER === 'string' && /^[A-Z0-9]{1,8}$/.test(r.OWNER)) owner.set(id, r.OWNER);
  }
  for (const o of omms) {
    const c = owner.get(o.NORAD_CAT_ID);
    if (c) o.OWNER = c;
  }
  return omms;
}
