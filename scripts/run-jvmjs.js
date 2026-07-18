#!/usr/bin/env node
'use strict';

// Boot a FunOrb gamepack on the java-tools JavaScript JVM (headless).
//
// Usage:
//   node scripts/run-jvmjs.js [gamepack.jar] [--class client] [--max-insns N] [--trace]
//     [--load-state file.json]
//     [--save-state file.json --save-after-ms N [--exit-after-save]] [key=value ...]
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
    } else if (arg.includes('=')) {
      const eq = arg.indexOf('=');
      options.params[arg.slice(0, eq)] = arg.slice(eq + 1);
    } else {
      options.jar = path.resolve(arg);
    }
  }
  return options;
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

  if (options.loadState) {
    const state = JSON.parse(fs.readFileSync(options.loadState, 'utf8'));
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
        if (options.exitAfterSave) process.exitCode = 1;
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
  await jvm.run(options.mainClass, { args: [] });
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
