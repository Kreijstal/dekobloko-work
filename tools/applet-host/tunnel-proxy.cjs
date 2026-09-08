#!/usr/bin/env node
'use strict';
// Host-rewriting reverse proxy / router for exposing local servers through
// one tunnel without restarting them.
//
//   node tools/applet-host/tunnel-proxy.cjs <listenPort> <targetPort> [options]
//     --route <prefix>=<port>     send paths under <prefix> to another local port
//                                 (the prefix is kept; that server mounts itself there)
//     --default-query <k>=<v>     redirect a bare "/" to "/?k=v" (e.g. jvm=local)
//
// Vite refuses requests whose Host header is not in server.allowedHosts (a
// tunnel hostname never is), so the default target gets the Host header
// rewritten to its own name. WebSocket upgrades are tunnelled too, so Vite's
// HMR client does not spin on reconnects. Binds 127.0.0.1 only, and logs one
// line per non-asset request to stdout.
const http = require('http');
const net = require('net');

const args = process.argv.slice(2);
const positional = [];
const routes = [];
const handlers = [];
let defaultQuery = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--route') {
    const [prefix, port] = String(args[++i]).split('=');
    routes.push({ prefix: prefix.replace(/\/+$/, ''), port: Number(port) });
  } else if (args[i] === '--default-query') {
    defaultQuery = String(args[++i]);
  } else if (args[i] === '--handler') {
    // --handler /api/x=/path/to/module.cjs: serve that path from the module's
    // exported `handle(request, response)` instead of forwarding it.
    const spec = String(args[++i]);
    const at = spec.indexOf('=');
    handlers.push({ prefix: spec.slice(0, at), handle: require(require('path').resolve(spec.slice(at + 1))).handle });
  } else {
    positional.push(args[i]);
  }
}
const [listenArg, targetArg, targetHostArg] = positional;
if (!listenArg || !targetArg) {
  console.error('usage: tunnel-proxy.cjs <listenPort> <targetPort> [targetHost] [--route /prefix=port] [--default-query k=v]');
  process.exit(2);
}
const listenPort = Number(listenArg);
const targetPort = Number(targetArg);
const targetHost = targetHostArg || '127.0.0.1';

function targetFor(pathname) {
  for (const route of routes) {
    if (pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)) {
      return { port: route.port, host: '127.0.0.1', hostHeader: `127.0.0.1:${route.port}`, label: route.prefix };
    }
  }
  return { port: targetPort, host: targetHost, hostHeader: `localhost:${targetPort}`, label: '/' };
}

const server = http.createServer((request, response) => {
  const startedAt = Date.now();
  const url = new URL(request.url || '/', 'http://localhost');
  const forwardedFor = request.headers['x-forwarded-for'] || request.socket.remoteAddress;
  if (defaultQuery && url.pathname === '/' && !url.searchParams.has(defaultQuery.split('=')[0])) {
    url.searchParams.set(...defaultQuery.split('='));
    response.writeHead(302, { location: `/${url.search}`, 'cache-control': 'no-store' });
    response.end();
    console.log(`${new Date().toISOString()} ${forwardedFor} ${request.method} ${request.url} -> 302 /${url.search}`);
    return;
  }
  const handler = handlers.find((entry) => url.pathname === entry.prefix || url.pathname.startsWith(`${entry.prefix}/`));
  if (handler) {
    response.on('finish', () => {
      console.log(`${new Date().toISOString()} ${forwardedFor} ${request.method} ${request.url} -> [handler] ${response.statusCode} ${Date.now() - startedAt}ms`);
    });
    handler.handle(request, response);
    return;
  }
  const target = targetFor(url.pathname);
  const headers = { ...request.headers, host: target.hostHeader, 'x-forwarded-for': forwardedFor };
  const upstream = http.request({
    host: target.host, port: target.port, method: request.method, path: request.url, headers,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode, upstreamResponse.headers);
    upstreamResponse.pipe(response);
    upstreamResponse.on('end', () => {
      if (!/\.(js|mjs|ts|tsx|map|css|svg|png|ico|bin)(\?|$)/.test(request.url) || upstreamResponse.statusCode >= 400) {
        console.log(`${new Date().toISOString()} ${forwardedFor} ${request.method} ${request.url} -> [${target.label}] ${upstreamResponse.statusCode} ${Date.now() - startedAt}ms`);
      }
    });
  });
  upstream.on('error', (error) => {
    console.log(`${new Date().toISOString()} ${forwardedFor} ${request.method} ${request.url} -> [${target.label}] upstream error ${error.message}`);
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'text/plain' });
    response.end(`upstream error: ${error.message}\n`);
  });
  request.pipe(upstream);
});

server.on('upgrade', (request, socket, head) => {
  const target = targetFor(new URL(request.url || '/', 'http://localhost').pathname);
  const upstream = net.connect(target.port, target.host, () => {
    const lines = [`${request.method} ${request.url} HTTP/1.1`];
    for (const [name, value] of Object.entries(request.headers)) {
      lines.push(`${name}: ${name === 'host' ? target.hostHeader : value}`);
    }
    upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});

server.listen(listenPort, '127.0.0.1', () => {
  console.log(`tunnel-proxy: 127.0.0.1:${listenPort} -> ${targetHost}:${targetPort}` +
    routes.map((route) => `, ${route.prefix}/* -> 127.0.0.1:${route.port}`).join('') +
    handlers.map((entry) => `, ${entry.prefix} -> local handler`).join('') +
    (defaultQuery ? `, "/" redirects to "/?${defaultQuery}"` : ''));
});
