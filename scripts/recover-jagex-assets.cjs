#!/usr/bin/env node
'use strict';
// Recover identified native libraries from the existing cache. Reference-table
// names in that cache are stale, so identify ELF architecture/API from content.
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {spawnSync} = require('node:child_process');
const {unpack, pack, reference, nameHash, validateLibrary, rebuildReference, rebuildMaster, masterBody, whirlpool} = require('./lib/js5-cache-recovery.cjs');
const {dekoRoot, assetRoot, catalogPath} = require('./lib/game-asset-paths.cjs');
const sourceRoot = path.resolve(process.env.JAGEX_CACHE_ROOT || dekoRoot);
const {CacheStore, crc32} = require(path.join(dekoRoot, 'scripts/js5-server.js'));
const apply = process.argv.includes('--apply');
if (process.argv.slice(2).some(arg => arg !== '--apply')) throw new Error('Usage: recover-jagex-assets.cjs [--apply]');
const catalog = require(catalogPath);
const source = new CacheStore(sourceRoot);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const recovered = [['jaclib', 27], ['jaggl', 28]].map(([library, group]) => {
  const raw = source.read(0, group);
  if (!raw) throw new Error(`Source cache lacks 0/${group}`);
  const data = unpack(raw);
  validateLibrary(data, library);
  return {library, sourceArchive: 0, sourceGroup: group, data,
    name: `linux/x86_64/lib${library}.so`, sha256: sha(data), bytes: pack(data)};
});
const plans = [], groups = [];
for (const game of catalog.games) {
  const directory = path.join(assetRoot, game.assetRoot);
  const master = fs.readFileSync(path.join(directory, '255-255.bin'));
  const tables = new Map();
  for (const file of fs.readdirSync(directory).filter(f => /^255-\d+\.bin$/.test(f) && f !== '255-255.bin')) {
    const archive = Number(file.slice(4, -4)), raw = fs.readFileSync(path.join(directory, file));
    const ref = reference(raw), replacements = new Map();
    for (const asset of recovered) {
      const entry = ref.entries.find(e => e.name === nameHash(asset.name));
      if (!entry || fs.existsSync(path.join(directory, `${archive}-${entry.id}.bin`))) continue;
      if (entry.fileCount !== 1 || entry.files[0] !== 0 || entry.fileNames?.[0] !== 0)
        throw new Error(`Unexpected library file layout: ${game.internalName}:${archive}/${entry.id}`);
      replacements.set(entry.id, asset.bytes);
      groups.push({game: game.internalName, archive, group: entry.id, name: asset.name,
        sourceArchive: asset.sourceArchive, sourceGroup: asset.sourceGroup,
        sha256: asset.sha256, originalCrc: entry.crc, replacementCrc: crc32(asset.bytes),
        originalVersion: entry.version, replacementVersion: (entry.version + 1) >>> 0,
        compressedBytes: asset.bytes.length, decodedBytes: asset.data.length,
        provenance: 'Older cached library; not a byte-identical restoration of the advertised revision'});
    }
    if (replacements.size) {
      masterBody(master);
      const offset = 6 + archive * 72;
      if (archive >= master[5] || crc32(raw) !== master.readUInt32BE(offset)) throw new Error('Original reference CRC mismatch');
      if (ref.version !== master.readUInt32BE(offset + 4) ||
          !whirlpool(raw).equals(master.subarray(offset + 8, offset + 72))) throw new Error('Original reference digest/version mismatch');
      const next = rebuildReference(raw, replacements, crc32);
      tables.set(archive, next);
      plans.push({game, directory, archive, replacements, table: next, original: raw});
    }
  }
  if (tables.size) {
    const next = rebuildMaster(master, tables, crc32);
    plans.push({game, directory, master: next, original: master});
  }
}
const report = {source: sourceRoot, recoveredGroups: groups.length,
  note: 'Only content-identified ELF libraries are recovered. The three other earlier candidates are existing GeoBlox assets with stale cached name associations.', groups};
if (apply && groups.length) {
  // Validate the entire plan before mutating any game. Retain original master
  // and reference containers so this local revision can be reversed exactly.
  for (const plan of plans) {
    const name = plan.master ? '255-255.bin' : `255-${plan.archive}.bin`;
    const backup = path.join(assetRoot, 'game-assets/recovery/originals', plan.game.internalName, name);
    fs.mkdirSync(path.dirname(backup), {recursive: true});
    if (fs.existsSync(backup) && !fs.readFileSync(backup).equals(plan.original)) throw new Error('Existing recovery backup differs');
  }
  for (const plan of plans) {
    const name = plan.master ? '255-255.bin' : `255-${plan.archive}.bin`;
    const backup = path.join(assetRoot, 'game-assets/recovery/originals', plan.game.internalName, name);
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, plan.original);
    if (plan.replacements) for (const [id, bytes] of plan.replacements)
      fs.writeFileSync(path.join(plan.directory, `${plan.archive}-${id}.bin`), bytes);
    fs.writeFileSync(path.join(plan.directory, name), plan.master || plan.table);
  }
  fs.writeFileSync(path.join(assetRoot, 'game-assets/recovery-report.json'), JSON.stringify(report, null, 2) + '\n');
  const audit = spawnSync(process.execPath, [path.join(__dirname, 'audit-game-assets.cjs'), '--fill-shared'], {cwd: dekoRoot, encoding: 'utf8'});
  if (audit.status !== 0) throw new Error(audit.stderr || audit.stdout);
  process.stdout.write(audit.stdout);
}
console.log(JSON.stringify({mode: apply ? 'apply' : 'dry-run', recoveredGroups: groups.length,
  games: [...new Set(groups.map(g => g.game))], groups: groups.map(g => `${g.game}:${g.archive}/${g.group} ${g.name}`)}));
