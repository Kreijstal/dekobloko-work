'use strict';
const zlib = require('node:zlib');
const {spawnSync} = require('node:child_process');
// Decode archive reference metadata (protocols 5, 6, 7). Protocol 7 uses
// unsigned large-smarts for counts and group/file id deltas.
function parseReferenceTable(raw) {
  if (!raw || raw.length < 5) throw new Error('Truncated JS5 container');
  const length = raw.readUInt32BE(1);
  let data;
  if (raw[0] === 0) data = raw.subarray(5, 5 + length);
  else if (raw[0] === 2) data = zlib.gunzipSync(raw.subarray(9, 9 + length));
  else if (raw[0] === 1) {
    const result = spawnSync('bzip2', ['-dc'], {input: Buffer.concat([Buffer.from('BZh1'), raw.subarray(9, 9 + length)]), maxBuffer: 128 * 1024 * 1024});
    if (result.status !== 0) throw new Error(`JS5 bzip2: ${result.error?.message || result.stderr}`);
    data = result.stdout;
  } else throw new Error(`Unsupported JS5 compression ${raw[0]}`);
  let offset = 0;
  const u8 = () => data.readUInt8(offset++);
  const u16 = () => {const n = data.readUInt16BE(offset);offset+=2;return n;};
  const u32 = () => {const n = data.readUInt32BE(offset);offset+=4;return n;};
  const protocol = u8();
  if (protocol < 5 || protocol > 7) throw new Error(`Unsupported JS5 reference protocol ${protocol}`);
  if (protocol >= 6) u32();
  const flags = u8();
  const countValue = () => protocol >= 7 && data[offset] & 128 ? u32() & 0x7fffffff : u16();
  const count = countValue();
  if (count > 100000) throw new Error('Invalid JS5 group count');
  const ids=[];let id=0;
  for(let i=0;i<count;i++){id+=countValue();ids.push(id);}
  if(flags&1)offset+=count*4;
  if(flags&2)offset+=count*64;
  const crcs=ids.map(()=>u32());
  return new Map(ids.map((id,i)=>[id,{crc:crcs[i],version:u32()}]));
}
module.exports={parseReferenceTable};
