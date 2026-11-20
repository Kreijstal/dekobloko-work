import {test} from 'node:test';
import assert from 'node:assert/strict';
import {voidHuntersCoverage} from '../voidhunters-coverage.mjs';

test('Void Hunters counts three-letter obfuscated classes without rejecting short method contracts', () => {
  const symbols = [['C:aaa', 'aaa'], ['C:ab', 'ab'], ['C:a$CfrPartitionedBody', '$CfrPartitionedBody'],
    ['C:pe', 'World'], ['M:pe.a()V', 'a'], ['M:pe.run()V', 'run'], ['M:pe.get()I', 'get'], ['M:pe.put()V', 'put']]
    .map(([symbol, renamedName]) => ({symbol, renamedName, declaration: {file: 'aaa.java'}}));
  const mapping = {symbols, files: [{original: 'aaa.java', renamed: 'aaa.java'}]};
  const result = voidHuntersCoverage(mapping);
  assert.equal(result.classes, 4);
  assert.equal(result.namedClasses, 1);
  assert.equal(result.unresolvedClasses.length, 3);
  assert.equal(result.methods, 4);
  assert.equal(result.namedMethods, 3);
  assert.equal(result.complete, false);
  for (const row of symbols) {
    if (row.symbol.startsWith('C:')) row.renamedName = 'ReviewedRole' + symbols.indexOf(row);
    else if (row.renamedName === 'a') row.renamedName = 'advance';
  }
  assert.equal(voidHuntersCoverage(mapping).complete, true);
});

test('generated partition methods prevent completion even when their class has a readable name', () => {
  const symbols = [['C:loader', 'ComponentDefinitionInitializer'],
    ['M:loader.runPartition0()V', 'runPartition0'],
    ['M:loader.runPartition12()V', 'runPartition12'], ['M:loader.run()V', 'run']]
    .map(([symbol, renamedName]) => ({symbol, renamedName, declaration: {file: 'loader.java'}}));
  const mapping = {symbols, files: [{original: 'loader.java', renamed: 'Initializer.java'}]};
  const result = voidHuntersCoverage(mapping);
  assert.equal(result.namedClasses, 1);
  assert.equal(result.namedMethods, 1);
  assert.deepEqual(result.unresolvedMethods.map(row => row.symbol),
    ['M:loader.runPartition0()V', 'M:loader.runPartition12()V']);
  assert.equal(result.complete, false);
  symbols[1].renamedName = 'initializeEquipmentGeometry';
  symbols[2].renamedName = 'finalizeComponentDefinitionBuffers';
  assert.equal(voidHuntersCoverage(mapping).complete, true);
});
