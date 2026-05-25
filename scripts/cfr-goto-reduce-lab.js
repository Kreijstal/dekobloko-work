#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DEKOB = path.resolve(__dirname, '..');
const JAVA_TOOLS_DIR = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');
const CFR_JAR = path.join(DEKOB, 'lib', 'cfr.jar');

function usage() {
  console.error(`Usage:
  node scripts/cfr-goto-reduce-lab.js reduce --input <case.j> --out <reduced.j> [--min-markers 1] [--max-attempts 80] [--work .work/cfr-goto-reducer]`);
}

function main(argv) {
  const cmd = argv[0];
  if (cmd !== 'reduce') {
    usage();
    process.exit(cmd ? 2 : 0);
  }
  const args = parseArgs(argv.slice(1));
  const result = reduce(args);
  printResult(result);
}

function parseArgs(argv) {
  const out = {
    input: null,
    out: null,
    work: path.join(DEKOB, '.work', 'cfr-goto-reducer'),
    minMarkers: 1,
    maxAttempts: 80,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') out.input = path.resolve(argv[++i]);
    else if (arg.startsWith('--input=')) out.input = path.resolve(arg.slice('--input='.length));
    else if (arg === '--out') out.out = path.resolve(argv[++i]);
    else if (arg.startsWith('--out=')) out.out = path.resolve(arg.slice('--out='.length));
    else if (arg === '--work') out.work = path.resolve(argv[++i]);
    else if (arg.startsWith('--work=')) out.work = path.resolve(arg.slice('--work='.length));
    else if (arg === '--min-markers') out.minMarkers = Number(argv[++i]);
    else if (arg.startsWith('--min-markers=')) out.minMarkers = Number(arg.slice('--min-markers='.length));
    else if (arg === '--max-attempts') out.maxAttempts = Number(argv[++i]);
    else if (arg.startsWith('--max-attempts=')) out.maxAttempts = Number(arg.slice('--max-attempts='.length));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!out.input) throw new Error('--input is required');
  if (!out.out) throw new Error('--out is required');
  if (!Number.isFinite(out.minMarkers) || out.minMarkers < 1) throw new Error('--min-markers must be >= 1');
  if (!Number.isFinite(out.maxAttempts) || out.maxAttempts < 1) throw new Error('--max-attempts must be >= 1');
  return out;
}

function reduce(args) {
  const original = fs.readFileSync(args.input, 'utf8');
  fs.rmSync(args.work, { recursive: true, force: true });
  fs.mkdirSync(args.work, { recursive: true });

  const baseline = evaluate(original, args.work, 'baseline');
  if (!baseline.ok || baseline.markers < args.minMarkers) {
    throw new Error(`baseline does not reproduce: ok=${baseline.ok} markers=${baseline.markers} error=${baseline.error || ''}`);
  }

  let best = original;
  let attempts = 0;
  let accepted = 0;
  const history = [];
  for (let chunk = initialChunkSize(best); chunk >= 1 && attempts < args.maxAttempts; chunk = Math.floor(chunk / 2)) {
    let changedAtSize = true;
    while (changedAtSize && attempts < args.maxAttempts) {
      changedAtSize = false;
      const plan = parseReducibleMethod(best);
      for (let start = 0; start < plan.blocks.length && attempts < args.maxAttempts; start += chunk) {
        const end = Math.min(plan.blocks.length, start + chunk);
        const candidate = deleteBlocks(plan, start, end);
        if (!candidate || candidate === best) continue;
        attempts += 1;
        const trial = evaluate(candidate, args.work, `try-${attempts}`);
        history.push({ attempt: attempts, chunk, start, end, ok: trial.ok, markers: trial.markers, lines: lineCount(candidate), error: trial.error || null });
        if (trial.ok && trial.markers >= args.minMarkers) {
          best = candidate;
          accepted += 1;
          changedAtSize = true;
          console.log(`accepted attempt=${attempts} chunk=${chunk} blocks=${start}-${end} markers=${trial.markers} lines=${lineCount(best)}`);
          break;
        }
      }
    }
  }

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, best, 'utf8');
  fs.writeFileSync(path.join(args.work, 'history.json'), `${JSON.stringify(history, null, 2)}\n`, 'utf8');
  return {
    input: args.input,
    out: args.out,
    baselineMarkers: baseline.markers,
    final: evaluate(best, args.work, 'final'),
    originalLines: lineCount(original),
    finalLines: lineCount(best),
    attempts,
    accepted,
    history: path.join(args.work, 'history.json'),
  };
}

function initialChunkSize(text) {
  const plan = parseReducibleMethod(text);
  let chunk = 1;
  while (chunk * 2 <= plan.blocks.length / 2) chunk *= 2;
  return Math.max(1, chunk);
}

function parseReducibleMethod(text) {
  const lines = text.split(/\r?\n/);
  const methodStart = lines.findIndex((line) => line.startsWith('.method '));
  const codeStart = lines.findIndex((line, idx) => idx > methodStart && line.trim().startsWith('.code '));
  const codeEnd = lines.findIndex((line, idx) => idx > codeStart && line.trim() === '.end code');
  if (methodStart < 0 || codeStart < 0 || codeEnd < 0) throw new Error('expected one Jasmin method with .code');
  const blocks = [];
  let cur = null;
  for (let i = codeStart + 1; i < codeEnd; i += 1) {
    if (/^\s*L[\w$]+:/.test(lines[i])) {
      if (cur) blocks.push(cur);
      cur = { start: i, end: i + 1 };
    } else if (cur) {
      cur.end = i + 1;
    }
  }
  if (cur) blocks.push(cur);
  if (!blocks.length) throw new Error('no label blocks found');
  return { text, lines, codeStart, codeEnd, blocks };
}

function deleteBlocks(plan, startBlock, endBlock) {
  const deleteStart = plan.blocks[startBlock] && plan.blocks[startBlock].start;
  const deleteEnd = plan.blocks[endBlock - 1] && plan.blocks[endBlock - 1].end;
  if (deleteStart == null || deleteEnd == null || deleteStart >= deleteEnd) return null;

  const deleted = plan.lines.slice(deleteStart, deleteEnd);
  const deletedLabels = new Set(deleted.map(labelDefOf).filter(Boolean));
  if (!deletedLabels.size) return null;
  const keptLines = plan.lines.slice(0, deleteStart).concat(plan.lines.slice(deleteEnd));
  const keptRefs = collectRefs(keptLines);
  for (const label of deletedLabels) {
    if (keptRefs.has(label)) return null;
  }
  return keptLines.join('\n');
}

function evaluate(text, workRoot, name) {
  const dir = path.join(workRoot, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const jPath = path.join(dir, 'Candidate.j');
  const classPath = path.join(dir, 'Candidate.class');
  fs.writeFileSync(jPath, text, 'utf8');
  const assemble = spawnSync(process.execPath, [
    path.join(JAVA_TOOLS_DIR, 'scripts', 'jvm-cli.js'),
    'assemble',
    jPath,
    '--out',
    classPath,
  ], { cwd: DEKOB, encoding: 'utf8', timeout: 30000 });
  if (assemble.status !== 0) {
    return { ok: false, markers: 0, error: shortLog(assemble.stderr || assemble.stdout || 'assemble failed') };
  }
  const cfrDir = path.join(dir, 'cfr');
  fs.mkdirSync(cfrDir, { recursive: true });
  const cfr = spawnSync('java', ['-jar', CFR_JAR, classPath, '--outputdir', cfrDir, '--silent', 'true', '--caseinsensitivefs', 'false'], {
    cwd: DEKOB,
    encoding: 'utf8',
    timeout: 30000,
  });
  if (cfr.error) return { ok: false, markers: 0, error: shortLog(cfr.error.message) };
  return { ok: true, markers: countMarkers(cfrDir), cfrStatus: cfr.status };
}

function countMarkers(cfrDir) {
  if (!fs.existsSync(cfrDir)) return 0;
  let count = 0;
  for (const file of fs.readdirSync(cfrDir)) {
    if (!file.endsWith('.java')) continue;
    for (const line of fs.readFileSync(path.join(cfrDir, file), 'utf8').split(/\r?\n/)) {
      if (/\*\* GOTO|Unable to fully structure code|lbl-1000/.test(line)) count += 1;
    }
  }
  return count;
}

function collectRefs(lines) {
  const refs = new Set();
  for (const line of lines) {
    const branch = /\b(?:goto|goto_w|jsr|if[a-z_]*|if_[a-z_]+)\s+(L[\w$]+)/g;
    let match;
    while ((match = branch.exec(line))) refs.add(match[1]);
  }
  return refs;
}

function labelDefOf(line) {
  const match = /^\s*(L[\w$]+):/.exec(line);
  return match ? match[1] : null;
}

function lineCount(text) {
  return text.split(/\r?\n/).length;
}

function shortLog(text) {
  return String(text || '').trim().replace(/\s+/g, ' ').slice(0, 240);
}

function printResult(result) {
  console.log(`baseline_markers=${result.baselineMarkers}`);
  console.log(`final_markers=${result.final.markers}`);
  console.log(`lines=${result.originalLines}->${result.finalLines}`);
  console.log(`attempts=${result.attempts}`);
  console.log(`accepted=${result.accepted}`);
  console.log(`out=${result.out}`);
  console.log(`history=${result.history}`);
}

main(process.argv.slice(2));
