#!/usr/bin/env node
// Fresh-process decoder/full-loading diagnostics, outside browser acceptance.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';import {createRequire,Module} from 'node:module';
import {execFileSync} from 'node:child_process';
import {getHeapStatistics} from 'node:v8';
import {freshLoadingBytes} from './browser.mjs';
const require=createRequire(import.meta.url),root=path.resolve(new URL('../../../java-tools/',import.meta.url).pathname);
const player=path.resolve(process.argv[6]||path.join(os.homedir(),'.cache/dekobloko/geoblox-loading'));
const receiptPath=path.join(player,'benchmark.json'),receipt=JSON.parse(fs.readFileSync(receiptPath));
const mode=process.argv[2]||'js',asset=process.argv[3]||'1-2.bin',kernel=process.argv[5]||'bzip';
assert.ok(['js','wasm','canonical','slab','teavm'].includes(mode));assert.ok(['bzip','vorbis','loading'].includes(kernel));
if(kernel==='vorbis')assert.equal(asset,'3-0.bin','Vorbis probe consumes the recorded sample archive');
if(kernel==='loading')assert.equal(asset,'all','Full loading consumes all recorded assets');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const harnessFiles=Object.fromEntries([
 ['probe.mjs',import.meta.url],['browser.mjs',new URL('./browser.mjs',import.meta.url)],
 ['browser-inflater.mjs',new URL('../launcher/browser-loader/browser-inflater.mjs',import.meta.url)],
 ['wasm-optimizer.mjs',new URL('./wasm-optimizer.mjs',import.meta.url)],
].map(([name,url])=>[name,hash(fs.readFileSync(new URL(url)))]));
const assetBytes=name=>{
 const data=fs.readFileSync(path.join(player,'assets',name));assert.equal(hash(data),receipt.assets[name],name);
 return new Int8Array(data);
};
const save=result=>{
 Object.assign(result,{engine:process.version,execArgv:process.execArgv,heapLimitBytes:getHeapStatistics().heap_size_limit,
  harnessSha256:harnessFiles['probe.mjs'],harnessFilesSha256:harnessFiles,mode,asset,kernel});
 const current=JSON.parse(fs.readFileSync(receiptPath));
 result.recent=[...(current.kernelDiagnostic?.recent||[]),{runtimeRevision:result.runtimeRevision,sourceLoader:result.sourceLoader,
  mode,asset,kernel,executionMs:result.executionMs,decodeMs:result.decodeMs,musicMs:result.musicMs,graphicsMs:result.graphicsMs,
  equal:result.equal,lateCompiles:result.compilation?.postMainSyncCompileCount}].slice(-6);
 current.kernelDiagnostic=result;fs.writeFileSync(receiptPath,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify(result,null,2));
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
// Load immutable source in memory for fast A/B checks, without another
// checkout, generated bundle or copied source directory. Ordinary dependency
// resolution is retained for packages outside java-tools/src.
const revision=process.argv[4] && process.argv[4]!=='-' && execFileSync('git',['rev-parse','--verify',process.argv[4]+'^{commit}'],{cwd:root,encoding:'utf8'}).trim();
let loadJvm=()=>require(path.join(root,'src/core/jvm'));
if(revision){
 const parent=path.dirname(root),cloner=[parent,path.join(parent,'blank-github-cloner')].find(directory=>fs.existsSync(path.join(directory,'public/jvm-source-bundler.js')));
 assert.ok(cloner,'An adjacent cloner checkout supplies the source archive reader');
 const {unpackTar}=await import(pathToFileURL(path.join(cloner,'public/jvm-source-bundler.js')));
 const files=new Map(unpackTar(execFileSync('git',['archive','--prefix=package/',revision,'src','package.json'],{cwd:root,maxBuffer:64*1024*1024})));
 // The ignored JRE index must be generated from the archived files too.
 // Falling back to the checkout's index would share its JRE and core helpers
 // across revisions, invalidating both ownership metadata and A/B provenance.
 const jreFiles=[...files.keys()].filter(name=>name.startsWith('src/jre/')&&name.endsWith('.js')&&path.basename(name)!=='index.js');
 const entries=jreFiles.map(name=>[name.slice('src/jre/'.length,-3),'./'+name.slice('src/jre/'.length)])
  .sort(([a],[b])=>a.localeCompare(b));
 files.set('src/jre/index.js','module.exports={\n'+entries.map(([name,file])=>JSON.stringify(name)+':require('+JSON.stringify(file)+')').join(',\n')+'\n};\n');
 // Node's existing bootstrap discovers additional class names on disk. Reject
 // a different file inventory rather than accidentally creating extra stubs.
 const diskFiles=[];
 const inventory=directory=>{for(const entry of fs.readdirSync(path.join(root,directory),{withFileTypes:true})){
  const name=directory+'/'+entry.name;if(entry.isDirectory())inventory(name);
  else if(name.endsWith('.js')&&entry.name!=='index.js')diskFiles.push(name);
 }};
 inventory('src/jre');assert.deepEqual(diskFiles.sort(),jreFiles.sort(),'JRE file inventory differs from source revision');
 const cache=new Map();
 const relative=filename=>path.relative(root,filename).split(path.sep).join('/');
 const resolveSource=filename=>[filename,filename+'.js',filename+'.json',path.join(filename,'index.js'),path.join(filename,'index.json')]
  .find(candidate=>files.has(relative(candidate)));
 const load=filename=>{
  if(cache.has(filename))return cache.get(filename).exports;
  const source=files.get(relative(filename));
  assert.notEqual(source,undefined,'Source module is absent from revision: '+relative(filename));
  const module=new Module(filename);module.filename=filename;module.paths=Module._nodeModulePaths(path.dirname(filename));cache.set(filename,module);
  module.require=request=>{
   if(request.startsWith('.')||path.isAbsolute(request)){
    const candidate=path.resolve(path.dirname(filename),request),name=relative(candidate);
    if(name==='src'||name.startsWith('src/')||name==='package.json'){
     const resolved=resolveSource(candidate);
     assert.ok(resolved,'Source import is absent from revision: '+request+' from '+relative(filename));
     return load(resolved);
    }
   }
   const resolved=Module._resolveFilename(request,module);
   return files.has(relative(resolved))?load(resolved):require(resolved);
  };
  if(filename.endsWith('.json'))module.exports=JSON.parse(source);else module._compile(source,filename);
  module.loaded=true;return module.exports;
 };
 loadJvm=()=>load(path.join(root,'src/core/jvm.js'));
}
const input=kernel==='loading'?null:assetBytes(asset);
let reference=kernel==='bzip'?execFileSync('python3',['-c',`import bz2,sys
b=sys.stdin.buffer.read();sys.stdout.buffer.write(bz2.decompress(b'BZh1'+b[9:9+int.from_bytes(b[1:5],'big')]))`],{input:Buffer.from(input),maxBuffer:16*1024*1024}):null;
const temporary=kernel==='loading'?null:fs.mkdtempSync(path.join(os.tmpdir(),'loading-kernel-'));
let optimizer;
try {
 if(temporary){
 fs.writeFileSync(path.join(temporary,'LoadingKernelProbe.java'),kernel==='vorbis'?`public class LoadingKernelProbe {
 static byte[] output;static int written;static long decodeNanos;
 public static void main(String[] args)throws Exception {
  GeobloxLoading.browserMode=args.length==0;GeobloxLoading.assetRoot=args.length==0?null:args[0];Geoblox.clientControlFlowFlag=0;
  GeobloxLoading.LocalArchive local=new GeobloxLoading.LocalArchive(3);ResourceArchive archive=new ResourceArchive(local,false,0);archive.ensureIndexLoaded(0);
  int count=local.index.fileCounts[0],chosen=-1,size=-1;int[] files=local.index.fileIds[0];
  for(int i=0;i<count;i++){int file=files==null?i:files[i];if(file==0)continue;byte[] data=archive.getFile(0,-28153,file);if(data.length>size){size=data.length;chosen=file;}}
  if(chosen<0)throw new AssertionError("No sample");
  MusicDecoder decoder=MusicDecoder.loadById(archive,0,chosen);if(decoder==null)throw new AssertionError("No decoder");
  long start=System.nanoTime();PcmSample sample=decoder.decodePcmBudgeted(null);decodeNanos=System.nanoTime()-start;
  if(sample==null)throw new AssertionError("No PCM");output=sample.samples;written=output.length;
  if(args.length>0)System.out.write(output);
 }
}`:`public class LoadingKernelProbe {
 static native byte[] input(); static byte[] output; static int written;
 public static void main(String[] args) {
  byte[] data=input();int n=((data[5]&255)<<24)|((data[6]&255)<<16)|((data[7]&255)<<8)|(data[8]&255);
  output=new byte[n];written=Bzip2Decoder.decompressInto(output,n,data,data.length-9,9);
 }
}`);
 execFileSync('javac',['--release','8','-classpath',path.join(player,'classes'),'-d',temporary,path.join(temporary,'LoadingKernelProbe.java')]);
 }
 if(kernel==='vorbis')reference=execFileSync('java',['-Xmx1g','-Djava.awt.headless=true','-cp',temporary+path.delimiter+path.join(player,'classes'),'LoadingKernelProbe',path.join(player,'assets')],{maxBuffer:64*1024*1024});
 const {JVM}=loadJvm();
 if(process.env.JVM_WASM_OPT_DIAGNOSTIC==='1'){
  const {installWasmOptimizer}=await import('./wasm-optimizer.mjs');
  optimizer=installWasmOptimizer();
 }
 const options=structuredClone(kernel==='loading'?(mode==='slab'?receipt.diagnosticOptions||receipt.jvmOptions:receipt.jvmOptions):receipt.executionBaseline.jvmOptions);
 const mainClass=kernel==='loading'?'GeobloxLoading':'LoadingKernelProbe';
 options.classpath=[...(temporary?[temporary]:[]),path.join(player,'classes')];
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
  optimizer?.finishPreparation();guestCpu=process.cpuUsage();guestStart=performance.now();mark();};
 const w=j.jit.wasmJit;
 const transitions=[];const execute=w.execute.bind(w);
 w.execute=(frame,thread,state,...args)=>{const before=frame.pc,r=execute(frame,thread,state,...args);if(state.key?.includes('Bzip2Decoder')&&state.exits&&transitions.length<100)transitions.push({key:state.key,before,after:frame.pc,result:r,fuels:state.fuelExits});return r;};
 let error;const start=performance.now();
 try{await j.run(mainClass);}catch(caught){error={type:caught.type||caught.name,message:caught.message,location:caught.jvmGuestLocation};}
 const finished=performance.now(),cpu=guestCpu&&process.cpuUsage(guestCpu),elapsed=finished-start,executionMs=finished-guestStart;
 const fields=j.classes[mainClass].staticFields,out=fields.get('output:[B');
 const check=kernel==='loading'?['pcmSamples:I','pcmBytes:J','pcmCrc:J','archiveFiles:I','decodedBytes:J','graphicsCrc:J'].map(name=>String(fields.get(name))).join(':'):undefined;
 const actual=out&&Buffer.from(out),equal=kernel==='loading'?check===receipt.referenceCheck:actual?.equals(reference)||false;
 let firstDifference=-1;if(actual&&!equal)firstDifference=actual.findIndex((value,i)=>value!==reference[i]);
 const methods=[];
 const owners=kernel==='bzip'?['Bzip2Decoder','Bzip2DecoderState']:['MusicDecoder','VorbisCodebook','VorbisResidue','MusicDecodeStage',...(kernel==='loading'?['Bzip2Decoder','Bzip2DecoderState']:[])];
 const layout=meta=>meta&&{structured:!!meta.structured,canonical:!!meta.canonicalRun,normalFlow:meta.normalFlowFullyCompiled,
  omittedPhiCopies:meta.omittedPhiCopies||0,
  stackifiedNumericValueCount:meta.stackifiedNumericValueCount||0,
  reusedNumericLocalCount:meta.reusedNumericLocalCount||0,
  omittedArrayFillCount:meta.omittedArrayFillCount||0,
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
  instrumented:!!w.importStatsEnabled||!!optimizer,
  ...(optimizer?{wasmOptimizer:optimizer.finishPreparation()}:{}),
  executionMethods:w.compiled.map(state=>({key:state.key,runs:state.runs,exits:state.exits,
    structured:!!state.meta?.structured,full:!!state.meta?.fullyCompiled,
    canonical:!!state.meta?.canonicalRun,directEntries:state.meta?.canonicalEntries?.value||0}))
   .filter(state=>state.runs||state.directEntries),
  ...(w.importStatsEnabled?{importCensus:w.compiled.flatMap(state=>[
    ['entry',state.meta],['callee',state.callee?.meta],['osr',state.osr?.meta]
   ].flatMap(([tier,meta])=>[...(meta?.importStats||[])].filter(([,count])=>count>0)
    .map(([name,count])=>({method:state.key,tier,name,count}))))
   .sort((a,b)=>b.count-a.count).slice(0,120)}:{}),
  fixtureSha256:temporary?hash(fs.readFileSync(path.join(temporary,'LoadingKernelProbe.class'))):receipt.workloadSha256,
  fixtureKind:temporary?'kernel-class':'loading-workload-source',
  options,mode,asset,kernel,reference:kernel==='loading'?'Recorded HotSpot checksum':kernel==='vorbis'?'HotSpot':'Python bz2',elapsed,executionMs,executionCpuMs:cpu&&(cpu.user+cpu.system)/1000,
  ...(kernel==='loading'?{check,musicMs:Number(fields.get('musicNanos:J'))/1e6,graphicsMs:Number(fields.get('graphicsNanos:J'))/1e6,
    loadingMs:(Number(fields.get('musicNanos:J'))+Number(fields.get('graphicsNanos:J')))/1e6}:{}),
  decodeMs:kernel==='vorbis'?Number(fields.get('decodeNanos:J'))/1e6:undefined,equal,firstDifference,error,lateCompiles,compilation:j.jit.syncCompileCensus(),preparation:j.preparationReport,transitions,methods};
 save(result);
}finally{optimizer?.finishPreparation();if(temporary)fs.rmSync(temporary,{recursive:true});}
}
