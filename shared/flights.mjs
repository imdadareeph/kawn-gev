// Shared by the server proxy and the browser fallback: validates a flights query and
// normalises a readsb-style aircraft list into one small uniform record shape.

/** Snap a coordinate so nearby requests share one cache entry. */
function snap(v, step) {
  return Math.round(v / step) * step;
}

/**
 * Validate and bound a point query. Returns null when the input is unusable.
 * @param {unknown} lat @param {unknown} lon @param {unknown} r radius in nautical miles
 */
export function clampQuery(lat, lon, r) {
  const la = Number.parseFloat(String(lat));
  const lo = Number.parseFloat(String(lon));
  const ra = Number.parseFloat(String(r));
  if (!Number.isFinite(la) || !Number.isFinite(lo) || !Number.isFinite(ra)) return null;
  if (la < -85 || la > 85 || lo < -180 || lo > 180) return null;
  const radius = Math.min(250, Math.max(5, Math.round(ra)));
  return {
    lat: Number(snap(la, 0.25).toFixed(2)),
    lon: Number(snap(lo, 0.25).toFixed(2)),
    r: radius,
  };
}

const EMERGENCY_SQUAWKS = new Set(['7500', '7600', '7700']);

/**
 * @param {any} json upstream body
 * @param {number} fallbackNowMs used when the upstream timestamp is missing
 */
export function normalizeAdsb(json, fallbackNowMs) {
  const list = Array.isArray(json?.ac) ? json.ac : [];
  const nowMs = typeof json?.now === 'number' && json.now > 1e11 ? json.now : fallbackNowMs;
  const out = [];
  let excludedMilitary = 0;
  for (const a of list) {
    if (out.length >= 1500) break;
    if (typeof a?.lat !== 'number' || typeof a?.lon !== 'number') continue;
    if (typeof a.hex !== 'string' || !/^[0-9a-fA-F~]{6,7}$/.test(a.hex)) continue;
    // Policy: military and state aircraft are not shown (regional security sensitivity).
    if (typeof a.dbFlags === 'number' && (a.dbFlags & 1) === 1) {
      excludedMilitary += 1;
      continue;
    }
    const onGround = a.alt_baro === 'ground';
    const altFt = typeof a.alt_baro === 'number' ? a.alt_baro : onGround ? 0 : null;
    const squawk = typeof a.squawk === 'string' ? a.squawk : null;
    const seenPos = typeof a.seen_pos === 'number' ? a.seen_pos : typeof a.seen === 'number' ? a.seen : 0;
    const track =
      typeof a.track === 'number' ? a.track : typeof a.true_heading === 'number' ? a.true_heading : null;
    out.push({
      id: a.hex.toLowerCase(),
      callsign: typeof a.flight === 'string' ? a.flight.trim().slice(0, 12) : '',
      reg: typeof a.r === 'string' ? a.r.slice(0, 12) : '',
      type: typeof a.t === 'string' ? a.t.slice(0, 8) : '',
      category: typeof a.category === 'string' ? a.category.slice(0, 3) : '',
      lat: a.lat,
      lon: a.lon,
      altFt,
      gsKt: typeof a.gs === 'number' ? a.gs : null,
      trackDeg: track,
      vsFpm: typeof a.baro_rate === 'number' ? a.baro_rate : typeof a.geom_rate === 'number' ? a.geom_rate : null,
      squawk,
      onGround,
      emergency: (squawk !== null && EMERGENCY_SQUAWKS.has(squawk)) || (typeof a.emergency === 'string' && a.emergency !== 'none'),
      posTime: Math.round(nowMs - seenPos * 1000),
    });
  }
  return { aircraft: out, excludedMilitary, upstreamNow: nowMs };
}
