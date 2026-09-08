'use strict';
const assert=require('node:assert/strict');
const {installAudioCapture}=require('./live-capture.cjs');
function fixture(nonzero){
 class Stack{constructor(frame){this.items=[frame];}peek(){return this.items[this.items.length-1];}pop(){return this.items.pop();}}
 const fields=[17];Object.defineProperty(fields,Symbol('jvm.denseFieldKeys'),{value:['phase:I']});
 Object.defineProperty(fields,Symbol('jvm.denseFieldSlots'),{value:new Map([['phase:I',0]])});
 const method={name:'mix',descriptor:'([III)V',flags:[]};
 const pcm=new Int32Array(4),receiver={type:'MixerFixture',fields};
 const frame={pc:0,className:'MixerFixture',method,locals:[receiver,pcm,0,2]};
 const stack=new Stack(frame),run=()=>{},execute=()=>{},positional=()=>{};
 const target={method,lookupClass:'MixerFixture',targetClassName:'MixerFixture',positionalInvoker:()=>{}};
 const jit={runGeneratedFrame:run,wasmJit:{execute},getPositionalGeneratedInvoker:positional,
  syncCallSites:[{targets:new Map([['MixerFixture',target]]),fastPositional:{},fastPositionalTargets:{}}]};
 const jvm={jit,threads:[{callStack:stack}],classes:{},classInitializationState:new Map(),clock:{millis:()=>123}};
 const captured=installAudioCapture(jvm,{owner:'MixerFixture',name:'mix',descriptor:'([III)V',phase:'test'});
 jit.runGeneratedFrame(null,frame);pcm[0]=nonzero?99:0;stack.pop();
 assert.equal(jit.runGeneratedFrame,run);assert.equal(jit.wasmJit.execute,execute);
 assert.equal(jit.getPositionalGeneratedInvoker,positional);assert.equal(target.positionalInvoker,undefined);
 return captured;
}
const ok=fixture(true);assert.equal(ok.state,'completed');
const guest=ok.artifact.input.nodes.find(n=>n.kind==='guest');
assert.deepEqual(guest.fields,[['phase:I',17]],'foreign bundle field symbols retain Java names');
assert.equal(ok.artifact.expected.nodes.find(n=>n.kind==='typed').values[0],99);
assert.equal(fixture(false).state,'failed','silent capture fails and restores hooks');
console.log('Live capture exact fields, completion, and failure cleanup passed');
