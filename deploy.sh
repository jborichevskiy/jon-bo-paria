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
cp content.json dist/

# Photos — ship transcoded .mp4 web videos; skip the raw .mov originals (large, Pages 25MB limit)
rsync -a --exclude='*.mov' --exclude='*.MOV' \
  photos/ dist/photos/

echo "▶ Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name paria-2026 --commit-dirty=true

echo "✅ Done — https://map.jon.bo"
