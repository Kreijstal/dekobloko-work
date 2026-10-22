// Native-data controls, not a Java runtime. Both keep explicit Java bounds
// calls and identical arithmetic/fuel. Only primitive element storage changes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const floatArrayKinds=['float-linear-array','float-gc-array','float-linear-noreturn','float-gc-physical','float-gc-physical-noreturn'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const arrays=['a','b','out'];
const types=`(type $floats (array (mut f32)))
 (type $store (struct (field i32) (field i32) (field (ref $floats))))`;
export function floatArraySource(kind,name){
 assert.ok(floatArrayKinds.includes(kind));
 assert.ok(['butterfly-local','butterfly-no-readback'].includes(name));
 const gc=kind.startsWith('float-gc-'),physical=kind.includes('physical'),noreturn=kind.endsWith('noreturn');
 const value=(array,index)=>gc?`(array.get $floats (local.get $${array}Data) ${index})`:
  `(f32.load (i32.add (local.get $${array}Base) (i32.shl ${index} (i32.const 2))))`;
 const load=(array,index)=>`(block (result f32) ${bounds(array,index)} ${value(array,index)})`;
 const store=(array,index,expression)=>`${bounds(array,index)} `+(gc?
  `(array.set $floats (local.get $${array}Data) ${index} ${expression})`:
  `(f32.store (i32.add (local.get $${array}Base) (i32.shl ${index} (i32.const 2))) ${expression})`);
 function bounds(array,index){return `(if (i32.ge_u ${index} (local.get $${array}Len))
  (then (call $bounds ${index} (local.get $${array}Len))${noreturn?' unreachable':''}))`;}
 const locals=arrays.map(a=>`(local $${a}Base i32)(local $${a}Len i32)(local $${a}Data (ref $floats))(local $${a}Store (ref $store))`).join('\n ');
 const capture=arrays.map(a=>`(local.set $${a}Store (ref.cast (ref $store) (any.convert_extern (local.get $${a}))))
  (local.set $${a}Base (struct.get $store 0 (local.get $${a}Store)))
  ${physical?`(local.set $${a}Data (struct.get $store 2 (local.get $${a}Store)))
  (local.set $${a}Len (array.len (local.get $${a}Data)))`:`(local.set $${a}Len (struct.get $store 1 (local.get $${a}Store)))
  (local.set $${a}Data (struct.get $store 2 (local.get $${a}Store)))`}`).join('\n ');
 return `(module ${types}
 (import "env" "memory" (memory 1))
 (import "env" "bounds" (func $bounds (param i32 i32)))
 (import "env" "fuel" (func $fuel))
 (func (export "newStore") (param $base i32)(param $len i32)(result externref)
  (local $data (ref $floats))(local $i i32)
  (local.set $data (array.new_default $floats (local.get $len)))
  (block $done (loop $next (br_if $done (i32.ge_u (local.get $i) (local.get $len)))
   (array.set $floats (local.get $data) (local.get $i)
    (f32.load (i32.add (local.get $base) (i32.shl (local.get $i) (i32.const 2)))))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))(br $next)))
  (extern.convert_any (struct.new $store (local.get $base) (local.get $len) (local.get $data))))
 (func (export "copyOut") (param $raw externref)
  (local $s (ref $store))(local $i i32)
  (local.set $s (ref.cast (ref $store) (any.convert_extern (local.get $raw))))
  ${gc?`(block $done (loop $next (br_if $done (i32.ge_u (local.get $i) (struct.get $store 1 (local.get $s))))
   (f32.store (i32.add (struct.get $store 0 (local.get $s)) (i32.shl (local.get $i) (i32.const 2)))
    (array.get $floats (struct.get $store 2 (local.get $s)) (local.get $i)))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))(br $next)))`:''})
 (func (export "readOne") (param $out externref)(param $p i32)(result f32)
  ${locals} ${capture.replaceAll(/\$[ab](?=\))/g,'$out')}
  ${load('out','(local.get $p)')})
 (func (export "run") (param $n i32)(param $a externref)(param $b externref)(param $out externref)(param $remaining i32)(result i32 i32)
  ${locals}(local $i i32)(local $p i32)(local $q i32)(local $x f32)(local $y f32)(local $c f32)(local $sum i32)
  ${capture}
  (block $done (loop $next
   (local.set $remaining (i32.sub (local.get $remaining) (i32.const 1)))
   (if (i32.le_s (local.get $remaining) (i32.const 0)) (then (call $fuel)))
   (br_if $done (i32.ge_s (local.get $i) (local.get $n)))
   (local.set $p (i32.and (local.get $i) (i32.const 1023)))
   (local.set $q (i32.and (i32.add (local.get $p) (i32.const 512)) (i32.const 1023)))
   (local.set $x ${load('a','(local.get $p)')})
   (local.set $y ${load('a','(local.get $q)')})
   (local.set $c (f32.mul (f32.sub (local.get $x) (local.get $y)) ${load('b','(local.get $p)')}))
   ${store('out','(local.get $p)','(local.get $c)')}
   ${store('out','(local.get $q)','(f32.add (local.get $x) (local.get $y))')}
   (local.set $sum (i32.add (i32.mul (local.get $sum) (i32.const 33))
    (i32.trunc_sat_f32_s (f32.mul ${name==='butterfly-local'?load('out','(local.get $p)'):'(local.get $c)'} (f32.const 1048576)))))
   (local.set $i (i32.add (local.get $i) (i32.const 1)))(br $next)))
  (i32.const -1)(local.get $sum)))`;
}
export function createFloatArrayControl(kind,name){
 const source=floatArraySource(kind,name),bytes=execFileSync('wasm-as',['--enable-reference-types','--enable-gc','--enable-multivalue','--enable-nontrapping-float-to-int','-','-o','-'],{input:source});
 const memory=new WebAssembly.Memory({initial:1});
 const instance=new WebAssembly.Instance(new WebAssembly.Module(bytes),{env:{memory,
  bounds:(index,length)=>{throw {type:'java/lang/ArrayIndexOutOfBoundsException',index,length};},
  fuel:()=>{throw {type:'ControlFuelExhausted'};}}});
 const newArray=(base,data)=>{assert.ok(base>=0&&base%4===0&&base+data.length*4<=memory.buffer.byteLength);
  const view=new Float32Array(memory.buffer,base,data.length);view.set(data);
  return {store:instance.exports.newStore(base,data.length),view};};
 return {exports:instance.exports,memory,newArray,sourceSha256:hash(source),wasmSha256:hash(bytes)};
}
export function measureFloatArrayControl(kind,name,count,seed,expected){
 assert.ok(Number.isSafeInteger(count)&&count>0&&count<100_000_000);
 const c=createFloatArrayControl(kind,name),data=new Float32Array(1024),factors=new Float32Array(1024);let x=seed.charCodeAt(0);
 for(let i=0;i<1024;i++){x=(Math.imul(x,1664525)+1013904223)|0;data[i]=((x&1023)-512)/512;factors[i]=((x>>>8)&1023)/1024;}
 const a=c.newArray(64,data),b=c.newArray(4160,factors),out=c.newArray(8256,new Float32Array(1024));
 const inputSha256=hash(Buffer.concat([Buffer.from(data.buffer),Buffer.from(factors.buffer)]));
 const start=performance.now(),[status,sum]=c.exports.run(count,a.store,b.store,out.store,100_000_000),elapsedMs=performance.now()-start;
 assert.equal(status,-1);c.exports.copyOut(out.store);
 let checksum=sum;for(const value of out.view)checksum=(Math.imul(checksum,31)+Math.trunc(Math.fround(value*1048576)))|0;
 assert.equal(checksum,expected,'Original HotSpot checksum/output fold mismatch');
 // Only malformed and zero-trip cases follow timing. Never replay/warm up the workload.
 for(const index of [-1,1024])assert.throws(()=>c.exports.readOne(out.store,index),e=>e.type==='java/lang/ArrayIndexOutOfBoundsException'&&e.index===index&&e.length===1024);
 assert.deepEqual(c.exports.run(0,a.store,b.store,out.store,100),[-1,0]);
 return {elapsedMs,checksum,inputSha256,modelSourceSha256:c.sourceSha256,modelWasmSha256:c.wasmSha256,
  elementStorage:kind.startsWith('float-gc-')?'wasm-gc-f32-array':'wasm-linear-memory',explicitJavaBounds:true,
  boundsLengthSource:kind.includes('physical')?'gc-array-length':'stored-length',boundsNoreturn:kind.endsWith('noreturn'),
  postTimerBoundsChecks:2,postTimerZeroTripCheck:true,
  purpose:'Native-only element-storage control with identical bounds/fuel/math; excludes VM representation selection, frames and foreign/null arrays; not JVM or parity acceptance'};
}
