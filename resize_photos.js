#!/usr/bin/env node
// Generate downscaled web copies of the trip photos for the map's photo panel.
//
// Full-res phone JPEGs (up to 12MP / 17MB) were decoding in ~1s on the main thread and
// stalling the map during photo transitions. These ~1600px copies decode in tens of ms.
// The map panel loads these; the lightbox still loads the originals for full quality.
//
// Output mirrors the originals under photos/web/…
//   photos/trip/gary/IMG_0208.jpeg → photos/web/trip/gary/IMG_0208.jpeg
// (photos/ is gitignored and rsynced at deploy time, so photos/web/ ships automatically.)
//
// Usage:
//   node resize_photos.js           resize any missing / out-of-date web copies
//   node resize_photos.js --force   rebuild every web copy
//
// macOS only — uses the built-in `sips`. Non-destructive: originals are never touched.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MAX_DIM = 1600;   // longest edge in px — ~2x the panel's CSS width for retina sharpness
const QUALITY = 82;     // JPEG quality (0–100)
const FORCE   = process.argv.includes('--force');
const ROOT    = __dirname;

const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'content.json'), 'utf8'));
const imgs = [...new Set(
  (content.photos || [])
    .filter(p => p.image && !p.isVideo)
    .map(p => p.image)
)];

const webPathOf = src => src.replace(/^photos\//, 'photos/web/');

let done = 0, skipped = 0, missing = 0, origBytes = 0, webBytes = 0;

for (const rel of imgs) {
  const inPath = path.join(ROOT, rel);
  if (!fs.existsSync(inPath)) { console.warn('  ! missing source:', rel); missing++; continue; }

  const outPath = path.join(ROOT, webPathOf(rel));
  const inStat = fs.statSync(inPath);

  // Skip if an up-to-date web copy already exists (unless --force).
  if (!FORCE && fs.existsSync(outPath) && fs.statSync(outPath).mtimeMs >= inStat.mtimeMs) {
    skipped++;
    origBytes += inStat.size;
    webBytes  += fs.statSync(outPath).size;
    continue;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  try {
    execFileSync('sips', [
      '-s', 'format', 'jpeg',
      '-s', 'formatOptions', String(QUALITY),
      '-Z', String(MAX_DIM),           // resample so the longest edge is MAX_DIM, aspect preserved
      inPath, '--out', outPath,
    ], { stdio: 'ignore' });

    const wSize = fs.statSync(outPath).size;
    origBytes += inStat.size;
    webBytes  += wSize;
    console.log(`  ✓ ${rel}  ${(inStat.size / 1048576).toFixed(1)}MB → ${(wSize / 1024).toFixed(0)}KB`);
    done++;
  } catch (e) {
    console.error('  ✗ sips failed for', rel, '—', e.message);
  }
}

const mb = b => (b / 1048576).toFixed(1) + 'MB';
console.log(`\nResized ${done}, skipped ${skipped}${missing ? `, missing ${missing}` : ''}.`);
if (origBytes) {
  console.log(`Panel payload: ${mb(origBytes)} → ${mb(webBytes)} (${(100 - webBytes / origBytes * 100).toFixed(0)}% smaller)`);
}
