(async()=>{
 const attempt=new URLSearchParams(location.search).get('attempt')||'1';
 const debug=window.boundaryDebug=new JVMDebug.BrowserJVMDebug();await debug.initialize();
 const bytes=await fetch('/fixture.jar?attempt='+attempt).then(r=>r.arrayBuffer());
 await debug.loadFile(new File([bytes],'fixture.jar',{type:'application/java-archive'}));
 const manifest=await fetch('/runtime.json').then(r=>r.json());Object.assign(debug.debugController.options,manifest.jvmOptions);
 const result=window.boundaryResult={attempt,state:'preparing',trace:[],exceptions:[]};
 let started=null;
 const short=(j,t)=>({status:t.status,stack:t.callStack.items.map(f=>({owner:f.className,name:f.method.name,pc:f.pc}))});
 debug.run('BoundaryApplet',{beforeRun:()=>{
  const j=debug.debugController.jvm,original=j.jit.runGeneratedFrame;
  j.jit.runGeneratedFrame=function(g,f,t,...args){
   const watch=result.trace.length<400;
   if(watch)result.trace.push({event:'enter',owner:f.className,name:f.method.name,pc:f.pc,generated:g.name,...short(j,t)});
   try {const value=original.call(this,g,f,t,...args);
    if(watch)result.trace.push({event:'exit',owner:f.className,name:f.method.name,pc:f.pc,
     result:typeof value==='symbol'?String(value):value&&{returned:value.returned,deopt:value.deopt,reason:value.reason,value:typeof value.value==='symbol'?String(value.value):value.value},...short(j,t)});
    return value;
   }catch(e){if(watch)result.trace.push({event:'throw',owner:f.className,name:f.method.name,message:String(e)});throw e;}
  };
  const handle=j.handleException;
  j.handleException=function(e,pc,t){result.exceptions.push({type:e.type,name:e.name,hostStack:String(e.stack||''),message:String(e.message||''),pc,...short(j,t)});return handle.call(this,e,pc,t);};
 }}).catch(e=>{result.error=String(e.stack||e);result.state='failed';});
 const timer=setInterval(()=>{
  const j=debug.debugController.jvm;if(!j.guestStarted)return;
  if(started===null)started=performance.now();
  const fields=j.classes.BoundaryApplet.staticFields;
  result.fields=Object.fromEntries(['entered','unlocked','updated','presented','done','caught'].map(k=>[k,fields.get(k+':I')||0]));
  result.threads=j.threads.map(t=>({id:t.id,runnable:t.javaThread?.runnable?.type,...short(j,t)}));
  if(result.fields.done||performance.now()-started>5000){
   clearInterval(timer);result.state='observed';result.elapsedMs=performance.now()-started;result.compiles=j.jit.syncCompileCensus();
   result.generated=[];
   for(const [owner,name,descriptor] of [['Loop','run','()V'],['Loop','step','()V'],['Worker','update','(Z)V'],...(attempt==='field-cache'?[['Source','ready','()Z']]:[])]){
    const m=j.findMethod(j.classes[owner],name,descriptor);if(!m)continue;const g=j.jit.codegenCache.get(m);if(!g)continue;
    result.generated.push({owner,name:m.name,descriptor:m.descriptor,flags:m.flags,
     source:g.jvmGeneratedSource,structured:!!g.jvmStructuredSsa,
     variants:Object.fromEntries(Object.entries(g).filter(([k,v])=>typeof v==='function'&&v.jvmGeneratedSource).map(([k,v])=>[k,{name:v.name,source:v.jvmGeneratedSource}]))});
   }
   document.getElementById('status').textContent=JSON.stringify({fields:result.fields,threads:result.threads},null,2);
  }
 },100);
})().catch(e=>{window.boundaryResult={state:'failed',error:String(e)+'\n'+String(e.stack||'')};});
