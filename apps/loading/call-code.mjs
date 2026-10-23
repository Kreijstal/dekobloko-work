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
const family=process.argv[3]||'boolean';assert.ok(['boolean','reader','original-reader'].includes(family));
assert.ok(flags.every(flag=>process.execArgv.includes(flag)),'Run this preparation with the documented eager/heap flags');
const receipt=JSON.parse(fs.readFileSync(reportPath)),options=structuredClone(receipt.diagnosticOptions);
options.classpath=[path.join(directory,'classes')];options.jit.compileWorker=false;
options.jit.preparationPolicy={entryMethods:['LoadingMicroKernel.main([Ljava/lang/String;)V']};
const {JVM}=await loadArchivedJvm(path.resolve(here,'../../../java-tools'),revision);
globalThis.window=globalThis;globalThis.document={};const j=new JVM(options);delete globalThis.document;
const stop=new Error('Call-code inspection stops before guest code');let boundary=false,ticks=0;
j.jit.markMainStarted=()=>{boundary=true;throw stop;};
j.executeTick=()=>{ticks++;throw Error('Compile-only inspection attempted a guest tick');};
let failure;try{await j.run('LoadingMicroKernel');}catch(error){failure=error;}
assert.ok(boundary,'Preparation did not reach the main boundary');assert.equal(failure,stop);assert.equal(ticks,0);

const walk=(node,visit)=>{if(!Array.isArray(node))return;visit(node);for(const child of node)walk(child,visit);};
function codeShape(wat,name){
 const module=parseWat(wat),imports=module.filter(n=>n?.[0]==='import'&&n[3]?.[0]==='func');
 const functions=module.filter(n=>n?.[0]==='func'),at=functions.findIndex(n=>n[1]===name);
 assert.ok(at>=0,'Missing defined function '+name);const operations={};
 walk(functions[at],n=>{if(typeof n[0]==='string')operations[n[0]]=(operations[n[0]]||0)+1;});
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
 ['Bzip2Decoder.readBits(ILBzip2DecoderState;)I'];
const teaNames=family==='boolean'?['$162','$55']:family==='reader'?['$51','$30']:['$7'];
for(const [ordinal,key]of targets.entries()){
 const state=j.jit.wasmJit.compiled.find(s=>s.key===key);assert.equal(state?.status,'ready',key);
 const meta=state.meta;assert.ok(meta.bytes);assert.ok(meta.normalFlowFullyCompiled);
 const wat=execFileSync('wasm-dis',['--all-features','-'],{input:meta.bytes,encoding:'utf8',maxBuffer:4*1024*1024});
 if(ordinal===targets.length-1)fs.writeFileSync(path.join(directory,'current.wat'),wat);
 const exportName=meta.parameterObjectABI?.length?'canonicalCompactStorageRun':'canonicalCompactRun';
 const module=parseWat(wat),exported=module.find(n=>n?.[0]==='export'&&n[1]===JSON.stringify(exportName));
 assert.ok(exported,key+' has no published compact entry');
 const shape=codeShape(wat,exported[2][1]),code=nativeCode(meta.bytes,shape.index);
 fs.appendFileSync(jvmOutput,'\n'+key+'\n'+code);
 const bindings=j.jit.wasmJit.canonicalDirectLinks.bindings.get(key)||[];
 rows.push({backend:'jvm',key,export:exportName,...shape,...nativeSummary(code),
  nativeObjectBodyFieldSites:meta.nativeObjectBodyFieldSites||0,
  canonicalLazyActivation:!!meta.canonicalLazyActivation,
  canonicalTargetImportCount:meta.canonicalTargetImportCount||0,
  nativeObjectPromotedFieldCount:meta.nativeObjectPromotedFieldCount||0,
  nonReturningArrayErrorSiteCount:meta.nonReturningArrayErrorSiteCount||0,
  nativeObjectElidedArrayReferenceSites:meta.nativeObjectElidedArrayReferenceSites||0,
  publishedSlots:bindings.filter(b=>b.compact).map(b=>({slot:b.slot,stub:j.jit.wasmJit.canonicalDirectLinks.table.get(b.slot)===b.stub,
   typed:!!b.target,typedStub:b.target?b.target.value===b.stub:null}))});
}
// Already-inspected controls are evidence to reuse, not code to compile again.
const savedTea=[...(receipt.optimizationTrials.nativeCallCode?.observations||[])].reverse()
 .find(o=>o.family===family&&o.engine===process.version&&JSON.stringify(o.flags)===JSON.stringify(flags))
 ?.rows.filter(row=>row.backend==='teavm');
let teaOutput=null;
if(savedTea?.length===teaNames.length)rows.push(...savedTea);
else{
 const teaWat=fs.readFileSync(path.join(directory,'current-teavm.wat'),'utf8');
 const teaBytes=fs.readFileSync(path.join(directory,'teavm/micro.wasm'));
 teaOutput=path.join(directory,'current-teavm-native.txt');fs.writeFileSync(teaOutput,'');
 for(const name of teaNames){
  const shape=codeShape(teaWat,name),code=nativeCode(teaBytes,shape.index);
  fs.appendFileSync(teaOutput,'\n'+name+'\n'+code);rows.push({backend:'teavm',...shape,...nativeSummary(code)});
 }
}
const current=JSON.parse(fs.readFileSync(reportPath)),trial=current.optimizationTrials.nativeCallCode||={observations:[]};
const result={sourceRevision:revision,family,compileOnly:true,guestTicks:ticks,mainExecuted:false,teaVmInstantiated:false,
 nonReturningArrayErrorsByMethod:j.jit.wasmJit.compiled.filter(s=>s.key.startsWith('Bzip2Decoder.')&&s.meta?.nonReturningArrayErrorSiteCount)
  .map(s=>({key:s.key,sites:s.meta.nonReturningArrayErrorSiteCount})),
 baselineTimingsOrFingerprints:false,teaNativeCodeReused:savedTea?.length===teaNames.length,
 engine:process.version,flags,rows,jvmOutput,teaOutput,measuredAt:new Date().toISOString()};
trial.observations.push(result);fs.writeFileSync(reportPath,JSON.stringify(current,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
