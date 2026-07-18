#!/usr/bin/env node
'use strict';

/**
 * goto-oracle-split — CFR-oracle-guided node-splitting to eliminate residual
 * `** GOTO` / "Unable to fully structure code" markers a decompiler emits on
 * irreducible/over-joined control flow.
 *
 * Greedy search: enumerate every safe tail-duplication candidate (a join block
 * with a goto predecessor, from tailDuplicateJoin.js), apply each to a fresh
 * copy of the class, run CFR, and keep the single split that most reduces the
 * marker count. Repeat until no candidate improves. Every split is pure node
 * splitting (byte-identical clone entered by the same jump), so the transform
 * is always semantics-preserving; CFR decides which splits actually help.
 *
 * Usage:
 *   node scripts/goto-oracle-split.js <input.class> <output.class> [--max-iters N] [--verbose]
 *
 * Env: JAVA_TOOLS_DIR (default /home/kreijstal/git/java-tools), CFR_JAR
 *      (default <repo>/lib/cfr.jar).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const v8 = require('v8');
const { spawnSync } = require('child_process');

const JAVA_TOOLS_DIR = path.resolve(process.env.JAVA_TOOLS_DIR || '/home/kreijstal/git/java-tools');
const REPO_DIR = path.resolve(__dirname, '..');
const CFR_JAR = path.resolve(process.env.CFR_JAR || path.join(REPO_DIR, 'lib', 'cfr.jar'));

const { getAST } = require(path.join(JAVA_TOOLS_DIR, 'node_modules', 'jvm_parser'));
const { convertJson } = require(path.join(JAVA_TOOLS_DIR, 'src', 'parsing', 'convert_tree'));
const { writeClassAstToClassFile } = require(path.join(JAVA_TOOLS_DIR, 'src', 'parsing', 'classAstToClassFile'));
const { listJoinCandidates, applyJoinSplit } = require(path.join(JAVA_TOOLS_DIR, 'src', 'passes', 'tailDuplicateJoin'));

function parseArgs(argv) {
  const pos = [];
  const opts = { maxIters: 24, maxCandidates: 120, minPreds: 3, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--max-iters') opts.maxIters = parseInt(argv[++i], 10);
    else if (a === '--max-candidates') opts.maxCandidates = parseInt(argv[++i], 10);
    else if (a === '--min-preds') opts.minPreds = parseInt(argv[++i], 10);
    else if (a === '--verbose') opts.verbose = true;
    else pos.push(a);
  }
  opts.input = pos[0] && path.resolve(pos[0]);
  opts.output = pos[1] && path.resolve(pos[1]);
  return opts;
}

function loadAst(classFile) {
  const bytes = fs.readFileSync(classFile);
  const parsed = getAST(new Uint8Array(bytes));
  return convertJson(parsed.ast, parsed.constantPool);
}

function writeAst(astRoot, classFile) {
  writeClassAstToClassFile(astRoot, classFile);
}

function cfrMarkers(classFile, work) {
  const dir = fs.mkdtempSync(path.join(work, 'cfr-'));
  try {
    const res = spawnSync('java', ['-jar', CFR_JAR, classFile, '--outputdir', dir,
      '--silent', 'true', '--caseinsensitivefs', 'false'],
      { encoding: 'utf8', timeout: 180000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024 });
    if (res.error || res.status !== 0) return null;
    let gotos = 0, unable = 0, exc = 0;
    let files = [];
    try { files = fs.readdirSync(dir); } catch { return null; }
    const methods = new Set();
    for (const name of files) {
      if (!name.endsWith('.java')) continue;
      const text = fs.readFileSync(path.join(dir, name), 'utf8');
      gotos += (text.match(/\*\* GOTO/g) || []).length;
      unable += (text.match(/Unable to fully structure code/g) || []).length;
      exc += (text.match(/Exception decompiling/g) || []).length;
      for (const mn of markerMethodNames(text)) methods.add(mn);
    }
    return { gotos, unable, exc, total: gotos + unable, methods };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Names of methods whose body contains a `** GOTO` / "Unable to fully
 * structure code" marker. Scans each marker line back to its enclosing method
 * declaration and extracts the method name. Java methods are unique by
 * (name, descriptor), so filtering candidate splits to these names confines the
 * CFR-in-the-loop search to the handful of methods CFR actually cannot
 * structure — turning a whole-class brute force into a targeted one.
 */
function markerMethodNames(text) {
  const lines = text.split('\n');
  const decl = /^\s*(?:(?:public|private|protected|static|final|abstract|synchronized|native|strictfp|default)\s+)*[\w$.\[\]<>?, ]+?\s+(\w+)\s*\([^;{]*\)\s*(?:throws [\w$., ]+)?\{\s*$/;
  const kw = new Set(['if', 'while', 'for', 'switch', 'catch', 'return', 'new', 'else']);
  const nameAt = (m) => (m && m[1] && !kw.has(m[1]) ? m[1] : null);
  const names = new Set();
  for (let i = 0; i < lines.length; i++) {
    const isGoto = /\*\* GOTO/.test(lines[i]);
    const isUnable = /Unable to fully structure code/.test(lines[i]);
    if (!isGoto && !isUnable) continue;
    // `** GOTO` sits in the method body (scan up to the signature). "Unable to
    // fully structure" sits in the javadoc directly above the signature (scan
    // down to it). Using the correct direction per marker keeps the set to
    // exactly the methods CFR cannot structure — no neighbour false positives.
    if (isGoto) {
      for (let j = i; j >= 0; j--) { const n = nameAt(decl.exec(lines[j])); if (n) { names.add(n); break; } }
    } else {
      for (let j = i; j < lines.length; j++) { const n = nameAt(decl.exec(lines[j])); if (n) { names.add(n); break; } }
    }
  }
  return names;
}

/** Find the code attribute of the method a candidate targets, so its codeItems
 * can be snapshotted/restored around a trial split. */
function findMethodCode(ast, cand) {
  for (const classItem of (ast.classes || [])) {
    if (classItem.className !== cand.owner) continue;
    for (const item of (classItem.items || [])) {
      if (!item || item.type !== 'method' || !item.method) continue;
      if (item.method.name !== cand.name || item.method.descriptor !== cand.desc) continue;
      const codeAttr = (item.method.attributes || []).find((a) => a.type === 'code');
      return codeAttr && codeAttr.code ? codeAttr.code : null;
    }
  }
  return null;
}

function better(a, b) {
  // a strictly better than b: fewer gotos, or same gotos and fewer total, and
  // never more exceptions.
  if (a.exc > b.exc) return false;
  if (a.gotos !== b.gotos) return a.gotos < b.gotos;
  if (a.total !== b.total) return a.total < b.total;
  return false;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.input || !opts.output) {
    console.error('usage: node scripts/goto-oracle-split.js <input.class> <output.class> [--max-iters N] [--verbose]');
    process.exit(2);
  }
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'goto-oracle-split-'));
  const tmpClass = path.join(work, 'cand.class');
  let applied = 0;
  try {
    let ast = loadAst(opts.input);
    writeAst(ast, tmpClass);
    let current = cfrMarkers(tmpClass, work);
    if (!current) { fs.copyFileSync(opts.input, opts.output); console.log(JSON.stringify({ applied: 0, reason: 'cfr-baseline-failed' })); return; }
    if (opts.verbose) console.error(`baseline gotos=${current.gotos} unable=${current.unable} exc=${current.exc}`);

    for (let iter = 0; iter < opts.maxIters && current.total > 0; iter++) {
      // Worthwhile split sites: multi-way joins (>=3 preds), conditional-headed
      // loop guards, or any join fed by a conditional edge (the `if (...) ** GOTO`
      // shape, which is only 2-predecessor). Simple 2-pred goto/fallthrough
      // diamonds CFR structures itself, so they are excluded. Prioritise the
      // most likely marker sites and cap per-iteration trials to keep the
      // CFR-in-the-loop search tractable on large classes.
      // Residual `** GOTO` on reducible flow (CFR's structuring limit, not
      // irreducibility) sits at genuine multi-way joins. Restrict to joins with
      // >= minPreds predecessors, confined to the methods CFR marks, ranked by
      // predecessor count. This keeps the CFR-in-the-loop sweep to a few dozen
      // trials per method instead of hundreds.
      const markerMethods = current.methods || new Set();
      const candidates = listJoinCandidates(ast)
        .filter((c) => c.allPreds >= opts.minPreds || c.hasCondHead || c.hasCondPred)
        .filter((c) => markerMethods.size === 0 || markerMethods.has(c.name))
        .sort((a, b) => b.allPreds - a.allPreds || (b.hasCondPred - a.hasCondPred) || a.bodyInsns - b.bodyInsns)
        .slice(0, opts.maxCandidates);
      let best = null; let bestCand = null;
      for (const cand of candidates) {
        // Snapshot only the one method the split mutates, apply in place, CFR,
        // then restore — far cheaper than deep-cloning the whole class per
        // candidate on large classes.
        const code = findMethodCode(ast, cand);
        if (!code) continue;
        const saved = v8.serialize(code.codeItems);
        const r = applyJoinSplit(ast, cand);
        let mk = null;
        if (r.changed) {
          try { writeAst(ast, tmpClass); mk = cfrMarkers(tmpClass, work); } catch { mk = null; }
        }
        code.codeItems = v8.deserialize(saved); // revert without changing BigInt operands
        if (mk && better(mk, current) && (best === null || better(mk, best))) {
          best = mk; bestCand = cand;
        }
      }
      if (!best) break;
      applyJoinSplit(ast, bestCand); // apply the winner permanently
      current = best; applied++;
      if (opts.verbose) console.error(`iter ${iter}: split ${bestCand.name}${bestCand.desc} @${bestCand.label} -> gotos=${current.gotos} unable=${current.unable} exc=${current.exc}`);
    }

    writeAst(ast, opts.output);
    console.log(JSON.stringify({ applied, gotos: current.gotos, unable: current.unable, exc: current.exc }));
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main();
