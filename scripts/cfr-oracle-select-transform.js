#!/usr/bin/env node
'use strict';

// Lab-only tool.
//
// This script uses CFR as an oracle to test candidate rewrite families and
// discover bytecode-shape policies. It is intentionally not part of the real
// deobfuscation pipeline: production deob must use local bytecode facts and
// deterministic transforms, not decompiler feedback or saved lab specimens.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DEKOB = path.resolve(__dirname, '..');
const JAVA_TOOLS_DIR = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');
const CFR_JAR = path.join(DEKOB, 'lib', 'cfr.jar');
const MARKER_RE = /\*\* GOTO|Unable to fully structure code|lbl-1000|\*\* while/g;
const BAD_RE = /Exception decompiling|Invisible function parameters|uninitialised local|uninitialized local|if \(true\) \*\* GOTO|if \([0-9]+ == [0-9]+\) \*\* GOTO/;

function usage() {
  console.error('usage: node scripts/cfr-oracle-select-transform.js <input.j|input.class> <out.class> [--disasm <out.j>]');
}

const input = process.argv[2] && path.resolve(process.argv[2]);
const outClass = process.argv[3] && path.resolve(process.argv[3]);
const disasmIndex = process.argv.indexOf('--disasm');
const outJ = disasmIndex >= 0 ? path.resolve(process.argv[disasmIndex + 1] || '') : null;
if (!input || !outClass || (disasmIndex >= 0 && !process.argv[disasmIndex + 1])) {
  usage();
  process.exit(2);
}

const className = input.endsWith('.class') ? path.basename(input, '.class') : (readClassName(input) || path.basename(input, path.extname(input)));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cfr-oracle-transform-'));
try {
  const baselineDir = path.join(work, 'baseline');
  const candidateDir = path.join(work, 'candidate');
  fs.mkdirSync(baselineDir, { recursive: true });
  fs.mkdirSync(candidateDir, { recursive: true });
  const baselineClass = path.join(baselineDir, `${className}.class`);
  fs.mkdirSync(path.dirname(baselineClass), { recursive: true });

  if (input.endsWith('.class')) {
    fs.copyFileSync(input, baselineClass);
  } else {
    run(process.execPath, [
      path.join(JAVA_TOOLS_DIR, 'scripts', 'jvm-cli.js'),
      'assemble',
      input,
      '--out',
      baselineClass,
    ]);
  }

  const baseline = countMarkers(baselineClass);
  const candidates = runCandidates(baselineDir, candidateDir, className, baselineClass);
  const best = chooseBestCandidate(baseline, candidates);
  const accept = !!best;
  const selected = accept ? best.classFile : baselineClass;
  fs.mkdirSync(path.dirname(outClass), { recursive: true });
  fs.copyFileSync(selected, outClass);
  if (outJ) {
    run(process.execPath, [
      path.join(JAVA_TOOLS_DIR, 'scripts', 'jvm-cli.js'),
      'disassemble',
      outClass,
      '--out',
      outJ,
    ]);
  }
  console.log(JSON.stringify({
    action: accept ? 'candidate' : 'baseline',
    baseline,
    candidate: best ? best.count : bestRejectedCandidate(candidates),
    candidateName: best ? best.name : null,
    candidates: candidates.map(({ name, count }) => ({ name, ...count })),
    outClass,
    outJ,
  }));
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

function runCandidates(inputDir, candidateRoot, className, baselineClass) {
  const candidates = [];
  const defaultCandidate = runCandidate(inputDir, candidateRoot, className, candidateProfile('default'));
  candidates.push(defaultCandidate);
  candidates.push(runCandidate(inputDir, candidateRoot, className, candidateProfile('loop-entry')));

  for (const profile of fallbackProfilesFor(defaultCandidate.count)) {
    candidates.push(runCandidate(inputDir, candidateRoot, className, profile));
  }
  return candidates;
}

function runCandidate(inputDir, candidateRoot, className, profile) {
  const outDir = path.join(candidateRoot, profile.name);
  fs.mkdirSync(outDir, { recursive: true });
  const classFile = path.join(outDir, `${className}.class`);
  const env = candidateEnv(profile);
  try {
    run(process.execPath, [
      path.join(DEKOB, 'scripts', 'pipeline', 'bulk-pipeline.js'),
      inputDir,
      outDir,
      '--profile',
      'none',
      '--safe-bytecode',
    ], { env });
    const count = fs.existsSync(classFile) ? countMarkers(classFile) : markerFailure(['missing-output-class']);
    return { name: profile.name, classFile, count };
  } catch {
    return { name: profile.name, classFile, count: markerFailure(['pipeline-failed']) };
  }
}

function fallbackProfilesFor(count) {
  if (!count || !count.bad) return [];
  const profiles = [];
  if (hasReason(count, 'terminal-helper-uninitialized-local')) {
    profiles.push(candidateProfile('no-terminal-extract'));
    profiles.push(candidateProfile('loop-entry-no-terminal-extract'));
  }
  if (hasReason(count, 'constant-true-goto')) {
    profiles.push(candidateProfile('no-terminal-tail-clone'));
  }
  return profiles;
}

function hasReason(count, reason) {
  return Array.isArray(count.reasons) && count.reasons.includes(reason);
}

function candidateProfile(name) {
  if (name === 'default') return { name: 'default', skipPasses: '' };
  if (name === 'loop-entry') {
    return {
      name,
      skipPasses: '',
      env: {
        STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '1',
        STRUCTURED_GOTO_CLONE_SHORT: '0',
        STRUCTURED_GOTO_CLONE_ZERO: '0',
        STRUCTURED_GOTO_CLONE_RETURN: '0',
        STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
        STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
      },
    };
  }
  if (name === 'no-terminal-extract') {
    return { name, skipPasses: 'terminal-iterator-extract,terminal-action-extract,terminal-cleanup-extract' };
  }
  if (name === 'loop-entry-no-terminal-extract') {
    return {
      name,
      skipPasses: 'terminal-iterator-extract,terminal-action-extract,terminal-cleanup-extract',
      env: {
        STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '1',
        STRUCTURED_GOTO_CLONE_SHORT: '0',
        STRUCTURED_GOTO_CLONE_ZERO: '0',
        STRUCTURED_GOTO_CLONE_RETURN: '0',
        STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
        STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
      },
    };
  }
  if (name === 'no-terminal-tail-clone') {
    return {
      name,
      skipPasses: 'terminal-iterator-extract,terminal-action-extract,terminal-cleanup-extract,structured-goto-clone',
      peepholeOptions: {
        cloneForwardTerminalGotoTails: false,
        cloneConditionalTerminalTails: false,
      },
    };
  }
  throw new Error(`unknown oracle profile: ${name}`);
}

function candidateEnv(profile) {
  return {
    ...process.env,
    STRUCTURED_GOTO_ONESHOT_PREHEADER: process.env.STRUCTURED_GOTO_ONESHOT_PREHEADER || '1',
    STRUCTURED_GOTO_ITERATIVE: process.env.STRUCTURED_GOTO_ITERATIVE || '1',
    STRUCTURED_GOTO_MAX_ITERATIONS: process.env.STRUCTURED_GOTO_MAX_ITERATIONS || '8',
    STRUCTURED_GOTO_CLONE_SHORT: process.env.STRUCTURED_GOTO_CLONE_SHORT || '0',
    STRUCTURED_GOTO_CLONE_ZERO: process.env.STRUCTURED_GOTO_CLONE_ZERO || '0',
    STRUCTURED_GOTO_CLONE_RETURN: process.env.STRUCTURED_GOTO_CLONE_RETURN || '0',
    STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: process.env.STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL || '0',
    STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: process.env.STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY || '0',
    SKIP_PIPELINE_PASSES: mergeSkipPasses(process.env.SKIP_PIPELINE_PASSES, profile.skipPasses),
    PIPELINE_EXPERIMENTAL_PEEPHOLE_OPTIONS: mergePeepholeOptions(process.env.PIPELINE_EXPERIMENTAL_PEEPHOLE_OPTIONS, profile.peepholeOptions),
    ...(profile.env || {}),
  };
}

function mergePeepholeOptions(existing, extra) {
  if (!extra) return existing || '';
  let parsed = {};
  if (existing) {
    try {
      parsed = JSON.parse(existing);
    } catch {
      parsed = {};
    }
  }
  return JSON.stringify({ ...parsed, ...extra });
}

function mergeSkipPasses(...values) {
  return [...new Set(values
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean))]
    .join(',');
}

function chooseBestCandidate(baseline, candidates) {
  const viable = candidates
    .filter((candidate) => !candidate.count.bad && candidate.count.markers < baseline.markers)
    .sort((a, b) => a.count.markers - b.count.markers || a.name.localeCompare(b.name));
  return viable[0] || null;
}

function bestRejectedCandidate(candidates) {
  const sorted = [...candidates].sort((a, b) => {
    if (a.count.bad !== b.count.bad) return a.count.bad ? 1 : -1;
    return a.count.markers - b.count.markers || a.name.localeCompare(b.name);
  });
  return sorted[0] ? sorted[0].count : markerFailure(['no-candidates']);
}

function markerFailure(reasons) {
  return { markers: Infinity, bad: true, reasons };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: DEKOB,
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return result;
}

function readClassName(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^\.class\s+.*\s+([^\s]+)$/m);
  return match && match[1];
}

function countMarkers(classFile) {
  const cfrDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfr-oracle-count-'));
  try {
    const result = spawnSync('java', ['-jar', CFR_JAR, classFile, '--outputdir', cfrDir, '--silent', 'true', '--caseinsensitivefs', 'false'], {
      cwd: DEKOB,
      encoding: 'utf8',
    });
    const diagnostics = `${result.stdout || ''}\n${result.stderr || ''}`;
    let markers = 0;
    const reasons = [];
    if (result.status !== 0) reasons.push('cfr-process-failed');
    collectBadReasons(diagnostics, reasons);
    const javaFiles = fs.readdirSync(cfrDir).filter((name) => name.endsWith('.java'));
    if (javaFiles.length === 0) {
      reasons.push('cfr-no-java-output');
    }
    for (const file of javaFiles) {
      const text = fs.readFileSync(path.join(cfrDir, file), 'utf8');
      markers += (text.match(MARKER_RE) || []).length;
      collectBadReasons(text, reasons);
    }
    return { markers, bad: reasons.length > 0, reasons: [...new Set(reasons)] };
  } finally {
    fs.rmSync(cfrDir, { recursive: true, force: true });
  }
}

function collectBadReasons(text, reasons) {
  if (!text) return;
  if (/Exception decompiling/.test(text)) reasons.push('exception-decompiling');
  if (/Invisible function parameters|uninitialised local|uninitialized local/.test(text)) reasons.push('uninitialized-local');
  if (/ck\$terminalIterator/.test(text) && /Invisible function parameters|uninitialised local|uninitialized local/.test(text)) {
    reasons.push('terminal-helper-uninitialized-local');
  }
  if (/if \(true\) \*\* GOTO/.test(text)) reasons.push('constant-true-goto');
  if (/if \([0-9]+ == [0-9]+\) \*\* GOTO/.test(text)) reasons.push('constant-compare-goto');
}
