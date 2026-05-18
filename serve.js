#!/usr/bin/env node
// launch with `node build.js && node serve.js --host 0.0.0.0
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html', '.js':   'application/javascript',
  '.json':'application/json',  '.css':  'text/css',
  '.jpeg':'image/jpeg',        '.jpg':  'image/jpeg',
  '.png': 'image/png',         '.gpx':  'application/gpx+xml',
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
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
});
