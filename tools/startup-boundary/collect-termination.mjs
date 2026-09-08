import fs from 'node:fs';
const code=`JSON.stringify((()=>{
 const s=window.geobloxSession,j=s?.debug.debugController.jvm,d=window.terminationTrace;
 return {url:location.href,guestStarted:j?.guestStarted,startedAt:s?.runtimeStartedAt,
  diagnostic:d?{limit:d.limit,sequence:d.sequence,armed:d.armed,errors:d.errors,dump:d.dump}:null,
  threads:j?.threads.map(t=>({id:t.id,status:t.status,runnable:t.javaThread?.runnable?.type,depth:t.callStack.size()})),
  presentation:j?._awtPresentationStats||null,
  exceptions:s?.runtimeExceptions,
  branches:j&&d?.dump?{synchronousTick:j._tryExecuteSynchronousJitTick.toString(),interpreterTick:j.executeTick.toString()}:null};
})(),(k,v)=>typeof v==='bigint'?v.toString()+'n':v)`;
const r=await(await fetch('http://localhost:9226',{method:'POST',body:JSON.stringify({context:'content',script:'return window.wrappedJSObject.eval('+JSON.stringify(code)+');'})})).json();
if(r[2])throw Error(JSON.stringify(r[2]));
const result=JSON.parse(r[3].value);
if(result.diagnostic?.dump){fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2));console.log('Saved '+process.argv[2]);}
console.log(JSON.stringify({...result,diagnostic:result.diagnostic&&{...result.diagnostic,dump:result.diagnostic.dump&&{reason:result.diagnostic.dump.reason,dropped:result.diagnostic.dump.dropped,last:result.diagnostic.dump.events.slice(-6)}},branches:undefined,exceptions:undefined},null,2));
