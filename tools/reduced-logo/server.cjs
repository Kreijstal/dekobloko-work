'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const [jar,bundle,manifest,port='18106',oracleDirectory]=process.argv.slice(2);
if(!jar||!bundle||!manifest)throw Error('Usage: node server.cjs JAR BUNDLE_DIR RUNTIME_JSON [PORT]');
http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 let file;
 if(name==='/')file=path.join(__dirname,'index.html');
 else if(name==='/run.js')file=path.join(__dirname,'run.js');
 else if(name==='/fixture.jar')file=jar;
 else if(name==='/runtime.json')file=manifest;
 else if(oracleDirectory&&/^\/oracle-(detail[1-4]|thin4|chain)\.bin$/.test(name))file=path.join(oracleDirectory,path.basename(name));
 else if(/^\/[\w.-]+\.js$/.test(name))file=path.join(bundle,path.basename(name));
 if(!file||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');
 fs.createReadStream(file).pipe(res);
}).listen(Number(port),'127.0.0.1',()=>console.log('Reduced gap: http://localhost:'+port));
