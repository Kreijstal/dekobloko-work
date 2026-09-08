import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const script=new URL('./report.mjs',import.meta.url).pathname;
function fixture(name,h,b,options={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'method-diff-test-'));
 const manifest={spec:{name,samples:3},jarSha256:'same-jar'};
 const base={state:'completed',outputs:[7,7,7]};
 fs.writeFileSync(path.join(dir,'oracle.json'),JSON.stringify({checksum:7}));
 fs.writeFileSync(path.join(dir,'hotspot-1.json'),JSON.stringify({...base,manifest,nanos:h}));
 fs.writeFileSync(path.join(dir,'firefox-1.json'),JSON.stringify({...base,pin:{manifest},nanos:b,...options}));
 return dir;
}
test('ranks absolute elapsed discrepancy rather than ratio',()=>{
 const small=fixture('large-ratio',[1,1,1],[100,100,100]);
 const big=fixture('large-cost',[1000000,1000000,1000000],[10000000,10000000,10000000]);
 const r=spawnSync(process.execPath,[script,small,big],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const report=JSON.parse(r.stdout);
 assert.equal(report.rows[0].name,'large-cost');assert.equal(report.rows[0].repeatable,false);
});
test('rejects incorrect outputs',()=>{
 const dir=fixture('bad',[1,1,1],[2,2,2],{outputs:[7,0,7]});
 assert.notEqual(spawnSync(process.execPath,[script,dir]).status,0);
});
test('rejects changed classfiles',()=>{
 const dir=fixture('bad',[1,1,1],[2,2,2],{pin:{manifest:{jarSha256:'other'}}});
 assert.notEqual(spawnSync(process.execPath,[script,dir]).status,0);
});
test('rejects incomplete or failed execution',()=>{
 for(const options of [{state:'failed'},{nanos:[1,2]},{nanos:[1,-2,3]}]){
  const dir=fixture('bad',[1,1,1],[2,2,2],options);
  assert.notEqual(spawnSync(process.execPath,[script,dir]).status,0);
 }
});
test('rejects hidden-window timing',()=>{
 for(const options of [{hiddenDuringGuest:true},{guestStartVisibility:'hidden'},{finalVisibility:'hidden'}]){
  const dir=fixture('hidden',[1,1,1],[2,2,2],options);
  assert.notEqual(spawnSync(process.execPath,[script,dir]).status,0);
 }
});
test('withholds clock-limited ratios',()=>{
 const dir=fixture('tiny',[100,100,100],[0,0,0]);
 const r=spawnSync(process.execPath,[script,dir],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
 const row=JSON.parse(r.stdout).rows[0];assert.equal(row.warmRatio,null);assert.equal(row.browserClockLimited,true);
});
