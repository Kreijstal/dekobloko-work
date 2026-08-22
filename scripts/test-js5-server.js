#!/usr/bin/env node
'use strict';

// Self-contained checks for the local JS5 update server. Builds a synthetic
// main_file_cache on disk, serves it, and speaks the client half of the
// protocol back at it -- no game, no network, no downloaded cache.

const assert = require('assert');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const {startJs5Server, CacheStore, openStore, crc32} =
  require('./js5-server');

const SECTOR_SIZE = 520;

// --- a minimal cache writer, so the test owns its own fixtures --------------

function writeCache(directory, entries) {
  const dataPath = path.join(directory, 'main_file_cache.dat2');
  const indexes = new Map();
  const sectors = [];
  for (const [archiveId, groupId, payload] of entries) {
    const first = sectors.length + 1;
    let written = 0;
    let chunk = 0;
    while (written < payload.length) {
      const block = payload.subarray(written, written + 512);
      const sector = Buffer.alloc(SECTOR_SIZE);
      sector.writeUInt16BE(groupId, 0);
      sector.writeUInt16BE(chunk, 2);
      // The next-sector pointer is filled once we know whether more follow.
      sector[7] = archiveId;
      block.copy(sector, 8);
      sectors.push(sector);
      written += block.length;
      chunk += 1;
    }
    for (let index = first; index < sectors.length + 1; index += 1) {
      const isLast = index === sectors.length;
      sectors[index - 1].writeUIntBE(isLast ? 0 : index + 1, 4, 3);
    }
    if (!indexes.has(archiveId)) indexes.set(archiveId, []);
    indexes.get(archiveId).push({groupId, length: payload.length, first});
  }

  // Sector 0 is never referenced; the index encodes "no entry" as sector 0.
  const data = Buffer.concat([Buffer.alloc(SECTOR_SIZE), ...sectors]);
  fs.writeFileSync(dataPath, data);
  for (const [archiveId, records] of indexes) {
    const highest = Math.max(...records.map(record => record.groupId));
    const index = Buffer.alloc((highest + 1) * 6);
    for (const record of records) {
      index.writeUIntBE(record.length, record.groupId * 6, 3);
      index.writeUIntBE(record.first, record.groupId * 6 + 3, 3);
    }
    fs.writeFileSync(
      path.join(directory, `main_file_cache.idx${archiveId}`), index);
  }
}

function container(payload) {
  const head = Buffer.alloc(5);
  head.writeUInt32BE(payload.length, 1);
  return Buffer.concat([head, payload]);
}

// --- the client half of the protocol ---------------------------------------

function connect(port) {
  const socket = net.createConnection({host: '127.0.0.1', port});
  let buffer = Buffer.alloc(0);
  let waiter = null;
  let key = 0;
  const settle = () => {
    if (!waiter || buffer.length < waiter.count) return;
    const {count, resolve} = waiter;
    waiter = null;
    const taken = buffer.subarray(0, count);
    buffer = buffer.subarray(count);
    resolve(key ? Buffer.from(taken.map(byte => byte ^ key)) : taken);
  };
  socket.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    settle();
  });
  const read = count => new Promise(resolve => {
    waiter = {count, resolve};
    settle();
  });
  return {
    socket,
    read,
    setXorKey(value) { key = value; },
    ready: new Promise(resolve => socket.once('connect', resolve)),
  };
}

async function handshake(client, revision = 26) {
  await client.ready;
  client.socket.write(Buffer.concat([
    Buffer.from([12, 0, 0, 0, 0, 0, 0, 0, 15]),
    (() => { const b = Buffer.alloc(4); b.writeUInt32BE(revision); return b; })(),
  ]));
  assert.deepStrictEqual(await client.read(1), Buffer.from([0]),
    'the server acknowledges the JS5 handshake');
}

async function request(client, archiveId, groupId, priority = true) {
  const packet = Buffer.alloc(6);
  packet[0] = priority ? 1 : 0;
  packet[1] = archiveId;
  packet.writeUInt32BE(groupId, 2);
  client.socket.write(packet);

  const head = await client.read(10);
  assert.strictEqual(head[0], archiveId, 'the reply names the archive asked for');
  assert.strictEqual(head.readUInt32BE(1), groupId,
    'the reply names the group asked for');
  const compression = head[5] & 0x7f;
  const compressedLength = head.readUInt32BE(6);
  const total = compressedLength + (compression === 0 ? 0 : 4);

  // The first block carries 512 bytes of the packet, ten of which are header;
  // every later block is preceded by a 0xff marker.
  let body = Buffer.alloc(0);
  let remaining = total;
  const first = Math.min(remaining, 502);
  if (first > 0) {
    body = Buffer.concat([body, await client.read(first)]);
    remaining -= first;
  }
  while (remaining > 0) {
    const marker = await client.read(1);
    assert.strictEqual(marker[0], 0xff, 'continuation blocks carry the marker');
    const take = Math.min(remaining, 511);
    body = Buffer.concat([body, await client.read(take)]);
    remaining -= take;
  }
  return {compression, compressedLength, body, priorityFlag: head[5] & 0x80};
}

// --- the checks ------------------------------------------------------------

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'js5-server-test-'));
  try {
    // A group that fits one sector, one that spans several, and a group table
    // for each archive so the synthesized master index has something to cover.
    const small = container(Buffer.from('a small group payload'));
    const large = container(Buffer.from(
      Array.from({length: 5000}, (_, index) => index & 0xff)));
    const tableZero = container(Buffer.from([1, 2, 3]));
    const tableTwo = container(Buffer.from([4, 5, 6, 7]));
    writeCache(directory, [
      [0, 0, small],
      [2, 7, large],
      [255, 0, tableZero],
      [255, 2, tableTwo],
    ]);
    // idx255 must list three archives (0, 1, 2) so the master index reports a
    // count that includes an archive with no table of its own.
    const index255 = fs.readFileSync(
      path.join(directory, 'main_file_cache.idx255'));
    assert.strictEqual(index255.length, 18, 'idx255 covers archives 0 through 2');

    const store = new CacheStore(directory);
    assert.ok(store.available(), 'the synthetic cache is readable');
    assert.deepStrictEqual(store.read(0, 0), small,
      'a single-sector group round-trips through the cache reader');
    assert.deepStrictEqual(store.read(2, 7), large,
      'a multi-sector group round-trips through the cache reader');
    assert.strictEqual(store.read(2, 8), null,
      'an absent group reads as a miss, not as garbage');

    const server = await startJs5Server({
      cacheDir: directory, port: 0, substitutes: new Map(),
    });
    try {
      const client = connect(server.port);
      await handshake(client);

      const one = await request(client, 0, 0);
      assert.deepStrictEqual(
        Buffer.concat([Buffer.from([one.compression]),
          (() => { const b = Buffer.alloc(4);
            b.writeUInt32BE(one.compressedLength); return b; })(),
          one.body]),
        small, 'a served group is byte-identical to the cached container');

      const many = await request(client, 2, 7);
      assert.strictEqual(many.body.length, large.length - 5,
        'a multi-block response delivers every payload byte');
      assert.deepStrictEqual(many.body, large.subarray(5),
        'block framing does not corrupt or reorder the payload');

      // A miss must be answered. Silence leaves the client waiting on a reply
      // that never comes, holding the connection open until it times out and
      // reconnects ~30s later, forever -- which reads as a hang, not an error.
      const miss = await request(client, 2, 9);
      assert.strictEqual(miss.compressedLength, 0,
        'a missing group answers with an empty container');

      const nonPriority = await request(client, 0, 0, false);
      assert.strictEqual(nonPriority.priorityFlag, 0x80,
        'the reply echoes the request priority in its flag byte');

      // The master index is never stored; a real server computes it live.
      const master = await request(client, 255, 255);
      assert.strictEqual(master.compression, 0,
        'the synthesized master index is an uncompressed container');
      assert.strictEqual(master.body.length, 1 + 3 * 72,
        'the master index covers every archive idx255 lists');
      assert.strictEqual(master.body[0], 3, 'the archive count leads the body');
      assert.strictEqual(master.body.readUInt32BE(1), crc32(tableZero),
        'archive 0 is vouched for by the CRC of its group table');
      assert.strictEqual(master.body.readUInt32BE(1 + 72), 0,
        'an archive with no group table records a zero CRC');
      assert.strictEqual(master.body.readUInt32BE(1 + 2 * 72), crc32(tableTwo),
        'archive 2 is vouched for by the CRC of its group table');

      // Opcode 4 switches on a stream XOR. Storing the key but sending
      // plaintext makes the client decode garbage and drop the connection.
      const key = 0x5a;
      const keyPacket = Buffer.alloc(6);
      keyPacket[0] = 4;
      keyPacket[1] = key;
      client.socket.write(keyPacket);
      client.setXorKey(key);
      const scrambled = await request(client, 2, 7);
      assert.deepStrictEqual(scrambled.body, large.subarray(5),
        'an XOR-keyed stream carries the same payload as a plain one');

      client.socket.destroy();
    } finally {
      server.close();
    }

    // A substitute stands in only where the cache has nothing.
    const substitute = Buffer.from([0, 0, 0, 0, 4, 9, 9, 9, 9]);
    const withSubstitute = await startJs5Server({
      cacheDir: directory, port: 0,
      substitutes: new Map([['6/1', substitute], ['0/0', substitute]]),
    });
    try {
      const client = connect(withSubstitute.port);
      await handshake(client);
      const served = await request(client, 6, 1);
      assert.deepStrictEqual(served.body, substitute.subarray(5),
        'a substitute is served for a group the cache does not have');
      const cached = await request(client, 0, 0);
      assert.deepStrictEqual(cached.body, small.subarray(5),
        'a cached group is never displaced by a substitute');
      client.socket.destroy();
    } finally {
      withSubstitute.close();
    }

    // Chaining is what makes a partial recording useful: the index layer and
    // the bulk data usually live in different directories.
    const indexOnly = fs.mkdtempSync(path.join(os.tmpdir(), 'js5-index-'));
    const master = container(Buffer.from([9, 9, 9]));
    fs.writeFileSync(path.join(indexOnly, '255-255.bin'), master);
    const chained = openStore([indexOnly, directory]);
    assert.deepStrictEqual(chained.read(255, 255), master,
      'the first directory answers what it has');
    assert.deepStrictEqual(chained.read(2, 7), large,
      'the later directory answers what the first lacks');
    assert.strictEqual(chained.read(2, 9), null,
      'a group in neither directory is still a miss');

    const chainServer = await startJs5Server({
      cacheDir: [indexOnly, directory], port: 0, substitutes: new Map(),
    });
    try {
      const client = connect(chainServer.port);
      await handshake(client);
      const served = await request(client, 255, 255);
      assert.deepStrictEqual(served.body, master.subarray(5),
        'a stored master index is served in place of a synthesized one');
      client.socket.destroy();
    } finally {
      chainServer.close();
      fs.rmSync(indexOnly, {recursive: true, force: true});
    }

    console.log('js5-server: all checks passed');
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
