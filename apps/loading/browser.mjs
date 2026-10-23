// Reproducible default for this execution-only comparison. Production launcher
// policy is separate; this fixture admits only its entry's reachable closure.
export function preparedLoadingOptions(base) {
  return {...base,prepareBeforeMain:true,prepareWasmPreparedUpgradesOnly:false,
    wasmFields:false,denseInstanceFields:true,
    jit:{...base.jit,preparedCompleteWasm:true,preparedLoopLeafWasm:true,
      preparationPolicy:{...base.jit?.preparationPolicy,
        entryMethods:['GeobloxLoading.main([Ljava/lang/String;)V']},
      wasm:{...base.jit?.wasm,canonicalDirectCalls:true,canonicalEhLinks:true,
        nativeJsExceptionTags:true,nativeInstanceExits:true,inlineColdIntegerLeaves:true,
        reuseNestedArguments:true,compileConstructors:true}}};
}

// Older runtime exports wrap fresh native I/O bytes; newer exports may return
// an owned typed view directly. This fixture's asset bridge has always exposed
// a typed view, so preserve that representation across source revisions.
export function freshLoadingBytes(jvm,bytes) {
  const array=jvm.newByteArray(bytes);
  return ArrayBuffer.isView(array)?array:array.array;
}

// Deferred identities count materialized activations, not normal invocations.
// Missing invocation counts must not masquerade as zero measured executions.
export function canonicalExecutionCounts(meta) {
  return {directEntries:meta?.canonicalLazyActivation?null:meta?.canonicalEntries?.value||0,
    canonicalIdCount:meta?.canonicalEntries?.value??null,
    canonicalLazyActivation:!!meta?.canonicalLazyActivation,
    nativeObjectBodyEntries:meta?.importStats?.get('native_object_body_entered')??null};
}

// Browser fixture only: all class files and compressed assets arrive before
// either runtime starts. Each invocation executes the workload exactly once.
export async function runLoading(backend, fixture) {
  const bytes=base64=>Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
  const assets=Object.fromEntries(Object.entries(fixture.assets).map(([n,b])=>[n,new Int8Array(bytes(b).buffer)]));
  const script=src=>new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>reject(Error('Cannot load '+src));document.head.append(el);});
  const started=performance.now();
  if(backend==='teavm') {
    globalThis.loadingAssets=assets;
    await script('/teavm/loading.wasm-runtime.js');
    const module=await TeaVM.wasmGC.load('/teavm/loading.wasm');
    const ready=performance.now();
    await module.exports.main([]);
    return {backend,hostAndModuleMs:ready-started,entryMs:performance.now()-ready,
      musicMs:module.exports.musicMs(),graphicsMs:module.exports.graphicsMs(),check:module.exports.check()};
  }
  if(backend!=='jvm')throw Error('Unknown runtime '+backend);
  await script('/runtime/jvm-debug.js');
  const debug=new JVMDebug.BrowserJVMDebug();
  await debug.initialize({dataPackage:{classes:fixture.classes}});
  const controller=debug.debugController;
  const {jit,...rest}=fixture.options;
  Object.assign(controller.options,rest,{prepareBeforeMain:true,prepareWasmPreparedUpgradesOnly:rest.prepareWasmPreparedUpgradesOnly??true});
  controller.options.jit={...controller.options.jit,...jit,compileWorker:false};
  const {installBrowserInflater}=await import('/inflater.mjs');
  let preparation,executionError;
  const lateCompiles=[];
  const ready=performance.now();
  try {await debug.run('GeobloxLoading',{args:[],beforeRun:({jvm})=>{
    const decompress=async(data,format)=>new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream(format))).arrayBuffer());
    installBrowserInflater(jvm,{inflate:b=>decompress(b,'deflate'),inflateRaw:b=>decompress(b,'deflate-raw')});
    jvm.jre.GeobloxLoading={applicationFallback:true,staticMethods:{
      'browserAsset(Ljava/lang/String;)[B':(_jvm,_object,args)=>{
        const name=String(args[0]?.value??args[0]);
        if(!assets[name])throw Error('Unexpected asset '+name);
        return freshLoadingBytes(_jvm,assets[name]);
      },
    }};
    // Reject late compiler entry before it performs work. Record attempts
    // too: swallowing an assertion into a slower fallback must not pass.
    jvm.jit._syncCompileEnvironment={trace:false,assert:true};
    const startCompile=jvm.jit.startSynchronousCompile.bind(jvm.jit);
    jvm.jit.startSynchronousCompile=(method,path)=>{if(jvm.jit.mainStarted)lateCompiles.push({method:jvm.jit.methodIdentity(method),path});return startCompile(method,path);};
    const prepare=jvm.precompileInitializedClasses.bind(jvm);
    jvm.precompileInitializedClasses=async options=>{const t=performance.now();const result=await prepare(options);preparation={ms:performance.now()-t,methods:result.methods,wasmMethods:result.wasmMethods,report:result.report};return result;};
  }});}catch(error){executionError=error.message;}
  const jvm=controller.jvm,fields=jvm.classes.GeobloxLoading.staticFields;
  const read=name=>Number(fields.get(name));
  const h=jvm.jit,w=h.wasmJit;
  const executionMethods=w.compiled.map(state=>({key:state.key,runs:state.runs,exits:state.exits,
    structured:!!state.meta?.structured,full:!!state.meta?.fullyCompiled,guarded:!!state.meta?.guardOnlyNormalFlowGaps,
    canonical:!!state.meta?.canonicalRun,prepared:h.preparedCodegenMethods.has(state.method),
    upgrade:h.hasPreparedFullWasmUpgrade(state.method),nativeReferences:state.meta?.nativeObjectReferenceSites||0,
    nativeCasts:state.meta?.nativeCastSites||0,...canonicalExecutionCounts(state.meta)}))
    .filter(state=>state.runs||state.guarded||state.directEntries||state.nativeObjectBodyEntries);
  const check=['pcmSamples:I','pcmBytes:J','pcmCrc:J','archiveFiles:I','decodedBytes:J','graphicsCrc:J'].map(read).join(':');
  return {backend,hostAndModuleMs:ready-started,entryAndPreparationMs:performance.now()-ready,
    musicMs:read('musicNanos:J')/1e6,graphicsMs:read('graphicsNanos:J')/1e6,check,preparation,
    compilation:jvm.jit.syncCompileCensus(),executionMethods,lateCompiles,error:executionError};
}
