#!/usr/bin/env node
// A changed-runtime reduction of returned private metadata. One canonical report;
// the control withholds a new proof, never removes a correctness check.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadArchivedJvm} from './archive-jvm.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),script=fileURLToPath(import.meta.url);
const directory=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading/returned-array');
const reportPath=path.join(path.dirname(directory),'benchmark.json');
const root=path.resolve(here,'../../../java-tools');
const flags=['--max-old-space-size=1024','--no-liftoff','--no-wasm-lazy-compilation'];
const revision=process.argv[3];assert.match(revision||'',/^[0-9a-f]{40}$/,'Use an exact changed-source JVM commit');
const count=1000000,engines=['shared','unshared'];
const source=`
final class ReturnedRows {int[][] rows;int[] row(int i){return rows[i];}}
final class ReturnState {int[] input;int a,b,c,d;}
public class ReturnedArrayProbe {
 static int touch(ReturnState s,int n){for(int i=0;i<n;i++){s.a++;s.b++;s.c++;s.d++;s.a+=s.input[0];}return s.a;}
 static int scan(ReturnedRows book,ReturnState s,int n){int sum=0;for(int i=0;i<n;i++){
  int[] a=book.row(i&255);if((i&1)==0)sum+=touch(s,0);for(int k=0;k<8;k++)sum=sum*33+a[k];}return sum;}
}`;
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
if(process.argv[2]==='one'){
 const engine=process.argv[4],instrumented=process.argv[5]==='stats';assert.ok(engines.includes(engine));
 assert.ok(flags.every(flag=>process.execArgv.includes(flag)),'Use the eager compiler/heap flags');
 let installed=false,Frame,takeWasmReturnValue,objectModel,allocMultiArray;
 const {JVM}=await loadArchivedJvm(root,revision,{observeModule:({filename,exports})=>{
  if(filename.endsWith('/src/core/frame.js'))Frame=exports;
  if(filename.endsWith('/src/core/objectModel.js'))objectModel=exports;
  if(filename.endsWith('/src/instructions/object.js'))allocMultiArray=exports.allocMultiArray;
  if(filename.endsWith('/src/jit/wasmShared.js'))takeWasmReturnValue=exports.takeWasmReturnValue;
  if(engine==='unshared'&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
   const seed=exports.prototype.seedArrayCacheHeader;
   exports.prototype.seedArrayCacheHeader=function(cache,base,length,ownership){
    // Only returned metadata supplies the explicit fourth argument. Preserve
    // all other code/proofs, but withhold this certificate in the control.
    return seed.call(this,cache,base,length,ownership?[0x41,0]:ownership);
   };installed=true;
  }
 }});
 const j=new JVM({classpath:[directory],wasmHeap:true,wasmFields:true,wasmHeapMb:16,
  jit:{enabled:false,compileWorker:false,retainCompilerDiagnostics:false,wasmStructured:true,
   wasm:{deepInline:false,maxInlineCalleeItems:1,inlineBudget:1,canonicalDirectCalls:true,canonicalEhLinks:true,nativeJsExceptionTags:true}}});
 await j.preloadClasspathClasses();for(const name of ['ReturnedRows','ReturnState','ReturnedArrayProbe'])j._markClassInitialized(name);
 const w=j.jit.wasmJit;w.importStatsEnabled=instrumented;
 const prepare=(owner,name,descriptor)=>{const method=j.findMethod(j.classes[owner],name,descriptor),state=w.methodState({method});
  w.compile({method,className:owner},state,{asCallee:true});assert.equal(state.status,'ready',state.lastCompileError||owner+'.'+name);return state;};
 prepare('ReturnedRows','row','(I)[I');prepare('ReturnedArrayProbe','touch','(LReturnState;I)I');
 const target=prepare('ReturnedArrayProbe','scan','(LReturnedRows;LReturnState;I)I');
 if(engine==='unshared')assert.ok(installed,'Control did not bind before compilation');
 assert.ok(target.meta.nativeObjectRegionBlockCount>0,'Reduction lost the established region proof');
 assert.ok(target.meta.nativeArrayResultOwnershipSites>0,'Reduction lost ownership handoff');
 // Constructors are host setup only; the Java loop itself runs unchanged.
 assert.ok(objectModel&&allocMultiArray,'Archived constructors were not captured');
 const book=objectModel.makeObjectRef(j,'ReturnedRows',objectModel.newFields(j,'ReturnedRows'));
 const state=objectModel.makeObjectRef(j,'ReturnState',objectModel.newFields(j,'ReturnState'));
 const rows=allocMultiArray(j,'[[I',[256,8]);
 for(let i=0;i<256;i++)for(let k=0;k<8;k++)rows[i][k]=(i*17+k*7)&255;
 objectModel.writeField(book.fields,'ReturnedRows.rows',rows);objectModel.writeField(state.fields,'ReturnState.input',rows[0]);
 let expected=0;for(let i=0;i<count;i++)for(let k=0;k<8;k++)expected=(Math.imul(expected,33)+((i&255)*17+k*7&255))|0;
 const frame=new Frame(target.method);frame.className='ReturnedArrayProbe';target.meta.box.frame=frame;
 w.freezeCompilation();j.jit._syncCompileEnvironment={trace:false,assert:true};j.jit.markMainStarted();
 let status,checksum;const started=process.hrtime.bigint();
 try{status=target.run(book,state,count,0,1000000000);checksum=status===-1?takeWasmReturnValue(target.meta):undefined;}
 finally{target.meta.box.frame=null;}
 const elapsedMs=Number(process.hrtime.bigint()-started)/1e6;
 assert.equal(status,-1,'Reduction left native code');assert.equal(checksum,expected,'Changed/control result differs');
 const census=j.jit.syncCompileCensus();assert.equal(census.postMainSyncCompileCount,0);
 assert.ok([...w.nativeArrayResults.values()].every(r=>r.base.value===-2&&r.length.value===0&&r.owned.value===0),'Payload retained after return');
 const headerQueries=target.meta.importStats?.get('native_body_array_header')||0;
 if(instrumented)assert.equal(headerQueries,engine==='shared'?0:count,'Control/proof did not cover every returned row');
 fs.writeSync(1,JSON.stringify({sourceRevision:revision,engine,instrumented,count,checksum,elapsedMs,
  headerQueries:instrumented?headerQueries:null,nativeObjectRegionBlockCount:target.meta.nativeObjectRegionBlockCount,
  nativeArrayResultOwnershipSites:target.meta.nativeArrayResultOwnershipSites,lateCompiles:0,
  node:process.version,execArgv:process.execArgv,control:engine==='unshared'?'Withhold only returned ownership certificate; same changed runtime and input':null})+'\n');process.exit(0);
}
assert.equal(process.argv[2],'run','Usage: returned-array.mjs run EXACT_CHANGED_REVISION');
fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'ReturnedArrayProbe.java'),source);
execFileSync('javac',['--release','8','-proc:none','-d',directory,path.join(directory,'ReturnedArrayProbe.java')]);
const report=JSON.parse(fs.readFileSync(reportPath));
const observations=(report.optimizationTrials.returnedArrayOwnership||={observations:[]}).observations;
let result=observations.findLast(r=>r.sourceRevision===revision&&r.sourceSha256===hash(source)&&!r.completed);
if(!result){result={sourceRevision:revision,sourceSha256:hash(source),harnessSha256:hash(fs.readFileSync(script)),
 purpose:'New changed-runtime returned-row reduction; no warmup, existing baseline or TeaVM run. Control withholds only the returned ownership certificate.',
 count,diagnostics:[],runs:[]};observations.push(result);}
const {diagnostics,runs}=result;
const save=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
const one=(engine,stats=false)=>JSON.parse(execFileSync(process.execPath,[...flags,script,'one',revision,engine,...(stats?['stats']:[])],
 {encoding:'utf8',maxBuffer:1024*1024}).trim());
for(const engine of engines){
 if(diagnostics.some(r=>r.engine===engine)){console.log(engine+': reuse saved diagnostic; no execution');continue;}
 const observation=one(engine,true);diagnostics.push(observation);save();console.log(engine+': excluded diagnostic, '+observation.headerQueries+' ownership queries');
}
for(let pair=0;pair<3;pair++)for(const engine of pair===1?engines.toReversed():engines){
 if(runs.some(r=>r.engine===engine&&r.pair===pair)){console.log('reuse saved pair '+(pair+1)+' '+engine);continue;}
 const observation=one(engine);runs.push({...observation,pair,measuredAt:new Date().toISOString()});save();console.log('pair '+(pair+1)+' '+engine+': '+observation.elapsedMs.toFixed(3)+' ms');
}
result.completed=true;result.measuredAt=new Date().toISOString();save();
for(const engine of engines){const samples=runs.filter(r=>r.engine===engine).map(r=>r.elapsedMs).sort((a,b)=>a-b);console.log(engine+' median: '+samples[1].toFixed(6)+' ms');}
