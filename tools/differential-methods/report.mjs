import fs from 'node:fs';
import path from 'node:path';
const median=a=>{a=[...a].sort((x,y)=>x-y);const n=a.length;return n%2?a[n>>1]:(a[n/2-1]+a[n/2])/2;};
const rows=[];
for(const dir of process.argv.slice(2)){
 const files=fs.readdirSync(dir),h=files.filter(f=>/^hotspot-.*\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f)))),b=files.filter(f=>/^firefox-.*\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f))));
 if(!h.length||!b.length)throw Error('Missing paired runtime results: '+dir);
 if(b.some(r=>r.hiddenDuringGuest||(r.guestStartVisibility||r.visibility)==='hidden'||r.finalVisibility==='hidden'))throw Error('Hidden browser run is not comparable');
 const spec=h[0].manifest.spec,jar=h[0].manifest.jarSha256;
 const oracle=JSON.parse(fs.readFileSync(path.join(dir,'oracle.json'))),expected=oracle.checksum;
 for(const r of [...h,...b]){
  if(r.state!=='completed'||r.outputs?.length!==spec.samples||r.nanos?.length!==spec.samples||r.outputs.some(o=>o!==expected)||r.nanos.some(n=>!Number.isFinite(n)||n<0))throw Error('Correctness/incomplete result: '+dir);
  if((r.manifest||r.pin.manifest).jarSha256!==jar)throw Error('Different classfiles');
 }
 const cold=a=>median(a.map(r=>r.nanos[0]/1e6)),warm=a=>median(a.map(r=>median(r.nanos.slice(1).map(n=>n/1e6))));
 rows.push({name:spec.name,hotspotForks:h.length,firefoxForks:b.length,oracle:oracle.source||'all sample checksums match independent decoded output',coldHotspotMs:cold(h),coldFirefoxMs:cold(b),coldExcessMs:cold(b)-cold(h),warmHotspotMs:warm(h),warmFirefoxMs:warm(b),warmExcessMs:warm(b)-warm(h),warmRatio:warm(b)/warm(h),maximumFirefoxOperationMs:Math.max(...b.flatMap(r=>r.nanos.map(n=>n/1e6))),repeatable:b.length>=3&&h.length>=3,gameFrequency:'unmeasured; no full-frame contribution forecast'});
}
// Rank absolute elapsed cost. Ratio is supplementary, never the sort key.
rows.sort((a,b)=>b.coldExcessMs-a.coldExcessMs);
for(const row of rows){row.browserClockLimited=row.warmFirefoxMs<10;if(row.browserClockLimited)row.warmRatio=null;if(row.warmFirefoxMs<1){row.warmExcessMs=null;row.warmResolutionStatus='below approximately 1ms guest-clock resolution; no speedup claim';}}
console.log(JSON.stringify({rankBy:'cold excess milliseconds per operation',timingCaveat:'Accepted Firefox guest nanoTime samples are approximately millisecond-quantized. Sub-10ms warmed ratios are withheld; zero does not mean zero cost.',rows},null,2));
