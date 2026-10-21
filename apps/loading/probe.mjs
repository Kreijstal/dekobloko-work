#!/usr/bin/env node
// Small archive-decoder reproducer for compiler debugging, outside acceptance.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';import {createRequire,Module} from 'node:module';
import {execFileSync} from 'node:child_process';
import {getHeapStatistics} from 'node:v8';
const require=createRequire(import.meta.url),root=path.resolve(new URL('../../../java-tools/',import.meta.url).pathname);
const player=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading');
const receiptPath=path.join(player,'benchmark.json'),receipt=JSON.parse(fs.readFileSync(receiptPath));
const mode=process.argv[2]||'js',asset=process.argv[3]||'1-2.bin',kernel=process.argv[5]||'bzip';
assert.ok(['js','wasm','canonical','slab'].includes(mode));assert.ok(['bzip','vorbis'].includes(kernel));
if(kernel==='vorbis')assert.equal(asset,'3-0.bin','Vorbis probe consumes the recorded sample archive');
// Load immutable source in memory for fast A/B checks, without another
// checkout, generated bundle or copied source directory. Ordinary dependency
// resolution is retained for packages outside java-tools/src.
const revision=process.argv[4] && execFileSync('git',['rev-parse','--verify',process.argv[4]+'^{commit}'],{cwd:root,encoding:'utf8'}).trim();
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
const input=new Int8Array(fs.readFileSync(path.join(player,'assets',asset)));
assert.equal(crypto.createHash('sha256').update(input).digest('hex'),receipt.assets[asset],'Archive bytes differ from recorded input');
let reference=kernel==='bzip'?execFileSync('python3',['-c',`import bz2,sys
b=sys.stdin.buffer.read();sys.stdout.buffer.write(bz2.decompress(b'BZh1'+b[9:9+int.from_bytes(b[1:5],'big')]))`],{input:Buffer.from(input),maxBuffer:16*1024*1024}):null;
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'loading-kernel-'));
try {
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
 for(const [name,expected] of Object.entries(receipt.classes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(player,'classes',name))).digest('hex'),expected,name);
 if(kernel==='vorbis')reference=execFileSync('java',['-Xmx1g','-Djava.awt.headless=true','-cp',temporary+path.delimiter+path.join(player,'classes'),'LoadingKernelProbe',path.join(player,'assets')],{maxBuffer:64*1024*1024});
 const {JVM}=loadJvm();
 const options=structuredClone(receipt.executionBaseline.jvmOptions);
 options.classpath=[temporary,path.join(player,'classes')];
 options.jit.preparationPolicy={entryMethods:['LoadingKernelProbe.main([Ljava/lang/String;)V']};
 options.jit.compileWorker=false;
 if(mode!=='js'){options.prepareWasmPreparedUpgradesOnly=false;options.jit.preparedCompleteWasm=true;options.jit.preparedLoopLeafWasm=true;}
 if(mode==='canonical'||mode==='slab')options.jit.wasm={canonicalDirectCalls:true,canonicalEhLinks:true,nativeJsExceptionTags:true,nativeInstanceExits:true};
 if(mode==='slab'){options.wasmFields=true;options.denseInstanceFields=false;}
 globalThis.window=globalThis;globalThis.document={};
 const j=new JVM(options);delete globalThis.document;
 j.jre.LoadingKernelProbe={applicationFallback:true,staticMethods:{'input()[B':vm=>vm.newByteArray(input)}};
 if(kernel==='vorbis'){
  const assets=Object.fromEntries(['3-0.bin','255-3.bin'].map(name=>{const data=fs.readFileSync(path.join(player,'assets',name));
   assert.equal(crypto.createHash('sha256').update(data).digest('hex'),receipt.assets[name],name);return [name,new Int8Array(data)];}));
  j.jre.GeobloxLoading={applicationFallback:true,staticMethods:{'browserAsset(Ljava/lang/String;)[B':(vm,_obj,args)=>{
   const name=String(args[0]?.value??args[0]);assert.ok(assets[name],name);return vm.newByteArray(assets[name]);}}};
  const {installBrowserInflater}=await import('../launcher/browser-loader/browser-inflater.mjs');
  const decompress=async(data,format)=>new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream(format))).arrayBuffer());
  installBrowserInflater(j,{inflate:b=>decompress(b,'deflate'),inflateRaw:b=>decompress(b,'deflate-raw')});
 }
 j.jit._syncCompileEnvironment={trace:false,assert:true};
 let guestStart,guestCpu;const mark=j.jit.markMainStarted.bind(j.jit);j.jit.markMainStarted=()=>{guestCpu=process.cpuUsage();guestStart=performance.now();mark();};
 const w=j.jit.wasmJit;
 const transitions=[];const execute=w.execute.bind(w);
 w.execute=(frame,thread,state,...args)=>{const before=frame.pc,r=execute(frame,thread,state,...args);if(state.key?.includes('Bzip2Decoder')&&state.exits&&transitions.length<100)transitions.push({key:state.key,before,after:frame.pc,result:r,fuels:state.fuelExits});return r;};
 let error;const start=performance.now();
 try{await j.run('LoadingKernelProbe');}catch(caught){error={type:caught.type||caught.name,message:caught.message,location:caught.jvmGuestLocation};}
 const finished=performance.now(),cpu=guestCpu&&process.cpuUsage(guestCpu),elapsed=finished-start,executionMs=finished-guestStart;
 const fields=j.classes.LoadingKernelProbe.staticFields,out=fields.get('output:[B');
 const actual=out&&Buffer.from(out),equal=actual?.equals(reference)||false;
 let firstDifference=-1;if(actual&&!equal)firstDifference=actual.findIndex((value,i)=>value!==reference[i]);
 const methods=[];
 const owners=kernel==='vorbis'?['MusicDecoder','VorbisCodebook','VorbisResidue','MusicDecodeStage']:['Bzip2Decoder','Bzip2DecoderState'];
 for(const owner of owners)for(const item of j.classes[owner]?.ast.classes[0].items||[]){if(item.type!=='method')continue;const m=item.method,s=w.state.get(m),g=j.jit.codegenCache.get(m);methods.push({key:owner+'.'+m.name+m.descriptor,wasm:s&&{status:s.status,runs:s.runs,directEntries:s.meta?.canonicalEntries?.value||0,exits:s.exits,fuelExits:s.fuelExits,full:s.meta?.fullyCompiled,calleeFull:s.callee?.meta?.fullyCompiled,frameEntryOnly:s.meta?.frameEntryOnly,veto:s.linkVetoed,nested:s.nestedCalls,nestedDeopts:s.nestedDeopts,demotes:s.meta?.demoteReasons&&[...s.meta.demoteReasons],pending:[...new Set(s.meta?.linkBindings?.filter(b=>b.pending).map(b=>b.key)||[])],flags:s.meta&&{deoptable:s.meta.deoptableCalls,usedEh:s.meta.usedEh,boxed:s.meta.boxedCount}},js:g&&{restoring:!!g.jvmRestoringDirectPositionalBody,rejection:g.jvmStructuredRestoringDirectRejection}});}
 const result={runtimeRevision:revision||'working-tree',sourceLoader:revision?'archive-with-generated-jre-index':'working-tree',engine:process.version,execArgv:process.execArgv,heapLimitBytes:getHeapStatistics().heap_size_limit,
  harnessSha256:crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),
  fixtureSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(temporary,'LoadingKernelProbe.class'))).digest('hex'),
  options,mode,asset,kernel,reference:kernel==='vorbis'?'HotSpot':'Python bz2',elapsed,executionMs,executionCpuMs:cpu&&(cpu.user+cpu.system)/1000,
  decodeMs:kernel==='vorbis'?Number(fields.get('decodeNanos:J'))/1e6:undefined,equal,firstDifference,error,compilation:j.jit.syncCompileCensus(),preparation:j.preparationReport,transitions,methods};
 result.recent=[...(receipt.kernelDiagnostic?.recent||[]),{runtimeRevision:result.runtimeRevision,sourceLoader:result.sourceLoader,mode,asset,kernel,executionMs:result.executionMs,decodeMs:result.decodeMs,equal,lateCompiles:result.compilation.postMainSyncCompileCount}].slice(-6);
 const current=JSON.parse(fs.readFileSync(receiptPath));current.kernelDiagnostic=result;
 fs.writeFileSync(receiptPath,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 assert.equal(error,undefined,'Guest execution failed');
 assert.equal(result.compilation.postMainSyncCompileCount,0,'Probe compiled during guest execution');
 assert.ok(equal,'Decoded bytes differ from reference decoder');
}finally{fs.rmSync(temporary,{recursive:true});}
