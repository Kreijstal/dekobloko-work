#!/usr/bin/env node
// New PCM-shaped reduction. Both variants use the same changed archived JVM;
// one withholds only its new no-helper regional emission. No known control runs.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadArchivedJvm} from './archive-jvm.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),script=fileURLToPath(import.meta.url);
const root=path.resolve(here,'../../../java-tools'),cache=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading');
const ledger=path.join(cache,'benchmark.json'),directory=path.join(cache,'field-array');
const flags=['--max-old-space-size=1024','--no-liftoff','--no-wasm-lazy-compilation'];
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const source=`class PcmOutputState {byte[] output;int cursor,rounds;}
public class PcmRegionKernel {
 static int convert(PcmOutputState s,float[][] chunks,int rounds,int count){
  for(int p=0;p<rounds;p++){float[] input=chunks[p];
   for(int i=0;i<count;i++){int value=(int)(128.0f+input[i]*128.0f);
    if((value&-256)!=0)value=~value>>31;s.output[s.cursor++]=(byte)(value-128);}
   s.rounds++;
  }return s.cursor;
 }
}`;
const classes=['PcmRegionKernel.class','PcmOutputState.class'];
function build(){
 fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'PcmRegionKernel.java'),source);
 execFileSync('javac',['--release','8','-proc:none','-d',directory,path.join(directory,'PcmRegionKernel.java')]);
 const fixture={sourceSha256:hash(source),classes:Object.fromEntries(classes.map(name=>[name,hash(fs.readFileSync(path.join(directory,name)))])),
  rounds:32,width:32768,purpose:'New closed field/array-writing conversion loop; one invocation, no warmup, allocation outside timer.'};
 const receipt=JSON.parse(fs.readFileSync(ledger));(receipt.optimizationTrials.fieldArrayWritingRegions||={}).fixture=fixture;
 fs.writeFileSync(ledger,JSON.stringify(receipt,null,2)+'\n');console.log('Built new field/array conversion fixture without executing Java or TeaVM.');
}
async function one(revision,variant){
 assert.match(revision,/^[0-9a-f]{40}$/);assert.ok(['native','withheld'].includes(variant));
 assert.ok(flags.every(flag=>process.execArgv.includes(flag)));
 const {fixture,options}=JSON.parse(fs.readFileSync(0,'utf8'));assert.equal(hash(source),fixture.sourceSha256);
 for(const [name,sha]of Object.entries(fixture.classes))assert.equal(hash(fs.readFileSync(path.join(directory,name))),sha,name);
 let objectModel,Frame;
 const {JVM}=await loadArchivedJvm(root,revision,{observeModule:({filename,exports})=>{
  if(filename.endsWith('/src/core/objectModel.js'))objectModel=exports;
  if(filename.endsWith('/src/core/frame.js'))Frame=exports;
  if(variant==='withheld'&&filename.endsWith('/src/jit/nativeObjectBody.js')){
   const prepare=exports.prepare;exports.prepare=function(...args){
    const plan=prepare.apply(this,args);return plan?.partial&&!plan.calls.size?null:plan;
   };
  }
 }});
 globalThis.window=globalThis;globalThis.document={};
 options.classpath=[directory];options.jit.enabled=false;options.jit.compileWorker=false;
 const j=new JVM(options);delete globalThis.document;await j.preloadClasspathClasses();
 for(const owner of ['PcmRegionKernel','PcmOutputState'])j._markClassInitialized(owner);
 const w=j.jit.wasmJit,method=j.findMethod(j.classes.PcmRegionKernel,'convert','(LPcmOutputState;[[FII)I'),state=w.methodState({method});
 w.compile({method,className:'PcmRegionKernel'},state,{asCallee:true});assert.equal(state.status,'ready',state.lastCompileError);
 assert.ok(state.meta.fullyCompiled);assert.equal(!!state.meta.nativeObjectRegionBlockCount,variant==='native');
 assert.ok(objectModel&&Frame,'Capture the archived factories, not checkout-owned metadata');
 const object=objectModel.makeObjectRef(j,'PcmOutputState',objectModel.newFields(j,'PcmOutputState'));
 const count=fixture.rounds*fixture.width,input=j.wasmHeap.alloc('[F',fixture.width),output=j.wasmHeap.alloc('[B',count);
 input.type='[F';output.type='[B';for(let i=0;i<input.length;i++)input[i]=((i&511)-256)/128;
 object.fields['PcmOutputState.output']=output;object.fields['PcmOutputState.cursor']=0;object.fields['PcmOutputState.rounds']=0;
 const chunks=Object.assign(Array(fixture.rounds).fill(input),{type:'[[F'});
 w.freezeCompilation();j.jit._syncCompileEnvironment={trace:false,assert:true};j.jit.markMainStarted();
 const frame=new Frame(method);frame.className='PcmRegionKernel';state.meta.box.frame=frame;
 const before=process.hrtime.bigint();let status,elapsedMs;
 try{status=state.run(object,chunks,fixture.rounds,fixture.width,0,100000000);elapsedMs=Number(process.hrtime.bigint()-before)/1e6;}
 finally{state.meta.box.frame=null;}assert.equal(status,-1);
 assert.equal(object.fields['PcmOutputState.cursor'],count);assert.equal(object.fields['PcmOutputState.rounds'],fixture.rounds);
 let checksum=0,expected=0;for(let i=0;i<count;i++){
  checksum=(Math.imul(checksum,33)+output[i])|0;const original=(((i%fixture.width)&511)-256)/128;
  let value=Math.trunc(Math.fround(128+Math.fround(original*128)));
  if(value&-256)value=~value>>31;const byte=(value-128)<<24>>24;
  assert.equal(output[i],byte,'conversion byte '+i);expected=(Math.imul(expected,33)+byte)|0;
 }
 for(let i=0;i<input.length;i++)assert.equal(input[i],((i&511)-256)/128,'input remains readonly');
 assert.equal(checksum,expected);assert.equal(j.jit.syncCompileCensus().postMainSyncCompileCount,0);
 console.log(JSON.stringify({sourceRevision:revision,variant,elapsedMs,checksum,count,node:process.version,execArgv:process.execArgv,
  sourceSha256:fixture.sourceSha256,classes:fixture.classes,harnessSha256:hash(fs.readFileSync(script)),
  nativeRegionBlocks:state.meta.nativeObjectRegionBlockCount||0,nativeFields:state.meta.nativeObjectBodyFieldSites||0,
  receiverGuardElisions:state.meta.nativeObjectReceiverGuardElisionCount||0,
  nativeArrays:state.meta.nativeObjectBodyArraySites||0,lateJavaCompiles:0,
  scope:'New same-source emission ablation; withheld variant retains candidate preflight snapshots. Not an old baseline, original game, TeaVM comparison or production fuel policy.'}));
}
function run(revision,nativeOnly=false){
 assert.match(revision||'',/^[0-9a-f]{40}$/);const receipt=JSON.parse(fs.readFileSync(ledger));
 const fixture=receipt.optimizationTrials.fieldArrayWritingRegions?.fixture;assert.ok(fixture,'Build the new fixture first');
 const input=JSON.stringify({fixture,options:receipt.diagnosticOptions}),rows=[];
 for(let pair=0;pair<3;pair++)for(const variant of nativeOnly?['native']:pair%2?['withheld','native']:['native','withheld']){
  const row=JSON.parse(execFileSync(process.execPath,[...flags,script,'one',revision,variant],{input,encoding:'utf8',maxBuffer:1024*1024}));
  rows.push({...row,pair,measuredAt:new Date().toISOString()});console.log(variant+' '+row.elapsedMs.toFixed(6)+' ms, check '+row.checksum);
 }
 const current=JSON.parse(fs.readFileSync(ledger));(current.optimizationTrials.fieldArrayWritingRegions.smallObservations||=[]).push(...rows);
 fs.writeFileSync(ledger,JSON.stringify(current,null,2)+'\n');
}
const [command,revision,variant]=process.argv.slice(2);
if(command==='build')build();else if(command==='run')run(revision);else if(command==='run-native')run(revision,true);else if(command==='one')await one(revision,variant);
else throw Error('Usage: field-array.mjs build | run EXACT_REVISION | run-native EXACT_REVISION');
