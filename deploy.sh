#!/usr/bin/env bash
set -e

echo "▶ Building trip-data.js..."
node build.js

echo "▶ Staging deploy in dist/..."
rm -rf dist
mkdir -p dist

# Core files
cp paria-trip-map.html dist/index.html
cp trip-data.js dist/

# Photos — skip videos (Pages 25MB file limit)
rsync -a --exclude='*.mov' --exclude='*.mp4' --exclude='*.MOV' --exclude='*.MP4' \
  photos/ dist/photos/

echo "▶ Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name paria-2026 --commit-dirty=true

echo "✅ Done — https://map.jon.bo"
