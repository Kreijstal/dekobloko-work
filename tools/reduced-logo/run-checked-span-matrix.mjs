import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [output,control='18166',callee='18164',inline='18165']=process.argv.slice(2);
if(!output)throw Error('Usage: run-checked-span-matrix.mjs OUTPUT [CONTROL CALLEE INLINE]');
const run=fileURLToPath(new URL('./run-matrix.mjs',import.meta.url));
const ports={control,callee,inline};let index=0;
function measure(arm){
 const label=String(index++).padStart(2,'0')+'-'+arm;
 console.log(JSON.stringify({label,...JSON.parse(execFileSync(process.execPath,
  [run,'http://localhost:'+ports[arm],output+'/'+label,'thin4'],{encoding:'utf8'}).trim())}));
}
measure('control');
for(let round=0;round<3;round++)for(const arm of round%2?['inline','callee']:['callee','inline']){
 measure(arm);measure('control');
}
