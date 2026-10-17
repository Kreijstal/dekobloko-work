#!/usr/bin/env node
// Run on the visible X11 desktop being measured, one runtime at a time.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile);
const options={url:'http://127.0.0.1:5188/',seconds:30,
  player:path.join(os.homedir(),'.cache/dekobloko/geoblox-intro')};
for(let i=2;i<process.argv.length;i++){
  const key=process.argv[i].slice(2);
  if(!['url','seconds','player','output'].includes(key)||!process.argv[i+1])throw new Error('Unknown option: '+process.argv[i]);
  options[key]=key==='seconds'?Number(process.argv[++i]):process.argv[++i];
}
assert.ok(options.seconds>=2);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function observe(){
  const {stdout}=await exec('python3',[path.join(__dirname,'observe-x11.py'),'--seconds',String(options.seconds)],{maxBuffer:1024*1024});
  return JSON.parse(stdout);
}
async function main(){
  if(options.output)fs.writeFileSync(options.output,JSON.stringify({state:'running',valid:false})+'\n');
  const {firefox}=require(process.env.PLAYWRIGHT_ROOT||path.join(os.homedir(),'git/java-tools/node_modules/playwright'));
  const nativeReceipt=JSON.parse(fs.readFileSync(path.join(options.player,'provenance.json')));
  assert.ok(nativeReceipt.checked&&nativeReceipt.reference,'Build the player with --check first');
  const data=await (await fetch(new URL('/data.json',options.url))).json();
  assert.deepEqual(data.provenance,nativeReceipt,'Browser and native player must have identical build provenance');
  const report={workload:'Original GeoBlox Jagex intro; 640x480; fixed 20ms ticks; two warmup cycles',
    cpuSlowdown:1,provenance:nativeReceipt,runtimeSha256:data.runtimeSha256,jvmOptions:data.jvmOptions,
    machine:{hostname:os.hostname(),cpu:os.cpus()[0].model,platform:os.release()},
    note:'X11-visible frame IDs, not physical-panel scanout. Diagnostic run, not browser release acceptance.'};
  let browser;
  try{
    browser=await firefox.launch({headless:false});
    report.firefoxVersion=browser.version();
    const page=await browser.newPage({viewport:{width:800,height:600}});
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('console',message=>{if(message.type()==='error')console.error(message.text().slice(0,2000));});
    const url=new URL(options.url);url.searchParams.set('measure','');
    await page.goto(url.href);
    for(let iteration=0;;iteration++){
      await pause(1000);
      const state=await page.evaluate(()=>({state:window.intro?.state,frames:window.intro?.submissions.length,error:window.intro?.error}));
      if(iteration%10===0)console.error('Firefox',JSON.stringify(state));
      if(state.state==='failed'||errors.length)throw new Error(state.error||errors.join('\n'));
      if(state.frames>=502)break;
    }
    await page.bringToFront();
    const {stdout:firefoxWindows}=await exec('xdotool',['search','--onlyvisible','--name','^Jagex Intro · Firefox JVM']);
    const firefoxWindow=firefoxWindows.trim().split('\n')[0];
    await exec('xdotool',['windowactivate','--sync',firefoxWindow]);
    await exec('xdotool',['windowraise',firefoxWindow]);
    await exec('xdotool',['windowstate','--add','ABOVE',firefoxWindow]);
    report.firefoxSurface=await page.evaluate(()=>{
      const canvas=document.querySelector('canvas'),box=canvas.getBoundingClientRect();
      return {screen:[window.mozInnerScreenX,window.mozInnerScreenY],dpr:devicePixelRatio,
        canvas:[box.x,box.y,box.width,box.height],marker:[...canvas.getContext('2d').getImageData(0,0,4,1).data]};
    });
    console.error('Firefox surface',JSON.stringify(report.firefoxSurface));
    console.error('Observing Firefox for '+options.seconds+' seconds');
    report.firefox=await observe();
    report.firefox.referenceRgbSha256=await page.evaluate(()=>window.intro.referenceRgbSha256);
    report.firefox.userAgent=await page.evaluate(()=>navigator.userAgent);
    console.error('Firefox',JSON.stringify(report.firefox));
  }finally{if(browser)await browser.close();}
  console.error('Warming HotSpot for two cycles');
  const native=spawn(path.join(options.player,'run.sh'),['--measure'],{stdio:['ignore','pipe','pipe']});
  let nativeLog='',nativeError='';
  native.stdout.on('data',data=>{nativeLog+=data;});
  native.stderr.on('data',data=>{nativeError+=data;});
  let spawnError;native.on('error',error=>{spawnError=error;});
  try{
    while(!nativeLog.includes('INTRO READY')){
      if(spawnError)throw spawnError;
      if(native.exitCode!==null)throw new Error('HotSpot stopped: '+nativeError);
      await pause(200);
    }
    await pause(11000);
    const {stdout}=await exec('xdotool',['search','--pid',String(native.pid),'--name','^Jagex Intro$']);
    await exec('xdotool',['windowactivate','--sync',stdout.trim().split('\n')[0]]);
    await exec('xdotool',['windowstate','--add','ABOVE',stdout.trim().split('\n')[0]]);
    console.error('Observing HotSpot for '+options.seconds+' seconds');
    report.hotspot=await observe();
    const java=fs.realpathSync('/proc/'+native.pid+'/exe');
    report.hotspot.javaVersion=(await exec(java,['-version'])).stderr.trim();
    report.hotspot.stderr=nativeError;
    report.hotspot.command=path.join(options.player,'run.sh')+' --measure';
    console.error('HotSpot',JSON.stringify(report.hotspot));
  }finally{native.kill('SIGTERM');}
  report.valid=report.firefox.valid&&report.hotspot.valid;
  const result=JSON.stringify(report,null,2)+'\n';
  if(options.output)fs.writeFileSync(options.output,result);
  process.stdout.write(result);
}
main().catch(error=>{
  if(options.output)fs.writeFileSync(options.output,JSON.stringify({state:'failed',valid:false,error:String(error.stack||error)},null,2)+'\n');
  console.error(error.stack||error);process.exitCode=1;
});
