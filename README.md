# Paria Canyon 2026

An interactive map of our four-day hike down Paria Canyon — photos and videos placed
along the route, with an elevation profile and per-photographer filtering.

Live at **https://map.jon.bo**

## Architecture

`content.json` is the **single source of truth**. The media lives in `photos/`; everything
the site renders (captions, dates, locations, video paths) comes from `content.json`.

```
photos/            media files (images + transcoded .mp4 videos)
   │   one-time import  →  node build_content.js
   ▼
content.json       THE source of truth — captions, locations, routeFrac, video paths
   ├── editor.html  ⇄  serve.js (/api/content)   read + write
   └── paria-trip-map.html                        reads content.json directly (fetch)
```

- **`content.json`** — flat `photos[]` array. Each entry: `image` path, `photographer`,
  `caption`, `location` `{lat,lng}`, `routeFrac` (0–1 position along the trail),
  `dateCreated` (ISO-UTC), `isVideo`, `coreTrip`. Edited via the editor; nothing else
  generates it during normal use.
- **`paria-trip-map.html`** — the map (deployed as `index.html`). Fetches `content.json`
  directly (cache-busted), so a fresh save shows on refresh. Renders images in `<img>`,
  videos in `<video controls>`. On small screens (≤768px) it redirects to `mobile.html`
  (append `?desktop` to force the full map on a phone).
- **`mobile.html`** — phone-only, photo-first experience: an overview card, a gallery grid,
  and a caption slideshow. No map, no filtering. Reads the same `content.json` (and the same
  `photos/web/` downscaled copies), so it stays in sync with the editor automatically.
- **`editor.html` + `serve.js`** — local editor. `serve.js` reads/writes `content.json`
  via `/api/content` and serves it with `Cache-Control: no-store`.
- **`build_content.js`** — ⚠️ **one-time importer only.** Re-seeds `content.json` from
  `photos/` + `captions.json`, enriching with EXIF date/GPS (→ `location` + `routeFrac`)
  and pointing videos at their transcoded `.mp4`. **Running it overwrites `content.json`
  and wipes all editor edits** — it's an import, not a sync.

## Run it locally

```sh
node serve.js
```

Then open:

- **Map** → http://localhost:8080/ (serves `paria-trip-map.html`)
- **Editor** → http://localhost:8080/editor.html

`serve.js` is the right local server — not wrangler. The deployed site is pure static
(Cloudflare Pages just serves the files), and `serve.js` serves those *same* files **plus**
the `/api/content` read/write endpoint the editor needs and `Cache-Control: no-store` on
`content.json` so edits show on refresh. No build step, no install — it's plain Node
(`http`/`fs`), so `node serve.js` is all you need.

> **Want a production-fidelity preview?** `wrangler pages dev dist` serves exactly what
> ships (after staging — see [Deploy](#deploy)). But it's static-only: the editor's **Save**
> will 404 because there's no `/api/content`. Use it to sanity-check the deployed bundle,
> not to edit.

### Editing workflow

1. Open the editor at http://localhost:8080/editor.html
2. Edit a caption (etc.) → **Save** (writes `content.json`)
3. Refresh the map at http://localhost:8080/ — your change is there.

> If a save ever seems ignored, a stale `serve.js` may be holding the port. Free it with
> `lsof -ti:8080 | xargs kill -9`, then relaunch.

## Videos

Source `.mov` files are transcoded to compressed, web-playable `.mp4` (H.264, `+faststart`)
to stay under Cloudflare Pages' 25 MB/file limit. `content.json` points at the `.mp4`;
the original `.mov` is kept as `originalFilename` and not deployed.

To (re-)transcode, e.g.:

```sh
# short clip — keep quality high
ffmpeg -i IN.mov -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p \
  -movflags +faststart -c:a aac -b:a 128k OUT.mp4

# large clip — 2-pass to a target size, scaled down
ffmpeg -i IN.mov -vf scale=540:960 -c:v libx264 -b:v 1400k -pass 1 -an -f mp4 /dev/null
ffmpeg -i IN.mov -vf scale=540:960 -c:v libx264 -b:v 1400k -pass 2 \
  -movflags +faststart -c:a aac -b:a 96k OUT.mp4
```

## Deploy

```sh
./deploy.sh
```

Stages `content.json`, the map (as `index.html`), and `photos/` (ships `.mp4`, skips raw
`.mov`) into `dist/`, then publishes to Cloudflare Pages. No build step — the map reads
`content.json` as-is.

---

Built by Jon with Claude.
