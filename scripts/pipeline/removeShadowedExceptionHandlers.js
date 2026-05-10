'use strict';

const DEFAULT_DROP_HANDLERS = new Map();
const DEFAULT_DROP_RANGES = new Map();

function runDekoblokoExceptionHandlerDrops(ast, options = {}) {
  const dropHandlers = options.dropHandlers || toHandlerMap(options.handlers) || DEFAULT_DROP_HANDLERS;
  const dropRanges = options.dropRanges || toRangeMap(options.ranges) || DEFAULT_DROP_RANGES;
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
      }
    }
  }
  return removed;
}

function toHandlerMap(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const out = new Map();
  for (const entry of entries) {
    out.set(entry.method, new Set(entry.handlers || []));
  }
  return out;
}

function toRangeMap(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const out = new Map();
  for (const entry of entries) {
    out.set(entry.method, new Set(entry.ranges || []));
  }
  return out;
}

module.exports = { runDekoblokoExceptionHandlerDrops };
