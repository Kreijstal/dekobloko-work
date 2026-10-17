#!/usr/bin/env node
// One fresh JVM and one intro pass per host. No warmup, loop or FPS probe.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');

const options = {url:'http://127.0.0.1:5188/',
  player:path.join(os.homedir(),'.cache/dekobloko/geoblox-intro')};
for (let i=2;i<process.argv.length;i++) {
  const key=process.argv[i].slice(2);
  if(key==='reuse-native'){options.reuseNative=true;continue;}
  if (!['url','player','output'].includes(key)||!process.argv[i+1]) throw new Error('Unknown option: '+process.argv[i]);
  options[key]=process.argv[++i];
}

async function main() {
  let baseline,previous;
  if(options.output&&fs.existsSync(options.output)){
    previous=JSON.parse(fs.readFileSync(options.output));
    baseline=previous.baseline??(previous.valid&&!previous.firefox?.aot?previous:undefined);
  }
  if(options.reuseNative)assert.ok(previous?.valid&&previous.hotspot?.frames===251,
    '--reuse-native requires an existing valid --output report');
  const {firefox}=require(process.env.PLAYWRIGHT_ROOT||path.join(os.homedir(),'git/java-tools/node_modules/playwright'));
  const provenance=JSON.parse(fs.readFileSync(path.join(options.player,'provenance.json')));
  assert.ok(provenance.checked,'Build the player with --check first');
  const data=await (await fetch(new URL('/data.json',options.url))).json();
  assert.deepEqual(data.provenance,provenance,'Both hosts must use identical build provenance');
  if(options.reuseNative)assert.deepEqual(previous.provenance,provenance,'Saved native reference must use identical source/assets');
  const classes=[];
  function visit(directory,prefix='') {
    for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const name=prefix+entry.name,file=path.join(directory,entry.name);
      if(entry.isDirectory())visit(file,name+'/');
      else if(name.endsWith('.class'))classes.push({filename:name,content:fs.readFileSync(file).toString('base64')});
    }
  }
  const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
  visit(path.join(options.player,'classes'));
  assert.equal(sha256(JSON.stringify(classes)),data.sourceSha256,'Both hosts must use identical class bytes');
  for(const [name,hash] of Object.entries(provenance.assets)) {
    assert.equal(sha256(fs.readFileSync(path.join(options.player,'assets',name))),hash,'Asset differs: '+name);
  }
  const report={workload:'One pass, ticks 0–250, 640x480, nominal 20ms cadence; no warmup or replay',
    provenance,runtimeSha256:data.runtimeSha256,
    jvmOptions:data.jvmOptions,baseline,
    ...(options.reuseNative?{nativeReferenceReused:true,teavm:previous.teavm,teavmTrials:previous.teavmTrials,
      jvmTrials:[...(previous.jvmTrials||[previous.firefox])].slice(-7)}:{}),
    machine:{hostname:os.hostname(),cpu:os.cpus()[0].model,platform:os.release()},
    note:'Average render throughput is 251 / animation seconds, not a presented-frame measurement. Both runs are silent.'};
  let browser;
  try {
    const launchStarted=performance.now();
    browser=await firefox.launch({headless:false});
    report.firefoxVersion=browser.version();
    const page=await browser.newPage({viewport:{width:800,height:600}});
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('console',message=>{if(message.type()==='error')console.error(message.text().slice(0,2000));});
    const url=new URL(options.url);url.search='';
    await page.goto(url.href);
    await page.waitForFunction(()=>['completed','failed'].includes(window.intro?.state),null,{timeout:0,polling:1000});
    const result=await page.evaluate(()=>({state:window.intro.state,error:window.intro.error,timings:window.intro.timings,aot:window.intro.aot,jvmOptions:window.intro.jvmOptions,referenceRgbSha256:window.intro.referenceRgbSha256}));
    assert.equal(result.state,'completed',result.error);
    report.jvmOptions=result.jvmOptions;
    assert.deepEqual(errors,[]);
    assert.equal(result.referenceRgbSha256,provenance.reference.rgbSha256,'Saved native image hash must match');
    report.firefox={...result.timings,aot:result.aot,jvmOptions:result.jvmOptions,
      measuredAt:new Date().toISOString(),referenceRgbSha256:result.referenceRgbSha256,
      launchToJavaReturnMs:performance.now()-launchStarted};
    console.error('Firefox completed one pass:',JSON.stringify(report.firefox));
  } finally {if(browser)await browser.close();}

  if(options.reuseNative)report.hotspot=previous.hotspot;
  else {
    const launchStarted=performance.now();
    const native=spawn(path.join(options.player,'run.sh'),['--silent'],{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    native.stdout.on('data',data=>{stdout+=data;});
    native.stderr.on('data',data=>{stderr+=data;});
    try {
      await new Promise((resolve,reject)=>{
        native.once('error',reject);
        native.once('close',(code,signal)=>code===0?resolve():reject(new Error('HotSpot stopped: '+code+' '+signal+' '+stderr)));
      });
      const match=stdout.match(/INTRO FINISHED frames=(\d+) animationNanos=(\d+) totalNanos=(\d+)/);
      assert.ok(match,'HotSpot did not finish the intro');
      report.hotspot={frames:Number(match[1]),animationMs:Number(match[2])/1e6,
        javaEntryMs:Number(match[3])/1e6,processWallMs:performance.now()-launchStarted,stderr};
    } finally {if(native.exitCode===null)native.kill('SIGTERM');}
  }
  if(report.jvmTrials)report.jvmTrials.push(report.firefox);
  for(const host of [report.firefox,report.hotspot]) {
    assert.equal(host.frames,251,'Each JVM must stop after exactly one pass');
    host.derivedAverageRenderFps=host.frames/(host.animationMs/1000);
  }
  report.valid=true;
  const json=JSON.stringify(report,null,2)+'\n';
  if(options.output)fs.writeFileSync(options.output,json);
  process.stdout.write(json);
}
main().catch(error=>{
  console.error(error.stack||error);process.exitCode=1;
});
