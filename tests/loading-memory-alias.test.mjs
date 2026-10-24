import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryAliasEngines,memoryAliasKernels,buildMemoryAlias,initializeMemoryAlias,memoryAliasOracle,memoryAliasState,memoryAliasArgument} from '../apps/loading/memory-alias.mjs';

function check(engine,kernel,n,options={}){
 const c=buildMemoryAlias(engine,kernel,options),setup=initializeMemoryAlias(c,options),expected=memoryAliasOracle(kernel,n,options);
 let result,error;try{result=c.exports.run(n,memoryAliasArgument(c,setup.stateBase),setup.arrayBase,options.length??1024,options.fuel??1000000000);}catch(e){error=e;}
 assert.deepEqual(error,expected.error);
 if(!error)assert.deepEqual(result,[expected.sum,expected.fuel]);
 assert.deepEqual(Array.from(new Int32Array(c.data.buffer,setup.arrayBase,1024)),expected.data);
 assert.deepEqual(memoryAliasState(c,setup.stateBase),expected.state);
 return {c,result};
}
test('new alias controls preserve integer operations, output and exact fuel across storage forms',()=>{
 for(const kernel of memoryAliasKernels)for(const engine of ['shared','imported','owned']){
  for(const n of [0,1,1024,2049])check(engine,kernel,n);
  check(engine,kernel,4,{fuel:3});check(engine,kernel,4,{length:3});
  check(engine,kernel,0,{length:0});
 }
});
test('two imported memory names may alias and must observe intervening writes',()=>{
 for(const kernel of memoryAliasKernels){
  const options={alias:true,stateBase:4096};
  const shared=check('shared',kernel,128,options),imported=check('imported',kernel,128,options);
  assert.deepEqual(shared.result,imported.result);
  assert.equal(imported.c.data,imported.c.state);
  assert.notDeepEqual(memoryAliasOracle(kernel,128,options).state,memoryAliasOracle(kernel,128,{stateBase:4096}).state);
 }
 assert.throws(()=>buildMemoryAlias('owned',memoryAliasKernels[0],{alias:true}));
});


test('typed GC state has the same mutable-field, array, fuel and fault behavior',()=>{
 for(const engine of ['gc-struct','gc-array'])for(const kernel of memoryAliasKernels){
  for(const n of [0,1,1024,2049])check(engine,kernel,n);
  check(engine,kernel,4,{fuel:3});check(engine,kernel,4,{length:3});check(engine,kernel,0,{length:0});
  assert.throws(()=>buildMemoryAlias(engine,kernel,{alias:true}));
 }
});


test('global state preserves operations and imported global names may alias',()=>{
 for(const engine of ['global-imported','global-owned'])for(const kernel of memoryAliasKernels){
  for(const n of [0,1,1024,2049])check(engine,kernel,n);
  check(engine,kernel,4,{fuel:3});check(engine,kernel,4,{length:3});check(engine,kernel,0,{length:0});
 }
 const c=buildMemoryAlias('global-imported','array-read-state-write',{globalAlias:true});const setup=initializeMemoryAlias(c);
 assert.equal(c.state[0],c.state[1]);assert.equal(c.state[1],c.state[2]);
 let value=11;const a=new Int32Array(c.data.buffer,setup.arrayBase,1024);
 for(let i=0;i<128;i++){value=(value+1)&31;value=(Math.imul(value,33)+a[i])|0;value^=a[i];}
 assert.deepEqual(c.exports.run(128,setup.stateBase,setup.arrayBase,1024,1000),[0,871]);
 assert.deepEqual(memoryAliasState(c),[value,value,value]);
});
