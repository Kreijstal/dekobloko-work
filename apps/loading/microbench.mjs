#!/usr/bin/env node
// Causal diagnostics, not loading/FPS acceptance. No workload warmup or replay.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadArchivedJvm} from './archive-jvm.mjs';

const script=fileURLToPath(import.meta.url);
const root=path.resolve(path.dirname(script),'../../../java-tools');
const player=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading');
const directory=path.join(player,'microbench');
const receiptPath=path.join(player,'benchmark.json');
const cases=['scalar','byte-array','boolean-array','bits-local','bits-static','bits-call','bits-static-cursors','bits-static-array',
 'bits-cross-owner','sin','bits-instance','bits-instance-call','butterfly-static','butterfly-local',
 'float-load-static','float-load-cached','float-load-parameter','butterfly-cached',
 'butterfly-no-readback','butterfly-loads','float-store-parameter','float-store-readback','float-arithmetic',
 'bzip-block','bzip-ready-owner','int-load-parameter','int-load-cast','cold-prefix-loop','ready-prefix-loop'];
const iterations=1_000_000,seed='q',version='0.16.0';
// Compile Wasm with V8's optimizing tier before execution on BOTH backends.
// This removes lazy Wasm compilation/tiering from these operation diagnostics.
const nodeArgs=['--max-old-space-size=1024','--no-liftoff','--no-wasm-lazy-compilation'];
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const read=()=>JSON.parse(fs.readFileSync(receiptPath));
const codecAsset='0-27.bin';
const codecClassNames=['Bzip2Decoder.class','Bzip2DecoderState.class','UsernameResponseSupport.class','ContextualRuntimeException.class'];
const codecInput=fs.readFileSync(path.join(player,'assets',codecAsset));
assert.equal(hash(codecInput),read().assets[codecAsset],'Changed codec input');
assert.equal(codecInput[0],1,'Expected a Jagex Bzip archive');
const codecOutputBytes=codecInput.readUInt32BE(5);
const save=microbenchmarks=>{
 const receipt=read();receipt.microbenchmarks=microbenchmarks;
 fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
};
const source=`public class LoadingMicroKernel {
 static int checksum, byteCursor, bitCursor, readerInitializations;
 static byte[] bytes;
 static float[] samples,weights,transformed;
 static long elapsedNanos;
 static int loopPrefixes,loopSteps,loopTails,initializerPrefixes;
 static int scalar(int n,int seed) {
  int x=seed,sum=0;
  for(int i=0;i<n;i++){x=x*1664525+1013904223;sum=sum*33+x;}
  return sum;
 }
 static int byteArray(int n,byte[] a) {
  int sum=0;
  for(int i=0;i<n;i++){int p=i&1023;a[p]=(byte)(a[p]^1);sum=sum*33+a[p];}
  return sum;
 }
 static int booleanArray(int n,boolean[] a) {
  int sum=0;
  for(int i=0;i<n;i++){int p=i&1023;a[p]=!a[p];sum=sum*33+(a[p]?1:0);}
  return sum;
 }
 static int bitsLocal(int n,byte[] a) {
  int sum=0,b=0,k=0;
  for(int i=0;i<n;i++){
   int v=a[b]>>k&1;k=k+1;b=(b+(k>>3))&1023;k=k&7;sum=sum*33+v;
  }
  return sum;
 }
 static int bitsStatic(int n) {
  int sum=0;
  for(int i=0;i<n;i++){
   int v=bytes[byteCursor]>>bitCursor&1;bitCursor=bitCursor+1;
   byteCursor=(byteCursor+(bitCursor>>3))&1023;bitCursor=bitCursor&7;sum=sum*33+v;
  }
  return sum;
 }
 static int readBit() {
  int v=bytes[byteCursor]>>bitCursor&1;bitCursor=bitCursor+1;
  byteCursor=(byteCursor+(bitCursor>>3))&1023;bitCursor=bitCursor&7;return v;
 }
 static int bitsCall(int n) {
  int sum=0;
  for(int i=0;i<n;i++)sum=sum*33+readBit();
  return sum;
 }
 static int bitsStaticCursors(int n,byte[] a) {
  int sum=0;
  for(int i=0;i<n;i++){
   int v=a[byteCursor]>>bitCursor&1;bitCursor=bitCursor+1;
   byteCursor=(byteCursor+(bitCursor>>3))&1023;bitCursor=bitCursor&7;sum=sum*33+v;
  }
  return sum;
 }
 static int bitsStaticArray(int n) {
  int sum=0,b=0,k=0;
  for(int i=0;i<n;i++){
   int v=bytes[b]>>k&1;k=k+1;b=(b+(k>>3))&1023;k=k&7;sum=sum*33+v;
  }
  return sum;
 }
 static int bitsCrossOwner(int n) {
  int sum=0;
  for(int i=0;i<n;i++)sum=sum*33+MicroBitReader.readBit();
  return sum;
 }
 static int sine(int n,int seed) {
  int sum=0;
  for(int i=0;i<n;i++)sum=sum*33+(int)(Math.sin(((i+seed)&8191)*0.0007669903939428206)*1000000.0);
  return sum;
 }
 static int bitsInstance(int n,MicroCursor r,byte[] a) {
  int sum=0;
  for(int i=0;i<n;i++){
   int v=a[r.byteCursor]>>r.bitCursor&1;r.bitCursor=r.bitCursor+1;
   r.byteCursor=(r.byteCursor+(r.bitCursor>>3))&1023;r.bitCursor=r.bitCursor&7;sum=sum*33+v;
  }
  return sum;
 }
 static int bitsInstanceCall(int n,MicroCursor r,byte[] a) {
  int sum=0;
  for(int i=0;i<n;i++)sum=sum*33+r.readBit(a);
  return sum;
 }
 static int butterflyStatic(int n) {
  int sum=0;
  for(int i=0;i<n;i++){
   int p=i&1023,q=(p+512)&1023;
   float a=samples[p],b=samples[q];
   transformed[p]=(a-b)*weights[p];transformed[q]=a+b;
   sum=sum*33+(int)(transformed[p]*1048576.0f);
  }
  return sum;
 }
 static int butterflyLocal(int n,float[] data,float[] factors,float[] out) {
  int sum=0;
  for(int i=0;i<n;i++){
   int p=i&1023,q=(p+512)&1023;
   float a=data[p],b=data[q];
   out[p]=(a-b)*factors[p];out[q]=a+b;
   sum=sum*33+(int)(out[p]*1048576.0f);
  }
  return sum;
 }
 static int butterflyCached(int n) {
  float[] data=samples,factors=weights,out=transformed;
  int sum=0;
  for(int i=0;i<n;i++){
   int p=i&1023,q=(p+512)&1023;
   float a=data[p],b=data[q];
   out[p]=(a-b)*factors[p];out[q]=a+b;
   sum=sum*33+(int)(out[p]*1048576.0f);
  }
  return sum;
 }
 // A single array load isolates reference handling from butterfly stores/math.
 static int floatLoadStatic(int n) {
  int sum=0;
  for(int i=0;i<n;i++)sum=sum*33+(int)(samples[i&1023]*1048576.0f);
  return sum;
 }
 static int floatLoadCached(int n) {
  float[] data=samples;
  int sum=0;
  for(int i=0;i<n;i++)sum=sum*33+(int)(data[i&1023]*1048576.0f);
  return sum;
 }
 static int floatLoadParameter(int n,float[] data) {
  int sum=0;
  for(int i=0;i<n;i++)sum=sum*33+(int)(data[i&1023]*1048576.0f);
  return sum;
 }
 static int butterflyNoReadback(int n,float[] data,float[] factors,float[] out) {
  int sum=0;
  for(int i=0;i<n;i++){
   int p=i&1023,q=(p+512)&1023;
   float a=data[p],b=data[q],c=(a-b)*factors[p];
   out[p]=c;out[q]=a+b;
   sum=sum*33+(int)(c*1048576.0f);
  }
  return sum;
 }
 static int butterflyLoads(int n,float[] data,float[] factors) {
  int sum=0;
  for(int i=0;i<n;i++){
   int p=i&1023,q=(p+512)&1023;
   float a=data[p],b=data[q],c=(a-b)*factors[p];
   sum=sum*33+(int)(c*1048576.0f);
  }
  return sum;
 }
 static int floatStoreParameter(int n,float[] out) {
  int sum=0;
  for(int i=0;i<n;i++){
   int p=i&1023;float v=p*0.0009765625f;
   out[p]=v;sum=sum*33+(int)(v*1048576.0f);
  }
  return sum;
 }
 static int floatStoreReadback(int n,float[] out) {
  int sum=0;
  for(int i=0;i<n;i++){
   int p=i&1023;float v=p*0.0009765625f;
   out[p]=v;sum=sum*33+(int)(out[p]*1048576.0f);
  }
  return sum;
 }
 static int floatArithmetic(int n) {
  int sum=0;
  for(int i=0;i<n;i++){
   int p=i&1023;float v=p*0.0009765625f;
   sum=sum*33+(int)(v*1048576.0f);
  }
  return sum;
 }
 static byte[] bzipInput() {
  String hex="${codecInput.toString('hex')}";
  byte[] data=new byte[hex.length()/2];
  for(int i=0;i<data.length;i++){
   int a=hex.charAt(i*2)-48,b=hex.charAt(i*2+1)-48;
   if(a>9)a-=39;if(b>9)b-=39;
   data[i]=(byte)((a<<4)|b);
  }
  return data;
 }
 static int bzipBlock(byte[] input,byte[] output) {
  return Bzip2Decoder.decompressInto(output,output.length,input,input.length-9,9);
 }
 static int intLoadParameter(int n,int[] data) {
  int sum=0;
  for(int i=0;i<n;i++)sum=sum*33+data[i&1023];
  return sum;
 }
 static int intLoadCast(int n,Object data) {
  int sum=0;
  for(int i=0;i<n;i++)sum=sum*33+((int[])data)[i&1023];
  return sum;
 }
 static int coldPrefixLoop(int n) {
  loopPrefixes++;
  int sum=MicroColdHolder.seed;
  for(int i=0;i<n;i++){loopSteps++;sum=sum*33+MicroBitReader.readBit();}
  loopTails++;
  return sum;
 }
 public static void main(String[] args) {
  int mode=Integer.parseInt(args[0]),n=Integer.parseInt(args[1]),seed=args[2].charAt(0);
  byte[] a=new byte[1024];boolean[] z=new boolean[1024];bytes=new byte[1024];
  samples=new float[1024];weights=new float[1024];transformed=new float[1024];
  int[] integers=new int[1024];
  int x=seed;
  for(int i=0;i<1024;i++){
   x=x*1664525+1013904223;a[i]=(byte)(x&1);z[i]=a[i]!=0;bytes[i]=(byte)(x>>>24);
   integers[i]=x;
   samples[i]=((x&1023)-512)/512.0f;weights[i]=((x>>>8)&1023)/1024.0f;
  }
  byteCursor=0;bitCursor=0;
  MicroBitReader.bytes=bytes;MicroBitReader.byteCursor=0;MicroBitReader.bitCursor=0;
  if(readerInitializations!=1)throw new AssertionError();
  MicroCursor cursor=new MicroCursor();
  byte[] packed=null,unpacked=null;
  if(mode==23||mode==24){new Bzip2Decoder();packed=bzipInput();unpacked=new byte[${codecOutputBytes}];}
  if(mode==24&&UsernameResponseSupport.accountUiViewportWidth!=640)throw new AssertionError();
  if(mode==28&&MicroColdHolder.seed!=17)throw new AssertionError();
  long start=System.nanoTime();
  switch(mode){
   case 0:checksum=scalar(n,seed);break;
   case 1:checksum=byteArray(n,a);break;
   case 2:checksum=booleanArray(n,z);break;
   case 3:checksum=bitsLocal(n,bytes);break;
   case 4:checksum=bitsStatic(n);break;
   case 5:checksum=bitsCall(n);break;
   case 6:checksum=bitsStaticCursors(n,bytes);break;
   case 7:checksum=bitsStaticArray(n);break;
   case 8:checksum=bitsCrossOwner(n);break;
   case 9:checksum=sine(n,seed);break;
   case 10:checksum=bitsInstance(n,cursor,bytes);break;
   case 11:checksum=bitsInstanceCall(n,cursor,bytes);break;
   case 12:checksum=butterflyStatic(n);break;
   case 13:checksum=butterflyLocal(n,samples,weights,transformed);break;
   case 14:checksum=floatLoadStatic(n);break;
   case 15:checksum=floatLoadCached(n);break;
   case 16:checksum=floatLoadParameter(n,samples);break;
   case 17:checksum=butterflyCached(n);break;
   case 18:checksum=butterflyNoReadback(n,samples,weights,transformed);break;
   case 19:checksum=butterflyLoads(n,samples,weights);break;
   case 20:checksum=floatStoreParameter(n,transformed);break;
   case 21:checksum=floatStoreReadback(n,transformed);break;
   case 22:checksum=floatArithmetic(n);break;
   case 23:checksum=bzipBlock(packed,unpacked);break;
   case 24:checksum=bzipBlock(packed,unpacked);break;
   case 25:checksum=intLoadParameter(n,integers);break;
   case 26:checksum=intLoadCast(n,integers);break;
   case 27:case 28:checksum=coldPrefixLoop(n);break;
   default:throw new IllegalArgumentException();
  }
  elapsedNanos=System.nanoTime()-start;
  if(mode==12||mode==13||mode==17||mode==18||mode==20||mode==21)
   for(int i=0;i<1024;i++)checksum=checksum*31+(int)(transformed[i]*1048576.0f);
  if(mode==23||mode==24)for(int i=0;i<unpacked.length;i++)checksum=checksum*31+unpacked[i];
  if(mode==27||mode==28){
   if(loopPrefixes!=1||loopSteps!=n||loopTails!=1||initializerPrefixes!=(mode==27?1:0))throw new AssertionError();
   checksum=checksum*31+initializerPrefixes;
  }
 }
}
final class MicroBitReader {
 static int initialization=initialize();
 static int initialize(){LoadingMicroKernel.readerInitializations++;return 1;}
 static byte[] bytes;
 static int byteCursor,bitCursor;
 static int readBit(){
  int v=bytes[byteCursor]>>bitCursor&1;bitCursor=bitCursor+1;
  byteCursor=(byteCursor+(bitCursor>>3))&1023;bitCursor=bitCursor&7;return v;
 }
}
final class MicroCursor {
 int byteCursor,bitCursor;
 int readBit(byte[] a){
  int v=a[byteCursor]>>bitCursor&1;bitCursor=bitCursor+1;
  byteCursor=(byteCursor+(bitCursor>>3))&1023;bitCursor=bitCursor&7;return v;
 }
}
final class MicroColdHolder {
 static int seed;
 static {LoadingMicroKernel.initializerPrefixes=LoadingMicroKernel.loopPrefixes;seed=17;}
}`;

function build() {
 const previous=read().microbenchmarks;
 const fixtures=previous?.fixtures||[];
 if(previous&&!fixtures.some(f=>f.sourceSha256===previous.sourceSha256)){
  const previousSource=fs.readFileSync(path.join(directory,'LoadingMicroKernel.java'),'utf8');
  assert.equal(hash(previousSource),previous.sourceSha256,'Cannot archive a mismatched previous fixture');
  fixtures.push({sourceSha256:previous.sourceSha256,classSha256:previous.classSha256,wasmSha256:previous.wasmSha256,
   runtimeSha256:previous.runtimeSha256,classes:previous.classes,source:previousSource});
  // Persist this identity before replacing generated files, even if javac,
  // TeaVM or a reference check fails during the subsequent build.
  save({...previous,fixtures});
 }
 // Replace only this generated fixture; never rebuild the full game here.
 fs.mkdirSync(directory,{recursive:true});
 fs.rmSync(path.join(directory,'current.wat'),{force:true});
 const classes=path.join(directory,'classes');fs.rmSync(classes,{recursive:true,force:true});fs.mkdirSync(classes);
 const codecClasses={};
 for(const name of codecClassNames){
  const bytes=fs.readFileSync(path.join(player,'classes',name));
  assert.equal(hash(bytes),read().classes[name],'Changed original codec class: '+name);
  codecClasses[name]=hash(bytes);fs.writeFileSync(path.join(classes,name),bytes);
 }
 fs.writeFileSync(path.join(directory,'LoadingMicroKernel.java'),source);
 execFileSync('javac',['--release','8','-proc:none','-classpath',classes,'-d',classes,path.join(directory,'LoadingMicroKernel.java')]);
 const classHashes=Object.fromEntries(fs.readdirSync(classes).filter(n=>n.endsWith('.class')).sort()
  .map(name=>[name,hash(fs.readFileSync(path.join(classes,name)))]));
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'loading-micro-build-'));
 try {
  const src=path.join(temporary,'src/main/java');fs.mkdirSync(src,{recursive:true});
  fs.cpSync(classes,path.join(temporary,'target/classes'),{recursive:true});
  fs.writeFileSync(path.join(src,'TeaVmMicro.java'),`import org.teavm.jso.JSExport;
public class TeaVmMicro {
 public static void main(String[] args){LoadingMicroKernel.main(args);}
 @JSExport public static double elapsedMs(){return LoadingMicroKernel.elapsedNanos/1e6;}
 @JSExport public static int checksum(){return LoadingMicroKernel.checksum;}
}`);
  fs.writeFileSync(path.join(temporary,'pom.xml'),`<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>local.loading</groupId><artifactId>micro</artifactId><version>1</version><properties><maven.compiler.release>11</maven.compiler.release></properties><dependencies>${['teavm-classlib','teavm-jso'].map(n=>`<dependency><groupId>org.teavm</groupId><artifactId>${n}</artifactId><version>${version}</version></dependency>`).join('')}</dependencies><build><plugins><plugin><artifactId>maven-resources-plugin</artifactId><version>3.4.0</version></plugin><plugin><artifactId>maven-compiler-plugin</artifactId><version>3.13.0</version></plugin><plugin><groupId>org.teavm</groupId><artifactId>teavm-maven-plugin</artifactId><version>${version}</version><configuration><mainClass>TeaVmMicro</mainClass><targetType>WEBASSEMBLY_GC</targetType><targetDirectory>\${project.build.directory}/wasm</targetDirectory><targetFileName>micro.wasm</targetFileName><optimizationLevel>FULL</optimizationLevel><minifying>true</minifying><runtimeFileName>micro.wasm-runtime.js</runtimeFileName></configuration></plugin></plugins></build></project>`);
  execFileSync('mvn',['-o','-B','-ntp','compile',`org.teavm:teavm-maven-plugin:${version}:compile`,`org.teavm:teavm-maven-plugin:${version}:copy-webassembly-gc-runtime`],{
   cwd:temporary,stdio:'inherit',env:{...process.env,JAVA_HOME:'/usr/lib/jvm/java-21-openjdk',MAVEN_OPTS:'-Xmx1g'}});
  for(const [name,expected]of Object.entries(classHashes))assert.equal(
   hash(fs.readFileSync(path.join(temporary,'target/classes',name))),expected,'TeaVM must consume identical javac bytes: '+name);
  fs.cpSync(path.join(temporary,'target/wasm'),path.join(directory,'teavm'),{recursive:true});
  // HotSpot checks exactly the same bytes in separate fresh processes.
  fs.writeFileSync(path.join(temporary,'MicroReference.java'),`public class MicroReference {
 public static void main(String[] args){LoadingMicroKernel.main(args);System.out.println(LoadingMicroKernel.checksum);}
}`);
  execFileSync('javac',['--release','8','-classpath',classes,'-d',temporary,path.join(temporary,'MicroReference.java')]);
  fs.copyFileSync(path.join(temporary,'MicroReference.class'),path.join(directory,'MicroReference.class'));
  const referenceChecks=cases.map((_,i)=>Number(execFileSync('java',['-Xmx1g','-cp',temporary+path.delimiter+classes,'MicroReference',String(i),String(iterations),seed],{encoding:'utf8'}).trim()));
  assert.equal(referenceChecks[1],referenceChecks[2],'Byte and boolean variants differ');
  assert.equal(referenceChecks[3],referenceChecks[4],'Local and static bit readers differ');
  assert.equal(referenceChecks[3],referenceChecks[5],'Inline and helper bit readers differ');
  assert.equal(referenceChecks[3],referenceChecks[6],'Static cursor bit reader differs');
  assert.equal(referenceChecks[3],referenceChecks[7],'Static array bit reader differs');
  for(const index of [8,10,11])assert.equal(referenceChecks[3],referenceChecks[index],cases[index]+' differs');
  assert.equal(referenceChecks[12],referenceChecks[13],'Static and local float butterflies differ');
  assert.equal(referenceChecks[12],referenceChecks[17],'Static and cached float butterflies differ');
  assert.equal(referenceChecks[12],referenceChecks[18],'Butterfly without readback differs');
  assert.equal(referenceChecks[20],referenceChecks[21],'Store with and without readback differs');
  assert.equal(referenceChecks[23],referenceChecks[24],'Cold and initialized-owner archive decodes differ');
  assert.equal(referenceChecks[25],referenceChecks[26],'Typed and cast integer loads differ');
  for(const index of [15,16])assert.equal(referenceChecks[14],referenceChecks[index],cases[index]+' differs');
  save({purpose:'Small causal diagnostics; not full-loading or FPS acceptance',version,cases,iterations,seed,
   codec:{asset:codecAsset,inputSha256:hash(codecInput),outputBytes:codecOutputBytes,classes:codecClasses,decodesPerProcess:1},
   sourceSha256:hash(source),classSha256:classHashes['LoadingMicroKernel.class'],classes:classHashes,
   wasmSha256:hash(fs.readFileSync(path.join(directory,'teavm/micro.wasm'))),
   runtimeSha256:hash(fs.readFileSync(path.join(directory,'teavm/micro.wasm-runtime.js'))),referenceChecks,
   fixtures,runs:previous?.runs||[],diagnostics:previous?.diagnostics||[]});
 } finally {fs.rmSync(temporary,{recursive:true,force:true});}
}

async function one(engine,name,revision,inspection) {
 const fixture=read().microbenchmarks,index=cases.indexOf(name);
 assert.ok(fixture&&index>=0,'Build the fixture and select a known case');
 assert.equal(hash(source),fixture.sourceSha256,'Rebuild changed fixture');
 const classes=fixture.classes||{'LoadingMicroKernel.class':fixture.classSha256};
 assert.deepEqual(fs.readdirSync(path.join(directory,'classes')).sort(),Object.keys(classes).sort(),'Unexpected fixture classes');
 for(const [name,expected]of Object.entries(classes))assert.equal(hash(fs.readFileSync(path.join(directory,'classes',name))),expected);
 const ownsMethod=key=>Object.keys(classes).some(name=>key.startsWith(name.slice(0,-6)+'.'));
 const codec=name.startsWith('bzip-');
 const count=codec?1:Number(process.env.MICRO_ITERATIONS||fixture.iterations);
 assert.ok(Number.isSafeInteger(count)&&count>0&&count<=100_000_000,'Invalid iteration count');
 const expected=codec||count===fixture.iterations?fixture.referenceChecks[index]:fixture.references?.[count]?.[index];
 assert.ok(Number.isInteger(expected),'Run the paired harness to establish the HotSpot reference for this count');
 const args=[String(index),String(count),fixture.seed];
 const result={case:name,engine,sourceRevision:revision,iterations:count,node:process.version,execArgv:process.execArgv,
  loadAverageAtStart:os.loadavg(),availableParallelism:os.availableParallelism(),
  instrumented:process.env.JVM_WASM_IMPORT_STATS==='1'||!!inspection,
  nativeAot:nodeArgs.slice(1).every(flag=>process.execArgv.includes(flag)),
  harnessSha256:hash(fs.readFileSync(script)),loaderSha256:hash(fs.readFileSync(new URL('./archive-jvm.mjs',import.meta.url))),
  fixtureSha256:hash(JSON.stringify(classes)),fixtureKind:'class-inventory',sourceSha256:fixture.sourceSha256};
 if(engine==='teavm'){
  const wasm=fs.readFileSync(path.join(directory,'teavm/micro.wasm'));
  assert.equal(hash(wasm),fixture.wasmSha256);
  assert.equal(hash(fs.readFileSync(path.join(directory,'teavm/micro.wasm-runtime.js'))),fixture.runtimeSha256);
  await import(pathToFileURL(path.join(directory,'teavm/micro.wasm-runtime.js')));
  const module=await TeaVM.wasmGC.load(wasm);
  await module.exports.main(args);
  Object.assign(result,{elapsedMs:module.exports.elapsedMs(),checksum:module.exports.checksum(),wasmSha256:fixture.wasmSha256});
 }else{
  assert.equal(engine,'jvm');
  const {JVM}=await loadArchivedJvm(root,revision);
  const options=structuredClone(read().diagnosticOptions);
  options.classpath=[path.join(directory,'classes')];
  options.jit.preparationPolicy={entryMethods:['LoadingMicroKernel.main([Ljava/lang/String;)V']};
  options.jit.compileWorker=false;
  globalThis.window=globalThis;globalThis.document={};
  const j=new JVM(options);delete globalThis.document;
  j.jit._syncCompileEnvironment={trace:false,assert:true};
  const late=[],compile=j.jit.startSynchronousCompile.bind(j.jit);
  j.jit.startSynchronousCompile=(method,entryPath)=>{
   if(j.jit.mainStarted)late.push(j.jit.methodIdentity(method));
   return compile(method,entryPath);
  };
  const transitions=[],canonicalCensus=new Map(),checkpointTrace=[];
  if(j.jit.wasmJit.importStatsEnabled){
   const w=j.jit.wasmJit,execute=w.execute.bind(w);
   const canonical=w.requiresCanonicalResume.bind(w),checkpoint=w.structuredResumeCheckpoint?.bind(w);
   w.requiresCanonicalResume=frame=>{
    const result=canonical(frame),key=frame?.method&&j.jit.methodIdentity(frame.method);
    if(key&&ownsMethod(key)){
     let row=canonicalCensus.get(key);if(!row)canonicalCensus.set(key,row={key,required:0,ordinary:0});
     row[result?'required':'ordinary']++;
    }
    return result;
   };
   if(checkpoint)w.structuredResumeCheckpoint=(frame,...args)=>{
    const pc=checkpoint(frame,...args),key=j.jit.methodIdentity(frame.method);
    if(ownsMethod(key)&&checkpointTrace.length<30)checkpointTrace.push({key,entry:frame.pc,checkpoint:pc,
     canonical:w.canonicalResumeFrames.has(frame),frameEntryOnly:!!w.state.get(frame.method)?.meta?.frameEntryOnly});
    return pc;
   };
   w.execute=(frame,thread,state,...rest)=>{
    const before=frame.pc,canonicalBefore=w.canonicalResumeFrames.has(frame),start=performance.now(),out=execute(frame,thread,state,...rest);
    if(ownsMethod(state.key)&&transitions.length<30)
     transitions.push({key:state.key,before,after:frame.pc,osr:!!rest[2],
      structured:!!(rest[2]&&state.osr?state.osr.meta:state.meta)?.structured,
      elapsedMs:performance.now()-start,canonicalBefore,canonicalAfter:w.canonicalResumeFrames.has(frame),result:out});
    return out;
   };
  }
  await j.run('LoadingMicroKernel',{args});
  if(inspection==='code'){
   const method=name==='sin'?'sine':name==='ready-prefix-loop'?'coldPrefixLoop':name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
   const prefix=name.startsWith('bzip-')?'Bzip2Decoder.decodeBlocks(':'LoadingMicroKernel.'+method+'(';
   const state=j.jit.wasmJit.compiled.find(s=>s.key.startsWith(prefix));
   assert.ok(state?.meta?.bytes,'Installed kernel bytes are unavailable');
   const output=path.join(directory,'current.wat');
   fs.writeFileSync(output,execFileSync('wasm-dis',['--all-features','-'],{input:state.meta.bytes}));
   result.code={output,sha256:hash(state.meta.bytes),method:state.key};
   const generated=j.jit.codegenCache.get(state.method);
   result.code.javascript={flags:Object.keys(generated||{}).filter(key=>generated[key]===true),
    source:String(generated?.jvmResumeBodyFn||generated)};
  }
  const fields=j.classes.LoadingMicroKernel.staticFields;
  Object.assign(result,{elapsedMs:Number(fields.get('elapsedNanos:J'))/1e6,checksum:fields.get('checksum:I'),
   compilation:j.jit.syncCompileCensus(),lateCompiles:late,options,
   executionMethods:j.jit.wasmJit.compiled.filter(s=>ownsMethod(s.key)).map(s=>({
    key:s.key,runs:s.runs,directEntries:s.meta?.canonicalEntries?.value||0,exits:s.exits,
    fuelExits:s.fuelExits,nestedCalls:s.nestedCalls,nestedDeopts:s.nestedDeopts,
    full:!!s.meta?.fullyCompiled,canonical:!!s.meta?.canonicalRun,inlined:s.meta?.inlinedCalls,
    slabFieldSites:s.meta?.slabFieldSites,omittedSlabFillCount:s.meta?.omittedSlabFillCount||0,
    normalFlow:!!s.meta?.normalFlowFullyCompiled,demotes:[...(s.meta?.demoteReasons||[])],
    structuredResumeEntry:s.meta?.structuredResumeEntry,
    specSites:s.meta?.specSites,entryGuards:s.meta?.entryInitializationGuards,
    links:s.meta?.linkBindings?.map(b=>({key:b.key,pending:b.pending,canonical:!!b.canonicalDirect})),
    jsRestoring:!!j.jit.codegenCache.get(s.method)?.jvmRestoringDirectPositionalBody})),
   ...(j.jit.wasmJit.importStatsEnabled?{transitions,canonicalCensus:[...canonicalCensus.values()],checkpointTrace,importCensus:j.jit.wasmJit.compiled.flatMap(s=>[
    ['entry',s.meta],['callee',s.callee?.meta],['osr',s.osr?.meta]
   ].flatMap(([tier,meta])=>[...(meta?.importStats||[])].filter(([,count])=>count>0)
    .map(([name,count])=>({method:s.key,tier,name,count})))).sort((a,b)=>b.count-a.count).slice(0,40)}:{})});
  assert.deepEqual(late,[],'Java compilation occurred during execution');
  assert.equal(result.compilation.postMainSyncCompileCount,0);
 }
 assert.ok(Number.isFinite(result.elapsedMs)&&result.elapsedMs>0,'Timer failed');
 assert.equal(result.checksum,expected,'HotSpot checksum mismatch');
 console.log('MICRO_RESULT '+JSON.stringify(result));
}

function run(revision,names) {
 assert.notEqual(process.env.JVM_WASM_IMPORT_STATS,'1','Keep instrumented diagnostics out of timing comparisons');
 assert.match(revision||'',/^[0-9a-f]{40}$/,'Use an exact JVM source commit');
 if(!names.length)names=cases;
 for(const name of names)assert.ok(cases.includes(name),name);
 const count=ensureReference();
 const runId=crypto.randomUUID();
 // Three fresh-process pairs; reverse engine order in the middle pair.
 for(const name of names)for(let pair=0;pair<3;pair++){
  const order=pair===1?['teavm','jvm']:['jvm','teavm'];
  for(const engine of order){
   const output=execFileSync(process.execPath,[...nodeArgs,script,'one',engine,name,revision],{encoding:'utf8',maxBuffer:16*1024*1024});
   const line=output.split('\n').find(line=>line.startsWith('MICRO_RESULT '));
   assert.ok(line,output);const result=JSON.parse(line.slice('MICRO_RESULT '.length));
   result.runId=runId;result.pair=pair;result.measuredAt=new Date().toISOString();
   const fixture=read().microbenchmarks;fixture.runs.push(result);save(fixture);
   console.log(`${name} n=${result.iterations} pair ${pair+1} ${engine}: ${result.elapsedMs.toFixed(3)} ms, check ${result.checksum}`);
  }
 }
}

function ensureReference() {
 const fixture=read().microbenchmarks,count=Number(process.env.MICRO_ITERATIONS||fixture.iterations);
 assert.ok(Number.isSafeInteger(count)&&count>0&&count<=100_000_000,'Invalid iteration count');
 if(count!==fixture.iterations&&!fixture.references?.[count]){
  (fixture.references||={})[count]=cases.map((_,i)=>Number(execFileSync('java',['-Xmx1g','-cp',directory+path.delimiter+path.join(directory,'classes'),
   'MicroReference',String(i),String(count),fixture.seed],{encoding:'utf8'}).trim()));
  save(fixture);
 }
 return count;
}

function diagnose(revision,name) {
 assert.match(revision||'',/^[0-9a-f]{40}$/);
 ensureReference();
 const output=execFileSync(process.execPath,[...nodeArgs,script,'one','jvm',name,revision],{
  encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,JVM_WASM_IMPORT_STATS:'1'}});
 const line=output.split('\n').find(line=>line.startsWith('MICRO_RESULT '));assert.ok(line,output);
 const result=JSON.parse(line.slice('MICRO_RESULT '.length));
 result.measuredAt=new Date().toISOString();
 const fixture=read().microbenchmarks;(fixture.diagnostics||=[]).push(result);save(fixture);
 console.log(JSON.stringify(result,null,2));
}

const [command,...args]=process.argv.slice(2);
if(command==='build')build();
else if(command==='one')await one(...args);
else if(command==='run')run(args[0],args.slice(1));
else if(command==='diagnose')diagnose(...args);
else if(command==='inspect')await one('jvm',args[1],args[0],'code');
else throw Error('Usage: microbench.mjs build | run EXACT_REVISION [CASE ...] | diagnose EXACT_REVISION CASE | inspect EXACT_REVISION CASE | one jvm|teavm CASE EXACT_REVISION');
