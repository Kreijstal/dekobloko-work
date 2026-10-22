import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {extractMdctSources,inspectCapture} from '../apps/loading/mdct.mjs';
import {projectMeasurementFixture} from '../apps/loading/measurement-fixture.mjs';
const decoder=fs.readFileSync(new URL('../../funorb-decompiled/games/geoblox/MusicDecoder.java',import.meta.url),'utf8');
const helper=fs.readFileSync(new URL('../../funorb-decompiled/games/geoblox/SpriteConstructionSupport.java',import.meta.url),'utf8');
const reverseHelper=fs.readFileSync(new URL('../../funorb-decompiled/games/geoblox/TextValidationFailure.java',import.meta.url),'utf8');

test('complete original transform is extracted without rewriting its arithmetic',t=>{
 const result=extractMdctSources(decoder,helper,reverseHelper);
 assert.ok(result.region.includes('for (butterflyStage'));assert.ok(result.region.includes('for (rightWindowIndex'));
 assert.ok(result.generated.includes(result.region.replaceAll('SpriteConstructionSupport.unsignedBitLength','MdctTransformKernel.unsignedBitLength')));
 assert.ok(result.generated.includes(result.setupRegion.replaceAll('SpriteConstructionSupport.unsignedBitLength','MdctTransformKernel.unsignedBitLength').replaceAll('TextValidationFailure.reverseLowBitsIntoAccumulator','MdctTransformKernel.reverseLowBitsIntoAccumulator')));
 assert.ok(result.generated.includes(result.reverseRegion));assert.ok(result.reverseRegion.includes('value = value >>> 1;'));
 assert.ok(result.generated.indexOf('prepareTables(small,large);')<result.generated.indexOf('long start=System.nanoTime();'));
 assert.equal(result.generated.split('prepareTables(small,large);').length-1,1);
 assert.equal(result.generated.split('  runTransforms();').length-1,1,'transform stream executes once, after the timer starts');
 assert.ok(result.generated.indexOf('  runTransforms();')>result.generated.indexOf('long start=System.nanoTime();'));
 assert.ok(!result.region.includes('overlapResult ='));assert.equal(result.captured.split('MdctCapture.before(').length-1,1);
 assert.equal(result.captured.split('MdctCapture.after(').length-1,1);assert.match(result.regionSha256,/^[a-f0-9]{64}$/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mdct-source-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(path.join(dir,'MdctTransformKernel.java'),result.generated);
 execFileSync('javac',['--release','8','-proc:none','-d',dir,path.join(dir,'MdctTransformKernel.java')]);
 assert.ok(fs.statSync(path.join(dir,'MdctTransformKernel.class')).size>0);
 assert.throws(()=>extractMdctSources(decoder.replace('overlapResult = null;','overlapResult = somethingElse;'),helper,reverseHelper),/Missing source anchor/);
});
const buffer=words=>{const b=Buffer.alloc(words.length*4);words.forEach((n,i)=>b.writeInt32BE(n,i*4));return b;};
function capture(){
 const tables=Array.from({length:8},()=>[1,0]).flat();
 return {input:buffer([0x4d444354,1,1,8,8,...tables,8,0,0,4,4,4,8,4,8,...Array(8).fill(0)]),
  expected:buffer([0x4d44434f,1,1,8,...Array(8).fill(0)])};
}
test('captured stream validates dimensions, per-record sizes and truncation',()=>{
 const {input,expected}=capture(),shape=inspectCapture(input,expected);assert.equal(shape.records,1);assert.equal(shape.floatWords,8);assert.deepEqual(shape.blockCounts,{'8':1});
 assert.throws(()=>inspectCapture(input.subarray(0,input.length-1),expected));
 const bad=Buffer.from(expected);bad.writeInt32BE(7,12);assert.throws(()=>inspectCapture(input,bad));
 const window=Buffer.from(input);window.writeInt32BE(9,(5+16+3)*4);assert.throws(()=>inspectCapture(window,expected));
});
test('transform workers receive only pinned inputs, never accumulated history',()=>{
 const fixture={sourceSha256:'source',kernelClassSha256:'class',inputSha256:'input',expectedSha256:'output',records:682,floatWords:100};
 for(const key of ['runs','source','capture','diagnostics'])Object.defineProperty(fixture,key,{get(){throw Error('history accessed');}});
 assert.deepEqual(projectMeasurementFixture({mdctBenchmark:fixture}),{mdctBenchmark:{sourceSha256:'source',kernelClassSha256:'class',inputSha256:'input',expectedSha256:'output',records:682,floatWords:100}});
});
