'use strict';

// Targeted cleanup for Dekobloko qk.run() exception ranges.
//
// CFR fails to structure qk.run when the broad obfuscation wrappers protect
// the loop, the cleanup try/catch island, and the reporting handler as one
// region. The hand reduction shows CFR accepts the same CFG when the wrappers
// are split around that cleanup island. This rewrites only the verified qk
// exception-table shape; it does not inspect CFR output.

function runQkExceptionSplit(astRoot, options = {}) {
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
      if (!codeAttr || !codeAttr.code || !Array.isArray(codeAttr.code.exceptionTable)) continue;
      fired += rewriteExceptionTable(codeAttr.code.exceptionTable, target.rewrite || []);
    }
  }
  return { changed: fired > 0, fired };
}

function rewriteExceptionTable(exceptionTable, rewrite) {
  let fired = 0;
  for (const spec of rewrite) {
    const idx = exceptionTable.findIndex((entry) => matches(entry, spec.from));
    if (idx < 0) continue;
    const original = exceptionTable[idx];
    const replacements = spec.to.map((labels) => {
      const entry = { ...original, ...labels };
      delete entry.start_pc;
      delete entry.end_pc;
      delete entry.handler_pc;
      return entry;
    });
    exceptionTable.splice(idx, 1, ...replacements);
    fired += 1;
  }
  return fired;
}

function matches(entry, labels) {
  return entry &&
    entry.startLbl === labels.startLbl &&
    entry.endLbl === labels.endLbl &&
    entry.handlerLbl === labels.handlerLbl &&
    (entry.catch_type === 'any' || entry.catchType === 'any');
}

module.exports = { runQkExceptionSplit };
