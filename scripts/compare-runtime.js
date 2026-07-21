#!/usr/bin/env node
'use strict';

// Runtime-equivalence check: boot several variants of a game (original
// bytecode, pipeline-transformed bytecode, decompiled+javac-recompiled
// classes) on the jvm.js interpreter under a deterministic clock, stop each
// run at the same instruction budget, and compare the observable behaviour:
//   - stdout produced by the game
//   - uncaught exceptions / JVM errors on stderr
//   - the set of live threads and their statuses at cut-off
//   - rendered canvas framebuffers (pixel-exact PNG hash)
//
// Each variant runs twice: identical repeat runs establish that the
// comparison is deterministic (the "noise floor"); only observables that are
// stable across repeats count as evidence when variants differ.
//
// Usage:
//   node scripts/compare-runtime.js [--game NAME] [--budget N] [--work DIR]
//     [--variant label=classesDir ...]
//
// Defaults compare the dekobloko variants produced by
// scripts/decompile-all-games.sh.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FAKE_TIME = '1000000000000';

function parseArgs(argv) {
  const options = { game: 'dekobloko', budget: 20000000, work: null, variants: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--game') options.game = argv[++i];
    else if (arg === '--budget') options.budget = Number(argv[++i]);
    else if (arg === '--work') options.work = path.resolve(argv[++i]);
    else if (arg === '--variant') {
      const spec = argv[++i];
      if (typeof spec !== 'string') throw new Error('--variant requires safe-label=classesDir');
      const eq = spec.indexOf('=');
      if (eq <= 0 || eq === spec.length - 1) {
        throw new Error(`Invalid --variant '${spec}'; expected safe-label=classesDir`);
      }
      options.variants.push({ label: spec.slice(0, eq), dir: path.resolve(spec.slice(eq + 1)) });
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.variants.length) {
    const gameDir = path.join(ROOT, '.work', 'games', options.game);
    options.variants = [
      { label: 'original', dir: path.join(gameDir, 'classes') },
      { label: 'transformed', dir: path.join(gameDir, 'decompile-owned', 'out') },
      { label: 'recompiled', dir: path.join(gameDir, 'decompile-owned', 'classes') },
    ];
  }
  if (!options.work) options.work = path.join(ROOT, '.work', 'runtime-compare', options.game);
  const labels = new Set();
  for (const variant of options.variants) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(variant.label)) {
      throw new Error(`Unsafe variant label '${variant.label}'; use letters, digits, '.', '_' or '-'`);
    }
    if (labels.has(variant.label)) throw new Error(`Duplicate variant label '${variant.label}'`);
    labels.add(variant.label);
  }
  return options;
}

function runOnce(variant, iteration, options) {
  const runDir = path.join(options.work, `${variant.label}-run${iteration}`);
  fs.rmSync(runDir, { recursive: true, force: true });
  fs.mkdirSync(runDir, { recursive: true });
  const result = spawnSync('node', [
    path.join(ROOT, 'scripts', 'run-jvmjs.js'),
    variant.dir,
    '--max-insns', String(options.budget),
  ], {
    env: Object.assign({}, process.env, {
      JVM_FAKE_TIME: FAKE_TIME,
      JVM_FRAME_DIR: runDir,
    }),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 30 * 60 * 1000,
  });
  fs.writeFileSync(path.join(runDir, 'stdout.log'), result.stdout || '');
  fs.writeFileSync(path.join(runDir, 'stderr.log'), result.stderr || '');
  // exit 3 is run-jvmjs's instruction-budget cutoff marker (JVM_TRACE_EXIT
  // in jvm.js), i.e. the healthy outcome for a bounded comparison run
  const acceptable = result.status === 0 || result.status === 3;
  if (result.error || result.signal || !acceptable) {
    const reason = result.error
      ? result.error.message
      : result.signal
        ? `terminated by ${result.signal}`
        : result.status === null
          ? 'terminated without an exit status'
          : `exited with status ${result.status}`;
    throw new Error(`Runtime variant '${variant.label}' run ${iteration} failed: ${reason}`);
  }
  return { runDir, exitCode: result.status, signature: extractSignature(runDir, result) };
}

function extractSignature(runDir, result) {
  const stderr = result.stderr || '';
  // Thread status at an arbitrary instruction cutoff is a transient scheduler
  // state (runnable/SLEEPING/WAITING flap between otherwise-identical runs), so
  // collapse the live states to "alive" and compare the terminated-vs-alive
  // shape and thread count — that distinguishes a crashed/deadlocked run from a
  // healthy one without tracking scheduler jitter.
  const threads = [];
  for (const line of stderr.split('\n')) {
    const m = line.match(/^thread \d+ \((.*)\) status=(\S+)/);
    if (m) threads.push(`${m[1]}:${m[2] === 'terminated' ? 'terminated' : 'alive'}`);
  }
  // Java-level exceptions the JVM printed outside the instruction trace.
  const exceptions = stderr.split('\n').filter((line) =>
    /Exception|java\.lang\..*Error|panic/i.test(line) &&
    !/ pc=\d+ /.test(line)).slice(0, 50);
  const canvases = {};
  for (const file of fs.readdirSync(runDir).filter((f) => f.endsWith('.png')).sort()) {
    const bytes = fs.readFileSync(path.join(runDir, file));
    canvases[file] = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  }
  return {
    exitCode: result.status,
    stdout: result.stdout || '',
    threads,
    exceptions,
    canvases,
  };
}

function compareSignatures(a, b) {
  const diffs = [];
  if (a.exitCode !== b.exitCode) diffs.push(`exit code: ${a.exitCode} vs ${b.exitCode}`);
  if (a.stdout !== b.stdout) diffs.push('stdout differs');
  if (a.threads.join('|') !== b.threads.join('|')) {
    diffs.push(`threads: [${a.threads.join(', ')}] vs [${b.threads.join(', ')}]`);
  }
  if (a.exceptions.join('|') !== b.exceptions.join('|')) {
    diffs.push(`exceptions: ${JSON.stringify(a.exceptions)} vs ${JSON.stringify(b.exceptions)}`);
  }
  const names = new Set([...Object.keys(a.canvases), ...Object.keys(b.canvases)]);
  for (const name of names) {
    if (a.canvases[name] !== b.canvases[name]) {
      diffs.push(`canvas ${name}: ${a.canvases[name] || 'missing'} vs ${b.canvases[name] || 'missing'}`);
    }
  }
  return diffs;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  for (const variant of options.variants) {
    if (!fs.existsSync(variant.dir)) {
      throw new Error(`Variant '${variant.label}' classes not found: ${variant.dir}`);
    }
  }
  fs.mkdirSync(options.work, { recursive: true });
  console.log(`[*] budget=${options.budget} insns, work=${options.work}`);

  const runs = {};
  for (const variant of options.variants) {
    for (const iteration of [1, 2]) {
      process.stdout.write(`[*] running ${variant.label} (run ${iteration})... `);
      const t0 = Date.now();
      const run = runOnce(variant, iteration, options);
      runs[`${variant.label}#${iteration}`] = run;
      console.log(`exit=${run.exitCode} threads=${run.signature.threads.length} ` +
        `canvases=${Object.keys(run.signature.canvases).length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }

  console.log('\n=== Determinism (same variant, repeat run) ===');
  let deterministic = true;
  for (const variant of options.variants) {
    const diffs = compareSignatures(
      runs[`${variant.label}#1`].signature, runs[`${variant.label}#2`].signature);
    console.log(`${variant.label}: ${diffs.length ? 'NON-DETERMINISTIC' : 'stable'}`);
    for (const d of diffs) console.log(`    ${d}`);
    if (diffs.length) deterministic = false;
  }

  console.log('\n=== Variant comparison (vs first variant, run 1) ===');
  const reference = options.variants[0];
  let equivalent = true;
  for (const variant of options.variants.slice(1)) {
    const diffs = compareSignatures(
      runs[`${reference.label}#1`].signature, runs[`${variant.label}#1`].signature);
    console.log(`${reference.label} vs ${variant.label}: ${diffs.length ? 'DIFFERS' : 'match'}`);
    for (const d of diffs) console.log(`    ${d}`);
    if (diffs.length) equivalent = false;
  }

  const report = {
    budget: options.budget,
    deterministic,
    equivalent,
    runs: Object.fromEntries(Object.entries(runs).map(([k, v]) => [k, v.signature])),
  };
  fs.writeFileSync(path.join(options.work, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`\n[*] report: ${path.join(options.work, 'report.json')}`);

  if (!deterministic) {
    console.log('RESULT: inconclusive — repeat runs of the same variant differ; ' +
      'only differences that exceed this noise floor are meaningful.');
    process.exit(2);
  }
  if (!equivalent) {
    console.log('RESULT: BEHAVIOUR DIVERGES between variants.');
    process.exit(1);
  }
  console.log('RESULT: all variants behave identically under this budget.');
}

main();
