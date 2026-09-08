'use strict';
const {encode,captureStatics}=require('./graph.cjs');
const model=require('../../../java-tools/src/core/objectModel');
const {parseMethodDescriptor}=require('../../../java-tools/src/jit/wasmShared');

// Separate diagnostic bundle: dense-layout symbols are module-local. Read
// the live object's explicit layout metadata, never guess numeric field names.
const keysFor=fields=>Object.getOwnPropertySymbols(fields)
  .find(s=>s.description==='jvm.denseFieldKeys');
const slotsFor=fields=>Object.getOwnPropertySymbols(fields)
  .find(s=>s.description==='jvm.denseFieldSlots');
const liveFields={
 enumerateFieldKeys(fields){
  if(!Array.isArray(fields))return model.enumerateFieldKeys(fields);
  const keys=fields[keysFor(fields)];
  if(!Array.isArray(keys)||!keys.every(k=>typeof k==='string'))
   throw Error('Live dense field layout unavailable');
  return [...keys];
 },
 readField(fields,key){
  if(!Array.isArray(fields))return model.readField(fields,key);
  const slots=fields[slotsFor(fields)];
  if(!slots||typeof slots.get!=='function')throw Error('Live dense field slots unavailable');
  const slot=slots.get(key);return fields[slot===undefined?key:slot];
 }
};

function installAudioCapture(jvm,{owner,name,descriptor,phase,sampleRate=22050}){
 if(!phase)throw Error('An explicitly observed phase is required');
 const jit=jvm.jit,wasm=jit.wasmJit;
 const result={state:'armed',phase};
 const originalRun=jit.runGeneratedFrame,originalWasm=wasm.execute;
 const prototype=Object.getPrototypeOf(jvm.threads[0].callStack),originalPop=prototype.pop;
 const originalPositional=jit.getPositionalGeneratedInvoker;
 const matches=(method,className)=>method?.name===name&&method.descriptor===descriptor&&className===owner;
 let pending=null,stopped=false;
 const touched=new Set();
 function stop(){
  if(stopped)return;stopped=true;
  jit.runGeneratedFrame=originalRun;wasm.execute=originalWasm;
  prototype.pop=originalPop;jit.getPositionalGeneratedInvoker=originalPositional;
  for(const target of touched)target.positionalInvoker=undefined;
 }
 function begin(frame){
  if(stopped||pending||frame.pc!==0||!matches(frame.method,frame.className))return;
  try{
   const params=parseMethodDescriptor(descriptor).params,args=[];
   let slot=0;if(!frame.method.flags.includes('static'))args.push(frame.locals[slot++]);
   for(const p of params){args.push(frame.locals[slot]);slot+=p==='J'||p==='D'?2:1;}
   const statics=captureStatics(jvm);
   pending={frame,args,input:encode({args,statics:statics.values},{fieldModel:liveFields}),
    initialized:[...jvm.classInitializationState].filter(([,v])=>v==='INITIALIZED').map(([k])=>k),
    omittedStatics:statics.omitted,clockMillis:jvm.clock.millis()};
   result.state='capturing';
  }catch(e){result.state='failed';result.error=String(e.stack||e);stop();}
 }
 jit.getPositionalGeneratedInvoker=function(site,target){
  if(matches(target?.method,target?.lookupClass)){touched.add(target);return null;}
  return originalPositional.call(this,site,target);
 };
 for(const site of jit.syncCallSites){
  if(!site)continue;
  for(const target of site.targets.values())if(matches(target.method,target.lookupClass)){
   touched.add(target);target.positionalInvoker=null;
   site.fastPositional=null;
   if(site.fastPositionalTargets)delete site.fastPositionalTargets[target.targetClassName];
   if(site.fastDynamicTarget?.target===target)site.fastDynamicTarget.positional=null;
  }
 }
 jit.runGeneratedFrame=function(fn,frame,...args){begin(frame);return originalRun.call(this,fn,frame,...args);};
 wasm.execute=function(frame,...args){begin(frame);return originalWasm.call(this,frame,...args);};
 prototype.pop=function(){
  if(pending&&this.peek()===pending.frame){
   try{
    const p=pending, samples=Array.from(p.args[1]);
    if(!samples.some(v=>v!==0))throw Error('Captured block contains no nonzero PCM');
    result.artifact={schema:1,key:owner+'.'+name+descriptor,owner,name,descriptor,mode:'audio',
     input:p.input,expected:encode({args:p.args,outputs:{}},{fieldModel:liveFields}),
     initialized:p.initialized,omittedStatics:p.omittedStatics,clockMillis:p.clockMillis,
     provenance:{source:'live browser guest entry',phase,captureTimingExcluded:true,
      runtime:{wasmHeap:!!jvm.wasmHeap,denseInstanceFields:jvm.denseInstanceFields},
      intervention:'selected call made canonical for snapshot; timings invalid during capture'},
     visualBuffers:[],audio:{sampleRate,frames:p.args[3],offset:p.args[2],samples}};
    result.state='completed';
   }catch(e){result.state='failed';result.error=String(e.stack||e);}
   stop();
  }
  return originalPop.call(this);
 };
 result.stop=stop;return result;
}
module.exports={installAudioCapture};
