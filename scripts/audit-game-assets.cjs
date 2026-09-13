#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');
const {parseReferenceTable}=require('./lib/js5-reference.cjs');
const {createHash}=require('node:crypto');
const {dekoRoot, assetRoot, catalogPath} = require('./lib/game-asset-paths.cjs');
const {crc32}=require(path.join(dekoRoot,'scripts/js5-server.js'));
const catalog=require(catalogPath);
const byCrc=new Map();
const directories=catalog.games.map(g=>path.join(assetRoot,g.assetRoot));
for(const directory of directories){
  if(!fs.existsSync(directory))continue;
  for(const name of fs.readdirSync(directory).filter(n=>/^\d+-\d+\.bin$/.test(n))){
    const bytes=fs.readFileSync(path.join(directory,name));
    if(bytes.length<5)continue;
    const size=bytes.readUInt32BE(1)+(bytes[0]===0?5:9);
    if(size>bytes.length)continue;
    const container=bytes.subarray(0,size);byCrc.set(crc32(container),container);
  }
}
const fill=process.argv.includes('--fill-shared');const results=[];
for(const game of catalog.games){
  const directory=path.join(assetRoot,game.assetRoot);
  const result={game:game.internalName,gamecrc:game.gamecrc,js5GameId:game.js5GameId,containers:0,bytes:0,reused:0,missing:[],invalid:[]};results.push(result);
  const files=[];
  function read(archive,group,crc){
    const name=`${archive}-${group}.bin`,file=path.join(directory,name);
    let bytes=fs.existsSync(file)?fs.readFileSync(file):null;
    if(bytes&&fill&&crc!==undefined&&(bytes.length<5||crc32(bytes.subarray(0,bytes.readUInt32BE(1)+(bytes[0]===0?5:9)))!==crc)){
      const quarantine=path.join(dekoRoot,'.work/invalid-game-assets',game.internalName);fs.mkdirSync(quarantine,{recursive:true});
      fs.renameSync(file,path.join(quarantine,name));bytes=null;
    }
    if(!bytes&&fill&&crc!==undefined&&byCrc.has(crc)){
      bytes=byCrc.get(crc);fs.writeFileSync(file,bytes);result.reused++;
    }
    if(!bytes){result.missing.push(name);return null;}
    if(bytes.length<5||bytes.length<bytes.readUInt32BE(1)+(bytes[0]===0?5:9)){
      result.invalid.push(`${name}: truncated`);return null;
    }
    bytes=bytes.subarray(0,bytes.readUInt32BE(1)+(bytes[0]===0?5:9));
    if(crc!==undefined&&crc32(bytes)!==crc){result.invalid.push(`${name}: CRC mismatch`);return null;}
    files.push(name);result.containers++;result.bytes+=bytes.length;return bytes;
  }
  const master=read(255,255);
  if(!master)continue;
  if(master[0]!==0||master.length<6+master[5]*72){result.invalid.push('Unsupported master index');continue;}
  for(let archive=0;archive<master[5];archive++){
    const crc=master.readUInt32BE(6+archive*72);if(!crc)continue;
    const table=read(255,archive,crc);if(!table)continue;
    try{for(const [group,metadata] of parseReferenceTable(table))read(archive,group,metadata.crc);}
    catch(error){result.invalid.push(`255-${archive}.bin: ${error.message}`);}
  }
  if(fill){
    const manifest=JSON.stringify(files.sort())+'\n';
    fs.writeFileSync(path.join(directory,'manifest.json'),manifest);
    game.assetVersion=createHash('sha256').update(master).update(manifest).digest('hex').slice(0,16);
  }
}
if(fill)fs.writeFileSync(catalogPath,JSON.stringify(catalog,null,2)+'\n');
fs.mkdirSync(path.join(assetRoot,'game-assets'),{recursive:true});
fs.writeFileSync(path.join(assetRoot,'game-assets/asset-report.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({games:results.length,containers:results.reduce((n,r)=>n+r.containers,0),bytes:results.reduce((n,r)=>n+r.bytes,0),reused:results.reduce((n,r)=>n+r.reused,0),missing:results.reduce((n,r)=>n+r.missing.length,0),invalid:results.reduce((n,r)=>n+r.invalid.length,0)}));
if(results.some(r=>r.invalid.length))process.exitCode=1;
if(process.argv.includes('--complete')&&results.some(r=>r.missing.length))process.exitCode=1;
