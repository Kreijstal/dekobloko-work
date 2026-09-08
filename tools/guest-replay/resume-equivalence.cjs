'use strict';
// Correctness-only scheduler stress. No timings from this driver are a
// performance result. Supply a captured component and its classpath.
const fs=require('fs'),assert=require('assert');
const {createReplay}=require('./engine.cjs');
const [capture,classpath]=process.argv.slice(2);
const artifact=JSON.parse(fs.readFileSync(capture));
const manifest=require('../../apps/launcher/browser-runtime.json');
(async()=>{
 for(const [tier,period] of [['interpreter',0],['javascript',0],['javascript',2],['javascript',3]]){
   const replay=await createReplay(artifact,{classpath,tier,jvmOptions:{...manifest.jvmOptions,
     jit:{...manifest.jvmOptions.jit,structuredBoundedAdaptivePolling:true}}});
   let polls=0;
   if(period)replay.jvm.jit.continueStructuredQuantum=()=>++polls%period!==0;
   const result=await replay.run({timeoutMs:10000,maxTicks:1000000});
   assert.equal(result.correct,true,`${tier} poll period ${period} must preserve exact state`);
   assert.equal(result.timedCompiles,0,'no compilation during execution');
   if(period)assert(polls>=period,'the forced scheduler exit must actually be exercised');
   console.log(JSON.stringify({tier,period,polls,correct:result.correct}));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
