import fs from 'node:fs';
import {summarizePhase} from './frame-phase-metrics.mjs';
const [command,label='menu']=process.argv.slice(2);
async function page(code){const p=await(await fetch('http://localhost:9226',{method:'POST',
 body:JSON.stringify({context:'content',script:`return window.wrappedJSObject.eval(${JSON.stringify(code)});`})})).json();
 if(p[2])throw Error(JSON.stringify(p[2]));return JSON.parse(p[3].value);}
if(command==='start'){
 console.log(await page(`JSON.stringify((()=>{
  if(window.__phaseTrace)throw Error('Stop the existing trace first');
  const j=geobloxSession.debug.debugController.jvm,s=j._awtPresentationStats;
  const trace={times:new Float64Array(100000),count:0,overflow:false,marks:[],visibility:[],
    list:null,original:null,url:location.href,cleanup:[]};
  trace.mark=label=>trace.marks.push({label,time:performance.now(),
    visible:document.visibilityState,started:j.guestStarted,
    audio:JVMDebug.audioPlatform.getWebAudioDiagnostics(),compiles:j.jit.syncCompileCensus()});
  trace.listener=()=>trace.visibility.push({time:performance.now(),state:document.visibilityState});
  document.addEventListener('visibilitychange',trace.listener);
  const attach=stats=>{const list=stats.recentFrameTimings,original=list.push;
    trace.list=list;trace.original=original;
    list.push=function(row){if(trace.count<trace.times.length)trace.times[trace.count++]=row.presentedAt;
      else trace.overflow=true;return original.call(this,row);};};
  const onceAssigned=(key,callback)=>{
    const descriptor=Object.getOwnPropertyDescriptor(j,key);
    if(descriptor&&(!descriptor.configurable||!('value' in descriptor)))throw Error('Cannot observe '+key);
    let value=j[key],pending=true;
    const restore=()=>{if(!pending)return;pending=false;delete j[key];
      if(descriptor)Object.defineProperty(j,key,{...descriptor,value});
      else if(value!==undefined)j[key]=value;};
    Object.defineProperty(j,key,{configurable:true,enumerable:descriptor?.enumerable??true,
      get:()=>value,set:next=>{value=next;restore();callback(next);}});
    trace.cleanup.push(restore);
  };
  if(s)attach(s);else onceAssigned('_awtPresentationStats',attach);
  if(!j.guestStarted)onceAssigned('guestStarted',started=>{if(started)trace.mark('guest-start-to-menu');});
  window.__phaseTrace=trace;trace.mark(${JSON.stringify(label)});return {started:true,label:${JSON.stringify(label)}};
 })())`));
}else if(command==='mark'){
 console.log(await page(`JSON.stringify((()=>{const t=window.__phaseTrace;if(!t)throw Error('No trace');
 t.mark(${JSON.stringify(label)});return {label:${JSON.stringify(label)},frames:t.count};})())`));
}else if(command==='stop'){
 const r=await page(`JSON.stringify((()=>{const t=window.__phaseTrace;if(!t)throw Error('No trace');
 t.mark('end');if(t.list)t.list.push=t.original;t.cleanup.forEach(f=>f());
 document.removeEventListener('visibilitychange',t.listener);
 delete window.__phaseTrace;return {url:t.url,overflow:t.overflow,times:Array.from(t.times.subarray(0,t.count)),
 marks:t.marks,visibility:t.visibility};})())`);
 r.phases=r.marks.slice(0,-1).map((m,i)=>{const next=r.marks[i+1];return {label:m.label,
   ...summarizePhase(r.times,m.time,next.time),
   foreground:m.visible==='visible'&&!r.visibility.some(v=>v.time>m.time&&v.time<=next.time&&v.state!=='visible'),
   underruns:next.audio.underruns-m.audio.underruns,
   missingAudioSeconds:next.audio.underrunSeconds-m.audio.underrunSeconds,
   synchronousCompiles:next.compiles.postMainSyncCompileCount-m.compiles.postMainSyncCompileCount};});
 r.valid=!r.overflow&&r.phases.every(p=>p.foreground);
 fs.writeFileSync(label,JSON.stringify(r,null,2));console.log(JSON.stringify({file:label,valid:r.valid,phases:r.phases},null,2));
}else throw Error('Usage: start PHASE | mark PHASE | stop OUTPUT.json');
