import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {projectMeasurementFixture,parseMeasurementResult,recordProbeObservation,summarizeExecutionOutcome} from '../apps/loading/measurement-fixture.mjs';
import {validateBufferedWorkload,bufferedReplayArgs} from '../apps/loading/buffered-replay.mjs';

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
