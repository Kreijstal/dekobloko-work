import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inventory, validateReport, pipelineCheckEnvironment, validateNamedExport, validateRawClassRepairs} from './publish-decompiled-games.mjs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

test('named exports retain raw class repair proofs through their immutable input pin', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'named-repair-test-'));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const git = (...args) => execFileSync('git', ['-C', root, ...args], {encoding:'utf8'}).trim();
  try {
    const directory = path.join(root,'games/fixture');fs.mkdirSync(directory,{recursive:true});
    fs.mkdirSync(path.join(root,'decompilation'));
    const original='class A {}';fs.writeFileSync(path.join(directory,'A.java'),original);
    const rawSources=inventory(directory,'.java');
    git('init','--quiet');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','Raw input');
    const source={commit:git('rev-parse','HEAD'),subdirectory:'games/fixture'};
    fs.unlinkSync(path.join(directory,'A.java'));fs.writeFileSync(path.join(directory,'Named.java'),'class Named {}');
    fs.writeFileSync(path.join(directory,'README.md'),'Guide');const sources=inventory(directory,'.java',['README.md']);
    const dictionary={inputTreeSha256:'c'.repeat(64),files:[{}],
      provenance:{source,baseInputTreeSha256:rawSources.sha256,outputTreeSha256:sources.sha256}};
    const bytes=JSON.stringify(dictionary);fs.writeFileSync(path.join(root,'decompilation/fixture-naming.json'),bytes);
    const named={source,inputTreeSha256:dictionary.inputTreeSha256,sources,
      dictionary:{path:'decompilation/fixture-naming.json',sha256:hash(bytes)},
      readingGuide:{path:'games/fixture/README.md',sha256:hash('Guide')}};
    const repair={output:{path:'games/fixture/A.java',sha256:hash(original)},
      generator:{commit:'a'.repeat(40),execution:'committed-source-archive',sourceArchive:{sha256:'b'.repeat(64)}},
      validation:{wholeGameJavac:'pass',sources:1}};
    const record={sources:rawSources,sourceRepairs:{classes:{'A.java':repair}}};
    assert.doesNotThrow(()=>validateRawClassRepairs(root,'fixture',record,named));
    assert.throws(()=>validateRawClassRepairs(root,'fixture',{...record,sources:{...rawSources,sha256:'f'.repeat(64)}},named),/input differs/);
    repair.output.sha256='d'.repeat(64);
    assert.throws(()=>validateRawClassRepairs(root,'fixture',record,named),/identity differs/);
    repair.output.sha256=hash(original);fs.writeFileSync(path.join(directory,'Named.java'),'class Named { int changed; }');
    assert.throws(()=>validateRawClassRepairs(root,'fixture',record,named),/identity differs/);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('raw class refreshes pin the output, compiler archive and semantic result', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'raw-refresh-test-'));
  try {
    const game = path.join(root, 'games/fixture'); fs.mkdirSync(game, {recursive: true});
    const java = 'class A {}'; fs.writeFileSync(path.join(game, 'A.java'), java);
    const receipt = {output: {path: 'games/fixture/A.java', sha256: createHash('sha256').update(java).digest('hex')},
      generator: {commit: 'a'.repeat(40), execution: 'committed-source-archive', sourceArchive: {sha256: 'b'.repeat(64)}},
      validation: {wholeGameJavac: 'pass', sources: 1, originalBytecodeProbe: {reference: 'mask=256', rebuilt: 'mask=256'}}};
    const record = {sources: {files: 1}, sourceRepairs: {classes: {'A.java': receipt}}};
    assert.doesNotThrow(() => validateRawClassRepairs(root, 'fixture', record));
    for (const mutate of [r => {r.output.path = '../escape';}, r => {r.generator.sourceArchive.sha256 = 'unknown';},
      r => {r.validation.sources = 2;}, r => {r.validation.originalBytecodeProbe.rebuilt = 'mask=0';}]) {
      const changed = structuredClone(receipt); mutate(changed);
      assert.throws(() => validateRawClassRepairs(root, 'fixture', {...record, sourceRepairs: {classes: {'A.java': changed}}}), /differs/);
    }
    fs.writeFileSync(path.join(game, 'A.java'), java + ' ');
    assert.throws(() => validateRawClassRepairs(root, 'fixture', record), /identity differs/);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('named catalog publication verifies its Java, guide and reverse dictionary together', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'named-catalog-test-'));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  try {
    const game = path.join(root, 'games/fixture');fs.mkdirSync(game, {recursive: true});fs.mkdirSync(path.join(root, 'decompilation'));
    fs.writeFileSync(path.join(game, 'Named.java'), 'class Named {}');fs.writeFileSync(path.join(game, 'README.md'), 'Current guide');
    const sources = inventory(game, '.java', ['README.md']);
    const source = {commit: 'a'.repeat(40), subdirectory: 'games/fixture'};
    const dictionary = JSON.stringify({inputTreeSha256: 'b'.repeat(64), files: [{}], provenance: {source, outputTreeSha256: sources.sha256}});
    fs.writeFileSync(path.join(root, 'decompilation/fixture-naming.json'), dictionary);
    const receipt = {source, inputTreeSha256: 'b'.repeat(64), sources,
      dictionary: {path: 'decompilation/fixture-naming.json', sha256: hash(dictionary)},
      readingGuide: {path: 'games/fixture/README.md', sha256: hash('Current guide')}};
    assert.equal(validateNamedExport(root, 'fixture', receipt).files, 1);
    fs.writeFileSync(path.join(game, 'Named.java'), 'class Named { int changed; }');
    assert.throws(() => validateNamedExport(root, 'fixture', receipt), /identity differs/);
    fs.writeFileSync(path.join(game, 'Named.java'), 'class Named {}');
    fs.writeFileSync(path.join(game, 'README.md'), 'Stale guide');
    assert.throws(() => validateNamedExport(root, 'fixture', receipt), /identity differs/);
    assert.throws(() => validateNamedExport(root, 'fixture', {...receipt, dictionary: {...receipt.dictionary, path: '../escape'}}), /paths/);
    fs.writeFileSync(path.join(game, 'dependency.jar'), 'binary');
    assert.throws(() => inventory(game, '.java', ['README.md']), /Unexpected entry/);
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});

test('pipeline retries may change recorded execution timeouts but never transformation gates', () => {
  const batch = {PIPELINE_ALLOW_MUTUALLY_GUARDED_FALSE_CYCLES: '1'};
  const retry = {...batch, PIPELINE_TIMEOUT_SECONDS: '7200'};
  assert.deepEqual(pipelineCheckEnvironment(batch, retry, {
    PATH: '/bin', PIPELINE_TIMEOUT_SECONDS: '1', BULK_PIPELINE_UNRECORDED: '1', SKIP_PIPELINE_PASSES: 'unsafe',
  }), {PATH: '/bin', ...retry});
  assert.deepEqual(pipelineCheckEnvironment(retry, batch, {}), batch);
  for (const changed of [{...retry, PIPELINE_ALLOW_MUTUALLY_GUARDED_FALSE_CYCLES: '0'},
    {...retry, BULK_PIPELINE_UNKNOWN_GATE: '1'}, {}, null])
    assert.throws(() => pipelineCheckEnvironment(batch, changed, {}), /environment/);
  assert.deepEqual(pipelineCheckEnvironment(batch, {...batch, PIPELINE_TIMEOUT_SECONDS: '0'}, {}),
    {...batch, PIPELINE_TIMEOUT_SECONDS: '0'});
  for (const value of ['-1', 'NaN', '7200.5', '9007199254740992', 7200])
    assert.throws(() => pipelineCheckEnvironment(batch, {...batch, PIPELINE_TIMEOUT_SECONDS: value}, {}), /timeout/);
});

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
    fs.mkdirSync(path.join(root, 'a'));
    fs.writeFileSync(path.join(root, 'a', 'nested.java'), 'class Nested {}');
    const original = inventory(root, '.java');
    assert.deepEqual(original.entries.map(([name]) => name), ['a.java', 'a/nested.java', 'b.java']);
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
