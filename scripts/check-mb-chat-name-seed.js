#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const DEKOB = path.resolve(__dirname, '..');
const JT = path.resolve(process.env.JAVA_TOOLS_DIR || process.env.JT_DIR || '/home/kreijstal/git/java-tools');
process.env.NODE_PATH = [path.join(JT, 'node_modules'), process.env.NODE_PATH || '']
  .filter(Boolean)
  .join(path.delimiter);
Module._initPaths();

const jtRequire = Module.createRequire(path.join(JT, 'package.json'));
const { getAST } = jtRequire('jvm_parser');
const { convertJson } = require(path.join(JT, 'src/parsing/convert_tree'));
const { buildCfg, reachingDefinitions } = require(path.join(JT, 'src/passes/splitArrayReachingLocal'));

const classFile = path.resolve(process.argv[2] || path.join(DEKOB, 'classes-original', 'mb.class'));
const bytes = fs.readFileSync(classFile);
const parsed = getAST(new Uint8Array(bytes));
const ast = convertJson(parsed.ast, parsed.constantPool);
const method = findChatFormatter(ast);
const code = method.attributes
  .map((attr) => attr && attr.type === 'code' && attr.code)
  .find(Boolean);

if (!code || !Array.isArray(code.codeItems)) fail('mb.a(int, hl) has no Code attribute');

const items = code.codeItems;
const tier2LoadIndex = findTier2NameLoad(items);
const tier2Local = aloadLocal(items[tier2LoadIndex]);
const analysis = reachingDefinitions(code, buildCfg(code));
const reaching = analysis.before[tier2LoadIndex] && analysis.before[tier2LoadIndex].get(tier2Local);

if (!reaching || ![...reaching].some((defId) => originatesAtNameField(items, analysis, defId, new Set()))) {
  const defs = reaching ? [...reaching].join(', ') : 'none';
  fail(`tier-2 name load from local ${tier2Local} is not reached by hl.p (definitions: ${defs})`);
}

console.log(`PASS: mb.a tier-2 name local ${tier2Local} retains the hl.p seed`);

function findChatFormatter(root) {
  for (const cls of root.classes || []) {
    if (cls.className !== 'mb') continue;
    for (const item of cls.items || []) {
      const candidate = item && item.type === 'method' && item.method;
      if (candidate && candidate.name === 'a' && candidate.descriptor === '(ILhl;)Ljava/lang/String;') {
        return candidate;
      }
    }
  }
  fail('mb.a(int, hl) was not found');
}

function findTier2NameLoad(codeItems) {
  const iconIndex = codeItems.findIndex((item) => op(item) === 'ldc' && arg(item) === '<img=1>');
  if (iconIndex < 0) fail('tier-2 <img=1> formatter was not found');
  const prefixAppend = findNextStringAppend(codeItems, iconIndex + 1);
  const nameAppend = findNextStringAppend(codeItems, prefixAppend + 1);
  for (let i = nameAppend - 1; i > prefixAppend; i -= 1) {
    if (aloadLocal(codeItems[i]) != null) return i;
  }
  fail('tier-2 name load was not found');
}

function findNextStringAppend(codeItems, start) {
  for (let i = start; i < codeItems.length; i += 1) {
    if (op(codeItems[i]) !== 'invokevirtual') continue;
    const ref = arg(codeItems[i]);
    if (Array.isArray(ref) && ref[1] === 'java/lang/StringBuilder' &&
        Array.isArray(ref[2]) && ref[2][0] === 'append' &&
        ref[2][1] === '(Ljava/lang/String;)Ljava/lang/StringBuilder;') {
      return i;
    }
  }
  fail('expected StringBuilder.append(String) was not found');
}

function originatesAtNameField(codeItems, analysis, defId, seen) {
  if (typeof defId !== 'number' || seen.has(defId)) return false;
  seen.add(defId);
  const def = analysis.defs.get(defId);
  if (!def) return false;
  const producerIndex = previousInstructionIndex(codeItems, def.index);
  if (producerIndex < 0) return false;
  const producer = codeItems[producerIndex];
  if (isNameFieldLoad(producer)) return true;
  const sourceLocal = aloadLocal(producer);
  if (sourceLocal == null) return false;
  const sourceDefs = analysis.before[producerIndex] && analysis.before[producerIndex].get(sourceLocal);
  return !!sourceDefs && [...sourceDefs]
    .some((sourceDef) => originatesAtNameField(codeItems, analysis, sourceDef, new Set(seen)));
}

function isNameFieldLoad(item) {
  if (op(item) !== 'getfield') return false;
  const ref = arg(item);
  return Array.isArray(ref) && ref[1] === 'hl' && Array.isArray(ref[2]) &&
    (ref[2][0] === 'p' || ref[2][0] === 'hl_p' || ref[2][0] === 'field_p') &&
    ref[2][1] === 'Ljava/lang/String;';
}

function previousInstructionIndex(codeItems, start) {
  for (let i = start - 1; i >= 0; i -= 1) {
    if (codeItems[i] && codeItems[i].instruction) return i;
  }
  return -1;
}

function aloadLocal(item) {
  const itemOp = op(item);
  if (itemOp === 'aload') return String(arg(item));
  const match = /^aload_([0-3])$/.exec(itemOp || '');
  return match ? match[1] : null;
}

function op(item) {
  const insn = item && item.instruction;
  return typeof insn === 'string' ? insn : insn && insn.op;
}

function arg(item) {
  const insn = item && item.instruction;
  return insn && typeof insn === 'object' ? insn.arg : null;
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}
