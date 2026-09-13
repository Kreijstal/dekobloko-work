#!/usr/bin/env node
'use strict';

// Game-agnostic JS5 update server.
//
// The AlterOrb/FunOrb gamepacks fetch every asset over the Jagex JS5 protocol
// from a remote update server. This serves the same protocol from a local
// main_file_cache directory instead, so a game can boot with no network at all.
//
// It is deliberately not tied to one game: the only per-game input is which
// cache directory to read.
//
// The 13-byte handshake is [12][17][build:u16][server:u16][lang:u8][15]
// [gamecrc:u32]. The build revision does not identify the game -- the 44
// validated builds collide into 31 distinct values -- but the trailing gamecrc
// does: it is the per-game `gamecrc` in the AlterOrb launcher config. Pass
// --game-crc and the server refuses a connection from a different game instead
// of answering it out of the wrong cache, which a client cannot detect and
// which strands it on a blank screen. Still run one server per game.
//
//   node scripts/js5-server.js --cache-dir <dir> [--port 43594] [--host 127.0.0.1]
//                              [--game-crc <n>]
//
// Also exports startJs5Server() for callers that embed it (see
// launch-alterorb-games-jvmjs.js).

const net = require('net');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SECTOR_SIZE = 520;
const MAX_ENTRY_SIZE = 100000000;

// --- cache reading ---------------------------------------------------------

class CacheStore {
  constructor(cacheDir) {
    this.cacheDir = cacheDir;
    this.dataPath = path.join(cacheDir, 'main_file_cache.dat2');
  }

  available() {
    return fs.existsSync(this.dataPath);
  }

  archiveCount() {
    // The master index is never stored; a real server computes it live from the
    // per-archive group tables, and idx255 is what says how many there are.
    try {
      return Math.floor(
        fs.statSync(path.join(this.cacheDir, 'main_file_cache.idx255')).size / 6);
    } catch (error) {
      return 0;
    }
  }

  // Which archives this cache actually holds bytes for, with the group ids it
  // stores for each. Used to check a chained index layer describes this data
  // and not some other game's.
  storedArchives() {
    const archives = new Map();
    let names;
    try {
      names = fs.readdirSync(this.cacheDir);
    } catch (error) {
      return archives;
    }
    for (const name of names) {
      const match = /^main_file_cache\.idx(\d+)$/.exec(name);
      if (!match) continue;
      const archive = Number(match[1]);
      if (archive === 255) continue;
      let index;
      try {
        index = fs.readFileSync(path.join(this.cacheDir, name));
      } catch (error) {
        continue;
      }
      const groups = [];
      for (let group = 0; (group + 1) * 6 <= index.length; group += 1) {
        if (index.readUIntBE(group * 6, 3) > 0) groups.push(group);
      }
      if (groups.length) archives.set(archive, groups);
    }
    return archives;
  }

  read(archiveId, groupId) {
    const indexPath = path.join(this.cacheDir, `main_file_cache.idx${archiveId}`);
    if (!fs.existsSync(this.dataPath) || !fs.existsSync(indexPath)) return null;

    let indexFile;
    let record;
    try {
      indexFile = fs.openSync(indexPath, 'r');
      record = Buffer.alloc(6);
      const got = fs.readSync(indexFile, record, 0, 6, groupId * 6);
      if (got !== 6) return null;
    } catch (error) {
      return null;
    } finally {
      if (indexFile !== undefined) fs.closeSync(indexFile);
    }

    const length = record.readUIntBE(0, 3);
    let sector = record.readUIntBE(3, 3);
    if (length <= 0 || length > MAX_ENTRY_SIZE || sector <= 0) return null;

    const dataFile = fs.openSync(this.dataPath, 'r');
    try {
      const sectorCount = Math.floor(fs.fstatSync(dataFile).size / SECTOR_SIZE);
      const payload = Buffer.alloc(length);
      let filled = 0;
      let chunk = 0;
      // Groups above 0xffff carry a four-byte group id in the sector header,
      // which costs two bytes of payload per sector.
      const extended = groupId > 0xffff;
      const headerSize = extended ? 10 : 8;

      while (filled < length) {
        if (sector <= 0 || sector > sectorCount) return null;
        const header = Buffer.alloc(headerSize);
        if (fs.readSync(dataFile, header, 0, headerSize, sector * SECTOR_SIZE) !==
            headerSize) return null;

        const currentGroup = extended
          ? header.readUInt32BE(0) : header.readUInt16BE(0);
        const currentChunk = extended
          ? header.readUInt16BE(4) : header.readUInt16BE(2);
        const nextSector = extended
          ? header.readUIntBE(6, 3) : header.readUIntBE(4, 3);
        const currentArchive = extended ? header[9] : header[7];
        if (currentGroup !== groupId) return null;
        if (currentChunk !== chunk) return null;
        if (currentArchive !== archiveId) return null;

        const blockSize = Math.min(extended ? 510 : 512, length - filled);
        const read = fs.readSync(dataFile, payload, filled, blockSize,
          sector * SECTOR_SIZE + headerSize);
        if (read !== blockSize) return null;
        filled += blockSize;
        sector = nextSector;
        chunk += 1;
      }
      return payload;
    } catch (error) {
      return null;
    } finally {
      fs.closeSync(dataFile);
    }
  }
}

// A directory of recorded containers, one file per group, written by
// scripts/js5-recorder.js. This is the format a recorded boot produces: it
// keeps the real master index, which the client never writes to its own cache,
// and it needs no sector allocator to append to.
class RawGroupStore {
  constructor(directory) {
    this.cacheDir = directory;
  }

  available() {
    try {
      return fs.readdirSync(this.cacheDir).some((name) => name.endsWith('.bin'));
    } catch (error) {
      return false;
    }
  }

  hasMasterIndex() {
    return fs.existsSync(path.join(this.cacheDir, '255-255.bin'));
  }

  archiveCount() {
    let highest = -1;
    try {
      for (const name of fs.readdirSync(this.cacheDir)) {
        const match = /^255-(\d+)\.bin$/.exec(name);
        if (match && Number(match[1]) !== 255) {
          highest = Math.max(highest, Number(match[1]));
        }
      }
    } catch (error) {
      return 0;
    }
    return highest + 1;
  }

  read(archiveId, groupId) {
    try {
      return fs.readFileSync(
        path.join(this.cacheDir, `${archiveId}-${groupId}.bin`));
    } catch (error) {
      return null;
    }
  }
}

// Several directories read as one, first match winning. This is what makes a
// short recording useful: a client that already had its data groups cached
// only ever fetches the index layer, so the recording holds 255/255 and the
// group tables while the bulk sits in the client's own cache. Neither is
// replayable alone; chained, they are.
class ChainStore {
  constructor(stores) {
    this.stores = stores;
    this.cacheDir = stores.map((store) => store.cacheDir).join(' + ');
  }

  available() {
    return this.stores.some((store) => store.available());
  }

  archiveCount() {
    return Math.max(0, ...this.stores.map((store) => store.archiveCount()));
  }

  read(archiveId, groupId) {
    for (const store of this.stores) {
      const raw = store.read(archiveId, groupId);
      if (raw !== null) return raw;
    }
    return null;
  }
}

// --- chain identity --------------------------------------------------------

// Decompress a JS5 container. Compression 0 is stored, 2 is gzip; 1 (bzip2)
// has no core Node decoder, and a table that uses it is skipped rather than
// guessed at.
function containerPayload(raw) {
  if (raw === null || raw.length < 5) return null;
  const compression = raw[0];
  const compressedLength = raw.readUInt32BE(1);
  if (compression === 0) return raw.subarray(5, 5 + compressedLength);
  if (compression === 2) {
    try {
      return zlib.gunzipSync(raw.subarray(9, 9 + compressedLength));
    } catch (error) {
      return null;
    }
  }
  return null;
}

// Parse an archive's reference table (archive 255, group <archive>) far enough
// to recover each group's id, CRC and version. Those three are what a client
// checks a group against, so they are what identifies the data the table
// describes.
function parseReferenceTable(raw) {
  const payload = containerPayload(raw);
  if (payload === null || payload.length < 2) return null;
  let offset = 0;
  const u8 = () => payload[offset++];
  const u16 = () => { const v = payload.readUInt16BE(offset); offset += 2; return v; };
  const i32 = () => { const v = payload.readInt32BE(offset); offset += 4; return v; };
  try {
    const protocol = u8();
    if (protocol < 5 || protocol > 7) return null;
    if (protocol >= 6) i32();
    const flags = u8();
    // Protocol 7 replaces every count and delta with a "large smart"; this
    // check only needs the protocol-6 shape, which is what the FunOrb tables
    // that chain with a client cache use.
    if (protocol >= 7) return null;
    const count = u16();
    const ids = [];
    let id = 0;
    for (let index = 0; index < count; index += 1) { id += u16(); ids.push(id); }
    if (flags & 1) offset += count * 4;
    if (flags & 2) offset += count * 64;
    const groups = new Map();
    const crcs = [];
    for (let index = 0; index < count; index += 1) crcs.push(i32() >>> 0);
    for (let index = 0; index < count; index += 1) {
      groups.set(ids[index], {crc: crcs[index], version: i32()});
    }
    return groups;
  } catch (error) {
    return null;
  }
}

// Which archives a master index declares. Entry N is 72 bytes -- CRC, version,
// whirlpool -- after a one-byte count, and an all-zero CRC means "no such
// archive in this build".
function declaredArchives(raw) {
  const payload = containerPayload(raw);
  if (payload === null || payload.length < 1) return null;
  const count = payload[0];
  if (payload.length < 1 + count * 72) return null;
  const declared = new Set();
  for (let archive = 0; archive < count; archive += 1) {
    if (payload.readUInt32BE(1 + archive * 72) !== 0) declared.add(archive);
  }
  return declared;
}

// A chained store mixes two datasets on purpose: the recorded index layer says
// which groups exist and what they must hash to, the client cache supplies the
// bytes. If the two came from different games or builds the server still
// answers every request and the client still never boots -- it looks up an
// asset by name, the foreign table resolves it to a group that is not there,
// and startup blocks on a condition that can never become true. The JS5
// handshake carries only a build revision and the 44 validated builds collide
// into 31 values, so nothing upstream of here can catch that. Check it.
function chainIdentityProblems(stores) {
  const indexLayer = stores.find((store) =>
    store instanceof RawGroupStore && store.hasMasterIndex());
  const caches = stores.filter((store) => store instanceof CacheStore &&
    store.available());
  if (!indexLayer || !caches.length) return [];
  const declared = declaredArchives(indexLayer.read(255, 255));
  if (declared === null) return [];
  const problems = [];
  for (const cache of caches) {
    for (const [archive, groups] of cache.storedArchives()) {
      if (!declared.has(archive)) {
        problems.push(`archive ${archive} is stored in ${cache.cacheDir} ` +
          `(${groups.length} group(s)) but ${indexLayer.cacheDir}/255-255.bin ` +
          `declares no such archive`);
        continue;
      }
      const table = parseReferenceTable(indexLayer.read(255, archive));
      if (table === null) continue;
      for (const group of groups) {
        const entry = table.get(group);
        const stored = cache.read(archive, group);
        if (!entry || stored === null || stored.length < 3) continue;
        const body = stored.subarray(0, stored.length - 2);
        const version = stored.readUInt16BE(stored.length - 2);
        const crc = crc32(body);
        if (crc === entry.crc && version === (entry.version & 0xffff)) break;
        problems.push(`archive ${archive} group ${group}: ` +
          `${cache.cacheDir} holds crc=0x${crc.toString(16)} version=${version}, ` +
          `${indexLayer.cacheDir}/255-${archive}.bin describes ` +
          `crc=0x${entry.crc.toString(16)} version=${entry.version & 0xffff}`);
        break;
      }
    }
  }
  return problems;
}

// A recorded directory and a client cache are both "the cache" as far as the
// server is concerned; pick whichever each directory actually holds.
function openStore(cacheDir) {
  const directories = Array.isArray(cacheDir) ? cacheDir : [cacheDir];
  const stores = directories.map((directory) =>
    fs.existsSync(path.join(directory, 'main_file_cache.dat2'))
      ? new CacheStore(directory) : new RawGroupStore(directory));
  if (stores.length > 1) {
    const problems = chainIdentityProblems(stores);
    if (problems.length) {
      throw new Error('JS5 cache chain mixes datasets that do not describe ' +
        'each other:\n  ' + problems.join('\n  ') +
        '\nServing this chain answers every request and still cannot boot ' +
        'the game. Record the index layer from the same game and build as ' +
        'the client cache.');
    }
  }
  return stores.length === 1 ? stores[0] : new ChainStore(stores);
}


// --- protocol --------------------------------------------------------------

class ByteReader {
  constructor() {
    this.buffer = Buffer.alloc(0);
    this.pending = null;
    this.ended = false;
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this._settle();
  }

  end() {
    this.ended = true;
    this._settle();
  }

  _settle() {
    if (!this.pending) return;
    if (this.buffer.length >= this.pending.count) {
      const {count, resolve} = this.pending;
      this.pending = null;
      const taken = this.buffer.subarray(0, count);
      this.buffer = this.buffer.subarray(count);
      resolve(taken);
      return;
    }
    if (this.ended) {
      const {reject} = this.pending;
      this.pending = null;
      reject(new Error('connection closed mid-request'));
    }
  }

  read(count) {
    if (this.pending) return Promise.reject(new Error('concurrent read'));
    return new Promise((resolve, reject) => {
      this.pending = {count, resolve, reject};
      this._settle();
    });
  }
}

function container(body) {
  // compression 0, then the uncompressed length, then the payload.
  const head = Buffer.alloc(5);
  head[0] = 0;
  head.writeUInt32BE(body.length, 1);
  return Buffer.concat([head, body]);
}

class Js5Session {
  constructor(socket, cache, peer, options) {
    this.socket = socket;
    this.cache = cache;
    this.peer = peer;
    this.xorKey = 0;
    this.substitutes = options.substitutes || new Map();
    this.log = options.log || (() => {});
  }

  _read(archiveId, groupId) {
    const raw = this.cache.read(archiveId, groupId);
    if (raw !== null) return raw;
    const substitute = this.substitutes.get(`${archiveId}/${groupId}`);
    if (substitute) {
      this.log(`[js5] ${this.peer} SUBSTITUTE ${archiveId}/${groupId} ` +
        `${substitute.length}B crc=0x${(zlib.crc32
          ? zlib.crc32(substitute) : crc32(substitute)).toString(16)}`);
      return substitute;
    }
    return null;
  }

  buildMasterIndex() {
    const count = this.cache.archiveCount();
    const body = Buffer.alloc(1 + count * 72);
    body[0] = count & 0xff;
    for (let archive = 0; archive < count; archive += 1) {
      const raw = this._read(255, archive);
      const offset = 1 + archive * 72;
      body.writeUInt32BE(raw === null ? 0 : crc32(raw), offset);
      body.writeUInt32BE(0, offset + 4);   // version
      // whirlpool stays zero-filled; the client only verifies it when the
      // master index is signed, and a synthesized one never is.
    }
    return container(body);
  }

  async run(revision) {
    this.log(`[js5] ${this.peer} accepted gamecrc=${revision}`);
    this.socket.write(Buffer.from([0]));
    for (;;) {
      const packet = await this.reader.read(6);
      const opcode = packet[0];
      if (opcode === 0 || opcode === 1) {
        this.handleFileRequest(opcode === 1, packet[1], packet.readUInt32BE(2));
        continue;
      }
      if (opcode === 4) {
        this.xorKey = packet[1];
        this.log(`[js5] ${this.peer} xor-key=${this.xorKey}`);
        continue;
      }
      if (opcode === 7) {
        this.log(`[js5] ${this.peer} disconnect control`);
        return;
      }
      // 2, 3 and 6 are priority/normal/setup control messages with nothing to
      // answer. Anything else is logged rather than fatal: dropping the
      // connection on an unknown opcode would look like a network fault to the
      // client and send it into a reconnect loop.
      this.log(`[js5] ${this.peer} control opcode=${opcode} ${packet.toString('hex')}`);
    }
  }

  handleFileRequest(priority, archiveId, groupId) {
    let raw;
    if (archiveId === 255 && groupId === 255) {
      raw = this._read(255, 255);
      if (raw === null) raw = this.buildMasterIndex();
    } else {
      raw = this._read(archiveId, groupId);
    }

    if (raw === null) {
      // Answer the miss instead of staying silent. A bare return leaves the
      // client waiting on a response that never comes; it holds the connection
      // open, drops it, and reopens ~30s later forever, which looks like a
      // hang rather than a missing file.
      const empty = Buffer.alloc(10);
      empty[0] = archiveId & 0xff;
      empty.writeUInt32BE(groupId, 1);
      empty[5] = priority ? 0 : 0x80;
      empty.writeUInt32BE(0, 6);
      this.sendFramed(empty);
      this.log(`[js5] ${this.peer} MISS ${archiveId}/${groupId} (sent empty)`);
      return;
    }

    if (archiveId !== 255) {
      // Cache entries carry a version trailer on disk that is not part of the
      // container the client expects.
      const compression = raw[0];
      const compressedLength = raw.readUInt32BE(1);
      const containerLength = (compression === 0 ? 5 : 9) + compressedLength;
      if (raw.length < containerLength) {
        this.log(`[js5] ${this.peer} truncated ${archiveId}/${groupId} ` +
          `${raw.length}B expected ${containerLength}`);
        return;
      }
      if (raw.length > containerLength) raw = raw.subarray(0, containerLength);
    }
    if (raw.length < 5) {
      this.log(`[js5] ${this.peer} short entry ${archiveId}/${groupId}`);
      return;
    }

    const compression = raw[0];
    const compressedLength = raw.readUInt32BE(1);
    const head = Buffer.alloc(10);
    head[0] = archiveId & 0xff;
    head.writeUInt32BE(groupId, 1);
    head[5] = (compression & 0x7f) | (priority ? 0 : 0x80);
    head.writeUInt32BE(compressedLength, 6);
    this.sendFramed(Buffer.concat([head, raw.subarray(5)]));
    this.log(`[js5] ${this.peer} sent ${archiveId}/${groupId} ${raw.length}B`);
  }

  xor(data) {
    // The client may switch on a stream XOR with opcode 4, after which every
    // outgoing byte -- headers and 0xff block markers included -- must be
    // XORed, or it decodes garbage and drops the connection.
    if (!this.xorKey) return data;
    const out = Buffer.allocUnsafe(data.length);
    for (let index = 0; index < data.length; index += 1) {
      out[index] = data[index] ^ this.xorKey;
    }
    return out;
  }

  sendFramed(packet) {
    if (packet.length <= 512) {
      this.socket.write(this.xor(packet));
      return;
    }
    this.socket.write(this.xor(packet.subarray(0, 512)));
    let offset = 512;
    while (offset < packet.length) {
      const end = Math.min(offset + 511, packet.length);
      this.socket.write(this.xor(Buffer.from([0xff])));
      this.socket.write(this.xor(packet.subarray(offset, end)));
      offset = end;
    }
  }
}

// zlib.crc32 exists only on newer Node; keep a fallback so the server runs
// wherever the launcher does.
let crcTable = null;
function crc32(buffer) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buffer) >>> 0;
  if (crcTable === null) {
    crcTable = new Int32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crcTable[index] = value;
    }
  }
  let crc = -1;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[index]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

// --- server ----------------------------------------------------------------

// Archive 6 group 1 is the FunOrb subscription upsell panel. The service is
// dead and the group survives in no cache, but the client blocks on "Loading
// extra data" forever waiting for it -- and a zero-length group does not
// satisfy it, since it reads that as a failed fetch and re-requests. The
// synthesized replacement in apps/server/synthetic is forged to carry the CRC
// the (signed, unpatchable) master index already records for it. This is not
// dekobloko-specific: every game whose cache lacks the group needs it, and a
// game whose cache HAS it never consults the substitute at all.
function defaultSubstitutes() {
  const substitutes = new Map();
  const bundled = path.join(__dirname, '..', 'apps', 'server', 'synthetic',
    'archive6_group1.bin');
  try {
    substitutes.set('6/1', fs.readFileSync(bundled));
  } catch (error) {
    // Absent is fine; a cache that has the group never needs it.
  }
  return substitutes;
}

function startJs5Server({cacheDir, port = 43594, host = '127.0.0.1',
  gameCrc = null, substitutes = defaultSubstitutes(), log = () => {}} = {}) {
  const expectedGameCrc = gameCrc === null || gameCrc === undefined
    ? null : gameCrc >>> 0;
  const cache = openStore(cacheDir);
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    const peer = `${socket.remoteAddress}:${socket.remotePort}`;
    const reader = new ByteReader();
    socket.on('data', (chunk) => reader.push(chunk));
    socket.on('end', () => reader.end());
    socket.on('close', () => { reader.end(); sockets.delete(socket); });
    socket.on('error', () => { reader.end(); sockets.delete(socket); });

    (async () => {
      const preamble = await reader.read(8);
      if (preamble[0] !== 12) {
        log(`[js5] ${peer} invalid preamble ${preamble.toString('hex')}`);
        socket.destroy();
        return;
      }
      const opcode = (await reader.read(1))[0];
      if (opcode !== 15) {
        // Only the JS5 handshake belongs here; the login/game protocol is a
        // separate server's job.
        log(`[js5] ${peer} non-JS5 opcode=${opcode}, closing`);
        socket.destroy();
        return;
      }
      const handshakeGameCrc = (await reader.read(4)).readUInt32BE(0);
      if (expectedGameCrc !== null && handshakeGameCrc !== expectedGameCrc) {
        // Answering would serve one game's index layer to another. Every
        // request then succeeds and the client still never boots, because the
        // foreign tables resolve its assets to groups this cache does not have.
        log(`[js5] ${peer} REFUSED gamecrc=${handshakeGameCrc}, ` +
          `this server serves gamecrc=${expectedGameCrc}`);
        socket.destroy();
        return;
      }
      const revision = handshakeGameCrc;
      const session = new Js5Session(socket, cache, peer, {substitutes, log});
      session.reader = reader;
      await session.run(revision);
    })().catch((error) => {
      log(`[js5] ${peer} closed: ${error.message}`);
      socket.destroy();
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      log(`[js5] serving ${cache.cacheDir} on ${host}:${port}` +
        (cache.available() ? '' : ' (WARNING: no main_file_cache.dat2)'));
      resolve({
        port: server.address().port,
        cache,
        close: () => {
          for (const socket of sockets) socket.destroy();
          server.close();
        },
      });
    });
  });
}

module.exports = {startJs5Server, CacheStore, RawGroupStore, ChainStore,
  chainIdentityProblems, parseReferenceTable, declaredArchives,
  openStore, crc32, defaultSubstitutes};

if (require.main === module) {
  const args = process.argv.slice(2);
  let cacheDir = null;
  let port = 43594;
  let host = '127.0.0.1';
  let substitutes = defaultSubstitutes();
  let gameCrc = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--cache-dir') {
      // Repeatable: later directories answer only what earlier ones lack.
      cacheDir = cacheDir === null ? args[++index]
        : [].concat(cacheDir, args[++index]);
    }
    else if (args[index] === '--port') port = Number(args[++index]);
    else if (args[index] === '--host') host = args[++index];
    else if (args[index] === '--game-crc') gameCrc = Number(args[++index]);
    else if (args[index] === '--substitute') {
      // --substitute 6/1=path/to/group.bin
      const [key, file] = args[++index].split('=');
      substitutes.set(key, fs.readFileSync(file));
    } else if (args[index] === '--no-substitutes') substitutes = new Map();
    else if (args[index] === '--quiet') process.env.JS5_QUIET = '1';
    else {
      console.error(`unknown argument: ${args[index]}`);
      process.exit(2);
    }
  }
  if (!cacheDir) {
    console.error('usage: js5-server.js --cache-dir <dir> [--port N] ' +
      '[--host H] [--game-crc N] [--substitute A/G=file] ' +
      '[--no-substitutes] [--quiet]');
    process.exit(2);
  }
  const log = process.env.JS5_QUIET === '1'
    ? () => {} : (line) => console.error(line);
  startJs5Server({cacheDir, port, host, gameCrc, substitutes, log})
    .catch((error) => {
    console.error(`js5-server failed: ${error.message}`);
    process.exit(1);
  });
}
