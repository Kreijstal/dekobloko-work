import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertSteelNamingComplete} from '../build-steelsentinels-rules.mjs';
import {namingCoverage} from '../naming-coverage.mjs';

const fixture=(className,methodName)=>({files:[{original:'hd.java',renamed:'BattleTerrain.java'}],symbols:[
  {symbol:'C:hd$1$CfrPartitionedState',renamedName:className},
  {symbol:'M:hd$1$CfrPartitionedState.<init>(Z)V',renamedName:className},
  {symbol:'M:hd$1$CfrPartitionedState.runPartition0()V',renamedName:methodName},
  {symbol:'M:hd$1$CfrPartitionedState.run()V',renamedName:'buildCatalogue'},
]});

test('Steel export rejects numbered dispatcher methods even when the shared audit accepts them',()=>{
  const partial=fixture('PartCatalogueBuilder','runPartition0');
  assert.equal(namingCoverage(partial).complete,true);
  assert.throws(()=>assertSteelNamingComplete(partial),/naming incomplete: M:hd\$1\$CfrPartitionedState.runPartition0/);
});

test('Steel export includes nested loader classes and constructors in its coverage',()=>{
  assert.throws(()=>assertSteelNamingComplete(fixture('$CfrPartitionedState','allocatePartSpriteStorage')),/naming incomplete: C:hd\$1\$CfrPartitionedState/);
  const complete=assertSteelNamingComplete(fixture('PartCatalogueBuilder','allocatePartSpriteStorage'));
  assert.equal(complete.complete,true);
  assert.equal(complete.classes,1);
  assert.equal(complete.methods,2);
  assert.equal(complete.constructors,1);
});
