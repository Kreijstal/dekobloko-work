import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {installWasmOptimizer} from '../apps/loading/wasm-optimizer.mjs';

// (module (import "env" "fn" (func (param f64) (result f64)))
// (func (export "run") (param f64) (result f64) local.get 0 call 0))
const bytes=Uint8Array.from([0,97,115,109,1,0,0,0,1,6,1,96,1,124,1,124,
 2,10,1,3,101,110,118,2,102,110,0,0,3,2,1,0,7,7,1,3,114,117,110,0,1,10,8,1,6,0,32,0,16,0,11]);
const require=createRequire(import.meta.url);
const {T,OP,assembleModule,emitTryTableJsTag}=require('../../java-tools/src/jit/wasmShared');

test('post-optimized code keeps import results and thrown identity; hook ends before execution',()=>{
 const Original=WebAssembly.Module,optimizer=installWasmOptimizer({minimumBytes:0});
 let module;
 try{module=new WebAssembly.Module(bytes);}finally{optimizer.finishPreparation();}
 assert.equal(WebAssembly.Module,Original);
 const stats=optimizer.finishPreparation();
 assert.equal(stats.optimizedCount,1);assert.deepEqual(stats.errors,[]);
 assert.equal(stats.inputBytes,bytes.length);assert.ok(stats.outputBytes>0);
 assert.match(stats.toolSha256,/^[a-f0-9]{64}$/);
 const sentinel={identity:1};let calls=0;
 const instance=new WebAssembly.Instance(module,{env:{fn:x=>{
  calls++;if(x===7)throw sentinel;return -x;
 }}});
 assert.equal(instance.exports.run(2.5),-2.5);
 assert.ok(Object.is(instance.exports.run(0),-0));
 assert.throws(()=>instance.exports.run(7),error=>error===sentinel);
 assert.equal(calls,3);assert.equal(stats.optimizedCount,1,'execution does not invoke optimizer');
});

test('failed transforms cannot silently become successful diagnostics',()=>{
 for(const transform of [()=>new Uint8Array([1,2,3]),()=>{throw new Error('injected optimizer failure');}]){
  const Original=WebAssembly.Module,optimizer=installWasmOptimizer({minimumBytes:0,optimize:transform});
  try{assert.throws(()=>new WebAssembly.Module(bytes));}finally{optimizer.finishPreparation();}
  assert.equal(WebAssembly.Module,Original);
  assert.equal(optimizer.finishPreparation().errors.length,1);
 }
});

test('optimized JS-tag handlers preserve original host throwables',()=>{
 const body=[];
 emitTryTableJsTag(body,b=>b.push(OP.call,0),b=>b.push(OP.i32_const,5,OP.return),1);
 body.push(OP.i32_const,0,OP.return,OP.end);
 const input=assembleModule({importDecls:[{name:'thrower',params:[],results:[]},
  {name:'record',params:[T.ref],results:[]}],mainParams:[],mainResults:[T.i32],declared:[],body,importJsTag:true});
 const optimizer=installWasmOptimizer({minimumBytes:0});let module;
 try{module=new WebAssembly.Module(input);}finally{optimizer.finishPreparation();}
 const thrown={identity:42};let seen;
 const instance=new WebAssembly.Instance(module,{env:{js_tag:WebAssembly.JSTag,
  thrower:()=>{throw thrown;},record:e=>{seen=e;}}});
 assert.equal(instance.exports.run(),5);assert.equal(seen,thrown);
 assert.equal(optimizer.finishPreparation().optimizedCount,1);
});

test('optimized consumers retain GC type identity with an unoptimized producer',()=>{
 const {nativeObjectStorageTypes,getNativeObjectStorageOps}=require('../../java-tools/src/core/nativeObjectStorage');
 const ops=getNativeObjectStorageOps();assert.ok(ops);
 const store=ops.create(128,7,1);
 const input=assembleModule({importDecls:[],mainParams:[T.ref],mainResults:[T.i32],declared:[],
  body:[OP.local_get,0,0xfb,0x1a,0xfb,0x16,1,0xfb,2,1,0,OP.end],gcTypes:nativeObjectStorageTypes()});
 const optimizer=installWasmOptimizer({minimumBytes:0});let module;
 try{module=new WebAssembly.Module(input);}finally{optimizer.finishPreparation();}
 const instance=new WebAssembly.Instance(module);
 assert.equal(instance.exports.run(store),128);
 assert.equal(ops.classId(store),7);
 assert.equal(optimizer.finishPreparation().optimizedCount,1);
});

test('invalid compiler candidates and small modules retain their original path',()=>{
 let transforms=0;const optimizer=installWasmOptimizer({minimumBytes:16,optimize:input=>{transforms++;return input;}});
 try{
  new WebAssembly.Module(Uint8Array.from([0,97,115,109,1,0,0,0]));
  assert.throws(()=>new WebAssembly.Module(new Uint8Array(32)),WebAssembly.CompileError);
  assert.equal(transforms,0);
  assert.equal(optimizer.finishPreparation().skippedInvalid,1);
  assert.deepEqual(optimizer.finishPreparation().errors,[]);
 }finally{optimizer.finishPreparation();}
});
