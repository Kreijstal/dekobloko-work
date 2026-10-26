// Own a local Firefox session, run the decompiled GitHub sources, and enter
// level zero through Java reflection. Print one result; save no screenshots
// or measurement reports. The single browser profile retains useful caches.
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(new URL('../../../blank-github-cloner/package.json', import.meta.url));

async function reflectStartLevel() {
  const jvm = window.geobloxSession.debug.debugController.jvm;
  const mirror = jvm.getClassObjectSync('rl');
  const parameters = ['byte', 'int', 'int'].map(name => ({type: 'java/lang/Class', isPrimitive: true, name}));
  const method = jvm.jre['java/lang/Class'].methods['getDeclaredMethod(Ljava/lang/String;[Ljava/lang/Class;)Ljava/lang/reflect/Method;'](
    jvm, mirror, ['a', parameters]);
  jvm.jre['java/lang/reflect/Method'].methods['setAccessible(Z)V'](jvm, method, [1]);
  method._methodData.className ||= 'rl';
  const base = jvm.threads[0];
  const thread = {...base, id: jvm.threads.length, name: 'diagnostic-reflection',
    status: 'runnable', pendingException: null, callStack: new base.callStack.constructor()};
  // Method.invoke permits an absent caller, whereas CallStack.peek throws
  // for an empty stack. Adapt only this owned diagnostic thread's stack.
  const peek = thread.callStack.peek;
  thread.callStack.peek = function () {return this.isEmpty() ? null : peek.call(this);};
  jvm.threads.push(thread);
  const previous = jvm.currentThreadIndex;
  let invocation;
  try {
    jvm.currentThreadIndex = thread.id;
    invocation = jvm.jre['java/lang/reflect/Method'].methods['invoke(Ljava/lang/Object;[Ljava/lang/Object;)Ljava/lang/Object;'](
      jvm, method, [null, [26, 0, 0]], thread);
  } finally {jvm.currentThreadIndex = previous;}
  await invocation;
  jvm.resumeForHostEvent();
  return thread.id;
}

async function measureFrames(milliseconds) {
  const jvm = window.geobloxSession.debug.debugController.jvm;
  const stats = jvm._awtPresentationStats;
  const before = jvm.jit.closedWorld.stats(), first = stats.presented, start = performance.now();
  await new Promise(resolve => setTimeout(resolve, milliseconds));
  const elapsedMs = performance.now() - start, after = jvm.jit.closedWorld.stats();
  return {elapsedMs, frames: stats.presented - first, fps: (stats.presented - first) * 1000 / elapsedMs,
    counters: Object.fromEntries(['entries', 'parks', 'slowCalls', 'preempted'].map(key => [key, (after[key] || 0) - (before[key] || 0)])),
    closedWorld: after, heap: jvm.wasmHeap.usage(),
    recentFrameTimings: stats.recentFrameTimings.slice(-8)};
}

export async function diagnoseCrazyCrystals({context: suppliedContext, baseURL = 'http://127.0.0.1:5173/'} = {}) {
  const startedAt = new Date().toISOString();
  const context = suppliedContext || await require('playwright').firefox.launchPersistentContext(
    path.join(os.homedir(), '.cache/dekobloko/crazycrystals-browser'), {
      headless: true, viewport: {width: 1000, height: 760},
      firefoxUserPrefs: {'javascript.options.wasm_js_promise_integration': true},
    });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Keep source edits from hot-reloading an owned diagnostic session.
  await page.routeWebSocket('**', socket => socket.close());
  try {
    const url = new URL(baseURL);
    url.searchParams.set('game', 'crazycrystals');
    await page.goto(url.href, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => {
      const jvm = window.geobloxSession?.debug?.debugController?.jvm;
      return jvm?.classes.a?.staticFields.get('field_b:Lue;')?.type === 're' ||
        document.getElementById('geoblox-loader')?.classList.contains('error');
    }, {}, {timeout: 0});
    const identity = await page.evaluate(async () => {
      const session = window.geobloxSession, jvm = session.debug.debugController.jvm;
      if (!jvm.jit.closedWorld?.built) throw new Error('Closed-world module was not built');
      const cache = JSON.parse(await window.gitConsole.fs.promises.readFile('/runtime-bundle/cache.json', 'utf8'));
      const {sha256} = await import('/jvm-source-bundler.js');
      return {browser: navigator.userAgent, navigationToMenuMs: performance.now(),
        jspi: typeof WebAssembly.Suspending === 'function',
        runtimeSourceCommit: cache.sourceCommit,
        runtimeBundleSha256: await sha256(new TextEncoder().encode(cache.assets['jvm-debug.js'])),
        gameSourceCommit: session.sourceIdentity, cachedCompilation: session.compilation.cached,
        game: {menu: jvm.classes.a.staticFields.get('field_b:Lue;')?.type,
          level: jvm.classes.dk.staticFields.get('field_h:I')}};
    });
    const menu = await page.evaluate(measureFrames, 8000);
    const reflectionThread = await page.evaluate(reflectStartLevel);
    await page.waitForFunction(id => {
      const jvm = window.geobloxSession?.debug?.debugController?.jvm;
      return jvm?.threads[id]?.status === 'terminated' &&
        jvm.classes.r.staticFields.get('field_m:Z') &&
        jvm.classes.qn.staticFields.get('field_n:I') >= 640;
    }, reflectionThread, {timeout: 0});
    const gameplay = await page.evaluate(measureFrames, 8000);
    const state = await page.evaluate(() => {
      const jvm = window.geobloxSession.debug.debugController.jvm;
      return {worldActive: Boolean(jvm.classes.r.staticFields.get('field_m:Z')),
        level: jvm.classes.dk.staticFields.get('field_h:I'),
        boardRows: jvm.classes.tm.staticFields.get('field_d:[[Lf;')?.length,
        runtimeFailure: window.geobloxSession.runtimeFailure || null};
    });
    if (!state.worldActive || !state.boardRows || state.runtimeFailure || errors.length)
      throw new Error(JSON.stringify({state, errors}));
    return {startedAt, host: os.hostname(), headless: true, cpuSlowdown: 1,
      acceptanceVerified: false, measurement: 'headless canvas presentation counters',
      identity, menu, gameplay, state, errors};
  } finally {
    await page.close();
    if (!suppliedContext) await context.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await diagnoseCrazyCrystals({baseURL: process.argv[2]})));
}
