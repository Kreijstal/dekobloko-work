'use strict';
(async()=>{
 const mode=new URLSearchParams(location.search).get('mode')||'split';
 const verify=new URLSearchParams(location.search).get('verify')==='pixels';
 if(!['split','fused','extracted','dispatch','mesh','detail1','detail2','detail3','detail4','state1','state2','state3','state4','flat1','flat4','full4','thin4','chain'].includes(mode))throw Error('Invalid mode');
 const debug=window.gapDebug=new JVMDebug.BrowserJVMDebug();
 await debug.initialize();
 const bytes=await fetch('/fixture.jar').then(r=>r.arrayBuffer());
 await debug.loadFile(new File([bytes],'fixture.jar',{type:'application/java-archive'}));
 const manifest=await fetch('/runtime.json').then(r=>r.json());
 Object.assign(debug.debugController.options,manifest.jvmOptions,{appletParameters:{mode,verify:verify?'pixels':'none'}});
 const run=window.gapResult={mode,state:'preparing',userAgent:navigator.userAgent,frames:[]};
 const start=performance.now();let guestStart=null;
 const timer=setInterval(()=>{
  const j=debug.debugController.jvm;
  if(j.guestStarted&&guestStart===null){guestStart=performance.now();run.state='running';}
  const fields=j.classes.LogoApplet?.staticFields;
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
   run.components={};for(const name of ['renderNanos','composeNanos','publishNanos']){const a=get(name,'[J');if(a)run.components[name]=Array.from(a.data||a.elements||a.items||a,n=>Number(n)/1e6);}
   run.checksum=get('checksum','I');run.state=verify?'verifying':'completed';
   run.compiles=j.jit.syncCompileCensus();clearInterval(timer);
   run.singleSiteInline=j.jit.singleSiteInlineReport||null;
   run.singleSiteInlineEntries=j.jit.singleSiteInlineEntries||0;
   run.checkedSpan=j.jit.checkedSpanReport||null;
   run.checkedSpanEntries=j.jit.checkedSpanEntries||0;
   if(run.checkedSpan?.countEntries)run.performanceAccepted=false;
   if(run.singleSiteInline?.countEntries)run.performanceAccepted=false;
   document.getElementById('status').textContent=JSON.stringify(run,null,2);
   if(verify){
    run.performanceAccepted=false;
    fetch('/oracle-'+mode.replace('state','detail').replace('flat','detail').replace('full','detail')+'.bin').then(r=>{if(!r.ok)throw Error('Missing pixel oracle');return r.arrayBuffer();}).then(buffer=>{
     const expected=new DataView(buffer),rows=get('validationPixels','[[I');let n=0;
     for(let f=0;f<32;f++)for(let i=0;i<540*140;i++,n++)if(rows[f][i]!==expected.getInt32(n*4))throw Error('Pixel mismatch '+f+':'+i);
     if(n*4!==buffer.byteLength)throw Error('Oracle length mismatch');
     run.exactPixelOracle={matched:true,pixels:n};run.state='completed';document.getElementById('status').textContent=JSON.stringify(run,null,2);
    }).catch(e=>{run.state='failed';run.error=String(e.stack||e);document.getElementById('status').textContent=run.error;});
   }
  }
 },250);
 debug.run('LogoApplet').catch(e=>{run.state='failed';run.error=String(e)+'\n'+String(e.stack||'');
  clearInterval(timer);document.getElementById('status').textContent=run.error;});
})().catch(e=>{window.gapResult={state:'failed',error:String(e.stack||e)};
 document.getElementById('status').textContent=window.gapResult.error;});
