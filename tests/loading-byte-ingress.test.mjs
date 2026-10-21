import test from 'node:test';
import assert from 'node:assert/strict';
import {freshLoadingBytes} from '../apps/loading/browser.mjs';

test('loading bytes preserve fresh typed and legacy wrapped runtime results',()=>{
  const source=new Int8Array([3,-128,-1]);
  for(const wrapped of [false,true]){
    const jvm={newByteArray(bytes){const array=new Int8Array(bytes);return wrapped?{type:'[B',array}:array;}};
    const first=freshLoadingBytes(jvm,source),second=freshLoadingBytes(jvm,source);
    assert.ok(first instanceof Int8Array);
    assert.deepEqual([...first],[3,-128,-1]);
    assert.notEqual(first,second);
    first[0]=17;
    assert.equal(source[0],3);
    assert.equal(second[0],3);
  }
  const owned=new Int8Array([4]);owned.wasmBase=32;
  assert.equal(freshLoadingBytes({newByteArray:()=>owned},source),owned);
});
