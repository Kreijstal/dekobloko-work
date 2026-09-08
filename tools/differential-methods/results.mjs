import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const [output,...dirs]=process.argv.slice(2);
const text=execFileSync(process.execPath,[new URL('./report.mjs',import.meta.url).pathname,...dirs],{encoding:'utf8'});
fs.writeFileSync(output,text);console.log(text);
