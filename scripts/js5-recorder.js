#!/usr/bin/env node
'use strict';

// Recording JS5 proxy: forwards a client's update-server connection to the
// real server and writes every group the server returns to disk, so a later
// run can be served entirely from local files.
//
// This exists because the two other ways to obtain a cache both fall short.
// The client's own on-disk cache is not enough -- it never persists the master
// index (255/255), which it fetches and validates in memory every boot, and it
// only stores what it happened to need. And the standalone sweep in
// tools/js5/download-caches.py walks the archives independently of any client,
// which desynchronizes against the live mirror partway through.
//
// Recording sidesteps both: whatever a real boot asked for and received is
// exactly what a replay needs, master index included.
//
// Responses are self-describing -- each carries its own archive and group in
// the header -- so the recorder never has to match replies to requests. That
// matters because the server answers from separate priority and normal queues
// and may interleave them.

const net = require('net');
const fs = require('fs');
const path = require('path');

function groupFileName(archiveId, groupId) {
  return `${archiveId}-${groupId}.bin`;
}

// Parses the server->client half of a JS5 stream, emitting whole containers.
class ResponseParser {
  constructor(onGroup) {
    this.onGroup = onGroup;
    this.buffer = Buffer.alloc(0);
    this.state = 'header';
    this.current = null;
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      if (this.state === 'header') {
        if (this.buffer.length < 10) return;
        const head = this.buffer.subarray(0, 10);
        const compression = head[5] & 0x7f;
        const compressedLength = head.readUInt32BE(6);
        this.current = {
          archiveId: head[0],
          groupId: head.readUInt32BE(1),
          compression,
          // The container the client reconstructs is the compression byte, the
          // length, and the payload -- the archive/group/flags framing is
          // transport only.
          header: Buffer.concat([
            Buffer.from([compression]), head.subarray(6, 10)]),
          remaining: compressedLength + (compression === 0 ? 0 : 4),
          blocks: [],
          // Ten of the first block's 512 bytes are the header just consumed.
          blockRemaining: 502,
        };
        this.buffer = this.buffer.subarray(10);
        this.state = 'body';
        continue;
      }

      const wanted = Math.min(this.current.remaining, this.current.blockRemaining);
      if (wanted > 0) {
        if (this.buffer.length < 1) return;
        const take = Math.min(wanted, this.buffer.length);
        this.current.blocks.push(this.buffer.subarray(0, take));
        this.buffer = this.buffer.subarray(take);
        this.current.remaining -= take;
        this.current.blockRemaining -= take;
        if (this.current.remaining === 0) {
          this.finish();
          continue;
        }
        if (this.current.blockRemaining > 0) return;
      }
      if (this.current.remaining === 0) {
        this.finish();
        continue;
      }
      // Block boundary: a 0xff marker precedes each continuation block.
      if (this.buffer.length < 1) return;
      if (this.buffer[0] !== 0xff) {
        throw new Error(`js5 stream desynchronized at block marker ` +
          `0x${this.buffer[0].toString(16)} for ` +
          `${this.current.archiveId}/${this.current.groupId}`);
      }
      this.buffer = this.buffer.subarray(1);
      this.current.blockRemaining = 511;
    }
  }

  finish() {
    const {archiveId, groupId, header, blocks} = this.current;
    this.onGroup(archiveId, groupId,
      Buffer.concat([header, ...blocks]));
    this.current = null;
    this.state = 'header';
  }
}

function startJs5RecordingProxy({remoteHost, remotePort = 43594, port = 0,
  host = '127.0.0.1', outDir, log = () => {}} = {}) {
  fs.mkdirSync(outDir, {recursive: true});
  const sockets = new Set();
  const written = new Set();
  let bytes = 0;

  const server = net.createServer((client) => {
    const upstream = net.createConnection({host: remoteHost, port: remotePort});
    sockets.add(client);
    sockets.add(upstream);

    let xorKey = 0;
    let clientHandshakeRemaining = 13;  // 8 preamble + 1 opcode + 4 revision
    let responseStarted = false;
    let serverAckRemaining = 1;
    const parser = new ResponseParser((archiveId, groupId, container) => {
      const name = groupFileName(archiveId, groupId);
      if (written.has(name)) return;
      written.add(name);
      bytes += container.length;
      fs.writeFileSync(path.join(outDir, name), container);
      log(`[js5-record] ${archiveId}/${groupId} ${container.length}B`);
    });

    client.on('data', (chunk) => {
      upstream.write(chunk);
      let rest = chunk;
      if (clientHandshakeRemaining > 0) {
        const skip = Math.min(clientHandshakeRemaining, rest.length);
        clientHandshakeRemaining -= skip;
        rest = rest.subarray(skip);
      }
      // Opcode 4 turns on a stream XOR that applies to everything the server
      // sends afterwards, framing markers included.
      for (let index = 0; index + 6 <= rest.length; index += 6) {
        if (rest[index] === 4) xorKey = rest[index + 1];
      }
    });

    upstream.on('data', (chunk) => {
      client.write(chunk);
      let rest = chunk;
      if (serverAckRemaining > 0) {
        // The single handshake acknowledgement byte precedes the stream and is
        // never XORed.
        const skip = Math.min(serverAckRemaining, rest.length);
        serverAckRemaining -= skip;
        rest = rest.subarray(skip);
      }
      if (rest.length === 0) return;
      const plain = xorKey
        ? Buffer.from(rest.map((byte) => byte ^ xorKey)) : rest;
      try {
        parser.push(plain);
        responseStarted = true;
      } catch (error) {
        // A desynchronized parse must not break the game being proxied: stop
        // recording this connection and keep forwarding bytes untouched.
        log(`[js5-record] recording stopped: ${error.message}`);
        parser.push = () => {};
      }
    });

    const close = () => {
      sockets.delete(client);
      sockets.delete(upstream);
      client.destroy();
      upstream.destroy();
    };
    client.on('error', close);
    upstream.on('error', close);
    client.on('close', close);
    upstream.on('close', close);
    void responseStarted;
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      log(`[js5-record] ${host}:${server.address().port} -> ` +
        `${remoteHost}:${remotePort}, writing ${outDir}`);
      resolve({
        port: server.address().port,
        get groupCount() { return written.size; },
        get byteCount() { return bytes; },
        close: () => {
          for (const socket of sockets) socket.destroy();
          server.close();
        },
      });
    });
  });
}

module.exports = {startJs5RecordingProxy, ResponseParser, groupFileName};

if (require.main === module) {
  const args = process.argv.slice(2);
  let outDir = null;
  let port = 43594;
  let remoteHost = 'mgg-server.alterorb.net';
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--out') outDir = args[++index];
    else if (args[index] === '--port') port = Number(args[++index]);
    else if (args[index] === '--remote') remoteHost = args[++index];
    else {
      console.error(`unknown argument: ${args[index]}`);
      process.exit(2);
    }
  }
  if (!outDir) {
    console.error('usage: js5-recorder.js --out <dir> [--port N] [--remote H]');
    process.exit(2);
  }
  startJs5RecordingProxy({remoteHost, port, outDir,
    log: (line) => console.error(line)}).catch((error) => {
    console.error(`js5-recorder failed: ${error.message}`);
    process.exit(1);
  });
}
