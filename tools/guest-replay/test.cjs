'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {execFileSync}=require('child_process');
const {encode,decode}=require('./graph.cjs');
const {createReplay}=require('./engine.cjs');
const {JVM}=require('../../../java-tools/src/core/jvm');
const model=require('../../../java-tools/src/core/objectModel');
async function main(){
  const jvm=new JVM({wasmHeap:true});
  const array=new Int32Array([1,-2,2147483647]);
  const input={array,alias:array,big:1234567890123456789n,negativeZero:-0,nan:NaN};input.self=input;
  const snapshot=encode(input),restored=decode(snapshot,jvm);
  assert.equal(restored.array,restored.alias);assert.equal(restored,restored.self);
  assert.deepEqual(encode(restored),snapshot);
  const booleans=jvm.wasmHeap.alloc('[Z',2);booleans.type='[Z';booleans.set([0,1]);
  const booleanSnapshot=encode(booleans),booleanCopy=decode(booleanSnapshot,jvm);
  assert.equal(booleanCopy.type,'[Z','heap snapshots must not turn boolean[] into byte[]');
  assert.deepEqual(encode(booleanCopy),booleanSnapshot);
  assert.equal(encode(restored,{schema:1}).schema,1,'legacy oracle serialization remains explicit');
  assert.throws(()=>encode({fn:()=>{}}),/Non-portable/);
  assert.throws(()=>encode(new Date()),/Host object/);
  assert.throws(()=>encode([array,array.subarray(1)]),/Overlapping/);
  assert.throws(()=>encode(array,{maxBytes:1}),/byte limit/);
  assert.throws(()=>decode({schema:1,nodes:[],root:{$ref:8}},jvm),/reference/);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'guest-replay-test-'));
  try{
    execFileSync('javac',['-g','-d',dir,path.join(__dirname,'ReplayFixture.java')]);
    const capture=new JVM({classpath:dir,wasmHeap:true,denseInstanceFields:true});
    await capture.preloadClasspathClasses();
    const object=model.makeObjectRef(capture,'ReplayFixture',model.newFields(capture,'ReplayFixture'));
    model.writeField(object.fields,'ReplayFixture.total',7);
    model.writeField(object.fields,'legacy.extra',123);
    assert.deepEqual(encode(decode(encode(object),capture)),encode(object),'dense auxiliary fields survive snapshots');
    const out=capture.wasmHeap.alloc('[I',4);out.set([1,2,3,4]);
    const args=[object,out],initial=encode({args,statics:{ReplayFixture:[]}});
    out.set([8,17,27,38]);model.writeField(object.fields,'ReplayFixture.total',17);
    const artifact={schema:1,owner:'ReplayFixture',name:'mix',descriptor:'([I)V',key:'ReplayFixture.mix([I)V',
      input:initial,expected:encode({args,outputs:{}}),initialized:['ReplayFixture'],clockMillis:0,visualBuffers:[]};
    for(const tier of ['interpreter','javascript','wasm','hybrid']){
      const replay=await createReplay(artifact,{classpath:dir,tier,jvmOptions:{denseInstanceFields:true}});
      if(tier==='interpreter')replay.jvm.interpreterBurst=1;
      for(let n=0;n<2;n++){
        replay.jvm._nextEventLoopYieldAt=-1;
        const tickMethod=tier==='interpreter'?'_tryExecuteSynchronousInterpreterTick':'_tryExecuteSynchronousJitTick';
        const executeTick=replay.jvm[tickMethod];
        let firstTick=true;
        replay.jvm[tickMethod]=function(...args){
          if(firstTick){
            firstTick=false;
            assert.ok(this._nextEventLoopYieldAt>0,'reset gives the compiled workload a fresh host deadline');
          }
          const result=executeTick.apply(this,args);
          // Force a real host-turn boundary while the interpreter still has
          // work. This must yield and resume, not permanently expire polls.
          if(tier==='interpreter')this._nextEventLoopYieldAt=-1;
          return result;
        };
        const result=await replay.run();assert.equal(result.correct,true,JSON.stringify({tier,result}));
        replay.jvm[tickMethod]=executeTick;
        assert.equal(firstTick,false,'the production scheduler entry was exercised');
        if(tier==='interpreter')assert.ok(result.hostYields>0,'expired turns yield during execution');
        if(tier==='wasm')assert.ok(result.wasmRuns>0,'the Wasm arm must actually execute Wasm');
      }
      const expected=artifact.expected;
      artifact.expected={...expected,unexpectedOutput:true};
      assert.equal((await replay.run()).correct,false,'a bad oracle must not pass');
      artifact.expected=expected;
    }
    // One timed stream: no graph reset, verification, or deadline refresh
    // between calls. State must carry through overflow and synchronized entry.
    const streamRoots=decode(initial,capture),streamValues=streamRoots.args[1];
    let total=7;const everySample=[];
    for(let block=0;block<32;block++) {
      for(let i=0;i<streamValues.length;i++) {
        total=(total+streamValues[i])|0;
        streamValues[i]=(total+7*i)|0;
      }
      everySample.push(...streamValues);
    }
    model.writeField(streamRoots.args[0].fields,'ReplayFixture.total',total);
    const hotspot=execFileSync('java',['-cp',dir,'ReplayFixture'],{encoding:'utf8'}).trim().split(/\s+/).map(Number);
    assert.deepEqual([total,...streamValues],hotspot,'sequence oracle also matches HotSpot');
    const stream={...artifact,invocations:32,
      stream:{arrayArgument:1,clearBeforeCall:false,expectedSamples:everySample},
      expected:encode({args:streamRoots.args,outputs:{}})};
    for(const tier of ['interpreter','javascript','wasm','hybrid']) {
      const replay=await createReplay(stream,{classpath:dir,tier,jvmOptions:{denseInstanceFields:true}});
      const result=await replay.run();
      assert.equal(result.completedInvocations,32);
      assert.equal(result.correct,true,JSON.stringify({tier,result}));
      assert.equal(result.timedCompiles,0);
      assert.deepEqual(result.samples,everySample,'every block is retained, not only the last');
      assert.equal(result.deadlineMs,32*1000/24);
      await assert.rejects(()=>replay.run({invocations:0}),/invocation count/);
      everySample[0]++;
      assert.equal((await replay.run()).correct,false,'corrupt early PCM fails despite exact final state');
      everySample[0]--;
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
  console.log('Guest replay graph, production scheduler, and four-tier reset/equivalence tests passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
