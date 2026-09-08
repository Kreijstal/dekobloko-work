'use strict';

// Locating the java-tools checkout.
//
// java-tools is a pinned sibling dependency (generic compiler, interpreter,
// JIT and JVM runtime). dekobloko-work owns application integration and
// tooling; it never vendors java-tools, it locates it.
//
// Before this module there were SIX mutually incompatible discovery rules in
// scripts/ alone (see docs/configuration.md for the full table and the audit
// that produced it):
//
//   A  JAVA_TOOLS_DIR || JT_DIR || '/home/kreijstal/git/java-tools'
//   B  JAVA_TOOLS_DIR || <repo>/../java-tools
//   C  JAVA_TOOLS_DIR || ~/git/java-tools
//   D  JAVA_TOOLS_ROOT || <repo>/../java-tools      (different variable!)
//   E  JAVA_TOOLS_DIR || '/home/kreijstal/git/java-tools'   (no JT_DIR)
//   F  JAVA_TOOLS_DIR required, exit 2 when unset
//
// Rules A and E hardcode the author's home directory, so on any other machine
// they resolve to a path that does not exist and then fail somewhere deep
// inside a require(). Rule D means `export JAVA_TOOLS_DIR=...`, which is what
// the README tells you to do, does NOT configure scripts/serve-game-library.js.
//
// This module does not silently pick a winner. Removing an author-specific
// implicit fallback changes behaviour, so it is a separately tested
// configuration migration, not part of a mechanical extraction. Each strategy
// below reproduces one existing rule EXACTLY; call sites keep their current
// behaviour while gaining a loud, actionable failure and an inspectable record
// of which source won.
//
// No import-time side effects.

const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const AUTHOR_FALLBACK = '/home/kreijstal/git/java-tools';

// Ordered candidate lists. Each entry is [sourceLabel, valueFactory].
const STRATEGIES = {
  // A: the pipeline / CFR family.
  jtDirWithAuthorFallback: (env, repoRoot) => [
    ['JAVA_TOOLS_DIR', env.JAVA_TOOLS_DIR],
    ['JT_DIR', env.JT_DIR],
    ['author-fallback', AUTHOR_FALLBACK],
  ],
  // B: the benchmark / diagnostics family.
  jtDirWithSiblingFallback: (env, repoRoot) => [
    ['JAVA_TOOLS_DIR', env.JAVA_TOOLS_DIR],
    ['sibling-of-repo', path.join(repoRoot, '..', 'java-tools')],
  ],
  // C: the headless-runner family.
  jtDirWithHomeFallback: (env, repoRoot) => [
    ['JAVA_TOOLS_DIR', env.JAVA_TOOLS_DIR],
    ['home-git', path.join(os.homedir(), 'git', 'java-tools')],
  ],
  // D: scripts/serve-game-library.js and docs/browser-game-library.md.
  jtRootWithSiblingFallback: (env, repoRoot) => [
    ['JAVA_TOOLS_ROOT', env.JAVA_TOOLS_ROOT],
    ['sibling-of-repo', path.join(repoRoot, '..', 'java-tools')],
  ],
  // E: like A without JT_DIR.
  jtDirOnlyWithAuthorFallback: (env, repoRoot) => [
    ['JAVA_TOOLS_DIR', env.JAVA_TOOLS_DIR],
    ['author-fallback', AUTHOR_FALLBACK],
  ],
  // F: no fallback at all. This is the behaviour every call site should
  // eventually adopt, because it is the only one that is portable.
  required: (env, repoRoot) => [
    ['JAVA_TOOLS_DIR', env.JAVA_TOOLS_DIR],
    ['JT_DIR', env.JT_DIR],
  ],
};

const STRATEGY_NAMES = Object.keys(STRATEGIES);

// Returns {dir, source, candidates, strategy} without touching the filesystem,
// so the resolution itself is inspectable and testable in isolation.
function describeJavaTools({
  strategy = 'jtDirWithSiblingFallback',
  env = process.env,
  repoRoot = path.resolve(__dirname, '..', '..'),
} = {}) {
  const build = STRATEGIES[strategy];
  if (!build) {
    throw new Error(
      `unknown java-tools discovery strategy "${strategy}"; ` +
      `known strategies: ${STRATEGY_NAMES.join(', ')}`);
  }
  const candidates = build(env, repoRoot)
    .map(([source, value]) => ({source, value: value || null}));
  const winner = candidates.find((candidate) => candidate.value);
  return {
    strategy,
    candidates,
    source: winner ? winner.source : null,
    dir: winner ? path.resolve(winner.value) : null,
    usesAuthorFallback: Boolean(winner && winner.source === 'author-fallback'),
  };
}

// Resolve and validate. A missing prerequisite fails loudly and actionably; it
// never falls back to a different execution mode and never returns a path the
// caller will discover is wrong three requires later.
function resolveJavaTools(options = {}) {
  const {validate = true, requireEntries = ['package.json']} = options;
  const description = describeJavaTools(options);
  if (!description.dir) {
    const error = new Error(
      'java-tools checkout not configured. Set JAVA_TOOLS_DIR to a java-tools ' +
      'checkout, e.g.\n\n    export JAVA_TOOLS_DIR="$HOME/git/java-tools"\n\n' +
      `(discovery strategy "${description.strategy}" found no candidate)`);
    error.code = 'JAVA_TOOLS_NOT_CONFIGURED';
    error.resolution = description;
    throw error;
  }
  if (validate) {
    const missing = [];
    if (!fs.existsSync(description.dir)) missing.push(description.dir);
    else {
      for (const entry of requireEntries) {
        if (!fs.existsSync(path.join(description.dir, entry))) {
          missing.push(path.join(description.dir, entry));
        }
      }
    }
    if (missing.length > 0) {
      const hint = description.usesAuthorFallback
        ? '\nThis path came from the built-in author fallback, not from your ' +
          'environment. Set JAVA_TOOLS_DIR explicitly.'
        : `\nThis path came from ${description.source}.`;
      const error = new Error(
        `java-tools checkout is unusable: missing ${missing.join(', ')}.${hint}`);
      error.code = 'JAVA_TOOLS_UNUSABLE';
      error.resolution = description;
      throw error;
    }
  }
  return description;
}

// require() a module from inside the java-tools checkout, resolving it the way
// java-tools itself would (so its own node_modules are visible).
function javaToolsRequire(dir) {
  return Module.createRequire(path.join(dir, 'package.json'));
}

function javaToolsPath(dir, ...segments) {
  return path.join(dir, ...segments);
}

module.exports = {
  AUTHOR_FALLBACK,
  STRATEGY_NAMES,
  describeJavaTools,
  resolveJavaTools,
  javaToolsRequire,
  javaToolsPath,
};
