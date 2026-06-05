#!/usr/bin/env node
// Seed content.json — YOUR editable trip data — from the curated photos/trip/ folders.
//
// Source of truth for WHICH photos exist = the media files under photos/trip/<person>/.
// (The full iCloud scrape in output/ is NOT included — only used to enrich matching
// photos with UUID / date / location / "had an iCloud caption" flag.)
//
// Each person's folder = that person's contribution: photographer AND caption author
// default to the folder owner. Captions come from that folder's captions.json.
//
// Re-running OVERWRITES content.json (clobbers hand edits) — only re-run to re-seed.
//
// Run: node build_content.js

const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT     = __dirname;
const TRIP_DIR = path.join(ROOT, 'photos', 'trip');
const SCRAPE   = path.join(ROOT, 'output', 'paria_2026_album.json');
const OUT_FILE = path.join(ROOT, 'content.json');

// ── People (folder name = person key) ─────────────────────────────────────────
const PEOPLE = {
  jon:    { name: 'Jon',    email: '***' },
  gary:   { name: 'Gary',   email: '***' },
  maggie: { name: 'Maggie', email: '***' },
  lauren: { name: 'Lauren', email: null },
};

const MEDIA_RE = /\.(jpe?g|heic|png|mov|mp4)$/i;
const VIDEO_RE = /\.(mov|mp4)$/i;
const stem = (fn) => (fn || '').replace(/\.[A-Za-z0-9]+$/, '').trim();

// Most cameras on this trip were on Mountain Daylight (UTC-6). Used only when a photo
// has neither GPS time (UTC) nor an explicit EXIF offset tag.
const DEFAULT_OFFSET = '-06:00';

// Parse an EXIF/QuickTime timestamp to epoch ms (UTC). Handles:
//   "2026:04:04 13:12:32Z"        (GPSDateTime, already UTC)
//   "2026:04:04 07:12:33"         (DateTimeOriginal, local — needs `offset`)
//   "2026:04:04 14:28:14-06:00"   (QuickTime CreationDate, offset embedded)
function exifToMs(s, offset) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/);
  if (!m) return null;
  const [, Y, Mo, D, T, tz] = m;
  let iso = `${Y}-${Mo}-${D}T${T}`;
  if (tz) iso += tz === 'Z' ? 'Z' : (tz.includes(':') ? tz : tz.slice(0, 3) + ':' + tz.slice(3));
  else iso += offset || 'Z';
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

// Best UTC capture instant per file: GPS time > offset-corrected capture > video creation > scrape.
function captureMs(exif, scrapeISO) {
  return exifToMs(exif.GPSDateTime)
      ?? exifToMs(exif.DateTimeOriginal, exif.OffsetTimeOriginal || DEFAULT_OFFSET)
      ?? exifToMs(exif.CreationDate)
      ?? (scrapeISO ? Date.parse(scrapeISO) : null);
}

// Read the relevant time tags for every media file in one exiftool pass.
function readExif(files) {
  if (!files.length) return {};
  const out = spawnSync('exiftool', ['-j', '-n', '-api', 'QuickTimeUTC=0',
    '-GPSDateTime', '-DateTimeOriginal', '-OffsetTimeOriginal', '-CreationDate', ...files],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (out.status !== 0 || !out.stdout) {
    console.warn('  (exiftool unavailable — falling back to scrape dates only)');
    return {};
  }
  const map = {};
  for (const rec of JSON.parse(out.stdout)) map[path.resolve(rec.SourceFile)] = rec;
  return map;
}

// ── Enrichment index from the scrape (filename stem -> scrape photo) ───────────
const scrapeByStem = {};
if (fs.existsSync(SCRAPE)) {
  const scrape = JSON.parse(fs.readFileSync(SCRAPE, 'utf8'));
  for (const p of scrape.photos) {
    const cap = (p.comments || []).find((c) => c.isCaption && c.text);
    const meta = { uuid: p.uuid, dateCreated: p.dateCreated || null, icloudCaption: !!cap };
    for (const s of [stem(p.originalFilename), stem(p.sharedFilename)]) {
      if (s) (scrapeByStem[s] ||= []).push(meta);
    }
  }
}

// ── EXIF time tags for every curated file (one exiftool pass) ─────────────────
const allFiles = [];
for (const person of Object.keys(PEOPLE)) {
  const dir = path.join(TRIP_DIR, person);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((f) => MEDIA_RE.test(f)))
    allFiles.push(path.join(dir, f));
}
const exif = readExif(allFiles);

// ── Build one entry per media file, per person folder ─────────────────────────
const photos = [];
for (const person of Object.keys(PEOPLE)) {
  const dir = path.join(TRIP_DIR, person);
  if (!fs.existsSync(dir)) continue;

  // caption lookup for this folder: filename -> { caption, location }
  const capByFile = {};
  const capFile = path.join(dir, 'captions.json');
  if (fs.existsSync(capFile)) {
    for (const e of JSON.parse(fs.readFileSync(capFile, 'utf8'))) {
      if (Array.isArray(e.photos)) {
        for (const ph of e.photos) {
          capByFile[ph.file] = { caption: e.caption,
            location: (ph.lat != null && ph.lng != null) ? { lat: ph.lat, lng: ph.lng } : null };
        }
      } else {
        const f = e.photo || e.video;
        if (f) capByFile[f] = { caption: e.caption, location: null };
      }
    }
  }

  for (const file of fs.readdirSync(dir).filter((f) => MEDIA_RE.test(f)).sort()) {
    const hand = capByFile[file] || {};
    const meta = (scrapeByStem[stem(file)] || [])[0] || {};
    const ex   = exif[path.resolve(dir, file)] || {};
    const ms   = captureMs(ex, meta.dateCreated);
    photos.push({
      id: meta.uuid || `${person}-${stem(file)}`,
      image: `photos/trip/${person}/${file}`,
      originalFilename: file,
      isVideo: VIDEO_RE.test(file),
      photographer: person,        // folder owner — your curation intent; editable
      caption: hand.caption || '',
      captionAuthor: person,
      coreTrip: true,
      location: hand.location || null,
      dateCreated: ms != null ? new Date(ms).toISOString() : (meta.dateCreated || null),
      _sortMs: ms,                 // dropped before write; only used to order photos
      _icloudCaption: !!meta.icloudCaption,
    });
  }
}

// Sort by GPS/capture time (UTC). Undated items sink to the end, stable by filename.
photos.sort((a, b) => (a._sortMs ?? Infinity) - (b._sortMs ?? Infinity)
                   || a.originalFilename.localeCompare(b.originalFilename));
for (const p of photos) delete p._sortMs;

const content = { people: PEOPLE, photos };
fs.writeFileSync(OUT_FILE, JSON.stringify(content, null, 2));

console.log(`Wrote content.json`);
console.log(`  ${photos.length} photos from photos/trip/ | ${photos.filter((p) => p.caption).length} captioned | ${photos.filter((p) => p.isVideo).length} videos`);
for (const person of Object.keys(PEOPLE)) {
  const n = photos.filter((p) => p.photographer === person).length;
  if (n) console.log(`    ${PEOPLE[person].name}: ${n}`);
}
