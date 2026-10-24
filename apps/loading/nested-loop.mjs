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
import {parseWat,printWat} from './wasm-loop-outline.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),script=fileURLToPath(import.meta.url);
const root=path.resolve(here,'../../../java-tools');
const player=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading');
const directory=path.join(player,'nested-loop'),reportPath=path.join(player,'benchmark.json');
const flags=['--max-old-space-size=1024','--no-liftoff','--no-wasm-lazy-compilation'];
const [command,revision,engine,detail,caseArg]=process.argv.slice(2),engines=['inlined','separate'];
const caseName=command.startsWith('slice-')||caseArg==='slice'?'slice':command.startsWith('phis-')||caseArg==='phis'?'phis':command.startsWith('bounds-')||caseArg==='bounds'?'bounds':command.startsWith('region-')||caseArg==='region'?'region':command.startsWith('array-')||caseArg==='array'?'array':command.startsWith('cold-')||caseArg==='cold'?'cold':command.startsWith('large-')||caseArg==='large'?'large':command.startsWith('stable-')||caseArg==='stable'?'stable':command.startsWith('scope-')||caseArg==='scope'?'scope':'whole';
const count=caseName==='cold'?128:1000000;
const targetName={slice:'scanRegionSlice',phis:'scanRegionPhis',bounds:'scanRegionBounds',region:'scanRegion',array:'scanArrayPairs',whole:'scan',scope:'scanScoped',stable:'scanStable',large:'scanStable',cold:'scanStable'}[caseName];
const receiverTokenExperiment=command.startsWith('stable-token-');
const requestedEngine=['direct','merged','trusted','paired','separate','plain','eager','lazy'].find(value=>command.includes('-'+value+'-'));
assert.match(revision||'',/^[0-9a-f]{40}$/,'Use an exact changed-source JVM commit');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const regionExpression=Array.from({length:16}).reduce(expression=>'('+expression+'*0.75f+0.125f)','regionSource[k+OFFSET]');
const regionTerms=[0,256,512,768].map(offset=>'regionTarget[k+'+offset+']='+regionExpression.replaceAll('OFFSET',offset)+';').join('');
const boundsExpression=Array.from({length:4}).reduce(expression=>'('+expression+'*0.75f+0.125f)','regionSource[k+OFFSET]');
const boundsLane=offset=>boundsExpression.replaceAll('OFFSET',offset);
const boundsTerms=[0,512].map(base=>'regionTarget[k+'+base+']='+boundsLane(base)+'+'+boundsLane(base+256)+';regionTarget[k+'+(base+256)+']='+boundsLane(base)+'-'+boundsLane(base+256)+';').join('');
const ghostCount=caseName==='slice'?8:3;
const ghostDecl=Array.from({length:ghostCount},(_,i)=>'ghost'+i+'=0').join(',');
const ghostRead=Array.from({length:ghostCount},(_,i)=>'ghost'+i+'=regionSource[k'+(i%4?'+'+(i%4*256):'')+'];').join('');
const ghostFill=Array.from({length:ghostCount},(_,i)=>'ghost'+i+'='+(i+1)+';').join('');
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
 static int fence;static float[] regionSource,regionTarget;
 static void regionBarrier(){fence++;}
${['phis','slice'].includes(caseName)?` static float[] ${targetName}(int n){regionBarrier();if(n<0)return regionTarget;regionTarget[0]=regionSource[0];regionTarget[256]=regionSource[256];regionTarget[512]=regionSource[512];regionTarget[768]=regionSource[768];float ${ghostDecl};for(int i=0;i<n;i++){int k=i&255;${ghostRead}${boundsTerms}}for(int q=0;q<3;q++){${ghostFill}}fence+=10;return regionTarget;}
`:''} static float[] scanRegionBounds(int n){regionBarrier();if(n<0)return regionTarget;regionTarget[0]=regionSource[0];regionTarget[256]=regionSource[256];regionTarget[512]=regionSource[512];regionTarget[768]=regionSource[768];for(int i=0;i<n;i++){int k=i&255;${boundsTerms}}fence+=10;return regionTarget;}
 static float[] scanRegion(int n){regionBarrier();if(n<0)return regionTarget;regionTarget[0]=regionSource[0];regionTarget[256]=regionSource[256];regionTarget[512]=regionSource[512];regionTarget[768]=regionSource[768];for(int i=0;i<n;i++){int k=i&255;${regionTerms}}fence+=10;return regionTarget;}

 static int identity(int i){return i;}
 static void outside(int i){fence=identity(i);}
 static int scanArrayPairs(NestedLoopBook[] books,int n){int sum=3;for(int i=0;i<n;i++){int[] row=books[i&1].vector();for(int k=0;k<8;k++)sum=sum*33+row[k];}return sum;}
 static int scanStable(NestedLoopBook[] books,int n){NestedLoopBook book=books[0];int sum=3;for(int i=0;i<n;i++){
  int[] row=book.vector();for(int k=0;k<8;k++)sum=sum*33+row[k];}return sum;}
 static int scanScoped(NestedLoopBook[] books,int n){int sum=3;for(int i=0;i<n;i++){
  int[] row=books[0].vector();for(int k=0;k<8;k++)sum=sum*33+row[k];outside(i);}return sum;}
 static int scan(NestedLoopBook book,int n){int sum=3;for(int i=0;i<n;i++){
  int[] row=book.vector();for(int k=0;k<8;k++)sum=sum*33+row[k];}return sum;}
}`;

// This bound changes only temporary compiler graph views after normal code
// emission, restores every map, and never runs the filtered graph as code.
function nestedLivenessBound(c,numeric,analyze){
 const fn=c.fn,saved=[],graphs=new Map(),stats={maps:0,slotsBefore:0,slotsAfter:0,unknownContexts:0};
 const methodLive=method=>{if(!graphs.has(method)){const code=method.attributes?.find(a=>a.type==='code')?.code;graphs.set(method,analyze(code));}return graphs.get(method);};
 const needed=(item,slot)=>{
  const activation=c.inlineActivations?.get(item);
  if(activation){
   const chain=[];for(let level=activation;level;level=level.parent)chain.unshift(level);
   if(slot<c.callerLocals){const live=methodLive(c.method);return !live||live.has(chain[0].call,slot);}
   const at=chain.findIndex(level=>slot>=level.base&&slot<level.base+level.localsSize);
   if(at<0)return false;
   const level=chain[at],live=methodLive(level.method),pc=at+1<chain.length?chain[at+1].call:level.item;
   return !live||live.has(pc,slot-level.base)||live.has(pc+1,slot-level.base);
  }
  const original=c.origIdx?c.origIdx[item]:item;
  if(!Number.isInteger(original)||original<0){stats.unknownContexts++;return true;}
  if(slot>=c.callerLocals)return true; // unknown splice/retry private operands
  const live=methodLive(c.method);return !live||live.has(original,slot)||live.has(original+1,slot);
 };
 const allocation=()=>{
  const stackified=numeric.prepare(fn),locals=new Map(fn.params.map((v,i)=>[v,i])),byKind={I:0,J:0,F:0,D:0,A:0};let next=fn.params.length;
  const allocate=value=>{if(!locals.has(value)){locals.set(value,next++);byKind[value.kind]++;}return locals.get(value);};
  const reused=numeric.assignLocals(fn,stackified,locals,allocate);
  return {locals:next-fn.params.length,numeric:byKind.I+byKind.J+byKind.F+byKind.D,references:byKind.A,stackified:stackified.size,reused};
 };
 const filter=(object,key,test)=>{const map=object[key];if(!map)return;const next=new Map([...map].filter(([slot])=>test(slot)));
  stats.maps++;stats.slotsBefore+=map.size;stats.slotsAfter+=next.size;saved.push([object,key,map]);object[key]=next;};
 const strict=allocation();let filtered;
 try{
  for(const block of fn.blocks){
   const head=c.cfg.blocks[block.id].insns[0];filter(block,'slotDefsIn',slot=>needed(head,slot));
   const successors=c.cfg.succ[block.id];filter(block,'slotDefsOut',slot=>successors.some(id=>needed(c.cfg.blocks[id].insns[0],slot)));
   for(const node of [...block.body,block.term])if(node)filter(node,'slotState',slot=>needed(node.itemIdx,slot));
  }
  filtered=allocation();
 }finally{for(const [object,key,map]of saved)object[key]=map;}
 return {key:c.className+'.'+c.method.name+c.method.descriptor,strict,filtered,reduction:strict.locals-filtered.locals,...stats,
  originalLivenessMethods:graphs.size,supportedLiveness:[...graphs.values()].filter(Boolean).length,
  note:'Nested/root original liveness bound only; operand prefixes retained, exception-aware liveness; unknown private splice/retry states kept. No safety proof or execution of trimmed snapshots.'};
}

if(command==='one'||command==='code-one'||command==='liveness-one'){
 assert.ok(engines.includes(engine)||['token','tokenControl','slice','sliceControl','phis','phisControl','bounds','boundsControl','region','regionControl','direct','merged','trusted','paired','query','plain','eager','lazy'].includes(engine));assert.ok(flags.every(flag=>process.execArgv.includes(flag)));
 if(engine==='plain')assert.equal(caseName,'large','Plain matrix is only the new large-container control');
 let regionAnalyzer,regionAnalysis;const instrumented=detail==='stats';let Frame,model,allocMultiArray,allocReferenceArray,referenceStorage,takeWasmReturnValue,numeric,frameLive,emission,installed=false;const bounds=[],versions=new WeakMap(),directImports=new WeakMap();
 const {JVM}=await loadArchivedJvm(root,revision,{preloadModules:command==='liveness-one'?['src/jit/stackifyNumericValues.js','src/analysis/frameLocalLiveness.js']:caseName==='cold'?['src/core/nativeObjectStorage.js']:[],observeModule:({filename,exports})=>{
  if(filename.endsWith('/src/core/nativeObjectStorage.js'))referenceStorage=exports;
  if(filename.endsWith('/src/jit/stackifyNumericValues.js'))numeric=exports;
  if(filename.endsWith('/src/analysis/frameLocalLiveness.js'))frameLive=exports.frameLocalLiveness;
  if(command==='liveness-one'&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
   const translate=exports.prototype.translateBody;
   exports.prototype.translateBody=function(...args){const value=translate.apply(this,args);
    if(value?.bytes&&this.className==='NestedLoopProbe'&&this.method.name===targetName)bounds.push(nestedLivenessBound(this,numeric,frameLive));return value;};
  }
  if(['direct','merged'].includes(engine)&&filename.endsWith('/src/jit/CanonicalDirectFrames.js')){
   const proto=exports.CanonicalDirectLinks.prototype;
   for(const name of ['publish','withdraw','release']){const original=proto[name];proto[name]=function(...args){const value=original.apply(this,args);
    const live=[];for(const record of versions.get(this)||[]){const cell=record.version.deref(),target=record.target.deref();
     if(!cell||!target)continue;if(this.table.get(record.slot)!==target)cell.value=-1;live.push(record);}
    versions.set(this,live);return value;};}
  }
  if(['direct','merged'].includes(engine)&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
   const original=exports.prototype.emitCanonicalInvoke;
   assert.equal(typeof original,'function','Source lacks the generic canonical emission boundary');
   exports.prototype.emitCanonicalInvoke=function(node,call,out){
    if(this.className!=='NestedLoopProbe'||this.method.name!==targetName||node.imm?.[1]!=='NestedLoopBook'||node.imm?.[2]?.[0]!=='vector')return original.call(this,node,call,out);
    const {T,OP,uleb,sleb}=emission,links=this.wasmJit.canonicalDirectLinks,binding=links.bySlot.get(call.slot);
    let imports=directImports.get(this);if(!imports){imports=new Map();directImports.set(this,imports);}let record=imports.get(call.slot);
    if(!record){
     const target=links.table.get(call.slot);assert.ok(target&&target!==binding.stub,'Snapshot target is not published');
     const signature=this.sigTypes[call.type-(this.objNativeOps?2:0)],index=this.addImport('snapshot_target_'+call.slot,signature.params,signature.results,target,true);
     const cell=new WebAssembly.Global({value:'i32',mutable:true},0),global=this.globalImportDecls.length,name='snapshot_version_'+call.slot;
     this.globalImportDecls.push({name,type:T.i32,mutable:true});this.importedGlobals[name]=cell;
     record={index,global,selected:this.nextLocal++};this.declared.push(T.i32);imports.set(call.slot,record);
     const live=versions.get(links)||[];live.push({slot:call.slot,version:new WeakRef(cell),target:new WeakRef(target)});versions.set(links,live);
    }
    // Arguments remain on stack. Preserve the original selected dispatch slot;
    // either version or dispatch mismatch takes exactly its existing table arm.
    out.push(OP.local_tee,...uleb(record.selected),OP.i32_const,...sleb(call.slot),OP.i32_eq,
     OP.global_get,...uleb(record.global),OP.i32_const,0,OP.i32_eq,OP.i32_and,
     OP.if,...sleb(call.type),OP.call,...uleb(record.index),OP.else,
     OP.local_get,...uleb(record.selected),OP.call_indirect,...uleb(call.type),0,OP.end);
   };
  }
  if(engine==='trusted'&&filename.endsWith('/src/jit/nativeStaticArrayBody.js')){
   const entry=exports.entry;let identity;
   exports.entry=function(c,out){
    if(c.className!=='NestedLoopBook'||c.method.name!=='vector')return entry(c,out);
    const receiver=c.fn.params[0],cache=c.objCacheFor(receiver),{T,OP,uleb,assembleModule}=emission;
    assert.ok(c.parameterObjectABI.includes(0)&&cache.typedIncoming,'Trusted-shape bound requires typed paired transport');
    identity||=new WebAssembly.Instance(new WebAssembly.Module(assembleModule({importDecls:[],mainParams:[T.ref],mainResults:[T.ref],declared:[],body:[OP.local_get,0,OP.end]}))).exports.run;
    const use=c.useOf,add=c.addImport;
    c.useOf=function(value){return value===receiver?[OP.local_get,...uleb(cache.typedStore),0xfb,0x1b]:use.call(this,value);};
    c.addImport=function(name,params,results,fn,pure){return name==='native_state_object_storage'?
     add.call(this,'trusted_storage_identity',params,results,identity,true):add.call(this,name,params,results,fn,pure);};
    try{return entry(c,out);}finally{c.useOf=use;c.addImport=add;}
   };
  }
  if(['phis','slice'].includes(caseName)&&filename.endsWith('/src/jit/nativeNumericKernelPlan.js'))regionAnalyzer=exports.analyzeRegions;
  if(['phis','slice'].includes(caseName)&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
   const translate=exports.prototype.translateBody;exports.prototype.translateBody=function(...args){const meta=translate.apply(this,args);
    if(this.className==='NestedLoopProbe'&&this.method.name===targetName){const bound=regionAnalyzer(this);regionAnalysis={reason:bound.reason,regions:bound.regions.map(r=>({reason:r.reason,plans:r.plans.map(p=>({header:p.header,refused:p.refused,inputs:p.inputCount,normal:p.normalReturnCount,faults:p.faults.length}))}))};}
    return meta;
   };
  }
  if(engine==='tokenControl'&&filename.endsWith('/src/jit/nativeReceiverEntry.js')){const prepare=exports.prepareCall;exports.prepareCall=(c,node,...args)=>c.className==='NestedLoopProbe'&&c.method.name===targetName?null:prepare(c,node,...args);}
  if(caseName==='slice'&&engine==='sliceControl'&&filename.endsWith('/src/jit/nativeKernelSlice.js')){const analyze=exports.analyze;exports.analyze=(c,p,...args)=>c.className==='NestedLoopProbe'&&c.method.name===targetName?{reason:'new-case conservative numeric input tuple',work:0,active:[],inputs:p.numericInputs.map(v=>v.id),omitted:[]}:analyze(c,p,...args);}
  if(caseName==='phis'&&engine==='phisControl'&&filename.endsWith('/src/jit/nativeKernelBoundary.js')){
   const prepare=exports.prepare;exports.prepare=function(c,plans,...args){const index=prepare(c,plans,...args);
    if(c.className==='NestedLoopProbe'&&c.method.name===targetName&&!index.reason)for(const block of c.fn.blocks)if(c.fn.reachable.has(block.id))for(const phi of block.phis||[])for(const arg of phi.args){
     if(!index.consumers.has(arg.id))index.consumers.set(arg.id,new Set());index.consumers.get(arg.id).add(block.id);
    }
    return index;
   };
  }
  if(caseName==='bounds'&&engine==='boundsControl'&&filename.endsWith('/src/jit/nativeKernelBounds.js'))exports.analyze=()=>({elisions:new Map(),reason:'fixture withholds only new bounds proof',work:0});
  if(caseName==='region'&&engine==='regionControl'&&filename.endsWith('/src/jit/nativeRegionKernel.js')){const prepare=exports.prepare;exports.prepare=(c,structured)=>c.className==='NestedLoopProbe'&&c.method.name==='scanRegion'?new Map():prepare(c,structured);}
  if(caseName==='array'&&engine==='query'&&filename.endsWith('/src/jit/pairedNativeStorage.js'))exports.prepareArrayReceivers=()=>new Map();
  if(filename.endsWith('/src/core/frame.js'))Frame=exports;
  if(filename.endsWith('/src/core/objectModel.js'))model=exports;
  if(filename.endsWith('/src/instructions/object.js')){allocMultiArray=exports.allocMultiArray;allocReferenceArray=exports.allocReferenceArray;}
  if(filename.endsWith('/src/jit/wasmShared.js')){takeWasmReturnValue=exports.takeWasmReturnValue;emission=exports;}
  if((engine==='separate'||['token','tokenControl','slice','sliceControl','phis','phisControl','bounds','boundsControl','region','regionControl','direct','merged','trusted','paired','query','plain'].includes(engine))&&filename.endsWith('/src/jit/wasmInline.js')){
   const inline=exports.inlineCalls;
   exports.inlineCalls=function(jvm,code,options){
    if(options.callerClassName==='NestedLoopProbe'&&options.callerMethod?.name===targetName)return null;
    return inline(jvm,code,options);
   };installed=true;
  }
 }});
 if(engine==='separate'||['token','tokenControl','slice','sliceControl','phis','phisControl','bounds','boundsControl','region','regionControl','direct','merged','trusted','paired','query','plain'].includes(engine))assert.ok(installed,'Separate-call experiment missed the outer transform');
 const j=new JVM({classpath:[directory],wasmHeap:true,wasmFields:true,wasmHeapMb:32,
  jit:{enabled:false,compileWorker:false,retainCompilerDiagnostics:false,wasmStructured:true,
   wasm:{deepInline:false,canonicalDirectCalls:true,canonicalEhLinks:true,nativeJsExceptionTags:true}}});
 if(command==='code-one'||command==='liveness-one'||caseName==='cold'){j.executeTick=()=>{throw Error('Inspection attempted a guest tick');};j.executeInstruction=()=>{throw Error('Inspection attempted a guest instruction');};}
 await j.preloadClasspathClasses();for(const name of ['NestedLoopBits','NestedLoopBook','NestedLoopProbe'])j._markClassInitialized(name);
 const w=j.jit.wasmJit;w.enabled=true;w.importStatsEnabled=instrumented;
 if(caseName==='cold'){
  assert.ok(['eager','lazy'].includes(engine));
  assert.equal(typeof referenceStorage.peekNativeReferenceArrayStorageOf,'function','Cold case requires the changed lazy-mirror source');
  const marker=model.makeObjectRef(j,'NestedLoopBook',model.newFields(j,'NestedLoopBook'));
  const memory=j.wasmHeap.memory,ops=referenceStorage.getNativeObjectStorageOps(),arrays=[],length=1024,touched=16;
  const before=j.wasmHeap.top,start=process.hrtime.bigint();
  for(let i=0;i<count;i++){
   const a=allocReferenceArray(j,'NestedLoopBook',length);arrays.push(a);
   if(engine==='eager')referenceStorage.nativeObjectStorageOf(a,memory);
   for(let k=0;k<length;k++)a[k]=marker;
  }
  let checksum=0;
  for(let i=0;i<touched;i++){
   const store=referenceStorage.nativeObjectStorageOf(arrays[i*8],memory);
   if(store&&ops.reference(store,length-1)===marker)checksum++;
  }
  const elapsedMs=Number(process.hrtime.bigint()-start)/1e6;
  const built=arrays.filter(a=>referenceStorage.peekNativeReferenceArrayStorageOf(a,memory)).length;
  assert.equal(checksum,touched);assert.equal(built,engine==='eager'?count:touched);
  const allocated=j.wasmHeap.top-before;assert.equal(allocated,built*(8+length*8));
  assert.equal(w.compiled.length,0,'Cold allocator case compiled guest code');
  console.log('NESTED_LOOP_RESULT '+JSON.stringify({sourceRevision:revision,caseName,engine,instrumented,count,length,touched,checksum,elapsedMs,
   builtMirrors:built,allocatedCapabilityBytes:allocated,compiledGuestMethods:0,guestInstructions:0,
   sourceSha256:hash(source),harnessSha256:hash(fs.readFileSync(script)),node:process.version,execArgv:process.execArgv,
   control:'New allocation/fill/first-use case within the same changed runtime. Eager mode requests each mirror before filling; demand mode touches only sixteen arrays. No known JVM/TeaVM/HotSpot baseline executes.',
   scope:'Runtime allocation APIs, one cold pass with every Java array retained alive; not original loading, Java instruction timing, CPU attribution or TeaVM parity'}));
  process.exit(0);
 }
 const build=(owner,name,descriptor)=>{const method=j.findMethod(j.classes[owner],name,descriptor),state=w.methodState({method});
  w.compile({method,className:owner},state,{asCallee:true});assert.equal(state.status,'ready',state.lastCompileError||owner+'.'+name);return state;};
 if(caseName==='slice'||caseName==='phis'||caseName==='region'||caseName==='bounds'){
  build('NestedLoopProbe','regionBarrier','()V');const target=build('NestedLoopProbe',targetName,'(I)[F');
  assert.equal(target.meta.nativeRegionKernelCount||0,caseName==='bounds'||engine==='slice'||engine==='phis'||engine==='region'?1:0,'Selected regional transform was not installed/withheld '+JSON.stringify(regionAnalysis));
  assert.ok(target.meta.nativeStaticArrayRegions.length,'Original region ownership guard was lost');
  const input=j.wasmHeap.alloc('[F',1024),output=j.wasmHeap.alloc('[F',1024);input.type=output.type='[F';
  const expected=new Float32Array(1024);for(let i=0;i<1024;i++){input[i]=((i*17)%257-128)/256;let value=input[i];for(let k=0;k<(['slice','bounds','phis'].includes(caseName)?4:16);k++)value=Math.fround(Math.fround(value*0.75)+0.125);expected[i]=value;}
  if(['slice','bounds','phis'].includes(caseName)){const values=expected.slice();for(let i=0;i<256;i++)for(const base of [0,512]){expected[i+base]=Math.fround(values[i+base]+values[i+base+256]);expected[i+base+256]=Math.fround(values[i+base]-values[i+base+256]);}if(caseName==='bounds')assert.equal(target.meta.nativeRegionKernelBoundsElisions||0,engine==='bounds'?4:0,'Bounds proof was not installed/withheld');}
  const fields=j.classes.NestedLoopProbe.staticFields;fields.set('fence:I',0);fields.set('regionSource:[F',input);fields.set('regionTarget:[F',output);
  const frame=new Frame(target.method);frame.className='NestedLoopProbe';frame.locals[0]=count;target.meta.box.frame=frame;
  w.freezeCompilation();j.jit._syncCompileEnvironment={trace:false,assert:true};j.jit.markMainStarted();
  const start=process.hrtime.bigint();let status,value;
  try{status=target.run(count,0,1000000000);value=status===-1?takeWasmReturnValue(target.meta):undefined;}finally{target.meta.box.frame=null;}
  const elapsedMs=Number(process.hrtime.bigint()-start)/1e6;
  assert.equal(status,-1);assert.equal(value,output);assert.equal(fields.get('fence:I'),11);assert.deepEqual([...output],[...expected]);
  assert.equal(j.jit.syncCompileCensus().postMainSyncCompileCount,0);assert.equal(target.meta.directFrameContext.exitCount,0);
  let checksum=0;for(const word of new Uint32Array(output.buffer,output.byteOffset,1024))checksum=(Math.imul(checksum,33)+word)|0;
  console.log('NESTED_LOOP_RESULT '+JSON.stringify({sourceRevision:revision,caseName,engine,instrumented,count,checksum,elapsedMs,
   nativeRegionKernelBoundsElisions:target.meta.nativeRegionKernelBoundsElisions||0,nativeRegionKernelCount:target.meta.nativeRegionKernelCount||0,nativeRegionKernelInputOmissions:target.meta.nativeRegionKernelInputOmissions||0,nativeRegionKernelBytes:target.meta.nativeRegionKernelBytes||0,
   regionAnalysis,nativeRegionKernelRemovedBlocks:target.meta.nativeRegionKernelRemovedBlocks||0,nativeExits:target.meta.directFrameContext.exitCount,lateJavaCompiles:0,
   regionGuards:target.meta.nativeStaticArrayRegions.length,sourceSha256:hash(source),classSha256:hash(fs.readFileSync(path.join(directory,'NestedLoopProbe.class'))),
   harnessSha256:hash(fs.readFileSync(script)),node:process.version,execArgv:process.execArgv,
   control:caseName==='slice'?'New wide-input loop: same changed backend; control withholds only helper-local slicing, keeping conservative input admission. No known baseline executes.':caseName==='phis'?'New dead-phi boundary case on the same changed runtime; control conservatively retains all parallel-copy obligations, withholding only the demand proof. No previously measured baseline executes.':caseName==='bounds'?'Same changed source/new repeated-index graph; both use the numeric worker, control withholds only its compile-time bounds proof.':'Same changed source and new substantial floating array-region graph; control withholds only its numeric worker, preserving owned-region guards and native fallback body.',
   scope:'One AOT invocation, no warmup or known baseline/oracle execution; not original loading or TeaVM parity'}));process.exit(0);
 }
 build('NestedLoopBook','scalar','()I');const vector=build('NestedLoopBook','vector','()[I');
 if(caseName==='scope'){build('NestedLoopProbe','identity','(I)I');build('NestedLoopProbe','outside','(I)V');}
 const target=build('NestedLoopProbe',targetName,caseName!=='whole'?'([LNestedLoopBook;I)I':'(LNestedLoopBook;I)I');
 assert.equal(target.meta.inlineActivationDepth||0,engine==='inlined'?2:0,'Unexpected compiled call shape');
 assert.ok(target.meta.normalFlowFullyCompiled,'Reduction lost full normal flow');
 if(engine==='merged'){
  // Controlled two-method linking experiment. Keep every original instruction,
  // owner, metadata import, version guard and table fallback. Only the direct
  // import's module boundary changes. Scratch binaries are removed before run.
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'nested-module-merge-'));
  try{
   const rootTree=parseWat(execFileSync('wasm-dis',['--all-features','-'],{input:target.meta.bytes,encoding:'utf8',maxBuffer:4*1024*1024}));
   const childTree=parseWat(execFileSync('wasm-dis',['--all-features','-'],{input:vector.meta.bytes,encoding:'utf8',maxBuffer:4*1024*1024}));
   const rootEnv=target.meta.importObject.env,childEnv=vector.meta.importObject.env;
   for(const node of childTree){
    if(node?.[0]==='import'&&node[3]?.[0]!=='memory')node[1]=JSON.stringify('vectorEnv');
    if(node?.[0]==='export')node[1]=JSON.stringify('vector__'+JSON.parse(node[1]));
   }
   let linked=0;
   for(const node of rootTree){
    if(node?.[0]!=='import'||node[3]?.[0]==='memory')continue;
    const name=JSON.parse(node[2]);
    if(name.startsWith('snapshot_target_')){
     const slot=Number(name.slice('snapshot_target_'.length)),fn=(versions.get(w.canonicalDirectLinks)||[]).find(record=>record.slot===slot)?.target.deref();
     const entry=Object.entries(vector.meta).find(([key,value])=>key.startsWith('canonical')&&value===fn);
     assert.ok(entry,'Cannot identify the exact vector export');node[1]=JSON.stringify('vector');node[2]=JSON.stringify('vector__'+entry[0]);linked++;
    }else node[1]=JSON.stringify('rootEnv');
   }
   assert.equal(linked,1,'Unexpected merge boundary count');
   const rootWat=path.join(temporary,'root.wat'),childWat=path.join(temporary,'vector.wat'),rootWasm=path.join(temporary,'root.wasm'),childWasm=path.join(temporary,'vector.wasm'),merged=path.join(temporary,'merged.wasm');
   fs.writeFileSync(rootWat,printWat(rootTree));fs.writeFileSync(childWat,printWat(childTree));
   execFileSync('wasm-as',[rootWat,'--all-features','--disable-compact-imports','-g','-o',rootWasm]);execFileSync('wasm-as',[childWat,'--all-features','--disable-compact-imports','-g','-o',childWasm]);
   execFileSync('wasm-merge',[rootWasm,'root',childWasm,'vector','--all-features','--disable-compact-imports','-g','-o',merged]);
   const bytes=fs.readFileSync(merged),module=new WebAssembly.Module(bytes);
   const instance=new WebAssembly.Instance(module,{env:{mem:j.wasmHeap.memory},rootEnv,vectorEnv:childEnv});
   assert.ok(instance.exports.run,'Missing merged root export');
   target.meta.bytes=bytes;target.run=instance.exports.run;target.meta.retv=instance.exports.retv||null;
   target.meta.canonicalEntries=instance.exports.canonicalEntries||null;
   vector.meta.canonicalEntries=instance.exports.vector__canonicalEntries||null;
   if(instance.exports.canonicalOwner)instance.exports.canonicalOwner.value=target.meta.directFrameContext;
   if(instance.exports.vector__canonicalOwner)instance.exports.vector__canonicalOwner.value=vector.meta.directFrameContext;
  }finally{fs.rmSync(temporary,{recursive:true,force:true});}
 }
 if(command==='liveness-one'){
  assert.ok(bounds.length,'No nested graph captured');
  console.log('NESTED_LIVENESS_RESULT '+JSON.stringify({sourceRevision:revision,caseName,engine,bounds,harnessSha256:hash(fs.readFileSync(script)),guestInstructions:0,
   scope:'New nested-frame snapshot allocation question only; no workload, oracle, timer, native-code/control identity replay or execution of filtered code'}));process.exit(0);
 }
 if(command==='code-one'){
  const rows=[];
  for(const [name,state]of detail==='vector-code'?[['vector',vector]]:[['root',target],['vector',vector]]){
   const codeBytes=engine==='merged'?target.meta.bytes:state.meta.bytes;
   const wat=execFileSync('wasm-dis',['--all-features','-'],{input:codeBytes,encoding:'utf8',maxBuffer:4*1024*1024});
   const module=parseWat(wat),core=module.find(node=>node?.[0]==='func'&&node[1]?.startsWith('$jvm$wasm$')&&node[1].includes(name==='root'?'NestedLoopProbe':'NestedLoopBook'));
   assert.ok(core,'Missing generated core function');
   const starts=[...wat.matchAll(/^ \(func (\$[^\s(]+)/gm)],ordinal=starts.findIndex(match=>match[1]===core[1]);assert.ok(ordinal>=0);
   const index=(wat.match(/^ \(import [^\n]*\(func /gm)||[]).length+ordinal;
   const native=execFileSync(process.execPath,[...flags,'--trace-wasm-inlining','--print-wasm-code-function-index='+index,'-e',
    "new WebAssembly.Module(require('node:fs').readFileSync(0))"],{input:codeBytes,encoding:'utf8',maxBuffer:8*1024*1024});
   assert.match(native,/compiler: TurboFan/,'Expected eager optimizing native compilation');
   const body=native.slice(native.indexOf('Instructions (size'),native.indexOf('\nSource positions:'));
   const ops={};const walk=node=>{if(!Array.isArray(node))return;if(typeof node[0]==='string')ops[node[0]]=(ops[node[0]]||0)+1;for(const child of node)walk(child);};walk(core);
   rows.push({name,key:state.key,wasmBytes:codeBytes.length,wasmLocals:core.filter(node=>node?.[0]==='local').length,
    instructionBytes:Number(native.match(/Instructions \(size = (\d+)\)/)?.[1]),
    stackReservations:[...body.matchAll(/^0x[^\n]*\bsubq? rsp,[^\n]*/gm)].map(match=>match[0]),
    stackAddressSites:(body.match(/\[(?:r|e)[bs]p[^\]]*\]/g)||[]).length,
    nativeCallSites:(body.match(/^0x[^\n]*\bcall\b/gm)||[]).length,
    inlining:native.split('\n').filter(line=>line.includes('function '+index+':')&&/candidate|inlining/.test(line)).slice(0,16),
    branches:ops.if||0,loops:ops.loop||0,loads:ops['i32.load']||0,stores:ops['i32.store']||0,
    inlineActivationDepth:state.meta.inlineActivationDepth||0,nativeStateSites:state.meta.nativeStaticStateBodySites||0,
    nativeNumericKernelCount:state.meta.nativeNumericKernelCount||0,nativeNumericKernelBoundaryOmissions:state.meta.nativeNumericKernelBoundaryOmissions||0,nativeNumericKernelOutcomeCount:state.meta.nativeNumericKernelOutcomeCount||0,nativeNumericKernelDeferredLengths:state.meta.nativeNumericKernelDeferredLengths||0,nativeNumericKernelDeferredScalars:state.meta.nativeNumericKernelDeferredScalars||0,nativeNumericKernelRemovedBlocks:state.meta.nativeNumericKernelRemovedBlocks||0,nativeNumericKernelBytes:state.meta.nativeNumericKernelBytes||0,
    nativeElementReuseSiteCount:state.meta.nativeElementReuseSiteCount||0,nativeElementCaptureCount:state.meta.nativeElementCaptureCount||0});
   if(name==='root'||detail==='vector-code')fs.writeFileSync(path.join(directory,'current.wat'),wat);
   fs.appendFileSync(path.join(directory,'current-native.txt'),'\n'+engine+' '+state.key+'\n'+native);
  }
  console.log('NESTED_CODE_RESULT '+JSON.stringify({sourceRevision:revision,caseName,engine,rows,harnessSha256:hash(fs.readFileSync(script)),guestInstructions:0,
   scope:'Code-generation question only: no Java workload, oracle, timer, CPU attribution or baseline identity replay; native static site counts include cold paths.'}));process.exit(0);
 }
 const tree=[];let leaf=0;
 const node=depth=>{const at=tree.length;tree.push(0);if(!depth)tree[at]=~leaf++;
  else{node(depth-1);const right=node(depth-1);tree[at]=right;}return at;};node(8);
 const input=j.wasmHeap.alloc('[B',count);input.type='[B';for(let i=0;i<count;i++)input[i]=(i*73+17)&255;
 const treeArray=j.wasmHeap.alloc('[I',tree.length);treeArray.type='[I';treeArray.set(tree);
 const matrixLength=caseName==='large'?1024:256;
 const rows=engine==='plain'?Object.assign(new Array(matrixLength),{type:'[[I',elementType:'[I'}):allocMultiArray(j,'[[I',[matrixLength,8]);
 for(let i=0;i<matrixLength;i++){
  if(engine==='plain'){rows[i]=j.wasmHeap.alloc('[I',8);rows[i].type='[I';}
  for(let k=0;k<8;k++)rows[i][k]=(i*17+k*7)&255;
 }
 const book=model.makeObjectRef(j,'NestedLoopBook',model.newFields(j,'NestedLoopBook'));
 model.writeField(book.fields,'NestedLoopBook.tree',treeArray);model.writeField(book.fields,'NestedLoopBook.rows',rows);
 const state=j.classes.NestedLoopBits.staticFields;state.set('bytes:[B',input);state.set('bit:I',0);state.set('cursor:I',0);
 let expected=3;for(let i=0;i<count;i++){
  const byte=(i*73+17)&255;let index=0;for(let bit=0;bit<8;bit++)index=index<<1|byte>>bit&1;
  for(let k=0;k<8;k++)expected=(Math.imul(expected,33)+((index*17+k*7)&255))|0;
 }
 const argument=caseName!=='whole'?allocMultiArray(j,'[LNestedLoopBook;',[caseName==='array'?2:1]):book;if(caseName!=='whole')argument[0]=book;if(caseName==='array')argument[1]=book;
 if(engine==='token'||engine==='tokenControl'){assert.ok(vector.meta.nativeReceiverTokenEntry?.run,'New ABI case lacks the actual callee token contract');assert.equal(target.meta.nativeReceiverTokenCallSites||0,engine==='token'?1:0,'New ABI route was not installed/withheld');}
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
 if(engine==='paired'||engine==='query'){
  assert.equal(target.meta.pairedStorageCallSiteCount,1,'Real protocol lacks a paired call');
  assert.ok(vector.meta.pairedNativeStorage?.run,'Real protocol lacks a callee proof');
  if(instrumented){
   assert.equal(target.meta.importStats.get('paired_object_storage')||0,caseName==='array'?(engine==='paired'?0:count):1,'Receiver pairing does not match the selected proof');
   assert.equal(vector.meta.importStats.get('native_state_object_storage')||0,0,'Callee still calls host validation');
  }
 }
 if(instrumented)assert.equal(vectorEntries,engine==='inlined'?0:count,'Control lost the intended method boundary');
 if(instrumented&&(engine==='token'||engine==='tokenControl')){assert.equal(target.meta.importStats.get('native_receiver_token')||0,engine==='token'?1:0,'Invariant receiver must acquire its token once');assert.equal(vector.meta.importStats.get('native_state_object_storage')||0,engine==='token'?0:count,'Token entry must remove per-call host ownership authentication');}
 if(instrumented&&['stable','large'].includes(caseName))assert.equal(target.meta.importStats.get('native_state_object_storage')||0,engine==='inlined'?1:0,'Stable ownership was not shared across scope entries');
 if(instrumented&&caseName==='large')assert.equal(vector.meta.importStats.get('aget_r')||0,engine==='plain'?count:0,'Large matrix lost its selected native/fallback path');
 console.log('NESTED_LOOP_RESULT '+JSON.stringify({sourceRevision:revision,caseName,engine,instrumented,count,checksum,elapsedMs,harnessSha256:hash(fs.readFileSync(script)),
  matrixLength,matrixKind:engine==='plain'?'supported-plain-fallback':'owned-reference-array',
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
  separateVectorNumericKernelCount:vector.meta.nativeNumericKernelCount||0,
  separateVectorNumericKernelBoundaryOmissions:vector.meta.nativeNumericKernelBoundaryOmissions||0,
  separateVectorNumericKernelOutcomeCount:vector.meta.nativeNumericKernelOutcomeCount||0,
  separateVectorNumericKernelDeferredLengths:vector.meta.nativeNumericKernelDeferredLengths||0,
  separateVectorNumericKernelDeferredScalars:vector.meta.nativeNumericKernelDeferredScalars||0,
  separateVectorNumericKernelRemovedBlocks:vector.meta.nativeNumericKernelRemovedBlocks||0,
  separateVectorNumericKernelBytes:vector.meta.nativeNumericKernelBytes||0,
  separateVectorReferenceReadElisions:vector.meta.nativeArrayReferenceReadElisionCount||0,
  ownershipQueries:instrumented?target.meta.importStats.get('native_body_object_storage')||0:null,
  separateVectorOwnershipQueries:instrumented?vector.meta.importStats.get('native_state_object_storage')||0:null,
  separateVectorRowStorageQueries:instrumented?vector.meta.importStats.get('object_storage')||0:null,
  separateVectorCheckedRowReads:instrumented?vector.meta.importStats.get('aget_r')||0:null,
  nativeArrayReceiverPairSites:target.meta.nativeArrayReceiverPairSites||0,
  pairedStorageCallSites:target.meta.pairedStorageCallSiteCount||0,
  nativeReceiverTokenCallSites:target.meta.nativeReceiverTokenCallSites||0,calleeReceiverTokenEntry:!!vector.meta.nativeReceiverTokenEntry?.run,
  nativeReceiverTokenQueries:instrumented?target.meta.importStats.get('native_receiver_token')||0:null,
  pairedStorageQueries:instrumented?target.meta.importStats.get('paired_object_storage')||0:null,
  pairedStorageEntry:engine==='paired'?'Generic compiler-paired entry, synchronous monotonic storage revocation, ordinary signature/dispatch/entry fallbacks; no ownership-validator override':null,
  trustedEntryCalls:instrumented?vector.meta.importStats.get('trusted_storage_identity')||0:null,
  trustedShapeBound:engine==='trusted'?'Controlled owned fixture only: typed transport replaces entry ownership lookup with a Wasm identity; no general pairing/customization proof or runtime integration':null,
  nativeExits:target.meta.directFrameContext.exitCount,lateJavaCompiles:0,
  node:process.version,execArgv:process.execArgv,
  directImportExperiment:['direct','merged'].includes(engine)?'Per-call version/dispatch checked Wasm import; publication/withdrawal/release revoke snapshots; table fallback and original ABI remain active; fixture-only integration':null,
  control:(engine==='token'||engine==='tokenControl')?'New private receiver ABI comparison: same changed runtime and fixed Java graph; control withholds only the root token call route. No known JVM/TeaVM/HotSpot baseline executes.':caseName==='large'?'New large-container reduction: same changed runtime and Java methods, owned matrix versus supported plain matrix fallback; no known baseline executes':engine==='separate'?'Withhold only the root inline transform; same changed runtime and new Java workload':null,
  scope:'Bounded '+caseName+' code-generation reduction with identical high invocation fuel; not production scheduling, original loading, TeaVM parity or an existing baseline validation'}));
 process.exit(0);
}

assert.ok(['stable-token-diagnose','stable-token-inspect','stable-token-run','stable-token-candidate','slice-diagnose','slice-run','phis-inspect','phis-candidate','phis-diagnose','phis-run','bounds-inspect','bounds-candidate','bounds-diagnose','bounds-run','region-diagnose','region-run','array-diagnose','array-run','diagnose','run','candidate','scope-diagnose','scope-run','scope-candidate','stable-diagnose','stable-run','stable-candidate','inspect','scope-inspect','stable-inspect','code','scope-code','stable-code','liveness','scope-liveness','stable-liveness','stable-direct-code','stable-direct-inspect','stable-direct-candidate','stable-merged-code','stable-merged-inspect','stable-merged-candidate','stable-trusted-code','stable-trusted-inspect','stable-trusted-candidate','stable-paired-code','stable-paired-inspect','stable-paired-candidate','stable-separate-code','stable-separate-vector-code','stable-separate-inspect','stable-separate-candidate','large-separate-inspect','large-separate-candidate','large-plain-inspect','large-plain-candidate','large-run','cold-eager-inspect','cold-lazy-inspect','cold-run'].includes(command),'Usage: nested-loop.mjs diagnose|run|candidate|scope-diagnose|scope-run|scope-candidate EXACT_CHANGED_REVISION');
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
if(command.endsWith('liveness')){
 if(result.livenessBound)console.log('Reuse saved nested liveness bound');
 else{
  const row=parseMeasurementResult(execFileSync(process.execPath,[...flags,script,'liveness-one',revision,'inlined','code',caseName],
   {encoding:'utf8',maxBuffer:1024*1024}),'NESTED_LIVENESS_RESULT ');result.livenessBound=row;save();console.log(JSON.stringify(row));
 }
}else if(command.endsWith('code')){
 fs.writeFileSync(path.join(directory,'current-native.txt'),'');
 result.codeOutputs||=[];
 for(const variant of requestedEngine?[requestedEngine]:engines){
  const row=parseMeasurementResult(execFileSync(process.execPath,[...flags,script,'code-one',revision,variant,command.endsWith('-vector-code')?'vector-code':'code',caseName],
   {encoding:'utf8',maxBuffer:1024*1024}),'NESTED_CODE_RESULT ');result.codeOutputs=result.codeOutputs.filter(previous=>previous.engine!==variant);result.codeOutputs.push(row);save();console.log(JSON.stringify(row));
 }
}else if(command.endsWith('diagnose')||command.endsWith('inspect'))for(const variant of receiverTokenExperiment?(command.endsWith('inspect')?['token']:['token','tokenControl']):requestedEngine?[requestedEngine]:caseName==='slice'?['slice','sliceControl']:command==='phis-inspect'?['phis']:caseName==='phis'?['phis','phisControl']:command==='bounds-inspect'?['bounds']:caseName==='bounds'?['bounds','boundsControl']:caseName==='region'?['region','regionControl']:caseName==='array'?['paired','query']:command.endsWith('inspect')?['inlined']:engines){
 if(result.diagnostics.some(row=>row.engine===variant)){console.log('reuse saved '+variant+' diagnostic');continue;}
 const row=one(variant,true);result.diagnostics.push(row);save();console.log(JSON.stringify(row));
}
else{
 if(receiverTokenExperiment){const proved=result.diagnostics.find(row=>row.engine==='token');assert.ok(proved?.calleeReceiverTokenEntry&&proved.nativeReceiverTokenCallSites===1&&proved.nativeReceiverTokenQueries===1&&proved.separateVectorOwnershipQueries===0,'Inspect the new token route before timing');if(!command.endsWith('candidate')){const control=result.diagnostics.find(row=>row.engine==='tokenControl');assert.ok(control&&control.nativeReceiverTokenCallSites===0&&control.separateVectorOwnershipQueries===count,'New ABI control must exercise the different entry route');}}
 if(caseName==='slice'){const proved=result.diagnostics.find(row=>row.engine==='slice'),control=result.diagnostics.find(row=>row.engine==='sliceControl');assert.ok(proved&&control,'Run slice-diagnose before timing the new wide-input case');assert.ok(proved.nativeRegionKernelInputOmissions>=8&&proved.nativeRegionKernelCount===1&&control.nativeRegionKernelCount===0,'New case must exercise changed input admission');}
 if(caseName==='phis'){
  const proved=result.diagnostics.find(row=>row.engine==='phis'),control=result.diagnostics.find(row=>row.engine==='phisControl');
  assert.ok(proved,'Inspect the changed phis candidate before timing');
  assert.equal(proved.nativeRegionKernelCount,1,'Changed proof must install the intended worker');
  if(command==='phis-candidate')assert.ok(proved.nativeRegionKernelInputOmissions>=3,'Candidate must actually exercise the changed numeric input slice');
  else{assert.ok(control,'Run phis-diagnose for a genuinely new paired case');assert.equal(control.nativeRegionKernelCount,0,'Conservative new-case control must exercise a different boundary');}
 }
 const measuredEngines=receiverTokenExperiment?(command.endsWith('candidate')?['token']:['token','tokenControl']):requestedEngine?[requestedEngine]:caseName==='slice'?['slice','sliceControl']:command==='phis-candidate'?['phis']:caseName==='phis'?['phis','phisControl']:command==='bounds-candidate'?['bounds']:caseName==='bounds'?['bounds','boundsControl']:caseName==='region'?['region','regionControl']:caseName==='array'?['paired','query']:caseName==='cold'?['eager','lazy']:caseName==='large'?['separate','plain']:command.endsWith('candidate')?['inlined']:engines;
 result.timingMode=measuredEngines.length===1?'Changed candidate only; reuse saved controls':'Paired new-workload control';
 for(let pair=0;pair<3;pair++)for(const variant of pair===1?measuredEngines.toReversed():measuredEngines){
  if(result.runs.some(row=>row.engine===variant&&row.pair===pair)){console.log('reuse saved pair '+pair+' '+variant);continue;}
  const row=one(variant,false);result.runs.push({...row,pair,measuredAt:new Date().toISOString()});save();
  console.log('pair '+(pair+1)+' '+variant+': '+row.elapsedMs.toFixed(6)+' ms');
 }
 result.completed=true;save();
}
