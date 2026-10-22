import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {projectMeasurementFixture,parseMeasurementResult,recordProbeObservation,summarizeExecutionOutcome} from '../apps/loading/measurement-fixture.mjs';
import {validateBufferedWorkload,bufferedReplayArgs} from '../apps/loading/buffered-replay.mjs';
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
test('native call controls preserve bit-stream values and partial state across every call form',t=>{
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
 for(const kind of bufferedCallKinds){
  assert.equal(bufferedCallSources(kind).readerCore,reader,'The same reader arithmetic and field operations remain');
  const result=measureBufferedCallControl(kind,input,workload,requests.length,expected);
  assert.equal(result.checksum,expected[0]);assert.deepEqual(result.bufferedState,expected.slice(1));
  assert.equal(result.postTimerBoundsChecks,2);assert.equal(result.postTimerNoRefillCheck,true);
  if(kind==='buffered-call-transfer'){
   assert.equal(result.postTimerMetadataReleaseChecks,6);assert.equal(result.postTimerMetadataRefusals,2);
  }
  if(kind==='buffered-call-parameter'){
   assert.equal(result.nativeCallProtocol,'store-parameter-and-status');assert.equal(result.postTimerMetadataRefusals,2);
  }
 }
});
