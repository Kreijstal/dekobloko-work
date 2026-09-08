import fs from 'node:fs';

// Attribute each sample to its nearest generated JavaScript frame. This is
// not exclusive method time: native/helper descendants can be above it.
// Preserve unknown implementations; do not infer an engine tier from a name.
const profile=JSON.parse(fs.readFileSync(process.argv[2]));
function walk(profile){
 for(const thread of profile.threads||[]){
  if(!thread.stringTable?.some(s=>s.includes('jvm$')))continue;
  const f=thread.frameTable.schema,s=thread.stackTable.schema;
  const tiers=new Map(),methods=new Map();let attributed=0;
  for(const sample of thread.samples.data){
   let stack=sample[thread.samples.schema.stack];
   while(stack!=null){
    const entry=thread.stackTable.data[stack];
    const frame=thread.frameTable.data[entry[s.frame]];
    const name=thread.stringTable[frame[f.location]];
    if(name.includes('jvm$')){
     const tier=thread.stringTable[frame[f.implementation]]||'unknown';
     const key=name.split(' (')[0]+'|'+tier;
     tiers.set(tier,(tiers.get(tier)||0)+1);
     methods.set(key,(methods.get(key)||0)+1);attributed++;break;
    }
    stack=entry[s.prefix];
   }
  }
  console.log(JSON.stringify({pid:thread.pid,thread:thread.name,
   totalSamples:thread.samples.data.length,attributedSamples:attributed,
   nearestGeneratedTierSamples:Object.fromEntries(tiers),
   methods:[...methods].sort((a,b)=>b[1]-a[1]).slice(0,30)},null,2));
 }
 for(const child of profile.processes||[])walk(child);
}
walk(profile);
