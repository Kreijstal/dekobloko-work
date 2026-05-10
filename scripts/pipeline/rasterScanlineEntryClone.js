'use strict';

const TARGETS = [];

function runRasterScanlineEntryClone(astRoot, options = {}) {
  let changed = 0;
  const targets = options.targets || TARGETS;
  if (targets.length === 0) return { changed: false, fired: 0 };
  for (const cls of astRoot.classes || []) {
    if (!cls) continue;
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      for (const target of targets) {
        if (cls.className !== target.className) continue;
        if (item.method.name !== target.methodName || item.method.descriptor !== target.descriptor) continue;
        const codeAttr = (item.method.attributes || []).find((attr) => attr.type === 'code');
        const codeItems = codeAttr && codeAttr.code && codeAttr.code.codeItems;
        if (!Array.isArray(codeItems)) continue;
        changed += cloneEntry(codeItems, target);
      }
    }
  }
  return { changed: changed > 0, changed };
}

function cloneEntry(codeItems, target) {
  const gotoIdx = findLabelIndex(codeItems, target.entryGoto);
  const startIdx = findLabelIndex(codeItems, target.rangeStart);
  const endIdx = findLabelIndex(codeItems, target.rangeEnd);
  if (gotoIdx < 0 || startIdx < 0 || endIdx < 0 || startIdx >= endIdx) return 0;
  const gotoInsn = codeItems[gotoIdx].instruction;
  if (!isInsn(gotoInsn, 'goto', target.entryTarget)) return 0;

  const range = codeItems.slice(startIdx, endIdx);
  const labelMap = new Map();
  let next = Number(target.prefix.slice(1));
  for (const item of range) {
    const label = trim(item && item.labelDef);
    if (label) labelMap.set(label, `L${next++}`);
  }

  const cloned = range.map((item) => cloneItem(item, labelMap));
  codeItems.splice(gotoIdx, 1, ...cloned);
  return 1;
}

function cloneItem(item, labelMap) {
  const out = {};
  const label = trim(item && item.labelDef);
  if (label) out.labelDef = `${labelMap.get(label)}:`;
  if (item && item.instruction) out.instruction = rewriteInstruction(item.instruction, labelMap);
  if (item && item.lineNumber) out.lineNumber = cloneValue(item.lineNumber);
  return out;
}

function rewriteInstruction(insn, labelMap) {
  const copy = cloneValue(insn);
  if (copy && typeof copy === 'object' && typeof copy.arg === 'string') {
    const arg = trim(copy.arg);
    if (labelMap.has(arg)) copy.arg = labelMap.get(arg);
  }
  return copy;
}

function cloneValue(value) {
  if (value == null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

function findLabelIndex(codeItems, label) {
  return codeItems.findIndex((item) => item && item.labelDef === `${label}:`);
}

function isInsn(insn, op, arg) {
  return insn && typeof insn === 'object' && insn.op === op && trim(insn.arg) === arg;
}

function trim(label) {
  return typeof label === 'string' ? label.replace(/:$/, '') : label;
}

module.exports = { runRasterScanlineEntryClone };
