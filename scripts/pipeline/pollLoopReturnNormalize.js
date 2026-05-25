'use strict';

function runPollLoopReturnNormalize(astRoot) {
  let rewrites = 0;
  for (const cls of astRoot.classes || []) {
    if (!cls || !Array.isArray(cls.items)) continue;
    for (const item of cls.items) {
      if (!item || item.type !== 'method' || !item.method) continue;
      const codeAttr = (item.method.attributes || []).find((attr) => attr && attr.type === 'code');
      const codeItems = codeAttr && codeAttr.code && codeAttr.code.codeItems;
      if (!Array.isArray(codeItems) || codeItems.length < 12) continue;
      rewrites += splitNullableArrayLengthMinusOneGuards(codeItems);
      rewrites += normalizePollLoopReturns(codeItems);
      rewrites += inlineLocalPollLoopReturns(codeItems);
      rewrites += dropUnreachableDuplicateIntReturns(codeItems);
      rewrites += canonicalizeBooleanCleanupReturns(codeItems);
    }
  }
  return { changed: rewrites > 0, rewrites };
}

function splitNullableArrayLengthMinusOneGuards(items) {
  let rewrites = 0;
  const labels = buildLabelIndex(items);
  const usedLabels = collectUsedLabels(items);
  for (let i = 0; i <= items.length - 12; i += 1) {
    const match = matchNullableArrayLengthMinusOneGuard(items, i, labels, usedLabels);
    if (!match) continue;
    items.splice(match.nullGotoIndex, 1, ...match.nullGuardItems);
    const shift = match.nullGuardItems.length - 1;
    const originalGuardIndex = match.guardIndex + shift;
    items.splice(originalGuardIndex, 5,
      itemWithInstruction(items[originalGuardIndex], { op: 'goto', arg: match.arrayLengthTarget }));
    rewrites += 1;
    i += match.nullGuardItems.length;
  }
  return rewrites;
}

function matchNullableArrayLengthMinusOneGuard(items, i, labels, usedLabels) {
  if (op(items[i]) !== 'aconst_null') return null;
  if (nextInstructionIndex(items, i + 1) !== i + 1 || !sameThisArrayFieldLoad(items[i + 1], items[i + 2])) return null;
  const nullBranchOp = op(items[i + 3]);
  if (nullBranchOp !== 'if_acmpne' && nullBranchOp !== 'ifnonnull') return null;
  const arrayLoadLabel = trimLabel(items[i + 3].instruction.arg);
  const arrayLoadIndex = labels.get(arrayLoadLabel);
  if (arrayLoadIndex == null || arrayLoadIndex <= i + 3) return null;

  const nullGotoIndex = nextInstructionIndex(items, i + 4);
  if (nullGotoIndex < 0 || op(items[nullGotoIndex]) !== 'goto') return null;
  const guardLabel = trimLabel(items[nullGotoIndex].instruction.arg);
  const guardIndex = labels.get(guardLabel);
  if (guardIndex == null || guardIndex <= arrayLoadIndex) return null;
  if (guardIndex !== nextInstructionIndex(items, arrayLoadIndex + 4)) return null;

  if (!sameThisArrayFieldLoad(items[arrayLoadIndex], items[arrayLoadIndex + 1])) return null;
  if (op(items[arrayLoadIndex + 2]) !== 'arraylength') return null;
  const local = storeLocal(items[arrayLoadIndex + 3] && items[arrayLoadIndex + 3].instruction);
  if (local == null) return null;

  if (pushValue(items[guardIndex]) !== 0) return null;
  if (loadLocal(items[guardIndex + 1] && items[guardIndex + 1].instruction) !== local) return null;
  if (op(items[guardIndex + 2]) !== 'iconst_m1' || op(items[guardIndex + 3]) !== 'ixor') return null;
  if (op(items[guardIndex + 4]) !== 'if_icmpne') return null;
  if (!plainRemovedItems(items, guardIndex + 1, guardIndex + 3, usedLabels)) return null;
  if (!plainMovableItems(items, guardIndex + 1, guardIndex + 4, usedLabels)) return null;

  const arrayLengthTarget = trimLabel(items[guardIndex + 4].instruction.arg);
  if (!arrayLengthTarget) return null;
  if (rangeHasBranchTarget(items, labels, usedLabels, nullGotoIndex + 1, guardIndex + 5)) return null;

  return {
    nullGotoIndex,
    guardIndex,
    arrayLengthTarget,
    nullGuardItems: cloneWithoutLabels(items.slice(guardIndex, guardIndex + 5)),
  };
}

function inlineLocalPollLoopReturns(items) {
  let rewrites = 0;
  let labels = buildLabelIndex(items);
  const matches = [];
  for (let i = 0; i <= items.length - 4; i += 1) {
    const local = loadLocal(items[i] && items[i].instruction);
    if (local == null || pushValue(items[i + 1]) !== 0 || op(items[i + 2]) !== 'if_icmpne') continue;
    const backedgeIndex = nextInstructionIndex(items, i + 3);
    if (backedgeIndex < 0 || op(items[backedgeIndex]) !== 'goto') continue;
    const returnLabel = trimLabel(items[i + 2].instruction.arg);
    const returnIndex = labels.get(returnLabel);
    if (returnIndex == null || returnIndex <= i || !isLoadReturn(items, returnIndex, local)) continue;
    const loopLabel = trimLabel(items[backedgeIndex].instruction.arg);
    const loopIndex = labels.get(loopLabel);
    if (loopIndex == null || loopIndex >= i) continue;
    if (!looksLikePollingLoopHeader(items, loopIndex, i, local)) continue;
    matches.push({ compareIndex: i + 2, backedgeIndex, local, loopLabel });
  }
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const match = matches[i];
    items.splice(match.compareIndex, match.backedgeIndex - match.compareIndex + 1,
      itemWithInstruction(items[match.compareIndex], { op: 'if_icmpeq', arg: match.loopLabel }),
      itemWithInstruction(items[match.backedgeIndex], loadInstruction(match.local)),
      itemWithInstruction(null, 'ireturn'));
    rewrites += 1;
  }
  return rewrites;
}

function dropUnreachableDuplicateIntReturns(items) {
  let rewrites = 0;
  let changed = true;
  while (changed) {
    changed = false;
    const usedLabels = collectUsedLabels(items);
    for (let i = 0; i <= items.length - 3; i += 1) {
      if (op(items[i]) !== 'ireturn') continue;
      const duplicateLabel = trimLabel(items[i + 1] && items[i + 1].labelDef);
      if (duplicateLabel && usedLabels.has(duplicateLabel)) continue;
      if (loadLocal(items[i + 1] && items[i + 1].instruction) == null || op(items[i + 2]) !== 'ireturn') continue;
      if (!plainRemovedItems(items, i + 1, i + 2, usedLabels)) continue;
      items.splice(i + 1, 2);
      rewrites += 1;
      changed = true;
      break;
    }
  }
  return rewrites;
}

function canonicalizeBooleanCleanupReturns(items) {
  let rewrites = 0;
  for (let i = 0; i <= items.length - 10; i += 1) {
    if (loadLocal(items[i] && items[i].instruction) == null) continue;
    if (op(items[i + 1]) !== 'ifne' || op(items[i + 2]) !== 'goto') continue;
    const cleanupLabel = trimLabel(items[i + 1].instruction.arg);
    const zeroLabel = trimLabel(items[i + 2].instruction.arg);
    if (!cleanupLabel || !zeroLabel) continue;
    if (trimLabel(items[i + 3] && items[i + 3].labelDef) !== cleanupLabel) continue;
    if (op(items[i + 3]) !== 'aload_0' || op(items[i + 4]) !== 'bipush' || pushValue(items[i + 4]) !== -36) continue;
    if (op(items[i + 5]) !== 'invokespecial' || !isByteVoidMethod(items[i + 5] && items[i + 5].instruction)) continue;
    if (pushValue(items[i + 6]) !== 3 || op(items[i + 7]) !== 'ireturn') continue;
    if (trimLabel(items[i + 8] && items[i + 8].labelDef) !== zeroLabel) continue;
    if (pushValue(items[i + 8]) !== 0 || op(items[i + 9]) !== 'ireturn') continue;
    items.splice(i + 1, 2, itemWithInstruction(items[i + 1], { op: 'ifeq', arg: zeroLabel }));
    rewrites += 1;
  }
  return rewrites;
}

function normalizePollLoopReturns(items) {
  const labels = buildLabelIndex(items);
  const usedLabels = collectUsedLabels(items);
  const matches = [];
  for (let i = 0; i <= items.length - 6; i += 1) {
    const compare = matchPollingResultNotCompare(items, i, labels, usedLabels);
    if (compare) {
      matches.push(compare);
      continue;
    }
    const match = matchObfuscatedZeroReturnLoop(items, i, labels, usedLabels);
    if (!match) continue;
    matches.push(match);
  }
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const match = matches[i];
    items.splice(match.index, 5,
      itemWithInstruction(items[match.index], loadInstruction(match.local)),
      itemWithInstruction(items[match.index + 2], 'iconst_0'),
      itemWithInstruction(items[match.index + 4], { op: match.branchOp, arg: match.returnLabel }));
  }
  return matches.length;
}

function matchPollingResultNotCompare(items, i, labels, usedLabels) {
  if (op(items[i]) !== 'iconst_m1') return null;
  const local = loadLocal(items[i + 1] && items[i + 1].instruction);
  if (local == null || op(items[i + 2]) !== 'iconst_m1' || op(items[i + 3]) !== 'ixor') return null;
  const branchOp = op(items[i + 4]);
  if (branchOp !== 'if_icmpne' && branchOp !== 'if_icmpeq') return null;
  if (!plainRemovedItems(items, i, i + 3, usedLabels)) return null;
  const returnLabel = trimLabel(items[i + 4].instruction.arg);
  const returnIndex = labels.get(returnLabel);
  if (returnIndex == null || !isLoadReturn(items, returnIndex, local)) return null;
  if (!hasPollingResultProducer(items, Math.max(0, i - 12), i, local)) return null;
  return { index: i, local, branchOp, returnLabel };
}

function hasPollingResultProducer(items, start, end, local) {
  let hasBooleanPoll = false;
  let hasResultCall = false;
  for (let i = start; i < end; i += 1) {
    const insn = items[i] && items[i].instruction;
    const cur = op(items[i]);
    const ref = methodRef(insn);
    if (cur === 'invokestatic' && ref && ref.desc && ref.desc.endsWith(')Z')) {
      hasBooleanPoll = true;
      continue;
    }
    if ((cur === 'invokevirtual' || cur === 'invokespecial' || cur === 'invokeinterface') &&
        ref && ref.desc && ref.desc.endsWith(')I')) {
      hasResultCall = true;
      continue;
    }
    if (storeLocal(insn) === local && hasBooleanPoll && hasResultCall) return true;
  }
  return false;
}

function matchObfuscatedZeroReturnLoop(items, i, labels, usedLabels) {
  if (op(items[i]) !== 'iconst_m1') return null;
  const local = loadLocal(items[i + 1] && items[i + 1].instruction);
  if (local == null || op(items[i + 2]) !== 'iconst_m1' || op(items[i + 3]) !== 'ixor') return null;
  if (op(items[i + 4]) !== 'if_icmpne') return null;
  if (!plainRemovedItems(items, i, i + 3, usedLabels)) return null;
  const returnLabel = trimLabel(items[i + 4].instruction.arg);
  const returnIndex = labels.get(returnLabel);
  if (returnIndex == null || !isLoadReturn(items, returnIndex, local)) return null;
  const backedge = nextInstructionIndex(items, i + 5);
  if (backedge < 0 || op(items[backedge]) !== 'goto') return null;
  const loopLabel = trimLabel(items[backedge].instruction.arg);
  const loopIndex = labels.get(loopLabel);
  if (loopIndex == null || loopIndex >= i) return null;
  if (!looksLikePollingLoopHeader(items, loopIndex, i, local)) return null;
  return { index: i, local, branchOp: 'if_icmpne', returnLabel };
}

function looksLikePollingLoopHeader(items, loopIndex, compareIndex, local) {
  const firstBranch = findFirstBranchAfter(items, loopIndex, Math.min(compareIndex, loopIndex + 8));
  if (firstBranch < 0) return false;
  const firstBranchOp = op(items[firstBranch]);
  if (firstBranchOp !== 'ifeq' && firstBranchOp !== 'ifne') return false;
  let hasBooleanPoll = false;
  let hasResultCall = false;
  let storedResult = false;
  for (let i = loopIndex; i < compareIndex; i += 1) {
    const insn = items[i] && items[i].instruction;
    const cur = op(items[i]);
    const ref = methodRef(insn);
    if (cur === 'invokestatic' && ref && ref.desc && ref.desc.endsWith(')Z')) {
      hasBooleanPoll = true;
      continue;
    }
    if ((cur === 'invokevirtual' || cur === 'invokespecial' || cur === 'invokeinterface') &&
        ref && ref.desc && ref.desc.endsWith(')I')) {
      hasResultCall = true;
      continue;
    }
    if (storeLocal(insn) === local && hasResultCall) {
      storedResult = true;
    }
  }
  return hasBooleanPoll && hasResultCall && storedResult;
}

function findFirstBranchAfter(items, start, end) {
  for (let i = start; i < end; i += 1) {
    if (isBranch(op(items[i]))) return i;
  }
  return -1;
}

function isLoadReturn(items, index, local) {
  const first = nextInstructionIndex(items, index);
  if (first < 0 || loadLocal(items[first] && items[first].instruction) !== local) return false;
  const second = nextInstructionIndex(items, first + 1);
  return second >= 0 && op(items[second]) === 'ireturn';
}

function plainRemovedItems(items, start, end, usedLabels) {
  for (let i = start; i <= end; i += 1) {
    const item = items[i];
    if (!item) return false;
    if (item.labelDef && usedLabels.has(trimLabel(item.labelDef))) return false;
    if (item.stackMapFrame || item.lineNumber) return false;
  }
  return true;
}

function plainMovableItems(items, start, end, usedLabels) {
  for (let i = start; i <= end; i += 1) {
    const item = items[i];
    if (!item) return false;
    if (item.labelDef && usedLabels.has(trimLabel(item.labelDef))) return false;
    if (item.stackMapFrame || item.lineNumber) return false;
  }
  return true;
}

function rangeHasBranchTarget(items, labels, usedLabels, start, end) {
  for (let i = start; i < end; i += 1) {
    const label = trimLabel(items[i] && items[i].labelDef);
    if (!label || !usedLabels.has(label)) continue;
    const targetIndex = labels.get(label);
    if (targetIndex == null || targetIndex < start || targetIndex >= end) return true;
  }
  return false;
}

function buildLabelIndex(items) {
  const out = new Map();
  for (let i = 0; i < items.length; i += 1) {
    const label = trimLabel(items[i] && items[i].labelDef);
    if (label) out.set(label, i);
  }
  return out;
}

function collectUsedLabels(items) {
  const out = new Set();
  for (const item of items) {
    for (const label of branchLabels(item && item.instruction)) out.add(label);
  }
  return out;
}

function branchLabels(insn) {
  if (!insn || typeof insn !== 'object') return [];
  if (insn.arg && typeof insn.arg === 'string' && isBranch(insn.op)) return [trimLabel(insn.arg)];
  if ((insn.op === 'tableswitch' || insn.op === 'lookupswitch') && Array.isArray(insn.arg)) {
    return insn.arg.map(trimLabel).filter(Boolean);
  }
  return [];
}

function nextInstructionIndex(items, start) {
  for (let i = start; i < items.length; i += 1) {
    if (items[i] && items[i].instruction) return i;
  }
  return -1;
}

function itemWithInstruction(item, instruction) {
  const out = {};
  if (item && item.labelDef) out.labelDef = item.labelDef;
  out.instruction = instruction;
  return out;
}

function cloneWithoutLabels(items) {
  return items.map((item) => itemWithInstruction(null, cloneInstruction(item && item.instruction)));
}

function cloneInstruction(instruction) {
  if (!instruction || typeof instruction === 'string') return instruction;
  return { ...instruction };
}

function sameThisArrayFieldLoad(first, second) {
  if (op(first) !== 'aload_0' || op(second) !== 'getfield') return false;
  const field = second && second.instruction && second.instruction.arg;
  return Array.isArray(field) && field[0] === 'Field' && Array.isArray(field[2]) &&
    typeof field[2][1] === 'string' && field[2][1].startsWith('[');
}

function methodRef(insn) {
  if (!insn || !Array.isArray(insn.arg)) return null;
  const ref = insn.arg;
  if (ref[0] !== 'Method' && ref[0] !== 'InterfaceMethod') return null;
  const sig = Array.isArray(ref[2]) ? ref[2] : [];
  return { owner: ref[1], name: sig[0], desc: sig[1] };
}

function isByteVoidMethod(insn) {
  const ref = methodRef(insn);
  return !!(ref && ref.desc === '(B)V');
}

function loadInstruction(local) {
  if (local === 0) return 'iload_0';
  if (local === 1) return 'iload_1';
  if (local === 2) return 'iload_2';
  if (local === 3) return 'iload_3';
  return { op: 'iload', arg: String(local) };
}

function loadLocal(insn) {
  const cur = op({ instruction: insn });
  if (cur === 'iload_0') return 0;
  if (cur === 'iload_1') return 1;
  if (cur === 'iload_2') return 2;
  if (cur === 'iload_3') return 3;
  if (cur === 'iload') return Number(insn.arg);
  return null;
}

function pushValue(item) {
  const cur = op(item);
  if (cur === 'iconst_m1') return -1;
  if (/^iconst_[0-5]$/.test(cur || '')) return Number(cur.slice(-1));
  if (cur === 'bipush' || cur === 'sipush') return Number(item.instruction.arg);
  if (cur === 'ldc') {
    const value = item.instruction.arg;
    return Number.isInteger(value) ? value : null;
  }
  return null;
}

function storeLocal(insn) {
  const cur = op({ instruction: insn });
  if (cur === 'istore_0') return 0;
  if (cur === 'istore_1') return 1;
  if (cur === 'istore_2') return 2;
  if (cur === 'istore_3') return 3;
  if (cur === 'istore') return Number(insn.arg);
  return null;
}

function isBranch(cur) {
  return cur === 'goto' || /^if/.test(cur || '');
}

function op(item) {
  const insn = item && item.instruction;
  if (!insn) return '';
  if (typeof insn === 'string') return insn;
  return insn.op || insn.opcode || '';
}

function trimLabel(label) {
  return typeof label === 'string' ? label.replace(/:$/, '') : '';
}

module.exports = { runPollLoopReturnNormalize };
