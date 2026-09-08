'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const directory=process.argv[2];if(!directory)throw Error('Usage: node build.cjs OUTPUT_DIRECTORY');
const output=path.resolve(directory);fs.mkdirSync(output,{recursive:true});
const names=['LogoWorkload','LogoApplet','LogoTriangle','LogoDispatch','LogoMeshRenderer','LogoDetailWorkload','LogoProjection','LogoFlatDispatch','LogoCompositor','LogoCallChain'];
const sources=names.map(n=>path.join(__dirname,n+'.java'));
const compiler=path.resolve(__dirname,'../../../java-tools/scripts/compileJava.js');
function run(command,args){const r=cp.spawnSync(command,args,{stdio:'inherit'});if(r.status!==0)throw Error(command+' failed');}
run(process.execPath,[compiler,...sources,'--out',path.join(output,'classes'),'--source-level','8']);
run('jar',['cf',path.join(output,'fixture.jar'),'-C',path.join(output,'classes'),'.']);
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.writeFileSync(path.join(output,'provenance.json'),JSON.stringify({compiler:'java-tools Java frontend',sources:Object.fromEntries(sources.map(file=>[path.basename(file),hash(file)])),jarSha256:hash(path.join(output,'fixture.jar'))},null,2));
