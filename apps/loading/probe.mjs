#!/usr/bin/env node
// Small archive-decoder reproducer for compiler debugging, outside acceptance.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),root=path.resolve(new URL('../../../java-tools/',import.meta.url).pathname);
const player=path.join(os.homedir(),'.cache/dekobloko/geoblox-loading');
const receiptPath=path.join(player,'benchmark.json'),receipt=JSON.parse(fs.readFileSync(receiptPath));
const mode=process.argv[2]||'js',asset=process.argv[3]||'1-2.bin';assert.ok(['js','wasm','canonical','slab'].includes(mode));
const input=new Int8Array(fs.readFileSync(path.join(player,'assets',asset)));
const reference=execFileSync('python3',['-c',`import bz2,sys
b=sys.stdin.buffer.read();sys.stdout.buffer.write(bz2.decompress(b'BZh1'+b[9:9+int.from_bytes(b[1:5],'big')]))`],{input:Buffer.from(input),maxBuffer:16*1024*1024});
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'loading-kernel-'));
try {
 fs.writeFileSync(path.join(temporary,'LoadingKernelProbe.java'),`public class LoadingKernelProbe {
 static native byte[] input(); static byte[] output; static int written;
 public static void main(String[] args) {
  byte[] data=input();int n=((data[5]&255)<<24)|((data[6]&255)<<16)|((data[7]&255)<<8)|(data[8]&255);
  output=new byte[n];written=Bzip2Decoder.decompressInto(output,n,data,data.length-9,9);
 }
}`);
 execFileSync('javac',['--release','8','-classpath',path.join(player,'classes'),'-d',temporary,path.join(temporary,'LoadingKernelProbe.java')]);
 const {JVM}=require(path.join(root,'src/core/jvm'));
 const options=structuredClone(receipt.executionBaseline.jvmOptions);
 options.classpath=[temporary,path.join(player,'classes')];
 options.jit.preparationPolicy={entryMethods:['LoadingKernelProbe.main([Ljava/lang/String;)V']};
 options.jit.compileWorker=false;
 if(mode!=='js'){options.prepareWasmPreparedUpgradesOnly=false;options.jit.preparedCompleteWasm=true;options.jit.preparedLoopLeafWasm=true;}
 if(mode==='canonical'||mode==='slab')options.jit.wasm={canonicalDirectCalls:true,canonicalEhLinks:true,nativeJsExceptionTags:true,nativeInstanceExits:true};
 if(mode==='slab'){options.wasmFields=true;options.denseInstanceFields=false;}
 globalThis.window=globalThis;globalThis.document={};
 const j=new JVM(options);delete globalThis.document;
 j.jre.LoadingKernelProbe={applicationFallback:true,staticMethods:{'input()[B':()=>input}};
 j.jit._syncCompileEnvironment={trace:false,assert:true};
 let guestStart;const mark=j.jit.markMainStarted.bind(j.jit);j.jit.markMainStarted=()=>{guestStart=performance.now();mark();};
 const w=j.jit.wasmJit;
 const transitions=[];const execute=w.execute.bind(w);
 w.execute=(frame,thread,state,...args)=>{const before=frame.pc,r=execute(frame,thread,state,...args);if(state.key?.includes('Bzip2Decoder')&&state.exits&&transitions.length<100)transitions.push({key:state.key,before,after:frame.pc,result:r,fuels:state.fuelExits});return r;};
 let error;const start=performance.now();
 try{await j.run('LoadingKernelProbe');}catch(caught){error={type:caught.type||caught.name,message:caught.message,location:caught.jvmGuestLocation};}
 const elapsed=performance.now()-start;
 const fields=j.classes.LoadingKernelProbe.staticFields,out=fields.get('output:[B');
 const actual=out&&Buffer.from(out),equal=actual?.equals(reference)||false;
 let firstDifference=-1;if(actual&&!equal)firstDifference=actual.findIndex((value,i)=>value!==reference[i]);
 const methods=[];
 for(const owner of ['Bzip2Decoder','Bzip2DecoderState'])for(const item of j.classes[owner]?.ast.classes[0].items||[]){if(item.type!=='method')continue;const m=item.method,s=w.state.get(m),g=j.jit.codegenCache.get(m);methods.push({key:owner+'.'+m.name+m.descriptor,wasm:s&&{status:s.status,runs:s.runs,exits:s.exits,fuelExits:s.fuelExits,full:s.meta?.fullyCompiled,calleeFull:s.callee?.meta?.fullyCompiled,frameEntryOnly:s.meta?.frameEntryOnly,veto:s.linkVetoed,nested:s.nestedCalls,nestedDeopts:s.nestedDeopts,demotes:s.meta?.demoteReasons&&[...s.meta.demoteReasons],pending:[...new Set(s.meta?.linkBindings?.filter(b=>b.pending).map(b=>b.key)||[])],flags:s.meta&&{deoptable:s.meta.deoptableCalls,usedEh:s.meta.usedEh,boxed:s.meta.boxedCount}},js:g&&{restoring:!!g.jvmRestoringDirectPositionalBody,rejection:g.jvmStructuredRestoringDirectRejection}});}
 const result={mode,asset,elapsed,executionMs:performance.now()-guestStart,equal,firstDifference,error,compilation:j.jit.syncCompileCensus(),preparation:j.preparationReport,transitions,methods};
 receipt.kernelDiagnostic=result;fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 assert.ok(equal,'Decoded bytes differ from independent BZip2 reference');
}finally{fs.rmSync(temporary,{recursive:true});}
