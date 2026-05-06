'use strict';

// Targeted cleanup for Dekobloko qc.b(IZ)Z.
//
// CFR leaves one structure marker in the cursor smoothing section. The
// do-loop at L3688 has a normal exit to L3746 and a found-item exit to L3760,
// where L3746 is just the same "mb += delta; goto L3760" tail. Cloning that
// tail for the normal exit gives CFR separate exits and removes the marker.

function runQcDoLoopTailClone(astRoot) {
  let fired = 0;
  for (const cls of astRoot.classes || []) {
    if (!cls || cls.className !== 'qc') continue;
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      if (item.method.name !== 'b' || item.method.descriptor !== '(IZ)Z') continue;
      const codeAttr = (item.method.attributes || []).find((attr) => attr && attr.type === 'code');
      if (!codeAttr || !codeAttr.code) continue;
      fired += transformMethod(codeAttr.code.codeItems || []);
    }
  }
  return { changed: fired > 0, fired };
}

function transformMethod(codeItems) {
  const branchIdx = findLabelIndex(codeItems, 'L3706');
  const tailIdx = findLabelIndex(codeItems, 'L3746');
  const joinIdx = findLabelIndex(codeItems, 'L3760');
  if (branchIdx < 0 || tailIdx < 0 || joinIdx < 0 || tailIdx >= joinIdx) return 0;

  const branch = codeItems[branchIdx] && codeItems[branchIdx].instruction;
  if (!branch || typeof branch !== 'object' || branch.op !== 'if_icmpeq' || trim(branch.arg) !== 'L3746') {
    return 0;
  }

  const tail = codeItems.slice(tailIdx, joinIdx);
  if (!matchesMbDeltaTail(tail)) return 0;

  codeItems[branchIdx].instruction = { ...branch, arg: 'L3746A' };
  const clone = [
    itemWith('L3746A', 'aload_0'),
    itemWith('L3746B', 'dup'),
    itemWith('L3746C', { op: 'getfield', arg: ['Field', 'qc', ['mb', 'I']] }),
    itemWith('L3746D', { op: 'iload', arg: '10' }),
    itemWith('L3746E', 'iadd'),
    itemWith('L3746F', { op: 'putfield', arg: ['Field', 'qc', ['mb', 'I']] }),
    itemWith('L3746G', { op: 'goto', arg: 'L3760' }),
  ];
  codeItems.splice(tailIdx, 0, ...clone);
  return 1;
}

function matchesMbDeltaTail(tail) {
  const ops = tail.map((item) => getOp(item && item.instruction));
  return ops.join(' ') === 'aload_0 dup getfield iload iadd putfield goto' &&
    hasField(tail[2], 'qc', 'mb', 'I') &&
    hasLocal(tail[3], '10') &&
    hasField(tail[5], 'qc', 'mb', 'I') &&
    trim(tail[6] && tail[6].instruction && tail[6].instruction.arg) === 'L3760';
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
