// Valid-data controls for native call boundaries, not a Java implementation.
// The GC-state mode changes only field storage; requests, arithmetic, bounds,
// fuel and call/status protocol match the typed linear-state control.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {validateBufferedWorkload} from './buffered-replay.mjs';

export const bufferedCallKinds=['buffered-call-local','buffered-call-import','buffered-call-table','buffered-call-status','buffered-call-transfer','buffered-call-parameter','buffered-call-typed-parameter','buffered-call-gc-parameter'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const signature=(status,transfer,parameter,typed)=>`(type $reader (func (param i32 ${transfer?'externref':'i32'}${parameter?typed?' (ref null $storage)':' externref':''}) (result i32${status?' i32':''})))`;
// Same structural store shape as the inspected JVM's private metadata.
const storageTypes=`(type $references (array (mut externref)))
 (type $storage (struct (field i32) (field i32) (field (ref $references))))`;
const transferImport='(import "env" "input" (global $input (mut externref)))';
const storeGuard=`(if (i32.eqz (ref.test (ref $storage) (any.convert_extern (local.get $incoming)))) (then unreachable))
 (local.set $native (ref.cast (ref $storage) (any.convert_extern (local.get $incoming))))
 (local.set $state (struct.get $storage 0 (local.get $native)))
 (if (i32.lt_s (local.get $state) (i32.const 0)) (then unreachable))`;
const makeStorage=`(func (export "newStore") (param $base i32) (result externref)
 (extern.convert_any (struct.new $storage (local.get $base) (i32.const 1)
  (array.new_default $references (i32.const 0)))))`;
const poll=`(global.set $fuel (i32.sub (global.get $fuel) (i32.const 1)))
 (if (i32.le_s (global.get $fuel) (i32.const 0)) (then unreachable))`;
const reader=(status=false,transfer=false,parameter=false,typed=false)=>`(func $read (export "read") (type $reader) (param $count i32) (param ${transfer?'$receiver externref':'$state i32'})${parameter?` (param $incoming ${typed?'(ref null $storage)':'externref'})`:''} (result i32${status?' i32':''})
 (local $index i32)(local $length i32)(local $value i32)${transfer?'\n (local $state i32)'+(parameter?'':'(local $incoming externref)')+'(local $native (ref null $storage)) '+
  (parameter?'':'(local.set $incoming (global.get $input))\n (global.set $input (ref.null extern))\n ')+(typed?'(local.set $native (local.get $incoming))\n (local.set $state (struct.get $storage 0 (local.get $native)))\n (if (i32.lt_s (local.get $state) (i32.const 0)) (then unreachable))':storeGuard):''}
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

// Same native metadata shape plus a typed field payload. Byte input remains in
// the SAME linear memory: this isolates scalar-field representation/aliasing,
// without silently removing the explicit Java-index check or fuel accounting.
function gcStateSources(){
 const types='(type $fields (struct '+Array(6).fill('(field (mut i32))').join(' ')+'))\n '+
  storageTypes.replace('(field (ref $references))))',
   '(field (ref $references)) (field (ref $fields))))');
 const get=i=>`(struct.get $fields ${i} (local.get $fields))`;
 const put=(i,value)=>`(struct.set $fields ${i} (local.get $fields) ${value})`;
 const read=`(func $read (export "read") (type $reader)
  (param $count i32)(param $receiver externref)(param $incoming (ref null $storage))(result i32 i32)
  (local $fields (ref $fields))(local $state i32)(local $index i32)(local $length i32)(local $value i32)
  (local.set $state (struct.get $storage 0 (local.get $incoming)))
  (if (i32.lt_s (local.get $state) (i32.const 0)) (then unreachable))
  (local.set $fields (struct.get $storage 3 (local.get $incoming)))
  (block $ready (loop $refill
   (br_if $ready (i32.ge_s ${get(0)} (local.get $count)))
   ${poll}
   (local.set $index ${get(2)})(local.set $length ${get(5)})
   (if (i32.ge_u (local.get $index) (local.get $length))
    (then (throw $bounds (call $error (local.get $index) (local.get $length)))))
   ${put(1,`(i32.or (i32.shl ${get(1)} (i32.const 8))
    (i32.and (i32.load8_s (i32.add ${get(4)} (local.get $index))) (i32.const 255)))`)}
   ${put(0,`(i32.add ${get(0)} (i32.const 8))`)}
   ${put(2,`(i32.add ${get(2)} (i32.const 1))`)}
   ${put(3,`(i32.add ${get(3)} (i32.const 1))`)} (br $refill)))
  (local.set $value (i32.and (i32.shr_s ${get(1)} (i32.sub ${get(0)} (local.get $count)))
   (i32.sub (i32.shl (i32.const 1) (local.get $count)) (i32.const 1))))
  ${put(0,`(i32.sub ${get(0)} (local.get $count))`)}
  (i32.const -1)(local.get $value))`;
 const base=bufferedCallSources('buffered-call-typed-parameter');
 const factory=`(func (export "newStore") (param $base i32) (result externref)
  (extern.convert_any (struct.new $storage (local.get $base) (i32.const 1)
   (array.new_default $references (i32.const 0))
   (struct.new $fields ${Array.from({length:6},(_,i)=>`(i32.load offset=${i*4} (local.get $base))`).join(' ')}))))`;
 const sync=`(func (export "syncState") (param $raw externref)(param $base i32)
  (local $fields (ref $fields))
  (local.set $fields (struct.get $storage 3 (ref.cast (ref $storage) (any.convert_extern (local.get $raw)))))
  ${Array.from({length:6},(_,i)=>`(i32.store offset=${i*4} (local.get $base) ${get(i)})`).join('\n  ')})`;
 return {reader:read,readerCore:read,
  provider:base.provider.replace(storageTypes,types).replace(base.reader,read).replace(makeStorage,factory+'\n '+sync),
  caller:base.caller.replace(storageTypes,types)};
}

export function bufferedCallSources(kind){
 assert.ok(bufferedCallKinds.includes(kind),'Unknown native call control');
 if(kind==='buffered-call-gc-parameter')return gcStateSources();
 const local=kind==='buffered-call-local',typed=kind==='buffered-call-typed-parameter',parameter=kind==='buffered-call-parameter'||typed;
 const transfer=kind==='buffered-call-transfer'||parameter;
 const status=kind==='buffered-call-status'||transfer;
 const table=kind==='buffered-call-table'||status,read=reader(status,transfer,parameter,typed);
 const call=table?`(call_indirect (type $reader) (local.get $width) (local.get $${transfer?'receiver':'state'})${parameter?` (local.get $${typed?'typedStore':'store'})`:''} (i32.const 0))`:
  '(call $read (local.get $width) (local.get $state))';
 const consume=status?`${call} (local.set $value) (local.set $status)
   (if (i32.ge_s (local.get $status) (i32.const 0)) (then unreachable))
   (local.set $sum (i32.add (i32.mul (local.get $sum) (i32.const 33)) (local.get $value)))`:
  `(local.set $sum (i32.add (i32.mul (local.get $sum) (i32.const 33)) ${call}))`;
 const caller=`(func (export "run") (param $n i32) (param ${transfer?'$receiver externref':'$state i32'}) (param $widths i32)${transfer?' (param $store externref)':''} (result i32)
  (local $i i32)(local $sum i32)(local $width i32)${status?'(local $status i32)(local $value i32)':''}
  ${typed?'(local $typedStore (ref null $storage)) (local.set $typedStore (ref.cast (ref $storage) (any.convert_extern (local.get $store))))':''}
  (block $done (loop $next
   (br_if $done (i32.ge_s (local.get $i) (local.get $n)))
   ${poll}
   (local.set $width (i32.and (i32.load8_u (i32.add (local.get $widths) (local.get $i))) (i32.const 31)))
   ${transfer&&!parameter?'(global.set $input (local.get $store))\n   ':''}${consume}
   (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $next)))
  (local.get $sum))`;
 return {reader:read,readerCore:reader(),provider:`(module ${typed?storageTypes+' ':''}${signature(status,transfer,parameter,typed)} ${transfer&&!typed?storageTypes+' ':''}${baseImports} ${readerImports} ${transfer&&!parameter?transferImport+' ':''}${read}${transfer?' '+makeStorage:''})`,
  caller:`(module ${typed?storageTypes+' ':''}${signature(status,transfer,parameter,typed)} ${transfer&&!typed?storageTypes+' ':''}${baseImports}
   ${local?readerImports:table?'(import "env" "table" (table 1 funcref))':
    '(import "env" "read" (func $read (type $reader)))'}
   ${transfer&&!parameter?transferImport+' ':''}${local?read:''} ${caller})`};
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
 const gc=kind==='buffered-call-gc-parameter',typed=gc||kind==='buffered-call-typed-parameter',parameter=kind==='buffered-call-parameter'||typed,transfer=kind==='buffered-call-transfer'||parameter;
 const inputGlobal=transfer&&!parameter?new WebAssembly.Global({value:'externref',mutable:true},null):null;
 const env={memory,fuel,bounds,...(inputGlobal?{input:inputGlobal}:{}),error:(index,length)=>({type:'java/lang/ArrayIndexOutOfBoundsException',index,length})};
 const sources=bufferedCallSources(kind);
 const assemble=source=>execFileSync('wasm-as',['--enable-exception-handling','--enable-reference-types','--enable-multivalue',...(transfer?['--enable-gc']:[]),'-','-o','-'],{input:source});
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
 const receiver={};let store=transfer?provider.exports.newStore(state):null;
 const reset=()=>{if(gc)store=provider.exports.newStore(state);};
 const sync=()=>{if(gc)provider.exports.syncState(store,state);};
 const run=n=>transfer?caller.exports.run(n,receiver,widthsBase,store):caller.exports.run(n,state,widthsBase);
 // Exactly one execution: module construction and data installation are outside timing.
 const start=performance.now(),streamChecksum=run(count),elapsedMs=performance.now()-start;
 if(inputGlobal)assert.equal(inputGlobal.value,null,'Entry must consume and release transferred metadata');
 sync();const bufferedState=Array.from(fields.subarray(0,4));
 // The Java fixture folds final state after stopping its timer too.
 const checksum=bufferedState.reduce((sum,value)=>(Math.imul(sum,31)+value)|0,streamChecksum);
 assert.deepEqual([checksum,...bufferedState],reference,'Native control differs from original Java reader');
 // Negative and end indices fail before any field writes, as in the original reader.
 for(const index of [-1,input.length]){
  fields.set([0,123,index,17]);reset();const before=Array.from(fields);
  assert.throws(()=>run(1),error=>error.type==='java/lang/ArrayIndexOutOfBoundsException'&&
   error.index===index&&error.length===input.length);
  sync();assert.deepEqual(Array.from(fields),before,'Failed input access changed reader state');
  if(inputGlobal)assert.equal(inputGlobal.value,null,'Exceptional entry must release transferred metadata');
 }
 fields.set([requests[0]&31,1,input.length,17]);reset();
 assert.equal(run(1),1,'Buffered bits must not touch exhausted input');
 sync();assert.deepEqual(Array.from(fields.subarray(0,4)),[0,1,input.length,17]);
 if(transfer){
  if(inputGlobal)assert.equal(inputGlobal.value,null,'No-refill entry must release transferred metadata');
  for(const invalid of [null,{}]){
   const before=Array.from(fields);
   assert.throws(()=>caller.exports.run(1,receiver,widthsBase,invalid),WebAssembly.RuntimeError);
   if(inputGlobal)assert.equal(inputGlobal.value,null,'Refused metadata must also be released');
   assert.deepEqual(Array.from(fields),before,'Refused metadata must not touch reader state');
  }
 }
 return {elapsedMs,checksum,bufferedState,readerSourceSha256:hash(sources.reader),readerCoreSourceSha256:hash(sources.readerCore),
  ...(gc?{stateRepresentation:'typed-gc-struct',byteInputRepresentation:'linear-memory',postTimerStateSync:true}:{}),
  nativeCallProtocol:typed?'typed-store-parameter-and-status':parameter?'store-parameter-and-status':transfer?'transferred-store-and-status':kind==='buffered-call-status'?'status-and-value':'value-only',
  ...(transfer?{postTimerMetadataRefusals:2}:{}),...(inputGlobal?{postTimerMetadataReleaseChecks:6}:{}),
  callerSourceSha256:hash(sources.caller),callerWasmSha256:hash(callerBytes),
  ...(providerBytes?{providerSourceSha256:hash(sources.provider),providerWasmSha256:hash(providerBytes)}:{}),
  postTimerBoundsChecks:2,postTimerNoRefillCheck:true,
  purpose:gc?'GC scalar-state control; same requests, byte input, bounds, fuel and table/status protocol; not Java runtime or parity acceptance':
   'Identical valid-data reader with local, imported or table native calls; explicit bounds/fuel; not Java runtime or parity acceptance'};
}
