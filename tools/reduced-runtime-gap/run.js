'use strict';
(async()=>{
 const mode=new URLSearchParams(location.search).get('mode')||'split';
 if(!['split','fused'].includes(mode))throw Error('Invalid mode');
 const debug=window.gapDebug=new JVMDebug.BrowserJVMDebug();
 await debug.initialize();
 const bytes=await fetch('/fixture.jar').then(r=>r.arrayBuffer());
 await debug.loadFile(new File([bytes],'fixture.jar',{type:'application/java-archive'}));
 const manifest=await fetch('/runtime.json').then(r=>r.json());
 Object.assign(debug.debugController.options,manifest.jvmOptions,{appletParameters:{mode}});
 const run=window.gapResult={mode,state:'preparing',userAgent:navigator.userAgent,frames:[]};
 const start=performance.now();let guestStart=null;
 const timer=setInterval(()=>{
  const j=debug.debugController.jvm;
  if(j.guestStarted&&guestStart===null){guestStart=performance.now();run.state='running';}
  const fields=j.classes.ReducedGapApplet?.staticFields;
  const get=(n,d)=>fields?.get(n+':'+d);
  run.guestStartedObservation=guestStart;
  run.observedPreparationMs=guestStart===null?performance.now()-start:guestStart-start;
  run.presentations=j._awtPresentationStats?.presented||0;
  run.presentedGaps=j._awtPresentationStats?.recentPresentationGaps||[];
  run.count=get('frames','I')||0;run.phase=get('phase','I')||0;
  document.getElementById('status').textContent=JSON.stringify({mode,state:run.state,frames:run.count,
   presentations:run.presentations,phase:run.phase},null,2);
  if(get('done','I')){
   const array=get('frameNanos','[J');
   run.frames=Array.from(array.data||array.elements||array.items||array,n=>Number(n)/1e6);
   run.checksum=get('checksum','I');run.state='completed';
   run.compiles=j.jit.syncCompileCensus();clearInterval(timer);
   document.getElementById('status').textContent=JSON.stringify(run,null,2);
  }
 },250);
 debug.run('ReducedGapApplet').catch(e=>{run.state='failed';run.error=String(e.stack||e);
  clearInterval(timer);document.getElementById('status').textContent=run.error;});
})().catch(e=>{window.gapResult={state:'failed',error:String(e.stack||e)};
 document.getElementById('status').textContent=window.gapResult.error;});
