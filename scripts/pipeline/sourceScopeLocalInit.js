'use strict';

function runSourceScopeLocalInit(astRoot, options = {}) {
  let changed = 0;
  const targets = options.targets || [];
  if (targets.length === 0) return { changed: false, changed: 0 };
  for (const cls of astRoot.classes || []) {
    if (!cls) continue;
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      for (const target of targets) {
        if (cls.className !== target.className) continue;
        if (item.method.name !== target.methodName || item.method.descriptor !== target.descriptor) continue;
        const codeAttr = (item.method.attributes || []).find((attr) => attr.type === 'code');
        const code = codeAttr && codeAttr.code;
        const codeItems = code && code.codeItems;
        if (!Array.isArray(codeItems)) continue;
        changed += insertInit(codeItems, code, target);
      }
    }
  }
  return { changed: changed > 0, changed };
}

function insertInit(codeItems, code, target) {
  const idx = findLabelIndex(codeItems, target.anchorLabel);
  if (idx < 0) return 0;
  const local = String(target.local);
  if (alreadyInitializedBefore(codeItems, idx, local)) return 0;
  const prefix = target.prefix || `L${target.anchorLabel.replace(/^L/, '')}S`;
  const kind = target.kind || 'reference';
  const init = kind === 'int'
    ? [{ labelDef: `${prefix}0:`, instruction: 'iconst_0' }]
    : [{ labelDef: `${prefix}0:`, instruction: 'aconst_null' }];
  init.push({ labelDef: `${prefix}1:`, instruction: { op: kind === 'int' ? 'istore' : 'astore', arg: local } });
  codeItems.splice(idx, 0, ...init);
  const needed = Number(local) + 1;
  if ((Number(code.localsSize) || 0) < needed) code.localsSize = needed;
  return 1;
}

function alreadyInitializedBefore(codeItems, idx, local) {
  for (let i = Math.max(0, idx - 2); i < idx; i += 1) {
    const insn = codeItems[i] && codeItems[i].instruction;
    if (!insn || typeof insn !== 'object') continue;
    if ((insn.op === 'astore' || insn.op === 'istore') && String(insn.arg) === local) return true;
  }
  return false;
}

function findLabelIndex(codeItems, label) {
  return codeItems.findIndex((item) => item && item.labelDef === `${label}:`);
}

module.exports = { runSourceScopeLocalInit };
