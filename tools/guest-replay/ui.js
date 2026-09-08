'use strict';
const el=id=>document.getElementById(id),cache=new Map(),artifacts=new Map();
let classManifest,lastAudio,audioContext,playing;
const log=row=>{el('results').textContent+=JSON.stringify(row)+'\n';};
async function prepare(mode,tier){
  if(!classManifest)classManifest=await GuestReplay.loadClasses(p=>el('status').textContent=`Loading classes ${p.completed}/${p.total}`);
  if(!artifacts.has(mode)){
    const artifact=await fetch('/captures/'+mode+'.json').then(r=>{if(!r.ok)throw Error('Missing capture');return r.json();});
    if(mode==='visual'&&!(artifact.provenance?.changedNonblackPixels>0))throw Error('Visual fixture lacks verified changed, non-black pixels; recapture it');
    artifacts.set(mode,artifact);
  }
  const key=mode+':'+tier;
  if(!cache.has(key)){
    const manifest=await fetch('/runtime.json').then(r=>r.json());
    el('status').textContent='Preparing '+key;
    const replay=await GuestReplay.createReplay(artifacts.get(mode),{classpath:'/',tier,jvmOptions:manifest.jvmOptions,
      onProgress:p=>el('status').textContent=`Preparing ${key}: ${p.completed}/${p.total}`});
    cache.set(key,replay);
    log({event:'prepared',mode,tier,ms:replay.preparationMs,methods:replay.preparedMethods,classesSha256:classManifest.sha256});
  }
  return cache.get(key);
}
function present(result,artifact){
  if(result.pixels){
    const b=artifact.visualBuffers[0],canvas=el('canvas');canvas.width=b.width;canvas.height=b.height;
    const ctx=canvas.getContext('2d'),image=ctx.createImageData(b.width,b.height);
    result.pixels.forEach((v,i)=>{image.data[i*4]=v>>>16&255;image.data[i*4+1]=v>>>8&255;image.data[i*4+2]=v&255;image.data[i*4+3]=255;});ctx.putImageData(image,0,0);
  }
  if(result.samples){lastAudio={...artifact.audio,samples:result.samples};el('play').disabled=false;}
}
async function runLab({mode=el('mode').value,tier=el('tier').value,count=Number(el('count').value)}={}){
  if(!['audio','visual','combined'].includes(mode)||!Number.isInteger(count)||count<1||count>20)throw Error('Invalid trial request');
  if(document.hidden)throw Error('Keep the Firefox test tab visible');
  if(playing){playing.stop();playing=null;}
  el('run').disabled=true;const rows=[];
  try{
    const modes=mode==='combined'?['audio','visual']:[mode];
    for(const m of modes)await prepare(m,tier);
    for(let i=0;i<count;i++){
      const pair={};
      for(const m of modes){
        el('status').textContent=`Executing ${m}, trial ${i+1}/${count}`;
        const result=await cache.get(m+':'+tier).run({timeoutMs:60000});
        const {pixels,samples,...summary}=result;
        const row={event:'replay',mode:m,trial:i,...summary};rows.push(row);log(row);
        if(!result.correct)throw Error('Output/state mismatch: timing is not accepted');
        pair[m]=result;present(result,artifacts.get(m));
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(mode==='combined'){
        const audioDemand=pair.audio.executionMs/pair.audio.deadlineMs;
        const visualDemand=pair.visual.executionMs/(1000/24);
        log({event:'combined-budget',trial:i,audioCpuFraction:audioDemand,visualCpuFraction:visualDemand,
          combinedCpuFraction:audioDemand+visualDemand,withinSingleThreadBudget:audioDemand+visualDemand<=1,
          scope:'isolated execution demand; not end-to-end FPS; reset/verification excluded'});
      }
    }
    el('status').textContent='Done. Every reported successful trial matched captured outputs and receiver state.';
    return rows;
  }finally{el('run').disabled=false;}
}
el('run').onclick=()=>runLab().catch(e=>{el('status').textContent=String(e);log({error:String(e)});});
el('play').onclick=()=>{
  if(playing){playing.stop();playing=null;el('play').textContent='Play captured audio block';return;}
  audioContext ||= new AudioContext();audioContext.resume();
  const a=lastAudio,channels=a.samples.length/a.frames;
  const buffer=audioContext.createBuffer(channels,a.frames,a.sampleRate);
  for(let c=0;c<channels;c++){const out=buffer.getChannelData(c);for(let i=0;i<a.frames;i++)out[i]=Math.max(-1,Math.min(1,a.samples[(i+a.offset)*channels+c]/8388608));}
  playing=audioContext.createBufferSource();playing.buffer=buffer;playing.loop=true;
  playing.connect(audioContext.destination);playing.start();el('play').textContent='Stop audio';
};
window.guestReplayLab={run:runLab};
