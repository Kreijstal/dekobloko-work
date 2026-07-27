#!/usr/bin/env node
'use strict';

// Boot a FunOrb gamepack on the java-tools JavaScript JVM (headless).
//
// Usage:
//   node scripts/run-jvmjs.js [gamepack.jar] [--class client] [--max-insns N] [--trace]
//     [--load-state file.json]
//     [--save-state file.json --save-after-ms N [--exit-after-save]] [key=value ...]
//     [--replay-awt file.awtlog] [--replay-speed N] [--replay-start-after-ms N]
//     [--replay-delay-after-ms N --replay-extra-delay-ms N]
//     [--replay-wait-static-null class.field[,class.field...]]
//
// Defaults to the repo-root dekobloko.jar and entry class `client`.
// key=value pairs override/extend the applet parameters.
// --max-insns N stops after N interpreted instructions and dumps a
// per-thread trace snapshot (exit code 3) — useful because the game loop
// never terminates on its own.
//
// JAVA_TOOLS_DIR must point at a java-tools checkout (default: ~/git/java-tools).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const JAVA_TOOLS_DIR = process.env.JAVA_TOOLS_DIR || path.join(os.homedir(), 'git', 'java-tools');

function parseArgs(argv) {
  const options = {
    jar: path.join(ROOT, 'dekobloko.jar'),
    mainClass: 'client',
    codeBase: null,
    maxInsns: null,
    trace: false,
    loadState: null,
    saveState: null,
    saveAfterMs: null,
    exitAfterSave: false,
    replayAwt: null,
    replaySpeed: 1,
    replayStartAfterMs: 0,
    replayDelayAfterMs: null,
    replayExtraDelayMs: 0,
    replayWaitStaticNull: [],
    params: {},
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--class') {
      options.mainClass = argv[++i];
    } else if (arg === '--codebase') {
      options.codeBase = argv[++i];
    } else if (arg === '--max-insns') {
      options.maxInsns = Number(argv[++i]);
    } else if (arg === '--trace') {
      options.trace = true;
    } else if (arg === '--load-state') {
      options.loadState = path.resolve(argv[++i]);
    } else if (arg === '--save-state') {
      options.saveState = path.resolve(argv[++i]);
    } else if (arg === '--save-after-ms') {
      options.saveAfterMs = Number(argv[++i]);
    } else if (arg === '--exit-after-save') {
      options.exitAfterSave = true;
    } else if (arg === '--replay-awt') {
      options.replayAwt = path.resolve(argv[++i]);
    } else if (arg === '--replay-speed') {
      options.replaySpeed = Number(argv[++i]);
    } else if (arg === '--replay-start-after-ms') {
      options.replayStartAfterMs = Number(argv[++i]);
    } else if (arg === '--replay-delay-after-ms') {
      options.replayDelayAfterMs = Number(argv[++i]);
    } else if (arg === '--replay-extra-delay-ms') {
      options.replayExtraDelayMs = Number(argv[++i]);
    } else if (arg === '--replay-wait-static-null') {
      const value = argv[++i];
      if (value === undefined) throw new Error('--replay-wait-static-null requires a value');
      options.replayWaitStaticNull = value.split(',').filter(Boolean);
    } else if (arg.includes('=')) {
      const eq = arg.indexOf('=');
      options.params[arg.slice(0, eq)] = arg.slice(eq + 1);
    } else {
      options.jar = path.resolve(arg);
    }
  }
  return options;
}

function parseAwtReplay(contents) {
  const entries = [];
  for (const [index, rawLine] of String(contents).split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const columns = line.split('\t');
    if (columns.length !== 13) {
      throw new Error(`Invalid AWT replay line ${index + 1}: expected 13 tab-separated columns`);
    }
    const values = columns.slice(2).map(Number);
    const timeMillis = Number(columns[0]);
    if (!Number.isFinite(timeMillis) || values.some((value) => !Number.isFinite(value))) {
      throw new Error(`Invalid numeric value on AWT replay line ${index + 1}`);
    }
    entries.push({
      timeMillis,
      kind: columns[1],
      id: values[0],
      modifiers: values[1],
      x: values[2],
      y: values[3],
      button: values[4],
      clickCount: values[5],
      keyCode: values[6],
      keyChar: values[7],
      keyLocation: values[8],
      scrollAmount: values[9],
      wheelRotation: values[10],
    });
  }
  return entries;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));
}

function readStaticField(jvm, specification) {
  const separator = specification.lastIndexOf('.');
  if (separator <= 0 || separator === specification.length - 1) {
    throw new Error(`Invalid static field specification: ${specification}`);
  }
  const className = specification.slice(0, separator).replace(/\./g, '/');
  const fieldName = specification.slice(separator + 1);
  const classData = jvm.classes && jvm.classes[className];
  if (!classData || !classData.staticFields) return { found: false, value: undefined };
  for (const [key, value] of classData.staticFields) {
    if (key.startsWith(`${fieldName}:`)) return { found: true, value };
  }
  return { found: false, value: undefined };
}

async function waitForStaticNulls(jvm, specifications, timeoutMillis = 300000) {
  if (!specifications.length) return;
  const initial = specifications.map((specification) => {
    const state = readStaticField(jvm, specification);
    return `${specification}=${!state.found ? 'missing' : (state.value === null ? 'null' : 'non-null')}`;
  });
  console.error(`jvmjs: AWT replay waiting for static nulls ${initial.join(',')}`);
  const deadline = Date.now() + timeoutMillis;
  while (true) {
    const states = specifications.map((specification) => readStaticField(jvm, specification));
    if (states.every((state) => state.found && state.value === null)) break;
    if (Date.now() >= deadline) {
      throw new Error(`Timeout waiting for static nulls: ${specifications.join(',')}`);
    }
    await delay(100);
  }
  console.error(`jvmjs: AWT replay static nulls reached ${specifications.join(',')}`);
}

function componentChildren(component) {
  return component && Array.isArray(component._components) ? component._components : [];
}

function deepestComponentAt(component, x, y) {
  if (!component) return null;
  const children = componentChildren(component);
  for (let i = children.length - 1; i >= 0; i -= 1) {
    const child = children[i];
    if (!child || child._visible === false) continue;
    const childX = Number(child._x) || 0;
    const childY = Number(child._y) || 0;
    const width = Number(child._width) || 0;
    const height = Number(child._height) || 0;
    if (width > 0 && height > 0 &&
        x >= childX && y >= childY && x < childX + width && y < childY + height) {
      return deepestComponentAt(child, x - childX, y - childY);
    }
  }
  return { component, x, y };
}

function allComponents(root) {
  const result = [];
  const visit = (component) => {
    if (!component || result.includes(component)) return;
    result.push(component);
    for (const child of componentChildren(component)) visit(child);
  };
  visit(root);
  return result;
}

function callbackForEntry(entry) {
  const mouseCallbacks = new Map([
    [500, ['mouse', 'mouseClicked']],
    [501, ['mouse', 'mousePressed']],
    [502, ['mouse', 'mouseReleased']],
    [503, ['mouseMotion', 'mouseMoved']],
    [504, ['mouse', 'mouseEntered']],
    [505, ['mouse', 'mouseExited']],
    [506, ['mouseMotion', 'mouseDragged']],
  ]);
  const keyCallbacks = new Map([
    [400, ['key', 'keyTyped']],
    [401, ['key', 'keyPressed']],
    [402, ['key', 'keyReleased']],
  ]);
  if (entry.kind === 'key') return keyCallbacks.get(entry.id) || null;
  if (entry.kind === 'wheel') return ['mouseWheel', 'mouseWheelMoved'];
  return mouseCallbacks.get(entry.id) || null;
}

function replayEvent(entry, source, localX, localY) {
  const isKey = entry.kind === 'key';
  const isWheel = entry.kind === 'wheel';
  return {
    type: isKey
      ? 'java/awt/event/KeyEvent'
      : (isWheel ? 'java/awt/event/MouseWheelEvent' : 'java/awt/event/MouseEvent'),
    source,
    component: source,
    id: entry.id,
    when: Date.now(),
    modifiers: entry.modifiers,
    x: localX,
    y: localY,
    button: entry.button,
    clickCount: entry.clickCount,
    keyCode: entry.keyCode,
    keyChar: entry.keyChar,
    keyLocation: entry.keyLocation,
    scrollAmount: entry.scrollAmount,
    wheelRotation: entry.wheelRotation,
    popupTrigger: false,
    consumed: false,
    fields: {},
  };
}

async function waitForReplayThread(thread, timeoutMillis = 30000) {
  const deadline = Date.now() + timeoutMillis;
  while (thread.status !== 'terminated') {
    if (Date.now() >= deadline) {
      throw new Error(`AWT replay callback timed out on thread ${thread.id}`);
    }
    await delay(1);
  }
}

async function invokeReplayListener(jvm, thread, listener, methodName, descriptor, event) {
  const listenerType = listener && (listener._className || listener.type);
  if (!listenerType) return false;
  const method = await jvm.findMethodInHierarchy(listenerType, methodName, descriptor);
  if (!method) return false;
  const Frame = invokeReplayListener.Frame ||
    (invokeReplayListener.Frame = require(path.join(JAVA_TOOLS_DIR, 'src', 'core', 'frame')));
  const frame = new Frame(method);
  frame.className = listenerType;
  frame.locals[0] = listener;
  frame.locals[1] = event;
  thread.callStack.push(frame);
  thread.status = 'runnable';
  await waitForReplayThread(thread);
  return true;
}

async function runAwtReplay(jvm, applet, entries, options) {
  if (!entries.length) throw new Error('AWT replay contains no events');
  const Stack = require(path.join(JAVA_TOOLS_DIR, 'src', 'core', 'stack'));
  const replayThread = {
    id: 1000000,
    name: 'awt-replay',
    callStack: new Stack(),
    status: 'terminated',
    pendingException: null,
  };
  jvm.threads.push(replayThread);

  const speed = options.replaySpeed;
  await delay(options.replayStartAfterMs);
  const components = allComponents(applet);
  const listenerSummary = components.map((component) => {
    const listeners = component._listeners || {};
    return Object.entries(listeners)
      .filter(([, values]) => Array.isArray(values) && values.length)
      .map(([kind, values]) => `${kind}=${values.length}`)
      .join(',');
  }).filter(Boolean);
  console.error(`jvmjs: AWT replay start events=${entries.length} speed=${speed}` +
    ` startAfterMs=${options.replayStartAfterMs} listeners=${listenerSummary.join(';') || 'none'}`);

  let previousMillis = 0;
  let extraDelayApplied = false;
  let dispatched = 0;
  let callbacks = 0;
  for (const entry of entries) {
    if (!extraDelayApplied && options.replayDelayAfterMs !== null &&
        previousMillis <= options.replayDelayAfterMs &&
        entry.timeMillis > options.replayDelayAfterMs) {
      console.error(`jvmjs: AWT replay extra delay=${options.replayExtraDelayMs}ms` +
        ` after recorded t=${options.replayDelayAfterMs}ms`);
      await delay(options.replayExtraDelayMs);
      await waitForStaticNulls(jvm, options.replayWaitStaticNull);
      extraDelayApplied = true;
    }
    await delay((entry.timeMillis - previousMillis) / speed);
    previousMillis = entry.timeMillis;
    const callback = callbackForEntry(entry);
    if (!callback) continue;
    const [listenerKind, methodName] = callback;
    let located;
    if (entry.kind === 'key') {
      const keyComponents = allComponents(applet);
      const target = keyComponents.find((component) =>
        component._focused && component._listeners && component._listeners.key && component._listeners.key.length) ||
        keyComponents.find((component) =>
          component._listeners && component._listeners.key && component._listeners.key.length) || applet;
      located = { component: target, x: 0, y: 0 };
    } else {
      located = deepestComponentAt(applet, entry.x, entry.y) || { component: applet, x: entry.x, y: entry.y };
    }
    const target = located.component;
    const event = replayEvent(entry, target, located.x, located.y);
    const listeners = target && target._listeners && target._listeners[listenerKind] || [];
    for (const listener of listeners) {
      const descriptor = entry.kind === 'key'
        ? '(Ljava/awt/event/KeyEvent;)V'
        : (entry.kind === 'wheel'
          ? '(Ljava/awt/event/MouseWheelEvent;)V'
          : '(Ljava/awt/event/MouseEvent;)V');
      if (await invokeReplayListener(jvm, replayThread, listener, methodName, descriptor, event)) {
        callbacks += 1;
      }
    }
    dispatched += 1;
    if (entry.id === 500 || entry.id === 501 || entry.id === 502 || dispatched % 100 === 0) {
      console.error(`jvmjs: AWT replay event=${dispatched}/${entries.length}` +
        ` t=${entry.timeMillis}ms kind=${entry.kind} id=${entry.id}` +
        ` x=${entry.x} y=${entry.y} callbacks=${callbacks}`);
    }
  }
  console.error(`jvmjs: AWT replay done dispatched=${dispatched} callbacks=${callbacks}`);
}

function extractJar(jarPath) {
  // A directory of .class files can be used directly as the classpath entry.
  if (fs.statSync(jarPath).isDirectory()) return jarPath;
  const name = path.basename(jarPath).replace(/\.jar$/i, '');
  const classesDir = path.join(ROOT, '.work', 'jvmjs', name, 'classes');
  const stamp = path.join(classesDir, '.extracted');
  if (!fs.existsSync(stamp) || fs.statSync(stamp).mtimeMs < fs.statSync(jarPath).mtimeMs) {
    fs.rmSync(classesDir, { recursive: true, force: true });
    fs.mkdirSync(classesDir, { recursive: true });
    execFileSync('unzip', ['-o', '-q', jarPath, '*.class', '-d', classesDir]);
    fs.writeFileSync(stamp, '');
  }
  return classesDir;
}

function buildHookStub() {
  const source = path.join(ROOT, 'stubs', 'src', 'net', 'alterorb', 'launcher', 'Hook.java');
  const outDir = path.join(ROOT, '.work', 'jvmjs', 'hookcp');
  const classFile = path.join(outDir, 'net', 'alterorb', 'launcher', 'Hook.class');
  if (!fs.existsSync(classFile) || fs.statSync(classFile).mtimeMs < fs.statSync(source).mtimeMs) {
    fs.mkdirSync(outDir, { recursive: true });
    execFileSync('javac', ['-source', '8', '-target', '8', '-d', outDir, source], { stdio: ['ignore', 'ignore', 'inherit'] });
  }
  return outDir;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.loadState && options.saveState) {
    throw new Error('--load-state and --save-state cannot be used together');
  }
  if (options.saveAfterMs !== null && !options.saveState) {
    throw new Error('--save-after-ms requires --save-state file.json');
  }
  if (options.exitAfterSave && !options.saveState) {
    throw new Error('--exit-after-save requires --save-state file.json');
  }
  if (!Number.isFinite(options.replaySpeed) || options.replaySpeed <= 0) {
    throw new Error('--replay-speed must be a positive number');
  }
  if (!Number.isFinite(options.replayStartAfterMs) || options.replayStartAfterMs < 0) {
    throw new Error('--replay-start-after-ms must be a non-negative number');
  }
  if (options.replayDelayAfterMs !== null &&
      (!Number.isFinite(options.replayDelayAfterMs) || options.replayDelayAfterMs < 0)) {
    throw new Error('--replay-delay-after-ms must be a non-negative number');
  }
  if (!Number.isFinite(options.replayExtraDelayMs) || options.replayExtraDelayMs < 0) {
    throw new Error('--replay-extra-delay-ms must be a non-negative number');
  }
  if (options.replayExtraDelayMs > 0 && options.replayDelayAfterMs === null) {
    throw new Error('--replay-extra-delay-ms requires --replay-delay-after-ms N');
  }
  if (options.replayWaitStaticNull.length && options.replayDelayAfterMs === null) {
    throw new Error('--replay-wait-static-null requires --replay-delay-after-ms N');
  }
  if (options.replayAwt && !fs.existsSync(options.replayAwt)) {
    throw new Error(`AWT replay not found: ${options.replayAwt}`);
  }
  if (!fs.existsSync(JAVA_TOOLS_DIR)) {
    throw new Error(`java-tools not found at ${JAVA_TOOLS_DIR} (set JAVA_TOOLS_DIR)`);
  }
  if (!fs.existsSync(options.jar)) {
    throw new Error(`Gamepack not found: ${options.jar}`);
  }

  // src/jre/index.js is generated and gitignored; regenerate so a fresh
  // checkout (or stale index) does not crash on a missing module.
  execFileSync('node', [path.join(JAVA_TOOLS_DIR, 'scripts', 'generate-jre-index.js')], { stdio: 'ignore' });

  if (options.trace || options.maxInsns) {
    process.env.JVM_TRACE = '1';
  }
  if (options.maxInsns) {
    process.env.JVM_TRACE_EXIT = String(options.maxInsns);
  }

  // Dekobloko's startup is dominated by numeric table construction, archive
  // decoding, and software rendering loops. Use the validated WebAssembly
  // tier by default while retaining JVM_WASM_JIT=0 as an explicit opt-out.
  if (process.env.JVM_WASM_JIT === undefined) {
    process.env.JVM_WASM_JIT = '1';
  }

  const classesDir = extractJar(options.jar);
  const hookDir = buildHookStub();
  const { JVM } = require(path.join(JAVA_TOOLS_DIR, 'src', 'core', 'jvm'));

  // Same parameter set as apps/launcher DekoblokoLauncher.
  const appletParameters = Object.assign({
    overxgames: '45',
    overxachievements: '1000',
    member: 'no',
    gameport1: '43594',
    gameport2: '43594',
    servernum: '8003',
    instanceid: '1234567',
    gamecrc: '0',
  }, options.params);

  const jvm = new JVM({
    classpath: [classesDir, hookDir],
    appletParameters,
    appletCodeBase: options.codeBase || undefined,
  });
  if (process.env.JVM_BENCHMARK_METADATA === '1') {
    const jit = jvm.jit;
    const structured = jit && jit.structuredSsa;
    const fused = jit && jit.fusedRegions;
    const wasm = jit && jit.wasmJit;
    console.error('[jvm-benchmark-gates] ' + JSON.stringify({
      eventLoopYieldMs: jvm.eventLoopYieldMs,
      eventLoopYieldStrategy: jvm.eventLoopYieldStrategy,
      interpreterBurst: jvm.interpreterBurst,
      fakeTime: Boolean(jvm.clock && jvm.clock.enabled),
      fakeTimeRealtime: Boolean(jvm.clock && jvm.clock.realtime),
      jit: {
        enabled: Boolean(jit && jit.enabled),
        profileMethods: Boolean(jit && jit.profileMethods),
        profileTimings: Boolean(jit && jit.profileTimings),
        preferWholeMethodJs: Boolean(jit && jit.preferWholeMethodJs),
        rendererPipeline: Boolean(jit && jit.rendererPipelineEnabled),
        scalarLoops: Boolean(jit && jit.scalarLoopsEnabled),
        scalarGuestBodies: Boolean(jit && jit.scalarGuestBodiesEnabled),
        scalarSsaOptimizations: Boolean(jit && jit.scalarSsaOptimizationsEnabled),
        longArithmeticWasmFirst: Boolean(jit && jit.longArithmeticWasmFirstEnabled),
      },
      wasm: {
        enabled: Boolean(wasm && wasm.enabled),
        structured: Boolean(wasm && wasm.structuredEnabled),
      },
      structuredSsa: {
        enabled: Boolean(structured && structured.enabled),
        continuations: Boolean(structured && structured.continuationsEnabled),
        dispatchIslands: Boolean(structured && structured.dispatchIslandsEnabled),
        deferredCallMaterialization: Boolean(
          structured && structured.deferredCallMaterializationEnabled),
        localValueNumbering: Boolean(structured && structured.localValueNumberingEnabled),
        guardedStaticBooleans: Boolean(
          structured && structured.guardedStaticBooleansEnabled),
        coarseCountedLoopSafePoints: Boolean(
          structured && structured.coarseCountedLoopSafePointsEnabled),
        atomicBoundedLoops: Boolean(structured && structured.atomicBoundedLoopsEnabled),
      },
      fusedRegions: {
        enabled: Boolean(fused && fused.enabled),
        directCalls: Boolean(fused && fused.directCallsEnabled),
        lexicalKernels: Boolean(fused && fused.lexicalKernelsEnabled),
        handwrittenKernels: Boolean(fused && fused.handwrittenKernelsEnabled),
        semanticRasterKernels: Boolean(fused && fused.semanticRasterKernelsEnabled),
      },
    }));
    process.once('exit', () => {
      console.error('[jvm-benchmark-counters] ' + JSON.stringify({
        structuredSsaRuns: Number(structured && structured.runCount) || 0,
        structuredSsaSafePoints: Number(structured && structured.safePointCount) || 0,
        fusedRuns: Number(jit && jit.fusedRunCount) || 0,
        fusedDirectRuns: Number(jit && jit.fusedDirectRunCount) || 0,
        fusedGuardedFallbacks: Number(jit && jit.fusedGuardedFallbackCount) || 0,
        fusedRestoredExceptionFrames:
          Number(jit && jit.fusedRestoredExceptionFrameCount) || 0,
        handwrittenFusedRegions:
          Number(jit && jit.handwrittenFusedRegionCount) || 0,
        handwrittenFusedRuns:
          Number(jit && jit.handwrittenFusedRunCount) || 0,
        semanticFusedWrapperRuns:
          Number(jit && jit.semanticFusedWrapperRunCount) || 0,
        semanticFusedRasterRuns:
          Number(jit && jit.semanticFusedRasterRunCount) || 0,
        semanticFusedFlatRasterRuns:
          Number(jit && jit.semanticFusedFlatRasterRunCount) || 0,
        lexicalFusedKernels:
          Number(jit && jit.lexicalFusedKernelCount) || 0,
        fusedDirectEntries: Number(
          fused && Array.isArray(fused.directEntries) && fused.directEntries.length) || 0,
        fusedResolvedDirectEntries: fused && Array.isArray(fused.directEntries)
          ? fused.directEntries.filter((entry) => entry && entry.target).length : 0,
        fusedUnresolvedDirectEntries: fused && Array.isArray(fused.directEntries)
          ? fused.directEntries.filter((entry) => entry && entry.unresolved).length : 0,
        fusedRejectedDirectEntries: fused && Array.isArray(fused.directEntries)
          ? fused.directEntries.filter((entry) => entry && entry.permanentlyRejected).length : 0,
        fusedDirectAttempts: Number(fused && fused.directAttemptCount) || 0,
        fusedDirectFallbacksByReason: fused && fused.directFallbackCounts
          ? Object.fromEntries(fused.directFallbackCounts) : {},
        fusedDirectEntryStates: fused && Array.isArray(fused.directEntries)
          ? fused.directEntries.map((entry) => ({
            owner: entry && (entry.target && entry.target.lookupClass ||
              entry.unresolved && entry.unresolved.owner) || null,
            descriptor: entry && (entry.target && entry.target.method &&
              entry.target.method.descriptor ||
              entry.unresolved && entry.unresolved.descriptor) || null,
            resolved: Boolean(entry && entry.target),
            compiled: Boolean(entry && (entry.region ||
              entry.target && fused.cache.get(entry.target.method))),
            permanentlyRejected: Boolean(entry && entry.permanentlyRejected),
            rejectedEpoch: entry && entry.rejectedEpoch || null,
          })) : [],
        wasmRuns: Number(wasm && wasm.runCount) || 0,
        oversizedWasmFirstMethods:
          Number(jit && jit.oversizedWasmFirstMethodCount) || 0,
        longArithmeticWasmFirstMethods:
          Number(jit && jit.longArithmeticWasmFirstMethodCount) || 0,
        adaptiveWholeMethodPromotions:
          Number(jit && jit.adaptiveWholeMethodPromotionCount) || 0,
        adaptiveWholeMethodEscalations:
          Number(jit && jit.adaptiveWholeMethodEscalationCount) || 0,
      }));
    });
  }

  let appletInstance = null;
  if (options.replayAwt) {
    const createAppletInstance = jvm.createAppletInstance.bind(jvm);
    jvm.createAppletInstance = async (...args) => {
      appletInstance = await createAppletInstance(...args);
      return appletInstance;
    };
  }

  if (options.loadState) {
    let state;
    try {
      state = JSON.parse(fs.readFileSync(options.loadState, 'utf8'));
    } catch (error) {
      throw new Error(`Cannot load save state ${options.loadState}: ${error.message}`);
    }
    const restored = await jvm.loadState(state);
    console.error(`jvmjs: loaded save state ${options.loadState}` +
      (restored.externalResources.length
        ? ` (${restored.externalResources.length} host resources omitted or reopened)` : ''));
    await jvm.execute();
    return;
  }

  if (options.saveState) {
    if (!Number.isFinite(options.saveAfterMs) || options.saveAfterMs < 0) {
      throw new Error('--save-state requires --save-after-ms N');
    }
    setTimeout(() => {
      try {
        const state = jvm.saveState();
        fs.mkdirSync(path.dirname(options.saveState), { recursive: true });
        fs.writeFileSync(options.saveState, JSON.stringify(state));
        console.error(`jvmjs: saved state ${options.saveState} ` +
          `(${state.graph.nodes.length} heap nodes, ${state.externalResources.length} external resources)`);
        if (options.exitAfterSave) setImmediate(() => process.exit(0));
      } catch (error) {
        console.error(`jvmjs: save state failed: ${error.stack || error}`);
        if (options.exitAfterSave) setImmediate(() => process.exit(1));
      }
    }, options.saveAfterMs);
  }

  const progressMs = Number(process.env.JVM_DEBUG_PROGRESS_MS);
  if (Number.isFinite(progressMs) && progressMs > 0) {
    const timer = setInterval(() => {
      console.error('--- JVM progress ---');
      for (const thread of jvm.threads) {
        const frames = thread.callStack && thread.callStack.items;
        const frame = frames && frames[frames.length - 1];
        const method = frame && frame.method;
        const location = frame
          ? `${frame.className}.${method && method.name}${(method && method.descriptor) || ''} pc=${frame.pc}`
          : '<no frame>';
        console.error(`thread ${thread.id} (${thread.name}) status=${thread.status}: ${location}`);
      }
      if (process.env.JVM_PROFILE_HOT_METHODS === '1' ||
          process.env.JVM_PROFILE_HOT_METHODS_WITH_JIT === '1') {
        jvm.dumpHotMethods(Number(process.env.JVM_PROFILE_HOT_METHODS_LIMIT || 10));
      }
      if (process.env.JVM_DEBUG_JIT === '1' && jvm.jit) {
        jvm.jit.dumpStats(Number(process.env.JVM_DEBUG_JIT_LIMIT || 10));
      }
      jvm.dumpSoftCanvases();
    }, progressMs);
    timer.unref();
  }

  console.error(`jvmjs: booting ${path.basename(options.jar)} class=${options.mainClass}` +
    (options.maxInsns ? ` (stopping after ${options.maxInsns} instructions)` : ''));
  const runPromise = jvm.run(options.mainClass, { args: [] });
  if (options.replayAwt) {
    const entries = parseAwtReplay(fs.readFileSync(options.replayAwt, 'utf8'));
    let runFinished = false;
    let runFailure = null;
    runPromise.then(
      () => { runFinished = true; },
      (error) => { runFailure = error; runFinished = true; },
    );
    const appletDeadline = Date.now() + 300000;
    while (!appletInstance && !runFinished && Date.now() < appletDeadline) await delay(1);
    if (runFailure) throw runFailure;
    if (!appletInstance) {
      throw new Error(runFinished
        ? 'JVM exited before creating the applet instance'
        : 'Timeout waiting for the applet instance');
    }
    runAwtReplay(jvm, appletInstance, entries, options).catch((error) => {
      console.error(`jvmjs: AWT replay failed: ${error.stack || error}`);
      setImmediate(() => process.exit(1));
    });
  }
  await runPromise;
}

module.exports = { callbackForEntry, parseAwtReplay, readStaticField, replayEvent };

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}
