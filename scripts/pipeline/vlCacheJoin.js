'use strict';

function runVlCacheJoin(astRoot, options = {}) {
  let changed = 0;
  const targets = options.targets || [];
  for (const cls of astRoot.classes || []) {
    if (!cls) continue;
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      const codeAttr = (item.method.attributes || []).find((attr) => attr.type === 'code');
      const codeItems = codeAttr && codeAttr.code && codeAttr.code.codeItems;
      if (!Array.isArray(codeItems)) continue;
      const explicit = targets.filter((spec) =>
        cls.className === spec.className &&
        item.method.name === spec.methodName &&
        item.method.descriptor === spec.descriptor);
      for (const target of explicit) {
        changed += rewrite(codeItems, target);
      }
      if (explicit.length === 0 && options.infer !== false) {
        changed += rewriteInferred(codeItems, options);
      }
    }
  }
  return { changed: changed > 0, changed };
}

function rewrite(codeItems, target) {
  const condIdx = findLabelIndex(codeItems, target.conditionLabel);
  const firstGotoIdx = findLabelIndex(codeItems, target.firstGotoLabel);
  const secondGotoIdx = findLabelIndex(codeItems, target.secondGotoLabel);
  if (condIdx < 0 || firstGotoIdx < 0 || secondGotoIdx < 0) return 0;

  const cond = codeItems[condIdx].instruction;
  const firstGoto = codeItems[firstGotoIdx].instruction;
  const secondGoto = codeItems[secondGotoIdx].instruction;
  if (!isInsn(cond, target.condition.op, target.condition.arg)) return 0;
  if (!isInsn(firstGoto, 'goto', target.joinLabel)) return 0;
  if (!isInsn(secondGoto, 'goto', target.joinLabel)) return 0;

  const useStart = findLabelIndex(codeItems, target.joinLabel);
  const useEnd = findLabelIndex(codeItems, target.endLabel);
  if (useStart < 0 || useEnd < 0 || useStart >= useEnd) return 0;
  const cachedUse = codeItems.slice(useStart, useEnd).map((item) => ({
    instruction: clone(item.instruction),
  }));
  cachedUse.push({ instruction: { op: 'goto', arg: target.endLabel } });

  codeItems.splice(firstGotoIdx, 1, ...cachedUse);
  const adjustedSecondGotoIdx = findLabelIndex(codeItems, target.secondGotoLabel);
  if (adjustedSecondGotoIdx < 0 || !isInsn(codeItems[adjustedSecondGotoIdx].instruction, 'goto', target.joinLabel)) {
    throw new Error('vl-cache-join: lost second goto');
  }
  codeItems.splice(adjustedSecondGotoIdx, 1);
  return 1;
}

function rewriteInferred(codeItems, options) {
  let changed = 0;
  const maxUseInsns = options.maxUseInsns || 45;
  while (true) {
    const target = inferOne(codeItems, maxUseInsns);
    if (!target) break;
    changed += rewrite(codeItems, target);
  }
  return changed;
}

function inferOne(codeItems, maxUseInsns) {
  for (let firstGotoIdx = 0; firstGotoIdx < codeItems.length; firstGotoIdx += 1) {
    const firstGoto = codeItems[firstGotoIdx] && codeItems[firstGotoIdx].instruction;
    if (!isGoto(firstGoto)) continue;

    const joinLabel = trim(firstGoto.arg);
    const joinIdx = findLabelIndex(codeItems, joinLabel);
    if (joinIdx <= firstGotoIdx) continue;

    const cond = previousReal(codeItems, firstGotoIdx);
    if (!cond || !isConditional(cond.item.instruction)) continue;
    const condTarget = trim(cond.item.instruction.arg);
    const condTargetIdx = findLabelIndex(codeItems, condTarget);
    if (condTargetIdx <= firstGotoIdx || condTargetIdx >= joinIdx) continue;

    const secondGotoIdx = findLastGotoTo(codeItems, condTargetIdx, joinIdx, joinLabel);
    if (secondGotoIdx <= firstGotoIdx) continue;
    const afterSecond = nextReal(codeItems, secondGotoIdx);
    if (!afterSecond || afterSecond.idx !== joinIdx) continue;

    const end = inferUseEnd(codeItems, joinIdx, maxUseInsns);
    if (!end) continue;

    const firstUse = nextReal(codeItems, joinIdx - 1);
    const useLocal = loadLocal(firstUse && firstUse.item.instruction);
    if (!useLocal) continue;
    if (!hasStoreLocal(codeItems, condTargetIdx, secondGotoIdx, useLocal)) continue;

    return {
      conditionLabel: trim(codeItems[cond.idx].labelDef),
      condition: {
        op: cond.item.instruction.op,
        arg: condTarget,
      },
      firstGotoLabel: trim(codeItems[firstGotoIdx].labelDef),
      secondGotoLabel: trim(codeItems[secondGotoIdx].labelDef),
      joinLabel,
      endLabel: end,
    };
  }
  return null;
}

function inferUseEnd(codeItems, joinIdx, maxUseInsns) {
  const limit = Math.min(codeItems.length, joinIdx + maxUseInsns);
  for (let i = joinIdx + 1; i < limit; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (!isGoto(insn)) continue;
    const target = trim(insn.arg);
    const targetIdx = findLabelIndex(codeItems, target);
    if (targetIdx <= i || targetIdx > limit) continue;
    return target;
  }
  return null;
}

function findLastGotoTo(codeItems, startIdx, endIdx, label) {
  for (let i = endIdx - 1; i >= startIdx; i -= 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (isGoto(insn) && trim(insn.arg) === label) return i;
  }
  return -1;
}

function previousReal(codeItems, idx) {
  for (let i = idx - 1; i >= 0; i -= 1) {
    const item = codeItems[i];
    if (item && item.instruction) return { idx: i, item };
  }
  return null;
}

function nextReal(codeItems, idx) {
  for (let i = idx + 1; i < codeItems.length; i += 1) {
    const item = codeItems[i];
    if (item && item.instruction) return { idx: i, item };
  }
  return null;
}

function hasStoreLocal(codeItems, startIdx, endIdx, local) {
  for (let i = startIdx; i < endIdx; i += 1) {
    if (storeLocal(codeItems[i] && codeItems[i].instruction) === local) return true;
  }
  return false;
}

function loadLocal(insn) {
  const op = opOf(insn);
  if (op === 'aload_0') return '0';
  if (op === 'aload_1') return '1';
  if (op === 'aload_2') return '2';
  if (op === 'aload_3') return '3';
  if (op === 'aload' && insn.arg != null) return String(insn.arg);
  return null;
}

function storeLocal(insn) {
  const op = opOf(insn);
  if (op === 'astore_0') return '0';
  if (op === 'astore_1') return '1';
  if (op === 'astore_2') return '2';
  if (op === 'astore_3') return '3';
  if (op === 'astore' && insn.arg != null) return String(insn.arg);
  return null;
}

function isGoto(insn) {
  return isInsn(insn, 'goto');
}

function isConditional(insn) {
  const op = opOf(insn);
  return typeof op === 'string' && (
    op.startsWith('if') ||
    op === 'ifnull' ||
    op === 'ifnonnull'
  );
}

function opOf(insn) {
  return typeof insn === 'string' ? insn : insn && insn.op;
}

function clone(value) {
  if (value == null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

function findLabelIndex(codeItems, label) {
  return codeItems.findIndex((item) => item && item.labelDef === `${label}:`);
}

function isInsn(insn, op, arg) {
  if (!insn) return false;
  if (typeof insn === 'string') return insn === op && arg === undefined;
  return typeof insn === 'object' && insn.op === op && (arg === undefined || trim(insn.arg) === arg);
}

function trim(label) {
  return typeof label === 'string' ? label.replace(/:$/, '') : label;
}

module.exports = { runVlCacheJoin };
