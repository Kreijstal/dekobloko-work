import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const hook = new Function('context', readFileSync(new URL('../apps/launcher/browser-runtime-before.js',import.meta.url),'utf8'));
function fixture(modern=false) {
  const calls=[], events=[], session={};
  const jvm={jit:{}, handleException(){},
    async precompileInitializedClasses(options) {calls.push(['prepare',options,this.classpath]);return {prepared:3};},
    async run(name,options) {calls.push(['run',name,options]);return 'done';},
  };
  if(modern){jvm.prepareBeforeMain=true;jvm.jit.markMainStarted=()=>calls.push(['mark']);}
  const context={controller:{jvm,options:{prepareBeforeMain:true}},session,setStatus(){},sendTelemetry:(event)=>events.push(event)};
  return {jvm,calls,events,context};
}
// The hook only inspects window.location for an optional diagnostic toggle.
globalThis.location={search:''};
test('old bundle reports missing lifecycle without forcing unsafe preparation',async()=>{
  const {jvm,calls,events,context}=fixture();const run=jvm.run;hook(context);
  assert.equal(jvm.run,run);
  assert.equal(await jvm.run('Main',{classpath:['/classes']}),'done');
  assert.deepEqual(calls.map(c=>c[0]),['run']);
  assert.deepEqual(events,['runtime_preparation_unavailable']);
});
test('modern bundle retains its own preparation and guest-start hook',async()=>{
  const {jvm,calls,events,context}=fixture(true);const run=jvm.run;hook(context);
  assert.equal(jvm.run,run);jvm.jit.markMainStarted();assert.deepEqual(calls,[['mark']]);
  assert.deepEqual(events,['guest_execution_start']);
});
test('preparation observation preserves options and completion telemetry',async()=>{
  const {jvm,calls,events,context}=fixture(true);hook(context);
  const result=await jvm.precompileInitializedClasses({initializedOnly:false,effectful:true});
  assert.equal(result.prepared,3);
  assert.equal(calls[0][1].initializedOnly,false);
  assert.equal(calls[0][1].effectful,true);
  assert.deepEqual(events,['runtime_preparation_complete']);
});
