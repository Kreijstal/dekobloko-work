#!/usr/bin/env node
'use strict';

// Contract tests for scripts/lib/provenance.js.
//
// The point of these tests is that the extracted helpers reproduce, byte for
// byte, what the six private copies computed, and that the schema adapters
// keep each result file's EXISTING key names. Old raw results must stay
// readable, so the adapters are part of the contract, not a convenience.

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');

const {
  sha256Buffer, sha256File, sha256Text, sortedFiles, hashTree, gitTreeState,
  asRevisionSha1Schema, asRevisionSchema, asCommitSchema,
} = require('./lib/provenance');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'provenance-test-'));
try {
  // --- digests reproduce the original inline implementations ---------------
  const file = path.join(temporary, 'sample.bin');
  fs.writeFileSync(file, Buffer.from([1, 2, 3, 4]));
  const expected = crypto.createHash('sha256')
    .update(fs.readFileSync(file)).digest('hex');
  assert.equal(sha256File(file), expected,
    'sha256File must equal the inline helper it replaced');
  assert.equal(sha256Buffer(fs.readFileSync(file)), expected);
  assert.equal(
    sha256Text('abc'),
    crypto.createHash('sha256').update(Buffer.from('abc', 'utf8')).digest('hex'));

  // --- hashTree: sorted, path-and-content sensitive ------------------------
  const tree = path.join(temporary, 'tree');
  fs.mkdirSync(path.join(tree, 'pkg'), {recursive: true});
  fs.writeFileSync(path.join(tree, 'B.class'), 'bbb');
  fs.writeFileSync(path.join(tree, 'A.class'), 'aaa');
  fs.writeFileSync(path.join(tree, 'pkg', 'C.class'), 'ccc');

  assert.deepEqual(sortedFiles(tree),
    ['A.class', 'B.class', path.join('pkg', 'C.class')],
    'files must be visited in sorted order so the digest is deterministic');

  const first = hashTree(tree);
  assert.equal(first.files, 3);
  assert.equal(hashTree(tree).sha256, first.sha256, 'hashTree must be stable');

  // Content change moves the digest.
  fs.writeFileSync(path.join(tree, 'A.class'), 'aaaa');
  assert.notEqual(hashTree(tree).sha256, first.sha256,
    'a content change must move the tree digest');
  fs.writeFileSync(path.join(tree, 'A.class'), 'aaa');
  assert.equal(hashTree(tree).sha256, first.sha256);

  // A rename that preserves content must ALSO move the digest, because the
  // relative path is mixed in. This is the property the class-tree provenance
  // stamps rely on.
  fs.renameSync(path.join(tree, 'B.class'), path.join(tree, 'D.class'));
  assert.notEqual(hashTree(tree).sha256, first.sha256,
    'a rename must move the tree digest');

  // --- gitTreeState on a real repository -----------------------------------
  const repo = path.join(temporary, 'repo');
  fs.mkdirSync(repo);
  const git = (...args) => execFileSync('git', ['-C', repo, ...args],
    {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Test');
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'one\n');
  git('add', 'tracked.txt');
  git('commit', '-q', '-m', 'first');

  const clean = gitTreeState(repo);
  assert.equal(clean.available, true);
  assert.equal(clean.error, null);
  assert.match(clean.commit, /^[0-9a-f]{40}$/);
  assert.match(clean.tree, /^[0-9a-f]{40}$/);
  assert.equal(clean.dirty, false, 'a clean checkout must not report dirty');
  assert.equal(clean.trackedDirty, false);
  assert.deepEqual(clean.untrackedPaths, []);

  // An untracked file makes `dirty` true but leaves `trackedDirty` false --
  // exactly the distinction the launcher reports rely on.
  fs.writeFileSync(path.join(repo, 'scratch.txt'), 'x\n');
  const untracked = gitTreeState(repo);
  assert.equal(untracked.dirty, true);
  assert.equal(untracked.trackedDirty, false,
    'an untracked file must not be reported as a tracked modification');
  assert.deepEqual(untracked.untrackedPaths, ['scratch.txt']);

  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'two\n');
  const modified = gitTreeState(repo, {includePatch: true});
  assert.equal(modified.trackedDirty, true);
  assert.ok(modified.trackedPatchBytes > 0,
    'a dirty tracked file must produce a non-empty patch');
  assert.match(modified.trackedPatchSha256, /^[0-9a-f]{64}$/);
  assert.ok(modified.trackedPatch.includes('two'),
    'the patch must actually carry the change that makes the run reproducible');

  // --- a non-repository is reported as unavailable, never as clean ---------
  const notARepo = path.join(temporary, 'plain');
  fs.mkdirSync(notARepo);
  const missing = gitTreeState(notARepo);
  assert.equal(missing.available, false,
    'a non-repository must report available:false');
  assert.equal(missing.dirty, null,
    'an unavailable measurement must be null, never false and never 0');
  assert.ok(missing.error, 'the failure reason must be recorded');

  // --- schema adapters preserve the existing on-disk key names -------------
  const state = clean;
  assert.deepEqual(Object.keys(asRevisionSha1Schema(state)).sort(),
    ['dirty', 'trackedDirty', 'treeSha1', 'revisionSha1'].sort(),
    'benchmark-dekobloko-animation.js / serve-audio-diagnostics.js schema');
  assert.equal(asRevisionSha1Schema(state).revisionSha1, state.commit);

  assert.deepEqual(Object.keys(asRevisionSchema(state)).sort(),
    ['dirty', 'revision', 'trackedDirty'].sort(),
    'benchmark-guest-mixer-node.js schema');
  assert.equal(asRevisionSchema(state).revision, state.commit);

  assert.deepEqual(Object.keys(asCommitSchema(state)).sort(),
    ['commit', 'dirty', 'path', 'trackedDirty'].sort(),
    'launch-alterorb-games-jvmjs.js schema');
  assert.equal(asCommitSchema(state).commit, state.commit);
  assert.equal(asCommitSchema(state).path, repo);
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}

console.log('PASS lib/provenance selftest');
