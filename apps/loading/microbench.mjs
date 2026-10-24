#!/usr/bin/env node
// Causal diagnostics, not loading/FPS acceptance. No workload warmup or replay.
import fs from 'node:fs';
import {canonicalExecutionCounts} from './browser.mjs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadArchivedJvm} from './archive-jvm.mjs';
import {selectBenchmarkRevision} from './benchmark-baseline.mjs';
import {projectMeasurementFixture,readMeasurementFixture,fixtureStdinFlag,parseMeasurementResult,summarizeExecutionOutcome} from './measurement-fixture.mjs';
import {captureBufferedWorkload,bufferedReplayArgs} from './buffered-replay.mjs';
import {bufferedCallKinds,measureBufferedCallControl} from './buffered-call-controls.mjs';
import {floatArrayKinds,measureFloatArrayControl} from './float-array-controls.mjs';

const script=fileURLToPath(import.meta.url);
const root=path.resolve(path.dirname(script),'../../../java-tools');
const player=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading');
const directory=path.join(player,'microbench');
const receiptPath=path.join(player,'benchmark.json');
const cases=['scalar','byte-array','boolean-array','bits-local','bits-static','bits-call','bits-static-cursors','bits-static-array',
 'bits-cross-owner','sin','bits-instance','bits-instance-call','butterfly-static','butterfly-local',
 'float-load-static','float-load-cached','float-load-parameter','butterfly-cached',
 'butterfly-no-readback','butterfly-loads','float-store-parameter','float-store-readback','float-arithmetic',
 'bzip-block','bzip-ready-owner','int-load-parameter','int-load-cast','cold-prefix-loop','ready-prefix-loop',
 'cast-only','reference-only','array-result-loop','object-result-loop','window-parameter','window-static',
 'huffman-helper','huffman-cached','huffman-inline',
 'huffman-many-fields','huffman-many-cached','huffman-many-local','huffman-many-value',
 'byte-field-call','boolean-field-call','tail-cold','tail-ready','tail-zero-cold','tail-zero-ready',
 'buffered-helper','buffered-inline','buffered-local','buffered-ready-helper','buffered-ready-wrapped'];
const iterations=1_000_000,seed='q',version='0.16.0';
// Compile Wasm with V8's optimizing tier before execution on BOTH backends.
// This removes lazy Wasm compilation/tiering from these operation diagnostics.
const nodeArgs=['--max-old-space-size=1024','--no-liftoff','--no-wasm-lazy-compilation'];
const linearKinds=new Set(['linear-import','linear-unreachable','linear-trap','linear-tag','linear-js-tag','linear-guarded']);
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const worker=['one','inspect'].includes(process.argv[2]);
const workerFixture=worker?readMeasurementFixture(receiptPath):null;
const read=()=>worker?workerFixture.receipt:JSON.parse(fs.readFileSync(receiptPath));
const codecAsset=process.env.MICRO_BZIP_ASSET||read().microbenchmarks?.codec?.asset||'0-27.bin';
assert.match(codecAsset,/^\d+-\d+\.bin$/,'Use a pinned archive asset name');
const codecClassNames=['Bzip2Decoder.class','Bzip2DecoderState.class','UsernameResponseSupport.class','ContextualRuntimeException.class'];
const codecInput=fs.readFileSync(path.join(player,'assets',codecAsset));
assert.equal(hash(codecInput),read().assets[codecAsset],'Changed codec input');
assert.equal(codecInput[0],1,'Expected a Jagex Bzip archive');
const codecOutputBytes=codecInput.readUInt32BE(5);
const codecHex=codecInput.toString('hex');
// Keep javac UTF-8 constants below 64 KiB for the larger real archive control.
const codecHexSource=codecHex.length<=60000?`String hex="${codecHex}";`:
 `StringBuilder joined=new StringBuilder();
  for(String part:new String[]{${codecHex.match(/.{1,60000}/g).map(part=>JSON.stringify(part)).join(',')}})joined.append(part);
  String hex=joined.toString();`;
const save=microbenchmarks=>{
 const receipt=read();receipt.microbenchmarks=microbenchmarks;
 fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
};
// Exact refill/arithmetic order from the pinned decoder's readBits method.
// Prefix substitution changes only where the same state values are stored.
// The local version is a valid-input causal control, not a guest-code rewrite:
// its partial state on an exception would differ from the original method.
const bufferedRead=prefix=>`
  while(${prefix}bufferedBitCount<bitCount){
   ${prefix}bitBuffer=${prefix}bitBuffer<<8|${prefix}inputBytes[${prefix}inputPosition]&255;
   ${prefix}bufferedBitCount=${prefix}bufferedBitCount+8;
   ${prefix}inputPosition=${prefix}inputPosition+1;
   ${prefix}inputBytesRead=${prefix}inputBytesRead+1;
   if(${prefix}inputBytesRead!=0)continue;
  }
  int value=${prefix}bitBuffer>>${prefix}bufferedBitCount-bitCount&(1<<bitCount)-1;
  ${prefix}bufferedBitCount=${prefix}bufferedBitCount-bitCount;`;
const source=`public class LoadingMicroKernel {
 static int checksum, byteCursor, bitCursor, readerInitializations;
 static byte[] bytes;
 static byte[] byteFields;static boolean[] booleanFields;
 static int[] tailData;
 static int tailCalls,tailInitializationPhase,tailLoopFinished,tailPrepareCalls;
 static volatile int tailInitializations;
 static float[] samples,weights,transformed;
 static float[] windowSamples;
 static long elapsedNanos;
 static Bzip2DecoderState bufferedState;
 static int[] bufferedFinalState;
 static int loopPrefixes,loopSteps,loopTails,initializerPrefixes,resultLoopChecksum;
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
 // A bounded recursive prefix retains real method entries under the normal
 // inliner. The runner verifies that fact rather than disabling inlining.
 static int byteFieldStep(int i,int depth){if(depth>0)return byteFieldStep(i,depth-1);byteFields[i]=(byte)(byteFields[i]^1);return byteFields[i];}
 static int booleanFieldStep(int i,int depth){if(depth>0)return booleanFieldStep(i,depth-1);booleanFields[i]=!booleanFields[i];return booleanFields[i]?1:0;}
 static int byteFieldCall(int n){int sum=0;for(int i=0;i<n;i++)sum=sum*33+byteFieldStep(i&1023,1);return sum;}
 static int booleanFieldCall(int n){int sum=0;for(int i=0;i<n;i++)sum=sum*33+booleanFieldStep(i&1023,1);return sum;}
 // The cold operation follows a pure captured-array loop. Recursion keeps
 // its real call boundary under the normal inliner, without a runtime flag.
 static int tailHelper(int value,int depth){
  if(depth>0)return tailHelper(value,depth-1);
  tailCalls++;return value^MicroTailHolder.seed;
 }
 static int tailLoop(int n){
  int[] a=tailData;int sum=0;
  for(int i=0;i<n;i++){int p=i&1023;a[p]=a[p]*3+i;sum=sum*33+a[(p+1)&1023];}
  tailLoopFinished=1;return sum+tailHelper(sum,1);
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
  ${codecHexSource}
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
 static int[] bufferedWidths(String[] args){
  int length=0;for(int i=3;i<args.length;i++)length+=args[i].length();
  int[] widths=new int[length/2];int at=0;
  for(int i=3;i<args.length;i++)for(int k=0;k<args[i].length();k+=2){
   int a=args[i].charAt(k)-48,b=args[i].charAt(k+1)-48;
   if(a>9)a-=39;if(b>9)b-=39;widths[at++]=(a<<4)|b;
  }
  return widths;
 }
 static int bufferedHelper(int n,Bzip2DecoderState state,int[] widths){
  int sum=0;for(int i=0;i<n;i++)sum=sum*33+MicroBufferedReader.readBits(widths[i]&31,state);return sum;
 }
 static int bufferedWrapped(int n,Bzip2DecoderState state,int[] widths){
  int sum=0;for(int i=0;i<n;i++){int code=widths[i],value;
   if((code&64)!=0)value=MicroBufferedReader.readBit(state);
   else if((code&128)!=0)value=MicroBufferedReader.readByte(state)&255;
   else value=MicroBufferedReader.readBits(code&31,state);
   sum=sum*33+value;
  }return sum;
 }
 static int bufferedInline(int n,Bzip2DecoderState state,int[] widths){
  int sum=0;for(int i=0;i<n;i++){int bitCount=widths[i]&31;${bufferedRead('state.')}
   sum=sum*33+value;}return sum;
 }
 static int bufferedLocal(int n,Bzip2DecoderState state,int[] widths){
  byte[] inputBytes=state.inputBytes;int bufferedBitCount=state.bufferedBitCount,bitBuffer=state.bitBuffer;
  int inputPosition=state.inputPosition,inputBytesRead=state.inputBytesRead,sum=0;
  for(int i=0;i<n;i++){int bitCount=widths[i]&31;${bufferedRead('')}
   sum=sum*33+value;}
  state.bufferedBitCount=bufferedBitCount;state.bitBuffer=bitBuffer;
  state.inputPosition=inputPosition;state.inputBytesRead=inputBytesRead;return sum;
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
 static int castOnly(int n,Object data) {
  int sum=0;
  for(int i=0;i<n;i++){int[] a=(int[])data;sum=sum*33+(a==null?0:i);}
  return sum;
 }
 static int referenceOnly(int n,int[] data) {
  int sum=0;
  for(int i=0;i<n;i++){int[] a=data;sum=sum*33+(a==null?0:i);}
  return sum;
 }
 static int[] arrayResultLoop(int n,int[] data) {
  int sum=0;
  for(int i=0;i<n;i++)sum=sum*33+data[i&1023];
  resultLoopChecksum=sum;return data;
 }
 static Object objectResultLoop(int n,int[] data) {
  int sum=0;
  for(int i=0;i<n;i++)sum=sum*33+data[i&1023];
  resultLoopChecksum=sum;return data;
 }
 static void windowParameter(int n,float[] data) {
  for(int i=0;i<n;i++){
   float sine=(float)Math.sin(((double)(i&1023)+0.5)/1024.0*0.5*3.141592653589793);
   data[i]=data[i]*(float)Math.sin(1.5707963267948966*(double)sine*(double)sine);
  }
 }
 static void windowStatic(int n) {
  for(int i=0;i<n;i++){
   float sine=(float)Math.sin(((double)(i&1023)+0.5)/1024.0*0.5*3.141592653589793);
   windowSamples[i]=windowSamples[i]*(float)Math.sin(1.5707963267948966*(double)sine*(double)sine);
  }
 }
 static int tree(int[] nodes,int at,int depth,int value) {
  if(depth==0){nodes[at]=~value;return at+1;}
  int right=tree(nodes,at+1,depth-1,value);nodes[at]=right;
  return tree(nodes,right,depth-1,value|(1<<(depth-1)));
 }
 static int huffmanHelper(int n,MicroHuffmanBook book) {
  int sum=0;for(int i=0;i<n;i++)sum=sum*33+book.readScalar();return sum;
 }
 static int huffmanCached(int n,MicroHuffmanBook book) {
  int sum=0;for(int i=0;i<n;i++)sum=sum*33+book.readScalarCached();return sum;
 }
 static int huffmanInline(int n,MicroHuffmanBook book) {
  int sum=0;for(int i=0;i<n;i++)sum=sum*33+book.readScalarInline();return sum;
 }
 static int huffmanManyFields(int n,MicroHuffmanBook book){return book.readManyFields(n);}
 static int huffmanManyCached(int n,MicroHuffmanBook book){return book.readManyCached(n);}
 static int huffmanManyLocal(int n,MicroHuffmanBook book){return book.readManyLocal(n);}
 static int huffmanManyValue(int n,MicroHuffmanBook book){return book.readManyValue(n);}
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
  byteFields=a;booleanFields=z;
  tailData=integers;
  MicroBitReader.bytes=bytes;MicroBitReader.byteCursor=0;MicroBitReader.bitCursor=0;
  if(readerInitializations!=1)throw new AssertionError();
  MicroCursor cursor=new MicroCursor();
  byte[] packed=null,unpacked=null;
  if(mode==23||mode==24){new Bzip2Decoder();packed=bzipInput();unpacked=new byte[${codecOutputBytes}];}
  if(mode==24&&UsernameResponseSupport.accountUiViewportWidth!=640)throw new AssertionError();
  int[] widths=null;
  if(mode>=48&&mode<=52){bufferedState=new Bzip2DecoderState();bufferedState.inputBytes=bzipInput();
   bufferedState.inputPosition=9;widths=bufferedWidths(args);n=Math.min(n,widths.length);}
  // Initialize only the helper's owner before timing, never read any bits.
  if(mode==51||mode==52)new MicroBufferedReader();
  if(mode==28&&MicroColdHolder.seed!=17)throw new AssertionError();
  if(mode>=44&&mode<=47){
   tailCalls=0;tailInitializations=0;tailInitializationPhase=0;tailLoopFinished=0;tailPrepareCalls=0;
   if((mode&1)!=0)MicroTailHolder.prepare();
   if(tailInitializations!=(mode&1)||tailCalls!=0||tailPrepareCalls!=(mode&1))throw new AssertionError();
  }
  if(mode==33||mode==34){windowSamples=new float[n];for(int i=0;i<n;i++)windowSamples[i]=0.5f+(i&1023)/1024.0f;}
  MicroHuffmanBook book=null;
  if(mode>=35&&mode<=41){
   int[] nodes=new int[511];if(tree(nodes,0,8,0)!=nodes.length)throw new AssertionError();
   book=new MicroHuffmanBook(nodes);MicroHuffmanReader.bytes=new byte[n];
   for(int i=0;i<n;i++){x=x*1664525+1013904223;MicroHuffmanReader.bytes[i]=(byte)(x>>>24);}
   MicroHuffmanReader.byteCursor=0;MicroHuffmanReader.bitCursor=0;
  }
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
   case 29:checksum=castOnly(n,integers);break;
   case 30:checksum=referenceOnly(n,integers);break;
   case 31:checksum=arrayResultLoop(n,integers)==integers?resultLoopChecksum:-7;break;
   case 32:checksum=objectResultLoop(n,integers)==integers?resultLoopChecksum:-7;break;
   case 33:windowParameter(n,windowSamples);break;
   case 34:windowStatic(n);break;
   case 35:checksum=huffmanHelper(n,book);break;
   case 36:checksum=huffmanCached(n,book);break;
   case 37:checksum=huffmanInline(n,book);break;
   case 38:checksum=huffmanManyFields(n,book);break;
   case 39:checksum=huffmanManyCached(n,book);break;
   case 40:checksum=huffmanManyLocal(n,book);break;
   case 41:checksum=huffmanManyValue(n,book);break;
   case 42:checksum=byteFieldCall(n);break;
   case 43:checksum=booleanFieldCall(n);break;
   case 44:case 45:checksum=tailLoop(n);break;
   case 46:case 47:checksum=tailLoop(0);break;
   case 48:checksum=bufferedHelper(n,bufferedState,widths);break;
   case 49:checksum=bufferedInline(n,bufferedState,widths);break;
   case 50:checksum=bufferedLocal(n,bufferedState,widths);break;
   case 51:checksum=bufferedHelper(n,bufferedState,widths);break;
   case 52:checksum=bufferedWrapped(n,bufferedState,widths);break;
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
  if(mode==33||mode==34)for(int i=0;i<n;i++)checksum=checksum*31+(int)(windowSamples[i]*1048576.0f);
  if(mode>=35&&mode<=41){
   if(MicroHuffmanReader.byteCursor!=n||MicroHuffmanReader.bitCursor!=0)throw new AssertionError();
   checksum=checksum*31+MicroHuffmanReader.byteCursor;
  }
  if(mode>=44&&mode<=47){
   if(tailCalls!=1||tailInitializations!=1||tailLoopFinished!=1||tailInitializationPhase!=1-(mode&1)||tailPrepareCalls!=(mode&1))throw new AssertionError();
   for(int value:tailData)checksum=checksum*31+value;
  }
  if(mode>=48&&mode<=52){
   bufferedFinalState=new int[]{bufferedState.bufferedBitCount,bufferedState.bitBuffer,
    bufferedState.inputPosition,bufferedState.inputBytesRead};
   for(int value:bufferedFinalState)checksum=checksum*31+value;
  }
 }
}
final class MicroBufferedReader {
 static int readBits(int bitCount,Bzip2DecoderState state){${bufferedRead('state.')}return value;}
 static byte readBit(Bzip2DecoderState state){return (byte)readBits(1,state);}
 static byte readByte(Bzip2DecoderState state){return (byte)readBits(8,state);}
}
final class MicroTailHolder {
 static int seed=initialize();
 static void prepare(){LoadingMicroKernel.tailPrepareCalls++;}
 static int initialize(){LoadingMicroKernel.tailInitializations++;
  LoadingMicroKernel.tailInitializationPhase=LoadingMicroKernel.tailLoopFinished;return 17;}
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
}
final class MicroHuffmanReader {
 static int ready;static {ready=1;}
 static byte[] bytes;static int byteCursor,bitCursor;
 static int readBit(){
  int value=bytes[byteCursor]>>bitCursor&1;bitCursor=bitCursor+1;
  byteCursor=byteCursor+(bitCursor>>3);bitCursor=bitCursor&7;return value;
 }
}
final class MicroHuffmanBook {
 private int[] tree;
 MicroHuffmanBook(int[] nodes){tree=nodes;}
 final int readScalar(){
  int at=0;
  while(tree[at]>=0)at=MicroHuffmanReader.readBit()!=0?tree[at]:at+1;
  return ~tree[at];
 }
 final int readScalarCached(){
  int at=0;int[] nodes=tree;
  while(nodes[at]>=0)at=MicroHuffmanReader.readBit()!=0?nodes[at]:at+1;
  return ~nodes[at];
 }
 final int readScalarInline(){
  int at=0;
  while(tree[at]>=0){
   int bit=MicroHuffmanReader.bytes[MicroHuffmanReader.byteCursor]>>MicroHuffmanReader.bitCursor&1;
   MicroHuffmanReader.bitCursor++;
   MicroHuffmanReader.byteCursor+=MicroHuffmanReader.bitCursor>>3;MicroHuffmanReader.bitCursor&=7;
   at=bit!=0?tree[at]:at+1;
  }
  return ~tree[at];
 }
 // Causal controls on valid input, not proposed guest-code rewrites. A single
 // traversal stream is consumed once. Each step removes only one category:
 // per-symbol calls, repeated tree fields, then static reader state per bit.
 final int readManyFields(int n){
  int sum=0;
  for(int i=0;i<n;i++){
   int at=0;
   while(tree[at]>=0){
    int bit=MicroHuffmanReader.bytes[MicroHuffmanReader.byteCursor]>>MicroHuffmanReader.bitCursor&1;
    MicroHuffmanReader.bitCursor++;
    MicroHuffmanReader.byteCursor+=MicroHuffmanReader.bitCursor>>3;MicroHuffmanReader.bitCursor&=7;
    at=bit!=0?tree[at]:at+1;
   }
   sum=sum*33+~tree[at];
  }
  return sum;
 }
 final int readManyCached(int n){
  int sum=0;int[] nodes=tree;
  for(int i=0;i<n;i++){
   int at=0;
   while(nodes[at]>=0){
    int bit=MicroHuffmanReader.bytes[MicroHuffmanReader.byteCursor]>>MicroHuffmanReader.bitCursor&1;
    MicroHuffmanReader.bitCursor++;
    MicroHuffmanReader.byteCursor+=MicroHuffmanReader.bitCursor>>3;MicroHuffmanReader.bitCursor&=7;
    at=bit!=0?nodes[at]:at+1;
   }
   sum=sum*33+~nodes[at];
  }
  return sum;
 }
 final int readManyLocal(int n){
  int sum=0;int[] nodes=tree;byte[] input=MicroHuffmanReader.bytes;
  int byteCursor=MicroHuffmanReader.byteCursor,bitCursor=MicroHuffmanReader.bitCursor;
  for(int i=0;i<n;i++){
   int at=0;
   while(nodes[at]>=0){
    int bit=input[byteCursor]>>bitCursor&1;
    bitCursor++;byteCursor+=bitCursor>>3;bitCursor&=7;
    at=bit!=0?nodes[at]:at+1;
   }
   sum=sum*33+~nodes[at];
  }
  MicroHuffmanReader.byteCursor=byteCursor;MicroHuffmanReader.bitCursor=bitCursor;
  return sum;
 }
 // Same loop, but read each tree value once rather than again on the
 // right-child edge and after the leaf test. Reader operations are unchanged.
 final int readManyValue(int n){
  int sum=0;int[] nodes=tree;byte[] input=MicroHuffmanReader.bytes;
  int byteCursor=MicroHuffmanReader.byteCursor,bitCursor=MicroHuffmanReader.bitCursor;
  for(int i=0;i<n;i++){
   int at=0,node;
   while((node=nodes[at])>=0){
    int bit=input[byteCursor]>>bitCursor&1;
    bitCursor++;byteCursor+=bitCursor>>3;bitCursor&=7;
    at=bit!=0?node:at+1;
   }
   sum=sum*33+~node;
  }
  MicroHuffmanReader.byteCursor=byteCursor;MicroHuffmanReader.bitCursor=bitCursor;
  return sum;
 }
}`;

function build() {
 const previous=read().microbenchmarks;
 const fixtures=previous?.fixtures||[];
 const previousWorkloadSha=previous?.bufferedWorkload?hash(JSON.stringify(previous.bufferedWorkload)):null;
 if(previous&&!fixtures.some(f=>f.sourceSha256===previous.sourceSha256&&f.wasmSha256===previous.wasmSha256&&
    (f.bufferedWorkloadSha256||null)===previousWorkloadSha)){
  const previousSource=fs.readFileSync(path.join(directory,'LoadingMicroKernel.java'),'utf8');
  assert.equal(hash(previousSource),previous.sourceSha256,'Cannot archive a mismatched previous fixture');
  fixtures.push({sourceSha256:previous.sourceSha256,classSha256:previous.classSha256,wasmSha256:previous.wasmSha256,
   ...(previousWorkloadSha?{bufferedWorkloadSha256:previousWorkloadSha}:{}),
   runtimeSha256:previous.runtimeSha256,wrapperSha256:previous.wrapperSha256,classes:previous.classes,source:previousSource});
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
 const bufferedWorkload=captureBufferedWorkload({player,asset:codecAsset,inputSha256:hash(codecInput),
  classes:codecClasses,previous:previous?.bufferedWorkload});
 const bufferedWorkloads={...previous?.bufferedWorkloads},workloadSha=hash(JSON.stringify(bufferedWorkload));
 if(previousWorkloadSha&&previousWorkloadSha!==workloadSha)bufferedWorkloads[previousWorkloadSha]=previous.bufferedWorkload;
 delete bufferedWorkloads[workloadSha];
 const replayArgs=bufferedReplayArgs(bufferedWorkload);
 fs.writeFileSync(path.join(directory,'LoadingMicroKernel.java'),source);
 execFileSync('javac',['--release','8','-proc:none','-classpath',classes,'-d',classes,path.join(directory,'LoadingMicroKernel.java')]);
 const classHashes=Object.fromEntries(fs.readdirSync(classes).filter(n=>n.endsWith('.class')).sort()
  .map(name=>[name,hash(fs.readFileSync(path.join(classes,name)))]));
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'loading-micro-build-'));
 try {
  const src=path.join(temporary,'src/main/java');fs.mkdirSync(src,{recursive:true});
  fs.cpSync(classes,path.join(temporary,'target/classes'),{recursive:true});
  const wrapper=`import org.teavm.jso.JSExport;
public class TeaVmMicro {
 public static void main(String[] args){LoadingMicroKernel.main(args);}
 @JSExport public static double elapsedMs(){return LoadingMicroKernel.elapsedNanos/1e6;}
 @JSExport public static int checksum(){return LoadingMicroKernel.checksum;}
 @JSExport public static int bufferedState(int key){return LoadingMicroKernel.bufferedFinalState[key];}
 @JSExport public static int tailState(int key){switch(key){
  case 0:return LoadingMicroKernel.tailCalls;case 1:return LoadingMicroKernel.tailInitializations;
  case 2:return LoadingMicroKernel.tailInitializationPhase;case 3:return LoadingMicroKernel.tailLoopFinished;
  case 4:return LoadingMicroKernel.tailPrepareCalls;default:return LoadingMicroKernel.readerInitializations;
 }}
}`;
  fs.writeFileSync(path.join(src,'TeaVmMicro.java'),wrapper);
  fs.writeFileSync(path.join(temporary,'pom.xml'),`<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>local.loading</groupId><artifactId>micro</artifactId><version>1</version><properties><maven.compiler.release>11</maven.compiler.release></properties><dependencies>${['teavm-classlib','teavm-jso'].map(n=>`<dependency><groupId>org.teavm</groupId><artifactId>${n}</artifactId><version>${version}</version></dependency>`).join('')}</dependencies><build><plugins><plugin><artifactId>maven-resources-plugin</artifactId><version>3.4.0</version></plugin><plugin><artifactId>maven-compiler-plugin</artifactId><version>3.13.0</version></plugin><plugin><groupId>org.teavm</groupId><artifactId>teavm-maven-plugin</artifactId><version>${version}</version><configuration><mainClass>TeaVmMicro</mainClass><targetType>WEBASSEMBLY_GC</targetType><targetDirectory>\${project.build.directory}/wasm</targetDirectory><targetFileName>micro.wasm</targetFileName><optimizationLevel>FULL</optimizationLevel><minifying>true</minifying><runtimeFileName>micro.wasm-runtime.js</runtimeFileName></configuration></plugin></plugins></build></project>`);
  execFileSync('mvn',['-o','-B','-ntp','compile',`org.teavm:teavm-maven-plugin:${version}:compile`,`org.teavm:teavm-maven-plugin:${version}:copy-webassembly-gc-runtime`],{
   cwd:temporary,stdio:'inherit',env:{...process.env,JAVA_HOME:'/usr/lib/jvm/java-21-openjdk',MAVEN_OPTS:'-Xmx1g'}});
  for(const [name,expected]of Object.entries(classHashes))assert.equal(
   hash(fs.readFileSync(path.join(temporary,'target/classes',name))),expected,'TeaVM must consume identical javac bytes: '+name);
  fs.cpSync(path.join(temporary,'target/wasm'),path.join(directory,'teavm'),{recursive:true});
  // HotSpot checks exactly the same bytes in separate fresh processes.
  fs.writeFileSync(path.join(temporary,'MicroReference.java'),`public class MicroReference {
 static int[] bufferedOracle(String[] args)throws Exception{
  Bzip2DecoderState state=new Bzip2DecoderState();state.inputBytes=LoadingMicroKernel.bzipInput();state.inputPosition=9;
  int[] widths=LoadingMicroKernel.bufferedWidths(args);int n=Math.min(Integer.parseInt(args[1]),widths.length),sum=0;
  java.lang.reflect.Method read=Bzip2Decoder.class.getDeclaredMethod("readBits",int.class,Bzip2DecoderState.class);
  read.setAccessible(true);
  for(int i=0;i<n;i++)sum=sum*33+(Integer)read.invoke(null,widths[i]&31,state);
  int[] result={0,state.bufferedBitCount,state.bitBuffer,state.inputPosition,state.inputBytesRead};
  for(int i=1;i<result.length;i++)sum=sum*31+result[i];result[0]=sum;return result;
 }
 public static void main(String[] args)throws Exception{
  if(args[0].equals("buffered-oracle")){
   System.out.println(java.util.Arrays.toString(bufferedOracle(args)));return;
  }
  LoadingMicroKernel.main(args);
  if(Integer.parseInt(args[0])>=48){
   int[] expected=bufferedOracle(args);
   if(expected[0]!=LoadingMicroKernel.checksum||!java.util.Arrays.equals(
    java.util.Arrays.copyOfRange(expected,1,5),LoadingMicroKernel.bufferedFinalState))throw new AssertionError("Original bit reader differs");
  }
  System.out.println(LoadingMicroKernel.checksum);
 }
}`);
  execFileSync('javac',['--release','8','-classpath',classes,'-d',temporary,path.join(temporary,'MicroReference.java')]);
  fs.copyFileSync(path.join(temporary,'MicroReference.class'),path.join(directory,'MicroReference.class'));
  const referenceChecks=cases.map((_,i)=>Number(execFileSync('java',['-Xmx1g','-cp',temporary+path.delimiter+classes,'MicroReference',String(i),String(iterations),seed,
   ...(i>=48?replayArgs:[])],{encoding:'utf8'}).trim()));
  const bufferedReferences={[bufferedWorkload.requests]:JSON.parse(execFileSync('java',['-Xmx1g','-cp',temporary+path.delimiter+classes,
   'MicroReference','buffered-oracle',String(bufferedWorkload.requests),seed,...replayArgs],{encoding:'utf8'}))};
  assert.deepEqual(bufferedReferences[bufferedWorkload.requests],bufferedWorkload.readerReference,'Replay differs from captured original return values/state');
  for(const index of [48,49,50,51,52])assert.equal(referenceChecks[index],bufferedWorkload.readerReference[0],cases[index]+' differs from original readBits');
  assert.equal(referenceChecks[1],referenceChecks[2],'Byte and boolean variants differ');
  assert.equal(referenceChecks[1],referenceChecks[42],'Byte field helper differs');
  assert.equal(referenceChecks[2],referenceChecks[43],'Boolean field helper differs');
  assert.equal(referenceChecks[44],referenceChecks[45],'Cold and initialized tail controls differ');
  assert.equal(referenceChecks[46],referenceChecks[47],'Zero-trip tail controls differ');
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
  assert.equal(referenceChecks[29],referenceChecks[30],'Typed and cast reference checks differ');
  assert.equal(referenceChecks[31],referenceChecks[32],'Array and object result loops differ');
  assert.equal(referenceChecks[25],referenceChecks[31],'Array-result loop differs from integer load control');
  assert.equal(referenceChecks[33],referenceChecks[34],'Parameter and static window outputs differ');
  assert.equal(referenceChecks[35],referenceChecks[36],'Field and local Huffman trees differ');
  assert.equal(referenceChecks[35],referenceChecks[37],'Called and inline Huffman bit readers differ');
  for(const index of [38,39,40,41])assert.equal(referenceChecks[35],referenceChecks[index],cases[index]+' differs');
  for(const index of [15,16])assert.equal(referenceChecks[14],referenceChecks[index],cases[index]+' differs');
  save({purpose:'Small causal diagnostics; not full-loading or FPS acceptance',version,cases,iterations,seed,
   codec:{asset:codecAsset,inputSha256:hash(codecInput),outputBytes:codecOutputBytes,classes:codecClasses,decodesPerProcess:1},
   sourceSha256:hash(source),classSha256:classHashes['LoadingMicroKernel.class'],classes:classHashes,
   wasmSha256:hash(fs.readFileSync(path.join(directory,'teavm/micro.wasm'))),
   runtimeSha256:hash(fs.readFileSync(path.join(directory,'teavm/micro.wasm-runtime.js'))),wrapperSha256:hash(wrapper),referenceChecks,bufferedReferences,bufferedWorkload,bufferedWorkloads,
   fixtures,runs:previous?.runs||[],diagnostics:previous?.diagnostics||[]});
 } finally {fs.rmSync(temporary,{recursive:true,force:true});}
}

function linearReadControl(name,count,kind) {
 assert.ok(['huffman-many-local','huffman-many-value'].includes(name),'Linear control only models the reduced tree loop');
 // Same valid input and arithmetic as Java. Error edges are deliberately
 // varied to isolate optimizer knowledge, not proposed as Java replacements.
 const memory=new WebAssembly.Memory({initial:4096,maximum:4096});
 const nodes=new Int32Array(memory.buffer,16,511),input=new Int8Array(memory.buffer,4096,count);
 const tree=(at,depth,value)=>{
  if(depth===0){nodes[at]=~value;return at+1;}
  const right=tree(at+1,depth-1,value);nodes[at]=right;
  return tree(right,depth-1,value|(1<<(depth-1)));
 };
 assert.equal(tree(0,8,0),511);
 let x=seed.charCodeAt(0);
 for(let i=0;i<1024;i++)x=Math.imul(x,1664525)+1013904223|0;
 for(let i=0;i<count;i++){x=Math.imul(x,1664525)+1013904223|0;input[i]=x>>>24;}
 const tagged=kind==='linear-tag',jsTagged=kind==='linear-js-tag',hasTag=tagged||jsTagged;
 const fail=jsTagged?'(throw $bounds (call $make_error (local.get $index) (local.get $length)))':
  tagged?'(throw $bounds (local.get $index) (local.get $length))':
  kind==='linear-trap'?'unreachable':`(call $error (local.get $index) (local.get $length))${kind==='linear-unreachable'?' unreachable':''}`;
 const load=(base,index,length,byte=false)=>{
  const native=`(block (result i32)
  (local.set $index ${index})(local.set $length ${length})
  (if (i32.ge_u (local.get $index) (local.get $length)) (then ${fail}))
  (${byte?'i32.load8_s':'i32.load'} (i32.add (local.get $${base}) ${byte?'(local.get $index)':'(i32.shl (local.get $index) (i32.const 2))'})))`;
  return kind==='linear-guarded'?`(if (result i32) (i32.ge_s (local.get $${base}) (i32.const 0))
   (then ${native})(else (call $${base}_get ${index} ${length})))`:native;
 };
 const treeLoad=load('tree','(local.get $at)','(local.get $treeLength)');
 const byteLoad=load('input','(local.get $byteCursor)','(local.get $inputLength)',true);
 const value=name==='huffman-many-value'?'(local.get $node)':treeLoad;
 const poll=`(local.set $fuel (i32.sub (local.get $fuel) (i32.const 1)))
  (if (i32.le_s (local.get $fuel) (i32.const 0)) (then unreachable))`;
 const wat=`(module (import "env" "mem" (memory 1))
  (import "env" "error" (func $error (param i32 i32)))
  (import "env" "tree_get" (func $tree_get (param i32 i32) (result i32)))
  (import "env" "input_get" (func $input_get (param i32 i32) (result i32)))
  ${hasTag?`(import "env" "bounds" (tag $bounds (param ${jsTagged?'externref':'i32 i32'})))`:''}
  ${jsTagged?'(import "env" "make_error" (func $make_error (param i32 i32) (result externref)))':''}
  (func (export "decode") (param $n i32) (param $tree i32) (param $treeLength i32)
   (param $input i32) (param $inputLength i32) (param $fuel i32) (result i32)
   (local $sum i32)(local $symbol i32)(local $at i32)(local $node i32)
   (local $byteCursor i32)(local $bitCursor i32)(local $bit i32)(local $index i32)(local $length i32)
   (block $done (loop $outer ${poll}
    (br_if $done (i32.ge_s (local.get $symbol) (local.get $n)))
    (local.set $at (i32.const 0))
    (block $leaf (loop $inner ${poll}
     (local.set $node ${treeLoad})
     (br_if $leaf (i32.lt_s (local.get $node) (i32.const 0)))
     (local.set $bit (i32.and (i32.shr_s ${byteLoad} (local.get $bitCursor)) (i32.const 1)))
     (local.set $bitCursor (i32.add (local.get $bitCursor) (i32.const 1)))
     (local.set $byteCursor (i32.add (local.get $byteCursor) (i32.shr_s (local.get $bitCursor) (i32.const 3))))
     (local.set $bitCursor (i32.and (local.get $bitCursor) (i32.const 7)))
     (local.set $at (if (result i32) (local.get $bit) (then ${value})
      (else (i32.add (local.get $at) (i32.const 1)))))
     (br $inner)))
    (local.set $sum (i32.add (i32.mul (local.get $sum) (i32.const 33)) (i32.xor ${value} (i32.const -1))))
    (local.set $symbol (i32.add (local.get $symbol) (i32.const 1)))(br $outer)))
   (if (i32.or (i32.ne (local.get $byteCursor) (local.get $n)) (local.get $bitCursor)) (then unreachable))
   (i32.add (i32.mul (local.get $sum) (i32.const 31)) (local.get $byteCursor))))`;
 const bytes=execFileSync('wasm-as',['-','-o','-',...(hasTag?['--enable-exception-handling','--enable-multivalue']:[]),
  ...(jsTagged?['--enable-reference-types']:[])],{input:wat});
 const bounds=jsTagged?WebAssembly.JSTag:tagged?new WebAssembly.Tag({parameters:['i32','i32']}):undefined;
 let madeError;
 const error=(index,length)=>{throw {type:'java/lang/ArrayIndexOutOfBoundsException',index,length};};
 const checked=array=>(index,length)=>{if((index>>>0)>=(length>>>0))error(index,length);return array[index];};
 const module=new WebAssembly.Module(bytes),instance=new WebAssembly.Instance(module,{env:{mem:memory,
  tree_get:checked(nodes),input_get:checked(input),
  ...(hasTag?{bounds}:{}),
  ...(jsTagged?{make_error:(index,length)=>(madeError={type:'java/lang/ArrayIndexOutOfBoundsException',index,length})}:{}),
  error}});
 const inputSha256=hash(input),treeSha256=hash(new Uint8Array(nodes.buffer,nodes.byteOffset,nodes.byteLength));
 const start=performance.now(),checksum=instance.exports.decode(count,nodes.byteOffset,nodes.length,input.byteOffset,input.length,100000000);
 const elapsedMs=performance.now()-start;
 // These malformed-input checks run after timing. Tagged exceptions must
 // identify the original failing index/length; a native trap is not a tag.
 const paths=kind==='linear-guarded'?[true,false]:[true];
 for(const native of paths)for(const [treeLength,inputLength]of [[0,input.length],[nodes.length,0]]){
  assert.throws(()=>instance.exports.decode(1,native?nodes.byteOffset:-1,treeLength,native?input.byteOffset:-1,inputLength,100000000),error=>{
   if(tagged)return error instanceof WebAssembly.Exception&&error.is(bounds)&&error.getArg(bounds,0)===0&&error.getArg(bounds,1)===0;
   if(kind==='linear-trap')return error instanceof WebAssembly.RuntimeError;
   return (!jsTagged||error===madeError)&&error.type==='java/lang/ArrayIndexOutOfBoundsException'&&error.index===0&&error.length===0;
  },'Bounds error edge did not preserve its diagnostic contract');
 }
 return {elapsedMs,checksum,linearSourceSha256:hash(wat),wasmSha256:hash(bytes),inputSha256,treeSha256,postTimerBoundsChecks:2*paths.length,
  purpose:'Handwritten linear-memory diagnostic on valid data; explicit bounds and fuel polling; no runtime/Java acceptance claim'};
}

async function one(engine,name,revision,inspection,inspectionPrefix) {
 const fixture=read().microbenchmarks,index=cases.indexOf(name);
 assert.ok(fixture&&index>=0,'Build the fixture and select a known case');
 assert.equal(hash(source),fixture.sourceSha256,'Rebuild changed fixture');
 const classes=fixture.classes||{'LoadingMicroKernel.class':fixture.classSha256};
 assert.deepEqual(fs.readdirSync(path.join(directory,'classes')).sort(),Object.keys(classes).sort(),'Unexpected fixture classes');
 for(const [name,expected]of Object.entries(classes))assert.equal(hash(fs.readFileSync(path.join(directory,'classes',name))),expected);
 const ownsMethod=key=>Object.keys(classes).some(name=>key.startsWith(name.slice(0,-6)+'.'));
 const codec=name.startsWith('bzip-');
 const buffered=name.startsWith('buffered-');
 const count=codec?1:buffered?Math.min(Number(process.env.MICRO_ITERATIONS||fixture.bufferedWorkload?.requests),fixture.bufferedWorkload?.requests):Number(process.env.MICRO_ITERATIONS||fixture.iterations);
 assert.ok(Number.isSafeInteger(count)&&count>0&&count<=100_000_000,'Invalid iteration count');
 const expected=buffered?fixture.bufferedReferences?.[count]?.[0]:codec||count===fixture.iterations?fixture.referenceChecks[index]:fixture.references?.[count]?.[index];
 assert.ok(Number.isInteger(expected),'Run the paired harness to establish the HotSpot reference for this count');
 if(buffered)assert.equal(fixture.bufferedWorkload.inputSha256,hash(codecInput),'Replay input changed');
 const args=[String(index),String(count),fixture.seed,...(buffered?bufferedReplayArgs(fixture.bufferedWorkload):[])];
 const result={case:name,engine,sourceRevision:revision,iterations:count,node:process.version,execArgv:process.execArgv,
  ...(buffered?{replayTraceSha256:fixture.bufferedWorkload.traceSha256,replayInputSha256:fixture.bufferedWorkload.inputSha256,
   replayLoaderSha256:hash(fs.readFileSync(new URL('./buffered-replay.mjs',import.meta.url))),
   partialReplay:count<fixture.bufferedWorkload.requests}:{}),
  ...(name.startsWith('tail-')?{loopIterations:name.startsWith('tail-zero-')?0:count}:{}),
  loadAverageAtStart:os.loadavg(),availableParallelism:os.availableParallelism(),
  instrumented:process.env.JVM_WASM_IMPORT_STATS==='1'||!!inspection,
  nativeAot:nodeArgs.slice(1).every(flag=>process.execArgv.includes(flag)),
  fixtureTransport:workerFixture.supplied?'stdin-projected':'file-projected',
  measurementFixtureSha256:hash(JSON.stringify(workerFixture.receipt)),
  harnessSha256:hash(fs.readFileSync(script)),loaderSha256:hash(fs.readFileSync(new URL('./archive-jvm.mjs',import.meta.url))),
  fixtureSha256:hash(JSON.stringify(classes)),fixtureKind:'class-inventory',sourceSha256:fixture.sourceSha256};
 if(floatArrayKinds.includes(engine)){
  Object.assign(result,measureFloatArrayControl(engine,name,count,fixture.seed,expected));
 }else if(linearKinds.has(engine)){
  Object.assign(result,linearReadControl(name,count,engine));
 }else if(bufferedCallKinds.includes(engine)){
  assert.equal(name,'buffered-ready-helper','Native call controls use the direct original request stream');
  Object.assign(result,measureBufferedCallControl(engine,codecInput,fixture.bufferedWorkload,count,fixture.bufferedReferences[count]),{
   callControlHarnessSha256:hash(fs.readFileSync(new URL('./buffered-call-controls.mjs',import.meta.url)))});
 }else if(engine==='teavm'){
  const wasm=fs.readFileSync(path.join(directory,'teavm/micro.wasm'));
  assert.equal(hash(wasm),fixture.wasmSha256);
  assert.equal(hash(fs.readFileSync(path.join(directory,'teavm/micro.wasm-runtime.js'))),fixture.runtimeSha256);
  await import(pathToFileURL(path.join(directory,'teavm/micro.wasm-runtime.js')));
  const module=await TeaVM.wasmGC.load(wasm);
  try{await module.exports.main(args);}catch(error){
   throw Error('TeaVM microkernel failed: '+JSON.stringify({case:name,error:String(error),
    elapsedMs:module.exports.elapsedMs(),checksum:module.exports.checksum(),
    ...(name.startsWith('tail-')?{tailState:Array.from({length:6},(_,key)=>module.exports.tailState(key))}:{})}));
  }
  Object.assign(result,{elapsedMs:module.exports.elapsedMs(),checksum:module.exports.checksum(),wasmSha256:fixture.wasmSha256});
  if(name.startsWith('buffered-'))result.bufferedState=Array.from({length:4},(_,key)=>module.exports.bufferedState(key));
  if(name.startsWith('tail-'))result.tail={calls:module.exports.tailState(0),initializations:module.exports.tailState(1),
   initializationPhase:module.exports.tailState(2),loopFinished:module.exports.tailState(3),prepareCalls:module.exports.tailState(4)};
 }else{
  const memoStorage=engine==='jvm-fixture-memo-storage';
  const storageControl=engine==='jvm-fixture-storage'||memoStorage;
  assert.ok(engine==='jvm'||storageControl,'Unknown JVM control');
  if(storageControl)assert.equal(name,memoStorage?'huffman-inline':'huffman-helper','Storage ablation is restricted to its private tree fixture');
  let replacementInstalled=false;
  const {JVM}=await loadArchivedJvm(root,revision,storageControl?{observeModule:({filename,exports})=>{
   if(!filename.endsWith('/src/core/nativeObjectStorage.js'))return;
   // Valid-input diagnostic only: retain private store/field-container identity
   // checks but omit the stronger shape/base authentication. Never a VM policy.
   if(memoStorage){
    // The controlled fixture never replaces/shadows its tree fields. This
    // deliberately unsafe memo isolates repeated ownership lookup, not a VM
    // optimization: arbitrary callbacks would require proper revocation.
    const validate=exports.validatedNativeObjectStorageOf,stores=new WeakMap();
    exports.validatedNativeObjectStorageOf=(object,memory)=>{
     const cached=stores.get(object);if(cached)return cached;
     const store=validate(object,memory);if(store)stores.set(object,store);return store;
    };
   }else exports.validatedNativeObjectStorageOf=exports.nativeObjectStorageOf;
   replacementInstalled=true;
  }}:{});
  if(storageControl){
   assert.ok(replacementInstalled,'Storage ablation did not bind before compiler imports');
   result.semanticControl={kind:memoStorage?'memoized-fixture-storage':'private-fixture-storage',preservesArbitraryJavaSemantics:false,
    change:memoStorage?'Reuse the first successful ownership lookup per fixture object':'Replace whole-shape validator with existing private storage lookup',replacementInstalled};
  }
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
      elapsedMs:performance.now()-start,canonicalBefore,canonicalAfter:w.canonicalResumeFrames.has(frame),result:summarizeExecutionOutcome(out)});
    return out;
   };
  }
  await j.run('LoadingMicroKernel',{args});
  if(inspection==='code'){
   const method=name==='sin'?'sine':name==='ready-prefix-loop'?'coldPrefixLoop':name==='buffered-ready-helper'?'bufferedHelper':name==='buffered-ready-wrapped'?'bufferedWrapped':name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
   const prefix=inspectionPrefix||(name.startsWith('bzip-')?'Bzip2Decoder.decodeBlocks(':'LoadingMicroKernel.'+method+'(');
   const state=j.jit.wasmJit.compiled.find(s=>s.key.startsWith(prefix));
   assert.ok(state?.meta?.bytes,'Installed kernel bytes are unavailable');
   const output=path.join(directory,'current.wat');
   const disassemble=(bytes,target)=>{
    const fd=fs.openSync(target,'w');
    try{execFileSync('wasm-dis',['--all-features','-'],{input:bytes,stdio:['pipe',fd,'pipe']});}
    finally{fs.closeSync(fd);}
   };
   disassemble(state.meta.bytes,output);
   // Keep exactly one current preview for each compiler, from the same
   // pinned Java fixture. These disassemblies are diagnostics, never timings.
   const teaBytes=fs.readFileSync(path.join(directory,'teavm/micro.wasm'));
   assert.equal(hash(teaBytes),fixture.wasmSha256,'TeaVM inspection artifact changed');
   const teaOutput=path.join(directory,'current-teavm.wat');
   disassemble(teaBytes,teaOutput);
   result.code={output,sha256:hash(state.meta.bytes),method:state.key,
    teavm:{output:teaOutput,wasmSha256:fixture.wasmSha256}};
   const generated=j.jit.codegenCache.get(state.method);
   result.code.javascript={flags:Object.keys(generated||{}).filter(key=>generated[key]===true),
    source:String(generated?.jvmResumeBodyFn||generated)};
  }
  const fields=j.classes.LoadingMicroKernel.staticFields;
  if(name.startsWith('buffered-'))result.bufferedState=Array.from(fields.get('bufferedFinalState:[I'));
  if(name.startsWith('huffman-'))result.inputSha256=hash(Uint8Array.from(
   j.classes.MicroHuffmanReader.staticFields.get('bytes:[B')));
  Object.assign(result,{elapsedMs:Number(fields.get('elapsedNanos:J'))/1e6,checksum:fields.get('checksum:I'),
   compilation:j.jit.syncCompileCensus(),lateCompiles:late,options,
   executionMethods:j.jit.wasmJit.compiled.filter(s=>ownsMethod(s.key)).map(s=>({
    key:s.key,runs:s.runs,...canonicalExecutionCounts(s.meta),exits:s.exits,
    nativeExitCount:s.meta?.directFrameContext?.exitCount??null,
    directNativeExitCount:s.meta?.directFrameContext?.directExitCount??null,
    nativeThrowCount:s.meta?.directFrameContext?.throwCount??null,
    inlineActivationSiteCount:s.meta?.inlineActivationSiteCount||0,
    inlineActivationDepth:s.meta?.inlineActivationDepth||0,
    inlineAtomicStaticSiteCount:s.meta?.inlineAtomicStaticSiteCount||0,
    nativeObjectBodyFieldSites:s.meta?.nativeObjectBodyFieldSites||0,
    nativeObjectBodyArraySites:s.meta?.nativeObjectBodyArraySites||0,
    nativeObjectBodyReceiverCount:s.meta?.nativeObjectBodyReceiverCount??null,
    nativeObjectBodyLazyReceivers:s.meta?.nativeObjectBodyLazyReceivers??null,
    instructionExitSiteCount:s.meta?.instructionExitSiteCount??null,
    nativeOperandSnapshotCount:s.meta?.nativeOperandSnapshotCount??null,
    nativeClosedCallSiteCount:s.meta?.nativeClosedCallSiteCount??null,
    nativeStaticInputGuardCount:s.meta?.nativeStaticInputGuardCount??null,
    nativeObjectRegionBlockCount:s.meta?.nativeObjectRegionBlockCount??null,
    nativeStaticStateBodySites:s.meta?.nativeStaticStateBodySites??null,
    nativeArrayReferenceReadElisionCount:s.meta?.nativeArrayReferenceReadElisionCount||0,
    nativeStaticDeferredFieldCount:s.meta?.nativeStaticDeferredFieldCount??null,
    nativeStaticStateInstanceFieldSites:s.meta?.nativeStaticStateInstanceFieldSites??null,
    nativeStaticStateTailLoadCount:s.meta?.nativeStaticStateTailLoadCount??null,
    nativeStaticCheckedReferenceLoads:s.meta?.nativeStaticCheckedReferenceLoads??null,
    nativeObjectRegionCastCount:s.meta?.nativeObjectRegionCastCount??null,
    nativeObjectRegionCastCacheCount:s.meta?.nativeObjectRegionCastCacheCount??null,
    nativeObjectRegionStaticReadCount:s.meta?.nativeObjectRegionStaticReadCount??null,
    nativeClosedForwarder:s.meta?.nativeClosedForwarder??null,
    nativeClosedCallRoot:s.meta?.nativeClosedCallRoot??null,
    nativeOperandSnapshotRetried:s.meta?.nativeOperandSnapshotRetried??null,
    closedContractVersion:s.meta?.closedNativeBody?.version??null,
    closedExportBound:!!s.meta?.canonicalClosedStorageRun&&s.meta?.closedNativeBody?.run===s.meta?.canonicalClosedStorageRun,
    canonicalTargetImportCount:s.meta?.canonicalTargetImportCount||0,
    nativeCastRegion:s.meta?.nativeCastRegion||null,
    nativeBooleanArraySites:s.meta?.nativeBooleanArraySites||0,
    nativeStaticArrayBodySites:s.meta?.nativeStaticArrayBodySites||0,
    nativeStaticArrayRegions:s.meta?.nativeStaticArrayRegions||[],
    fuelExits:s.fuelExits,nestedCalls:s.nestedCalls,nestedDeopts:s.nestedDeopts,
    full:!!s.meta?.fullyCompiled,canonical:!!s.meta?.canonicalRun,inlined:s.meta?.inlinedCalls,
    omittedNativeBoundsCheckCount:s.meta?.omittedNativeBoundsCheckCount||0,
    crossBlockArrayFillCount:s.meta?.crossBlockArrayFillCount||0,
    arrayMetadataFlowStatus:s.meta?.arrayMetadataFlowStatus||'unavailable',
    slabFieldSites:s.meta?.slabFieldSites,omittedSlabFillCount:s.meta?.omittedSlabFillCount||0,
    parameterHeapSpecializationBytes:s.meta?.parameterHeapSpecializationBytes||0,
    parameterHeapBoundsElisionCount:s.meta?.parameterHeapBoundsElisionCount||0,
    parameterHeapRangeGuardCount:s.meta?.parameterHeapRangeGuardCount||0,
    parameterObjectSpecializationBytes:s.meta?.parameterObjectSpecializationBytes||0,
    slabGuardCount:s.meta?.slabGuardCount||0,slabGuardBytes:s.meta?.slabGuardBytes||0,
    nativeNumericKernelCount:s.meta?.nativeNumericKernelCount||0,
    nativeNumericKernelBytes:s.meta?.nativeNumericKernelBytes||0,
    nativeElementReuseSiteCount:s.meta?.nativeElementReuseSiteCount||0,
    nativeElementCaptureCount:s.meta?.nativeElementCaptureCount||0,
    nativeArrayReadReuseSites:s.meta?.nativeArrayReadReuseSites||0,
    reusedPrimitiveFieldReadCount:s.meta?.reusedPrimitiveFieldReadCount||0,
    primitiveFieldCaptureCount:s.meta?.primitiveFieldCaptureCount||0,
    primitiveFieldSharedLocalCount:s.meta?.primitiveFieldSharedLocalCount||0,
    booleanArrayCacheCount:s.meta?.booleanArrayCacheCount||0,
    booleanFieldArrayGroupCount:s.meta?.booleanFieldArrayGroupCount||0,
    representationLoopCount:s.meta?.representationLoopCount||0,
    representationLoopBytes:s.meta?.representationLoopBytes||0,
    normalFlow:!!s.meta?.normalFlowFullyCompiled,demotes:[...(s.meta?.demoteReasons||[])],
    structuredResumeEntry:s.meta?.structuredResumeEntry,
    specSites:s.meta?.specSites,entryGuards:s.meta?.entryInitializationGuards,
    links:s.meta?.linkBindings?.map(b=>({key:b.key,pending:b.pending,canonical:!!b.canonicalDirect})),
    ...(j.jit.wasmJit.importStatsEnabled?{imports:[['entry',s.meta],['callee',s.callee?.meta],['osr',s.osr?.meta]]
     .flatMap(([tier,meta])=>[...(meta?.importStats||[])].filter(([,count])=>count>0).map(([name,count])=>({tier,name,count})))}:{}),
    jsRestoring:!!j.jit.codegenCache.get(s.method)?.jvmRestoringDirectPositionalBody})),
   ...(j.jit.wasmJit.importStatsEnabled?{transitions,canonicalCensus:[...canonicalCensus.values()],checkpointTrace,importCensus:j.jit.wasmJit.compiled.flatMap(s=>[
    ['entry',s.meta],['callee',s.callee?.meta],['osr',s.osr?.meta]
   ].flatMap(([tier,meta])=>[...(meta?.importStats||[])].filter(([,count])=>count>0)
    .map(([name,count])=>({method:s.key,tier,name,count})))).sort((a,b)=>b.count-a.count).slice(0,40)}:{})});
  assert.deepEqual(late,[],'Java compilation occurred during execution');
  assert.equal(result.compilation.postMainSyncCompileCount,0);
  if(storageControl){
   const tree=result.executionMethods.find(m=>m.key===(memoStorage?'MicroHuffmanBook.readScalarInline()I':'MicroHuffmanBook.readScalar()I'));
   assert.equal(tree?.directEntries,count,'Ablation lost the per-symbol native boundary');
   if(memoStorage){
    assert.ok(tree.nativeStaticStateBodySites>0,'Memo control lost its mixed state proof');
    assert.equal(tree.nativeStaticStateInstanceFieldSites,3,'Memo control lost its instance fields');
   }else{
    assert.equal(tree.nativeClosedCallSiteCount,1,'Ablation lost the closed static-reader edge');
    assert.equal(tree.nativeObjectBodyFieldSites,3,'Ablation lost the receiver-field proof');
   }
   assert.equal(tree.nativeExitCount,0,'Ablation left native execution');
  }
  if(['byte-field-call','boolean-field-call'].includes(name)){
   const prefix='LoadingMicroKernel.'+(name==='byte-field-call'?'byte':'boolean')+'FieldStep(';
   const step=result.executionMethods.find(method=>method.key.startsWith(prefix));
   assert.ok(step?.full&&step.directEntries>=count&&step.exits===0,'Per-call control lost its native method boundary');
  }
  if(name.startsWith('tail-')){
   const loop=result.executionMethods.find(method=>method.key.startsWith('LoadingMicroKernel.tailLoop('));
   const helper=result.executionMethods.find(method=>method.key.startsWith('LoadingMicroKernel.tailHelper('));
   assert.ok(loop?.full&&loop.directEntries+loop.runs>=1,'Tail loop lost its compiled method boundary');
   assert.ok(helper?.full&&helper.directEntries+helper.runs>=1,'Tail helper lost its compiled method boundary');
   result.tail={calls:fields.get('tailCalls:I'),initializations:fields.get('tailInitializations:I'),
    initializationPhase:fields.get('tailInitializationPhase:I'),loopFinished:fields.get('tailLoopFinished:I'),prepareCalls:fields.get('tailPrepareCalls:I')};
  }
  if(['buffered-ready-helper','buffered-ready-wrapped'].includes(name)){
   const prefix=name==='buffered-ready-wrapped'?'LoadingMicroKernel.bufferedWrapped(':'LoadingMicroKernel.bufferedHelper(';
   const caller=result.executionMethods.find(method=>method.key.startsWith(prefix));
   assert.equal(caller?.exits,0,'Owner preparation did not remove the first helper transition');
  }
 }
 if(name.startsWith('tail-'))assert.deepEqual(result.tail,{calls:1,initializations:1,
  initializationPhase:name.endsWith('-ready')?0:1,loopFinished:1,prepareCalls:name.endsWith('-ready')?1:0},
  'Host-observed tail state differs from the class-initialization contract');
 if(name.startsWith('buffered-')){
  const oracle=fixture.bufferedReferences?.[count];assert.ok(oracle,'Original buffered-reader reference is missing');
  assert.deepEqual([result.checksum,...result.bufferedState],oracle,'Original bit-reader checksum/state mismatch');
 }
 assert.ok(Number.isFinite(result.elapsedMs)&&result.elapsedMs>0,'Timer failed');
 assert.equal(result.checksum,expected,'HotSpot checksum mismatch');
 console.log('MICRO_RESULT '+JSON.stringify(result));
}

function run(revision,names,engines=['jvm','teavm']) {
 revision=selectBenchmarkRevision(revision);
 assert.notEqual(process.env.JVM_WASM_IMPORT_STATS,'1','Keep instrumented diagnostics out of timing comparisons');
 assert.match(revision||'',/^[0-9a-f]{40}$/,'Use an exact JVM source commit');
 if(!names.length)names=cases;
 for(const name of names)assert.ok(cases.includes(name),name);
 const count=ensureReference();
 const measurementInput=JSON.stringify(projectMeasurementFixture(read())),measurementHash=hash(measurementInput);
 const runId=crypto.randomUUID();
 // Three fresh-process pairs; reverse engine order in the middle pair.
 for(const name of names)for(let pair=0;pair<3;pair++){
  const order=pair===1?[...engines].reverse():engines;
  for(const engine of order){
   const output=execFileSync(process.execPath,[...nodeArgs,script,'one',engine,name,revision,fixtureStdinFlag],{
    input:measurementInput,encoding:'utf8',maxBuffer:16*1024*1024});
   const result=parseMeasurementResult(output,'MICRO_RESULT ');
   assert.ok(!result.instrumented,'Keep inspection/import counters out of timing observations');
   assert.equal(result.measurementFixtureSha256,measurementHash,'Worker did not use the supplied fixture');
   result.runId=runId;result.pair=pair;result.measuredAt=new Date().toISOString();
   const fixture=read().microbenchmarks;fixture.runs.push(result);save(fixture);
   console.log(`${name} n=${result.iterations} pair ${pair+1} ${engine}: ${result.elapsedMs.toFixed(3)} ms, check ${result.checksum}`);
  }
 }
}

function ensureReference() {
 const fixture=read().microbenchmarks,count=Number(process.env.MICRO_ITERATIONS||fixture.iterations);
 assert.ok(Number.isSafeInteger(count)&&count>0&&count<=100_000_000,'Invalid iteration count');
 assert.ok(count===fixture.iterations||fixture.references?.[count],
  'Measurement requires an existing reference for this iteration count; no oracle executes here');
 const bufferedCount=Math.min(count,fixture.bufferedWorkload.requests);
 assert.ok(fixture.bufferedReferences?.[bufferedCount],
  'Measurement requires the existing buffered reference; no oracle executes here');
 return count;
}

function diagnose(revision,name,engine='jvm') {
 assert.ok(['jvm','jvm-fixture-storage','jvm-fixture-memo-storage'].includes(engine),'Unknown diagnostic JVM control');
 revision=selectBenchmarkRevision(revision);
 assert.match(revision||'',/^[0-9a-f]{40}$/);
 ensureReference();
 const output=execFileSync(process.execPath,[...nodeArgs,script,'one',engine,name,revision,fixtureStdinFlag],{
  input:JSON.stringify(projectMeasurementFixture(read())),encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,JVM_WASM_IMPORT_STATS:'1'}});
 const result=parseMeasurementResult(output,'MICRO_RESULT ');
 result.measuredAt=new Date().toISOString();
 const fixture=read().microbenchmarks;(fixture.diagnostics||=[]).push(result);save(fixture);
 console.log(JSON.stringify(result,null,2));
}

const [command,...args]=process.argv.slice(2);
if(command==='build')build();
else if(command==='one')await one(...args);
else if(command==='run')run(args[0],args.slice(1));
else if(command==='run-jvm')run(args[0],args.slice(1),['jvm']);
else if(command==='storage-control')run(args[0],['huffman-helper'],['jvm-fixture-storage']);
else if(command==='memo-storage-control')run(args[0],['huffman-inline'],['jvm-fixture-memo-storage']);
else if(command==='float-arrays'){
 const engines=(args[1]||'').split(',');
 for(const engine of engines)assert.ok(floatArrayKinds.includes(engine),'Select a float-array control');
 run(args[0],args.slice(2),engines);
}
else if(command==='linear'){
 assert.ok(linearKinds.has(args[1]),'Select '+[...linearKinds].join(', '));
 run(args[0],args.slice(2),[args[1],'teavm']);
}
else if(command==='diagnose')diagnose(...args);
else if(command==='calls'){
 const engines=args.slice(1);
 for(const engine of engines)assert.ok(bufferedCallKinds.includes(engine)||engine==='teavm','Unknown call control: '+engine);
 run(args[0],['buffered-ready-helper'],engines.length?engines:[...bufferedCallKinds,'teavm']);
}
else if(command==='inspect')await one('jvm',args[1],selectBenchmarkRevision(args[0]),'code',args[2]);
else throw Error('Usage: microbench.mjs build | run [baseline|EXACT_REVISION] [CASE ...] | run-jvm EXACT_REVISION [CASE ...] | float-arrays EXACT_REVISION ENGINE[,ENGINE...] CASE ... | calls baseline|EXACT_REVISION [CALL_KIND ...] | linear baseline|EXACT_REVISION '+[...linearKinds].join('|')+' CASE ... | storage-control EXACT_REVISION | memo-storage-control EXACT_REVISION | diagnose baseline|EXACT_REVISION CASE [jvm|jvm-fixture-storage] | inspect baseline|EXACT_REVISION CASE [METHOD_PREFIX] | one ENGINE CASE EXACT_REVISION');
