import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {gzipSync} from 'node:zlib';
const {parseReferenceTable}=createRequire(import.meta.url)('../scripts/lib/js5-reference.cjs');
function container(data, gzip=false){const payload=gzip?gzipSync(data):data;const header=Buffer.alloc(gzip?9:5);header[0]=gzip?2:0;header.writeUInt32BE(payload.length,1);if(gzip)header.writeUInt32BE(data.length,5);return Buffer.concat([header,payload]);}
for(const version of [5,6,7]) for(const gzip of [false,true]) test(`JS5 reference protocol ${version}, gzip ${gzip}`,()=>{
  const prefix=Buffer.from(version>=6?[version,0,0,0,1,0]:[version,0]);
  const groups=Buffer.alloc(22);groups.writeUInt16BE(2,0);groups.writeUInt16BE(1,2);groups.writeUInt16BE(3,4);groups.writeUInt32BE(0x87654321,6);groups.writeUInt32BE(0x12345678,10);groups.writeUInt32BE(7,14);groups.writeUInt32BE(8,18);
  assert.deepEqual([...parseReferenceTable(container(Buffer.concat([prefix,groups]),gzip))],[[1,{crc:0x87654321,version:7}],[4,{crc:0x12345678,version:8}]]);
});
test('protocol 7 handles a group id larger than 65535',()=>{
  const b=Buffer.from([7,0,0,0,1,0,0,1,128,1,0,1,18,52,86,120,0,0,0,2]);assert.deepEqual([...parseReferenceTable(container(b))],[[65537,{crc:0x12345678,version:2}]]);
});
test('truncated references fail explicitly',()=>assert.throws(()=>parseReferenceTable(Buffer.from([0,0,0,0,1,7]))));
