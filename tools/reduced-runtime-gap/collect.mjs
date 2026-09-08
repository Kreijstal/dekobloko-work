import fs from 'node:fs';
const code=`JSON.stringify((()=>{const r=window.gapResult,j=gapDebug.debugController.jvm;
 const a=j.classes.ReducedGapApplet.staticFields.get('frameNanos:[J');
 return {...r,frames:Array.from(a.data||a.elements||a.items||a,n=>Number(n)/1e6)};})())`;
const p=await(await fetch('http://localhost:9226',{method:'POST',body:JSON.stringify({
 context:'content',script:'return window.wrappedJSObject.eval('+JSON.stringify(code)+');'})})).json();
if(p[2])throw Error(JSON.stringify(p[2]));
const result=JSON.parse(p[3].value);
if(result.state!=='completed'||result.frames.length!==24)throw Error('Run incomplete');
const sorted=[...result.frames].sort((a,b)=>a-b);
result.summary={computeAndPublishFps:24000/result.frames.reduce((a,b)=>a+b,0),
 presentedFps:1000*result.presentedGaps.length/result.presentedGaps.reduce((a,b)=>a+b,0),
 firstFrameMs:result.frames[0],p50Ms:sorted[11],p95Ms:sorted[22],maxMs:sorted[23]};
fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2));
console.log(JSON.stringify({mode:result.mode,checksum:result.checksum,...result.summary}));
