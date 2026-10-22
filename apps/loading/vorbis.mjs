#!/usr/bin/env node
// One original sample per fresh VM; archive/setup work precedes the timer.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {vorbisProbeSource} from './workload.mjs';
import {projectMeasurementFixture,readMeasurementFixture,fixtureStdinFlag,parseMeasurementResult,recordProbeObservation} from './measurement-fixture.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const script=fileURLToPath(import.meta.url);
const player=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading');
const directory=path.join(player,'vorbis');
const receiptPath=path.join(player,'benchmark.json');
const version='0.16.0';
const nodeArgs=['--max-old-space-size=1024','--no-liftoff','--no-wasm-lazy-compilation'];
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const worker=process.argv[2]==='one';
const workerFixture=worker?readMeasurementFixture(receiptPath):null;
const read=()=>worker?workerFixture.receipt:JSON.parse(fs.readFileSync(receiptPath));
const save=fixture=>{const data=read();data.vorbisBenchmark=fixture;fs.writeFileSync(receiptPath,JSON.stringify(data,null,2)+'\n');};
const source=vorbisProbeSource();
const pinnedClasses=()=>{
 const classes=read().classes;
 for(const [name,expected]of Object.entries(classes))
  assert.equal(hash(fs.readFileSync(path.join(player,'classes',name))),expected,name);
 return classes;
};
const assets=()=>Object.fromEntries(['3-0.bin','255-3.bin'].map(name=>{
 const bytes=fs.readFileSync(path.join(player,'assets',name));
 assert.equal(hash(bytes),read().assets[name],name);return [name,new Int8Array(bytes)];
}));

function build(){
 const classes=pinnedClasses(),previous=read().vorbisBenchmark;
 assets();
 fs.mkdirSync(directory,{recursive:true});
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'loading-vorbis-build-'));
 try{
  fs.writeFileSync(path.join(directory,'LoadingKernelProbe.java'),source);
  execFileSync('javac',['--release','8','-proc:none','-classpath',path.join(player,'classes'),'-d',directory,path.join(directory,'LoadingKernelProbe.java')]);
  const reference=execFileSync('java',['-Xmx1g','-Djava.awt.headless=true','-cp',directory+path.delimiter+path.join(player,'classes'),
   'LoadingKernelProbe',path.join(player,'assets')],{maxBuffer:64*1024*1024});
  assert.ok(reference.length>0,'No reference PCM');
  fs.writeFileSync(path.join(directory,'reference.pcm'),reference);
  const src=path.join(temporary,'src/main/java'),target=path.join(temporary,'target/classes');
  fs.mkdirSync(src,{recursive:true});fs.cpSync(path.join(player,'classes'),target,{recursive:true});
  fs.copyFileSync(path.join(directory,'LoadingKernelProbe.class'),path.join(target,'LoadingKernelProbe.class'));
  const wrapper=`import org.teavm.jso.*;
public class TeaVmVorbis {
 @JSBody(params="name",script="return globalThis.loadingAssets[name];") public static native byte[] asset(String name);
 public static byte[] bridgeAsset(String name){return asset(name);}
 public static void main(String[] args)throws Exception{LoadingKernelProbe.main(new String[0]);}
 @JSExport public static double decodeMs(){return LoadingKernelProbe.decodeNanos/1e6;}
 @JSExport public static int pcmLength(){return LoadingKernelProbe.output.length;}
 @JSExport public static int pcmByte(int index){return LoadingKernelProbe.output[index];}
}`;
  const transformer=`import org.teavm.model.*;import org.teavm.model.instructions.*;
public class VorbisPlatformBridge implements ClassHolderTransformer {
 public void transformClass(ClassHolder cls,ClassHolderTransformerContext context){
  if(cls.getName().equals("GeobloxLoading")){
   MethodHolder method=cls.getMethod(new MethodDescriptor("browserAsset",ValueType.object("java.lang.String"),ValueType.arrayOf(ValueType.BYTE)));
   Program p=new Program();p.createVariable();Variable name=p.createVariable(),result=p.createVariable();BasicBlock b=p.createBasicBlock();
   InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("TeaVmVorbis","bridgeAsset",ValueType.object("java.lang.String"),ValueType.arrayOf(ValueType.BYTE)));call.setArguments(name);call.setReceiver(result);b.add(call);ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(result);b.add(exit);method.getModifiers().remove(ElementModifier.NATIVE);method.setProgram(p);
  }
  String name=cls.getName();if(!(name.startsWith("java.awt.")||name.startsWith("java.applet.")||name.startsWith("javax.swing.")||name.startsWith("javax.sound.")||name.startsWith("javax.accessibility.")||name.startsWith("java.net.Socket")||name.startsWith("java.io.ObjectInputStream")))return;
  for(MethodHolder m:cls.getMethods()){
   if(m.getModifiers().contains(ElementModifier.ABSTRACT))continue;
   Program p=new Program();p.createVariable();for(int i=0;i<m.parameterCount();i++)p.createVariable();BasicBlock b=p.createBasicBlock();
   if(m.getName().equals("<init>")||m.getName().equals("<clinit>"))b.add(new ExitInstruction());
   else{Variable failure=p.createVariable();ConstructInstruction make=new ConstructInstruction();make.setType("java.lang.UnsupportedOperationException");make.setReceiver(failure);b.add(make);InvokeInstruction init=new InvokeInstruction();init.setType(InvocationType.SPECIAL);init.setInstance(failure);init.setMethod(new MethodReference(UnsupportedOperationException.class,"<init>",void.class));b.add(init);RaiseInstruction raise=new RaiseInstruction();raise.setException(failure);b.add(raise);}
   m.getModifiers().remove(ElementModifier.NATIVE);m.setProgram(p);
  }
 }
}`;
  fs.writeFileSync(path.join(src,'TeaVmVorbis.java'),wrapper);
  fs.writeFileSync(path.join(src,'VorbisPlatformBridge.java'),transformer);
  // The same desktop declarations and fail-fast service boundary as the full
  // TeaVM fixture. No desktop service runs in this headless decoder workload.
  execFileSync('python3',['-c',`import pathlib,sys,zipfile
out=pathlib.Path(sys.argv[1])
for module in ['java.desktop','java.datatransfer','java.base']:
 with zipfile.ZipFile('/usr/lib/jvm/java-21-openjdk/jmods/'+module+'.jmod') as archive:
  for name in archive.namelist():
   rel=name.removeprefix('classes/')
   if not name.startswith('classes/') or not name.endswith('.class'):continue
   if not (rel.startswith('java/io/') and rel.endswith('Exception.class')) and not rel.startswith(('java/awt/','java/applet/','javax/swing/','javax/sound/','java/net/Socket','javax/accessibility/','java/io/ObjectInputStream','java/io/ObjectStreamConstants','java/io/ObjectInput.class')):continue
   destination=out/rel
   if not destination.exists():
    destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(archive.read(name))`,target]);
  fs.writeFileSync(path.join(temporary,'pom.xml'),`<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>local.loading</groupId><artifactId>vorbis</artifactId><version>1</version><properties><maven.compiler.release>11</maven.compiler.release></properties><dependencies>${['teavm-classlib','teavm-jso','teavm-core'].map(name=>`<dependency><groupId>org.teavm</groupId><artifactId>${name}</artifactId><version>${version}</version></dependency>`).join('')}</dependencies><build><plugins><plugin><artifactId>maven-resources-plugin</artifactId><version>3.4.0</version></plugin><plugin><artifactId>maven-compiler-plugin</artifactId><version>3.13.0</version></plugin><plugin><groupId>org.teavm</groupId><artifactId>teavm-maven-plugin</artifactId><version>${version}</version><configuration><mainClass>TeaVmVorbis</mainClass><targetType>WEBASSEMBLY_GC</targetType><targetDirectory>\${project.build.directory}/wasm</targetDirectory><targetFileName>vorbis.wasm</targetFileName><optimizationLevel>FULL</optimizationLevel><minifying>true</minifying><runtimeFileName>vorbis.wasm-runtime.js</runtimeFileName><transformers><transformer>VorbisPlatformBridge</transformer></transformers></configuration></plugin></plugins></build></project>`);
  execFileSync('mvn',['-o','-B','-ntp','compile',`org.teavm:teavm-maven-plugin:${version}:compile`,`org.teavm:teavm-maven-plugin:${version}:copy-webassembly-gc-runtime`],{
   cwd:temporary,stdio:'inherit',env:{...process.env,JAVA_HOME:'/usr/lib/jvm/java-21-openjdk',MAVEN_OPTS:'-Xmx1g'}});
  for(const [name,expected]of Object.entries(classes))assert.equal(hash(fs.readFileSync(path.join(target,name))),expected,'TeaVM changed pinned class: '+name);
  assert.equal(hash(fs.readFileSync(path.join(target,'LoadingKernelProbe.class'))),hash(fs.readFileSync(path.join(directory,'LoadingKernelProbe.class'))));
  fs.cpSync(path.join(temporary,'target/wasm'),path.join(directory,'teavm'),{recursive:true});
  const identity={sourceSha256:hash(source),probeClassSha256:hash(fs.readFileSync(path.join(directory,'LoadingKernelProbe.class'))),
   classesInventorySha256:hash(JSON.stringify(classes)),assets:Object.fromEntries(Object.keys(assets()).map(name=>[name,read().assets[name]])),
   referencePcmSha256:hash(reference),referencePcmBytes:reference.length,
   wasmSha256:hash(fs.readFileSync(path.join(directory,'teavm/vorbis.wasm'))),runtimeSha256:hash(fs.readFileSync(path.join(directory,'teavm/vorbis.wasm-runtime.js'))),
   wrapperSha256:hash(wrapper),transformerSha256:hash(transformer)};
  const fixtures=previous?.fixtures||[];
  if(previous&&previous.wasmSha256!==identity.wasmSha256)fixtures.push({...previous,runs:undefined,fixtures:undefined});
  save({...identity,version,source,purpose:'Largest original sample, one decode, no warmup; archive selection/setup excluded from decode timer',
   fixtures,runs:previous?.runs||[],diagnostics:previous?.diagnostics||[]});
  console.log('Built matched Vorbis fixture: '+reference.length+' PCM bytes');
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}

async function one(engine,revision){
 const fixture=read().vorbisBenchmark;assert.ok(fixture,'Build the Vorbis fixture first');
 assert.equal(hash(source),fixture.sourceSha256,'Rebuild the changed probe');
 assert.equal(hash(JSON.stringify(pinnedClasses())),fixture.classesInventorySha256);
 const reference=fs.readFileSync(path.join(directory,'reference.pcm'));assert.equal(hash(reference),fixture.referencePcmSha256);
 const provenance={sourceSha256:fixture.sourceSha256,fixtureSha256:fixture.probeClassSha256,
  classesInventorySha256:fixture.classesInventorySha256,assets:fixture.assets,referencePcmSha256:fixture.referencePcmSha256,
  harnessSha256:hash(fs.readFileSync(script)),node:process.version,execArgv:process.execArgv,
  fixtureTransport:workerFixture.supplied?'stdin-projected':'file-projected',
  measurementFixtureSha256:hash(JSON.stringify(workerFixture.receipt))};
 let result;
 if(engine==='jvm'){
  assert.match(revision||'',/^[0-9a-f]{40}$/);
  const stdout=execFileSync(process.execPath,[...nodeArgs,path.join(here,'probe.mjs'),'slab','3-0.bin',revision,'vorbis',player,fixtureStdinFlag],{
   input:JSON.stringify(projectMeasurementFixture(read())),encoding:'utf8',maxBuffer:16*1024*1024});
  result={...parseMeasurementResult(stdout,'PROBE_RESULT '),engine,sourceRevision:revision};
  assert.equal(result.fixtureSha256,fixture.probeClassSha256,'JVM did not execute the identical probe class');
  assert.equal(result.compilation.postMainSyncCompileCount,0);assert.deepEqual(result.lateCompiles,[]);
 }else{
  assert.equal(engine,'teavm');
  globalThis.loadingAssets=assets();
  const wasm=fs.readFileSync(path.join(directory,'teavm/vorbis.wasm'));assert.equal(hash(wasm),fixture.wasmSha256);
  assert.equal(hash(fs.readFileSync(path.join(directory,'teavm/vorbis.wasm-runtime.js'))),fixture.runtimeSha256);
  await import(pathToFileURL(path.join(directory,'teavm/vorbis.wasm-runtime.js')));
  const module=await TeaVM.wasmGC.load(wasm);await module.exports.main([]);
  assert.equal(module.exports.pcmLength(),reference.length);
  const output=Buffer.alloc(reference.length);
  for(let i=0;i<output.length;i++)output[i]=module.exports.pcmByte(i);
  assert.ok(output.equals(reference),'TeaVM PCM differs from HotSpot');
  result={engine,sourceRevision:'TeaVM '+version,decodeMs:module.exports.decodeMs(),equal:true,instrumented:false,
   wasmSha256:fixture.wasmSha256,runtimeSha256:fixture.runtimeSha256};
 }
 assert.ok(result.equal&&result.decodeMs>0&&!result.instrumented,'Invalid matched observation');
 assert.ok(nodeArgs.slice(1).every(flag=>process.execArgv.includes(flag)),'Native compilation must precede execution');
 console.log('VORBIS_RESULT '+JSON.stringify({...result,...provenance}));
}

function run(revision){
 assert.match(revision||'',/^[0-9a-f]{40}$/);
 assert.notEqual(process.env.JVM_WASM_IMPORT_STATS,'1','Keep profiling out of timing comparisons');
 const measurementInput=JSON.stringify(projectMeasurementFixture(read())),measurementHash=hash(measurementInput);
 const runId=crypto.randomUUID();
 for(let pair=0;pair<3;pair++)for(const engine of pair===1?['teavm','jvm']:['jvm','teavm']){
  const stdout=execFileSync(process.execPath,[...nodeArgs,script,'one',engine,revision,fixtureStdinFlag],{
   input:measurementInput,encoding:'utf8',maxBuffer:16*1024*1024});
  const observation={...parseMeasurementResult(stdout,'VORBIS_RESULT '),runId,pair,measuredAt:new Date().toISOString()};
  assert.equal(observation.measurementFixtureSha256,measurementHash,'Worker did not use the supplied fixture');
  const fixture=read().vorbisBenchmark;fixture.runs.push(observation);save(fixture);
  console.log(`pair ${pair+1} ${engine}: ${observation.decodeMs.toFixed(3)} ms; PCM matches every byte`);
 }
}

function inspect(revision,method='MusicDecoder.readBit()I'){
 assert.match(revision||'',/^[0-9a-f]{40}$/);
 const stdout=execFileSync(process.execPath,[...nodeArgs,path.join(here,'probe.mjs'),'slab','3-0.bin',revision,'vorbis',player,method,fixtureStdinFlag],{
  input:JSON.stringify(projectMeasurementFixture(read())),encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,JVM_WASM_IMPORT_STATS:'1'}});
 const result=parseMeasurementResult(stdout,'PROBE_RESULT '),current=read(),fixture=current.vorbisBenchmark;
 assert.ok(result.instrumented&&result.equal&&result.inspection,'Invalid method diagnostic');
 assert.equal(result.fixtureSha256,fixture.probeClassSha256);
 recordProbeObservation(current,result);
 (fixture.diagnostics||=[]).push({...result,measuredAt:new Date().toISOString(),excludedFromTiming:true});
 fs.writeFileSync(receiptPath,JSON.stringify(current,null,2)+'\n');
 console.log('Inspected '+method+' at '+result.inspection.output+'; counts excluded from timing pairs');
}

const [command,...args]=process.argv.slice(2);
if(command==='build')build();
else if(command==='one')await one(...args);
else if(command==='run')run(...args);
else if(command==='inspect')inspect(...args);
else throw Error('Usage: vorbis.mjs build | run EXACT_REVISION | one jvm|teavm EXACT_REVISION | inspect EXACT_REVISION [METHOD]');
