import fs from 'node:fs';
const code=`JSON.stringify((()=>{
 const j=geobloxSession.debug.debugController.jvm,m=j.findMethod(j.classes.jb,'f','()Z'),g=j.jit.codegenCache.get(m);
 return {owner:'jb',name:m.name,descriptor:m.descriptor,code:j.jit.getCodeItems(m),
 generated:Object.fromEntries(Object.entries(g).map(([k,v])=>[k,typeof v==='function'?{name:v.name,source:v.jvmGeneratedSource||v.toString()}:v])),
 dispatch:j.dispatchExceptionInFrame.toString()};
})(),(k,v)=>typeof v==='bigint'?v.toString()+'n':v)`;
const r=await(await fetch('http://localhost:9226',{method:'POST',body:JSON.stringify({context:'content',script:'return window.wrappedJSObject.eval('+JSON.stringify(code)+');'})})).json();
if(r[2])throw Error(JSON.stringify(r[2]));fs.writeFileSync(process.argv[2],r[3].value);
console.log(process.argv[2]);
