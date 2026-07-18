#!/usr/bin/env node
'use strict';

// Logging TCP proxy for the JS5 update-server connection. Sits on a local
// port and forwards to the real server, logging every segment in the same
// format as java-tools' JVM_DEBUG_SOCKET so a real-JRE run and a jvm.js run
// produce directly diffable protocol traces (with millisecond timestamps for
// timing analysis, e.g. watchdog-induced reconnects).
//
//   node scripts/js5-proxy.js [--listen 43594] [--target mgg-server.alterorb.net:43594] [--log out.log]

const net = require('net');
const fs = require('fs');

const args = process.argv.slice(2);
let listenPort = 43594;
let target = 'mgg-server.alterorb.net:43594';
let logFile = null;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--listen') listenPort = Number(args[++i]);
  else if (args[i] === '--target') target = args[++i];
  else if (args[i] === '--log') logFile = args[++i];
}
const [targetHost, targetPort] = target.split(':');

const logStream = logFile ? fs.createWriteStream(logFile) : null;
const t0 = Date.now();
function log(line) {
  const stamped = `+${String(Date.now() - t0).padStart(7)}ms ${line}`;
  console.error(stamped);
  if (logStream) logStream.write(stamped + '\n');
}

function hexHead(buf) {
  const head = buf.subarray(0, 32).toString('hex').replace(/(..)/g, '$1 ').trim();
  return `${buf.length}B: ${head}${buf.length > 32 ? ' …' : ''}`;
}

let nextId = 0;
const server = net.createServer((client) => {
  const id = nextId++;
  log(`[socket ${id} open] from ${client.remoteAddress}`);
  const upstream = net.connect(Number(targetPort), targetHost);
  client.on('data', (chunk) => { log(`[socket ${id} send] ${hexHead(chunk)}`); upstream.write(chunk); });
  upstream.on('data', (chunk) => { log(`[socket ${id} recv] ${hexHead(chunk)}`); client.write(chunk); });
  const closeBoth = (who) => {
    log(`[socket ${id} closed] by ${who}`);
    client.destroy();
    upstream.destroy();
  };
  client.on('close', () => closeBoth('client'));
  upstream.on('close', () => closeBoth('server'));
  client.on('error', () => {});
  upstream.on('error', (e) => log(`[socket ${id} upstream-error] ${e.message}`));
});

server.listen(listenPort, '127.0.0.1', () => {
  log(`js5-proxy listening on 127.0.0.1:${listenPort} -> ${targetHost}:${targetPort}`);
});
