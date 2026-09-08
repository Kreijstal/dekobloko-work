'use strict';
// Opt-in preload for launch-alterorb-games-jvmjs. Never installed in production.
const fs=require('fs'),path=require('path');
const {encode,captureStatics}=require('./graph.cjs');
const model=require('../../../java-tools/src/core/objectModel');
const Jit=require('../../../java-tools/src/jit/JitCompiler');
const Wasm=require('../../../java-tools/src/jit/WasmJit');
const CallStack=require('../../../java-tools/src/core/callStack');
const {parseMethodDescriptor}=require('../../../java-tools/src/jit/wasmShared');
const output=process.env.GUEST_REPLAY_CAPTURE_DIR;
if(!output)throw Error('GUEST_REPLAY_CAPTURE_DIR is required');
fs.mkdirSync(output,{recursive:true});
const targets=new Map([
  ['kj.a([III)V',{mode:'audio'}],
  ['hi.a(IIIIILnf;II)V',{mode:'visual'}],
]);
// Additional diagnostic entry, e.g. a loader/decompressor. This only changes
// capture selection; it is not a runtime intrinsic or a production tier rule.
const extraTarget=process.env.GUEST_REPLAY_EXTRA_TARGET;
if(extraTarget)targets.set(extraTarget,{mode:'component'});
const pending=new WeakMap(),done=new Set(),attempts=new Map();
// Select later music passages without executing guest code before main or
// changing the mixer. The default remains the original first-voice fixture.
const audioSkipBlocks=Number(process.env.GUEST_REPLAY_AUDIO_SKIP_BLOCKS||0);
if(!Number.isSafeInteger(audioSkipBlocks)||audioSkipBlocks<0)throw Error('Invalid audio skip block count');
let activeAudioBlocks=0;
const key=(m,c)=>`${c||m.className}.${m.name}${m.descriptor}`;
function containsVoice(root) {
  const seen=new Set(),todo=[root];
  while(todo.length && seen.size<10000) {
    const o=todo.pop();if(!o||typeof o!=='object'||seen.has(o))continue;
    seen.add(o);if(o.type==='kl')return true;
    if(o.fields)for(const k of model.enumerateFieldKeys(o.fields))todo.push(model.readField(o.fields,k));
    else if(Array.isArray(o))for(const v of o)if(v&&typeof v==='object')todo.push(v);
  }
  return false;
}
function begin(jvm,frame) {
  if(frame.pc!==0||pending.has(frame))return;
  const k=key(frame.method,frame.className),spec=targets.get(k);
  if(!spec||done.has(k))return;
  if(spec.mode==='audio') {
    if(!containsVoice(frame.locals[0]))return;
    if(activeAudioBlocks++<audioSkipBlocks)return;
  }
  const attempt=(attempts.get(k)||0)+1;attempts.set(k,attempt);
  if(attempt>(spec.mode==='visual'?512:4))return;
  // Sample across logo animation rather than repeatedly snapshotting every
  // invisible draw in its initial fade-in.
  if(spec.mode==='visual'&&attempt%8!==1)return;
  try {
    const args=[],params=parseMethodDescriptor(frame.method.descriptor).params;
    let slot=0;
    if(!(frame.method.flags||[]).includes('static'))args.push(frame.locals[slot++]);
    for(const p of params){args.push(frame.locals[slot]);slot+=p==='J'||p==='D'?2:1;}
    const statics=captureStatics(jvm);
    if(spec.mode==='visual') {
      // The rasterizer reads the texture descriptor table as well as primitive
      // static arrays. Preserve its guest-object graph explicitly; do not
      // replace a missing table with a synthetic null or empty value.
      const owner='l',field='field_i:[Lfd;',value=jvm.classes[owner]?.staticFields.get(field);
      if(value===undefined)throw Error('Missing rasterizer texture table');
      if(!statics.values[owner].some(([key])=>key===field))statics.values[owner].push([field,value]);
      statics.omitted=statics.omitted.filter(key=>key!==owner+'.'+field);
    }
    const input=encode({args,statics:statics.values});
    pending.set(frame,{schema:1,key:k,owner:frame.className,name:frame.method.name,
      descriptor:frame.method.descriptor,mode:spec.mode,args,input,
      initialized:[...jvm.classInitializationState].filter(([,v])=>v==='INITIALIZED').map(([k])=>k),
      omittedStatics:statics.omitted,clockMillis:jvm.clock.millis(),
      provenance:{source:'live guest entry',captureTimingExcluded:true,
        runtime:{wasmHeap:!!jvm.wasmHeap,wasmFields:jvm.wasmFields,
          denseInstanceFields:jvm.denseInstanceFields},
        ...(spec.mode==='audio'?{activeAudioBlock:activeAudioBlocks}: {})},
      beforePixels:spec.mode==='visual'?Array.from(jvm.classes.vb.staticFields.get('field_c:[I')||[]):null,jvm});
    console.error('[guest-replay] captured entry',k,'nodes',input.nodes.length,'bytes',input.bytes);
  }catch(e){console.error('[guest-replay] capture failed',k,String(e));}
}
const positional=Jit.prototype.getPositionalGeneratedInvoker;
Jit.prototype.getPositionalGeneratedInvoker=function(site,target){
  if(target?.method&&targets.has(key(target.method,target.lookupClass)))return null;
  return positional.call(this,site,target);
};
const generated=Jit.prototype.runGeneratedFrame;
Jit.prototype.runGeneratedFrame=function(fn,frame,thread,checks){begin(this.jvm,frame);return generated.call(this,fn,frame,thread,checks);};
const execute=Wasm.prototype.execute;
Wasm.prototype.execute=function(frame,...args){begin(this.jvm,frame);return execute.call(this,frame,...args);};
const pop=CallStack.prototype.pop;
CallStack.prototype.pop=function(){
  const frame=this.peek(),capture=pending.get(frame);
  if(capture){
    pending.delete(frame);
    try {
      const spec=targets.get(capture.key);
      const arrays=[],outputs={};
      if(spec.mode==='visual') {
        const fields=capture.jvm.classes.vb.staticFields;
        const pixels=fields.get('field_c:[I');
        if(!pixels?.length)throw Error('Visual capture has no raster target');
        const changedPixels=Array.from(pixels).filter((v,i)=>(v&0xffffff)!==0&&v!==capture.beforePixels[i]).length;
        if(!changedPixels){console.error('[guest-replay] skipping invisible visual draw');return pop.call(this);}
        capture.provenance.changedNonblackPixels=changedPixels;
        outputs['vb.field_c:[I']=pixels;
        arrays.push({owner:'vb',field:'field_c:[I',width:fields.get('field_f:I'),
          height:pixels.length/fields.get('field_f:I'),pixels:Array.from(pixels)});
      }
      const expected=encode({args:capture.args,outputs});
      const {args,jvm,beforePixels,...portable}=capture;
      const artifact={...portable,expected,visualBuffers:spec.mode==='visual'?arrays:[],
        audio:spec.mode==='audio'?{sampleRate:Number(jvm.classes.qk.staticFields.get('field_j:I')),
          frames:args[3],offset:args[2],samples:Array.from(args[1])}:null};
      fs.writeFileSync(path.join(output,spec.mode+'.json'),JSON.stringify(artifact));
      done.add(capture.key);console.error('[guest-replay] saved',spec.mode);
    }catch(e){console.error('[guest-replay] completion failed',capture.key,String(e));}
  }
  return pop.call(this);
};
