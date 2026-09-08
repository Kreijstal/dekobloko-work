(async()=>{
 const pin=await fetch('/pin.json').then(r=>r.json());
 const manifest=await fetch('/runtime.json').then(r=>r.json());
 const result=window.diffResult={state:'preparing',pin,userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,visibility:document.visibilityState,hiddenDuringGuest:false};
 document.addEventListener('visibilitychange',()=>{if(window.diffDebug?.debugController.jvm.guestStarted&&document.hidden)result.hiddenDuringGuest=true;});
 const debug=window.diffDebug=new JVMDebug.BrowserJVMDebug();await debug.initialize();
 const jar=await fetch('/fixture.jar').then(r=>r.arrayBuffer());
 const jarHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',jar)),n=>n.toString(16).padStart(2,'0')).join('');
 if(jarHash!==pin.manifest.jarSha256)throw Error('Fetched JAR differs from pinned manifest');
 result.fetchedJarSha256=jarHash;
 await debug.loadFile(new File([jar],'fixture.jar'));
 Object.assign(debug.debugController.options,manifest.jvmOptions);
 const start=performance.now();let guestStart=null,finished=false;
 const save=async()=>{if(finished)return;finished=true;clearInterval(timer);document.querySelector('#status').textContent=JSON.stringify(result,null,2);await fetch('/result',{method:'POST',body:JSON.stringify(result)});};
 const timer=setInterval(()=>{
  const j=debug.debugController.jvm;
  if(j.guestStarted&&guestStart===null){guestStart=performance.now();result.preparationMs=guestStart-start;}
  const fields=j.classes[pin.manifest.spec.class]?.staticFields;
  const get=(n,d)=>fields?.get(n+':'+d);
  result.completed=get('completed','I')||0;
  document.querySelector('#status').textContent=JSON.stringify({state:guestStart?'running':'preparing',completed:result.completed,elapsedMs:performance.now()-start});
  if((guestStart!==null&&performance.now()-guestStart>120000)||performance.now()-start>600000){result.state='failed';result.error='Bounded run timeout';debug.debugController.pause();save();return;}
  if(get('done','I')){
   const array=a=>Array.from(a?.data||a?.elements||a?.items||a||[],Number);
   result.nanos=array(get('nanos','[J'));result.outputs=array(get('outputs','[I'));
   result.compiles=j.jit.syncCompileCensus();result.state='completed';
   result.audioTested=false;result.wallMs=performance.now()-guestStart;result.finalVisibility=document.visibilityState;save();
  }
 },250);
 debug.run(pin.manifest.spec.class,{beforeRun({jvm}){
  const prepare=jvm.precompileInitializedClasses;
  jvm.precompileInitializedClasses=async function(...args){
   const value=await prepare.apply(this,args);
   result.state='ready-for-visible-run';
   if(document.hidden)await new Promise(resolve=>{const visible=()=>{if(!document.hidden){document.removeEventListener('visibilitychange',visible);resolve();}};document.addEventListener('visibilitychange',visible);visible();});
   return value;
  };
  const mark=jvm.jit.markMainStarted;
  jvm.jit.markMainStarted=function(...args){guestStart=performance.now();result.preparationMs=guestStart-start;result.guestStartVisibility=document.visibilityState;return mark.apply(this,args);};
 }}).then(()=>{
  if(!debug.debugController.jvm.classes[pin.manifest.spec.class]?.staticFields.get('done:I')){result.state='failed';result.error='Guest execution returned without the driver completion oracle';save();}
 }).catch(e=>{result.state='failed';result.error=String(e);result.stack=e.stack;result.cause=String(e.cause||'');result.causeStack=e.causeStack;result.guestLocation=e.jvmGuestLocation;save();});
})().catch(e=>{window.diffResult={state:'failed',error:String(e),stack:e.stack};document.querySelector('#status').textContent=window.diffResult.error;});
