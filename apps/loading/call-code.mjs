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
const family=process.argv[3]||'boolean';assert.ok(['int-tree-prefix-shape','native-unary-cache','instance-reference-code','static-value-block-elision','static-value-block-native','static-value-block-code','reference-element-bound','root-static-guards','root-static-code','receiver-caller-code','receiver-token-code','receiver-token-coverage','native-region-kernel-slice-code','native-region-kernel-bounds-code','native-region-kernel-code','native-region-kernel-bound','receiver-origin-bound','boolean','reader','original-reader','music-reader','packet','archive','packet-flow','ssa-liveness','archive-proof','archive-exit','packet-metadata','constructor-coverage','native-reference-store-coverage','checkpoint-coverage','static-loop-coverage','static-loop-region-bound','static-loop-gates','field-array-coverage','constant-inline-coverage','nested-constant-inline-coverage','native-element-availability','native-element-micro','native-numeric-kernel','native-numeric-kernel-code','native-numeric-kernel-micro-code','native-kernel-boundary','inlined-lifetimes','frame-remat','mdct-frame-remat'].includes(family));
const numericKernelFamily=['native-region-kernel-slice-code','native-region-kernel-bounds-code','native-region-kernel-code','native-region-kernel-bound','native-numeric-kernel','native-numeric-kernel-code','native-numeric-kernel-micro-code','native-kernel-boundary'].includes(family),numericKernelCode=numericKernelFamily&&family.endsWith('-code');
const numericKernelMicro=['native-numeric-kernel-micro-code','native-kernel-boundary'].includes(family);
const elementBound=['native-element-availability','native-element-micro'].includes(family);
const entryVariant=process.argv[4]||'ordinary';assert.ok(['ordinary','closed'].includes(entryVariant));
if(entryVariant==='closed')assert.ok(['original-reader','music-reader'].includes(family),'Inspect a proved native reader export');
assert.ok(flags.every(flag=>process.execArgv.includes(flag)),'Run this preparation with the documented eager/heap flags');
const receipt=JSON.parse(fs.readFileSync(reportPath)),options=structuredClone(receipt.diagnosticOptions);
const originalFlow=['packet-flow','ssa-liveness'].includes(family),flowOnly=originalFlow||family==='inlined-lifetimes'||family.endsWith('frame-remat'),directMusic=family==='music-reader',fullGraph=['int-tree-prefix-shape','native-unary-cache','instance-reference-code','static-value-block-elision','static-value-block-native','static-value-block-code','reference-element-bound','root-static-guards','root-static-code','receiver-caller-code','receiver-token-code','receiver-token-coverage','native-region-kernel-slice-code','native-region-kernel-bounds-code','native-region-kernel-code','native-region-kernel-bound','receiver-origin-bound','packet','archive','archive-proof','archive-exit','packet-metadata','constructor-coverage','native-reference-store-coverage','checkpoint-coverage','static-loop-coverage','static-loop-region-bound','static-loop-gates','field-array-coverage','constant-inline-coverage','nested-constant-inline-coverage','native-element-availability','native-numeric-kernel','native-numeric-kernel-code'].includes(family),mainClass=fullGraph?'GeobloxLoading':'LoadingMicroKernel';
options.classpath=[path.join(family==='mdct-frame-remat'?path.join(player,'mdct'):fullGraph||directMusic||originalFlow||family==='frame-remat'?player:directory,'classes')];options.jit.compileWorker=false;
options.jit.preparationPolicy={entryMethods:[mainClass+'.main([Ljava/lang/String;)V']};
const receiverTokenFamily=family.startsWith('receiver-token-')||family==='receiver-caller-code';
const intTreePrefixRows=[];let intrinsicCacheUsage;const instanceReferenceRows=new Map();const staticValueBlockRows=new Map();let referenceElementBound;const referenceElementRows=new Map();let receiverTokenOperations;const rootStaticRows=new Map();const receiverFieldPlans=new Map();let identityAssembly;const receiverOriginRows=new Map();
let buildSsa,buildCfg,frameLiveness,numericLocals,inlineCalls,stableHeaders,elementAvailability,numericKernel,buildNumericKernel;const referenceStoreRows=new Map();const numericKernelRows=new Map();const elementBoundRows=new Map();const proofCensus=[],translationFailures=[],headerCensus=[],checkpointCensus=[],checkpointPlans=new WeakMap(),staticLoopCensus=[],staticRegionBounds=new WeakMap(),fieldArrayPlans=new WeakMap(),fieldArrayCensus=[];
const preloadModules=family==='native-unary-cache'?['src/jit/nativeUnaryIntrinsicCache.js']:family==='reference-element-bound'?['src/jit/referenceElementReuseBound.js']:family==='receiver-origin-bound'?['src/jit/wasmShared.js']:numericKernelFamily?['src/jit/nativeNumericKernelPlan.js',...(numericKernelCode?['src/jit/nativeNumericKernel.js']:[])]:elementBound?['src/jit/nativeElementAvailability.js']:family==='ssa-liveness'?['src/analysis/frameLocalLiveness.js','src/jit/stackifyNumericValues.js']:
 family==='inlined-lifetimes'||family.endsWith('frame-remat')?['src/jit/wasmInline.js','src/jit/stackifyNumericValues.js']:family==='packet-metadata'?['src/jit/stableArrayHeaders.js']:[];
const {JVM}=await loadArchivedJvm(path.resolve(here,'../../../java-tools'),revision,{preloadModules,observeModule:({filename,exports})=>{
 if(family==='int-tree-prefix-shape'&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translateBody;
  exports.prototype.translateBody=function(...args){const meta=translate.apply(this,args);
   if(meta?.bytes&&this.className==='VorbisCodebook'&&this.method.name==='readVector'){
    const describe=node=>({id:node.id,op:node.op,kind:node.kind,args:node.args?.map(value=>value.id),imm:node.imm});
    const plan=this.nativeStaticArrayBody;
    intTreePrefixRows.push({key:this.className+'.'+this.method.name+this.method.descriptor,
     stateful:!!plan?.stateful,entry:this.cfg.entry,structuredResume:meta.structuredResumeEntry,
     params:this.fn.params.map(describe),
     fields:[...(plan?.instanceReads||[])].map(([id,read])=>({id,field:read.slot.key,receiver:read.receiver.id,array:!!read.array,slot:read.slot.index})),
     statics:[...(plan?.reads||[])].map(([id,field])=>({id,owner:field.owner,address:field.native.address})),
     scalars:[...(plan?.scalarSites||[])].map(([id,field])=>({id,owner:field.owner,address:field.native.address,write:!!field.write})),
     blocks:this.fn.blocks.map(block=>({id:block.id,predIds:block.predIds,phis:block.phis.map(describe),body:block.body.map(describe),
      term:{kind:block.term.kind,op:block.term.insnOp,args:block.term.args?.map(value=>value.id),taken:block.term.taken,fall:block.term.fall,target:block.term.target}}))});
   }return meta;
  };
 }
 if(family==='native-unary-cache'&&filename.endsWith('/src/jit/nativeUnaryIntrinsicCache.js'))intrinsicCacheUsage=exports.nativeUnaryIntrinsicCacheUsage;
 if(family==='instance-reference-code'&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translateBody;
  exports.prototype.translateBody=function(...args){const meta=translate.apply(this,args);
   if(meta?.bytes&&this.className==='VorbisCodebook'&&this.method.name==='readVector'){
    instanceReferenceRows.set(meta,{key:this.className+'.'+this.method.name+this.method.descriptor,
     recipes:meta.nativeInstanceReferenceRecipeCount||0,statefulSites:meta.nativeStaticStateBodySites,
     structuredResume:meta.structuredResumeEntry,
     fields:[...(this.nativeStaticArrayBody?.instanceReferenceRecipes?.entries()||[])].map(([id,read])=>({id,field:read.slot.key,slot:read.slot.index}))});
   }return meta;
  };
 }
 if(family.startsWith('static-value-block-')&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translateBody;
  exports.prototype.translateBody=function(...args){const meta=translate.apply(this,args);
   if(meta?.bytes&&['VorbisCodebook','MusicDecoder'].includes(this.className)){
    const key=this.className+'.'+this.method.name+this.method.descriptor;
    if(['VorbisCodebook.readVector()[F','MusicDecoder.readBit()I','MusicDecoder.readBits(I)I'].includes(key))
     staticValueBlockRows.set(meta,{key,blocks:meta.nativeStaticValueBlockCount,statefulSites:meta.nativeStaticStateBodySites,elidedStores:meta.nativeStaticOverwrittenStoreCount||0,
      scalars:[...(this.nativeStaticArrayBody?.scalars.values()||[])].map(field=>({owner:field.owner,address:field.native.address,blockType:field.native.blockType,slot:field.native.slot}))});
   }return meta;
  };
 }
 if(family==='reference-element-bound'&&filename.endsWith('/src/jit/referenceElementReuseBound.js'))referenceElementBound=exports.analyze;
 if(family==='reference-element-bound'&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translateBody;
  exports.prototype.translateBody=function(...args){const meta=translate.apply(this,args);
   if(meta?.bytes&&['MusicDecoder','VorbisResidue','VorbisCodebook','Bzip2Decoder'].includes(this.className)){
    const bound=referenceElementBound(this.fn,this.cfg),describe=node=>({id:node.id,op:node.op,block:node.block,item:node.itemIdx,...(node.imm?{imm:node.imm}:{})});
    referenceElementRows.set(meta,{key:this.className+'.'+this.method.name+this.method.descriptor,
     complete:bound.complete,reason:bound.reason||null,work:bound.work,
     existingElementCaches:[...this.fieldCaches.values()].filter(cache=>cache.kind==='e').length,
     sites:bound.sites.map(site=>({node:describe(site.node),array:describe(site.array),index:describe(site.index),
      cycleBlocks:site.component.length,calls:site.calls.map(node=>({op:node.op,target:node.imm?.slice(1)}))}))});
   }return meta;
  };
 }
 if(family.startsWith('root-static-')&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translateBody;
  exports.prototype.translateBody=function(...args){const meta=translate.apply(this,args);
   if(meta?.bytes&&['VorbisCodebook','VorbisResidue','MusicDecoder'].includes(this.className)){
    const key=this.className+'.'+this.method.name+this.method.descriptor;
    if(['VorbisCodebook.readScalar()I','VorbisCodebook.readVector()[F','VorbisResidue.decodeResidue([FIZ)V','MusicDecoder.decodePacket(I)[F'].includes(key)){
     const original=this.method.attributes.find(a=>a.type==='code').code.codeItems;
     rootStaticRows.set(meta,{key,inlined:meta.inlinedCalls,activations:meta.inlineActivationSiteCount,
      statefulSites:meta.nativeStaticStateBodySites,fieldSites:meta.nativeStaticStateInstanceFieldSites,wasmBytes:meta.bytes.length,
      parameterArrayABI:meta.parameterArrayABI,parameterObjectABI:meta.parameterObjectABI,
      staticFrames:[...new Set([...(this.inlineActivations?.values()||[])].filter(a=>a.method.flags?.includes('static')).map(a=>a.className+'.'+a.method.name+a.method.descriptor))],
      roots:original.filter(item=>item.instruction?.op==='invokestatic').map(item=>({target:item.instruction.arg.slice(1),
       ownerState:this.jvm.classInitializationState.get(item.instruction.arg[1])||'UNINITIALIZED'}))});
    }
   }return meta;
  };
 }
 if(receiverTokenFamily&&filename.endsWith('/src/core/nativeReceiverToken.js'))receiverTokenOperations=exports.getNativeReceiverTokenOps();
 if(family==='receiver-token-code'&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translateBody;
  exports.prototype.translateBody=function(...args){
   const meta=translate.apply(this,args);
   if(meta?.bytes&&this.className==='VorbisCodebook'&&this.method.name==='readVector'){
    const fields=[];
    for(const [id,read]of this.nativeStaticArrayBody?.instanceReads||[]){
     if(read.slot.referenceArrayIndex===undefined)continue;
     const node=this.fn.values.find(v=>v.id===id),cache=this.objCaches.get(id);
     fields.push({field:read.slot.key,item:node.itemIdx,block:read.block,raw:cache.store,typed:cache.typedStore,storeFilled:cache.storeFilled});
    }
    receiverFieldPlans.set(meta,{fields,tailLoads:this.nativeStaticArrayBody?.tailLoads||0,
     loopResumeHeader:this.loopResume?.header??null,declaredLocals:this.declared.length});
   }
   return meta;
  };
 }
 if(family==='receiver-origin-bound'&&filename.endsWith('/src/jit/wasmShared.js'))identityAssembly=exports;
 if(family==='receiver-origin-bound'&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translateBody;
  exports.prototype.translateBody=function(...args){
   const meta=translate.apply(this,args);
   if(meta?.bytes&&this.pairedStorageCalls?.size&&!receiverOriginRows.has(meta)){
    const identity=value=>this.fn.referenceFacts.identity(value);
    const calls=[...this.pairedStorageCalls.keys()].map(node=>({item:node.itemIdx,block:node.block,callee:node.imm.slice(1),
     references:node.args.map((value,index)=>({value,index})).filter(({value})=>value.kind==='A').map(({value,index})=>{
      const root=identity(value),container=root.op==='aaload'?identity(root.args[0]):null;
      return {index,value:value.id,root:root.id,op:root.op,
       ...(container?{container:container.id,containerOp:container.op,containerField:container.imm,
        elementIndex:root.args[1].id,emittedNativeRead:this.nativeReferenceArraySites?.has(root.id)||false}:{}),
       ordinaryParameter:this.fn.params.includes(root)};
     })}));
    receiverOriginRows.set(meta,{key:this.className+'.'+this.method.name+this.method.descriptor,calls});
   }
   return meta;
  };
 }
 if(family==='native-reference-store-coverage'&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translateBody;
  exports.prototype.translateBody=function(...args){
   const meta=translate.apply(this,args);
   if(meta?.bytes&&!referenceStoreRows.has(meta)&&this.fn){
    const stores=this.fn.blocks.filter(b=>this.fn.reachable.has(b.id)).flatMap(b=>b.body.filter(n=>n.op==='aastore'));
    if(stores.length||this.className==='VorbisCodebook'&&this.method.name==='<init>')referenceStoreRows.set(meta,{key:this.className+'.'+this.method.name+this.method.descriptor,
     emittedSites:meta.nativeReferenceStoreSites||0,normalFlowFullyCompiled:!!meta.normalFlowFullyCompiled,stores:stores.map(n=>{
      const root=this.fn.referenceFacts.identity(n.args[2]),value=this.fn.referenceFacts.get(root),array=this.fn.referenceFacts.get(n.args[0]);
      return {item:n.itemIdx,block:n.block,demoted:this.demoted.has(n.block),admitted:!!this.nativeReferenceStorePlan?.sites.has(n.id),
       valueOp:root.op,valueType:value.exactType,valueBounds:value.upperBounds,arrayType:array.exactType,arrayBounds:array.upperBounds};})});
   }
   return meta;
  };
 }
 if(numericKernelFamily&&filename.endsWith('/src/jit/nativeNumericKernelPlan.js'))numericKernel=family.startsWith('native-region-kernel-')?exports.analyzeRegions:exports.analyze;
 if(numericKernelFamily&&filename.endsWith('/src/jit/nativeNumericKernel.js'))buildNumericKernel=exports.build;
 if(numericKernelFamily&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translateBody;
  exports.prototype.translateBody=function(...args){
   const meta=translate.apply(this,args);
   if(meta?.bytes&&!numericKernelRows.has(meta)&&(['VorbisCodebook','VorbisResidue','MusicDecoder','MusicDecodeStage'].includes(this.className)||numericKernelMicro&&(this.className.startsWith('MicroHuffman')||this.className==='LoadingMicroKernel'&&this.method.name.startsWith('huffman')))){
    const before=[this.nextLocal,this.declared.length,this.importDecls.length],bound=numericKernel(this);
    assert.deepEqual([this.nextLocal,this.declared.length,this.importDecls.length],before,'Numeric kernel bound changed code generation');
    const kernels=[];
    if(numericKernelCode)for(const plan of bound.plans||bound.regions.flatMap(region=>region.plans))if(!plan.refused&&
      (family.startsWith('native-region-kernel-')&&numericKernelCode?this.regionKernelWorkers?.has(plan.header):!this.numericKernelWorkers||this.numericKernelWorkers.has(plan.header))){
     const kernel=(family.startsWith('native-region-kernel-')&&numericKernelCode?this.regionKernelWorkers:this.numericKernelWorkers)?.get(plan.header)||buildNumericKernel(this,plan.header),module=kernel.module||new WebAssembly.Module(kernel.bytes);
     if(family==='native-region-kernel-bounds-code'&&!kernel.boundsElisions?.length)continue;
     if(family==='native-region-kernel-slice-code'&&!kernel.numericSlice?.omitted.length)continue;
     const imports=WebAssembly.Module.imports(module);
     const coldGlobals=kernel.coldGlobals||[];
     assert.deepEqual(imports,[{module:'env',name:'mem',kind:'memory'},...coldGlobals.map(g=>({module:'env',name:g.name,kind:'global'}))],'Kernel has a host-call or unbound import');
     assert.ok([...kernel.params,...kernel.results,...coldGlobals].every(b=>[0x7f,0x7e,0x7d,0x7c].includes(b.type)),'Non-numeric kernel boundary');
     const wat=execFileSync('wasm-dis',['--all-features','-'],{input:kernel.bytes,encoding:'utf8',maxBuffer:4*1024*1024});
     const operations={};
     const visit=node=>{if(!Array.isArray(node))return;if(typeof node[0]==='string')operations[node[0]]=(operations[node[0]]||0)+1;for(const child of node)visit(child);};
     visit(parseWat(wat));
     assert.ok(!Object.keys(operations).some(op=>op.startsWith('call')||/^(ref|struct|array)\./.test(op)),'Kernel carries opaque calls or GC context');
     const machineCode=nativeSummary(nativeCode(kernel.bytes,0));
     kernels.push({header:plan.header,moduleBytes:kernel.bytes.length,params:kernel.params,results:kernel.results,
      outcomeIndex:kernel.outcomeIndex||null,normalBoundaryOmissions:kernel.plan.projectedNormalBoundary?.omitted.length||0,
      boundsElisions:kernel.boundsElisions||[],numericLocalCount:kernel.numericLocalCount,logicalResults:kernel.logicalResults||kernel.results,coldGlobals,coldPackets:kernel.coldPackets||null,coldStateRefusal:kernel.coldStateRefusal||null,numericSlice:kernel.numericSlice||null,normalExits:kernel.normalExits,fuelReason:kernel.fuelReason,
      faultReasons:kernel.faultReasons,imports,operations,machineCode});
    }
    assert.deepEqual([this.nextLocal,this.declared.length,this.importDecls.length],before,'Kernel prototype changed the installed method');
    numericKernelRows.set(meta,{key:this.className+'.'+this.method.name+this.method.descriptor,...bound,installedWorkers:meta.nativeRegionKernelCount||meta.nativeNumericKernelCount||0,installedWorkerBytes:meta.nativeRegionKernelBytes||meta.nativeNumericKernelBytes||0,...(numericKernelCode?{kernels}:{})});
   }
   return meta;
  };
 }
 if(elementBound&&filename.endsWith('/src/jit/nativeElementAvailability.js'))elementAvailability=exports.analyze;
 if(elementBound&&filename.endsWith('/src/jit/StructuredWasmCompiler.js')){
  const translate=exports.prototype.translateBody;
  exports.prototype.translateBody=function(...args){
   const meta=translate.apply(this,args);
   if(meta?.bytes&&!elementBoundRows.has(meta)&&(['VorbisCodebook','VorbisResidue','MusicDecoder','MusicDecodeStage'].includes(this.className)||family==='native-element-micro'&&(this.className.startsWith('MicroHuffman')||this.className==='LoadingMicroKernel'&&this.method.name.startsWith('huffman')))){
    const before=[this.nextLocal,this.declared.length,this.importDecls.length],bound=elementAvailability(this);
    assert.deepEqual([this.nextLocal,this.declared.length,this.importDecls.length],before,'Availability bound changed code generation');
    const pairs=[...bound.pairs].map(([to,from])=>({op:to.op,from:from.itemIdx,to:to.itemIdx,
     fromBlock:from.block,toBlock:to.block,index:to.args[1].id,originalArray:from.args[0].id,laterArray:to.args[0].id}));
    elementBoundRows.set(meta,{key:this.className+'.'+this.method.name+this.method.descriptor,
     stateful:!!this.nativeStaticArrayBody?.stateful,reason:bound.reason,pairs,captures:bound.sources.size,
     emittedReuseSites:meta.nativeElementReuseSiteCount||0,emittedCaptures:meta.nativeElementCaptureCount||0,
     roots:[...bound.roots],barriers:bound.barriers||0,work:bound.work||0,moduleBytes:meta.bytes.length});
   }
   return meta;
  };
 }
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
if(family==='int-tree-prefix-shape'){
 const observation={sourceRevision:revision,rows:intTreePrefixRows,guestTicks:ticks,assetCalls,mainExecuted:false,
  note:'New exact integer-tree traversal and bit-state SSA shape question only; no Java/oracle execution, baseline replay, timing or CPU attribution.',measuredAt:new Date().toISOString()};
 console.log(JSON.stringify(observation,null,2));assert.ok(intTreePrefixRows.some(row=>row.stateful),'Actual vector must retain its existing ownership/effect proof');
 const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.intTreePrefixCache||={shapeObservations:[]}).shapeObservations.push(observation);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');process.exit(0);
}
if(family==='native-unary-cache'){
 const rows=[],seen=new Set();
 for(const state of j.jit.wasmJit.compiled)for(const meta of [state.meta,state.callee?.meta,state.osr?.meta]){
  if(!meta||seen.has(meta)||!meta.nativeUnaryIntrinsicCacheBindings)continue;seen.add(meta);
  rows.push({key:state.key,
   bindings:meta.nativeUnaryIntrinsicCacheBindings,inlineSites:meta.nativeUnaryIntrinsicInlineSites||0,
   memoryImports:WebAssembly.Module.imports(new WebAssembly.Module(meta.bytes)).filter(entry=>entry.kind==='memory').map(entry=>entry.name),
   wasmBytes:meta.bytes?.length||0});
 }
 const usage=intrinsicCacheUsage(j),observation={sourceRevision:revision,rows,usage,guestTicks:ticks,assetCalls,mainExecuted:false,
  note:'New bounded pure-native intrinsic cache admission only; no guest/oracle execution, baseline replay, timer or CPU attribution.',measuredAt:new Date().toISOString()};
 console.log(JSON.stringify(observation,null,2));
 assert.ok(rows.length&&usage.names.includes('sin'),'Actual preparation must install the new intrinsic');
 assert.ok(usage.bytes<=usage.limitBytes,'Shared per-VM cache allocation exceeds its fixed budget');
 const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.nativeUnaryIntrinsicCache||={codeObservations:[]}).codeObservations.push(observation);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');process.exit(0);
}
if(family==='instance-reference-code'){
 const rows=[],seen=new Set();
 for(const state of j.jit.wasmJit.compiled)for(const meta of [state.meta,state.callee?.meta,state.osr?.meta]){
  if(!meta||seen.has(meta)||!instanceReferenceRows.has(meta))continue;seen.add(meta);const row={...instanceReferenceRows.get(meta)};
  const wat=execFileSync('wasm-dis',['--all-features','-'],{input:meta.bytes,encoding:'utf8',maxBuffer:4*1024*1024}),module=parseWat(wat);
  const exported=module.find(n=>n?.[0]==='export'&&n[1]===JSON.stringify('canonicalCompactStorageRun'));assert.ok(exported,'Actual vector lacks its private typed entry');
  const shape=codeShape(wat,exported[2][1]),native=nativeCode(meta.bytes,shape.index);row.code={...shape,...nativeSummary(native)};
  const imports=new Map(module.filter(n=>n?.[0]==='import'&&n[3]?.[0]==='func').map(n=>[n[3][1],JSON.parse(n[2])]));
  const slots=new Set(row.fields.map(f=>String(f.slot))),accesses=[];
  const visit=(n,loop=false,calls=[])=>{if(!Array.isArray(n))return;loop||=n[0]==='loop';if(n[0]==='call')calls=[...calls,imports.get(n[1])||n[1]];
   if(n[0]==='array.get'&&n[1]==='$0'&&n.at(-1)?.[0]==='i32.const'&&slots.has(n.at(-1)[1]))accesses.push({loop,calls,slot:n.at(-1)[1]});
   for(const child of n)visit(child,loop,calls);};
  visit(module.find(n=>n?.[0]==='func'&&n[1]===exported[2][1]));row.referenceMaterializations=accesses;row.wasmBytes=meta.bytes.length;
  fs.writeFileSync(path.join(directory,'current.wat'),wat);fs.writeFileSync(path.join(directory,'current-jvm-native.txt'),native);rows.push(row);
 }
 const observation={sourceRevision:revision,rows,guestTicks:ticks,assetCalls,mainExecuted:false,
  note:'New readonly instance-reference code question. No Java/oracle execution, CPU profiling, known baseline code identity or timing.',measuredAt:new Date().toISOString()};
 console.log(JSON.stringify(observation,null,2));assert.ok(rows.some(row=>row.recipes>0&&row.statefulSites>0&&!row.structuredResume),'Actual vector did not earn the fresh-only reference proof');
 const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.instanceReferenceRecipes||={codeObservations:[]}).codeObservations.push(observation);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');process.exit(0);
}
if(family.startsWith('static-value-block-')){
 const rows=[],seen=new Set();
 for(const state of j.jit.wasmJit.compiled)for(const meta of [state.meta,state.callee?.meta,state.osr?.meta]){
  if(!meta||seen.has(meta)||!staticValueBlockRows.has(meta))continue;seen.add(meta);const row={...staticValueBlockRows.get(meta)};
  if(row.key==='VorbisCodebook.readVector()[F'){
   const wat=execFileSync('wasm-dis',['--all-features','-'],{input:meta.bytes,encoding:'utf8',maxBuffer:4*1024*1024});
   row.typedStaticStores=(wat.match(/\(struct\.set \$2 /g)||[]).length;
   row.typedStaticReads=(wat.match(/\(struct\.get \$2 /g)||[]).length;
   row.wasmBytes=meta.bytes.length;fs.writeFileSync(path.join(directory,'current.wat'),wat);
   if(['static-value-block-native','static-value-block-elision'].includes(family)){
    const module=parseWat(wat),exported=module.find(n=>n?.[0]==='export'&&n[1]===JSON.stringify('canonicalCompactStorageRun'));
    assert.ok(exported,'Actual vector lacks its typed native entry');const shape=codeShape(wat,exported[2][1]),native=nativeCode(meta.bytes,shape.index);
    row.native={...shape,...nativeSummary(native)};fs.writeFileSync(path.join(directory,'current-jvm-native.txt'),native);
   }
  }rows.push(row);
 }
 const observation={sourceRevision:revision,family,rows,guestTicks:ticks,assetCalls,mainExecuted:false,
  note:'Changed static-value representation only. Actual vector code must use typed static reads/stores. No Java/oracle execution, CPU profiling, baseline identity check or timing.',measuredAt:new Date().toISOString()};
 console.log(JSON.stringify(observation,null,2));
 assert.ok(rows.some(row=>row.key==='VorbisCodebook.readVector()[F'&&row.blocks>0&&row.statefulSites>0&&row.typedStaticStores>=2),'Actual vector did not consume the disjoint static payload');
 if(family==='static-value-block-elision')assert.ok(rows.some(row=>row.key==='VorbisCodebook.readVector()[F'&&row.elidedStores===1&&row.native.operations['struct.set']===2),'Actual vector did not remove precisely its overwritten publication');
 const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.staticValueBlocks||={codeObservations:[]}).codeObservations.push(observation);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');process.exit(0);
}
if(family==='reference-element-bound'){
 const rows=[],seen=new Set();
 for(const state of j.jit.wasmJit.compiled)for(const meta of [state.meta,state.callee?.meta,state.osr?.meta]){
  if(!meta||seen.has(meta)||!referenceElementRows.has(meta))continue;seen.add(meta);rows.push(referenceElementRows.get(meta));
 }
 const observation={sourceRevision:revision,rows,guestTicks:ticks,assetCalls,mainExecuted:false,
  note:'New preparation-only opportunity bound. No reuse is authorized; native array identity, mutation generation and actual index would still need checking. No timing, profiling, oracle execution or known-control replay.',measuredAt:new Date().toISOString()};
 console.log(JSON.stringify(observation,null,2));
 const residue=rows.find(row=>row.key==='VorbisResidue.decodeResidue([FIZ)V');
 assert.ok(residue?.complete&&residue.sites.some(site=>site.index.imm?.[2]?.[0]==='classbookIndex'),'Missing actual repeated classbook-index opportunity');
 const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.referenceElementReuseBound||={observations:[]}).observations.push(observation);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');process.exit(0);
}
if(family.startsWith('root-static-')){
 const w=j.jit.wasmJit,rows=[],seen=new Set();
 for(const state of w.compiled)for(const meta of [state.meta,state.callee?.meta,state.osr?.meta]){
  if(!meta||seen.has(meta)||!rootStaticRows.has(meta))continue;seen.add(meta);const row={...rootStaticRows.get(meta)};
  if(family==='root-static-code'&&row.key==='VorbisResidue.decodeResidue([FIZ)V'&&row.inlined===0){
   const wat=execFileSync('wasm-dis',['--all-features','-'],{input:meta.bytes,encoding:'utf8',maxBuffer:4*1024*1024});
   const core=[...wat.matchAll(/^ \(func (\$[^\s(]+)/gm)].find(m=>m[1].startsWith('$jvm$wasm$')&&m[1].includes('VorbisResidue'));
   assert.ok(core,'Missing actual retained-callee caller core');const shape=codeShape(wat,core[1]),native=nativeCode(meta.bytes,shape.index);
   row.code={...shape,...nativeSummary(native)};fs.writeFileSync(path.join(directory,'current.wat'),wat);fs.writeFileSync(path.join(directory,'current-jvm-native.txt'),native);
  }
  rows.push(row);
 }
 const observation={sourceRevision:revision,family,rows,guestTicks:ticks,assetCalls,mainExecuted:false,
  note:'New root static activation and native-stateful admission question only. No guest/TeaVM execution, timing, CPU attribution or known-control replay.',measuredAt:new Date().toISOString()};
 const current=JSON.parse(fs.readFileSync(reportPath));((current.optimizationTrials.rootStaticActivations||={}).codeObservations||=[]).push(observation);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify(observation,null,2));
 assert.ok(rows.some(row=>row.key==='VorbisCodebook.readScalar()I'&&row.statefulSites>0&&row.activations>0),'Actual scalar did not earn the stronger native proof');
 if(family==='root-static-code')assert.ok(rows.some(row=>row.key==='VorbisResidue.decodeResidue([FIZ)V'&&row.inlined===0&&row.code),'Actual allocating caller did not retain the certified scalar callee');
 if(family==='root-static-guards'){const packet=rows.find(row=>row.key==='MusicDecoder.decodePacket(I)[F');assert.ok(packet,'Actual packet is missing');assert.ok(packet.staticFrames.length>0&&packet.staticFrames.every(name=>name==='MusicDecoder.readBit()I'),'Packet admitted an unrelated cold root static leaf');}
 process.exit(0);
}
if(receiverTokenFamily){
 const w=j.jit.wasmJit,seen=new Set(),rows=[];
 for(const state of w.compiled)for(const meta of [state.meta,state.callee?.meta,state.osr?.meta]){
  if(!meta||seen.has(meta))continue;seen.add(meta);
  if(!meta.nativeReceiverTokenEntry&&!meta.nativeReceiverTokenCallSites)continue;
  if(meta.nativeReceiverTokenEntry)assert.equal(meta.nativeReceiverTokenEntry.run,meta.canonicalCompactStorageRun,'Private entry is not the actual guarded export');
  const intrinsicNames={native_receiver_capture:'capture',native_receiver_owner:'owner',native_receiver_store:'store',native_receiver_valid:'valid',native_receiver_is_token:'isToken'};
  const intrinsics=Object.entries(intrinsicNames).filter(([name])=>meta.importObject?.env[name]).map(([name,operation])=>{
   assert.equal(meta.importObject.env[name],receiverTokenOperations[operation],'GC intrinsic acquired a JavaScript forwarding wrapper');return name;
  });
  let code;
  if(family==='receiver-caller-code'&&state.key==='VorbisResidue.decodeResidue([FIZ)V'){
   const wat=execFileSync('wasm-dis',['--all-features','-'],{input:meta.bytes,encoding:'utf8',maxBuffer:8*1024*1024});
   const core=[...wat.matchAll(/^ \(func (\$[^\s(]+)/gm)].find(m=>m[1].startsWith('$jvm$wasm$')&&m[1].includes('VorbisResidue'));
   assert.ok(core,'Missing actual residue core');
   const shape=codeShape(wat,core[1],true),native=nativeCode(meta.bytes,shape.index);
   const imports=new Map([...wat.matchAll(/^ \(import "[^"]+" "([^"]+)" \(func (\$[^\s(]+)/gm)].map(m=>[m[2],m[1]]));
   fs.writeFileSync(path.join(directory,'current.wat'),wat);fs.writeFileSync(path.join(directory,'current-jvm-native.txt'),native);
   const teaWat=fs.readFileSync(path.join(player,'vorbis/current-teavm.wat'),'utf8'),tea=codeShape(teaWat,'$590',true);
   code={...shape,...nativeSummary(native),parameterArrayABI:meta.parameterArrayABI,parameterObjectABI:meta.parameterObjectABI,
    calls:shape.callSites.map(site=>({...site,import:imports.get(site.target)||null})),
    teaVm:{...tea,source:'Existing saved Vorbis WAT; no regeneration, code-identity check, native compilation or execution'},
    note:'Actual residue caller code and static call placement, including cold paths; not dynamic execution counts or CPU attribution.'};
   assert.ok(code.calls.some(site=>site.import==='native_receiver_token'),'Selected caller lacks the proved receiver factory');
  }
  if(family==='receiver-token-code'&&state.key==='VorbisCodebook.readVector()[F'){
   const wat=execFileSync('wasm-dis',['--all-features','-'],{input:meta.bytes,encoding:'utf8',maxBuffer:4*1024*1024});
   const core=[...wat.matchAll(/^ \(func (\$[^\s(]+)/gm)].find(m=>m[1].startsWith('$jvm$wasm$')&&m[1].includes('VorbisCodebook'));
   assert.ok(core,'Missing actual vector core');
   const shape=codeShape(wat,core[1]),native=nativeCode(meta.bytes,shape.index);
   fs.writeFileSync(path.join(directory,'current.wat'),wat);fs.writeFileSync(path.join(directory,'current-jvm-native.txt'),native);
   code={...shape,...nativeSummary(native),...receiverFieldPlans.get(meta),
    stackAddressSites:(native.slice(native.indexOf('Instructions (size'),native.indexOf('\nSource positions:')).match(/\[(?:r|e)[bs]p[^\]]*\]/g)||[]).length};
   assert.equal(code.fields.length,1,'Missing exact companion-store field lifetime');
  }
  rows.push({key:state.key,entry:!!meta.nativeReceiverTokenEntry?.run,callSites:meta.nativeReceiverTokenCallSites||0,wasmBytes:meta.bytes.length,intrinsics,...(code?{code}:{})});
 }
 const bindings=[...w.canonicalDirectLinks.bySlot.values()].filter(b=>b.receiverTokenIndex!==undefined).map(b=>({key:b.key,index:b.receiverTokenIndex,published:w.canonicalDirectLinks.table.get(b.slot)!==b.stub}));
 const intendedEntryInstalled=rows.some(row=>row.key==='VorbisCodebook.readVector()[F'&&row.entry),intendedCallInstalled=rows.some(row=>row.key==='VorbisResidue.decodeResidue([FIZ)V'&&row.callSites>0);
 const result={sourceRevision:revision,family,compileOnly:true,guestTicks:ticks,assetCalls,mainExecuted:false,intendedEntryInstalled,intendedCallInstalled,rows,bindings,
  note:family==='receiver-caller-code'?'New actual residue caller code and static call-placement comparison with existing TeaVM WAT. No guest or TeaVM execution, timing, CPU attribution or known-control replay.':family==='receiver-token-code'?'New actual vector core/native-code and field-metadata lifetime question. No guest execution, known-control identity check, baseline/oracle replay, timing or CPU profiling.':'Actual tagged receiver entries, private live-table contracts and pure Wasm GC intrinsic imports. No guest invocation, old baseline/oracle replay, CPU profiling or timing.',measuredAt:new Date().toISOString()};
 const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.nativeReceiverTokens||={codeObservations:[]}).codeObservations.push(result);fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 assert.ok(intendedEntryInstalled&&intendedCallInstalled,'Original token route did not install');process.exit(0);
}
if(family==='receiver-origin-bound'){
 const active=new Set(j.jit.wasmJit.compiled.flatMap(s=>[s.meta,s.callee?.meta,s.osr?.meta]));
 const rows=[...receiverOriginRows].filter(([meta])=>active.has(meta)).map(([,row])=>row);
 assert.ok(rows.length,'No actual paired call shapes were observed');
 const {T,OP,assembleModule}=identityAssembly;
 const hostEqualityBytes=assembleModule({importDecls:[],mainParams:[T.ref,T.ref],mainResults:[T.i32],declared:[],
  body:[OP.local_get,0,0xfb,0x1a,OP.local_get,1,0xfb,0x1a,0xd3,OP.end]});
 let hostEqualityError;
 try{new WebAssembly.Module(hostEqualityBytes);}catch(error){hostEqualityError=error.message;}
 assert.match(hostEqualityError||'',/ref\.eq.*eqref.*anyref/,'Opaque host identity needs a new supported proof');
 const typeTestBytes=assembleModule({importDecls:[],mainParams:[T.ref],mainResults:[T.i32],declared:[],
  body:[OP.local_get,0,0xfb,0x1a,0xfb,0x14,0x6d,OP.end]});
 const typeTest=new WebAssembly.Instance(new WebAssembly.Module(typeTestBytes)).exports.run;
 const hostObjectEqref=typeTest({fields:{}});assert.equal(hostObjectEqref,0);
 const result={sourceRevision:revision,family,analysisOnly:true,guestTicks:ticks,assetCalls,mainExecuted:false,rows,
  hostIdentity:{hostEqualityError,hostObjectEqref},
  note:'New argument-origin and host-reference-type questions only. No guest workload, oracle, baseline/code identity replay, timing or CPU attribution. Native element-read emission is not a proven ownership certificate.',measuredAt:new Date().toISOString()};
 const current=JSON.parse(fs.readFileSync(reportPath));
 (current.optimizationTrials.nativeCallCode||={observations:[]}).observations.push(result);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(0);
}
if(numericKernelFamily){
 const active=new Set(j.jit.wasmJit.compiled.flatMap(s=>[s.meta,s.callee?.meta,s.osr?.meta]));
 const rows=[...numericKernelRows].filter(([meta])=>active.has(meta)).map(([,row])=>row);
 assert.ok(rows.some(row=>family.startsWith('native-region-kernel-')?row.key==='MusicDecoder.decodePacket(I)[F':numericKernelMicro?row.key.startsWith('LoadingMicroKernel.huffmanInline('):row.key==='VorbisCodebook.readVector()[F'),'Missing intended method');
 if(numericKernelCode)assert.ok(rows.some(row=>(family.startsWith('native-region-kernel-')&&numericKernelCode?row.key==='MusicDecoder.decodePacket(I)[F':numericKernelMicro?row.key.startsWith('LoadingMicroKernel.huffmanInline('):row.key==='VorbisCodebook.readVector()[F')&&row.kernels?.length),'Intended traversal kernel was not generated');
 const result={sourceRevision:revision,family,analysisOnly:!numericKernelCode,installed:rows.some(row=>row.installedWorkers),guestTicks:ticks,assetCalls,mainExecuted:false,rows,
  note:numericKernelCode?'New numeric-only helper generated/validated and its optimizing code inspected. No helper or guest executes; no baseline replay, timing or CPU attribution.':'Planning bound only; normal prepared code generation is unchanged. No Java/helper execution, control replay, timing, fingerprint or CPU attribution.',measuredAt:new Date().toISOString()};
 const current=JSON.parse(fs.readFileSync(reportPath)),trial=(current.optimizationTrials.nativeNumericKernels||={});
 (trial[numericKernelCode?'codeObservations':'boundObservations']||=[]).push(result);fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));process.exit(0);
}
if(elementBound){
 const active=new Set(j.jit.wasmJit.compiled.flatMap(s=>[s.meta,s.callee?.meta,s.osr?.meta]));
 const rows=[...elementBoundRows].filter(([meta])=>active.has(meta)).map(([,row])=>row);
 assert.ok(rows.some(row=>family==='native-element-micro'?row.key.startsWith('LoadingMicroKernel.huffmanInline('):row.key==='VorbisCodebook.readVector()[F'),'Missing intended traversal method');
 const result={sourceRevision:revision,family,analysisOnly:true,guestTicks:ticks,assetCalls,mainExecuted:false,rows,
  note:'New native-only disjoint-effect availability bound. No replacement graph emits or executes, no baseline identity/timing check or CPU attribution.',measuredAt:new Date().toISOString()};
 const current=JSON.parse(fs.readFileSync(reportPath)),trial=(current.optimizationTrials.nativeElementAvailability||={});
 (trial.boundObservations||=[]).push(result);fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));process.exit(0);
}
if(['constant-inline-coverage','nested-constant-inline-coverage'].includes(family)){
 const rows=j.jit.wasmJit.compiled.flatMap(s=>{
  const seen=new Set();return [['entry',s.meta],['callee',s.callee?.meta],['osr',s.osr?.meta]].flatMap(([tier,meta])=>{
   if(!meta||seen.has(meta))return [];seen.add(meta);if(!meta.constantArgumentInlineSites)return [];
   return [{key:s.key,tier,sites:meta.constantArgumentInlineSites,inlined:meta.inlinedCalls,
    normalFlowFullyCompiled:!!meta.normalFlowFullyCompiled,moduleBytes:meta.bytes?.length||0,
    slabSites:meta.slabFieldSites||0,nativeObjectFields:meta.nativeObjectBodyFieldSites||0}];
  });
 });
 const result={sourceRevision:revision,family,compileOnly:true,guestTicks:ticks,assetCalls,mainExecuted:false,rows,
  sites:rows.reduce((n,r)=>n+r.sites,0),scope:'All installed entry/callee/OSR metadata, deduplicated by identity within each state',
  note:'Actual installed constant-sensitive inline coverage, no Java/TeaVM execution or known-control replay.',measuredAt:new Date().toISOString()};
 const current=JSON.parse(fs.readFileSync(reportPath)),trial=(current.optimizationTrials.constantArgumentInlining||={});
 const target=family==='nested-constant-inline-coverage'?(trial.nested||={}):trial;
 (target.codeCoverages||=[]).push(result);
 fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(0);
}
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
if(family==='native-reference-store-coverage'){
 const active=new Set(j.jit.wasmJit.compiled.flatMap(state=>[state.meta,state.callee?.meta,state.osr?.meta]));
 const rows=[...referenceStoreRows].filter(([meta])=>active.has(meta)).map(([,row])=>row);
 const constructor=j.classes.VorbisCodebook.ast.classes[0].items.find(item=>item.type==='method'&&item.method.name==='<init>').method;
 const state=j.jit.wasmJit.state.get(constructor);
 assert.ok(state,'Missing prepared original codebook constructor');
 if(!rows.some(row=>row.key==='VorbisCodebook.<init>()V'))rows.push({key:'VorbisCodebook.<init>()V',status:state.status,
  structured:!!state.meta?.structured,emittedSites:state.meta?.nativeReferenceStoreSites||0,
  normalFlowFullyCompiled:!!state.meta?.normalFlowFullyCompiled,stores:[],structuredFailure:state.structuredFailReason,
  note:'No surviving structured-store census for this constructor; state recorded explicitly.'});
 const result={sourceRevision:revision,family,compileOnly:true,guestTicks:ticks,assetCalls,mainExecuted:false,rows,
  note:'Actual installed reference-store emission and producer-type census only; zero Java execution, timing, CPU attribution or old-control replay.',measuredAt:new Date().toISOString()};
 const current=JSON.parse(fs.readFileSync(reportPath));(current.optimizationTrials.nativeReferenceStores||={}).coverage=result;
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

function walk(node,visit){if(!Array.isArray(node))return;visit(node);for(const child of node)walk(child,visit);}
function codeShape(wat,name,withCalls=false){
 // wasm-dis emits each top-level function on its own indented line. Parse
 // only the selected function, so a full application cannot exhaust the
 // bounded expression parser merely because it contains many other methods.
 const starts=[...wat.matchAll(/^ \(func (\$[^\s(]+)/gm)],at=starts.findIndex(m=>m[1]===name);
 assert.ok(at>=0,'Missing defined function '+name);const start=starts[at].index,end=wat.indexOf('\n )',start);
 assert.ok(end>start,'Missing top-level function end');
 const module=parseWat('(module\n'+wat.slice(start,end+3)+'\n)'),operations={};
 walk(module[1],n=>{if(typeof n[0]==='string')operations[n[0]]=(operations[n[0]]||0)+1;});
 const imports=wat.match(/^ \(import [^\n]*\(func /gm)||[];
 const callSites=[];
 if(withCalls){const visit=(node,depth)=>{if(!Array.isArray(node))return;const next=depth+(node[0]==='loop'?1:0);
  if(node[0]==='call'||node[0]==='call_indirect')callSites.push({kind:node[0],target:typeof node[1]==='string'?node[1]:null,loopDepth:next});
  for(const child of node)visit(child,next);};visit(module[1],0);}
 return {name,index:imports.length+at,operations,...(withCalls?{callSites}:{})};
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
