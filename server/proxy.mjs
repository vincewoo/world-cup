// ── PRODUCTION PROXY + STATIC SERVER ─────────────────────────────────────────
// The football-data.org API needs the key in an `X-Auth-Token` header and sends
// no CORS headers, so the browser can't call it directly. In dev the Vite proxy
// (vite.config.ts) handles this; this file is the production equivalent.
//
// It does two jobs with zero dependencies (Node 18+ global `fetch`):
//   1. forwards `/api/football-data/*` to the real API, injecting the token
//      server-side (identical rewrite + header to the dev proxy), and
//   2. serves the built SPA from ../dist with an index.html fallback.
//
// Run after building:  FOOTBALL_DATA_TOKEN=… npm run build && npm run proxy
// Without a token the API returns 4xx and the client degrades to seeded data.
// ─────────────────────────────────────────────────────────────────────────────

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT) || 8080;
const TOKEN = process.env.FOOTBALL_DATA_TOKEN || '';
const DIST = fileURLToPath(new URL('../dist', import.meta.url));

// Upstreams proxied under /api/*. football-data needs a token header; the
// Polymarket Gamma API is public (no key) — both just sidestep CORS. The
// Polymarket host must be on the network egress allowlist for fetches to land.
const UPSTREAMS = [
  {
    prefix: '/api/football-data',
    base: 'https://api.football-data.org/v4',
    headers: TOKEN ? { Accept: 'application/json', 'X-Auth-Token': TOKEN } : { Accept: 'application/json' },
  },
  {
    prefix: '/api/polymarket',
    base: 'https://gamma-api.polymarket.com',
    headers: { Accept: 'application/json' },
  },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

// Forward an /api/* request to its upstream, injecting that upstream's headers.
async function proxyApi(req, res, path, up) {
  const target = up.base + path.slice(up.prefix.length);
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: up.headers,
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Upstream fetch failed', detail: String(err?.message || err) }));
  }
}

// Serve a static file from dist, falling back to index.html for SPA routes.
async function serveStatic(req, res, urlPath) {
  // Resolve safely inside DIST (block path traversal).
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(DIST, rel === '/' || rel === '' ? 'index.html' : rel);
  if (!filePath.startsWith(DIST)) filePath = join(DIST, 'index.html');

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    // SPA fallback: any unmatched, extension-less path serves index.html.
    if (extname(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    try {
      const html = await readFile(join(DIST, 'index.html'));
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      res.end(html);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Build not found — run `npm run build` first.');
    }
  }
}

const server = createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  const up = UPSTREAMS.find((u) => urlPath === u.prefix || urlPath.startsWith(u.prefix + '/'));
  if (up) {
    void proxyApi(req, res, req.url || up.prefix, up);
  } else {
    void serveStatic(req, res, urlPath);
  }
});

server.listen(PORT, () => {
  console.log(`wc2026 proxy + static server on http://localhost:${PORT}`);
  console.log(TOKEN ? 'football-data.org token: set' : 'football-data.org token: NOT set (live feed will fall back to seeded data)');
});
