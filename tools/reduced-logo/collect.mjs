import fs from 'node:fs';
const p=await(await fetch('http://localhost:9226',{method:'POST',body:JSON.stringify({context:'content',script:'return window.wrappedJSObject.eval("JSON.stringify(window.gapResult)");'})})).json();
if(p[2])throw Error(JSON.stringify(p[2]));
const result=JSON.parse(p[3].value);
if(result.state!=='completed'||result.frames.length!==32)throw Error('Run incomplete');
const detailOracle={detail1:-1370228226,detail2:-757457398,detail3:143333580,detail4:2045229082};
const expected=result.mode==='chain'?1619828224:result.mode==='thin4'?2134137715:(detailOracle[result.mode.replace('state','detail').replace('flat','detail').replace('full','detail')]??(result.mode==='mesh'?-402308771:(['extracted','dispatch'].includes(result.mode)?-1026827282:-299842540)));
if(result.checksum!==expected)throw Error('HotSpot checksum mismatch');
const sorted=[...result.frames].sort((a,b)=>a-b);
result.summary={computeAndPublishFps:32000/result.frames.reduce((a,b)=>a+b,0),
 presentedIntervalFps:result.presentedGaps.length*1000/result.presentedGaps.reduce((a,b)=>a+b,0),
 firstFrameMs:result.frames[0],p50Ms:sorted[15],p95Ms:sorted[30],maxMs:sorted[31]};
if(result.performanceAccepted===false)result.summary={verificationOnly:true,exactPixelOracle:result.exactPixelOracle};
fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2));
console.log(JSON.stringify({mode:result.mode,checksum:result.checksum,...result.summary}));
