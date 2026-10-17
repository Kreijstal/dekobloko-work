import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync, deflateSync} from 'node:zlib';
import {installBrowserInflater} from '../apps/launcher/browser-loader/browser-inflater.mjs';

for (const raw of [false, true]) test(`async platform inflater: ${raw ? 'raw' : 'zlib'}`, async () => {
  const vm = {jre: {'java/util/zip/Inflater': {methods: {}}}};
  const decompress = async (bytes, format) => new Uint8Array(await new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format))).arrayBuffer());
  installBrowserInflater(vm, {
    inflate: bytes => decompress(bytes, 'deflate'),
    inflateRaw: bytes => decompress(bytes, 'deflate-raw'),
  });
  const object = {}, methods = vm.jre['java/util/zip/Inflater'].methods;
  const call = (name, ...args) => methods[name](vm, object, args);
  const plain = new Uint8Array([0, 127, 128, 255, 11]);
  call('<init>(Z)V', raw ? 1 : 0);
  call('setInput([B)V', new Int8Array((raw ? deflateRawSync : deflateSync)(plain)));
  const first = new Int8Array(2), rest = new Int8Array(3);
  assert.equal(await call('inflate([B)I', first), 2);
  assert.equal(call('finished()Z'), 0);
  assert.equal(await call('inflate([B)I', rest), 3);
  assert.deepEqual([...first, ...rest], [0, 127, -128, -1, 11]);
  assert.equal(call('finished()Z'), 1);
  call('reset()V');
  call('setInput([B)V', new Int8Array([1, 2, 3]));
  await assert.rejects(call('inflate([B)I', first), error => error.type === 'java/util/zip/DataFormatException');
});
