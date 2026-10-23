#!/usr/bin/env node
// Execution-only sampling for fast iteration. This is diagnostic, never a
// substitute for the fresh-process, unprofiled Firefox acceptance comparison.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import inspector from 'node:inspector';
import vm from 'node:vm';
import {installBrowserInflater} from '../launcher/browser-loader/browser-inflater.mjs';
import {freshLoadingBytes,canonicalExecutionCounts} from './browser.mjs';
const player=path.resolve(process.argv[2]||path.join(os.homedir(),'.cache/dekobloko/geoblox-loading'));
const reportPath=path.join(player,'benchmark.json');
const receipt=JSON.parse(fs.readFileSync(reportPath));
const runtimeDirectory=path.resolve(process.argv[3]||path.join(player,'runtime'));
const runtimeRevision=process.argv[3]?process.argv[4]:receipt.runtimeRevision;
if(process.argv[3]&&!runtimeRevision)throw Error('An isolated runtime needs its source revision');
const runtimeHashes=Object.fromEntries(Object.keys(receipt.runtime).map(name=>[name,
 crypto.createHash('sha256').update(fs.readFileSync(path.join(runtimeDirectory,name))).digest('hex')]));
if(!process.argv[3])for(const [name,expected] of Object.entries(receipt.runtime))assert.equal(runtimeHashes[name],expected,'runtime/'+name);
for(const category of ['classes','assets'])for(const [name,expected] of Object.entries(receipt[category]))
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(player,category,name))).digest('hex'),expected,category+'/'+name);
globalThis.window=globalThis;globalThis.document={};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'Firefox',hardwareConcurrency:4,language:'en-US'}});
globalThis.importScripts=()=>{};globalThis.location=new URL('http://localhost/');
vm.runInThisContext(fs.readFileSync(path.join(runtimeDirectory,'jvm-debug.js'),'utf8'),{filename:'jvm-debug.js'});
const {BrowserJVMDebug}=globalThis.JVMDebug;
delete globalThis.importScripts;delete globalThis.location;
const debug=new BrowserJVMDebug();
await debug.initialize({dataPackage:{classes:Object.keys(receipt.classes).map(filename=>({filename,content:fs.readFileSync(path.join(player,'classes',filename)).toString('base64')}))}});
const effectiveOptions=receipt.diagnosticOptions||receipt.jvmOptions;
const controller=debug.debugController,{jit,...rest}=effectiveOptions;
Object.assign(controller.options,rest,{prepareBeforeMain:true,prepareWasmPreparedUpgradesOnly:rest.prepareWasmPreparedUpgradesOnly??true});
controller.options.jit={...controller.options.jit,...jit,compileWorker:false};
const assets=Object.fromEntries(Object.keys(receipt.assets).map(name=>[name,new Int8Array(fs.readFileSync(path.join(player,'assets',name)))]));
const session=new inspector.Session();session.connect();
const post=(name,args={})=>new Promise((resolve,reject)=>session.post(name,args,(error,result)=>error?reject(error):resolve(result)));
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:500});
let preparationMs;const lateCompiles=[];
try {
await debug.run('GeobloxLoading',{args:[],beforeRun:({jvm})=>{
 delete globalThis.document;
 const decompress=async(data,format)=>new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream(format))).arrayBuffer());
 installBrowserInflater(jvm,{inflate:b=>decompress(b,'deflate'),inflateRaw:b=>decompress(b,'deflate-raw')});
 jvm.jre.GeobloxLoading={applicationFallback:true,staticMethods:{'browserAsset(Ljava/lang/String;)[B':(_vm,_object,args)=>{const name=String(args[0]?.value??args[0]);assert.ok(assets[name],name);return freshLoadingBytes(_vm,assets[name]);}}};
 jvm.jit.wasmJit.traceMethodPattern='MusicDecoder.decodePacket';jvm.jit.wasmJit.traceExitsOnly=true;
 jvm.jit._syncCompileEnvironment={trace:false,assert:true};
 const startCompile=jvm.jit.startSynchronousCompile.bind(jvm.jit);
 jvm.jit.startSynchronousCompile=(method,path)=>{if(jvm.jit.mainStarted)lateCompiles.push({method:jvm.jit.methodIdentity(method),path});return startCompile(method,path);};
 const prepare=jvm.precompileInitializedClasses.bind(jvm);
 jvm.precompileInitializedClasses=async options=>{const start=performance.now();const result=await prepare(options);preparationMs=performance.now()-start;return result;};
 const start=jvm.jit.markMainStarted.bind(jvm.jit);
 jvm.jit.markMainStarted=()=>{session.post('Profiler.start');start();};
}});
const {profile}=await post('Profiler.stop');
const nodes=new Map(profile.nodes.map(node=>[node.id,node]));
const parents=new Map();for(const node of profile.nodes)for(const child of node.children||[])parents.set(child,node.id);
const self=new Map(),guest=new Map();
for(let i=0;i<profile.samples.length;i++) {
 const id=profile.samples[i],node=nodes.get(id),frame=node.callFrame;
 const key=frame.functionName+' '+frame.url+':'+(frame.lineNumber+1)+':'+(frame.columnNumber+1);
 const micros=profile.timeDeltas?.[i]||0;
 self.set(key,(self.get(key)||0)+micros);
 let next=id;
 while(next){const f=nodes.get(next).callFrame;const label=f.functionName+' '+f.url;if(label.includes('jvm$')){guest.set(label,(guest.get(label)||0)+micros);break;}next=parents.get(next);}
}
const top=map=>[...map].sort((a,b)=>b[1]-a[1]).slice(0,60).map(([name,micros])=>({name,ms:micros/1000}));
const jvm=controller.jvm,fields=jvm.classes.GeobloxLoading.staticFields;
const read=name=>Number(fields.get(name));
const check=['pcmSamples:I','pcmBytes:J','pcmCrc:J','archiveFiles:I','decodedBytes:J','graphicsCrc:J'].map(read).join(':');
assert.deepEqual(lateCompiles,[]);assert.equal(check,receipt.referenceCheck);assert.equal(jvm.jit.syncCompileCensus().postMainSyncCompileCount,0);
const selectedWasm=jvm.jit.wasmJit.compiled.filter(s=>/MusicDecodeStage|MusicScore|MidiTrackReader|decodePacket|readVector/.test(s.key)).map(s=>({key:s.key,runs:s.runs,exits:s.exits,status:s.status,meta:s.meta&&{full:s.meta.fullyCompiled,normal:s.meta.normalFlowFullyCompiled,canonical:!!s.meta.canonicalRun,boxed:s.meta.boxedCount,specSites:s.meta.specSites,demotes:[...s.meta.demoteReasons],init:s.meta.initializationGuardTokens?.map(t=>t.initialized)},callee:s.callee?.meta&&{full:s.callee.meta.fullyCompiled,demotes:[...s.callee.meta.demoteReasons]},osr:s.osr?.meta&&{full:s.osr.meta.fullyCompiled,demotes:[...s.osr.meta.demoteReasons]}}));
const diagnostic={runtimeRevision,runtime:runtimeHashes,lateCompiles,selectedWasm,engine:process.version,profiled:true,options:effectiveOptions,preparationMs,musicMs:read('musicNanos:J')/1e6,graphicsMs:read('graphicsNanos:J')/1e6,check,self:top(self),guest:top(guest),profile,
 wasm:jvm.jit.wasmJit.compiled.map(s=>({key:s.key,runs:s.runs,exits:s.exits,fuelExits:s.fuelExits,fullReason:s.failReason,...canonicalExecutionCounts(s.meta),fullyCompiled:s.meta?.fullyCompiled,structured:s.meta?.structured,objectInputs:s.meta?.objectStorageInputCount,nativeReferenceSites:s.meta?.nativeObjectReferenceSites,referenceArraySites:s.meta?.nativeReferenceArraySites,canonicalSites:s.meta?.canonicalDirectSites,partialDeps:s.partialDeps,demotes:s.meta?.demoteReasons&&[...s.meta.demoteReasons],osrDemotes:s.osr?.meta?.demoteReasons&&[...s.osr.meta.demoteReasons],imports:s.meta?.importStats?[...s.meta.importStats]:null})).filter(s=>s.runs||s.directEntries||s.nativeObjectBodyEntries).sort((a,b)=>(b.runs+(b.directEntries||b.nativeObjectBodyEntries||0))-(a.runs+(a.directEntries||a.nativeObjectBodyEntries||0))).slice(0,60)};
const current=JSON.parse(fs.readFileSync(reportPath));current.nodeDiagnostic=diagnostic;fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');console.log(JSON.stringify({...diagnostic,profile:undefined},null,2));
} finally {session.disconnect();}
