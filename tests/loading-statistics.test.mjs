import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeLoading,summarizeLoadingCandidate} from '../apps/loading/statistics.mjs';

const observations=(jvm,teavm)=>jvm.flatMap((time,pair)=>[
 {backend:'jvm',pair,musicMs:time*.75,graphicsMs:time*.25,loadingMs:time},
 {backend:'teavm',pair,musicMs:teavm[pair]*.75,graphicsMs:teavm[pair]*.25,loadingMs:teavm[pair]}
]);

test('changing timing regimes cannot pass using unpaired backend medians',()=>{
 const result=summarizeLoading(observations([19838.999808,5358.000128,5272],[4963,5515,1365]),3);
 assert.ok(result.parity.ratioOfMedians<1.1,'original statistic reproduces the false pass');
 assert.ok(result.parity.ratio>3.8,'paired comparisons expose the actual gap');
 assert.equal(result.parity.met,false);
});
test('both estimators must satisfy parity and boundary is inclusive',()=>{
 assert.equal(summarizeLoading(observations([108,108,108],[100,100,100]),3).parity.met,true);
 assert.equal(summarizeLoading(observations([110,110,110],[100,100,100]),3).parity.met,true);
 const conflicting=summarizeLoading(observations([100,200,300],[100,20000,1]),3);
 assert.ok(conflicting.ratio<=1.1);
 assert.ok(conflicting.parity.ratioOfMedians>1.1);
 assert.equal(conflicting.parity.met,false);
});
test('missing or duplicated pairs cannot form an acceptance summary',()=>{
 const rows=observations([108,108,108],[100,100,100]);
 assert.throws(()=>summarizeLoading(rows.slice(1),3),/Incomplete/);
 rows[0].pair=1;
 assert.throws(()=>summarizeLoading(rows,3),/Expected one jvm/);
});

test('candidate-only summaries cannot claim paired parity or accept invalid samples',()=>{
 const rows=observations([90,110,100],[1,1,1]).filter(row=>row.backend==='jvm');
 const result=summarizeLoadingCandidate(rows,3);
 assert.deepEqual(result.summary,{jvm:{musicMs:75,graphicsMs:25,loadingMs:100}});
 assert.equal(result.parity.evaluated,false);assert.equal('met' in result.parity,false);
 assert.equal('ratio' in result,false);assert.equal('pairedRatios' in result.parity,false);
 assert.throws(()=>summarizeLoadingCandidate(rows.slice(1),3),/Incomplete/);
 assert.throws(()=>summarizeLoadingCandidate([...rows.slice(0,2),rows[0]],3),/Expected one/);
 assert.throws(()=>summarizeLoadingCandidate([...rows.slice(0,2),{...rows[2],backend:'teavm'}],3),/Expected one/);
 assert.throws(()=>summarizeLoadingCandidate([...rows.slice(0,2),{...rows[2],musicMs:NaN}],3),/Invalid/);
});
