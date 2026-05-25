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
  console.error(`usage:
  node scripts/cfr-oracle-select-transform.js <input.j|input.class> <out.class> [--disasm <out.j>] [--catalog] [--catalog-limit N]
  node scripts/cfr-oracle-select-transform.js --list-catalog`);
}

const args = parseCli(process.argv.slice(2));
if (args.listCatalog) {
  const profiles = catalogProfiles();
  console.log(JSON.stringify({ count: profiles.length, profiles: profiles.map((profile) => profile.name) }, null, 2));
  process.exit(0);
}

const input = args.input && path.resolve(args.input);
const outClass = args.outClass && path.resolve(args.outClass);
const outJ = args.disasm ? path.resolve(args.disasm) : null;
if (!input || !outClass) {
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
  const candidates = runCandidates(baselineDir, candidateDir, className, baselineClass, args);
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

function parseCli(argv) {
  const out = {
    catalog: process.env.CFR_ORACLE_CATALOG === '1',
    catalogLimit: Number(process.env.CFR_ORACLE_CATALOG_LIMIT || 0),
  };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--list-catalog') out.listCatalog = true;
    else if (arg === '--catalog') out.catalog = true;
    else if (arg === '--catalog-limit') out.catalogLimit = Number(argv[++i]);
    else if (arg.startsWith('--catalog-limit=')) out.catalogLimit = Number(arg.slice('--catalog-limit='.length));
    else if (arg === '--disasm') out.disasm = argv[++i];
    else if (arg.startsWith('--disasm=')) out.disasm = arg.slice('--disasm='.length);
    else positional.push(arg);
  }
  out.input = positional[0];
  out.outClass = positional[1];
  out.catalogLimit = Number.isFinite(out.catalogLimit) && out.catalogLimit > 0 ? out.catalogLimit : 0;
  return out;
}

function runCandidates(inputDir, candidateRoot, className, baselineClass, args = {}) {
  const candidates = [];
  const seen = new Set();
  const defaultProfile = candidateProfile('default');
  const defaultCandidate = runCandidate(inputDir, candidateRoot, className, defaultProfile);
  candidates.push(defaultCandidate);
  seen.add(defaultProfile.name);
  const loopEntry = candidateProfile('loop-entry');
  candidates.push(runCandidate(inputDir, candidateRoot, className, loopEntry));
  seen.add(loopEntry.name);

  for (const profile of fallbackProfilesFor(defaultCandidate.count)) {
    if (seen.has(profile.name)) continue;
    candidates.push(runCandidate(inputDir, candidateRoot, className, profile));
    seen.add(profile.name);
  }

  if (args.catalog) {
    const profiles = args.catalogLimit ? catalogProfiles().slice(0, args.catalogLimit) : catalogProfiles();
    for (const profile of profiles) {
      if (seen.has(profile.name)) continue;
      candidates.push(runCandidate(inputDir, candidateRoot, className, profile));
      seen.add(profile.name);
    }
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

function catalogProfiles() {
  const profiles = [];
  const push = (profile) => profiles.push(profile);

  for (const maxInsns of [4, 8, 12, 16, 24, 32]) {
    for (const maxRefs of [2, 3, 4, 6, 8]) {
      push({
        name: `shared-side-effect-i${maxInsns}-r${maxRefs}`,
        peepholeOptions: {
          cloneSharedSideEffectJoins: true,
          cloneSharedSideEffectJoinMaxInsns: maxInsns,
          cloneSharedSideEffectJoinMaxRefs: maxRefs,
        },
      });
    }
  }

  for (const maxInsns of [2, 3, 4, 5, 6]) {
    for (const maxRefs of [1, 2, 4, 8]) {
      push({
        name: `shared-loop-increment-i${maxInsns}-r${maxRefs}`,
        peepholeOptions: {
          cloneSharedLoopIncrementTails: true,
          cloneSharedLoopIncrementTailMaxInsns: maxInsns,
          cloneSharedLoopIncrementTailMaxRefs: maxRefs,
        },
      });
    }
  }

  for (const maxInsns of [80, 160, 260, 520]) {
    for (const maxClones of [1, 2, 4, 6]) {
      push({
        name: `forward-terminal-tail-i${maxInsns}-c${maxClones}`,
        peepholeOptions: {
          cloneForwardTerminalGotoTails: true,
          cloneForwardTerminalGotoTailMaxInsns: maxInsns,
          cloneForwardTerminalGotoTailMaxClones: maxClones,
        },
      });
    }
  }

  for (const maxInsns of [80, 160, 260, 520]) {
    for (const maxClones of [1, 2, 4]) {
      push({
        name: `conditional-terminal-tail-i${maxInsns}-c${maxClones}`,
        peepholeOptions: {
          cloneConditionalTerminalTails: true,
          cloneConditionalTerminalTailMaxInsns: maxInsns,
          cloneConditionalTerminalTailMaxClones: maxClones,
        },
      });
    }
  }

  for (const maxInsns of [2, 4, 6, 8, 12]) {
    for (const maxRefs of [2, 4, 8]) {
      push({
        name: `pure-forward-join-i${maxInsns}-r${maxRefs}`,
        peepholeOptions: {
          cloneSharedPureForwardJoins: true,
          cloneSharedPureForwardJoinMaxInsns: maxInsns,
          cloneSharedPureForwardJoinMaxRefs: maxRefs,
        },
      });
    }
  }

  push({
    name: 'thread-multi-use-goto-bridges',
    peepholeOptions: { threadMultiUseGotoBridges: true },
  });
  push({
    name: 'loop-entry-with-shared-side-effect',
    env: {
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '1',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
    },
    peepholeOptions: {
      cloneSharedSideEffectJoins: true,
      cloneSharedSideEffectJoinMaxInsns: 16,
      cloneSharedSideEffectJoinMaxRefs: 4,
    },
  });
  push({
    name: 'loop-entry-with-increment-tail',
    env: {
      STRUCTURED_GOTO_CLONE_LOOP_BODY_ENTRY: '1',
      STRUCTURED_GOTO_CLONE_SHORT: '0',
      STRUCTURED_GOTO_CLONE_ZERO: '0',
      STRUCTURED_GOTO_CLONE_RETURN: '0',
      STRUCTURED_GOTO_MERGE_ARRAY_PRETAIL: '0',
      STRUCTURED_GOTO_ONESHOT_PREHEADER: '0',
    },
    peepholeOptions: {
      cloneSharedLoopIncrementTails: true,
      cloneSharedLoopIncrementTailMaxInsns: 4,
      cloneSharedLoopIncrementTailMaxRefs: 4,
    },
  });

  const names = new Set();
  for (const profile of profiles) {
    if (names.has(profile.name)) throw new Error(`duplicate catalog transform: ${profile.name}`);
    names.add(profile.name);
  }
  return profiles;
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
