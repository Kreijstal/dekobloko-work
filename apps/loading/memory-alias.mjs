// Native-only alias controls. These are not Java implementations or JVM timing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const memoryAliasEngines=['shared','imported','owned','gc-struct','gc-array','global-imported','global-owned'];
export const memoryAliasKernels=['array-read-state-write','array-write-state-read'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const flags=['--max-old-space-size=1024','--no-liftoff','--no-wasm-lazy-compilation'];

export function memoryAliasSource(engine,kernel){
 assert.ok(memoryAliasEngines.includes(engine));assert.ok(memoryAliasKernels.includes(kernel));
 const gc=engine.startsWith('gc-'),gcArray=engine==='gc-array',global=engine.startsWith('global-');
 const state=engine==='shared'?'$data':'$state';
 const load=(offset=0)=>global?`(global.get $cell${offset/4})`:gc?(gcArray?`(array.get $State (local.get $s) (i32.const ${offset/4}))`:`(struct.get $State ${offset/4} (local.get $s))`):`(i32.load ${state} offset=${offset} (local.get $s))`;
 const store=(offset,value)=>global?`(global.set $cell${offset/4} ${value})`:gc?(gcArray?`(array.set $State (local.get $s) (i32.const ${offset/4}) ${value})`:`(struct.set $State ${offset/4} (local.get $s) ${value})`):`(i32.store ${state} offset=${offset} (local.get $s) ${value})`;
 const array=`(i32.add (local.get $a) (i32.shl (local.get $p) (i32.const 2)))`;
 const read=`(i32.load $data ${array})`;
 const body=kernel==='array-read-state-write'?`
   (local.set $x ${read})
   ${store(0,`(i32.and (i32.add ${load()} (i32.const 1)) (i32.const 31))`)}
   (local.set $y ${read})
   ${store(4,`(i32.add (i32.mul ${load(4)} (i32.const 33)) (local.get $x))`)}
   ${store(8,`(i32.xor ${load(8)} (local.get $y))`)}
   (local.set $sum (i32.add (i32.mul (local.get $sum) (i32.const 17)) (i32.xor ${load(4)} ${load(8)})))
  `:`
   (local.set $x ${load()})
   (i32.store $data ${array} (i32.add (i32.mul ${read} (local.get $x)) (i32.const 17)))
   (local.set $sum (i32.add (i32.mul (local.get $sum) (i32.const 33)) (i32.xor ${load()} ${read})))
  `;
 return `(module
  ${gc?gcArray?'(type $State (array (mut i32)))':'(type $State (struct (field (mut i32)) (field (mut i32)) (field (mut i32))))':''}
  (import "env" "data" (memory $data 1))
  ${engine==='imported'?'(import "env" "state" (memory $state 1))':''}
  ${engine==='global-imported'?[0,1,2].map(i=>`(import "env" "cell${i}" (global $cell${i} (mut i32)))`).join('\n'):''}
  (import "env" "bounds" (func $bounds (param i32 i32)))
  (import "env" "fuel" (func $fuel))
  ${engine==='owned'?'(memory $state 1)':''}
  ${engine==='global-owned'?[0,1,2].map(i=>`(global $cell${i} (mut i32) (i32.const 0))`).join('\n'):''}
  ${global?[0,1,2].map(i=>`(export "cell${i}" (global $cell${i}))`).join('\n'):''}
  ${gc?`(func (export "newState") (param i32 i32 i32)(result externref)
   (extern.convert_any (${gcArray?'array.new_fixed $State 3':'struct.new $State'} (local.get 0) (local.get 1) (local.get 2))))
  (func (export "stateValues") (param $raw externref)(result i32 i32 i32)(local $s (ref null $State))
   (local.set $s (ref.cast (ref null $State) (any.convert_extern (local.get $raw)))) ${load()} ${load(4)} ${load(8)})`:(global?'':`(export "state" (memory ${state}))`)}
  (func (export "run") (param $n i32)${gc?'(param $raw externref)':'(param $s i32)'}(param $a i32)(param $length i32)(param $remaining i32)(result i32 i32)
   (local $i i32)(local $p i32)(local $x i32)(local $y i32)(local $sum i32)
   ${gc?'(local $s (ref null $State)) (local.set $s (ref.cast (ref null $State) (any.convert_extern (local.get $raw))))':''}
   (block $done (loop $next
    (local.set $remaining (i32.sub (local.get $remaining) (i32.const 1)))
    (if (i32.le_s (local.get $remaining) (i32.const 0)) (then (call $fuel) unreachable))
    (br_if $done (i32.ge_s (local.get $i) (local.get $n)))
    (local.set $p (i32.and (local.get $i) (i32.const 1023)))
    (if (i32.ge_u (local.get $p) (local.get $length))
     (then (call $bounds (local.get $p) (local.get $length)) unreachable))
    ${body}
    (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $next)))
   (local.get $sum)(local.get $remaining)))`;
}

export function buildMemoryAlias(engine,kernel,{alias=false,globalAlias=false}={}){
 assert.ok(!alias||['shared','imported'].includes(engine),'Owned state cannot alias an import');
 assert.ok(!globalAlias||engine==='global-imported','Only imported globals can share a cell');
 const source=memoryAliasSource(engine,kernel);
 const bytes=execFileSync('wasm-as',['--enable-multimemory','--enable-multivalue','--enable-gc','--enable-reference-types','--disable-compact-imports','-','-o','-'],{input:source,maxBuffer:1024*1024});
 const data=new WebAssembly.Memory({initial:1}),state=engine==='imported'?(alias?data:new WebAssembly.Memory({initial:1})):undefined;
 const sharedCell=globalAlias?new WebAssembly.Global({value:'i32',mutable:true},0):null;
 const cells=engine==='global-imported'?Object.fromEntries([0,1,2].map(i=>['cell'+i,sharedCell||new WebAssembly.Global({value:'i32',mutable:true},0)])):{};
 const exports=new WebAssembly.Instance(new WebAssembly.Module(bytes),{env:{data,state,...cells,
  bounds:(index,length)=>{throw {type:'java/lang/ArrayIndexOutOfBoundsException',index,length};},
  fuel:()=>{throw {type:'fuel'};}}}).exports;
 return {engine,exports,data,state:engine.startsWith('global-')?[exports.cell0,exports.cell1,exports.cell2]:exports.state,sourceSha256:hash(source),wasmSha256:hash(bytes)};
}

export function initializeMemoryAlias(control,{arrayBase=4096,stateBase=64}={}){
 const data=new Int32Array(control.data.buffer),state=/^(gc|global)-/.test(control.engine)?null:new Int32Array(control.state.buffer);
 for(let i=0;i<1024;i++)data[(arrayBase>>2)+i]=(Math.imul(i,110351)+12345)^(i>>>3);
 if(state){state[stateBase>>2]=3;state[(stateBase>>2)+1]=7;state[(stateBase>>2)+2]=11;}
 else if(control.engine?.startsWith('global-'))[3,7,11].forEach((value,i)=>control.state[i].value=value);
 else control.state=control.exports.newState(3,7,11);
 return {arrayBase,stateBase};
}

export function memoryAliasOracle(kernel,n,{alias=false,arrayBase=4096,stateBase=64,length=1024,fuel=1000000000}={}){
 const data={buffer:new ArrayBuffer(65536)},state=alias?data:{buffer:new ArrayBuffer(65536)};
 const setup=initializeMemoryAlias({data,state},{arrayBase,stateBase});
 const a=new Int32Array(data.buffer),s=new Int32Array(state.buffer),at=arrayBase>>2,st=stateBase>>2;
 let sum=0,error;
 for(let i=0;;i++){
  if(--fuel<=0){error={type:'fuel'};break;}
  if(i>=n)break;
  const p=i&1023;if(p>=length){error={type:'java/lang/ArrayIndexOutOfBoundsException',index:p,length};break;}
  if(kernel==='array-read-state-write'){
   const x=a[at+p];s[st]=(s[st]+1)&31;const y=a[at+p];
   s[st+1]=(Math.imul(s[st+1],33)+x)|0;s[st+2]^=y;
   sum=(Math.imul(sum,17)+(s[st+1]^s[st+2]))|0;
  }else{
   const x=s[st];a[at+p]=(Math.imul(a[at+p],x)+17)|0;
   sum=(Math.imul(sum,33)+(s[st]^a[at+p]))|0;
  }
 }
 return {sum,fuel,error,data:Array.from(a.slice(at,at+1024)),state:Array.from(s.slice(st,st+3)),...setup};
}

export const memoryAliasState=(control,stateBase=64)=>control.engine?.startsWith('global-')?control.state.map(cell=>cell.value):control.engine?.startsWith('gc-')?control.exports.stateValues(control.state):Array.from(new Int32Array(control.state.buffer,stateBase,3));
export const memoryAliasArgument=(control,stateBase=64)=>control.engine?.startsWith('gc-')?control.state:stateBase;

function one(engine,kernel,n){
 assert.ok(flags.every(flag=>process.execArgv.includes(flag)));
 const control=buildMemoryAlias(engine,kernel),setup=initializeMemoryAlias(control);
 const expected=memoryAliasOracle(kernel,n),start=process.hrtime.bigint();
 const [sum,fuel]=control.exports.run(n,memoryAliasArgument(control,setup.stateBase),setup.arrayBase,1024,1000000000);
 const elapsedMs=Number(process.hrtime.bigint()-start)/1e6;
 const data=Array.from(new Int32Array(control.data.buffer,setup.arrayBase,1024));
 const state=memoryAliasState(control,setup.stateBase);
 assert.equal(sum,expected.sum);assert.equal(fuel,expected.fuel);assert.deepEqual(data,expected.data);assert.deepEqual(state,expected.state);
 return {engine,kernel,n,elapsedMs,sum,fuel,dataSha256:hash(Int32Array.from(data)),state,
  sourceSha256:control.sourceSha256,wasmSha256:control.wasmSha256,node:process.version,execArgv:process.execArgv,
  oneInvocation:true,warmup:false,equal:true,
  scope:'New valid-input native alias control only; no VM representation/foreign reference handling, Java frames, TeaVM or original loading execution. Not JVM/parity acceptance.'};
}

const script=fileURLToPath(import.meta.url);
if(process.argv[1]&&path.resolve(process.argv[1])===script){
 if(process.argv[2]==='one')console.log(JSON.stringify(one(process.argv[3],process.argv[4],Number(process.argv[5]))));
 else{
  assert.equal(process.argv[2],'run','Usage: memory-alias.mjs run | one ENGINE KERNEL COUNT');
  const file=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading/benchmark.json'),receipt=JSON.parse(fs.readFileSync(file));
  assert.ok(process.argv[3],'Select only new engines; reuse saved controls instead of rerunning them');
  const selectedEngines=process.argv[3].split(',');assert.ok(selectedEngines.length&&selectedEngines.every(engine=>memoryAliasEngines.includes(engine)));
  const sourceSha256=hash(fs.readFileSync(script)),n=8*1024*1024;
  const trial=receipt.optimizationTrials.memoryAliasControls||={observations:[]};
  let group=trial.observations.findLast(row=>row.sourceSha256===sourceSha256&&row.n===n&&JSON.stringify(row.selectedEngines)===JSON.stringify(selectedEngines));
  if(!group){group={sourceSha256,n,selectedEngines,generatorRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:path.dirname(script),encoding:'utf8'}).trim(),runs:[],note:'New physical alias cases only; no saved control, baseline identity, oracle rebuild, CPU profiling or repeated guest invocation.'};trial.observations.push(group);}
  const save=()=>fs.writeFileSync(file,JSON.stringify(receipt,null,2)+'\n');
  for(const kernel of memoryAliasKernels)for(let pair=0;pair<3;pair++)for(const engine of pair===1?selectedEngines.toReversed():selectedEngines){
   if(group.runs.some(row=>row.kernel===kernel&&row.engine===engine&&row.pair===pair))continue;
   const result=JSON.parse(execFileSync(process.execPath,[...flags,script,'one',engine,kernel,String(n)],{encoding:'utf8',maxBuffer:1024*1024}));
   group.runs.push({...result,pair,measuredAt:new Date().toISOString()});save();
   console.log(`${kernel} pair ${pair+1} ${engine}: ${result.elapsedMs.toFixed(6)} ms`);
  }
  group.complete=true;group.medians=Object.fromEntries(memoryAliasKernels.map(kernel=>[kernel,Object.fromEntries(selectedEngines.map(engine=>{
   const xs=group.runs.filter(row=>row.kernel===kernel&&row.engine===engine).map(row=>row.elapsedMs).sort((a,b)=>a-b);return [engine,xs[1]];
  }))]));save();console.log(JSON.stringify(group.medians));
 }
}
