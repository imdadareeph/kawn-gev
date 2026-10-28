# God's Eye View: where the HUDs and looks live, how FLIR (thermal) works, and the Scope

Written 2026-10-26. Read-only study of `/Users/imdadareeph/Desktop/42/gods-eye-view`. No code was changed and the app was not run; screenshots come from `/Users/imdadareeph/Desktop/42/gev/shots`. Companion file: `/Users/imdadareeph/Desktop/42/GEV-KAWN-ANALYSIS.md`.

## Folder access note

This file points into several folders. **If you do not have permission to open a folder named here, ask the owner for permission to access it before reading it.** Do not guess its contents. Roots used:

| Root | Full path |
|---|---|
| God's Eye View repo (read-only reference) | `/Users/imdadareeph/Desktop/42/gods-eye-view` |
| GEV capture notes and 36 screenshots | `/Users/imdadareeph/Desktop/42/gev` |
| Kawn app (for the comparison in section 9) | `/Users/imdadareeph/Desktop/42/kawn/kawn-app` |
| Kawn docs | `/Users/imdadareeph/Desktop/42/kawn/docs` |

**Parking is not in this file or in GEV.** The parking code is in Kawn under `/Users/imdadareeph/Desktop/42/kawn` (client `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/parking.ts`, server route in `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/api.mjs`, design `/Users/imdadareeph/Desktop/42/kawn/docs/13-parking-spot-feature.md`). The full parking analysis is in `/Users/imdadareeph/Desktop/42/GEV-KAWN-ANALYSIS.md` (section 6.2 and Part B1). If access to `/Users/imdadareeph/Desktop/42/kawn` is not granted, ask the owner for permission first.

Handoff rule from `/Users/imdadareeph/Desktop/42/HANDOFF-SESSION-2026-10-17.md`: nothing under `/Users/imdadareeph/Desktop/42/kawn/` may carry the original's code or names. Keep this file outside `kawn/`.

## Contents
1. The screen as stacked layers (what is drawn where)
2. The seven looks: where they are and how to switch them
3. How a look is built and applied (the pipeline)
4. FLIR (thermal) in detail
5. The other looks in brief (NVG, CRT, Anime, Noir, Snow)
6. The HUD: four layouts and where each element sits
7. The Scope (keyhole mask)
8. Related display features: Detection, Bloom, Sharpen, Celestial, Cockpit vision
9. Share-link keys and keyboard shortcuts
10. Screenshot map
11. Kawn comparison

---

## 1. The screen as stacked layers

From back to front (z-order values are taken from the code; "page" = full-window, "viewer" = inside the Cesium container):

| Order | Layer | What it is | Where defined |
|---|---|---|---|
| 1 | **Cesium canvas** | The globe, tiles, entities, 3D models | `/Users/imdadareeph/Desktop/42/gods-eye-view/src/app/viewer.js` |
| 2 | **Look post-process stages** | Full-frame GLSL passes run *inside* the Cesium render (not DOM): one stage per look plus Sharpen, plus Cesium's built-in Bloom | `/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/visualEffects.js` |
| 3 | **`#scope-mask` canvas** | 2D canvas appended to the viewer container; transparent inside the keyhole, fades to near-black (5,5,8) outside. z-index 2 inside the viewer, deliberately below the detection surface (5) | `/Users/imdadareeph/Desktop/42/gods-eye-view/src/scopeMask.js` |
| 4 | **World overlay canvas + detection surface** | Screen-space labels, bounding boxes and callouts. The detection surface blends over the masked scene (`mix-blend-mode`), themed per look | `/Users/imdadareeph/Desktop/42/gods-eye-view/src/overlays/worldOverlay.js` |
| 5 | **`#intel-hud`** | The HUD text/brackets. `position: fixed; inset: 0; z-index: 2; pointer-events: none`, hidden by default (`opacity 0`, fades in 0.4 s) | `/Users/imdadareeph/Desktop/42/gods-eye-view/src/hud.js`, CSS `/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/styles/overlays.css` |
| 6 | **UI panels** | Data Layers (left), Display / CCTV / Street Level / Context (right rail), Command Dock (bottom) | the HTML files in `/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/templates/` |

Important consequence: a look recolours the **3D scene only** (layer 2). Panels, the DOM HUD and the scope mask are not run through the look shader, so they keep their own colours. The HUD retints itself to match the look (section 6.5), and the detection overlay switches theme (section 8.1).

---

## 2. The seven looks: where they are and how to switch them

**Names and ids.** UI label → internal style id: Normal → `normal`; CRT → `retro`; NVG → `surveillance`; FLIR → `thermal`; Anime → `anime`; Noir → `noir`; Snow → `snow`. Map in `/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/visualPresets.js` (`STYLES`), UI names in `/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/visualSettings.js` (`displayNames`).

**Where the buttons are.** Bottom **Command Dock**, right-hand **VISUAL PRESETS** tray (the other trays are Location and the Voice control). Template: `/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/templates/command-dock.html`.

```
#command-dock (bottom centre)
 ├─ #location-bar        LOCATION tray (search box + city chips)
 ├─ voice control        ON/OFF, STD/MINI, spend readout
 └─ #control-panel       VISUAL PRESETS tray  (screenshot: 02-visual-presets.png)
      ├─ #style-buttons  7 buttons: NORMAL 1, CRT 2, NVG 3, FLIR 4, ANIME 5, NOIR 6, SNOW 7
      ├─ MAP SOURCE row  #map-stack-chips: GOOGLE 3D, BING AERIAL, BING LABELS, ESRI SATELLITE, OSM
      └─ #style-mini-status  collapsed state, e.g. "NORMAL" / "FLIR"
```

Number keys **1 to 7** pick the look (`STYLE_KEYS` in `/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/applicationShortcuts.js`). The active look name also shows top-right on screen as "ACTIVE STYLE" (`#style-indicator`; names NVG/FLIR/CRT, others upper-cased).

**Where the look's sliders are.** Right rail **DISPLAY** panel, `#param-slider-panel` (heading "PARAMETERS"), filled by `_updateSliderPanel(style)` from the shader's `uniforms` metadata (label, min, max, default). Display panel order (`/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/templates/display-controls.html`):

```
#pp-toggles  DISPLAY
 ├─ HUD toggle (H) + Layout select [Tactical|Operator|Minimal|Cyber] + Cyber sonar rows
 ├─ DETECTION toggle (D): density slider, allocation Elastic|Weighted, fade, outside
 ├─ #param-slider-panel  look PARAMETERS (appears when a look is active)
 ├─ 3D aircraft models: Proximity | All
 ├─ SCOPE toggle + feather slider
 ├─ DRAW   ├─ GeoJSON/KML import   ├─ CELESTIAL   ├─ CLEAN UI   ├─ BLOOM   └─ SHARPEN
```

Screenshots showing the panel with sliders: `/Users/imdadareeph/Desktop/42/gev/shots/03-style-nvg.png`, `04-style-flir.png`, `05-style-crt.png`, `13-style-anime-dubai.png`, `16-snow-wind-dubai-flights.png`.

---

## 3. How a look is built and applied (the pipeline)

### 3.1 One shader module per look

Files in `/Users/imdadareeph/Desktop/42/gods-eye-view/src/styles/`: `retro.js` (178 lines), `surveillance.js` (279), `thermal.js` (340), `anime.js` (70), `noir.js` (57), `snow.js` (95). Each exports `{ name, uniforms, fragmentShader }`:

- `uniforms` = metadata for the sliders: `{ default, min, max, label }` per parameter.
- `fragmentShader` = a GLSL string in Cesium's post-process form: reads `colorTexture`, `colorTextureDimensions`, `v_textureCoordinates`, writes `out_FragColor`. Every look has a master `intensity` (0 to 1); animated looks also declare `uniform float time`.

### 3.2 Stages are created once, disabled

`VisualEffects.initStyles()` (`/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/visualEffects.js`):

1. For each entry in `STYLES` (order: retro, surveillance, thermal, anime, noir, snow) create `new PostProcessStage({ name: 'godsEyeView_<style>', fragmentShader, uniforms })`.
2. Uniforms start as `{ intensity: 0, time: 0 (only if the shader declares it), ...each uniform's default }`.
3. `stage.enabled = false`, then `viewer.scene.postProcessStages.add(stage)`.

`initPostProcess()` then adds the **Sharpen** stage (an unsharp-mask shader in `visualPresets.js`) and borrows Cesium's built-in **bloom** stage, setting its uniforms (contrast 256, brightness -0.35 ...) and remembering the previous values for restore on teardown.

### 3.3 Switching a look (`setStyle`)

In `/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/visualSettings.js` (`setStyle`, ~line 1531):

1. Claim the share-link restore lane; record the previous style; set `document.documentElement.dataset.gevStyle = <style>` (CSS can key off this).
2. Turn off the Celestial ring (it belongs to the unfiltered globe only).
3. **Crossfade**: the old look's `intensity` eases to 0 and the new one's to 1 over `TRANSITION_DURATION_MS = 500` ms, ease-in-out (`2t²` then `1 - (-2t+2)²/2`). A stage is `enabled` only while `intensity > 0.001`, so unused looks cost nothing.
4. `_applyStylePresetDefaults(style)` writes the preset's slider values and, for military looks, turns the HUD on and applies the detection preset (Dense 75 %).
5. Update the buttons (`.style-btn.active`), the top-right indicator, the mini status, and rebuild the slider panel.
6. `hud.onStyleChange(style)` retints and shows/hides the HUD (section 6.5).
7. `setDetectionStyle(style)` re-themes the detection overlay.
8. `_syncIrBoost()`: for NVG and FLIR, flights and military layers get `irBoost: true` (brighter in-scene sprites) and Cesium **fog is turned off** (distant aircraft would otherwise fog to black silhouettes; IR "sees through haze"). The prior fog state is restored on exit.
9. Dispatch `gev:style-change`, update the share link.

### 3.4 Animation loop and render budget

`startAnimationLoop()` runs a `requestAnimationFrame` loop only while a transition is in flight or an animated look (one with `time`) is visible. Each frame it eases intensities and writes `stage.uniforms.time = (now - start) / 1000`. While running it **holds** the render governor (`holdRender('style-anim')`), otherwise the app renders only on demand and releases the hold. That is why FLIR's noise drifts continuously and a parked camera with Normal look costs nothing.

### 3.5 Default values

`GLOBAL_POST_DEFAULTS` (first load, before any share link): bloom off, **sharpen on at 49 %**, HUD variant tactical, **detection on, Dense 75 %**, allocation Elastic, fade 7 %, outside opacity 1 %, celestial off. `STYLE_PRESET_DEFAULTS` carry per-look values for retro, surveillance, thermal (section 4.5); all three also set `hudVisible: true` and the detection preset.

---

## 4. FLIR (thermal) in detail

File: `/Users/imdadareeph/Desktop/42/gods-eye-view/src/styles/thermal.js`. Described in its header as "Forward Looking Infrared... White-Hot/Black-Hot modes, coherent temporal noise, hot-spot bloom, temperature banding, soft IR diffraction, and full HUD overlay rendered in GLSL."

### 4.1 Honest framing

It is **not** real thermal data. The shader treats **luminance of the already-rendered scene as "temperature"** (dark = cold, bright = hot) and recolours it. Water, shadows and dark roofs read cold; bright sand and concrete read hot. The on-shader temperature number is likewise invented (section 4.4).

### 4.2 Parameters (the sliders)

| Uniform | Label | Range | Shader default | Preset (FLIR button) | Meaning |
|---|---|---|---|---|---|
| `sensitivity` | Sensitivity | 0 to 1 | 0.75 | **0.85** | Contrast range of the luminance→temperature map |
| `bloom` | Bloom | 0 to 1 | 0.65 | **0.20** | Strength of hot-spot glow |
| `mode` | WHOT/BHOT | 0 to 1 | 0.0 | **0.33** | `< 0.5` = White-Hot, `>= 0.5` = Black-Hot (hard step at 0.5) |
| `pixelation` | Pixelation | 1 to 6 | 1.5 | **1.0** | Sensor pixel block size (1 = none) |
| `palette` | Ironbow | 0 to 1 | 0.0 | (unchanged, 0) | Blend monochrome → Ironbow colour ramp |
| `intensity` (internal) | – | 0 to 1 | 0 | animated | Master look strength, faded in/out |
| `time` (internal) | – | – | 0 | animated | Drives the noise drift and frame counter |

Screenshot 04 (`/Users/imdadareeph/Desktop/42/gev/shots/04-style-flir.png`) shows the panel with Sensitivity 0.85, Bloom 0.20, WHOT/BHOT 0.33, Pixelation 1.0, Ironbow 0.00. Shot 33 (`33-scenes-panel.png`, Cyber HUD) shows purple/orange Ironbow because Cyber sets the palette to 0.42.

### 4.3 The pass, in the order it runs

1. **Lens mask.** UV is centred and aspect-corrected: `r = length(centered)`; `lensMask = pow(1 - smoothstep(0.6, 1.05, r), 0.7)`; `lensShading = max(1 - r²·0.25, 0)`. If `lensMask < 0.001` the pixel is plain black (the round optics field of view).
2. **Sensor pixelation.** `pixSize = mix(1, pixelation, intensity)`; UV is snapped to a block grid, so higher Pixelation gives blocky low-resolution sensor pixels.
3. **Soft IR blur.** A 5×5 Gaussian-weighted blur (sample spacing 1.5 texels, weight `exp(-0.5·(x²+y²)/2)`), mixed 60 % × intensity with the sharp sample. Thermal cameras are soft; this also hides tile seams.
4. **Luminance → temperature.** `luma = dot(rgb, (0.299, 0.587, 0.114))`; `sens = mix(0.25, 1.0, sensitivity)`; `temp = clamp((luma - (0.5 - sens/2)) / sens, 0, 1)`. Low Sensitivity widens the window (flatter image), high Sensitivity narrows it (punchier contrast).
5. **Temperature banding.** 12 bands: `contour = smoothstep(0.04, 0.06, |fract(temp·12) - 0.5|)`, and `temp *= mix(1, contour·0.85 + 0.15, 0.3·intensity)`. Adds faint isotherm contour lines.
6. **White-Hot / Black-Hot.** `isBlackHot = step(0.5, mode)`; `thermal = mix(temp, 1 - temp, isBlackHot)`.
7. **Colour.** `mono = vec3(thermal)`; `iron = ironbow(temp)`; `thermalColor = mix(mono, iron, palette)`. The Ironbow ramp uses true temperature (not the WHOT/BHOT-inverted value), so colours stay meaningful when the polarity flips. Ramp stops: black (0,0,0) → deep purple (0.13,0,0.30) → magenta (0.49,0,0.45) → red (0.86,0.10,0.18) → orange (1,0.55,0) → yellow (1,0.91,0.32) → white.
8. **Hot-spot bloom.** A 9×9 neighbourhood (offset step 3 texels) accumulates `smoothstep(0.6, 1.0, brightness)` with distance weights, normalised, then `thermalColor += bloomSample · bloom · 0.8`. Only bright ("hot") areas bleed.
9. **Coherent noise.** `fbm` value noise (4 octaves) sampled at `uv·80 + time·(0.3, 0.2)`, amplitude `(n - 0.5)·0.08·intensity`: slow cloud-like drift, not TV static.
10. **In-shader HUD** (section 4.4).
11. **Lens shading and mask** multiply the colour, `clamp(0, 1)`, then `finalColor = mix(original, thermalColor, intensity)` and edges fade to black by `mix(1, lensMask, intensity)`.

### 4.4 The shader's own mini-HUD (distinct from the DOM HUD)

Drawn in GLSL at fixed UV positions, so it is part of the image and lives inside the lens:

| Element | UV position | Detail |
|---|---|---|
| "FLIR" label marker | x 0.02-0.10, y 0.92-0.96 | A bar (not text) at 0.6 opacity |
| Mode marker | x 0.02-0.08, y 0.88-0.91 | Smaller bar at 0.4 |
| Centre crosshair | centre | Four short ticks (0.015 to 0.04 from centre) |
| Temperature readout | top-right, origin (0.88, 0.92) | 7-segment digits built from `segment()/digit()/renderChar()` with `.` and `°`. Value `= 20 + centre-pixel luminance × 30` °C, i.e. **a made-up 20 to 50 °C number from brightness** |
| Frame counter | bottom-right, origin (0.88, 0.04) | 4 digits of `floor(time·30) mod 10000` |
| Scale bar | right edge x 0.94-0.955, y 0.15-0.85 | Vertical grey gradient; flips with BHOT |

The HUD adds `hud · 0.6 · intensity` to the colour, so it always shows through.

### 4.5 What switching to FLIR also changes

From `STYLE_PRESET_DEFAULTS.thermal` in `/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/visualPresets.js`: sensitivity 0.85, bloom 0.2, mode 0.33, pixelation 1.0; bloom stage off; sharpen 49 %; HUD layout tactical, HUD **on**; detection **Dense 75 %** (unless the operator hand-edited detection, which sets `_detectionUserOverridden` and suppresses the auto-enable). Plus: detection overlay theme `thermal`, IR boost on flights/military sprites, Cesium fog off, and the HUD recolours white. In the Contacts / cockpit contexts see section 8.5.

### 4.6 Cyber layout and FLIR

`/Users/imdadareeph/Desktop/42/gods-eye-view/src/hudLayouts.js`: `CYBER_VISUAL_DEFAULTS = { style: 'thermal', ironbow: 0.42 }`. Entering the **Cyber** HUD layout *by explicit choice* switches the look to FLIR and sets the palette to 0.42 (a purple/orange tint). It does not overwrite share-link state, repeated Cyber selections, or later user tuning. Leaving Cyber restores the remembered previous look unless the user picked one meanwhile (`_preCyberStyle`, `_cyberStyleUserSelected`).

### 4.7 Cost and caveats

Per frame the FLIR stage does about 25 blur taps + 81 bloom taps + noise, so it is the heaviest look. The render governor keeps the loop alive while FLIR is visible (needed for `time`). FEATURES.md notes heavy layer combinations plus a look can make the browser hang and screenshots time out; turn layers on one at a time.

---

## 5. The other looks in brief

| Look | File | Parameters (min..max, default) | What the shader does |
|---|---|---|---|
| **NVG** `surveillance` | `/Users/imdadareeph/Desktop/42/gods-eye-view/src/styles/surveillance.js` | gain 0..1 (0.55; preset **0.18**), bloom 0..1 (preset **0.22**), scanlineStr 0..1 (preset **0.96**), pixelation 1..6 (preset **1.0**) | PVS-14 image-intensifier emulation: P43 phosphor green, tube vignette (circular field), honeycomb pattern, scintillation noise, auto-gain, scanlines, bloom around bright sources, simple HUD marks. Animated (`time`) |
| **CRT** `retro` | `/Users/imdadareeph/Desktop/42/gods-eye-view/src/styles/retro.js` | pixelation 1..10 (preset **1.0**), distortion 0..1 (preset **0**), instability 0..1 (preset **0.42**) | Bayer dithering, barrel distortion, scanlines, chromatic aberration, vignette, phosphor ghosting, horizontal jitter, flicker, glitch lines, RGB shadow-mask. Animated |
| **Anime** | `/Users/imdadareeph/Desktop/42/gods-eye-view/src/styles/anime.js` | saturation 0..2 (1.0), edgeThick 0..1 (0.5) | Cel-shading: luminance quantised into bands `mix(256, 4, intensity)`, HSV saturation boost, ink-style edge detect. Not animated |
| **Noir** | `/Users/imdadareeph/Desktop/42/gods-eye-view/src/styles/noir.js` | contrastAmt 0..2 (1.2), grainAmt 0..1 (0.5), vignetteAmt 0..1 (0.5) | Desaturate (`mix(rgb, luma, intensity)`), contrast `(c - 0.5)·(1 + contrastAmt·intensity) + 0.5`, film grain `±0.04·grain`, vignette `pow(x·y·16, 0.3 + 0.4·vig·intensity)`, 15 % sepia tint. (Screenshot notes abbreviate these as "c.120 g.50 v.50".) |
| **Snow** | `/Users/imdadareeph/Desktop/42/gods-eye-view/src/styles/snow.js` | density 0..1 (0.6), wind 0..1 (0.5) | White overlay, desaturation, animated falling particles (hash noise, `time`) |

The first three (CRT, NVG, FLIR) are the **military** looks: they auto-show the HUD, set the Dense 75 % detection preset, and retint the HUD (`MILITARY_STYLES` in `/Users/imdadareeph/Desktop/42/gods-eye-view/src/hud.js`). Anime, Noir and Snow are cosmetic and auto-hide the HUD (unless the HUD was turned on manually).

---

## 6. The HUD

Code: `/Users/imdadareeph/Desktop/42/gods-eye-view/src/hud.js` (class `IntelHUD`, 950 lines). Layout vocabulary: `/Users/imdadareeph/Desktop/42/gods-eye-view/src/hudLayoutPolicy.js` (`tactical`, `operator`, `minimal`, `cyber`) and `/Users/imdadareeph/Desktop/42/gods-eye-view/src/hudLayouts.js`. CSS: `/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/styles/overlays.css` (base and layouts), `/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/styles/cyber.css` (Cyber skin, sonar), `/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/styles/responsive.css` (small screens).

### 6.1 Structure

`#intel-hud` (set `data-variant="tactical|operator|minimal|cyber"`) contains:

| Element | Class / id | Content |
|---|---|---|
| Sonar ring | `.hud-sonar` | Cyber only: a large circle centred on screen (80vw/104vh) for the contact scanner |
| Top bar | `.hud-top-bar` | "TOP SECRET // SI-TK // NOFORN" (left), mission id (centre), "PAGE 1/1" (right). Operator and Minimal-bottom only |
| Top-left block | `.hud-top-left` | Bracket `┌`, classification line, mission id + sensor id (`KH11-4179 OPS-4155`), **mode label** `#hud-mode` (NORMAL / NVG / FLIR / CRT...), **SUMMARY** line `#hud-summary` |
| Top-right block | `.hud-top-right` | `● REC <UTC timestamp>` (dot blinks), `ORB: 47351 PASS: DESC-119`, bracket `┐` |
| Bottom-left block | `.hud-bottom-left` | `MGRS: 31U BT 9321 1062` `#hud-mgrs`, lat/lon in degrees-minutes-seconds `#hud-latlon`, bracket `└` |
| Bottom-right block | `.hud-bottom-right` | `GSD: 13.45M NIIRS: 1.2` `#hud-gsd`, `ALT: 35830M SUN: 30.0° EL` `#hud-alt`, `AIS: --` `#hud-ais-vessel`, bracket `┘` |
| Left edge | `.hud-left-edge` | Vertical text `COLL: hh:mm:ssZ`, `ONA: ..°` (off-nadir angle) |
| Right edge | `.hud-right-edge` | Vertical text `BAND: PAN`, `BITS: 11`, `LVL: 1A` (static flavour) |
| Bottom bar | `.hud-bottom-bar` | `LAT: -- LON: -- MGRS: ---` single line (Operator, Minimal) |

### 6.2 Positions (CSS values)

Base (`overlays.css`): blocks are absolutely positioned inside the fixed full-window HUD.

| Block | Position |
|---|---|
| top-left | `top: 120px; left: 36px` |
| top-right | `top: 120px; right: 36px` |
| bottom-left | `bottom: 180px; left: 36px` |
| bottom-right | `bottom: 180px; right: 36px` |
| top-bar | `top: 70px`, centred, width `min(980px, 100vw - 120px)`, `display:none` by default |
| bottom-bar | `bottom: 110px`, centred, `display:none` by default |

The bottom offsets (180 px, 110 px) keep the HUD clear of the Command Dock. All HUD elements are `pointer-events: none`, so they never block the globe.

### 6.3 The four layouts

| Layout | Behaviour (from CSS) | Seen in |
|---|---|---|
| **Tactical** (default) | Four corner blocks and edge text. Top/bottom bars hidden. Corner top = `max(14vh, 136px)` | `01-baseline-scope.png`...`16-snow-wind-dubai-flights.png` |
| **Operator** | Adds the top bar (`top: max(10vh, 90px)`) and bottom bar; corner brackets hidden; panels framed. Also shows the Context panel (Contacts, Space Missions, Search Nearby Sites) | `/Users/imdadareeph/Desktop/42/gev/shots/17-hud-operator.png`, 20, 24-29 |
| **Minimal** | Hides top-right, bottom-right, edges, classification and system lines. top-left at `top: 88px`, bottom-left at `bottom: 12vh`, bottom bar at `bottom: calc(12vh + 4rem)` | not captured |
| **Cyber** | Red/white palette (`--hud-color rgba(244,247,246,.94)`, border `rgba(196,84,84,.74)`), `// CYBER` tag, **application-wide skin** (`<html data-ui-theme="cyber">` re-themes panels, scenes, radio panel placement) and the **Sonar** contact scanner. Selecting it explicitly also switches the look to FLIR with Ironbow 0.42 (section 4.6) | `/Users/imdadareeph/Desktop/42/gev/shots/19-hud-cyber.png`, 33 |

Switch layouts: Display panel → HUD → **Layout** select (`#hud-layout-select`); or voice (the layout name is validated against the same vocabulary in the server voice tools). `applyHudUiTheme()` sets `data-ui-theme` on `<html>`.

### 6.4 Data behind the readouts (`hud.js`)

| Readout | How it is computed |
|---|---|
| MGRS | `mgrs` library `forward([lon, lat])` from the camera ground point |
| Lat/lon | DMS of the camera centre |
| **GSD** | `gsd = max(0.01, altitude_m × 0.000375)` metres per pixel (verified: 35,830 m × 0.000375 = 13.4 m, matches the screenshots) |
| **NIIRS** | simplified GIQE: `10.25 - 3.32 × log10(GSD in inches)`, clamped up to 9 |
| ALT | Camera height. Converted to height above mean sea level using the EGM96 geoid undulation, cached per 0.01° cell (`HUD_GEOID_CELL_DEG`), so the 4 Hz tick stays cheap |
| SUN | Sun elevation for the camera position and current time |
| ONA | Off-nadir angle from camera pitch |
| REC / COLL | Wall-clock UTC (timestamp interval); the red dot blinks (`_recBlinkInterval`) |
| ORB / PASS / mission id / sensor id | **Random-looking decoration** generated at construction (e.g. `OPS-41xx`), not real telemetry |
| AIS | Nearest tracked vessel text, `--` when none |
| SUMMARY | A natural-language scene summary from the AI HUD-summary service (`/api/openai/hud-summary`, needs an OpenAI key) with a keyless locality tag (`hudLocality.js`, nearest city POI). Refreshed on a **15 s** interval (`HUD_SUMMARY_INTERVAL_MS`), typed out character by character; lags the camera (FEATURES.md saw "Big Ben" persist at a north-London zoom) |

So GSD and NIIRS are **derived from altitude only**, not from the imagery's real resolution; the classification banner is cosmetic.

### 6.5 HUD colour per look

`HUD_COLORS` in `/Users/imdadareeph/Desktop/42/gods-eye-view/src/hud.js`, applied as CSS variables `--hud-color`, `--hud-glow`, `--hud-border` by `onStyleChange(style)`:

| Look | Main colour |
|---|---|
| NVG (`surveillance`) | green `rgba(51,255,51,0.8)` |
| FLIR (`thermal`) | white `rgba(255,255,255,0.7)` |
| CRT (`retro`) | amber `rgba(255,170,0,0.8)` |
| everything else (`_default`) | cyan `rgba(0,255,255,0.6)` |
| Cyber layout | forced red/white by `cyber.css` (`!important`) |

Auto show/hide: `MILITARY_STYLES = {retro, surveillance, thermal}` call `show()`; other looks call `hide()`, unless the operator toggled the HUD by hand (`_autoMode` becomes false). `H` toggles the HUD.

---

## 7. The Scope

File: `/Users/imdadareeph/Desktop/42/gods-eye-view/src/scopeMask.js` (572 lines) and the shared geometry in `/Users/imdadareeph/Desktop/42/gods-eye-view/src/celestialRing.js`.

### 7.1 What it is

A circular "keyhole" viewport: the middle of the screen stays clear and everything outside fades to the page black `rgb(5,5,8)`. History in the file header: the scope was never actually implemented; it **emerged** as a smear from six zero-intensity look stages. On 2026-08-08 it was rebuilt explicitly as a canvas with a featherable edge, which also freed six shader passes.

### 7.2 How it is drawn

- One `<canvas id="scope-mask" aria-hidden="true">` appended into the Cesium viewer container (`installScopeMask(viewer)`), under the detection surface so detection still composites over the masked scene.
- **No render loop.** It repaints only on resize (ResizeObserver), device-pixel-ratio change, a feather/enable change, or a quantised terminus-alpha step. A parked camera costs nothing.
- The mask is a radial gradient: transparent inside, ramping to `rgba(5,5,8, α)` outside.

### 7.3 Geometry

`getKeyholeGeometry(w, h)`: `radius = h × 0.5 × KEYHOLE_OUTER_RADIUS` with `KEYHOLE_OUTER_RADIUS = 1.05`, centre = window centre. `scopeMaskGeometry` adds the feather: `half = radius × featherRatio × 0.5`; `innerR = radius - half`; `outerR = radius + half`; `maxR` reaches the farthest corner. The feather **straddles** the keyhole edge so the visible radius stays tied to the shared geometry that labels and cards fade on.

### 7.4 Feather

Slider `#scope-feather-slider` 0 to 100 (`%`), **default 11** (`SCOPE_FEATHER_RATIO_DEFAULT = 0.11`). 0 = hard crop, 100 = smooth fade starting near the centre. The default moved over time: 35 % → 0 (hard crop, 2026-08-22) → 0.08 → **0.11** (2026-08-24 "final lock"). The three places that must agree (comment in the file): the constant, the slider's markup value in `index.html`, and `_scopeFeatherPct` in `/Users/imdadareeph/Desktop/42/gods-eye-view/src/sharelink.js`. The share-link *parse* fallback for a missing `scf` stays at 35 on purpose, because old links were authored when 35 was the look. In the study screenshots the tester had set feather to **100 %** (visible in the Display panel in shots 01 to 08), which is why the vignette is wide.

### 7.5 Altitude-adaptive edge (terminus alpha)

The outside fill's final opacity depends on camera height so stars survive at planet scale but smeared geometry never appears at working altitudes:

| Camera height | Terminus alpha |
|---|---|
| ≥ 10,000 km (`SCOPE_TERMINUS_FAR_M = 10_000_000`) | **0.94** (a faint 6 % bleed keeps corner stars) |
| 10,000 km → 7,000 km | ramps quickly to 1.0 |
| ≤ 7,000 km (`SCOPE_TERMINUS_NEAR_M`) | **1.0** (solid black) |

Performance contract: the height sample is throttled to every 120 ms (`SCOPE_TERMINUS_SAMPLE_MS`), and a repaint happens only when the alpha crosses a 0.005 step (`SCOPE_TERMINUS_QUANTUM`), about 12 repaints over a whole zoom gesture. Share-link key `sce` carries an override (`setScopeTerminusOverride`).

### 7.6 Who else uses the keyhole

The **same circle** drives label visibility: `keyholeLabelAlpha(x, y, w, h)` returns 1 inside the radius and fades linearly across the feather band to the configured outside-opacity floor (detection "Outside" slider, default 1 %). So detection labels, callout cards and the Celestial ring all fade on the same geometry as the visible mask.

### 7.7 Control and share keys

Display panel → **SCOPE** toggle (`#scope-toggle`, default on) and **FEATHER** slider; share link keys `sc` (1/0), `scf` (feather %), `sce` (terminus %). Setters: `setScopeMaskEnabled`, `setScopeMaskFeather`.

---

## 8. Related display features

### 8.1 Detection overlay (D)

`/Users/imdadareeph/Desktop/42/gods-eye-view/src/data/detection.js` and `/Users/imdadareeph/Desktop/42/gods-eye-view/src/overlays/worldOverlay.js`. Draws screen-space brackets and labels on entities in view (aircraft, data centres, CCTV...). Controls: density 0..100 (step 25; default Dense 75 %), allocation **Elastic** or **Weighted** (how the label budget is shared across layers), fade 0..40 (default 7 %), outside opacity 0..100 (default 1 %). `D` cycles the mode. Theme per look via `THEME_MAP` (retro, surveillance, thermal, default); the thermal theme is warm white (`line rgba(255,224,170,.95)`, `blend: screen`, `filter: contrast(1.1) saturate(1.08)`, scanline 0.04) with tier colours civil white, military `#ff7a5c`, sea `#ffd0b0`, space `#d0e0ff`, vehicle `#ffcf9f` (`/Users/imdadareeph/Desktop/42/gods-eye-view/src/overlays/worldOverlayTokens.js`).

### 8.2 Bloom and Sharpen

Bloom: Cesium's built-in stage, off by default, intensity slider 0 to 200; curve in `VisualEffects.applyBloomIntensity` (eased `contrast 255 - 168·e`, `sigma 0.28 + 6.3·e`, etc.). Sharpen: custom 3×3 unsharp mask, on at **49 %** by default, `amount = 0.1 + value × 2.0`.

### 8.3 Celestial ring

Display → CELESTIAL: reveals the full globe in the scope with a rotating sun and moon canvas (2 MP backing budget each). Only for the unfiltered globe: it switches off when a look is selected.

### 8.4 Clean UI

Hides panels and chrome ("EXIT CLEAN VIEW" button), for recordings. Attribution stays visible.

### 8.5 Cockpit vision

The cockpit ride-along can override the look without changing the map style: `/Users/imdadareeph/Desktop/42/gods-eye-view/src/cockpitVisionPolicy.js` maps vision modes optical, crt, nvg, thermal, noir to stage intensities (`applyCockpitVisionStageIntensities`), and `_syncIrBoost` uses the *effective* style so IR boost, fog off and `gev:vision-change` follow the cockpit mode.

---

## 9. Share-link keys and shortcuts

Source: `/Users/imdadareeph/Desktop/42/gods-eye-view/src/sharelink.js` (the URL hash holds the whole visual state).

| Key | Meaning |
|---|---|
| `style` | look id (mapped through `URL_TO_STYLE`) |
| `sp` | look parameters, `name.value` assignments joined by `_` (registry `SHARE_STYLE_PARAM_REGISTRY`; only valid names for that look), link version `v=2` |
| `hud` | HUD layout (default tactical) |
| `hv` | HUD visible (1/0) |
| `dm`, `dd`, `da`, `kf`, `ko` | detection mode, density, allocation, fade, outside opacity |
| `sc`, `scf`, `sce` | scope on, feather %, terminus % |
| `cr` | celestial ring |
| `bloom`, `bi`, `bv`, `sharpen`, `si` | bloom flag/intensity/version, sharpen flag/intensity |
| `map` | map stack (photoreal, bing-aerial, bing-labels, esri-imagery, osm) |
| `lat`, `lon`, `alt`, `heading`, `pitch`, `roll` | camera |
| `ui` | panel/UI state |

Shortcuts (`/Users/imdadareeph/Desktop/42/gods-eye-view/src/ui/applicationShortcuts.js`): **1-7** looks (Normal, CRT, NVG, FLIR, Anime, Noir, Snow), **H** HUD, **D** cycle detection, **O** orbit/spin, **V** clean view, **F** layers panel, **C** CCTV, Esc dismiss search. Keys are ignored while typing in an input.

Note from `/Users/imdadareeph/Desktop/42/gev/FEATURES.md`: editing only the hash after load does not re-apply state; use a full reload.

---

## 10. Screenshot map (in `/Users/imdadareeph/Desktop/42/gev/shots`)

| Topic | Files |
|---|---|
| Normal look, scope feather 100 | `01-baseline-scope.png`, `06-flights-vessels.png`, `08-sats-cables-quakes.png` |
| Scope feather 0 (hard crop) | `07-scope-feather-0.png` |
| Visual Presets tray open | `02-visual-presets.png` |
| NVG | `03-style-nvg.png` (green HUD, params gain/bloom/scanlines/pixelation) |
| **FLIR** | `04-style-flir.png` (mono, params sensitivity/bloom/WHOT-BHOT/pixelation/Ironbow), `33-scenes-panel.png` (Cyber HUD, Ironbow tint) |
| CRT | `05-style-crt.png` (amber HUD) |
| Anime / Noir / Snow | `13-style-anime-dubai.png`, `14-style-noir-dubai.png`, `15-style-snow-dubai.png`, `16-snow-wind-dubai-flights.png` |
| HUD layouts | Tactical in 01-16; Operator `17-hud-operator.png`, 20, 24-29; Cyber `19-hud-cyber.png`, 33; Minimal not captured |
| Celestial / globe | `09-celestial-3d.png`, `21-reset-globe-orbit.png` |

Screenshot 5 from the earlier request, `/Users/imdadareeph/Desktop/42/Screenshot 2026-10-17 at 6.44.06 PM.png`, shows the tray itself: look row on top (NORMAL active), MAP SOURCE row below with ESRI SATELLITE active and BING LABELS greyed ("Needs CESIUM_ION_TOKEN").

---

## 11. Kawn comparison

Kawn has no WebGL looks and no HUD; its civic design deliberately avoids the "military look" (docs: `/Users/imdadareeph/Desktop/42/kawn/docs/25-looks-and-vehicles-observation.md`, §1b and §3a).

| Topic | God's Eye View | Kawn |
|---|---|---|
| Looks | 7 GLSL post-process looks over the Cesium frame | 5 map looks as **CSS filters on the map canvas only**: Natural, Night (`brightness .72 saturate .7 hue-rotate -10deg`), Heat map (`grayscale(1) contrast(1.1)`), Mono (`grayscale(1) contrast(1.15)` on `#map`), Sepia (`sepia(.7) saturate(1.2) brightness(.96)`). Rules in `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/styles/app.css` ~lines 1357-1360, state `mapLook` in `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/state.ts` |
| FLIR/NVG/CRT | Built in | **Not built.** Decision: sensor skins are v2 and, if ever built, sit behind an "Advanced looks" switch that is off by default |
| HUD | Four layouts, classification banner, MGRS/GSD/NIIRS | None. Kawn shows a plain info card (PLACE, LOCAL TIME, CENTRE, SCALE) top-right |
| Scope | Canvas mask, radius `0.525 × height`, feather default 11 %, altitude terminus | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/map/scope.ts`: CSS radial-gradient vignette; `fadeCurve`: `inner = lerp(0.72, 0, f)`, `outer = lerp(0.76, 1, f)`, smoothstep between; `labelAlpha = 1 - 0.93 × fade`; on by default with **feather 100** (owner decision), stored in the profile (`scopeOn`, `feather`) |
| Detection labels | Dense 75 % overlay | Simulated-vehicle tags (`SIM-0042`) only at zoom ≥ 15.5 with Scope on, at most 60, faded by the same scope curve |
| Shared idea | Scope keyhole fades labels and chrome | Same keyhole logic reused for labels; the look does not touch the scope |
