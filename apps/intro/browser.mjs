import {configureIntro,installIntroNatives} from '/intro/runtime.mjs';
import {decodeCodePack,codePackIdentity,sameIdentity,createCodePackStore,installCodePack} from '/launcher/browser-loader/code-pack.mjs';
import {copyRgbToRgba} from '/pixels.mjs';

const canvas=document.querySelector('canvas');
const context=canvas.getContext('2d',{alpha:false});
const image=context.createImageData(640,480);
const rgba=image.data;
const stats=window.intro={state:'preparing',frames:0,provenance:null,runtimeSha256:null};
const verifyColours=new URLSearchParams(location.search).has('verify');
let referenceRgba=null;
try {
  const data=await (await fetch('/data.json')).json();
  stats.provenance=data.provenance;stats.runtimeSha256=data.runtimeSha256;
  const assets=new Map(await Promise.all(Object.keys(data.provenance.assets).map(async name=>{
    const response=await fetch('/assets/'+name);
    if(!response.ok)throw new Error('Missing intro asset: '+name);
    return [name,new Int8Array(await response.arrayBuffer())];
  })));
  const debug=new window.JVMDebug.BrowserJVMDebug();
  window.introDebug=debug;
  await debug.initialize({dataPackage:{classes:data.classes}});
  data.classes=null; // The class provider now owns the decoded bytes.
  const controller=debug.debugController;
  configureIntro(controller,data.jvmOptions);
  stats.jvmOptions={...data.jvmOptions,prepareBeforeMain:true,jit:controller.options.jit};
  const response=await fetch('/intro.aot');
  if(!response.ok)throw new Error('Build the intro AOT artifact before playing');
  let pack=decodeCodePack(await response.arrayBuffer());
  const identity=codePackIdentity({runtimeVersion:data.runtimeSha256,
    jarVersion:data.sourceSha256+':'+data.integrationSha256,options:controller.options});
  if(!sameIdentity(identity,pack.identity))throw new Error('Intro AOT artifact is stale; rebuild it');
  const store=createCodePackStore('replay',pack);
  pack=null;
  stats.aot={bytes:Number(response.headers.get('Content-Length')),identity};
  let next=0;
  stats.runStartedAt=performance.now();
  stats.run=debug.run('GeobloxIntro$Browser',{args:['/intro'],beforeRun:({jvm})=>{
    installCodePack(jvm,{identity,store,onReport:(result,cache)=>{
      stats.aot={...stats.aot,preparationMs:performance.now()-stats.runStartedAt,report:result.report,cache};
      const prepared=result.report.preparedCache;
      if(!prepared||prepared.misses||prepared.refused||prepared.errors)throw new Error('Incomplete intro AOT replay');
    }});
    installIntroNatives(jvm,{
      asset:name=>{
        if(!assets.has(name))throw new Error('Non-intro asset: '+name);
        return assets.get(name);
      },
      present:async (pixels,tick)=>{
        if(tick!==stats.frames)throw new Error('Intro tick skipped or repeated: '+tick);
        const now=performance.now();
        if(!next)next=now;
        copyRgbToRgba(pixels,rgba);
        context.putImageData(image,0,0);
        const reference=data.provenance.reference;
        if(reference&&tick===reference.tick){
          referenceRgba=verifyColours?context.getImageData(0,0,640,480).data:rgba.slice();
        }
        stats.state='playing';
        stats.frames++;
        next+=20;const delay=next-performance.now();
        if(delay < -200)next=performance.now();
        await new Promise(resolve=>setTimeout(resolve,Math.max(0,delay)));
      },
    });
  }});
  await stats.run;
  const fields=controller.jvm.classes.GeobloxIntro.staticFields;
  stats.timings={frames:Number(fields.get('framesRendered:I')),
    animationMs:Number(fields.get('animationElapsedNanos:J'))/1e6,
    javaEntryMs:Number(fields.get('totalElapsedNanos:J'))/1e6,
    javaRunMs:performance.now()-stats.runStartedAt};
  if(stats.frames!==251||stats.timings.frames!==251)throw new Error('Incomplete intro');
  stats.aot.execution=controller.jvm.jit.syncCompileCensus();
  const reference=data.provenance.reference;
  if(reference){
    if(!referenceRgba)throw new Error('Reference frame was not produced');
    const rgb=new Uint8Array((referenceRgba.length/4-reference.skipPixels)*3);
    for(let i=reference.skipPixels*4,p=0;i<referenceRgba.length;i+=4){
      rgb[p++]=referenceRgba[i];rgb[p++]=referenceRgba[i+1];rgb[p++]=referenceRgba[i+2];
    }
    stats.referenceRgbSha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',rgb))]
      .map(value=>value.toString(16).padStart(2,'0')).join('');
    if(stats.referenceRgbSha256!==reference.rgbSha256)throw new Error('Firefox colours/geometry differ from the native reference frame: '+stats.referenceRgbSha256);
  }
  stats.state='completed';
} catch(error) {
  stats.state='failed';
  const seen=new WeakSet();
  const describe=value=>JSON.stringify(value,(_key,item)=>{
    if(typeof item==='bigint')return String(item);
    if(item instanceof Map)return Object.fromEntries(item);
    if(item&&typeof item==='object'){
      if(seen.has(item))return '[circular]';seen.add(item);
    }
    return item;
  });
  stats.error=String(error.message||error)+'\n'+describe(error.cause??error);
  console.error(stats.error);
}
