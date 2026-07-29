#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const javaToolsRoot = path.resolve(process.env.JAVA_TOOLS_DIR ||
  path.join(repositoryRoot, "..", "java-tools"));
const defaultTrack = path.join(
  repositoryRoot, ".work", "music", "dekobloko", "split",
  "archive10_group000", "music_Art_Deko_remix_NORMAL.ui.bin");
const gameJar = path.resolve(process.env.FUNORB_GAME_JAR ||
  path.join(repositoryRoot, "dekobloko.jar"));
const driverJar = path.join(
  repositoryRoot, ".work", "audio-diagnostics", "java",
  "funorb-guest-mixer.jar");
const sampleBank = path.join(
  repositoryRoot, ".work", "audio-diagnostics", "java",
  "funorb-sample-bank.bin");
const driverSource = path.join(
  repositoryRoot, "tools", "music", "JavaFunOrbTrackPlayer.java");
const driverClass = "JavaFunOrbTrackPlayer";
const sampleRate = 22050;

function usage() {
  console.log(`Usage: node scripts/benchmark-guest-mixer-node.js [options]

Runs the same guest ia/mi/ei soundtrack mixer used by the browser audio
diagnostic, but with Node's non-blocking mock SourceDataLine sink.

Options:
  --tier javascript|alternate|interpreter  Execution tier (default: javascript)
  --structured-ssa default|on|off          Override structured-loop policy
  --inline-loop-regions on|off             Toggle embedded scalar array regions
  --track PATH                             Raw .ui.bin track descriptor
  --channels mono|stereo                   Guest mixer output shape (default: mono)
  --mix direct|scheduler                   Bypass or use the game audio scheduler
  --target-frames N                        Set the driver's reported expected frames
  --stop-after-ms N                        Request a guest safe-point stop on a timer
  --profile-timings                        Match browser 1/128 JIT and 1/16 scheduler samples
  --profile-methods                        Enable intrusive JIT invocation counters
  --no-prepare                             Reuse previously generated driver assets
  --help                                   Show this help
`);
}

function parseArguments(argv) {
  const options = {
    tier: "javascript",
    structuredSsa: "default",
    inlineLoopRegions: "on",
    track: defaultTrack,
    channels: "mono",
    mix: "direct",
    targetFrames: 0,
    stopAfterMs: 0,
    profileTimings: false,
    profileMethods: false,
    prepare: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--profile-methods") {
      options.profileMethods = true;
    } else if (argument === "--profile-timings") {
      options.profileTimings = true;
    } else if (argument === "--no-prepare") {
      options.prepare = false;
    } else if (argument === "--tier") {
      options.tier = requiredValue(argv, ++index, argument);
    } else if (argument === "--structured-ssa") {
      options.structuredSsa = requiredValue(argv, ++index, argument);
    } else if (argument === "--inline-loop-regions") {
      options.inlineLoopRegions = requiredValue(argv, ++index, argument);
    } else if (argument === "--track") {
      options.track = path.resolve(requiredValue(argv, ++index, argument));
    } else if (argument === "--channels") {
      options.channels = requiredValue(argv, ++index, argument);
    } else if (argument === "--mix") {
      options.mix = requiredValue(argv, ++index, argument);
    } else if (argument === "--target-frames") {
      options.targetFrames = nonNegativeInteger(
        requiredValue(argv, ++index, argument), argument);
    } else if (argument === "--stop-after-ms") {
      options.stopAfterMs = nonNegativeInteger(
        requiredValue(argv, ++index, argument), argument);
    } else {
      throw new Error(`unknown option: ${argument}`);
    }
  }
  if (!["javascript", "alternate", "interpreter"].includes(options.tier)) {
    throw new Error(
      `--tier must be javascript, alternate, or interpreter; got ${options.tier}`);
  }
  if (!["default", "on", "off"].includes(options.structuredSsa)) {
    throw new Error(
      `--structured-ssa must be default, on, or off; got ${options.structuredSsa}`);
  }
  if (!["on", "off"].includes(options.inlineLoopRegions)) {
    throw new Error(
      `--inline-loop-regions must be on or off; got ${options.inlineLoopRegions}`);
  }
  if (!["mono", "stereo"].includes(options.channels)) {
    throw new Error(
      `--channels must be mono or stereo; got ${options.channels}`);
  }
  if (!["direct", "scheduler"].includes(options.mix)) {
    throw new Error(
      `--mix must be direct or scheduler; got ${options.mix}`);
  }
  return options;
}

function requiredValue(argv, index, option) {
  if (index >= argv.length) throw new Error(`${option} requires a value`);
  return argv[index];
}

function nonNegativeInteger(value, option) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`${option} must be a non-negative integer`);
  }
  return number;
}

function prepareAssets() {
  execFileSync(process.execPath, [
    path.join(repositoryRoot, "scripts", "serve-audio-diagnostics.js"),
    "--prepare-only",
  ], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: ["ignore", "ignore", "inherit"],
  });
}

function requireFile(file, description) {
  if (!fs.existsSync(file)) {
    throw new Error(`${description} is missing: ${file}`);
  }
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function gitState(root) {
  function git(args) {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  }
  try {
    return {
      revision: git(["rev-parse", "HEAD"]),
      trackedDirty: Boolean(git(["status", "--porcelain", "--untracked-files=no"])),
      dirty: Boolean(git(["status", "--porcelain"])),
    };
  } catch {
    return { revision: null, trackedDirty: null, dirty: null };
  }
}

function staticNumber(fields, name, descriptor) {
  const value = fields.get(`${name}:${descriptor}`);
  return typeof value === "bigint" ? Number(value) : Number(value || 0);
}

function driverSnapshot(fields) {
  const millis = name => staticNumber(fields, name, "J") / 1e6;
  const integer = name => staticNumber(fields, name, "I") | 0;
  const warmupChunks = integer("warmupChunks");
  const steadyChunks = integer("steadyChunks");
  const mixMs = millis("mixNanos");
  const convertMs = millis("convertNanos");
  const writeMs = millis("writeNanos");
  const pipelineMs = mixMs + convertMs + writeMs;
  const writtenFrames = integer("writtenFrames");
  const audioSeconds = writtenFrames / sampleRate;
  return {
    bankLoadMs: millis("bankLoadNanos"),
    trackLoadMs: millis("trackLoadNanos"),
    mixMs,
    convertMs,
    writeMs,
    waitMs: millis("waitNanos"),
    pushMs: millis("pushNanos"),
    drainMs: millis("drainNanos"),
    pipelineMs,
    pipelineRealtimeFactor:
      pipelineMs > 0 ? audioSeconds / (pipelineMs / 1000) : 0,
    audioSeconds,
    targetFrames: integer("targetFrames"),
    writtenFrames,
    writtenBytes: integer("writtenBytes"),
    chunks: integer("profiledChunks"),
    writes: integer("writes"),
    checksum: integer("checksum") >>> 0,
    channels: integer("channels"),
    channelDiagnostics: {
      leftChecksum: integer("leftChecksum") >>> 0,
      rightChecksum: integer("rightChecksum") >>> 0,
      leftAbsoluteSum: staticNumber(fields, "leftAbsoluteSum", "J"),
      rightAbsoluteSum: staticNumber(fields, "rightAbsoluteSum", "J"),
    },
    deadlineMs: millis("chunkDeadlineNanos"),
    deadlineMisses: integer("deadlineMisses"),
    longestDeadlineMissStreak: integer("longestDeadlineMissStreak"),
    maximumMs: {
      mix: millis("mixMaxNanos"),
      convert: millis("convertMaxNanos"),
      write: millis("writeMaxNanos"),
      pipeline: millis("pipelineMaxNanos"),
    },
    warmup: {
      chunks: warmupChunks,
      averageMs: warmupChunks
        ? millis("warmupPipelineNanos") / warmupChunks : 0,
    },
    steady: {
      chunks: steadyChunks,
      averageMs: steadyChunks
        ? millis("steadyPipelineNanos") / steadyChunks : 0,
    },
    stopped: integer("stopRequested") !== 0,
    error: integer("error"),
    done: integer("done") !== 0,
  };
}

function relevantEnvironment() {
  return Object.fromEntries(Object.entries(process.env)
    .filter(([name]) => name.startsWith("JVM_") ||
      name === "JAVA_TOOLS_DIR" || name === "FUNORB_AUDIO_DATA" ||
      name === "FUNORB_GAME_JAR")
    .sort(([left], [right]) => left.localeCompare(right)));
}

function timingProfile(jvm, limit = 20) {
  if (!jvm.jit.profileTimings) return null;
  const methodRate = jvm.jit.methodTimingSampleRate;
  const generatedMethods = [...jvm.jit.methodTimingSamples.entries()]
    .map(([method, value]) => ({
      method,
      tier: value.tier,
      samples: value.samples,
      sampledTotalMs: value.totalMs,
      estimatedTotalMs: value.totalMs * methodRate,
    }))
    .sort((left, right) => right.estimatedTotalMs - left.estimatedTotalMs)
    .slice(0, limit);
  const scheduler = jvm.getSchedulerTimingSnapshot(limit);
  return {
    generatedMethodSampleRate: methodRate,
    generatedMethods,
    scheduler,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  if (options.prepare) prepareAssets();
  for (const [file, description] of [
    [options.track, "track descriptor"],
    [gameJar, "Dekobloko JAR"],
    [driverJar, "guest mixer driver JAR"],
    [sampleBank, "guest sample bank"],
    [driverSource, "guest mixer driver source"],
  ]) {
    requireFile(file, description);
  }

  const { JVM } = require(path.join(javaToolsRoot, "src", "core", "jvm"));
  const jitOptions = {
    enabled: options.tier !== "interpreter",
    preferWholeMethodJs: options.tier === "javascript",
    profileMethods: options.profileMethods,
    profileTimings: options.profileTimings,
    methodTimingSampleRate: 128,
    inlineLoopRegions: options.inlineLoopRegions === "on",
  };
  if (options.structuredSsa !== "default") {
    jitOptions.structuredSsa = options.structuredSsa === "on";
  }
  const jvm = new JVM({
    classpath: [driverJar, gameJar],
    jit: jitOptions,
    schedulerTimingRate: options.profileTimings ? 16 : 0,
  });

  let stopTimer = null;
  if (options.stopAfterMs > 0) {
    stopTimer = setTimeout(() => {
      const fields = jvm.classes[driverClass] &&
        jvm.classes[driverClass].staticFields;
      if (fields) fields.set("stopRequested:I", 1);
    }, options.stopAfterMs);
  }

  const started = process.hrtime.bigint();
  try {
    await jvm.run(driverClass, {
      args: [
        options.track,
        sampleBank,
        String(options.targetFrames),
        options.channels,
        options.mix,
      ],
    });
  } finally {
    if (stopTimer) clearTimeout(stopTimer);
  }
  const wallMs = Number(process.hrtime.bigint() - started) / 1e6;
  const fields = jvm.classes[driverClass] &&
    jvm.classes[driverClass].staticFields;
  if (!fields) throw new Error("guest mixer did not publish its static fields");
  const guest = driverSnapshot(fields);
  const result = {
    benchmark: "dekobloko-guest-mixer-node",
    measuredAt: new Date().toISOString(),
    runtime: {
      node: process.version,
      v8: process.versions.v8,
      platform: `${process.platform}/${process.arch}`,
      cpu: os.cpus()[0] && os.cpus()[0].model,
      audioSink: "Node mock SourceDataLine (non-blocking/discarded PCM)",
    },
    configuration: {
      tier: options.tier,
      jit: jitOptions,
      finalPreferWholeMethodJs: jvm.jit.preferWholeMethodJs,
      targetFrames: options.targetFrames,
      channels: options.channels,
      mix: options.mix,
      stopAfterMs: options.stopAfterMs,
      profileTimings: options.profileTimings,
      structuredSsa: {
        requested: options.structuredSsa,
        enabled: jvm.jit.structuredSsa.enabled,
        arrayLoopsOnly: jvm.jit.structuredSsa.arrayLoopsOnly,
      },
      inlineLoopRegions: options.inlineLoopRegions,
      environment: relevantEnvironment(),
    },
    provenance: {
      dekoblokoWork: gitState(repositoryRoot),
      javaTools: gitState(javaToolsRoot),
      artifacts: {
        track: { path: options.track, sha256: sha256(options.track) },
        gameJar: { path: gameJar, sha256: sha256(gameJar) },
        driverJar: { path: driverJar, sha256: sha256(driverJar) },
        driverSource: { path: driverSource, sha256: sha256(driverSource) },
        sampleBank: { path: sampleBank, sha256: sha256(sampleBank) },
      },
    },
    wallMs,
    wallRealtimeFactor:
      wallMs > 0 ? guest.audioSeconds / (wallMs / 1000) : 0,
    guest,
    jitCounters: {
      invocationCountersEnabled: options.profileMethods,
      generatedRuns:
        options.profileMethods ? jvm.jit.generatedRunCount : null,
      wasmRuns: jvm.jit.wasmJit.runCount,
      structuredRuns: jvm.jit.structuredSsa.runCount,
      inlineLoopRegionRuns: jvm.jit.inlineLoopRegionRunCount,
      inlineLoopRegionOsr: jvm.jit.inlineLoopRegionOsrCount,
      fusedRuns:
        options.profileMethods ? jvm.jit.fusedRunCount : null,
      scalarLoopRuns:
        options.profileMethods ? jvm.jit.scalarLoopRunCount : null,
      compiledWasmBodies: jvm.jit.wasmJit.compiled.length,
    },
    timingProfile: timingProfile(jvm),
  };
  console.log(JSON.stringify(result, null, 2));
  if (guest.error || !guest.done) process.exitCode = 1;
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
