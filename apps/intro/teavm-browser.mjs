const stats=window.intro={state:'preparing',frames:0,runtime:'TeaVM Wasm GC'};
try {
  const entryStarted=performance.now();
  const data=await (await fetch('/teavm/data.json')).json();
  stats.provenance=data.provenance;stats.compiler=data.teavm;
  const assets=Object.fromEntries(await Promise.all(['255-10.bin','10-2.bin','10-3.bin'].map(async name=>{
    const response=await fetch('/assets/'+name);
    if(!response.ok)throw new Error('Missing asset: '+name);
    return [name,new Int8Array(await response.arrayBuffer())];
  })));
  globalThis.teavmAssets=assets;
  const container=assets['10-3.bin'];
  const view=new DataView(container.buffer,container.byteOffset,container.byteLength);
  const packedLength=view.getUint32(1,false);
  if(container[0]!==2)throw new Error('Expected gzip JS5 image container');
  const jpeg=new Uint8Array(await new Response(new Blob([container.subarray(9,9+packedLength)]).stream()
    .pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const bitmap=await createImageBitmap(new Blob([jpeg]),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
  const decodeCanvas=new OffscreenCanvas(bitmap.width,bitmap.height);
  const decodeContext=decodeCanvas.getContext('2d');decodeContext.drawImage(bitmap,0,0);
  const decoded=decodeContext.getImageData(0,0,bitmap.width,bitmap.height).data;
  const imagePixels=new Int32Array(2+bitmap.width*bitmap.height);
  imagePixels[0]=bitmap.width;imagePixels[1]=bitmap.height;bitmap.close();
  for(let i=2,p=0;i<imagePixels.length;i++,p+=4)
    imagePixels[i]=(decoded[p+3]<<24)|(decoded[p]<<16)|(decoded[p+1]<<8)|decoded[p+2];
  globalThis.teavmDecodeImage=bytes=>{
    if(bytes.length!==jpeg.length)throw new Error('Unexpected image');
    for(let i=0;i<bytes.length;i++)if((bytes[i]&255)!==jpeg[i])throw new Error('Image input differs');
    return imagePixels;
  };
  const context=document.querySelector('canvas').getContext('2d',{alpha:false});
  const image=context.createImageData(640,480);
  let referenceRgba=null,presented=0;
  globalThis.teavmPresent=buffer=>{
    const rgba=new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength);
    if(rgba.length!==640*480*4)throw new Error('Wrong TeaVM framebuffer size');
    image.data.set(rgba);context.putImageData(image,0,0);
    if(presented===data.provenance.reference.tick)referenceRgba=rgba.slice();
    presented++;
  };
  const loadStarted=performance.now();
  const module=await TeaVM.wasmGC.load('/teavm/intro.wasm');
  stats.moduleLoadMs=performance.now()-loadStarted;
  const javaStarted=performance.now();
  await module.exports.main([]);
  stats.setupMs=performance.now()-javaStarted;
  const started=performance.now();let next=started;
  stats.state='playing';
  for(let tick=0;tick<=250;tick++) {
    const frames=module.exports.render(tick);
    if(frames!==tick+1||presented!==tick+1)throw new Error('TeaVM skipped/repeated a frame');
    stats.frames=frames;
    next+=20;const delay=next-performance.now();
    if(delay < -200)next=performance.now();
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,delay)));
  }
  stats.timings={frames:stats.frames,animationMs:performance.now()-started,
    javaEntryMs:performance.now()-javaStarted,launchToJavaReturnMs:performance.now()-entryStarted};
  // Reuse the stored reference; hash the captured frame after timing stops.
  if(!referenceRgba)throw new Error('Reference frame was not produced');
  const rgb=new Uint8Array(640*480*3);
  for(let i=0,p=0;i<referenceRgba.length;i+=4){rgb[p++]=referenceRgba[i];rgb[p++]=referenceRgba[i+1];rgb[p++]=referenceRgba[i+2];}
  stats.referenceRgbSha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',rgb))]
    .map(value=>value.toString(16).padStart(2,'0')).join('');
  if(stats.referenceRgbSha256!==data.provenance.reference.rgbSha256)throw new Error('TeaVM reference image differs: '+stats.referenceRgbSha256);
  stats.state='completed';
} catch(error) {
  stats.state='failed';stats.error=String(error)+'\n'+String(error.stack||'');console.error(stats.error);
}
