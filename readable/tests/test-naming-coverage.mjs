import {test} from 'node:test';
import assert from 'node:assert/strict';
import {namingCoverage, isOpaqueName} from '../naming-coverage.mjs';

const declaration = (symbol, name, file = 'a.java') => ({symbol, renamedName: name, declaration: {file}});
const fixture = symbols => ({symbols, files: [{original: 'a.java', renamed: 'GameScreen.java'}]});

test('coverage includes overloads and nested classes while preserving constructors and callback names', () => {
  const result = namingCoverage(fixture([
    declaration('C:a', 'GameScreen'), declaration('C:a$Nested', 'Nested'),
    declaration('M:a.<init>()V', 'GameScreen'), declaration('M:a.run()V', 'run'),
    declaration('M:a.a(I)V', 'a'), declaration('M:a.a(J)V', 'advance'),
    declaration('F:a.field_a:I', 'field_a'),
  ]));
  assert.equal(result.classes, 2); assert.equal(result.namedClasses, 2);
  assert.equal(result.methods, 3); assert.equal(result.namedMethods, 2); assert.equal(result.constructors, 1);
  assert.deepEqual(result.unresolvedMethods, [{symbol: 'M:a.a(I)V', name: 'a', file: 'GameScreen.java'}]);
  assert.equal(result.complete, false);
  assert.equal(namingCoverage(fixture([declaration('C:a','GameScreen'), declaration('M:a.a()V','advance')])).complete, true);
});

test('numbered or opaque placeholders do not satisfy the naming objective', () => {
  for (const name of ['a','Z','ab','Class42','Method_aa','Helper123','Unknown_oe','$cfr$lcmp','$cfr$intArgs$a$hash']) assert.equal(isOpaqueName(name), true, name);
  for (const name of ['GameScreen','decodeLevelStream','run','read','copy','CfrPartitionedBody','drawPhase2'])
    assert.equal(isOpaqueName(name), false, name);
});

test('coverage rejects incomplete or duplicated inventories', () => {
  assert.throws(() => namingCoverage({}), /resolved/);
  assert.throws(() => namingCoverage(fixture([])), /inventory/);
  assert.throws(() => namingCoverage(fixture([declaration('C:a','GameScreen'),declaration('C:a','GameScreen')])), /Duplicate/);
  assert.throws(() => namingCoverage(fixture([declaration('C:a','GameScreen'),declaration('M:a.a()V','')])), /Missing/);
});
