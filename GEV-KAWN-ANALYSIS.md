# God's Eye View + Kawn: front end, maps, APIs, satellite views, car/parking simulation, sidebar

Written 2026-10-26. Sources read: `/Users/imdadareeph/Desktop/42/gods-eye-view/` (README, DATA_SOURCES, docs, `/Users/imdadareeph/Desktop/42/gods-eye-view/src/`, `/Users/imdadareeph/Desktop/42/gods-eye-view/server/`), `/Users/imdadareeph/Desktop/42/gev/` (/Users/imdadareeph/Desktop/42/gev/FEATURES.md, 36 screenshots in `/Users/imdadareeph/Desktop/42/gev/shots/`), `/Users/imdadareeph/Desktop/42/kawn/` (docs 11, 13, 25; `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src`, `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server`), `/Users/imdadareeph/Desktop/42/HANDOFF-SESSION-2026-10-17.md`, and the screenshots `/Users/imdadareeph/Desktop/42/audit-desktop-all-layers.png`, `/Users/imdadareeph/Desktop/42/kawn-cars-1.png`, `/Users/imdadareeph/Desktop/42/kawn-cars-2.png`, `/Users/imdadareeph/Desktop/42/Screenshot 2026-10-17 at 6.44.06 PM.png`.

> Handoff rule: nothing under `/Users/imdadareeph/Desktop/42/kawn/` may carry the original's code, names or wording. This file sits one level up in `42/`, so it may compare the two. Do not copy parts of it into `/Users/imdadareeph/Desktop/42/kawn/`.

## Folder access and path convention

**Permission note.** This analysis reads files across several folders. If Claude Code (or any reader of this file) does not have permission to open one of the folders below, **ask the owner for permission to access that folder before reading it.** Do not guess its contents and do not work around the denial.

**Paths.** Every file or folder named in this document is given as a full absolute path. The five roots are:

| Root | Full path | Holds |
|---|---|---|
| God's Eye View (original, read-only reference) | `/Users/imdadareeph/Desktop/42/gods-eye-view` | `src/`, `server/`, `docs/`, `README.md`, `DATA_SOURCES.md` |
| Kawn app | `/Users/imdadareeph/Desktop/42/kawn/kawn-app` | `src/`, `server/`, `shared/`, `tests/` |
| Kawn project | `/Users/imdadareeph/Desktop/42/kawn` | `docs/00` to `docs/25`, `reverse-engineering/`, `ui-design/` |
| GEV capture notes | `/Users/imdadareeph/Desktop/42/gev` | `FEATURES.md`, `shots/` (36 screenshots) |
| Working folder | `/Users/imdadareeph/Desktop/42` | this file, `HANDOFF-SESSION-2026-10-17.md`, the four Kawn/audit screenshots, `wallA-notes/` |

**Where parking lives.** All parking work is in Kawn, under `/Users/imdadareeph/Desktop/42/kawn` (GEV has no parking). If access to that folder is not granted, ask the owner for permission before reading these:

| What | Full path |
|---|---|
| Design and analysis | `/Users/imdadareeph/Desktop/42/kawn/docs/13-parking-spot-feature.md` |
| Build log (step 6, parking phase 0) | `/Users/imdadareeph/Desktop/42/kawn/docs/17-build-log.md` |
| Client feed and helpers | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/parking.ts` |
| Map drawing | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/deck-layers.ts` |
| Server route `/api/parking` (Overpass proxy) | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/api.mjs` |
| Parking card | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/ui/cards.ts` |
| District brief (parking count) | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/data/district-brief.ts` |
| Tests | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/tests/parking.test.ts` |

Kawn doc numbers map to `/Users/imdadareeph/Desktop/42/kawn/docs/NN-<name>.md`. A source file named only by its function (no path) lives under one of the roots above; use the section's app (GEV or Kawn) to pick the root.

Contents
1. God's Eye View (GEV): front end
2. GEV: maps, imagery and terrain
3. GEV: APIs and data sources
4. GEV satellite and map views seen in `/Users/imdadareeph/Desktop/42/gev/shots`
5. Kawn: how it is built
6. Kawn: how cars and parking are simulated (screenshot 1 and 4)
7. Kawn: sidebar elements (screenshots 1 to 4)
8. Handoff status and open items
9. GEV vs Kawn at a glance
10. PART B (detailed, starts after section 9): B1 parking in depth, B2 satellite imagery views, B3 satellites and orbits, B4 NASA GIBS imagery, B5 summary

---

## 1. God's Eye View: front end

**What it is.** A browser "spy-satellite simulator": a photorealistic 3D globe with live aircraft, ships, satellites, quakes, traffic, public CCTV, and voice control. v0.2.1, MIT code, ~1,600 source files in `/Users/imdadareeph/Desktop/42/gods-eye-view/src/` and `/Users/imdadareeph/Desktop/42/gods-eye-view/server/`. Runs at `http://localhost:4173` (Vite).

**Stack.** Vanilla JavaScript (no UI framework), CesiumJS globe, Vite, a Node server (Vite plugin plus `/Users/imdadareeph/Desktop/42/gods-eye-view/server/standalone`) that brokers every keyed API. Voice uses the OpenAI Realtime API (30 voice tools). Also ships an MCP server (`/Users/imdadareeph/Desktop/42/gods-eye-view/server/mcp`) and an embeddable panel (`?embed=1`, `npm run build:panel`).

**Boot.** `/Users/imdadareeph/Desktop/42/gods-eye-view/src/main.js` → `/Users/imdadareeph/Desktop/42/gods-eye-view/src/standalone/application.js` → `createApplication` with four constructors, started in order: `createScene` (Cesium viewer, credits, initial map), `createControls` (style manager, camera), `createData` (layer catalog, state restore), `createTools` (scenes, annotations, voice). Teardown runs the reverse: tools, controls, data, scene. Source: `/Users/imdadareeph/Desktop/42/gods-eye-view/docs/APPLICATION.md`.

**Screen layout** (from `/Users/imdadareeph/Desktop/42/gev/FEATURES.md` and screenshots):

| Region | Content |
|---|---|
| Top left | Logo "GOD'S EYE VIEW / NO PLACE LEFT BEHIND" |
| Top centre | 5 round buttons: clear layers, copy share link, tilt (35° oblique), north-up, reset globe. Status pill below ("REFRESHING LIVE DATA · CCTV", "LOADING FRAMES 612/3902") |
| Top right | "ACTIVE STYLE" readout (NORMAL / NVG / FLIR / CRT / ...) |
| Left | **Data Layers** panel, grouped Movement, Cameras, Infrastructure, Events, Weather, Utilities. Each row: icon, name, count, source and age line, ON/OFF/LOADING/FALLBACK/UNAVAILABLE chip |
| Right rail | **Display** (HUD + layout, Detection density/allocation/fade/outside, 3D models PROXIMITY/ALL, Scope feather, Draw, Celestial, Clean UI, Bloom, Sharpen), **CCTV**, **Street Level**, **Context** (Contacts, Space Missions), Weather |
| Bottom | Dock: **Location** tray, **Voice** (hold Space; STD/MINI model, spend readout, $5 cap), **Visual Presets** tray |
| Overlay HUD | Military-style text: "TOP SECRET // SI-TK // NOFORN" (cosmetic), MGRS, lat/lon, GSD, NIIRS, altitude, sun elevation, REC clock. Four layouts: Tactical, Operator, Minimal, Cyber |
| Bottom left | Cesium ion logo, "Powered by Esri", © OpenStreetMap, expandable "Data attribution" lightbox |

**Look system.** GLSL post-process presets: Normal, CRT, NVG, FLIR, Anime, Noir, Snow. Each has parameter sliders (NVG: gain 0.18, bloom 0.22, scanlines 0.96, pixelation 1.0; FLIR: sensitivity, bloom, white/black, ironbow; CRT: pixelation, distortion, instability; Snow: density 0.6, wind 0.5). Picking a look auto-enables the HUD. Look and parameters are stored in the share link.

**Scope.** A keyhole spotlight at screen centre. Detection labels stay sharp inside and fade outside. "Feather" 0 = hard edge, 100 = smooth vignette. (Kawn copies this idea and ships it on by default at feather 100.)

**State and share links.** All state (camera, style, layers, one tracked target) lives in the URL hash, e.g. `lo=f.t.<hex>` for a tracked aircraft. `/Users/imdadareeph/Desktop/42/gev/FEATURES.md` notes that editing only the hash after load does not re-apply it; navigate or reload.

**Other front-end features.** Cockpit ride-along, Contacts roster (250 km), click-to-track with trail and metadata, 3D aircraft models that swap in near the camera (787, ATR-72, Citation, Bell 206, MQ-9), Draw (area/line/pin with live measure), Scenes/Director (6 built-ins: Nepal Flood, Global Flights Radar, Orbital Watch, Thermal Threat Board, City Overload, Omniscience Pullback), voice whiteboard, directions A→B with fly-along, Street Level (Mapillary, Google Street View, KartaView), radio tuner (750 stations), POWER UP panel for keys.

**Behaviours worth knowing** (`/Users/imdadareeph/Desktop/42/gev/FEATURES.md`): heavy layer combos hang the browser, so turn layers on one at a time; zoom-out has no clamp with synthetic wheel events; Esri tiles went blank at ~108 m (stay above ~500 m for recordings); layers can re-enable after fly-to.

**Rendering technique** (README "Under the Hood"): per-frame screen-space heading so icons keep true heading at any camera angle; render one feed interval behind real time with interpolation and dead reckoning; SGP4 for satellites with orbit rings realigned by GMST; entity heights aligned to Google 3D tiles so aircraft sit on aprons.

---

## 2. GEV: maps, imagery and terrain

The map stack is declared in `/Users/imdadareeph/Desktop/42/gods-eye-view/src/maps/catalog.js`. Five selectable stacks, shown as the **MAP SOURCE** row in the Visual Presets tray (screenshot 5, `/Users/imdadareeph/Desktop/42/Screenshot 2026-10-17 at 6.44.06 PM.png`):

| Chip | id | Provider | Needs | Implementation |
|---|---|---|---|---|
| GOOGLE 3D | `photoreal` | Google Photorealistic 3D Tiles | Cesium ion token (free tier, personal use) or a Google Maps key (metered) | `/Users/imdadareeph/Desktop/42/gods-eye-view/src/maps/google3d.js`: tries Google direct key, then server-issued token, then ion-hosted Google asset |
| BING AERIAL `ION` | `bing-aerial` | Bing aerial via Cesium ion | `CESIUM_ION_TOKEN` | `/Users/imdadareeph/Desktop/42/gods-eye-view/src/maps/imagery.js` fetches the ion endpoint, builds a `BingMapsImageryProvider` over HTTPS |
| BING LABELS `ION` | `bing-labels` | Bing aerial with labels via ion | `CESIUM_ION_TOKEN` | same path, labelled style |
| **ESRI SATELLITE** `SAT` | `esri-imagery` | Esri World Imagery | none | `ArcGisMapServerImageryProvider` on `services.arcgisonline.com/.../World_Imagery/MapServer` |
| OSM | `osm` | OpenStreetMap raster | none | `OpenStreetMapImageryProvider` on `tile.openstreetmap.org` |

Screenshot 5 shows the state without keys: ESRI SATELLITE highlighted (active), BING LABELS ION outlined and greyed with the tooltip "Needs CESIUM_ION_TOKEN — add it in Provider Settings", and the Look row (NORMAL active, CRT, NVG, FLIR, ANIME, NOIR, SNOW) above it.

**Startup route** (`selectMapStartupRoute`): Google key → `google-direct`; else ion token → `google-ion`; else `osm` path (the keyless Esri globe in practice, with OSM as automatic fallback if Esri is unreachable).

**Terrain.** `/Users/imdadareeph/Desktop/42/gods-eye-view/src/maps/terrain.js`: Cesium world terrain when an ion token exists, otherwise a keyless terrain provider. `/Users/imdadareeph/Desktop/42/gev/FEATURES.md` saw a Re:Earth terrain source return 429 under load; terrain then pops in late. Wait ~8 s before recording.

**Basemap ladder (README):**

| You have | You get |
|---|---|
| Nothing | Esri World Imagery in 2D plus keyless terrain; OSM if Esri fails |
| Free Cesium ion token | Google Photorealistic 3D plus world terrain |
| Google Maps key | Same 3D direct, plus Google place search (billing needed, first 1,000 sessions a month free) |

**Credits.** Required Google/Cesium credit renders in `#cesium-credits`; each layer registers its own credit through `/Users/imdadareeph/Desktop/42/gods-eye-view/src/data/dataCredits.js`.

---

## 3. GEV: APIs and data sources

The browser talks to its own `/api/*` routes. Those routes are the only place keys live. Hardening noted in README: SSRF protection, response caps, sanitised errors. The browser only sees the Google Maps key and Cesium ion token.

### 3.1 Own server routes (counted in `/Users/imdadareeph/Desktop/42/gods-eye-view/src/` and `/Users/imdadareeph/Desktop/42/gods-eye-view/server/`)

| Route group | Examples | Upstream |
|---|---|---|
| Flights | `/api/flights`, `/api/flights/track`, `/api/adsbdb/` | OpenSky (primary), adsb.lol point API (fallback), OpenSky tracks, adsbdb |
| Military | `/api/military`, `/api/military/track`, `/api/military-installations` | adsb.lol military feed, OSM via Overpass |
| Vessels | `/api/vessels` | AISStream websocket `wss://stream.aisstream.io` (key; 503 without it) |
| Space | `/api/celestrak`, `/api/celestrak/active`, `/api/launches` | CelesTrak GP elements; Launch Library 2 (`ll.thespacedevs.com`) |
| Geocode and routes | `/api/geocode`, `/api/route`, `/api/google/text-search`, `/api/google/nearby-places` | Nominatim, Photon (keyless search), OSRM routing, Google Places |
| Traffic | `/api/tomtom/status`, `/api/tomtom/flow/...` | TomTom flow tiles `api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.pbf` (daily tile budget) |
| Overpass | `/api/overpass`, `/api/overpass/status` | OSM Overpass (roads, ALPR, installations), cached |
| Terrain | `/api/terrain/heights` | terrain height sampling |
| Weather | `/api/wind`, `/api/wind/grid/...`, `/api/weather/*`, `/api/weather-effects`, `/api/cyclones`, `/api/regional-brief` | NOAA GFS (AWS open data), ECMWF IFS open data, NOAA nowCOAST (radar, GOES clouds, lightning), NHC/CPHC |
| Fire | `/api/firms`, `/api/fire-perimeters` | NASA FIRMS (key), WFIGS/NIFC |
| CCTV | `/api/cctv`, `/api/cctv/sources`, `/api/cctv/media/...`, `/api/cctv/frame/`, `/api/cctv/health` | ~3,900 public cameras (TxDOT, Caltrans, TfL, 511 Ontario, Fintraffic, DriveBC, Tallinn, DelDOT HLS, NSW, Calgary, Norway) |
| Transit and bikes | `/api/transit`, `/api/transit/feeds`, `/api/transit/vehicles/`, `/api/gbfs/` | GTFS-RT feeds, GBFS |
| Radio | `/api/radio/stations`, `/api/radio/click/` | Radio Browser (de1/de2/nl1) |
| Street level | `/api/mapillary/tiles` (29 call sites), `/api/mapillary/status` | Mapillary tiles (client token) |
| GNSS | `/api/gnss-integrity` | adsb.lol NIC/NACp aggregation |
| AI and voice | `/api/realtime/token`, `/api/realtime/oauth-*`, `/api/openai/hud-summary`, `/api/voice/token` | OpenAI Realtime (key or ChatGPT OAuth) |
| Setup | `/api/setup/status`, `/api/setup/keys` | POWER UP key writer (dev server only) |

### 3.2 Browser-direct calls

USGS earthquakes (`earthquake.usgs.gov/.../all_day.geojson`), KartaView, Google Street View (Maps JS API), Photon geocoder, Cesium ion endpoints, Esri/OSM/Bing tiles, Google 3D tiles (`tile.googleapis.com`).

### 3.3 Bundled static data

Data centres (4,351), dams (704), submarine cables (712 routes, ~2.6K lines; TeleGeography, CC BY-NC-SA, commercial users must delete), OSM military names, neighbourhood overlays, city presets.

### 3.4 Keys (README)

| Key | Unlocks | Cost |
|---|---|---|
| Cesium ion | Google 3D, world terrain, Bing stacks | free (personal) |
| Google Maps | direct 3D, place search, Street View | metered |
| OpenAI | voice, AI HUD summary | metered, $5 hard cap |
| AISStream | live ships | free |
| NASA FIRMS | fires | free |
| TomTom | live flow speeds for simulated traffic | free tier |
| Mapillary | street-level imagery | free |
| OpenSky, Launch Library 2 | higher allowances | free, optional |

Eighteen of twenty layers have a keyless path. `npm run doctor` reports provider readiness without printing values.

### 3.5 Request discipline

Per-provider caches, in-flight coalescing, OpenSky credit governor, TomTom daily tile budget, disk-cached TLEs, byte-range GRIB2 reads for wind (cached an hour), HLS proxy limited to 2 sessions and 24 MiB.

---

## 4. GEV satellite and map views seen in `/Users/imdadareeph/Desktop/42/gev/shots` (36 images)

Every screenshot except the globe/orbit ones uses the **Esri satellite basemap** (no Google/Bing keys were configured: attribution reads "Powered by Esri • © OpenStreetMap"). Views grouped by imagery type:

### 4.1 Esri satellite, flat or top-down (London, alt ~35.8 km)

| Shot | What it shows |
|---|---|
| 01 baseline-scope | London from above, Scope feather 100. Data-centre and CCTV labels, camera-mesh clusters; Transit, Bike Share, Mapped ALPR ON; "LOADING FRAMES 44/3902" |
| 02 visual-presets | Same view, Visual Presets tray open: 7 looks plus MAP SOURCE row with ESRI SATELLITE active |
| 03 style-nvg | NVG: green monochrome, scanlines, HUD on, parameters (gain, bloom, scanlines, pixelation) |
| 04 style-flir | FLIR: grayscale thermal, parameters incl. Ironbow |
| 05 style-crt | CRT: amber-tinted, scanline texture |
| 06 flights-vessels | Normal look, Live Flights "ENABLING", Live Vessels **UNAVAILABLE** (AISSTREAM_API_KEY not set) |
| 07 scope-feather-0 | Same area with hard-edge Scope (feather 0) |
| 08 sats-cables-quakes | Mapped ALPR, Data Centers 4.4K, Submarine Cables 2.6K, Earthquakes 32 ON; aircraft icons and a red ISS path across London |

### 4.2 Esri satellite, tilted or low altitude

| Shot | What it shows |
|---|---|
| 10 location-panel | Location tray with search box and chips (Austin, SF, New York, Tokyo, London) |
| 11 dubai-search | Typing "Dubai" flies keyless to Dubai (alt ~85 km) |
| 12 dubai-oblique-contacts | **Hero shot.** Tilted Dubai: Palm Jumeirah, The World, coast, flight lines to Sharjah/Dubai, Equinix DX1 and Khazna data-centre pins, "TILTED VIEW" |
| 13 style-anime-dubai, 14 style-noir-dubai, 15 style-snow-dubai | Same Dubai view through Anime, Noir, Snow looks |
| 16 snow-wind-dubai-flights | Snow look with Wind ON, flight callsigns (ABY369, UAE2AY, FALCON06...) |
| 17 hud-operator, 19 hud-cyber | Alternative HUD layouts; Cyber = red accents, `// CYBER` tag |
| 20 zoom-in-970m | Roof-level Esri imagery (GSD 0.38 m); tiles blank at ~108 m |
| 22 burj-khalifa-downtown | Oblique downtown Dubai with long tower shadows, Dubai Fountain lake; Live Flights FALLBACK (247, adsb.lol 250 nm) |
| 23 dubai-coast-flights | Coast with flights |
| 24 heathrow-airport | Heathrow, dozens of aircraft with callsign labels |
| 25 contacts-roster-heathrow | Operator HUD exposes Contacts roster |
| 26 heathrow-traffic-baw615-tracked | Tracked BAW615 with cyan trail, tooltip "BAW615 · 1700 ft · 81 kts · British Airways Airbus A320 · BDS → LHR" |
| 27 landing-touchdown-3d-model | Cyan 3D A320 model on the runway, GSD 0.16 m, "LOAD FAILED" chip, Operator HUD, CCTV pane empty |
| 28 landing-rollout | Straight-down rollout |
| 29 heathrow-oblique-ual935-tracked | Oblique, UAL935 (0 ft, 8 kts, STALE) |
| 30, 31 draw | Draw mode: orange quadrilateral over Heathrow terminals, label "Heathrow stand area" |
| 32 street-level-key-required | Street Level **UNAVAILABLE / KEY REQUIRED** (Mapillary token missing); Mapillary credit in the footer |
| 33 scenes-panel | Cyber HUD, FLIR look, Scenes panel (6 built-ins, Capture/Update shot, Start/Stop/Next, Export/Import) |
| 34-36 scene-pullback | Omniscience Pullback scene frames |

### 4.3 Globe / orbital views

| Shot | What it shows |
|---|---|
| 09 celestial-3d | Celestial button: camera at ~24,900 km, whole Earth with radio markers, CCTV clusters, earthquake labels (M2.7-M5.6), submarine cables, satellite label BEIDOU-3 IGSO-1; "3D MODELS PROXIMITY" |
| 21 reset-globe-orbit | Reset Globe → ~18,000 km orbit view |

### 4.4 Imagery sources behind those views

- Esri World Imagery (all flat/oblique shots).
- Google Photorealistic 3D: never shown in these shots (no key). Shot 22's tower shadows are baked into the Esri imagery, not 3D tiles.
- Bing Aerial / Labels: greyed out without `CESIUM_ION_TOKEN` (screenshot 5).
- OSM: automatic fallback only.
- Non-map imagery layers: "Recent Imagery" (NASA GIBS, HLS + VIIRS) stayed OFF in all shots. Satellites layer (CelesTrak) shows 824-838 objects when on.

### 4.5 Gaps `/Users/imdadareeph/Desktop/42/gev/FEATURES.md` lists as not captured

Cockpit ride-along, approach/descent, rain/cloud/lightning, CCTV nearest/hop, Minimal HUD, voice, five of six scenes, share-link copy.

---

## 5. Kawn: how it is built

**Product.** "Kawn: See the whole city." UAE city intelligence, English + Arabic. Code in `/Users/imdadareeph/Desktop/42/kawn/kawn-app`. Dev server `http://localhost:8789/`. Docs in `/Users/imdadareeph/Desktop/42/kawn/docs` (00-INDEX to 25).

**Stack.** TypeScript, Vite, MapLibre GL 6.14 (2D vector map), deck.gl 9.4 overlays (via `@deck.gl/mapbox`), satellite.js 7.1.0, plain Node server (`/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/index.mjs`, `api.mjs`) as a key broker and cache, Vitest (268 tests). No UI framework: HTML strings from `ui/cards.ts` and `ui/shell.ts`.

**Maps.** `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/map/style.ts` builds its own styling over keyless OpenFreeMap vector tiles (`tiles.openfreemap.org/planet`, OpenMapTiles schema, ODbL). TomTom flow tiles are added as a proxied source `/api/traffic/{z}/{x}/{y}`. A Scope module (`/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/map/scope.ts`) copies the keyhole idea. Looks (Night, Heat map, Mono, Sepia) are CSS filters on the map canvas only. World view (globe) shows satellites/orbits. No satellite imagery: the map-source row is documented as "Streets and Satellite (licence needed, greyed)".

**Server routes** (`/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/api.mjs`, `routes.mjs`):

| Route | Upstream |
|---|---|
| `/api/flights` | adsb.lol, failover adsb.fi (breaker, spacing, 9 s cache, 120 s stale) |
| `/api/route`-family | adsbdb, vrs-standing-data.adsb.lol (host allow-list, no redirects) |
| `/api/traffic/{z}/{x}/{y}`, `/api/traffic/status`, `/api/traffic/corridors` | TomTom flow tiles; corridor fallback uses TomTom flowSegmentData on ~25 main roads |
| `/api/parking?south&west&north&east` | Overpass (`overpass-api.de`, `overpass.kumi.systems`), 24 h cache |
| `/api/orbits` | CelesTrak (cached to `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/.cache/orbits.json`) |
| `/api/health` | health |

Browser CSP allows only `self`, `tiles.openfreemap.org`, `photon.komoot.io`. Search uses Photon first, Nominatim as Enter-only fallback. Limits: per-IP 90/min general, 240/min flights allowance, GET/HEAD only, 8 s upstream timeout, 8 MB cap, sanitised errors. Secrets stay server-side (`/Users/imdadareeph/Desktop/42/kawn/kawn-app/.env`; the TomTom key must never be printed or committed).

**State.** `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/state.ts`: `LayerId = flights | transit | traffic | estate | parking | orbits`; a `Profile` (lang, numerals, theme dark/light/contrast, mapLook, `cars`, scopeOn, feather, layers, panel open flags, dockPinned, role) saved to localStorage and sanitised on load. Share links use the URL hash; letters: f flights, t transit, k traffic, p parking, o satellites, e estate, w world view, y year, d district, m metro.

---

## 6. Kawn: how cars and parking are simulated

Screenshot 1 (`/Users/imdadareeph/Desktop/42/audit-desktop-all-layers.png`) shows Road traffic ON and **Parking IDLE ("Zoom in to see parking")**. Screenshot 4 (`/Users/imdadareeph/Desktop/42/kawn-cars-2.png`, Burj Khalifa, 380 m scale) shows the "Simulated vehicles" switch under Road traffic with a **SIMULATED** chip, and the dots on the roads. There are two separate things, and only one is simulated.

### 6.1 Cars: simulated, not real

Code: `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/cars.ts` (153 lines), wired in `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/app.ts` ~lines 322-410 and drawn in `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/deck-layers.ts` ~163-215. Documented in `/Users/imdadareeph/Desktop/42/kawn/docs/11-realtime-car-traffic.md`, `/Users/imdadareeph/Desktop/42/kawn/docs/25-looks-and-vehicles-observation.md`.

**Honesty rule.** "No dot is a real car." Positions are generated. Only speed and colour follow measured road speed. UAE public data has no moving-car feed (docs 11, 14), so the label stays: `carsNote` = "Generated dots on real roads, not real cars. Speed and colour follow measured road speed where available; grey means no speed data."

**Activation** (`carsActive`): `profile.cars` AND Road traffic layer ON AND not world view AND zoom ≥ 12. The toggle is `#lt-cars` ("Simulated vehicles"), nested under Road traffic, off by default.

**Pipeline per refresh** (350 ms debounce after the camera settles):

1. **Roads.** Take road lines from the map's rendered vector tiles (motorway, trunk, primary, secondary, tertiary and smaller; footpaths and tracks excluded) as `RoadIn { key, coords, cls }`.
2. **`buildRoads`.** Dedupe by key, compute cumulative length (`metres` with a cos-latitude correction), drop roads under 40 m, cap at 3,000. Each road gets a `level` (0..1 relative speed, 1 = free flow) from `corridorLevel`: the nearest measured TomTom corridor vertex within 60 m of the road's midpoint, or `null` if none.
3. **`carBudget(zoom, phone)`.** 0 below zoom 12; cap 4,000 (1,500 on phones) scaled by `min(1, (zoom-11)/3)`, floor 300.
4. **`reconcile`.** Keep cars still on in-view roads; for each new road add `max(len>150 ? 1 : 0, floor(len / spacing))` cars at random positions. Spacing by class: motorway 70 m, trunk 90, primary 120, secondary 160, tertiary 220, other 400. Free speed by class: 25, 20, 16, 12, 9, other 6 m/s, times `0.8 + 0.4·rand` and times `speedScale(level) = 0.15 + 0.85·level` (unknown level = 1). If over budget, thin evenly by stride.
5. **`step(dt)`** each animation frame (dt clamped to 0.25 s): advance `s += v·dt`; at road end wrap to start. On slow roads (level < 0.5) each car has `0.4·dt` chance per frame to hold for 1-3 s: stop-and-go. Skipped when the user prefers reduced motion.
6. **`points`.** Interpolate each car's position along its road (`positionAt` binary-searches the cumulative lengths) and tag a colour tier from the road level: `tierOf` = 3 standstill (<0.25), 2 heavy (<0.5), 1 slow (<0.8), 0 free, -1 unknown (neutral grey).
7. **Draw.** deck.gl `ScatterplotLayer` `cars`: radius 2.4 px (3.4 px at zoom ≥ 15), fill from the theme traffic ramp or neutral grey, thin halo outline. Tags (`SIM-0042`, id mod 10000) appear only at zoom ≥ 15.5 with Scope on, at most 60, faded by the Scope mask.

**What is live in the loop:** only the road speed level (TomTom flow tiles, or ~25 corridor probes as fallback). Everything else is a model. In screenshot 4 the yellow thick road is TomTom-coloured slow flow on the main highway and the yellow dots cluster on it; white/grey dots sit on roads with no speed data.

**Compared with GEV** (`/Users/imdadareeph/Desktop/42/kawn/docs/25-looks-and-vehicles-observation.md` §1a, read with owner permission): GEV does the same trick. Count per road = length/spacing × class multiplier × density slider (cap 6,000, falling with height, floor 400); dots advance along road waypoints at class speed scaled by congestion with random stop-and-go; the id tag is the list index, not a vehicle identity; live data only recolours and re-paces. GEV switches vehicles off above 8 km and limits to major roads above 4.5 km. Kawn's version is smaller (4,000 cap, zoom ≥ 12) and labelled SIMULATED in the UI, tags, share link and i18n (AR "محاكاة").

### 6.2 Parking: not simulated, supply only

Code: `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/parking.ts`, route `GET /api/parking` in `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/api.mjs` (~221-320), design in `/Users/imdadareeph/Desktop/42/kawn/docs/13-parking-spot-feature.md`. There is **no availability data and none is invented.** Dubai's real-time bay occupancy sits with Parkin, RTA sensors and malls (no public API found); TomTom Parking Availability needs a sales agreement.

What the layer does:

- **Zoom gate.** `PARKING_MIN_ZOOM = 14`. Below that the row shows **IDLE** and "Zoom in to see parking" (this is screenshot 1).
- **Fetch.** On camera settle (450 ms debounce) `ParkingFeed` clamps the view to a box no larger than 0.05° per side (server rejects > 0.06°), skips the request if the new box is inside the last fetched box, aborts older requests, and calls `/api/parking?south&west&north&east`.
- **Server.** Overpass query `nwr["amenity"="parking"]` and `nwr["amenity"="parking_space"]` in the box, `out center tags`, 25 s timeout, two mirrors, grid-snapped box so neighbours share cache keys, 24 h cache, daily budget, and an Overpass "200 with remark" (timeout) is never cached as "no parking".
- **Parse.** `parseSites` accepts only ids matching `osm-[nwr]\d+`; maps kind (surface, multi-storey, underground, street_side, other), capacity (positive number or null), fee, access, `hideByDefault`. Private and customers-only sites are hidden by default and counted ("N private or customers-only sites hidden"). Up to 4,000 sites kept.
- **Draw.** deck.gl `ScatterplotLayer` `parking`, pickable. Radius `parkingRadius(capacity)`: 4 px neutral grey when capacity is unknown (about 96 % of OSM lots; only 146 of 4,093 in the Dubai box carry a capacity), else 5-13 px by `3 + sqrt(capacity)/2`. Click opens a parking card.
- **States.** OFF, IDLE, LOADING, ON ("SUPPLY ONLY · N sites from OpenStreetMap · availability not provided"), STALE ("Saved copy, upstream unreachable"), UNAVAILABLE (budget / busy / unreachable).
- **Handoff gap:** parking markers are faint on the dark map.

**Planned (/Users/imdadareeph/Desktop/42/kawn/docs/13-parking-spot-feature.md, not built):** Phase 1 an **ESTIMATED** busyness band (four levels, never a number) from time-of-week, tariff zone and events, labelled as an estimate; Phase 2 navigation hand-off; Phase 3 a licensed live feed only after a signed agreement. Rule: LIVE (feed, with age) vs ESTIMATED (model, band only) vs UNKNOWN (supply only); free-space numbers only for LIVE.

---

## 7. Kawn: sidebar elements

The sidebar is the **Data layers** panel (`layersTitle`), top-left under the "Kawn / See the whole city." brand block, collapsible with the chevron at the top right of its header, scrolls inside. Screenshots: 1 and 3 `/Users/imdadareeph/Desktop/42/audit-desktop-all-layers.png` (zoom 3 km, flights and traffic ON), 2 `/Users/imdadareeph/Desktop/42/kawn-cars-1.png` (1.7 km, only flights + metro ON), 4 `/Users/imdadareeph/Desktop/42/kawn-cars-2.png` (380 m, traffic ON with vehicles). Screenshots 1 and 3 are the same file.

**Row anatomy.** Icon tile, layer name, state chip (OFF / ON / LOADING / DEGRADED / STALE / FALLBACK / UNAVAILABLE / SAMPLE / IDLE). When a row is active it gets a coloured outline (teal ON, gold SAMPLE, grey IDLE) and a meta line plus an optional note below. Chips carry the word as well as colour. Each row is a switch (`aria-checked`).

| Group | Row | State in screenshots | Meta / note text | Data |
|---|---|---|---|---|
| **GROWTH** | City growth | OFF (all four) | "SAMPLE · illustrative · years from public reporting, verify" | Timeline slider (`growth.ts`), network by year (`networkAt`) |
| **MOBILITY** | Flights | ON (1, 3, 2); OFF (4) | "adsb.lol · 11 s ago · 56 aircraft" (1); "adsb.fi · 9 s ago · 68 aircraft" (2). Note: "Military and state aircraft are not shown." | Live via `/api/flights`; source and age change with provider failover (adsb.lol → adsb.fi). Zoom gate gives IDLE "Zoom in to load aircraft" |
| | Metro & bus | **SAMPLE** (gold) | "Illustrative routes · simulated vehicles · Blue Line planned for 2029 (dashed)". Note: "Not RTA or ITC data. Needs an operator agreement for live feeds." | Sample lines/stations (`transit-sample.ts`, `blue-line.ts` from OSM track shapes); red line = Metro Red, yellow/teal/green = other lines; dashed blue = planned Blue Line |
| | Road traffic | ON (1, 3, 4) | "Live speeds on main roads only · TomTom" (corridor fallback) or "Live road speeds · TomTom · zoom 8+" (tiles). Note: "Live congestion colours on roads from TomTom. Colour is road speed, not individual cars." | TomTom flow. Failure words: no key, key lacks access to flow tiles (tiles return 403, handoff open item 1), feed unreachable |
| | ↳ Simulated vehicles (nested switch, **SIMULATED** chip) | visible in 4 only | "Generated dots on real roads, not real cars. Speed and colour follow measured road speed where available; grey means no speed data." | `cars.ts`, see §6.1 |
| | Parking | **IDLE** (1, 3), OFF (2, 4) | IDLE: "Zoom in to see parking". Note: "Supply from OpenStreetMap, not live availability." | `/api/parking`, see §6.2 |
| **SPACE** | Satellites | OFF | When on in World view: "ESTIMATED · computed from public orbital elements · elements {age} old · {n} objects". Outside World view: IDLE "Open World view to see satellites" | CelesTrak via `/api/orbits`, SGP4 in satellite.js; click flies to and follows a satellite; teal ground track |
| **REAL ESTATE** | Property activity | OFF | "Generated sample · not official figures" | `estate-sample.ts`, 3D columns (height = activity index, colour = price index) |

(Row order per code: growth, then mobility rows, then space, then real estate. Screenshot 4 shows the "Real estate" header cut off at the bottom of the scroll.)

**Other chrome visible in the screenshots**

| Element | Detail |
|---|---|
| Brand block | Logo disc with gold dot, "Kawn", tagline |
| Top toolbar (round icons) | 6 buttons: clear/close, copy share link, 3D/tilt, compass/north-up, globe/World view, locate-me |
| Top-right info card | PLACE (Dubai · United Arab Emirates), LOCAL TIME (ticking), CENTRE (lat/lng), SCALE (3 km, 1.7 km, 380 m) |
| "Text list of what is on the map" | Accessible text alternative to the canvas (chevron opens it) |
| Bottom dock | **Location** (current place: Dubai or "Dubai · Burj Khalifa"), **Search**, **Look** (Dark; theme/map look tray); trays pin with a button, at most two |
| Credits | Bottom-left button; attribution (OpenStreetMap, OpenFreeMap, TomTom, adsb.lol / adsb.fi etc.) |
| Map labels on dark theme | District labels gold (Bur Dubai, Deira, Jumeirah), airport and aircraft glyphs blue with callsign + altitude, station markers red |

**State logic** (`layerRow()` in `app.ts` ~220-295): world view forces every city layer to IDLE ("Switch to city view"); traffic checks `trafficState` (live, checking, no_key, forbidden, unavailable) and corridor fallback; parking and flights map their feed states; any other layer is SAMPLE. Same state words exist in Arabic (`stOn` "يعمل", `stSample` "عيّنة", `stIdle` "خامل", ...); Arabic strings pass a parity test but are not browser-checked.

**Compared with GEV's Data Layers panel.** GEV groups 6 sections with ~30 rows (Movement, Cameras, Infrastructure, Events, Weather, Utilities), tiny monospaced source/age lines, a count next to the name, and chips ON/OFF/FALLBACK/UNAVAILABLE/LOADING. Kawn keeps the chip idea but has 9 rows, plain sentences instead of terse codes, a nested sub-switch for simulated vehicles, and adds SAMPLE and IDLE words to separate "illustrative data" and "waiting for zoom" from "off".

---

## 8. Handoff status (`/Users/imdadareeph/Desktop/42/HANDOFF-SESSION-2026-10-17.md`)

**Done.** Steps 2-11: accessibility and tokens; 16-button location tray; parking supply (server and client); district brief card; metro cards; growth timeline; world view and satellites/orbits (CelesTrak, satellite.js 7.1.0); step 9a flights hardening (own 240/min allowance, adsb.lol and adsb.fi failover, UAE home circle, interpolation, ground glyphs); step 9b dock parity (tray engine, landmarks keys 1-5, search polish, look tray, mobile); step 10 satellite follow camera; step 11 flight path and follow (route card, REPORTED chip, no ETA); TomTom traffic (tiles plus corridor fallback); planned Blue Line. Checks: tsc clean, 268 tests, build and brand check pass, `npm audit` 0, TomTom key not in build output. Nothing in flight.

**Working rules.** Document first (/Users/imdadareeph/Desktop/42/kawn/docs/17-build-log.md plan before code), then build, then verify with Playwright in English only (390×844 and 1280×800, dark and light). Ask before installs, spend, config changes. Kawn name only; no GEV code, names, env-var names, routes or wording under `/Users/imdadareeph/Desktop/42/kawn/`. Real-path evidence is in `/Users/imdadareeph/Desktop/42/wallA-notes/ledgers/`. No version control yet.

**Open owner items.**
1. Enable the TomTom traffic **tile** product on the key (tiles return 403, corridor fallback works).
2. Flights production feed: adsb.fi is non-commercial; pick and contract a commercial feed; permission for the route database (/Users/imdadareeph/Desktop/42/kawn/docs/20-flight-path-and-follow-spec.md D4).
3. CelesTrak contact address and terms re-read; UAE satellite list unverified (MBZ-SAT is 62626).
4. Native Arabic review of new strings (satellites, follow, dock, parking, flight route).
5. Check 19 new landmark coordinates and Arabic names, Blue Line stations (medium confidence), growth sample years.
6. Licences for real estate, transit, parking feeds; who signs; whether to contact NCM, ITC, Sharjah, feed providers.
7. Decisions: military opt-in layer, commercial feed budget, Nominatim as Enter-only fallback, "Normal" look = follow device.

**Known gaps.** Tap-pick on map markers unverified headless; parking markers faint on dark map; Arabic deck text does not shape (project labels not drawn); Green Line has no geometry; not built: passes table, satellite search/hover, tray notch, orbit/clean view, voice, trails backfill beyond step 11, flight type enrichment; frame times unmeasured; unidentified white square bottom-left on phone; no deployment target; no version control.

**Commands.** In `/Users/imdadareeph/Desktop/42/kawn/kawn-app` with node 22 (`export PATH=$HOME/.nvm/versions/node/v22.22.3/bin:$PATH`): `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npm audit --omit=dev`. Key scan: grep the build and source folders for the key string; it must print nothing.

---

## 9. GEV vs Kawn at a glance

| Aspect | God's Eye View | Kawn |
|---|---|---|
| Purpose | Global OSINT globe, spy-sim look | UAE city intelligence, civic look, EN/AR |
| Renderer | CesiumJS 3D globe | MapLibre 2D + deck.gl overlays (globe in World view) |
| Imagery | Esri satellite, Google 3D, Bing (ion), OSM | Vector map only (OpenFreeMap); satellite imagery deferred pending licence |
| Looks | 7 GLSL sensor looks (CRT, NVG, FLIR...) | 5 CSS map looks (Natural, Night, Heat, Mono, Sepia); sensor skins deferred |
| Layers | ~30, 6 groups | 9 rows, 4 groups |
| Flights | OpenSky primary, adsb.lol fallback | adsb.lol + adsb.fi failover, UAE focus |
| Traffic | TomTom + OSM roads, simulated dots (cap 6,000) | TomTom tiles/corridors, simulated dots (cap 4,000), always labelled SIMULATED |
| Parking | none (road class is excluded from vehicles) | OSM supply via Overpass, no availability claim |
| Satellites | CelesTrak ~838 objects, SGP4 | CelesTrak, satellite.js, UAE satellites, follow camera |
| Voice, CCTV, ships, wind, quakes, fires | yes | not built |
| Keys in browser | Google Maps, Cesium ion | none |
| Backend | Vite plugin + large provider set | small Node broker with allow-list, rate limits, caches |

---
---

# PART B: Deep dive. Parking and satellite views

Added 2026-10-26. Parts 1 to 9 above are the overview; this part goes deep on the two topics asked for. "Satellite view" is covered in two senses: **B2 = satellite imagery as a map view** (Esri aerial in the screenshots) and **B3 = satellites as objects** (orbits, SGP4, follow) in both apps, plus **B4 = other space imagery** (NASA GIBS). Nothing in either repo was changed.

## B1. Parking in Kawn, in depth

### B1.1 What exists in code (steps 6a and 6b of /Users/imdadareeph/Desktop/42/kawn/docs/17-build-log.md)

| Piece | File | Role |
|---|---|---|
| Server box validation | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/api.mjs` `clampParkingBox` | Accepts lat 22 to 26.5, lon 51 to 57 (UAE and surrounds), south<north, west<east, each side ≤ 0.06°. Snaps the box **outward** to a 0.01° grid using integer maths (`Math.round(v*1e6)/1e4/100`) so floats cannot drift. Result can be up to 0.07° wide. Returns `null` → HTTP 400 `{error:'bad_query'}` |
| Overpass query | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/api.mjs` `fetchParking` | `[out:json][timeout:25];(nwr["amenity"="parking"](bbox);nwr["amenity"="parking_space"](bbox););out center tags;` One query returns lots (`amenity=parking`) and single bays (`parking_space`) as nodes, ways and relations; `out center` gives a point for ways and relations |
| Mirrors | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/api.mjs` `OVERPASS` | `overpass-api.de` then `overpass.kumi.systems`; fixed hosts, `redirect:'error'`, 40 s timeout (raised from 25 s in the build log), 8 MB cap, descriptive User-Agent with the brand slug |
| Budget | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/api.mjs` `spendParking` | One upstream call spends one unit; default **300 per UTC day** (`<BRAND>_PARKING_DAILY_BUDGET`, 0 = unlimited). Budget hit → HTTP 429 `{error:'budget'}` (client shows "Daily data allowance used up") |
| Bad-run guard | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/api.mjs` `fetchParking` | Overpass signals a timeout or out-of-memory as HTTP 200 with a `remark` string. That is treated as failure and never cached as "no parking here" |
| Cache | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/api.mjs` `getParking` | Key = snapped box. Fresh 24 h (`PARK_TTL_MS`) → `state:'live', cache:'hit'`. On upstream failure, a saved copy up to 7 days (`PARK_STALE_MS`) is served with `state:'stale'`. In-flight requests for the same key are coalesced |
| Normaliser | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/api.mjs` `normalizeParking` | Keeps only `amenity=parking|parking_space` with finite coordinates and element type node/way/relation. Output id `osm-n123`, `osm-w123`, `osm-r123` (safe in share links) |
| Client feed | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/parking.ts` `ParkingFeed` | State machine, fetch on camera settle, overlap skip, cap 4,000 kept sites |
| Drawing | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/deck-layers.ts` ~231-252 | deck.gl `ScatterplotLayer`, pickable, selected ring |
| Card | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/ui/cards.ts` `parkingCard` | Type, capacity, fee, access, source, fetched age, SUPPLY ONLY badge, hint, share button |
| District use | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/data/district-brief.ts` `parkingNear` | District brief shows parking supply within `PARKING_RADIUS_KM` = 1 km (haversine count of shown sites), or "out of coverage" / off |

### B1.2 Response contract (`GET /api/parking?south&west&north&east`)

A GeoJSON `FeatureCollection` plus honesty fields:

```
type: FeatureCollection
source: "OpenStreetMap"          license: "ODbL"
attribution: "© OpenStreetMap contributors (ODbL)"
fetchedAt, bbox (snapped)
supplyOnly: true                 availability: "not_provided"
note: "Parking supply from OpenStreetMap. This is where parking is mapped, not live availability."
counts: { total, hiddenByDefault, capacityTagged }
capacityTaggedShare: 0..1        state: "live" | "stale"      cache: "hit" | ...
features[]: Point [lon,lat], properties:
  id, element (lot|space), kind, capacity (int>0 | null), fee (yes|no|unknown),
  access (public|private|customers|other), hideByDefault, name (≤120 chars | null),
  source, license
```

Tag mapping rules: `capacity` only if the tag is a plain integer 1 to 6 digits (so "unknown" or "50-60" → null); `kind` from `parking=*` (surface, multi-storey, underground, street_side; `lane`, `on_kerb`, `half_on_kerb` fold into street_side; anything else `other`; untagged is never guessed); `access` from `access=*` (yes/public/permissive → public; private; customers; absent → public; other values → other); `hideByDefault = access is private or customers`.

### B1.3 Client behaviour step by step

1. User switches the **Parking** row on (off by default, letter `p` in share links). `ParkingFeed.setEnabled(true)` → `cameraSettled(0)`.
2. If `zoom < 14` (`PARKING_MIN_ZOOM`): abort any request, state **idle**, row shows IDLE "Zoom in to see parking". (Screenshot 1: zoom 3 km scale → IDLE.)
3. Else after a 450 ms debounce: skip if the tab is hidden; `clampViewBox` shrinks the view to a box at most 0.05° per side, centred on the view; **overlap skip**: if the new box lies entirely inside the last fetched box and state is live/stale, no request, just redraw.
4. Otherwise abort the previous request, set **loading**, `fetch('/api/parking?...')` with `AbortController`.
5. Errors: HTTP 429 with `error:'budget'` → reason budget; 429 otherwise → rate_limited; other non-OK → upstream; network failure → network. State **unavailable** with that reason.
6. Success: `parseSites` revalidates every feature (id must match `^osm-[nwr]\d+$`, numeric capacity only if > 0, enumerations coerced to safe values), merges into a Map by id (so panning accumulates), evicts oldest beyond 4,000, computes `count`, `hidden` (hideByDefault) and `fetchedAt`.
7. Drawing uses `visibleParking()` = sites with `hideByDefault === false`. Private and customers-only sites are counted but not drawn.
8. Turning the layer off clears the map of sites, the timer and any request.

**Marker size (`parkingRadius`)**: capacity null/invalid → **4 px**, grey `[140,152,168]`, outline 0.8 px. Capacity c → `clamp(round(3 + sqrt(c)/2), 5, 13)` px, theme blue (dark `[122,167,255]`, light `[42,85,214]`, contrast `[158,192,255]`), outline 1.5 px. Examples: 50 bays → 7 px; 400 → 13 px (cap). Only ~3.6 % of Dubai OSM lots carry capacity, so most markers are small grey dots; the build log notes markers are faint on the dark map (known gap).

**Row text by state** (`layerRow`): IDLE; LOADING "Loading known parking sites"; ON "SUPPLY ONLY · N sites from OpenStreetMap · availability not provided" plus "· M private or customers-only sites hidden"; STALE "Saved copy, upstream unreachable · SUPPLY ONLY"; UNAVAILABLE budget "Daily data allowance used up. Try again later." / busy "Too many requests. Try again shortly." / "Parking data unreachable". World view forces IDLE "Switch to city view".

**Card (tap a marker)**: header = site name or "Unnamed parking" with subtitle "Parking"; badge SUPPLY ONLY; rows Type, Capacity ("unknown" dim when null), Fee, Access, Source (OpenStreetMap), Fetched (age); hint "Supply from OpenStreetMap, not live availability"; Share button. Tap-pick was not verified in headless tests (owner to click in a real browser).

**Measured result** (build log step 7 final check): Dubai Mall at zoom 15 loaded **49 sites**, "11 private hidden", first load slow (cold Overpass).

### B1.4 Honesty model (design in /Users/imdadareeph/Desktop/42/kawn/docs/13-parking-spot-feature.md)

- Real-time bay or lot occupancy for Dubai exists only inside operators' systems: Parkin (AI cameras announced May 2026, 500+ curb/pole units first phase), RTA in-ground sensors (about 2,000, Al Rigga and WTC, older report), malls' own apps. No public API found for any of them. TomTom Parking Availability lists UAE but is sales-only. HERE on-street is automotive-only. Parkopedia: contact only.
- Open government data (Dubai open-data site) gives static RTA tables: tariff by zone/hour, spaces per zone (CSV, 2025 and an older 2017 mirror), parking-area KML. Not real time.
- OSM Dubai box count on 2026-10-17 (24.75-25.40 N, 54.85-55.65 E): 4,093 `amenity=parking` (3,658 ways, 406 nodes, 29 relations), 146 with capacity, 858 with fee, 275 `parking_space`.
- Rules: three truth levels **LIVE** (operator feed + age), **ESTIMATED** (model, band only), **UNKNOWN** (supply only). Free-space numbers only for LIVE. Never show an estimate as live.
- Planned marker language: Available green + check, Limited amber + half-fill, Full red + cross, Unknown grey plain "P"; estimated markers use a dashed ring and "~"; state never by colour alone.
- Phases: **0 supply (built)** → 1 ESTIMATED four-level band from hour-of-week curve per area class, tariff regime (paid hours, Friday/holiday), event calendar, small weather adjustment, capacity prior used only for confidence → 2 clustering, street-side lines from `parking:left/right/both`, arrival-time slider, opt-in "nearest" (browser-only distance), a11y audit → 3 one licensed live feed behind the server with budget + kill switch, STALE → ESTIMATED fall-through. Navigation hand-off sends destination only (Google/Apple Maps URL, no origin) so user location never reaches Kawn.
- Privacy: no plate data, no camera processing (CCTV and plate readers are on Kawn's "skipped by design" list). Server logs keep only snapped grid cells.
- Tests exist in `/Users/imdadareeph/Desktop/42/kawn/kawn-app/tests/parking.test.ts`: grid snap, 400 cases, normalisation, cache hit = 1 upstream call, mirror fallback, stale-on-error, sanitised 502, budget 429.

### B1.5 What the original (GEV) does about parking

Nothing. Parking is only a road category excluded from vehicle simulation, and the original runs no vision on camera frames (explicitly no object/face/plate recognition). Its only parking-adjacent ideas that Kawn borrowed are technique-level: viewport fetch after settle, overlap skip, per-tile cache with in-flight coalescing, daily budget with kill switch, four distinct outcome states (empty, unavailable, transient, throttled). So Kawn's parking layer is new work, and its "simulation" is only the vehicle layer in section 6.1.

### B1.6 Parking: gaps and next steps (from handoff and /Users/imdadareeph/Desktop/42/kawn/docs/13-parking-spot-feature.md)

Faint markers on dark theme; tap-pick unverified headless; no estimator yet; tariff table not loaded; ODbL attribution must show while the layer is on; licensing and agreement work (Parkin, RTA, TomTom trial) still open owner item 6.

---

## B2. Satellite imagery views (the map basemap) in GEV, in depth

### B2.1 Imagery stack and how it is chosen

| Layer in the scene | Provider | Max detail seen | Where |
|---|---|---|---|
| Base globe imagery | **Esri World Imagery** (`ArcGisMapServerImageryProvider.fromUrl(.../World_Imagery/MapServer)`, `enablePickFeatures:false`) credit "Powered by Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community" | GSD 0.16 m at 377 m altitude (shot 27), 0.38 m at 970 m (shot 20) | all shots except any with Google 3D |
| Alternative | Bing aerial (+labels) via Cesium ion endpoint, forced to HTTPS | not shown | greyed without `CESIUM_ION_TOKEN` (screenshot 5) |
| Alternative | Google Photorealistic 3D tiles | not shown | key/token needed |
| Fallback | OSM raster | not shown | automatic if Esri unreachable |
| Terrain | Cesium world terrain (ion) or keyless terrain (a source that returned 429 under load in tests) | – | `/Users/imdadareeph/Desktop/42/gods-eye-view/src/maps/terrain.js` |
| Optional overlay | NASA GIBS via Recent Imagery layer | 30 m (HLS) / ~250 m (VIIRS) | OFF in every shot |

Controller: `/Users/imdadareeph/Desktop/42/gods-eye-view/src/maps/controller.js` swaps imagery layers and terrain per selected stack; `/Users/imdadareeph/Desktop/42/gods-eye-view/src/mapStackChips.js` renders the chips and the "Needs CESIUM_ION_TOKEN" tooltip; `/Users/imdadareeph/Desktop/42/gods-eye-view/src/maps/availability.js` decides why a chip is unavailable. Attribution in the footer reads "CESIUM ion · Powered by Esri · © OpenStreetMap · Data attribution" and adds "© OpenMapTiles" when airport detail layers are in view (shots 27, 28).

### B2.2 Each satellite view in the 36 screenshots, with what it demonstrates

Values are the HUD readouts printed on each frame (ALT = camera altitude, GSD = ground sample distance per pixel, NIIRS = image-interpretability rating, SUN = elevation).

| # | View | Camera | HUD readout | Imagery character |
|---|---|---|---|---|
| 01, 02 | London from orbit-ish height | top-down, centre 51°30′N 0°01′E | ALT 35,830 m, GSD 13.45 m, NIIRS 1.2 | Esri, dark vignette from Scope; river and city fabric legible; CCTV mesh and data-centre labels sit on top |
| 03-05 | NVG / FLIR / CRT of the same London frame | same | same, sliders per look | Looks are screen-space shaders over the same Esri tiles: NVG green phosphor + scanlines, FLIR greyscale thermal-like with "Ironbow" param, CRT amber with scanline texture and instability |
| 06-08 | Flights/vessels, scope feather 0, sats-cables-quakes | same | same | Same tiles; layers change, not imagery |
| 09 | Celestial view | ~24,941 km, whole disc | GSD 9,352.9 m, NIIRS 0.0 | Blue-marble-style globe (low-res), submarine-cable lines, radio and CCTV clusters, quake labels M2.7 to M5.6, orbit ring and labels (BEIDOU-3 IGSO-1) |
| 11, 12 | Dubai search then oblique | ~49 km, pitch tilted, "TILTED VIEW" | ALT 49,312 m, GSD 18.48 m, NIIRS 0.7, 24°31′N 55°13′E | **Hero shot.** Palm Jumeirah, The World, coastline bathymetry colour; cyan lines are flight tracks; data-centre pins (Equinix DX1, Khazna) |
| 13 | Anime look, Dubai | same | same | Edge-thickness 0.50 + saturation 1.0 posterise the Esri tiles; sea becomes black/teal flat |
| 14, 15 | Noir, Snow look | same | same | Noir high contrast greyscale; Snow desaturates + animated snowflakes (density 0.6, wind 0.5) |
| 16 | Snow + Wind, Dubai flights | same | same | Callsign labels (ABY369 FL081, UAE2AY FL042, FALCON06 ...) with detection brackets |
| 17, 19 | Operator and Cyber HUD | – | – | HUD variants only |
| 20 | Roof level | ALT 970 m, GSD 0.38 m, NIIRS 6.3 | 51°36′37″N 0°16′15″W (north London suburbs) | Individual houses, gardens, rail lines, cars readable; the sharpest generic Esri detail used. /Users/imdadareeph/Desktop/42/gev/FEATURES.md: at ~108 m tiles stayed blank → stop near ≥ 500 m |
| 22 | Burj Khalifa downtown | ALT 1,772 m, GSD 0.65 m, NIIRS 5.6 | 25°10′47″N 55°15′22″E | Oblique with long tower shadows baked in the image (not 3D tiles): Sheikh Zayed Road, Downtown, Dubai Fountain lake; Live Flights FALLBACK 247 aircraft |
| 23 | Dubai coast + flights | – | – | Coast, aircraft glyphs |
| 24 | Heathrow from 21 km | ALT 21,077 m, GSD 7.92 m, NIIRS 2.0 | 51°28′N 0°27′W | Airport complex, reservoirs, data-centre pins; note tile **blur/stitching** at low LOD on the left edge |
| 25 | Contacts roster | – | – | Operator HUD exposes CONTACTS tab |
| 26, 29 | Tracked aircraft BAW615 / UAL935 | low oblique | – | Cyan trail, label "BAW615 · 1700 ft · 81 kts · British Airways Airbus A320 · BDS → LHR" |
| 27 | Touchdown | ALT 377 m, GSD 0.16 m, NIIRS 7.6 | 51°27′41.97″N 0°26′13.51″W | Taxiways and apron aircraft readable; cyan 3D A320 model replaces the glyph near the camera ("LOAD FAILED" chip because a feed lagged) |
| 28 | Rollout, straight-down | ALT 532 m, GSD 0.22 m, NIIRS 7.2 | "STRAIGHT-DOWN VIEW" toast | Runway markings; aircraft heading cyan, 3 nearby contacts with bearing/course tags |
| 30, 31 | Draw area (orange quad) | ALT 642 m, GSD 0.26 m, NIIRS 6.9 | label "Heathrow stand area" | Terminal 5 stands inside the polygon; live measure e.g. "18.8 ha" |
| 32 | Street Level KEY REQUIRED | same | – | Layer UNAVAILABLE without a Mapillary token; credit "Street Level: imagery © Mapillary contributors, CC BY-SA 4.0" |
| 33 | Scenes panel, Cyber HUD, FLIR look | same | – | Heathrow in false-colour thermal; Scenes list: Global Incident Context, Nepal-Focused Globe Rotation, Bhote Koshi Regional ... with Capture/Update shot, Start/Stop/Next, Export/Import |
| 34-36 | Scene pullback | descending camera heights | – | Cinematic frames from the "Omniscience Pullback" scene (street → city → globe) |
| 21 | Reset Globe | 18,000 km, straight down 58°S 98°E | ALT 18,000,000 m, GSD 6,750 m, NIIRS 0.0 | Southern hemisphere disc with Antarctica and Australia; long cyan lines = aircraft/trails rising off the surface |

**Resolution ladder (from the HUD fields).** 35.8 km → 13 m/px; 21 km → 7.9 m; 1.8 km → 0.65 m; 970 m → 0.38 m; 642 m → 0.26 m; 532 m → 0.22 m; 377 m → 0.16 m. NIIRS climbs 1.2 → 7.6 over the same range. GSD and NIIRS are computed readouts for flavour, derived from altitude; they are not the imagery's true native resolution (Esri tiles cap well above 0.16 m in most places).

**Failure and limits seen:** blank tiles near 108 m, 429 on terrain under load, Google 3D never loaded, Bing unavailable without token, zoom-out unclamped with synthetic wheel events (reached 3×10¹³ m, black screen; Reset Globe fixes).

### B2.3 Looks as post-process on imagery

All looks run as GLSL over the rendered frame, not as different tiles. Parameters (as shown in screenshots): NVG gain 0.18, bloom 0.22, scanlines 0.96, pixelation 1.0; FLIR sensitivity 0.85, bloom 0.20, white/black 0.33, pixelation 1.0, ironbow 0.00; CRT pixelation 1.0, distortion 0.00, instability 0.42; Anime saturation 1.0, edge thickness 0.50; Snow density 0.60, wind 0.50; Noir contrast 1.2, grain 0.5, vignette 0.5 (capture notes abbreviate these as "c.120 g.50 v.50") (from /Users/imdadareeph/Desktop/42/gev/FEATURES.md). Switching a look auto-enables the HUD and stores the look and parameters (`sp=`) in the share link.

### B2.4 Does Kawn have a satellite imagery view?

No. Kawn is a MapLibre vector map (OpenFreeMap tiles, own styling). The decision in /Users/imdadareeph/Desktop/42/kawn/docs/25-looks-and-vehicles-observation.md §3a item 4: the map-source row shows **Streets** and **Satellite**, with Satellite **greyed/licence needed** because no free source is cleared for production and "no unlicensed tiles". /Users/imdadareeph/Desktop/42/kawn/docs/18-space-view-spec.md §14 lists free satellite imagery under the globe as a later item. GEV's own usage (Esri World Imagery) is governed by Esri terms and attribution; reusing it commercially needs a licence check, not just a URL. Kawn's look tray today has Natural, Night, Heat map, Mono, Sepia, plus themes (dark, light, contrast).

---

## B3. Satellites as objects: orbits, in both apps

### B3.1 Data pipeline compared

| Step | GEV | Kawn |
|---|---|---|
| Source | CelesTrak GP, two-line text, six core groups: stations, visual, gps-ops, glo-ops (GLONASS), galileo, geo (~838 objects) + optional **Dense** = Starlink (~10,000 points) | CelesTrak GP **JSON/OMM**, groups stations, visual, gps-ops, glo-ops, galileo, geo plus `active` filtered to a UAE watchlist (~850 objects) |
| Server | `/api/celestrak/*` proxy, server goes upstream ≤ 1 per 6 h per group, 20 s deadline, memory + disk cache, stale served | `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/orbits.mjs`: one fetch per group per **2 h** (FRESH), one request at a time with 2 s gap, stop on any non-200 with growing pause 1/2/4/6 h, 403 or 429 pauses everything, size caps 3 MB (core) / 15 MB (active), stale copy up to **7 days**, flagged stale after 6 h, max 2,000 objects out, errors never echoed, disk cache `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/.cache/orbits.json` |
| Browser refresh | every 5 min asks server | `REFRESH_MS` 30 min |
| Propagation | SGP4 in browser (satellite.js), deep-space variant for periods ≥ 225 min; fleet pass every 1 s, 200 ms while following; followed satellite every frame | `satellite.js` 7.1.0 pure-JS parts only (`/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/sat-lib.ts` imports from `dist/io.js`, `propagation.js`, `transforms.js` to avoid the WebAssembly build); lazy `initLib()` so the city bundle does not grow; `positionAt` also returns altitude km, speed km/s and **elevation above the Dubai horizon** (`OBSERVER` 25.205 N 55.271 E) |
| Classes | Station, Nav, Geo, Visual, Comms (Starlink), ISS | `iss`, `uae`, `station`, `nav`, `geo`, `visual` (priority order iss > uae > station > nav > visual > geo) |
| Failure words | unavailable / degraded (missing groups) | LIVE, DEGRADED ("Some satellites are missing (x of y groups)"), STALE, UNAVAILABLE, LOADING (+ "Taking longer than usual") |

GEV code: `/Users/imdadareeph/Desktop/42/gods-eye-view/src/layers/satellites/` (catalog.js, orbits.js, policy.js, tracking.js, rendering.js and others). Kawn code: `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/orbits.ts`, `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/orbit-layers.ts`, `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/follow.ts`, `/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/sat-lib.ts`, `/Users/imdadareeph/Desktop/42/kawn/kawn-app/server/orbits.mjs`, `/Users/imdadareeph/Desktop/42/kawn/kawn-app/shared/uae-satellites.mjs`.

### B3.2 Look of the objects

| Class | GEV colour | Kawn colour | Size px |
|---|---|---|---|
| ISS | red #ff4444, 12 px, white outline, permanent label | `[255,68,68]` red | 12 |
| Station | warm white #fff6e5 | `[255,246,229]` | 8 |
| Nav (GPS/GLONASS/Galileo) | cyan #4fd8ff | `[79,216,255]` | 6 |
| Geo | violet #c89bff | `[200,155,255]` | 5 |
| Visual/other | blue-grey #9fb3c4 | `[159,179,196]` | 6 |
| Starlink (dense) | #54697f, 90 % alpha, 3 px | not included | 3 |
| UAE national satellites | – | teal `[46,230,197]`, drawn as a **hollow ring** (so class is not colour-only) | 8 |
| Selected | yellow 14 px marker | yellow `[255,216,74]` ring, radius 9 | 9 |

Space colour behind the globe in Kawn: `[5,5,8]` (#050508). Kawn draws points with `ScatterplotLayer` (`sats`, `sats-uae`, `sat-selected`) and rings with `PathLayer` (`sat-rings`, width in pixels, `wrapLongitude`). Limits: 2,000 points desktop, 300 phone (`POINT_CAP`).

### B3.3 Orbit rings and ground track (the trick)

Both bake **one orbital period** into **181 points (180 steps)** evenly spaced in time, `period = 86,400 / revolutions-per-day` seconds.

- **Ring (inertial loop).** All 181 samples are converted to lat/lon with ONE frozen Earth angle (`gmst0`), so the loop closes. Otherwise it drifts west about 24° per day-of-period. The last point is forced equal to the first (the raw gap is real orbital decay and precession in one period). Once per second the whole ring is rotated about the polar axis by the change in Earth angle since baking, so it stays locked to the satellite without re-propagating.
- **Ground track.** `bakeGroundTrack`: each sample uses its **own** Earth angle and altitude 0, so it is the true path over the surface for the next orbit; it does not close. Kawn draws it teal `[96,224,200]`, width 3; ISS ring red width 2.5; selected ring yellow width 2. Note shown to users: "The teal line on the surface is the ground track of the next orbit, estimated." (GEV has no ground track.)
- Rings exist only for ISS and the selected satellite.

### B3.4 World view (Kawn) and Celestial (GEV)

- **GEV Celestial** button: camera to ~24,900 km (shot 09), whole disc, everything on at once; **Reset Globe**: 18,000 km straight down over 2.8 s (shot 21). Atmosphere halo always on; stars and Sun/Moon from the engine; clock frozen at load, no terminator.
- **Kawn World** (/Users/imdadareeph/Desktop/42/kawn/docs/18-space-view-spec.md): opt-in, never default. Button switches MapLibre to `globe` projection (not `vertical-perspective`; deck.gl's mapbox overlay throws "Unsupported projection" for anything but globe/mercator), lowers min zoom to ~1.2, flies to UAE centre 55.3 E, 25.2 N at zoom ≈ 2.3 (≈ 18,000 km) over 2.8 s (instant if reduced motion); auto-exits when zoom passes **6.5** (`WORLD_AUTO_EXIT_ZOOM`, hysteresis: re-entry only by the button). City deck layers (flights, parking, traffic) show "Zoom in to the city" while in World. Sky: space #050508, horizon ~#3a6ea5, `atmosphere-blend` 1 at zoom ≤ 2.8 fading to 0 by 6; stars optional seeded canvas behind the map; no day/night terminator in v1.

### B3.5 Select and follow

| | GEV | Kawn (`/Users/imdadareeph/Desktop/42/kawn/kawn-app/src/layers/follow.ts`) |
|---|---|---|
| Pick | Click dot; camera locks at offset 450 km W, 450 km S, 350 km up (≈ 726 km); ×4 above 2,000 km altitude | Click dot → fly to and follow; zoom clamps `FOLLOW_ZOOM_MIN 1.3` to `MAX 5.5`; view height = `HEIGHT_PER_ALT 4 ×` altitude, clamped 1,600 to 44,000 km (`followHeightKm`, `followZoom`) |
| Exit | Esc, empty click, or follow something else | Modes `off → flying → on → paused → off`; user gestures (drag, rotate, pitch, zoom beyond `ZOOM_OUT_TOLERANCE 0.15`) pause follow (`breaksFollow`); **Resume** and **Stop** chip; lost-fix timeout `LOST_FIX_MS` 5 s |
| Card | Name, class line (NAV · GPS / STATION · ISS), "altitude km · catalogue number"; sat within 2 km listed as docked | `satCard` rows: catalogue no., altitude km, speed km/s, period min, inclination, sub-point lat/lng, position basis (computed, ESTIMATED badge), element age (STALE badge if old), source; hints for ground track, licence and safety |
| Share | followed sat by catalogue number | share letter `o` for orbits, `w` world; follow id validated |
| Not in either | time scrub, footprint, day/night; GEV also lacks search/hover names; Kawn lists search/hover and passes table as **not built** (handoff) |

Passes: GEV computes passes for voice/tool only (20 s steps to threshold elevation 10°, 10 bisections, 5 s walk to peak, parabola refine; "visible" needs satellite sunlit by a cylindrical Earth shadow R = 6,371 km while Sun ≤ −6°). Kawn specs a passes table over Dubai (/Users/imdadareeph/Desktop/42/kawn/docs/18-space-view-spec.md §9.1) but it is not built.

### B3.6 UAE satellite watchlist (Kawn, `/Users/imdadareeph/Desktop/42/kawn/kawn-app/shared/uae-satellites.mjs`)

MBZ-SAT 62626, KhalifaSat 43676, DubaiSat-2 39419, DubaiSat-1 35682, Etihad-SAT 63226, Thuraya-4 62483, Thuraya-3 32404, Thuraya-2 27825, Al Yah 3 43174, Yahsat 1A 37393, Yahsat 1B 38245. Matched by name against CelesTrak "active" on 2026-10-17; **UNVERIFIED** against an official list; Arabic names need native review.

### B3.7 Honesty text (Kawn)

Row meta when on: "ESTIMATED · computed from public orbital elements · elements {age} old · {n} objects". Every position is computed on-device, so the word ESTIMATED is permanent. Stale: "STALE · orbit data is {age} old. Retry later."

---

## B4. Other space imagery in GEV: Recent Imagery (NASA GIBS)

A separate layer (row "Recent Imagery · NASA GIBS · HLS + VIIRS", OFF in all shots). Keyless, browser-direct. Code: `/Users/imdadareeph/Desktop/42/gods-eye-view/src/layers/recentImagery/` (model.js, source.js, rendering.js, catalog.js).

| Product | Sensor | GIBS layer | Notes |
|---|---|---|---|
| HLS S30 | Sentinel-2 via HLS | `HLS_S30_Nadir_BRDF_Adjusted_Reflectance` | 30 m; granule search via NASA CMR; shows scene cloud % |
| HLS L30 | Landsat 8/9 via HLS | `HLS_L30_Nadir_BRDF_Adjusted_Reflectance` | 30 m |
| VIIRS | NOAA-21 | `VIIRS_NOAA21_CorrectedReflectance_TrueColor` | daily global mosaic, no granule catalogue (one candidate per UTC day) |

Tile URL pattern: `https://gibs-{s}.earthdata.nasa.gov/wmts/epsg3857/best/<layer>/default/<YYYY-MM-DD>/GoogleMapsCompatible_Level<maxLevel>/{z}/{y}/{x}.<format>` (y before x in GIBS paths). Web-Mercator limit applies. The layer mounts two slots (`a`, `b`) with alpha and a left/right split for before/after comparison; candidate ordering: newest day first, then S30, L30, VIIRS; "START HERE" picks the best-covered recent day (coverage first, then low cloud; falls back to a VIIRS overview). Card text example: "Sep 18, 2026 17:12Z · 3 days ago · Sentinel-2 via HLS · 30 m · 12% scene cloud". Used by scenes such as the Nepal flood replay (before/after imagery; bundled flood data is non-commercial).

Kawn: not built; /Users/imdadareeph/Desktop/42/kawn/docs/18-space-view-spec.md §14 lists "free satellite imagery under the globe" as later work, to be checked for licence and for UAE aerial-imaging rules (open item in /Users/imdadareeph/Desktop/42/kawn/docs/13-parking-spot-feature.md §7).

---

## B5. Summary of what each app really does for "satellite"

| Question | GEV | Kawn |
|---|---|---|
| Satellite photo basemap? | Yes: Esri World Imagery default, Bing/Google with a token, OSM fallback | No (vector map; Satellite chip greyed, licence needed) |
| Highest imagery detail demonstrated | 0.16 m GSD readout at 377 m (shot 27) | n/a |
| Satellite objects? | ~838 (+ Starlink dense), SGP4, rings, follow | ~850 incl. UAE list, SGP4, rings, ground track, follow |
| Space imagery overlays? | NASA GIBS (HLS 30 m, VIIRS) | none |
| Parking? | none | OSM supply layer, SUPPLY ONLY, no availability |
| Anything faked? | Traffic dots simulated; ISS/sat positions computed, not live telemetry; HUD "TOP SECRET" text cosmetic; GSD/NIIRS readouts derived from altitude | Car dots simulated and labelled; orbits ESTIMATED; flights live; parking supply real but not occupancy |
