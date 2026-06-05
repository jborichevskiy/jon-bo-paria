#!/usr/bin/env node
// ONE-TIME IMPORTER. Seeds content.json from the photos/trip/ folders + captions.json.
//
// content.json is the SINGLE SOURCE OF TRUTH going forward — edited via the editor
// (editor.html + serve.js), read directly by the map (paria-trip-map.html).
//
// ⚠️  Re-running OVERWRITES content.json and WIPES all editor edits. This is an import,
//     not a sync. Only run it to bootstrap from scratch (it backs up to content-backups/
//     via the editor save path, but NOT here — copy content.json first if unsure).
//
// What it does: one entry per media file under photos/trip/<person>/, enriched with
// EXIF date + GPS (→ location + routeFrac on the route), captions from captions.json,
// and videos pointed at their transcoded .mp4. The output/ iCloud scrape only supplies
// UUID / fallback date / "had an iCloud caption" flag.
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
  jon:    { name: 'Jon' },
  gary:   { name: 'Gary' },
  maggie: { name: 'Maggie' },
  lauren: { name: 'Lauren' },
};

const MEDIA_RE = /\.(jpe?g|heic|png|mov|mp4)$/i;
const VIDEO_RE = /\.(mov|mp4)$/i;
const stem = (fn) => (fn || '').replace(/\.[A-Za-z0-9]+$/, '').trim();

// Most cameras on this trip were on Mountain Daylight (UTC-6). Used only when a photo
// has neither GPS time (UTC) nor an explicit EXIF offset tag.
const DEFAULT_OFFSET = '-06:00';

// ── Route geometry ────────────────────────────────────────────────────────────
// 155 [lng, lat] waypoints from the GPX. routeFrac = where along the route (0–1)
// a photo's GPS snaps to — this is how the map places each photo on the trail.
const ROUTE = [[-111.890533,37.080723],[-111.890549,37.080647],[-111.890541,37.077263],[-111.889236,37.071503],[-111.885681,37.068226],[-111.883316,37.064468],[-111.882545,37.062782],[-111.87928,37.059528],[-111.875198,37.057281],[-111.874763,37.052799],[-111.876076,37.050373],[-111.872833,37.047661],[-111.868996,37.044083],[-111.869347,37.041569],[-111.86895,37.036263],[-111.870346,37.0327],[-111.869591,37.029564],[-111.863991,37.028164],[-111.864105,37.026161],[-111.861847,37.024731],[-111.858917,37.022148],[-111.860817,37.019054],[-111.862511,37.015793],[-111.863525,37.013432],[-111.86615,37.010246],[-111.866325,37.008705],[-111.865509,37.006836],[-111.865654,37.004173],[-111.864006,36.999035],[-111.860573,37.000046],[-111.859322,36.999435],[-111.859634,36.999588],[-111.862854,36.999832],[-111.865067,37.001163],[-111.869835,37.002975],[-111.871994,37.011284],[-111.87368,37.013966],[-111.872375,37.013199],[-111.872238,37.010647],[-111.867943,37.003063],[-111.864838,37.001263],[-111.862869,36.999474],[-111.860283,37.000282],[-111.85955,36.999691],[-111.860443,36.998028],[-111.859901,36.994511],[-111.859772,36.991558],[-111.857941,36.988995],[-111.85498,36.98727],[-111.85614,36.985317],[-111.852722,36.983833],[-111.850899,36.983795],[-111.84948,36.985458],[-111.846863,36.984394],[-111.8451,36.986397],[-111.843979,36.987083],[-111.841583,36.98856],[-111.839188,36.98576],[-111.835625,36.985657],[-111.833206,36.983856],[-111.832687,36.982819],[-111.832809,36.981853],[-111.832207,36.982059],[-111.828705,36.985065],[-111.824677,36.984707],[-111.819725,36.984344],[-111.820107,36.987064],[-111.817871,36.988266],[-111.815971,36.989811],[-111.815002,36.991608],[-111.810921,36.99263],[-111.806747,36.992218],[-111.807938,36.989845],[-111.8032,36.992027],[-111.801926,36.99052],[-111.798096,36.991562],[-111.799889,36.993599],[-111.795937,36.994564],[-111.792603,36.995445],[-111.789268,36.996319],[-111.7873,36.995567],[-111.784454,36.993671],[-111.781532,36.993034],[-111.780243,36.991993],[-111.781654,36.989979],[-111.776848,36.988213],[-111.776833,36.983219],[-111.777557,36.979557],[-111.773972,36.977802],[-111.77478,36.974617],[-111.775612,36.971073],[-111.771027,36.969326],[-111.768852,36.968697],[-111.766434,36.971642],[-111.763992,36.972267],[-111.759834,36.968555],[-111.756592,36.964954],[-111.756462,36.964996],[-111.759552,36.963974],[-111.758789,36.960995],[-111.755341,36.963173],[-111.752716,36.961094],[-111.750427,36.958878],[-111.746735,36.960045],[-111.744751,36.960316],[-111.744011,36.956593],[-111.741074,36.955349],[-111.73806,36.954975],[-111.734413,36.955578],[-111.731026,36.954517],[-111.73056,36.952164],[-111.725311,36.952793],[-111.720963,36.952892],[-111.716354,36.950882],[-111.713554,36.948132],[-111.710373,36.948612],[-111.70594,36.949089],[-111.70166,36.947987],[-111.698257,36.947552],[-111.69416,36.945999],[-111.690735,36.945553],[-111.687622,36.946262],[-111.683929,36.947315],[-111.680786,36.947529],[-111.677811,36.945602],[-111.674515,36.944],[-111.672546,36.940384],[-111.670403,36.937614],[-111.668106,36.935081],[-111.665489,36.932247],[-111.663513,36.930805],[-111.660767,36.928207],[-111.655144,36.925255],[-111.652809,36.923031],[-111.648323,36.921654],[-111.64357,36.919613],[-111.639572,36.916565],[-111.636726,36.914257],[-111.633377,36.911633],[-111.633217,36.908737],[-111.627922,36.90414],[-111.624275,36.902195],[-111.619728,36.89922],[-111.615379,36.896999],[-111.614273,36.893055],[-111.611565,36.890442],[-111.612778,36.886822],[-111.609161,36.883541],[-111.607414,36.880215],[-111.60759,36.877213],[-111.602791,36.874088],[-111.597733,36.871292],[-111.595612,36.866028],[-111.593498,36.86499],[-111.591164,36.866066]];

function haversineKm([lng1,lat1],[lng2,lat2]) {
  const R = 6371, r = Math.PI/180;
  const dLat = (lat2-lat1)*r, dLng = (lng2-lng1)*r;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}
const cumDist = [0];
for (let i = 1; i < ROUTE.length; i++) cumDist.push(cumDist[i-1] + haversineKm(ROUTE[i-1], ROUTE[i]));
const totalDist = cumDist[cumDist.length-1];

function snapToRoute(lng, lat) {
  let minD = Infinity, minI = 0;
  for (let i = 0; i < ROUTE.length; i++) {
    const d = haversineKm([lng, lat], ROUTE[i]);
    if (d < minD) { minD = d; minI = i; }
  }
  return +(cumDist[minI]/totalDist).toFixed(4);
}

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
    '-GPSDateTime', '-DateTimeOriginal', '-OffsetTimeOriginal', '-CreationDate',
    '-GPSLatitude', '-GPSLongitude', ...files],
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

  const names = new Set(fs.readdirSync(dir));
  for (const file of [...names].filter((f) => MEDIA_RE.test(f)).sort()) {
    // A transcoded .mp4 sitting next to its source .mov is a derived web asset, not a
    // separate item — skip it; the .mov is canonical (and carries the captions.json key).
    if (/\.mp4$/i.test(file) && names.has(file.replace(/\.mp4$/i, '.mov'))) continue;

    const hand = capByFile[file] || {};
    const meta = (scrapeByStem[stem(file)] || [])[0] || {};
    const ex   = exif[path.resolve(dir, file)] || {};
    const ms   = captureMs(ex, meta.dateCreated);

    // Location: hand-placed override (captions.json) wins; otherwise EXIF GPS.
    const location = hand.location
      ?? (ex.GPSLatitude != null && ex.GPSLongitude != null
          ? { lat: +(+ex.GPSLatitude).toFixed(6), lng: +(+ex.GPSLongitude).toFixed(6) }
          : null);

    // For a video, serve the compressed web .mp4 if it exists; keep the .mov name as origin.
    const isVideo  = VIDEO_RE.test(file);
    const mp4Name  = `${stem(file)}.mp4`;
    const servedFile = isVideo && names.has(mp4Name) ? mp4Name : file;

    photos.push({
      id: meta.uuid || `${person}-${stem(file)}`,
      image: `photos/trip/${person}/${servedFile}`,
      originalFilename: file,
      isVideo,
      photographer: person,        // folder owner — your curation intent; editable
      caption: hand.caption || '',
      captionAuthor: person,
      coreTrip: true,
      location,
      routeFrac: location ? snapToRoute(location.lng, location.lat) : null,
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
