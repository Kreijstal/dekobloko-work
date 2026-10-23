#!/usr/bin/env node
// A fresh bounded stream and one native invocation per observation. This new
// case compares one changed runtime with/without its outer inline transform;
// it never runs an existing JVM, TeaVM or HotSpot control.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadArchivedJvm} from './archive-jvm.mjs';
import {canonicalExecutionCounts} from './browser.mjs';
import {parseMeasurementResult} from './measurement-fixture.mjs';
import {parseWat} from './wasm-loop-outline.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),script=fileURLToPath(import.meta.url);
const root=path.resolve(here,'../../../java-tools');
const player=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading');
const directory=path.join(player,'nested-loop'),reportPath=path.join(player,'benchmark.json');
const flags=['--max-old-space-size=1024','--no-liftoff','--no-wasm-lazy-compilation'];
const [command,revision,engine,detail,caseArg]=process.argv.slice(2),engines=['inlined','separate'],count=1000000;
const caseName=command.startsWith('stable-')||caseArg==='stable'?'stable':command.startsWith('scope-')||caseArg==='scope'?'scope':'whole';
const targetName={whole:'scan',scope:'scanScoped',stable:'scanStable'}[caseName];
assert.match(revision||'',/^[0-9a-f]{40}$/,'Use an exact changed-source JVM commit');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const source=`
final class NestedLoopBits {static byte[] bytes;static int bit,cursor;}
final class NestedLoopBook {
 int[] tree;int[][] rows;
 final int scalar(){int at=0;while(tree[at]>=0){
  int b=NestedLoopBits.bytes[NestedLoopBits.cursor]>>NestedLoopBits.bit&1;
  NestedLoopBits.bit++;NestedLoopBits.cursor+=NestedLoopBits.bit>>3;NestedLoopBits.bit&=7;
  at=b!=0?tree[at]:at+1;}return ~tree[at];}
 final int[] vector(){return rows[scalar()];}
}
public class NestedLoopProbe {
 static int fence;
 static int identity(int i){return i;}
 static void outside(int i){fence=identity(i);}
 static int scanStable(NestedLoopBook[] books,int n){NestedLoopBook book=books[0];int sum=3;for(int i=0;i<n;i++){
  int[] row=book.vector();for(int k=0;k<8;k++)sum=sum*33+row[k];}return sum;}
 static int scanScoped(NestedLoopBook[] books,int n){int sum=3;for(int i=0;i<n;i++){
  int[] row=books[0].vector();for(int k=0;k<8;k++)sum=sum*33+row[k];outside(i);}return sum;}
 static int scan(NestedLoopBook book,int n){int sum=3;for(int i=0;i<n;i++){
  int[] row=book.vector();for(int k=0;k<8;k++)sum=sum*33+row[k];}return sum;}
}`;

if(command==='one'||command==='code-one'){
 assert.ok(engines.includes(engine));assert.ok(flags.every(flag=>process.execArgv.includes(flag)));
 const instrumented=detail==='stats';let Frame,model,allocMultiArray,takeWasmReturnValue,installed=false;
 const {JVM}=await loadArchivedJvm(root,revision,{observeModule:({filename,exports})=>{
  if(filename.endsWith('/src/core/frame.js'))Frame=exports;
  if(filename.endsWith('/src/core/objectModel.js'))model=exports;
  if(filename.endsWith('/src/instructions/object.js'))allocMultiArray=exports.allocMultiArray;
  if(filename.endsWith('/src/jit/wasmShared.js'))takeWasmReturnValue=exports.takeWasmReturnValue;
  if(engine==='separate'&&filename.endsWith('/src/jit/wasmInline.js')){
   const inline=exports.inlineCalls;
   exports.inlineCalls=function(jvm,code,options){
    if(options.callerClassName==='NestedLoopProbe'&&options.callerMethod?.name===targetName)return null;
    return inline(jvm,code,options);
   };installed=true;
  }
 }});
 if(engine==='separate')assert.ok(installed,'Control missed the outer transform');
 const j=new JVM({classpath:[directory],wasmHeap:true,wasmFields:true,wasmHeapMb:32,
  jit:{enabled:false,compileWorker:false,retainCompilerDiagnostics:false,wasmStructured:true,
   wasm:{deepInline:false,canonicalDirectCalls:true,canonicalEhLinks:true,nativeJsExceptionTags:true}}});
 if(command==='code-one'){j.executeTick=()=>{throw Error('Code inspection attempted a guest tick');};j.executeInstruction=()=>{throw Error('Code inspection attempted a guest instruction');};}
 await j.preloadClasspathClasses();for(const name of ['NestedLoopBits','NestedLoopBook','NestedLoopProbe'])j._markClassInitialized(name);
 const w=j.jit.wasmJit;w.enabled=true;w.importStatsEnabled=instrumented;
 const build=(owner,name,descriptor)=>{const method=j.findMethod(j.classes[owner],name,descriptor),state=w.methodState({method});
  w.compile({method,className:owner},state,{asCallee:true});assert.equal(state.status,'ready',state.lastCompileError||owner+'.'+name);return state;};
 build('NestedLoopBook','scalar','()I');const vector=build('NestedLoopBook','vector','()[I');
 if(caseName==='scope'){build('NestedLoopProbe','identity','(I)I');build('NestedLoopProbe','outside','(I)V');}
 const target=build('NestedLoopProbe',targetName,caseName!=='whole'?'([LNestedLoopBook;I)I':'(LNestedLoopBook;I)I');
 assert.equal(target.meta.inlineActivationDepth||0,engine==='inlined'?2:0,'Unexpected compiled call shape');
 assert.ok(target.meta.normalFlowFullyCompiled,'Reduction lost full normal flow');
 if(command==='code-one'){
  const rows=[];
  for(const [name,state]of [['root',target],['vector',vector]]){
   const wat=execFileSync('wasm-dis',['--all-features','-'],{input:state.meta.bytes,encoding:'utf8',maxBuffer:4*1024*1024});
   const module=parseWat(wat),core=module.find(node=>node?.[0]==='func'&&node[1]?.startsWith('$jvm$wasm$'));
   assert.ok(core,'Missing generated core function');
   const starts=[...wat.matchAll(/^ \(func (\$[^\s(]+)/gm)],ordinal=starts.findIndex(match=>match[1]===core[1]);assert.ok(ordinal>=0);
   const index=(wat.match(/^ \(import [^\n]*\(func /gm)||[]).length+ordinal;
   const native=execFileSync(process.execPath,[...flags,'--trace-wasm-inlining','--print-wasm-code-function-index='+index,'-e',
    "new WebAssembly.Module(require('node:fs').readFileSync(0))"],{input:state.meta.bytes,encoding:'utf8',maxBuffer:8*1024*1024});
   assert.match(native,/compiler: TurboFan/,'Expected eager optimizing native compilation');
   const body=native.slice(native.indexOf('Instructions (size'),native.indexOf('\nSource positions:'));
   const ops={};const walk=node=>{if(!Array.isArray(node))return;if(typeof node[0]==='string')ops[node[0]]=(ops[node[0]]||0)+1;for(const child of node)walk(child);};walk(core);
   rows.push({name,key:state.key,wasmBytes:state.meta.bytes.length,wasmLocals:core.filter(node=>node?.[0]==='local').length,
    instructionBytes:Number(native.match(/Instructions \(size = (\d+)\)/)?.[1]),
    stackReservations:[...body.matchAll(/^0x[^\n]*\bsubq? rsp,[^\n]*/gm)].map(match=>match[0]),
    stackAddressSites:(body.match(/\[(?:r|e)[bs]p[^\]]*\]/g)||[]).length,
    nativeCallSites:(body.match(/^0x[^\n]*\bcall\b/gm)||[]).length,
    branches:ops.if||0,loops:ops.loop||0,loads:ops['i32.load']||0,stores:ops['i32.store']||0,
    inlineActivationDepth:state.meta.inlineActivationDepth||0,nativeStateSites:state.meta.nativeStaticStateBodySites||0});
   if(name==='root')fs.writeFileSync(path.join(directory,'current.wat'),wat);
   fs.appendFileSync(path.join(directory,'current-native.txt'),'\n'+engine+' '+state.key+'\n'+native);
  }
  console.log('NESTED_CODE_RESULT '+JSON.stringify({sourceRevision:revision,caseName,engine,rows,guestInstructions:0,
   scope:'Code-generation question only: no Java workload, oracle, timer, CPU attribution or baseline identity replay; native static site counts include cold paths.'}));process.exit(0);
 }
 const tree=[];let leaf=0;
 const node=depth=>{const at=tree.length;tree.push(0);if(!depth)tree[at]=~leaf++;
  else{node(depth-1);const right=node(depth-1);tree[at]=right;}return at;};node(8);
 const input=j.wasmHeap.alloc('[B',count);input.type='[B';for(let i=0;i<count;i++)input[i]=(i*73+17)&255;
 const treeArray=j.wasmHeap.alloc('[I',tree.length);treeArray.type='[I';treeArray.set(tree);
 const rows=allocMultiArray(j,'[[I',[256,8]);for(let i=0;i<256;i++)for(let k=0;k<8;k++)rows[i][k]=(i*17+k*7)&255;
 const book=model.makeObjectRef(j,'NestedLoopBook',model.newFields(j,'NestedLoopBook'));
 model.writeField(book.fields,'NestedLoopBook.tree',treeArray);model.writeField(book.fields,'NestedLoopBook.rows',rows);
 const state=j.classes.NestedLoopBits.staticFields;state.set('bytes:[B',input);state.set('bit:I',0);state.set('cursor:I',0);
 let expected=3;for(let i=0;i<count;i++){
  const byte=(i*73+17)&255;let index=0;for(let bit=0;bit<8;bit++)index=index<<1|byte>>bit&1;
  for(let k=0;k<8;k++)expected=(Math.imul(expected,33)+((index*17+k*7)&255))|0;
 }
 const argument=caseName!=='whole'?allocMultiArray(j,'[LNestedLoopBook;',[1]):book;if(caseName!=='whole')argument[0]=book;
 const frame=new Frame(target.method);frame.className='NestedLoopProbe';frame.locals[0]=argument;frame.locals[1]=count;target.meta.box.frame=frame;
 w.freezeCompilation();j.jit._syncCompileEnvironment={trace:false,assert:true};j.jit.markMainStarted();
 // Isolate generated execution inside one bounded native invocation. Both
 // variants use the same budget; production fuel policy is never changed.
 const start=process.hrtime.bigint();let status,checksum;
 try{status=target.run(argument,count,0,1000000000);checksum=status===-1?takeWasmReturnValue(target.meta):undefined;}
 finally{target.meta.box.frame=null;}
 const elapsedMs=Number(process.hrtime.bigint()-start)/1e6;
 assert.equal(status,-1,'Reduction left its native invocation');assert.equal(checksum,expected);
 assert.deepEqual([state.get('cursor:I'),state.get('bit:I')],[count,0]);
 assert.equal(j.jit.syncCompileCensus().postMainSyncCompileCount,0);
 assert.ok([...w.nativeArrayResults.values()].every(r=>r.base.value===-2&&r.length.value===0&&r.owned.value===0),'Return metadata remains installed');
 const vectorEntries=instrumented?canonicalExecutionCounts(vector.meta).directEntries:null;
 if(instrumented)assert.equal(vectorEntries,engine==='inlined'?0:count,'Control lost the intended method boundary');
 if(instrumented&&caseName==='stable')assert.equal(target.meta.importStats.get('native_state_object_storage')||0,engine==='inlined'?1:0,'Stable ownership was not shared across scope entries');
 console.log('NESTED_LOOP_RESULT '+JSON.stringify({sourceRevision:revision,caseName,engine,instrumented,count,checksum,elapsedMs,
  sourceSha256:hash(source),classSha256:hash(fs.readFileSync(path.join(directory,'NestedLoopProbe.class'))),
  inlineActivationDepth:target.meta.inlineActivationDepth||0,vectorEntries,
  nativeStaticStateBodySites:target.meta.nativeStaticStateBodySites||0,
  nativeStaticArrayRegions:target.meta.nativeStaticArrayRegions||[],
  nativeStaticCheckedReferenceLoads:target.meta.nativeStaticCheckedReferenceLoads||0,
  stateOwnershipQueries:instrumented?target.meta.importStats.get('native_state_object_storage')||0:null,
  stateArrayHeaderQueries:instrumented?target.meta.importStats.get('native_state_array_header')||0:null,
  permissionChecks:instrumented?[...target.meta.importStats].filter(([name])=>name.startsWith('native_state_permissions_')).reduce((sum,[,value])=>sum+value,0):null,
  baseQueries:instrumented?target.meta.importStats.get('abase')||0:null,
  lengthQueries:instrumented?target.meta.importStats.get('alen0')||0:null,
  separateVectorStateSites:vector.meta.nativeStaticStateBodySites||0,
  ownershipQueries:instrumented?target.meta.importStats.get('native_body_object_storage')||0:null,
  separateVectorOwnershipQueries:instrumented?vector.meta.importStats.get('native_state_object_storage')||0:null,
  nativeExits:target.meta.directFrameContext.exitCount,lateJavaCompiles:0,
  node:process.version,execArgv:process.execArgv,
  control:engine==='separate'?'Withhold only the root inline transform; same changed runtime and new Java workload':null,
  scope:'Bounded '+caseName+' code-generation reduction with identical high invocation fuel; not production scheduling, original loading, TeaVM parity or an existing baseline validation'}));
 process.exit(0);
}

assert.ok(['diagnose','run','candidate','scope-diagnose','scope-run','scope-candidate','stable-diagnose','stable-run','stable-candidate','inspect','scope-inspect','stable-inspect','code','scope-code','stable-code'].includes(command),'Usage: nested-loop.mjs diagnose|run|candidate|scope-diagnose|scope-run|scope-candidate EXACT_CHANGED_REVISION');
fs.mkdirSync(directory,{recursive:true});const java=path.join(directory,'NestedLoopProbe.java');
if(!fs.existsSync(java)||fs.readFileSync(java,'utf8')!==source||!fs.existsSync(path.join(directory,'NestedLoopProbe.class'))){
 fs.writeFileSync(java,source);execFileSync('javac',['--release','8','-proc:none','-d',directory,java]);
}
const report=JSON.parse(fs.readFileSync(reportPath)),trial=report.optimizationTrials.nestedInlineLoops||={observations:[]};
let result=trial.observations.findLast(row=>row.sourceRevision===revision&&row.sourceSha256===hash(source)&&(row.caseName||'whole')===caseName);
if(!result){result={sourceRevision:revision,caseName,sourceSha256:hash(source),harnessSha256:hash(fs.readFileSync(script)),count,
 diagnostics:[],runs:[],purpose:'New nested stream case: unchanged backend controls are not executed. Control withholds only this new outer transform.'};trial.observations.push(result);}
const save=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
const one=(variant,stats)=>parseMeasurementResult(execFileSync(process.execPath,[...flags,script,'one',revision,variant,stats?'stats':'timing',caseName],
 {encoding:'utf8',maxBuffer:1024*1024}),'NESTED_LOOP_RESULT ');
if(command.endsWith('code')){
 fs.writeFileSync(path.join(directory,'current-native.txt'),'');
 result.codeOutputs=[];
 for(const variant of engines){
  const row=parseMeasurementResult(execFileSync(process.execPath,[...flags,script,'code-one',revision,variant,'code',caseName],
   {encoding:'utf8',maxBuffer:1024*1024}),'NESTED_CODE_RESULT ');result.codeOutputs.push(row);save();console.log(JSON.stringify(row));
 }
}else if(command.endsWith('diagnose')||command.endsWith('inspect'))for(const variant of command.endsWith('inspect')?['inlined']:engines){
 if(result.diagnostics.some(row=>row.engine===variant)){console.log('reuse saved '+variant+' diagnostic');continue;}
 const row=one(variant,true);result.diagnostics.push(row);save();console.log(JSON.stringify(row));
}
else{
 const measuredEngines=command.endsWith('candidate')?['inlined']:engines;
 result.timingMode=measuredEngines.length===1?'Changed candidate only; reuse saved controls':'Paired new-workload control';
 for(let pair=0;pair<3;pair++)for(const variant of pair===1?measuredEngines.toReversed():measuredEngines){
  if(result.runs.some(row=>row.engine===variant&&row.pair===pair)){console.log('reuse saved pair '+pair+' '+variant);continue;}
  const row=one(variant,false);result.runs.push({...row,pair,measuredAt:new Date().toISOString()});save();
  console.log('pair '+(pair+1)+' '+variant+': '+row.elapsedMs.toFixed(6)+' ms');
 }
 result.completed=true;save();
}
