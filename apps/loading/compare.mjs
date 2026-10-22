#!/usr/bin/env node
// Fresh process and one loading pass per observation; never warm up
// by repeating the workload inside the measured VM.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
import {summarizeLoading} from './statistics.mjs';
import {projectMeasurementFixture,fixtureStdinFlag,parseMeasurementResult,recordProbeObservation} from './measurement-fixture.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const options={player:path.join(os.homedir(),'.cache/dekobloko/geoblox-loading'),browser:'firefox',pairs:3};
for(let i=2;i<process.argv.length;i++) {
  const key=process.argv[i].slice(2);
  if(!['player','browser','pairs','runtime','revision','options'].includes(key)||!process.argv[i+1])throw Error('Expected --player DIR --browser firefox|chromium|node --pairs N');
  options[key]=process.argv[++i];
}
options.player=path.resolve(options.player);options.pairs=Number(options.pairs);
assert.ok(Number.isSafeInteger(options.pairs)&&options.pairs>0&&options.pairs<=20);
assert.ok(['firefox','chromium','node'].includes(options.browser));
const node=options.browser==='node';
// Match the microbenchmarks: eager optimizing Wasm on both backends, with no
// guest workload warmup. Native Wasm compilation belongs to preparation too.
const nodeExecutionFlags=['--max-old-space-size=1024','--no-liftoff','--no-wasm-lazy-compilation'];
if(node&&options.runtime)throw Error('Node probes use --revision source directly; no --runtime bundle');
const require=createRequire(import.meta.url);
const playwright=node?null:require(process.env.PLAYWRIGHT_ROOT||path.join(os.homedir(),'git/java-tools/node_modules/playwright'));
const receiptPath=path.join(options.player,'benchmark.json');
const receipt=JSON.parse(fs.readFileSync(receiptPath));
const runtimeDirectory=path.resolve(options.runtime||path.join(options.player,'runtime'));
if(options.runtime&&!options.revision)throw Error('An isolated runtime requires --revision');
const runtimeRevision=node?execFileSync('git',['rev-parse','--verify',(options.revision||receipt.runtimeRevision)+'^{commit}'],
 {cwd:path.resolve(here,'../../../java-tools'),encoding:'utf8'}).trim():options.revision||receipt.runtimeRevision;
assert.equal(receipt.schema,1);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const classes=[];
for(const [name,expected] of Object.entries(receipt.classes)) {
  const bytes=fs.readFileSync(path.join(options.player,'classes',name));assert.equal(hash(bytes),expected,name);
  classes.push({filename:name,content:bytes.toString('base64')});
}
const assets={};
for(const [name,expected] of Object.entries(receipt.assets)) {
  const bytes=fs.readFileSync(path.join(options.player,'assets',name));assert.equal(hash(bytes),expected,name);
  assets[name]=bytes.toString('base64');
}
const runtimeHashes={};
for(const [name,expected] of Object.entries(node?{}:receipt.runtime)){
 const actual=hash(fs.readFileSync(path.join(runtimeDirectory,name)));
 if(!options.runtime)assert.equal(actual,expected,name);
 runtimeHashes[name]=actual;
}
assert.equal(hash(fs.readFileSync(path.join(options.player,'teavm/loading.wasm'))),receipt.teavm.wasmSha256);
if(options.options && ((!options.runtime&&!node) || options.options!=='diagnostic'))throw Error('--options diagnostic requires an isolated runtime or Node source probe');
const fixture={classes,assets,options:(options.options==='diagnostic'?receipt.diagnosticOptions:receipt.jvmOptions)||JSON.parse(fs.readFileSync(path.resolve(here,'../launcher/browser-runtime.json'))).jvmOptions};
if(!options.options&&!node)receipt.jvmOptions=fixture.options;
const provenance={runtimeRevision,runtime:node?{sourceLoader:'archive-with-generated-jre-index'}:runtimeHashes,jvmOptions:fixture.options,
 comparisonHarnessSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),
 comparisonStatisticsSha256:hash(fs.readFileSync(new URL('./statistics.mjs',import.meta.url))),
 ...(node?{diagnosticOnly:true,engine:process.version,oldSpaceLimitMiB:1024,nodeExecutionFlags}:{})};
const resultKey=node?'nodeComparison':'results';
const server=createServer((req,res)=>{
  try {
    const name=new URL(req.url,'http://localhost').pathname;
    if(name==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><title>GeoBlox asset loading</title>');return;}
    if(name==='/fixture.json'){res.setHeader('content-type','application/json');res.end(JSON.stringify(fixture));return;}
    if(name.startsWith('/runtime/')){
      const runtimeFile=path.resolve(runtimeDirectory,name.slice('/runtime/'.length));
      if(!runtimeFile.startsWith(runtimeDirectory+path.sep))throw Error('Invalid runtime path');
      res.setHeader('content-type','text/javascript');res.end(fs.readFileSync(runtimeFile));return;
    }
    const file=name==='/browser.mjs'?path.join(here,'browser.mjs'):name==='/inflater.mjs'?path.resolve(here,'../launcher/browser-loader/browser-inflater.mjs'):path.resolve(options.player,'.'+name);
    if(!['/browser.mjs','/inflater.mjs'].includes(name)&&!file.startsWith(options.player+path.sep))throw Error('Invalid path');
    res.setHeader('content-type',name.endsWith('.wasm')?'application/wasm':'text/javascript');res.end(fs.readFileSync(file));
  }catch {res.statusCode=404;res.end('Not found');}
});
if(!node)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
if(!node&&!receipt.baselineResults)receipt.baselineResults=receipt.results;
const observations=[];
const measurementInput=node?JSON.stringify(projectMeasurementFixture(receipt)):null;
if(node)Object.assign(provenance,{fixtureTransport:'stdin-projected',measurementFixtureSha256:hash(measurementInput)});
console.log('Comparing '+options.pairs+' fresh-process pairs in '+options.browser);

try {
  for(let pair=0;pair<options.pairs;pair++)for(const backend of pair%2?['teavm','jvm']:['jvm','teavm']) {
    console.log('Pair '+(pair+1)+'/'+options.pairs+': '+backend);
    const browser=node?null:await playwright[options.browser].launch({headless:true});
    try {
      const errors=[];let result;
      if(node){
        const mode=backend==='teavm'?'teavm':options.options==='diagnostic'?'slab':'canonical';
        const child=spawnSync(process.execPath,[...nodeExecutionFlags,path.join(here,'probe.mjs'),mode,'all',
          backend==='jvm'?runtimeRevision:'-','loading',options.player,fixtureStdinFlag],{
          input:measurementInput,encoding:'utf8',maxBuffer:16*1024*1024});
        let observed;
        if(child.status===0)observed=parseMeasurementResult(child.stdout,'PROBE_RESULT ');
        else if(child.stdout?.includes('PROBE_RESULT '))observed=parseMeasurementResult(child.stdout,'PROBE_RESULT ');
        result={...observed,backend,browser:'Node.js '+process.version,
          ...(child.status===0?{}:{error:observed?.error||child.error?.message||child.stderr?.slice(-2000)||'Node observation failed with status '+child.status})};
        if(observed){
          assert.equal(observed.measurementFixtureSha256,provenance.measurementFixtureSha256,'Worker did not use the supplied fixture');
          recordProbeObservation(receipt,result);
        }
      }else{
      const page=await browser.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
      await page.goto('http://127.0.0.1:'+server.address().port);
      result=await page.evaluate(async backend=>{
        const {runLoading}=await import('/browser.mjs');
        const fixture=await(await fetch('/fixture.json')).json();
        return {...await runLoading(backend,fixture),browser:navigator.userAgent};
      },backend);
      }
      try {
        assert.deepEqual(errors,[]);
        assert.equal(result.error,undefined,'Workload execution failed');
        if(backend==='jvm'){
          assert.ok(!result.instrumented,'Instrumented diagnostics cannot establish performance acceptance');
          assert.deepEqual(result.lateCompiles,[],'AOT failed: compiler entered during guest execution');
          assert.equal(result.compilation.postMainSyncCompileCount,0,'AOT failed: late compilation');
        }
        assert.equal(result.check,receipt.referenceCheck,'Decoded results differ from HotSpot');
        if(observations.length)assert.equal(result.check,observations[0].check,'Decoded results differ between VMs');
        assert.ok(result.musicMs>0&&result.graphicsMs>0);
      } catch(error) {
        receipt[resultKey]={...provenance,scope:receipt.workload,browser:options.browser,status:'failed',observations,
          failedObservation:result,error:error.message,fullMenuLoading:false};
        fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
        throw error;
      }
      observations.push({...result,loadingMs:result.musicMs+result.graphicsMs,pair});
      receipt[resultKey]={...provenance,scope:receipt.workload,browser:options.browser,status:'running',observations,fullMenuLoading:false};
      fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
      console.log(JSON.stringify(observations.at(-1)));
    } finally {if(browser)await browser.close();}
  }
  const {summary,ratio,parity}=summarizeLoading(observations,options.pairs);
  receipt[resultKey]={...provenance,scope:receipt.workload,browser:options.browser,status:'complete',observations,summary,parity,assetAndPcmResultsMatch:true,zeroGuestCompilation:true,fullMenuLoading:false};
  fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({scope:receipt.workload,summary,ratio,parity,report:receiptPath}));
  assert.ok(parity.met,'Loading parity target failed: JVM.js must take at most 110% of TeaVM execution time');
} finally {if(server.listening)await new Promise(resolve=>server.close(resolve));}
