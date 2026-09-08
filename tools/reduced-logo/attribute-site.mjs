import fs from 'node:fs';
const dir=process.argv[2];
if(!dir)throw Error('Usage: node attribute-site.mjs PROFILE_DIRECTORY');
const profile=JSON.parse(fs.readFileSync(dir+'/profile.json'));
const metadata=JSON.parse(fs.readFileSync(dir+'/metadata.json'));
const triangle=metadata.methods.find(m=>m.owner==='LogoFlatTriangle');
const bodies=new Map(Object.values(triangle.bodies).filter(b=>b.name&&b.source).map(b=>[b.name,b]));
const report=[];
function walk(p){
  for(const t of p.threads||[]){
    if(!t.stringTable?.some(s=>s.includes('$LogoFlatTriangle$')))continue;
    const f=t.frameTable.schema,s=t.stackTable.schema,q=t.samples.schema;
    const rows=new Map();
    const add=(key,delta)=>{const r=rows.get(key)||{samples:0,cpuDelta:0};r.samples++;r.cpuDelta+=Number.isFinite(delta)?delta:0;rows.set(key,r);};
    const frameInfo=frame=>{
      const location=t.stringTable[frame[f.location]]||'';
      return {location,name:location.split(' (')[0],line:frame[f.line],column:frame[f.column],tier:t.stringTable[frame[f.implementation]]||'unknown'};
    };
    const siteAt=frame=>{
      const b=bodies.get(frame.name);
      const functionLine=Number(frame.location.match(/Function:(\d+):\d+/)?.[1]);
      if(!b||!functionLine||!frame.line)return {pc:'unmapped',line:frame.line};
      // Function body starts on the line after the function declaration;
      // generatedSource starts at its first body line.
      const sourceLine=frame.line-functionLine;
      const before=b.source.split('\n').slice(0,sourceLine-1).join('\n').length+(sourceLine>1?1:0);
      for(const site of triangle.sites||[]){
        if(site.owner!=='LogoFlatSpan')continue;
        const open='/*'+site.markers?.start+'*/',close='/*'+site.markers?.end+'*/';
        const lo=b.source.indexOf(open),hi=b.source.indexOf(close,lo);
        if(lo>=0&&hi>=lo&&before>=lo&&before<=hi+close.length)return {pc:site.pc,line:sourceLine};
      }
      return {pc:'outside-marked-call',line:sourceLine};
    };
    const examples={};
    for(const sample of t.samples.data){
      const frames=[];let stack=sample[q.stack];
      while(stack!=null){const e=t.stackTable.data[stack];frames.push(frameInfo(t.frameTable.data[e[s.frame]]));stack=e[s.prefix];}
      const delta=sample[q.threadCPUDelta];
      const nearest=frames.find(x=>x.name.startsWith('jvm$'));
      if(nearest)add('nearest/'+nearest.name+'|'+nearest.tier,delta);
      const callerIndex=frames.findIndex(x=>x.name.includes('$LogoFlatTriangle$'));
      if(callerIndex<0)continue;
      const caller=frames[callerIndex],site=siteAt(caller);
      add('caller-inclusive/'+caller.name+'|'+caller.tier,delta);
      if(nearest===caller)add('caller-nearest/'+caller.name+'|'+caller.tier,delta);
      if(typeof site.pc==='number') {
        add('site-inclusive/'+caller.name+'|pc='+site.pc+'|'+caller.tier,delta);
        if(nearest===caller)add('site-nearest/'+caller.name+'|pc='+site.pc+'|'+caller.tier,delta);
      }
      const spanIndex=frames.findIndex(x=>x.name.includes('$LogoFlatSpan$'));
      if(spanIndex>=0&&spanIndex<callerIndex){
        const key='span-under-caller/'+caller.name+'|pc='+site.pc+'|'+caller.tier;
        add(key,delta);
        if(!examples[key])examples[key]={caller,sourceLine:site.line,stack:frames.slice(0,callerIndex+1)};
      }
    }
    report.push({pid:t.pid,thread:t.name,allSamples:t.samples.data.length,
      rows:[...rows].sort((a,b)=>b[1].samples-a[1].samples).map(([key,value])=>({key,...value})),examples});
  }
  for(const c of p.processes||[])walk(c);
}
walk(profile);
fs.writeFileSync(dir+'/attribution.json',JSON.stringify(report,null,2));
for(const r of report)console.log(JSON.stringify({pid:r.pid,allSamples:r.allSamples,rows:r.rows.filter(x=>x.key.includes('pc=365')||x.key.startsWith('caller-nearest/')||x.key.startsWith('nearest/')&&x.key.includes('LogoFlatSpan'))},null,2));
