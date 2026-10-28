import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from '../src/share';

describe('share link', () => {
  it('round-trips camera, layers, scope, language and theme', () => {
    const enc = encodeShare({
      view: { lng: 55.27123456, lat: 25.20456789, zoom: 11.234, bearing: 20.4, pitch: 45.2 },
      layers: ['flights', 'estate'],
      scopeOn: true,
      feather: 100,
      lang: 'ar',
      numerals: 'arab',
      theme: 'contrast',
      role: 'investor',
      flight: '7c6b2d',
    });
    const dec = decodeShare(`#${enc}`);
    expect(dec?.view).toEqual({ lng: 55.27123, lat: 25.20457, zoom: 11.23, bearing: 20, pitch: 45 });
    expect(dec?.layers).toEqual(['flights', 'estate']);
    expect(dec).toMatchObject({ scopeOn: true, feather: 100, lang: 'ar', numerals: 'arab', theme: 'contrast', role: 'investor', flight: '7c6b2d' });
  });

  it('encodes "no layers" distinctly from "not specified"', () => {
    expect(decodeShare(encodeShare({ layers: [] }))?.layers).toEqual([]);
    expect(decodeShare(encodeShare({ scopeOn: false }))?.layers).toBeUndefined();
  });

  it('fails closed on garbage and ignores out-of-range values', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('#zzz')).toBeNull();
    expect(decodeShare('#c=999,25&z=11')?.view).toBeUndefined();
    expect(decodeShare('#c=55,25&z=99')?.view).toBeUndefined();
    expect(decodeShare('#sf=500&lg=fr&th=neon')).toBeNull();
    expect(decodeShare('#f=<script>')).toBeNull();
  });

  it('never carries more than one tracked flight and rejects non-hex ids', () => {
    expect(encodeShare({ flight: 'not-hex' })).toBe('');
    expect(decodeShare('#f=abc123&f=def456')?.flight).toBe('abc123');
  });
});
