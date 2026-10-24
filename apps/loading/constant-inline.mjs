#!/usr/bin/env node
// New reduction, not a replay of an existing baseline. Both variants load the
// same immutable candidate; one withholds only integer-argument specialization.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadArchivedJvm} from './archive-jvm.mjs';
const script=fileURLToPath(import.meta.url),root=path.resolve(path.dirname(script),'../../../java-tools');
const nested=process.argv[2]?.includes('nested'),cache=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading');
const directory=path.join(cache,nested?'constant-inline-nested':'constant-inline');
const ledger=path.join(cache,'benchmark.json'),flags=['--max-old-space-size=1024','--no-liftoff','--no-wasm-lazy-compilation'];
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const source=nested?`final class NestedByteInput {
 byte[] bytes;int position,rounds;
 int read(byte guard){if(guard!=34)return NestedGuardFailure.fail(guard);
  int p=position;position=p+1;return bytes[p]&255;}
 int pair(){rounds++;return read((byte)34)<<8|read((byte)34);}
}
class NestedGuardFailure {static int calls;static int fail(int guard){calls++;return guard+1000;}}
public class NestedReadKernel {
 static int sum(NestedByteInput input,int count){int sum=0;
  for(int i=0;i<count;i++)sum=sum*31+input.pair();return sum;}
}`:`final class GuardedByteInput {
 byte[] bytes;int position;
 int read(byte guard){if(guard!=34)return GuardFailure.fail(guard);
  int p=position;position=p+1;return bytes[p]&255;}
}
class GuardFailure {static int calls;static int fail(int guard){calls++;return guard+1000;}}
public class ConstantReadKernel {
 static int sum(GuardedByteInput input,int count){int sum=0;
  for(int i=0;i<count;i++)sum=sum*31+input.read((byte)34);return sum;}
}`;
const inputClass=nested?'NestedByteInput':'GuardedByteInput',failureClass=nested?'NestedGuardFailure':'GuardFailure',
 kernelClass=nested?'NestedReadKernel':'ConstantReadKernel';
const classNames=[inputClass,failureClass,kernelClass].map(name=>name+'.class');
const trialOf=receipt=>nested?(receipt.optimizationTrials.constantArgumentInlining.nested||={}):receipt.optimizationTrials.constantArgumentInlining;
const nestedNeedle='()=>callIntegerConstants(ctx,codeAttr,method,className,idx)';
function build(){
 fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,kernelClass+'.java'),source);
 execFileSync('javac',['--release','8','-proc:none','-d',directory,path.join(directory,kernelClass+'.java')]);
 const fixture={sourceSha256:hash(source),classes:Object.fromEntries(classNames.map(name=>[name,hash(fs.readFileSync(path.join(directory,name)))])),
  count:1048576,purpose:nested?'One wrapper with two guarded child reads per iteration, one invocation, no warmup; input outside timer.':'One guarded instance byte read per loop iteration, one invocation, no warmup; input outside timer.'};
 const receipt=JSON.parse(fs.readFileSync(ledger));(receipt.optimizationTrials.constantArgumentInlining||={});trialOf(receipt).fixture=fixture;
 fs.writeFileSync(ledger,JSON.stringify(receipt,null,2)+'\n');console.log('Built new guarded-reader fixture without running Java, TeaVM or a known control.');
}
async function one(revision,variant,inspect=false){
 assert.match(revision,/^[0-9a-f]{40}$/);assert.ok(['specialized','withheld'].includes(variant));
 assert.ok(flags.every(flag=>process.execArgv.includes(flag)));
 const receipt=inspect?JSON.parse(fs.readFileSync(ledger)):null;
 const {fixture,options}=inspect?{fixture:trialOf(receipt).fixture,options:receipt.diagnosticOptions}:
  JSON.parse(fs.readFileSync(0,'utf8'));assert.equal(hash(source),fixture.sourceSha256);
 for(const [name,sha]of Object.entries(fixture.classes))assert.equal(hash(fs.readFileSync(path.join(directory,name))),sha);
 let objectModel,Frame;
 let transformed=0,transformation;
 const {JVM}=await loadArchivedJvm(root,revision,{transformSource:variant==='withheld'&&nested?({filename,source})=>{
  if(!filename.endsWith('/src/jit/wasmInline.js'))return source;
  assert.equal(source.split(nestedNeedle).length,2,'Withhold only the one nested argument-fact supplier');
  const result=source.replace(nestedNeedle,'null');transformed++;
  transformation={needle:nestedNeedle,replacement:'null',originalSha256:hash(source),changedSha256:hash(result)};return result;
 }:undefined,observeModule:({filename,exports})=>{
  if(filename.endsWith('/src/core/objectModel.js'))objectModel=exports;
  if(filename.endsWith('/src/core/frame.js'))Frame=exports;
  if(variant==='withheld'&&!nested&&filename.endsWith('/src/jit/inlineIntegerArguments.js'))exports.specialize=()=>null;
 }});
 globalThis.window=globalThis;globalThis.document={};
 options.classpath=[directory];options.jit.enabled=false;options.jit.compileWorker=false;
 const j=new JVM(options);delete globalThis.document;await j.preloadClasspathClasses();
 for(const owner of [inputClass,failureClass,kernelClass])j._markClassInitialized(owner);
 j.classes[failureClass].staticFields.set('calls:I',0);
 const w=j.jit.wasmJit;
 const build=(owner,name,descriptor)=>{const method=j.findMethod(j.classes[owner],name,descriptor),state=w.methodState({method});
  w.compile({method,className:owner},state,{asCallee:true});assert.equal(state.status,'ready',state.lastCompileError);return state;};
 build(failureClass,'fail','(I)I');build(inputClass,'read','(B)I');
 if(nested)build(inputClass,'pair','()I');
 const state=build(kernelClass,'sum','(L'+inputClass+';I)I');
 assert.equal(transformed,variant==='withheld'&&nested?1:0);
 assert.ok(state.meta.normalFlowFullyCompiled);assert.equal(state.meta.constantArgumentInlineSites>0,variant==='specialized');
 if(inspect){
  console.log(JSON.stringify({sourceRevision:revision,variant,compileOnly:true,constantSites:state.meta.constantArgumentInlineSites,
   inlined:state.meta.inlinedCalls,slabSites:state.meta.slabFieldSites,demotes:state.meta.demoteReasons,
   moduleBytes:state.meta.bytes.length,mainExecuted:false}));
  process.stdout.write(execFileSync('wasm-dis',['--all-features','-'],{input:state.meta.bytes,encoding:'utf8',maxBuffer:4*1024*1024}));return;
 }
 const input=j.wasmHeap.alloc('[B',fixture.count);input.type='[B';let expected=0;
 for(let i=0;i<input.length;i++)input[i]=(Math.imul(i,53)+17)<<24>>24;
 for(let i=0;i<input.length;i+=nested?2:1){const value=nested?(input[i]&255)<<8|(input[i+1]&255):input[i]&255;
  expected=(Math.imul(expected,31)+value)|0;}
 const object=objectModel.makeObjectRef(j,inputClass,objectModel.newFields(j,inputClass));
 object.fields[inputClass+'.bytes']=input;object.fields[inputClass+'.position']=0;
 if(nested)object.fields[inputClass+'.rounds']=0;
 w.freezeCompilation();j.jit._syncCompileEnvironment={trace:false,assert:true};j.jit.markMainStarted();
 const frame=new Frame(state.method);frame.className=kernelClass;state.meta.box.frame=frame;
 const before=process.hrtime.bigint();let status,elapsedMs;
 try{status=state.run(object,fixture.count/(nested?2:1),0,1e8);elapsedMs=Number(process.hrtime.bigint()-before)/1e6;}
 finally{state.meta.box.frame=null;}
 assert.equal(status,-1);assert.equal(state.meta.box.ret,expected);
 assert.equal(object.fields[inputClass+'.position'],fixture.count);assert.equal(j.classes[failureClass].staticFields.get('calls:I'),0);
 for(let i=0;i<input.length;i++)assert.equal(input[i],(Math.imul(i,53)+17)<<24>>24,'input remains unchanged');
 if(nested)assert.equal(object.fields[inputClass+'.rounds'],fixture.count/2);
 assert.equal(j.jit.syncCompileCensus().postMainSyncCompileCount,0);
 console.log(JSON.stringify({sourceRevision:revision,variant,nested:!!nested,transformation,archiveLoaderSha256:hash(fs.readFileSync(new URL('./archive-jvm.mjs',import.meta.url))),elapsedMs,count:fixture.count,checksum:expected,
  constantSites:state.meta.constantArgumentInlineSites,inlined:state.meta.inlinedCalls,slabSites:state.meta.slabFieldSites,
  sourceSha256:fixture.sourceSha256,classes:fixture.classes,harnessSha256:hash(fs.readFileSync(script)),
  node:process.version,execArgv:process.execArgv,lateJavaCompiles:0,
  scope:'New same-source specialization ablation; no existing baseline, TeaVM or game execution.'}));
}
function run(revision,specializedOnly=false){
 assert.match(revision||'',/^[0-9a-f]{40}$/);const receipt=JSON.parse(fs.readFileSync(ledger));
 const fixture=trialOf(receipt)?.fixture;assert.ok(fixture,'Build the new fixture first');
 const input=JSON.stringify({fixture,options:receipt.diagnosticOptions}),rows=[];
 for(let pair=0;pair<3;pair++)for(const variant of specializedOnly?['specialized']:pair%2?['withheld','specialized']:['specialized','withheld']){
  const row=JSON.parse(execFileSync(process.execPath,[...flags,script,nested?'one-nested':'one',revision,variant],{input,encoding:'utf8',maxBuffer:1024*1024}));
  rows.push({...row,pair,measuredAt:new Date().toISOString()});console.log(variant+' '+row.elapsedMs.toFixed(6)+' ms, checksum '+row.checksum);
 }
 const current=JSON.parse(fs.readFileSync(ledger));(trialOf(current).smallObservations||=[]).push(...rows);
 fs.writeFileSync(ledger,JSON.stringify(current,null,2)+'\n');
}
const [command,revision,variant]=process.argv.slice(2);
if(['build','build-nested'].includes(command))build();else if(['run','run-nested'].includes(command))run(revision);else if(['run-specialized','run-nested-specialized'].includes(command))run(revision,true);
else if(['inspect','inspect-nested'].includes(command))await one(revision,variant||'specialized',true);
else if(['one','one-nested'].includes(command))await one(revision,variant);else throw Error('Usage: constant-inline.mjs build | run EXACT_REVISION | run-specialized EXACT_REVISION');
