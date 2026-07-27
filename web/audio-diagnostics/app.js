import { hydrateSampleBank, renderTrack } from "../music-visualizer/audio.js";

const QUERY = new URLSearchParams(location.search);
const DATA_ROOT = QUERY.get("data") || "/audio-data";
const GUEST_BANK_PATH = "funorb-sample-bank.bin";
const GUEST_TRACK_PATH = "diagnostic-track.ui.bin";
const GUEST_SAMPLE_RATE = 22050;
const METHOD_TIMING_ENABLED = QUERY.get("profile") !== "0";
const METHOD_TIMING_SAMPLE_RATE = Math.min(
  4096, Math.max(1, Number(QUERY.get("jitSampleRate")) || 128));
const SCHEDULER_TIMING_SAMPLE_RATE = Math.min(
  4096, Math.max(1, Number(QUERY.get("schedulerSampleRate")) || 16));
const TELEMETRY_INTERVAL_MS = 5000;
const els = Object.fromEntries([
  "trackSelect", "playButton", "playlistButton", "benchmarkButton", "stopButton",
  "engineSelect", "modeExplanation", "progress", "statusText", "playbackText",
  "libraryBadge", "renderTime", "audioDuration", "realtimeFactor", "eventLoopDelay",
  "bufferTime", "checksum", "sampleCount", "sampleRate", "peak", "rms", "nonZero",
  "contextState", "outputRate", "baseLatency", "outputLatency", "bankLoad", "historyBody",
  "javaGeneration", "javaWrite", "javaWait", "javaPush",
  "javaUiStall", "javaUnderruns", "javaUnderrunTime", "javaStatus", "javaProfile",
].map(id => [id, document.getElementById(id)]));

const state = {
  manifest: null,
  tracks: [],
  worker: null,
  workerReady: null,
  workerRequests: new Map(),
  requestSequence: 0,
  mainBank: null,
  mainBankLoadMs: null,
  context: null,
  source: null,
  currentPcm: null,
  playbackStartedAt: 0,
  playbackOffset: 0,
  playbackDuration: 0,
  playbackAnimation: 0,
  stopped: false,
  playlist: false,
  busy: false,
  cache: new Map(),
  history: [],
  telemetrySession: createSessionId(),
  javaDebug: null,
  javaManifest: null,
  javaTrackBusy: false,
};

els.playButton.addEventListener("click", () => playSelected(false));
els.playlistButton.addEventListener("click", () => playSelected(true));
els.benchmarkButton.addEventListener("click", benchmarkSelected);
els.stopButton.addEventListener("click", stopEverything);
els.engineSelect.addEventListener("change", () => {
  els.modeExplanation.textContent = els.engineSelect.value === "worker"
    ? "keeps rendering away from animation and input"
    : "reproduces PCM work competing with animation and input";
});

initialize().catch(showError);

async function initialize() {
  const startedAt = performance.now();
  const response = await fetch(`${DATA_ROOT}/manifest.json`);
  if (!response.ok) throw new Error(`soundtrack manifest request failed: HTTP ${response.status}`);
  state.manifest = await response.json();
  const archive = state.manifest.archives && state.manifest.archives["10"];
  if (!archive || !Array.isArray(archive.files)) throw new Error("soundtrack manifest has no archive 10 tracks");
  state.tracks = archive.files.map((track, index) => ({
    ...track,
    index,
    label: String(track.name || `track ${index + 1}`).replace(/^music\//, ""),
    jsonUrl: trackJsonUrl(track),
  }));
  state.tracks.sort((a, b) => a.label.localeCompare(b.label));
  els.trackSelect.replaceChildren(...state.tracks.map(track => {
    const option = document.createElement("option");
    option.value = String(track.index);
    option.textContent = track.label;
    return option;
  }));
  els.libraryBadge.textContent = `${state.manifest.game || "FunOrb"} · ${state.tracks.length} tracks`;
  setStatus(`Loaded ${state.tracks.length} track descriptors in ${formatMs(performance.now() - startedAt)}. PCM bank loads on first render.`);
  setControls(false);
  prepareJavaRuntime().catch(showJavaError);
}

async function prepareJavaRuntime() {
  const [manifest, gameJarResponse, driverJarResponse, bankResponse] = await Promise.all([
    fetch("/jvm-assets/manifest.json").then(checkedJson),
    fetch("/jvm-assets/dekobloko.jar").then(checkedResponse),
    fetch("/jvm-assets/funorb-guest-mixer.jar").then(checkedResponse),
    fetch("/jvm-assets/funorb-sample-bank.bin").then(checkedResponse),
    loadScript("/jvm-assets/jvm-debug.js"),
  ]).then(values => [values[0], values[1], values[2], values[3]]);
  await loadScript("/jvm-assets/web-audio.js");
  const [gameJarBytes, driverJarBytes, bankBytes] = await Promise.all([
    gameJarResponse.arrayBuffer(),
    driverJarResponse.arrayBuffer(),
    bankResponse.arrayBuffer(),
  ]);
  const debug = new JVMDebug.BrowserJVMDebug();
  await debug.initialize();
  await debug.loadFile(new File(
    [gameJarBytes], "dekobloko.jar",
    { type: "application/java-archive" }));
  await debug.loadFile(new File(
    [driverJarBytes], "funorb-guest-mixer.jar",
    { type: "application/java-archive" }));
  debug.fileProvider.virtualFS.set(
    GUEST_BANK_PATH, new Uint8Array(bankBytes));
  state.javaDebug = debug;
  state.javaManifest = manifest;
  setJavaStatus(
    `Ready · guest mixer ${shortHash(manifest.guestMixerSourceSha256)} · ` +
    `sample bank ${shortHash(manifest.sampleBankSha256)} · ` +
    `game JAR ${shortHash(manifest.gameJarSha256)} · ` +
    `driver ${shortHash(manifest.driverJarSha256)} · ` +
    `JVM ${shortHash(manifest.jvmBundleSha256)}`);
  sendAudioTelemetry("runtime_ready", {
    manifest,
    trackCount: state.tracks.length,
    instrumentation: instrumentationConfiguration(),
  });
  setControls(false);
}

function trackJsonUrl(track) {
  const filename = String(track.path).split("/").pop().replace(/\.ui\.bin$/, ".json");
  return `${DATA_ROOT}/json/archive10_ui/${encodeURIComponent(filename)}`;
}

function selectedTrack() {
  const index = Number(els.trackSelect.value);
  return state.tracks.find(track => track.index === index) || state.tracks[0];
}

async function benchmarkSelected() {
  if (state.busy) return;
  state.stopped = false;
  state.playlist = false;
  await performRender(selectedTrack(), { play: false });
}

async function playSelected(playlist) {
  if (state.busy || state.javaTrackBusy || !state.javaDebug) return;
  stopAudioSource();
  state.stopped = false;
  state.playlist = playlist;
  let start = state.tracks.findIndex(track => track.index === selectedTrack().index);
  do {
    const track = state.tracks[start];
    els.trackSelect.value = String(track.index);
    const completed = await playTrackThroughJava(track);
    if (!completed || !state.playlist || state.stopped) return;
    start = (start + 1) % state.tracks.length;
  } while (state.playlist && !state.stopped);
}

async function playTrackThroughJava(track) {
  state.javaTrackBusy = true;
  state.busy = true;
  setControls(true);
  els.progress.style.width = "0%";
  const preparationStartedAt = performance.now();
  setStatus(
    `Loading ${track.label}; the guest FunOrb mixer will synthesize it live…`,
    "active");
  let progressTimer = null;
  let methodProfiler = null;
  let nextTelemetryAt = performance.now() + TELEMETRY_INTERVAL_MS;
  let nextProfileDisplayAt = 0;
  const eventLoop = startEventLoopMonitor();
  try {
    const [trackResponse, descriptor] = await Promise.all([
      fetch(trackBinaryUrl(track)).then(checkedResponse),
      fetch(track.jsonUrl).then(checkedJson),
    ]);
    const trackBytes = new Uint8Array(await trackResponse.arrayBuffer());
    if (state.stopped) return false;
    state.javaDebug.fileProvider.virtualFS.set(GUEST_TRACK_PATH, trackBytes);
    const expectedFrames = estimateTrackFrames(descriptor);
    const preparationMs = performance.now() - preparationStartedAt;
    const audioBefore = javaAudioDiagnostics();
    setStatus(
      `${track.label}: guest ia/mi/ei is mixing and pushing PCM through SourceDataLine…`,
      "active");

    progressTimer = setInterval(() => {
      const fields = classStaticFields(state.javaManifest.trackClassName);
      if (!fields) return;
      const target = javaField(fields, "targetFrames", "I");
      const written = javaField(fields, "writtenFrames", "I");
      const now = performance.now();
      if (methodProfiler && !methodProfiler.audioStarted && written > 0) {
        methodProfiler.jit.methodTimingSamples.clear();
        methodProfiler.jvm.resetSchedulerTimings();
        methodProfiler.audioStarted = true;
        methodProfiler.startedAtFrame = written;
      }
      if (target > 0) {
        const progress = Math.min(1, written / target);
        els.progress.style.width = `${(progress * 100).toFixed(1)}%`;
        els.playbackText.textContent =
          `${clock(written / GUEST_SAMPLE_RATE)} / ${clock(target / GUEST_SAMPLE_RATE)}`;
      }
      if (now >= nextProfileDisplayAt) {
        nextProfileDisplayAt = now + 1000;
        els.javaProfile.textContent = formatGuestProfile(
          guestDriverSnapshot(fields),
          snapshotGuestMethodProfile(methodProfiler));
      }
      if (written > 0 && now >= nextTelemetryAt) {
        nextTelemetryAt = now + TELEMETRY_INTERVAL_MS;
        sendAudioTelemetry("guest_mixer_progress", {
          track: {label: track.label, path: track.path},
          guest: guestDriverSnapshot(fields),
          methodProfile: snapshotGuestMethodProfile(methodProfiler),
          audio: audioDiagnosticsDelta(audioBefore, javaAudioDiagnostics()),
          manifest: state.javaManifest,
          instrumentation: instrumentationConfiguration(),
        });
      }
    }, 100);

    const runPromise = state.javaDebug.run(state.javaManifest.trackClassName, {
      args: [
        GUEST_TRACK_PATH,
        GUEST_BANK_PATH,
        String(expectedFrames),
      ],
    });
    // BrowserJVMDebug.run resets its JVM synchronously before its first await.
    // Attach profiling to that new run-specific JVM, not the discarded loader
    // JVM that existed before run() was called.
    methodProfiler = beginGuestMethodProfile();
    await runPromise;
    const fields = classStaticFields(state.javaManifest.trackClassName);
    if (!fields) throw new Error("Java soundtrack player fields were not published");
    const result = {
      ...guestDriverSnapshot(fields),
      sampleRate: GUEST_SAMPLE_RATE,
      uiStallMs: eventLoop.stop(),
      preparationMs,
      methodProfile: snapshotGuestMethodProfile(methodProfiler),
      instrumentation: instrumentationConfiguration(),
    };
    const audioAfter = javaAudioDiagnostics();
    Object.assign(result, audioDiagnosticsDelta(audioBefore, audioAfter));
    result.analysis = analyzeGuestResult(result);

    showJavaTrackResult(track, result);
    if (result.error || !result.done ||
        result.bridgeFrames !== result.writtenFrames) {
      throw new Error(
        `Guest mixer mismatch: error=${result.error}, done=${result.done}, ` +
        `Java=${result.writtenFrames} frames, bridge=${result.bridgeFrames}`);
    }
    return !result.stopped;
  } catch (error) {
    eventLoop.stop();
    const fields = state.javaManifest &&
      classStaticFields(state.javaManifest.trackClassName);
    sendAudioTelemetry("guest_mixer_error", {
      track: {label: track.label, path: track.path},
      message: String(error && (error.message || error) || error),
      stack: error && error.stack ? String(error.stack) : null,
      guest: fields ? guestDriverSnapshot(fields) : null,
      methodProfile: snapshotGuestMethodProfile(methodProfiler),
      audio: javaAudioDiagnostics(),
      manifest: state.javaManifest,
      instrumentation: instrumentationConfiguration(),
    });
    showError(error);
    return false;
  } finally {
    if (progressTimer) clearInterval(progressTimer);
    endGuestMethodProfile(methodProfiler);
    state.javaDebug.fileProvider.virtualFS.delete(GUEST_TRACK_PATH);
    state.javaTrackBusy = false;
    state.busy = false;
    setControls(false);
  }
}

function showJavaTrackResult(track, result) {
  const duration = result.writtenFrames / result.sampleRate;
  const synthesisMs = result.mixMs + result.convertMs;
  els.renderTime.textContent = formatMs(result.mixMs);
  els.audioDuration.textContent = formatSeconds(duration);
  els.realtimeFactor.textContent =
    `${(duration / (synthesisMs / 1000)).toFixed(2)}×`;
  els.eventLoopDelay.textContent = `${result.uiStallMs.toFixed(1)} ms`;
  els.bufferTime.textContent = formatMs(result.writeMs);
  els.checksum.textContent =
    (result.checksum >>> 0).toString(16).padStart(8, "0");
  els.sampleCount.textContent = result.writtenFrames.toLocaleString();
  els.sampleRate.textContent = `${result.sampleRate.toLocaleString()} Hz`;
  els.peak.textContent = "measured by bridge";
  els.rms.textContent = "—";
  els.nonZero.textContent = "see WebAudio sampling";
  els.javaGeneration.textContent = formatMs(result.mixMs);
  els.javaWrite.textContent = formatMs(result.writeMs);
  els.javaWait.textContent = formatMs(result.waitMs);
  els.javaPush.textContent = formatMs(result.pushMs);
  els.javaUiStall.textContent = `${result.uiStallMs.toFixed(1)} ms`;
  els.javaUnderruns.textContent = result.underruns.toLocaleString();
  els.javaUnderrunTime.textContent =
    `${(result.underrunSeconds * 1000).toFixed(1)} ms of gaps`;
  els.progress.style.width =
    `${Math.min(100, result.writtenFrames * 100 / result.targetFrames).toFixed(1)}%`;
  setJavaStatus(
    `${track.label} · guest bank ${formatMs(result.bankLoadMs)} · ` +
    `track parse ${formatMs(result.trackLoadMs)} · PCM conversion ${formatMs(result.convertMs)} · ` +
    `deadline misses ${result.chunkProfile.deadlineMisses}/${result.chunkProfile.chunks} · ` +
    `${result.writes.toLocaleString()} Java writes · ${result.writtenBytes.toLocaleString()} bytes · ` +
    `drain ${formatMs(result.drainMs)} · ` +
    `${result.stopped ? "stopped" : "complete"}`);
  setStatus(
    result.stopped
      ? `${track.label} stopped after ${formatSeconds(result.writtenFrames / result.sampleRate)}.`
      : `${track.label} was mixed completely inside guest Java and played through SourceDataLine.`);
  els.javaProfile.textContent =
    formatGuestProfile(result, result.methodProfile);
  sendAudioTelemetry("guest_mixer_result", {
    track: {
      label: track.label,
      path: track.path,
    },
    result,
    manifest: state.javaManifest,
    audio: javaAudioDiagnostics(),
    instrumentation: instrumentationConfiguration(),
  });
}

function guestDriverSnapshot(fields) {
  const millis = name => javaField(fields, name, "J") / 1e6;
  const integer = name => javaField(fields, name, "I") | 0;
  const chunks = integer("profiledChunks");
  const warmupChunks = integer("warmupChunks");
  const steadyChunks = integer("steadyChunks");
  const warmupPipelineMs = millis("warmupPipelineNanos");
  const steadyPipelineMs = millis("steadyPipelineNanos");
  return {
    bankLoadMs: millis("bankLoadNanos"),
    trackLoadMs: millis("trackLoadNanos"),
    mixMs: millis("mixNanos"),
    convertMs: millis("convertNanos"),
    writeMs: millis("writeNanos"),
    waitMs: millis("waitNanos"),
    pushMs: millis("pushNanos"),
    drainMs: millis("drainNanos"),
    targetFrames: integer("targetFrames"),
    writtenFrames: integer("writtenFrames"),
    writtenBytes: integer("writtenBytes"),
    writes: integer("writes"),
    blockedPolls: integer("blockedPolls"),
    checksum: integer("checksum"),
    stopped: integer("stopRequested") !== 0,
    error: integer("error"),
    done: integer("done") !== 0,
    chunkProfile: {
      chunks,
      deadlineMs: millis("chunkDeadlineNanos"),
      deadlineMisses: integer("deadlineMisses"),
      currentDeadlineMissStreak: integer("currentDeadlineMissStreak"),
      longestDeadlineMissStreak: integer("longestDeadlineMissStreak"),
      worstDeadlineOverrunMs: millis("worstDeadlineOverrunNanos"),
      maxMs: {
        mix: millis("mixMaxNanos"),
        convert: millis("convertMaxNanos"),
        write: millis("writeMaxNanos"),
        wait: millis("waitMaxNanos"),
        pipeline: millis("pipelineMaxNanos"),
      },
      warmup: {
        chunks: warmupChunks,
        totalMs: warmupPipelineMs,
        averageMs: warmupChunks ? warmupPipelineMs / warmupChunks : 0,
      },
      steady: {
        chunks: steadyChunks,
        totalMs: steadyPipelineMs,
        averageMs: steadyChunks ? steadyPipelineMs / steadyChunks : 0,
      },
      histogram: {
        le5Ms: integer("pipelineLe5Ms"),
        le10Ms: integer("pipelineLe10Ms"),
        le15Ms: integer("pipelineLe15Ms"),
        le20Ms: integer("pipelineLe20Ms"),
        withinDeadline: integer("pipelineWithinDeadline"),
        le30Ms: integer("pipelineLe30Ms"),
        le50Ms: integer("pipelineLe50Ms"),
        over50Ms: integer("pipelineOver50Ms"),
      },
    },
  };
}

function audioDiagnosticsDelta(before, after) {
  return {
    underruns: Math.max(
      0, (after.underruns || 0) - (before.underruns || 0)),
    underrunSeconds: Math.max(
      0, (after.underrunSeconds || 0) -
        (before.underrunSeconds || 0)),
    bridgeFrames: Math.max(
      0, (after.writtenFrames || 0) - (before.writtenFrames || 0)),
  };
}

function analyzeGuestResult(result) {
  const audioSeconds = result.writtenFrames / GUEST_SAMPLE_RATE;
  const pipelineMs = result.mixMs + result.convertMs + result.writeMs;
  const chunks = result.chunkProfile.chunks;
  return {
    audioSeconds,
    pipelineMs,
    averagePipelineMs: chunks ? pipelineMs / chunks : 0,
    pipelineRealtimeFactor:
      pipelineMs > 0 ? audioSeconds / (pipelineMs / 1000) : 0,
    endToEndRealtimeFactor:
      result.pushMs > 0 ? audioSeconds / (result.pushMs / 1000) : 0,
    deadlineMissPercent: chunks
      ? result.chunkProfile.deadlineMisses * 100 / chunks : 0,
  };
}

function formatGuestProfile(guest, methodProfile) {
  if (!guest || !guest.chunkProfile) {
    return "Waiting for guest mixer profile data…";
  }
  const profile = guest.chunkProfile;
  const histogram = profile.histogram;
  const lines = [
    `Chunk deadline: ${profile.deadlineMs.toFixed(2)} ms · ` +
      `${profile.deadlineMisses}/${profile.chunks} misses ` +
      `(${profile.chunks ? (profile.deadlineMisses * 100 / profile.chunks).toFixed(1) : "0.0"}%) · ` +
      `longest miss streak ${profile.longestDeadlineMissStreak}`,
    `Maximum: pipeline ${profile.maxMs.pipeline.toFixed(1)} ms · ` +
      `mix ${profile.maxMs.mix.toFixed(1)} · convert ${profile.maxMs.convert.toFixed(1)} · ` +
      `write ${profile.maxMs.write.toFixed(1)} · wait ${profile.maxMs.wait.toFixed(1)}`,
    `Warmup: ${profile.warmup.chunks} chunks @ ${profile.warmup.averageMs.toFixed(2)} ms · ` +
      `steady: ${profile.steady.chunks} chunks @ ${profile.steady.averageMs.toFixed(2)} ms`,
    `Pipeline histogram: ≤5 ${histogram.le5Ms} · ≤10 ${histogram.le10Ms} · ` +
      `≤15 ${histogram.le15Ms} · ≤20 ${histogram.le20Ms} · ` +
      `≤deadline ${histogram.withinDeadline} · ≤30 ${histogram.le30Ms} · ` +
      `≤50 ${histogram.le50Ms} · >50 ${histogram.over50Ms}`,
  ];
  if (methodProfile && methodProfile.enabled) {
    lines.push(
      `Sampled scheduler ownership (1/${methodProfile.schedulerRate}; estimated synchronous time):`);
    if (!methodProfile.schedulerRows.length) {
      lines.push("  no scheduler samples yet");
    } else {
      for (const row of methodProfile.schedulerRows.slice(0, 12)) {
        lines.push(
          `  ${row.estimatedTotalMs.toFixed(1).padStart(9)} ms · ` +
          `${String(row.samples).padStart(5)} samples · ${row.method}`);
      }
    }
    lines.push(
      `Sampled generated-method timings (1/${methodProfile.sampleRate}; inclusive estimates):`);
    if (!methodProfile.rows.length) {
      lines.push("  no generated method samples yet");
    } else {
      for (const row of methodProfile.rows.slice(0, 12)) {
        lines.push(
          `  ${row.estimatedTotalMs.toFixed(1).padStart(9)} ms · ` +
          `${String(row.samples).padStart(5)} samples · ${row.tier} · ${row.method}`);
      }
    }
  } else {
    lines.push("Generated-method sampling disabled with ?profile=0.");
  }
  return lines.join("\n");
}

function trackBinaryUrl(track) {
  return `${DATA_ROOT}/${String(track.path).split("/").map(encodeURIComponent).join("/")}`;
}

function estimateTrackFrames(track) {
  const events = Array.isArray(track.events) ? track.events : [];
  const maxEventRow = events.reduce(
    (max, event) => Math.max(max, Number(event.absoluteRow) || 0), 0);
  const rows = Math.max(1, Number(track.maxRow ?? maxEventRow) + 1);
  const rowSamples = Math.max(
    1, Math.trunc((GUEST_SAMPLE_RATE * 640) / ((Number(track.m) || 144) * 256)));
  const ticksPerRow = Math.max(1, Number(track.k) || 1);
  return rows * rowSamples * ticksPerRow;
}

async function performRender(track, options) {
  if (!track) return false;
  state.busy = true;
  setControls(true);
  els.progress.style.width = "0%";
  setStatus(`Rendering ${track.label} with the ${engineLabel()}…`, "active");
  const monitor = startEventLoopMonitor();
  try {
    const cacheKey = `${els.engineSelect.value}:${track.index}`;
    let result = state.cache.get(cacheKey);
    if (!result) {
      result = els.engineSelect.value === "worker"
        ? await renderInWorker(track)
        : await renderOnMainThread(track);
      result.eventLoopDelayMs = monitor.stop();
      remember(cacheKey, result);
      addHistory(track, result);
    } else {
      result = {...result, cached: true, eventLoopDelayMs: monitor.stop()};
    }
    state.currentPcm = result.pcm;
    showResult(result);
    els.progress.style.width = "100%";
    if (state.stopped) {
      setStatus(`${track.label} finished rendering; playback was cancelled.`);
      return false;
    }
    if (options.play) {
      const bufferMs = await playPcm(result.pcm, result.sampleRate, track.label);
      result.bufferMs = bufferMs;
      showResult(result);
      setStatus(`${track.label} is playing. PCM synthesis took ${formatMs(result.renderMs)} (${formatFactor(result)}).`, "active");
    } else {
      setStatus(`${track.label}: ${formatSeconds(result.pcm.length / result.sampleRate)} rendered in ${formatMs(result.renderMs)} (${formatFactor(result)}).`);
    }
    return true;
  } catch (error) {
    monitor.stop();
    showError(error);
    return false;
  } finally {
    state.busy = false;
    setControls(false);
  }
}

async function renderInWorker(track) {
  await ensureWorker();
  const requestId = ++state.requestSequence;
  return new Promise((resolve, reject) => {
    state.workerRequests.set(requestId, { resolve, reject, track });
    state.worker.postMessage({ type: "render", requestId, trackUrl: track.jsonUrl });
  });
}

async function ensureWorker() {
  if (state.workerReady) return state.workerReady;
  state.worker = new Worker("./renderer-worker.js", { type: "module" });
  state.workerReady = new Promise((resolve, reject) => {
    const fail = event => reject(new Error(event.message || "PCM worker failed to start"));
    state.worker.addEventListener("error", fail, { once: true });
    state.worker.addEventListener("message", event => {
      const message = event.data;
      if (message.type === "ready") {
        els.bankLoad.textContent = `${formatMs(message.bankLoadMs)} (Worker)`;
        resolve(message);
      } else if (message.type === "progress") {
        const request = state.workerRequests.get(message.requestId);
        if (request) {
          els.progress.style.width = `${Math.round(message.progress * 100)}%`;
          setStatus(`Rendering ${request.track.label}: ${Math.round(message.progress * 100)}%`, "active");
        }
      } else if (message.type === "rendered") {
        const request = state.workerRequests.get(message.requestId);
        if (!request) return;
        state.workerRequests.delete(message.requestId);
        request.resolve({
          pcm: new Float32Array(message.pcm),
          renderMs: message.renderMs,
          fetchMs: message.fetchMs,
          bankLoadMs: message.bankLoadMs,
          sampleRate: message.sampleRate,
          stats: message.stats,
          engine: "Worker",
          bufferMs: null,
        });
      } else if (message.type === "error") {
        const request = state.workerRequests.get(message.requestId);
        if (request) {
          state.workerRequests.delete(message.requestId);
          request.reject(new Error(message.message));
        } else {
          reject(new Error(message.message));
        }
      }
    });
  });
  state.worker.postMessage({ type: "init", bankUrl: `${DATA_ROOT}/json/sample-bank.json` });
  return state.workerReady;
}

async function renderOnMainThread(track) {
  if (!state.mainBank) {
    const startedAt = performance.now();
    const response = await fetch(`${DATA_ROOT}/json/sample-bank.json`);
    if (!response.ok) throw new Error(`sample bank request failed: HTTP ${response.status}`);
    state.mainBank = hydrateSampleBank(await response.json());
    state.mainBankLoadMs = performance.now() - startedAt;
    els.bankLoad.textContent = `${formatMs(state.mainBankLoadMs)} (main)`;
  }
  const fetchStartedAt = performance.now();
  const response = await fetch(track.jsonUrl);
  if (!response.ok) throw new Error(`track request failed: HTTP ${response.status}`);
  const descriptor = await response.json();
  const fetchMs = performance.now() - fetchStartedAt;
  const renderStartedAt = performance.now();
  const pcm = await renderTrack(descriptor, state.mainBank, progress => {
    els.progress.style.width = `${Math.round(progress * 100)}%`;
    setStatus(`Rendering ${track.label}: ${Math.round(progress * 100)}%`, "active");
  });
  const renderMs = performance.now() - renderStartedAt;
  return {
    pcm,
    renderMs,
    fetchMs,
    bankLoadMs: state.mainBankLoadMs,
    sampleRate: state.mainBank.sampleRate,
    stats: inspectPcm(pcm),
    engine: "Main thread",
    bufferMs: null,
  };
}

async function ensureAudioContext() {
  if (!state.context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error("This browser has no Web Audio API");
    state.context = new AudioContext();
  }
  if (state.context.state !== "running") await state.context.resume();
  showContext();
  return state.context;
}

async function playPcm(pcm, sampleRate, label) {
  const context = await ensureAudioContext();
  stopAudioSource();
  const startedAt = performance.now();
  const buffer = context.createBuffer(1, pcm.length, sampleRate);
  buffer.copyToChannel(pcm, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  state.source = source;
  state.playbackStartedAt = context.currentTime;
  state.playbackDuration = buffer.duration;
  source.start();
  source.addEventListener("ended", () => {
    if (state.source === source) state.source = null;
  }, { once: true });
  updatePlaybackClock(label);
  return performance.now() - startedAt;
}

function waitForPlaybackEnd() {
  const source = state.source;
  if (!source) return Promise.resolve();
  return new Promise(resolve => source.addEventListener("ended", resolve, { once: true }));
}

function stopEverything() {
  state.stopped = true;
  state.playlist = false;
  const trackFields = state.javaManifest &&
    classStaticFields(state.javaManifest.trackClassName);
  if (trackFields) {
    trackFields.set("stopRequested:I", 1);
  }
  stopAudioSource();
  setStatus("Stopped.");
}

function stopAudioSource() {
  if (state.source) {
    try { state.source.stop(); } catch {}
    try { state.source.disconnect(); } catch {}
    state.source = null;
  }
  cancelAnimationFrame(state.playbackAnimation);
  els.playbackText.textContent = "00:00 / 00:00";
}

function updatePlaybackClock(label) {
  cancelAnimationFrame(state.playbackAnimation);
  const update = () => {
    if (!state.source || !state.context) return;
    const elapsed = Math.min(state.playbackDuration, state.context.currentTime - state.playbackStartedAt);
    els.playbackText.textContent = `${clock(elapsed)} / ${clock(state.playbackDuration)}`;
    document.title = `${clock(elapsed)} · ${label}`;
    state.playbackAnimation = requestAnimationFrame(update);
  };
  update();
}

function startEventLoopMonitor() {
  const interval = 50;
  let expected = performance.now() + interval;
  let worst = 0;
  let stopped = false;
  const timer = setInterval(() => {
    const now = performance.now();
    worst = Math.max(worst, now - expected);
    expected = now + interval;
  }, interval);
  return {
    stop() {
      if (!stopped) {
        stopped = true;
        clearInterval(timer);
      }
      return worst;
    },
  };
}

function inspectPcm(pcm) {
  let peak = 0;
  let squares = 0;
  let nonZero = 0;
  let checksum = 0x811c9dc5;
  const bits = new Uint32Array(pcm.buffer, pcm.byteOffset, pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    const sample = pcm[i];
    peak = Math.max(peak, Math.abs(sample));
    squares += sample * sample;
    if (Math.abs(sample) > 1e-7) nonZero++;
    checksum ^= bits[i];
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return {
    peak,
    rms: pcm.length ? Math.sqrt(squares / pcm.length) : 0,
    nonZero,
    checksum: checksum.toString(16).padStart(8, "0"),
  };
}

function remember(key, result) {
  state.cache.set(key, result);
  while (state.cache.size > 3) state.cache.delete(state.cache.keys().next().value);
}

function showResult(result) {
  const duration = result.pcm.length / result.sampleRate;
  els.renderTime.textContent = formatMs(result.renderMs);
  els.audioDuration.textContent = formatSeconds(duration);
  els.realtimeFactor.textContent = `${(duration / (result.renderMs / 1000)).toFixed(1)}×`;
  els.eventLoopDelay.textContent = `${result.eventLoopDelayMs.toFixed(1)} ms`;
  els.bufferTime.textContent = result.bufferMs == null ? "not copied" : formatMs(result.bufferMs);
  els.checksum.textContent = result.stats.checksum;
  els.sampleCount.textContent = result.pcm.length.toLocaleString();
  els.sampleRate.textContent = `${result.sampleRate.toLocaleString()} Hz`;
  els.peak.textContent = result.stats.peak.toFixed(6);
  els.rms.textContent = result.stats.rms.toFixed(6);
  els.nonZero.textContent = `${result.stats.nonZero.toLocaleString()} (${(result.stats.nonZero * 100 / result.pcm.length).toFixed(1)}%)`;
  els.bankLoad.textContent = `${formatMs(result.bankLoadMs)} (${result.engine})`;
}

function showContext() {
  if (!state.context) return;
  els.contextState.textContent = state.context.state;
  els.outputRate.textContent = `${state.context.sampleRate.toLocaleString()} Hz`;
  els.baseLatency.textContent = Number.isFinite(state.context.baseLatency)
    ? `${(state.context.baseLatency * 1000).toFixed(2)} ms` : "unreported";
  els.outputLatency.textContent = Number.isFinite(state.context.outputLatency)
    ? `${(state.context.outputLatency * 1000).toFixed(2)} ms` : "unreported";
}

function addHistory(track, result) {
  state.history.unshift({ track, result });
  state.history.length = Math.min(state.history.length, 20);
  els.historyBody.replaceChildren(...state.history.map(({track: item, result: row}) => {
    const duration = row.pcm.length / row.sampleRate;
    const tr = document.createElement("tr");
    for (const value of [
      item.label,
      row.engine,
      formatMs(row.renderMs),
      formatSeconds(duration),
      `${(duration / (row.renderMs / 1000)).toFixed(1)}×`,
      `${row.eventLoopDelayMs.toFixed(1)} ms`,
      row.stats.checksum,
    ]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    return tr;
  }));
}

function classStaticFields(className) {
  return state.javaDebug &&
    state.javaDebug.debugController &&
    state.javaDebug.debugController.jvm &&
    state.javaDebug.debugController.jvm.classes &&
    state.javaDebug.debugController.jvm.classes[className] &&
    state.javaDebug.debugController.jvm.classes[className].staticFields;
}

function javaField(fields, name, descriptor) {
  const value = fields.get(`${name}:${descriptor}`);
  return typeof value === "bigint" ? Number(value) : Number(value || 0);
}

function javaAudioDiagnostics() {
  return window.JVMDebug &&
    JVMDebug.audioPlatform &&
    typeof JVMDebug.audioPlatform.getWebAudioDiagnostics === "function"
    ? JVMDebug.audioPlatform.getWebAudioDiagnostics()
    : {};
}

function instrumentationConfiguration() {
  return {
    chunkLatency: true,
    progressTelemetryIntervalMs: TELEMETRY_INTERVAL_MS,
    generatedMethodSampling: METHOD_TIMING_ENABLED,
    generatedMethodSampleRate:
      METHOD_TIMING_ENABLED ? METHOD_TIMING_SAMPLE_RATE : 0,
    schedulerSampleRate:
      METHOD_TIMING_ENABLED ? SCHEDULER_TIMING_SAMPLE_RATE : 0,
    note: "Scheduler estimates attribute execution slices; generated-method estimates are inclusive and may overlap.",
  };
}

function beginGuestMethodProfile() {
  const jvm = state.javaDebug &&
    state.javaDebug.debugController &&
    state.javaDebug.debugController.jvm;
  const jit = jvm && jvm.jit;
  if (!jit || !METHOD_TIMING_ENABLED) return null;
  const profile = {
    jvm,
    jit,
    previousEnabled: jit.profileTimings,
    previousRate: jit.methodTimingSampleRate,
    previousFilter: jit.methodTimingFilter,
    previousSchedulerProfile: jvm._schedulerTimingProfile,
    audioStarted: false,
    startedAtFrame: 0,
  };
  jit.profileTimings = true;
  jit.methodTimingSampleRate = METHOD_TIMING_SAMPLE_RATE;
  jit.methodTimingFilter = null;
  jit.methodTimingSamples.clear();
  if (typeof jvm.configureSchedulerTimings === "function") {
    jvm.configureSchedulerTimings(SCHEDULER_TIMING_SAMPLE_RATE);
  }
  return profile;
}

function snapshotGuestMethodProfile(profile) {
  if (!profile) {
    return {
      enabled: false,
      sampleRate: 0,
      scope: "disabled",
      startedAtFrame: 0,
      rows: [],
      schedulerRows: [],
    };
  }
  const rate = profile.jit.methodTimingSampleRate;
  const rows = [...profile.jit.methodTimingSamples.entries()]
    .map(([method, value]) => ({
      method,
      tier: value.tier,
      samples: value.samples,
      sampledTotalMs: value.totalMs,
      sampledMaxMs: value.maxMs,
      estimatedTotalMs: value.totalMs * rate,
    }))
    .sort((left, right) =>
      right.estimatedTotalMs - left.estimatedTotalMs)
    .slice(0, 30);
  const scheduler = profile.jvm.getSchedulerTimingSnapshot(30);
  const schedulerRows = scheduler
    ? scheduler.rows.map(row => ({
      ...row,
      estimatedTotalMs: row.synchronousMs * scheduler.rate,
      estimatedAsyncWaitMs: row.asyncWaitMs * scheduler.rate,
    })).sort((left, right) =>
      right.estimatedTotalMs - left.estimatedTotalMs)
    : [];
  return {
    enabled: true,
    sampleRate: rate,
    scope: profile.audioStarted
      ? "audio_after_first_scheduler_yield"
      : "guest_run_including_preparation",
    startedAtFrame: profile.startedAtFrame,
    rows,
    schedulerRate: scheduler ? scheduler.rate : 0,
    schedulerRows,
  };
}

function endGuestMethodProfile(profile) {
  if (!profile) return;
  profile.jit.profileTimings = profile.previousEnabled;
  profile.jit.methodTimingSampleRate = profile.previousRate;
  profile.jit.methodTimingFilter = profile.previousFilter;
  profile.jvm._schedulerTimingProfile = profile.previousSchedulerProfile;
}

function setJavaStatus(message, kind = "") {
  els.javaStatus.textContent = message;
  els.javaStatus.dataset.kind = kind;
}

function showJavaError(error) {
  console.error(error);
  setJavaStatus(String(error && (error.message || error) || error), "error");
  sendAudioTelemetry("guest_mixer_error", {
    message: String(error && (error.message || error) || error),
    stack: error && error.stack ? String(error.stack) : null,
    manifest: state.javaManifest,
    audio: javaAudioDiagnostics(),
  });
}

function createSessionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function sendAudioTelemetry(event, details) {
  const payload = {
    session: state.telemetrySession,
    event,
    pageElapsedMs: Math.round(performance.now()),
    details,
  };
  fetch("/api/audio-diagnostics", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(error => {
    console.warn("Audio diagnostics telemetry failed:", error);
  });
}

function loadScript(src) {
  const existing = document.querySelector(`script[data-diagnostic-src="${src}"]`);
  if (existing) return existing._loadedPromise;
  const script = document.createElement("script");
  script.src = src;
  script.dataset.diagnosticSrc = src;
  script._loadedPromise = new Promise((resolve, reject) => {
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(
      new Error(`failed to load ${src}`)), { once: true });
  });
  document.head.append(script);
  return script._loadedPromise;
}

async function checkedResponse(response) {
  if (!response.ok) throw new Error(`${response.url}: HTTP ${response.status}`);
  return response;
}

async function checkedJson(response) {
  return (await checkedResponse(response)).json();
}

function shortHash(value) {
  return String(value || "unknown").slice(0, 12);
}

function setControls(busy) {
  els.playButton.disabled = busy || !state.tracks.length || !state.javaDebug;
  els.playlistButton.disabled = busy || !state.tracks.length || !state.javaDebug;
  els.benchmarkButton.disabled = busy || !state.tracks.length;
  els.trackSelect.disabled = busy || !state.tracks.length;
  els.engineSelect.disabled = busy;
  els.stopButton.disabled = false;
}

function setStatus(message, kind = "") {
  els.statusText.textContent = message;
  els.statusText.dataset.kind = kind;
}

function showError(error) {
  console.error(error);
  setStatus(String(error && (error.message || error) || error), "error");
  state.busy = false;
  setControls(false);
}

function engineLabel() {
  return els.engineSelect.value === "worker" ? "Web Worker" : "main thread";
}

function formatFactor(result) {
  const seconds = result.pcm.length / result.sampleRate;
  return `${(seconds / (result.renderMs / 1000)).toFixed(1)}× real time`;
}

function formatMs(value) {
  if (!Number.isFinite(value)) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value.toFixed(1)} ms`;
}

function formatSeconds(value) {
  return `${value.toFixed(2)} s`;
}

function clock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}
