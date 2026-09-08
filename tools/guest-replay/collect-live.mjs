import fs from 'node:fs';
import crypto from 'node:crypto';
const code='JSON.stringify({state:window.phaseCapture?.state,error:window.phaseCapture?.error,artifact:window.phaseCapture?.artifact})';
const p=await(await fetch('http://localhost:9226',{method:'POST',body:JSON.stringify({
 context:'content',script:'return window.wrappedJSObject.eval('+JSON.stringify(code)+');'})})).json();
if(p[2])throw Error(JSON.stringify(p[2]));
const capture=JSON.parse(p[3].value);
if(capture.state!=='completed')throw Error(JSON.stringify({state:capture.state,error:capture.error}));
const data=JSON.stringify(capture.artifact);fs.writeFileSync(process.argv[2],data);
console.log(JSON.stringify({file:process.argv[2],bytes:data.length,
 sha256:crypto.createHash('sha256').update(data).digest('hex'),provenance:capture.artifact.provenance}));
