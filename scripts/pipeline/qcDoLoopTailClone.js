'use strict';

// Targeted cleanup for Dekobloko qc.b(IZ)Z.
//
// CFR leaves one structure marker in the cursor smoothing section. The
// do-loop at L3688 has a normal exit to L3746 and a found-item exit to L3760,
// where L3746 is just the same "mb += delta; goto L3760" tail. Cloning that
// tail for the normal exit gives CFR separate exits and removes the marker.

function runQcDoLoopTailClone(astRoot, options = {}) {
  let fired = 0;
  const targets = options.targets || [];
  if (targets.length === 0) return { changed: false, fired: 0 };
  for (const cls of astRoot.classes || []) {
    if (!cls) continue;
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      const target = targets.find((spec) =>
        cls.className === spec.className &&
        item.method.name === spec.methodName &&
        item.method.descriptor === spec.descriptor);
      if (!target) continue;
      const codeAttr = (item.method.attributes || []).find((attr) => attr && attr.type === 'code');
      if (!codeAttr || !codeAttr.code) continue;
      fired += transformMethod(codeAttr.code.codeItems || [], target);
    }
  }
  return { changed: fired > 0, fired };
}

function transformMethod(codeItems, target) {
  const branchIdx = findLabelIndex(codeItems, target.branchLabel);
  const tailIdx = findLabelIndex(codeItems, target.tailStart);
  const joinIdx = findLabelIndex(codeItems, target.joinLabel);
  if (branchIdx < 0 || tailIdx < 0 || joinIdx < 0 || tailIdx >= joinIdx) return 0;

  const branch = codeItems[branchIdx] && codeItems[branchIdx].instruction;
  if (!branch || typeof branch !== 'object' || branch.op !== 'if_icmpeq' || trim(branch.arg) !== target.tailStart) {
    return 0;
  }

  const tail = codeItems.slice(tailIdx, joinIdx);
  if (!matchesMbDeltaTail(tail, target)) return 0;

  const prefix = target.clonePrefix || target.tailStart;
  const field = target.field;
  codeItems[branchIdx].instruction = { ...branch, arg: `${prefix}A` };
  const clone = [
    itemWith(`${prefix}A`, 'aload_0'),
    itemWith(`${prefix}B`, 'dup'),
    itemWith(`${prefix}C`, { op: 'getfield', arg: ['Field', field.owner, [field.name, field.descriptor]] }),
    itemWith(`${prefix}D`, { op: 'iload', arg: target.local }),
    itemWith(`${prefix}E`, 'iadd'),
    itemWith(`${prefix}F`, { op: 'putfield', arg: ['Field', field.owner, [field.name, field.descriptor]] }),
    itemWith(`${prefix}G`, { op: 'goto', arg: target.joinLabel }),
  ];
  codeItems.splice(tailIdx, 0, ...clone);
  return 1;
}

function matchesMbDeltaTail(tail, target) {
  const field = target.field;
  const ops = tail.map((item) => getOp(item && item.instruction));
  return ops.join(' ') === 'aload_0 dup getfield iload iadd putfield goto' &&
    hasField(tail[2], field.owner, field.name, field.descriptor) &&
    hasLocal(tail[3], target.local) &&
    hasField(tail[5], field.owner, field.name, field.descriptor) &&
    trim(tail[6] && tail[6].instruction && tail[6].instruction.arg) === target.joinLabel;
}

function hasField(item, owner, name, desc) {
  const arg = item && item.instruction && item.instruction.arg;
  return Array.isArray(arg) &&
    ((arg[0] === owner && arg[1] === name && arg[2] === desc) ||
     (arg[0] === 'Field' && arg[1] === owner && Array.isArray(arg[2]) && arg[2][0] === name && arg[2][1] === desc));
}

function hasLocal(item, local) {
  const arg = item && item.instruction && item.instruction.arg;
  return String(arg) === local;
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

module.exports = { runQcDoLoopTailClone };
