#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { createRequire } = Module;
const { spawnSync } = require('child_process');

const DEKOB = path.resolve(__dirname, '..', '..');
const JT = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');
const jtRequire = createRequire(path.join(JT, 'package.json'));
const { getAST } = jtRequire('jvm_parser');
const { convertJson } = require(path.join(JT, 'src/parsing/convert_tree'));

const VERIFY_CLASS = path.join(DEKOB, 'scripts', 'Verify.class');
const VERIFY_JAVA = path.join(DEKOB, 'scripts', 'Verify.java');
const ASM_CP = [
  path.join(JT, 'lib', 'asm-9.9.1.jar'),
  path.join(JT, 'lib', 'asm-tree-9.9.1.jar'),
  path.join(JT, 'lib', 'asm-analysis-9.9.1.jar'),
  path.join(DEKOB, 'scripts'),
].join(path.delimiter);

function usage() {
  console.error('Usage: node scripts/pipeline/structural-select-better.js <baseline-dir> <candidate-dir> <out-dir> [--no-verify]');
  console.error('  Cheap per-class selector: no CFR run. Candidate is selected only when bytecode CFG risk drops and hard red flags do not increase.');
}

function main(argv) {
  const [baselineDir, candidateDir, outDir, ...flags] = argv;
  if (!baselineDir || !candidateDir || !outDir) {
    usage();
    process.exit(2);
  }
  const verify = !flags.includes('--no-verify');
  if (verify) ensureVerify();
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const rows = [];
  let selected = 0;
  let rejected = 0;
  let missing = 0;
  for (const rel of listClassFiles(baselineDir)) {
    const baselinePath = path.join(baselineDir, rel);
    const candidatePath = path.join(candidateDir, rel);
    const outPath = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    if (!fs.existsSync(candidatePath)) {
      fs.copyFileSync(baselinePath, outPath);
      missing += 1;
      rows.push({ class: rel, action: 'baseline', reason: 'missing-candidate' });
      continue;
    }

    const baseline = scoreClassFile(baselinePath);
    const candidate = scoreClassFile(candidatePath);
    const candidateVerifies = verify ? verifyClass(candidatePath) : true;
    const decision = candidateIsStructurallyBetter(baseline, candidate, candidateVerifies);
    if (decision.accept) {
      fs.copyFileSync(candidatePath, outPath);
      selected += 1;
      rows.push({ class: rel, action: 'candidate', reason: decision.reason, baseline, candidate });
    } else {
      fs.copyFileSync(baselinePath, outPath);
      rejected += 1;
      rows.push({ class: rel, action: 'baseline', reason: decision.reason, baseline, candidate });
    }
  }

  const reportPath = path.join(outDir, 'structural-select-better-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(rows, null, 2));
  console.log(`selected=${selected} rejected=${rejected} missing=${missing} total=${rows.length}`);
  console.log(`report: ${reportPath}`);
}

function candidateIsStructurallyBetter(baseline, candidate, verifies) {
  if (!verifies) return { accept: false, reason: 'verify-failed' };
  if (!isLikelyCfrHostile(baseline)) return { accept: false, reason: 'baseline-not-structurally-hostile' };
  if (candidate.errors > baseline.errors) return { accept: false, reason: 'parse-errors-increased' };
  if (candidate.switches > baseline.switches) return { accept: false, reason: 'switches-increased' };
  if (candidate.exceptionHandlers > baseline.exceptionHandlers) return { accept: false, reason: 'handlers-increased' };
  if (candidate.maxMethodInsns > Math.max(250, baseline.maxMethodInsns * 1.25)) {
    return { accept: false, reason: 'method-size-inflated' };
  }
  if (candidate.irreducibleJoinScore > baseline.irreducibleJoinScore) {
    return { accept: false, reason: 'irreducible-join-score-increased' };
  }
  if (candidate.forwardGotoScore > baseline.forwardGotoScore) {
    return { accept: false, reason: 'forward-goto-score-increased' };
  }
  const riskDelta = baseline.totalRisk - candidate.totalRisk;
  const materialDelta = Math.max(25, Math.ceil(baseline.totalRisk * 0.03));
  if (riskDelta >= materialDelta) return { accept: true, reason: 'material-risk-decreased' };
  return { accept: false, reason: 'risk-not-decreased' };
}

function isLikelyCfrHostile(score) {
  return score.totalRisk >= 1000 ||
    score.forwardGotoScore >= 140 ||
    score.irreducibleJoinScore >= 130 ||
    score.stackJoinScore >= 75 ||
    score.backwardIntoSharedHeaderScore >= 20;
}

function scoreClassFile(file) {
  try {
    const parsed = getAST(new Uint8Array(fs.readFileSync(file)));
    const ast = convertJson(parsed.ast, parsed.constantPool);
    return scoreAst(ast);
  } catch (err) {
    return {
      totalRisk: Number.MAX_SAFE_INTEGER,
      errors: 1,
      error: err && err.message ? err.message : String(err),
    };
  }
}

function scoreAst(ast) {
  const score = {
    methods: 0,
    instructions: 0,
    maxMethodInsns: 0,
    switches: 0,
    exceptionHandlers: 0,
    forwardGotoScore: 0,
    irreducibleJoinScore: 0,
    backwardIntoSharedHeaderScore: 0,
    stackJoinScore: 0,
    errors: 0,
    totalRisk: 0,
  };

  for (const cls of ast.classes || []) {
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      const code = getCode(item.method);
      if (!code) continue;
      const methodScore = scoreMethod(code);
      score.methods += 1;
      score.instructions += methodScore.instructions;
      score.maxMethodInsns = Math.max(score.maxMethodInsns, methodScore.instructions);
      score.switches += methodScore.switches;
      score.exceptionHandlers += methodScore.exceptionHandlers;
      score.forwardGotoScore += methodScore.forwardGotoScore;
      score.irreducibleJoinScore += methodScore.irreducibleJoinScore;
      score.backwardIntoSharedHeaderScore += methodScore.backwardIntoSharedHeaderScore;
      score.stackJoinScore += methodScore.stackJoinScore;
      score.errors += methodScore.errors;
    }
  }
  score.totalRisk =
    score.forwardGotoScore +
    score.irreducibleJoinScore * 4 +
    score.backwardIntoSharedHeaderScore * 3 +
    score.stackJoinScore * 2 +
    score.switches * 20 +
    score.exceptionHandlers;
  return score;
}

function scoreMethod(code) {
  const items = code.codeItems || [];
  const labelIndex = buildLabelIndex(items);
  const refCounts = collectLabelReferenceCounts(items);
  const incoming = collectIncomingIndexes(items);
  const instructionIndexes = [];
  let switches = 0;
  let errors = 0;
  for (let i = 0; i < items.length; i += 1) {
    if (!items[i] || !items[i].instruction) continue;
    instructionIndexes.push(i);
    const op = opcode(items[i].instruction);
    if (op === 'lookupswitch' || op === 'tableswitch') switches += 1;
  }

  let forwardGotoScore = 0;
  let irreducibleJoinScore = 0;
  let backwardIntoSharedHeaderScore = 0;
  let stackJoinScore = 0;
  const stackDepths = estimateStackDepths(items, labelIndex);

  for (const i of instructionIndexes) {
    const insn = items[i].instruction;
    const op = opcode(insn);
    const target = branchTarget(insn);
    if (!target) continue;
    const targetIdx = labelIndex.get(trimLabel(target));
    if (targetIdx == null) {
      errors += 1;
      continue;
    }
    const refs = refCounts.get(trimLabel(target)) || 0;
    const distance = Math.abs(targetIdx - i);
    const targetIncoming = incoming.get(targetIdx) || [];
    const targetStack = stackDepths.get(targetIdx);
    const sourceStack = stackDepths.get(i);
    if (targetStack != null && sourceStack != null && targetStack > 0) {
      stackJoinScore += 1;
    }
    if (op === 'goto' || op === 'goto_w') {
      if (targetIdx > i && targetIdx !== nextInstructionIndex(items, i + 1)) {
        forwardGotoScore += 1 + Math.min(8, Math.floor(distance / 40));
        if (refs > 1) forwardGotoScore += refs;
      }
      if (targetIdx < i && refs > 1 && targetIncoming.some((from) => from < targetIdx || from > i)) {
        backwardIntoSharedHeaderScore += refs;
      }
    } else if (isConditional(op) && targetIdx > i && refs > 1) {
      irreducibleJoinScore += 1 + Math.min(5, refs - 1);
    }
  }

  for (const [label, refs] of refCounts) {
    const idx = labelIndex.get(label);
    if (idx == null || refs < 2) continue;
    if (isLabelProtected(code, label)) irreducibleJoinScore += refs;
  }

  return {
    instructions: instructionIndexes.length,
    switches,
    exceptionHandlers: (code.exceptionTable || []).length,
    forwardGotoScore,
    irreducibleJoinScore,
    backwardIntoSharedHeaderScore,
    stackJoinScore,
    errors,
  };
}

function estimateStackDepths(items, labelIndex) {
  const depths = new Map();
  let depth = 0;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || !item.instruction) continue;
    depths.set(i, depth);
    const effect = stackEffect(opcode(item.instruction));
    depth = Math.max(0, depth - effect.pop + effect.push);
    if (isTerminal(opcode(item.instruction))) depth = 0;
  }
  for (const [label, idx] of labelIndex) {
    if (!depths.has(idx)) {
      const next = nextInstructionIndex(items, idx);
      if (next != null && depths.has(next)) depths.set(idx, depths.get(next));
    }
  }
  return depths;
}

function stackEffect(op) {
  if (!op) return { pop: 0, push: 0 };
  if (/^(?:iload|aload|fload|lload|dload)(?:_\d)?$/.test(op) || /^(?:iconst|aconst|fconst|lconst|dconst)_/.test(op) ||
      op === 'bipush' || op === 'sipush' || op === 'ldc' || op === 'ldc_w' || op === 'getstatic') {
    return { pop: 0, push: op.startsWith('l') || op.startsWith('d') ? 2 : 1 };
  }
  if (/^(?:istore|astore|fstore)(?:_\d)?$/.test(op)) return { pop: 1, push: 0 };
  if (/^(?:lstore|dstore)(?:_\d)?$/.test(op)) return { pop: 2, push: 0 };
  if (isConditional(op)) {
    if (op.includes('_icmp') || op.includes('_acmp')) return { pop: 2, push: 0 };
    return { pop: 1, push: 0 };
  }
  if (op === 'goto' || op === 'goto_w' || op === 'return') return { pop: 0, push: 0 };
  if (op.endsWith('return')) return { pop: op === 'lreturn' || op === 'dreturn' ? 2 : 1, push: 0 };
  if (op === 'pop') return { pop: 1, push: 0 };
  if (op === 'pop2') return { pop: 2, push: 0 };
  if (op === 'dup') return { pop: 0, push: 1 };
  if (/^(?:i|f|a)const_/.test(op)) return { pop: 0, push: 1 };
  return { pop: 0, push: 0 };
}

function listClassFiles(dir) {
  const out = [];
  walk(dir, (file) => {
    if (file.endsWith('.class')) out.push(path.relative(dir, file));
  });
  return out.sort();
}

function walk(dir, visit) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, visit);
    else if (ent.isFile()) visit(p);
  }
}

function getCode(method) {
  const attr = (method.attributes || []).find((entry) => entry && entry.type === 'code');
  return attr && attr.code;
}

function buildLabelIndex(items) {
  const out = new Map();
  for (let i = 0; i < items.length; i += 1) {
    const label = trimLabel(items[i] && items[i].labelDef);
    if (label) out.set(label, i);
  }
  return out;
}

function collectLabelReferenceCounts(items) {
  const out = new Map();
  for (const item of items) {
    if (!item || !item.instruction) continue;
    for (const label of instructionLabels(item.instruction)) {
      const key = trimLabel(label);
      out.set(key, (out.get(key) || 0) + 1);
    }
  }
  return out;
}

function collectIncomingIndexes(items) {
  const out = new Map();
  const labelIndex = buildLabelIndex(items);
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || !item.instruction) continue;
    for (const label of instructionLabels(item.instruction)) {
      const idx = labelIndex.get(trimLabel(label));
      if (idx == null) continue;
      if (!out.has(idx)) out.set(idx, []);
      out.get(idx).push(i);
    }
  }
  return out;
}

function instructionLabels(instruction) {
  const op = opcode(instruction);
  const arg = instruction && typeof instruction === 'object' ? instruction.arg : null;
  if (typeof arg === 'string' && (isConditional(op) || op === 'goto' || op === 'goto_w')) return [arg];
  if (op === 'lookupswitch' && arg) {
    return [
      arg.defaultLabel,
      ...(arg.pairs || []).map((pair) => Array.isArray(pair) ? pair[1] : null),
    ].filter(Boolean);
  }
  if (op === 'tableswitch') {
    return [
      instruction.defaultLbl,
      ...(instruction.labels || []),
    ].filter(Boolean);
  }
  return [];
}

function branchTarget(instruction) {
  const labels = instructionLabels(instruction);
  return labels.length === 1 ? labels[0] : null;
}

function nextInstructionIndex(items, start) {
  for (let i = start; i < items.length; i += 1) {
    if (items[i] && items[i].instruction) return i;
  }
  return null;
}

function isLabelProtected(code, label) {
  const target = trimLabel(label);
  for (const entry of code.exceptionTable || []) {
    if (trimLabel(entry.startLbl || entry.startLabel || entry.start) === target) return true;
    if (trimLabel(entry.endLbl || entry.endLabel || entry.end) === target) return true;
    if (trimLabel(entry.handlerLbl || entry.handlerLabel || entry.handler || entry.usingLbl) === target) return true;
  }
  return false;
}

function isConditional(op) {
  return /^if/.test(op || '');
}

function isTerminal(op) {
  return op === 'goto' || op === 'goto_w' || op === 'return' || op === 'ireturn' ||
    op === 'lreturn' || op === 'freturn' || op === 'dreturn' || op === 'areturn' ||
    op === 'athrow' || op === 'tableswitch' || op === 'lookupswitch';
}

function opcode(instruction) {
  if (!instruction) return null;
  if (typeof instruction === 'string') return instruction.split(/\s+/, 1)[0];
  return instruction.op || null;
}

function trimLabel(label) {
  return typeof label === 'string' && label.endsWith(':') ? label.slice(0, -1) : label;
}

function verifyClass(classPath) {
  const result = spawnSync('java', ['-cp', ASM_CP, 'Verify', classPath], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 4,
  });
  return result.status === 0;
}

function ensureVerify() {
  if (fs.existsSync(VERIFY_CLASS) && fs.statSync(VERIFY_CLASS).mtimeMs >= fs.statSync(VERIFY_JAVA).mtimeMs) return;
  const result = spawnSync('javac', ['-cp', ASM_CP, '-d', path.join(DEKOB, 'scripts'), VERIFY_JAVA], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`failed to build Verify.java\n${result.stdout || ''}${result.stderr || ''}`);
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  candidateIsStructurallyBetter,
  scoreClassFile,
  scoreAst,
  scoreMethod,
};
