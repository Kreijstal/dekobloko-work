'use strict';
// Generates a separate host-only instrumented build. Never time this jar.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const classes=process.argv[2];if(!classes)throw Error('Usage: node census.cjs COMPILED_CLASSES_OR_JAR');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'logo-cost-census-'));
let source=fs.readFileSync(path.join(__dirname,'LogoFlatDispatch.java'),'utf8');
function once(needle,replacement){if(source.split(needle).length!==2)throw Error('Census source shape changed');source=source.replace(needle,replacement);}
once('int param7, int param8) {','int param7, int param8) {\nLogoCostCensus.triangles++;');
if(source.split('param8++;').length!==3)throw Error('Expected two scan loops');
source=source.replaceAll('param8++;','LogoCostCensus.rows++;param8++;');
once('int param3, int param4) {','int param3, int param4) {\nLogoCostCensus.spans++;LogoCostCensus.pixels+=Math.max(0,param4);');
fs.writeFileSync(path.join(temp,'LogoFlatDispatch.java'),source);
function run(command,args){const r=cp.spawnSync(command,args,{stdio:'inherit'});if(r.status!==0)throw Error(command+' failed');}
run('javac',['--release','8','-cp',classes,'-d',temp,path.join(temp,'LogoFlatDispatch.java'),path.join(__dirname,'LogoCostCensus.java')]);
for(const mode of ['square','thin'])run('java',['-cp',temp+path.delimiter+classes,'LogoCostCensus',mode]);
console.log('Diagnostic classes retained at '+temp);
