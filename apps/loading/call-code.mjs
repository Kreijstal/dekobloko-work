#!/usr/bin/env node
// Compile-only call-shape comparison. No Java main/class initializer or TeaVM
// export executes; timings/fingerprints of known controls are not collected.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadArchivedJvm} from './archive-jvm.mjs';
import {parseWat} from './wasm-loop-outline.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const player=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading');
const directory=path.join(player,'microbench'),reportPath=path.join(player,'benchmark.json');
const flags=['--max-old-space-size=1024','--no-liftoff','--no-wasm-lazy-compilation'];
const revision=process.argv[2];assert.match(revision||'',/^[0-9a-f]{40}$/,'Use an exact archived JVM revision');
const family=process.argv[3]||'boolean';assert.ok(['boolean','reader','original-reader','music-reader','packet','archive','packet-flow','ssa-liveness','archive-proof','archive-exit'].includes(family));
const entryVariant=process.argv[4]||'ordinary';assert.ok(['ordinary','closed'].includes(entryVariant));
if(entryVariant==='closed')assert.ok(['original-reader','music-reader'].includes(family),'Inspect a proved native reader export');
assert.ok(flags.every(flag=>process.execArgv.includes(flag)),'Run this preparation with the documented eager/heap flags');
const receipt=JSON.parse(fs.readFileSync(reportPath)),options=structuredClone(receipt.diagnosticOptions);
const flowOnly=['packet-flow','ssa-liveness'].includes(family),directMusic=family==='music-reader',fullGraph=['packet','archive','archive-proof','archive-exit'].includes(family),mainClass=fullGraph?'GeobloxLoading':'LoadingMicroKernel';
options.classpath=[path.join(fullGraph||directMusic||flowOnly?player:directory,'classes')];options.jit.compileWorker=false;
options.jit.preparationPolicy={entryMethods:[mainClass+'.main([Ljava/lang/String;)V']};
let buildSsa,buildCfg,frameLiveness,numericLocals;const proofCensus=[],translationFailures=[];
const {JVM}=await loadArchivedJvm(path.resolve(here,'../../../java-tools'),revision,{preloadModules:family==='ssa-liveness'?['src/analysis/frameLocalLiveness.js','src/jit/stackifyNumericValues.js']:[],observeModule:({filename,exports})=>{
 if(filename.endsWith('/src/analysis/opgraph/ssa.js'))buildSsa=exports.buildSsa;
 if(filename.endsWith('/src/decompiler/structurer.js'))buildCfg=exports.buildCfgFromCode;
 if(filename.endsWith('/src/analysis/frameLocalLiveness.js'))frameLiveness=exports.frameLocalLiveness;
 if(filename.endsWith('/src/jit/stackifyNumericValues.js'))numericLocals=exports;
 if(family==='archive-exit'&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translate,exit=exports.prototype.emitInstructionExit;
  exports.prototype.translate=function(...args){try{return translate.apply(this,args);}catch(error){
   if(this.className==='Bzip2Decoder'&&this.method.name==='decodeBlocks')translationFailures.push({phase:'translate',message:String(error.message),stack:String(error.stack).split('\n').slice(1,6)});
   throw error;
  }};
  exports.prototype.emitInstructionExit=function(node,out){try{return exit.call(this,node,out);}catch(error){
   if(this.className==='Bzip2Decoder'&&this.method.name==='decodeBlocks')translationFailures.push({phase:'instruction-exit',op:node.op,id:node.id,item:node.itemIdx,
    slotState:!!node.slotState,operandSnapshot:Array.isArray(node.stackUnder),arguments:node.args.map(v=>({op:v.op,kind:v.kind})),
    prefix:node.stackUnder?.map(v=>({op:v.op,kind:v.kind})),message:String(error.message)});
   throw error;
  }};
 }
 if(family==='archive-proof'&&filename.endsWith('/src/jit/nativeObjectBody.js')){
  const prepare=exports.prepare;
  exports.prepare=function(c,structured,...args){
   const result=prepare(c,structured,...args);
   if(c.className==='Bzip2Decoder'&&c.method.name==='decodeBlocks'&&!args[0]){
    const ops={};for(const b of c.fn.blocks)for(const n of b.body)ops[n.op]=(ops[n.op]||0)+1;
    const receiverKinds={};for(const field of c.nativeObjectFieldOperations.values()){
     const kind=c.fn.params.includes(field.receiver)?'param':field.receiver.op;receiverKinds[kind]=(receiverKinds[kind]||0)+1;
    }
    const callees=[];
    for(const b of c.fn.blocks)for(const n of b.body)if(n.op==='invokestatic'){
     const [,owner,[name,descriptor]]=n.imm,key=owner+'.'+name+descriptor;
     const method=c.jvm.classes[owner]?.ast?.classes?.[0]?.items.find(i=>i.type==='method'&&i.method.name===name&&i.method.descriptor===descriptor)?.method;
     const state=method&&c.wasmJit.state.get(method),meta=state?.meta,call=c.nativeObjectCalls.get(n.id);
     if(!callees.some(q=>q.key===key))callees.push({key,status:state?.status,eligible:c.wasmJit.canonicalDirectLinks.constructor.eligible(state),
      closedVersion:meta?.closedNativeBody?.version??null,objectABI:meta?.parameterObjectABI,arrayABI:meta?.parameterArrayABI,
      actualCall:!!call,compact:call?.compact,guard:call?.guardIdx??null,callArrays:call?.arrays?.length,objects:call?.objects?.length});
    }
    proofCensus.push({asCallee:!!c.preferCompleteCallee,selected:!!result,
     gates:{noHeap:!c.heap,noObjectOps:!c.objNativeOps,noDirectFrames:!c.directFrames,noJsTag:!c.jsTagEh,
      staticBody:!!c.nativeStaticArrayBody,inline:!!c.origIdx,liveRanges:c.liveRanges.length,demoted:c.demoted.size,
      deoptBlocks:c.deoptBlocks.size,irreducible:c.irreducibleSplitBlocks||0,guardedNested:c.guardedNestedArrayLoopPlans?.size||0,blocks:c.fn.blocks.length},
     counts:{nodes:c.fn.values.length,fields:c.nativeObjectFieldOperations.size,staticReads:c.nativeStaticArrayReads.size,
      calls:c.nativeObjectCalls.size,casts:ops.checkcast||0,gets:ops.getfield||0,puts:ops.putfield||0},receiverKinds,callees});
   }
   return result;
  };
 }
}});
globalThis.window=globalThis;globalThis.document={};const j=new JVM(options);delete globalThis.document;
if(flowOnly){
 j.executeTick=()=>{throw Error('Flow inspection attempted guest execution');};
 j.executeInstruction=()=>{throw Error('Flow inspection attempted a Java instruction');};
 await j.preloadClasspathClasses();
 if(family==='ssa-liveness'){
  const rows=[];
  const targets=[['MusicDecoder','decodePacket','(I)[F'],['VorbisCodebook','readVector','()[F'],
   ['VorbisCodebook','readScalar','()I'],['MusicDecodeStage','applyFloorLine','(IIII[FI)V'],
   ['Bzip2Decoder','decodeBlocks','(LBzip2DecoderState;)V']];
  const protectedValues=fn=>{
   const set=new Set(),map=m=>{for(const v of m?.values()||[])set.add(v);},list=vs=>{for(const v of vs||[])set.add(v);};
   for(const b of fn.blocks){map(b.slotDefsIn);map(b.slotDefsOut);list(b.entryStack);list(b.exitStack);
    for(const n of [...b.body,b.term]){map(n?.slotState);list(n?.stackUnder);}}
   return set;
  };
  const allocation=fn=>{
   const protectedSet=protectedValues(fn),stackified=numericLocals.prepare(fn),localOf=new Map(fn.params.map((v,i)=>[v,i]));let next=fn.params.length;
   const allocate=v=>{if(!localOf.has(v))localOf.set(v,next++);return localOf.get(v);};
   const reused=numericLocals.assignLocals(fn,stackified,localOf,allocate);
   return {protectedNumeric:[...protectedSet].filter(v=>'IJFD'.includes(v.kind)).length,
    stackified:stackified.size,allocatedLocals:next-fn.params.length,reusedNumericLocals:reused};
  };
  for(const [owner,name,descriptor]of targets){
   const method=j.findMethod(j.classes[owner],name,descriptor),code=method.attributes.find(a=>a.type==='code').code;
   const key=owner+'.'+name+descriptor;
   if(code.exceptionTable?.length){rows.push({key,skipped:'Standalone bound excludes handlers'});continue;}
   const cfg=buildCfg(code.codeItems),live=frameLiveness(code);
   if(!cfg||!live){rows.push({key,skipped:'No supported bounded CFG/liveness'});continue;}
   for(const snapshotPolicy of ['calls','potential-native']){
    const fn=buildSsa({...code,method,className:owner},{cfg,captureOperandStack:snapshotPolicy==='calls'?undefined:
     op=>/^[ilfdbcs]a(?:load|store)$/.test(op)||['arraylength','getfield','putfield','getstatic','checkcast'].includes(op)});
    assert.ok(!fn.rejected,fn.rejected);const strict=allocation(fn),saved=[];
    const filter=(object,key,needed)=>{
     const map=object[key];if(!map)return;saved.push([object,key,map]);object[key]=new Map([...map].filter(([slot])=>needed(slot)));
    };
    try{
     for(const b of fn.blocks){
      const at=cfg.blocks[b.id].insns[0];filter(b,'slotDefsIn',slot=>live.has(at,slot));
      filter(b,'slotDefsOut',slot=>cfg.succ[b.id].some(id=>live.has(cfg.blocks[id].insns[0],slot)));
      for(const n of [...b.body,b.term])if(n)filter(n,'slotState',slot=>live.has(n.itemIdx,slot)||
       Number.isInteger(n.itemIdx)&&n.itemIdx+1<code.codeItems.length&&live.has(n.itemIdx+1,slot));
     }
     const filtered=allocation(fn);rows.push({key,snapshotPolicy,blocks:fn.blocks.length,nodes:fn.values.length,strict,filtered,
      localReduction:strict.allocatedLocals-filtered.allocatedLocals});
    }finally{for(const [object,key,map]of saved)object[key]=map;}
   }
  }
  assert.equal(j.jit.wasmJit.compiled.length,0);
  const result={sourceRevision:revision,family,analysisOnly:true,compiledGuestMethods:0,guestTicks:0,mainExecuted:false,
   note:'Original SSA allocation bound only; local maps filtered with original liveness, operand snapshots retained. No inlining, handlers, code emission, CPU attribution, timing or safety proof.',
   rows,measuredAt:new Date().toISOString()};
  const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.nativeCallCode||={observations:[]}).observations.push(result);
  fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');fs.writeSync(1,JSON.stringify(result,null,2)+'\n');process.exit(0);
 }
 const method=j.findMethod(j.classes.MusicDecoder,'decodePacket','(I)[F');
 const code=method.attributes.find(a=>a.type==='code').code;
 const fn=buildSsa({...code,method,className:'MusicDecoder'});assert.ok(!fn.rejected,fn.rejected);
 const categories={},arrayFields=new Set(),intFields=new Set();
 let nodes=0,arrayBlocks=0,arrayAndIntBlocks=0,arrayAndMathBlocks=0,staticArraySites=0,staticIntSites=0,mathSites=0;
 for(const block of fn.blocks){
  if(!fn.reachable.has(block.id))continue;
  let arrays=false,integers=false,math=false;
  for(const node of block.body){
   nodes++;categories[node.op]=(categories[node.op]||0)+1;
   if(/^[ilfdbcs]a(?:load|store)$/.test(node.op)||node.op==='arraylength')arrays=true;
   if(node.op==='getstatic'){
    const [,owner,[name,descriptor]]=node.imm,key=owner+'.'+name+descriptor;
    if(/^\[[BCSIJFD]$/.test(descriptor)){arrayFields.add(key);staticArraySites++;}
    if(descriptor==='I'){intFields.add(key);staticIntSites++;integers=true;}
   }
   if(node.op==='invokestatic'&&node.imm[1]==='java/lang/Math'){math=true;mathSites++;}
  }
  if(arrays){arrayBlocks++;if(integers)arrayAndIntBlocks++;if(math)arrayAndMathBlocks++;}
 }
 assert.equal(j.jit.wasmJit.compiled.length,0,'Flow inspection compiled a guest method');
 const result={sourceRevision:revision,family,analysisOnly:true,compiledGuestMethods:0,guestTicks:0,mainExecuted:false,
  note:'Syntactic SSA coverage bounds; not a compiler admission, CPU attribution, timing or safety proof',
  flow:{method:'MusicDecoder.decodePacket(I)[F',blocks:fn.blocks.length,nodes,arrayBlocks,arrayAndIntBlocks,arrayAndMathBlocks,
   staticArraySites,uniqueStaticArrayFields:arrayFields.size,staticIntSites,uniqueStaticIntFields:intFields.size,mathSites,
   otherInvocations:Object.fromEntries(Object.entries(categories).filter(([op])=>op.startsWith('invoke')))},
  rows:[],measuredAt:new Date().toISOString()};
 const current=JSON.parse(fs.readFileSync(reportPath));
 (current.optimizationTrials.nativeCallCode||={observations:[]}).observations.push(result);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');
 fs.writeSync(1,JSON.stringify(result,null,2)+'\n');process.exit(0);
}
const stop=new Error('Call-code inspection stops before guest code');let boundary=false,ticks=0;
let assetCalls=0;
if(fullGraph){
 j.jre.GeobloxLoading={applicationFallback:true,staticMethods:{'browserAsset(Ljava/lang/String;)[B':()=>{
  assetCalls++;throw Error('Compile-only call inspection attempted an asset request');}}};
 const {installBrowserInflater}=await import('../launcher/browser-loader/browser-inflater.mjs');
 installBrowserInflater(j,{inflate:()=>{throw Error('Compile-only inflate');},inflateRaw:()=>{throw Error('Compile-only inflateRaw');}});
}
j.jit.markMainStarted=()=>{boundary=true;throw stop;};
j.executeTick=()=>{ticks++;throw Error('Compile-only inspection attempted a guest tick');};
if(directMusic){
 j.executeInstruction=()=>{ticks++;throw Error('Direct reader compilation attempted Java execution');};
 await j.preloadClasspathClasses();
 for(const [name,descriptor]of [['readBit','()I'],['readBits','(I)I']]){
  const method=j.findMethod(j.classes.MusicDecoder,name,descriptor),state=j.jit.wasmJit.methodState({method});
  j.jit.wasmJit.compile({method,className:'MusicDecoder'},state,{asCallee:true});
  assert.equal(state.status,'ready',state.lastCompileError||name+' did not compile');
 }
}else{
 let failure;try{await j.run(mainClass);}catch(error){failure=error;}
 assert.ok(boundary,'Preparation did not reach the main boundary');assert.equal(failure,stop);
}
assert.equal(ticks,0);assert.equal(assetCalls,0);
if(['archive-proof','archive-exit'].includes(family)){
 const state=j.jit.wasmJit.compiled.find(s=>s.key==='Bzip2Decoder.decodeBlocks(LBzip2DecoderState;)V');assert.equal(state?.status,'ready');
 const result={sourceRevision:revision,family,analysisOnly:true,guestTicks:ticks,assetCalls,mainExecuted:false,
  note:'Final preparation proof-admission census; no workload, CPU profile, timing or oracle replay',
  selectedRegionBlocks:state.meta.nativeObjectRegionBlockCount||0,structuredFailure:state.structuredFailReason,
  candidates:state.wasmCandidateCoverage,rows:family==='archive-proof'?proofCensus:translationFailures,measuredAt:new Date().toISOString()};
 const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.nativeCallCode||={observations:[]}).observations.push(result);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');fs.writeSync(1,JSON.stringify(result,null,2)+'\n');process.exit(0);
}

const walk=(node,visit)=>{if(!Array.isArray(node))return;visit(node);for(const child of node)walk(child,visit);};
function codeShape(wat,name){
 // wasm-dis emits each top-level function on its own indented line. Parse
 // only the selected function, so a full application cannot exhaust the
 // bounded expression parser merely because it contains many other methods.
 const starts=[...wat.matchAll(/^ \(func (\$[^\s(]+)/gm)],at=starts.findIndex(m=>m[1]===name);
 assert.ok(at>=0,'Missing defined function '+name);const start=starts[at].index,end=wat.indexOf('\n )',start);
 assert.ok(end>start,'Missing top-level function end');
 const module=parseWat('(module\n'+wat.slice(start,end+3)+'\n)'),operations={};
 walk(module[1],n=>{if(typeof n[0]==='string')operations[n[0]]=(operations[n[0]]||0)+1;});
 const imports=wat.match(/^ \(import [^\n]*\(func /gm)||[];
 return {name,index:imports.length+at,operations};
}
function nativeCode(bytes,index){
 // Constructing Module compiles code, never runs the module or its start.
 return execFileSync(process.execPath,[...flags,'--trace-wasm-inlining','--print-wasm-code-function-index='+index,'-e',
  "new WebAssembly.Module(require('node:fs').readFileSync(0))"],{input:bytes,encoding:'utf8',maxBuffer:16*1024*1024});
}
function nativeSummary(code){
 assert.match(code,/compiler: TurboFan/,'Optimizing native output was not printed');
 const instructions=code.match(/Instructions \(size = (\d+)\)/);
 const body=code.slice(code.indexOf('Instructions (size'),code.indexOf('\nSource positions:'));
 const calls=[...body.matchAll(/^0x[^\n]*\bcall\b[^\n]*/gm)].map(m=>m[0]);
 const index=Number(code.match(/\nindex: (\d+)/)[1]);
 return {instructionBytes:instructions?Number(instructions[1]):null,calls,
  stackReservations:[...body.matchAll(/^0x[^\n]*\bsubq? rsp,[^\n]*/gm)].map(m=>m[0]),
  inliningTrace:code.split('\n').filter(line=>new RegExp('function '+index+'[: (]').test(line))};
}
const rows=[],jvmOutput=path.join(directory,'current-jvm-native.txt');fs.writeFileSync(jvmOutput,'');
const targets=family==='boolean'?['LoadingMicroKernel.booleanFieldCall(I)I','LoadingMicroKernel.booleanFieldStep(II)I']:
 family==='reader'?['LoadingMicroKernel.bufferedHelper(ILBzip2DecoderState;[I)I','MicroBufferedReader.readBits(ILBzip2DecoderState;)I']:
 family==='music-reader'?['MusicDecoder.readBit()I','MusicDecoder.readBits(I)I']:
 family==='packet'?['MusicDecoder.decodePacket(I)[F']:
 family==='archive'?['Bzip2Decoder.decodeBlocks(LBzip2DecoderState;)V']:
 ['Bzip2Decoder.readBits(ILBzip2DecoderState;)I'];
// Packet identity is supported by its receiver+index -> float[] signature,
// four sine call sites and the original transform's 67 gets / 40 stores.
const teaNames=family==='boolean'?['$162','$55']:family==='reader'?['$51','$30']:family==='music-reader'?['$58','$29']:family==='packet'?['$523']:family==='archive'?['$193']:['$7'];
for(const [ordinal,key]of targets.entries()){
 const state=j.jit.wasmJit.compiled.find(s=>s.key===key);assert.equal(state?.status,'ready',key);
 const meta=state.meta;assert.ok(meta.bytes);assert.ok(meta.normalFlowFullyCompiled);
 const wat=execFileSync('wasm-dis',['--all-features','-'],{input:meta.bytes,encoding:'utf8',maxBuffer:4*1024*1024});
 if(ordinal===targets.length-1)fs.writeFileSync(path.join(directory,'current.wat'),wat);
 const exportName=entryVariant==='closed'?'canonicalClosedStorageRun':meta.parameterObjectABI?.length?'canonicalCompactStorageRun':'canonicalCompactRun';
 if(entryVariant==='closed'){
  assert.ok([1,2].includes(meta.closedNativeBody?.version),'Closed export requires a supported compiler contract');
  assert.equal(meta.closedNativeBody.run,meta.canonicalClosedStorageRun,'Certificate must bind this exact export');
 }
 const module=parseWat(wat),exported=module.find(n=>n?.[0]==='export'&&n[1]===JSON.stringify(exportName));
 assert.ok(exported,key+' has no published compact entry');
 const shape=codeShape(wat,exported[2][1]),code=nativeCode(meta.bytes,shape.index);
 fs.appendFileSync(jvmOutput,'\n'+key+'\n'+code);
 const bindings=j.jit.wasmJit.canonicalDirectLinks.bindings.get(key)||[];
 rows.push({backend:'jvm',key,export:exportName,...shape,...nativeSummary(code),
  nativeLoopBoundsSiteCount:meta.nativeLoopBoundsSiteCount||0,
  nativeLoopBoundsGuardCount:meta.nativeLoopBoundsGuardCount||0,
  nativeLoopBoundsMaxDimensions:meta.nativeLoopBoundsMaxDimensions||0,
  nativeLoopBoundsOperationCount:meta.nativeLoopBoundsOperationCount||0,
  directMathSinImport:meta.importObject?.env?.math_sin__D_D===Math.sin,
  nativeObjectBodyFieldSites:meta.nativeObjectBodyFieldSites||0,
  nativeObjectBodyReceiverCount:meta.nativeObjectBodyReceiverCount??null,
  nativeObjectBodyLazyReceivers:meta.nativeObjectBodyLazyReceivers??null,
  instructionExitSiteCount:meta.instructionExitSiteCount??null,
  nativeOperandSnapshotCount:meta.nativeOperandSnapshotCount??null,
  nativeClosedCallSiteCount:meta.nativeClosedCallSiteCount??null,
  nativeStaticInputGuardCount:meta.nativeStaticInputGuardCount??null,
  nativeObjectRegionBlockCount:meta.nativeObjectRegionBlockCount??null,
  nativeStaticStateBodySites:meta.nativeStaticStateBodySites??null,
  nativeStaticStateInstanceFieldSites:meta.nativeStaticStateInstanceFieldSites??null,
  nativeStaticStateTailLoadCount:meta.nativeStaticStateTailLoadCount??null,
  nativeObjectRegionCastCount:meta.nativeObjectRegionCastCount??null,
  nativeObjectRegionCastCacheCount:meta.nativeObjectRegionCastCacheCount??null,
  nativeObjectRegionStaticReadCount:meta.nativeObjectRegionStaticReadCount??null,
  nativeClosedForwarder:meta.nativeClosedForwarder??null,
  nativeClosedCallRoot:meta.nativeClosedCallRoot??null,
  nativeOperandSnapshotRetried:meta.nativeOperandSnapshotRetried??null,
  closedContractVersion:meta.closedNativeBody?.version??null,
  closedExportBound:!!meta.canonicalClosedStorageRun&&meta.closedNativeBody?.run===meta.canonicalClosedStorageRun,
  opaqueObjectStorageCacheCount:meta.opaqueObjectStorageCacheCount??null,
  canonicalLazyActivation:!!meta.canonicalLazyActivation,
  canonicalTargetImportCount:meta.canonicalTargetImportCount||0,
  nativeObjectPromotedFieldCount:meta.nativeObjectPromotedFieldCount||0,
  nonReturningArrayErrorSiteCount:meta.nonReturningArrayErrorSiteCount||0,
  nativeObjectElidedArrayReferenceSites:meta.nativeObjectElidedArrayReferenceSites||0,
  publishedSlots:bindings.filter(b=>b.compact).map(b=>({slot:b.slot,stub:j.jit.wasmJit.canonicalDirectLinks.table.get(b.slot)===b.stub,
   typed:!!b.target,typedStub:b.target?b.target.value===b.stub:null}))});
 if(fullGraph){
  const core=module.find(n=>n?.[0]==='func'&&n[1]?.startsWith('$jvm$wasm$'));
  assert.ok(core,'Missing core Java body');const coreShape=codeShape(wat,core[1]),coreCode=nativeCode(meta.bytes,coreShape.index);
  fs.appendFileSync(jvmOutput,'\n'+key+' core\n'+coreCode);
  rows.push({backend:'jvm',key,export:'core',...coreShape,...nativeSummary(coreCode)});
 }
}
// Already-inspected controls are evidence to reuse, not code to compile again.
const savedTea=[...(receipt.optimizationTrials.nativeCallCode?.observations||[])].reverse()
 .find(o=>o.family===family&&o.engine===process.version&&JSON.stringify(o.flags)===JSON.stringify(flags))
 ?.rows.filter(row=>row.backend==='teavm');
if(entryVariant==='closed')assert.equal(savedTea?.length,teaNames.length,'Reuse saved TeaVM native code; do not compile the known control again');
let teaOutput=null;
if(savedTea?.length===teaNames.length)rows.push(...savedTea);
else{
 const teaDirectory=family==='packet'||directMusic?path.join(player,'vorbis'):directory;
 const teaWat=fs.readFileSync(path.join(teaDirectory,'current-teavm.wat'),'utf8');
 const teaBytes=fs.readFileSync(path.join(teaDirectory,'teavm',family==='packet'||directMusic?'vorbis.wasm':'micro.wasm'));
 teaOutput=path.join(directory,'current-teavm-native.txt');fs.writeFileSync(teaOutput,'');
 for(const name of teaNames){
  const shape=codeShape(teaWat,name),code=nativeCode(teaBytes,shape.index);
  if(family==='packet'){
   assert.equal(shape.operations['array.get'],67,'Packet identity: array gets');
   assert.equal(shape.operations['array.set'],40,'Packet identity: array stores');
  }
  if(directMusic){
   assert.equal(shape.operations['array.get_s'],name==='$58'?1:2,'Original music reader byte accesses');
   assert.equal(shape.operations['global.set'],3,'Original music reader cursor writes');
   assert.equal(shape.operations.loop||0,name==='$58'?0:1,'Original music reader loop shape');
  }
  if(family==='archive'){
   assert.equal(shape.operations['struct.set'],14,'Archive identity: field writes');
   assert.equal(shape.operations['array.get_s'],25,'Archive identity: byte reads');
  }
  fs.appendFileSync(teaOutput,'\n'+name+'\n'+code);rows.push({backend:'teavm',...shape,...nativeSummary(code)});
 }
}
const current=JSON.parse(fs.readFileSync(reportPath)),trial=current.optimizationTrials.nativeCallCode||={observations:[]};
const result={sourceRevision:revision,family,entryVariant,preparationMethod:directMusic?'direct reader compilation':'entry graph',compileOnly:true,guestTicks:ticks,assetCalls,mainExecuted:false,teaVmInstantiated:false,
 nonReturningArrayErrorsByMethod:j.jit.wasmJit.compiled.filter(s=>s.key.startsWith('Bzip2Decoder.')&&s.meta?.nonReturningArrayErrorSiteCount)
  .map(s=>({key:s.key,sites:s.meta.nonReturningArrayErrorSiteCount})),
 baselineTimingsOrFingerprints:false,teaNativeCodeReused:savedTea?.length===teaNames.length,
 engine:process.version,flags,rows,jvmOutput,teaOutput,measuredAt:new Date().toISOString()};
trial.observations.push(result);fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
