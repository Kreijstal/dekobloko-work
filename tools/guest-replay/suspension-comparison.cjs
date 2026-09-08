'use strict';
const fs=require('fs'),assert=require('assert');
const {createReplay}=require('./engine.cjs');
const [file,classpath]=process.argv.slice(2);
const artifact=JSON.parse(fs.readFileSync(file));
const manifest=require('../../apps/launcher/browser-runtime.json');
(async()=>{
 for(const enabled of [false,true]){
   const r=await createReplay(artifact,{classpath,tier:'hybrid',jvmOptions:{...manifest.jvmOptions,
     jit:{...manifest.jvmOptions.jit,retainFramelessAfterSuspension:enabled}}});
   for(let trial=0;trial<3;trial++){
     const before=r.jvm.jit.cooperativeCallSuspensionCount;
     const result=await r.run({timeoutMs:60000});
     assert(result.correct,'exact output and state must match');
     assert.equal(result.timedCompiles,0);
     const targets=[...new Set(r.jvm.jit.syncCallSites.flatMap(s=>s?[...s.targets.values()]:[]))];
     console.log(JSON.stringify({enabled,trial,correct:result.correct,executionMs:result.executionMs,
       hostYields:result.hostYields,retainedSuspensions:r.jvm.jit.cooperativeCallSuspensionCount-before,
       rejectedTargets:targets.filter(t=>t.framelessRejected).map(t=>({
         key:t.lookupClass+'.'+t.method.name+t.method.descriptor,reason:t.framelessRejectionReason||'exception-or-active-child'}))}));
   }
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
