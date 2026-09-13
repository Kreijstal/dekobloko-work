'use strict';
const zlib = require('node:zlib');
const {spawnSync} = require('node:child_process');

function unpack(raw) {
  if (raw.length < 5) throw new Error('Truncated container');
  const n = raw.readUInt32BE(1), header = raw[0] ? 9 : 5;
  if (raw.length < header + n) throw new Error('Truncated payload');
  let data;
  if (raw[0] === 0) data = raw.subarray(5, 5 + n);
  else if (raw[0] === 2) data = zlib.gunzipSync(raw.subarray(9, 9 + n));
  else if (raw[0] === 1) {
    const r = spawnSync('bzip2', ['-dc'], {input: Buffer.concat([Buffer.from('BZh1'), raw.subarray(9, 9 + n)]), maxBuffer: 64 * 1024 * 1024});
    if (r.status !== 0) throw new Error('Cannot decode bzip2 container');
    data = r.stdout;
  } else throw new Error('Unsupported compression');
  if (raw[0] && data.length !== raw.readUInt32BE(5)) throw new Error('Uncompressed length mismatch');
  return data;
}

function pack(data, compressed = true) {
  const payload = compressed ? zlib.gzipSync(data, {level: 9}) : data;
  const head = Buffer.alloc(compressed ? 9 : 5);
  head[0] = compressed ? 2 : 0;
  head.writeUInt32BE(payload.length, 1);
  if (compressed) head.writeUInt32BE(data.length, 5);
  return Buffer.concat([head, payload]);
}

function whirlpool(bytes) {
  const r = spawnSync('openssl', ['dgst', '-whirlpool', '-provider', 'legacy', '-binary'], {input: bytes});
  if (r.status !== 0 || r.stdout.length !== 64) throw new Error('OpenSSL legacy Whirlpool provider required');
  return r.stdout;
}

function reference(raw) {
  const data = Buffer.from(unpack(raw)); let offset = 0;
  const u8 = () => data.readUInt8(offset++);
  const u16 = () => {const v = data.readUInt16BE(offset); offset += 2; return v;};
  const u32 = () => {const v = data.readUInt32BE(offset); offset += 4; return v;};
  const protocol = u8();
  if (protocol < 5 || protocol > 7) throw new Error('Unsupported reference protocol');
  const version = protocol >= 6 ? u32() : 0, flags = u8();
  if (flags & ~3) throw new Error('Unsupported reference flags');
  const count = () => protocol >= 7 && data[offset] & 128 ? u32() & 0x7fffffff : u16();
  const size = count(), entries = []; let id = 0;
  if (size > 100000) throw new Error('Invalid group count');
  for (let i = 0; i < size; i++) entries.push({id: id += count()});
  if (flags & 1) for (const e of entries) e.name = u32();
  if (flags & 2) for (const e of entries) {e.digestOffset = offset; offset += 64;}
  for (const e of entries) {e.crcOffset = offset; e.crc = u32();}
  for (const e of entries) {e.versionOffset = offset; e.version = u32();}
  for (const e of entries) e.fileCount = u16();
  for (const e of entries) {let file = 0; e.files = Array.from({length: e.fileCount}, () => file += count());}
  if (flags & 1) for (const e of entries) e.fileNames = e.files.map(u32);
  if (offset !== data.length) throw new Error('Reference table has unexplained bytes');
  return {data, protocol, version, flags, entries};
}

function rebuildReference(raw, replacements, crc32) {
  const ref = reference(raw);
  for (const [id, bytes] of replacements) {
    const e = ref.entries.find(e => e.id === id);
    if (!e) throw new Error(`Undeclared group ${id}`);
    ref.data.writeUInt32BE(crc32(bytes), e.crcOffset);
    ref.data.writeUInt32BE((e.version + 1) >>> 0, e.versionOffset);
    if (e.digestOffset !== undefined) whirlpool(bytes).copy(ref.data, e.digestOffset);
  }
  if (ref.protocol >= 6) ref.data.writeUInt32BE((ref.version + 1) >>> 0, 1);
  return pack(ref.data);
}

function masterBody(raw) {
  if (raw[0] !== 0) throw new Error('Unsupported master compression');
  const end = 6 + raw[5] * 72;
  if (raw.length !== end + 65 || raw.readUInt32BE(1) !== raw.length - 5 ||
      !whirlpool(raw.subarray(5, end)).equals(raw.subarray(end + 1))) {
    throw new Error('Master is not the supported 65-byte digest envelope');
  }
  return end;
}

function rebuildMaster(raw, tables, crc32) {
  const end = masterBody(raw), result = Buffer.from(raw);
  for (const [archive, bytes] of tables) {
    if (archive < 0 || archive >= raw[5]) throw new Error('Undeclared archive');
    const offset = 6 + archive * 72, ref = reference(bytes);
    result.writeUInt32BE(crc32(bytes), offset);
    result.writeUInt32BE(ref.version, offset + 4);
    whirlpool(bytes).copy(result, offset + 8);
  }
  whirlpool(result.subarray(5, end)).copy(result, end + 1);
  return result;
}

function nameHash(name) {
  let hash = 0;
  for (const c of name.toLowerCase()) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  return hash;
}

function validateLibrary(data, library) {
  if (data.length < 64 || data.subarray(0, 4).toString('hex') !== '7f454c46' ||
      data[4] !== 2 || data[5] !== 1 || data.readUInt16LE(16) !== 3 || data.readUInt16LE(18) !== 62)
    throw new Error('Expected an x86-64 Linux ELF shared library');
  const marker = library === 'jaclib' ? 'Java_jaclib_memory_' : library === 'jaggl' ? 'Java_jaggl_OpenGL_' : null;
  if (!marker || !data.includes(Buffer.from(marker))) throw new Error('Native API identity mismatch');
}

module.exports = {unpack, pack, whirlpool, reference, rebuildReference, rebuildMaster, masterBody, nameHash, validateLibrary};
