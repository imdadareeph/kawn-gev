import { describe, expect, it } from 'vitest';
import { normalize, parseCoordinates, searchLocal } from '../src/search';

describe('coordinates', () => {
  it('parses common notations', () => {
    expect(parseCoordinates('25.2048, 55.2708')).toEqual({ lat: 25.2048, lng: 55.2708 });
    expect(parseCoordinates('25.2048 N 55.2708 E')).toEqual({ lat: 25.2048, lng: 55.2708 });
    expect(parseCoordinates('51.47 N 0.454 W')).toEqual({ lat: 51.47, lng: -0.454 });
    expect(parseCoordinates('lat 25.2 lon 55.3')).toEqual({ lat: 25.2, lng: 55.3 });
  });
  it('rejects out-of-range or non-coordinates', () => {
    expect(parseCoordinates('95, 10')).toBeNull();
    expect(parseCoordinates('dubai')).toBeNull();
    expect(parseCoordinates('1 2 3')).toBeNull();
  });
});

describe('bilingual gazetteer', () => {
  it('folds Arabic spelling variants', () => {
    expect(normalize('أبوظبي')).toBe(normalize('ابوظبي'));
    expect(normalize('مدينة')).toBe(normalize('مدينه'));
    expect(normalize('١٢٣')).toBe('123');
  });

  it('finds Abu Dhabi from either script and with spacing differences', () => {
    for (const q of ['abu dhabi', 'Abudhabi', 'أبوظبي', 'ابو ظبي']) {
      expect(searchLocal(q)[0]?.id).toBe('abudhabi');
    }
  });

  it('finds airports by code and by name in both languages', () => {
    expect(searchLocal('dxb')[0]?.id).toBe('dxb');
    expect(searchLocal('heathrow')[0]?.id).toBe('lhr');
    expect(searchLocal('مطار دبي الدولي')[0]?.id).toBe('dxb');
  });

  it('finds landmarks and districts, ignoring the Arabic article', () => {
    expect(searchLocal('برج خليفة')[0]?.id).toBe('burj-khalifa');
    expect(searchLocal('marina')[0]?.id).toBe('dubai-marina');
    expect(searchLocal('المرسى')[0]?.id).toBe('dubai-marina');
  });

  it('returns a coordinate hit for coordinate input and nothing for nonsense', () => {
    expect(searchLocal('25.2, 55.27')[0]?.source).toBe('coords');
    expect(searchLocal('qqqqzz')).toEqual([]);
  });
});
