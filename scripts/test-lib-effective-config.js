#!/usr/bin/env node
'use strict';

// Contract tests for scripts/lib/effective-config.js.
//
// The registry is documentation that is executable, so it is tested like code:
// every documented consumer must still exist at the line it claims, and the
// snapshot must distinguish "unset" from "set to empty" so a result file can
// never imply a default that was never applied.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const config = require('./lib/effective-config');

const REPO = config.REPO_ROOT;

// --- the registry is well formed ------------------------------------------
assert.ok(config.REGISTRY.length > 30, 'the registry must be populated');
const names = config.REGISTRY.map((entry) => entry.name);
assert.equal(new Set(names).size, names.length,
  'each variable must appear exactly once');
for (const entry of config.REGISTRY) {
  assert.match(entry.name, /^[A-Z][A-Z0-9_]*$/, `bad name ${entry.name}`);
  assert.ok(entry.summary, `${entry.name} needs a summary`);
  assert.ok(entry.group, `${entry.name} needs a group`);
  assert.ok(entry.defaultText, `${entry.name} needs a documented default`);
  assert.ok(Array.isArray(entry.consumers) && entry.consumers.length > 0,
    `${entry.name} must name at least one consumer`);
}

// --- every documented consumer must exist and still read the variable ----
// Line numbers are deliberately NOT stored in the registry: they rot on the
// next edit. What is pinned is the file, and that the file still mentions the
// variable. locateConsumers() resolves the live line numbers.
const missingFiles = [];
const staleConsumers = [];
for (const entry of config.REGISTRY) {
  const located = config.locateConsumers(entry);
  assert.equal(located.length, entry.consumers.length);
  for (const consumer of located) {
    assert.ok(!/:\d+$/.test(consumer.file),
      `${entry.name}: consumers must be plain paths, not file:line ` +
      `(got ${consumer.file})`);
    if (!consumer.exists) {
      missingFiles.push(`${entry.name} -> ${consumer.file}`);
    } else if (consumer.stale) {
      staleConsumers.push(`${entry.name} -> ${consumer.file}`);
    } else {
      assert.ok(consumer.lines.every((line) => Number.isInteger(line) && line > 0),
        `${entry.name}: resolved lines must be positive integers`);
    }
  }
}
assert.deepEqual(missingFiles, [],
  'the registry names consumer files that do not exist');
assert.deepEqual(staleConsumers, [],
  'the registry names files that no longer read the variable');

// A consumer that stops reading its variable must be reported, not ignored.
{
  const located = config.locateConsumers(
    {name: 'A_NAME_NO_FILE_CONTAINS_XYZZY', consumers: ['README.md']});
  assert.equal(located[0].exists, true);
  assert.equal(located[0].stale, true,
    'a file that does not mention the variable must be flagged stale');
  assert.deepEqual(located[0].lines, []);
}
{
  const located = config.locateConsumers(
    {name: 'ANY', consumers: ['scripts/does-not-exist.js']});
  assert.equal(located[0].exists, false);
  assert.equal(located[0].stale, true);
}

// --- divergences are recorded, not silently smoothed over -----------------
const divergent = config.divergences().map((entry) => entry.name).sort();
assert.deepEqual(divergent, [
  'GAME_LIBRARY_BUNDLE_DIR', 'JAVA_TOOLS_DIR', 'JAVA_TOOLS_NODE_DEPS_DIR',
  'JAVA_TOOLS_ROOT',
], 'the four known configuration divergences must stay recorded until migrated');
for (const entry of config.divergences()) {
  assert.ok(entry.note && entry.note.length > 40,
    `${entry.name} must explain its divergence`);
}

// --- runtime gates are classified as java-tools', not ours ----------------
assert.equal(config.isRuntimeGate('JVM_WASM_JIT'), true);
assert.equal(config.isRuntimeGate('STRUCTURED_GOTO_CLONE_RETURN'), true);
assert.equal(config.isRuntimeGate('BULK_PIPELINE_CLASS_FILTER'), true);
assert.equal(config.isRuntimeGate('GAME_LIBRARY_PORT'), false);
for (const entry of config.REGISTRY) {
  assert.equal(config.isRuntimeGate(entry.name), false,
    `${entry.name} is documented here, so it must not also be a runtime gate`);
}

// --- snapshot separates unset from empty ----------------------------------
{
  const snapshot = config.snapshot({}, {includeRuntimeGates: false});
  assert.equal(snapshot.schema, 'dekobloko-work/effective-config@1');
  assert.deepEqual(snapshot.set, {},
    'nothing configured means nothing in `set` -- never a synthesised default');
  assert.equal(snapshot.unset.length, config.REGISTRY.length);
  assert.equal(snapshot.runtimeGates, undefined);
}
{
  const snapshot = config.snapshot(
    {GAME_LIBRARY_PORT: '', JAVA_TOOLS_DIR: '/a/jt'},
    {includeRuntimeGates: false});
  assert.equal(snapshot.set.GAME_LIBRARY_PORT, '',
    'a variable set to empty must be reported as set-and-empty');
  assert.equal(snapshot.set.JAVA_TOOLS_DIR, '/a/jt');
  assert.ok(!snapshot.unset.includes('GAME_LIBRARY_PORT'));
  assert.ok(snapshot.unset.includes('GAME_LIBRARY_TELEMETRY_PATH'));
}
{
  const snapshot = config.snapshot({
    JVM_WASM_JIT: '1', STRUCTURED_GOTO_CLONE_RETURN: '0', PATH: '/usr/bin',
  });
  assert.deepEqual(snapshot.runtimeGates,
    {JVM_WASM_JIT: '1', STRUCTURED_GOTO_CLONE_RETURN: '0'},
    'runtime gates are captured for provenance; unrelated variables are not');
  assert.ok(snapshot.runtimeGatesNote.includes('java-tools'));
}

// --- the snapshot records enough to reproduce the run ---------------------
{
  const snapshot = config.snapshot();
  assert.equal(snapshot.repoRoot, REPO);
  assert.equal(snapshot.node, process.version);
  assert.equal(typeof snapshot.cwd, 'string');
  assert.match(snapshot.platform, /^[a-z0-9]+-[a-z0-9]+$/);
}

console.log(
  `PASS lib/effective-config selftest ` +
  `(${config.REGISTRY.length} variables, ${config.GROUPS.length} groups, ` +
  `${divergent.length} recorded divergences)`);
