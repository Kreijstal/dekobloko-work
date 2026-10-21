// Node-only code-generation diagnostic. Never installed by a normal launcher.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function installWasmOptimizer({minimumBytes=16384,tool='/usr/bin/wasm-opt',optimize}={}) {
 const Original=WebAssembly.Module,validate=WebAssembly.validate;
 const options=['-','-O3','--mvp-features','--enable-mutable-globals',
  '--enable-sign-ext','--enable-nontrapping-float-to-int','--enable-bulk-memory',
  '--enable-reference-types','--enable-multivalue','--enable-gc',
  '--enable-exception-handling','--enable-simd','-o','-'];
 const data={diagnosticOnly:true,minimumBytes,options,modules:[],errors:[],
  skippedInvalid:0,optimizedCount:0,inputBytes:0,outputBytes:0,optimizationMs:0};
 if(!optimize){
  data.toolVersion=execFileSync(tool,['--version'],{encoding:'utf8'}).trim();
  data.toolSha256=hash(fs.readFileSync(tool));
  optimize=input=>execFileSync(tool,options,{input,maxBuffer:64*1024*1024,
   env:{...process.env,BINARYEN_CORES:'1'},stdio:['pipe','pipe','pipe']});
 }
 let active=true;
 const proxy=new Proxy(Original,{construct(target,args,newTarget){
  const input=Buffer.from(args[0] instanceof ArrayBuffer?args[0]:
   new Uint8Array(args[0].buffer,args[0].byteOffset,args[0].byteLength));
  if(input.byteLength<minimumBytes)return Reflect.construct(target,args,newTarget);
  // A refused compiler candidate must retain its original validation error;
  // it is not a failure of the optimizer under test.
  if(!validate(input)){data.skippedInvalid++;return Reflect.construct(target,args,newTarget);}
  const inputSha256=hash(input),start=performance.now();
  try{
   const output=optimize(input);
   if(!validate(output)){
    // Retain the engine's precise encoding/feature error, not just false.
    new Original(output);
    throw Error('Optimizer produced an unsupported or invalid module');
   }
   const result=Reflect.construct(target,[output,...args.slice(1)],newTarget);
   const row={inputSha256,outputSha256:hash(output),inputBytes:input.length,
    outputBytes:output.length,optimizationMs:performance.now()-start};
   if(data.modules.length<512)data.modules.push(row);
   data.optimizedCount++;data.inputBytes+=row.inputBytes;data.outputBytes+=row.outputBytes;
   data.optimizationMs+=row.optimizationMs;
   return result;
  }catch(error){
   data.errors.push({inputSha256,inputBytes:input.length,message:String(error.message).slice(0,2000)});
   throw error;
  }
 }});
 WebAssembly.Module=proxy;
 return {
  finishPreparation(){
   if(active){
    if(WebAssembly.Module!==proxy)throw Error('Wasm diagnostic constructor changed unexpectedly');
    WebAssembly.Module=Original;active=false;
   }
   return data;
  },
 };
}
