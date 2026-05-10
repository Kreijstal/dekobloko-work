'use strict';

function runStackReceiverTailClone(astRoot, options = {}) {
  let fired = 0;
  const targets = options.targets || [];
  if (targets.length === 0) return { changed: false, fired: 0 };
  for (const cls of astRoot.classes || []) {
    if (!cls) continue;
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      for (const target of targets) {
        if (cls.className !== target.className) continue;
        if (item.method.name !== target.methodName || item.method.descriptor !== target.descriptor) continue;
        const codeAttr = (item.method.attributes || []).find((attr) => attr && attr.type === 'code');
        const code = codeAttr && codeAttr.code;
        const codeItems = code && code.codeItems;
        if (!Array.isArray(codeItems)) continue;
        fired += transformMethod(code, target);
      }
    }
  }
  return { changed: fired > 0, fired };
}

function transformMethod(code, target) {
  const codeItems = code.codeItems || [];
  const branchIdx = findLabelIndex(codeItems, target.branchLabel);
  const tailIdx = findLabelIndex(codeItems, target.tailStart);
  const insertIdx = findLabelIndex(codeItems, target.insertBefore);
  if (branchIdx < 0 || tailIdx < 0 || insertIdx < 0) return 0;

  const branch = codeItems[branchIdx] && codeItems[branchIdx].instruction;
  if (!branch || typeof branch !== 'object') return 0;
  if (branch.op !== target.branchOp || trim(branch.arg) !== target.tailStart) return 0;

  const tailPush = codeItems[tailIdx] && codeItems[tailIdx].instruction;
  const tailCall = codeItems[tailIdx + 1] && codeItems[tailIdx + 1].instruction;
  if (getOp(tailPush) !== 'iconst_1') return 0;
  if (!matchesInvoke(tailCall, target.invoke)) return 0;

  const prefix = target.clonePrefix || `${target.tailStart}_clone`;
  branch.arg = `${prefix}0`;
  codeItems.splice(insertIdx, 0,
    itemWith(`${prefix}0`, 'iconst_1'),
    itemWith(`${prefix}1`, cloneInstruction(tailCall)),
    itemWith(`${prefix}2`, 'return'),
    { labelDef: `${prefix}3:` });
  if (target.handlerLabel) {
    code.exceptionTable = code.exceptionTable || [];
    code.exceptionTable.push({
      start_pc: null,
      end_pc: null,
      handler_pc: null,
      catch_type: 'any',
      startLbl: `${prefix}0`,
      endLbl: `${prefix}3`,
      handlerLbl: target.handlerLabel,
    });
  }
  return 1;
}

function matchesInvoke(insn, expected) {
  if (!insn || typeof insn !== 'object' || insn.op !== 'invokevirtual') return false;
  const arg = insn.arg;
  return Array.isArray(arg) &&
    arg[0] === 'Method' &&
    arg[1] === expected.owner &&
    Array.isArray(arg[2]) &&
    arg[2][0] === expected.name &&
    arg[2][1] === expected.descriptor;
}

function cloneInstruction(insn) {
  return typeof insn === 'object' && insn ? { ...insn } : insn;
}

function itemWith(label, instruction) {
  return { labelDef: `${label}:`, instruction };
}

function findLabelIndex(codeItems, label) {
  return codeItems.findIndex((item) => trim(item && item.labelDef) === label);
}

function trim(label) {
  return typeof label === 'string' ? label.replace(/:$/, '') : label;
}

function getOp(insn) {
  return typeof insn === 'string' ? insn : insn && insn.op;
}

module.exports = { runStackReceiverTailClone };
