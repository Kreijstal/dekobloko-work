import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installReviewedGame, reviewedRules} from '../reviewed-game.mjs';
import {sourceInventory, sourceIdentity} from '../tools/readable-java.mjs';

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewed-publication-test-'));
  try {
    const repository = path.join(root, 'repository'), generated = path.join(root, 'generated');
    const current = path.join(repository, 'games/fixture'), src = path.join(generated, 'src');
    for (const dir of [current, src]) fs.mkdirSync(path.join(dir, 'nativeapi'), {recursive: true});
    fs.mkdirSync(path.join(repository, 'decompilation'));
    fs.writeFileSync(path.join(current, 'Original.java'), 'class Original {}');
    fs.writeFileSync(path.join(current, 'nativeapi/Binding.java'), 'package nativeapi; public class Binding {}');
    fs.writeFileSync(path.join(src, 'Named.java'), 'class Named {}');
    fs.copyFileSync(path.join(current, 'nativeapi/Binding.java'), path.join(src, 'nativeapi/Binding.java'));
    const manifest = path.join(repository, 'decompilation-provenance.json');
    fs.writeFileSync(manifest, '{"publication":{"games":{"fixture":{}}}}');
    const dictionary = {inputTreeSha256: sourceIdentity(sourceInventory(current)), files: [{}, {}],
      provenance: {source: {commit: 'a'.repeat(40)}, outputTreeSha256: sourceIdentity(sourceInventory(src))},
      generators: {javaTools: {commit: 'b'.repeat(40)}}};
    return run({repository, generated, current, src, manifest, dictionary});
  } finally {fs.rmSync(root, {recursive: true, force: true});}
}

test('packaged Java publishes, checks deterministically and detects nested source edits', () => fixture(f => {
  installReviewedGame(f.repository, 'fixture', f.generated, f.dictionary, 'Reading guide', false);
  assert.equal(fs.existsSync(path.join(f.current, 'Original.java')), false);
  assert.equal(fs.readFileSync(path.join(f.current, 'nativeapi/Binding.java'), 'utf8'), 'package nativeapi; public class Binding {}');
  installReviewedGame(f.repository, 'fixture', f.generated, f.dictionary, 'Reading guide', true);
  fs.appendFileSync(path.join(f.current, 'nativeapi/Binding.java'), '\n// unexpected edit');
  assert.throws(() => installReviewedGame(f.repository, 'fixture', f.generated, f.dictionary, 'Reading guide', true), /differs/);
}));

test('unmanaged nested binary and source symlink are rejected before replacing a publication', () => fixture(f => {
  const binary = path.join(f.current, 'nativeapi/binding.jar'); fs.writeFileSync(binary, 'unmanaged');
  assert.throws(() => installReviewedGame(f.repository, 'fixture', f.generated, f.dictionary, 'Guide', false), /Unmanaged.*binding.jar/);
  assert.equal(fs.existsSync(path.join(f.current, 'Original.java')), true);
  fs.rmSync(binary);
  fs.symlinkSync('Binding.java', path.join(f.current, 'nativeapi/Alias.java'));
  assert.throws(() => installReviewedGame(f.repository, 'fixture', f.generated, f.dictionary, 'Guide', false), /Unmanaged.*Alias.java/);
}));

test('failed receipt installation restores packaged sources and removes a newly installed dictionary', () => fixture(f => {
  const originalManifest = fs.readFileSync(f.manifest), rename = fs.renameSync;
  try {
    fs.renameSync = (from, to) => {if (to === f.manifest) throw new Error('injected installation failure'); return rename(from, to);};
    assert.throws(() => installReviewedGame(f.repository, 'fixture', f.generated, f.dictionary, 'Guide', false), /injected/);
  } finally {fs.renameSync = rename;}
  assert.deepEqual(fs.readFileSync(f.manifest), originalManifest);
  assert.equal(fs.existsSync(path.join(f.current, 'Original.java')), true);
  assert.equal(fs.existsSync(path.join(f.current, 'nativeapi/Binding.java')), true);
  assert.equal(fs.existsSync(path.join(f.repository, 'decompilation/fixture-naming.json')), false);
  assert.equal(fs.readdirSync(f.repository).some(n => n.startsWith('.named-refresh-')), false);
}));

test('reviewed names follow resolved override identities and reject conflicting or external contracts', () => {
  const input = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewed-overrides-'));
  try {
    fs.writeFileSync(path.join(input, 'A.java'), 'class A {void a(int x) {}}');
    const rows = [
      ['D', 'A.java', '6', '7', 'C:A', 'A'],
      ['D', 'A.java', '14', '15', 'M:A.a(I)V', 'a'],
      ['D', 'B.java', '14', '15', 'M:B.a(I)V', 'a'],
      ['D', 'A.java', '20', '21', 'P:A.a(I)V#0', 'x'],
      ['D', 'B.java', '20', '21', 'P:B.a(I)V#0', 'y'],
      ['O', 'M:B.a(I)V', 'M:A.a(I)V'],
    ];
    const members = {'M:A.a(I)V': {to: 'advance', evidence: 'Reviewed update contract.'},
      'P:A.a(I)V#0': {to: 'ticks', evidence: 'Reviewed tick argument.'}};
    const rules = reviewedRules(input, rows, {}, members);
    assert.equal(rules.find(r => r.symbol === 'M:B.a(I)V').to, 'advance');
    assert.equal(rules.find(r => r.symbol === 'P:B.a(I)V#0').to, 'ticks');
    assert.throws(() => reviewedRules(input, rows, {}, {...members, 'M:B.a(I)V': {to: 'render', evidence: 'Conflicting contract.'}}), /Conflicting override/);
    assert.throws(() => reviewedRules(input, [...rows, ['O', 'M:A.a(I)V', 'M:External.a(I)V']], {}, members), /external override/);
  } finally {fs.rmSync(input, {recursive: true, force: true});}
});

test('an already meaningful override name connects the whole family without an endless rewrite', () => {
  const input = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewed-semantic-bridge-'));
  try {
    fs.writeFileSync(path.join(input, 'A.java'), 'class A {}');
    const rows = [
      ['D', 'A.java', '0', '1', 'M:A.a(I)V', 'a'],
      ['D', 'B.java', '0', '1', 'M:B.advance(I)V', 'advance'],
      ['D', 'C.java', '0', '1', 'M:C.c(I)V', 'c'],
      ['D', 'A.java', '0', '1', 'P:A.a(I)V#0', 'ticks'],
      ['D', 'B.java', '0', '1', 'P:B.advance(I)V#0', 'b'],
      ['D', 'C.java', '0', '1', 'P:C.c(I)V#0', 'c'],
      // Reverse order forces another iteration through the semantic bridge.
      ['O', 'M:C.c(I)V', 'M:B.advance(I)V'], ['O', 'M:B.advance(I)V', 'M:A.a(I)V'],
    ];
    const rules = reviewedRules(input, rows, {}, {
      'M:A.a(I)V': {to: 'advance', evidence: 'Reviewed contract.'},
      'P:A.a(I)V#0': {to: 'ticks', evidence: 'Reviewed parameter.'},
    });
    assert.equal(rules.find(r => r.symbol === 'M:C.c(I)V').to, 'advance');
    assert.equal(rules.find(r => r.symbol === 'P:C.c(I)V#0').to, 'ticks');
    assert.equal(rules.some(r => r.symbol === 'M:B.advance(I)V'), false);
    assert.equal(rules.some(r => r.symbol === 'P:A.a(I)V#0'), false);
  } finally {fs.rmSync(input, {recursive: true, force: true});}
});
