import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createBrowserGameServer} from '../apps/launcher/browser-loader/browser-game-server.mjs';
const require = createRequire(import.meta.url);
const {pack, unpack, reference, rebuildReference, rebuildMaster, whirlpool, masterBody, validateLibrary} = require('../scripts/lib/js5-cache-recovery.cjs');
const {crc32} = require('../scripts/js5-server.js');
test('shipped recovered groups preserve decoded bytes through browser JS5 framing', async () => {
  const {ResponseParser} = require('../scripts/js5-recorder.js');
  const {assetRoot, catalogPath} = require('../scripts/lib/game-asset-paths.cjs');
  const catalog = require(catalogPath);
  const report = require(path.join(assetRoot, 'game-assets/recovery-report.json'));
  for (const entry of report.groups) {
    const game = catalog.games.find(g => g.internalName === entry.game);
    const asset = readFileSync(path.join(assetRoot, `${game.assetRoot}/${entry.archive}-${entry.group}.bin`));
    const refs = readFileSync(path.join(assetRoot, `${game.assetRoot}/255-${entry.archive}.bin`));
    const master = readFileSync(path.join(assetRoot, `${game.assetRoot}/255-255.bin`));
    const ref = reference(refs), metadata = ref.entries.find(e => e.id === entry.group);
    assert.equal(metadata.crc, crc32(asset));
    assert.equal(master.readUInt32BE(6 + entry.archive * 72), crc32(refs));
    assert.deepEqual(master.subarray(14 + entry.archive * 72, 78 + entry.archive * 72), whirlpool(refs));
    masterBody(master);
    const server = createBrowserGameServer({game, storage: {}, fetchAsset: async url => {
      assert.equal(url, `${game.assetRoot}/${entry.archive}-${entry.group}.bin?v=${game.assetVersion}`);
      return new Response(asset);
    }});
    const socket = server.createSocket();
    socket.outgoing.push(15, game.gamecrc >>> 24 & 255, game.gamecrc >>> 16 & 255,
      game.gamecrc >>> 8 & 255, game.gamecrc & 255, 0, entry.archive, 0, 0, 0, entry.group);
    server.processWrites(socket); await socket.requestChain;
    const wire = Buffer.concat(socket.chunks.map(c => Buffer.from(c)));
    let decoded;
    const parser = new ResponseParser((archive, group, bytes) => {
      assert.equal(archive, entry.archive); assert.equal(group, entry.group); decoded = bytes;
    });
    // Exercise fragmented delivery across several JS5 continuation boundaries.
    for (let offset = 1; offset < wire.length; offset += 137) parser.push(wire.subarray(offset, offset + 137));
    assert.deepEqual(decoded, asset);
    assert.equal(createHash('sha256').update(unpack(decoded)).digest('hex'), entry.sha256);
  }
});
