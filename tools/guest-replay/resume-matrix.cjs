'use strict';
// Diagnostic ablation, never loaded by the runtime or the launcher.
const fs=require('fs');
const {createReplay}=require('./engine.cjs');
const [capture,classpath]=process.argv.slice(2);
const artifact=JSON.parse(fs.readFileSync(capture));
const manifest=require('../../apps/launcher/browser-runtime.json');
const arms={
 control:{},
 noResume:{structuredResumeEntry:false},
 generator:{ordinaryAdaptiveFramelessPositional:false,compiledCallChains:false},
 noLocalValues:{structuredLocalValueNumbering:false},
 noDeferredCalls:{structuredDeferredCallMaterialization:false},
 noCoarseLoops:{structuredCoarseCountedLoopSafePoints:false},
 noBranchEntries:{structuredResumeEntryBranches:false},
};
(async()=>{
 for(const [arm,options] of Object.entries(arms)){
   try{
     const replay=await createReplay(artifact,{classpath,tier:'javascript',
       jvmOptions:{...manifest.jvmOptions,jit:{...manifest.jvmOptions.jit,
         structuredBoundedAdaptivePolling:true,...options}}});
     if(process.env.GUEST_REPLAY_FORCE_POLLS==='1')
       replay.jvm.jit.continueStructuredQuantum=()=>false;
     const result=await replay.run({timeoutMs:60000});
     console.log(JSON.stringify({arm,correct:result.correct,executionMs:result.executionMs,
       hostYields:result.hostYields,mismatch:result.mismatch}));
   }catch(e){console.log(JSON.stringify({arm,error:String(e)}));}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
