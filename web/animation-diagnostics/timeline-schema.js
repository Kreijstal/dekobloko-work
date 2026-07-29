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

  return Object.freeze({normalizeLogoTimeline, summarizeLogoTimeline});
}));
