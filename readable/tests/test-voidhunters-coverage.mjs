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
