#!/usr/bin/env node
// One original transform per captured packet; no warmup or workload replay.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadArchivedJvm} from './archive-jvm.mjs';
import {freshLoadingBytes,canonicalExecutionCounts} from './browser.mjs';
import {selectBenchmarkRevision} from './benchmark-baseline.mjs';
import {projectMeasurementFixture,readMeasurementFixture,fixtureStdinFlag,parseMeasurementResult} from './measurement-fixture.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),script=fileURLToPath(import.meta.url);
const player=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading'),directory=path.join(player,'mdct');
const receiptPath=path.join(player,'benchmark.json'),root=path.resolve(here,'../../../java-tools');
const version='0.16.0',nodeArgs=['--max-old-space-size=1024','--no-liftoff','--no-wasm-lazy-compilation'];
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
let workerFixture;
const read=()=>workerFixture?.receipt||JSON.parse(fs.readFileSync(receiptPath));
const save=fixture=>{const r=read();r.mdctBenchmark=fixture;fs.writeFileSync(receiptPath,JSON.stringify(r,null,2)+'\n');};
const parameterNames=['blockSize','longBlockValue','leftWindowStart','leftWindowEnd','leftWindowLength','rightWindowStart','rightWindowEnd','rightWindowLength'];
const floatTables=['shortMdctTrigA','shortMdctTrigB','shortMdctTrigC','longMdctTrigA','longMdctTrigB','longMdctTrigC'];
const intTables=['shortBitReverseIndices','longBitReverseIndices'];
const uniqueIndex=(source,text,start=0)=>{const index=source.indexOf(text,start);assert.ok(index>=0,'Missing source anchor: '+text);assert.equal(source.indexOf(text,index+text.length),-1,'Ambiguous source anchor: '+text);return index;};

export function extractMdctSources(decoder,helper,reverseHelper){
 const methodStart=uniqueIndex(decoder,'    private final float[] decodePacket(int packetIndex) {');
 const prefixEnd=decoder.indexOf('        MusicDecoder.setBitInput(',methodStart);assert.ok(prefixEnd>methodStart);
 const start=uniqueIndex(decoder,'          zeroFillIndexOrHalfBlockSize = blockSize >> 1;',prefixEnd);
 const end=uniqueIndex(decoder,'\n        }\n        overlapResult = null;',start);
 const region=decoder.slice(start,end),names=new Set(region.match(/[A-Za-z_$][\w$]*/g));
 const declarations=decoder.slice(decoder.indexOf('{',methodStart)+1,prefixEnd).split('\n').filter(line=>{
  const match=line.match(/^\s*(?:int|float|boolean|Object|[A-Z]\w*)(?:\[\])?\s+(\w+)(?:\s*=.*)?;\s*$/);
  return match&&names.has(match[1])&&!parameterNames.includes(match[1]);
 }).join('\n');
 const bitStart=uniqueIndex(helper,'    final static int unsignedBitLength(byte methodGuard, int remainingBits) {');
 let level=0,bitEnd=-1;
 for(let i=helper.indexOf('{',bitStart);i<helper.length;i++){
  level+=(helper[i]==='{')-(helper[i]==='}');if(level===0){bitEnd=i+1;break;}
 }
 assert.ok(bitEnd>bitStart);const bitMethod=helper.slice(bitStart,bitEnd);
 const setupMethod=uniqueIndex(decoder,'    final static void decodeSetup(byte[] setupBytes) {');
 const setupStart=uniqueIndex(decoder,'        workBlock = new float[longBlockSize];',setupMethod);
 const setupEnd=uniqueIndex(decoder,'        codebookCount = MusicDecoder.readBits(8) + 1;',setupStart);
 const setupRegion=decoder.slice(setupStart,setupEnd),setupNames=new Set(setupRegion.match(/[A-Za-z_$][\w$]*/g));
 const setupDeclarations=decoder.slice(decoder.indexOf('{',setupMethod)+1,
  decoder.indexOf('        MusicDecoder.setBitInput(',setupMethod)).split('\n').filter(line=>{
   const match=line.match(/^\s*(?:int|float|boolean)(?:\[\])?\s+(\w+)(?:\s*=.*)?;\s*$/);
   return match&&setupNames.has(match[1]);
  }).join('\n');
 const reverseStart=uniqueIndex(reverseHelper,'    final static int reverseLowBitsIntoAccumulator(int value, int initialAccumulator, int bitCount) {');
 const reverseBodyStart=uniqueIndex(reverseHelper,'          accumulator = initialAccumulator;',reverseStart);
 const reverseBodyEnd=uniqueIndex(reverseHelper,'          resultBeforeReturn = accumulator;',reverseBodyStart);
 // This original helper slice contains only total primitive integer operations;
 // its RuntimeException catch cannot run. No game setup or transform is replayed.
 const reverseRegion=reverseHelper.slice(reverseBodyStart,reverseBodyEnd);
 const setupBody=setupRegion.replaceAll('SpriteConstructionSupport.unsignedBitLength','MdctTransformKernel.unsignedBitLength')
  .replaceAll('TextValidationFailure.reverseLowBitsIntoAccumulator','MdctTransformKernel.reverseLowBitsIntoAccumulator');
 const body=region.replaceAll('SpriteConstructionSupport.unsignedBitLength','MdctTransformKernel.unsignedBitLength');
 const generated=`public final class MdctTransformKernel {
 static byte[] fixture;static byte[] bytes;static int cursor;
 static float[] ${['workBlock',...floatTables].join(',')};
 static int[] ${intTables.join(',')};
 static float[][] rows;static int[] dimensions;static int records,setupCalls;static long transformNanos;
 static native byte[] input();
 static int readInt(){int p=cursor;cursor=p+4;return (bytes[p]&255)<<24|(bytes[p+1]&255)<<16|(bytes[p+2]&255)<<8|(bytes[p+3]&255);}
 static float[] readFloats(){int n=readInt();float[] a=new float[n];for(int i=0;i<n;i++)a[i]=Float.intBitsToFloat(readInt());return a;}
 static int[] readInts(){int n=readInt();int[] a=new int[n];for(int i=0;i<n;i++)a[i]=readInt();return a;}
 public static void main(String[] args){
  bytes=fixture!=null?fixture:input();cursor=0;
  if(readInt()!=0x4d444354||readInt()!=1)throw new IllegalArgumentException();
  records=readInt();int small=readInt(),large=readInt();
  // The stream still contains the captured tables as pinned oracle data. Use
  // the original setup algorithm to construct the dependencies once instead.
  for(int table=0;table<8;table++){int n=readInt();cursor+=n*4;}
  if(small<=0||large<small)throw new IllegalArgumentException();
  prepareTables(small,large);
  rows=new float[records][];dimensions=new int[records*8];
  for(int i=0;i<records;i++){for(int j=0;j<8;j++)dimensions[i*8+j]=readInt();rows[i]=readFloats();}
  if(cursor!=bytes.length||small<=0||large<small)throw new IllegalArgumentException();
  long start=System.nanoTime();
  runTransforms();
  transformNanos=System.nanoTime()-start;
 }
 static void runTransforms(){
  for(int i=0;i<records;i++){int p=i*8;workBlock=rows[i];
   transform(${parameterNames.map((_,i)=>'dimensions[p'+(i?'+'+i:'')+']').join(',')});
  }
 }
 ${bitMethod}
 static int reverseLowBitsIntoAccumulator(int value,int initialAccumulator,int bitCount){
  int accumulator;
${reverseRegion}
  return accumulator;
 }
 static void prepareTables(int shortBlockSize,int longBlockSize){
  setupCalls++;
${setupDeclarations}
${setupBody}
 }
 static void transform(${parameterNames.map(name=>'int '+name).join(',')}){
${declarations}
${body}
 }
}`;
 const before=`MdctCapture.before(${parameterNames.join(',')},shortBlockSize,longBlockSize,workBlock,${[...floatTables,...intTables].join(',')});\n`;
 const captured=decoder.slice(0,start)+before+region+'\n          MdctCapture.after(workBlock);'+decoder.slice(end);
 return {generated,captured,region,bitMethod,declarations,setupRegion,reverseRegion,regionSha256:hash(region),helperMethodSha256:hash(bitMethod),setupRegionSha256:hash(setupRegion),reverseRegionSha256:hash(reverseRegion)};
}

function captureSource(){return `import java.io.*;import java.nio.file.*;
public class MdctCapture {
 static DataOutputStream input,expected;static int count;static float[] pending;
 static void floats(DataOutputStream out,float[] a)throws IOException{out.writeInt(a.length);for(float x:a)out.writeInt(Float.floatToRawIntBits(x));}
 static void ints(DataOutputStream out,int[] a)throws IOException{out.writeInt(a.length);for(int x:a)out.writeInt(x);}
 static void before(${parameterNames.map(n=>'int '+n).join(',')},int small,int large,float[] work,${floatTables.map(n=>'float[] '+n).join(',')},${intTables.map(n=>'int[] '+n).join(',')}){
  try{if(pending!=null)throw new AssertionError();
   if(count==0){input.writeInt(small);input.writeInt(large);${floatTables.map(n=>'floats(input,'+n+');').join('')}${intTables.map(n=>'ints(input,'+n+');').join('')}}
   ${parameterNames.map(n=>'input.writeInt('+n+');').join('')}floats(input,work);pending=work;
  }catch(IOException e){throw new UncheckedIOException(e);}
 }
 static void after(float[] work){try{if(work!=pending)throw new AssertionError();floats(expected,work);pending=null;count++;}catch(IOException e){throw new UncheckedIOException(e);}}
 public static void main(String[] args)throws Exception{
  Path dir=Paths.get(args[1]);input=new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(dir.resolve("input.bin"))));
  expected=new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(dir.resolve("expected.bin"))));
  input.writeInt(0x4d444354);input.writeInt(1);input.writeInt(0);expected.writeInt(0x4d44434f);expected.writeInt(1);expected.writeInt(0);
  try{LoadingKernelProbe.main(new String[]{args[0]});if(count==0||pending!=null)throw new AssertionError();}
  finally{input.close();expected.close();}
  for(String name:new String[]{"input.bin","expected.bin"}){try(RandomAccessFile f=new RandomAccessFile(dir.resolve(name).toFile(),"rw")){f.seek(8);f.writeInt(count);}}
 }
}`;}
const referenceDriver=`import java.io.*;import java.nio.file.*;
public class MdctReference {
 public static void main(String[] args)throws Exception{
  MdctTransformKernel.fixture=Files.readAllBytes(Paths.get(args[0]));MdctTransformKernel.main(new String[0]);
  DataOutputStream out=new DataOutputStream(new BufferedOutputStream(System.out));out.writeInt(0x4d44434f);out.writeInt(1);out.writeInt(MdctTransformKernel.rows.length);
  for(float[] a:MdctTransformKernel.rows){out.writeInt(a.length);for(float x:a)out.writeInt(Float.floatToRawIntBits(x));}out.flush();
 }
}`;
const wrapper=`import org.teavm.jso.*;
public class TeaVmMdct {
 @JSBody(script="return globalThis.mdctInput;")public static native byte[] asset();
 public static byte[] bridgeInput(){return asset();}
 public static void main(String[] args){MdctTransformKernel.fixture=asset();MdctTransformKernel.main(new String[0]);}
 @JSExport public static int setupCount(){return MdctTransformKernel.setupCalls;}
 @JSExport public static double elapsedMs(){return MdctTransformKernel.transformNanos/1e6;}
 @JSExport public static int recordCount(){return MdctTransformKernel.rows.length;}
 @JSExport public static int rowLength(int i){return MdctTransformKernel.rows[i].length;}
 @JSExport public static int outputWord(int i,int j){return Float.floatToRawIntBits(MdctTransformKernel.rows[i][j]);}
}`;
const transformer=`import org.teavm.model.*;import org.teavm.model.instructions.*;
public class MdctInputBridge implements ClassHolderTransformer {
 public void transformClass(ClassHolder cls,ClassHolderTransformerContext context){if(!cls.getName().equals("MdctTransformKernel"))return;
  MethodHolder m=cls.getMethod(new MethodDescriptor("input",ValueType.arrayOf(ValueType.BYTE)));Program p=new Program();p.createVariable();Variable r=p.createVariable();BasicBlock b=p.createBasicBlock();
  InvokeInstruction call=new InvokeInstruction();call.setType(InvocationType.SPECIAL);call.setMethod(new MethodReference("TeaVmMdct","bridgeInput",ValueType.arrayOf(ValueType.BYTE)));call.setReceiver(r);b.add(call);
  ExitInstruction exit=new ExitInstruction();exit.setValueToReturn(r);b.add(exit);m.getModifiers().remove(ElementModifier.NATIVE);m.setProgram(p);
 }
}`;

export function inspectCapture(input,expected){
 const state={offset:0},int=()=>{assert.ok(state.offset+4<=input.length,'Truncated input');const n=input.readInt32BE(state.offset);state.offset+=4;return n;};
 assert.equal(int(),0x4d444354);assert.equal(int(),1);const count=int(),small=int(),large=int();assert.ok(count>0&&count<100000&&small>0&&large>=small);
 const tables=[];for(let i=0;i<8;i++){const n=int();assert.ok(n>0&&n<=large);tables.push(n);state.offset+=n*4;assert.ok(state.offset<=input.length);}
 let floats=0;const sizes={},lengths=[];
 for(let i=0;i<count;i++){
  const dims=Array.from({length:8},int),length=int();assert.ok(dims[0]>0&&dims[0]<=length&&length<=large);assert.ok(dims[1]===0||dims[1]===1);
  assert.ok(dims[2]>=0&&dims[3]<=dims[0]&&dims[3]>=dims[2]&&dims[4]>0);assert.ok(dims[5]>=0&&dims[6]<=dims[0]&&dims[6]>=dims[5]&&dims[7]>0);
  sizes[dims[0]]=(sizes[dims[0]]||0)+1;lengths.push(length);state.offset+=length*4;assert.ok(state.offset<=input.length);floats+=length;
 }
 assert.equal(state.offset,input.length,'Trailing input');assert.equal(expected.readInt32BE(0),0x4d44434f);assert.equal(expected.readInt32BE(4),1);assert.equal(expected.readInt32BE(8),count);
 let at=12,total=0;for(let i=0;i<count;i++){assert.ok(at+4<=expected.length);const n=expected.readInt32BE(at);assert.equal(n,lengths[i]);at+=4+n*4;total+=n;assert.ok(at<=expected.length);}
 assert.equal(at,expected.length);assert.equal(total,floats);return {records:count,floatWords:floats,shortBlockSize:small,longBlockSize:large,tableLengths:tables,blockCounts:sizes};
}

function build(reuseCapture=false){
 const r=read(),sourceRoot=path.resolve(here,'../../../funorb-decompiled/games/geoblox');
 if(!reuseCapture)for(const [name,sha]of Object.entries(r.classes))assert.equal(hash(fs.readFileSync(path.join(player,'classes',name))),sha);
 const decoder=fs.readFileSync(path.join(sourceRoot,'MusicDecoder.java'),'utf8'),helper=fs.readFileSync(path.join(sourceRoot,'SpriteConstructionSupport.java'),'utf8');
 const reverseHelper=fs.readFileSync(path.join(sourceRoot,'TextValidationFailure.java'),'utf8');
 const sources=extractMdctSources(decoder,helper,reverseHelper),capture=captureSource();
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'mdct-component-'));
 try{
  const captureDir=path.join(temporary,'capture');fs.mkdirSync(captureDir);
  let pcm,patchedDecoderSha256;
  if(!reuseCapture){
  console.log('Capturing the changed decoder around its original transform...');
  for(const [name,text]of Object.entries({'MusicDecoder.java':sources.captured,'MdctCapture.java':capture}))fs.writeFileSync(path.join(captureDir,name),text);
  execFileSync('javac',['--release','8','-proc:none','-classpath',path.join(player,'classes')+path.delimiter+path.join(player,'vorbis'),'-d',captureDir,...['MusicDecoder.java','MdctCapture.java'].map(n=>path.join(captureDir,n))]);
  pcm=execFileSync('java',['-Xmx1g','-Djava.awt.headless=true','-cp',[captureDir,path.join(player,'vorbis'),path.join(player,'classes')].join(path.delimiter),'MdctCapture',path.join(player,'assets'),captureDir],{maxBuffer:64*1024*1024});
  assert.equal(hash(pcm),r.vorbisBenchmark.referencePcmSha256,'Capture instrumentation changed the known PCM');
  patchedDecoderSha256=hash(fs.readFileSync(path.join(captureDir,'MusicDecoder.class')));
  }else{
   const previous=r.mdctBenchmark;assert.ok(previous,'No captured fixture to reuse');
   assert.equal(hash(decoder),previous.decoderSourceSha256);assert.equal(hash(helper),previous.helperSourceSha256);
   assert.equal(sources.regionSha256,previous.regionSha256);assert.equal(sources.helperMethodSha256,previous.helperMethodSha256);
   for(const [name,key]of [['input.bin','inputSha256'],['expected.bin','expectedSha256']]){
    const bytes=fs.readFileSync(path.join(directory,name));assert.equal(hash(bytes),previous[key]);fs.writeFileSync(path.join(captureDir,name),bytes);
   }
   patchedDecoderSha256=previous.patchedDecoderSha256;console.log('Reusing captured packet data; no decoder capture rerun.');
  }
  const input=fs.readFileSync(path.join(captureDir,'input.bin')),expected=fs.readFileSync(path.join(captureDir,'expected.bin')),shape=inspectCapture(input,expected);
  const classes=path.join(temporary,'classes');fs.mkdirSync(classes);
  fs.writeFileSync(path.join(temporary,'MdctTransformKernel.java'),sources.generated);
  execFileSync('javac',['--release','8','-proc:none','-d',classes,path.join(temporary,'MdctTransformKernel.java')]);
  fs.writeFileSync(path.join(captureDir,'MdctReference.java'),referenceDriver);
  execFileSync('javac',['--release','8','-proc:none','-classpath',classes,'-d',captureDir,path.join(captureDir,'MdctReference.java')]);
  const actual=execFileSync('java',['-Xmx1g','-cp',captureDir+path.delimiter+classes,'MdctReference',path.join(captureDir,'input.bin')],{maxBuffer:64*1024*1024});
  assert.ok(actual.equals(expected),'Extracted component differs from the captured original transform');
  console.log('Changed table-generating component matches all '+shape.floatWords+' cached original float words across '+shape.records+' packets.');
  const src=path.join(temporary,'src/main/java'),target=path.join(temporary,'target/classes');fs.mkdirSync(src,{recursive:true});fs.mkdirSync(target,{recursive:true});
  fs.copyFileSync(path.join(classes,'MdctTransformKernel.class'),path.join(target,'MdctTransformKernel.class'));
  fs.writeFileSync(path.join(src,'TeaVmMdct.java'),wrapper);fs.writeFileSync(path.join(src,'MdctInputBridge.java'),transformer);
  fs.writeFileSync(path.join(temporary,'pom.xml'),`<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>local.loading</groupId><artifactId>mdct</artifactId><version>1</version><properties><maven.compiler.release>11</maven.compiler.release></properties><dependencies>${['teavm-classlib','teavm-jso','teavm-core'].map(n=>`<dependency><groupId>org.teavm</groupId><artifactId>${n}</artifactId><version>${version}</version></dependency>`).join('')}</dependencies><build><plugins><plugin><artifactId>maven-resources-plugin</artifactId><version>3.4.0</version></plugin><plugin><artifactId>maven-compiler-plugin</artifactId><version>3.13.0</version></plugin><plugin><groupId>org.teavm</groupId><artifactId>teavm-maven-plugin</artifactId><version>${version}</version><configuration><mainClass>TeaVmMdct</mainClass><targetType>WEBASSEMBLY_GC</targetType><targetDirectory>\${project.build.directory}/wasm</targetDirectory><targetFileName>mdct.wasm</targetFileName><runtimeFileName>mdct.wasm-runtime.js</runtimeFileName><optimizationLevel>FULL</optimizationLevel><minifying>true</minifying><transformers><transformer>MdctInputBridge</transformer></transformers></configuration></plugin></plugins></build></project>`);
  execFileSync('mvn',['-o','-B','-ntp','compile',`org.teavm:teavm-maven-plugin:${version}:compile`,`org.teavm:teavm-maven-plugin:${version}:copy-webassembly-gc-runtime`],{cwd:temporary,stdio:'inherit',env:{...process.env,JAVA_HOME:'/usr/lib/jvm/java-21-openjdk',MAVEN_OPTS:'-Xmx1g'}});
  const kernel=fs.readFileSync(path.join(classes,'MdctTransformKernel.class'));
  assert.equal(hash(fs.readFileSync(path.join(target,'MdctTransformKernel.class'))),hash(kernel),'TeaVM input class changed');
  fs.mkdirSync(path.join(directory,'classes'),{recursive:true});fs.copyFileSync(path.join(classes,'MdctTransformKernel.class'),path.join(directory,'classes/MdctTransformKernel.class'));
  fs.writeFileSync(path.join(directory,'MdctTransformKernel.java'),sources.generated);fs.writeFileSync(path.join(directory,'input.bin'),input);fs.writeFileSync(path.join(directory,'expected.bin'),expected);
  fs.cpSync(path.join(temporary,'target/wasm'),path.join(directory,'teavm'),{recursive:true});
  const previous=r.mdctBenchmark,fixtures=previous?.fixtures||[];
  if(previous&&previous.sourceSha256!==hash(sources.generated))fixtures.push({...previous,runs:undefined,fixtures:undefined});
  save({version,...shape,setupKind:'original-table-generation',setupRegionSha256:sources.setupRegionSha256,reverseRegionSha256:sources.reverseRegionSha256,reverseHelperSourceSha256:hash(reverseHelper),sourceSha256:hash(sources.generated),regionSha256:sources.regionSha256,helperMethodSha256:sources.helperMethodSha256,decoderSourceSha256:hash(decoder),helperSourceSha256:hash(helper),captureSourceSha256:hash(capture),patchedDecoderSha256,originalDecoderClassSha256:r.classes['MusicDecoder.class'],capturedPcmSha256:pcm?hash(pcm):previous.capturedPcmSha256,kernelClassSha256:hash(kernel),inputSha256:hash(input),expectedSha256:hash(expected),wrapperSha256:hash(wrapper),transformerSha256:hash(transformer),wasmSha256:hash(fs.readFileSync(path.join(directory,'teavm/mdct.wasm'))),runtimeSha256:hash(fs.readFileSync(path.join(directory,'teavm/mdct.wasm-runtime.js'))),fixtures,runs:previous?.runs||[],purpose:'Original table setup once before timing; original MDCT and both windows for every captured nonsilent packet once each; no replay/warmup; native packet driver; archive/codebook/overlap/PCM packing excluded; exact cached full-array float bits'});
  console.log('Built matched original-transform fixture at '+directory);
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}

async function one(engine,revision,inspection=false){
 const fixture=read().mdctBenchmark;assert.ok(fixture,'Build the transform fixture first');
 const input=fs.readFileSync(path.join(directory,'input.bin')),expected=fs.readFileSync(path.join(directory,'expected.bin'));
 assert.equal(hash(input),fixture.inputSha256);assert.equal(hash(expected),fixture.expectedSha256);
 assert.equal(hash(fs.readFileSync(path.join(directory,'classes/MdctTransformKernel.class'))),fixture.kernelClassSha256);
 let elapsedMs,output,methods,compilation,code,setupCount;
 if(engine==='teavm'){
  const wasm=fs.readFileSync(path.join(directory,'teavm/mdct.wasm'));assert.equal(hash(wasm),fixture.wasmSha256);
  assert.equal(hash(fs.readFileSync(path.join(directory,'teavm/mdct.wasm-runtime.js'))),fixture.runtimeSha256);
  globalThis.mdctInput=new Int8Array(input);
  await import(pathToFileURL(path.join(directory,'teavm/mdct.wasm-runtime.js')));const module=await TeaVM.wasmGC.load(wasm);await module.exports.main([]);
  elapsedMs=module.exports.elapsedMs();setupCount=module.exports.setupCount();assert.equal(module.exports.recordCount(),fixture.records);
  output=Buffer.alloc(expected.length);let at=0;const put=n=>{output.writeInt32BE(n,at);at+=4;};put(0x4d44434f);put(1);put(fixture.records);
  for(let i=0;i<fixture.records;i++){const n=module.exports.rowLength(i);put(n);for(let j=0;j<n;j++)put(module.exports.outputWord(i,j));}assert.equal(at,output.length);
 }else{
  assert.equal(engine,'jvm');assert.match(revision,/^[0-9a-f]{40}$/);const {JVM}=await loadArchivedJvm(root,revision);
  const options=structuredClone(read().diagnosticOptions);options.classpath=[path.join(directory,'classes')];options.jit.compileWorker=false;options.jit.preparationPolicy={entryMethods:['MdctTransformKernel.main([Ljava/lang/String;)V']};
  globalThis.window=globalThis;globalThis.document={};const j=new JVM(options);delete globalThis.document;
  j.jre.MdctTransformKernel={applicationFallback:true,staticMethods:{'input()[B':vm=>freshLoadingBytes(vm,new Int8Array(input))}};
  const late=[],compile=j.jit.startSynchronousCompile.bind(j.jit);j.jit._syncCompileEnvironment={trace:false,assert:true};j.jit.startSynchronousCompile=(method,entry)=>{if(j.jit.mainStarted)late.push(j.jit.methodIdentity(method));return compile(method,entry);};
  await j.run('MdctTransformKernel');const fields=j.classes.MdctTransformKernel.staticFields;elapsedMs=Number(fields.get('transformNanos:J'))/1e6;setupCount=fields.get('setupCalls:I');
  if(inspection){
   const state=j.jit.wasmJit.compiled.find(s=>s.key.startsWith('MdctTransformKernel.transform('));assert.ok(state?.meta?.bytes);
   const target=path.join(player,'vorbis/current.wat'),teaTarget=path.join(player,'vorbis/current-teavm.wat');
   fs.writeFileSync(target,execFileSync('wasm-dis',['--all-features','-'],{input:state.meta.bytes}));
   fs.writeFileSync(teaTarget,execFileSync('wasm-dis',['--all-features','-'],{input:fs.readFileSync(path.join(directory,'teavm/mdct.wasm'))}));
   code={method:state.key,sha256:hash(state.meta.bytes),output:target,teavm:{sha256:fixture.wasmSha256,output:teaTarget}};
  }
  const rows=fields.get('rows:[[F');assert.equal(rows.length,fixture.records);output=Buffer.alloc(expected.length);let at=0;
  const put=n=>{output.writeInt32BE(n,at);at+=4;};put(0x4d44434f);put(1);put(fixture.records);
  const scratch=new DataView(new ArrayBuffer(4)),little=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
  for(let i=0;i<rows.length;i++){const row=rows[i],view=row instanceof Float32Array?new DataView(row.buffer,row.byteOffset,row.byteLength):null;
   put(row.length);for(let k=0;k<row.length;k++){
   if(view)put(view.getInt32(k*4,little));
   else{scratch.setFloat32(0,row[k]);put(scratch.getInt32(0));}
  }}assert.equal(at,output.length);
  methods=j.jit.wasmJit.compiled.filter(s=>s.key.startsWith('MdctTransformKernel.')).map(s=>({key:s.key,runs:s.runs,...canonicalExecutionCounts(s.meta),exits:s.exits,fuelExits:s.fuelExits,
   nativeExitCount:s.meta?.directFrameContext?.exitCount??null,directNativeExitCount:s.meta?.directFrameContext?.directExitCount??null,nativeThrowCount:s.meta?.directFrameContext?.throwCount??null,
   lastNativeExitStatus:s.meta?.directFrameContext?.lastExitStatus??null,calleeNativeExitCount:s.callee?.meta?.directFrameContext?.exitCount??null,
   full:!!s.meta?.fullyCompiled,structured:!!s.meta?.structured,demotes:[...(s.meta?.demoteReasons||[])],
   ...(inspection?{omittedArrayFillCount:s.meta?.omittedArrayFillCount,slabFieldSites:s.meta?.slabFieldSites,loopInvariantNumericValueCount:s.meta?.loopInvariantNumericValueCount,nativeStaticArrayBodySites:s.meta?.nativeStaticArrayBodySites,
    nativeStaticIntrinsicReadinessGuardCount:s.meta?.nativeStaticIntrinsicReadinessGuardCount,
    nativeReadinessGuardsReusedCount:s.meta?.nativeReadinessGuardsReusedCount,
    nativeArrayRematerializedReferenceCount:s.meta?.nativeArrayRematerializedReferenceCount,
    nativeStaticArrayCapturedReferenceCount:s.meta?.nativeStaticArrayCapturedReferenceCount,
    nativeArraySharedMetadataValueCount:s.meta?.nativeArraySharedMetadataValueCount,
    nativeArrayMetadataPhiCopiesOmittedCount:s.meta?.nativeArrayMetadataPhiCopiesOmittedCount,
    imports:[...s.meta?.importStats||[]].filter(([,count])=>count>0).map(([name,count])=>({name,count}))}:{}),
  }));
  compilation=j.jit.syncCompileCensus();assert.deepEqual(late,[]);assert.equal(compilation.postMainSyncCompileCount,0);
  const transform=methods.find(s=>s.key.startsWith('MdctTransformKernel.transform('));assert.ok(transform?.full&&transform.directEntries+transform.runs>=fixture.records,'Transform did not run natively');
  const driver=methods.find(s=>s.key==='MdctTransformKernel.runTransforms()V');
  assert.ok(driver?.full&&driver.runs+driver.directEntries>0,'Packet driver must execute natively');
  assert.ok(transform.directEntries>=fixture.records-2,'Per-packet calls must use native links');
  if(fixture.setupKind==='original-table-generation'){
   assert.equal(transform.runs+transform.directEntries,fixture.records,'No transform replay or warmup');
   assert.equal(transform.nativeExitCount,0,'Original setup must leave the timed transform entirely native');
   assert.equal(transform.nativeThrowCount,0,'Timed transform must not throw');
  }
 }
 assert.equal(setupCount,1,'The original dependency setup must run exactly once, without transform warmup');
 const equal=output.equals(expected),firstDifference=equal?-1:output.findIndex((value,i)=>value!==expected[i]);assert.ok(equal,'Transform output float bits differ at byte '+firstDifference);
 assert.ok(elapsedMs>0);assert.ok(nodeArgs.every(flag=>process.execArgv.includes(flag)),'Eager native compilation flags missing');
 console.log('MDCT_RESULT '+JSON.stringify({engine,sourceRevision:engine==='jvm'?revision:'TeaVM '+version,elapsedMs,equal,setupCount,setupKind:fixture.setupKind,outputSha256:hash(output),fixture:{sourceSha256:fixture.sourceSha256,kernelClassSha256:fixture.kernelClassSha256,inputSha256:fixture.inputSha256,expectedSha256:fixture.expectedSha256,...(engine==='teavm'?{wasmSha256:fixture.wasmSha256}:{})},methods,compilation,code,node:process.version,execArgv:process.execArgv,instrumented:inspection||process.env.JVM_WASM_IMPORT_STATS==='1',fixtureTransport:workerFixture?.supplied?'stdin-projected':'file-projected'}));
}
function run(revision,engines=['jvm','teavm']){
 assert.notEqual(process.env.JVM_WASM_IMPORT_STATS,'1','Keep profiling out of timing runs');
 const runId=crypto.randomUUID(),input=JSON.stringify(projectMeasurementFixture(read()));
 for(let pair=0;pair<3;pair++)for(const engine of pair===1?[...engines].reverse():engines){
  const stdout=execFileSync(process.execPath,[...nodeArgs,script,'one',engine,revision,fixtureStdinFlag],{input,encoding:'utf8',maxBuffer:16*1024*1024});
  const result=parseMeasurementResult(stdout,'MDCT_RESULT '),fixture=read().mdctBenchmark;assert.ok(!result.instrumented);fixture.runs.push({...result,runId,pair,measuredAt:new Date().toISOString()});save(fixture);
  console.log('pair '+(pair+1)+' '+engine+': '+result.elapsedMs.toFixed(3)+' ms; all float words exact');
 }
}
function inspect(revision){
 const stdout=execFileSync(process.execPath,[...nodeArgs,script,'one','jvm',revision,'inspect',fixtureStdinFlag],{
  input:JSON.stringify(projectMeasurementFixture(read())),encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,JVM_WASM_IMPORT_STATS:'1'}});
 const result=parseMeasurementResult(stdout,'MDCT_RESULT ');assert.ok(result.instrumented&&result.code&&result.equal);
 const fixture=read().mdctBenchmark;(fixture.diagnostics||=[]).push({...result,excludedFromTiming:true,measuredAt:new Date().toISOString()});save(fixture);
 console.log('Inspected '+result.code.method+'; code/import counts excluded from timings');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const [command,...args]=process.argv.slice(2);
 if(command==='one'){workerFixture=readMeasurementFixture(receiptPath);await one(args[0],args[1],args[2]==='inspect');}
 else if(command==='build')build();
 else if(command==='rebuild')build(true);
 else if(command==='run')run(selectBenchmarkRevision(args[0]));
 else if(command==='run-jvm')run(selectBenchmarkRevision(args[0]),['jvm']);
 else if(command==='inspect')inspect(selectBenchmarkRevision(args[0]));
 else throw Error('Usage: mdct.mjs build | rebuild | inspect EXACT_REVISION | run [EXACT_REVISION] | run-jvm EXACT_REVISION | one jvm|teavm EXACT_REVISION');
}
