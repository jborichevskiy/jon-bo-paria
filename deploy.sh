#!/usr/bin/env bash
set -e

# content.json is the single source of truth (edited via the editor). The map reads it
# directly — nothing to build here. Do NOT run build_content.js; that re-seeds
# content.json from photos/ + captions.json and would wipe editor edits.
echo "▶ Staging deploy in dist/..."
rm -rf dist
mkdir -p dist

# Core files
cp paria-trip-map.html dist/index.html
cp mobile.html dist/          # phone-only photo gallery/slideshow (index.html redirects here on small screens)
cp about.html dist/           # about page (blog link + icon attribution), linked from the header "?" button
cp map-icon.svg dist/         # favicon (Noun Project map icon, CC BY 3.0 — attributed on about.html)
cp content.json dist/

# Generate/refresh downscaled web copies (photos/web/…) that the photo panel loads —
# full-res originals decoded in ~1s and stalled the map. Idempotent & non-destructive.
echo "▶ Refreshing web-sized photos..."
node resize_photos.js

# Photos — ship transcoded .mp4 web videos; skip the raw .mov originals (large, Pages 25MB limit)
rsync -a --exclude='*.mov' --exclude='*.MOV' \
  photos/ dist/photos/

echo "▶ Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name paria-2026 --commit-dirty=true

echo "✅ Done — https://paria.jon.bo"
