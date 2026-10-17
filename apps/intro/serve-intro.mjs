#!/usr/bin/env node
// Local-only host for the exact intro class files used by the desktop player.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {introManifest} from './manifest.mjs';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const options = {player: path.join(os.homedir(), '.cache/dekobloko/geoblox-intro'),
  runtime: null, port: 5188};
for (let i=2;i<process.argv.length;i++) {
  const name=process.argv[i].slice(2);
  if (!['player','runtime','port'].includes(name)||!process.argv[i+1])
    throw new Error('Usage: node apps/intro/serve-intro.mjs [--player DIR] [--runtime DIR] [--port PORT]');
  options[name]=name==='port'?Number(process.argv[++i]):path.resolve(process.argv[++i]);
}
options.runtime??=path.join(options.player,'runtime');
const receipt=JSON.parse(fs.readFileSync(path.join(options.player,'provenance.json')));
if(receipt.generatedBy!=='dekobloko-geoblox-intro')throw new Error('Not an intro player');
function dataManifest() {
  return Buffer.from(JSON.stringify(introManifest(options.player,options.runtime)));
}
const page=`<!doctype html><meta charset="utf-8"><title>Jagex Intro · Firefox JVM</title>
<style>html,body{margin:0;background:#000;width:100%;height:100%;overflow:hidden}body{display:grid;place-items:center}canvas{width:640px;height:480px;image-rendering:pixelated}</style>
<canvas width="640" height="480"></canvas><script src="/runtime/jvm-debug.js"></script><script type="module" src="/browser.mjs"></script>`;
const knownAssets=new Set(Object.keys(receipt.assets));
const server=http.createServer((request,response)=>{
  try {
    const route=new URL(request.url,'http://localhost').pathname;
    response.setHeader('Cache-Control','no-store');
    if(route==='/') {response.setHeader('Content-Type','text/html');response.end(page);return;}
    if(route==='/data.json'){response.setHeader('Content-Type','application/json');response.end(dataManifest());return;}
    let file;
    if(route==='/browser.mjs')file=path.join(here,'browser.mjs');
    else if(route==='/intro/runtime.mjs')file=path.join(here,'runtime.mjs');
    else if(['/launcher/browser-loader/browser-image-decoder.mjs','/launcher/browser-loader/browser-inflater.mjs','/launcher/browser-loader/code-pack.mjs'].includes(route))file=path.resolve(here,'..'+route);
    else if(route==='/intro.aot')file=path.join(options.player,'intro.aot');
    else if(route==='/pixels.mjs')file=path.join(here,'pixels.mjs');
    else if(route==='/decoder.mjs')file=path.resolve(here,'../launcher/browser-loader/browser-image-decoder.mjs');
    else if(route==='/inflater.mjs')file=path.resolve(here,'../launcher/browser-loader/browser-inflater.mjs');
    else if(route.startsWith('/assets/')&&knownAssets.has(route.slice(8)))file=path.join(options.player,'assets',route.slice(8));
    else if(/^\/runtime\/[A-Za-z0-9.-]+\.js$/.test(route))file=path.join(options.runtime,path.basename(route));
    else {response.writeHead(404);response.end();return;}
    response.setHeader('Content-Type',file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':'application/octet-stream');
    response.end(fs.readFileSync(file));
  } catch(error) {response.writeHead(500);response.end(String(error));}
});
server.listen(options.port,'127.0.0.1',()=>console.log(`Intro only: http://127.0.0.1:${server.address().port}`));
