import assert from 'node:assert/strict';

const median=values=>{
 const sorted=[...values].sort((a,b)=>a-b);
 assert.ok(sorted.length,'No loading observations');
 return sorted.length%2?sorted[sorted.length>>1]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
};

export function summarizeLoading(observations,pairs){
 const pairedRatios=[];
 assert.equal(observations.length,pairs*2,'Incomplete loading comparison');
 for(let pair=0;pair<pairs;pair++){
  const values={};
  for(const backend of ['jvm','teavm']){
   const matching=observations.filter(row=>row.pair===pair&&row.backend===backend);
   assert.equal(matching.length,1,'Expected one '+backend+' observation for pair '+pair);
   values[backend]=matching[0];
   for(const key of ['musicMs','graphicsMs','loadingMs'])assert.ok(
    Number.isFinite(values[backend][key])&&values[backend][key]>0,'Invalid '+key);
  }
  pairedRatios.push(values.jvm.loadingMs/values.teavm.loadingMs);
 }
 const summary=Object.fromEntries(['jvm','teavm'].map(backend=>[backend,
  Object.fromEntries(['musicMs','graphicsMs','loadingMs'].map(key=>[key,
   median(observations.filter(row=>row.backend===backend).map(row=>row[key]))]))]));
 const ratio=median(pairedRatios),ratioOfMedians=summary.jvm.loadingMs/summary.teavm.loadingMs;
 const parity={maximumRatio:1.1,ratio,ratioOfMedians,pairedRatios,
  method:'median paired ratios and ratio of backend medians',met:ratio<=1.1&&ratioOfMedians<=1.1};
 return {summary,ratio,parity};
}
