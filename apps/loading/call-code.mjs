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
const family=process.argv[3]||'boolean';assert.ok(['boolean','reader','original-reader','music-reader','packet','archive','packet-flow','ssa-liveness','archive-proof','archive-exit','packet-metadata','constructor-coverage','checkpoint-coverage','static-loop-coverage','static-loop-region-bound','static-loop-gates','field-array-coverage','inlined-lifetimes','frame-remat','mdct-frame-remat'].includes(family));
const entryVariant=process.argv[4]||'ordinary';assert.ok(['ordinary','closed'].includes(entryVariant));
if(entryVariant==='closed')assert.ok(['original-reader','music-reader'].includes(family),'Inspect a proved native reader export');
assert.ok(flags.every(flag=>process.execArgv.includes(flag)),'Run this preparation with the documented eager/heap flags');
const receipt=JSON.parse(fs.readFileSync(reportPath)),options=structuredClone(receipt.diagnosticOptions);
const originalFlow=['packet-flow','ssa-liveness'].includes(family),flowOnly=originalFlow||family==='inlined-lifetimes'||family.endsWith('frame-remat'),directMusic=family==='music-reader',fullGraph=['packet','archive','archive-proof','archive-exit','packet-metadata','constructor-coverage','checkpoint-coverage','static-loop-coverage','static-loop-region-bound','static-loop-gates','field-array-coverage'].includes(family),mainClass=fullGraph?'GeobloxLoading':'LoadingMicroKernel';
options.classpath=[path.join(family==='mdct-frame-remat'?path.join(player,'mdct'):fullGraph||directMusic||originalFlow||family==='frame-remat'?player:directory,'classes')];options.jit.compileWorker=false;
options.jit.preparationPolicy={entryMethods:[mainClass+'.main([Ljava/lang/String;)V']};
let buildSsa,buildCfg,frameLiveness,numericLocals,inlineCalls,stableHeaders;const proofCensus=[],translationFailures=[],headerCensus=[],checkpointCensus=[],checkpointPlans=new WeakMap(),staticLoopCensus=[],staticRegionBounds=new WeakMap(),fieldArrayPlans=new WeakMap(),fieldArrayCensus=[];
const preloadModules=family==='ssa-liveness'?['src/analysis/frameLocalLiveness.js','src/jit/stackifyNumericValues.js']:
 family==='inlined-lifetimes'||family.endsWith('frame-remat')?['src/jit/wasmInline.js','src/jit/stackifyNumericValues.js']:family==='packet-metadata'?['src/jit/stableArrayHeaders.js']:[];
const {JVM}=await loadArchivedJvm(path.resolve(here,'../../../java-tools'),revision,{preloadModules,observeModule:({filename,exports})=>{
 if(family==='field-array-coverage'&&filename.endsWith('/src/jit/nativeObjectBody.js')){
  const prepare=exports.prepare;
  exports.prepare=function(c,structured,preflight,...rest){
   const plan=prepare(c,structured,preflight,...rest);
   if(!preflight&&(plan?.partial&&!plan.calls.size||c.className==='MusicDecoder'&&c.method.name==='decodePcmBudgeted'))
    fieldArrayPlans.set(c,{key:c.className+'.'+c.method.name+c.method.descriptor,
     noCallRegion:!!plan?.partial&&!plan.calls.size,blocks:plan?.blocks?.size||0,fields:plan?.fields?.size||0,
     arrays:plan?.arrayCaches?.size||0,closedCalls:plan?.calls?.size||0,
     gates:{inline:!!c.origIdx,staticBody:!!c.nativeStaticArrayBody,liveRanges:c.liveRanges.length,
      guardedLoops:c.guardedNestedArrayLoopPlans.size,demotes:c.demoted.size}});
   return plan;
  };
 }
 if(family==='field-array-coverage'&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translateBody;
  exports.prototype.translateBody=function(...args){
   const meta=translate.apply(this,args),row=fieldArrayPlans.get(this);
   if(meta?.bytes&&row)fieldArrayCensus.push({...row,meta,full:!!meta.fullyCompiled,moduleBytes:meta.bytes.length});
   return meta;
  };
 }
 if(['static-loop-region-bound','static-loop-gates'].includes(family)&&filename.endsWith('/src/jit/nativeObjectBody.js')){
  const prepare=exports.prepare;
  exports.prepare=function(c,structured,preflight,...rest){
   const actual=prepare(c,structured,preflight,...rest);
   if(!preflight&&c.origIdx&&c.className==='Bzip2Decoder'&&c.method.name==='decodeBlocks'){
    const before=[c.nextLocal,c.importDecls.length,c.canonicalSlots.length];
    // An optimistic admission bound, never installed or emitted. Removing
    // the origin gate cannot itself prove safe reconstruction of a guard exit.
    const shadow=Object.assign(Object.create(Object.getPrototypeOf(c)),c,{origIdx:null});
    const bound=prepare(shadow,structured,true,true);
    assert.deepEqual([c.nextLocal,c.importDecls.length,c.canonicalSlots.length],before,'Preflight bound changed code-generation state');
    const callees=new Map();
    for(const block of c.fn.blocks)for(const node of block.body)if(node.op==='invokestatic'){
     const [,owner,[name,descriptor]]=node.imm,key=owner+'.'+name+descriptor;
     const method=c.jvm.findMethod(c.jvm.classes[owner],name,descriptor),state=method&&c.wasmJit.state.get(method),meta=state?.meta;
     if(!callees.has(key))callees.set(key,{key,status:state?.status,closed:!!meta?.closedNativeBody,
      arrayAbi:meta?.parameterArrayABI?.length,full:!!meta?.fullyCompiled});
    }
    const gates={heap:!!c.heap,nativeOps:!!c.objNativeOps,directFrames:!!c.directFrames,jsTag:!!c.jsTagEh,
     staticBody:!!c.nativeStaticArrayBody,liveRanges:c.liveRanges.length,demotes:c.demoted.size,deoptBlocks:c.deoptBlocks.size,
     split:c.irreducibleSplitBlocks||0,guardedLoops:c.guardedNestedArrayLoopPlans.size,blocks:c.fn.blocks.length,
     fieldSites:c.nativeObjectFieldOperations.size,uniqueFieldSlots:new Set([...c.nativeObjectFieldOperations.values()].map(v=>v.slot.key)).size};
    staticRegionBounds.set(c,{gates,callees:[...callees.values()],actual:!!actual,ignoringOriginAndMissingSnapshots:!!bound,
     partial:!!bound?.partial,lazy:!!bound?.lazy,fields:bound?.fields?.size,arrays:bound?.arrays?.size,
     boundOnly:true});
   }
   return actual;
  };
 }
 if(['static-loop-coverage','static-loop-region-bound','static-loop-gates'].includes(family)&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translateBody;
  exports.prototype.translateBody=function(...args){
   const meta=translate.apply(this,args);
   if(!meta?.bytes||!['Bzip2Decoder','MusicDecoder','VorbisCodebook','VorbisResidue','MusicDecodeStage'].includes(this.className))return meta;
   const sites=new Map();
   for(let activation of this.inlineActivations?.values()||[]){
    while(activation.parent)activation=activation.parent;
    if(!activation.method.flags?.includes('static'))continue;
    const key=activation.className+'.'+activation.method.name+activation.method.descriptor;
    sites.set(key+'@'+activation.call,{callee:key,call:activation.call,calleeLocals:activation.localsSize});
   }
   staticLoopCensus.push({meta,key:this.className+'.'+this.method.name+this.method.descriptor,
    sites:[...sites.values()],full:!!meta.fullyCompiled,normalFull:!!meta.normalFlowFullyCompiled,
    activationSites:meta.inlineActivationSiteCount||0,moduleBytes:meta.bytes.length,
    nativeObjectFields:meta.nativeObjectBodyFieldSites||0,nativeObjectArrays:meta.nativeObjectBodyArraySites||0,
    nativeRegionBlocks:meta.nativeObjectRegionBlockCount||0,regionBound:staticRegionBounds.get(this)});
   return meta;
  };
 }
 if(family==='checkpoint-coverage'&&filename.endsWith('/src/jit/structuredLoopResume.js')){
  const prepare=exports.prepare;
  exports.prepare=function(c,structured){
   const plan=prepare(c,structured),key=c.className+'.'+c.method.name+c.method.descriptor;
   if(!['VorbisCodebook.<init>()V','VorbisCodebook.computeLookupValueCount(II)I','MusicDecoder.decodeSetup([B)V'].includes(key))return plan;
   const loops=[];
   const walk=(node,path=[])=>{
    if(!node)return;
    if(node.t==='loop'){
     const block=Number(node.label.slice(1)),at=c.cfg.blocks[block]?.insns[0];
     loops.push({block,item:c.origIdx?c.origIdx[at]:at,path});walk(node.body,[...path,'loop']);
    }else if(node.t==='seq')for(const child of node.body)walk(child,path);
    else if(node.t==='block')walk(node.body,path);
    else if(node.t==='if'){walk(node.then,[...path,'then']);walk(node.els,[...path,'else']);}
    else if(node.t==='switch'){for(const arm of node.cases)walk(arm.body,[...path,'case']);walk(node.dflt,[...path,'default']);}
   };walk(structured.tree);
   const alternatives=exports.alternatives?.(c,structured).map(p=>({block:p.header,item:p.item,slots:p.restore.map(v=>({slot:v.slot,kind:v.value.kind})),
    branches:[...p.branches||[]].map(([node,taken])=>({block:node.block,taken})),
    enclosingLoops:[...p.enclosingLoops||[]].map(node=>Number(node.label.slice(1)))}));
   // Admission bound only: the normal emitter and its cache entry remain
   // untouched. A prefix-only byte[] parameter may otherwise force restoring
   // a dead argument merely to fill an entry cache the resumed region never uses.
   const parameterCaches=[...c.arrayCaches.values()].filter(cache=>cache.parameter);
   const ignoringParameterCaches=exports.alternatives?.({...c,arrayCaches:new Map([...c.arrayCaches].filter(([,cache])=>!cache.parameter))},structured)
    .map(p=>({block:p.header,item:p.item}));
   checkpointPlans.set(c,{key,loops,alternatives,
    parameterCaches:parameterCaches.map(cache=>({id:cache.value.id,op:cache.value.op,kind:cache.value.kind})),
    ignoringParameterCaches,parameterCacheBoundOnly:true,chosen:plan?{block:plan.header,item:plan.item,slots:plan.restore.map(v=>v.slot)}:null,
    gates:{frameLiveness:!!c.frameLocalLiveness,demotes:c.demoted.size,deoptBlocks:c.deoptBlocks.size,
     handlers:c.fn.handlerEntries.length,entryPhis:c.fn.blocks[c.cfg.entry].phis.length,
     arrayResult:!!c.ownArrayResult,guardedNested:c.guardedNestedArrayLoopPlans.size}});
   return plan;
  };
 }
 if(family==='checkpoint-coverage'&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translateBody;
  exports.prototype.translateBody=function(...args){const meta=translate.apply(this,args),row=checkpointPlans.get(this);
   if(meta?.bytes&&row)checkpointCensus.push({...row,meta,frameEntryOnly:!!meta.frameEntryOnly,resume:meta.structuredResumeEntry,resumes:meta.structuredResumeEntries||[]});
   return meta;
  };
 }
 if(filename.endsWith('/src/analysis/opgraph/ssa.js'))buildSsa=exports.buildSsa;
 if(filename.endsWith('/src/decompiler/structurer.js'))buildCfg=exports.buildCfgFromCode;
 if(filename.endsWith('/src/analysis/frameLocalLiveness.js'))frameLiveness=exports.frameLocalLiveness;
 if(filename.endsWith('/src/jit/stackifyNumericValues.js'))numericLocals=exports;
 if(filename.endsWith('/src/jit/wasmInline.js'))inlineCalls=exports.inlineCalls;
 if(filename.endsWith('/src/jit/stableArrayHeaders.js'))stableHeaders=exports;
 if(family==='packet-metadata'&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translateBody;
  exports.prototype.translateBody=function(...args){
   const meta=translate.apply(this,args);
   if(meta?.bytes&&this.className==='MusicDecoder'&&this.method.name==='decodePacket'){
    const regions=(this.nativeStaticArrayBody?.regions||[]).filter(plan=>!plan.stateful).map(plan=>{
     const aliases=stableHeaders(plan);
     return {entry:plan.entry,blocks:plan.blocks.size,sites:plan.sites,references:plan.references.size,
      fields:plan.fields.size,externalReferences:plan.external.size,phis:[...plan.references.values()].filter(v=>v.op==='phi').length,
      stableAliases:[...aliases],potentialSavedHeaderLocals:2*aliases.size};
    });
    headerCensus.push({meta,key:this.className+'.'+this.method.name+this.method.descriptor,regions});
   }
   return meta;
  };
 }

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
 if(family==='inlined-lifetimes'){
  // Symbolic readiness only: do not execute any initializer to inspect a
  // prepared inline shape. The existing timer fixtures own real preparation.
  for(const owner of Object.keys(j.classes))j._markClassInitialized(owner);
  const method=j.findMethod(j.classes.LoadingMicroKernel,'huffmanInline','(ILMicroHuffmanBook;)I');
  const code=method.attributes.find(a=>a.type==='code').code,w=j.jit.wasmJit;
  const expanded=inlineCalls(j,{code},{maxCalleeItems:w.maxInlineCalleeItems,budget:w.inlineBudget,
   hierarchy:w.hierarchy,callerClassName:'LoadingMicroKernel',callerMethod:method,callerIsStatic:true,
   deepInline:w.deepInline,resumableLoops:true,inlineColdIntegerLeaves:w.inlineColdIntegerLeavesEnabled});
  assert.equal(expanded?.inlined,1,'Bound this reduction to the one recovered root call');
  const analyze=items=>{
   const fn=buildSsa({codeItems:items,exceptionTable:code.exceptionTable,method,className:'LoadingMicroKernel'});
   assert.ok(!fn.rejected,fn.rejected);
   const stackified=numericLocals.prepare(fn),localOf=new Map(fn.params.map((v,i)=>[v,i]));let next=fn.params.length;
   const allocate=v=>{if(!localOf.has(v))localOf.set(v,next++);return localOf.get(v);};
   const reused=numericLocals.assignLocals(fn,stackified,localOf,allocate),phis=fn.blocks.flatMap(b=>b.phis);
   return {items:items.length,values:fn.values.length,localSlots:fn.localsSize,
    calleeNumericPhis:phis.filter(v=>v.origin?.slot>=code.localsSize&&'IJFD'.includes(v.kind)).length,
    numericLocals:[...localOf.keys()].filter(v=>!fn.params.includes(v)&&'IJFD'.includes(v.kind)).length,
    referenceLocals:[...localOf.keys()].filter(v=>!fn.params.includes(v)&&v.kind==='A').length,
    stackified:stackified.size,allocatedLocals:next-fn.params.length,reusedNumericLocals:reused};
  };
  const current=analyze(expanded.items),proposed=[];let continuations=0;
  for(const [index,item]of expanded.items.entries()){
   proposed.push(item);
   if(item.labelDef?.endsWith('RET:')&&expanded.origIdx[index]>=0){
    continuations++;
    for(let slot=Number(code.localsSize);slot<current.localSlots;slot++)proposed.push(
     {instruction:'aconst_null'},{instruction:{op:'astore',arg:String(slot)}});
   }
  }
  assert.equal(continuations,1,'Only the completed root activation is retired');
  const result={sourceRevision:revision,family,analysisOnly:true,compiledGuestMethods:0,guestTicks:0,mainExecuted:false,
   symbolicReadiness:true,callerLocalSlots:code.localsSize,current,proposed:analyze(proposed),
   note:'SSA/allocation bound for ending completed inline-local lifetimes; no runtime timing, baseline validation or semantics claim.',measuredAt:new Date().toISOString()};
  assert.equal(w.compiled.length,0);
  const currentReceipt=JSON.parse(fs.readFileSync(reportPath));(currentReceipt.optimizationTrials.nativeCallCode||={observations:[]}).observations.push(result);
  fs.writeFileSync(reportPath,JSON.stringify(currentReceipt,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(0);
 }
 if(family.endsWith('frame-remat')){
  const rows=[];
  const allocation=(fn,stackified)=>{
   const locals=new Map(fn.params.map((v,i)=>[v,i]));let next=fn.params.length;
   const allocate=value=>{if(!locals.has(value))locals.set(value,next++);return locals.get(value);};
   const reused=numericLocals.assignLocals(fn,stackified,locals,allocate);
   return {locals:next-fn.params.length,reused};
  };
  const targets=family==='mdct-frame-remat'?[['MdctTransformKernel','transform',null]]:
   [['MusicDecoder','decodePacket','(I)[F'],['VorbisCodebook','readVector','()[F'],
   ['VorbisCodebook','readScalar','()I'],['VorbisResidue','decodeResidue','([FIZ)V'],['Bzip2Decoder','decodeBlocks','(LBzip2DecoderState;)V']];
  for(const [owner,name,descriptor]of targets){
   const method=descriptor?j.findMethod(j.classes[owner],name,descriptor):j.classes[owner].ast.classes[0].items.find(i=>i.type==='method'&&i.method.name===name).method,code=method.attributes.find(a=>a.type==='code').code;
   const fn=buildSsa({...code,method,className:owner},{captureOperandStack:op=>/^[ilfdbcs]a(?:load|store)$/.test(op)||['aaload','arraylength','getfield','putfield','getstatic','checkcast'].includes(op)});
   assert.ok(!fn.rejected,fn.rejected);
   const initial=(numericLocals.prepareArithmetic||numericLocals.prepare)(fn),candidates=numericLocals.frameRematerializations(fn,initial),combined=new Set([...initial,...candidates]);
   const dependencies=new Set(),visit=value=>{if(combined.has(value))for(const arg of value.args)visit(arg);else dependencies.add(value);};
   for(const value of candidates)visit(value);
   const strict=allocation(fn,initial),saved=[];
   const filter=(object,key)=>{const values=object[key];if(!values)return;saved.push([object,key,values]);
    object[key]=values instanceof Map?new Map([...values].filter(([,v])=>!candidates.has(v))):values.filter(v=>!candidates.has(v));};
   let proposed;
   try{
    for(const b of fn.blocks){for(const key of ['slotDefsIn','slotDefsOut','entryStack','exitStack'])filter(b,key);
     for(const n of [...b.body,...(b.term?[b.term]:[])])for(const key of ['slotState','stackUnder'])filter(n,key);}
    const block=fn.blocks[0];saved.push([block,'entryStack',block.entryStack]);block.entryStack=[...(block.entryStack||[]),...dependencies];
    proposed=allocation(fn,combined);
   }finally{for(const [object,key,value]of saved.reverse())object[key]=value;}
   const operations={};for(const v of candidates)operations[v.op]=(operations[v.op]||0)+1;
   rows.push({key:owner+'.'+name+method.descriptor,values:fn.values.length,candidates:candidates.size,operations,protectedOperands:dependencies.size,strict,proposed,reduction:strict.locals-proposed.locals});
  }
  assert.equal(j.jit.wasmJit.compiled.length,0);
  const result={sourceRevision:revision,family,analysisOnly:true,compiledGuestMethods:0,guestTicks:0,mainExecuted:false,
   note:'New cold-frame arithmetic reconstruction bound. Captured leaves protected; no filtered graph executes, code emission, CPU profile, baseline fingerprint or control replay.',rows,measuredAt:new Date().toISOString()};
  const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.nativeCallCode||={observations:[]}).observations.push(result);
  fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(0);
 }
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
if(family==='static-loop-gates'){
 await j.preloadClasspathClasses();const w=j.jit.wasmJit;
 for(const name of ['readBits','readByte','readBit','buildByteAlphabet','buildHuffmanTables','emitBlockRuns','decodeBlocks']){
  const method=j.classes.Bzip2Decoder.ast.classes[0].items.find(item=>item.type==='method'&&item.method.name===name).method;
  w.compile({method,className:'Bzip2Decoder'},w.methodState({method}),{asCallee:true});
 }
}else if(directMusic){
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
if(family==='field-array-coverage'){
 const active=new Set(j.jit.wasmJit.compiled.flatMap(state=>[state.meta,state.callee?.meta,state.osr?.meta]));
 const rows=fieldArrayCensus.filter(row=>active.has(row.meta)).map(({meta,...row})=>row);
 assert.ok(rows.some(row=>row.key.startsWith('MusicDecoder.decodePcmBudgeted(')),'Missing actual PCM conversion admission');
 const result={sourceRevision:revision,family,compileOnly:true,guestTicks:ticks,assetCalls,mainExecuted:false,rows,
  note:'New closed field/array-writing loop admission only; normal emission, no Java/TeaVM execution, CPU attribution or baseline replay.',measuredAt:new Date().toISOString()};
 const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.nativeCallCode||={observations:[]}).observations.push(result);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(0);
}
if(['static-loop-coverage','static-loop-region-bound','static-loop-gates'].includes(family)){
 const active=new Set(j.jit.wasmJit.compiled.flatMap(state=>[state.meta,state.callee?.meta,state.osr?.meta]));
 const rows=staticLoopCensus.filter(row=>active.has(row.meta)).map(({meta,...row})=>row);
 for(const state of j.jit.wasmJit.compiled)if(state.key.startsWith('Bzip2Decoder.')&&!state.meta?.structured&&!rows.some(row=>row.key===state.key))
  rows.push({key:state.key,status:state.status,structured:false,structuredFailure:state.structuredFailReason,
   lastCompileError:state.lastCompileError,candidates:state.wasmCandidateCoverage});
 const methodStates=[];
 for(const name of ['readByte','readBit','decodeBlocks']){
  const method=j.classes.Bzip2Decoder.ast.classes[0].items.find(item=>item.type==='method'&&item.method.name===name).method;
  const state=j.jit.wasmJit.state.get(method);
  methodStates.push({name,status:state?.status,listed:!!state&&j.jit.wasmJit.compiled.includes(state),
   structured:!!state?.meta?.structured,structuredFailure:state?.structuredFailReason,
   failReason:state?.failReason,lastCompileError:state?.lastCompileError,candidates:state?.wasmCandidateCoverage,
   nativeFields:state?.meta?.nativeObjectBodyFieldSites,nativeArrays:state?.meta?.nativeObjectBodyArraySites,
   closed:!!state?.meta?.closedNativeBody,sites:state?.meta?.inlineActivationSiteCount});
 }
 assert.ok(rows.length,'No codec methods prepared for the new static-loop question');
 const result={sourceRevision:revision,family,compileOnly:true,guestTicks:ticks,assetCalls,mainExecuted:false,rows,methodStates,
  note:'New recovered-static-loop admission or optimistic region bound, as labelled; normal emission unchanged by the inspector. No Java/TeaVM execution, CPU attribution, timing or baseline fingerprint check.',measuredAt:new Date().toISOString()};
 const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.nativeCallCode||={observations:[]}).observations.push(result);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(0);
}
if(family==='checkpoint-coverage'){
 const active=new Set(j.jit.wasmJit.compiled.flatMap(state=>[state.meta,state.callee?.meta,state.osr?.meta]));
 const rows=checkpointCensus.filter(row=>active.has(row.meta)).map(({meta,...row})=>row);
 assert.ok(rows.some(row=>row.key==='VorbisCodebook.<init>()V'),'Constructor checkpoint census is missing');
 const result={sourceRevision:revision,family,compileOnly:true,guestTicks:ticks,assetCalls,mainExecuted:false,rows,
  note:'New checkpoint-shape/restore admission question, with normal preparation and no constructor execution, timer, CPU profile or baseline replay.',measuredAt:new Date().toISOString()};
 const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.nativeCallCode||={observations:[]}).observations.push(result);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(0);
}
if(family==='constructor-coverage'){
 const keys=['VorbisCodebook.<init>()V','MusicDecoder.decodeSetup([B)V','VorbisResidue.<init>()V','MusicDecodeStage.<init>()V','VorbisMapping.<init>()V'];
 const rows=keys.map(key=>{
  const state=j.jit.wasmJit.compiled.find(s=>s.key===key),meta=state?.meta;
  return {key,status:state?.status,full:!!meta?.fullyCompiled,normalFull:!!meta?.normalFlowFullyCompiled,
   demotes:[...(meta?.demoteReasons||[])],
   multiArrayImports:Object.keys(meta?.importObject?.env||{}).filter(name=>name.startsWith('multianewarr_'))};
 });
 assert.ok(rows[0].normalFull,'Codebook constructor is still outside complete native flow');
 const result={sourceRevision:revision,family,compileOnly:true,guestTicks:ticks,assetCalls,mainExecuted:false,rows,
  note:'New missing-opcode admission question only; no constructor/main execution, timing, CPU attribution, TeaVM or unchanged-control validation.',measuredAt:new Date().toISOString()};
 const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.nativeCallCode||={observations:[]}).observations.push(result);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(0);
}
if(family==='packet-metadata'){
 const active=new Set(j.jit.wasmJit.compiled.flatMap(state=>[state.meta,state.callee?.meta,state.osr?.meta]));
 const rows=headerCensus.filter(row=>active.has(row.meta)).map(({meta,...row})=>row);
 assert.ok(rows.length,'No active packet region census');
 const result={sourceRevision:revision,family,compileOnly:true,guestTicks:ticks,assetCalls,mainExecuted:false,
  baselineTimingsOrFingerprints:false,rows,note:'New singleton-source header-sharing admission only. No metadata changes or workload execution.',measuredAt:new Date().toISOString()};
 const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.nativeCallCode||={observations:[]}).observations.push(result);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(0);
}
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
  nativeArrayReferenceReadElisionCount:meta.nativeArrayReferenceReadElisionCount||0,
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
assert.equal(savedTea?.length,teaNames.length,'Reuse recorded TeaVM native code; this inspector never recompiles a known control');
const teaOutput=null;rows.push(...savedTea);
const current=JSON.parse(fs.readFileSync(reportPath)),trial=current.optimizationTrials.nativeCallCode||={observations:[]};
const result={sourceRevision:revision,family,entryVariant,preparationMethod:directMusic?'direct reader compilation':'entry graph',compileOnly:true,guestTicks:ticks,assetCalls,mainExecuted:false,teaVmInstantiated:false,
 nonReturningArrayErrorsByMethod:j.jit.wasmJit.compiled.filter(s=>s.key.startsWith('Bzip2Decoder.')&&s.meta?.nonReturningArrayErrorSiteCount)
  .map(s=>({key:s.key,sites:s.meta.nonReturningArrayErrorSiteCount})),
 baselineTimingsOrFingerprints:false,teaNativeCodeReused:savedTea?.length===teaNames.length,
 engine:process.version,flags,rows,jvmOutput,teaOutput,measuredAt:new Date().toISOString()};
trial.observations.push(result);fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
