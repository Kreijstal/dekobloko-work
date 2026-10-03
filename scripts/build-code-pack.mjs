#!/usr/bin/env node
// Dev-only: produce (or check) a JIT code pack for the browser game page by
// running the page's own ahead-of-main preparation pass in Node, with the
// exact runtime bundle the page will load.
//
//   node scripts/build-code-pack.mjs record --bundle DIR --out PACK
//   node scripts/build-code-pack.mjs replay --bundle DIR --pack PACK
//   node scripts/build-code-pack.mjs verify --bundle DIR --pack PACK
//
// DIR is the directory GAME_LIBRARY_BUNDLE_DIR names (the page's runtime is
// DIR/jvm-debug-current.js; --script picks another file name). Other flags:
// --game ID (dekobloko), --jar FILE (default as the server resolves it),
// --java-tools DIR (node_modules for JSZip), --world FILE (dump the prepared
// world: site tables, prepared set, body digests), --trace FILE.
//
// record: fresh JVM, every method compiled, every entry written to PACK.
// replay: fresh JVM, entries served from PACK; each materialized body is
//         re-serialized and compared with the entry it came from.
// verify: fresh JVM, everything compiled locally; each fresh entry is compared
//         byte for byte with PACK's entry under the same key.
// Exit status is non-zero when replay or verify finds any difference.
//
// The bundle is loaded through its UMD wrapper, so Node runs the same code the
// browser runs, with the bundle's own process shim (empty environment). The
// page options below mirror scripts/serve-game-library.js for a URL with no
// query parameters; the identity hashes them, so any drift makes the browser
// refuse the pack instead of replaying it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {codePackIdentity, codePackConfiguration, createCodePackStore,
  decodeCodePack, encodeCodePack, installCodePack, sameIdentity} from
  '../apps/launcher/browser-loader/code-pack.mjs';
import {configureApplet} from '../apps/launcher/browser-loader/applet-config.mjs';

const require = createRequire(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const mode = args.shift();
const flag = (name, fallback = null) => {
  const at = args.indexOf('--' + name);
  return at >= 0 ? args[at + 1] : fallback;
};
if (!['record', 'replay', 'verify'].includes(mode)) {
  console.error('usage: build-code-pack.mjs record|replay|verify --bundle DIR ' +
    '[--out PACK | --pack PACK] [--game ID] [--jar FILE]');
  process.exit(2);
}
const bundleDir = path.resolve(flag('bundle', process.env.GAME_LIBRARY_BUNDLE_DIR || '.'));
const javaToolsRoot = path.resolve(flag('java-tools',
  process.env.JAVA_TOOLS_ROOT || path.resolve(repositoryRoot, '..', 'java-tools')));
const bundleFile = path.join(bundleDir, flag('script', 'jvm-debug-current.js'));
const gameId = flag('game', 'dekobloko');
const config = JSON.parse(fs.readFileSync(
  path.join(repositoryRoot, '.work', 'game-library', 'config.json'), 'utf8'));
const catalogGame = config.games.find(game => game.internalName === gameId);
if (!catalogGame) throw new Error('unknown game ' + gameId);
const jarFile = path.resolve(flag('jar',
  process.env['GAME_LIBRARY_JAR_' + gameId.toUpperCase().replace(/[^A-Z0-9]/g, '_')] ||
  path.join(repositoryRoot, '.work', 'gamepacks', gameId + '.jar')));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// The game object the page receives in its asset manifest.
const game = {
  id: catalogGame.internalName,
  name: catalogGame.name,
  mainClass: catalogGame.mainClass,
  gamecrc: catalogGame.gamecrc,
  server: String(config.server).replace(/\/?$/, '/'),
};

// The runtime asks the host what it is (WasmJit's browser default, the
// bundle's window-only registrations such as the Web Audio backend), so Node
// presents the same answers a page does. Preparation runs no guest code and
// touches no DOM; the document is an empty object.
globalThis.window = globalThis;
globalThis.document = {};
Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:154.0) Gecko/20100101 Firefox/154.0',
  hardwareConcurrency: 4, language: 'en-US'}});
// webpack's automatic publicPath needs a script URL at load time; a worker
// global supplies one without a document. Removed again right after loading.
globalThis.importScripts = () => {};
globalThis.location = new URL('http://localhost/');
const JVMDebug = require(bundleFile);
// Only for the world digest below (both runs being compared use the same).
const {dropDiagnosticSource} = require(path.join(javaToolsRoot, 'src', 'jit',
  'PreparedCodeCache.js'));
delete globalThis.importScripts;
delete globalThis.location;
const debug = new JVMDebug.BrowserJVMDebug();
// The bundle loads JSZip as a webpack chunk, which has no loader in Node. The
// bundle's chunk is this same package, so entry order is the same.
debug.fileProvider.getJSZip = async () => require(
  path.join(javaToolsRoot, 'node_modules', 'jszip'));

// ---- page options for a URL with no query (serve-game-library.js) ----
const options = debug.debugController.options;
options.jit = {
  ...(options.jit || {}),
  codegen: true,
  rendererPipeline: true,
  scalarLoops: true,
  scalarGuestBodies: true,
  scalarSsaOptimizations: false,
  structuredSsa: true,
  structuredDeferredCallMaterialization: true,
  ordinaryAdaptiveFramelessPositional: true,
  adaptiveFramelessBudgetMultiplier: 100,
  preferWholeMethodJs: true,
  profileTimings: false,
  methodTimingSampleRate: 128,
  adaptiveWholeMethodEscalationThreshold: 16,
  checkedLeafDirectPositional: true,
  wasmSynchronizedInstanceLinks: true,
  wasmSynchronizedStaticLinks: true,
  wasm: {
    ...((options.jit || {}).wasm || {}),
    deepInline: true,
    checkcast: true,
  },
};
options.wasmHeapMb = 512;
options.prepareBeforeMain = true;
options.prepareWasmPreparedUpgradesOnly = true;
options.prepareWasm = true;
options.prepareEffectful = true;
options.prepareLoopsOnly = false;
configureApplet(debug.debugController, game, {simpleMode: true});
options.eventLoopYieldStrategy = 'message-channel';
options.schedulerTimingRate = 256;
{
  const jit = debug.debugController.jvm.jit;
  jit.rendererPipelineEnabled = true;
  jit.scalarLoopsEnabled = true;
  jit.scalarGuestBodiesEnabled = true;
  jit.structuredSsa.enabled = true;
}
await debug.initialize();
const jarBytes = new Uint8Array(fs.readFileSync(jarFile));
// The page names the archive after the game, whatever the file is called.
await debug.fileProvider.loadJarArchive(jarBytes, gameId + '.jar');

// Same classes, same method keys, same async-ness as the page's overrides.
// Preparation never calls them; they exist so the JVM resolves the same JRE
// methods the page's JVM does.
const stub = () => 0;
const asyncStub = async () => 0;
const methods = (keys, asyncKeys = []) => Object.fromEntries([
  ...keys.map(key => [key, stub]), ...asyncKeys.map(key => [key, asyncStub])]);
options.jreOverrides = {
  'net/alterorb/launcher/Hook': {methods: methods([
    'cacheRedirect(Ljava/lang/String;Ljava/lang/String;)Ljava/io/File;'])},
  'java/io/File': {methods: methods(['exists()Z', 'length()J', 'delete()Z',
    'mkdir()Z', 'mkdirs()Z'])},
  'java/io/RandomAccessFile': {methods: methods([
    '<init>(Ljava/io/File;Ljava/lang/String;)V', 'read()I', 'read([BII)I',
    'write(I)V', 'write([B)V', 'write([BII)V', 'seek(J)V', 'length()J', 'close()V'])},
  'java/util/zip/CRC32': {methods: methods(['<init>()V', 'reset()V',
    'update([BII)V', 'getValue()J'])},
  'java/util/zip/Inflater': {methods: methods(['<init>()V', '<init>(Z)V',
    'setInput([BII)V', 'reset()V', 'end()V'], ['inflate([B)I'])},
  'um': {natives: {applicationFallback: true}, methods: methods([], ['a(I[BII)[B'])},
  'java/lang/Runtime': {methods: methods(['availableProcessors()I',
    'freeMemory()J', 'totalMemory()J', 'maxMemory()J'])},
  'java/net/Socket': {methods: methods(['<init>(Ljava/net/InetAddress;I)V',
    'connect(Ljava/net/SocketAddress;)V', 'setSoTimeout(I)V', 'setTcpNoDelay(Z)V',
    'getOutputStream()Ljava/io/OutputStream;', 'getInputStream()Ljava/io/InputStream;',
    'close()V'])},
  'java/net/InetAddress': {methods: methods([
    'getByName(Ljava/lang/String;)Ljava/net/InetAddress;'])},
  'java/net/SocketInputStream': {methods: methods(['available()I', 'close()V'],
    ['read()I', 'read([B)I', 'read([BII)I'])},
  'java/net/SocketOutputStream': {methods: methods(['write(I)V', 'write([B)V',
    'write([BII)V', 'flush()V', 'close()V'])},
  'java/applet/AppletContext': {methods: methods([
    'showDocument(Ljava/net/URL;)V',
    'showDocument(Ljava/net/URL;Ljava/lang/String;)V',
    'showStatus(Ljava/lang/String;)V'])},
};
if (game.id !== 'dekobloko') delete options.jreOverrides.um;
configureApplet(debug.debugController, game, {simpleMode: true});

const identity = codePackIdentity({runtimeVersion: sha256(bundleFile),
  jarVersion: sha256(jarFile), options});
let pack = null;
if (mode !== 'record') {
  pack = decodeCodePack(fs.readFileSync(path.resolve(flag('pack'))));
  if (!sameIdentity(pack.identity, identity)) {
    console.error('pack identity differs', {pack: pack.identity, here: identity});
    process.exit(1);
  }
}
const store = createCodePackStore(mode, pack);
// --trace FILE: one line per cache lookup (method, watermark, outcome) and
// per compile (which lookup it ran under); compare two runs step by step.
const traceFile = flag('trace');
const trace = [];
if (traceFile) {
  const get = store.get, put = store.put;
  store.get = async (key, maxBytes) => {
    const text = await get(key, maxBytes);
    const [, method, watermark] = JSON.parse(key);
    trace.push({method, watermark, served: text != null});
    return text;
  };
  store.put = async (key, text) => {
    const lookups = trace.filter(row => row.method);
    lookups[lookups.length - 1].put = true;
    return put(key, text);
  };
}

// Replay check: every materialized body, serialized again by the same JIT,
// must reproduce the payload it was built from.
const replayCheck = {checked: 0, identical: 0, differed: 0, firstDifference: null};
const STOP = Symbol('preparation finished');
let preparation = null;
const started = performance.now();
await debug.run(game.mainClass, {
  beforeRun: ({jvm}) => {
    if (mode === 'replay') {
      const jit = jvm.jit;
      const materialize = jit.materializeGeneratedResult.bind(jit);
      // The payloads PreparedCodeCache is about to materialize, in order:
      // the entry's own body, then each nested-compile companion.
      let pending = [];
      const get = store.get;
      store.get = async (key, maxBytes) => {
        const text = await get(key, maxBytes);
        pending = [];
        if (text != null) {
          const entry = JSON.parse(text);
          if (entry.payload) pending.push({method: entry.method, payload: entry.payload});
          for (const row of entry.companions || []) {
            if (row.payload) pending.push({method: row.className + '.' + row.name + row.descriptor,
              payload: row.payload});
          }
        }
        return text;
      };
      // Provenance stamps the world at serialization time, and `dropped`
      // lists the closures transport never carries; neither is code.
      // Site tables are compared through the world digest instead.
      const normalize = payload => JSON.stringify(payload, (key, value) =>
        key === 'provenance' || key === 'dropped' || key === 'siteTables' ? undefined : value);
      jit.materializeGeneratedResult = (payload, method, opts) => {
        const body = materialize(payload, method, opts);
        if (opts !== undefined || !pending.length) return body;
        const expected = pending.shift();
        replayCheck.checked++;
        if (!body) return body;
        const again = jit.serializeGeneratedResult(body);
        const a = normalize(again || {}), b = normalize(expected.payload);
        if (a === b) replayCheck.identical++;
        else {
          replayCheck.differed++;
          if (!replayCheck.firstDifference) {
            let at = 0;
            while (at < a.length && a[at] === b[at]) at++;
            replayCheck.firstDifference = {method: expected.method, at,
              again: a.slice(Math.max(0, at - 80), at + 160),
              pack: b.slice(Math.max(0, at - 80), at + 160)};
          }
        }
        return body;
      };
    }
    if (traceFile) {
      // Every compile, in order, tagged with the lookup it happened under.
      const compileMethod = jvm.jit.compileMethod;
      jvm.jit.compileMethod = function (target, ...rest) {
        const compileKey = (jvm.findClassNameForMethod(target) || '?') + '.' +
          target.name + target.descriptor;
        trace.push({compile: compileKey, step: trace.filter(row => row.method).length - 1});
        return compileMethod.call(this, target, ...rest);
      };
      const wasm = jvm.jit.wasmJit;
      if (wasm && typeof wasm.compile === 'function') {
        const wasmCompile = wasm.compile;
        wasm.compile = function (request, ...rest) {
          const target = request?.method;
          trace.push({wasmCompile: target ? (jvm.findClassNameForMethod(target) || '?') + '.' +
            target.name + target.descriptor : '?',
          step: trace.filter(row => row.method).length - 1});
          return wasmCompile.call(this, request, ...rest);
        };
      }
    }
    installCodePack(jvm, {identity, store, onReport: (result, stats) => {
      preparation = {result, stats, jvm};
      throw STOP;
    }});
  },
}).catch(error => {
  if (error?.cause !== STOP && error !== STOP) throw error;
});
const elapsedMs = Math.round(performance.now() - started);
if (!preparation) throw new Error('preparation did not run');
const {result, jvm} = preparation;
const report = result.report;
const census = jvm.jit.syncCompileCensus();
const summary = {
  mode, elapsedMs, identity,
  methods: report.methods, rounds: report.rounds, newBodies: report.newBodies,
  unprepared: report.unprepared, wasmMethods: report.wasmMethods,
  tiers: report.tiers, deferredDeepWasm: report.deferredDeepWasm,
  wasmSettled: report.wasmSettled, wasmEnabled: Boolean(jvm.jit.wasmJit?.enabled),
  linkedSites: report.linkedSites, linkedReceivers: report.linkedReceivers,
  preparedCache: report.preparedCache, store: store.stats,
  preMainSyncCompileCount: census.preMainSyncCompileCount,
  preMainSyncCompileMs: Math.round(census.preMainSyncCompileMs),
  classes: Object.keys(jvm.classes).length,
  watermark: jvm.jit.siteIdWatermark(),
  replayCheck: mode === 'replay' ? replayCheck : undefined,
};
function methodKeyOf(jvm, method) {
  return (jvm.findClassNameForMethod(method) || '?') + '.' + method.name + method.descriptor;
}
// A digest of the world preparation leaves behind, for comparing runs.
const world = {
  classes: Object.keys(jvm.classes),
  prepared: [...jvm.classes ? Object.entries(jvm.classes) : []].flatMap(([name, data]) =>
    (data?.ast?.classes?.[0]?.items || []).filter(item => item?.type === 'method' &&
      jvm.jit.preparedCodegenMethods.has(item.method))
      .map(item => name + '.' + item.method.name + item.method.descriptor)),
  watermark: jvm.jit.siteIdWatermark(),
  // Every id-indexed table entry, by what it denotes, and which indices
  // share one site object.
  syncCallSites: jvm.jit.syncCallSites.map((site, index) => site ? [
    site.op, site.declaredClassName, site.methodName, site.descriptor,
    site.callerPc, site.callerMethod ? methodKeyOf(jvm, site.callerMethod) : null,
    site.id === index ? null : site.id] : null),
  fieldSites: jvm.jit.fieldSites.map(site => site ?
    [site.className, site.fieldName, site.descriptor] : null),
  directStaticTargets: jvm.jit.directStaticTargets.map(target => target ?
    [target.siteClassName, target.key] : null),
  classInitializationGuards: jvm.jit.structuredSsa.classInitializationGuards
    .map(guard => guard ? [...(guard.owners || [])] : null),
  // Every published body, as the text and metadata it would transport
  // (diagnostic source copies left out, as entries carry them), hashed.
  bodies: Object.entries(jvm.classes).flatMap(([name, data]) =>
    (data?.ast?.classes?.[0]?.items || []).filter(item => item?.type === 'method' &&
      jvm.jit.codegenCache.has(item.method)).map(item => {
      const body = jvm.jit.codegenCache.get(item.method);
      let text = String(body);
      if (typeof body === 'function') {
        const payload = jvm.jit.serializeGeneratedResult(body);
        if (payload) {
          dropDiagnosticSource(payload);
          text = JSON.stringify(payload, (key, value) =>
            key === 'provenance' || key === 'dropped' ? undefined : value);
        } else text = 'unserializable:' + (body.jvmGeneratedSource || body.name);
      }
      return name + '.' + item.method.name + item.method.descriptor + ' ' +
        crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
    })),
  wasmReady: [...jvm.classes ? Object.entries(jvm.classes) : []].flatMap(([name, data]) =>
    (data?.ast?.classes?.[0]?.items || []).filter(item => item?.type === 'method' &&
      jvm.jit.wasmJit?.state?.get(item.method)?.status === 'ready')
      .map(item => name + '.' + item.method.name + item.method.descriptor)),
};
summary.worldDigest = crypto.createHash('sha256').update(JSON.stringify(world)).digest('hex');
if (traceFile) fs.writeFileSync(traceFile, trace.map(row => JSON.stringify(row)).join('\n') + '\n');
const worldOut = flag('world');
if (worldOut) fs.writeFileSync(worldOut, JSON.stringify(world));
if (mode === 'record') {
  const out = path.resolve(flag('out'));
  const bytes = encodeCodePack({identity, entries: store.written, meta: {
    createdAt: new Date().toISOString(), bundle: bundleFile, jar: jarFile,
    configuration: codePackConfiguration(options), worldDigest: summary.worldDigest,
    nodeCompileMs: summary.preMainSyncCompileMs}});
  fs.writeFileSync(out, bytes);
  summary.pack = {file: out, entries: store.written.size, bytes: bytes.length};
}
console.log(JSON.stringify(summary, null, 1));
const failed = mode === 'verify' && (store.stats.differed || store.stats.missingInPack) ||
  mode === 'replay' && (replayCheck.differed || report.preparedCache?.refused ||
    report.preparedCache?.misses !== report.preparedCache?.unrecorded);
process.exit(failed ? 1 : 0);
