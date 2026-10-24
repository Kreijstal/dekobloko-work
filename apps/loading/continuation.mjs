#!/usr/bin/env node
// A new cold-call case on one changed source revision, with and without its
// native continuation. Every child executes one fresh activation, no warmup.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadArchivedJvm} from './archive-jvm.mjs';
import {parseMeasurementResult} from './measurement-fixture.mjs';

const script=fileURLToPath(import.meta.url),here=path.dirname(script);
const root=path.resolve(here,'../../../java-tools');
const player=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading');
const directory=path.join(player,'continuation'),reportPath=path.join(player,'benchmark.json');
const flags=['--max-old-space-size=1024','--no-liftoff','--no-wasm-lazy-compilation'];
const [requestedCommand,revision,engine,caseArg]=process.argv.slice(2),n=8192;
const caseName=requestedCommand.startsWith('parameter-')||caseArg==='parameter'?'parameter':'mixed';
const command=requestedCommand.replace(/^parameter-/,'');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
assert.match(revision||'',/^[0-9a-f]{40}$/,'Use an exact changed-source revision');
const source=`public class ContinuationProbe {
 static int prefixes,early,steps,tails,decisions,initializerPrefix,initializerEarly;
 static int[] output;
 static boolean choose(int mode){decisions++;return mode==0;}
 static int prefixLen(int[] input){return input.length;}
 static int prefixKernel(int mode,int n,int[] input){prefixes++;output=input;int sum=prefixLen(input);input=null;
  for(int i=0;i<3;i++){early++;sum=sum*3+i;}
  if(choose(mode)){sum+=ContinuationLookup.read();for(int i=0;i<n;i++){steps++;sum=sum*33+(i&7);}}
  else{sum+=ContinuationLookup.read();for(int i=0;i<n;i++){steps++;sum=sum*17-(i&7);}}
  tails++;return sum;
 }
 static int kernel(int mode,int n,int[] input){prefixes++;int[] kept=input;input=null;output=kept;int sum=17;
  for(int i=0;i<3;i++){early++;sum=sum*3+i;}
  if(choose(mode)){sum+=ContinuationLookup.read();for(int i=0;i<n;i++){steps++;kept[0]++;sum=sum*33+(i&7);}}
  else{sum+=ContinuationLookup.read();for(int i=0;i<n;i++){steps++;kept[0]++;sum=sum*17-(i&7);}}
  tails++;return sum;
 }
}
class ContinuationLookup {static int read(){return ContinuationSeed.seed;}}
class ContinuationSeed {static int seed;static {ContinuationProbe.initializerPrefix=ContinuationProbe.prefixes;
 ContinuationProbe.initializerEarly=ContinuationProbe.early;seed=11;}}
`;

if(command==='one'){
 assert.ok(['resume','fallback'].includes(engine));assert.ok(flags.every(f=>process.execArgv.includes(f)));
 let Frame,Stack;
 const {JVM}=await loadArchivedJvm(root,revision,{observeModule:({filename,exports})=>{
  if(filename.endsWith('/src/core/frame.js'))Frame=exports;
  if(filename.endsWith('/src/core/stack.js'))Stack=exports;
 }});
 const j=new JVM({classpath:[directory],wasmHeap:true,wasmFields:true,wasmHeapMb:1,prepareBeforeMain:false,
  jit:{codegen:true,compileWorker:false,retainCompilerDiagnostics:false,scalarLoops:true,
   structuredSsa:true,rendererPipeline:true,compiledCallChains:true,scalarGuestBodies:true,
   preparedCompleteWasm:true,preparedLoopLeafWasm:true,
   wasm:{structured:true,deepInline:false,canonicalDirectCalls:true,canonicalEhLinks:true,nativeJsExceptionTags:true}}});
 await j.preloadClasspathClasses();const w=j.jit.wasmJit;w.enabled=true;
 await j.precompileInitializedClasses({initializedOnly:false,effectful:true,wasm:true,wasmPreparedUpgradesOnly:false});
 const method=j.findMethod(j.classes.ContinuationProbe,caseName==='parameter'?'prefixKernel':'kernel','(II[I)I'),state=w.state.get(method);
 assert.equal(state?.status,'ready');assert.ok(state.meta.structuredResumeEntries.length>=3);
 if(caseName==='parameter')assert.ok(state.meta.parameterArrayCacheCount>0,'Case needs an actual prefix parameter cache');
 assert.notEqual(j.classInitializationState.get('ContinuationSeed'),'INITIALIZED');
 j._markClassInitialized('ContinuationProbe');const fields=j.classes.ContinuationProbe.staticFields;
 for(const name of ['prefixes','early','steps','tails','decisions','initializerPrefix','initializerEarly'])fields.set(name+':I',0);
 fields.set('output:[I',null);
 const array=j.wasmHeap.alloc('[I',1);array.type='[I';array[0]=7;
 const frame=new Frame(method),carrier=new Frame(method);frame.className='ContinuationProbe';
 frame.locals[0]=0;frame.locals[1]=n;frame.locals[2]=array;
 const thread={id:0,status:'runnable',callStack:new Stack(),pendingException:null};
 thread.callStack.push(carrier);thread.callStack.push(frame);j.threads=[thread];j.currentThreadIndex=0;
 if(engine==='fallback'){
  // Keep the same initial native entry and cold call. Only withhold this
  // activation's later native entries; supported generated/bytecode tiers run.
  const prepare=w.prepare.bind(w),candidates=w.structuredResumeCandidates.bind(w);
  w.prepare=f=>f===frame&&f.pc>0?null:prepare(f);
  w.structuredResumeCandidates=f=>f===frame?null:candidates(f);
 }
 w.freezeCompilation();j.jit._syncCompileEnvironment={trace:false,assert:true};j.jit.markMainStarted();
 const start=process.hrtime.bigint();let ticks=0;
 while(thread.callStack.size()>1){await j.executeTick();assert.ok(++ticks<1000000,'Continuation made no progress');}
 const elapsedMs=Number(process.hrtime.bigint()-start)/1e6;
 let expected=caseName==='parameter'?1:17;for(let i=0;i<3;i++)expected=(Math.imul(expected,3)+i)|0;
 expected+=11;for(let i=0;i<n;i++)expected=(Math.imul(expected,33)+(i&7))|0;
 assert.equal(carrier.stack.pop(),expected);
 for(const [name,value]of Object.entries({prefixes:1,early:3,steps:n,tails:1,decisions:1,initializerPrefix:1,initializerEarly:3}))assert.equal(fields.get(name+':I'),value,name);
 assert.equal(fields.get('output:[I'),array);assert.equal(array[0],caseName==='parameter'?7:7+n);
 assert.equal(j.jit.syncCompileCensus().postMainSyncCompileCount,0);
 assert.ok(engine==='resume'?state.runs>1:state.runs===1,'Control did not select the intended continuation');
 console.log('CONTINUATION_RESULT '+JSON.stringify({sourceRevision:revision,caseName,engine,n,checksum:expected,elapsedMs,ticks,
  nativeEntries:state.runs,nativeExits:state.meta.directFrameContext?.exitCount||0,lateJavaCompiles:0,
  sourceSha256:hash(source),classSha256:hash(fs.readFileSync(path.join(directory,'ContinuationProbe.class'))),
  harnessSha256:hash(fs.readFileSync(script)),node:process.version,execArgv:process.execArgv,
  scope:'New sequential/conditional loop and cold nested initializer, one activation on changed source. Fallback withholds only later native entries; no known control/oracle replay, CPU profile or full-loading verdict.'}));
 process.exit(0);
}

assert.ok(['inspect','run'].includes(command),'Use continuation.mjs inspect|run EXACT_CHANGED_REVISION');
fs.mkdirSync(directory,{recursive:true});const java=path.join(directory,'ContinuationProbe.java');
if(!fs.existsSync(java)||fs.readFileSync(java,'utf8')!==source||!fs.existsSync(path.join(directory,'ContinuationProbe.class'))){
 fs.writeFileSync(java,source);execFileSync('javac',['--release','8','-proc:none','-d',directory,java]);
}
const report=JSON.parse(fs.readFileSync(reportPath));
const trial=report.optimizationTrials.conditionalLoopContinuation||={observations:[]};
let observation=trial.observations.find(x=>x.sourceRevision===revision&&x.caseName===caseName&&x.sourceSha256===hash(source)&&x.harnessSha256===hash(fs.readFileSync(script)));
if(!observation){observation={sourceRevision:revision,caseName,sourceSha256:hash(source),harnessSha256:hash(fs.readFileSync(script)),diagnostics:[],runs:[]};trial.observations.push(observation);}
const save=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
const one=mode=>parseMeasurementResult(execFileSync(process.execPath,[...flags,script,'one',revision,mode,caseName],{encoding:'utf8',maxBuffer:1024*1024}),'CONTINUATION_RESULT ');
if(command==='inspect'){
 for(const mode of ['resume','fallback'])if(!observation.diagnostics.some(r=>r.engine===mode)){
  const row={...one(mode),excludedFromTiming:true};observation.diagnostics.push(row);save();console.log(JSON.stringify(row));
 }
}else for(let pair=0;pair<3;pair++)for(const mode of pair===1?['fallback','resume']:['resume','fallback']){
 if(observation.runs.some(r=>r.pair===pair&&r.engine===mode)){console.log('Reuse saved '+mode+' sample '+pair);continue;}
 const row={...one(mode),pair,measuredAt:new Date().toISOString()};observation.runs.push(row);save();
 console.log('pair '+(pair+1)+' '+mode+': '+row.elapsedMs.toFixed(6)+' ms');
}
