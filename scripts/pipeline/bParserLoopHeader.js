'use strict';

function runBParserLoopHeader(astRoot, options = {}) {
  let changed = 0;
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
      const codeAttr = (item.method.attributes || []).find((attr) => attr.type === 'code');
      const codeItems = codeAttr && codeAttr.code && codeAttr.code.codeItems;
      if (!Array.isArray(codeItems)) continue;
      changed += rewrite(codeItems, target);
    }
  }
  return { changed: changed > 0, changed };
}

function rewrite(codeItems, target) {
  const preLoadIdx = findLabelIndex(codeItems, target.preLoadLabel);
  const preGotoIdx = findLabelIndex(codeItems, target.preGotoLabel);
  const loopLoadIdx = findLabelIndex(codeItems, target.loopLoadLabel);
  const headerIdx = findLabelIndex(codeItems, target.headerLabel);
  const backIdx = findLabelIndex(codeItems, target.backGotoLabel);
  if ([preLoadIdx, preGotoIdx, loopLoadIdx, headerIdx, backIdx].some((idx) => idx < 0)) return 0;
  if (!isInsn(codeItems[preLoadIdx].instruction, 'iload', target.local)) return 0;
  if (!isInsn(codeItems[preGotoIdx].instruction, 'goto', target.headerLabel)) return 0;
  if (!isInsn(codeItems[loopLoadIdx].instruction, 'iload', target.local)) return 0;
  if (opOf(codeItems[headerIdx].instruction) !== 'iconst_m1') return 0;
  if (!isInsn(codeItems[backIdx].instruction, 'goto', target.loopLoadLabel)) return 0;

  codeItems[preLoadIdx].instruction = { op: 'goto', arg: target.headerLabel };
  delete codeItems[preGotoIdx].instruction;
  delete codeItems[preGotoIdx].pc;
  delete codeItems[loopLoadIdx].instruction;
  delete codeItems[loopLoadIdx].pc;
  codeItems[headerIdx].instruction = { op: 'iload', arg: target.local };
  codeItems.splice(headerIdx + 1, 0, { instruction: 'iconst_m1' });
  codeItems[backIdx + 1].instruction = { op: 'goto', arg: target.headerLabel };
  cleanupEmpty(codeItems);
  return 1;
}

function cleanupEmpty(codeItems) {
  for (let i = codeItems.length - 1; i >= 0; i -= 1) {
    const item = codeItems[i];
    if (item && !item.labelDef && !item.instruction && !item.stackMapFrame && !item.lineNumber) {
      codeItems.splice(i, 1);
    }
  }
}

function findLabelIndex(codeItems, label) {
  return codeItems.findIndex((item) => item && item.labelDef === `${label}:`);
}

function isInsn(insn, op, arg) {
  return insn && typeof insn === 'object' && insn.op === op && trim(insn.arg) === arg;
}

function opOf(insn) {
  return typeof insn === 'string' ? insn : insn && insn.op;
}

function trim(label) {
  return typeof label === 'string' ? label.replace(/:$/, '') : label;
}

module.exports = { runBParserLoopHeader };
