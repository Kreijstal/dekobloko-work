import fs from 'node:fs';
import assert from 'node:assert/strict';
const oracle=JSON.parse(fs.readFileSync(new URL('./oracle.json',import.meta.url)));
assert(process.argv.length>2,'Pass one or more captured result JSON paths');
for(const file of process.argv.slice(2)) {
 const r=JSON.parse(fs.readFileSync(file));
 assert.equal(r.state,'observed',file);
 assert.deepEqual(r.fields,oracle.fields,file);
 assert.deepEqual(r.exceptions,oracle.exceptions,file);
 const worker=r.threads.find(t=>t.runnable==='Worker');
 assert.equal(worker?.status,oracle.workerStatus,file);
 assert.equal(worker.stack.length,oracle.workerStackLength,file);
 if(r.attempt!=='1') {
  assert(r.trace.some(e=>e.event==='enter'&&e.generated==='jvm$generated_sync$Loop$step__V'),file+': generated-sync step not observed');
 }
 assert(r.trace.some(e=>e.event==='exit'&&e.name==='run'&&e.result?.returned&&e.stack.length===0),file+': no normal outer return');
 console.log('PASS normal completion (not a failing reproducer): '+file);
}
