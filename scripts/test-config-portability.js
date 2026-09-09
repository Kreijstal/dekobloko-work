#!/usr/bin/env node
'use strict';

// Portability ratchet for configuration.
//
// This repository has three classes of configuration bug that keep coming
// back. Each is cheap to detect from the source text, so they are detected
// here rather than discovered on someone else's machine:
//
//   1. A variable that defaults to a hardcoded author path even when the
//      variable it should follow was set correctly.
//   2. A shell script that ASSIGNS a configuration variable unconditionally,
//      silently discarding an exported value.
//   3. Growth in the number of author-path fallbacks.
//
// (3) is a ratchet, not a ban: migrating all of them is a separate, per-family
// configuration change with its own tests. The count may go DOWN freely. If it
// goes UP the test fails and says so. Lower the number when you migrate a
// family; never raise it.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const AUTHOR_PATH = '/home/kreijstal/git/java-tools';

function sourceFiles() {
  const found = [];
  const skip = new Set(['.git', 'node_modules', '.work', 'classes-original']);
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (skip.has(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (/\.(js|cjs|mjs|sh)$/.test(entry.name)) found.push(absolute);
    }
  };
  for (const top of ['scripts', 'tools', 'apps', 'web', 'game-logic']) {
    const absolute = path.join(REPO, top);
    if (fs.existsSync(absolute)) walk(absolute);
  }
  return found.sort();
}

const files = sourceFiles();
assert.ok(files.length > 100,
  `expected to scan the repository, only found ${files.length} files`);

const relative = (file) => path.relative(REPO, file);
const read = (file) => fs.readFileSync(file, 'utf8');

// --- 1. no variable may default to the author path while ignoring its own ---
//        primary variable.
{
  const offenders = [];
  for (const file of files) {
    for (const [index, line] of read(file).split(/\r?\n/).entries()) {
      // JAVA_TOOLS_NODE_DEPS_DIR must follow the resolved java-tools checkout,
      // not jump straight to a literal path.
      if (line.includes('JAVA_TOOLS_NODE_DEPS_DIR') && line.includes(AUTHOR_PATH)) {
        offenders.push(`${relative(file)}:${index + 1}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'JAVA_TOOLS_NODE_DEPS_DIR must default to the resolved java-tools ' +
    'checkout, never to a literal path -- otherwise setting JAVA_TOOLS_DIR ' +
    'correctly still sends the pipeline to a directory that does not exist');
}

// --- 2. shell scripts must not overwrite an exported configuration value ----
{
  // Only a standalone assignment statement can discard an exported value.
  // `VAR="$VAR" some-command ...` is an environment prefix for one command and
  // is not an assignment at all, so it must not be flagged.
  const assignment =
    /^\s*(?:export\s+)?(?:JT_DIR|JAVA_TOOLS_DIR|JAVA_TOOLS_ROOT)=(\S*)\s*(?:#.*)?$/;
  const offenders = [];
  for (const file of files.filter((f) => f.endsWith('.sh'))) {
    for (const [index, line] of read(file).split(/\r?\n/).entries()) {
      const match = assignment.exec(line);
      if (!match) continue;
      // Any `$` reference means the value is derived rather than dictated:
      // `${VAR:-default}`, `$(dirname ...)` and `"$OTHER"` all qualify.
      if (!match[1].includes('$')) {
        offenders.push(`${relative(file)}:${index + 1}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'a shell script assigned a configuration variable unconditionally, ' +
    'discarding the caller\'s exported value; use ${VAR:-default}');
}

// --- 3. ratchet: the author-path fallback count may fall, never rise --------
//
// MEASURED, not chosen: 42 at commit d9bb936, 41 after removing
// scripts/pipeline/bulk-pipeline.js's second copy. Every remaining site is
// listed in docs/configuration.md. Lower this number as families migrate to
// the `required` strategy in scripts/lib/java-tools.js.
const AUTHOR_FALLBACK_BUDGET = 7;

// scripts/lib/ and this test DOCUMENT the author path -- naming a bad default
// in order to describe it is not the same as depending on it. Counting them
// would punish writing the divergence down.
const DOCUMENTS_THE_PATH = (name) =>
  name.startsWith('scripts/lib/') || name === 'scripts/test-config-portability.js';

const sites = [];
for (const file of files) {
  const name = relative(file);
  if (DOCUMENTS_THE_PATH(name)) continue;
  for (const [index, line] of read(file).split(/\r?\n/).entries()) {
    if (line.includes(AUTHOR_PATH)) {
      sites.push(`${name}:${index + 1}`);
    }
  }
}

if (sites.length > AUTHOR_FALLBACK_BUDGET) {
  assert.fail(
    `author-path fallbacks rose from ${AUTHOR_FALLBACK_BUDGET} to ` +
    `${sites.length}. New sites are not acceptable; use the discovery ` +
    `strategies in scripts/lib/java-tools.js.\n` +
    sites.slice(AUTHOR_FALLBACK_BUDGET).map((s) => `  ${s}`).join('\n'));
}
if (sites.length < AUTHOR_FALLBACK_BUDGET) {
  assert.fail(
    `author-path fallbacks fell from ${AUTHOR_FALLBACK_BUDGET} to ` +
    `${sites.length}. Good -- now lower AUTHOR_FALLBACK_BUDGET in ` +
    `scripts/test-config-portability.js to ${sites.length} so the ` +
    'improvement is locked in, and update docs/configuration.md.');
}

console.log(
  `PASS config-portability selftest ` +
  `(${files.length} source files scanned, ` +
  `${sites.length}/${AUTHOR_FALLBACK_BUDGET} author-path fallbacks)`);
