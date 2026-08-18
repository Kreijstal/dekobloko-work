#!/usr/bin/env node
'use strict';

// Round-trip check for the recording proxy's stream parser: whatever the JS5
// server frames onto the wire, the recorder must reconstruct byte-for-byte.
//
// The parser is the part of recording that can silently go wrong. It tracks
// block boundaries by counting bytes, so an off-by-one in the first block (512
// bytes, ten of them header) or in continuation blocks (511 after a 0xff
// marker) would still produce plausible-looking files.

const assert = require('assert');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const {startJs5Server} = require('./js5-server');
const {ResponseParser} = require('./js5-recorder');

function container(payload) {
  const head = Buffer.alloc(5);
  head.writeUInt32BE(payload.length, 1);
  return Buffer.concat([head, payload]);
}

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'js5-recorder-test-'));
  try {
    // Sizes chosen around the block boundaries: under one block, exactly one
    // block, one byte over, and several blocks.
    const payloads = new Map([
      ['0-0', container(Buffer.from('tiny'))],
      ['0-1', container(Buffer.alloc(497, 0xa1))],
      ['0-2', container(Buffer.alloc(498, 0xa2))],
      ['0-3', container(Buffer.alloc(499, 0xa3))],
      ['0-4', container(Buffer.alloc(4096, 0xa4))],
      ['2-70000', container(Buffer.alloc(20000, 0xa5))],
    ]);
    for (const [key, value] of payloads) {
      fs.writeFileSync(path.join(directory, `${key}.bin`), value);
    }

    const server = await startJs5Server({
      cacheDir: directory, port: 0, substitutes: new Map(),
    });
    try {
      const recorded = new Map();
      const parser = new ResponseParser((archiveId, groupId, bytes) => {
        recorded.set(`${archiveId}-${groupId}`, bytes);
      });

      const socket = net.createConnection({host: '127.0.0.1', port: server.port});
      await new Promise(resolve => socket.once('connect', resolve));
      let acknowledged = false;
      socket.on('data', chunk => {
        let rest = chunk;
        if (!acknowledged) {
          // The handshake acknowledgement precedes the response stream.
          rest = rest.subarray(1);
          acknowledged = true;
        }
        if (rest.length) parser.push(rest);
      });

      const revision = Buffer.alloc(4);
      revision.writeUInt32BE(26);
      socket.write(Buffer.concat([
        Buffer.from([12, 0, 0, 0, 0, 0, 0, 0, 15]), revision]));

      for (const key of payloads.keys()) {
        const [archiveId, groupId] = key.split('-').map(Number);
        const request = Buffer.alloc(6);
        request[0] = 1;
        request[1] = archiveId;
        request.writeUInt32BE(groupId, 2);
        socket.write(request);
      }

      const deadline = Date.now() + 10000;
      while (recorded.size < payloads.size && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      socket.destroy();

      assert.strictEqual(recorded.size, payloads.size,
        'every response is reconstructed as one container');
      for (const [key, expected] of payloads) {
        assert.deepStrictEqual(recorded.get(key), expected,
          `${key} round-trips through framing unchanged`);
      }
    } finally {
      server.close();
    }
    console.log('js5-recorder: all checks passed');
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
