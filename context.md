# Paria Canyon Trip Map — Project Context

## What this is

A custom interactive trip artifact for a Paria Canyon backpacking trip (April 2026), built as a single self-contained HTML file. The goal is something onX can't produce: a personal, shareable map with your photos, your story, and your styling — that you own end-to-end.

## The trip

- **Route**: White House Trailhead → Paria Canyon → Lees Ferry
- **Distance**: ~38 miles, south-southwest through the Paria Canyon–Vermilion Cliffs Wilderness
- **Note**: Trip included a short excursion up Buckskin Gulch from the trailhead area, but the main route follows the Paria River canyon
- **Dates**: April 4–8, 2026 (based on GPX timestamps)

## Files

| File | Purpose |
|---|---|
| `paria-trip-map.html` | The map — open directly in any browser, no build step |
| `onx-markups-05052026.gpx` | onX export of the actual GPS track (3,517 points) |

## Tech stack

- **MapLibre GL JS** (v4.7.1) — open-source map renderer, supports 3D terrain natively
- **MapTiler** — provides the topo basemap style (`topo-v2`) and terrain-RGB elevation tiles
- **GeoJSON** — route and photo markers are plain JS objects, no external data files

Why this combo: MapLibre is free and open, MapTiler's free tier covers a personal project, and the whole thing ships as one HTML file with no build tooling.

## Map features

- 3D terrain at 1.5× exaggeration (slot canyon walls read clearly)
- **Satellite imagery layer** (MapTiler `tiles/satellite` raster, opacity 1.0, default on) with toggle button
- Topo basemap + extra hillshade layer for depth; satellite inserted above hillshade so route/labels render on top
- Desert sky/fog palette
- Route line with shadow, drawn from real GPS track
- Photo markers pinned to real EXIF GPS coordinates
- Click-to-popup on each marker (small thumbnail + label — main photo is in the right panel)
- **Cinematic camera navigation** — Next/Prev buttons fly between photos with auto-computed bearing (faces direction of travel), 2.2s transition, popup auto-opens on arrival
- Clicking a pin directly triggers a faster 1.4s fly to that marker
- Active marker highlights so you always know your position in the story
- Overview button resets to full-route view and clears active state
- Toggle 3D button
- **Debug panel** (`d` key) — live lng/lat, zoom, bearing, pitch + active photo EXIF bearing

## Layout

Three-column layout (all via CSS flexbox, no build step):

```
┌─────────────────────────────────┬──────────────┐
│                                 │              │
│         MAP (flex: 1)           │  right panel │
│                                 │  (360px)     │
│                                 │              │
├─────────────────────────────────┤  photo img   │
│  ELEVATION STRIP (160px tall)   │  caption     │
│  canvas: time bg + ele line     │  prev/next   │
│  + photo squares + hover        │  controls    │
└─────────────────────────────────┴──────────────┘
```

- Map div uses `flex: 1; min-height: 0` inside a flex column — this is required for MapLibre to size correctly inside flexbox
- Elevation strip is a sibling div below the map, not an overlay

## Data

**Route**: Downsampled from 3,517 raw GPS points to 154 points (every 23rd point, keeping first and last). Stored inline in the HTML as a GeoJSON LineString.

**Elevation profile**: `[route_fraction, elevation_meters, local_hour_MDT]` — 154 points extracted from GPX `<ele>` and `<time>` tags via Pillow+ElementTree. Day transitions (overnight camps) are detectable where `hour` drops by >2 between adjacent points. Transition fracs: ~0.3308 (end Day 1) and ~0.6653 (end Day 2).

**Photo markers**: 12 test photos from `photos/test1/`, sorted chronologically. Each photo has:
```js
{ id, lng, lat, date, title, caption, img,
  bearing,    // GPSImgDirection from EXIF — camera pointing direction (true north)
  routeFrac   // position along route 0–1, computed by nearest-point to GPX track
}
```

**EXIF fields available** (confirmed on all 12 photos):
- `GPSLatitude` / `GPSLongitude` — shot location
- `GPSImgDirection` (tag 17, ref T = true north) — exact camera bearing when shot
- `GPSAltitude` — elevation at shot
- `GPSSpeed` — walking speed
- `DateTimeOriginal` — for chronological sort

EXIF extraction done with Pillow (`PIL`). `GPSImgDirection` comes back as a rational fraction (e.g. `1789/10`) — convert with `float(Fraction(str(val)))`.

**Trip timing** (local MDT, UTC-6):
- Day 1 (Apr 4): 11:21am – 7:24pm
- Day 2 (Apr 5): 9:16am – 5:35pm  
- Day 3 (Apr 6): 9:28am – 4:05pm
- Total distance: 33.5 miles, elevation range 955m–1396m (3,133–4,580 ft)

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

## Elevation chart (canvas)

Drawn on a `<canvas>` inside `#elevation-strip`. Key implementation notes:
- Canvas pixel dims must be set to `W * devicePixelRatio` for crisp rendering on retina; CSS dims stay in logical px
- Time-of-day background: colored `fillRect` strips per profile segment using `createLinearGradient`; color stops in `timeToRGBA(h)` map hour → `[r,g,b,a]`. Current palette: blue morning → bright peak sun 12–4p → cool blue-purple evening
- Overnight camps drawn as near-black bands at the transition fracs, labeled "camp"
- Photo squares hit-tested on click with 14px radius; hover shows time + elevation tooltip
- `drawElevationChart(activeIdx)` called from `stepTo()`, `resetView()`, and `resize`

## Satellite layer

MapTiler raster source:
```js
{ type: 'raster', url: `https://api.maptiler.com/tiles/satellite/tiles.json?key=${KEY}` }
```
Layer added **before** `'hillshade'` in the `addLayer` call so topo labels and route render on top. Toggled via `setLayoutProperty('satellite-layer', 'visibility', ...)`. Default: on.

## Per-photo camera bearing (deferred)

EXIF `GPSImgDirection` is stored on every photo as `bearing` (true north degrees). Wired into the photos array but **not currently used** for `flyTo` — `stepTo()` uses `bearingBetween()` auto-compute (faces direction of travel). The EXIF bearing was tried as the `flyTo` bearing but often showed occluded terrain; worth revisiting with per-photo zoom/pitch overrides as well. Debug panel (`d`) shows active photo's EXIF bearing alongside current map bearing for comparison.

## Next steps (in rough priority order)

1. **Final photo selection** — pick the real photos, drop into `photos/`, run the EXIF extraction script, update `title`, `caption`, and `routeFrac` per entry.

2. **Per-photo camera tuning** — each photo has `bearing` (EXIF), and `stepTo()` accepts it. Add optional `zoom` and `pitch` overrides per entry for key shots (narrows, wide canyon views). Use debug panel to dial in values.

3. **Elevation chart polish** — day labels (Apr 4 / Apr 5 / Apr 6) below the chart, photo number labels on hover.

4. **Visual polish** — custom map style via MapTiler Cloud (fork `topo-v2`), custom marker icons, sepia/retro CSS filters.

5. **Hosting** — single HTML file drops onto Vercel, Netlify, or GitHub Pages with zero config. Photos go up alongside it, or move to Cloudinary for CDN delivery.

## MapTiler API key

Stored in the `MAPTILER_KEY` constant near the top of `paria-trip-map.html`. Free tier is sufficient for personal/low-traffic use.
