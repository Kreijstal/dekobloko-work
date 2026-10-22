// Measurement workers consume inputs, never accumulated observations/profiles.
// The recorder retains the single canonical report and supplies this projection
// over stdin; no second fixture/report file is created.
import fs from 'node:fs';
import assert from 'node:assert/strict';

export const fixtureStdinFlag='--measurement-fixture-stdin';
const pick=(value,keys)=>value&&Object.fromEntries(keys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]));
export function projectMeasurementFixture(receipt){
 assert.ok(receipt&&typeof receipt==='object'&&!Array.isArray(receipt),'Invalid measurement receipt');
 return {
  ...pick(receipt,['schema','classes','assets','referenceCheck','workload','workloadSha256','sourceTreeSha256',
   'jvmOptions','diagnosticOptions','runtimeRevision','runtime']),
  ...(receipt.teavm?{teavm:pick(receipt.teavm,['version','wasmSha256','runtimeSha256'])}:{}),
  ...(receipt.executionBaseline?{executionBaseline:pick(receipt.executionBaseline,['jvmOptions'])}:{}),
  ...(receipt.microbenchmarks?{microbenchmarks:pick(receipt.microbenchmarks,
   ['cases','iterations','seed','codec','sourceSha256','classSha256','classes','wasmSha256','runtimeSha256','wrapperSha256','referenceChecks','references','bufferedReferences','bufferedWorkload'])}:{}),
  ...(receipt.vorbisBenchmark?{vorbisBenchmark:pick(receipt.vorbisBenchmark,
   ['sourceSha256','probeClassSha256','classesInventorySha256','assets','referencePcmSha256','referencePcmBytes',
    'wasmSha256','runtimeSha256','wrapperSha256','transformerSha256','version'])}:{}),
 };
}
export function readMeasurementFixture(reportPath){
 const index=process.argv.indexOf(fixtureStdinFlag),supplied=index>=0;
 if(supplied)process.argv.splice(index,1);
 return {receipt:projectMeasurementFixture(JSON.parse(fs.readFileSync(supplied?0:reportPath,'utf8'))),supplied};
}
export function parseMeasurementResult(stdout,prefix){
 const lines=stdout.split('\n').filter(line=>line.startsWith(prefix));
 assert.equal(lines.length,1,'Expected exactly one '+prefix+' result');
 const result=JSON.parse(lines[0].slice(prefix.length));
 assert.ok(result&&typeof result==='object'&&!Array.isArray(result),'Invalid measurement result');
 return result;
}
export function summarizeExecutionOutcome(result){
 const summary=pick(result,['handled','returned','isVoid','deopted']);
 if(result&&Object.hasOwn(result,'value')){
  const value=result.value;summary.valueKind=value===null?'null':typeof value;
  if(value===null||['number','boolean'].includes(typeof value))summary.value=value;
  else if(typeof value==='bigint')summary.value=String(value);
  else if(typeof value==='string')summary.value=value.slice(0,160);
 }
 return summary;
}
export function recordProbeObservation(receipt,result){
 result.recent=[...(receipt.kernelDiagnostic?.recent||[]),{
  runtimeRevision:result.runtimeRevision,sourceLoader:result.sourceLoader,mode:result.mode,asset:result.asset,kernel:result.kernel,
  executionMs:result.executionMs,decodeMs:result.decodeMs,musicMs:result.musicMs,graphicsMs:result.graphicsMs,
  equal:result.equal,lateCompiles:result.compilation?.postMainSyncCompileCount,
 }].slice(-6);
 receipt.kernelDiagnostic=result;
 return result;
}
