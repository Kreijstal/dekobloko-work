import fs from 'node:fs';
import assert from 'node:assert/strict';
const oracle=JSON.parse(fs.readFileSync(new URL('./oracle.json',import.meta.url)));
const [mode,...files]=process.argv.slice(2);
assert(['failure','correct'].includes(mode)&&files.length,'Usage: verify.mjs failure|correct RESULT.json ...');
for(const file of files){
 const r=JSON.parse(fs.readFileSync(file));
 assert.deepEqual(r.fields,mode==='failure'?oracle.observedFailure:oracle.expectedJava,file);
 assert.equal(r.threads.find(t=>t.runnable==='Worker')?.status,oracle.workerStatus,file);
 if(mode==='failure')assert(r.exceptions.some(e=>e.name===oracle.failureName&&e.message===oracle.failureMessage&&e.hostStack.includes('Source/ready()Z?tier='+oracle.failureTier)),file);
 else assert.equal(r.exceptions.length,0,file);
 console.log('VERIFIED '+mode+': '+file);
}
