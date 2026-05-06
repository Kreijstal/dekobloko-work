'use strict';

// Targeted cleanup for Dekobloko ei.b([III)V.
//
// CFR throws ConfusedCFRException on the original class when the two sibling
// D>0/!B loops share the final boundary tail through gotos L797->L933 and
// L902->L933. The bytecode-reduction fix is to duplicate that tail at both
// exits. This keeps the same behavior but gives CFR separate loop exits.

function runEiTailClone(astRoot) {
  let fired = 0;
  for (const cls of astRoot.classes || []) {
    if (!cls || cls.className !== 'ei') continue;
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      if (item.method.name !== 'b' || item.method.descriptor !== '([III)V') continue;
      const codeAttr = (item.method.attributes || []).find((attr) => attr && attr.type === 'code');
      if (!codeAttr || !codeAttr.code) continue;
      fired += transformMethod(codeAttr.code.codeItems || []);
    }
  }
  return { changed: fired > 0, fired };
}

function transformMethod(codeItems) {
  const tail = extractTail(codeItems, 'L933', 'L1013');
  if (!tail) return 0;

  let fired = 0;
  fired += replaceGotoWithTail(codeItems, 'L797', 'L933', tail, 'L800X');
  fired += replaceGotoWithTail(codeItems, 'L902', 'L933', tail, 'L900X');
  return fired === 2 ? fired : 0;
}

function extractTail(codeItems, startLabel, endLabel) {
  const start = findLabelIndex(codeItems, startLabel);
  const end = findLabelIndex(codeItems, endLabel);
  if (start < 0 || end < start) return null;
  const tail = codeItems.slice(start, end + 1);
  if (getOp(tail[tail.length - 1] && tail[tail.length - 1].instruction) !== 'return') return null;
  return tail;
}

function replaceGotoWithTail(codeItems, label, target, tail, prefix) {
  const idx = findLabelIndex(codeItems, label);
  if (idx < 0) return 0;
  const insn = codeItems[idx] && codeItems[idx].instruction;
  if (!insn || typeof insn !== 'object' || insn.op !== 'goto' || trim(insn.arg) !== target) return 0;

  const cloned = cloneTail(tail, prefix, label);
  codeItems.splice(idx, 1, ...cloned);
  return 1;
}

function cloneTail(tail, prefix, firstLabel) {
  const labels = new Set();
  for (const item of tail) {
    const label = trim(item && item.labelDef);
    if (label) labels.add(label);
  }

  const map = new Map();
  for (const label of labels) map.set(label, `${prefix}_${label.slice(1)}`);
  map.set(trim(tail[0] && tail[0].labelDef), firstLabel);

  return tail.map((item) => cloneItem(item, map));
}

function cloneItem(item, labelMap) {
  const clone = { ...item };
  delete clone.pc;

  const label = trim(item && item.labelDef);
  if (label && labelMap.has(label)) clone.labelDef = `${labelMap.get(label)}:`;

  if (item && item.instruction && typeof item.instruction === 'object') {
    clone.instruction = { ...item.instruction };
    if (typeof clone.instruction.arg === 'string') {
      const target = trim(clone.instruction.arg);
      if (labelMap.has(target)) clone.instruction.arg = labelMap.get(target);
    }
  }
  return clone;
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

module.exports = { runEiTailClone };
