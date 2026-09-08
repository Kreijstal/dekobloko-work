import fs from 'node:fs';
const output=process.argv[2];
for(let i=0;i<60;i++){
 const code="JSON.stringify(window.boundaryResult||{},(k,v)=>typeof v==='bigint'?v.toString()+'n':v)";
 const r=await(await fetch('http://localhost:9226',{method:'POST',body:JSON.stringify({context:'content',script:'return window.wrappedJSObject.eval('+JSON.stringify(code)+');'})})).json();
 if(r[2])throw Error(JSON.stringify(r[2]));const x=JSON.parse(r[3].value);
 if(['observed','failed'].includes(x.state)){
  fs.writeFileSync(output,JSON.stringify(x,null,2));
  console.log(JSON.stringify({...x,trace:x.trace?.slice(-8),generated:x.generated?.map(g=>({owner:g.owner,name:g.name,structured:g.structured,variants:Object.keys(g.variants)}))},null,2));break;
 }
 await new Promise(r=>setTimeout(r,1000));
}
