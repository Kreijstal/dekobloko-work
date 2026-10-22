#!/usr/bin/env node
// Fresh-process decoder/full-loading diagnostics, outside browser acceptance.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {getHeapStatistics} from 'node:v8';
import {freshLoadingBytes} from './browser.mjs';
import {loadArchivedJvm} from './archive-jvm.mjs';
import {vorbisProbeSource} from './workload.mjs';
import {readMeasurementFixture,recordProbeObservation,summarizeExecutionOutcome} from './measurement-fixture.mjs';
const require=createRequire(import.meta.url),root=path.resolve(new URL('../../../java-tools/',import.meta.url).pathname);
const player=path.resolve(process.argv[6]||path.join(os.homedir(),'.cache/dekobloko/geoblox-loading'));
const receiptPath=path.join(player,'benchmark.json');
const {receipt,supplied:fixtureSupplied}=readMeasurementFixture(receiptPath);
const mode=process.argv[2]||'js',asset=process.argv[3]||'1-2.bin',kernel=process.argv[5]||'bzip';
const inspectMethod=process.argv[7];
assert.ok(['js','wasm','canonical','slab','teavm'].includes(mode));assert.ok(['bzip','vorbis','loading'].includes(kernel));
if(inspectMethod)assert.ok(kernel==='vorbis'&&mode==='slab','Method inspection uses the reduced Vorbis diagnostic');
if(kernel==='vorbis')assert.equal(asset,'3-0.bin','Vorbis probe consumes the recorded sample archive');
if(kernel==='loading')assert.equal(asset,'all','Full loading consumes all recorded assets');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const harnessFiles=Object.fromEntries([
 ['probe.mjs',import.meta.url],['archive-jvm.mjs',new URL('./archive-jvm.mjs',import.meta.url)],['browser.mjs',new URL('./browser.mjs',import.meta.url)],
 ['browser-inflater.mjs',new URL('../launcher/browser-loader/browser-inflater.mjs',import.meta.url)],
 ['wasm-optimizer.mjs',new URL('./wasm-optimizer.mjs',import.meta.url)],
 ['wasm-loop-outline.mjs',new URL('./wasm-loop-outline.mjs',import.meta.url)],
 ['workload.mjs',new URL('./workload.mjs',import.meta.url)],
 ['measurement-fixture.mjs',new URL('./measurement-fixture.mjs',import.meta.url)],
].map(([name,url])=>[name,hash(fs.readFileSync(new URL(url)))]));
const assetBytes=name=>{
 const data=fs.readFileSync(path.join(player,'assets',name));assert.equal(hash(data),receipt.assets[name],name);
 return new Int8Array(data);
};
const save=result=>{
 Object.assign(result,{engine:process.version,execArgv:process.execArgv,heapLimitBytes:getHeapStatistics().heap_size_limit,
  harnessSha256:harnessFiles['probe.mjs'],harnessFilesSha256:harnessFiles,mode,asset,kernel,
  fixtureTransport:fixtureSupplied?'stdin-projected':'file-projected',measurementFixtureSha256:hash(JSON.stringify(receipt))});
 if(fixtureSupplied)console.log('PROBE_RESULT '+JSON.stringify(result));
 else {
  const current=JSON.parse(fs.readFileSync(receiptPath));recordProbeObservation(current,result);
  fs.writeFileSync(receiptPath,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }
 assert.equal(result.error,undefined,'Guest execution failed');
 if(mode!=='teavm'){
  assert.deepEqual(result.lateCompiles,[],'Probe attempted compilation during guest execution');
  assert.equal(result.compilation.postMainSyncCompileCount,0,'Probe compiled during guest execution');
 }
 assert.ok(result.equal,'Decoded output differs from reference');
 if(result.wasmOptimizer)assert.deepEqual(result.wasmOptimizer.errors,[],'Wasm optimization failed');
};
for(const [name,expected] of Object.entries(receipt.classes))assert.equal(hash(fs.readFileSync(path.join(player,'classes',name))),expected,name);
if(mode==='teavm'){
 assert.ok(!process.env.JVM_WASM_OPT_DIAGNOSTIC,'Pinned TeaVM bytes are not post-optimized');
 assert.ok(!process.env.JVM_WASM_OUTLINE_DIAGNOSTIC,'Pinned TeaVM bytes are not outlined');
 assert.equal(kernel,'loading','TeaVM mode uses the unchanged full-loading artifact');
 assert.ok(!process.argv[4]||process.argv[4]==='-','TeaVM mode takes no JVM source revision');
 const wasm=fs.readFileSync(path.join(player,'teavm/loading.wasm'));
 assert.equal(hash(wasm),receipt.teavm.wasmSha256,'Pinned TeaVM artifact differs');
 globalThis.loadingAssets=Object.fromEntries(Object.keys(receipt.assets).map(name=>[name,assetBytes(name)]));
 const start=performance.now();
 await import(pathToFileURL(path.join(player,'teavm/loading.wasm-runtime.js')));
 const module=await TeaVM.wasmGC.load(wasm),ready=performance.now(),cpuStart=process.cpuUsage();
 await module.exports.main([]);
 const finished=performance.now(),cpu=process.cpuUsage(cpuStart),check=module.exports.check();
 const musicMs=module.exports.musicMs(),graphicsMs=module.exports.graphicsMs();
 save({runtimeRevision:'TeaVM '+receipt.teavm.version,sourceLoader:'pinned-wasm',wasmSha256:hash(wasm),
  runtimeSha256:hash(fs.readFileSync(path.join(player,'teavm/loading.wasm-runtime.js'))),reference:'Recorded HotSpot checksum',
  fixtureSha256:receipt.workloadSha256,fixtureKind:'loading-workload-source',elapsed:finished-start,hostAndModuleMs:ready-start,
  executionMs:finished-ready,executionCpuMs:(cpu.user+cpu.system)/1000,musicMs,graphicsMs,loadingMs:musicMs+graphicsMs,
  check,equal:check===receipt.referenceCheck});
}else{
const revision=process.argv[4] && process.argv[4]!=='-' && execFileSync('git',['rev-parse','--verify',process.argv[4]+'^{commit}'],{cwd:root,encoding:'utf8'}).trim();
const {JVM}=revision?await loadArchivedJvm(root,revision):require(path.join(root,'src/core/jvm'));
const input=kernel==='loading'?null:assetBytes(asset);
let reference=kernel==='bzip'?execFileSync('python3',['-c',`import bz2,sys
b=sys.stdin.buffer.read();sys.stdout.buffer.write(bz2.decompress(b'BZh1'+b[9:9+int.from_bytes(b[1:5],'big')]))`],{input:Buffer.from(input),maxBuffer:16*1024*1024}):null;
const temporary=kernel==='bzip'?fs.mkdtempSync(path.join(os.tmpdir(),'loading-kernel-')):null;
const probeDirectory=kernel==='vorbis'?path.join(player,'vorbis'):temporary;
let optimizer;
try {
 if(temporary){
 fs.writeFileSync(path.join(temporary,'LoadingKernelProbe.java'),kernel==='vorbis'?vorbisProbeSource():`public class LoadingKernelProbe {
 static native byte[] input(); static byte[] output; static int written;
 public static void main(String[] args) {
  byte[] data=input();int n=((data[5]&255)<<24)|((data[6]&255)<<16)|((data[7]&255)<<8)|(data[8]&255);
  output=new byte[n];written=Bzip2Decoder.decompressInto(output,n,data,data.length-9,9);
 }
}`);
 execFileSync('javac',['--release','8','-classpath',path.join(player,'classes'),'-d',temporary,path.join(temporary,'LoadingKernelProbe.java')]);
 }
 if(kernel==='vorbis'){
  const fixture=receipt.vorbisBenchmark;assert.ok(fixture,'Build the cached Vorbis fixture first');
  assert.equal(hash(vorbisProbeSource()),fixture.sourceSha256,'Cached probe source differs');
  assert.equal(hash(fs.readFileSync(path.join(probeDirectory,'LoadingKernelProbe.class'))),fixture.probeClassSha256,'Cached probe class differs');
  reference=fs.readFileSync(path.join(probeDirectory,'reference.pcm'));
  assert.equal(hash(reference),fixture.referencePcmSha256,'Cached HotSpot PCM differs');
 }
 if(process.env.JVM_WASM_OUTLINE_DIAGNOSTIC==='1'){
  assert.equal(kernel,'vorbis','Loop outlining currently uses the reduced original-music diagnostic');
  assert.ok(!inspectMethod&&!process.env.JVM_WASM_OPT_DIAGNOSTIC,'Use outlining without another optimizer/inspection');
  const {installWasmLoopOutliner}=await import('./wasm-loop-outline.mjs');
  optimizer=installWasmLoopOutliner({functionPrefix:'$jvm$wasm$MusicDecoder$decodePacket',requiredImportName:'math_sin__D_D',maxHelpers:2,
   outputPath:path.join(player,'vorbis/current.wat')});
 }
 if(process.env.JVM_WASM_OPT_DIAGNOSTIC==='1'){
  const {installWasmOptimizer}=await import('./wasm-optimizer.mjs');
  optimizer=installWasmOptimizer();
 }
 const options=structuredClone(mode==='slab'&&kernel!=='bzip'?receipt.diagnosticOptions||receipt.jvmOptions:
   kernel==='loading'?receipt.jvmOptions:receipt.executionBaseline.jvmOptions);
 const mainClass=kernel==='loading'?'GeobloxLoading':'LoadingKernelProbe';
 options.classpath=[...(probeDirectory?[probeDirectory]:[]),path.join(player,'classes')];
 options.jit.preparationPolicy={entryMethods:[mainClass+'.main([Ljava/lang/String;)V']};
 options.jit.compileWorker=false;
 if(mode!=='js'){options.prepareWasmPreparedUpgradesOnly=false;options.jit.preparedCompleteWasm=true;options.jit.preparedLoopLeafWasm=true;}
 if(mode==='canonical'||mode==='slab')options.jit.wasm={...options.jit.wasm,canonicalDirectCalls:true,canonicalEhLinks:true,nativeJsExceptionTags:true,nativeInstanceExits:true};
 if(kernel==='loading'){options.wasmFields=mode==='slab';options.denseInstanceFields=mode!=='slab';}
 if(mode==='slab'){options.wasmFields=true;options.denseInstanceFields=false;}
 globalThis.window=globalThis;globalThis.document={};
 const j=new JVM(options);delete globalThis.document;
 if(temporary)j.jre.LoadingKernelProbe={applicationFallback:true,staticMethods:{'input()[B':vm=>freshLoadingBytes(vm,input)}};
 if(kernel!=='bzip'){
  const assets=Object.fromEntries((kernel==='loading'?Object.keys(receipt.assets):['3-0.bin','255-3.bin']).map(name=>[name,assetBytes(name)]));
  j.jre.GeobloxLoading={applicationFallback:true,staticMethods:{'browserAsset(Ljava/lang/String;)[B':(vm,_obj,args)=>{
   const name=String(args[0]?.value??args[0]);assert.ok(assets[name],name);return freshLoadingBytes(vm,assets[name]);}}};
  const {installBrowserInflater}=await import('../launcher/browser-loader/browser-inflater.mjs');
  const decompress=async(data,format)=>new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream(format))).arrayBuffer());
  installBrowserInflater(j,{inflate:b=>decompress(b,'deflate'),inflateRaw:b=>decompress(b,'deflate-raw')});
 }
 j.jit._syncCompileEnvironment={trace:false,assert:true};
 const lateCompiles=[],startCompile=j.jit.startSynchronousCompile.bind(j.jit);
 j.jit.startSynchronousCompile=(method,entryPath)=>{
  if(j.jit.mainStarted&&lateCompiles.length<100)lateCompiles.push({method:j.jit.methodIdentity(method),entryPath});
  return startCompile(method,entryPath);
 };
 let guestStart,guestCpu;const mark=j.jit.markMainStarted.bind(j.jit);j.jit.markMainStarted=()=>{
  const optimization=optimizer?.finishPreparation();
  if(optimization?.transformation==='closed-loop-outline')assert.ok(optimization.outlinedLoops.length,'No loop outlined; do not time unchanged code');
  guestCpu=process.cpuUsage();guestStart=performance.now();mark();};
 const w=j.jit.wasmJit;
 const transitions=[];const execute=w.execute.bind(w);
 w.execute=(frame,thread,state,...args)=>{const before=frame.pc,r=execute(frame,thread,state,...args);if(state.key?.includes('Bzip2Decoder')&&state.exits&&transitions.length<100)transitions.push({key:state.key,before,after:frame.pc,result:summarizeExecutionOutcome(r),fuels:state.fuelExits});return r;};
 let error;const start=performance.now();
 try{await j.run(mainClass);}catch(caught){error={type:caught.type||caught.name,message:caught.message,location:caught.jvmGuestLocation};}
 const finished=performance.now(),cpu=guestCpu&&process.cpuUsage(guestCpu),elapsed=finished-start,executionMs=finished-guestStart;
 if(optimizer?.writePreview){
  const state=w.compiled.find(s=>s.key==='MusicDecoder.decodePacket(I)[F');
  assert.ok(state?.meta?.bytes,'Active decoder module is unavailable');optimizer.writePreview(hash(state.meta.bytes));
 }
 const fields=j.classes[mainClass].staticFields,out=fields.get('output:[B');
 const check=kernel==='loading'?['pcmSamples:I','pcmBytes:J','pcmCrc:J','archiveFiles:I','decodedBytes:J','graphicsCrc:J'].map(name=>String(fields.get(name))).join(':'):undefined;
 const actual=out&&Buffer.from(out),equal=kernel==='loading'?check===receipt.referenceCheck:actual?.equals(reference)||false;
 let firstDifference=-1;if(actual&&!equal)firstDifference=actual.findIndex((value,i)=>value!==reference[i]);
 const methods=[];
 let inspection;
 if(inspectMethod){
  const state=w.compiled.find(s=>s.key===inspectMethod);
  assert.ok(state?.meta?.bytes,'Installed method bytes unavailable: '+inspectMethod);
  const output=path.join(player,'vorbis/current.wat');
  const disassemble=(bytes,target)=>{
   const fd=fs.openSync(target,'w');
   try{execFileSync('wasm-dis',['--all-features','-'],{input:bytes,stdio:['pipe',fd,'pipe']});}
   finally{fs.closeSync(fd);}
  };
  disassemble(state.meta.bytes,output);
  const teaBytes=fs.readFileSync(path.join(player,'vorbis/teavm/vorbis.wasm'));
  assert.equal(hash(teaBytes),receipt.vorbisBenchmark.wasmSha256);
  const teaOutput=path.join(player,'vorbis/current-teavm.wat');
  disassemble(teaBytes,teaOutput);
  inspection={method:state.key,sha256:hash(state.meta.bytes),output,teavm:{sha256:hash(teaBytes),output:teaOutput}};
 }
 const owners=kernel==='bzip'?['Bzip2Decoder','Bzip2DecoderState']:['MusicDecoder','VorbisCodebook','VorbisResidue','MusicDecodeStage',...(kernel==='loading'?['Bzip2Decoder','Bzip2DecoderState']:[])];
 const layout=meta=>meta&&{structured:!!meta.structured,canonical:!!meta.canonicalRun,normalFlow:meta.normalFlowFullyCompiled,
  ...(optimizer&&meta.bytes?{moduleInputSha256:hash(meta.bytes)}:{}),
  omittedNativeBoundsCheckCount:meta.omittedNativeBoundsCheckCount||0,
  crossBlockArrayFillCount:meta.crossBlockArrayFillCount||0,
  arrayMetadataFlowStatus:meta.arrayMetadataFlowStatus||'unavailable',
  parameterHeapSpecializationBytes:meta.parameterHeapSpecializationBytes||0,
  parameterHeapBoundsElisionCount:meta.parameterHeapBoundsElisionCount||0,
  parameterHeapRangeGuardCount:meta.parameterHeapRangeGuardCount||0,
  parameterObjectSpecializationBytes:meta.parameterObjectSpecializationBytes||0,
  reusedPrimitiveFieldReadCount:meta.reusedPrimitiveFieldReadCount||0,
  primitiveFieldCaptureCount:meta.primitiveFieldCaptureCount||0,
  primitiveFieldSharedLocalCount:meta.primitiveFieldSharedLocalCount||0,
  omittedPhiCopies:meta.omittedPhiCopies||0,
  stackifiedNumericValueCount:meta.stackifiedNumericValueCount||0,
  reusedNumericLocalCount:meta.reusedNumericLocalCount||0,
  omittedArrayFillCount:meta.omittedArrayFillCount||0,
  nativeStaticArrayBodySites:meta.nativeStaticArrayBodySites||0,
  nativeStaticArrayRegions:meta.nativeStaticArrayRegions||[],
  guardedPrimitiveArrayLoopCount:meta.guardedPrimitiveArrayLoopCount||0,
  guardedPrimitiveArrayLoopBytes:meta.guardedPrimitiveArrayLoopBytes||0,
  nativeTags:!!meta.nativeJsExceptionTags,specSites:meta.specSites?.length||0,inlined:meta.inlinedCalls,
  nativeStaticLeafBytes:meta.nativeStaticLeafVersionBytes||0,
  params:meta.paramSlots?.map(p=>({slot:p.slot,type:p.t})),entryGuards:meta.entryInitializationGuards,
  links:meta.linkBindings?.map(b=>({key:b.key,pending:b.pending,canonical:!!b.canonicalDirect}))};
 for(const owner of owners)for(const item of j.classes[owner]?.ast.classes[0].items||[]){if(item.type!=='method')continue;const m=item.method,s=w.state.get(m),g=j.jit.codegenCache.get(m);methods.push({key:owner+'.'+m.name+m.descriptor,wasm:s&&{status:s.status,runs:s.runs,directEntries:s.meta?.canonicalEntries?.value||0,exits:s.exits,fuelExits:s.fuelExits,full:s.meta?.fullyCompiled,calleeFull:s.callee?.meta?.fullyCompiled,layout:layout(s.meta),calleeLayout:layout(s.callee?.meta),
  publication:w.canonicalDirectLinks&&{eligible:!!w.canonicalDirectLinks.constructor.eligible(s),slots:(w.canonicalDirectLinks.bindings.get(s.key)||[]).map(b=>({compact:b.compact,stub:w.canonicalDirectLinks.table.get(b.slot)===b.stub}))},
  frameEntryOnly:s.meta?.frameEntryOnly,veto:s.linkVetoed,nested:s.nestedCalls,nestedDeopts:s.nestedDeopts,demotes:s.meta?.demoteReasons&&[...s.meta.demoteReasons],pending:[...new Set(s.meta?.linkBindings?.filter(b=>b.pending).map(b=>b.key)||[])],flags:s.meta&&{deoptable:s.meta.deoptableCalls,usedEh:s.meta.usedEh,boxed:s.meta.boxedCount}},js:g&&{restoring:!!g.jvmRestoringDirectPositionalBody,rejection:g.jvmStructuredRestoringDirectRejection}});}
 const result={runtimeRevision:revision||'working-tree',sourceLoader:revision?'archive-with-generated-jre-index':'working-tree',engine:process.version,execArgv:process.execArgv,heapLimitBytes:getHeapStatistics().heap_size_limit,
  instrumented:!!w.importStatsEnabled||!!optimizer||!!inspection,
  ...(inspection?{inspection}:{}),
  ...(optimizer?{wasmOptimizer:optimizer.finishPreparation()}:{}),
  executionMethods:w.compiled.map(state=>({key:state.key,runs:state.runs,exits:state.exits,
    omittedNativeBoundsCheckCount:state.meta?.omittedNativeBoundsCheckCount||0,
    crossBlockArrayFillCount:state.meta?.crossBlockArrayFillCount||0,
    arrayMetadataFlowStatus:state.meta?.arrayMetadataFlowStatus||'unavailable',
    parameterHeapSpecializationBytes:state.meta?.parameterHeapSpecializationBytes||0,
    parameterHeapBoundsElisionCount:state.meta?.parameterHeapBoundsElisionCount||0,
    parameterHeapRangeGuardCount:state.meta?.parameterHeapRangeGuardCount||0,
    parameterObjectSpecializationBytes:state.meta?.parameterObjectSpecializationBytes||0,
    nativeArrayReadReuseSites:state.meta?.nativeArrayReadReuseSites||0,
    reusedPrimitiveFieldReadCount:state.meta?.reusedPrimitiveFieldReadCount||0,
    primitiveFieldCaptureCount:state.meta?.primitiveFieldCaptureCount||0,
    primitiveFieldSharedLocalCount:state.meta?.primitiveFieldSharedLocalCount||0,
    booleanArrayCacheCount:state.meta?.booleanArrayCacheCount||0,
    booleanFieldArrayGroupCount:state.meta?.booleanFieldArrayGroupCount||0,
    representationLoopCount:state.meta?.representationLoopCount||0,
    representationLoopBytes:state.meta?.representationLoopBytes||0,
    structured:!!state.meta?.structured,full:!!state.meta?.fullyCompiled,
    canonical:!!state.meta?.canonicalRun,directEntries:state.meta?.canonicalEntries?.value||0}))
   .filter(state=>state.runs||state.directEntries),
  heapUsage:j.wasmHeap?.usage(),
  ...(w.importStatsEnabled?{importCensus:w.compiled.flatMap(state=>[
    ['entry',state.meta],['callee',state.callee?.meta],['osr',state.osr?.meta]
   ].flatMap(([tier,meta])=>[...(meta?.importStats||[])].filter(([,count])=>count>0)
    .map(([name,count])=>({method:state.key,tier,name,count}))))
   .sort((a,b)=>b.count-a.count).slice(0,120)}:{}),
  fixtureSha256:probeDirectory?hash(fs.readFileSync(path.join(probeDirectory,'LoadingKernelProbe.class'))):receipt.workloadSha256,
  fixtureKind:probeDirectory?'kernel-class':'loading-workload-source',
  options,mode,asset,kernel,reference:kernel==='loading'?'Recorded HotSpot checksum':kernel==='vorbis'?'Recorded HotSpot PCM':'Python bz2',elapsed,executionMs,executionCpuMs:cpu&&(cpu.user+cpu.system)/1000,
  ...(kernel==='loading'?{check,musicMs:Number(fields.get('musicNanos:J'))/1e6,graphicsMs:Number(fields.get('graphicsNanos:J'))/1e6,
    loadingMs:(Number(fields.get('musicNanos:J'))+Number(fields.get('graphicsNanos:J')))/1e6}:{}),
  decodeMs:kernel==='vorbis'?Number(fields.get('decodeNanos:J'))/1e6:undefined,equal,firstDifference,error,lateCompiles,compilation:j.jit.syncCompileCensus(),preparation:j.preparationReport,transitions,methods};
 save(result);
}finally{optimizer?.finishPreparation();if(temporary)fs.rmSync(temporary,{recursive:true});}
}
