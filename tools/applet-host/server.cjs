#!/usr/bin/env node
'use strict';
// Single-applet browser host with a telemetry collector.
//
//   node tools/applet-host/server.cjs <Applet.java> [java-tools/dist] [port] [telemetry.jsonl]
//
// Serves index.html, the applet source (re-read on every request so edits
// propagate without a restart), the java-tools browser bundle and its lazy
// chunks under /jvm-assets/, and collects the page's diagnostics as one JSON
// line per event in the telemetry file, the way blank-github-cloner's dev
// server does for GeoBlox. Binds 127.0.0.1 by default; set HOST=0.0.0.0 to
// expose it on the LAN.
const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');

const [, , sourceArg, distArg, portArg, telemetryArg] = process.argv;
if (!sourceArg) {
  console.error('usage: server.cjs <Applet.java> [java-tools/dist] [port] [telemetry.jsonl]');
  process.exit(2);
}
const sourcePath = path.resolve(sourceArg);
const distDir = path.resolve(distArg || path.join(__dirname, '..', '..', '..', 'java-tools', 'dist'));
const port = Number(portArg || 18201);
const host = process.env.HOST || '127.0.0.1';
const telemetryPath = path.resolve(telemetryArg ||
  path.join(__dirname, '..', '..', '.work', 'telemetry', 'applet-host.jsonl'));
const mainClass = path.basename(sourcePath, '.java');
const prefix = (process.env.APPLET_HOST_PREFIX || '').replace(/\/+$/, '');
const hostDir = __dirname;

fs.mkdirSync(path.dirname(telemetryPath), { recursive: true });
for (const required of ['jvm-debug.js', 'jvm-compile-worker.js']) {
  if (!fs.existsSync(path.join(distDir, required))) {
    console.error(`missing ${path.join(distDir, required)}; build java-tools first`);
    process.exit(2);
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.java': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
};

function send(response, status, body, type = 'text/plain; charset=utf-8', extra = {}) {
  response.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    ...extra,
  });
  response.end(body);
}

// Gzip cache for the big bundle assets: the tunnel is slow, and the 2.5 MB
// runtime + 1.9 MB compile worker shrink about 4x. Keyed by path + mtime.
const gzipCache = new Map();
function gzipped(filePath, stat) {
  const key = `${filePath}:${stat.mtimeMs}:${stat.size}`;
  let entry = gzipCache.get(key);
  if (!entry) {
    entry = zlib.gzipSync(fs.readFileSync(filePath), { level: 6 });
    gzipCache.set(key, entry);
    for (const other of gzipCache.keys()) {
      if (other !== key && other.startsWith(`${filePath}:`)) gzipCache.delete(other);
    }
  }
  return entry;
}

function sendFile(request, response, filePath) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (_error) {
    send(response, 404, `not found: ${path.basename(filePath)}\n`);
    return;
  }
  if (!stat.isFile()) {
    send(response, 404, 'not found\n');
    return;
  }
  const headers = {
    'content-type': TYPES[path.extname(filePath)] || 'application/octet-stream',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    vary: 'accept-encoding',
  };
  const acceptsGzip = /\bgzip\b/.test(String(request.headers['accept-encoding'] || ''));
  if (acceptsGzip && stat.size > 16 * 1024 && /\.(js|mjs|map|json|java|txt|html|css)$/.test(filePath)) {
    const body = gzipped(filePath, stat);
    response.writeHead(200, { ...headers, 'content-encoding': 'gzip', 'content-length': body.length });
    response.end(request.method === 'HEAD' ? undefined : body);
    return;
  }
  response.writeHead(200, { ...headers, 'content-length': stat.size });
  if (request.method === 'HEAD') { response.end(); return; }
  fs.createReadStream(filePath).pipe(response);
}

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size <= limit) chunks.push(chunk);
    });
    request.on('end', () => {
      if (size > limit) reject(new Error(`payload too large (${size} bytes)`));
      else resolve(Buffer.concat(chunks));
    });
    request.on('error', reject);
  });
}

let telemetryCount = 0;
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  // APPLET_HOST_PREFIX=/pf mounts the whole host under that prefix (the page
  // uses relative URLs, so only the server needs to know).
  if (prefix) {
    if (pathname === prefix) {
      response.writeHead(302, { location: `${prefix}/${url.search}` });
      response.end();
      return;
    }
    if (!pathname.startsWith(`${prefix}/`)) {
      send(response, 404, `not found (host is mounted at ${prefix}/)\n`);
      return;
    }
    pathname = pathname.slice(prefix.length) || '/';
  }
  const remote = request.headers['x-forwarded-for'] || request.socket.remoteAddress || null;

  if (pathname === '/api/telemetry') {
    if (request.method === 'OPTIONS') {
      send(response, 204, '', 'text/plain', {
        'access-control-allow-methods': 'POST, GET, OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      return;
    }
    if (request.method === 'GET') {
      // Tail for a quick look from a browser or curl.
      let text = '';
      try { text = fs.readFileSync(telemetryPath, 'utf8'); } catch (_error) { /* none yet */ }
      const lines = text.trimEnd().split('\n').filter(Boolean);
      const limit = Number(url.searchParams.get('limit') || 50);
      send(response, 200, `${lines.slice(-limit).join('\n')}\n`, 'application/x-ndjson; charset=utf-8');
      return;
    }
    if (request.method !== 'POST') {
      send(response, 405, 'POST required\n');
      return;
    }
    try {
      const body = await readBody(request, 4 * 1024 * 1024);
      const payload = JSON.parse(body.toString('utf8'));
      const events = Array.isArray(payload) ? payload : [payload];
      const stamp = new Date().toISOString();
      const userAgent = request.headers['user-agent'] || null;
      const lines = events.map((event) => JSON.stringify({
        receivedAt: stamp, remote, userAgent, ...event,
      }));
      fs.appendFileSync(telemetryPath, `${lines.join('\n')}\n`);
      telemetryCount += events.length;
      for (const event of events) {
        const summary = event.event === 'stdout' || event.event === 'stderr'
          ? String(event.details && event.details.text || '').trimEnd().split('\n').slice(0, 3).join(' | ')
          : JSON.stringify(event.details || {}).slice(0, 160);
        console.log(`[telemetry] ${stamp} ${event.session || '-'} ${event.event} ${summary}`);
      }
      send(response, 204, '');
    } catch (error) {
      send(response, 400, `${error.message}\n`);
    }
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    send(response, 405, 'GET only\n');
    return;
  }
  if (pathname === '/' || pathname === '/index.html') {
    const html = fs.readFileSync(path.join(hostDir, 'index.html'), 'utf8')
      .replaceAll('__MAIN_CLASS__', mainClass)
      .replaceAll('__SOURCE_NAME__', path.basename(sourcePath));
    send(response, 200, html, TYPES['.html']);
    return;
  }
  if (pathname === `/${path.basename(sourcePath)}` || pathname === '/source') {
    sendFile(request, response, sourcePath);
    return;
  }
  if (pathname === '/compile-worker.js') {
    sendFile(request, response, path.join(hostDir, 'compile-worker.js'));
    return;
  }
  if (pathname.startsWith('/jvm-assets/')) {
    const name = path.basename(pathname);
    if (name.includes('..')) { send(response, 400, 'bad path\n'); return; }
    sendFile(request, response, path.join(distDir, name));
    return;
  }
  if (pathname === '/api/info') {
    // Every script the page needs, so it can fetch each exactly once (with
    // retries) and hand the sources to its workers instead of letting them
    // fetch over the tunnel themselves.
    const assets = fs.readdirSync(distDir)
      .filter((name) => /^(\d+\.)?jvm-debug\.js$/.test(name) || name === 'jvm-compile-worker.js')
      .sort((a, b) => (a === 'jvm-debug.js' ? -1 : b === 'jvm-debug.js' ? 1 : a.localeCompare(b)));
    send(response, 200, JSON.stringify({
      mainClass, source: sourcePath, dist: distDir, telemetry: telemetryPath,
      telemetryEventsThisProcess: telemetryCount, assets,
    }, null, 2), TYPES['.json']);
    return;
  }
  send(response, 404, 'not found\n');
});

server.listen(port, host, () => {
  console.log(`applet-host: ${mainClass} from ${sourcePath}`);
  console.log(`applet-host: bundle ${distDir}`);
  console.log(`applet-host: telemetry -> ${telemetryPath}`);
  console.log(`applet-host: http://${host}:${port}${prefix}/`);
});
