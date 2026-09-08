import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {page} from './capture.mjs';
const [out,oracle]=process.argv.slice(2);
const actual=JSON.parse(await page(`JSON.stringify((()=>{
 const j=window.diffDebug.debugController.jvm;
 if(!j.classes.CandyDecode.staticFields.get('done:I'))throw Error('Incomplete benchmark');
 const obj=j.classes.CandyDecode.staticFields.get('output:Ldm;');
 const a=j.jit.getField(obj,['Field','dm',['field_v','[I']]);
 return Array.from(a.data||a.elements||a.items||a);
})())`));
const b=Buffer.alloc(actual.length*4);actual.forEach((v,i)=>b.writeInt32BE(v,i*4));
const expected=fs.readFileSync(oracle);
const result={equal:b.equals(expected),pixels:actual.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),scope:'Final sample, every pixel byte-for-byte; every timed sample additionally checked by checksum'};
fs.writeFileSync(path.join(out,'final-pixel-check.json'),JSON.stringify(result,null,2));
console.log(result);if(!result.equal)process.exitCode=1;
