import fs from 'node:fs';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: attribute-cpu.mjs PROFILE OUTPUT');
const profile=JSON.parse(fs.readFileSync(input));const reports=[];
function visit(p){
 for(const t of p.threads||[]){
  if(t.name!=='GeckoMain'||!t.stackTable||!t.frameTable)continue;
  const f=t.frameTable.schema,s=t.stackTable.schema,q=t.samples.schema;
  const methods=new Map(),leaves=new Map();let sampledCpuNs=0,guestCpuNs=0,missingDelta=0;
  const add=(map,key,cpu)=>{const row=map.get(key)||{samples:0,cpuNs:0};row.samples++;row.cpuNs+=cpu;map.set(key,row);};
  for(const sample of t.samples.data){
   const raw=sample[q.threadCPUDelta],cpu=Number.isFinite(raw)?raw:0;
   if(!Number.isFinite(raw))missingDelta++;sampledCpuNs+=cpu;
   let stack=sample[q.stack],guest=null,leaf=null;
   while(stack!=null){const e=t.stackTable.data[stack],fr=t.frameTable.data[e[s.frame]];
    const name=t.stringTable[fr[f.location]]||'unknown';
    leaf??=name;
    if(!guest&&name.startsWith('jvm$'))guest=name.split(' (')[0]+'|'+(t.stringTable[fr[f.implementation]]||'unknown');
    stack=e[s.prefix];
   }
   if(guest){add(methods,guest,cpu);guestCpuNs+=cpu;}
   if(leaf)add(leaves,leaf,cpu);
  }
  if(!methods.size)continue;
  const ordered=map=>[...map].map(([name,x])=>({name,...x,cpuMs:x.cpuNs/1e6})).sort((a,b)=>b.cpuNs-a.cpuNs);
  reports.push({pid:t.pid,thread:t.name,samples:t.samples.data.length,missingDelta,
   sampledCpuMs:sampledCpuNs/1e6,nearestGeneratedCpuMs:guestCpuNs/1e6,
   methods:ordered(methods),leaves:ordered(leaves)});
 }
 for(const child of p.processes||[])visit(child);
}
visit(profile);fs.writeFileSync(output,JSON.stringify({diagnosticOnly:true,
 attribution:'Nearest generated method includes native/helper descendants; not exclusive CPU or unprofiled frame time.',reports},null,2));
console.log(JSON.stringify(reports.map(r=>({...r,methods:r.methods.slice(0,12),leaves:r.leaves.slice(0,8)})),null,2));
