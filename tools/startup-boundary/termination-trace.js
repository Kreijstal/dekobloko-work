// Opt-in observation layer, installed only by the isolated diagnostic origin.
// No guest input, scheduler budget, codegen option or return value is changed.
window.installTerminationTrace=function(j){
 if(window.terminationTrace)return;
 const limit=4096, ring=new Array(limit), ids=new WeakMap();
 let seq=0,nextId=1,armed=false,frozen=false;
 const id=o=>o&&typeof o==='object'?(ids.has(o)?ids.get(o):(ids.set(o,nextId),nextId++)):null;
 const scalar=v=>typeof v==='bigint'?v.toString()+'n':typeof v==='symbol'?String(v):
  typeof v==='function'?{function:v.name}:v&&typeof v==='object'?{id:id(v),type:v.type||v.constructor?.name}:v;
 const error=e=>({type:e?.type,name:e?.name,message:String(e?.message||e),stack:String(e?.stack||'')});
 const frame=f=>{
  if(!f)return null;
  const g=j.jit.codegenCache.get(f.method);
  return {id:id(f),owner:f.className,name:f.method?.name,descriptor:f.method?.descriptor,
   pc:f.pc,instruction:JSON.parse(JSON.stringify(f.instructions?.[f.pc]||null)),length:f.instructions?.length,
   tier:g?.jvmSourceUrl,structured:!!g?.jvmStructuredSsa,
   parent:id(f.jitGeneratedReturnParent),locals:f.locals?.map(scalar),operands:f.stack?.items.map(scalar),
   continuation:Object.fromEntries(Object.entries(f).filter(([k])=>/jit|continu|pending|monitor|resume/i.test(k)).map(([k,v])=>[k,scalar(v)])),
   symbols:Object.fromEntries(Object.getOwnPropertySymbols(f).map(k=>[String(k),f[k]&&typeof f[k]==='object'?{...scalar(f[k]),properties:Object.fromEntries(Object.entries(f[k]).map(([k,v])=>[k,scalar(v)]))}:scalar(f[k])]))};
 };
 const state=t=>({thread:t.id,status:t.status,frames:t.callStack.items.map(frame),
  pending:Object.fromEntries(Object.entries(t).filter(([k])=>/pending|continu|sleep|wait|block|join|jit/i.test(k)).map(([k,v])=>[k,scalar(v)]))});
 const api=window.terminationTrace={limit,installedAt:performance.now(),get sequence(){return seq},get armed(){return armed},get live(){return Array.from({length:Math.min(seq,limit)},(_,i)=>ring[(Math.max(0,seq-limit)+i)%limit])},dump:null,errors:[]};
 function emit(event,t,extra={}){
  if(frozen||t?.id!==2)return;
  try{ring[seq%limit]={seq,time:performance.now(),event,...state(t),...extra};seq++;}
  catch(e){api.errors.push(String(e));}
 }
 function dump(reason){if(frozen)return;api.dump={reason,sequence:seq,dropped:Math.max(0,seq-limit),events:Array.from({length:Math.min(seq,limit)},(_,i)=>ring[(Math.max(0,seq-limit)+i)%limit])};frozen=true;}
 function attach(t){
  if(t.id!==2||t.__terminationObserved)return;
  t.__terminationObserved=true;
  let status=t.status;
  Object.defineProperty(t,'status',{enumerable:true,configurable:true,get(){return status},set(v){
   emit('status-assignment',t,{from:status,to:v,hostStack:new Error().stack});
   status=v;
   if(v==='terminated'){emit('terminated',t);dump('thread-2-terminated');}
  }});
  const stack=t.callStack;
  for(const name of ['pop','clear','push']){
   const original=stack[name];
   stack[name]=function(...args){
    if(armed||name!=='push'&&this.items.length<=1)emit('stack-'+name+'-before',t,{argument:frame(args[0]),hostStack:new Error().stack});
    const value=original.apply(this,args);
    if(armed||this.items.length===0)emit('stack-'+name+'-after',t,{removed:name==='pop'?frame(value):null});
    return value;
   };
  }
  emit('attached',t);
 }
 const push=j.threads.push;
 j.threads.push=function(...ts){ts.forEach(attach);return push.apply(this,ts);};
 j.threads.forEach(attach);
 // The launcher replaces j.threads during startup. Attach to the scheduled
 // thread as well, before any of its execution or termination branches.
 if(j._prepareSchedulerTick){
  const prepare=j._prepareSchedulerTick;
  j._prepareSchedulerTick=function(...args){
   j.threads.forEach(attach);
   return prepare.apply(this,args);
  };
 }
 const run=j.jit.runGeneratedFrame;
 j.jit.runGeneratedFrame=function(g,f,t,...args){
  attach(t);
  if(t.id===2&&f.className==='ch'&&f.method.name==='a'&&f.method.descriptor==='(B)V')armed=true;
  if(armed)emit('generated-enter',t,{frame:frame(f),selected:g.name,source:g.jvmSourceUrl});
  try{const v=run.call(this,g,f,t,...args);
   if(armed)emit('generated-exit',t,{frame:frame(f),result:v&&{handled:v.handled,returned:v.returned,deopt:v.deopt,transient:v.transient,reason:v.reason,value:scalar(v.value)},selected:g.name});
   return v;
  }catch(e){emit('generated-host-throw',t,{frame:frame(f),error:error(e)});throw e;}
 };
 for(const name of ['handleException','dispatchExceptionInFrame','_failSynchronousJitTick']){
  const original=j[name];
  j[name]=function(...args){
   const t=name==='dispatchExceptionInFrame'?j.threads.find(t=>t.id===2&&t.callStack.items.includes(args[0])):args[name==='handleException'?2:1];
   if(t)emit(name+'-before',t,{error:error(args[name==='dispatchExceptionInFrame'?1:0]),hostStack:new Error().stack});
   try{const v=original.apply(this,args);if(t)emit(name+'-after',t,{result:scalar(v)});return v;}
   catch(e){if(t)emit(name+'-throw',t,{error:error(e)});throw e;}
  };
 }
 window.addEventListener('error',e=>{const t=j.threads.find(t=>t.id===2);if(t)emit('window-error',t,{error:error(e.error)});});
 window.addEventListener('unhandledrejection',e=>{const t=j.threads.find(t=>t.id===2);if(t)emit('unhandled-rejection',t,{error:error(e.reason)});});
};
