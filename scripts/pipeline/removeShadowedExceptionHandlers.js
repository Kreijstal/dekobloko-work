'use strict';

const DEFAULT_TARGETS = new Set([
  'el.a(IBILjava/awt/Component;)Leh;',
  'kc.a(ZIIZZZ)Lji;',
]);

const DEFAULT_DROP_HANDLERS = new Map([
  ['pn.b(Z)I', new Set(['L23'])],
  ['pn.k(I)Z', new Set(['L100'])],
  ['t.k(I)Lhm;', new Set(['L26'])],
]);

const DEFAULT_DROP_RANGES = new Map([
]);

function handlerTypeKey(entry) {
  return entry.catch_type || entry.catchType || entry.type || 'any';
}

function rangeKey(entry) {
  const start = entry.startLbl || entry.startLabel || entry.start || entry.from || entry.start_pc;
  const end = entry.endLbl || entry.endLabel || entry.end || entry.to || entry.end_pc;
  return `${start}->${end}:${handlerTypeKey(entry)}`;
}

function runRemoveShadowedExceptionHandlers(ast, options = {}) {
  const targets = options.targets || DEFAULT_TARGETS;
  const dropHandlers = options.dropHandlers || DEFAULT_DROP_HANDLERS;
  const dropRanges = options.dropRanges || DEFAULT_DROP_RANGES;
  let removed = 0;
  for (const cls of ast.classes || []) {
    for (const item of cls.items || []) {
      if (!item || item.type !== 'method' || !item.method) continue;
      const methodKey = `${cls.className}.${item.method.name}${item.method.descriptor}`;
      for (const attr of item.method.attributes || []) {
        if (!attr || attr.type !== 'code' || !attr.code || !Array.isArray(attr.code.exceptionTable)) continue;
        const handlersToDrop = dropHandlers.get(methodKey);
        if (handlersToDrop) {
          const before = attr.code.exceptionTable.length;
          attr.code.exceptionTable = attr.code.exceptionTable.filter((entry) => !handlersToDrop.has(entry.handlerLbl || entry.handlerLabel || entry.handler));
          removed += before - attr.code.exceptionTable.length;
        }
        const rangesToDrop = dropRanges.get(methodKey);
        if (rangesToDrop) {
          const before = attr.code.exceptionTable.length;
          attr.code.exceptionTable = attr.code.exceptionTable.filter((entry) => {
            const start = entry.startLbl || entry.startLabel || entry.start || entry.from || entry.start_pc;
            const end = entry.endLbl || entry.endLabel || entry.end || entry.to || entry.end_pc;
            const handler = entry.handlerLbl || entry.handlerLabel || entry.handler;
            return !rangesToDrop.has(`${start}->${end}:${handler}`);
          });
          removed += before - attr.code.exceptionTable.length;
        }
        if (!targets.has(methodKey)) continue;
        const seen = new Set();
        const kept = [];
        for (const entry of attr.code.exceptionTable) {
          const key = rangeKey(entry);
          if (seen.has(key)) {
            removed += 1;
            continue;
          }
          seen.add(key);
          kept.push(entry);
        }
        attr.code.exceptionTable = kept;
      }
    }
  }
  return removed;
}

module.exports = { runRemoveShadowedExceptionHandlers };
