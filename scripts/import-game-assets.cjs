#!/usr/bin/env node
'use strict';
// Export existing offline caches using the same validated recording -> client
// cache chain as dekobloko-work. Never fetch assets from a public game host.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {parseReferenceTable} = require('./lib/js5-reference.cjs');
const {dekoRoot, assetRoot, catalogPath} = require('./lib/game-asset-paths.cjs');
const cacheRoot = path.resolve(process.env.ALTERORB_JVMJS_CACHE_ROOT || path.join(os.homedir(), '.alterorb/caches'));
const recordedRoot = path.resolve(process.env.JS5_RECORDED_ROOT || path.join(dekoRoot, '.work/js5-recorded'));
const {openStore, defaultSubstitutes, crc32, declaredArchives} = require(path.join(dekoRoot, 'scripts/js5-server.js'));
const catalog = JSON.parse(fs.readFileSync(catalogPath));
const requested = process.argv.slice(2);
for (const id of requested) {
  if (!catalog.games.some(game => game.internalName === id)) throw new Error(`Unknown game: ${id}`);
}
const results = [];
for (const game of catalog.games.filter(game => !requested.length || requested.includes(game.internalName))) {
  const directories = [path.join(recordedRoot, game.internalName), path.join(cacheRoot, game.internalName)]
    .filter(directory => fs.existsSync(directory));
  const result = {game: game.internalName, exported: 0, missing: [], errors: []};
  results.push(result);
  if (!directories.length) { result.errors.push('No offline cache'); continue; }
  try {
    const store = openStore(directories);
    const master = store.read(255, 255);
    if (!master) {
      // GeoBlox already ships a verified recording; preserve it on refresh.
      if (fs.existsSync(path.join(assetRoot, game.assetRoot, '255-255.bin'))) {
        result.errors.push('No replacement signed master; retained bundled assets');
      } else result.missing.push('255-255.bin');
      continue;
    }
    const bundledMasterPath = path.join(assetRoot, game.assetRoot, '255-255.bin');
    if (fs.existsSync(bundledMasterPath) && !fs.readFileSync(bundledMasterPath).equals(master)) {
      throw new Error('Offline master differs from the pinned game master; fetch current assets before importing');
    }
    const archives = declaredArchives(master);
    if (!archives) throw new Error('Invalid signed master index');
    const groups = new Map([['255-255.bin', master]]);
    const substitutes = defaultSubstitutes();
    for (const archive of archives) {
      const raw = store.read(255, archive);
      if (!raw) { result.missing.push(`255-${archive}.bin`); continue; }
      if (crc32(raw) !== master.readUInt32BE(6 + archive * 72)) {
        result.errors.push(`Reference CRC mismatch 255-${archive}.bin`); continue;
      }
      groups.set(`255-${archive}.bin`, raw);
      const table = parseReferenceTable(raw);
      if (!table) { result.errors.push(`Cannot decode reference table ${archive}`); continue; }
      for (const [group, metadata] of table) {
        const bytes = store.read(archive, group) || substitutes.get(`${archive}/${group}`);
        const name = `${archive}-${group}.bin`;
        if (bytes && bytes.length >= 5) {
          const size = bytes.readUInt32BE(1) + (bytes[0] === 0 ? 5 : 9);
          const container = bytes.subarray(0, size);
          if (crc32(container) === metadata.crc) groups.set(name, container);
          else result.errors.push(`CRC mismatch ${name}`);
        }
        else result.missing.push(name);
      }
    }
    const destination = path.join(assetRoot, game.assetRoot);
    fs.mkdirSync(destination, {recursive: true});
    for (const [name, bytes] of groups) fs.writeFileSync(path.join(destination, name), bytes);
    fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify([...groups.keys()].sort()) + '\n');
    result.exported = groups.size;
  } catch (error) { result.errors.push(error.message); }
}
const reportPath = path.join(assetRoot, 'game-assets/import-report.json');
fs.mkdirSync(path.dirname(reportPath), {recursive: true});
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2) + '\n');
for (const result of results) console.log(`${result.game}: ${result.exported} containers; ${result.missing.length} missing; ${result.errors.join('; ')}`);
if (results.some(result => result.missing.length || result.errors.length)) process.exitCode = 1;
