#!/usr/bin/env node
// Launch with `node serve.js`. Reads/writes content.json (the single source of truth).
// Map:    http://localhost:8080/   (paria-trip-map.html — reads content.json directly)
// Editor: http://localhost:8080/editor.html
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;
const CONTENT  = path.join(ROOT, 'content.json');
const BACKUPS  = path.join(ROOT, 'content-backups');

const MIME = {
  '.html': 'text/html', '.js':   'application/javascript',
  '.json':'application/json',  '.css':  'text/css',
  '.jpeg':'image/jpeg',        '.jpg':  'image/jpeg',
  '.png': 'image/png',         '.svg':  'image/svg+xml',
  '.gpx': 'application/gpx+xml',
  // Shared-album "HEIC" exports are actually JPEG bytes — serve them as such so browsers render them.
  '.heic':'image/jpeg',
  '.mov': 'video/quicktime',   '.mp4':  'video/mp4',
};

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

// Save content.json, first backing up the previous version (timestamped).
function saveContent(body, res) {
  let parsed;
  try { parsed = JSON.parse(body); }
  catch (e) { return sendJSON(res, 400, { error: 'invalid JSON: ' + e.message }); }

  if (fs.existsSync(CONTENT)) {
    fs.mkdirSync(BACKUPS, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(CONTENT, path.join(BACKUPS, `content.${ts}.json`));
  }
  fs.writeFileSync(CONTENT, JSON.stringify(parsed, null, 2));
  sendJSON(res, 200, { ok: true, photos: (parsed.photos || []).length });
}

http.createServer((req, res) => {
  const urlPath0 = decodeURIComponent(req.url.split('?')[0]);

  // ── API ──────────────────────────────────────────────────────────────────
  if (urlPath0 === '/api/content' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => saveContent(body, res));
    return;
  }
  if (urlPath0 === '/api/content' && req.method === 'GET') {
    return fs.readFile(CONTENT, (err, d) =>
      err ? sendJSON(res, 404, { error: 'no content.json — run `node build_content.js`' })
          : (res.writeHead(200, { 'Content-Type': 'application/json' }), res.end(d)));
  }
  if (urlPath0 === '/api/images' && req.method === 'GET') {
    // list available exported image files, for the "add photo" picker
    return fs.readdir(path.join(ROOT, 'output'), (err, files) =>
      sendJSON(res, 200, (files || []).filter((f) => /\.(jpe?g|heic|png)$/i.test(f)).sort()));
  }

  // ── Static files ───────────────────────────────────────────────────────────
  let urlPath = urlPath0;
  if (urlPath === '/') urlPath = '/paria-trip-map.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end(); }

  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] ?? 'application/octet-stream' };
    // content.json is the live source of truth — never let the browser serve a stale copy.
    if (urlPath.endsWith('content.json')) headers['Cache-Control'] = 'no-store';

    // Safari (and HTML5 video generally) requires proper HTTP range support — it opens
    // media with `Range: bytes=0-1` and needs a 206 + Accept-Ranges/Content-Range back,
    // otherwise it shows a black player with no duration. Serve ranges for everything.
    headers['Accept-Ranges'] = 'bytes';
    const range = req.headers.range;
    const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m && (m[1] !== '' || m[2] !== '')) {
      let start = m[1] === '' ? null : parseInt(m[1], 10);
      let end   = m[2] === '' ? null : parseInt(m[2], 10);
      if (start === null) { start = Math.max(0, stat.size - end); end = stat.size - 1; } // suffix range
      if (end === null || end >= stat.size) end = stat.size - 1;
      if (start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        return res.end();
      }
      headers['Content-Range']  = `bytes ${start}-${end}/${stat.size}`;
      headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers);
      return fs.createReadStream(filePath, { start, end }).pipe(res);
    }

    headers['Content-Length'] = stat.size;
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
}).listen(PORT, () => {
  console.log(`Serving at http://localhost:${PORT}/`);
  console.log(`Editor:     http://localhost:${PORT}/editor.html`);
});
