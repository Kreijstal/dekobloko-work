import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {projectMeasurementFixture,parseMeasurementResult,recordProbeObservation,summarizeExecutionOutcome} from '../apps/loading/measurement-fixture.mjs';
import {validateBufferedWorkload,bufferedReplayArgs,bufferedRefillCounts} from '../apps/loading/buffered-replay.mjs';
import {bufferedCallKinds,bufferedCallSources,measureBufferedCallControl} from '../apps/loading/buffered-call-controls.mjs';

test('worker projection preserves inputs without traversing accumulated profiles',()=>{
 const forbidden=()=>{throw Error('history must stay in the recorder');};
 const receipt={classes:{'Example.class':'class-sha'},assets:{'0-1.bin':'asset-sha'},
  diagnosticOptions:{jit:{compileWorker:false}},teavm:{version:'pinned',wasmSha256:'wasm-sha'},
  executionBaseline:{jvmOptions:{wasmHeap:true}},microbenchmarks:{cases:['example'],classes:{'Example.class':'class-sha'},referenceChecks:[42]}};
 Object.defineProperty(receipt,'optimizationTrials',{get:forbidden});
 Object.defineProperty(receipt.executionBaseline,'results',{get:forbidden});
 for(const key of ['runs','diagnostics','fixtures','source','bufferedWorkloads'])Object.defineProperty(receipt.microbenchmarks,key,{get:forbidden});
 const fixture=projectMeasurementFixture(receipt);
 assert.deepEqual(projectMeasurementFixture(fixture),fixture,'wire projection is stable across nested workers');
 assert.deepEqual(fixture.classes,receipt.classes);assert.deepEqual(fixture.diagnosticOptions,receipt.diagnosticOptions);
 assert.deepEqual(fixture.executionBaseline,{jvmOptions:{wasmHeap:true}});
 assert.deepEqual(fixture.microbenchmarks,{cases:['example'],classes:{'Example.class':'class-sha'},referenceChecks:[42]});
 assert.equal('optimizationTrials' in fixture,false);
});
test('stdin worker uses no recorder file and consumes the transport argument',()=>{
 const module=new URL('../apps/loading/measurement-fixture.mjs',import.meta.url).href;
 const code=`import {readMeasurementFixture,fixtureStdinFlag} from ${JSON.stringify(module)};
 process.argv.push(fixtureStdinFlag);
 const result=readMeasurementFixture('/nonexistent/measurement-history.json');
 console.log(JSON.stringify({...result,flagRemains:process.argv.includes(fixtureStdinFlag)}));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{
  input:JSON.stringify({assets:{input:'sha'},referenceCheck:'reference',optimizationTrials:{secret:'unused-history'}}),encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);
 assert.deepEqual(JSON.parse(child.stdout),{receipt:{assets:{input:'sha'},referenceCheck:'reference'},supplied:true,flagRemains:false});
});
test('worker output cannot silently reuse a stale or duplicated result',()=>{
 assert.deepEqual(parseMeasurementResult('guest output\nPROBE_RESULT {"check":"current"}\n','PROBE_RESULT '),{check:'current'});
 for(const text of ['', 'PROBE_RESULT {}\nPROBE_RESULT {}\n','PROBE_RESULT null','PROBE_RESULT []'])
  assert.throws(()=>parseMeasurementResult(text,'PROBE_RESULT '));
 assert.throws(()=>parseMeasurementResult('PROBE_RESULT invalid','PROBE_RESULT '),SyntaxError);
});
test('the recorder retains bounded recent summaries outside the worker',()=>{
 const receipt={kernelDiagnostic:{recent:Array.from({length:6},(_,n)=>({runtimeRevision:String(n)}))}};
 const result={runtimeRevision:'current',mode:'slab',kernel:'loading',equal:true,musicMs:12,graphicsMs:3,
  methods:[{diagnostic:'not part of a recent summary'}],compilation:{postMainSyncCompileCount:0}};
 recordProbeObservation(receipt,result);
 assert.equal(receipt.kernelDiagnostic,result);assert.equal(result.recent.length,6);
 assert.equal(result.recent[0].runtimeRevision,'1');assert.equal(result.recent.at(-1).runtimeRevision,'current');
 assert.equal('methods' in result.recent.at(-1),false);assert.equal(result.recent.at(-1).lateCompiles,0);
});
test('execution summaries retain status without retaining guest return graphs',()=>{
 const guest={};Object.defineProperty(guest,'toJSON',{get(){throw Error('guest graph traversed');}});
 const result=summarizeExecutionOutcome({handled:true,returned:true,value:guest});
 assert.deepEqual(result,{handled:true,returned:true,valueKind:'object'});
 assert.equal(JSON.stringify(result),'{"handled":true,"returned":true,"valueKind":"object"}');
 assert.deepEqual(summarizeExecutionOutcome({handled:true,returned:true,value:42}),
  {handled:true,returned:true,valueKind:'number',value:42});
 assert.equal(summarizeExecutionOutcome({value:9223372036854775807n}).value,'9223372036854775807');
 assert.equal(summarizeExecutionOutcome({value:'x'.repeat(1_000_000)}).value.length,160);
});
test('reader replays preserve exact request order and reject malformed wrapper markers',()=>{
 const fixture=bytes=>({encoded:bytes.toString('base64'),requests:bytes.length,
  traceSha256:createHash('sha256').update(bytes).digest('hex')});
 const valid=fixture(Buffer.from([65,3,136]));
 const {widths,wrappers,bits}=validateBufferedWorkload(valid);
 assert.deepEqual(widths,{1:1,3:1,8:1});assert.deepEqual(wrappers,{direct:1,bit:1,byte:1});assert.equal(bits,12);
 for(const bytes of [[0],[66],[129],[193],[33]])assert.throws(()=>validateBufferedWorkload(fixture(Buffer.from(bytes))));
 assert.throws(()=>validateBufferedWorkload({...valid,requests:4}));
 assert.throws(()=>validateBufferedWorkload({...valid,traceSha256:'wrong'}));
 const large=Buffer.alloc(123456,1),chunks=bufferedReplayArgs(fixture(large));
 assert.ok(chunks.length>1&&chunks.every(chunk=>chunk.length<=60000));
 assert.deepEqual(Buffer.from(chunks.join(''),'hex'),large,'chunking never wraps or repeats the request stream');
});
function verifyCallControls(t,kinds){
 if(!WebAssembly.JSTag){t.skip('Native call controls require JavaScript exception tags');return;}
 if(!WebAssembly.validate(Uint8Array.of(0,97,115,109,1,0,0,0,1,5,1,0x5f,1,0x7f,0))){
  t.skip('Metadata transfer controls require native Wasm GC');return;
 }
 const assembler=spawnSync('wasm-as',['--version']);
 if(assembler.error?.code==='ENOENT'){t.skip('Native call controls require Binaryen wasm-as');return;}
 assert.equal(assembler.status,0,assembler.stderr?.toString());
 const input=Buffer.concat([Buffer.alloc(9),Buffer.from([0xa6,0x39,0xf0])]);
 const requests=Buffer.from([1,2,3,5,136,3,2]);
 const digest=value=>createHash('sha256').update(value).digest('hex');
 const workload={encoded:requests.toString('base64'),requests:requests.length,
  traceSha256:digest(requests),inputSha256:digest(input)};
 // Independent oracle: extract non-overlapping prefixes from a known bit string.
 const bits='101001100011100111110000';let at=0,sum=0;
 for(const code of requests){const width=code&31;sum=(Math.imul(sum,33)+parseInt(bits.slice(at,at+width),2))|0;at+=width;}
 assert.equal(at,24);const finalState=[0,0xa639f0,12,3];
 const expected=[finalState.reduce((value,field)=>(Math.imul(value,31)+field)|0,sum),...finalState];
 const reader=bufferedCallSources(bufferedCallKinds[0]).readerCore;
 for(const kind of kinds){
  if(kind!=='buffered-call-gc-parameter')assert.equal(bufferedCallSources(kind).readerCore,reader,'The same reader arithmetic and field operations remain');
  else {
   assert.match(bufferedCallSources(kind).reader,/struct\.get \$fields/);
   assert.match(bufferedCallSources(kind).reader,/i32\.ge_u/,'explicit Java array bounds check remains');
   assert.match(bufferedCallSources(kind).reader,/i32\.load8_s/,'byte input stays in linear memory');
  }
  const result=measureBufferedCallControl(kind,input,workload,requests.length,expected);
  assert.equal(result.checksum,expected[0]);assert.deepEqual(result.bufferedState,expected.slice(1));
  assert.equal(result.postTimerBoundsChecks,2);assert.equal(result.postTimerNoRefillCheck,true);
  if(kind==='buffered-call-transfer'){
   assert.equal(result.postTimerMetadataReleaseChecks,6);assert.equal(result.postTimerMetadataRefusals,2);
  }
  if(kind==='buffered-call-gc-parameter')assert.equal(result.stateRepresentation,'typed-gc-struct');
  if(kind==='buffered-call-typed-parameter'||kind==='buffered-call-gc-parameter'){
   assert.equal(result.nativeCallProtocol,'typed-store-parameter-and-status');assert.equal(result.postTimerMetadataRefusals,2);
   assert.doesNotMatch(bufferedCallSources(kind).reader,/any\.convert_extern|ref\.cast|ref\.test/,'callee receives its already typed storage');
  }
  if(kind==='buffered-call-parameter'){
   assert.equal(result.nativeCallProtocol,'store-parameter-and-status');assert.equal(result.postTimerMetadataRefusals,2);
  }
 }
}

test('buffered refill counts match explicit fills for every initial count and width',()=>{
 for(let initial=0;initial<=31;initial++)for(let width=1;width<=31;width++){
  let count=0,buffered=initial;while(buffered<width){buffered+=8;count++;}buffered-=width;
  const result=bufferedRefillCounts([width],initial);
  assert.deepEqual(result,{requests:1,histogram:{[count]:1},bytesRead:count,
   multiByteCalls:count>1?1:0,multiByteIterations:count>1?count:0,
   initialBufferedBits:initial,finalBufferedBits:buffered});
 }
 const stream=[65,2,3,136,15,31,1,1,1];
 const combined=bufferedRefillCounts(stream),split=bufferedRefillCounts(stream.slice(0,4)),tail=bufferedRefillCounts(stream.slice(4),split.finalBufferedBits);
 assert.equal(combined.bytesRead,split.bytesRead+tail.bytesRead);
 assert.equal(combined.finalBufferedBits,tail.finalBufferedBits,'chunk boundaries preserve buffered state');
 assert.equal(combined.multiByteCalls,split.multiByteCalls+tail.multiByteCalls);
 const bits=stream.reduce((n,code)=>n+(code&31),0);
 assert.equal(combined.bytesRead*8-bits,combined.finalBufferedBits,'bit conservation is independent of refill formula');
 assert.deepEqual(bufferedRefillCounts([]),{requests:0,histogram:{},bytesRead:0,multiByteCalls:0,multiByteIterations:0,initialBufferedBits:0,finalBufferedBits:0});
});
test('buffered refill counts reject invalid metadata without invoking any engine',()=>{
 for(const code of [-1,0,33,66,129,193,256,1.5])assert.throws(()=>bufferedRefillCounts([code]));
 for(const initial of [-1,32,NaN,0.5])assert.throws(()=>bufferedRefillCounts([1],initial));
});

test('native call controls preserve bit-stream values and partial state across every call form',t=>
 verifyCallControls(t,bufferedCallKinds.filter(kind=>kind!=='buffered-call-gc-parameter')));
test('GC scalar state preserves bit-stream values, bounds exceptions and metadata refusals',t=>
 verifyCallControls(t,['buffered-call-gc-parameter']));

test('float array element storage controls preserve arithmetic, aliases and Java bounds',async t=>{
 const {floatArrayKinds,createFloatArrayControl}=await import('../apps/loading/float-array-controls.mjs');
 if(!WebAssembly.validate(Uint8Array.of(0,97,115,109,1,0,0,0,1,5,1,0x5f,1,0x7f,0))){t.skip('requires Wasm GC');return;}
 if(spawnSync('wasm-as',['--version']).error?.code==='ENOENT'){t.skip('requires Binaryen');return;}
 const f=Math.fround,toInt=x=>Number.isNaN(x)?0:Math.max(-2147483648,Math.min(2147483647,Math.trunc(x)))|0;
 const reference=(n,data,factors,out)=>{
  let sum=0;
  for(let i=0;i<n;i++){
   const p=i&1023,q=(p+512)&1023,a=data[p],b=data[q],c=f(f(a-b)*factors[p]);
   out[p]=c;out[q]=f(a+b);sum=(Math.imul(sum,33)+toInt(f(out[p]*1048576)))|0;
  }return sum;
 };
 const data=Float32Array.from({length:1024},(_,i)=>(i-400)/256),factors=Float32Array.from({length:1024},(_,i)=>(i&31)/32);
 for(const kind of floatArrayKinds)for(const name of ['butterfly-local','butterfly-no-readback']){
  const c=createFloatArrayControl(kind,name),a=c.newArray(64,data),b=c.newArray(4160,factors),out=c.newArray(8256,new Float32Array(1024));
  const expectedOut=new Float32Array(1024),expected=reference(1027,data.slice(),factors,expectedOut);
  assert.deepEqual(c.exports.run(1027,a.store,b.store,out.store,10000),[-1,expected]);c.exports.copyOut(out.store);
  assert.deepEqual(new Uint32Array(out.view.buffer,out.view.byteOffset,1024),new Uint32Array(expectedOut.buffer),'every finite output bit matches');
  // Alias the complete output with the input, not a copied payload.
  const alias=c.newArray(64,data),expectedAlias=data.slice(),aliasSum=reference(1027,expectedAlias,factors,expectedAlias);
  assert.deepEqual(c.exports.run(1027,alias.store,b.store,alias.store,10000),[-1,aliasSum]);c.exports.copyOut(alias.store);
  assert.deepEqual(new Uint32Array(alias.view.buffer,alias.view.byteOffset,1024),new Uint32Array(expectedAlias.buffer),'alias writes remain visible to later reads');
  const input=data.slice();input[0]=2;input[512]=1;
  const left=c.newArray(64,input),weights=c.newArray(4160,new Float32Array(1024).fill(0.5)),short=c.newArray(8256,[-9]);
  assert.throws(()=>c.exports.run(1,left.store,weights.store,short.store,100),e=>e.type==='java/lang/ArrayIndexOutOfBoundsException'&&e.index===512&&e.length===1);
  c.exports.copyOut(short.store);assert.equal(short.view[0],0.5,'first store precedes failure of the second store');
  for(const index of [-1,1,2147483647,-2147483648])assert.throws(()=>c.exports.readOne(short.store,index),e=>e.type==='java/lang/ArrayIndexOutOfBoundsException'&&e.index===index&&e.length===1);
  const empty=c.newArray(8256,[]);assert.deepEqual(c.exports.run(0,empty.store,empty.store,empty.store,10),[-1,0]);
  assert.throws(()=>c.exports.run(1,left.store,weights.store,short.store,1),e=>e.type==='ControlFuelExhausted');
  const zeroFactors=c.newArray(4160,[]),untouched=c.newArray(8256,[9]);
  assert.throws(()=>c.exports.run(1,left.store,zeroFactors.store,untouched.store,100),e=>e.type==='java/lang/ArrayIndexOutOfBoundsException'&&e.index===0&&e.length===0);
  c.exports.copyOut(untouched.store);assert.equal(untouched.view[0],9,'input/factor failures do not execute output stores');
 }
});
