#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createReplay}=require('./engine.cjs');
async function main(){
  const [file,classpath,tier='javascript',countText='3',runtimeFile=path.resolve(__dirname,'../../apps/launcher/browser-runtime.json')]=process.argv.slice(2);
  const count=Number(countText);
  if(!file||!classpath||!Number.isInteger(count)||count<1||count>100)
    throw Error('Usage: node tools/guest-replay/run.cjs CAPTURE.json CLASSES_DIR [javascript|wasm|hybrid|interpreter] [1..100] [RUNTIME.json]');
  const bytes=fs.readFileSync(file),artifact=JSON.parse(bytes);
  const manifestBytes=fs.readFileSync(runtimeFile),manifest=JSON.parse(manifestBytes);
  const replay=await createReplay(artifact,{classpath,jvmOptions:manifest.jvmOptions,tier});
  console.log(JSON.stringify({event:'prepared',key:artifact.key,tier,preparationMs:replay.preparationMs,
    preparedMethods:replay.preparedMethods,fixtureSha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    phase:artifact.provenance?.phase||'unattributed',
    runtimeSha256:crypto.createHash('sha256').update(manifestBytes).digest('hex')}));
  for(let i=0;i<count;i++){
    const result=await replay.run({timeoutMs:60000});
    const {pixels,samples,...summary}=result;
    console.log(JSON.stringify({event:'replay',iteration:i,...summary}));
    if(!result.correct){process.exitCode=1;break;}
  }
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
