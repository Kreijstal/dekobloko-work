'use strict';

// The configuration registry: every environment variable this repository owns,
// what reads it, what it defaults to, and where its precedence is surprising.
//
// Purpose (in order):
//   1. Make the effective configuration of a run INSPECTABLE, so a result can
//      say what it actually ran with instead of what the README says it should
//      have run with. `node scripts/print-effective-config.js` prints it;
//      `snapshot()` attaches it to a result file.
//   2. Record precedence and consumers as they are TODAY. This file documents
//      current behaviour; it does not change it. Several entries are marked
//      `divergent: true` because two consumers disagree -- that disagreement is
//      preserved here on purpose so it can be migrated deliberately later.
//
// Out of scope by repository boundary: the JVM_*, STRUCTURED_GOTO_*,
// PIPELINE_* and TERMINAL_* gates. Those select java-tools runtime tiers and
// bytecode passes and are owned by java-tools. They are captured verbatim by
// `snapshot()` under `runtimeGates` (because they change results and therefore
// belong in provenance) but they are not documented here.
//
// No import-time side effects.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// group: which responsibility owns the variable.
// consumers: repository-relative path of every file that reads the variable.
//   Line numbers are resolved LIVE by locateConsumers() rather than stored,
//   because stored line numbers rot on the next edit and then quietly lie.
// defaultText: the default AS IMPLEMENTED, including author-specific ones.
// divergent: two or more consumers disagree about name, default or precedence.
const REGISTRY = [
  // --- dependency location -------------------------------------------------
  {
    name: 'JAVA_TOOLS_DIR',
    group: 'dependency-location',
    summary: 'Path to the java-tools checkout.',
    defaultText: 'no single default; see divergence note',
    divergent: true,
    note:
      'Six different resolution rules exist. scripts/pipeline/bulk-pipeline.js:16 ' +
      'and the CFR family fall back to JT_DIR then the hardcoded author path ' +
      "'/home/kreijstal/git/java-tools'. The benchmark and diagnostics family " +
      'falls back to <repo>/../java-tools. scripts/run-jvmjs.js:28 and ' +
      'scripts/benchmark-dekobloko-node-logo.js:11 fall back to ~/git/java-tools. ' +
      'scripts/serve-game-library.js:10 ignores this variable entirely and reads ' +
      'JAVA_TOOLS_ROOT. scripts/repair-same-int-constant-selectors.js:9 is the ' +
      'only consumer that refuses to guess and exits 2. ' +
      'See scripts/lib/java-tools.js for the strategy table.',
    consumers: [
      'scripts/run-jvmjs.js', 'scripts/pipeline/bulk-pipeline.js',
      'scripts/cfr-shape-db.js', 'scripts/cfr-oracle-select-transform.js',
      'scripts/cfr-marker-count.js', 'scripts/cfr-goto-lab.js',
      'scripts/cfr-goto-reduce-lab.js', 'scripts/cfr-goto-topology.js',
      'scripts/cfr-real-method-lab.js', 'scripts/analyze-cfr-javac.js',
      'scripts/analyze-goto-pass-impact.js',
      'scripts/benchmark-dekobloko-animation.js',
      'scripts/benchmark-dekobloko-node-logo.js',
      'scripts/benchmark-guest-mixer-node.js',
      'scripts/serve-audio-diagnostics.js',
      'scripts/probe-guest-vorbis-node.js', 'scripts/semdiff.js',
      'scripts/find-unsafe-observable-call-duplications.js',
      'scripts/repair-same-int-constant-selectors.js',
      'scripts/test-cfr-pass-regressions.js',
      'scripts/check-mb-chat-name-seed.js',
      'scripts/pipeline/ckClipFlag.js',
      'scripts/pipeline/structural-select-better.js',
      'scripts/validate-loop-entry-candidates.js',
      'scripts/decompile-all-games.sh', 'scripts/compile-check-cfr.sh',
      'scripts/regression-check-all.sh', 'scripts/cfr-goto-interesting.sh',
      'scripts/cfr-goto-interesting-valid-local.sh',
    ],
  },
  {
    name: 'JT_DIR',
    group: 'dependency-location',
    summary: 'Legacy alias for JAVA_TOOLS_DIR, consulted second.',
    defaultText: 'unset',
    consumers: [
      'scripts/pipeline/bulk-pipeline.js', 'scripts/cfr-shape-db.js',
      'scripts/cfr-marker-count.js',
      'scripts/cfr-oracle-select-transform.js', 'scripts/cfr-goto-lab.js',
      'scripts/cfr-goto-reduce-lab.js', 'scripts/cfr-real-method-lab.js',
      'scripts/check-mb-chat-name-seed.js',
      'scripts/pipeline/ckClipFlag.js',
      'scripts/pipeline/structural-select-better.js',
      'scripts/repair-same-int-constant-selectors.js',
      'scripts/test-cfr-pass-regressions.js',
      'scripts/validate-loop-entry-candidates.js',
    ],
    note: 'Not read by any benchmark, diagnostics or browser-library script.',
  },
  {
    name: 'JAVA_TOOLS_ROOT',
    group: 'dependency-location',
    summary: 'java-tools checkout, but ONLY for the browser game library.',
    defaultText: '<repo>/../java-tools',
    divergent: true,
    note:
      'README.md tells you to export JAVA_TOOLS_DIR. That does not configure ' +
      'scripts/serve-game-library.js, which reads this variable instead. ' +
      'docs/browser-game-library.md:30 uses the correct name.',
    consumers: ['scripts/serve-game-library.js'],
  },
  {
    name: 'JAVA_TOOLS_NODE_DEPS_DIR',
    group: 'dependency-location',
    summary: 'Checkout whose node_modules is prepended to NODE_PATH.',
    defaultText: 'divergent; see note',
    divergent: true,
    note:
      'scripts/test-cfr-pass-regressions.js:13 defaults this to the resolved ' +
      'JAVA_TOOLS_DIR. scripts/pipeline/bulk-pipeline.js:17 defaults it to the ' +
      "hardcoded '/home/kreijstal/git/java-tools' EVEN WHEN JAVA_TOOLS_DIR is " +
      'set correctly, so on any other machine the pipeline looks for node ' +
      'dependencies in a directory that does not exist.',
    consumers: [
      'scripts/pipeline/bulk-pipeline.js',
      'scripts/test-cfr-pass-regressions.js',
    ],
  },

  // --- catalog, gamepacks and game serving ---------------------------------
  {
    name: 'ALTERORB_CONFIG_URL',
    group: 'catalog',
    summary: 'Game-catalog source for the browser game library.',
    defaultText: 'https://static.alterorb.net/launcher/v3/config.json',
    note:
      'Standing rule: never contact a public game host. The default URL is ' +
      'only reached when it is set explicitly OR when no cached catalog exists ' +
      'at .work/game-library/config.json (scripts/serve-game-library.js:2259). ' +
      "A file:// URL pins an offline catalog. Prefer the cache or file://.",
    consumers: ['scripts/serve-game-library.js'],
  },
  {
    name: 'GAME_LIBRARY_PORT',
    group: 'game-serving',
    summary: 'HTTP port for the browser game library.',
    defaultText: '3765 (after DEKOBLOKO_BROWSER_PORT)',
    note:
      'The server binds 0.0.0.0, not 127.0.0.1 ' +
      '(scripts/serve-game-library.js:2294).',
    consumers: ['scripts/serve-game-library.js'],
  },
  {
    name: 'DEKOBLOKO_BROWSER_PORT',
    group: 'game-serving',
    summary: 'Legacy alias for GAME_LIBRARY_PORT, consulted second.',
    defaultText: 'unset',
    consumers: ['scripts/serve-game-library.js'],
  },
  {
    name: 'GAME_LIBRARY_BUNDLE_DIR',
    group: 'game-serving',
    summary: 'Directory holding the browser jvm.js runtime bundles.',
    defaultText: '/tmp/dekobloko-browser-bundle',
    divergent: true,
    note:
      'A fixed path under /tmp: it does not survive a reboot and it is not ' +
      'namespaced per checkout. Runs that select a bundle by filename here are ' +
      'not reproducible from the repository alone.',
    consumers: ['scripts/serve-game-library.js'],
  },
  {
    name: 'GAME_LIBRARY_BUNDLE',
    group: 'game-serving',
    summary: 'Runtime bundle filename inside GAME_LIBRARY_BUNDLE_DIR.',
    defaultText: 'jvm-debug-current.js (after DEKOBLOKO_BROWSER_BUNDLE)',
    consumers: ['scripts/serve-game-library.js'],
  },
  {
    name: 'DEKOBLOKO_BROWSER_BUNDLE',
    group: 'game-serving',
    summary: 'Legacy alias for GAME_LIBRARY_BUNDLE, consulted second.',
    defaultText: 'unset',
    consumers: ['scripts/serve-game-library.js'],
  },
  {
    name: 'GAME_LIBRARY_TELEMETRY_PATH',
    group: 'diagnostics',
    summary: 'JSONL telemetry sink for the browser game library.',
    defaultText: '<repo>/.work/telemetry/game-library.jsonl' +
      ' (after DEKOBLOKO_TELEMETRY_PATH)',
    note:
      'scripts/serve-game-library.js creates this directory at MODULE LOAD ' +
      'time (line 46), so merely requiring the file writes to the filesystem.',
    consumers: ['scripts/serve-game-library.js'],
  },
  {
    name: 'DEKOBLOKO_TELEMETRY_PATH',
    group: 'diagnostics',
    summary: 'Legacy alias for GAME_LIBRARY_TELEMETRY_PATH, consulted second.',
    defaultText: 'unset',
    consumers: ['scripts/serve-game-library.js'],
  },
  {
    name: 'GAME_LIBRARY_TCP_BRIDGE_HOST',
    group: 'game-serving',
    summary: 'Upstream host for the WebSocket-to-TCP game bridge.',
    defaultText: '127.0.0.1',
    consumers: ['scripts/serve-game-library.js'],
  },
  {
    name: 'GAME_LIBRARY_TCP_BRIDGE_PORT',
    group: 'game-serving',
    summary: 'Upstream port for the WebSocket-to-TCP game bridge.',
    defaultText: 'per-request',
    consumers: ['scripts/serve-game-library.js'],
  },
  {
    name: 'DEKOBLOKO_BROWSER_JAR',
    group: 'gamepack',
    summary: 'Override gamepack JAR for dekobloko in the browser library.',
    defaultText: 'unset (catalog-validated JAR is used)',
    note: 'Setting it opts the game out of catalog-hash validation.',
    consumers: ['scripts/serve-game-library.js'],
  },
  {
    name: 'FUNORB_GAME_JAR',
    group: 'gamepack',
    summary: 'Gamepack JAR for the Node audio probes and mixer benchmark.',
    defaultText: '<repo>/dekobloko.jar',
    consumers: [
      'scripts/benchmark-guest-mixer-node.js',
      'scripts/probe-guest-vorbis-node.js',
    ],
  },

  // --- headless launcher (scripts/launch-alterorb-games-jvmjs.js) ----------
  {
    name: 'ALTERORB_JVMJS_OFFLINE',
    group: 'headless-launcher',
    summary: 'Force the offline path (loopback guard + cached catalog).',
    defaultText: 'unset',
    consumers: ['scripts/launch-alterorb-games-jvmjs.js'],
  },
  {
    name: 'ALTERORB_JVMJS_WORKER',
    group: 'headless-launcher',
    summary: 'Internal: marks the child process as a launch worker.',
    defaultText: 'unset',
    note: 'Not a user-facing knob; set by the parent when it forks.',
    consumers: ['scripts/launch-alterorb-games-jvmjs.js'],
  },
  {
    name: 'ALTERORB_JVMJS_WORKER_RESULT',
    group: 'headless-launcher',
    summary: 'Internal: path the worker writes its result JSON to.',
    defaultText: 'unset',
    consumers: ['scripts/launch-alterorb-games-jvmjs.js'],
  },
  {
    name: 'ALTERORB_JVMJS_TCP_PORT',
    group: 'headless-launcher',
    summary: 'Loopback port for the game TCP bridge.',
    defaultText: 'see scripts/launch-alterorb-games-jvmjs.js:27',
    consumers: ['scripts/launch-alterorb-games-jvmjs.js'],
  },
  {
    name: 'ALTERORB_JVMJS_HTTP_PROXY_PORT',
    group: 'headless-launcher',
    summary: 'Loopback port for the applet codeBase HTTP server.',
    defaultText: 'see scripts/launch-alterorb-games-jvmjs.js:29',
    consumers: ['scripts/launch-alterorb-games-jvmjs.js'],
  },
  {
    name: 'ALTERORB_JVMJS_CHILD_LOG',
    group: 'diagnostics',
    summary: 'Directory for per-child stdout/stderr logs.',
    defaultText: 'unset (logs are kept in memory and tailed into the report)',
    consumers: ['scripts/launch-alterorb-games-jvmjs.js'],
  },
  {
    name: 'ALTERORB_JVMJS_JS5_LOG',
    group: 'diagnostics',
    summary: 'JS5 request log sink for the headless launcher.',
    defaultText: 'unset',
    consumers: ['scripts/launch-alterorb-games-jvmjs.js'],
  },
  {
    name: 'ALTERORB_JVMJS_CPU_PROFILE_RAW',
    group: 'diagnostics',
    summary: 'Write the raw V8 CPU profile alongside the summary.',
    defaultText: 'unset',
    note:
      'A profiled run is not comparable with an unprofiled one; the result ' +
      'envelope records which it was.',
    consumers: ['scripts/launch-alterorb-games-jvmjs.js'],
  },
  {
    name: 'ALTERORB_JVMJS_RUNTIME_MANIFEST',
    group: 'headless-launcher',
    summary: 'Runtime manifest selecting the jvm.js tier configuration.',
    defaultText: 'unset',
    consumers: ['scripts/launch-alterorb-games-jvmjs.js'],
  },
  {
    name: 'ALTERORB_JVMJS_PREPARE_BEFORE_START',
    group: 'headless-launcher',
    summary: 'Run the preparation phase before starting the measured run.',
    defaultText: 'unset',
    note:
      'Preparation and post-start execution are measured separately; this ' +
      'moves work across that boundary and must be recorded with the result.',
    consumers: ['scripts/launch-alterorb-games-jvmjs.js'],
  },
  {
    name: 'ALTERORB_JVMJS_REPORT_TAIL_LINES',
    group: 'diagnostics',
    summary: 'How many trailing log lines each result keeps.',
    defaultText: '300',
    consumers: ['scripts/launch-alterorb-games-jvmjs.js'],
  },

  // --- audio diagnostics ---------------------------------------------------
  {
    name: 'AUDIO_DIAGNOSTICS_HOST',
    group: 'diagnostics',
    summary: 'Bind host for the audio diagnostics page server.',
    defaultText: 'see scripts/serve-audio-diagnostics.js:15',
    consumers: ['scripts/serve-audio-diagnostics.js'],
  },
  {
    name: 'AUDIO_DIAGNOSTICS_PORT',
    group: 'diagnostics',
    summary: 'Bind port for the audio diagnostics page server.',
    defaultText: 'see scripts/serve-audio-diagnostics.js:16',
    consumers: ['scripts/serve-audio-diagnostics.js'],
  },
  {
    name: 'FUNORB_AUDIO_DATA',
    group: 'diagnostics',
    summary: 'Extracted music/sample data root for the audio diagnostics page.',
    defaultText: 'see scripts/serve-audio-diagnostics.js:13',
    consumers: ['scripts/serve-audio-diagnostics.js'],
  },
  {
    name: 'DEKOBLOKO_SCENE_TRACE',
    group: 'diagnostics',
    summary: 'Recorded scene trace replayed by the audio diagnostics page.',
    defaultText: 'see scripts/serve-audio-diagnostics.js:38',
    consumers: ['scripts/serve-audio-diagnostics.js'],
  },
  {
    name: 'DEKOBLOKO_SCENE_CLASSES_JAR',
    group: 'diagnostics',
    summary: 'Classes JAR backing the scene trace replay.',
    defaultText: 'see scripts/serve-audio-diagnostics.js:40',
    consumers: ['scripts/serve-audio-diagnostics.js'],
  },

  // --- multiplayer server (apps/server-js) ---------------------------------
  {
    name: 'DEKOBLOKO_BOTS',
    group: 'server',
    summary: 'Number of bots the JS server spawns.',
    defaultText: 'see apps/server-js/src/bots.js:657',
    consumers: ['apps/server-js/src/bots.js'],
  },
  {
    name: 'DEKOBLOKO_BOT_STRATEGY',
    group: 'server',
    summary: 'Bot play strategy.',
    defaultText: 'see apps/server-js/src/bots.js:54',
    consumers: ['apps/server-js/src/bots.js'],
  },
  {
    name: 'DEKOBLOKO_ROSTER',
    group: 'server',
    summary: 'Lobby roster size.',
    defaultText: 'see apps/server-js/src/lobby.js:2083',
    consumers: ['apps/server-js/src/lobby.js'],
  },
  {
    name: 'DEKOBLOKO_ROSTER_NAMES',
    group: 'server',
    summary: 'Explicit roster names.',
    defaultText: 'see apps/server-js/src/bots.js:662',
    consumers: ['apps/server-js/src/bots.js'],
  },
  {
    name: 'DEKOBLOKO_ROOMS',
    group: 'server',
    summary: 'Room count.',
    defaultText: 'see apps/server-js/src/game.js:964',
    consumers: ['apps/server-js/src/game.js'],
  },
  {
    name: 'DEKOBLOKO_RESYNC_ON_TRANSITION',
    group: 'server',
    summary: 'Resend authoritative state on lobby/game transitions.',
    defaultText: 'see apps/server-js/src/lobby.js:1301',
    consumers: ['apps/server-js/src/lobby.js'],
  },
  {
    name: 'DEKOBLOKO_AUTHORITATIVE_SNAPSHOTS',
    group: 'server',
    summary: 'Emit authoritative engine snapshots.',
    defaultText: 'see apps/server-js/src/lobby.js:1052',
    consumers: ['apps/server-js/src/lobby.js'],
  },
  {
    name: 'DEKOBLOKO_SYNTHETIC_DIR',
    group: 'server',
    summary: 'Synthetic JS5 cache directory served by the JS server.',
    defaultText: 'see apps/server-js/src/js5.js:29',
    consumers: ['apps/server-js/src/js5.js'],
  },
  {
    name: 'DEKOBLOKO_DEBUG_LOGIN',
    group: 'server',
    summary: 'Verbose login handshake tracing.',
    defaultText: 'unset',
    consumers: ['apps/server-js/src/login.js'],
  },
  {
    name: 'DEKOBLOKO_TRACE_GARBAGE',
    group: 'server',
    summary: 'Trace unrecognised lobby packets.',
    defaultText: 'unset',
    consumers: ['apps/server-js/src/lobby.js'],
  },

  // --- reductions and probes ----------------------------------------------
  {
    name: 'APPLET_HOST_PREFIX',
    group: 'reductions',
    summary: 'URL prefix for the single-file applet host.',
    defaultText: 'see tools/applet-host/server.cjs:30',
    consumers: ['tools/applet-host/server.cjs'],
  },
  {
    name: 'HOST',
    group: 'reductions',
    summary: 'Bind host for the single-file applet host.',
    defaultText: 'see tools/applet-host/server.cjs:26',
    consumers: ['tools/applet-host/server.cjs'],
  },
  {
    name: 'GUEST_REPLAY_CAPTURE_DIR',
    group: 'reductions',
    summary: 'Output directory for guest-replay captures.',
    defaultText: 'see tools/guest-replay/capture.cjs:10',
    consumers: ['tools/guest-replay/capture.cjs'],
  },
  {
    name: 'GUEST_REPLAY_EXTRA_TARGET',
    group: 'reductions',
    summary: 'Additional method target to capture.',
    defaultText: 'unset',
    consumers: ['tools/guest-replay/capture.cjs'],
  },
  {
    name: 'GUEST_REPLAY_AUDIO_SKIP_BLOCKS',
    group: 'reductions',
    summary: 'Audio blocks skipped during capture.',
    defaultText: 'see tools/guest-replay/capture.cjs:24',
    consumers: ['tools/guest-replay/capture.cjs'],
  },
  {
    name: 'GUEST_REPLAY_FORCE_POLLS',
    group: 'reductions',
    summary: 'Force scheduler polls in the resume matrix.',
    defaultText: 'see tools/guest-replay/resume-matrix.cjs:23',
    consumers: ['tools/guest-replay/resume-matrix.cjs'],
  },
  {
    name: 'JAVAC',
    group: 'toolchain',
    summary: 'javac executable used by the differential-methods build.',
    defaultText: "'javac' on PATH",
    consumers: ['tools/differential-methods/build.mjs'],
  },
  {
    name: 'JAVAP',
    group: 'toolchain',
    summary: 'javap executable used by the leaf-method finder.',
    defaultText: "'javap' on PATH",
    consumers: ['tools/find-leaf-methods.js'],
  },

  // --- decompiler / oracle -------------------------------------------------
  {
    name: 'CFR_JAR',
    group: 'decompiler',
    summary: 'CFR jar used as the comparison decompiler.',
    defaultText: '<repo>/lib/cfr.jar',
    consumers: ['scripts/goto-oracle-split.js', 'scripts/compile-check-cfr.sh'],
  },
  {
    name: 'CFR_ORACLE_CATALOG',
    group: 'decompiler',
    summary: 'Transform catalog for the CFR oracle selector.',
    defaultText: 'built-in catalog',
    consumers: ['scripts/cfr-oracle-select-transform.js'],
  },
  {
    name: 'CFR_MARKER_COUNT_TIMEOUT_SECONDS',
    group: 'decompiler',
    summary: 'Per-class timeout for CFR marker counting.',
    defaultText: 'see scripts/cfr-marker-count.js:44',
    consumers: ['scripts/cfr-marker-count.js'],
  },
  {
    name: 'SKIP_PIPELINE_PASSES',
    group: 'decompiler',
    summary: 'Comma-separated pipeline passes to skip.',
    defaultText: 'unset',
    consumers: [
      'scripts/pipeline/bulk-pipeline.js',
      'scripts/cfr-oracle-select-transform.js',
    ],
  },
];

const GROUPS = [...new Set(REGISTRY.map((entry) => entry.group))].sort();

// Variables owned by java-tools. Captured for provenance, not documented here.
const RUNTIME_GATE_PREFIXES = [
  'JVM_', 'STRUCTURED_GOTO_', 'PIPELINE_', 'TERMINAL_', 'BULK_PIPELINE_',
];

function isRuntimeGate(name) {
  return RUNTIME_GATE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

// Resolve a registry entry's consumers to concrete file:line references by
// reading the files now. A consumer file that no longer mentions the variable
// comes back with `lines: []` and `stale: true` -- surfaced, never hidden.
function locateConsumers(entry) {
  return entry.consumers.map((relative) => {
    const absolute = path.join(REPO_ROOT, relative);
    if (!fs.existsSync(absolute)) {
      return {file: relative, exists: false, stale: true, lines: []};
    }
    const lines = [];
    const contents = fs.readFileSync(absolute, 'utf8').split(/\r?\n/);
    for (let index = 0; index < contents.length; index += 1) {
      if (contents[index].includes(entry.name)) lines.push(index + 1);
    }
    return {file: relative, exists: true, stale: lines.length === 0, lines};
  });
}

function byName(name) {
  return REGISTRY.find((entry) => entry.name === name) || null;
}

function divergences() {
  return REGISTRY.filter((entry) => entry.divergent);
}

// The effective configuration of THIS process. Attach it to run results.
//
// `set` lists only registry variables that are actually set, with their values.
// `unset` names the registry variables that are not set, so a reader can tell
// "not configured" from "configured to empty" -- never substitute a default
// into `set` and never report an unavailable value as zero or absent.
function snapshot(env = process.env, {includeRuntimeGates = true} = {}) {
  const set = {};
  const unset = [];
  for (const entry of REGISTRY) {
    if (Object.prototype.hasOwnProperty.call(env, entry.name)) {
      set[entry.name] = env[entry.name];
    } else {
      unset.push(entry.name);
    }
  }
  const result = {
    schema: 'dekobloko-work/effective-config@1',
    repoRoot: REPO_ROOT,
    cwd: process.cwd(),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    set,
    unset,
  };
  if (includeRuntimeGates) {
    const gates = {};
    for (const name of Object.keys(env).sort()) {
      if (isRuntimeGate(name)) gates[name] = env[name];
    }
    result.runtimeGates = gates;
    result.runtimeGatesNote =
      'Owned by java-tools; recorded because they change results.';
  }
  return result;
}

module.exports = {
  REPO_ROOT,
  REGISTRY,
  locateConsumers,
  GROUPS,
  RUNTIME_GATE_PREFIXES,
  isRuntimeGate,
  byName,
  divergences,
  snapshot,
};
