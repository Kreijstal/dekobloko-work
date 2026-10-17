#!/usr/bin/env node
// One TeaVM pass. Reuse the existing native measurement and reference hash.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const options={url:'http://127.0.0.1:5188/teavm',output:path.join(os.homedir(),'.cache/dekobloko/intro-comparison.json')};
for(let i=2;i<process.argv.length;i++) {
  const key=process.argv[i].slice(2);
  if(!['url','output'].includes(key)||!process.argv[i+1])throw new Error('Unknown option');
  options[key]=process.argv[++i];
}
(async()=>{
  const previous=JSON.parse(fs.readFileSync(options.output));
  assert.ok(previous.valid&&previous.hotspot?.frames===251,'Existing successful native reference required');
  const manifest=await (await fetch(new URL('/teavm/data.json',options.url))).json();
  assert.deepEqual(manifest.provenance,previous.provenance,'TeaVM must use the measured native source/assets');
  assert.equal(manifest.teavm.readableSourceSha256,manifest.provenance.readableSourceSha256,'TeaVM artifact must match the current source export');
  const {firefox}=require(process.env.PLAYWRIGHT_ROOT||path.join(os.homedir(),'git/java-tools/node_modules/playwright'));
  const started=performance.now();
  const browser=await firefox.launch({headless:false});
  try {
    const page=await browser.newPage({viewport:{width:800,height:600}});
    page.on('console',m=>{if(m.type()==='error')console.error(m.text().slice(0,4000));});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(options.url);
    await page.waitForFunction(()=>['completed','failed'].includes(window.intro?.state),null,{timeout:0,polling:1000});
    const result=await page.evaluate(()=>window.intro);
    assert.equal(result.state,'completed',result.error);assert.deepEqual(errors,[]);
    assert.equal(result.frames,251);assert.equal(result.runtime,'TeaVM Wasm GC');
    assert.equal(result.referenceRgbSha256,previous.provenance.reference.rgbSha256);
    const trials=[...(previous.teavmTrials||(previous.teavm?[previous.teavm]:[]))].slice(-7);
    previous.teavm={...result,firefoxVersion:browser.version(),launchToCompletionMs:performance.now()-started,
      machine:{hostname:os.hostname(),cpu:os.cpus()[0].model},nativeReferenceReused:true,
      animationRatioToHotspot:result.timings.animationMs/previous.hotspot.animationMs};
    previous.teavmTrials=[...trials,previous.teavm];
    fs.writeFileSync(options.output,JSON.stringify(previous,null,2)+'\n');
    console.log(JSON.stringify(previous.teavm,null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
