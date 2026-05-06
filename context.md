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
- Topo basemap + extra hillshade layer for depth
- Desert sky/fog palette
- Route line with shadow, drawn from real GPS track
- Photo markers pinned to real EXIF GPS coordinates
- Click-to-popup on each marker (photo + title + caption + date)
- **Cinematic camera navigation** — Next/Prev buttons fly between photos with auto-computed bearing (faces direction of travel), 2.2s transition, popup auto-opens on arrival
- Clicking a pin directly triggers a faster 1.4s fly to that marker
- Active marker highlights so you always know your position in the story
- Progress counter ("3 of 12")
- Overview button resets to full-route view and clears active state
- Toggle 3D button

## Data

**Route**: Downsampled from 3,517 raw GPS points to 155 points (every 23rd point, keeping first and last). Stored inline in the HTML as a GeoJSON LineString.

**Photo markers**: 12 test photos from `photos/test1/`, sorted chronologically. Coordinates pulled from EXIF GPS — each pin is the exact location where the shot was taken. Titles and captions are placeholders pending final photo selection.

The `photos` array schema:
```js
{ id: 1, lng: -111.863678, lat: 37.027364,
  date: 'Apr 4',
  title: 'Your title',
  caption: 'Your caption.',
  img: 'photos/test1/IMG_7442.jpeg' }
```

Photos are served as relative paths and work locally when opened from the project root. For hosting, photos go up alongside the HTML (or move to Cloudinary/Vercel for CDN delivery).

**EXIF extraction**: done with Pillow (`PIL`) in a short Python script — reads `GPSLatitude`/`GPSLongitude` rational tuples, converts DMS→decimal degrees, sorts by `DateTimeOriginal`. No external tools needed beyond `pip install Pillow`.

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

## Next steps (in rough priority order)

1. **Final photo selection** — pick the real photos, drop into `photos/`, run the EXIF extraction script to get coordinates, update `title` and `caption` per entry.

2. **Per-photo camera tuning** — each photo entry can get a hand-set `bearing`, `zoom`, and `pitch`. `stepTo()` uses `bearingBetween()` auto-compute as a fallback; add optional overrides per entry when you want a specific frame (e.g. face up-canyon for a narrows shot vs. bird's-eye for a camp).

3. **Visual polish** — custom map style via MapTiler Cloud (fork `topo-v2`), custom marker icons, elevation profile chart (Chart.js + sample DEM along route), sepia/retro CSS filters.

4. **Hosting** — single HTML file drops onto Vercel, Netlify, or GitHub Pages with zero config. Photos go up alongside it, or move to Cloudinary for CDN delivery.

## MapTiler API key

Stored in the `MAPTILER_KEY` constant near the top of `paria-trip-map.html`. Free tier is sufficient for personal/low-traffic use.
