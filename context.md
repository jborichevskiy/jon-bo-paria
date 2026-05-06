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
- 20 numbered photo markers evenly spaced along the route
- Click-to-popup on each marker (photo + title + caption + date)
- Reset view + Toggle 3D buttons

## Data

**Route**: Downsampled from 3,517 raw GPS points to 155 points (every 23rd point, keeping first and last). Stored inline in the HTML as a GeoJSON LineString.

**Photo markers**: 20 positions evenly distributed along the downsampled route. Currently placeholders — swap in real photos by updating each entry in the `photos` array:

```js
{ id: 1, lng: -111.890533, lat: 37.080723,
  title: 'Your title',
  caption: 'Your caption.',
  date: 'Apr 4',
  img: 'URL or relative path to photo' }
```

Photos can be hosted on Cloudinary, Vercel, or served locally. If your photos have EXIF GPS data, the `exifr` library can auto-extract coordinates.

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

1. **Real photos** — update `title`, `caption`, `date`, and `img` for each of the 20 markers. Markers are already on the correct GPS coordinates.

2. **Scrollytelling** — fork the [Mapbox storytelling template](https://github.com/mapbox/storytelling), point it at MapLibre + MapTiler, define each photo as a chapter waypoint. The map cinematically flies between photos as you scroll.

3. **Visual polish** — custom map style via MapTiler Cloud (fork `topo-v2`, edit colors/typography), custom marker icons, elevation profile chart at bottom (Chart.js + sample the DEM along the route), sepia/retro CSS filters.

## MapTiler API key

Stored in the `MAPTILER_KEY` constant near the top of `paria-trip-map.html`. Free tier is sufficient for personal/low-traffic use.
