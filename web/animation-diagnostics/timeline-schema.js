(function exposeLogoTimeline(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.DekoblokoLogoTimeline = api;
  }
}(typeof globalThis === "object" ? globalThis : this, () => {
  "use strict";

  function normalizeLogoTimeline(value, expectedGameJarSha256) {
    const start = Number(value && value.start);
    const end = Number(value && value.end);
    const step = Number(value && value.step);
    const tickNanoseconds = Number(value && value.tickNanoseconds);
    if (!value || value.schema !== 1 ||
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        !Number.isSafeInteger(step) || step <= 0 ||
        end < start || (end - start) % step !== 0 ||
        !Number.isSafeInteger(tickNanoseconds) || tickNanoseconds <= 0 ||
        value.generatedFromGameJarSha256 !== expectedGameJarSha256) {
      throw new Error(
        "logo timeline is invalid or belongs to another game JAR");
    }
    return {
      schema: value.schema,
      workload: value.workload,
      start,
      end,
      step,
      tickNanoseconds,
      tickMs: tickNanoseconds / 1e6,
      values: Array.from(
        {length: (end - start) / step + 1},
        (_unused, index) => start + index * step),
    };
  }

  function summarizeLogoTimeline(timeline) {
    return {
      schema: timeline.schema,
      workload: timeline.workload,
      start: timeline.start,
      end: timeline.end,
      step: timeline.step,
      states: timeline.values.length,
      tickNanoseconds: timeline.tickNanoseconds,
      tickMs: timeline.tickMs,
      durationMs: timeline.values.length * timeline.tickMs,
    };
  }

  function sequenceHashesByLoop(rows, statesPerLoop) {
    const hashes = [];
    for (let offset = 0; offset < rows.length; offset += statesPerLoop) {
      let hash = 2166136261;
      for (const row of rows.slice(offset, offset + statesPerLoop)) {
        hash = Math.imul(hash ^ row.hash, 16777619) >>> 0;
      }
      hashes.push(hash);
    }
    return hashes;
  }

  function instructionOp(item) {
    const instruction = item && item.instruction;
    return typeof instruction === "string" ? instruction :
      instruction && instruction.op;
  }

  function findSurfaceClearMethod(jvm, surfaceField, onAmbiguous) {
    const fieldIdentity = JSON.stringify(surfaceField);
    const candidates = [];
    for (const [className, classData] of Object.entries(jvm.classes)) {
      const classItem = classData && classData.ast &&
        classData.ast.classes && classData.ast.classes[0];
      for (const item of classItem && classItem.items || []) {
        if (item.type !== "method" || item.method.descriptor !== "()V" ||
            item.method.handlers && item.method.handlers.length) continue;
        const code = jvm.jit.getCodeItems(item.method);
        const surfaceReads = code.filter(codeItem =>
          codeItem && codeItem.instruction &&
          codeItem.instruction.op === "getstatic" &&
          JSON.stringify(codeItem.instruction.arg) === fieldIdentity).length;
        const zeroStores = code.filter((codeItem, index) =>
          instructionOp(codeItem) === "iastore" &&
          instructionOp(code[index - 1]) === "iconst_0").length;
        if (surfaceReads >= 4 && zeroStores >= 4) {
          candidates.push({
            method: item.method,
            className,
            surfaceReads,
            zeroStores,
          });
        }
      }
    }
    candidates.sort((left, right) =>
      right.surfaceReads - left.surfaceReads ||
      right.zeroStores - left.zeroStores);
    if (candidates.length === 1) return candidates[0];
    return typeof onAmbiguous === "function" ?
      onAmbiguous(candidates.length) : null;
  }

  return Object.freeze({
    findSurfaceClearMethod,
    instructionOp,
    normalizeLogoTimeline,
    sequenceHashesByLoop,
    summarizeLogoTimeline,
  });
}));
