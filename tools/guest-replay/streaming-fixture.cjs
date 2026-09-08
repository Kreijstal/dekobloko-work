'use strict';
// Generate a diagnostic oracle after normal guest execution. No production
// preload, class-name intrinsic, or guest warmup is installed by this tool.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {execFileSync}=require('child_process');
const {JVM}=require('../../../java-tools/src/core/jvm');
const {newFields,makeObjectRef}=require('../../../java-tools/src/core/objectModel');
const {encode}=require('./graph.cjs');
const {createReplay}=require('./engine.cjs');
async function main(){
  const [classpath,output]=process.argv.slice(2);
  if(!classpath||!output)throw Error('Usage: streaming-fixture.cjs CLASSES_DIR OUTPUT.json');
  fs.mkdirSync(classpath,{recursive:true});
  execFileSync('javac',['-g','-d',classpath,path.join(__dirname,'StreamingAudioFixture.java')]);
  const jvm=new JVM({classpath,wasmHeap:true,denseInstanceFields:true});
  await jvm.preloadClasspathClasses();
  const owner='StreamingAudioFixture';
  const receiver=makeObjectRef(jvm,owner,newFields(jvm,owner));
  const pcm=jvm.wasmHeap.alloc('[I',64*256*2);
  const artifact={schema:1,owner,name:'mix',descriptor:'([I)V',key:owner+'.mix([I)V',
    input:encode({args:[receiver,pcm],statics:{}}),expected:encode({}),
    initialized:[owner,owner+'$Voice',owner+'$QuietVoice'],clockMillis:0,
    visualBuffers:[],audio:{frames:256,sampleRate:22050},invocations:64,
    provenance:{source:'standalone Java fixture',oracle:'interpreter state and HotSpot PCM',
      verificationOutsideTimedStream:true}};
  const reference=await createReplay(artifact,{classpath,tier:'interpreter',jvmOptions:{denseInstanceFields:true}});
  const result=await reference.run({timeoutMs:120000});
  const hotspot=execFileSync('java',['-cp',classpath,owner],{encoding:'utf8',maxBuffer:4*1024*1024})
    .trim().split(/\s+/).map(Number);
  assert.deepEqual(result.samples,hotspot,'all stereo samples must match HotSpot');
  artifact.expected=reference.snapshot();
  for(const tier of ['javascript','wasm','hybrid']){
    const replay=await createReplay(artifact,{classpath,tier,jvmOptions:{denseInstanceFields:true}});
    const measured=await replay.run({timeoutMs:120000});
    assert.equal(measured.correct,true,JSON.stringify({tier,measured}));
    console.log(JSON.stringify({tier,executionMs:measured.executionMs,deadlineMs:measured.deadlineMs,
      invocations:measured.completedInvocations,timedCompiles:measured.timedCompiles}));
  }
  fs.writeFileSync(output,JSON.stringify(artifact));
  console.log('Saved HotSpot-checked streaming fixture: '+output);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
