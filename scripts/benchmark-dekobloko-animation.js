#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  findSurfaceClearMethod: findSharedSurfaceClearMethod,
  normalizeLogoTimeline,
  sequenceHashesByLoop,
  summarizeLogoTimeline,
} = require("../web/animation-diagnostics/timeline-schema");

const root = path.resolve(__dirname, "..");
const javaToolsRoot = path.resolve(process.env.JAVA_TOOLS_DIR ||
  path.join(root, "..", "java-tools"));
const { JVM } = require(path.join(javaToolsRoot, "src", "core", "jvm"));
const Frame = require(path.join(javaToolsRoot, "src", "core", "frame"));
const Stack = require(path.join(javaToolsRoot, "src", "core", "stack"));
const tracePath = path.resolve(process.argv[2] ||
  path.join(root, ".work", "animation-diagnostics", "logo-animation-trace.json"));
const classpath = path.resolve(process.argv[3] ||
  path.join(root, ".work", "jvmjs",
    "hybrid-all-recompiled-lean-carriers", "classes"));
const timelinePath = path.join(
  root, "web", "animation-diagnostics", "logo-timeline.json");
const loops = positiveInteger("DEKOBLOKO_ANIMATION_LOOPS", 1);
const warmups = positiveInteger("DEKOBLOKO_ANIMATION_WARMUPS", 8);

function positiveInteger(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function frameKey(jvm, frame) {
  return `${frame.className || jvm.findClassNameForMethod(frame.method)}.` +
    `${frame.method.name}${frame.method.descriptor}`;
}

function arrayData(value) {
  if (!value) return null;
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return value;
  if (Array.isArray(value.elements) || ArrayBuffer.isView(value.elements)) {
    return value.elements;
  }
  return null;
}

function hashPixels(pixels, count) {
  let hash = 2166136261;
  for (let index = 0; index < count; index++) {
    hash = Math.imul(
      hash ^ (Number(pixels[index]) | 0), 16777619) >>> 0;
  }
  return hash;
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
    throw new Error("target has no unambiguous repeated integer animation input");
  }
  return ranked[0];
}

function findSurface(jvm) {
  const candidates = [];
  for (const classData of Object.values(jvm.classes)) {
    for (const item of classData?.ast?.classes?.[0]?.items || []) {
      if (item.type !== "method" || item.method.descriptor !== "(IIII)V") continue;
      const intrinsic = jvm.jit.getSynchronousIntrinsic(item.method, "(IIII)V");
      if (intrinsic?.jvmDirectKind !== "clippedStaticSpan") continue;
      const field = intrinsic.jvmDirectData?.staticFields?.[5];
      const pixels = arrayData(jvm.jit.getStaticSync(field));
      if (pixels) candidates.push({ field, pixels });
    }
  }
  // The complete historical raster oracle is intentionally disabled in the
  // production JIT. Keep this diagnostic usable with the generic tier by
  // deriving the surface from ordinary initialized static-array state. The
  // largest live int[] is the software framebuffer in this captured replay;
  // no owner or field identity participates in compilation.
  if (!candidates.length) {
    for (const [className, classData] of Object.entries(jvm.classes)) {
      for (const [key, value] of classData?.staticFields || []) {
        const pixels = arrayData(value);
        if (!pixels || value?.type !== "[I") continue;
        const separator = String(key).lastIndexOf(":");
        if (separator <= 0 || String(key).slice(separator + 1) !== "[I") continue;
        candidates.push({
          field: [
            "Field",
            className,
            [String(key).slice(0, separator), "[I"],
          ],
          pixels,
        });
      }
    }
  }
  candidates.sort((left, right) => right.pixels.length - left.pixels.length);
  if (!candidates[0]) throw new Error("captured software raster was not found");
  return candidates[0];
}

function findSurfaceClearMethod(jvm, surfaceField) {
  return findSharedSurfaceClearMethod(jvm, surfaceField, (candidateCount) => {
    throw new Error(
      `captured software raster has ${candidateCount} clear candidates`);
  });
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function hashTree(directory) {
  const digest = crypto.createHash("sha256");
  const visit = (relative) => {
    const absolute = path.join(directory, relative);
    for (const name of fs.readdirSync(absolute).sort()) {
      const childRelative = path.join(relative, name);
      const child = path.join(directory, childRelative);
      if (fs.statSync(child).isDirectory()) visit(childRelative);
      else {
        digest.update(childRelative.split(path.sep).join("/"));
        digest.update("\0");
        digest.update(fs.readFileSync(child));
        digest.update("\0");
      }
    }
  };
  visit("");
  return digest.digest("hex");
}

function gitMetadata(directory) {
  const git = (args) => execFileSync(
    "git", ["-C", directory, ...args], { encoding: "utf8" }).trim();
  const trackedStatus = git([
    "status", "--porcelain=v1", "--untracked-files=no",
  ]);
  const status = git(["status", "--porcelain=v1"]);
  return {
    revisionSha1: git(["rev-parse", "HEAD"]),
    treeSha1: git(["rev-parse", "HEAD^{tree}"]),
    trackedDirty: Boolean(trackedStatus),
    dirty: Boolean(status),
  };
}

async function invokeGuestFrame(runtime, method, className, locals) {
  const frame = new Frame(method);
  frame.className = className;
  frame.locals = locals.slice();
  runtime.thread.status = "runnable";
  runtime.thread.pendingException = null;
  runtime.thread.callStack.push(frame);
  let ticks = 0;
  while (!runtime.thread.callStack.isEmpty()) {
    await runtime.jvm.executeTick();
    if (Date.now() >= runtime.jvm._nextEventLoopYieldAt) {
      await new Promise((resolve) => setImmediate(resolve));
      runtime.jvm._nextEventLoopYieldAt =
        Date.now() + runtime.jvm.eventLoopYieldMs;
    }
    if (++ticks > 2_000_000) throw new Error("animation exceeded scheduler tick limit");
  }
  if (runtime.thread.pendingException) {
    throw new Error(
      `animation left pending exception ${JSON.stringify(runtime.thread.pendingException)}`);
  }
  return ticks;
}

async function invoke(runtime, progress) {
  runtime.jvm.jit.putStaticSync(runtime.progressField.field, progress);
  const started = process.hrtime.bigint();
  let ticks = 0;
  ticks += await invokeGuestFrame(
    runtime, runtime.clearMethod, runtime.clearClassName, []);
  ticks += await invokeGuestFrame(
    runtime, runtime.method, runtime.className, runtime.locals);
  return {
    nanoseconds: Number(process.hrtime.bigint() - started),
    ticks,
  };
}

async function main() {
  if (!fs.statSync(tracePath, { throwIfNoEntry: false })?.isFile() ||
      !fs.statSync(classpath, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(
      "Usage: node scripts/benchmark-dekobloko-animation.js " +
      "[trace.json] [class-directory]");
  }
  const gameJarSha256 = sha256(path.join(root, "dekobloko.jar"));
  const timeline = normalizeLogoTimeline(
    JSON.parse(fs.readFileSync(timelinePath, "utf8")), gameJarSha256);
  const progressValues = timeline.values;
  const frames = loops * progressValues.length;
  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  trace.state.classpath = [classpath];
  const jvm = new JVM({ classpath: [classpath], jit: {
    warmupThreshold: 0,
    preferWholeMethodJs: true,
    rendererPipeline: true,
    fusedRegions: true,
  } });
  await jvm.loadState(trace.state);
  const restored = jvm.threads.flatMap((thread) =>
    thread.callStack.items.map((frame) => ({ thread, frame })))
    .find(({ frame }) => frameKey(jvm, frame) === trace.methodKey);
  if (!restored) throw new Error(`trace has no entry frame ${trace.methodKey}`);

  const thread = {
    id: restored.thread.id,
    name: "moving-animation-benchmark",
    status: "runnable",
    pendingException: null,
    callStack: new Stack(),
  };
  jvm.threads = [thread];
  jvm.currentThreadIndex = 0;
  const runtime = {
    jvm,
    thread,
    method: restored.frame.method,
    className: restored.frame.className ||
      jvm.findClassNameForMethod(restored.frame.method),
    locals: restored.frame.locals.slice(),
    progressField: findAnimationProgressField(jvm, restored.frame.method),
    surface: findSurface(jvm),
  };
  const clearTarget = findSurfaceClearMethod(jvm, runtime.surface.field);
  runtime.clearMethod = clearTarget.method;
  runtime.clearClassName = clearTarget.className;
  const width = Number(runtime.locals[1]) * 2;
  const height = Number(runtime.locals[0]) * 2;
  const pixelCount = width * height;
  if (!Number.isSafeInteger(pixelCount) || pixelCount <= 0 ||
      runtime.surface.pixels.length < pixelCount) {
    throw new Error(`invalid captured surface ${width}x${height}`);
  }
  for (let index = 0; index < warmups; index++) {
    await invoke(runtime, progressValues[index % progressValues.length]);
  }
  const rows = [];
  for (let index = 0; index < frames; index++) {
    const invocation = await invoke(
      runtime, progressValues[index % progressValues.length]);
    const pixels = arrayData(jvm.jit.getStaticSync(runtime.surface.field));
    rows.push({
      ...invocation,
      progress: progressValues[index % progressValues.length],
      loop: Math.floor(index / progressValues.length),
      timelineIndex: index % progressValues.length,
      hash: hashPixels(pixels, pixelCount),
    });
  }
  const hashes = rows.map((row) => row.hash);
  const changedTransitions = hashes.slice(1)
    .filter((hash, index) => hash !== hashes[index]).length;
  if (new Set(hashes).size < 2 ||
      changedTransitions < Math.max(1, Math.floor((frames - 1) / 2))) {
    throw new Error(
      `static animation output: ${new Set(hashes).size} unique hashes, ` +
      `${changedTransitions}/${frames - 1} changed transitions`);
  }
  const loopSequenceHashes = sequenceHashesByLoop(
    rows, progressValues.length);
  if (new Set(loopSequenceHashes).size !== 1) {
    const firstMismatch = rows.findIndex((row, index) =>
      index >= progressValues.length &&
      row.hash !== rows[index % progressValues.length].hash);
    throw new Error(
      `timeline replay diverged across loops at state ` +
      `${firstMismatch % progressValues.length}: ` +
      `${loopSequenceHashes.join(", ")}`);
  }
  let sequenceHash = 2166136261;
  for (const hash of hashes) {
    sequenceHash = Math.imul(sequenceHash ^ hash, 16777619) >>> 0;
  }
  const elapsedNs = rows.reduce((sum, row) => sum + row.nanoseconds, 0);
  const result = {
    node: process.version,
    target: trace.methodKey,
    tier: "structured",
    loops,
    frames,
    warmups,
    framesPerSecond: frames * 1e9 / elapsedNs,
    medianGuestMs: median(rows.map((row) => row.nanoseconds)) / 1e6,
    averageSchedulerTicks:
      rows.reduce((sum, row) => sum + row.ticks, 0) / frames,
    timeline: {
      ...summarizeLogoTimeline(timeline),
      loopSequenceHashes,
    },
    surface: {
      width,
      height,
      pixels: pixelCount,
      uniqueHashes: new Set(hashes).size,
      changedTransitions,
      transitionCount: frames - 1,
      sequenceHash,
      firstHash: hashes[0],
      lastHash: hashes.at(-1),
    },
    progressInput: runtime.progressField,
    jit: {
      structuredRuns: jvm.jit.structuredSsa.runCount,
      fusedRuns: jvm.jit.fusedRunCount,
      fusedDirectRuns: jvm.jit.fusedDirectRunCount,
    },
    provenance: {
      traceSha256: sha256(tracePath),
      timelineSha256: sha256(timelinePath),
      classesTreeSha256: hashTree(classpath),
      generatedFromGameJarSha256: gameJarSha256,
      repositories: {
        dekoblokoWork: gitMetadata(root),
        javaTools: gitMetadata(javaToolsRoot),
      },
      environment: Object.fromEntries(Object.keys(process.env)
        .filter((key) => key.startsWith("JVM_") ||
          key.startsWith("DEKOBLOKO_ANIMATION_") ||
          key === "JAVA_TOOLS_DIR")
        .sort().map((key) => [key, process.env[key]])),
      jitOptions: {
        warmupThreshold: 0,
        preferWholeMethodJs: true,
        rendererPipeline: true,
        fusedRegions: true,
      },
    },
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  await jvm.closeSaveStateFileHandles?.();
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
