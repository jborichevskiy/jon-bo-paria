#!/usr/bin/env node
// launch with `node build.js && node serve.js --host 0.0.0.0
// Editor lives at http://localhost:8080/editor.html
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
  '.png': 'image/png',         '.gpx':  'application/gpx+xml',
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

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Serving at http://localhost:${PORT}/`);
  console.log(`Editor:     http://localhost:${PORT}/editor.html`);
});
