#!/usr/bin/env node
// One new constructor per fresh VM. Both modes use the changed source; the
// bytecode control withholds execution of its prepared Wasm body only.
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
const root=path.resolve(here,'../../../java-tools'),player=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading');
const directory=path.join(player,'constructors'),reportPath=path.join(player,'benchmark.json');
const flags=['--max-old-space-size=1024','--no-liftoff','--no-wasm-lazy-compilation'];
const [command,revision,engine,diagnostic]=process.argv.slice(2);
const storeCase=command?.startsWith('stores-')||engine?.startsWith('stores-'),size=storeCase?64:32,width=storeCase?8:size;
const modes=storeCase?['stores-native','stores-checked']:['wasm','bytecode'];
assert.match(revision||'',/^[0-9a-f]{40}$/,'Use an exact changed-source revision');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const source=storeCase?`public final class MatrixConstructionProbe {
 int[][][] values;
 MatrixConstructionProbe(int groups,int width){values=new int[groups][][];
  for(int g=0;g<groups;g++){int[][] rows=new int[256][];values[g]=rows;
   for(int i=0;i<256;i++)rows[i]=new int[width];}}
}`:`public final class MatrixConstructionProbe {
 int[][] values;
 MatrixConstructionProbe(int a,int b){values=new int[a][b];
  for(int i=0;i<a;i++)for(int k=0;k<b;k++)values[i][k]=i*100+k;}
}`;

if(command==='one'){
 assert.ok(modes.includes(engine));assert.ok(flags.every(f=>process.execArgv.includes(f)));
 let Frame,Stack,model,replacementInstalled=false;
 const native=engine!=='bytecode',instrumented=diagnostic==='stats';
 const {JVM}=await loadArchivedJvm(root,revision,{observeModule:({filename,exports})=>{
  if(engine==='stores-checked'&&filename.endsWith('/src/jit/nativeReferenceStores.js')){exports.emit=()=>false;replacementInstalled=true;}
  if(filename.endsWith('/src/core/frame.js'))Frame=exports;
  if(filename.endsWith('/src/core/callStack.js'))Stack=exports;
  if(filename.endsWith('/src/core/objectModel.js'))model=exports;
 }});
 const j=new JVM({classpath:[directory],wasmHeap:true,wasmFields:true,prepareBeforeMain:false,
  jit:{enabled:false,compileWorker:false,retainCompilerDiagnostics:false,wasmStructured:true,
   wasm:{structured:true,compileConstructors:true,deepInline:false,canonicalDirectCalls:true,canonicalEhLinks:true,nativeJsExceptionTags:true}}});
 await j.preloadClasspathClasses();j._markClassInitialized('MatrixConstructionProbe');
 const w=j.jit.wasmJit;w.importStatsEnabled=instrumented;
 const method=j.findMethod(j.classes.MatrixConstructionProbe,'<init>','(II)V'),state=w.methodState({method});
 w.compile({method,className:'MatrixConstructionProbe'},state,{asCallee:true});
 if(engine==='stores-checked')assert.ok(replacementInstalled,'The checked control did not withhold the new store emitter');
 assert.equal(state.status,'ready',state.lastCompileError);assert.ok(state.meta.fullyCompiled&&state.meta.normalFlowFullyCompiled,'Constructor still has an unsupported allocation');
 if(storeCase)assert.equal((state.meta.nativeReferenceStoreSites||0)>0,engine==='stores-native','Wrong native-store admission');
 const receiver=model.makeObjectRef(j,'MatrixConstructionProbe',model.newFields(j,'MatrixConstructionProbe'));
 const frame=new Frame(method);frame.className='MatrixConstructionProbe';frame.locals[0]=receiver;frame.locals[1]=size;frame.locals[2]=width;
 const thread={id:0,status:'runnable',callStack:new Stack()};thread.callStack.push(frame);j.threads=[thread];j.currentThreadIndex=0;
 w.freezeCompilation();j.jit._syncCompileEnvironment={trace:false,assert:true};j.jit.markMainStarted();w.enabled=native;
 const start=process.hrtime.bigint();let ticks=0,outcome;
 if(native)outcome=w.execute(frame,thread,state,0);
 else while(!thread.callStack.isEmpty()&&++ticks<1000000)await j.executeTick();
 const elapsedMs=Number(process.hrtime.bigint()-start)/1e6;
 assert.ok(thread.callStack.isEmpty(),'Constructor did not complete');
 if(native)assert.ok(outcome?.handled&&!outcome.deopted,'Constructor left native execution');
 const values=model.readField(receiver.fields,'MatrixConstructionProbe.values');
 assert.equal(values.length,size);let checksum=0;
 if(storeCase){
  const rows=new Set();
  for(let g=0;g<size;g++){
   const group=values[g];assert.equal(group.length,256);
   for(let i=0;i<256;i++){
    const row=group[i];rows.add(row);assert.equal(row.length,width);
    for(const value of row)assert.equal(value,0);
    checksum=(Math.imul(checksum,33)+row.length)|0;
   }
  }
  assert.equal(rows.size,size*256,'Rows unexpectedly share identity');
 }else for(let i=0;i<size;i++){
  assert.equal(values[i].length,size);
  for(let k=0;k<size;k++){assert.equal(values[i][k],i*100+k);checksum=(Math.imul(checksum,33)+values[i][k])|0;}
 }
 assert.equal(j.jit.syncCompileCensus().postMainSyncCompileCount,0);
 assert.equal(state.runs,native?1:0,'Control selected the wrong execution tier');
 console.log('CONSTRUCTOR_RESULT '+JSON.stringify({sourceRevision:revision,engine,caseName:storeCase?'reference-stores':'matrix',size,width,checksum,elapsedMs,ticks,instrumented,
  nativeReferenceStoreSites:state.meta.nativeReferenceStoreSites||0,
  checkedReferenceStoreCalls:instrumented?state.meta.importStats?.get('aset_aastore')||state.meta.importStats?.get('aset_r')||0:null,
  referenceStoreEmitterWithheld:replacementInstalled,
  nativeEntries:state.runs,nativeExits:state.meta.directFrameContext?.exitCount||0,lateJavaCompiles:0,
  sourceSha256:hash(source),classSha256:hash(fs.readFileSync(path.join(directory,'MatrixConstructionProbe.class'))),
  harnessSha256:hash(fs.readFileSync(script)),node:process.version,execArgv:process.execArgv,
  scope:'One complete new constructor through the selected supported execution tier; no warmup, replay, unchanged baseline/oracle or TeaVM process. Not a full-loading or parity verdict.'}));
 process.exit(0);
}

assert.ok(['inspect','run','stores-inspect','stores-run'].includes(command),'Use constructor.mjs inspect|run EXACT_CHANGED_REVISION');
fs.mkdirSync(directory,{recursive:true});const java=path.join(directory,'MatrixConstructionProbe.java');
if(!fs.existsSync(java)||fs.readFileSync(java,'utf8')!==source||!fs.existsSync(path.join(directory,'MatrixConstructionProbe.class'))){
 fs.writeFileSync(java,source);execFileSync('javac',['--release','8','-proc:none','-d',directory,java]);
}
const report=JSON.parse(fs.readFileSync(reportPath));
const trial=report.optimizationTrials.multiArrayAllocation||={observations:[]};
let observation=trial.observations.find(x=>x.sourceRevision===revision&&x.sourceSha256===hash(source));
if(!observation){observation={sourceRevision:revision,sourceSha256:hash(source),diagnostics:[],runs:[]};trial.observations.push(observation);}
const save=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
const one=mode=>parseMeasurementResult(execFileSync(process.execPath,[...flags,script,'one',revision,mode,...(command==='stores-inspect'?['stats']:[])],{encoding:'utf8',maxBuffer:1024*1024}),'CONSTRUCTOR_RESULT ');
if(command==='inspect'||command==='stores-inspect'){
 for(const mode of modes)if(!observation.diagnostics.some(r=>r.engine===mode)){
  const row={...one(mode),excludedFromTiming:true};observation.diagnostics.push(row);save();console.log(JSON.stringify(row));
 }
}else for(let pair=0;pair<3;pair++)for(const mode of pair===1?modes.toReversed():modes){
 if(observation.runs.some(r=>r.pair===pair&&r.engine===mode)){console.log('Reuse saved '+mode+' sample '+pair);continue;}
 const row={...one(mode),pair,measuredAt:new Date().toISOString()};observation.runs.push(row);save();
 console.log('pair '+(pair+1)+' '+mode+': '+row.elapsedMs.toFixed(6)+' ms');
}
