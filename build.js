#!/usr/bin/env node
// Reads photos/trip/{person}/captions.json for every person subdirectory.
// Enriches each photo with GPS + datetime from EXIF (via exiftool).
// Computes routeFrac by snapping GPS to the nearest point on the route.
// Writes trip-data.js so the HTML works without a local server.
// Run: node build.js

const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TRIP_DIR = path.join(__dirname, 'photos', 'trip');
const OUT_FILE = path.join(__dirname, 'trip-data.js');

// ── Route: 155 [lng, lat] waypoints from the GPX ──────────────────────────
const ROUTE = [[-111.890533,37.080723],[-111.890549,37.080647],[-111.890541,37.077263],[-111.889236,37.071503],[-111.885681,37.068226],[-111.883316,37.064468],[-111.882545,37.062782],[-111.87928,37.059528],[-111.875198,37.057281],[-111.874763,37.052799],[-111.876076,37.050373],[-111.872833,37.047661],[-111.868996,37.044083],[-111.869347,37.041569],[-111.86895,37.036263],[-111.870346,37.0327],[-111.869591,37.029564],[-111.863991,37.028164],[-111.864105,37.026161],[-111.861847,37.024731],[-111.858917,37.022148],[-111.860817,37.019054],[-111.862511,37.015793],[-111.863525,37.013432],[-111.86615,37.010246],[-111.866325,37.008705],[-111.865509,37.006836],[-111.865654,37.004173],[-111.864006,36.999035],[-111.860573,37.000046],[-111.859322,36.999435],[-111.859634,36.999588],[-111.862854,36.999832],[-111.865067,37.001163],[-111.869835,37.002975],[-111.871994,37.011284],[-111.87368,37.013966],[-111.872375,37.013199],[-111.872238,37.010647],[-111.867943,37.003063],[-111.864838,37.001263],[-111.862869,36.999474],[-111.860283,37.000282],[-111.85955,36.999691],[-111.860443,36.998028],[-111.859901,36.994511],[-111.859772,36.991558],[-111.857941,36.988995],[-111.85498,36.98727],[-111.85614,36.985317],[-111.852722,36.983833],[-111.850899,36.983795],[-111.84948,36.985458],[-111.846863,36.984394],[-111.8451,36.986397],[-111.843979,36.987083],[-111.841583,36.98856],[-111.839188,36.98576],[-111.835625,36.985657],[-111.833206,36.983856],[-111.832687,36.982819],[-111.832809,36.981853],[-111.832207,36.982059],[-111.828705,36.985065],[-111.824677,36.984707],[-111.819725,36.984344],[-111.820107,36.987064],[-111.817871,36.988266],[-111.815971,36.989811],[-111.815002,36.991608],[-111.810921,36.99263],[-111.806747,36.992218],[-111.807938,36.989845],[-111.8032,36.992027],[-111.801926,36.99052],[-111.798096,36.991562],[-111.799889,36.993599],[-111.795937,36.994564],[-111.792603,36.995445],[-111.789268,36.996319],[-111.7873,36.995567],[-111.784454,36.993671],[-111.781532,36.993034],[-111.780243,36.991993],[-111.781654,36.989979],[-111.776848,36.988213],[-111.776833,36.983219],[-111.777557,36.979557],[-111.773972,36.977802],[-111.77478,36.974617],[-111.775612,36.971073],[-111.771027,36.969326],[-111.768852,36.968697],[-111.766434,36.971642],[-111.763992,36.972267],[-111.759834,36.968555],[-111.756592,36.964954],[-111.756462,36.964996],[-111.759552,36.963974],[-111.758789,36.960995],[-111.755341,36.963173],[-111.752716,36.961094],[-111.750427,36.958878],[-111.746735,36.960045],[-111.744751,36.960316],[-111.744011,36.956593],[-111.741074,36.955349],[-111.73806,36.954975],[-111.734413,36.955578],[-111.731026,36.954517],[-111.73056,36.952164],[-111.725311,36.952793],[-111.720963,36.952892],[-111.716354,36.950882],[-111.713554,36.948132],[-111.710373,36.948612],[-111.70594,36.949089],[-111.70166,36.947987],[-111.698257,36.947552],[-111.69416,36.945999],[-111.690735,36.945553],[-111.687622,36.946262],[-111.683929,36.947315],[-111.680786,36.947529],[-111.677811,36.945602],[-111.674515,36.944],[-111.672546,36.940384],[-111.670403,36.937614],[-111.668106,36.935081],[-111.665489,36.932247],[-111.663513,36.930805],[-111.660767,36.928207],[-111.655144,36.925255],[-111.652809,36.923031],[-111.648323,36.921654],[-111.64357,36.919613],[-111.639572,36.916565],[-111.636726,36.914257],[-111.633377,36.911633],[-111.633217,36.908737],[-111.627922,36.90414],[-111.624275,36.902195],[-111.619728,36.89922],[-111.615379,36.896999],[-111.614273,36.893055],[-111.611565,36.890442],[-111.612778,36.886822],[-111.609161,36.883541],[-111.607414,36.880215],[-111.60759,36.877213],[-111.602791,36.874088],[-111.597733,36.871292],[-111.595612,36.866028],[-111.593498,36.86499],[-111.591164,36.866066]];

// Precompute cumulative arc-length along route
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

// ── EXIF ──────────────────────────────────────────────────────────────────
function readExifBatch(files) {
  if (!files.length) return {};
  const res = spawnSync('exiftool', [
    '-csv', '-GPSLatitude#', '-GPSLongitude#', '-DateTimeOriginal',
    '-GPSDateTime', '-OffsetTimeOriginal', '-n', ...files
  ]);
  if (!res.stdout) return {};
  const lines = res.stdout.toString().trim().split('\n');
  if (lines.length < 2) return {};
  const headers = lines[0].split(',');
  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    const row = Object.fromEntries(headers.map((h,j) => [h.trim(), (vals[j]||'').trim()]));
    map[row.SourceFile] = row;
  }
  return map;
}

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtTime(h, m) {
  return `${h > 12 ? h - 12 : (h || 12)}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// All times normalised to MDT (UTC-6).
function parseDateTime(dtOriginal, offsetStr, gpsDateTime) {
  // 1. GPS UTC → MDT: most reliable, immune to phone timezone bugs
  if (gpsDateTime) {
    const clean = gpsDateTime.replace('Z', '').trim();
    const [dp, tp] = clean.split(' ');
    if (dp && tp) {
      let [, mm, dd] = dp.split(':').map(Number);
      let [h, m]     = tp.split(':').map(Number);
      h -= 6; if (h < 0) { h += 24; dd -= 1; }
      return { date: `${MONTHS[mm]} ${dd}`, time: fmtTime(h, m) };
    }
  }
  // 2. Local clock + UTC offset → normalise to MDT
  if (dtOriginal && offsetStr) {
    const offsetHours = parseInt(offsetStr, 10); // e.g. -7 from "-07:00"
    const [dp, tp] = dtOriginal.split(' ');
    if (dp && tp) {
      let [, mm, dd] = dp.split(':').map(Number);
      let [h, m]     = tp.split(':').map(Number);
      h += (-6 - offsetHours);
      if (h >= 24) { h -= 24; dd += 1; }
      if (h < 0)   { h += 24; dd -= 1; }
      return { date: `${MONTHS[mm]} ${dd}`, time: fmtTime(h, m) };
    }
  }
  // 3. Raw DateTimeOriginal with no offset info — assume already MDT
  if (dtOriginal) {
    const [dp, tp] = dtOriginal.split(' ');
    if (dp) {
      const [, mm, dd] = dp.split(':').map(Number);
      const date = `${MONTHS[mm] ?? ''} ${dd}`.trim();
      let time = '';
      if (tp) { const [h, m] = tp.split(':').map(Number); time = fmtTime(h, m); }
      return { date, time };
    }
  }
  return {};
}

// ── Main ──────────────────────────────────────────────────────────────────
const persons = fs.existsSync(TRIP_DIR)
  ? fs.readdirSync(TRIP_DIR).filter(d => fs.statSync(path.join(TRIP_DIR,d)).isDirectory()).sort()
  : [];

const tripData = {};

for (const person of persons) {
  const captionsPath = path.join(TRIP_DIR, person, 'captions.json');
  if (!fs.existsSync(captionsPath)) continue;
  const groups = JSON.parse(fs.readFileSync(captionsPath, 'utf8'));

  // Collect all absolute file paths for batch EXIF read
  const absFiles = [];
  for (const group of groups) {
    const files = Array.isArray(group.photos)
      ? group.photos.map(p => p.file ?? p)
      : (Array.isArray(group.photo) ? group.photo : (group.photo ? [group.photo] : []));
    files.forEach(f => absFiles.push(path.join(TRIP_DIR, person, f)));
  }
  const exifMap = readExifBatch(absFiles);

  tripData[person] = groups.map(group => {
    // Normalise to array of {file, ...overrides}
    const rawEntries = Array.isArray(group.photos)
      ? group.photos.map(p => typeof p === 'string' ? { file: p } : p)
      : (Array.isArray(group.photo) ? group.photo : (group.photo ? [group.photo] : [])).map(f => ({ file: f, extra: group.extra }));

    let groupDate = group.date ?? '';

    const photos = rawEntries.map((ph, idx) => {
      const absPath = path.join(TRIP_DIR, person, ph.file);
      const exif = exifMap[absPath] ?? {};
      const dt = parseDateTime(exif.DateTimeOriginal, exif.OffsetTimeOriginal, exif.GPSDateTime);
      if (!groupDate && idx === 0) groupDate = dt.date ?? '';

      // lat/lng: prefer captions.json override → EXIF
      const lat = ph.lat ?? (exif.GPSLatitude  ? +exif.GPSLatitude  : null);
      const lng = ph.lng ?? (exif.GPSLongitude ? +exif.GPSLongitude : null);
      const frac = ph.routeFrac ?? (lat != null && lng != null ? snapToRoute(lng, lat) : null);
      const time = ph.time ?? group.time ?? dt.time ?? '';

      const entry = { file: ph.file, time };
      if (ph.extra === true || ph.extra === 'true') entry.extra = true;
      if (dt.date && dt.date !== groupDate) entry.date = dt.date;
      if (lat  != null) entry.lat      = +lat.toFixed(6);
      if (lng  != null) entry.lng      = +lng.toFixed(6);
      if (frac != null) entry.routeFrac = frac;
      return entry;
    });

    return { caption: group.caption ?? '', date: groupDate, photos };
  });

  console.log(`  ${person}: ${absFiles.length} photo(s) across ${groups.length} group(s)`);
}

const js = `// Auto-generated by build.js — do not edit directly.\n// Re-run: node build.js\nwindow.TRIP_DATA = ${JSON.stringify(tripData, null, 2)};\n`;
fs.writeFileSync(OUT_FILE, js);
console.log(`\nBuilt trip-data.js  persons: ${Object.keys(tripData).join(', ') || '(none)'}`);
