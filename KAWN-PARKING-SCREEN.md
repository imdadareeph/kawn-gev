# Kawn parking: where it sits on screen and how scope, looks and themes affect it

Written 2026-10-26. Read-only study; no code was changed and the app was not run. Companion files: `/Users/imdadareeph/Desktop/42/GEV-KAWN-ANALYSIS.md` (data, server, Part B1) and `/Users/imdadareeph/Desktop/42/GEV-HUD-LOOKS-SCOPE.md` (HUD, looks and scope in God's Eye View).

## Folder access note

The parking code is in `/Users/imdadareeph/Desktop/42/kawn`. **If you do not have permission to open that folder (or `/Users/imdadareeph/Desktop/42/gods-eye-view` for the comparison rows), ask the owner for permission before reading it.** Do not guess its contents. Every path below is absolute.


GEV has no parking, so this file is Kawn only. All code is under `/Users/imdadareeph/Desktop/42/kawn`. If access to that folder is not granted, ask the owner for permission before reading it. Full data and server detail is in `/Users/imdadareeph/Desktop/42/GEV-KAWN-ANALYSIS.md` (section 6.2 and Part B1); this section covers the screen side that parallels sections 1 to 8 above.

### 1 Files

| Part | Full path |
|---|---|
| Layer ids, profile, share letter | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/state.ts`, `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/share.ts` (`parking: 'p'`) |
| Sidebar row markup (`#lt-parking`, `#lm-parking`) | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/ui/shell.ts` ~lines 97-103 |
| Row state words and text (`layerRow`) | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/app.ts` ~lines 234-250 |
| Feed (fetch, zoom gate, box clamp) | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/parking.ts` |
| Marker drawing | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/deck-layers.ts` ~lines 231-252 |
| Pick to select to card | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/app.ts` (~637 pick, ~574 card), `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/ui/cards.ts` `parkingCard` |
| Server `/api/parking` | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/api.mjs` ~lines 221-320 and 386 |
| Design doc | `/Users/imdadareeph/Desktop/42/kawn/docs/13-parking-spot-feature.md` |

### 2 Layer stack on screen (Kawn)

Back to front:

| Order | Layer | Detail |
|---|---|---|
| 1 | MapLibre canvas | Vector basemap (`/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/map/map.ts`, `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/map/style.ts`) |
| 2 | deck.gl overlay canvas | `MapboxOverlay` with `interleaved: false`, so it is a **separate canvas** above the map. Parking markers, car dots, flights, transit, estate columns and satellites all draw here (`/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/deck-layers.ts`). Pixel ratio capped at 2, picking radius 8 px |
| 3 | `#scope` veil | `<div id="scope" class="scope">`, `position:absolute; inset:0; z-index:5; pointer-events:none`. A CSS radial-gradient (`scopeGradient`) painted over the map and deck canvases. Shell markup in `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/ui/shell.ts` line 9 |
| 4 | Panels and dock | Data layers sidebar, info card, bottom dock, selection card (bottom sheet on phones) |

There is no HUD layer. The nearest equivalents are the info card (PLACE, LOCAL TIME, CENTRE, SCALE) and the layer row for parking.

### 3 Parking row (where it is, what it shows)

In the **Data layers** sidebar, group **MOBILITY**, fourth row after Flights, Metro & bus and Road traffic: icon tile "P" (colour token `--c-parking`), name "Parking", state chip, then meta line and note. State words in screenshots: **IDLE** (zoom below 14, "Zoom in to see parking"), OFF. Text for the other states (LOADING, ON, STALE, UNAVAILABLE) is in Part B1.3 of `/Users/imdadareeph/Desktop/42/GEV-KAWN-ANALYSIS.md`. Keyboard and share: layer letter `p` in the share hash; off by default.

### 4 Marker colours by theme

Parking blue token `--c-parking` in `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/styles/app.css`: dark `#7aa7ff`, light `#2a55d6`, contrast `#9ec0ff` (lines 28, 70, 101). The deck layer uses the same hues as RGB (`PARKING_RGB`): dark `[122,167,255]`, light `[42,85,214]`, contrast `[158,192,255]`. Unknown-capacity sites are neutral grey `[140,152,168]`, 4 px; capacity-tagged sites use the theme blue, 5 to 13 px. Outline white (dark theme) or near-black (light). Known gap from the handoff: markers look faint on the dark map.

### 5 How the Scope affects parking

Scope in Kawn is the `#scope` veil (section 11 of `/Users/imdadareeph/Desktop/42/GEV-HUD-LOOKS-SCOPE.md`). Its parameters: centre = middle of the free map area (excluding panels), `radius = max(120, 0.5 × hypot(w, h) × 0.78)`, feather 0 to 100 (default **100**), strength per theme: dark `rgba(3,6,10)` at 0.82, light `rgba(246,244,239)` at 0.70, contrast `rgba(0,0,0)` at 0.90 (`SCOPE_RGB`, `SCOPE_STRENGTH` in `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/app.ts` lines 62-63). World view forces the dark values.

- **Parking markers are not faded by `labelAlpha`.** Only text labels and car tags call `labelAlpha` (`/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/deck-layers.ts` lines 186 and 346). Parking markers are plain dots with no label.
- **They are dimmed by the veil itself.** Because the veil sits above the deck canvas (z-index 5) and darkens (dark theme) or lightens (light theme) toward the edges, parking dots near the screen edge fade visually with the rest of the map. At feather 100 the fade starts at the centre, so markers away from the middle are already partly veiled, which adds to the "faint markers" gap.
- With Scope off, `#scope` is hidden and markers show at full strength everywhere.
- Picking is unaffected: the veil has `pointer-events: none`, and deck uses its own pick radius (8 px).

### 6 How the map looks affect parking

Looks are CSS filters (`/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/styles/app.css` lines 1357-1360): Night, Heat map, Sepia filter `.maplibregl-canvas` (the **basemap only**), while **Mono filters `#map`** (the map container, which includes the overlay canvas). Therefore:

| Look | Basemap | Parking markers |
|---|---|---|
| Natural | unchanged | unchanged |
| Night | dimmed and cooled | unchanged, so they stand out more |
| Heat map | greyscale | unchanged colours (the legend states "colour = data, not temperature") |
| Sepia | warm paper | unchanged colours |
| Mono | greyscale | greyscale as well (blue becomes grey), because the filter is on `#map` |

This is a design fact worth testing: in Mono the blue-vs-grey capacity cue (blue = tagged capacity, grey = unknown) is lost, so size is then the only cue. The documented marker language for later phases (shape and glyph, not colour alone) covers this.

### 7 Zoom gate, world view, camera

Parking draws only in city view (`parkingOn = city && layers.parking && state != 'unavailable'` in `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/app.ts` ~line 1535) and only from zoom 14 (`PARKING_MIN_ZOOM`). In World view (globe) the row reads IDLE "Switch to city view" and the feed is disabled (`parking.setEnabled(city && layers.parking)`, ~line 1857). Every camera settle calls `parking.cameraSettled()` (~line 1583) with a 450 ms debounce.

### 8 Selection card

Tapping a marker selects `{ kind: 'parking', id: 'osm-...' }` and renders `parkingCard` in the single selection card (bottom sheet on phones). A selected parking site gets a highlight ring (`ring('parking-selected', lng, lat)`). Turning the layer off clears the selection.

### 9 Comparison with how GEV shows its equivalents

| Concern | GEV | Kawn parking |
|---|---|---|
| Marker over the scope | Detection labels fade with the shared keyhole (`keyholeLabelAlpha`) | Dots are veiled by the scope gradient; labels (cars, flights) use `labelAlpha` |
| Look interaction | Look shader recolours the whole 3D frame; detection overlay re-themes per look | Look filters hit the basemap; deck markers keep their colours except in Mono |
| Status chrome | Chip on the layer row plus top status pill | State chip and meta line on the sidebar row; card carries a SUPPLY ONLY badge |
| HUD | Corner readouts, GSD/NIIRS | None; no occupancy or availability is ever drawn |
