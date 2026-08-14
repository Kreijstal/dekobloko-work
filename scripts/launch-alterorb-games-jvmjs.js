#!/usr/bin/env node
'use strict';

// Data-driven AlterOrb smoke launcher for the generic java-tools JVM.
//
// The JVM remains unaware of AlterOrb and individual games. This adapter reads
// AlterOrb's public config, supplies each applet's entry class and parameters,
// and reports whether it produces a nonblank game-sized software surface.

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');
const os = require('os');
const path = require('path');
const {execFileSync, spawn} = require('child_process');
const {hashClassTree} = require('./pipeline-cache-provenance');

const ROOT = path.resolve(__dirname, '..');
const JAVA_TOOLS_DIR = process.env.JAVA_TOOLS_DIR ||
  path.join(os.homedir(), 'git', 'java-tools');
const CONFIG_URL = 'https://static.alterorb.net/launcher/v3/config.json';
const REMOTE_TCP_PORT = 43594;
const TCP_PORT = Number(process.env.ALTERORB_JVMJS_TCP_PORT || REMOTE_TCP_PORT);
const HTTP_PROXY_PORT = Number(
  process.env.ALTERORB_JVMJS_HTTP_PROXY_PORT || 18080,
);
const RESULT_PREFIX = 'ALTERORB_JVMJS_RESULT ';

function parseArgs(argv) {
  const options = {
    games: [],
    jobs: Math.max(1, Math.min(4, os.cpus().length)),
    timeoutMs: 180000,
    report: path.join(ROOT, '.work', 'alterorb-jvmjs', 'report.json'),
    configUrl: CONFIG_URL,
    until: 'first-frame',
    noJit: false,
    recompiled: false,
    measureFpsMs: 0,
    minFps: 30,
    profileJit: false,
    cpuProfile: false,
    jarOverride: null,
    classesOverride: null,
    menuAdvanceClick: null,
    menuSceneTransitions: 1,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--game') options.games.push(argv[++index]);
    else if (arg === '--jobs') options.jobs = Number(argv[++index]);
    else if (arg === '--timeout-ms') options.timeoutMs = Number(argv[++index]);
    else if (arg === '--report') options.report = path.resolve(argv[++index]);
    else if (arg === '--config-url') options.configUrl = argv[++index];
    else if (arg === '--until-main-menu') options.until = 'main-menu';
    else if (arg === '--no-jit') options.noJit = true;
    else if (arg === '--recompiled') options.recompiled = true;
    else if (arg === '--measure-fps-ms') {
      options.measureFpsMs = Number(argv[++index]);
      options.until = 'main-menu';
    } else if (arg === '--min-fps') {
      options.minFps = Number(argv[++index]);
    } else if (arg === '--profile-jit') options.profileJit = true;
    else if (arg === '--cpu-profile') options.cpuProfile = true;
    else if (arg === '--jar') options.jarOverride = path.resolve(argv[++index]);
    else if (arg === '--classes-dir') {
      options.classesOverride = path.resolve(argv[++index]);
      options.recompiled = true;
    }
    else if (arg === '--menu-advance-click') {
      const coordinates = String(argv[++index] || '').split(',').map(Number);
      if (coordinates.length !== 2 || coordinates.some(value =>
        !Number.isInteger(value) || value < 0)) {
        throw new Error('--menu-advance-click must be non-negative X,Y integers');
      }
      options.menuAdvanceClick = {x: coordinates[0], y: coordinates[1]};
      options.until = 'main-menu';
    } else if (arg === '--menu-scene-transitions') {
      options.menuSceneTransitions = Number(argv[++index]);
      if (!Number.isInteger(options.menuSceneTransitions) ||
          options.menuSceneTransitions < 0) {
        throw new Error('--menu-scene-transitions must be a non-negative integer');
      }
      options.until = 'main-menu';
    }
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/launch-alterorb-games-jvmjs.js ' +
        '[--game internalName] [--jobs N] [--timeout-ms N] [--report file] ' +
        '[--until-main-menu] [--measure-fps-ms N] [--min-fps N] ' +
        '[--profile-jit] [--cpu-profile] [--no-jit] [--recompiled] ' +
        '[--classes-dir directory] ' +
        '[--menu-advance-click X,Y] [--menu-scene-transitions N] ' +
        '[--jar diagnostic.jar]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isInteger(options.jobs) || options.jobs < 1) {
    throw new Error('--jobs must be a positive integer');
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000) {
    throw new Error('--timeout-ms must be at least 1000');
  }
  if (!Number.isFinite(options.measureFpsMs) || options.measureFpsMs < 0) {
    throw new Error('--measure-fps-ms must be zero or a positive number');
  }
  if (!Number.isFinite(options.minFps) || options.minFps < 0) {
    throw new Error('--min-fps must be zero or a positive number');
  }
  return options;
}

function classifyMenuSurface(surface, seenFrameCount) {
  if (!surface) return {dense: false, sparse: false, advanceable: false};
  // Full-screen narrative/cinematic frames can be spatially dense but use a
  // tiny palette. Requiring richer color variation keeps them from satisfying
  // the menu checkpoint. Sparse menus (for example Escape Vector) retain their
  // own bounded-area rule.
  const dense = surface.nonblankSamples >= 2500 &&
    surface.uniqueSampleColors >= 96;
  const sparse = surface.nonblankSamples >= 800 &&
    surface.nonblankSamples < 2500 &&
    surface.uniqueSampleColors >= 32 &&
    seenFrameCount >= 10;
  const advanceable = surface.nonblankSamples >= 2500 &&
    surface.uniqueSampleColors >= 24 &&
    seenFrameCount >= 10;
  return {dense, sparse, advanceable};
}

function isPostLogoLoadingSurface(surface, seenFrameCount) {
  if (!surface || seenFrameCount < 10) return false;
  // FunOrb's common animated Jagex logo is a sequence of small, rapidly
  // changing surfaces.  Once it finishes, the archive/loading panel paints a
  // materially larger but still sparse surface.  Keep this purely visual so
  // the runner does not need guest class, method, field, or game identities.
  return surface.nonblankSamples >= 300 &&
    surface.nonblankSamples < 800 &&
    surface.uniqueSampleColors >= 16;
}

function hasMenuAdvanceSettled(dispatchedAt, frameCountAtDispatch,
  currentFrameCount) {
  return dispatchedAt === null || (
    Number.isInteger(frameCountAtDispatch) &&
    currentFrameCount >= frameCountAtDispatch + 5
  );
}

function sceneDifference(left, right) {
  if (!left || !right || left.length !== right.length || left.length === 0) {
    return 1;
  }
  let changed = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) changed += 1;
  }
  return changed / left.length;
}

function shouldResetMenuCandidateOnSceneTransition(observedTransitions,
    requiredTransitions) {
  return observedTransitions < requiredTransitions;
}

function enqueueSyntheticMouseClick(jvm, x, y) {
  const components = [...(jvm._awtInputComponents?.get('mouse') || [])]
    .filter(component => component && component._visible !== false &&
      component._listeners?.mouse?.length);
  let callbacks = 0;
  for (const component of components) {
    const base = {
      type: 'java/awt/event/MouseEvent',
      source: component,
      component,
      when: Date.now(),
      modifiers: 16,
      x,
      y,
      button: 1,
      clickCount: 1,
      popupTrigger: false,
      consumed: false,
      fields: {},
    };
    for (const listener of component._listeners.mouse) {
      for (const [methodName, id] of [
        ['mousePressed', 501], ['mouseReleased', 502], ['mouseClicked', 500],
      ]) {
        jvm.enqueueAwtEventInvocation(listener, methodName,
          '(Ljava/awt/event/MouseEvent;)V', {...base, id});
        callbacks += 1;
      }
    }
  }
  return callbacks;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function gitTreeState(directory) {
  const commit = execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const status = execFileSync('git', [
    '-C', directory, 'status', '--porcelain', '--untracked-files=all',
  ], {encoding: 'utf8'});
  const trackedStatus = execFileSync('git', [
    '-C', directory, 'status', '--porcelain', '--untracked-files=no',
  ], {encoding: 'utf8'});
  return {
    path: directory,
    commit,
    dirty: status.trim().length > 0,
    trackedDirty: trackedStatus.trim().length > 0,
  };
}

function effectiveRuntimeGates(options, environment = process.env) {
  return {
    jitEnabled: !options.noJit,
    JVM_WASM_JIT: environment.JVM_WASM_JIT || '1',
    JVM_WASM_STRUCTURED: environment.JVM_WASM_STRUCTURED || '1',
    JVM_ENABLE_RENDERER_PIPELINE:
      environment.JVM_ENABLE_RENDERER_PIPELINE || '1',
    JVM_FAKE_TIME: environment.JVM_FAKE_TIME || '1000000000000',
    JVM_FAKE_TIME_REALTIME: environment.JVM_FAKE_TIME_REALTIME || '1',
    JVM_PROFILE_SCHEDULER_TIMES: options.profileJit
      ? (environment.JVM_PROFILE_SCHEDULER_TIMES || '64')
      : (environment.JVM_PROFILE_SCHEDULER_TIMES || ''),
    JVM_DEBUG_ARRAY_OOB: environment.JVM_DEBUG_ARRAY_OOB || '1',
    JVM_DISABLE_STRUCTURED_FIELD_ARRAY_LOCAL_VIEWS:
      environment.JVM_DISABLE_STRUCTURED_FIELD_ARRAY_LOCAL_VIEWS || '',
    JVM_ENABLE_STRUCTURED_LOOP_STATIC_ARRAY_VIEWS:
      environment.JVM_ENABLE_STRUCTURED_LOOP_STATIC_ARRAY_VIEWS || '',
    JVM_ENABLE_STRUCTURED_PRODUCED_ARRAY_LOCAL_VIEWS:
      environment.JVM_ENABLE_STRUCTURED_PRODUCED_ARRAY_LOCAL_VIEWS || '',
    JVM_DISABLE_STRUCTURED_INDIRECT_ARRAY_RANGES:
      environment.JVM_DISABLE_STRUCTURED_INDIRECT_ARRAY_RANGES || '',
    JVM_DISABLE_STRUCTURED_UNSAFE_CONSTRUCTOR_CALLERS:
      environment.JVM_DISABLE_STRUCTURED_UNSAFE_CONSTRUCTOR_CALLERS || '',
    JVM_ENABLE_COMPILED_CALL_CHAINS:
      environment.JVM_ENABLE_COMPILED_CALL_CHAINS || '',
    JVM_ENABLE_HOT_CALL_GRAPH_REGIONS:
      environment.JVM_ENABLE_HOT_CALL_GRAPH_REGIONS || '',
    JVM_ENABLE_GRAPH_OWNED_STRUCTURED_CANDIDATES:
      environment.JVM_ENABLE_GRAPH_OWNED_STRUCTURED_CANDIDATES || '',
    JVM_ENABLE_FRAME_POSITIONAL_CALLS:
      environment.JVM_ENABLE_FRAME_POSITIONAL_CALLS || '',
    JVM_PROFILE_HOT_CALL_GRAPH_REGIONS:
      environment.JVM_PROFILE_HOT_CALL_GRAPH_REGIONS || '',
    JVM_TRACE_HOT_CALL_GRAPH_DEOPTS:
      environment.JVM_TRACE_HOT_CALL_GRAPH_DEOPTS || '',
    JVM_TRACE_HOT_CALL_GRAPH_SOURCE:
      environment.JVM_TRACE_HOT_CALL_GRAPH_SOURCE || '',
    JVM_HOT_CALL_GRAPH_MIN_ROOT_CODE_ITEMS:
      environment.JVM_HOT_CALL_GRAPH_MIN_ROOT_CODE_ITEMS || '',
    JVM_HOT_CALL_GRAPH_MAX_ROOT_CODE_ITEMS:
      environment.JVM_HOT_CALL_GRAPH_MAX_ROOT_CODE_ITEMS || '',
    JVM_HOT_CALL_GRAPH_MAX_METHODS:
      environment.JVM_HOT_CALL_GRAPH_MAX_METHODS || '',
    JVM_HOT_CALL_GRAPH_MAX_CODE_ITEMS:
      environment.JVM_HOT_CALL_GRAPH_MAX_CODE_ITEMS || '',
    JVM_HOT_CALL_GRAPH_INLINE_CODE_ITEM_BUDGET:
      environment.JVM_HOT_CALL_GRAPH_INLINE_CODE_ITEM_BUDGET || '',
    JVM_HOT_CALL_GRAPH_MAX_INLINE_SITES_PER_TARGET:
      environment.JVM_HOT_CALL_GRAPH_MAX_INLINE_SITES_PER_TARGET || '',
    JVM_HOT_CALL_GRAPH_INLINE_SOURCE_BYTE_BUDGET:
      environment.JVM_HOT_CALL_GRAPH_INLINE_SOURCE_BYTE_BUDGET || '',
    JVM_HOT_CALL_GRAPH_DIRECT_SAFE_POINT_BUDGET:
      environment.JVM_HOT_CALL_GRAPH_DIRECT_SAFE_POINT_BUDGET || '',
    JVM_HOT_CALL_GRAPH_EXPANSION_ENTRY_THRESHOLD:
      environment.JVM_HOT_CALL_GRAPH_EXPANSION_ENTRY_THRESHOLD || '',
    JVM_HOT_CALL_GRAPH_EXPANSION_PROBE_INTERVAL:
      environment.JVM_HOT_CALL_GRAPH_EXPANSION_PROBE_INTERVAL || '',
    JVM_DISABLE_HOT_CALL_GRAPH_COMPACT_INTERNAL_CALLS:
      environment.JVM_DISABLE_HOT_CALL_GRAPH_COMPACT_INTERNAL_CALLS || '',
    JVM_ENABLE_STRUCTURED_RUN_COUNTERS:
      environment.JVM_ENABLE_STRUCTURED_RUN_COUNTERS || '',
    JVM_DISABLE_EAGER_MONOMORPHIC_CALLS:
      environment.JVM_DISABLE_EAGER_MONOMORPHIC_CALLS || '',
    JVM_EAGER_MONOMORPHIC_CALL_MAX_CODE_ITEMS:
      environment.JVM_EAGER_MONOMORPHIC_CALL_MAX_CODE_ITEMS || '',
    ALTERORB_JVMJS_TCP_PORT: String(TCP_PORT),
    ALTERORB_JVMJS_HTTP_PROXY_PORT: String(HTTP_PROXY_PORT),
  };
}

function collectRunProvenance(options) {
  const decompilationManifest = path.join(ROOT, '.work', 'games',
    'decompilation-provenance.json');
  return {
    launcher: {
      path: __filename,
      sha256: sha256(__filename),
    },
    repositories: {
      dekoblokoWork: gitTreeState(ROOT),
      javaTools: gitTreeState(JAVA_TOOLS_DIR),
    },
    decompilationManifest: fs.existsSync(decompilationManifest) ? {
      path: decompilationManifest,
      sha256: sha256(decompilationManifest),
      value: JSON.parse(fs.readFileSync(decompilationManifest, 'utf8')),
    } : null,
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      gates: effectiveRuntimeGates(options),
    },
  };
}

function gamepackPath(game) {
  return path.join(ROOT, '.work', 'gamepacks', `${game.internalName}.jar`);
}

function recompiledClassesDir(game) {
  const owned = path.join(ROOT, '.work', 'games', game.internalName,
    'decompile-owned');
  const finalAbiNormalized = path.join(owned, 'classes-abi-final');
  if (fs.existsSync(finalAbiNormalized)) return finalAbiNormalized;
  const latestAbiNormalized = path.join(owned, 'classes-abi-latest');
  if (fs.existsSync(latestAbiNormalized)) return latestAbiNormalized;
  const nextAbiNormalized = path.join(owned, 'classes-abi-current-next');
  if (fs.existsSync(nextAbiNormalized)) return nextAbiNormalized;
  const currentAbiNormalized = path.join(owned, 'classes-abi-current');
  if (fs.existsSync(currentAbiNormalized)) return currentAbiNormalized;
  const abiNormalized = path.join(owned, 'classes-abi');
  return fs.existsSync(abiNormalized) ? abiNormalized : path.join(owned, 'classes');
}

function validateRecompiledClasses(game, jarPath, classesOverride = null) {
  const classesDir = classesOverride || recompiledClassesDir(game);
  if (!fs.existsSync(classesDir)) {
    return {ok: false, status: 'missing-recompiled-classes', classesDir};
  }
  const expected = execFileSync('unzip', ['-Z1', jarPath], {encoding: 'utf8'})
    .split(/\r?\n/)
    .filter(name => name.endsWith('.class'));
  const missing = expected.filter(relative =>
    !fs.existsSync(path.join(classesDir, relative)));
  if (missing.length) {
    return {
      ok: false,
      status: 'incomplete-recompiled-classes',
      classesDir,
      expectedClasses: expected.length,
      missingClasses: missing,
    };
  }
  return {ok: true, classesDir, expectedClasses: expected.length};
}

async function ensureGamepack(game, configUrl) {
  const jarPath = gamepackPath(game);
  if (fs.existsSync(jarPath) && sha256(jarPath) === game.gamepackHash) {
    return jarPath;
  }

  console.log(`download ${game.internalName}`);
  const response = await fetch(new URL(
    `jars/${game.internalName}.jar`, configUrl,
  ));
  if (!response.ok) {
    throw new Error(`Gamepack download failed for ${game.internalName}: ` +
      `${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== game.gamepackHash) {
    throw new Error(`Downloaded gamepack hash mismatch for ` +
      `${game.internalName}: expected ${game.gamepackHash}, got ${actualHash}`);
  }

  fs.mkdirSync(path.dirname(jarPath), {recursive: true});
  const temporaryPath = `${jarPath}.download-${process.pid}`;
  try {
    fs.writeFileSync(temporaryPath, bytes);
    fs.renameSync(temporaryPath, jarPath);
  } finally {
    fs.rmSync(temporaryPath, {force: true});
  }
  return jarPath;
}

function extractGamepack(game, jarPath) {
  const classesDir = path.join(ROOT, '.work', 'alterorb-jvmjs', 'classes',
    game.internalName);
  const stamp = path.join(classesDir, '.source.json');
  const source = {size: fs.statSync(jarPath).size, hash: game.gamepackHash};
  let current = null;
  try {
    current = JSON.parse(fs.readFileSync(stamp, 'utf8'));
  } catch (_) {
    // A missing or stale extraction is rebuilt below.
  }
  if (!current || current.size !== source.size || current.hash !== source.hash) {
    fs.rmSync(classesDir, {recursive: true, force: true});
    fs.mkdirSync(classesDir, {recursive: true});
    execFileSync('unzip', ['-o', '-q', jarPath, '*.class', '-d', classesDir]);
    fs.writeFileSync(stamp, JSON.stringify(source));
  }
  return classesDir;
}

function buildHookStub() {
  const source = path.join(ROOT, 'stubs', 'src', 'net', 'alterorb',
    'launcher', 'Hook.java');
  const output = path.join(ROOT, '.work', 'alterorb-jvmjs', 'hookcp');
  const classFile = path.join(output, 'net', 'alterorb', 'launcher',
    'Hook.class');
  if (!fs.existsSync(classFile) ||
      fs.statSync(classFile).mtimeMs < fs.statSync(source).mtimeMs) {
    fs.mkdirSync(output, {recursive: true});
    execFileSync('javac', [
      '-source', '8', '-target', '8', '-d', output, source,
    ], {stdio: ['ignore', 'ignore', 'inherit']});
  }
  return output;
}

function largestSurface(jvm) {
  let best = null;
  for (const surface of jvm._softCanvases || []) {
    const pixels = surface && surface._pixels;
    if (!pixels || pixels.length < 100000) continue;
    if (!best || pixels.length > best._pixels.length) best = surface;
  }
  return best;
}

function surfaceSnapshot(jvm) {
  const surface = largestSurface(jvm);
  if (!surface) return null;
  const pixels = surface._pixels;
  {
    const stride = Math.max(1, Math.floor(pixels.length / 4096));
    let nonblankSamples = 0;
    let hash = 2166136261;
    const colors = new Set();
    const sceneSamples = [];
    let sampleNumber = 0;
    for (let index = 0; index < pixels.length; index += stride) {
      const pixel = Number(pixels[index]) >>> 0;
      const rgb = pixel & 0xffffff;
      if (rgb !== 0 && rgb !== 0xffffff) nonblankSamples += 1;
      colors.add(rgb);
      hash ^= pixel;
      hash = Math.imul(hash, 16777619) >>> 0;
      if ((sampleNumber++ & 15) === 0) {
        sceneSamples.push(((rgb >>> 20) & 15) << 8 |
          ((rgb >>> 12) & 15) << 4 | ((rgb >>> 4) & 15));
      }
    }
    const snapshot = {
      pixels: pixels.length,
      width: Number(surface._width || surface.width || 0),
      height: Number(surface._height || surface.height || 0),
      nonblankSamples,
      uniqueSampleColors: colors.size,
      sampleHash: hash.toString(16).padStart(8, '0'),
    };
    Object.defineProperty(snapshot, '_sceneSamples', {value: sceneSamples});
    return snapshot;
  }
}

function writeSurfacePng(jvm, game, artifactKind) {
  const surface = largestSurface(jvm);
  if (!surface) return null;
  const {encodePng} = require(path.join(
    JAVA_TOOLS_DIR, 'src', 'io', 'pngEncoder',
  ));
  const kind = String(artifactKind || 'surface').replace(/[^a-z0-9_-]+/gi, '-');
  const output = path.join(ROOT, '.work', 'alterorb-jvmjs', 'screenshots',
    `${game.internalName}-${kind}-${Date.now()}-${process.pid}.png`);
  const width = Number(surface._pixelsWidth || surface._width || 0);
  const height = Number(surface._pixelsHeight || surface._height || 0);
  if (width <= 0 || height <= 0) return null;
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, encodePng(surface._pixels, width, height));
  return output;
}

function threadSnapshot(jvm) {
  return jvm.threads.map((thread) => {
    const frames = thread.callStack && thread.callStack.items;
    const frame = frames && frames[frames.length - 1];
    const blockingOn = thread.blockingOn;
    const lockOwner = blockingOn && blockingOn.lockOwner;
    const ownerThread = Number.isInteger(lockOwner)
      ? jvm.threads.find(candidate => candidate.id === lockOwner) : null;
    const frameLocation = candidate => candidate
      ? `${candidate.className}.${candidate.method && candidate.method.name}` +
        `${candidate.method && candidate.method.descriptor || ''}@${candidate.pc}`
      : null;
    const hotGraphContinuation = candidate => {
      if (!candidate || !candidate.method || !jvm.jit) return false;
      const generated = jvm.jit.codegenCache?.get(candidate.method);
      return Boolean(generated?.jvmHotCallGraphHasContinuation?.(candidate));
    };
    return {
      id: thread.id,
      status: thread.status,
      priority: Number(thread.javaThread?.priority ?? thread.priority ?? 5),
      sleepUntil: thread.sleepUntil === undefined
        ? null : Number(thread.sleepUntil),
      sleepRemainingMs: thread.sleepUntil === undefined
        ? null : Math.max(0,
          Number(thread.sleepUntil) - Number(jvm.clock?.millis?.() || 0)),
      location: frameLocation(frame),
      stack: frames ? frames.slice(-8).map(frameLocation) : [],
      hotGraphContinuations: frames ? frames.slice(-8)
        .filter(hotGraphContinuation).map(frameLocation) : [],
      blockingOn: blockingOn ? {
        type: blockingOn._className || blockingOn.type || null,
        isLocked: Boolean(blockingOn.isLocked),
        lockOwner: Number.isInteger(lockOwner) ? lockOwner : null,
        lockCount: Number(blockingOn.lockCount || 0),
        ownerStatus: ownerThread ? ownerThread.status : null,
        ownerLocation: ownerThread && ownerThread.callStack
          ? frameLocation(ownerThread.callStack.peek()) : null,
      } : null,
      traceTail: thread._trace ? thread._trace.slice(-200) : undefined,
    };
  });
}

function topEntries(map, limit = 40) {
  if (!(map instanceof Map)) return [];
  return [...map.entries()]
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, limit);
}

function topTimingEntries(map, limit = 40) {
  if (!(map instanceof Map)) return [];
  return [...map.entries()]
    .sort((left, right) =>
      Number(right[1] && right[1].totalMs || 0) -
      Number(left[1] && left[1].totalMs || 0))
    .slice(0, limit);
}

function hotCallGraphRegionSummaries(jit) {
  const traceSource = process.env.JVM_TRACE_HOT_CALL_GRAPH_SOURCE === '1';
  const traceFilter = process.env.JVM_TRACE_HOT_CALL_GRAPH_FILTER || '';
  const summaries = [...(jit?.hotCallGraphRegions
    ?.compiledRegionSummaries || [])]
    .filter((summary) => !traceFilter ||
      String(summary.root || '').includes(traceFilter))
    .sort((left, right) => right.runs - left.runs)
    .slice(0, traceSource ? 256 : 32);
  if (!traceSource) return summaries;
  const directory = path.join(ROOT, '.work', 'alterorb-jvmjs',
    'generated-regions');
  fs.mkdirSync(directory, {recursive: true});
  return summaries.map((summary, index) => {
    if (typeof summary.source !== 'string') return summary;
    const source = summary.source;
    const identity = String(summary.root || 'region')
      .replace(/[^a-z0-9_.-]+/gi, '_').slice(0, 80);
    const output = path.join(directory,
      `${process.pid}-${index}-${identity}.js`);
    fs.writeFileSync(output, source);
    const copy = {...summary};
    delete copy.source;
    copy.sourceArtifact = {
      path: output,
      bytes: Buffer.byteLength(source),
      sha256: crypto.createHash('sha256').update(source).digest('hex'),
    };
    return copy;
  });
}

function resetJitProfile(jvm) {
  const jit = jvm && jvm.jit;
  if (!jit) return;
  jit.profileMethods = true;
  jit.profileTimings = true;
  jit.methodTimingSampleRate = 128;
  for (const name of [
    'generatedMethodRunCounts', 'intrinsicMethodRunCounts',
    'inlinedMethodRunCounts', 'methodDeoptCounts', 'methodDeoptReasons',
    'methodDeoptSites',
    'methodTimingSamples',
    'structuredSsaMethodRunCounts', 'scalarLoopMethodRunCounts',
  ]) {
    const value = jit[name];
    if (value instanceof Map) value.clear();
  }
  if (typeof jvm.resetSchedulerTimings === 'function') {
    jvm.resetSchedulerTimings();
  }
}

function jitProfileSnapshot(jvm) {
  const jit = jvm && jvm.jit;
  if (!jit) return null;
  return {
    counters: {
      polygonRasterRuns: Number(jit.polygonRasterRunCount || 0),
      polygonRasterGuardedFallbacks:
        Number(jit.polygonRasterGuardedFallbackCount || 0),
      affineSpriteRasterRuns:
        Number(jit.affineSpriteRasterRunCount || 0),
      affineSpriteRasterGuardedFallbacks:
        Number(jit.affineSpriteRasterGuardedFallbackCount || 0),
      semanticBilinearSamplerRuns:
        Number(jit.semanticBilinearSamplerRunCount || 0),
      semanticBilinearSamplerFallbacks:
        Number(jit.semanticBilinearSamplerFallbackCount || 0),
      alphaMaskedColorBlitRuns:
        Number(jit.alphaMaskedColorBlitRunCount || 0),
      alphaMaskedColorBlitSlowPaths:
        Number(jit.alphaMaskedColorBlitSlowPathCount || 0),
      transparentIntBlitRuns:
        Number(jit.transparentIntBlitRunCount || 0),
      transparentIntBlitSlowPaths:
        Number(jit.transparentIntBlitSlowPathCount || 0),
      clippedGradientRuns:
        Number(jit.clippedGradientRunCount || 0),
      clippedGradientSlowPaths:
        Number(jit.clippedGradientSlowPathCount || 0),
      oversizedWasmFirstMethods:
        Number(jit.oversizedWasmFirstMethodCount || 0),
      longArithmeticWasmFirstMethods:
        Number(jit.longArithmeticWasmFirstMethodCount || 0),
      wasmRuns:
        Number(jit.wasmJit && jit.wasmJit.runCount || 0),
      referenceFramelessPositionalRuns:
        Number(jit.referenceFramelessPositionalRunCount || 0),
      framePositionalCalls:
        Number(jit.framePositionalCallCount || 0),
      framePositionalFallbacks:
        Number(jit.framePositionalFallbackCount || 0),
      structuredRestoringDirectRuns:
        Number(jit.structuredSsa?.restoringDirectRunCount || 0),
      lateStructuredUpgrades:
        Number(jit.structuredConstructorUpgradeCount || 0),
      graphOwnedStructuredCompiles:
        Number(jit.regionStructuredCandidateCompileCount || 0),
      eagerMonomorphicCallLinks:
        Number(jit.eagerMonomorphicCallLinkCount || 0),
      compiledCallChainRuns:
        Number(jit.compiledCallChainRunCount || 0),
      hotCallGraphModules:
        Number(jit.hotCallGraphRegions?.moduleCompileCount || 0),
      hotCallGraphLexicallyInlinedEdges:
        Number(jit.hotCallGraphRegions?.lexicallyInlinedEdgeCount || 0),
      hotCallGraphExceptionalInlinedEdges:
        Number(jit.hotCallGraphRegions?.exceptionalInlinedEdgeCount || 0),
      hotCallGraphCompactInternalEdges:
        Number(jit.hotCallGraphRegions?.compactInternalEdgeCount || 0),
      hotCallGraphGuardedInternalEdges:
        Number(jit.hotCallGraphRegions?.guardedInternalEdgeCount || 0),
      hotCallGraphOutlinedLoops:
        Number(jit.hotCallGraphRegions?.outlinedLoopCount || 0),
      hotCallGraphOutlinedLoopSourceBytes:
        Number(jit.hotCallGraphRegions?.outlinedLoopSourceBytes || 0),
      hotCallGraphPartitionedSegments:
        Number(jit.hotCallGraphRegions?.partitionedSegmentCount || 0),
      hotCallGraphPartitionedSegmentSourceBytes:
        Number(jit.hotCallGraphRegions?.partitionedSegmentSourceBytes || 0),
      hotCallGraphFramedPartitionedSegments:
        Number(jit.hotCallGraphRegions?.framedPartitionedSegmentCount || 0),
      hotCallGraphLiftedEnvironmentNames:
        Number(jit.hotCallGraphRegions?.liftedEnvironmentNameCount || 0),
      hotCallGraphPartitionPassMillis:
        Math.round(Number(jit.hotCallGraphRegions?.partitionPassMillis || 0)),
      hotCallGraphFactoryHoistedModules:
        Number(jit.hotCallGraphRegions?.factoryHoistedModuleCount || 0),
      hotCallGraphFactoryHoistedDeclarations:
        Number(jit.hotCallGraphRegions?.factoryHoistedDeclarationCount || 0),
      structuredProducedArrayLocalViews:
        Number(jit.structuredSsa
          ?.persistentProducedArrayLocalViewCompileCount || 0),
      structuredLoopInvariantStaticArrayViews:
        Number(jit.structuredSsa
          ?.loopInvariantStaticArrayViewCompileCount || 0),
      hotCallGraphBindingIndexBuilds:
        Number(jit.hotCallGraphRegions?.callBindingIndexBuildCount || 0),
      hotCallGraphBindingIndexReuses:
        Number(jit.hotCallGraphRegions?.callBindingIndexReuseCount || 0),
      hotCallGraphDirtyExpansions:
        Number(jit.hotCallGraphRegions?.dirtyExpansionCount || 0),
      hotCallGraphStateExpansions:
        Number(jit.hotCallGraphRegions?.stateExpansionCount || 0),
      hotCallGraphPeriodicExpansions:
        Number(jit.hotCallGraphRegions?.periodicExpansionCount || 0),
      hotCallGraphRuns:
        Number(jit.hotCallGraphRegions?.runCount || 0),
      hotCallGraphFallbacks:
        Number(jit.hotCallGraphRegions?.guardFallbackCount || 0),
      fusedRuns: Number(jit.fusedRunCount || 0),
      fusedDirectRuns: Number(jit.fusedDirectRunCount || 0),
      fusedGuardedFallbacks: Number(jit.fusedGuardedFallbackCount || 0),
      fusedRestoredExceptionFrames:
        Number(jit.fusedRestoredExceptionFrameCount || 0),
    },
    generatedMethods: topEntries(jit.generatedMethodRunCounts),
    hotCallGraphRegions: hotCallGraphRegionSummaries(jit),
    hotCallGraphRejections:
      jit.hotCallGraphRegions?.getRejectionSummaries?.() || [],
    hotCallGraphGenericCallSites:
      jit.hotCallGraphRegions?.getGenericCallSiteSummaries?.() || [],
    generatedMethodTimings: topTimingEntries(jit.methodTimingSamples),
    intrinsicMethods: topEntries(jit.intrinsicMethodRunCounts),
    inlinedMethods: topEntries(jit.inlinedMethodRunCounts),
    deopts: topEntries(jit.methodDeoptCounts),
    deoptSites: topEntries(jit.methodDeoptSites),
    deoptReasons: jit.methodDeoptReasons instanceof Map
      ? [...jit.methodDeoptReasons.entries()] : [],
    schedulerTimings: jvm._schedulerTimingProfile
      ? [...jvm._schedulerTimingProfile.samples.entries()]
        .sort((left, right) => right[1].totalMs - left[1].totalMs)
        .slice(0, 40)
      : [],
  };
}

function jitRuntimeCounters(jvm) {
  const jit = jvm && jvm.jit;
  if (!jit) return null;
  return {
    preferWholeMethodJs: Boolean(jit.preferWholeMethodJs),
    adaptiveConstructorCallers:
      Boolean(jit.adaptiveConstructorCallersEnabled),
    adaptiveEntryPromotions: Number(jit.adaptiveEntryPromotionCount || 0),
    adaptiveTimePromotions: Number(jit.adaptiveTimePromotionCount || 0),
    adaptiveTimeSamples: Number(jit.adaptiveTimeSampleCount || 0),
    adaptiveWholeMethodPromotions:
      Number(jit.adaptiveWholeMethodPromotionCount || 0),
    adaptiveWholeMethodEscalations:
      Number(jit.adaptiveWholeMethodEscalationCount || 0),
    polygonRasterRuns: Number(jit.polygonRasterRunCount || 0),
    polygonRasterGuardedFallbacks:
      Number(jit.polygonRasterGuardedFallbackCount || 0),
    affineSpriteRasterRuns: Number(jit.affineSpriteRasterRunCount || 0),
    affineSpriteRasterGuardedFallbacks:
      Number(jit.affineSpriteRasterGuardedFallbackCount || 0),
    polygonRasterFallbackEntry: Number(jit.polygonRasterFallbackEntry || 0),
    polygonRasterFallbackVertices:
      Number(jit.polygonRasterFallbackVertices || 0),
    polygonRasterFallbackCoordinate:
      Number(jit.polygonRasterFallbackCoordinate || 0),
    polygonRasterFallbackDegenerate:
      Number(jit.polygonRasterFallbackDegenerate || 0),
    polygonRasterFallbackSurface:
      Number(jit.polygonRasterFallbackSurface || 0),
    polygonRasterFallbackScratch:
      Number(jit.polygonRasterFallbackScratch || 0),
    polygonRasterFallbackSurfaceSample:
      jit.polygonRasterFallbackSurfaceSample || null,
    tiledBlitRuns: Number(jit.tiledBlitRunCount || 0),
    tiledBlitGuardedFallbacks:
      Number(jit.tiledBlitGuardedFallbackCount || 0),
    tiledBlitFallbackEntry: Number(jit.tiledBlitFallbackEntry || 0),
    tiledBlitFallbackTag: Number(jit.tiledBlitFallbackTag || 0),
    tiledBlitFallbackArrays: Number(jit.tiledBlitFallbackArrays || 0),
    tiledBlitFallbackLayout: Number(jit.tiledBlitFallbackLayout || 0),
    tiledBlitFallbackBounds: Number(jit.tiledBlitFallbackBounds || 0),
    perspectiveSpanRuns: Number(jit.perspectiveSpanRunCount || 0),
    perspectiveSpanGuardedFallbacks:
      Number(jit.perspectiveSpanGuardedFallbackCount || 0),
    semanticBilinearSamplerRuns:
      Number(jit.semanticBilinearSamplerRunCount || 0),
    semanticBilinearSamplerFallbacks:
      Number(jit.semanticBilinearSamplerFallbackCount || 0),
    alphaMaskedColorBlitRuns:
      Number(jit.alphaMaskedColorBlitRunCount || 0),
    alphaMaskedColorBlitSlowPaths:
      Number(jit.alphaMaskedColorBlitSlowPathCount || 0),
    transparentIntBlitRuns:
      Number(jit.transparentIntBlitRunCount || 0),
    transparentIntBlitSlowPaths:
      Number(jit.transparentIntBlitSlowPathCount || 0),
    clippedGradientRuns:
      Number(jit.clippedGradientRunCount || 0),
    clippedGradientSlowPaths:
      Number(jit.clippedGradientSlowPathCount || 0),
    oversizedWasmFirstMethods:
      Number(jit.oversizedWasmFirstMethodCount || 0),
    longArithmeticWasmFirstMethods:
      Number(jit.longArithmeticWasmFirstMethodCount || 0),
    wasmRuns:
      Number(jit.wasmJit && jit.wasmJit.runCount || 0),
    referenceFramelessPositionalRuns:
      Number(jit.referenceFramelessPositionalRunCount || 0),
    framePositionalCalls:
      Number(jit.framePositionalCallCount || 0),
    framePositionalFallbacks:
      Number(jit.framePositionalFallbackCount || 0),
    structuredRestoringDirectRuns:
      Number(jit.structuredSsa?.restoringDirectRunCount || 0),
    lateStructuredUpgrades:
      Number(jit.structuredConstructorUpgradeCount || 0),
    graphOwnedStructuredCompiles:
      Number(jit.regionStructuredCandidateCompileCount || 0),
    eagerMonomorphicCallLinks:
      Number(jit.eagerMonomorphicCallLinkCount || 0),
    compiledCallChainRuns:
      Number(jit.compiledCallChainRunCount || 0),
    hotCallGraphModules:
      Number(jit.hotCallGraphRegions?.moduleCompileCount || 0),
    hotCallGraphLexicallyInlinedEdges:
      Number(jit.hotCallGraphRegions?.lexicallyInlinedEdgeCount || 0),
    hotCallGraphExceptionalInlinedEdges:
      Number(jit.hotCallGraphRegions?.exceptionalInlinedEdgeCount || 0),
    hotCallGraphCompactInternalEdges:
      Number(jit.hotCallGraphRegions?.compactInternalEdgeCount || 0),
    hotCallGraphGuardedInternalEdges:
      Number(jit.hotCallGraphRegions?.guardedInternalEdgeCount || 0),
    hotCallGraphOutlinedLoops:
      Number(jit.hotCallGraphRegions?.outlinedLoopCount || 0),
    hotCallGraphOutlinedLoopSourceBytes:
      Number(jit.hotCallGraphRegions?.outlinedLoopSourceBytes || 0),
    hotCallGraphPartitionedSegments:
      Number(jit.hotCallGraphRegions?.partitionedSegmentCount || 0),
    hotCallGraphPartitionedSegmentSourceBytes:
      Number(jit.hotCallGraphRegions?.partitionedSegmentSourceBytes || 0),
    hotCallGraphFramedPartitionedSegments:
      Number(jit.hotCallGraphRegions?.framedPartitionedSegmentCount || 0),
    hotCallGraphLiftedEnvironmentNames:
      Number(jit.hotCallGraphRegions?.liftedEnvironmentNameCount || 0),
    hotCallGraphPartitionPassMillis:
      Math.round(Number(jit.hotCallGraphRegions?.partitionPassMillis || 0)),
    hotCallGraphFactoryHoistedModules:
      Number(jit.hotCallGraphRegions?.factoryHoistedModuleCount || 0),
    hotCallGraphFactoryHoistedDeclarations:
      Number(jit.hotCallGraphRegions?.factoryHoistedDeclarationCount || 0),
    structuredProducedArrayLocalViews:
      Number(jit.structuredSsa
        ?.persistentProducedArrayLocalViewCompileCount || 0),
    structuredLoopInvariantStaticArrayViews:
      Number(jit.structuredSsa
        ?.loopInvariantStaticArrayViewCompileCount || 0),
    hotCallGraphBindingIndexBuilds:
      Number(jit.hotCallGraphRegions?.callBindingIndexBuildCount || 0),
    hotCallGraphBindingIndexReuses:
      Number(jit.hotCallGraphRegions?.callBindingIndexReuseCount || 0),
    hotCallGraphDirtyExpansions:
      Number(jit.hotCallGraphRegions?.dirtyExpansionCount || 0),
    hotCallGraphStateExpansions:
      Number(jit.hotCallGraphRegions?.stateExpansionCount || 0),
    hotCallGraphPeriodicExpansions:
      Number(jit.hotCallGraphRegions?.periodicExpansionCount || 0),
    hotCallGraphRuns:
      Number(jit.hotCallGraphRegions?.runCount || 0),
    hotCallGraphFallbacks:
      Number(jit.hotCallGraphRegions?.guardFallbackCount || 0),
    hotCallGraphRegions: hotCallGraphRegionSummaries(jit),
    hotCallGraphRejections:
      jit.hotCallGraphRegions?.getRejectionSummaries?.() || [],
    hotCallGraphGenericCallSites:
      jit.hotCallGraphRegions?.getGenericCallSiteSummaries?.() || [],
    positionalGeneratedTemplateCompiles:
      Number(jit.positionalGeneratedTemplateCompileCount || 0),
    positionalGeneratedTemplateReuses:
      Number(jit.positionalGeneratedTemplateReuseCount || 0),
    positionalJreTemplateCompiles:
      Number(jit.positionalJreTemplateCompileCount || 0),
    positionalJreTemplateReuses:
      Number(jit.positionalJreTemplateReuseCount || 0),
    stableGeneratedEntryRuns:
      Number(jit.stableGeneratedEntryRunCount || 0),
    registeredSyncCallSites:
      Number(jit.syncCallSites && jit.syncCallSites.length || 0),
    legacySyncCallSites:
      Number(jit.legacySyncCallSites && jit.legacySyncCallSites.size || 0),
    generatedSchedulerBurstFrames:
      Number(jvm.generatedSchedulerBurstFrames || 0),
    generatedSchedulerBurstBatches:
      Number(jvm.generatedSchedulerBurstBatches || 0),
    fusedRuns: Number(jit.fusedRunCount || 0),
    fusedDirectRuns: Number(jit.fusedDirectRunCount || 0),
    fusedGuardedFallbacks: Number(jit.fusedGuardedFallbackCount || 0),
    fusedRestoredExceptionFrames:
      Number(jit.fusedRestoredExceptionFrameCount || 0),
  };
}

function schedulerTimingSnapshot(jvm) {
  if (!jvm || !jvm._schedulerTimingProfile) return null;
  const jit = jvm.jit;
  return [...jvm._schedulerTimingProfile.samples.entries()]
    .sort((left, right) => right[1].totalMs - left[1].totalMs)
    .slice(0, 40)
    .map(([key, timing]) => {
      const open = key.indexOf('(');
      const separator = open < 0 ? -1 : key.lastIndexOf('.', open);
      const owner = separator < 0 ? null : key.slice(0, separator);
      const name = separator < 0 || open < 0 ? null : key.slice(separator + 1, open);
      const descriptor = open < 0 ? null : key.slice(open);
      const classData = owner && jvm.classes && jvm.classes[owner];
      const method = classData && name && descriptor
        ? jvm.findMethod(classData, name, descriptor) : null;
      const generated = method && jit && jit.codegenCache &&
        jit.codegenCache.has(method) ? jit.codegenCache.get(method) : null;
      const code = method && Array.isArray(method.attributes)
        ? method.attributes.find(attribute =>
          attribute && attribute.type === 'code' && attribute.code)?.code
        : null;
      let tier = generated
        ? generated.jvmStructuredSsa ? 'structured-ssa'
          : generated.jvmScalarLoop ? 'scalar-loop'
            : 'generated-baseline'
        : 'not-generated';
      if (generated && generated.jvmResumeBody) tier += '+resume';
      return [key, {
        ...timing,
        tier,
        generatedCached: Boolean(generated),
        structuredContinuation:
          Boolean(generated && generated.jvmStructuredContinuation),
        structuredSafePointBudget: Number.isFinite(
          generated && generated.jvmStructuredSafePointBudget)
          ? generated.jvmStructuredSafePointBudget : null,
        structuredLoopCount: Number.isFinite(
          generated && generated.jvmStructuredLoopCount)
          ? generated.jvmStructuredLoopCount : null,
        structuredCoarseCountedLoopCount: Number.isFinite(
          generated && generated.jvmStructuredCoarseCountedLoopCount)
          ? generated.jvmStructuredCoarseCountedLoopCount : null,
        adaptivePositional: Boolean(
          generated && generated.jvmAdaptivePositionalBody),
        hotCallGraphFramedCandidate: Boolean(
          generated && generated.jvmHotCallGraphFramedSource),
        hotCallGraphCallSites: Array.isArray(
          generated && generated.jvmStructuredRegionCallSites)
          ? generated.jvmStructuredRegionCallSites.length : null,
        hotCallGraphPlanned: Boolean(
          generated && generated.jvmHotCallGraphRegionPlan),
        codegenSupported: Boolean(method && jit &&
          jit.isCodegenSupported(method)),
        adaptiveCodegenSupported: Boolean(method && jit &&
          jit.isCodegenSupported(method, true)),
        adaptivePromoted: Boolean(method && jit &&
          jit.adaptiveCodegenMethods && jit.adaptiveCodegenMethods.has(method)),
        instructionCount:
          Array.isArray(code && code.codeItems) ? code.codeItems.length : null,
        exceptionHandlerCount:
          Array.isArray(code && code.exceptionTable) ? code.exceptionTable.length : null,
        compileError: method && jit && jit.codegenCompileErrors &&
          jit.codegenCompileErrors.get(method)
          ? String(jit.codegenCompileErrors.get(method).message ||
            jit.codegenCompileErrors.get(method))
          : null,
      }];
    });
}

function startCpuProfile() {
  let inspector;
  try {
    inspector = require('inspector');
  } catch (error) {
    return Promise.resolve({
      error: String(error && (error.stack || error.message) || error),
      stop: async () => null,
    });
  }
  const session = new inspector.Session();
  session.connect();
  const post = (method, parameters) => new Promise((resolve, reject) => {
    session.post(method, parameters || {},
      (error, value) => error ? reject(error) : resolve(value));
  });
  return post('Profiler.enable')
    .then(() => post('Profiler.setSamplingInterval', {interval: 1000}))
    .then(() => post('Profiler.start'))
    .then(() => ({
      stop: async () => {
        try {
          const result = await post('Profiler.stop');
          return result && result.profile || null;
        } finally {
          session.disconnect();
        }
      },
    }))
    .catch((error) => {
      session.disconnect();
      return {
        error: String(error && (error.stack || error.message) || error),
        stop: async () => null,
      };
    });
}

function summarizeCpuProfile(profile, error) {
  if (!profile) return error ? {error} : null;
  const selfSamples = new Map();
  for (const id of profile.samples || []) {
    selfSamples.set(id, (selfSamples.get(id) || 0) + 1);
  }
  const totalSamples = (profile.samples || []).length;
  const allSelf = (profile.nodes || [])
    .map((node) => {
      const call = node.callFrame || {};
      const samples = selfSamples.get(node.id) || 0;
      return {
        functionName: call.functionName || '(anonymous)',
        url: call.url || '',
        lineNumber: Number(call.lineNumber || 0) + 1,
        samples,
        percent: totalSamples > 0 ? samples * 100 / totalSamples : 0,
      };
    })
    .filter((entry) => entry.samples > 0)
    .sort((left, right) => right.samples - left.samples);
  const classify = (entry) => {
    if (entry.url.startsWith('jvm-generated:')) return 'generated-guest';
    if (entry.url.includes('/src/core/')) return 'jvm-core';
    if (entry.url.includes('/src/jit/')) return 'jit-runtime';
    if (entry.url.includes('/src/instructions/')) return 'interpreter-opcode';
    if (entry.url.includes('/src/jre/')) return 'jre-native';
    if (entry.url.startsWith('node:')) return 'node-runtime';
    if (entry.functionName === '(program)' ||
        entry.functionName === 'wasm-to-js') return 'wasm';
    if (entry.functionName === '(garbage collector)') return 'gc';
    if (entry.functionName === '(idle)') return 'idle';
    return 'other';
  };
  const sumBy = (keyFor) => {
    const sums = new Map();
    for (const entry of allSelf) {
      const key = keyFor(entry);
      sums.set(key, (sums.get(key) || 0) + entry.samples);
    }
    return [...sums.entries()]
      .map(([key, samples]) => ({
        key, samples,
        percent: totalSamples > 0 ? samples * 100 / totalSamples : 0,
      }))
      .sort((left, right) => right.samples - left.samples);
  };
  const profileNodes = new Map((profile.nodes || []).map((node) =>
    [node.id, node]));
  const callerEdges = new Map();
  const callIdentity = (node) => {
    const frame = node && node.callFrame || {};
    return {
      functionName: frame.functionName || '(anonymous)',
      url: frame.url || '',
      lineNumber: Number(frame.lineNumber || 0) + 1,
    };
  };
  for (const parent of profile.nodes || []) {
    const caller = callIdentity(parent);
    for (const childId of parent.children || []) {
      const samples = selfSamples.get(childId) || 0;
      if (!samples) continue;
      const callee = callIdentity(profileNodes.get(childId));
      const key = JSON.stringify([caller, callee]);
      const existing = callerEdges.get(key);
      if (existing) existing.samples += samples;
      else callerEdges.set(key, {caller, callee, samples});
    }
  }
  const topCallerEdges = [...callerEdges.values()]
    .map((entry) => ({
      ...entry,
      percent: totalSamples > 0 ? entry.samples * 100 / totalSamples : 0,
    }))
    .sort((left, right) => right.samples - left.samples)
    .slice(0, 120);
  return {
    totalSamples,
    durationMicros: (profile.timeDeltas || [])
      .reduce((sum, value) => sum + Number(value || 0), 0),
    categories: sumBy(classify),
    topUrls: sumBy((entry) => entry.url || '(no URL)').slice(0, 80),
    topSelf: allSelf.slice(0, 80),
    topCallerEdges,
  };
}

function emitWorkerResult(result, exitCode) {
  const resultPath = process.env.ALTERORB_JVMJS_WORKER_RESULT || null;
  if (resultPath) {
    fs.mkdirSync(path.dirname(resultPath), {recursive: true});
    fs.writeFileSync(resultPath, JSON.stringify(result));
    process.stdout.write(RESULT_PREFIX + JSON.stringify({resultPath}) + '\n');
  } else {
    process.stdout.write(RESULT_PREFIX + JSON.stringify(result) + '\n');
  }
  setTimeout(() => process.exit(exitCode), 10);
}

async function runWorker(specification) {
  const game = specification.game;
  const cacheDir = path.join(os.homedir(), '.alterorb', 'caches',
    game.internalName);
  fs.mkdirSync(cacheDir, {recursive: true});
  process.chdir(cacheDir);

  const classesDir = specification.classesDir ||
    extractGamepack(game, specification.jarPath);
  const hookDir = buildHookStub();
  const {JVM} = require(path.join(JAVA_TOOLS_DIR, 'src', 'core', 'jvm'));
  const appletParameters = {
    overxgames: '45',
    overxachievements: '1000',
    member: 'no',
    gameport1: String(TCP_PORT),
    gameport2: String(TCP_PORT),
    servernum: '8003',
    simplemode: specification.until === 'main-menu' ? 'true' : 'false',
    instanceid: crypto.randomBytes(8).readBigInt64BE().toString(),
    gamecrc: String(game.gamecrc),
  };
  const jvm = new JVM({
    classpath: [classesDir, hookDir],
    appletParameters,
    appletCodeBase: `http://127.0.0.1:${HTTP_PROXY_PORT}/`,
    jit: {
      enabled: !specification.noJit,
      profileMethods: specification.profileJit,
      profileTimings: specification.profileJit,
      methodTimingSampleRate: 128,
    },
  });
  const methodEntryTraceOut = process.env.JVM_METHOD_ENTRY_TRACE_OUT || null;
  if (methodEntryTraceOut && process.env.JVM_METHOD_ENTRY_TRACE) {
    jvm.jit.methodEntryTraceKey = process.env.JVM_METHOD_ENTRY_TRACE;
    jvm.jit.methodEntryTraceOccurrence = Math.max(1, Number(
      process.env.JVM_METHOD_ENTRY_TRACE_OCCURRENCE,
    ) || 1);
  }
  let methodEntryTraceWritten = false;
  const startedAt = Date.now();
  let firstFrameAt = null;
  let logoCompletedAt = null;
  let firstMenuSurfaceAt = null;
  let menuCandidateFrameAt = null;
  let menuActivityStartAt = null;
  let menuActivityStartPresented = 0;
  let menuActivityStartDirtyMarks = 0;
  let menuActivityLastChangeAt = null;
  let menuActivityLastPresented = 0;
  let menuActivityLastDirtyMarks = 0;
  let menuAdvanceCandidateAt = null;
  let menuAdvanceDispatchedAt = null;
  let menuAdvanceSourceHash = null;
  let menuAdvanceCallbacks = 0;
  let menuAdvanceFrameCount = null;
  let denseSceneSamples = null;
  let denseSceneTransitions = 0;
  let fpsStartedAt = null;
  let fpsStartPresented = 0;
  let fpsStartDirtyMarks = 0;
  let cpuProfilePromise = null;
  let cpuProfileSummaryPromise = null;
  let menuScreenshot = null;
  const seenFrameHashes = new Set();
  const frameHistory = [];
  let settled = false;
  const stopCpuProfile = () => {
    if (!cpuProfilePromise) return Promise.resolve(null);
    if (!cpuProfileSummaryPromise) {
      cpuProfileSummaryPromise = cpuProfilePromise.then(async (controller) => {
        const profile = await controller.stop();
        return summarizeCpuProfile(profile, controller.error);
      }).catch((error) => ({
        error: String(error && (error.stack || error.message) || error),
      }));
    }
    return cpuProfileSummaryPromise;
  };
  const finish = (status, extra, exitCode) => {
    if (settled) return;
    settled = true;
    if (!methodEntryTraceWritten && methodEntryTraceOut &&
        jvm.jit.methodEntryTrace) {
      fs.mkdirSync(path.dirname(methodEntryTraceOut), {recursive: true});
      fs.writeFileSync(methodEntryTraceOut,
        JSON.stringify(jvm.jit.methodEntryTrace, null, 2));
      methodEntryTraceWritten = true;
    }
    if (process.env.JVM_DEBUG_JIT === '1' &&
        jvm.jit && typeof jvm.jit.dumpStats === 'function') {
      jvm.jit.dumpStats(Number(process.env.JVM_DEBUG_JIT_LIMIT) || 25);
    }
    const publish = async () => {
      let resultExtra = extra || {};
      if (cpuProfilePromise &&
          !Object.prototype.hasOwnProperty.call(resultExtra, 'cpuProfile')) {
        resultExtra = {...resultExtra, cpuProfile: await stopCpuProfile()};
      }
      emitWorkerResult({
        game: game.internalName,
        name: game.name,
        mainClass: game.mainClass,
        variant: specification.variant || 'original',
        status,
        elapsedMs: Date.now() - startedAt,
        phaseTimings: {
          firstFrameElapsedMs: firstFrameAt === null
            ? null : firstFrameAt - startedAt,
          logoCompletedElapsedMs: logoCompletedAt === null
            ? null : logoCompletedAt - startedAt,
          firstMenuSurfaceElapsedMs: firstMenuSurfaceAt === null
            ? null : firstMenuSurfaceAt - startedAt,
          postLogoToMenuMs: logoCompletedAt === null ||
              firstMenuSurfaceAt === null
            ? null : firstMenuSurfaceAt - logoCompletedAt,
        },
        methodEntryTraceMatches: methodEntryTraceOut
          ? jvm.jit.methodEntryTraceMatchCount : undefined,
        menuAdvance: menuAdvanceDispatchedAt === null ? null : {
          elapsedMs: menuAdvanceDispatchedAt - startedAt,
          sourceHash: menuAdvanceSourceHash,
          callbacks: menuAdvanceCallbacks,
          subsequentDistinctFrames: Math.max(0,
            seenFrameHashes.size - menuAdvanceFrameCount),
          ...specification.menuAdvanceClick,
        },
        menuSceneTransitions: denseSceneTransitions,
        ...resultExtra,
      }, exitCode);
    };
    publish().catch((error) => emitWorkerResult({
      game: game.internalName,
      name: game.name,
      mainClass: game.mainClass,
      variant: specification.variant || 'original',
      status: 'error',
      elapsedMs: Date.now() - startedAt,
      error: String(error && (error.stack || error.message) || error),
    }, 1));
  };
  const timer = setInterval(() => {
    if (!methodEntryTraceWritten && methodEntryTraceOut &&
        jvm.jit.methodEntryTrace) {
      fs.mkdirSync(path.dirname(methodEntryTraceOut), {recursive: true});
      fs.writeFileSync(methodEntryTraceOut,
        JSON.stringify(jvm.jit.methodEntryTrace, null, 2));
      methodEntryTraceWritten = true;
    }
    const observedAt = Date.now();
    const presentationStats = jvm._awtPresentationStats;
    const totalPresented = Number(presentationStats && presentationStats.presented || 0);
    const totalDirtyMarks = Number(presentationStats && presentationStats.dirtyMarks || 0);
    if (menuActivityStartAt !== null &&
        (totalPresented !== menuActivityLastPresented ||
          totalDirtyMarks !== menuActivityLastDirtyMarks)) {
      menuActivityLastChangeAt = observedAt;
      menuActivityLastPresented = totalPresented;
      menuActivityLastDirtyMarks = totalDirtyMarks;
    }
    const surface = surfaceSnapshot(jvm);
    if (surface && surface.nonblankSamples >= 16 && firstFrameAt === null) {
      firstFrameAt = Date.now();
    }
    if (surface && !seenFrameHashes.has(surface.sampleHash)) {
      seenFrameHashes.add(surface.sampleHash);
      frameHistory.push({
        elapsedMs: Date.now() - startedAt,
        ...surface,
      });
      if (frameHistory.length > 200) frameHistory.shift();
    }
    const isFirstFrame = specification.until !== 'main-menu' &&
      firstFrameAt !== null;
    const menuSurface = classifyMenuSurface(surface, seenFrameHashes.size);
    if (logoCompletedAt === null &&
        isPostLogoLoadingSurface(surface, seenFrameHashes.size)) {
      logoCompletedAt = observedAt;
      // Main-menu startup profiling measures guest loading mechanics, not
      // JVM/process startup or the logo animation. Reset sampled ownership at
      // the same generic framebuffer boundary used by postLogoToMenuMs.
      // Menu-FPS profiling deliberately keeps its later, menu-only boundary.
      if (specification.measureFpsMs <= 0) {
        if (specification.profileJit) resetJitProfile(jvm);
        if (specification.cpuProfile && cpuProfilePromise === null) {
          const delayMs = Math.max(0,
            Number(process.env.JVM_CPU_PROFILE_DELAY_MS) || 0);
          if (delayMs === 0) {
            cpuProfilePromise = startCpuProfile();
          } else {
            setTimeout(() => {
              if (!settled && cpuProfilePromise === null) {
                cpuProfilePromise = startCpuProfile();
              }
            }, delayMs);
          }
        }
      }
    }
    const denseMenuArtwork = menuSurface.dense;
    if (denseMenuArtwork && surface._sceneSamples) {
      if (denseSceneSamples === null) {
        denseSceneSamples = surface._sceneSamples;
      } else if (sceneDifference(denseSceneSamples,
        surface._sceneSamples) >= 0.3) {
        const resetCandidate = shouldResetMenuCandidateOnSceneTransition(
          denseSceneTransitions, specification.menuSceneTransitions);
        denseSceneTransitions += 1;
        denseSceneSamples = surface._sceneSamples;
        // The transition count is a startup gate, not a request for a static
        // menu. Once it is satisfied, normal full-screen menu animation must
        // not perpetually restart the settling window.
        if (resetCandidate) {
          menuCandidateFrameAt = null;
          menuActivityStartAt = null;
        }
      }
    }
    // Some complete menus deliberately use mostly-black artwork. Keep them
    // distinct from the sparse Jagex progress panel (roughly 470 sampled
    // nonblank pixels) by requiring a materially larger painted area and a
    // richer sequence of frame states.
    const sparseAnimatedMenu = menuSurface.sparse;
    if (firstMenuSurfaceAt === null &&
        (denseMenuArtwork || sparseAnimatedMenu)) {
      firstMenuSurfaceAt = observedAt;
      // The loading profile begins at the post-logo framebuffer boundary and
      // must end at the metric's first-menu boundary. Do not include the
      // subsequent correctness settling window in its samples.
      if (specification.cpuProfile && specification.measureFpsMs <= 0) {
        void stopCpuProfile();
      }
    }
    if (specification.until === 'main-menu' &&
        specification.menuAdvanceClick &&
        menuAdvanceDispatchedAt === null) {
      if (menuSurface.advanceable) {
        if (menuAdvanceCandidateAt === null) menuAdvanceCandidateAt = observedAt;
        if (observedAt - menuAdvanceCandidateAt >= 5000) {
          const callbacks = enqueueSyntheticMouseClick(jvm,
            specification.menuAdvanceClick.x,
            specification.menuAdvanceClick.y);
          if (callbacks > 0) {
            menuAdvanceDispatchedAt = observedAt;
            menuAdvanceSourceHash = surface.sampleHash;
            menuAdvanceCallbacks = callbacks;
            menuAdvanceFrameCount = seenFrameHashes.size;
            menuCandidateFrameAt = null;
            menuActivityStartAt = null;
          }
        }
      } else {
        menuAdvanceCandidateAt = null;
      }
    }
    const changedAfterAdvance = menuAdvanceDispatchedAt === null ||
      surface && surface.sampleHash !== menuAdvanceSourceHash;
    const settledAfterAdvance = hasMenuAdvanceSettled(
      menuAdvanceDispatchedAt, menuAdvanceFrameCount, seenFrameHashes.size);
    const sceneRequirementMet = sparseAnimatedMenu ||
      denseSceneTransitions >= specification.menuSceneTransitions;
    if (specification.until === 'main-menu' &&
        (denseMenuArtwork || sparseAnimatedMenu) &&
        changedAfterAdvance &&
        menuCandidateFrameAt === null) {
      menuCandidateFrameAt = observedAt;
      menuActivityStartAt = observedAt;
      menuActivityStartPresented = totalPresented;
      menuActivityStartDirtyMarks = totalDirtyMarks;
      menuActivityLastChangeAt = observedAt;
      menuActivityLastPresented = totalPresented;
      menuActivityLastDirtyMarks = totalDirtyMarks;
    }
    // FunOrb simple mode bypasses login and opens the offline main menu. Its
    // full-screen artwork is materially denser and more colorful than the
    // sparse Jagex/loading frames. Require several intervening frame states
    // and a settling delay so a transient progress redraw cannot pass.
    const isMenu = specification.until === 'main-menu' &&
      firstFrameAt !== null &&
      Date.now() - firstFrameAt >= 5000 &&
      menuCandidateFrameAt !== null &&
      Date.now() - menuCandidateFrameAt >= 10000 &&
      seenFrameHashes.size >= 3 &&
      settledAfterAdvance &&
      sceneRequirementMet &&
      (denseMenuArtwork || sparseAnimatedMenu);
    if (isMenu && specification.measureFpsMs > 0 && fpsStartedAt === null) {
      fpsStartedAt = Date.now();
      fpsStartPresented = Number(
        jvm._awtPresentationStats && jvm._awtPresentationStats.presented || 0);
      fpsStartDirtyMarks = Number(
        jvm._awtPresentationStats && jvm._awtPresentationStats.dirtyMarks || 0);
      menuScreenshot = writeSurfacePng(jvm, game, 'main-menu');
      if (specification.profileJit) resetJitProfile(jvm);
      if (specification.cpuProfile) {
        cpuProfilePromise = startCpuProfile();
        cpuProfileSummaryPromise = null;
      }
    }
    if (fpsStartedAt !== null &&
        Date.now() - fpsStartedAt >= specification.measureFpsMs) {
      clearInterval(timer);
      const endedAt = Date.now();
      const durationMs = endedAt - fpsStartedAt;
      const presented = Number(
        jvm._awtPresentationStats && jvm._awtPresentationStats.presented || 0) -
        fpsStartPresented;
      const dirtyMarks = Number(
        jvm._awtPresentationStats && jvm._awtPresentationStats.dirtyMarks || 0) -
        fpsStartDirtyMarks;
      const fps = durationMs > 0 ? presented * 1000 / durationMs : 0;
      const activityDurationMs = menuActivityStartAt === null ||
          menuActivityLastChangeAt === null
        ? 0 : Math.max(0, menuActivityLastChangeAt - menuActivityStartAt);
      const activityPresented = Math.max(
        0, menuActivityLastPresented - menuActivityStartPresented);
      const activityDirtyMarks = Math.max(
        0, menuActivityLastDirtyMarks - menuActivityStartDirtyMarks);
      const activityUseful = activityDurationMs >= 500 &&
        activityPresented >= 5 && activityDirtyMarks >= 5;
      const menuActivityFps = activityUseful
        ? activityPresented * 1000 / activityDurationMs : null;
      const menuActivityDirtyMarksPerSecond = activityUseful
        ? activityDirtyMarks * 1000 / activityDurationMs : null;
      const settledForMs = menuActivityLastChangeAt === null
        ? null : Math.max(0, endedAt - menuActivityLastChangeAt);
      // A number of FunOrb menus animate through a finite transition and then
      // intentionally stop repainting. A delayed fixed window reports 0 FPS
      // when that transition becomes faster. Use its complete active interval
      // only after it has settled; continuously animated menus retain the
      // ordinary fixed-window measurement.
      const useCompletedActivity = activityUseful && settledForMs >= 500;
      const effectiveFps = useCompletedActivity ? menuActivityFps : fps;
      const fpsBasis = useCompletedActivity
        ? 'completed-menu-activity' : 'fixed-window';
      const finishMeasurement = async () => {
        let cpuProfile = null;
        if (cpuProfilePromise) {
          const controller = await cpuProfilePromise;
          const profile = await controller.stop();
          cpuProfile = summarizeCpuProfile(profile, controller.error);
        }
        finish('fps-measured', {
          surface,
          screenshot: menuScreenshot,
          frameHistory,
          fpsMeasurement: {
            durationMs,
            presented,
            fps,
            effectiveFps,
            basis: fpsBasis,
            dirtyMarks,
            dirtyMarksPerSecond:
              durationMs > 0 ? dirtyMarks * 1000 / durationMs : 0,
          },
          menuActivityMeasurement: {
            durationMs: activityDurationMs,
            presented: activityPresented,
            fps: menuActivityFps,
            dirtyMarks: activityDirtyMarks,
            dirtyMarksPerSecond: menuActivityDirtyMarksPerSecond,
            settledForMs,
          },
          jitProfile: specification.profileJit ? jitProfileSnapshot(jvm) : undefined,
          jitCounters: jitRuntimeCounters(jvm),
          schedulerTimings: schedulerTimingSnapshot(jvm),
          cpuProfile,
        }, effectiveFps >= specification.minFps ? 0 : 4);
      };
      finishMeasurement().catch((error) => {
        finish('error', {
          error: String(error && (error.stack || error.message) || error),
          surface,
          frameHistory,
        }, 1);
      });
    } else if (isFirstFrame || isMenu && specification.measureFpsMs <= 0) {
      clearInterval(timer);
      const screenshot = isMenu ? writeSurfacePng(jvm, game, 'main-menu') : null;
      finish(isMenu ? 'main-menu' : 'first-frame', {
        surface,
        screenshot,
        frameHistory,
        jitProfile: specification.profileJit ? jitProfileSnapshot(jvm) : undefined,
        jitCounters: jitRuntimeCounters(jvm),
        schedulerTimings: schedulerTimingSnapshot(jvm),
      }, 0);
    } else if (fpsStartedAt === null &&
        Date.now() - startedAt >= specification.timeoutMs) {
      clearInterval(timer);
      finish('timeout', {
        surface,
        screenshot: writeSurfacePng(jvm, game, 'timeout'),
        frameHistory,
        threads: threadSnapshot(jvm),
        jitProfile: specification.profileJit ? jitProfileSnapshot(jvm) : undefined,
        jitCounters: jitRuntimeCounters(jvm),
        schedulerTimings: schedulerTimingSnapshot(jvm),
      }, 2);
    }
  }, 100);
  if (specification.cpuProfile && specification.measureFpsMs <= 0 &&
      specification.until !== 'main-menu') {
    cpuProfilePromise = startCpuProfile();
  }
  const runPromise = jvm.run(game.mainClass, {args: []});
  runPromise.then(() => {
    clearInterval(timer);
    finish('exited', {
      surface: surfaceSnapshot(jvm),
      screenshot: writeSurfacePng(jvm, game, 'exited'),
      frameHistory,
      threads: threadSnapshot(jvm),
      jitProfile: specification.profileJit ? jitProfileSnapshot(jvm) : undefined,
      jitCounters: jitRuntimeCounters(jvm),
      schedulerTimings: schedulerTimingSnapshot(jvm),
    }, 3);
  }, (error) => {
    clearInterval(timer);
    finish('error', {
      error: String(error && (error.stack || error.message) || error),
      surface: surfaceSnapshot(jvm),
      screenshot: writeSurfacePng(jvm, game, 'error'),
      frameHistory,
      threads: threadSnapshot(jvm),
      jitProfile: specification.profileJit ? jitProfileSnapshot(jvm) : undefined,
      jitCounters: jitRuntimeCounters(jvm),
      schedulerTimings: schedulerTimingSnapshot(jvm),
    }, 1);
  });
}

function startTcpBridge(remoteHost) {
  const sockets = new Set();
  const server = net.createServer(client => {
    const upstream = net.createConnection({
      host: remoteHost,
      port: REMOTE_TCP_PORT,
    });
    sockets.add(client);
    sockets.add(upstream);
    client.pipe(upstream).pipe(client);
    const close = () => {
      sockets.delete(client);
      sockets.delete(upstream);
      client.destroy();
      upstream.destroy();
    };
    client.on('error', close);
    upstream.on('error', close);
    client.on('close', close);
    upstream.on('close', close);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(TCP_PORT, '127.0.0.1', () => resolve({
      close: () => {
        for (const socket of sockets) socket.destroy();
        server.close();
      },
    }));
  });
}

function startHttpBridge(remoteHost) {
  const server = http.createServer((request, response) => {
    const upstream = https.request({
      hostname: remoteHost,
      port: 443,
      method: request.method,
      path: request.url,
      headers: {...request.headers, host: remoteHost},
    }, upstreamResponse => {
      response.writeHead(upstreamResponse.statusCode || 502,
        upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    upstream.on('error', error => {
      if (!response.headersSent) response.writeHead(502);
      response.end(String(error.message || error));
    });
    request.pipe(upstream);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(HTTP_PROXY_PORT, '127.0.0.1',
      () => resolve({close: () => server.close()}));
  });
}

async function fetchConfig(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`AlterOrb config request failed: ${response.status}`);
  }
  return response.json();
}

function tailLines(value, count = Number(
  process.env.ALTERORB_JVMJS_REPORT_TAIL_LINES,
) || 300) {
  return String(value).trim().split(/\r?\n/).slice(-count);
}

function runChild(game, options) {
  const jarPath = options.jarOverride || gamepackPath(game);
  if (!fs.existsSync(jarPath)) {
    return Promise.resolve({
      game: game.internalName,
      name: game.name,
      mainClass: game.mainClass,
      status: 'missing-jar',
      elapsedMs: 0,
    });
  }
  const actualHash = sha256(jarPath);
  if (!options.jarOverride && actualHash !== game.gamepackHash) {
    return Promise.resolve({
      game: game.internalName,
      name: game.name,
      mainClass: game.mainClass,
      status: 'hash-mismatch',
      expectedHash: game.gamepackHash,
      actualHash,
      elapsedMs: 0,
    });
  }
  let classesDir = null;
  if (options.recompiled) {
    const validation = validateRecompiledClasses(
      game, jarPath, options.classesOverride);
    if (!validation.ok) {
      return Promise.resolve({
        game: game.internalName,
        name: game.name,
        mainClass: game.mainClass,
        variant: 'recompiled',
        status: validation.status,
        classesDir: validation.classesDir,
        expectedClasses: validation.expectedClasses,
        missingClasses: validation.missingClasses,
        elapsedMs: 0,
      });
    }
    classesDir = validation.classesDir;
  }
  const artifacts = {
    gamepack: {path: jarPath, sha256: actualHash},
    recompiledClasses: classesDir ? {
      path: classesDir,
      ...hashClassTree(classesDir),
    } : null,
  };
  const specification = Buffer.from(JSON.stringify({
    game,
    jarPath,
    classesDir,
    variant: options.recompiled ? 'recompiled' : 'original',
    timeoutMs: options.timeoutMs,
    until: options.until,
    noJit: options.noJit,
    measureFpsMs: options.measureFpsMs,
    minFps: options.minFps,
    profileJit: options.profileJit,
    cpuProfile: options.cpuProfile,
    menuAdvanceClick: options.menuAdvanceClick,
    menuSceneTransitions: options.menuSceneTransitions,
  })).toString('base64');
  const workerResultPath = path.join(ROOT, '.work', 'alterorb-jvmjs',
    'worker-results', `${process.pid}-${game.internalName}-` +
      `${crypto.randomBytes(8).toString('hex')}.json`);
  return new Promise(resolve => {
    // Preserve diagnostic/runtime V8 flags (for example optimization tracing)
    // in workers. Environment variables alone cannot carry every allowed V8
    // option, and silently dropping execArgv makes provenance misleading.
    const child = spawn(process.execPath, [...process.execArgv, __filename], {
      cwd: ROOT,
      env: {
        ...process.env,
        ALTERORB_JVMJS_WORKER: specification,
        ALTERORB_JVMJS_WORKER_RESULT: workerResultPath,
        JAVA_TOOLS_DIR,
        JVM_WASM_JIT: process.env.JVM_WASM_JIT || '1',
        JVM_WASM_STRUCTURED: process.env.JVM_WASM_STRUCTURED || '1',
        JVM_ENABLE_RENDERER_PIPELINE:
          process.env.JVM_ENABLE_RENDERER_PIPELINE || '1',
        JVM_FAKE_TIME: process.env.JVM_FAKE_TIME || '1000000000000',
        JVM_FAKE_TIME_REALTIME:
          process.env.JVM_FAKE_TIME_REALTIME || '1',
        JVM_PROFILE_SCHEDULER_TIMES: options.profileJit
          ? (process.env.JVM_PROFILE_SCHEDULER_TIMES || '64')
          : (process.env.JVM_PROFILE_SCHEDULER_TIMES || ''),
        JVM_DEBUG_ARRAY_OOB: process.env.JVM_DEBUG_ARRAY_OOB || '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    // The rolling buffers below cap worker output for result reporting; V8
    // diagnostic streams (for example --trace-opt) exceed them by orders of
    // magnitude, so mirror the full streams to disk on request.
    const childLogStream = process.env.ALTERORB_JVMJS_CHILD_LOG
      ? fs.createWriteStream(path.join(
        process.env.ALTERORB_JVMJS_CHILD_LOG,
        `child-${game.internalName}-${process.pid}-` +
          `${crypto.randomBytes(4).toString('hex')}.log`))
      : null;
    child.stdout.on('data', chunk => {
      if (childLogStream) childLogStream.write(chunk);
      stdout += chunk;
      if (stdout.length > 262144) stdout = stdout.slice(-131072);
    });
    child.stderr.on('data', chunk => {
      if (childLogStream) childLogStream.write(chunk);
      stderr += chunk;
      if (stderr.length > 262144) stderr = stderr.slice(-131072);
    });
    child.on('error', error => resolve({
      game: game.internalName,
      name: game.name,
      mainClass: game.mainClass,
      status: 'spawn-error',
      error: String(error.stack || error),
      elapsedMs: 0,
    }));
    child.on('exit', (code, signal) => {
      if (fs.existsSync(workerResultPath)) {
        try {
          const workerResult = JSON.parse(fs.readFileSync(
            workerResultPath, 'utf8'));
          fs.unlinkSync(workerResultPath);
          resolve({
            ...workerResult,
            artifacts,
            exitCode: code,
            signal,
            stderrTail: tailLines(stderr),
          });
          return;
        } catch (_) {
          // Fall through to the legacy stdout transport and diagnostics.
        }
      }
      const resultLine = stdout.split(/\r?\n/)
        .find(line => line.startsWith(RESULT_PREFIX));
      if (resultLine) {
        try {
          resolve({
            ...JSON.parse(resultLine.slice(RESULT_PREFIX.length)),
            artifacts,
            exitCode: code,
            signal,
            stderrTail: tailLines(stderr),
          });
          return;
        } catch (_) {
          // Fall through to an invalid-result report.
        }
      }
      resolve({
        game: game.internalName,
        name: game.name,
        mainClass: game.mainClass,
        status: 'invalid-worker-result',
        artifacts,
        exitCode: code,
        signal,
        stdoutTail: tailLines(stdout),
        stderrTail: tailLines(stderr),
        elapsedMs: 0,
      });
    });
  });
}

async function runPool(games, options, onResult) {
  const results = [];
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= games.length) return;
      const game = games[index];
      const started = Date.now();
      console.log(`[${index + 1}/${games.length}] launch ${game.internalName}`);
      const result = await runChild(game, options);
      results.push(result);
      if (onResult) onResult(results);
      console.log(`[${index + 1}/${games.length}] ${game.internalName}: ` +
        `${result.status} ${(result.elapsedMs / 1000).toFixed(1)}s` +
        (result.fpsMeasurement
          ? ` fps=${Number(result.fpsMeasurement.effectiveFps ??
            result.fpsMeasurement.fps).toFixed(2)}` +
            (result.fpsMeasurement.basis === 'completed-menu-activity'
              ? ' (active transition)' : '')
          : '') +
        ` wall=${((Date.now() - started) / 1000).toFixed(1)}s`);
    }
  }
  await Promise.all(Array.from({length: Math.min(options.jobs, games.length)},
    () => worker()));
  return results;
}

function buildReport(config, options, results, expectedCount, complete) {
  const sortedResults = results.slice()
    .sort((left, right) => left.game.localeCompare(right.game));
  const counts = {};
  for (const result of sortedResults) {
    counts[result.status] = (counts[result.status] || 0) + 1;
  }
  return {
    schema: 1,
    createdAt: new Date().toISOString(),
    configUrl: options.configUrl,
    configVersion: config.version,
    server: config.server,
    timeoutMs: options.timeoutMs,
    until: options.until,
    noJit: options.noJit,
    variant: options.recompiled ? 'recompiled' : 'original',
    measureFpsMs: options.measureFpsMs,
    minFps: options.minFps,
    profileJit: options.profileJit,
    cpuProfile: options.cpuProfile,
    menuAdvanceClick: options.menuAdvanceClick,
    menuSceneTransitions: options.menuSceneTransitions,
    provenance: options.provenance,
    jobs: options.jobs,
    complete,
    completedGames: sortedResults.length,
    expectedGames: expectedCount,
    counts,
    results: sortedResults,
  };
}

function writeReportAtomically(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), {recursive: true});
  const temporaryPath = `${reportPath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, JSON.stringify(report, null, 2) + '\n');
  fs.renameSync(temporaryPath, reportPath);
}

async function main() {
  const workerSpec = process.env.ALTERORB_JVMJS_WORKER;
  if (workerSpec) {
    const specification = JSON.parse(Buffer.from(workerSpec, 'base64')
      .toString('utf8'));
    await runWorker(specification);
    return;
  }

  const options = parseArgs(process.argv.slice(2));
  if (options.classesOverride && options.games.length !== 1) {
    throw new Error('--classes-dir requires exactly one --game');
  }
  options.provenance = collectRunProvenance(options);
  execFileSync(process.execPath, [
    path.join(JAVA_TOOLS_DIR, 'scripts', 'generate-jre-index.js'),
  ], {stdio: 'ignore'});
  buildHookStub();
  const config = await fetchConfig(options.configUrl);
  let games = config.games || [];
  if (options.games.length) {
    const selected = new Set(options.games);
    games = games.filter(game => selected.has(game.internalName));
    const missing = options.games.filter(name =>
      !games.some(game => game.internalName === name));
    if (missing.length) {
      throw new Error(`Unknown AlterOrb game(s): ${missing.join(', ')}`);
    }
  }
  console.log(`AlterOrb JVM.js smoke launch: games=${games.length} ` +
    `jobs=${options.jobs} timeout=${options.timeoutMs}ms until=${options.until} ` +
    `measureFps=${options.measureFpsMs}ms minFps=${options.minFps} ` +
    `variant=${options.recompiled ? 'recompiled' : 'original'}`);
  await Promise.all(games.map(game => ensureGamepack(game, options.configUrl)));
  const remoteHost = new URL(config.server).hostname;
  const [tcpBridge, httpBridge] = await Promise.all([
    startTcpBridge(remoteHost),
    startHttpBridge(remoteHost),
  ]);
  let results;
  try {
    results = await runPool(games, options, partialResults => {
      writeReportAtomically(options.report,
        buildReport(config, options, partialResults, games.length, false));
    });
  } finally {
    tcpBridge.close();
    httpBridge.close();
  }
  const report = buildReport(config, options, results, games.length, true);
  writeReportAtomically(options.report, report);
  console.log(`Report: ${options.report}`);
  console.log(`Summary: ${JSON.stringify(report.counts)}`);
  const expectedStatus = options.measureFpsMs > 0 ? 'fps-measured'
    : options.until === 'main-menu' ? 'main-menu' : 'first-frame';
  if (results.some(result => result.status !== expectedStatus ||
      options.measureFpsMs > 0 &&
      Number(result.fpsMeasurement &&
        (result.fpsMeasurement.effectiveFps ??
          result.fpsMeasurement.fps)) <
        options.minFps)) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}

module.exports = {
  classifyMenuSurface,
  effectiveRuntimeGates,
  enqueueSyntheticMouseClick,
  hasMenuAdvanceSettled,
  isPostLogoLoadingSurface,
  parseArgs,
  sceneDifference,
  shouldResetMenuCandidateOnSceneTransition,
  summarizeCpuProfile,
  threadSnapshot,
};
