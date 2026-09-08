import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [outArg,bundleArg,runtimeArg,port='18212']=process.argv.slice(2);
const out=path.resolve(outArg),bundle=path.resolve(bundleArg),runtime=path.resolve(runtimeArg);
const here=path.dirname(new URL(import.meta.url).pathname);
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const pin={bundleSha256:hash(path.join(bundle,'jvm-debug.js')),bundleFiles:Object.fromEntries(fs.readdirSync(bundle).filter(f=>f.endsWith('.js')).map(f=>[f,hash(path.join(bundle,f))])),runtimeSha256:hash(runtime),manifest:JSON.parse(fs.readFileSync(path.join(out,'manifest.json')))};
if(hash(path.join(out,'fixture.jar'))!==pin.manifest.jarSha256)throw Error('JAR differs from pinned manifest');
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/pin.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(pin));return;}
 if(url.pathname==='/result'&&req.method==='POST'){
  let chunks=[],size=0;for await(const c of req){size+=c.length;if(size>4e6){res.writeHead(413);res.end();return;}chunks.push(c);}
  const result=JSON.parse(Buffer.concat(chunks));
  fs.writeFileSync(path.join(out,`firefox-${Date.now()}.json`),JSON.stringify(result,null,2));res.end('saved');return;
 }
 let file=url.pathname==='/'?path.join(here,'index.html'):url.pathname==='/run.js'?path.join(here,'run.js'):url.pathname==='/runtime.json'?runtime:url.pathname==='/fixture.jar'?path.join(out,'fixture.jar'):/^\/[\w.-]+\.js$/.test(url.pathname)?path.join(bundle,path.basename(url.pathname)):null;
 if(!file||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res);
}).listen(+port,'127.0.0.1',()=>console.log(`http://localhost:${port}`));
