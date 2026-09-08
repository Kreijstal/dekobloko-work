#!/usr/bin/env node
'use strict';

// Contract tests for scripts/lib/java-tools.js.
//
// These pin the SIX existing java-tools discovery rules found in the repository
// so that a later, deliberate configuration migration is a visible test change
// rather than a silent behaviour change. They must not be "fixed" by making
// every strategy agree: the divergence is the thing under test.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  AUTHOR_FALLBACK, STRATEGY_NAMES, describeJavaTools, resolveJavaTools,
  javaToolsRequire, javaToolsPath,
} = require('./lib/java-tools');

const REPO = '/repo/dekobloko-work';

// --- strategy A: JAVA_TOOLS_DIR || JT_DIR || author path -------------------
{
  const d = describeJavaTools({
    strategy: 'jtDirWithAuthorFallback', env: {}, repoRoot: REPO,
  });
  assert.equal(d.dir, AUTHOR_FALLBACK,
    'strategy A with an empty environment must reproduce the author fallback');
  assert.equal(d.source, 'author-fallback');
  assert.equal(d.usesAuthorFallback, true);
}
{
  const d = describeJavaTools({
    strategy: 'jtDirWithAuthorFallback', env: {JT_DIR: '/x/jt'}, repoRoot: REPO,
  });
  assert.equal(d.dir, '/x/jt', 'JT_DIR must win over the author fallback');
  assert.equal(d.source, 'JT_DIR');
  assert.equal(d.usesAuthorFallback, false);
}
{
  const d = describeJavaTools({
    strategy: 'jtDirWithAuthorFallback',
    env: {JAVA_TOOLS_DIR: '/a/jt', JT_DIR: '/x/jt'},
    repoRoot: REPO,
  });
  assert.equal(d.dir, '/a/jt', 'JAVA_TOOLS_DIR must win over JT_DIR');
  assert.equal(d.source, 'JAVA_TOOLS_DIR');
}

// --- strategy B: JAVA_TOOLS_DIR || <repo>/../java-tools -------------------
{
  const d = describeJavaTools({
    strategy: 'jtDirWithSiblingFallback', env: {}, repoRoot: REPO,
  });
  assert.equal(d.dir, '/repo/java-tools',
    'strategy B must fall back to the sibling of the repository root');
  assert.equal(d.source, 'sibling-of-repo');
}
{
  // JT_DIR is deliberately NOT consulted by strategy B; the benchmark family
  // never read it. Pinning this prevents an accidental "helpful" widening.
  const d = describeJavaTools({
    strategy: 'jtDirWithSiblingFallback', env: {JT_DIR: '/x/jt'}, repoRoot: REPO,
  });
  assert.equal(d.dir, '/repo/java-tools',
    'strategy B must ignore JT_DIR, matching the benchmark scripts');
}

// --- strategy C: JAVA_TOOLS_DIR || ~/git/java-tools ------------------------
{
  const d = describeJavaTools({
    strategy: 'jtDirWithHomeFallback', env: {}, repoRoot: REPO,
  });
  assert.equal(d.dir, path.join(os.homedir(), 'git', 'java-tools'),
    'strategy C must fall back to ~/git/java-tools');
}

// --- strategy D: JAVA_TOOLS_ROOT only -------------------------------------
{
  const d = describeJavaTools({
    strategy: 'jtRootWithSiblingFallback',
    env: {JAVA_TOOLS_DIR: '/a/jt'},
    repoRoot: REPO,
  });
  assert.equal(d.dir, '/repo/java-tools',
    'strategy D must IGNORE JAVA_TOOLS_DIR: this is the documented divergence ' +
    'that makes README.md\'s "export JAVA_TOOLS_DIR" not configure ' +
    'scripts/serve-game-library.js');
  const withRoot = describeJavaTools({
    strategy: 'jtRootWithSiblingFallback',
    env: {JAVA_TOOLS_ROOT: '/r/jt'},
    repoRoot: REPO,
  });
  assert.equal(withRoot.dir, '/r/jt');
  assert.equal(withRoot.source, 'JAVA_TOOLS_ROOT');
}

// --- strategy F: required, no fallback ------------------------------------
{
  const d = describeJavaTools({strategy: 'required', env: {}, repoRoot: REPO});
  assert.equal(d.dir, null, 'the required strategy must not invent a path');
  assert.throws(
    () => resolveJavaTools({strategy: 'required', env: {}, repoRoot: REPO}),
    (error) => error.code === 'JAVA_TOOLS_NOT_CONFIGURED' &&
      /JAVA_TOOLS_DIR/.test(error.message),
    'a missing prerequisite must fail loudly and name the variable to set');
}

// --- unknown strategy fails loudly ----------------------------------------
assert.throws(
  () => describeJavaTools({strategy: 'nope'}),
  /unknown java-tools discovery strategy/,
  'an unknown strategy must not silently pick a default');

// --- validation: an unusable checkout must fail, not be returned ----------
{
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-empty-'));
  try {
    assert.throws(
      () => resolveJavaTools({
        strategy: 'required', env: {JAVA_TOOLS_DIR: empty}, repoRoot: REPO,
      }),
      (error) => error.code === 'JAVA_TOOLS_UNUSABLE' &&
        error.message.includes('package.json'),
      'a directory without package.json must be rejected, not returned');
    // ...and validation can be turned off explicitly when a caller only needs
    // the path (for example to print it).
    const unchecked = resolveJavaTools({
      strategy: 'required', env: {JAVA_TOOLS_DIR: empty}, repoRoot: REPO,
      validate: false,
    });
    assert.equal(unchecked.dir, empty);
  } finally {
    fs.rmSync(empty, {recursive: true, force: true});
  }
}

// --- the error explains where a bad path came from ------------------------
{
  let message = '';
  try {
    resolveJavaTools({
      strategy: 'jtDirWithAuthorFallback',
      env: {},
      repoRoot: REPO,
      requireEntries: ['definitely-not-present-marker'],
    });
  } catch (error) {
    message = error.message;
  }
  assert.match(message, /author fallback/,
    'when the author fallback loses, the error must say so');
}

// --- real checkout, if one is configured ----------------------------------
{
  const real = process.env.JAVA_TOOLS_DIR;
  if (real && fs.existsSync(path.join(real, 'package.json'))) {
    const d = resolveJavaTools({
      strategy: 'required', env: {JAVA_TOOLS_DIR: real}, repoRoot: REPO,
    });
    assert.equal(d.dir, path.resolve(real));
    const jtRequire = javaToolsRequire(d.dir);
    assert.equal(typeof jtRequire, 'function');
    assert.equal(javaToolsPath(d.dir, 'src'), path.join(d.dir, 'src'));
    console.log(`  (also checked the configured checkout at ${d.dir})`);
  } else {
    console.log('  (JAVA_TOOLS_DIR not configured; skipped the live check)');
  }
}

assert.equal(STRATEGY_NAMES.length, 6, 'six documented strategies');
console.log('PASS lib/java-tools selftest');
