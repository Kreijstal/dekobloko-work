import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {pack, unpack, reference, rebuildReference, rebuildMaster, whirlpool, masterBody, validateLibrary} = require('../scripts/lib/js5-cache-recovery.cjs');
const {crc32} = require('node:zlib');
function word(n, size=4) {const b=Buffer.alloc(size);b.writeUIntBE(n,0,size);return b;}
function fixture() {
  const old = pack(Buffer.from('old contents'));
  const table = pack(Buffer.concat([Buffer.from([6]), word(4), Buffer.from([3]), word(1,2), word(27,2),
    word(123), whirlpool(old), word(crc32(old)), word(2), word(1,2), word(0,2), word(0)]));
  const body=Buffer.concat([Buffer.from([1]),word(crc32(table)),word(4),whirlpool(table)]);
  return {table,master:pack(Buffer.concat([body,Buffer.from([10]),whirlpool(body)]),false)};
}
test('recovery rebuilds every checksum layer and preserves file identities', () => {
  const {table,master}=fixture(), bytes=pack(Buffer.from('recovered contents'));
  const next=rebuildReference(table,new Map([[27,bytes]]),crc32), ref=reference(next), entry=ref.entries[0];
  assert.equal(ref.version,5);
  assert.equal(entry.version,3);
  assert.equal(entry.crc,crc32(bytes));
  assert.equal(entry.name,123);
  assert.deepEqual(entry.files,[0]);
  assert.deepEqual(entry.fileNames,[0]);
  assert.deepEqual(ref.data.subarray(entry.digestOffset,entry.digestOffset+64),whirlpool(bytes));
  const rebuilt=rebuildMaster(master,new Map([[0,next]]),crc32);
  assert.equal(rebuilt.readUInt32BE(6),crc32(next));
  assert.equal(rebuilt.readUInt32BE(10),5);
  assert.deepEqual(rebuilt.subarray(14,78),whirlpool(next));
  assert.doesNotThrow(()=>masterBody(rebuilt));
  assert.notDeepEqual(rebuilt,master);
  assert.equal(reference(table).version,4);
  assert.equal(unpack(bytes).toString(),'recovered contents');
});
test('corrupt or unsupported master envelopes and undeclared groups are rejected', () => {
  const {table,master}=fixture();const corrupt=Buffer.from(master);corrupt[12]^=1;
  assert.throws(()=>rebuildMaster(corrupt,new Map(),crc32),/envelope/);
  assert.throws(()=>masterBody(master.subarray(0,-1)),/envelope/);
  assert.throws(()=>rebuildReference(table,new Map([[1,pack(Buffer.from('x'))]]),crc32),/Undeclared/);
  assert.throws(()=>unpack(Buffer.from([2,0,0,0,9])),/Truncated/);
});
test('native library validation distinguishes architecture and JNI API identity', () => {
  const elf=Buffer.alloc(128);Buffer.from('7f454c46','hex').copy(elf);elf[4]=2;elf[5]=1;
  elf.writeUInt16LE(3,16);elf.writeUInt16LE(62,18);elf.write('Java_jaclib_memory_test',64);
  assert.doesNotThrow(()=>validateLibrary(elf,'jaclib'));
  assert.throws(()=>validateLibrary(elf,'jaggl'),/identity/);
  elf.writeUInt16LE(3,18);assert.throws(()=>validateLibrary(elf,'jaclib'),/x86-64/);
});
