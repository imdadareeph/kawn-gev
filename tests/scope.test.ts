import { describe, expect, it } from 'vitest';
import { fadeCurve, labelAlpha, paramsFor, scopeGradient } from '../src/map/scope';

describe('scope fade', () => {
  it('at feather 100 the fade starts at the centre and is smooth to the edge', () => {
    expect(fadeCurve(0, 100)).toBe(0);
    expect(fadeCurve(1, 100)).toBe(1);
    let prev = -1;
    let maxStep = 0;
    for (let i = 0; i <= 100; i += 1) {
      const v = fadeCurve(i / 100, 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      if (prev >= 0) maxStep = Math.max(maxStep, v - prev);
      prev = v;
    }
    // no hard edge: no single 1% step moves the fade by more than 3.5%
    expect(maxStep).toBeLessThan(0.035);
  });

  it('at feather 0 the edge is hard', () => {
    expect(fadeCurve(0.5, 0)).toBe(0);
    expect(fadeCurve(0.8, 0)).toBe(1);
    expect(fadeCurve(0.75, 0) - fadeCurve(0.72, 0)).toBeGreaterThan(0.5);
  });

  it('fade never decreases with distance for any feather', () => {
    for (const f of [0, 25, 50, 75, 100]) {
      let prev = 0;
      for (let i = 0; i <= 50; i += 1) {
        const v = fadeCurve(i / 50, f);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
    }
  });

  it('uses the free area centre, not the window centre', () => {
    const p = paramsFor({ x: 300, y: 70, w: 700, h: 500 }, 100, 0.8);
    expect(p.cx).toBe(650);
    expect(p.cy).toBe(320);
  });

  it('builds a gradient that starts clear and ends at full strength', () => {
    const p = paramsFor({ x: 0, y: 0, w: 1000, h: 600 }, 100, 0.8);
    const css = scopeGradient(p, '3,6,10');
    expect(css.startsWith('radial-gradient(circle at 500.0px 300.0px, rgba(3,6,10,0.000) 0.0px')).toBe(true);
    expect(css).toContain('rgba(3,6,10,0.800)');
  });

  it('keeps labels sharp at the centre and faint toward the edge', () => {
    const p = paramsFor({ x: 0, y: 0, w: 1000, h: 600 }, 100, 0.8);
    expect(labelAlpha(p.cx, p.cy, p)).toBeCloseTo(1, 5);
    expect(labelAlpha(p.cx + p.radius, p.cy, p)).toBeLessThan(0.1);
    expect(labelAlpha(10, 10, null)).toBe(1);
  });
});
