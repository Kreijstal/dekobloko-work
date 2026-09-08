'use strict';
const {createReplay}=require('./engine.cjs');
const Provider=require('../../../java-tools/src/io/BrowserFileProvider');
const {setFileProvider}=require('../../../java-tools/src/core/classLoader');
async function loadClasses(onProgress=()=>{}) {
  const manifest=await fetch('/classes/index.json').then(r=>r.json());
  const provider=new Provider();let next=0,complete=0;
  await Promise.all(Array.from({length:8},async()=>{
    while(next<manifest.files.length){
      const name=manifest.files[next++];
      const response=await fetch('/classes/'+name);
      if(!response.ok)throw Error('Missing class '+name);
      provider.virtualFS.set(name,new Uint8Array(await response.arrayBuffer()));
      onProgress({completed:++complete,total:manifest.files.length});
    }
  }));
  setFileProvider(provider);return manifest;
}
module.exports={createReplay,loadClasses,...require('./live-capture.cjs')};
