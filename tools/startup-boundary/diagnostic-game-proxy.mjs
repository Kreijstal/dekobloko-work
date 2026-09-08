// Diagnostic origin serving the entire unchanged accepted runtime bundle.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const [bundle,manifest,port='18167',fixture,diagnostic]=process.argv.slice(2);
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');let file;
 if(u.pathname==='/api/local-deko-runtime'&&u.searchParams.get('file')==='manifest')file=manifest;
 if(fixture&&u.pathname==='/__prepared-game.json')file=fixture;
 if(u.pathname.startsWith('/jvm-assets/')){
  const name=path.basename(u.pathname).replace('jvm-debug-current.js','jvm-debug.js');
  if(/^(?:\d+\.)?jvm-debug\.js$|^jvm-compile-worker\.js$/.test(name)&&fs.existsSync(path.join(bundle,name)))file=path.join(bundle,name);
 }
 if(file){res.writeHead(200,{'Content-Type':file.endsWith('.json')?'application/json':'application/javascript','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);return;}
 const r=http.request({hostname:'127.0.0.1',port:5173,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:5173','accept-encoding':'identity'}},p=>{
  if(fixture&&u.pathname==='/console.js'){
   const parts=[];p.on('data',b=>parts.push(b));p.on('end',()=>{
    const original=Buffer.concat(parts).toString();
    const needle='  await cloneGeobloxRepositories();\n  await compileGeoblox();';
    if(!original.includes(needle)){res.writeHead(500);res.end('Preparation hook did not match');return;}
    let prepared=original.replace(needle,`  activateJvmSplash();
  const JVMDebug=await loadJavaTools('accepted-host-prepared');
  const debug=new JVMDebug.BrowserJVMDebug();
  await debug.initialize({workspace:true});
  const fixture=await fetch('/__prepared-game.json').then(r=>r.json());
  for(const a of fixture.artifacts)debug.writeWorkspaceFile(a.outputPath,Uint8Array.from(atob(a.bytes),c=>c.charCodeAt(0)));
  window.geobloxSession={debug,compilation:{cached:true,cacheKey:fixture.sourceHead+':host-prepared',artifacts:fixture.artifacts.map(a=>({outputPath:a.outputPath}))},execution:null};`);
    if(diagnostic){
      const hook='      await session.runtimeHook;';
      if(!prepared.includes(hook)){res.writeHead(500);res.end('Diagnostic hook did not match');return;}
      prepared=prepared.replace(hook,hook+'\n      window.installTerminationTrace(session.debug.debugController.jvm);');
      prepared+='\n'+fs.readFileSync(diagnostic,'utf8');
    }
    const body=Buffer.from(prepared);
    const headers={...p.headers,'content-length':body.length,'cache-control':'no-store'};delete headers['content-encoding'];delete headers.etag;
    res.writeHead(p.statusCode,headers);res.end(body);
   });return;
  }
  res.writeHead(p.statusCode,p.headers);p.pipe(res);
 });
 r.on('error',e=>{res.writeHead(502);res.end(String(e));});req.pipe(r);
}).listen(+port,'127.0.0.1',()=>console.log('Accepted game origin '+port));
