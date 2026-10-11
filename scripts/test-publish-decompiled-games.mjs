import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inventory, validateReport} from './publish-decompiled-games.mjs';

test('catalog publisher rejects failed, missing and inconsistent validation', () => {
  const report = {game: 'fixture', status: 'pass', hardFailures: 0, classes: 2, sources: 2,
    failures: {pipeline: 0, cli: 0, verify: 0, javac: 0}};
  const diagnostics = {generatedFiles: 2, hardFailures: 0, validFallbacks: 0, panics: [],
    totals: {stackUnderflow: 0, rawControlFlow: 0, placeholders: 0}};
  const identity = {files: 2};
  assert.doesNotThrow(() => validateReport('fixture', report, diagnostics, identity, identity));
  for (const field of ['pipeline', 'cli', 'verify', 'javac']) {
    const failed = structuredClone(report);
    failed.failures[field] = 1;
    assert.throws(() => validateReport('fixture', failed, diagnostics, identity, identity), /failed export/);
    delete failed.failures[field];
    assert.throws(() => validateReport('fixture', failed, diagnostics, identity, identity), /failed export/);
  }
  for (const changed of [{...diagnostics, panics: ['panic']}, {...diagnostics, generatedFiles: 1},
    {...diagnostics, hardFailures: 1}, {...diagnostics, totals: {...diagnostics.totals, placeholders: 1}}])
    assert.throws(() => validateReport('fixture', report, changed, identity, identity), /failed export/);
  assert.throws(() => validateReport('other', report, diagnostics, identity, identity), /failed export/);
  assert.throws(() => validateReport('fixture', report, diagnostics, identity, {files: 1}), /failed export/);
});

test('catalog identity detects edits, renames and unsafe output entries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'funorb-inventory-test-'));
  try {
    fs.writeFileSync(path.join(root, 'b.java'), 'class B {}');
    fs.writeFileSync(path.join(root, 'a.java'), 'class A {}');
    const original = inventory(root, '.java');
    assert.deepEqual(original.entries.map(([name]) => name), ['a.java', 'b.java']);
    assert.equal(inventory(root, '.java').sha256, original.sha256);
    fs.writeFileSync(path.join(root, 'b.java'), 'class B { int value; }');
    assert.notEqual(inventory(root, '.java').sha256, original.sha256);
    fs.renameSync(path.join(root, 'a.java'), path.join(root, 'c.java'));
    assert.notEqual(inventory(root, '.java').sha256, original.sha256);
    fs.symlinkSync('b.java', path.join(root, 'link.java'));
    assert.throws(() => inventory(root, '.java'), /Unsafe entry/);
    fs.unlinkSync(path.join(root, 'link.java'));
    fs.writeFileSync(path.join(root, 'unexpected.json'), '{}');
    assert.throws(() => inventory(root, '.java'), /Unexpected entry/);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});
