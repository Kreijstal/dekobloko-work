#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const DEKOB_DIR = path.resolve(__dirname, '..');
const JAVA_TOOLS_DIR = process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools';
const BULK_PIPELINE = path.join(DEKOB_DIR, 'scripts', 'pipeline', 'bulk-pipeline.js');
const CFR_JAR = path.join(DEKOB_DIR, 'lib', 'cfr.jar');

function usage(message) {
  if (message) {
    console.error(`error: ${message}`);
  }
  console.error(`Usage: ${path.basename(process.argv[1])} <input-classes-dir> [options]

Options:
  --out-dir <dir>        output working directory (default: temp dir)
  --safe-bytecode         pass --safe-bytecode to bulk pipeline
  --profile <name>        profile to pass to bulk-pipeline (default: dekobloko)
  --max-passes <N>       stop after first N pass names
  --sample-classes <N>   limit run to first N classes (copied to temporary input)
  --include-post-final     include post-final synthetic passes in analysis
  --json                  machine-readable JSON summary output
  --help                  show usage`);
  process.exit(message ? 2 : 0);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.length < 1) usage();
const inputDir = path.resolve(args.shift());
const opts = {
  outDir: '',
  safeBytecode: false,
  profile: 'dekobloko',
  maxPasses: Infinity,
  sampleClasses: 0,
  includePostFinal: false,
  json: false,
};
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--out-dir') {
    opts.outDir = args[++i];
  } else if (arg === '--safe-bytecode') {
    opts.safeBytecode = true;
  } else if (arg === '--profile') {
    opts.profile = args[++i];
  } else if (arg === '--max-passes') {
    opts.maxPasses = Number(args[++i]) || 0;
  } else if (arg === '--sample-classes') {
    opts.sampleClasses = Number(args[++i]) || 0;
  } else if (arg === '--include-post-final') {
    opts.includePostFinal = true;
  } else if (arg === '--json') {
    opts.json = true;
  } else {
    usage(`unknown option: ${arg}`);
  }
}

if (!fs.existsSync(inputDir) || !fs.lstatSync(inputDir).isDirectory()) {
  usage(`missing input class directory: ${inputDir}`);
}
if (!fs.existsSync(CFR_JAR)) {
  throw new Error(`missing CFR jar: ${CFR_JAR}`);
}

function listClassFilesRecursively(dir, root = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs);
    if (entry.isDirectory()) {
      listClassFilesRecursively(abs, root, out);
    } else if (entry.isFile() && entry.name.endsWith('.class')) {
      out.push(rel);
    }
  }
  return out;
}

function collectPasses() {
  const bulkText = fs.readFileSync(BULK_PIPELINE, 'utf8');
  const names = [];
  const seen = new Set();
  const regex = /\{\s*name:\s*'([^']+)'\s*,/g;
  let match;
  while ((match = regex.exec(bulkText)) !== null) {
    const passName = match[1];
    if (!seen.has(passName)) {
      names.push(passName);
      seen.add(passName);
    }
  }
  const basePasses = names;
  if (!opts.includePostFinal) {
    return basePasses;
  }
  return basePasses.concat([
    'inline-single-use-boolean-branch-post',
    'post-final:peephole',
    'post-final:terminal-iterator-extract',
    'post-final:terminal-action-extract',
    'post-final:terminal-cleanup-extract',
    'post-final:structured-goto-clone',
  ]);
}

function copySampleInput(sourceDir, targetDir, limit) {
  if (limit <= 0) return;
  const all = listClassFilesRecursively(sourceDir);
  const chosen = all.slice(0, limit);
  for (const rel of chosen) {
    const src = path.join(sourceDir, rel);
    const dst = path.join(targetDir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

function listClassFilesForCfr(dir) {
  const files = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile() && entry.name.endsWith('.class')) {
        files.push(abs);
      }
    }
  };
  walk(dir);
  return files;
}

function countRegexMatches(text, regex) {
  const match = text.match(regex);
  return match ? match.length : 0;
}

function countMarkers(javaOutputDir) {
  let gotos = 0;
  let unable = 0;
  const files = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && abs.endsWith('.java')) files.push(abs);
    }
  };
  walk(javaOutputDir);
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    gotos += countRegexMatches(text, /\*\* GOTO/g);
    unable += countRegexMatches(text, /Unable to fully structure code|lbl-1000/g);
  }
  return { gotos, unable };
}

function runCfr(classDir) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'goto-pass-cfr-'));
  const classFiles = listClassFilesForCfr(classDir);
  if (classFiles.length === 0) {
    throw new Error(`no .class files in ${classDir}`);
  }
  const cfr = spawnSync('java', ['-jar', CFR_JAR, ...classFiles, '--outputdir', outDir], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (cfr.status !== 0) {
    throw new Error(`cfr failed in ${classDir}: ${cfr.stdout || ''}${cfr.stderr || ''}`);
  }
  const markers = countMarkers(outDir);
  fs.rmSync(outDir, { recursive: true, force: true });
  return markers;
}

function runPipeline(inDir, outDir, skipPasses) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const args = [BULK_PIPELINE, inDir, outDir];
  if (opts.profile) {
    args.push('--profile', opts.profile);
  }
  if (opts.safeBytecode) {
    args.push('--safe-bytecode');
  }
  const env = {
    ...process.env,
    JAVA_TOOLS_DIR,
    SKIP_PIPELINE_PASSES: skipPasses.join(','),
  };
  const proc = spawnSync('node', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env,
  });
  if (proc.status !== 0) {
    const stderr = [proc.stdout, proc.stderr].filter(Boolean).join('\n');
    if (stderr) {
      console.error(stderr);
    }
    throw new Error(`bulk-pipeline failed (skip=${skipPasses.join(',') || 'none'})`);
  }
  if (!opts.json && proc.stdout) process.stdout.write(proc.stdout);
  if (!opts.json && proc.stderr) process.stderr.write(proc.stderr);
}

const passes = collectPasses();
const selectedPasses = passes.slice(0, opts.maxPasses);
if (!selectedPasses.length) {
  usage('No passes selected for analysis');
}
const baseName = `goto-pass-impact-${Date.now()}`;
const workBase = path.resolve(opts.outDir || path.join(os.tmpdir(), baseName));
fs.mkdirSync(workBase, { recursive: true });
const cleanup = () => { fs.rmSync(workBase, { recursive: true, force: true }); };

let inputForRun = inputDir;
let tempInput = '';
if (opts.sampleClasses > 0) {
  tempInput = path.join(workBase, 'sample-classes');
  fs.mkdirSync(tempInput, { recursive: true });
  copySampleInput(inputDir, tempInput, opts.sampleClasses);
  inputForRun = tempInput;
}

  try {
    const noPassOut = path.join(workBase, 'stage-none');
    runPipeline(inputForRun, noPassOut, selectedPasses);
    const baseline = runCfr(noPassOut);
    if (!opts.json) {
      console.log(`baseline (0 passes): gotos=${baseline.gotos} unable=${baseline.unable}`);
    }
  let previous = baseline;
  const rows = [];
  const increasing = [];

    for (let i = 0; i < selectedPasses.length; i += 1) {
      const passName = selectedPasses[i];
      const skip = selectedPasses.slice(i + 1);
      const stageDir = path.join(workBase, `stage-${String(i).padStart(3, '0')}-${passName}`);
      runPipeline(inputForRun, stageDir, skip);
      const outCfr = runCfr(stageDir);
    const delta = outCfr.gotos - previous.gotos;
    const unableDelta = outCfr.unable - previous.unable;
    const marker = delta > 0 ? '+' : '';
    const status = delta > 0 ? 'WORSE' : (delta < 0 ? 'better' : 'same');
    rows.push({
      index: i,
      pass: passName,
      gotos: outCfr.gotos,
      unable: outCfr.unable,
      beforeGotos: previous.gotos,
      beforeUnable: previous.unable,
      delta,
      unableDelta,
      status,
      outputDir: stageDir,
    });
      if (!opts.json) {
        if (i < 15 || delta !== 0 || i === selectedPasses.length - 1) {
          console.log(`${String(i).padStart(3, '0')} ${passName.padEnd(35)} gotos=${outCfr.gotos.toString().padStart(4)} (${marker}${delta}) unable=${outCfr.unable.toString().padStart(3)} ${status}`);
        }
      }
    if (outCfr.gotos > previous.gotos) {
      increasing.push(rows[rows.length - 1]);
    }
    previous = outCfr;
  }

  if (!opts.json) {
    if (increasing.length === 0) {
      console.log('No pass increased GOTO marker count in this run.');
    } else {
      console.log('\nPasses that increased GOTO counts:');
      for (const hit of increasing) {
        console.log(`- ${hit.pass}: ${hit.beforeGotos} -> ${hit.gotos} (+${hit.delta})`);
      }
    }
  }

  if (opts.json) {
    const summary = {
      inputDir: inputForRun,
      passesAnalyzed: selectedPasses.length,
      profile: opts.profile,
      safeBytecode: opts.safeBytecode,
      includePostFinal: opts.includePostFinal,
      sampleClasses: opts.sampleClasses,
      baseline,
      rows,
      regressionPasses: increasing.map((r) => r.pass),
    };
    console.log(JSON.stringify(summary, null, 2));
  }
} finally {
  cleanup();
}
