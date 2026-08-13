# Paria Canyon Trip Map — Project Context

## What this is

A custom interactive trip artifact for a Paria Canyon backpacking trip (April 2026). The goal is something onX can't produce: a personal, shareable map with your photos, your story, and your styling — that you own end-to-end.

**Live at https://paria.jon.bo** — pure static site on Cloudflare Pages (project name `paria-2026`), deployed via `./deploy.sh`. No framework, no build step, no npm dependencies; plain HTML + JS + JSON.

## The trip

- **Route**: White House Trailhead → Paria Canyon → Lees Ferry
- **Distance**: ~38 miles, south-southwest through the Paria Canyon–Vermilion Cliffs Wilderness
- **Note**: Trip included a short excursion up Buckskin Gulch from the trailhead area, but the main route follows the Paria River canyon
- **Dates**: April 4–8, 2026 (based on GPX timestamps)

## Architecture

`content.json` is the **single source of truth**. Everything the site renders (captions, dates, locations, video paths, people) comes from it. It is edited via the local editor — never regenerate it once edits exist.

```
photos/            media originals + transcoded .mp4s (gitignored, rsynced into dist/ at deploy)
   │   one-time import: node build_content.js   ⚠️ OVERWRITES content.json
   ▼
content.json       THE source of truth — people{}, photos[] with captions/locations/routeFrac
   ├── editor.html  ⇄  serve.js (/api/content)    local read/write editor
   ├── paria-trip-map.html                         desktop map — deployed as index.html
   └── mobile.html                                 phone experience (photo-first, no map)
```

## Files

| File | Purpose |
|---|---|
| `paria-trip-map.html` | The desktop map. Fetches `content.json` (cache-busted) → `window.TRIP_CONTENT`. Redirects phones to `mobile.html` (see Mobile). Deployed renamed to `index.html`. |
| `mobile.html` | Phone-only, photo-first experience: overview card, gallery grid, caption slideshow. Reads the same `content.json` and `photos/web/` downscaled copies. |
| `editor.html` | Local content editor: card grid of all media — edit caption, photographer, captionAuthor, coreTrip; delete entries; add photos from `output/`; search + core/extra filter. Save POSTs to `serve.js`. |
| `serve.js` | Local dev server (plain Node, no deps). Static files **plus** `/api/content` GET/POST (with timestamped backup to `content-backups/` on every save), `/api/images` (lists `output/`), `Cache-Control: no-store` on content.json, and HTTP range support (Safari video requires 206 responses). Run it — not wrangler — for local dev. |
| `content.json` | Source of truth (see schema below). |
| `build_content.js` | ⚠️ **One-time importer only.** Seeds `content.json` from `photos/trip/<person>/` + `captions.json` + EXIF + the iCloud scrape in `output/`. Re-running **wipes all editor edits**. |
| `resize_photos.js` | Generates `photos/web/` downscaled copies (1600px longest edge, JPEG q82) via macOS `sips`. Idempotent; `--force` rebuilds all. Runs automatically inside `deploy.sh`. |
| `deploy.sh` | Stages `dist/` (map as `index.html`, `mobile.html`, `content.json`, `photos/` minus raw `.mov`) then `wrangler pages deploy dist --project-name paria-2026`. The only deploy path. |
| `onx-markups-05052026.gpx` | onX export of the actual GPS track (3,517 points). Gitignored (`*.gpx`). |
| `photos/trip/{person}/` | One subdirectory per photographer with their media + `captions.json`. Note: `captions.json` files are now **import-time inputs only** — live edits happen in `content.json` via the editor. |
| `photos/trip/cover.jpeg` | Cover image asset (title-lander use is still a todo). |
| `export-photos.applescript` | Exports originals from Photos.app into `photos/`. |
| `scrape_album.py` / `scrape_album.md` | iCloud shared-album scraper → `output/paria_2026_album.json` (UUIDs, fallback dates, iCloud-caption flags). One-time input to `build_content.js`. |
| `output/` | Scraped album data + downloadable image pool for the editor's add-photo picker. Gitignored. |
| `content-backups/` | Timestamped `content.json` backups, written by `serve.js` on every save. Gitignored. |
| `wrangler.toml` | `name = "paria-2026"`, `pages_build_output_dir = "."` — but deploys go through `deploy.sh` (which passes `dist/` explicitly). |
| `todos.md`, `plans/` | Working notes / design ideas. Gitignored. |

### Workflow

```bash
# Local dev (map + editor):
node serve.js
#   Map:    http://localhost:8080/
#   Editor: http://localhost:8080/editor.html

# Edit in the editor → Save → refresh the map. That's the loop.

# Deploy:
./deploy.sh        # → https://map.jon.bo

# Sanity-check the exact deploy bundle locally (static-only; editor Save will 404):
wrangler pages dev dist
```

## content.json schema

```json
{
  "people": { "gary": { "name": "Gary" }, "...": "…" },
  "photos": [
    {
      "id": "9CDF2495-…",                      // iCloud UUID, or "<person>-<filestem>" fallback
      "image": "photos/trip/gary/IMG_0208.jpeg", // videos point at the transcoded .mp4
      "originalFilename": "IMG_0208.jpeg",       // .mov name kept here for videos
      "isVideo": false,
      "photographer": "gary",                    // folder owner
      "caption": "This is Donnie's America…",
      "captionAuthor": "gary",                   // defaults to photographer; differs → credited separately
      "coreTrip": false,                         // false = "extra" (pre/post-trip, e.g. Lee's Ferry gear explosion)
      "location": { "lat": 36.865622, "lng": -111.589011 },
      "routeFrac": 1,                            // 0–1 position along the route (Haversine snap)
      "dateCreated": "2026-04-04T13:12:32.000Z", // ISO UTC instant
      "_icloudCaption": true                     // had a caption in the shared iCloud album
    }
  ]
}
```

**Current contents**: 30 items (28 photos + 2 videos) — Gary 13, Jon 8, Lauren 6, Maggie 3. Two are `coreTrip: false` extras. Sorting/numbering is derived at render time from `dateCreated` (UTC), not stored.

## Tech stack

- **MapLibre GL JS** (v4.7.1) — open-source map renderer, native 3D terrain
- **MapTiler** — topo basemap (`topo-v2`), terrain-RGB elevation tiles, satellite raster tiles
- **Cloudflare Pages** — static hosting via `wrangler pages deploy`; custom domain `map.jon.bo`
- **exiftool** — used by `build_content.js` (import-time only) for EXIF GPS + timestamps
- **sips** (macOS built-in) — used by `resize_photos.js` for web-sized copies
- **ffmpeg** — manual video transcode (`.mov` → H.264 `.mp4`, `+faststart`; Pages' 25 MB/file limit)

Why this combo: free/open renderer, free-tier tiles, zero framework dependencies, and the whole thing is a handful of static files any static host could serve.

## Map features

- 3D terrain at 1.5× exaggeration (slot canyon walls read clearly)
- **Satellite imagery layer** (MapTiler `tiles/satellite` raster, opacity 1.0, default on) with toggle
- Topo basemap + extra hillshade layer for depth; satellite inserted above hillshade so route/labels render on top
- Desert sky/fog palette
- Route line with shadow, drawn from real GPS track
- Photo markers numbered sequentially in chronological order across all photographers
- Photographer colors: Gary `#e8a020` amber, Lauren `#2bb5a0` teal, Maggie `#b55ad0` purple, Jon `#4a9fd0` blue; unknown people fall back to `#d85a30`. Shown on map markers, elevation chart squares, right-panel dot.
- Map markers are **circle icons only** — no popup thumbnails or captions on the map itself
- Clicking a pin triggers a faster 1.4s fly to that marker and loads it in the right panel
- Active marker highlights (white fill, colored border)
- **Hamburger menu** (top-left, frosted-glass) — Overview, Toggle 3D, Satellite
- **Cinematic camera navigation** — Next/Prev fly between photos with auto-computed bearing (faces direction of travel), 2.2s transition
- **Interstitial notes** — authored photo-less narrative beats (the `INTERSTITIALS` const). Spliced in after a given 1-based photo number (`after: 2`); real photo ids assigned before splicing so notes never renumber them. Camera parks at the lng/lat midpoint of neighbors, zoomed out (`camZoom/camPitch/camBearing`). No map marker (null hole in `markers[]` keeps index alignment); hollow dashed elevation-chart square; right panel shows a note card. String ids (`n1`, …), always survive filtering, don't count in photo totals. Currently one note: `n1` "The Shuttle" after photo #2.
- **Deep links** — `?photo=N` (display number) or `?photo=n1` (note id) skips the intro and lands on that stop.
- **Per-photo viewpoint tuning** — "Viewpoint" row in the right panel. Set captures `{ lng, lat, zoom, pitch, bearing }` from live map state; ✕ resets to auto. Persisted in `localStorage` under `paria-viewpoints`. `stepTo()` prefers the saved viewpoint, else auto-computes (direction-of-travel bearing, z13.5, p65).
- **Core/extra toggle** — `coreTrip: false` entries ("extras", e.g. pre-trip Lee's Ferry) can be hidden via a toggle button (`showExtra`).
- **People filter** — plumbing exists (`getFilteredPhotos()`, `initPeopleFilter()`, interstitials always pass), but the `<select>` UI is currently **disabled with a "coming soon" tooltip**.
- **Videos** — rendered inline in the right panel via `<video controls playsinline loop muted>`; the lightbox is image-only. Videos are skipped where a still is required (e.g. preload).
- **Debug panel** (`d` key) — live lng/lat, zoom, bearing, pitch + active photo EXIF bearing (now always 0 — see Data).

### Mobile redirect

An inline `<head>` script in `paria-trip-map.html` sends phones to `mobile.html`, preserving query/hash (deep links survive). Detection uses `min(screen.width, screen.height) ≤ 768` **and** `pointer: coarse` — layout-independent signals, because the old `matchMedia(max-width:768px)` raced the viewport meta on iOS. `?desktop` in the URL is the escape hatch to force the full map on a phone.

### Photo sizing (performance)

The right panel loads downscaled copies via `webSrc()` (`photos/…` → `photos/web/…`); full-res 12MP JPEGs decoded in ~1s and stalled transitions. The lightbox still loads originals. Falls back to the original if a web copy is missing (e.g. photo added in the editor before `resize_photos.js` re-runs — deploy.sh runs it automatically).

## Right panel

Three-section flex column (`overflow: hidden` on the panel; only the body scrolls):

- **`.rp-top`** (fixed) — Paria Canyon header + media thumbnail (img, or video player)
- **`.rp-body`** (scrollable, `flex: 1`) — title, person, date, caption, viewpoint row
- **`.rp-footer`** (fixed) — Prev/Next + progress counter (`X of Y`)

Per-photo display:
- **Title** — text before ` - ` in the caption
- **Person** — title-cased photographer; **captionAuthor** credited separately only when it differs
- **Date · Time** — derived from `dateCreated` via `fmtMDT()` (UTC → MDT display)
- **Caption** — full text, color `#999`

### Media thumbnail
- Container `aspect-ratio: 16/9`, background `#161616`; `object-fit: contain` (no cropping; portrait letterboxes)
- **Click to open lightbox** (images) — fullscreen overlay, 0.25s opacity fade; close via ✕, backdrop click, or Esc

## Layout

Two-column flexbox:

```
┌──────────────────────────────────────┬─────────────────┐
│  [≡] hamburger (top-left)            │  header         │
│                                      │  photo (16:9)   │
│         MAP (flex: 1, ~50%)          ├─────────────────┤
│                                      │  title          │
│                                      │  person · date  │
├──────────────────────────────────────┤  caption        │
│  ELEVATION STRIP (160px tall)        │  viewpoint row  │
│  canvas: time bg + ele line          ├─────────────────┤
│  + photo squares + hover             │  ← Prev  Next → │
│                                      │  X of Y         │
└──────────────────────────────────────┴─────────────────┘
```

- Map column: `flex: 1; min-width: 0` — required for MapLibre to size correctly inside flexbox
- Right panel: `flex: 0 0 50%; min-width: 280px`
- Elevation strip is a sibling div below the map, not an overlay

## Data

**Route**: Downsampled from 3,517 raw GPS points to ~155 waypoints. Stored inline in the map HTML as a GeoJSON LineString, and duplicated in `build_content.js` for `routeFrac` computation (Haversine snap to nearest waypoint → cumulative arc-length fraction).

**Elevation profile**: `[route_fraction, elevation_meters, local_hour_MDT]` — 154 points from GPX `<ele>`/`<time>`. Day transitions (camps) detectable where `hour` drops >2 between adjacent points: fracs ~0.3308 (end Day 1), ~0.6653 (end Day 2).

**Photo markers**: `loadPhotos()` reads `window.TRIP_CONTENT.photos`, maps each entry, sorts by `dateCreated` (UTC), assigns sequential ids, then splices in interstitials. Resolved entry:

```js
{ id, person, color, captionAuthor, captionAuthorColor, lng, lat, date, time,
  title, caption, img, isVideo, bearing: 0, routeFrac, sortKey, extra }
```

Note `bearing` is hardcoded `0` now — `build_content.js` imports only GPS lat/lng and time tags (`GPSDateTime` > `DateTimeOriginal`+`OffsetTimeOriginal` > QuickTime `CreationDate` > scrape date), **not** `GPSImgDirection`. The old EXIF-bearing experiment ended with the viewpoint-tuning system; the debug panel's bearing readout is therefore vestigial unless the import is extended.

**Timezone handling**: all times stored as ISO UTC instants; displayed via `fmtMDT()` (UTC−6). Import-time saga (for context): the trip crossed UT/AZ — Gary & Maggie's phones stayed on MDT, Lauren's switched to MST mid-trip (4 photos 1h behind), Jon's was MST throughout. `GPSDateTime` (always UTC) was the authoritative fix; all displayed times are MDT.

**Trip timing** (local MDT, UTC-6):
- Day 1 (Apr 4): 11:21am – 7:24pm
- Day 2 (Apr 5): 9:16am – 5:35pm
- Day 3 (Apr 6): 9:28am – 4:05pm
- Total: 33.5 miles, elevation 955m–1396m (3,133–4,580 ft)

## Videos

- Source `.mov` files are transcoded manually to H.264 `.mp4` (`+faststart`, see README for ffmpeg recipes) to stay under Cloudflare Pages' 25 MB/file limit.
- `content.json` points at the `.mp4`; `originalFilename` keeps the `.mov` name; raw `.mov` is excluded from deploys (`deploy.sh` rsync `--exclude`).
- `build_content.js` treats a `.mov`+`.mp4` pair as one item (the `.mp4` is a derived asset).
- `serve.js` implements HTTP byte ranges because Safari video requires 206 responses; Cloudflare Pages handles this itself in production.

## What was ruled out (and why)

| Option | Why skipped |
|---|---|
| Paper maps (Nat Geo #859) | Great reference, wrong shape for a digital artifact |
| Avenza/Apogee digital quads | Locked to their app, no customization |
| Raw USGS GeoTIFFs | Free and authoritative, but requires hand-tiling rasters |
| USGS 1m LIDAR DEMs | Incredible data, 5GB / 27 tiles — overkill for a trip page |
| Google Earth Engine | Optimized for analysis at scale, not a static trip artifact |
| CalTopo embed | Great cartography, not designed to bundle into custom JS |
| Matching onX 3D | Multi-month project; wrong battle — build what onX *can't* instead |
| One Cloudflare Pages project per trip on one hostname | Custom domains attach at the hostname level, not per-path — use one project with a subdirectory per trip instead |
| `fetch()` for captions.json (old `file://` era) | Obsolete — the map **does** fetch `content.json` now; local dev always runs through `serve.js` |

## Elevation chart (canvas)

Drawn on a `<canvas>` inside `#elevation-strip`. Key implementation notes:
- Canvas pixel dims set to `W * devicePixelRatio` for retina crispness; CSS dims stay logical px
- Time-of-day background: colored `fillRect` strips per profile segment; `timeToRGBA(h)` maps hour → `[r,g,b,a]`. Palette: blue morning → bright peak sun 12–4p → cool blue-purple evening
- Overnight camps drawn as near-black bands at the transition fracs, labeled "camp"
- Photo squares hit-tested on click with 14px radius; hover shows time + elevation tooltip
- The chart always uses **all** photos (`loadPhotos()`), not the filtered set
- `drawElevationChart(activeIdx)` called from `stepTo()`, `resetView()`, and `resize`

**Performance architecture:**
- Static layers (time gradients, camp markers, elevation fill/line, y-axis labels) rendered once into an offscreen `<canvas>` via `buildChartCache(W, H)`; each draw blits the cache then draws photo squares on top. Cache invalidated on resize.
- `ELEV_MIN`, `ELEV_MAX`, `ELEV_RANGE` precomputed; photo pixel positions precomputed per cache build.
- Mousemove is rAF-throttled (latest pointer position once per frame).

## Satellite layer

MapTiler raster source:
```js
{ type: 'raster', url: `https://api.maptiler.com/tiles/satellite/tiles.json?key=${KEY}` }
```
Layer added **before** `'hillshade'` so topo labels and route render on top. Toggled via `setLayoutProperty('satellite-layer', 'visibility', ...)`. Default: on.

## Deployment

- `./deploy.sh` → `wrangler pages deploy dist --project-name paria-2026` → live at **https://paria.jon.bo**.
- `dist/` is gitignored and fully regenerated each deploy: `index.html` (the map), `mobile.html`, `content.json`, `photos/` (with `photos/web/` copies, without `.mov`).
- `photos/` is **gitignored** — media never enters git; it's rsynced into `dist/` at deploy time. Same for `output/`, `content-backups/`, `dist/`, `*.gpx`.
- All asset references in the shipped files are **relative** (`content.json`, `photos/…`, `mobile.html`) — the bundle works from any subpath. Only `editor.html` uses absolute `/api/…` paths, and it's local-only, never deployed.

## Domain: `paria.jon.bo` (decided)

Decided: a **dedicated subdomain per trip** instead of a subpath — this trip lives at `https://paria.jon.bo`. Zero code/staging changes (every asset reference is relative); it's purely a custom-domain swap on the existing Pages project. Cloudflare custom domains attach at the hostname level, so per-trip subdomains (`<trip>.jon.bo`) sidestep path-routing entirely and leave `map.jon.bo` free to become a future multi-trip index or anything else.

Setup: Pages → `paria-2026` → Custom domains → add `paria.jon.bo` (DNS is automatic, the zone is in the same account). Whether to keep `map.jon.bo` attached as well is an open choice — keeping it preserves old shared links.

**Hugo "link post" on the blog** (still to do) — a normal post with `externalUrl: https://paria.jon.bo/` in front matter; list templates + RSS link `.Params.externalUrl | default .Permalink`; let the permalink page render as a stub with context. (`aliases` is NOT the right tool — it redirects old paths *to* a post, not out.)

## Next steps (in rough priority order)

1. **Hugo link post** pointing at `https://paria.jon.bo/` — see section above.
2. **People filter UI** — enable the disabled multi-select; plumbing already exists.
3. **Per-photo camera tuning** — Viewpoint row → Set; persists to localStorage. Debug panel (`d`) for live values.
4. **Title lander polish** — `photos/trip/cover.jpeg` on the intro, "start journey" button, "how to use" message (see `todos.md`).
5. **Elevation chart polish** — day labels (Apr 4/5/6), photo number labels on hover, click-to-fly on the line itself.
6. **Caption/copy pass** — flesh out remaining thin captions (do it in the editor, not captions.json).

## MapTiler API key

Stored in the `MAPTILER_KEY` constant near the top of `paria-trip-map.html`. Free tier is sufficient for personal/low-traffic use.
