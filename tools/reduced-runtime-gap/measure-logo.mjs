import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {summarizePhase} from '../../../frame-phase-metrics.mjs';
const output=process.argv[2];
if(!output)throw Error('Usage: node measure-logo.mjs OUTPUT_DIRECTORY (fresh game preparing, frame trace attached)');
fs.mkdirSync(output,{recursive:true});
const profiler=await(await fetch('http://localhost:9226',{method:'POST',body:JSON.stringify({context:'chrome',script:'return Services.profiler.IsActive();'})})).json();
if(profiler[2]||profiler[3]?.value!==false)throw Error('Stop the sampling profiler before this measurement');
async function page(code){const r=await(await fetch('http://localhost:9226',{method:'POST',body:JSON.stringify({context:'content',script:'return window.wrappedJSObject.eval('+JSON.stringify(code)+');'})})).json();if(r[2])throw Error(JSON.stringify(r[2]));return JSON.parse(r[3].value);}
await page(`JSON.stringify((()=>{
 const j=geobloxSession.debug.debugController.jvm,m=j.classes.gb.staticFields,original=m.set;
 if(j.guestStarted)throw Error('Attach before guest execution');
 const l=window.logoMeasure={ticks:[],timeOrigin:performance.timeOrigin};
 l.stop=()=>{m.set=original;};
 m.set=function(k,v){if(k==='field_f:I'){
  const row={time:performance.now(),tick:v};
  if(v===1&&l.start===undefined){l.start=l.ticks.at(-1)?.time??row.time;l.audioStart=JVMDebug.audioPlatform.getWebAudioDiagnostics();}
  l.ticks.push(row);
  if(v===251&&l.start!==undefined){l.end=row.time;l.audioEnd=JVMDebug.audioPlatform.getWebAudioDiagnostics();l.stop();}
 }return original.call(this,k,v);};return {attached:true};})())`);
let shots=0;
for(let i=0;i<900;i++){
 const state=await page('JSON.stringify({start:logoMeasure.start,end:logoMeasure.end,tick:logoMeasure.ticks.at(-1)?.tick})');
 if(state.start!==undefined&&state.end===undefined){execFileSync('import',['-window','60817411',output+'/logo-'+String(shots++).padStart(3,'0')+'.png'],{env:{...process.env,DISPLAY:':0.0'}});}
 if(state.end!==undefined){
  const result=await page('JSON.stringify({logo:logoMeasure,frames:Array.from(__phaseTrace.times.subarray(0,__phaseTrace.count)),visibility:__phaseTrace.visibility,userAgent:navigator.userAgent})');
  result.metrics=summarizePhase(result.frames,result.logo.start,result.logo.end);
  result.boundary='gb.field_f:I last initialization zero preceding tick 1 through tick 251; eh.a(III)V draws at >=0; wj.f(I)Z completes at >250';
  result.samplingProfiler=false;result.screenshots=shots;
  fs.writeFileSync(output+'/measurement.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result.metrics));break;
 }
 await new Promise(r=>setTimeout(r,750));
 if(i===899)throw Error('Logo did not finish');
}
