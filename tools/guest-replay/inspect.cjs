'use strict';
// Diagnostic runs are deliberately separate from throughput measurements.
const fs=require('fs');
const {createReplay}=require('./engine.cjs');
(async()=>{
  const [file,classpath,tier='javascript']=process.argv.slice(2);
  const artifact=JSON.parse(fs.readFileSync(file));
  const manifest=require('../../apps/launcher/browser-runtime.json');
  const replay=await createReplay(artifact,{classpath,tier,jvmOptions:manifest.jvmOptions});
  for(let i=0;i<3;i++)if(!(await replay.run({timeoutMs:60000})).correct)throw Error('Oracle mismatch');
  const j=replay.jvm,rows=new Map(),original=j.executeTick;
  j.executeTick=async function(options,scheduled,...rest){
    const frame=scheduled.callStack.peek(),m=frame.method;
    const key=frame.className+'.'+m.name+m.descriptor;
    const row=rows.get(key)||{key,ticks:0,ms:0,pcs:{},generated:!!j.jit.codegenCache.get(m)};
    rows.set(key,row);row.ticks++;row.pcs[frame.pc]=(row.pcs[frame.pc]||0)+1;
    const start=performance.now();
    try{return await original.call(this,options,scheduled,...rest);}
    finally{row.ms+=performance.now()-start;}
  };
  const result=await replay.run({timeoutMs:60000,schedulerMode:'single-step'});
  const bodies=[];
  for(const [owner,name,descriptor] of [['kl','a','([III)V'],['ad','a','([III)V'],['ad','a','(IBI[ILpc;I)V'],['kj','a','(II[ILpc;Z)Z']]){
    const method=await j.findMethodInHierarchy(owner,name,descriptor),fn=j.jit.codegenCache.get(method);
    bodies.push({key:owner+'.'+name+descriptor,properties:fn&&Object.fromEntries(Object.entries(fn)
      .filter(([k,v])=>/Synchronous|Rejection|Positional|Source|Structured/.test(k)&&['function','boolean','number','string'].includes(typeof v))
      .map(([k,v])=>[k,typeof v==='function'?{name:v.name,length:v.toString().length}:typeof v==='string'&&v.length>1000?v.length:v]))});
  }
  console.log(JSON.stringify({correct:result.correct,ticks:result.ticks,
    rows:[...rows.values()].sort((a,b)=>b.ms-a.ms),bodies},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
