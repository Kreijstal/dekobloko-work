#!/usr/bin/env node
'use strict';
// Offline candidate-key testing for a compressed JS5 group. No unrestricted
// key-space search, downloads, cache edits or signature changes.
const fs = require('node:fs');
const {unpack} = require('./lib/js5-cache-recovery.cjs');

function decryptBlock(v0, v1, key) {
  let sum = 0xc6ef3720;
  for (let cycle = 0; cycle < 32; cycle++) {
    v1 = (v1 - ((((v0 << 4 ^ v0 >>> 5) + v0) ^ (sum + key[sum >>> 11 & 3])))) >>> 0;
    sum = (sum - 0x9e3779b9) >>> 0;
    v0 = (v0 - ((((v1 << 4 ^ v1 >>> 5) + v1) ^ (sum + key[sum & 3])))) >>> 0;
  }
  return [v0, v1];
}

function containerEnd(raw) {
  if (raw.length < 13 || ![1, 2].includes(raw[0]))
    throw new Error('Expected a bzip2 or gzip JS5 container with an encrypted block');
  const end = 9 + raw.readUInt32BE(1);
  if (end > raw.length || end < 13) throw new Error('Truncated JS5 container');
  return end;
}

function decryptContainer(raw, key) {
  const end = containerEnd(raw), result = Buffer.from(raw.subarray(0, end));
  for (let offset = 5; offset + 8 <= end; offset += 8) {
    const [a, b] = decryptBlock(raw.readUInt32BE(offset), raw.readUInt32BE(offset + 4), key);
    result.writeUInt32BE(a, offset); result.writeUInt32BE(b, offset + 4);
  }
  return result;
}

function findKeys(raw, candidates, {maxPlainBytes = 64 * 1024 * 1024} = {}) {
  containerEnd(raw);
  let tested = 0, headerMatches = 0;
  const matches = [];
  for (const entry of candidates) {
    const key = Array.isArray(entry) ? entry : entry?.key;
    if (!Array.isArray(key) || key.length !== 4 || !key.every(word =>
      Number.isInteger(word) && word >= -0x80000000 && word <= 0xffffffff))
      throw new Error('Each candidate must contain four 32-bit integer words');
    tested++;
    const [length, magic] = decryptBlock(raw.readUInt32BE(5), raw.readUInt32BE(9), key);
    // The encrypted prefix is [uncompressed length][first compressed bytes].
    // Bzip2 containers omit BZh1, so their first four bytes are 31 41 59 26.
    if (length > maxPlainBytes || (raw[0] === 1 ? magic !== 0x31415926 : magic >>> 8 !== 0x1f8b08)) continue;
    headerMatches++;
    try {
      const container = decryptContainer(raw, key), plain = unpack(container);
      if (plain.length === length) matches.push({key, container, plain});
    } catch { /* A header alone is not proof: require decompression and CRC. */ }
  }
  return {tested, headerMatches, matches};
}

if (require.main === module) {
  const [group, keys, ...extra] = process.argv.slice(2);
  if (!group || !keys || extra.length) {
    console.error('Usage: node scripts/find-js5-xtea-key.cjs GROUP.bin KEYS.json');
    process.exitCode = 2;
  } else {
    const raw = fs.readFileSync(group);
    const result = findKeys(raw, [[0, 0, 0, 0], ...JSON.parse(fs.readFileSync(keys, 'utf8'))]);
    const sha256 = bytes => require('node:crypto').createHash('sha256').update(bytes).digest('hex');
    console.log(JSON.stringify({groupSha256: sha256(raw), tested: result.tested,
      headerMatches: result.headerMatches, matches: result.matches.map(match => ({key: match.key,
        plainBytes: match.plain.length, plainSha256: sha256(match.plain)}))}));
    if (!result.matches.length) process.exitCode = 1;
  }
}

module.exports = {decryptBlock, decryptContainer, findKeys};
