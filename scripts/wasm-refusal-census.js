#!/usr/bin/env node
'use strict';

// docs/refactor.md 3.4 asks for a refusal census, "originally `wasm_flags.py`".
// That harness does not exist on this machine (see docs/phase3-preparation.md),
// so this is its documented replacement.
//
// It does not re-implement the census: jvm.js already tallies, per method,
// every outcome the Wasm gate reached (`WasmJit._censusNote`), and writes it
// with JVM_WASM_CENSUS_FILE. This reads that file and answers the questions
// 3.4 actually poses.
//
//   Collect:  JVM_WASM_CENSUS_FILE=/path/census-%p.json <launcher command>
//   Report:   node scripts/wasm-refusal-census.js .work/phase3/census-*.json
//
// Two properties matter and are easy to get wrong:
//
//  * Every row is keyed by class + name + DESCRIPTOR. Section 3.4 names its
//    targets as `class.method`, and most of those are not unique -- `ck.a`
//    alone has 13 overloads. A per-name report silently merges unrelated
//    methods, so this tool never aggregates by name.
//  * "Reached the gate" is not "was eligible". A method the JS tier compiles
//    first never reaches the Wasm gate at all and appears nowhere below. Absent
//    from this report means unknown, not accepted.

const fs = require('fs');
const path = require('path');

function load(files) {
  const rows = [];
  for (const file of files) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const row of parsed.methods || []) rows.push({ ...row, file });
  }
  return rows;
}

function pad(value, width) { return String(value).padStart(width); }

function reasonTally(rows) {
  const tally = new Map();
  for (const row of rows) {
    for (const [reason, count] of Object.entries(row.reasons || {})) {
      const entry = tally.get(reason) || { attempts: 0, methods: 0 };
      entry.attempts += count;
      entry.methods += 1;
      tally.set(reason, entry);
    }
  }
  return [...tally].sort((a, b) => b[1].attempts - a[1].attempts);
}

function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('usage: wasm-refusal-census.js <census json> [...]');
    process.exit(2);
  }
  const rows = load(files);
  console.log(`methods that reached the Wasm gate: ${rows.length}`);
  console.log(`(from ${files.map((f) => path.basename(f)).join(', ')})\n`);

  console.log('-- gate outcome, ranked by attempts --');
  console.log(`${pad('attempts', 10)} ${pad('methods', 8)}  outcome`);
  for (const [reason, entry] of reasonTally(rows)) {
    console.log(`${pad(entry.attempts, 10)} ${pad(entry.methods, 8)}  ${reason}`);
  }

  const status = new Map();
  for (const row of rows) status.set(row.status, (status.get(row.status) || 0) + 1);
  console.log('\n-- terminal state of each method --');
  for (const [key, count] of [...status].sort((a, b) => b[1] - a[1])) {
    console.log(`${pad(count, 10)}  ${key}`);
  }

  // Installed but not carrying its own execution: a module entered as often as
  // it exits is the runs==exits shape the whole-method-JS preference exists to
  // avoid, and it is worth less than no module at all.
  const installed = rows.filter((r) => r.status === 'ready');
  const exitStorms = installed
    .filter((r) => r.runs > 0 && r.exits >= r.runs * 0.9)
    .sort((a, b) => b.runs - a.runs);
  console.log(`\n-- installed modules: ${installed.length} --`);
  console.log(`   full coverage: ${installed.filter((r) => r.full).length}`);
  console.log(`   normal-flow only: ${installed.filter((r) => !r.full && r.normalFull).length}`);
  console.log(`   exit storms (exits >= 90% of runs): ${exitStorms.length}`);
  for (const row of exitStorms.slice(0, 15)) {
    console.log(`     ${pad(row.runs, 9)} runs ${pad(row.exits, 9)} exits  ${row.method}`);
  }

  // What 3.4 asks to be guided by: the refusals that cost the most attempts,
  // with the methods behind each one named by descriptor.
  console.log('\n-- top refusals, with the methods behind them --');
  for (const [reason, entry] of reasonTally(rows).slice(0, 8)) {
    if (reason === 'entered' || reason === 'entered-osr') continue;
    const behind = rows
      .filter((r) => r.reasons && r.reasons[reason])
      .sort((a, b) => b.reasons[reason] - a.reasons[reason])
      .slice(0, 6);
    console.log(`\n  ${reason}  (${entry.attempts} attempts across ${entry.methods} methods)`);
    for (const row of behind) {
      console.log(`    ${pad(row.reasons[reason], 9)}  ${row.method}  [status=${row.status}]`);
    }
  }
}

main();
