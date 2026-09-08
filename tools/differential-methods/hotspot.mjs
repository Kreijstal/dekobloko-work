import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import os from 'node:os';
import crypto from 'node:crypto';
const [outArg,forks='3',java='/usr/lib/jvm/java-8-openjdk/bin/java']=process.argv.slice(2);
const out=path.resolve(outArg),manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));
if(crypto.createHash('sha256').update(fs.readFileSync(path.join(out,'fixture.jar'))).digest('hex')!==manifest.jarSha256)throw Error('JAR differs from pinned manifest');
const version=spawnSync(java,['-version'],{encoding:'utf8'});
if(version.status!==0)throw Error(version.stderr);
const read=p=>{try{return fs.readFileSync(p,'utf8').trim();}catch{return null;}};
for(let i=0;i<+forks;i++){
 const args=['-cp',path.join(out,'fixture.jar'),manifest.spec.class];
 const raw=execFileSync(java,args,{encoding:'utf8',timeout:120000});
 const rows=raw.split('\n').filter(s=>s.startsWith('DIFF ')).map(s=>s.split(' ').slice(1).map(Number));
 if(rows.length!==manifest.spec.samples)throw Error('Incomplete run');
 fs.writeFileSync(path.join(out,`hotspot-${Date.now()}-${i}.json`),JSON.stringify({state:'completed',manifest,java,args,version:version.stderr+version.stdout,machine:{hostname:os.hostname(),cpu:os.cpus()[0].model,governor:read('/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor'),maxKHz:read('/sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq')},nanos:rows.map(r=>r[1]),outputs:rows.map(r=>r[2]),raw},null,2));
 console.log(JSON.stringify({fork:i,coldMs:rows[0][1]/1e6,warmMs:rows.slice(1).map(r=>r[1]/1e6),outputs:rows.map(r=>r[2])}));
}
