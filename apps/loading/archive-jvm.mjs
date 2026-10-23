// Load one immutable JVM revision without a checkout or generated bundle.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Module,createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
export async function loadArchivedJvm(root,revision,{observeModule,preloadModules=[]}={}) {
 assert.match(revision,/^[0-9a-f]{40}$/,'An exact source commit is required');

 const parent=path.dirname(root),cloner=[parent,path.join(parent,'blank-github-cloner')].find(directory=>fs.existsSync(path.join(directory,'public/jvm-source-bundler.js')));
 assert.ok(cloner,'An adjacent cloner checkout supplies the source archive reader');
 const {unpackTar}=await import(pathToFileURL(path.join(cloner,'public/jvm-source-bundler.js')));
 const files=new Map(unpackTar(execFileSync('git',['archive','--prefix=package/',revision,'src','package.json'],{cwd:root,maxBuffer:64*1024*1024})));
 // The ignored JRE index must be generated from the archived files too.
 // Falling back to the checkout's index would share its JRE and core helpers
 // across revisions, invalidating both ownership metadata and A/B provenance.
 const jreFiles=[...files.keys()].filter(name=>name.startsWith('src/jre/')&&name.endsWith('.js')&&path.basename(name)!=='index.js');
 const entries=jreFiles.map(name=>[name.slice('src/jre/'.length,-3),'./'+name.slice('src/jre/'.length)])
  .sort(([a],[b])=>a.localeCompare(b));
 files.set('src/jre/index.js','module.exports={\n'+entries.map(([name,file])=>JSON.stringify(name)+':require('+JSON.stringify(file)+')').join(',\n')+'\n};\n');
 // Node's existing bootstrap discovers additional class names on disk. Reject
 // a different file inventory rather than accidentally creating extra stubs.
 const diskFiles=[];
 const inventory=directory=>{for(const entry of fs.readdirSync(path.join(root,directory),{withFileTypes:true})){
  const name=directory+'/'+entry.name;if(entry.isDirectory())inventory(name);
  else if(name.endsWith('.js')&&entry.name!=='index.js')diskFiles.push(name);
 }};
 inventory('src/jre');assert.deepEqual(diskFiles.sort(),jreFiles.sort(),'JRE file inventory differs from source revision');
 const cache=new Map();
 const relative=filename=>path.relative(root,filename).split(path.sep).join('/');
 const resolveSource=filename=>[filename,filename+'.js',filename+'.json',path.join(filename,'index.js'),path.join(filename,'index.json')]
  .find(candidate=>files.has(relative(candidate)));
 const load=filename=>{
  if(cache.has(filename))return cache.get(filename).exports;
  const source=files.get(relative(filename));
  assert.notEqual(source,undefined,'Source module is absent from revision: '+relative(filename));
  const module=new Module(filename);module.filename=filename;module.paths=Module._nodeModulePaths(path.dirname(filename));cache.set(filename,module);
  module.require=request=>{
   if(request.startsWith('.')||path.isAbsolute(request)){
    const candidate=path.resolve(path.dirname(filename),request),name=relative(candidate);
    if(name==='src'||name.startsWith('src/')||name==='package.json'){
     const resolved=resolveSource(candidate);
     assert.ok(resolved,'Source import is absent from revision: '+request+' from '+relative(filename));
     return load(resolved);
    }
   }
   const resolved=Module._resolveFilename(request,module);
   return files.has(relative(resolved))?load(resolved):require(resolved);
  };
  if(filename.endsWith('.json'))module.exports=JSON.parse(source);else module._compile(source,filename);
  module.loaded=true;observeModule?.({filename,exports:module.exports});return module.exports;
 };
 const result=load(path.join(root,'src/core/jvm.js'));
 for(const name of preloadModules){
  assert.ok(name.startsWith('src/')&&!name.split('/').includes('..'),'Preload only an archived source module');
  load(path.join(root,name));
 }
 return result;
}
