#!/usr/bin/env node
// Compile without executing Java, using the exact browser runtime bundle.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {introManifest} from './manifest.mjs';
import {configureIntro,installIntroNatives} from './runtime.mjs';
import {codePackIdentity,createCodePackStore,encodeCodePack,decodeCodePack,
  installCodePack,sameIdentity} from '../launcher/browser-loader/code-pack.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const options={player:path.join(os.homedir(),'.cache/dekobloko/geoblox-intro'),
  runtime:null,mode:'record'};
for(let i=2;i<process.argv.length;i++) {
  const key=process.argv[i].slice(2);
  if(!['player','runtime','mode'].includes(key)||!process.argv[i+1])throw new Error('Usage: build-aot.mjs [--player DIR] [--runtime DIR] [--mode record|replay]');
  options[key]=key==='mode'?process.argv[++i]:path.resolve(process.argv[++i]);
}
if(!['record','replay'].includes(options.mode))throw new Error('Unknown mode');
const playerReceipt=JSON.parse(fs.readFileSync(path.join(options.player,'provenance.json')));
if(playerReceipt.generatedBy!=='dekobloko-geoblox-intro')throw new Error('Not an intro player');
// Keep the selected launcher bundle intact. Build committed java-tools sources
// in an owned temporary directory, excluding unrelated working-tree edits.
if(!options.runtime) {
  options.runtime=path.join(options.player,'runtime');
  const source=path.resolve(here,'../../../java-tools');
  const run=(command,args,extra={})=>{
    const result=spawnSync(command,args,{encoding:'utf8',...extra});
    if(result.error)throw result.error;
    if(result.status!==0)throw new Error(`${command} failed: ${result.stderr||result.stdout}`);
    return result.stdout.trim();
  };
  const commit=run('git',['-C',source,'rev-parse','HEAD']);
  const receipt=path.join(options.runtime,'build.json');
  if(!fs.existsSync(receipt)||JSON.parse(fs.readFileSync(receipt)).sourceCommit!==commit) {
    const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'intro-runtime-'));
    try {
      const archive=spawnSync('git',['-C',source,'archive','HEAD'],{maxBuffer:128*1024*1024});
      if(archive.status!==0)throw new Error('Cannot archive committed runtime');
      run('tar',['-x','-C',temporary],{input:archive.stdout});
      const dependencies=path.join(os.homedir(),'git/java-tools/node_modules');
      fs.symlinkSync(fs.existsSync(path.join(source,'node_modules'))?path.join(source,'node_modules'):dependencies,
        path.join(temporary,'node_modules'),'dir');
      run(process.execPath,['scripts/generate-jre-index.js'],{cwd:temporary});
      const config=path.join(temporary,'intro-webpack.cjs');
      fs.writeFileSync(config,`const configs=require('./webpack.config.js');module.exports=[configs[0],configs[2]].map(c=>({...c,cache:false}));`);
      console.error('Building isolated browser runtime from '+commit);
      run(process.execPath,[path.join(temporary,'node_modules/webpack/bin/webpack.js'),
        '--config',config,'--output-path',path.join(temporary,'dist')],{cwd:temporary,maxBuffer:16*1024*1024});
      fs.rmSync(options.runtime,{recursive:true,force:true});
      fs.mkdirSync(options.runtime,{recursive:true});
      for(const name of fs.readdirSync(path.join(temporary,'dist'))) {
        if(!name.endsWith('.map'))fs.copyFileSync(path.join(temporary,'dist',name),path.join(options.runtime,name));
      }
      fs.writeFileSync(receipt,JSON.stringify({sourceCommit:commit},null,2)+'\n');
    } finally {fs.rmSync(temporary,{recursive:true,force:true});}
  }
}
const data=introManifest(options.player,options.runtime);
globalThis.window=globalThis;
globalThis.document={};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{
  userAgent:'Mozilla/5.0 (X11; Linux x86_64; rv:148.0) Gecko/20100101 Firefox/148.0',hardwareConcurrency:4,language:'en-US'}});
globalThis.importScripts=()=>{};
globalThis.location=new URL('http://localhost/');
const require=createRequire(import.meta.url);
const {BrowserJVMDebug}=require(path.join(options.runtime,'jvm-debug.js'));
delete globalThis.importScripts;
delete globalThis.location;
const debug=new BrowserJVMDebug();
await debug.initialize({dataPackage:{classes:data.classes}});
data.classes=null;
configureIntro(debug.debugController,data.jvmOptions);
const identity=codePackIdentity({runtimeVersion:data.runtimeSha256,
  jarVersion:data.sourceSha256+':'+data.integrationSha256,options:debug.debugController.options});
const output=path.join(options.player,'intro.aot');
const pack=options.mode==='replay'?decodeCodePack(fs.readFileSync(output)):null;
if(pack&&!sameIdentity(identity,pack.identity))throw new Error('AOT identity differs; rebuild');
const store=createCodePackStore(options.mode,pack);
let preparation,offlineJvm;
const STOP=Symbol('AOT complete');
const started=performance.now();
await debug.run('GeobloxIntro$Browser',{args:['/intro'],beforeRun:({jvm})=>{
  offlineJvm=jvm;
  const prepare=jvm.precompileInitializedClasses.bind(jvm);
  jvm.precompileInitializedClasses=opts=>prepare({...opts,onProgress:progress=>{
    if(progress.completed%250===0)console.error(JSON.stringify(progress));
  }});
  const forbidden=()=>{throw new Error('Offline compilation must not execute Java');};
  installIntroNatives(jvm,{asset:forbidden,present:forbidden});
  installCodePack(jvm,{identity,store,onReport:(result)=>{
    preparation=result;throw STOP;
  }});
}}).catch(error=>{if(error!==STOP&&error.cause!==STOP)throw error;});
if(!preparation)throw new Error('Preparation did not run');
if(offlineJvm.guestStarted||offlineJvm.jit.mainStarted)throw new Error('Offline preparation executed Java');
const summary={elapsedMs:Math.round(performance.now()-started),report:preparation.report,store:store.stats,compilation:offlineJvm.jit.syncCompileCensus()};
if(options.mode==='record') {
  if(!store.written.size)throw new Error('No compiled bodies recorded: '+JSON.stringify(summary));
  const bytes=encodeCodePack({identity,entries:store.written,meta:{summary},compressEntry:gzipSync});
  const largestEntry=Math.max(...[...store.written.values()].map(text=>text.length*2));
  if(bytes.length+2*largestEntry>64*1024*1024)throw new Error('Intro AOT transport/decode accounting exceeds 64 MiB');
  fs.writeFileSync(output+'.tmp',bytes);
  fs.renameSync(output+'.tmp',output);
} else if(!preparation.report.preparedCache||['misses','refused','errors'].some(key=>preparation.report.preparedCache[key])) {
  throw new Error('Incomplete AOT replay: '+JSON.stringify(summary));
}
console.log(JSON.stringify(summary,null,2));
console.log(`${options.mode}: ${output} (${fs.statSync(output).size} bytes); no Java executed`);
process.exit(0);
