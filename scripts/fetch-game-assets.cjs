#!/usr/bin/env node
'use strict';
// Explicit maintainer operation: download a complete catalog from AlterOrb once.
// Deployed games read these static containers; no game proxy is needed at runtime.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const os = require('node:os');
const {parseReferenceTable} = require('./lib/js5-reference.cjs');
const {dekoRoot, assetRoot, catalogPath} = require('./lib/game-asset-paths.cjs');
const {ResponseParser} = require(path.join(dekoRoot, 'scripts/js5-recorder.js'));
const {declaredArchives, crc32, defaultSubstitutes, CacheStore} = require(path.join(dekoRoot, 'scripts/js5-server.js'));

const catalog = JSON.parse(fs.readFileSync(catalogPath));
let requested = process.argv.slice(2);
let selectedGroup = null;
if (requested[0] === '--group') {
  if (requested.length !== 4) throw new Error('Usage: --group GAME ARCHIVE GROUP');
  selectedGroup = {archive: Number(requested[2]), group: Number(requested[3])};
  if (!Number.isInteger(selectedGroup.archive) || selectedGroup.archive < 0 || selectedGroup.archive > 255 ||
      !Number.isInteger(selectedGroup.group) || selectedGroup.group < 0 || selectedGroup.group > 0xffffffff) throw new Error('Invalid JS5 group');
  requested = [requested[1]];
}
for (const id of requested) if (!catalog.games.some(g => g.internalName === id)) throw new Error(`Unknown game ${id}`);
const remoteHost = process.env.JS5_HOST || 'mgg-server.alterorb.net';
const substitutes = defaultSubstitutes();

// CRC identities allow reuse of byte-identical shared groups, including old
// name aliases which the live service no longer answers individually.
const byCrc = new Map();
const cacheRoot = process.env.ALTERORB_JVMJS_CACHE_ROOT || path.join(os.homedir(), '.alterorb/caches');
for (const id of fs.existsSync(cacheRoot) ? fs.readdirSync(cacheRoot) : []) {
  const store = new CacheStore(path.join(cacheRoot, id));
  for (const [archive, groups] of store.storedArchives()) for (const group of groups) {
    const raw = store.read(archive, group);
    if (!raw || raw.length < 5) continue;
    const size = raw.readUInt32BE(1) + (raw[0] === 0 ? 5 : 9);
    if (raw.length < size) continue;
    const bytes = raw.subarray(0, size);
    byCrc.set(crc32(bytes), bytes);
  }
}
for (const bytes of substitutes.values()) byCrc.set(crc32(bytes), bytes);

function connect(game) {
  const pending = new Map();
  let acknowledged = false;
  const socket = net.createConnection({host: remoteHost, port: 43594});
  const parser = new ResponseParser((archive, group, bytes) => {
    const key = `${archive}/${group}`;
    const request = pending.get(key);
    if (!request) return;
    clearTimeout(request.timer); pending.delete(key); request.resolve(bytes);
  });
  let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => {readyResolve = resolve; readyReject = reject;});
  ready.catch(() => {});
  function fail(error) {
    readyReject(error);
    for (const request of pending.values()) {clearTimeout(request.timer); request.reject(error);}
    pending.clear(); socket.destroy();
  }
  socket.setTimeout(15000, () => fail(new Error('JS5 connection timeout')));
  socket.on('error', fail);
  socket.on('close', () => fail(new Error('JS5 connection closed')));
  socket.on('connect', () => {
    const hello = Buffer.from([12, 0, 17, 0, 0, 31, 67, 0, 15, 0, 0, 0, 0]);
    hello.writeUInt16BE(game.js5GameId, 3);
    hello.writeUInt32BE(game.gamecrc >>> 0, 9); socket.write(hello);
  });
  socket.on('data', bytes => {
    try {
      if (!acknowledged) {
        if (bytes[0] !== 0) return fail(new Error(`Handshake rejected: ${bytes[0]}`));
        acknowledged = true; readyResolve(); bytes = bytes.subarray(1);
        socket.write(Buffer.from([6, 0, 0, 3, 0, 0, 3, 0, 0, 0, 0, 0]));
      }
      if (bytes.length) {
        parser.push(bytes);
        for (const request of pending.values()) request.timer.refresh();
      }
    } catch (error) { fail(error); }
  });
  return {close: () => socket.destroy(), async read(archive, group) {
    await ready;
    if (socket.destroyed) throw new Error('JS5 connection closed');
    return new Promise((resolve, reject) => {
      const key = `${archive}/${group}`;
      pending.set(key, {resolve, reject, timer: setTimeout(() => {
        pending.delete(key); reject(new Error(`JS5 timeout ${key}`));
      }, 15000)});
      const request = Buffer.from([0, archive, 0, 0, 0, 0]);
      request.writeUInt32BE(group, 2); socket.write(request);
    });
  }};
}

async function download(game) {
  const result = {game: game.internalName, containers: 0, bytes: 0, missing: [], errors: []};
  const directory = path.join(assetRoot, game.assetRoot);
  fs.mkdirSync(directory, {recursive: true});
  let client = connect(game);
  const files = [];
  async function get(archive, group, expectedCrc) {
    const name = `${archive}-${group}.bin`;
    const destination = path.join(directory, name);
    let bytes = archive === 255 && group === 255 ? null : fs.existsSync(destination) ? fs.readFileSync(destination) : null;
    if (bytes && expectedCrc !== undefined && crc32(bytes) !== expectedCrc) bytes = null;
    if (!bytes && expectedCrc !== undefined) bytes = byCrc.get(expectedCrc);
    if (!bytes) {
      try { bytes = await client.read(archive, group); }
      catch (error) {
        bytes = substitutes.get(`${archive}/${group}`);

        if (!bytes || expectedCrc === undefined || crc32(bytes) !== expectedCrc) throw error;
      }
    }
    if (expectedCrc !== undefined && crc32(bytes) !== expectedCrc) throw new Error(`CRC mismatch ${archive}/${group}`);
    fs.writeFileSync(destination, bytes);
    byCrc.set(crc32(bytes), bytes);
    files.push(name); result.containers++; result.bytes += bytes.length;
    return bytes;
  }
  try {
    const master = await get(255, 255);
    const archives = declaredArchives(master);
    if (!archives) throw new Error('Invalid signed master index');
    if (selectedGroup) {
      const {archive, group} = selectedGroup;
      result.request = selectedGroup;
      if (archive === 255) {
        if (group !== 255) {
          if (![...archives].includes(group)) throw new Error('Undeclared reference table');
          await get(255, group, master.readUInt32BE(6 + group * 72));
        }
      } else {
        if (![...archives].includes(archive)) throw new Error('Undeclared archive');
        const reference = await get(255, archive, master.readUInt32BE(6 + archive * 72));
        const metadata = parseReferenceTable(reference).get(group);
        if (!metadata) throw new Error('Undeclared group');
        await get(archive, group, metadata.crc);
      }
      const manifestPath = path.join(directory, 'manifest.json');
      const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath)) : [];
      fs.writeFileSync(manifestPath, JSON.stringify([...new Set([...previous, ...files])].sort()) + '\n');
    } else {
    const requests = [];
    const retry = [];
    for (const archive of archives) {
      const crc = master.readUInt32BE(6 + archive * 72);
      try {
        let tableBytes;
        try { tableBytes = await get(255, archive, crc); }
        catch {
          client.close(); client = connect(game);
          tableBytes = await get(255, archive, crc);
        }
        const table = parseReferenceTable(tableBytes);
        for (const [group, metadata] of table) requests.push({archive, group, metadata});
      } catch (error) {
        result.missing.push({archive: 255, group: archive, error: error.message});
      }
    }
    await Promise.all(Array.from({length: 24}, async () => {
      while (requests.length) {
        const {archive, group, metadata} = requests.shift();
        try { await get(archive, group, metadata.crc); }
        catch (error) { retry.push({archive, group, metadata}); }
      }
    }));
    // A timed-out legacy group can close the shared connection. Retry small
    // batches on fresh connections so later valid groups still get a chance.
    while (retry.length) {
      client.close(); client = connect(game);
      await Promise.all(retry.splice(0, 8).map(async ({archive, group, metadata}) => {
        try { await get(archive, group, metadata.crc); }
        catch (error) { result.missing.push({archive, group, error: error.message}); }
      }));
    }
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(files.sort()) + '\n');
    }
  } catch (error) { result.errors.push(error.message); }
  finally { client.close(); }
  console.log(`${result.game}: ${result.containers} containers, ${result.bytes} bytes, ${result.missing.length} missing ${result.errors.join('; ')}`);
  return result;
}
(async () => {
  const games = catalog.games.filter(game => !requested.length || requested.includes(game.internalName));
  const results = [];
  // Three independent game connections, with bounded batches of outstanding requests.
  await Promise.all(Array.from({length: Math.min(3, games.length)}, async () => {
    while (games.length) results.push(await download(games.shift()));
  }));
  const report = path.join(assetRoot, selectedGroup ? 'game-assets/group-download-report.json' : 'game-assets/download-report.json');
  fs.mkdirSync(path.dirname(report), {recursive: true});
  const previous = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report)) : [];
  const combined = new Map(previous.map(result => [result.game, result]));
  for (const result of results) combined.set(result.game, result);
  fs.writeFileSync(report, JSON.stringify([...combined.values()].sort((a,b) => a.game.localeCompare(b.game)), null, 2) + '\n');
  if (results.some(result => result.missing.length || result.errors.length)) process.exitCode = 1;
})().catch(error => {console.error(error); process.exitCode = 1;});
