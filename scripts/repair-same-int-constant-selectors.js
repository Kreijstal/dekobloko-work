#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const JAVA_TOOLS_DIR = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');
const JVM_CLI = path.join(JAVA_TOOLS_DIR, 'scripts', 'jvm-cli.js');

const input = process.argv[2] && path.resolve(process.argv[2]);
const output = process.argv[3] && path.resolve(process.argv[3]);
if (!input || !output) {
  console.error('usage: node scripts/repair-same-int-constant-selectors.js <input.class> <output.class>');
  process.exit(2);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'same-int-selector-repair-'));
try {
  const sourceJ = path.join(work, `${path.basename(input, '.class')}.j`);
  run(process.execPath, [JVM_CLI, 'disassemble', input, '--out', sourceJ]);
  const lines = fs.readFileSync(sourceJ, 'utf8').split(/\r?\n/);
  const rewrites = repair(lines);
  if (rewrites === 0) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(input, output);
    console.log(JSON.stringify({ rewrites, output }));
    process.exit(0);
  }

  const repairedJ = path.join(work, 'repaired.j');
  fs.writeFileSync(repairedJ, `${lines.join('\n')}\n`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  run(process.execPath, [JVM_CLI, 'assemble', repairedJ, '--out', output]);
  console.log(JSON.stringify({ rewrites, output }));
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

function repair(lines) {
  let rewrites = 0;
  const maxRewrites = Number(process.env.SAME_INT_SELECTOR_REPAIR_MAX_REWRITES || 32);
  for (let i = 2; i + 2 < lines.length && rewrites < maxRewrites; i += 1) {
    const branch = instructionAt(lines[i]);
    if (!branch || !branch.op.startsWith('if_icmp') || !branch.arg) continue;

    const left = instructionAt(lines[i - 2]);
    const right = instructionAt(lines[i - 1]);
    if (!left || !right || !isSimplePredicateOperand(left) || integerConstantValue(right) == null) continue;

    const falseValue = instructionAt(lines[i + 1]);
    const jump = instructionAt(lines[i + 2]);
    if (!falseValue || !jump || jump.op !== 'goto' || !jump.arg) continue;
    const selectedValue = integerConstantValue(falseValue);
    if (selectedValue == null) continue;

    const trueIndex = findLabelAfter(lines, branch.arg, i + 1);
    const joinIndex = findLabelAfter(lines, jump.arg, i + 1);
    if (trueIndex < 0 || joinIndex < 0) continue;
    const trueValue = instructionAt(lines[trueIndex]);
    if (integerConstantValue(trueValue) !== selectedValue) continue;
    if (nextInstructionIndex(lines, trueIndex + 1) !== joinIndex) continue;

    const join = instructionAt(lines[joinIndex]);
    if (!join || !join.op.startsWith('if_icmp')) continue;

    lines[i - 2] = replaceInstruction(lines[i - 2], 'nop');
    lines[i - 1] = replaceInstruction(lines[i - 1], 'nop');
    lines[i] = replaceInstruction(lines[i], 'nop');
    rewrites += 1;
  }
  return rewrites;
}

function instructionAt(line) {
  if (!line || /^\s*\./.test(line)) return null;
  const text = line.replace(/^\s*[^:\s]+:\s*/, '').trim();
  if (!text) return null;
  const [op, ...rest] = text.split(/\s+/);
  return { op, arg: rest.join(' ') };
}

function replaceInstruction(line, instruction) {
  const match = /^(\s*(?:[^:\s]+:\s*)?)/.exec(line);
  return `${match ? match[1] : ''}${instruction}`;
}

function findLabelAfter(lines, label, start) {
  const wanted = `${labelName(label)}:`;
  for (let i = Math.max(0, start); i < lines.length; i += 1) {
    if (/^\s*\.end\s+code\b/.test(lines[i])) return -1;
    if (lines[i].trimStart().startsWith(wanted)) return i;
  }
  return -1;
}

function nextInstructionIndex(lines, start) {
  for (let i = start; i < lines.length; i += 1) {
    if (instructionAt(lines[i])) return i;
  }
  return -1;
}

function labelName(label) {
  return String(label || '').replace(/:$/, '');
}

function isSimplePredicateOperand(insn) {
  return integerConstantValue(insn) != null
    || insn.op === 'getstatic'
    || insn.op === 'iload'
    || /^iload_[0-3]$/.test(insn.op);
}

function integerConstantValue(insn) {
  if (!insn) return null;
  if (insn.op === 'iconst_m1') return -1;
  const iconst = /^iconst_([0-5])$/.exec(insn.op);
  if (iconst) return Number(iconst[1]);
  if (insn.op === 'bipush' || insn.op === 'sipush' || insn.op === 'ldc' || insn.op === 'ldc_w') {
    const value = Number(insn.arg);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    const detail = result.error ? result.error.message : (result.stderr || result.stdout || '').trim();
    throw new Error(`${cmd} ${args.join(' ')} failed: ${detail}`);
  }
}
