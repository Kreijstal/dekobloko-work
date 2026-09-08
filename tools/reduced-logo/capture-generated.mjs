import fs from 'node:fs';
const specs=process.argv[3]==='chain'?[['LogoCallChain','step','(I)V'],['LogoCallChain','triangle','([IIIIIII)V'],['LogoCallChain','submit','([IIIII)V'],['LogoCallChain','span','([IIII)V']]:[['LogoFlatTriangle','draw','(IIII[IIIII)V'],['LogoFlatSpan','draw','(I[IIII)V']];
const code=`(()=>{const j=gapDebug.debugController.jvm;return ${JSON.stringify(specs)}.map(([owner,name,descriptor])=>{
const m=j.findMethod(j.classes[owner],name,descriptor);
const g=j.jit.codegenCache.get(m);
return {owner:owner+'.'+name,properties:Object.fromEntries(Object.entries(g||{}).filter(([k,v])=>['string','number','boolean'].includes(typeof v))),
sites:j.jit.syncCallSites.filter(s=>s?.callerMethod===m).map(s=>({id:s.id,method:s.methodName,owner:s.declaredClassName,
target:s.fastPositional&&{name:s.fastPositional.invoke?.name,flags:Object.keys(s.fastPositional.invoke||{}),source:String(s.fastPositional.invoke)},
resolved:s.fastStaticTarget&&{preferFrameless:s.fastStaticTarget.preferFrameless,rejected:s.fastStaticTarget.framelessRejected}}))};});})()`;
const r=await(await fetch('http://localhost:9226',{method:'POST',body:JSON.stringify({context:'content',script:'return window.wrappedJSObject.eval('+JSON.stringify('JSON.stringify('+code+')')+');'})})).json();
if(r[2])throw Error(JSON.stringify(r[2]));
const data=JSON.parse(r[3].value);fs.writeFileSync(process.argv[2],JSON.stringify(data,null,2));
console.log(data.map(x=>({owner:x.owner,sources:Object.fromEntries(Object.entries(x.properties).filter(([k,v])=>typeof v==='string'&&k.includes('Source')).map(([k,v])=>[k,v.length])),sites:x.sites})));
