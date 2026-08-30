const els = Object.fromEntries([
  "identity", "tier", "mode", "frames", "run", "stop", "progress", "status", "surface",
  "fps", "guest", "upload", "misses", "ticks", "hash", "details",
].map(id => [id, document.getElementById(id)]));
const {
  findSurfaceClearMethod,
  normalizeLogoTimeline,
  sequenceHashesByLoop,
  summarizeLogoTimeline,
} = globalThis.DekoblokoLogoTimeline;

const QUERY = new URLSearchParams(location.search);
const TIER = ["structured", "generated", "scalar"].includes(QUERY.get("tier"))
  ? QUERY.get("tier") : "structured";
const TIER_OPTIONS = {
  structured: {
    rendererPipeline: true,
  },
  generated: {
    scalarLoops: false,
    scalarGuestBodies: false,
    structuredSsa: false,
  },
  scalar: {
    scalarLoops: true,
    scalarGuestBodies: true,
    scalarSsaOptimizations: false,
    structuredSsa: false,
  },
};

const state = {
  manifest: null,
  jvm: null,
  thread: null,
  method: null,
  className: null,
  locals: null,
  surface: null,
  clearMethod: null,
  clearClassName: null,
  progressField: null,
  timeline: null,
  progressValues: [],
  width: 0,
  height: 0,
  imageData: null,
  stopped: false,
  running: false,
  session: crypto.randomUUID ? crypto.randomUUID() :
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
};
// This page is itself a profiler. Keep the runtime reachable for automation
// without exposing or changing the generic browser JVM API.
window.__dekoblokoAnimationDiagnostics = state;

els.run.addEventListener("click", runBenchmark);
els.tier.value = TIER;
els.tier.addEventListener("change", () => {
  const query = new URLSearchParams(location.search);
  query.set("tier", els.tier.value);
  location.search = query.toString();
});
els.stop.addEventListener("click", () => {
  state.stopped = true;
  els.status.textContent = "Stopping after the current guest frame…";
});

initialize().catch(showError);

async function initialize() {
  const started = performance.now();
  const [manifest, timelineData, jarResponse, traceResponse] = await Promise.all([
    fetch("/animation-assets/manifest.json").then(checkedJson),
    fetch("./logo-timeline.json").then(checkedJson),
    fetch("/animation-assets/scene-classes.jar").then(checkedResponse),
    fetch("/animation-assets/animation-trace.json").then(checkedResponse),
    loadScript("/jvm-assets/jvm-debug.js"),
  ]);
  const [jarBytes, trace] = await Promise.all([
    jarResponse.arrayBuffer(),
    traceResponse.json(),
  ]);
  const timeline = normalizeLogoTimeline(
    timelineData, manifest.generatedFromGameJarSha256);

  const debug = new JVMDebug.BrowserJVMDebug();
  await debug.initialize();
  debug.debugController.options.jit = {
    ...(debug.debugController.options.jit || {}),
    warmupThreshold: 0,
    preferWholeMethodJs: true,
    profileMethods: false,
    ...TIER_OPTIONS[TIER],
  };
  await debug.loadFile(new File(
    [jarBytes], "scene-classes.jar", { type: "application/java-archive" }));
  debug.debugController.reset();
  const jvm = debug.debugController.jvm;
  trace.state.classpath = ["."];
  await jvm.loadState(trace.state);

  const restored = jvm.threads.flatMap(thread =>
    thread.callStack.items.map(frame => ({thread, frame})))
    .find(({frame}) => frameKey(jvm, frame) === trace.methodKey);
  if (!restored) {
    throw new Error(`capture has no entry frame ${trace.methodKey}`);
  }
  const locals = restored.frame.locals.slice();
  const thread = restored.thread;
  thread.callStack.items.length = 0;
  thread.status = "runnable";
  thread.pendingException = null;
  jvm.threads = [thread];
  jvm.currentThreadIndex = 0;

  const surface = findSurface(jvm);
  const clearTarget = surface &&
    findSurfaceClearMethod(jvm, surface.field);
  const progressField = findAnimationProgressField(jvm, restored.frame.method);
  if (!progressField) {
    throw new Error("capture has no structurally identifiable animation-progress field");
  }
  const width = Number(locals[1]) * 2;
  const height = Number(locals[0]) * 2;
  if (!surface || !clearTarget ||
      !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width <= 0 || height <= 0 || surface.pixels.length < width * height) {
    throw new Error(
      `captured raster geometry is inconsistent: ${width}x${height}, ` +
      `${surface?.pixels?.length || 0} pixels; ` +
      `clear=${Boolean(clearTarget)}`);
  }
  state.manifest = manifest;
  state.jvm = jvm;
  state.thread = thread;
  state.method = restored.frame.method;
  state.className = restored.frame.className ||
    jvm.findClassNameForMethod(restored.frame.method);
  state.locals = locals;
  state.surface = surface;
  state.clearMethod = clearTarget.method;
  state.clearClassName = clearTarget.className;
  state.progressField = progressField;
  state.timeline = timeline;
  state.progressValues = timeline.values;
  state.width = width;
  state.height = height;
  els.surface.width = width;
  els.surface.height = height;
  state.imageData = els.surface
    .getContext("2d", {alpha: false}).createImageData(width, height);
  paintSurface();

  els.identity.textContent =
    `${manifest.methodKey} · ${TIER} · ${shortHash(manifest.sceneTraceSha256)}`;
  els.details.textContent = [
    `Capture: ${manifest.sceneTraceBytes.toLocaleString()} bytes (` +
      `${manifest.compressedSceneTraceBytes.toLocaleString()} transferred)`,
    `Trace SHA-256: ${manifest.sceneTraceSha256}`,
    `Classes JAR: ${manifest.sceneClassesJarSha256}`,
    `Generated from game JAR: ${manifest.generatedFromGameJarSha256}`,
    `JVM bundle: ${manifest.jvmBundleSha256}`,
    `Selected tier: ${TIER}`,
    `Original timeline: ${timeline.start}…${timeline.end} by ${timeline.step}, ` +
      `${timeline.tickMs.toFixed(2)} ms/tick (${timeline.values.length} states)`,
    `Timeline SHA-256: ${manifest.timelineSha256}`,
    `Per-frame guest clear: ${JSON.stringify(
      describeMethod(jvm, clearTarget.method))}`,
    `Animation progress field: ${JSON.stringify(progressField.field)} ` +
      `(${progressField.readCount} reads in the captured bytecode)`,
    `Target shape: ${JSON.stringify(describeMethod(jvm, state.method))}`,
  ].join("\n");
  els.status.textContent =
    (TIER === "structured" ? "" :
      "CONTROL TIER: structured SSA is disabled; " +
      "this mode is intentionally slow and is not the normal JVM path. ") +
    `Ready in ${(performance.now() - started).toFixed(1)} ms. ` +
    "The first run includes JIT warmup; every measured frame advances the " +
    "captured guest animation progress.";
  els.run.disabled = false;
  sendTelemetry("runtime_ready", {
    manifest,
    tier: TIER,
    preparationMs: performance.now() - started,
    timeline: summarizeLogoTimeline(state.timeline),
    targetShape: describeMethod(jvm, state.method),
  });
}

async function runBenchmark() {
  if (state.running) return;
  state.running = true;
  state.stopped = false;
  els.run.disabled = true;
  els.stop.disabled = false;
  const requestedLoops = Math.max(
    1, Math.min(20, Math.trunc(Number(els.frames.value) || 2)));
  const requested = requestedLoops * state.progressValues.length;
  const mode = els.mode.value;
  const warmups = 8;
  const countersBefore = jitCounters();
  try {
    els.status.textContent = `Warming the captured guest scene (${warmups} frames)…`;
    for (let index = 0; index < warmups; index += 1) {
      await invokeScene(state.progressValues[index % state.progressValues.length]);
    }
    paintSurface();

    const frameRows = [];
    const started = performance.now();
    let totalTicks = 0;
    let hashMs = 0;
    for (let index = 0; index < requested && !state.stopped; index += 1) {
      if (mode === "paced") {
        await waitForTimelineDeadline(
          started + index * state.timeline.tickMs);
      }
      const frameStarted = performance.now();
      const timelineIndex = index % state.progressValues.length;
      const progress = state.progressValues[timelineIndex];
      const invocation = await invokeScene(progress);
      const renderedAt = performance.now();
      paintSurface();
      const uploadedAt = performance.now();
      const hashStarted = performance.now();
      const surfaceHash = hashPixels(
        surfacePixels(), state.width * state.height);
      hashMs += performance.now() - hashStarted;
      frameRows.push({
        guestMs: invocation.elapsedMs,
        uploadMs: uploadedAt - renderedAt,
        pipelineMs: uploadedAt - frameStarted,
        ticks: invocation.ticks,
        hash: surfaceHash,
        progress,
        loop: Math.floor(index / state.progressValues.length),
        timelineIndex,
      });
      totalTicks += invocation.ticks;
      els.progress.style.width = `${100 * (index + 1) / requested}%`;
      if ((index + 1) % 10 === 0) {
        els.status.textContent =
          `Rendered ${index + 1}/${requested} original timeline states…`;
        await Promise.resolve();
      }
    }
    const elapsedMs = performance.now() - started;
    if (!frameRows.length) throw new Error("scene loop stopped before a measured frame");
    if (frameRows.length !== requested) {
      throw new Error(
        `timeline stopped after ${frameRows.length}/${requested} states`);
    }
    const hashes = frameRows.map(row => row.hash);
    const uniqueHashes = new Set(hashes);
    const changedTransitions = hashes.slice(1)
      .filter((hash, index) => hash !== hashes[index]).length;
    const minimumMotionTransitions = Math.max(
      1, Math.floor((frameRows.length - 1) / 2));
    if (uniqueHashes.size < 2 ||
        changedTransitions < minimumMotionTransitions) {
      throw new Error(
        `animation did not move enough: ${uniqueHashes.size} unique surfaces, ` +
        `${changedTransitions}/${frameRows.length - 1} changed transitions`);
    }
    const loopSequenceHashes = sequenceHashesByLoop(
      frameRows, state.progressValues.length);
    if (new Set(loopSequenceHashes).size !== 1) {
      throw new Error(
        `timeline replay diverged across loops: ${loopSequenceHashes.join(", ")}`);
    }
    const result = summarize(
      mode, requestedLoops, requested, frameRows, elapsedMs, hashMs, totalTicks,
      countersBefore, jitCounters());
    displayResult(result);
    sendTelemetry("animation_loop_result", {manifest: state.manifest, result});
  } catch (error) {
    showError(error);
    sendTelemetry("animation_loop_error", {
      manifest: state.manifest,
      message: String(error?.message || error),
      stack: error?.stack || null,
    });
  } finally {
    state.running = false;
    els.run.disabled = false;
    els.stop.disabled = true;
  }
}

async function invokeScene(progress) {
  state.jvm.jit.putStaticSync(state.progressField.field, progress);
  const started = performance.now();
  let ticks = 0;
  ticks += await invokeGuestFrame(
    state.clearMethod, state.clearClassName, []);
  ticks += await invokeGuestFrame(
    state.method, state.className, state.locals);
  return {ticks, elapsedMs: performance.now() - started};
}

async function invokeGuestFrame(method, className, locals) {
  const frame = new JVMDebug.Frame(method);
  frame.className = className;
  frame.locals = locals.slice();
  state.thread.status = "runnable";
  state.thread.pendingException = null;
  state.thread.callStack.push(frame);
  let ticks = 0;
  while (!state.thread.callStack.isEmpty()) {
    const result = await state.jvm.executeTick();
    if (result.completed && !state.thread.callStack.isEmpty()) {
      throw new Error("scene replay terminated before its entry frame returned");
    }
    if (Date.now() >= state.jvm._nextEventLoopYieldAt) {
      await new Promise(resolve => setTimeout(resolve, 0));
      state.jvm._nextEventLoopYieldAt =
        Date.now() + state.jvm.eventLoopYieldMs;
    }
    if (++ticks > 1000000) throw new Error("scene replay exceeded scheduler tick limit");
  }
  if (state.thread.pendingException) {
    throw new Error(
      `scene replay left pending exception ${JSON.stringify(state.thread.pendingException)}`);
  }
  return ticks;
}

function summarize(mode, requestedLoops, requested, rows, elapsedMs, hashMs,
    totalTicks, before, after) {
  const values = key => rows.map(row => row[key]);
  const guest = values("guestMs");
  const upload = values("uploadMs");
  const pipeline = values("pipelineMs");
  const hashes = values("hash");
  const changedTransitions = hashes.slice(1)
    .filter((hash, index) => hash !== hashes[index]).length;
  let sequenceHash = 2166136261;
  for (const hash of hashes) {
    sequenceHash = Math.imul(sequenceHash ^ hash, 16777619) >>> 0;
  }
  const deadline = state.timeline.tickMs;
  return {
    tier: TIER,
    mode,
    requestedLoops,
    completedLoops: rows.length / state.progressValues.length,
    requestedFrames: requested,
    completedFrames: rows.length,
    elapsedMs,
    framesPerSecond: rows.length * 1000 / elapsedMs,
    guestMs: stats(guest),
    uploadMs: stats(upload),
    pipelineMs: stats(pipeline),
    hashMs,
    deadlineMs: deadline,
    deadlineMisses: pipeline.filter(value => value > deadline).length,
    sixtyFpsMisses: pipeline.filter(value => value > 1000 / 60).length,
    thirtyFpsMisses: pipeline.filter(value => value > 1000 / 30).length,
    averageSchedulerTicks: totalTicks / rows.length,
    timeline: {
      ...summarizeLogoTimeline(state.timeline),
      loopSequenceHashes: sequenceHashesByLoop(
        rows, state.progressValues.length),
    },
    surface: {
      width: state.width,
      height: state.height,
      pixels: state.width * state.height,
      uniqueHashes: new Set(hashes).size,
      changedTransitions,
      transitionCount: Math.max(0, rows.length - 1),
      motionRatio: rows.length > 1
        ? changedTransitions / (rows.length - 1) : 0,
      sequenceHash,
      firstHash: hashes[0],
      lastHash: hashes.at(-1),
    },
    jitDelta: Object.fromEntries(
      Object.keys(after).map(key => [key, after[key] - before[key]])),
  };
}

function displayResult(result) {
  els.fps.textContent =
    `${result.framesPerSecond.toFixed(2)} FPS` +
    (TIER === "structured" ? "" : " · CONTROL");
  els.guest.textContent = `${result.guestMs.median.toFixed(2)} ms`;
  els.upload.textContent = `${result.uploadMs.median.toFixed(2)} ms`;
  els.misses.textContent =
    `${result.deadlineMisses}/${result.completedFrames}`;
  els.ticks.textContent = result.averageSchedulerTicks.toFixed(2);
  els.hash.textContent =
    `${result.surface.uniqueHashes} moving · ${result.surface.sequenceHash >>> 0}`;
  els.details.textContent = JSON.stringify({
    ...result,
    provenance: state.manifest,
  }, null, 2);
  els.status.textContent =
    (TIER === "structured" ? "" :
      "CONTROL TIER (OPTIMIZATIONS OFF) · ") +
    `${result.mode} timeline complete: ${result.completedLoops} loops / ` +
    `${result.completedFrames} states at ` +
    `${result.framesPerSecond.toFixed(2)} FPS; ` +
    `${result.surface.changedTransitions}/${result.surface.transitionCount} ` +
    "consecutive surfaces changed.";
}

function stats(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    minimum: ordered[0],
    median: ordered[Math.floor(ordered.length / 2)],
    p95: ordered[Math.min(
      ordered.length - 1, Math.ceil(ordered.length * 0.95) - 1)],
    maximum: ordered.at(-1),
    average: sum / values.length,
    total: sum,
  };
}

function jitCounters() {
  const jit = state.jvm.jit;
  return {
    generatedRuns: jit.generatedRunCount || 0,
    structuredRuns: jit.structuredSsa.runCount || 0,
    scalarRuns: jit.scalarLoopRunCount || 0,
    fusedRuns: jit.fusedRunCount || 0,
    fusedDirectRuns: jit.fusedDirectRunCount || 0,
    inlineLoopRegionRuns: jit.inlineLoopRegionRunCount || 0,
    inlineLoopRegionOsr: jit.inlineLoopRegionOsrCount || 0,
  };
}

function findSurface(jvm) {
  const candidates = [];
  for (const classData of Object.values(jvm.classes)) {
    for (const item of classData?.ast?.classes?.[0]?.items || []) {
      if (item.type !== "method" || item.method.descriptor !== "(IIII)V") continue;
      const intrinsic = jvm.jit.getSynchronousIntrinsic(item.method, "(IIII)V");
      if (intrinsic?.jvmDirectKind !== "clippedStaticSpan") continue;
      const pixelsField = intrinsic.jvmDirectData?.staticFields?.[5];
      if (!pixelsField) continue;
      const pixels = arrayData(jvm.jit.getStaticSync(pixelsField));
      if (pixels) candidates.push({pixels, field: pixelsField});
    }
  }
  candidates.sort((left, right) => right.pixels.length - left.pixels.length);
  return candidates[0] || null;
}

function findAnimationProgressField(jvm, method) {
  const candidates = new Map();
  for (const item of jvm.jit.getCodeItems(method)) {
    const instruction = item?.instruction;
    if (!instruction || typeof instruction !== "object" ||
        instruction.op !== "getstatic" ||
        instruction.arg?.[2]?.[1] !== "I") continue;
    const identity = JSON.stringify(instruction.arg);
    const candidate = candidates.get(identity) || {
      field: instruction.arg,
      readCount: 0,
    };
    candidate.readCount++;
    candidates.set(identity, candidate);
  }
  const ranked = [...candidates.values()]
    .sort((left, right) => right.readCount - left.readCount);
  if (ranked[0]?.readCount < 4 ||
      ranked[1] && ranked[0].readCount < ranked[1].readCount * 2) {
    return null;
  }
  return ranked[0];
}

function describeMethod(jvm, method) {
  const counts = {
    instructions: 0, invokes: 0, fields: 0, arrays: 0,
    allocations: 0, branches: 0,
  };
  for (const item of jvm.jit.getCodeItems(method)) {
    const instruction = item?.instruction;
    const op = typeof instruction === "string" ? instruction : instruction?.op;
    if (!op) continue;
    counts.instructions++;
    if (op.startsWith("invoke")) counts.invokes++;
    if (op.endsWith("field") || op.endsWith("static")) counts.fields++;
    if (/^[a-z]aload$/.test(op) || /^[a-z]astore$/.test(op) ||
        op === "arraylength") counts.arrays++;
    if (op === "new" || op === "newarray" || op === "anewarray" ||
        op === "multianewarray") counts.allocations++;
    if (op === "goto" || op.startsWith("if") ||
        op === "tableswitch" || op === "lookupswitch") counts.branches++;
  }
  return counts;
}

function paintSurface() {
  const pixels = surfacePixels();
  const data = state.imageData.data;
  const pixelCount = state.width * state.height;
  for (let index = 0, offset = 0; index < pixelCount; index++, offset += 4) {
    const pixel = Number(pixels[index]) | 0;
    data[offset] = (pixel >>> 16) & 255;
    data[offset + 1] = (pixel >>> 8) & 255;
    data[offset + 2] = pixel & 255;
    data[offset + 3] = 255;
  }
  els.surface.getContext("2d", {alpha: false}).putImageData(
    state.imageData, 0, 0);
}

function surfacePixels() {
  const pixels = arrayData(state.jvm.jit.getStaticSync(state.surface.field));
  if (!pixels || pixels.length < state.width * state.height) {
    throw new Error("captured software surface disappeared during animation");
  }
  state.surface.pixels = pixels;
  return pixels;
}

function hashPixels(value, count) {
  const pixels = arrayData(value);
  let hash = 2166136261;
  for (let index = 0; index < count; index++) {
    hash = Math.imul(hash ^ (Number(pixels[index]) | 0), 16777619) >>> 0;
  }
  return hash;
}

function arrayData(value) {
  if (!value) return null;
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return value;
  if (Array.isArray(value.elements) || ArrayBuffer.isView(value.elements)) {
    return value.elements;
  }
  return null;
}

function frameKey(jvm, frame) {
  return `${frame.className || jvm.findClassNameForMethod(frame.method)}.` +
    `${frame.method.name}${frame.method.descriptor}`;
}

async function waitForTimelineDeadline(deadline) {
  for (;;) {
    const remaining = deadline - performance.now();
    if (remaining <= 0) return;
    await new Promise(resolve =>
      setTimeout(resolve, Math.max(0, remaining - 0.5)));
  }
}

function checkedResponse(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${response.url}`);
  return response;
}

function checkedJson(response) {
  return checkedResponse(response).json();
}

function shortHash(value) {
  return String(value || "").slice(0, 12);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.addEventListener("load", resolve, {once: true});
    script.addEventListener("error", () =>
      reject(new Error(`could not load ${src}`)), {once: true});
    document.head.append(script);
  });
}

function sendTelemetry(event, details) {
  fetch("/api/animation-diagnostics", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      session: state.session,
      event,
      pageElapsedMs: Math.round(performance.now()),
      details,
    }),
    keepalive: true,
  }).catch(() => {});
}

function showError(error) {
  console.error(error);
  els.status.textContent = `Animation diagnostic failed: ${error?.message || error}`;
  els.details.textContent = error?.stack || String(error);
  els.run.disabled = !state.jvm;
  els.stop.disabled = true;
}
