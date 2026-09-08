'use strict';
const {JVM}=require('../../../java-tools/src/core/jvm');
const Frame=require('../../../java-tools/src/core/frame');
const CallStack=require('../../../java-tools/src/core/callStack');
const {parseMethodDescriptor,getOp}=require('../../../java-tools/src/jit/wasmShared');
const {encode,decode}=require('./graph.cjs');
const now=()=>globalThis.performance?.now()??Date.now();

async function createReplay(artifact,{classpath,jvmOptions={},tier='javascript',onProgress=()=>{}}={}) {
  if(!['javascript','wasm','hybrid','interpreter'].includes(tier))throw Error('Unknown tier '+tier);
  const started=now();
  const jvm=new JVM({...jvmOptions,classpath,wasmHeap:true,
    jit:{...jvmOptions.jit,preferWholeMethodJs:tier!=='wasm',compileWorker:false,profileMethods:false,profileTimings:false}});
  await jvm.preloadClasspathClasses();
  for(const owner of artifact.initialized) {
    if(!jvm.classes[owner])await jvm.loadClassByName(owner);
    jvm.classInitializationState.set(owner,'INITIALIZED');
    jvm.getClassInitializationToken(owner).initialized=true;
  }
  let roots;
  const restore=()=>{
    roots=decode(artifact.input,jvm);
    for(const [owner,entries] of Object.entries(roots.statics)) {
      const fields=jvm.classes[owner]?.staticFields;if(!fields)continue;
      for(const [key,value] of entries)fields.set(key,value);
    }
  };
  restore();
  // A replay is a data computation, not a second applet boot. Install this
  // before binding compiled call sites so native file/network/thread actions
  // cannot escape the fixture. Built-in arithmetic/bulk-copy intrinsics remain.
  for(const nativeKey of jvm.jni.nativeRegistry.keys()) {
    const [owner,name]=nativeKey.split(':');
    const pure=owner==='java/lang/Math'||owner==='java/lang/StrictMath'||
      owner==='java/lang/System'&&name==='arraycopy'||
      owner==='java/lang/Object'&&name==='getClass'||
      ['java/lang/Float','java/lang/Double'].includes(owner)&&/Bits|bits/.test(name);
    if(!pure)jvm.jni.nativeRegistry.set(nativeKey,()=>{throw Error('Non-portable native in replay: '+nativeKey);});
  }
  jvm.jni.registryVersion++;
  const rootMethod=await jvm.findMethodInHierarchy(artifact.owner,artifact.name,artifact.descriptor);
  if(!rootMethod)throw Error('Replay root is missing');
  // Compile the captured receiver classes and direct call closure, not all
  // game methods. Exceptional diagnostics may remain interpreted: an exception
  // fails the replay rather than turning into an IO/reporting workload.
  const classes=[...new Set(artifact.input.nodes.filter(n=>n.kind==='guest').map(n=>n.type))];
  const pending=[{owner:artifact.owner,method:rootMethod}],methods=[],seen=new Set();
  while(pending.length) {
    const item=pending.pop(),m=item.method;if(!m||seen.has(m))continue;
    seen.add(m);methods.push(item);
    for(const code of m.attributes||[])for(const entry of code.code?.codeItems||[]) {
      const ins=entry.instruction,op=getOp(ins);
      if(!op?.startsWith('invoke')||!Array.isArray(ins.arg))continue;
      const [,owner,pair]=ins.arg;if(!pair||owner?.includes('/'))continue;
      const [name,desc]=pair;
      if(name==='<init>'||desc.endsWith('Ljava/lang/RuntimeException;'))continue;
      const owners=op==='invokestatic'||op==='invokespecial'?[owner]:[owner,...classes];
      for(const candidate of owners) {
        const method=await jvm.findMethodInHierarchy(candidate,name,desc);
        if(method&&!seen.has(method))pending.push({owner:method.className||candidate,method});
      }
    }
    if(methods.length>1500)throw Error('Replay call closure exceeds 1500 methods');
  }
  jvm.jit.wasmJit.enabled=tier==='wasm'||tier==='hybrid';
  jvm.jit.effectfulPreparationActive=true;
  if(tier==='javascript'||tier==='hybrid')for(let i=0;i<methods.length;i++) {
    const {method}=methods[i];
    jvm.jit.getGeneratedFunction(method,{allowEffectfulCalls:true,compileLocally:true});
    jvm.jit.preparedCodegenMethods.add(method);
    onProgress({completed:i+1,total:methods.length});
  }
  if(tier==='wasm'||tier==='hybrid')for(const {owner,method} of methods) {
    if((method.flags||[]).some(f=>f==='native'||f==='abstract'))continue;
    const state=jvm.jit.wasmJit.methodState({method});
    jvm.jit.wasmJit.compile({className:owner,method},state);
  }
  jvm.jit.effectfulPreparationActive=false;
  // No optimizer runs during a timed replay. Missing bodies keep the
  // interpreter; no worker starts and no foreground compile is hidden.
  jvm.jit.getGeneratedFunction=method=>jvm.jit.codegenCache.get(method)||null;
  jvm.jit.wasmJit.refusePostMainCompiles=true;
  jvm.jit.wasmJit.noOnDemandCalleeCompile=true;
  if(tier==='wasm') {
    const select=jvm.jit.tryRunFrame;
    jvm.jit.tryRunFrame=function(frame,thread){
      // Isolate this backend: gaps use the interpreter, not a hidden JS body.
      frame.jitJsDisabled=true;return select.call(this,frame,thread);
    };
  }
  jvm.jit.markMainStarted();jvm.guestStarted=true;
  const preparationMs=now()-started;

  async function run({timeoutMs=10000,maxTicks=2000000,schedulerMode='production',
    invocations=artifact.invocations||1}={}) {
    if(!['production','single-step'].includes(schedulerMode))throw Error('Unknown replay scheduler');
    if(!Number.isSafeInteger(invocations)||invocations<1)throw Error('Invalid invocation count');
    const resetStart=now();restore();
    const stream=artifact.stream;
    const streamArray=stream?roots.args[stream.arrayArgument]:null;
    if(stream&&!(streamArray instanceof Int32Array ||
      Array.isArray(streamArray)&&streamArray.every(Number.isInteger)))
      throw Error('Stream output argument must be an integer sample array');
    const pcmStream=stream?new Int32Array(streamArray.length*invocations):null;
    const thread={id:1,status:'runnable',callStack:new CallStack(),pendingException:null};
    const enter=()=>{
      // Root return ends the synthetic invocation thread. The next driver
      // invocation starts runnable, retaining the same guest heap and fields.
      thread.status='runnable';
      if(stream?.clearBeforeCall)streamArray.fill(0);
      const frame=new Frame(rootMethod);frame.className=artifact.owner;
      let slot=0,index=0;
      if(!(rootMethod.flags||[]).includes('static'))frame.locals[slot++]=roots.args[index++];
      for(const p of parseMethodDescriptor(artifact.descriptor).params){
        frame.locals[slot]=roots.args[index++];slot+=p==='J'||p==='D'?2:1;
      }
      thread.callStack.push(frame);
    };
    enter();jvm.threads=[thread];jvm.currentThreadIndex=0;
    jvm._audioPriority=null;jvm._awtFrameProducerThread=null;jvm._awtEventThread=null;
    let failure;
    const handle=jvm.handleException;
    jvm.handleException=ex=>{failure=ex;thread.status='terminated';};
    const resetMs=now()-resetStart,wasm=jvm.jit.wasmJit;
    const beforeRuns=wasm.runCount||0,beforeCompiles=jvm.jit.postMainSyncCompileCount||0,begin=now();let ticks=0;
    // Preparation/reset can take seconds. Starting with the constructor's
    // expired host deadline makes every compiled call poll spill immediately,
    // benchmarking a permanent deoptimization condition the normal execute()
    // loop does not have. Use its actual bounded host-turn lifecycle here too.
    jvm._nextEventLoopYieldAt=Date.now()+jvm.eventLoopYieldMs;
    let hostYields=0,hostYieldMs=0,completedInvocations=0;
    try {
      while(completedInvocations<invocations&&!failure) {
        if(thread.status!=='runnable')throw Error('Replay attempted blocking operation: '+thread.status);
        if(++ticks>maxTicks||now()-begin>timeoutMs)throw Error('Replay execution budget exceeded');
        const scheduled={thread,callStack:thread.callStack,schedulerNow:artifact.clockMillis};
        if(schedulerMode==='single-step')await jvm.executeTick({},scheduled,tier==='interpreter');
        else {
          // Match execute(): use synchronous generated/interpreter bursts,
          // awaiting only real asynchronous fallbacks. Per-bytecode promises
          // are debugger stepping overhead, not the production scheduler.
          let result=tier==='interpreter'?{slow:true,skipJit:true}:
            jvm._tryExecuteSynchronousJitTick(scheduled);
          if(result?.slow){
            result=jvm._tryExecuteSynchronousInterpreterTick(scheduled,result.skipJit);
            if(result?.slow)result=jvm.executeTick({allowBurst:true},scheduled,result.skipJit);
          }
          if(result&&typeof result.then==='function')await result;
        }
        if(thread.callStack.isEmpty()) {
          if(pcmStream)pcmStream.set(streamArray,completedInvocations*streamArray.length);
          completedInvocations++;
          if(completedInvocations<invocations)enter();
        }
        if(!thread.callStack.isEmpty()&&Date.now()>=jvm._nextEventLoopYieldAt) {
          const yieldStart=now();await jvm._yieldHostTurn();
          hostYieldMs+=now()-yieldStart;hostYields++;
          jvm._nextEventLoopYieldAt=Date.now()+jvm.eventLoopYieldMs;
        }
      }
      if(failure)throw Error('Guest replay exception: '+(failure.stack||failure.message||JSON.stringify(failure)));
    }finally{jvm.handleException=handle;}
    const executionMs=now()-begin,verificationStart=now(),outputs={};
    const timedCompiles=(jvm.jit.postMainSyncCompileCount||0)-beforeCompiles;
    if(timedCompiles)throw Error('Optimizer ran during timed execution: '+timedCompiles+' compiles');
    for(const b of artifact.visualBuffers||[])outputs[b.owner+'.'+b.field]=jvm.classes[b.owner].staticFields.get(b.field);
    const actual=encode({args:roots.args,outputs},{schema:artifact.input.schema});
    const expected=JSON.stringify(artifact.expected),actualText=JSON.stringify(actual);
    const pcmCorrect=!stream||Array.isArray(stream.expectedSamples)&&
      stream.expectedSamples.length===pcmStream.length&&
      stream.expectedSamples.every((value,index)=>value===pcmStream[index]);
    const correct=expected===actualText&&pcmCorrect;
    let difference=0;
    if(!correct)while(difference<Math.min(expected.length,actualText.length)&&expected[difference]===actualText[difference])difference++;
    const deadlineMs=invocations*(artifact.audio?1000*artifact.audio.frames/artifact.audio.sampleRate:1000/24);
    return {tier,schedulerMode,correct,executionMs,resetMs,verificationMs:now()-verificationStart,ticks,timedCompiles,hostYields,hostYieldMs,completedInvocations,wasmRuns:(wasm.runCount||0)-beforeRuns,
      deadlineMs,deadlineMet:executionMs<=deadlineMs,
      // Only expose measured outputs, not the whole live JVM graph.
      pixels:artifact.visualBuffers?.length?Array.from(Object.values(outputs)[0]):null,
      samples:pcmStream?Array.from(pcmStream):artifact.audio?Array.from(roots.args[1]):null,
      mismatch:correct?null:{expectedNodes:artifact.expected.nodes.length,actualNodes:actual.nodes.length,
        pcmCorrect,
        firstDifference:difference,expectedExcerpt:expected.slice(Math.max(0,difference-60),difference+100),
        actualExcerpt:actualText.slice(Math.max(0,difference-60),difference+100)}};
  }
  return {run,preparationMs,preparedMethods:methods.length,jvm,
    snapshot:()=>encode({args:roots.args,outputs:Object.fromEntries(
      (artifact.visualBuffers||[]).map(b=>[b.owner+'.'+b.field,jvm.classes[b.owner].staticFields.get(b.field)]))},
      {schema:artifact.input.schema})};
}
module.exports={createReplay};
