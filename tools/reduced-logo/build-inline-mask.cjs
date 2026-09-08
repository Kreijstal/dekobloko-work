'use strict';
// Diagnostic Java-source A/B, not a runtime intrinsic or a replacement fixture.
// Same primitive operation, moved into its caller to test call-plan admission.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const names=['LogoWorkload','LogoApplet','LogoTriangle','LogoDispatch','LogoMeshRenderer','LogoDetailWorkload','LogoProjection','LogoFlatDispatch','LogoCompositor','LogoCallChain'];
const files=names.map(n=>{
 let text=fs.readFileSync(path.join(__dirname,n+'.java'),'utf8');
 if(n==='LogoFlatDispatch'){
  const original='LogoRasterState.mask(var9[var6] >> -453107103, 8355711)';
  if(text.split(original).length!==2)throw Error('Expected one mask call');
  text=text.replace(original,'((var9[var6] >> -453107103) & 8355711)');
 }
 const file=path.join(out,n+'.java');fs.writeFileSync(file,text);return file;
});
function run(cmd,args){const r=cp.spawnSync(cmd,args,{stdio:'inherit'});if(r.status!==0)throw Error('Command failed');}
run(process.execPath,[path.resolve(__dirname,'../../../java-tools/scripts/compileJava.js'),...files,'--out',path.join(out,'classes'),'--source-level','8']);
run('jar',['cf',path.join(out,'fixture.jar'),'-C',path.join(out,'classes'),'.']);
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
fs.writeFileSync(path.join(out,'provenance.json'),JSON.stringify({diagnostic:'inline pure mask call at Java source level',sources:Object.fromEntries(files.map(f=>[path.basename(f),hash(f)])),jarSha256:hash(path.join(out,'fixture.jar'))},null,2));
