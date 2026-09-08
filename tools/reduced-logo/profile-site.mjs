import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [output, origin='http://localhost:18159'] = process.argv.slice(2);
if(!output)throw Error('Usage: node profile-site.mjs OUTPUT [ORIGIN]');
fs.mkdirSync(output,{recursive:true});
async function bridge(args){const r=await(await fetch('http://localhost:9226',{method:'POST',body:JSON.stringify(args)})).json();if(r[2])throw Error(JSON.stringify(r[2]));return r[3].value;}
await bridge({context:'chrome',script:'Services.profiler.StartProfiler(4000000,1,["js","stackwalk"],["GeckoMain"]);return true;'});
try {
  execFileSync(process.execPath,[fileURLToPath(new URL('./run-matrix.mjs',import.meta.url)),origin,output,'thin4'],{encoding:'utf8'});
  const metadata=await bridge({context:'content',script:`return window.wrappedJSObject.eval(${JSON.stringify(`JSON.stringify((()=>{
    const j=gapDebug.debugController.jvm;
    const specs=[['LogoFlatTriangle','draw','(IIII[IIIII)V'],['LogoFlatSpan','draw','(I[IIII)V'],['LogoMeshRenderer','draw',''],['LogoDetailWorkload','step','(I)V']];
    const methods=[];
    for(const [owner,name,descriptor] of specs){
      const cls=j.classes[owner];if(!cls)continue;
      const m=descriptor?j.findMethod(cls,name,descriptor):null;if(!m)continue;
      const g=j.jit.codegenCache.get(m);if(!g)continue;
      const bodies={};
      for(const [key,value] of Object.entries(g))if(typeof value==='function'&&value.jvmGeneratedSource)
        bodies[key]={name:value.name,source:value.jvmGeneratedSource,hoisted:value.jvmHoistedSource||'',tier:value.jvmTier};
      if(g.jvmGeneratedSource)bodies.own={name:g.name,source:g.jvmGeneratedSource,hoisted:g.jvmHoistedSource||'',tier:g.jvmTier};
      if(g.jvmResumeBodyFn?.jvmGeneratedSource)bodies.resume={name:g.jvmResumeBodyFn.name,source:g.jvmResumeBodyFn.jvmGeneratedSource,hoisted:g.jvmResumeBodyFn.jvmHoistedSource||'',tier:g.jvmResumeBodyFn.jvmTier};
      methods.push({owner,name,descriptor,bodies,sites:g.jvmStructuredRegionCallSites?.map(s=>({pc:s.pc,owner:s.declaredOwner,name:s.memberName,descriptor:s.descriptor,markers:s.regionMarkers,lowering:s.regionLowering}))});
    }
    return {methods,timeOrigin:performance.timeOrigin,result:gapResult};
  })())`)});`});
  fs.writeFileSync(output+'/metadata.json',metadata);
  const profile=await bridge({context:'chrome',async:true,script:'const done=arguments[arguments.length-1];Services.profiler.PauseSampling();Services.profiler.getProfileDataAsync().then(p=>done(JSON.stringify(p)));'});
  fs.writeFileSync(output+'/profile.json',profile);
  const run=JSON.parse(fs.readFileSync(output+'/thin4.json'));
  run.performanceAccepted=false;run.profileDiagnostic=true;delete run.summary;
  fs.writeFileSync(output+'/thin4.json',JSON.stringify(run,null,2));
  console.log(JSON.stringify({output,profileBytes:profile.length,frames:run.frames.length,checksum:run.checksum,diagnosticOnly:true}));
} finally {
  await bridge({context:'chrome',script:'Services.profiler.StopProfiler();return true;'});
}
