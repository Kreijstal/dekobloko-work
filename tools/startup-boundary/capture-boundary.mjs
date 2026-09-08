import fs from 'node:fs';
// Read-only: select the existing failed-game tab before invoking this tool.
const code=`JSON.stringify((()=>{
 const s=geobloxSession,j=s.debug.debugController.jvm;
 const field=(owner,key)=>j.classes[owner].staticFields.get(key);
 const receiver=field('qa','field_d:Lch;');
 const ticks=field('tl','field_l:[J');
 return {url:location.href,time:performance.now(),
  tickIndex:field('ij','field_cb:I'),renderIndex:field('fe','field_k:I'),
  requestedTicks:field('nf','field_w:I'),tickRing:ticks,
  focusSource:field('wc','field_g:Z'),focusCopy:field('lh','field_d:Z'),
  receiver:{type:receiver?.type,isLocked:receiver?.isLocked,lockOwner:receiver?.lockOwner,lockCount:receiver?.lockCount},
  shutdownDeadline:field('ka','field_a:J'),obfuscationFlag:field('Geoblox','field_C:I'),
  exceptions:s.runtimeExceptions,presentationStats:j._awtPresentationStats||null,
  threads:j.threads.map(t=>({id:t.id,status:t.status,runnable:t.javaThread?.runnable?.type,
   stack:t.callStack.items.map(f=>({owner:f.className,name:f.method.name,pc:f.pc}))}))};
})(),(k,v)=>typeof v==='bigint'?v.toString()+'n':v)`;
const r=await(await fetch('http://localhost:9226',{method:'POST',body:JSON.stringify({context:'content',script:'return window.wrappedJSObject.eval('+JSON.stringify(code)+');'})})).json();
if(r[2])throw Error(JSON.stringify(r[2]));
fs.writeFileSync(process.argv[2],r[3].value);
console.log(r[3].value);
