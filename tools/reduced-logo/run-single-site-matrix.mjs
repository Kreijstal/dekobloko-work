import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [output, control='18159', expand='18160', simplify='18161'] = process.argv.slice(2);
if (!output) throw Error('Usage: node run-single-site-matrix.mjs OUTPUT [CONTROL_PORT EXPAND_PORT SIMPLIFY_PORT]');
const run = fileURLToPath(new URL('./run-matrix.mjs',import.meta.url));
const ports={control,expand,simplify};
let index=0;
function measure(arm) {
  const label=String(index++).padStart(2,'0')+'-'+arm;
  const result=execFileSync(process.execPath,[run,'http://localhost:'+ports[arm],output+'/'+label,'thin4'],{encoding:'utf8'});
  console.log(JSON.stringify({label,...JSON.parse(result.trim())}));
}
measure('control');
for(let round=0;round<3;round++)for(const arm of round%2 ? ['simplify','expand'] : ['expand','simplify']) {
  measure(arm); measure('control');
}
