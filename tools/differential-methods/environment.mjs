import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
const [root,out]=process.argv.slice(2);
const read=p=>{try{return fs.readFileSync(p,'utf8').trim();}catch{return null;}};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const record={capturedAt:new Date().toISOString(),hostname:os.hostname(),kernel:os.release(),cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,
 cpufreq:os.cpus().map((_,i)=>({cpu:i,governor:read(`/sys/devices/system/cpu/cpu${i}/cpufreq/scaling_governor`),maxKHz:read(`/sys/devices/system/cpu/cpu${i}/cpufreq/scaling_max_freq`)})),
 runtimeSha256:hash(path.join(root,'runtime.json')),runtime:JSON.parse(fs.readFileSync(path.join(root,'runtime.json'))),sourceBundleSha256:hash(path.join(root,'sources.json')),
 bundleFiles:Object.fromEntries(fs.readdirSync(path.join(root,'bundle')).filter(f=>f.endsWith('.js')).map(f=>[f,hash(path.join(root,'bundle',f))])),
 note:'Settings snapshot, not a claim of exclusive CPU ownership. Unrelated user applications untouched. HotSpot and Firefox timed runs sequential on this host; helper compilation/test work on NUC.'};
fs.writeFileSync(out,JSON.stringify(record,null,2));console.log({out,cpu:record.cpu,cpufreq:record.cpufreq});
