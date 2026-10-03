import path from 'node:path';
import {funorbRepository} from '../layout.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {validateTextResourceEvidence} from '../text-resource-evidence.mjs';

const source = fs.readFileSync(path.join(funorbRepository, 'games/geoblox/wi.java'), 'utf8');
const current = JSON.parse(fs.readFileSync(new URL('../geoblox-rules.json', import.meta.url)));
const check = change => {
  const manifest = structuredClone(current.publication.textResources);
  const rules = structuredClone(current.renames);
  change?.(manifest, rules);
  return validateTextResourceEvidence(source, manifest, rules);
};

test('the current manifest verifies all guarded resource assignments', () => {
  assert.deepEqual(check(), {resourceFields: 152, storedReads: 218, discardedReads: 526});
});
test('resource evidence cannot change the pinned loader bytes', () => {
  assert.throws(() => validateTextResourceEvidence(source + '\n', current.publication.textResources,
    current.renames), /loader source differs/);
});
test('a named field cannot borrow a resource key or array index', () => {
  assert.throws(() => check(data => { data.resourceAssignments[0].resources[0].key = 'wrong'; }),
    /direct guarded assignments/);
  assert.throws(() => check(data => { data.resourceAssignments[0].resources[0].index = 3; }),
    /direct guarded assignments/);
});
test('discarded decodes cannot acquire invented named fields', () => {
  assert.throws(() => check(data => { data.resourceAssignments[0].symbol = 'F:wi.field_unknown:Ljava/lang/String;'; }),
    /direct guarded assignments/);
  assert.throws(() => check(data => { data.review.discardedReadsUnnamed--; }), /strictly equal/);
});
test('the current rules preserve every resource spelling and reviewed name', () => {
  assert.throws(() => check((data, rules) => {
    rules.find(rule => rule.symbol === data.resourceAssignments[0].symbol).originalName = 'different';
  }), /spelling guard differs/);
  assert.throws(() => check(data => { data.resourceAssignments[0].to = 'different'; }), /reviewed name/);
});
test('unqualified loading graphics retain their owning class', () => {
  const binding = current.publication.textResources.resourceAssignments.find(item =>
    item.symbol === 'F:wi.field_F:Ljava/lang/String;');
  assert.equal(binding.to, 'loadingGraphicsText');
  assert.deepEqual(binding.resources.map(item => item.key), ['loading_graphics']);
  assert.throws(() => check(data => {
    data.resourceAssignments = data.resourceAssignments.filter(item => item.symbol !== binding.symbol);
  }), /direct guarded assignments/);
});
