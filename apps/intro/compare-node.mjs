#!/usr/bin/env node
// One uncapped, offscreen pass per fresh process; no warmup or replay.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {introManifest,sha256} from './manifest.mjs';
import {configureIntro,installIntroNatives} from './runtime.mjs';
import {copyRgbToRgba} from './pixels.mjs';
import {codePackIdentity,decodeCodePack,sameIdentity,createCodePackStore,
  installCodePack} from '../launcher/browser-loader/code-pack.mjs';

const options={player:path.join(os.homedir(),'.cache/dekobloko/geoblox-intro'),
  output:path.join(os.homedir(),'.cache/dekobloko/intro-comparison.json')};
let worker=null;
for(let i=2;i<process.argv.length;i++) {
  const key=process.argv[i].slice(2);
  if(key==='worker'||key==='teavm-worker'){worker=key;continue;}
  if(!['player','output'].includes(key)||!process.argv[i+1])
    throw new Error('Usage: compare-node.mjs [--player DIR] [--output FILE]');
  options[key]=path.resolve(process.argv[++i]);
}
const receipt=JSON.parse(fs.readFileSync(path.join(options.player,'provenance.json')));
assert.equal(receipt.generatedBy,'dekobloko-geoblox-intro');
assert.ok(receipt.checked&&receipt.reference,'Use the already checked intro player');
for(const [name,hash] of Object.entries(receipt.assets))
  assert.equal(sha256(fs.readFileSync(path.join(options.player,'assets',name))),hash,name);

const hashRgb=rgba=>{
  const rgb=new Uint8Array(rgba.length/4*3);
  for(let i=0,p=0;i<rgba.length;i+=4){rgb[p++]=rgba[i];rgb[p++]=rgba[i+1];rgb[p++]=rgba[i+2];}
  return sha256(rgb.subarray(receipt.reference.skipPixels*3));
};

const require=createRequire(import.meta.url);
function jpegDecoder() {
  const root=process.env.JAVA_TOOLS_NODE_MODULES||path.join(os.homedir(),'git/java-tools/node_modules');
  return require(path.join(root,'jpeg-js'));
}

async function runNode() {
  const started=performance.now();
  const runtime=path.join(options.player,'runtime');
  const data=introManifest(options.player,runtime);
  globalThis.window=globalThis;
  globalThis.document={};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{
    userAgent:'Mozilla/5.0 (X11; Linux x86_64; rv:148.0) Gecko/20100101 Firefox/148.0',
    hardwareConcurrency:4,language:'en-US'}});
  globalThis.importScripts=()=>{};
  globalThis.location=new URL('http://localhost/');
  const {BrowserJVMDebug}=require(path.join(runtime,'jvm-debug.js'));
  delete globalThis.importScripts;
  delete globalThis.location;
  const debug=new BrowserJVMDebug();
  await debug.initialize({dataPackage:{classes:data.classes}});
  delete globalThis.document; // AWT's native Canvas already supports headless execution.
  data.classes=null;
  const controller=debug.debugController;
  configureIntro(controller,data.jvmOptions);
  const identity=codePackIdentity({runtimeVersion:data.runtimeSha256,
    jarVersion:data.sourceSha256+':'+data.integrationSha256,options:controller.options});
  let pack=decodeCodePack(fs.readFileSync(path.join(options.player,'intro.aot')));
  assert.ok(sameIdentity(identity,pack.identity),'Stale AOT pack; run build-aot.mjs');
  const store=createCodePackStore('replay',pack);pack=null;
  const jpeg=jpegDecoder();
  const assets=new Map(Object.keys(receipt.assets).map(name=>[name,
    new Int8Array(fs.readFileSync(path.join(options.player,'assets',name)))]));
  const rgba=new Uint8ClampedArray(640*480*4);
  let frames=0,reference,preparation;
  await debug.run('GeobloxIntro$Browser',{args:['/intro'],beforeRun:({jvm})=>{
    installCodePack(jvm,{identity,store,onReport:result=>{
      preparation={elapsedMs:performance.now()-started,report:result.report};
      const cache=result.report.preparedCache;
      assert.ok(cache&&!cache.misses&&!cache.refused&&!cache.errors,'Incomplete AOT replay');
    }});
    installIntroNatives(jvm,{
      asset:name=>{assert.ok(assets.has(name),'Unexpected asset '+name);return assets.get(name);},
      present:async (pixels,tick)=>{
        assert.equal(tick,frames,'Skipped or repeated tick');
        copyRgbToRgba(pixels,rgba);
        if(tick===receipt.reference.tick)reference=rgba.slice();
        frames++;
      },
    });
    // Node has no canvas codecs. Image decoding is setup work, outside the
    // animation timer; retain the browser native's async signature/throws.
    const methods=jvm.jre['java/awt/Toolkit'].methods;
    const original=methods['createImage([B)Ljava/awt/Image;'];
    const decode=async (_vm,_object,args)=>{
      const source=args[0]?.array??args[0];
      const offset=args[1]??0,length=args[2]??source.length;
      const image=jpeg.decode(Buffer.from(source.slice(offset,offset+length)),{useTArray:true});
      const pixels=new Int32Array(image.width*image.height);
      for(let i=0,p=0;i<pixels.length;i++,p+=4)
        pixels[i]=(image.data[p+3]<<24)|(image.data[p]<<16)|(image.data[p+1]<<8)|image.data[p+2];
      return {type:'java/awt/Image',_width:image.width,_height:image.height,_pixels:pixels};
    };
    decode.__throws=original.__throws;
    methods['createImage([B)Ljava/awt/Image;']=decode;
    methods['createImage([BII)Ljava/awt/Image;']=decode;
  }});
  const completed=performance.now();
  const fields=controller.jvm.classes.GeobloxIntro.staticFields;
  assert.equal(frames,251);assert.equal(Number(fields.get('framesRendered:I')),251);
  assert.ok(reference,'Missing reference frame');
  const referenceRgbSha256=hashRgb(reference);
  assert.equal(referenceRgbSha256,receipt.reference.rgbSha256);
  const execution=controller.jvm.jit.syncCompileCensus();
  return {version:process.version,v8:process.versions.v8,frames,
    animationMs:Number(fields.get('animationElapsedNanos:J'))/1e6,
    javaEntryMs:Number(fields.get('totalElapsedNanos:J'))/1e6,
    runToJavaReturnMs:completed-started,referenceRgbSha256,preparation,execution,
    sourceSha256:data.sourceSha256,runtimeSha256:data.runtimeSha256,identity,
    imageDecoder:'jpeg-js (setup only)',maxOldSpaceMiB:1024};
}

async function runTeaVm() {
  const started=performance.now(),directory=path.join(options.player,'teavm');
  const build=JSON.parse(fs.readFileSync(path.join(directory,'build.json')));
  assert.equal(build.readableSourceSha256,receipt.readableSourceSha256,'TeaVM source differs from the player');
  const wasm=fs.readFileSync(path.join(directory,'intro.wasm'));
  assert.equal(sha256(wasm),build.wasmSha256,'TeaVM artifact differs from its build receipt');
  const assets=Object.fromEntries(['255-10.bin','10-2.bin','10-3.bin'].map(name=>[name,
    new Int8Array(fs.readFileSync(path.join(options.player,'assets',name)))]));
  globalThis.teavmAssets=assets;
  const container=assets['10-3.bin'];
  const view=new DataView(container.buffer,container.byteOffset,container.byteLength);
  assert.equal(container[0],2);
  const jpeg=gunzipSync(container.subarray(9,9+view.getUint32(1,false)));
  const decoded=jpegDecoder().decode(jpeg,{useTArray:true});
  const pixels=new Int32Array(2+decoded.width*decoded.height);
  pixels[0]=decoded.width;pixels[1]=decoded.height;
  for(let i=2,p=0;i<pixels.length;i++,p+=4)
    pixels[i]=(decoded.data[p+3]<<24)|(decoded.data[p]<<16)|(decoded.data[p+1]<<8)|decoded.data[p+2];
  globalThis.teavmDecodeImage=bytes=>{
    assert.deepEqual(Buffer.from(bytes),jpeg,'Unexpected TeaVM image input');
    return pixels;
  };
  const rgba=new Uint8Array(640*480*4);
  let frames=0,reference;
  globalThis.teavmPresent=buffer=>{
    assert.equal(buffer.byteLength,rgba.length);
    rgba.set(new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength));
    if(frames===receipt.reference.tick)reference=rgba.slice();
    frames++;
  };
  require(path.join(directory,'intro.wasm-runtime.js'));
  const module=await globalThis.TeaVM.wasmGC.load(wasm);
  const loaded=performance.now();
  await module.exports.main([]);
  const animationStarted=performance.now();
  for(let tick=0;tick<=250;tick++)assert.equal(module.exports.render(tick),tick+1);
  const completed=performance.now();
  assert.equal(frames,251);assert.ok(reference,'Missing TeaVM reference frame');
  const referenceRgbSha256=hashRgb(reference);
  assert.equal(referenceRgbSha256,receipt.reference.rgbSha256);
  return {version:process.version,v8:process.versions.v8,compiler:build,frames,
    moduleAndHostSetupMs:loaded-started,javaSetupMs:animationStarted-loaded,
    animationMs:completed-animationStarted,javaEntryMs:completed-loaded,
    runToJavaReturnMs:completed-started,referenceRgbSha256,
    imageDecoder:'jpeg-js (setup only)',maxOldSpaceMiB:1024};
}

function run(command,args) {
  return new Promise((resolve,reject)=>{
    const started=performance.now();
    const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',chunk=>{stdout+=chunk;});
    child.stderr.on('data',chunk=>{stderr+=chunk;});
    child.once('error',reject);
    child.once('close',(code,signal)=>code===0?resolve({stdout,stderr,wallMs:performance.now()-started})
      :reject(new Error(`${command} exited ${code}/${signal}: ${stderr}\n${stdout.slice(-8000)}`)));
  });
}

async function compare() {
  const java=process.env.JAVA||'/usr/lib/jvm/java-17-openjdk/bin/java';
  const javac=process.env.JAVAC||path.join(path.dirname(java),'javac');
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'intro-node-'));
  let hotspot;
  try {
    const source=path.join(temporary,'IntroHeadless.java');
    fs.writeFileSync(source,`import java.nio.file.*;
import java.security.MessageDigest;
public final class IntroHeadless {
  public static void main(String[] args)throws Exception {
    long entry=System.nanoTime();
    GeobloxIntro.silent=true;
    GeobloxIntro intro=new GeobloxIntro(Paths.get(args[0]),new int[640*480]);
    byte[] rgba=new byte[640*480*4],reference=null;
    long started=System.nanoTime();
    for(int tick=0;tick<=250;tick++) {
      intro.render(tick);
      for(int i=0,p=0;i<intro.pixels.length;i++,p+=4) {
        int pixel=intro.pixels[i];
        rgba[p]=(byte)(pixel>>>16);rgba[p+1]=(byte)(pixel>>>8);
        rgba[p+2]=(byte)pixel;rgba[p+3]=(byte)255;
      }
      if(tick==${receipt.reference.tick})reference=rgba.clone();
    }
    long elapsed=System.nanoTime()-started,total=System.nanoTime()-entry;
    MessageDigest digest=MessageDigest.getInstance("SHA-256");
    for(int i=${receipt.reference.skipPixels}*4;i<reference.length;i+=4)digest.update(reference,i,3);
    StringBuilder hash=new StringBuilder();for(byte value:digest.digest())hash.append(String.format("%02x",value&255));
    System.out.println("INTRO_HEADLESS_RESULT "+elapsed+" "+total+" "+hash);
  }
}
`);
    const classes=path.join(options.player,'classes');
    await run(javac,['--release','8','-cp',classes,'-d',temporary,source]);
    const version=await run(java,['-version']);
    const result=await run(java,['-Djava.awt.headless=true','-Xmx256m','-cp',classes+path.delimiter+temporary,
      'IntroHeadless',path.join(options.player,'assets')]);
    const match=result.stdout.match(/INTRO_HEADLESS_RESULT (\d+) (\d+) ([a-f0-9]{64})/);
    assert.ok(match,'HotSpot did not complete');assert.equal(match[3],receipt.reference.rgbSha256);
    hotspot={version:version.stderr.trim(),frames:251,animationMs:Number(match[1])/1e6,
      javaEntryMs:Number(match[2])/1e6,processWallMs:result.wallMs,referenceRgbSha256:match[3],maxHeapMiB:256};
    console.error('HotSpot completed one uncapped pass:',hotspot.animationMs.toFixed(3)+' ms');
  } finally {
    // Only these generated files belong to this temporary directory.
    for(const name of fs.readdirSync(temporary)) {
      assert.ok(['IntroHeadless.java','IntroHeadless.class'].includes(name));
      fs.unlinkSync(path.join(temporary,name));
    }
    fs.rmdirSync(temporary);
  }
  const result=await run(process.execPath,['--max-old-space-size=1024',fileURLToPath(import.meta.url),
    '--worker','--player',options.player]);
  const marker=result.stdout.match(/^INTRO_NODE_RESULT (.+)$/m);
  assert.ok(marker,'Node did not complete: '+result.stdout.slice(-8000));
  const node={...JSON.parse(marker[1]),processWallMs:result.wallMs};
  console.error('Node completed one uncapped pass:',node.animationMs.toFixed(3)+' ms');
  let teavm=null;
  if(fs.existsSync(path.join(options.player,'teavm/build.json'))) {
    const result=await run(process.execPath,['--max-old-space-size=1024',fileURLToPath(import.meta.url),
      '--teavm-worker','--player',options.player]);
    const marker=result.stdout.match(/^INTRO_NODE_RESULT (.+)$/m);
    assert.ok(marker,'TeaVM did not complete: '+result.stdout.slice(-8000));
    teavm={...JSON.parse(marker[1]),processWallMs:result.wallMs};
    console.error('TeaVM in Node completed one uncapped pass:',teavm.animationMs.toFixed(3)+' ms');
  }
  for(const host of [hotspot,node,teavm].filter(Boolean))host.derivedAverageRenderFps=251000/host.animationMs;
  const comparison={measuredAt:new Date().toISOString(),
    workload:'One uncapped offscreen pass, ticks 0–250, 640x480, RGB→RGBA conversion; no pacing, warmup, replay or display',
    note:'Render throughput only; not presented FPS, a browser test, CPU-throttled acceptance or a heap measurement.',
    machine:{hostname:os.hostname(),cpu:os.cpus()[0].model,platform:os.release(),
      cpuAffinity:process.platform==='linux'
        ? fs.readFileSync('/proc/self/status','utf8').match(/^Cpus_allowed_list:\s*(.+)$/m)?.[1]??null : null},
    provenance:receipt,hotspot,node,teavm,valid:true};
  const previous=fs.existsSync(options.output)?JSON.parse(fs.readFileSync(options.output)):{};
  const trials=[...(previous.nodeComparisonTrials??(previous.nodeComparison?[previous.nodeComparison]:[])),comparison].slice(-8);
  const report={...previous,nodeComparison:comparison,nodeComparisonTrials:trials};
  fs.mkdirSync(path.dirname(options.output),{recursive:true});
  fs.writeFileSync(options.output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(comparison,null,2));
}

try {
  if(worker){console.log('INTRO_NODE_RESULT '+JSON.stringify(await (worker==='worker'?runNode():runTeaVm())));process.exit(0);}
  else await compare();
} catch(error){console.error(error.stack||error);process.exitCode=1;}
