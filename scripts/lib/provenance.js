'use strict';

// Provenance primitives: content digests and git working-tree state.
//
// Six scripts had byte-identical private `sha256(file)` helpers and five had
// mutually incompatible git-metadata helpers that recorded the same commit
// under four different key names (`revisionSha1`, `commitSha1`, `commit`,
// `revision`). This module owns the computation. It deliberately does NOT own
// the on-disk field names: each caller keeps the result schema it already
// writes, so previously recorded results stay readable. Use the `as*` adapters
// below to map the canonical record onto an existing schema.
//
// No import-time side effects: nothing here runs until it is called.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

function sha256Text(text) {
  return sha256Buffer(Buffer.from(String(text), 'utf8'));
}

// Deterministic digest of a directory's file contents and relative paths.
// Extracted unchanged from benchmark-dekobloko-animation.js:141 and
// benchmark-dekobloko-node-logo.js:91, which used the same algorithm (sorted
// relative path, NUL, bytes, NUL) but returned different shapes.
function sortedFiles(directory) {
  const files = [];
  const visit = (relative) => {
    const absolute = path.join(directory, relative);
    for (const name of fs.readdirSync(absolute).sort()) {
      const childRelative = relative ? path.join(relative, name) : name;
      const child = path.join(directory, childRelative);
      if (fs.statSync(child).isDirectory()) visit(childRelative);
      else files.push(childRelative);
    }
  };
  visit('');
  return files;
}

function hashTree(directory) {
  const digest = crypto.createHash('sha256');
  const files = sortedFiles(directory);
  for (const relative of files) {
    digest.update(relative.split(path.sep).join('/'));
    digest.update('\0');
    digest.update(fs.readFileSync(path.join(directory, relative)));
    digest.update('\0');
  }
  return {sha256: digest.digest('hex'), files: files.length};
}

function git(directory, args, {binary = false} = {}) {
  return execFileSync('git', ['-C', directory, ...args], {
    encoding: binary ? null : 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

// Canonical working-tree record for one checkout.
//
// `available` is explicit: a directory that is not a git checkout, or a git
// binary that is missing, yields `available: false` with the error text rather
// than nulls that read as "clean". Never report a missing measurement as zero.
//
// `includePatch` additionally records the tracked diff against HEAD, which is
// what makes a dirty result reproducible at all.
function gitTreeState(directory, {includePatch = false} = {}) {
  const record = {
    path: directory,
    available: false,
    error: null,
    commit: null,
    tree: null,
    trackedDirty: null,
    dirty: null,
    untrackedPaths: null,
  };
  try {
    const status = git(directory, ['status', '--porcelain', '--untracked-files=all']);
    const trackedStatus = git(directory, ['status', '--porcelain', '--untracked-files=no']);
    record.available = true;
    record.commit = git(directory, ['rev-parse', 'HEAD']).trim();
    record.tree = git(directory, ['rev-parse', 'HEAD^{tree}']).trim();
    record.trackedDirty = trackedStatus.trim().length > 0;
    record.dirty = status.trim().length > 0;
    record.untrackedPaths = status
      .split(/\r?\n/)
      .filter((line) => line.startsWith('??'))
      .map((line) => line.slice(3));
    if (includePatch) {
      const patch = git(directory, ['diff', '--binary', 'HEAD'], {binary: true});
      record.trackedPatchBytes = patch.length;
      record.trackedPatchSha256 = sha256Buffer(patch);
      record.trackedPatch = patch;
    }
  } catch (error) {
    record.error = String(error && error.message ? error.message : error);
  }
  return record;
}

// --- schema adapters -------------------------------------------------------
// Each existing result file keeps the exact key names it already used. Do not
// "unify" these without versioning the result schema; old raw results must
// stay readable and comparable.

// scripts/benchmark-dekobloko-animation.js, scripts/serve-audio-diagnostics.js
function asRevisionSha1Schema(state) {
  return {
    revisionSha1: state.commit,
    treeSha1: state.tree,
    trackedDirty: state.trackedDirty,
    dirty: state.dirty,
  };
}

// scripts/benchmark-guest-mixer-node.js
function asRevisionSchema(state) {
  return {
    revision: state.commit,
    trackedDirty: state.trackedDirty,
    dirty: state.dirty,
  };
}

// scripts/launch-alterorb-games-jvmjs.js
function asCommitSchema(state) {
  return {
    path: state.path,
    commit: state.commit,
    dirty: state.dirty,
    trackedDirty: state.trackedDirty,
  };
}

module.exports = {
  sha256Buffer,
  sha256File,
  sha256Text,
  sortedFiles,
  hashTree,
  gitTreeState,
  asRevisionSha1Schema,
  asRevisionSchema,
  asCommitSchema,
};
