// Scope view: a keyhole spotlight on the middle of the free map area. Detail stays sharp inside,
// and fades smoothly toward the edges into a soft vignette. At feather 100 the clear area is wide
// (about 45% of the radius, which itself reaches past the corners) and there is no hard edge anywhere.

export interface ScopeParams {
  cx: number;
  cy: number;
  /** Radius in px where the vignette reaches full strength. */
  radius: number;
  /** 0 to 100. */
  feather: number;
  /** Peak vignette opacity, 0 to 1. */
  strength: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Vignette amount (0 clear, 1 full) at normalised distance t from the scope centre. */
export function fadeCurve(t: number, feather: number): number {
  const f = Math.min(1, Math.max(0, feather / 100));
  const inner = lerp(0.72, 0.45, f);
  const outer = lerp(0.76, 1, f);
  if (t <= inner) return 0;
  if (t >= outer) return 1;
  return smooth((t - inner) / (outer - inner));
}

/** Opacity for a detection label at a screen point: sharp inside, softly fading outward. */
export function labelAlpha(x: number, y: number, p: ScopeParams | null): number {
  if (!p) return 1;
  const t = Math.hypot(x - p.cx, y - p.cy) / p.radius;
  return 1 - 0.93 * fadeCurve(t, p.feather);
}

/** CSS radial-gradient for the vignette. `rgb` is "r,g,b". */
export function scopeGradient(p: ScopeParams, rgb: string): string {
  const steps = 24;
  const stops: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const a = fadeCurve(t, p.feather) * p.strength;
    stops.push(`rgba(${rgb},${a.toFixed(3)}) ${(t * p.radius).toFixed(1)}px`);
  }
  return `radial-gradient(circle at ${p.cx.toFixed(1)}px ${p.cy.toFixed(1)}px, ${stops.join(', ')})`;
}

export interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Scope geometry from the free map area (not the whole window), so panels never push the hero off-centre. */
export function paramsFor(rect: FreeRect, feather: number, strength: number): ScopeParams {
  return {
    cx: rect.x + rect.w / 2,
    cy: rect.y + rect.h / 2,
    // At feather 100 the scope reaches well past the corners, so the whole view stays readable.
    radius: Math.max(120, 0.5 * Math.hypot(rect.w, rect.h) * lerp(0.78, 1.5, Math.min(1, Math.max(0, feather / 100)))),
    feather,
    strength,
  };
}

export class ScopeOverlay {
  private params: ScopeParams | null = null;
  constructor(private el: HTMLElement) {}

  /** Returns the active params, or null when Scope is off. */
  update(on: boolean, rect: FreeRect, feather: number, rgb: string, strength: number): ScopeParams | null {
    if (!on) {
      this.el.hidden = true;
      this.el.style.background = 'none';
      this.params = null;
      return null;
    }
    this.params = paramsFor(rect, feather, strength);
    this.el.hidden = false;
    this.el.style.background = scopeGradient(this.params, rgb);
    return this.params;
  }

  current(): ScopeParams | null {
    return this.params;
  }
}
