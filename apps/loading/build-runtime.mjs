#!/usr/bin/env node
// Reproduce the cloner's source bundle without reading a developer's dirty
// working tree or creating another committed/runtime artifact.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const repository=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const parent=path.dirname(repository);
const options={revision:'HEAD',javaTools:path.join(parent,'java-tools'),
  cloner:[parent,path.join(parent,'blank-github-cloner')].find(p=>fs.existsSync(path.join(p,'public/jvm-source-bundler.js')))};
for(let i=2;i<process.argv.length;i++) {
  const key=process.argv[i].slice(2);
  if(!['revision','java-tools','cloner','output'].includes(key)||!process.argv[i+1])throw Error('Expected --revision REF --java-tools DIR --cloner DIR --output DIR');
  options[key==='java-tools'?'javaTools':key]=process.argv[++i];
}
if(!options.cloner||!options.output)throw Error('Provide --output DIR and the cloner checkout if it is not adjacent');
const output=path.resolve(options.output),source=path.resolve(options.javaTools);
if(fs.existsSync(output))throw Error('Runtime output already exists; choose an empty output path');
const revision=execFileSync('git',['rev-parse','--verify',options.revision+'^{commit}'],{cwd:source,encoding:'utf8'}).trim();
const {bundleJvmSources,createPackageLoader,unpackTar}=await import(pathToFileURL(path.join(options.cloner,'public/jvm-source-bundler.js')));
const esbuild=await import(pathToFileURL(path.join(options.cloner,'node_modules/esbuild/lib/main.js')));
if(esbuild.version!=='0.28.0')throw Error('Install the cloner lockfile; this benchmark requires esbuild 0.28.0');
const archive=execFileSync('git',['archive','--prefix=package/',revision,'src','config/browser-build.json','package.json','package-lock.json'],{cwd:source,maxBuffer:64*1024*1024});
const files=Object.fromEntries(unpackTar(archive)),lock=JSON.parse(files['package-lock.json']);
const download=createPackageLoader({lock});
const dependencyRoots=[source,path.join(os.homedir(),'git/java-tools')];
const assets=await bundleJvmSources({esbuild,files,loadPackage:async virtual=>{
  for(const root of dependencyRoots)try {
    const disk=path.join(root,virtual.slice(1));
    if(JSON.parse(fs.readFileSync(path.join(disk,'package.json'))).version!==lock.packages[virtual.slice(1)].version)continue;
    const result=new Map();
    const walk=(dir,prefix='')=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      if(entry.name==='node_modules')continue;
      const relative=prefix+entry.name,full=path.join(dir,entry.name);
      if(entry.isDirectory())walk(full,relative+'/');
      else if(/\.(?:[cm]?js|json)$/.test(entry.name))result.set(relative,fs.readFileSync(full,'utf8'));
    }};walk(disk);return result;
  }catch { /* Missing local packages use the integrity-checked locked tarball. */ }
  return download(virtual);
}});
fs.mkdirSync(output,{recursive:true});
const hashes={};
for(const [name,text] of Object.entries(assets)){
  fs.writeFileSync(path.join(output,name),text);hashes[name]=crypto.createHash('sha256').update(text).digest('hex');
}
console.log(JSON.stringify({revision,assets:hashes,output}));
