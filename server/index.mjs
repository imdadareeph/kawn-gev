// Production server: serves the built front end and the /api handlers from one process.
// Binds to loopback by default. Exposing it beyond localhost needs an explicit host setting
// and a reviewed authentication proxy in front of it.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiMiddleware, hostAllowed } from './api.mjs';

const brand = JSON.parse(readFileSync(new URL('../brand.json', import.meta.url), 'utf8'));
const ENV = brand.slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
const HOST = process.env[`${ENV}_HOST`] ?? '127.0.0.1';
const PORT = Number.parseInt(process.env[`${ENV}_PORT`] ?? '8787', 10);
const DIST = join(fileURLToPath(new URL('..', import.meta.url)), 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://services.arcgisonline.com https://tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self' data: blob: https://services.arcgisonline.com https://tile.openstreetmap.org https://terrain.reearth.land https://api.cesium.com https://assets.ion.cesium.com https://*.cesium.com https://tile.googleapis.com https://api.adsb.lol https://photon.komoot.io",
  "worker-src 'self' blob:",
  "child-src blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const api = createApiMiddleware();

function serveStatic(req, res) {
  const url = new URL(req.url ?? '/', 'http://local');
  let rel = decodeURIComponent(url.pathname);
  if (rel.includes('\0')) rel = '/';
  let file = normalize(join(DIST, rel));
  if (file !== DIST && !file.startsWith(DIST + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    // Single-page app fallback only for extension-less paths.
    if (extname(rel)) {
      res.writeHead(404).end('Not found');
      return;
    }
    file = join(DIST, 'index.html');
  }
  if (!existsSync(file)) {
    res.writeHead(503, { 'Content-Type': 'text/plain' }).end('Build missing. Run: npm run build');
    return;
  }
  const ext = extname(file);
  const immutable = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(self), microphone=(), camera=()',
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  if (!hostAllowed(req.headers.host)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Forbidden host');
    return;
  }
  api(req, res, () => serveStatic(req, res));
}).listen(PORT, HOST, () => {
  console.log(`[${brand.slug}] serving http://${HOST}:${PORT}  (dist: ${DIST})`);
});
