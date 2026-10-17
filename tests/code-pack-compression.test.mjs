import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {encodeCodePack,decodeCodePack,createCodePackStore} from '../apps/launcher/browser-loader/code-pack.mjs';

test('compressed code packs replay and verify entries independently, then release transport', async()=>{
  const identity={runtime:'runtime',source:'classes',patch:'test',configuration:'options'};
  const entries=new Map([['first','generated method body '.repeat(10000)],['second','other body']]);
  const bytes=encodeCodePack({identity,entries,compressEntry:gzipSync});
  assert.ok(bytes.length<entries.get('first').length/10);
  const pack=decodeCodePack(bytes);
  assert.deepEqual(pack.identity,identity);
  const replay=createCodePackStore('replay',pack);
  for(const [key,text] of entries)assert.equal(await replay.get(key),text);
  assert.equal(await replay.get('absent'),null);
  assert.equal(replay.stats.served,2);
  const verify=createCodePackStore('verify',pack);
  for(const [key,text] of entries)await verify.put(key,text);
  assert.equal(verify.stats.verified,2);
  replay.release();
  assert.equal(await replay.get('first'),null,'released pack is no longer retained by the store');
});

test('unrequested compressed entries are not decompressed; legacy packs still decode synchronously', async()=>{
  const entries=[['first','valid'],['second','invalid']];
  let index=0;
  const bytes=encodeCodePack({identity:{},entries,
    compressEntry:raw=>index++===0?gzipSync(raw):new Uint8Array([0,1,2])});
  const pack=decodeCodePack(bytes);
  assert.equal(await pack.get('first'),'valid');
  await assert.rejects(pack.get('second'));
  const legacy=decodeCodePack(encodeCodePack({identity:{},entries}));
  assert.equal(legacy.get('first'),'valid');
  assert.equal(legacy.get('missing'),null);
});
