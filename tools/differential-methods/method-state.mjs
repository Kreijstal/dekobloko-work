import fs from 'node:fs';
import path from 'node:path';
import {page} from './capture.mjs';
const out=process.argv[2];
const snapshot=await page(`JSON.stringify((()=>{
 const j=window.diffDebug.debugController.jvm;
 return window.diffResult.pin.manifest.spec.targets.map(key=>{
  const dot=key.indexOf('.'),paren=key.indexOf('('),owner=key.slice(0,dot),name=key.slice(dot+1,paren),descriptor=key.slice(paren);
  const method=j.classes[owner].ast.classes[0].items.find(i=>i.method?.name===name&&i.method?.descriptor===descriptor)?.method;
  if(!method)return {key,missing:true};
  const wasm=j.jit.wasmJit.state.get(method),generated=j.jit.codegenCache.get(method);
  const scalars=o=>Object.fromEntries(Object.entries(o||{}).filter(([k,v])=>(typeof v==='string'&&v.length<300)||typeof v==='number'||typeof v==='boolean'));
  return {key,invocationsObserved:j.jit.invocationCounts.get(method)||0,wasm:scalars(wasm),generated:scalars(generated),compiledFunctionProperties:typeof generated==='function'?Object.keys(generated):null};
 });
})())`);
fs.writeFileSync(path.join(out,'method-state.json'),snapshot);
console.log(JSON.parse(snapshot).map(m=>({key:m.key,invocationsObserved:m.invocationsObserved,wasm:m.wasm,source:m.generated?.jvmSourceUrl})));
