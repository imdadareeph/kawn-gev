// Tactical HUD frame and screen-space detection boxes, in the spirit of gods-eye-view.
// Written for this app: the boxes mark parking lots, vehicles, aircraft and the user.

export interface DetectItem {
  x: number;
  y: number;
  /** Short id, shown above the box. */
  tag: string;
  /** Short detail, shown below the box. */
  text: string;
  color: string;
  /** Half-size of the box in CSS pixels. */
  r: number;
  /** Selected items are always drawn and get a thicker box. */
  selected?: boolean;
}

export interface HudReadout {
  lat: string;
  lng: string;
  gsd: string;
  niirs: string;
  sun: string;
  alt: string;
  heading: string;
  pitch: string;
  scale: string;
  clock: string;
  look: string;
}

const MAX_BOXES = 36;

/** Ground sample distance in metres per pixel, derived from camera height only (a readout, not the imagery's true resolution). */
export const gsdFromAltitude = (altM: number): number => Math.max(0.01, altM * 0.000375);

/** Simplified GIQE-style interpretability rating from GSD, as in the reference HUD. Derived, not measured. */
export function niirsFromGsd(gsdM: number): number {
  const inches = gsdM * 39.3701;
  return Math.min(9, Math.max(0, 10.25 - 3.32 * Math.log10(inches)));
}

/** Sun elevation in degrees at a place and time (low-precision solar position, good to about a degree). */
export function sunElevationDeg(date: Date, latDeg: number, lngDeg: number): number {
  const rad = Math.PI / 180;
  const d = date.getTime() / 86_400_000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const lst = ((gmst * 15 + lngDeg) * rad) - ra;
  const lat = latDeg * rad;
  return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(lst)) / rad;
}

export class DetectionCanvas {
  private ctx: CanvasRenderingContext2D | null;
  private w = 0;
  private h = 0;
  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
  }

  private fit(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear(): void {
    this.fit();
    this.ctx?.clearRect(0, 0, this.w, this.h);
  }

  /** Draws up to MAX_BOXES, nearest the screen centre first, dimming toward the edges. */
  draw(items: DetectItem[], rtl: boolean, scopeAlpha?: (x: number, y: number) => number): void {
    const ctx = this.ctx;
    this.clear();
    if (!ctx) return;
    const cx = this.w / 2;
    const cy = this.h / 2;
    const diag = Math.hypot(cx, cy);
    const visible = items
      .filter((i) => i.x > -20 && i.y > -20 && i.x < this.w + 20 && i.y < this.h + 20)
      .map((i) => ({ i, d: Math.hypot(i.x - cx, i.y - cy) / diag }))
      .sort((a, b) => (a.i.selected ? -1 : b.i.selected ? 1 : a.d - b.d))
      .slice(0, MAX_BOXES);
    ctx.font = '600 10px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = rtl ? 'right' : 'left';
    for (const { i, d } of visible) {
      // With the scope on, boxes fade on the same keyhole as the veil; otherwise they dim gently toward the edges.
      ctx.globalAlpha = i.selected ? 1 : scopeAlpha ? Math.max(0.2, scopeAlpha(i.x, i.y)) : Math.max(0.3, 1 - d * 0.7);
      ctx.strokeStyle = i.color;
      ctx.fillStyle = i.color;
      ctx.lineWidth = i.selected ? 2 : 1.25;
      const { x, y, r } = i;
      const k = Math.max(4, r * 0.4);
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        const px = x + sx * r;
        const py = y + sy * r;
        ctx.moveTo(px - sx * k, py);
        ctx.lineTo(px, py);
        ctx.lineTo(px, py - sy * k);
      }
      ctx.stroke();
      const tx = rtl ? x + r : x - r;
      ctx.fillText(i.tag, tx, y - r - 4);
      if (i.text) ctx.fillText(i.text, tx, y + r + 12);
    }
    ctx.globalAlpha = 1;
  }
}

export class TacticalHud {
  private els: Record<keyof HudReadout, HTMLElement>;
  constructor(private root: HTMLElement) {
    const q = (k: string): HTMLElement => root.querySelector(`[data-tac="${k}"]`) as HTMLElement;
    this.els = {
      lat: q('lat'), lng: q('lng'), gsd: q('gsd'), niirs: q('niirs'), sun: q('sun'), alt: q('alt'), heading: q('heading'),
      pitch: q('pitch'), scale: q('scale'), clock: q('clock'), look: q('look'),
    };
  }
  show(on: boolean): void {
    this.root.hidden = !on;
  }
  /** The HUD takes the colour of the active look: NVG green, thermal white, CRT amber. */
  setLook(look: string): void {
    this.root.dataset.look = look;
  }
  set(r: HudReadout): void {
    for (const k of Object.keys(r) as (keyof HudReadout)[]) {
      if (this.els[k].textContent !== r[k]) this.els[k].textContent = r[k];
    }
  }
}

/** Static markup for the tactical frame. Labels come from the i18n table through data-i18n. */
export function tacticalHtml(): string {
  const cell = (k: string, i18n: string) =>
    `<span class="tac-cell"><span class="tac-k" data-i18n="${i18n}"></span><span class="tac-v mono" data-tac="${k}" dir="ltr"></span></span>`;
  return `
<canvas id="detect" class="detect" aria-hidden="true"></canvas>
<div id="tac" class="tac" aria-hidden="true">
  <i class="tac-corner tl"></i><i class="tac-corner tr"></i><i class="tac-corner bl"></i><i class="tac-corner br"></i>
  <div class="tac-reticle"><i></i><i></i><i></i><i></i></div>
  <div class="tac-strip top">
    <span class="tac-rec"><i></i><span class="mono" data-tac="look" dir="ltr"></span></span>
    ${cell('alt', 'tacAlt')}${cell('heading', 'tacHdg')}${cell('pitch', 'tacPit')}${cell('scale', 'tacScale')}
  </div>
  <div class="tac-strip bottom">${cell('lat', 'tacLat')}${cell('lng', 'tacLng')}${cell('gsd', 'tacGsd')}${cell('niirs', 'tacNiirs')}${cell('sun', 'tacSun')}${cell('clock', 'tacUtc')}</div>
</div>`;
}
