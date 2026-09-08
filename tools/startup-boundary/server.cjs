const http=require('http'),fs=require('fs'),path=require('path');
const [fixtures,bundle,manifest,port='18169']=process.argv.slice(2);
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');let file;
 if(u.pathname==='/') {res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><title>Startup boundary reduction</title><pre id="status">Preparing</pre><script src="/jvm-debug.js"></script><script src="/run.js"></script>');return;}
 if(u.pathname==='/run.js')file=path.join(__dirname,'run.js');
 else if(u.pathname==='/runtime.json')file=manifest;
 else if(u.pathname==='/fixture.jar'&&/^(?:[123]|field-cache)$/.test(u.searchParams.get('attempt')))file=path.join(fixtures,'attempt'+u.searchParams.get('attempt')+'.jar');
 else if(/^\/[\w.-]+\.js$/.test(u.pathname))file=path.join(bundle,path.basename(u.pathname));
 if(!file||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Cache-Control','no-store');if(file.endsWith('.js'))res.setHeader('Content-Type','text/javascript');fs.createReadStream(file).pipe(res);
}).listen(+port,'127.0.0.1',()=>console.log('Boundary reduction '+port));
