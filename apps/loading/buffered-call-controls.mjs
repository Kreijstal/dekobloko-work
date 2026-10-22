// Valid-data controls for native call boundaries, not a Java implementation.
// Every mode uses the same reader instructions, requests, memory and checks.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateBufferedWorkload} from './buffered-replay.mjs';

export const bufferedCallKinds=['buffered-call-local','buffered-call-import','buffered-call-table','buffered-call-status'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const signature=status=>`(type $reader (func (param i32 i32) (result i32${status?' i32':''})))`;
const poll=`(global.set $fuel (i32.sub (global.get $fuel) (i32.const 1)))
 (if (i32.le_s (global.get $fuel) (i32.const 0)) (then unreachable))`;
const reader=(status=false)=>`(func $read (export "read") (type $reader) (param $count i32) (param $state i32) (result i32${status?' i32':''})
 (local $index i32)(local $length i32)(local $value i32)
 (block $ready (loop $refill
  (br_if $ready (i32.ge_s (i32.load (local.get $state)) (local.get $count)))
  ${poll}
  (local.set $index (i32.load offset=8 (local.get $state)))
  (local.set $length (i32.load offset=20 (local.get $state)))
  (if (i32.ge_u (local.get $index) (local.get $length))
   (then (throw $bounds (call $error (local.get $index) (local.get $length)))))
  (i32.store offset=4 (local.get $state)
   (i32.or (i32.shl (i32.load offset=4 (local.get $state)) (i32.const 8))
    (i32.and (i32.load8_s (i32.add (i32.load offset=16 (local.get $state)) (local.get $index))) (i32.const 255))))
  (i32.store (local.get $state) (i32.add (i32.load (local.get $state)) (i32.const 8)))
  (i32.store offset=8 (local.get $state) (i32.add (i32.load offset=8 (local.get $state)) (i32.const 1)))
  (i32.store offset=12 (local.get $state) (i32.add (i32.load offset=12 (local.get $state)) (i32.const 1)))
  (br $refill)))
 (local.set $value (i32.and
  (i32.shr_s (i32.load offset=4 (local.get $state)) (i32.sub (i32.load (local.get $state)) (local.get $count)))
  (i32.sub (i32.shl (i32.const 1) (local.get $count)) (i32.const 1))))
 (i32.store (local.get $state) (i32.sub (i32.load (local.get $state)) (local.get $count)))
 ${status?'(i32.const -1) ':''}(local.get $value))`;
const baseImports=`(import "env" "memory" (memory 1))
 (import "env" "fuel" (global $fuel (mut i32)))`;
const readerImports=`(import "env" "bounds" (tag $bounds (param externref)))
 (import "env" "error" (func $error (param i32 i32) (result externref)))`;

export function bufferedCallSources(kind){
 assert.ok(bufferedCallKinds.includes(kind),'Unknown native call control');
 const local=kind==='buffered-call-local',status=kind==='buffered-call-status';
 const table=kind==='buffered-call-table'||status,read=reader(status);
 const call=table?'(call_indirect (type $reader) (local.get $width) (local.get $state) (i32.const 0))':
  '(call $read (local.get $width) (local.get $state))';
 const consume=status?`${call} (local.set $value) (local.set $status)
   (if (i32.ge_s (local.get $status) (i32.const 0)) (then unreachable))
   (local.set $sum (i32.add (i32.mul (local.get $sum) (i32.const 33)) (local.get $value)))`:
  `(local.set $sum (i32.add (i32.mul (local.get $sum) (i32.const 33)) ${call}))`;
 const caller=`(func (export "run") (param $n i32) (param $state i32) (param $widths i32) (result i32)
  (local $i i32)(local $sum i32)(local $width i32)${status?'(local $status i32)(local $value i32)':''}
  (block $done (loop $next
   (br_if $done (i32.ge_s (local.get $i) (local.get $n)))
   ${poll}
   (local.set $width (i32.and (i32.load8_u (i32.add (local.get $widths) (local.get $i))) (i32.const 31)))
   ${consume}
   (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $next)))
  (local.get $sum))`;
 return {reader:read,readerCore:reader(),provider:`(module ${signature(status)} ${baseImports} ${readerImports} ${read})`,
  caller:`(module ${signature(status)} ${baseImports}
   ${local?readerImports:table?'(import "env" "table" (table 1 funcref))':
    '(import "env" "read" (func $read (type $reader)))'}
   ${local?read:''} ${caller})`};
}

export function measureBufferedCallControl(kind,input,workload,count,reference){
 validateBufferedWorkload(workload);
 assert.equal(hash(input),workload.inputSha256,'Original input changed');
 assert.ok(Number.isSafeInteger(count)&&count>0&&count<=workload.requests,'Invalid control request count');
 assert.ok(Array.isArray(reference)&&reference.length===5,'Missing original-method state oracle');
 const requests=Buffer.from(workload.encoded,'base64').subarray(0,count);
 const state=64,inputBase=256,widthsBase=(inputBase+input.length+15)&~15;
 const memory=new WebAssembly.Memory({initial:Math.ceil((widthsBase+count)/65536)});
 new Uint8Array(memory.buffer,inputBase,input.length).set(input);
 new Uint8Array(memory.buffer,widthsBase,count).set(requests);
 const fields=new Int32Array(memory.buffer,state,6);
 fields.set([0,0,9,0,inputBase,input.length]);
 const fuel=new WebAssembly.Global({value:'i32',mutable:true},100_000_000);
 const bounds=WebAssembly.JSTag;assert.ok(bounds,'Native JavaScript exception tags are required');
 const env={memory,fuel,bounds,error:(index,length)=>({type:'java/lang/ArrayIndexOutOfBoundsException',index,length})};
 const sources=bufferedCallSources(kind);
 const assemble=source=>execFileSync('wasm-as',['--enable-exception-handling','--enable-reference-types','--enable-multivalue','-','-o','-'],{input:source});
 let provider,providerBytes;
 if(kind!=='buffered-call-local'){
  providerBytes=assemble(sources.provider);
  provider=new WebAssembly.Instance(new WebAssembly.Module(providerBytes),{env});
  if(kind==='buffered-call-import')env.read=provider.exports.read;
  else {env.table=new WebAssembly.Table({element:'anyfunc',initial:1});env.table.set(0,provider.exports.read);
   assert.equal(env.table.get(0),provider.exports.read,'Table must hold the native function itself');}
 }
 const callerBytes=assemble(sources.caller),module=new WebAssembly.Module(callerBytes);
 const caller=new WebAssembly.Instance(module,{env});
 provider||=caller;
 // Exactly one execution: module construction and data installation are outside timing.
 const start=performance.now(),streamChecksum=caller.exports.run(count,state,widthsBase),elapsedMs=performance.now()-start;
 const bufferedState=Array.from(fields.subarray(0,4));
 // The Java fixture folds final state after stopping its timer too.
 const checksum=bufferedState.reduce((sum,value)=>(Math.imul(sum,31)+value)|0,streamChecksum);
 assert.deepEqual([checksum,...bufferedState],reference,'Native control differs from original Java reader');
 // Negative and end indices fail before any field writes, as in the original reader.
 for(const index of [-1,input.length]){
  fields.set([0,123,index,17]);const before=Array.from(fields);
  assert.throws(()=>caller.exports.run(1,state,widthsBase),error=>error.type==='java/lang/ArrayIndexOutOfBoundsException'&&
   error.index===index&&error.length===input.length);
  assert.deepEqual(Array.from(fields),before,'Failed input access changed reader state');
 }
 fields.set([requests[0]&31,1,input.length,17]);
 assert.equal(caller.exports.run(1,state,widthsBase),1,'Buffered bits must not touch exhausted input');
 assert.deepEqual(Array.from(fields.subarray(0,4)),[0,1,input.length,17]);
 return {elapsedMs,checksum,bufferedState,readerSourceSha256:hash(sources.reader),readerCoreSourceSha256:hash(sources.readerCore),
  nativeCallProtocol:kind==='buffered-call-status'?'status-and-value':'value-only',
  callerSourceSha256:hash(sources.caller),callerWasmSha256:hash(callerBytes),
  ...(providerBytes?{providerSourceSha256:hash(sources.provider),providerWasmSha256:hash(providerBytes)}:{}),
  postTimerBoundsChecks:2,postTimerNoRefillCheck:true,
  purpose:'Identical valid-data reader with local, imported or table native calls; explicit bounds/fuel; not Java runtime or parity acceptance'};
}
