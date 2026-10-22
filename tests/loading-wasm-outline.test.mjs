import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {outlineWat,parseWat,printWat} from '../apps/loading/wasm-loop-outline.mjs';
const features=['--mvp-features','--enable-mutable-globals','--enable-reference-types','--enable-gc','--enable-multivalue',
 '--enable-exception-handling','--enable-nontrapping-float-to-int','--enable-sign-ext','--enable-bulk-memory'];
const assemble=wat=>execFileSync('wasm-as',[...features,'-','-o','-'],{input:wat});
const build=(source,options={},imports={})=>{
 const result=outlineWat(source,{minimumMemoryOps:0,...options});
 assert.ok(result.outlinedLoops.length,'fixture must exercise outlining');
 const bytes=assemble(result.wat);assert.ok(WebAssembly.validate(bytes));
 return {...result,exports:new WebAssembly.Instance(new WebAssembly.Module(bytes),imports).exports};
};
const scalar=`(module (import "env" "spill" (func $spill (param i32)))
 (import "env" "tail" (func $tail))
 (func $kernel (export "run") (param $n i32)(param $fuel i32)(result i32)(local $i i32)(local $sum i32)(local $last i32)
  (local.set $sum (i32.const 5))(local.set $last (i32.const 17))
  (loop $again
   (local.set $fuel (i32.sub (local.get $fuel)(i32.const 1)))
   (if (i32.le_s (local.get $fuel)(i32.const 0))(then (call $spill (local.get $sum))(return (i32.const -7))))
   (if (i32.ge_s (local.get $i)(local.get $n))
    (then (call $tail)(return (i32.add (local.get $sum)(local.get $last))))
    (else (local.set $last (i32.const 9))
     (local.set $sum (i32.add (i32.mul (local.get $sum)(i32.const 33))(local.get $i)))
     (local.set $i (i32.add (local.get $i)(i32.const 1)))(br $again))))))`;

test('outlined loops preserve zero trips, signed arithmetic, continuation and fuel exits',()=>{
 let tails=0;const spills=[];
 const {exports,outlinedLoops}=build(scalar,{}, {env:{spill:x=>spills.push(x),tail:()=>tails++}});
 assert.equal(outlinedLoops.length,1);
 for(const n of [-1,0,1,2,10]){
  let sum=5;for(let i=0;i<n;i++)sum=(Math.imul(sum,33)+i)|0;
  const before=tails;assert.equal(exports.run(n,1000),(sum+(n>0?9:17))|0);assert.equal(tails,before+1);
 }
 const before=tails;assert.equal(exports.run(4,1),-7);assert.deepEqual(spills,[5]);assert.equal(tails,before);
 assert.equal(exports.run(4,3),-7);assert.deepEqual(spills,[5,5446]);assert.equal(tails,before);
});

test('checked imports keep exception identity and exact partial writes',()=>{
 const source=`(module (import "env" "bounds" (func $bounds (param i32)))
 (memory (export "memory") 1)
 (func $kernel (export "run")(param $n i32)(param $len i32)(result i32)(local $i i32)
  (loop $again (if (i32.ge_s (local.get $i)(local.get $n))(then (return (i32.const 77)))
   (else
    (if (i32.ge_u (local.get $i)(local.get $len))(then (call $bounds (local.get $i)) unreachable))
    (i32.store (i32.shl (local.get $i)(i32.const 2))(i32.add (local.get $i)(i32.const 10)))
    (local.set $i (i32.add (local.get $i)(i32.const 1)))(br $again))))))`;
 const failure={identity:42},seen=[];
 const {exports}=build(source,{}, {env:{bounds:i=>{seen.push(i);throw failure;}}});
 const values=new Int32Array(exports.memory.buffer,0,4);
 assert.throws(()=>exports.run(4,2),e=>e===failure);assert.deepEqual(seen,[2]);assert.deepEqual([...values],[10,11,0,0]);
 assert.equal(exports.run(0,0),77);assert.deepEqual(seen,[2]);
});

test('wide and floating live outputs preserve precision and signed zero',()=>{
 const source=`(module (global $wide (export "wide") (mut i64)(i64.const 0))
 (global $float (export "float") (mut f64)(f64.const 0))
 (func $kernel (export "run")(param $n i32)(param $seed i64)(param $x f64)(result i32)(local $i i32)(local $last i64)
  (local.set $last (local.get $seed))
  (loop $again (if (i32.ge_s (local.get $i)(local.get $n))
   (then (global.set $wide (local.get $last))(global.set $float (local.get $x))(return (i32.const -1)))
   (else (local.set $last (i64.mul (local.get $seed)(i64.const 31)))
    (local.set $seed (i64.add (local.get $seed)(i64.const 1)))
    (local.set $x (f64.neg (local.get $x)))
    (local.set $i (i32.add (local.get $i)(i32.const 1)))(br $again))))))`;
 const {exports}=build(source);
 for(const n of [0,1,3])for(const seed of [9007199254740993n,9223372036854775807n])for(const x of [-0,NaN,Infinity,-Infinity]){
  let last=seed,current=seed,value=x;for(let i=0;i<n;i++){last=BigInt.asIntN(64,current*31n);current=BigInt.asIntN(64,current+1n);value=-value;}
  assert.equal(exports.run(n,seed,x),-1);assert.equal(exports.wide.value,last);assert.ok(Object.is(exports.float.value,value));
 }
});

test('multiple outlined loops do not duplicate nested normal continuations',()=>{
 const source=`(module (import "env" "tail"(func $tail))
 (func $kernel (export "run")(param $n i32)(result i32)(local $i i32)(local $j i32)(local $sum i32)
 (loop $a (if(i32.ge_s(local.get $i)(local.get $n))
  (then (loop $b (if(i32.ge_s(local.get $j)(local.get $n))
   (then (call $tail)(return(local.get $sum)))
   (else(local.set $sum(i32.add(local.get $sum)(i32.const 2)))(local.set $j(i32.add(local.get $j)(i32.const 1)))(br $b)))))
  (else(local.set $sum(i32.add(local.get $sum)(i32.const 1)))(local.set $i(i32.add(local.get $i)(i32.const 1)))(br $a))))))`;
 let tails=0;const {exports,outlinedLoops}=build(source,{maxHelpers:2},{env:{tail:()=>tails++}});
 assert.equal(outlinedLoops.length,2);for(const n of [0,1,7])assert.equal(exports.run(n),n*3);assert.equal(tails,3);
});

test('escaping branches, nonnullable captures and bounded captures are refused',()=>{
 const escaping=`(module(func $kernel(result i32)(local $i i32)
  (block $outside(loop $again(if(i32.eqz(local.get $i))(then(return(i32.const 1)))
   (else(br $outside))))) (i32.const 2)))`;
 const refused=outlineWat(escaping,{minimumMemoryOps:0});assert.equal(refused.outlinedLoops.length,0);assert.equal(refused.wat,escaping);
 for(const options of [{maxInputs:0},{maxOutputs:0}]){
  const result=outlineWat(scalar,{minimumMemoryOps:0,...options});assert.equal(result.outlinedLoops.length,0);assert.ok(result.refusals['capture-budget']);
 }
});

test('existing names and nested WAT comments cannot change the transformation',()=>{
 const source=scalar.replace('$kernel','$jvm_outline_0').replace('$again','$outline_done_0').replaceAll('(br $again)','(br $outline_done_0)')
  .replace('(module','(module (; outer (; nested ;) ;)');
 const {exports,outlinedLoops}=build(source,{}, {env:{spill:()=>{},tail:()=>{}}});
 assert.notEqual(outlinedLoops[0].helper,'$jvm_outline_0');assert.equal(exports.run(0,100),22);
 assert.equal(parseWat(printWat(parseWat(source)))[0],'module');
});

test('outlined GC consumers retain identity with an untransformed producer',()=>{
 const require=createRequire(import.meta.url),{nativeObjectStorageTypes,getNativeObjectStorageOps}=require('../../java-tools/src/core/nativeObjectStorage');
 const {T,OP,assembleModule}=require('../../java-tools/src/jit/wasmShared');
 const ops=getNativeObjectStorageOps(),store=ops.create(128,7,1);
 const seed=assembleModule({importDecls:[],mainParams:[T.ref],mainResults:[T.i32],declared:[],
  body:[OP.local_get,0,0xfb,0x1a,0xfb,0x16,1,0xfb,2,1,0,OP.end],gcTypes:nativeObjectStorageTypes()});
 let source=execFileSync('wasm-dis',['--all-features','-'],{input:seed,encoding:'utf8'});
 const tree=parseWat(source),fn=tree.find(n=>Array.isArray(n)&&n[0]==='func');
 const expression=fn.at(-1);fn.splice(fn.length-1,1,['local','$i','i32'],['local','$sum','i32'],
  ['loop','$again',['if',['i32.ge_s',['local.get','$i'],['i32.const','3']],
   ['then',['return',['local.get','$sum']]],['else',['local.set','$sum',['i32.add',['local.get','$sum'],expression]],
    ['local.set','$i',['i32.add',['local.get','$i'],['i32.const','1']]],['br','$again']]]]);
 const {exports}=build(printWat(tree));assert.equal(exports.run(store),384);assert.equal(ops.classId(store),7);
});

test('exit-arm backedges and premature nonnullable captures are refused',()=>{
 const source=`(module (type $s(struct(field i32)))
 (func $kernel(param $x(ref $s))(result i32)(local $i i32)
 (loop $again(if(i32.ge_s(local.get $i)(i32.const 2))(then(return(i32.const 1)))
 (else(drop(struct.get $s 0(local.get $x)))(local.set $i(i32.add(local.get $i)(i32.const 1)))(br $again))))))`;
 const result=outlineWat(source,{minimumMemoryOps:0});assert.equal(result.outlinedLoops.length,0);
 assert.ok(result.refusals['unknown-tuple-or-nonnullable-local']);
 const backedge=scalar.replace('(call $tail)(return (i32.add (local.get $sum)(local.get $last)))','(br $again)');
 const refused=outlineWat(backedge,{minimumMemoryOps:0});assert.equal(refused.outlinedLoops.length,0);assert.ok(refused.refusals['exit-arm-backedge']);
});

test('preparation hook transforms the active module and restores the constructor before execution',async()=>{
 const {installWasmLoopOutliner}=await import('../apps/loading/wasm-loop-outline.mjs');
 const {createHash}=await import('node:crypto');
 const source=scalar.replace('(func $kernel','(memory 1)(data(i32.const 0)"'+'x'.repeat(20000)+'") (func $kernel');
 const input=execFileSync('wasm-as',[...features,'-g','-','-o','-'],{input:source});
 const Original=WebAssembly.Module,outliner=installWasmLoopOutliner({functionPrefix:'$kernel',minimumMemoryOps:0});
 let module;try{module=new WebAssembly.Module(input);}finally{outliner.finishPreparation();}
 assert.equal(WebAssembly.Module,Original);
 const before=outliner.finishPreparation();assert.ok(before.outlinedLoops.length,JSON.stringify(before));
 const digest=createHash('sha256').update(input).digest('hex'),preview=outliner.writePreview(digest),stats=outliner.finishPreparation();
 assert.notEqual(preview.outputSha256,digest);assert.equal(stats.outlinedLoops.length,1);assert.deepEqual(stats.errors,[]);
 assert.ok(stats.options.assemble.includes('--enable-gc'));assert.ok(!JSON.stringify(stats.options).includes('-O3'));
 let tails=0;const instance=new WebAssembly.Instance(module,{env:{spill:()=>{},tail:()=>tails++}});
 assert.equal(instance.exports.run(0,100),22);assert.equal(tails,1);assert.equal(stats.optimizedCount,1);
});

test('outer JS-tag handlers still catch throws through an outlined helper',()=>{
 const source=`(module (import "env" "js_tag"(tag $js(param externref)))
 (import "env" "raise"(func $raise))(import "env" "record"(func $record(param externref)))
 (func $core(result i32)(local $i i32)
  (loop $again(if(i32.ge_s(local.get $i)(i32.const 1))(then(return(i32.const 42)))
   (else(call $raise)(local.set $i(i32.add(local.get $i)(i32.const 1)))(br $again)))))
 (func $wrapper(export "run")(result i32)(local $r i32)
  (block $end(call $record(block $catch(result externref)
   (try_table(catch $js $catch)(local.set $r(call $core)))(br $end)))
   (local.set $r(i32.const -5)))(local.get $r)))`;
 const thrown={identity:'outer-tag'},seen=[];let throwing=true;
 const {exports}=build(source,{functionPrefix:'$core'},{env:{js_tag:WebAssembly.JSTag,
  raise:()=>{if(throwing)throw thrown;},record:value=>seen.push(value)}});
 assert.equal(exports.run(),-5);assert.equal(seen[0],thrown);
 throwing=false;assert.equal(exports.run(),42);assert.equal(seen.length,1);
});

test('cold exits preserve updated snapshots without capturing cold-only references',()=>{
 const source=`(module(import "env" "spill"(func $spill(param i32 externref i32)))
 (func $core(export "run")(param $n i32)(param $fuel i32)(param $token externref)(result i32)(local $i i32)
 (loop $again
  (local.set $fuel(i32.sub(local.get $fuel)(i32.const 1)))
  (if(i32.le_s(local.get $fuel)(i32.const 0))(then(call $spill(i32.const 1)(local.get $token)(local.get $i))(return(i32.const -7))))
  (if(i32.eq(local.get $i)(i32.const 2))(then(call $spill(i32.const 2)(local.get $token)(local.get $i))(return(i32.const -9))))
  (if(i32.ge_s(local.get $i)(local.get $n))(then(return(local.get $i)))
   (else(local.set $i(i32.add(local.get $i)(i32.const 1)))(br $again))))))`;
 const token={identity:'snapshot'},seen=[],failure={identity:'spill-throw'};let throwing=false;
 const result=build(source,{}, {env:{spill:(tag,ref,i)=>{seen.push([tag,ref,i]);if(throwing)throw failure;}}});
 const helper=parseWat(result.wat).find(n=>Array.isArray(n)&&n[0]==='func'&&n[1]===result.outlinedLoops[0].helper);
 assert.ok(!helper.some(n=>Array.isArray(n)&&n[0]==='param'&&n[1]==='$token'),'cold-only reference stays in the caller');
 assert.equal(result.outlinedLoops[0].sideExits,2);
 assert.equal(result.exports.run(1,100,token),1);assert.deepEqual(seen,[]);
 assert.equal(result.exports.run(5,100,token),-9);assert.deepEqual(seen,[[2,token,2]]);
 assert.equal(result.exports.run(5,2,token),-7);assert.deepEqual(seen.at(-1),[1,token,1]);
 throwing=true;assert.throws(()=>result.exports.run(5,2,token),e=>e===failure);assert.deepEqual(seen.at(-1),[1,token,1]);
});

test('import selection targets the loop body rather than its cold continuation',()=>{
 const source=scalar.replace('(module','(module (import "env" "work" (func $work))')
  .replace('(local.set $last (i32.const 9))','(call $work)(local.set $last (i32.const 9))');
 let calls=0;const result=build(source,{requiredImportName:'work'},{env:{work:()=>calls++,spill:()=>{},tail:()=>{}}});
 assert.equal(result.outlinedLoops[0].requiredCallSites,1);assert.equal(result.exports.run(3,100),179729);assert.equal(calls,3);
 const absent=outlineWat(source,{minimumMemoryOps:0,requiredImportName:'tail'});assert.equal(absent.outlinedLoops.length,0);
});
