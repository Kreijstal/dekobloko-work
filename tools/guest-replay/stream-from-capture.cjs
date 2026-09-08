'use strict';
// A component driver, not a recording of the full game's scheduling. It keeps
// captured receiver state alive, clears the caller-owned accumulation buffer,
// and records every block. External controls/statics remain at captured values.
const fs=require('fs'),assert=require('node:assert/strict');
const {createReplay}=require('./engine.cjs');
const {encode}=require('./graph.cjs');
async function main(){
  const [input,classpath,output,countText='64']=process.argv.slice(2);
  const count=Number(countText);
  if(!input||!classpath||!output||!Number.isSafeInteger(count)||count<2||count>512)
    throw Error('Usage: stream-from-capture.cjs INPUT.json CLASSES OUTPUT.json [2..512]');
  const source=JSON.parse(fs.readFileSync(input));
  if(source.mode!=='audio'||source.audio.offset!==0)throw Error('Requires a full audio block at offset zero');
  const artifact={...source,expected:encode({}),invocations:count,
    stream:{arrayArgument:1,clearBeforeCall:true,expectedSamples:[]},
    provenance:{...source.provenance,source:'captured-state continuous component driver',
      externalInputs:'frozen captured statics; no UI or device scheduling',
      originalCapture:input,oracle:'interpreter PCM and reachable state'}};
  const reference=await createReplay(artifact,{classpath,tier:'interpreter',jvmOptions:{denseInstanceFields:true}});
  const result=await reference.run({timeoutMs:180000});
  artifact.expected=reference.snapshot();artifact.stream.expectedSamples=result.samples;
  for(const tier of ['javascript','hybrid']) {
    const replay=await createReplay(artifact,{classpath,tier,jvmOptions:{denseInstanceFields:true}});
    const measured=await replay.run({timeoutMs:180000});
    assert.equal(measured.correct,true,JSON.stringify({tier,mismatch:measured.mismatch}));
    console.log(JSON.stringify({tier,executionMs:measured.executionMs,deadlineMs:measured.deadlineMs,
      invocations:measured.completedInvocations,timedCompiles:measured.timedCompiles}));
  }
  fs.writeFileSync(output,JSON.stringify(artifact));
  console.log('Saved continuous component driver: '+output);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
