import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {inventory} from '../../scripts/publish-decompiled-games.mjs';
import {recordVerifiedRawInput} from '../pin-game-input.mjs';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const identity = root => { const {files, sha256} = inventory(root, '.java', ['README.md']); return {files, sha256}; };

function fixture() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'input-pin-test-'));
  const destination = path.join(temporary, 'publication');fs.mkdirSync(destination);
  const git = (...args) => execFileSync('git', ['-C', destination, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  git('init', '--quiet', '--initial-branch=master', '--object-format=sha1');
  git('config', 'user.name', 'Input Pin Test');git('config', 'user.email', 'input-pin@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  const write = (file, bytes) => {const target = path.join(destination, file);fs.mkdirSync(path.dirname(target), {recursive: true});fs.writeFileSync(target, bytes);};
  const rawSources = path.join(temporary, 'raw');fs.mkdirSync(rawSources);
  const raw = 'class a { static int value = 7; }\n';fs.writeFileSync(path.join(rawSources, 'a.java'), raw);
  write('games/demo/Readable.java', 'class Readable { static int value = 3; }\n');
  write('games/demo/README.md', 'Current readable preview\n');
  write('games/other/Other.java', 'class Other {}\n');write('keep me.txt', 'Other tracked content\n');
  const source = {repository: 'fixture', commit: 'c'.repeat(40), subdirectory: 'games/demo'};
  const published = identity(path.join(destination, 'games/demo'));
  const dictionary = {inputTreeSha256: '0'.repeat(64), files: [{}],
    provenance: {source, outputTreeSha256: published.sha256}};
  const dictionaryBytes = JSON.stringify(dictionary) + '\n';write('decompilation/demo-naming.json', dictionaryBytes);
  const receipt = {source, inputTreeSha256: dictionary.inputTreeSha256, sources: published,
    dictionary: {path: 'decompilation/demo-naming.json', sha256: hash(dictionaryBytes)},
    readingGuide: {path: 'games/demo/README.md', sha256: hash('Current readable preview\n')}};
  const manifest = {namedExports: {demo: receipt}, publication: {games: {
    demo: {sources: identity(rawSources), publishedSources: published, sourceGenerator: {commit: 'a'.repeat(40)},
      validation: {bytecodeVerifier: 'pass', javac: 'pass'}},
    other: {sources: identity(path.join(destination, 'games/other')), note: 'keep this record'},
  }}};
  const saveManifest = () => write('decompilation-provenance.json', JSON.stringify(manifest, null, 2) + '\n');
  const commit = message => {git('add', '.');git('commit', '--quiet', '-m', message);return git('rev-parse', 'HEAD');};
  saveManifest();const parent = commit('Initial named publication');
  const pin = () => recordVerifiedRawInput({destination, game: 'demo', rawSources});
  const cleanup = () => fs.rmSync(temporary, {recursive: true, force: true});
  return {temporary, destination, rawSources, raw, git, write, manifest, saveManifest, commit, parent, pin, cleanup};
}

test('raw snapshot preserves the named preview, real index and all unrelated content', () => {
  const f = fixture();
  try {
    const index = f.git('write-tree');const result = f.pin();
    assert.equal(f.git('rev-parse', 'HEAD'), f.parent);assert.equal(f.git('write-tree'), index);
    assert.equal(f.git('status', '--porcelain'), '');assert.equal(result.reference, 'refs/readable-inputs/demo');
    assert.equal(f.git('show', result.commit + ':games/demo/a.java') + '\n', f.raw);
    assert.equal(f.git('show', result.commit + ':games/other/Other.java'), f.git('show', 'HEAD:games/other/Other.java'));
    assert.equal(f.git('show', result.commit + ':keep me.txt'), 'Other tracked content');
    const files = f.git('ls-tree', '-r', '--name-only', result.commit).split('\n');
    assert.ok(files.includes('games/demo/a.java'));
    for (const removed of ['games/demo/Readable.java', 'games/demo/README.md', 'decompilation/demo-naming.json'])
      assert.ok(!files.includes(removed), removed);
    const snapshot = JSON.parse(f.git('show', result.commit + ':decompilation-provenance.json'));
    assert.equal(snapshot.namedExports, undefined);assert.equal(snapshot.publication.games.demo.publishedSources, undefined);
    assert.deepEqual(snapshot.publication.games.demo.sources, f.manifest.publication.games.demo.sources);
    assert.deepEqual(snapshot.publication.games.other, f.manifest.publication.games.other);
    assert.equal(f.git('rev-list', '--parents', '-n', '1', result.commit), result.commit + ' ' + f.parent);
    assert.equal(fs.readFileSync(path.join(f.destination, 'games/demo/README.md'), 'utf8'), 'Current readable preview\n');
    assert.deepEqual(f.pin(), result, 'an unchanged pending snapshot is reused');
    // The final named export can use an ordinary merge commit to keep the raw
    // input reachable, without ever checking raw Java out over the preview.
    f.git('merge', '--no-commit', '--no-ff', '-s', 'ours', result.commit);
    f.git('commit', '--quiet', '-m', 'Attach verified raw input');
    assert.equal(f.git('merge-base', '--is-ancestor', result.commit, 'HEAD'), '');
    assert.equal(f.git('write-tree'), index);assert.equal(f.git('status', '--porcelain'), '');
  } finally {f.cleanup();}
});

for (const change of ['worktree', 'index', 'untracked']) test(`rejects a dirty ${change} without changing refs`, () => {
  const f = fixture();
  try {
    if (change === 'untracked') f.write('untracked.txt', 'keep me');
    else {f.write('keep me.txt', 'changed');if (change === 'index') f.git('add', 'keep me.txt');}
    const index = f.git('write-tree'),status = f.git('status', '--porcelain');
    assert.throws(f.pin, /clean Git worktree and index/);
    assert.equal(f.git('rev-parse', 'HEAD'), f.parent);assert.equal(f.git('write-tree'), index);
    assert.equal(f.git('status', '--porcelain'), status);assert.equal(f.git('for-each-ref', 'refs/readable-inputs'), '');
  } finally {f.cleanup();}
});

test('rejects changed or unexpected raw files before creating a pin', () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.rawSources, 'a.java'), 'class a {}\n');
    assert.throws(f.pin, /differs from the verified published catalog/);
    fs.writeFileSync(path.join(f.rawSources, 'a.java'), f.raw);
    fs.writeFileSync(path.join(f.rawSources, 'stale-report.json'), '{}');
    assert.throws(f.pin, /Unexpected entry/);
    assert.equal(f.git('for-each-ref', 'refs/readable-inputs'), '');assert.equal(f.git('status', '--porcelain'), '');
  } finally {f.cleanup();}
});

test('preserves a different unfinished pin, then permits replacing a reachable pin', () => {
  const f = fixture();
  try {
    const first = f.pin();
    fs.writeFileSync(path.join(f.rawSources, 'a.java'), 'class a { static int value = 9; }\n');
    f.manifest.publication.games.demo.sources = identity(f.rawSources);f.saveManifest();f.commit('New verified catalog record');
    assert.throws(f.pin, /unfinished raw input pin/);
    assert.equal(f.git('rev-parse', first.reference), first.commit);assert.equal(f.git('status', '--porcelain'), '');
    f.git('merge', '--no-commit', '--no-ff', '-s', 'ours', first.commit);f.git('commit', '--quiet', '-m', 'Preserve earlier input');
    const current = f.git('rev-parse', 'HEAD');const second = f.pin();
    assert.notEqual(first.commit, second.commit);assert.equal(second.parent, current);
    assert.equal(f.git('merge-base', '--is-ancestor', first.commit, 'HEAD'), '');
    assert.equal(f.git('rev-parse', first.reference), second.commit);assert.equal(f.git('status', '--porcelain'), '');
  } finally {f.cleanup();}
});

test('does not follow a symbolic input ref or accept a non-commit marker', () => {
  const f = fixture();
  try {
    const reference = 'refs/readable-inputs/demo';
    f.git('symbolic-ref', reference, 'refs/heads/master');
    assert.throws(f.pin, /must not be symbolic/);assert.equal(f.git('rev-parse', 'HEAD'), f.parent);
    f.git('symbolic-ref', '--delete', reference);
    const blob = f.git('rev-parse', 'HEAD:keep me.txt');f.git('update-ref', reference, blob);
    assert.throws(f.pin, /must point directly to a commit/);
    assert.equal(f.git('rev-parse', reference), blob);assert.equal(f.git('status', '--porcelain'), '');
  } finally {f.cleanup();}
});

test('a game already published as matching raw Java needs no extra snapshot', () => {
  const f = fixture();
  try {
    delete f.manifest.namedExports;delete f.manifest.publication.games.demo.publishedSources;
    fs.rmSync(path.join(f.destination, 'games/demo'), {recursive: true});
    f.write('games/demo/a.java', f.raw);fs.unlinkSync(path.join(f.destination, 'decompilation/demo-naming.json'));
    f.saveManifest();const parent = f.commit('Publish raw source directly');
    const result = f.pin();assert.equal(result.commit, parent);assert.equal(result.reference, null);
    assert.equal(f.git('rev-parse', 'HEAD'), parent);assert.equal(f.git('status', '--porcelain'), '');
    assert.equal(f.git('for-each-ref', 'refs/readable-inputs'), '');
  } finally {f.cleanup();}
});

test('a stale named receipt cannot be turned into a raw input snapshot', () => {
  const f = fixture();
  try {
    const file = path.join(f.destination, 'decompilation/demo-naming.json');
    fs.appendFileSync(file, '\n');const parent = f.commit('Break the dictionary receipt');
    assert.throws(f.pin, /Named export identity differs/);
    assert.equal(f.git('rev-parse', 'HEAD'), parent);assert.equal(f.git('status', '--porcelain'), '');
    assert.equal(f.git('for-each-ref', 'refs/readable-inputs'), '');
  } finally {f.cleanup();}
});

test('an in-progress ours merge is not mistaken for a clean committed publication', () => {
  const f = fixture();
  try {
    const result = f.pin();f.git('merge', '--no-commit', '--no-ff', '-s', 'ours', result.commit);
    assert.equal(f.git('status', '--porcelain'), '', 'this merge has no staged file changes');
    assert.throws(f.pin, /clean Git worktree and index/);
    assert.equal(f.git('rev-parse', 'HEAD'), f.parent);assert.equal(f.git('rev-parse', result.reference), result.commit);
  } finally {f.cleanup();}
});
