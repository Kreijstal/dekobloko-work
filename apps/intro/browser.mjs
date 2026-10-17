import {installBrowserImageDecoder} from '/decoder.mjs';
import {installBrowserInflater} from '/inflater.mjs';
import {copyRgbToRgba} from '/pixels.mjs';

const canvas=document.querySelector('canvas');
const context=canvas.getContext('2d',{alpha:false});
const image=context.createImageData(640,480);
const rgba=image.data;
const stats=window.intro={state:'preparing',submissions:[],ticks:[],provenance:null,runtimeSha256:null};
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
  const {jit,...runtimeOptions}=data.jvmOptions;
  Object.assign(controller.options,runtimeOptions);
  controller.options.jit={...controller.options.jit,...jit};
  stats.jvmOptions=data.jvmOptions;
  let next=0;
  const args=['/intro','--browser'];
  if(new URLSearchParams(location.search).has('measure'))args.push('--measure');
  stats.run=debug.run('GeobloxIntro',{args,beforeRun:({jvm})=>{
    installBrowserImageDecoder(jvm);
    const decompress=async (bytes,format)=>new Uint8Array(await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format))).arrayBuffer());
    installBrowserInflater(jvm,{inflate:bytes=>decompress(bytes,'deflate'),
      inflateRaw:bytes=>decompress(bytes,'deflate-raw')});
    jvm.jre.GeobloxIntro={applicationFallback:true,staticMethods:{
      'browserAsset(Ljava/lang/String;)[B':(_jvm,_object,args)=>{
        const name=String(args[0]?.value??args[0]);
        if(!assets.has(name))throw new Error('Non-intro asset: '+name);
        return assets.get(name);
      },
      'browserPresent([II)V':async (_jvm,_object,[pixels,tick])=>{
        const now=performance.now();
        if(!next)next=now;
        copyRgbToRgba(pixels,rgba);
        context.putImageData(image,0,0);
        const reference=data.provenance.reference;
        if(reference&&tick===reference.tick&&!stats.referenceRgbSha256){
          const actual=context.getImageData(0,0,640,480).data;
          const rgb=new Uint8Array((pixels.length-reference.skipPixels)*3);
          for(let i=reference.skipPixels,p=0;i<pixels.length;i++){
            rgb[p++]=actual[i*4];rgb[p++]=actual[i*4+1];rgb[p++]=actual[i*4+2];
          }
          stats.referenceRgbSha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',rgb))]
            .map(value=>value.toString(16).padStart(2,'0')).join('');
          if(stats.referenceRgbSha256!==reference.rgbSha256)throw new Error('Firefox colours/geometry differ from the native reference frame: '+stats.referenceRgbSha256);
        }
        stats.state='playing';
        if(stats.submissions.length<100000){stats.submissions.push(performance.now());stats.ticks.push(tick);}
        next+=20;const delay=next-performance.now();
        if(delay < -200)next=performance.now();
        await new Promise(resolve=>setTimeout(resolve,Math.max(0,delay)));
      },
    }};
  }});
  await stats.run;
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
