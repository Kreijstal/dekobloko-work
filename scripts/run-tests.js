#!/usr/bin/env node
'use strict';

// Discover and run the scripts/ self-tests.
//
//   node scripts/run-tests.js               every discovered test
//   node scripts/run-tests.js --quick       skip the ones marked slow
//   node scripts/run-tests.js --list        show what would run
//   node scripts/run-tests.js lib provenance   run tests matching a substring
//
// Before this existed the twelve scripts/test-*.js files had to be invoked one
// at a time by name, and only two of them were mentioned in any document, so
// "the tests pass" was never a checkable statement.
//
// Design rules, learned from the runner in apps/server-js/test/run-all.js:
//
//   * Discovering zero tests is a FAILURE, not a silent success. A glob that
//     matches nothing must never read as green.
//   * A known failure is declared with a reason and an owner. It does not turn
//     the run green, it is reported as KNOWN-FAIL and excluded from the exit
//     status -- and if a known failure starts PASSING, the run fails, so the
//     list cannot quietly rot.
//   * A test that exceeds its timeout is a failure, never a skip.
//
// This runner deliberately does not run apps/server-js (`npm test` there) or
// apps/server (`python3 -m unittest`) or game-logic (`./game-logic/build.sh`).
// Those are separate suites with their own runtimes; see docs/testing.md.

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const SCRIPTS = __dirname;
const DEFAULT_TIMEOUT_MS = 300000;

// Tests that take long enough that --quick should skip them, with measured
// wall times from a baseline run on 2026-09-08.
const SLOW = new Map([
  ['test-cfr-pass-regressions', 44],
  ['test-cfr-oracle-policy', 11],
]);

// Failures that are already failing for a reason outside this repository.
// Each entry MUST name the cause and where the fix belongs.
const KNOWN_FAILURES = new Map([
  ['test-cfr-oracle-policy', {
    reason:
      'Pinned marker counts no longer reproduce: the "terminal-helper ' +
      'fallback" case selects baseline (15 markers) where the baseline file ' +
      'expects candidate (7). The expected values are an ORACLE; they must not ' +
      'be regenerated to make this green. Confirmed cross-repository rather ' +
      'than local: cfr-oracle-select-transform.js shells out to ' +
      '$JAVA_TOOLS_DIR/scripts/jvm-cli.js, and the case fails identically ' +
      'against a clean java-tools worktree at c53e8f3, before any of the ' +
      'renderer refactor commits.',
    owner: 'java-tools (cross-repository)',
    since: '2026-09-08 baseline',
  }],
]);

function discover() {
  return fs.readdirSync(SCRIPTS)
    .filter((name) => /^test-.+\.js$/.test(name))
    .map((name) => name.replace(/\.js$/, ''))
    .sort();
}

function main(argv) {
  const quick = argv.includes('--quick');
  const listOnly = argv.includes('--list');
  const filters = argv.filter((arg) => !arg.startsWith('--'));

  let tests = discover();
  if (tests.length === 0) {
    console.error(
      `FAIL: no test files matched scripts/test-*.js in ${SCRIPTS}. ` +
      'An empty discovery is a failure, not a pass.');
    return 1;
  }
  if (filters.length > 0) {
    tests = tests.filter((name) => filters.every((f) => name.includes(f)));
    if (tests.length === 0) {
      console.error(`FAIL: no test matched ${JSON.stringify(filters)}`);
      return 1;
    }
  }
  const skipped = [];
  if (quick) {
    const kept = [];
    for (const name of tests) {
      if (SLOW.has(name)) skipped.push(name);
      else kept.push(name);
    }
    tests = kept;
  }

  if (listOnly) {
    for (const name of tests) {
      const marks = [
        SLOW.has(name) ? `slow ~${SLOW.get(name)}s` : null,
        KNOWN_FAILURES.has(name) ? 'known-failure' : null,
      ].filter(Boolean);
      console.log(`${name}${marks.length ? '  [' + marks.join(', ') + ']' : ''}`);
    }
    return 0;
  }

  const failed = [];
  const knownFailed = [];
  const unexpectedlyPassing = [];
  const passed = [];

  for (const name of tests) {
    const started = Date.now();
    const result = spawnSync(process.execPath, [path.join(SCRIPTS, `${name}.js`)], {
      encoding: 'utf8',
      timeout: DEFAULT_TIMEOUT_MS,
      cwd: path.resolve(SCRIPTS, '..'),
    });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const timedOut = result.error && result.error.code === 'ETIMEDOUT';
    const ok = !timedOut && result.status === 0;
    const known = KNOWN_FAILURES.get(name);

    if (ok && known) {
      unexpectedlyPassing.push(name);
      console.log(`UNEXPECTED PASS  ${name}  (${seconds}s)`);
      console.log(`    it is listed as a known failure: ${known.reason}`);
      console.log('    remove it from KNOWN_FAILURES in scripts/run-tests.js');
    } else if (ok) {
      passed.push(name);
      console.log(`PASS             ${name}  (${seconds}s)`);
    } else if (known) {
      knownFailed.push(name);
      console.log(`KNOWN-FAIL       ${name}  (${seconds}s)  owner: ${known.owner}`);
      console.log(`    ${known.reason}`);
    } else {
      failed.push(name);
      console.log(`FAIL             ${name}  (${seconds}s)` +
        (timedOut ? `  TIMED OUT after ${DEFAULT_TIMEOUT_MS}ms` : ''));
      const output = `${result.stdout || ''}${result.stderr || ''}`.trimEnd();
      for (const line of output.split(/\r?\n/).slice(-25)) {
        console.log(`    ${line}`);
      }
    }
  }

  console.log('');
  console.log(
    `${passed.length} passed, ${failed.length} failed, ` +
    `${knownFailed.length} known-fail, ${skipped.length} skipped` +
    (unexpectedlyPassing.length
      ? `, ${unexpectedlyPassing.length} unexpectedly passing`
      : ''));
  if (skipped.length > 0) console.log(`skipped (--quick): ${skipped.join(', ')}`);
  if (knownFailed.length > 0) {
    console.log(
      'Known failures are NOT green. They are tracked cross-repository ' +
      'regressions; see the reasons above.');
  }
  return (failed.length > 0 || unexpectedlyPassing.length > 0) ? 1 : 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {discover, main, KNOWN_FAILURES, SLOW};
