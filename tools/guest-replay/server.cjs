#!/usr/bin/env node
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const [classes,captures,bundle,portText='18092',runtimeFile=path.resolve(__dirname,'../../apps/launcher/browser-runtime.json')]=process.argv.slice(2),port=Number(portText);
if(!classes||!captures||!bundle||!Number.isInteger(port))throw Error('Usage: node server.cjs CLASSES CAPTURES BUNDLE_DIR [PORT] [RUNTIME.json]');
const files=[];function walk(dir,prefix=''){for(const name of fs.readdirSync(dir).sort()){
  const file=path.join(dir,name),relative=prefix+name;if(fs.statSync(file).isDirectory())walk(file,relative+'/');
  else if(name.endsWith('.class'))files.push(relative);
}}walk(classes);
const digest=crypto.createHash('sha256');for(const name of files)digest.update(name+'\0').update(fs.readFileSync(path.join(classes,name)));
const manifest=JSON.stringify({files,sha256:digest.digest('hex')});
const allowedClasses=new Set(files);
http.createServer((req,res)=>{
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  const url=new URL(req.url,'http://localhost');let file;
  if(url.pathname==='/classes/index.json'){res.setHeader('content-type','application/json');res.end(manifest);return;}
  if(url.pathname.startsWith('/classes/')&&allowedClasses.has(url.pathname.slice(9)))file=path.join(classes,url.pathname.slice(9));
  else if(['/captures/audio.json','/captures/visual.json'].includes(url.pathname))file=path.join(captures,path.basename(url.pathname));
  else if(url.pathname==='/runtime.json')file=runtimeFile;
  else if(['/', '/index.html','/ui.js'].includes(url.pathname))file=path.join(__dirname,url.pathname==='/'?'index.html':path.basename(url.pathname));
  else if(/^\/[\w.-]+\.js$/.test(url.pathname))file=path.join(bundle,path.basename(url.pathname));
  if(!file||!fs.existsSync(file)){res.writeHead(404);res.end('Not found');return;}
  res.setHeader('cache-control','no-store');
  res.setHeader('content-type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log('Guest replay lab http://127.0.0.1:'+port));
