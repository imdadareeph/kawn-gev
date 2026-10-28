// Sensor looks. The GLSL post-process shaders in this folder come from the
// open-source gods-eye-view project (MIT, © 2026 Bilawal Sidhu); see
// THIRD_PARTY_NOTICES.md. The stage wiring below is written for this app.
import { PostProcessStage, type Scene } from 'cesium';
import { retroShader } from './retro';
import { nightVisionShader } from './surveillance';
import { thermalShader } from './thermal';
import { animeShader } from './anime';
import { noirShader } from './noir';
import { snowShader } from './snow';

export const LOOK_IDS = ['none', 'retro', 'surveillance', 'thermal', 'anime', 'noir', 'snow'] as const;
export type LookId = (typeof LOOK_IDS)[number];
export const isLook = (v: unknown): v is LookId => typeof v === 'string' && (LOOK_IDS as readonly string[]).includes(v);

interface ShaderDef {
  fragmentShader: string;
  uniforms?: Record<string, { default: number; min?: number; max?: number; label?: string }>;
}
const SHADERS: Record<Exclude<LookId, 'none'>, ShaderDef> = {
  retro: retroShader,
  surveillance: nightVisionShader,
  thermal: thermalShader,
  anime: animeShader,
  noir: noirShader,
  snow: snowShader,
};

/** Tactical tuning gods-eye-view applies to its three military looks. */
const TUNING: Partial<Record<LookId, Record<string, number>>> = {
  retro: { pixelation: 1.0, distortion: 0, instability: 0.42 },
  surveillance: { gain: 0.18, bloom: 0.22, scanlineStr: 0.96, pixelation: 1.0 },
  thermal: { sensitivity: 0.85, bloom: 0.2, mode: 0.33, pixelation: 1.0 },
};

const FADE_MS = 500;
const SHARPEN = /* glsl */ `
  uniform sampler2D colorTexture;
  uniform vec2 colorTextureDimensions;
  uniform float amount;
  in vec2 v_textureCoordinates;
  void main() {
    vec2 uv = v_textureCoordinates;
    vec2 t = 1.0 / colorTextureDimensions;
    vec4 c = texture(colorTexture, uv);
    vec4 b = (texture(colorTexture, uv + vec2(-t.x, -t.y)) + texture(colorTexture, uv + vec2(0.0, -t.y)) +
      texture(colorTexture, uv + vec2(t.x, -t.y)) + texture(colorTexture, uv + vec2(-t.x, 0.0)) + c +
      texture(colorTexture, uv + vec2(t.x, 0.0)) + texture(colorTexture, uv + vec2(-t.x, t.y)) +
      texture(colorTexture, uv + vec2(0.0, t.y)) + texture(colorTexture, uv + vec2(t.x, t.y))) / 9.0;
    out_FragColor = vec4(clamp(c.rgb + (c.rgb - b.rgb) * amount, 0.0, 1.0), c.a);
  }
`;

type Stage = PostProcessStage & { uniforms: Record<string, number> };

export class Looks {
  private stages = new Map<LookId, Stage>();
  private sharpen: Stage;
  private current: LookId = 'none';
  private start = performance.now();
  private fade: { from: LookId; to: LookId; t0: number } | null = null;
  private off: () => void;

  constructor(scene: Scene) {
    for (const id of Object.keys(SHADERS) as Exclude<LookId, 'none'>[]) {
      const def = SHADERS[id];
      const uniforms: Record<string, number> = { intensity: 0 };
      if (def.fragmentShader.includes('uniform float time')) uniforms.time = 0;
      for (const [k, meta] of Object.entries(def.uniforms ?? {})) uniforms[k] = meta.default;
      Object.assign(uniforms, TUNING[id] ?? {});
      const stage = new PostProcessStage({ name: `look_${id}`, fragmentShader: def.fragmentShader, uniforms }) as Stage;
      stage.enabled = false;
      scene.postProcessStages.add(stage);
      this.stages.set(id, stage);
    }
    this.sharpen = new PostProcessStage({ name: 'look_sharpen', fragmentShader: SHARPEN, uniforms: { amount: 1.08 } }) as Stage;
    this.sharpen.enabled = false;
    scene.postProcessStages.add(this.sharpen);
    const handler = (): void => this.tick();
    scene.preRender.addEventListener(handler);
    this.off = () => scene.preRender.removeEventListener(handler);
  }

  /** Slider metadata for a look, with the current value of each parameter (the internal lens switch is hidden). */
  params(id: LookId): { name: string; label: string; min: number; max: number; value: number }[] {
    if (id === 'none') return [];
    const def = SHADERS[id] as ShaderDef;
    const st = this.stages.get(id);
    return Object.entries(def.uniforms ?? {})
      .filter(([k]) => k !== 'lensAmt')
      .map(([name, m]) => ({ name, label: m.label ?? name, min: m.min ?? 0, max: m.max ?? 1, value: st?.uniforms[name] ?? m.default }));
  }

  setParam(id: LookId, name: string, value: number): void {
    const st = this.stages.get(id);
    if (st && name in st.uniforms && name !== 'lensAmt' && name !== 'intensity' && name !== 'time') st.uniforms[name] = value;
  }

  get active(): LookId {
    return this.current;
  }

  set(next: LookId, instant = false): void {
    if (next === this.current) return;
    const from = this.current;
    this.current = next;
    // A light unsharp mask is part of the gods-eye-view default; it only runs with a look on.
    this.sharpen.enabled = next !== 'none';
    if (instant) {
      this.fade = null;
      for (const [id, st] of this.stages) this.apply(st, id === next ? 1 : 0);
      return;
    }
    this.fade = { from, to: next, t0: performance.now() };
  }

  /** The night-vision and thermal looks have a round lens mask; it follows the Scope switch. */
  setLens(on: boolean): void {
    for (const st of this.stages.values()) if (st.uniforms.lensAmt !== undefined) st.uniforms.lensAmt = on ? 1 : 0;
  }

  private apply(st: Stage, v: number): void {
    st.uniforms.intensity = v;
    st.enabled = v > 0.001;
  }

  private tick(): void {
    const now = performance.now();
    const sec = (now - this.start) / 1000;
    if (this.fade) {
      const k = Math.min(1, (now - this.fade.t0) / FADE_MS);
      const e = k * k * (3 - 2 * k);
      const a = this.stages.get(this.fade.from);
      const b = this.stages.get(this.fade.to);
      if (a) this.apply(a, 1 - e);
      if (b) this.apply(b, e);
      if (k >= 1) this.fade = null;
    }
    for (const st of this.stages.values()) if (st.enabled && st.uniforms.time !== undefined) st.uniforms.time = sec;
  }

  destroy(): void {
    this.off();
  }
}
