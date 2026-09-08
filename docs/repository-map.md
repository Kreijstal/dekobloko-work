# Repository map and migration backlog

What each component actually does, who calls it, and what is wrong with it.
Compiled 2026-09-08 from a full inventory of `scripts/`, `tools/`, `apps/`,
`web/`, `game-logic/`, `stubs/`, `mappings/` and `.work/`. Every claim below
was checked against the filesystem; nothing was called dead or duplicate from
its filename.

Status vocabulary: **supported** (documented and working), **experimental**
(works, undocumented or unintegrated), **historical** (superseded, kept for the
record), **unresolved** (documented but its prerequisites are missing here).

---

## 1. Native Java / AWT launching and trace checking

| Component | Owns | Status |
|---|---|---|
| `apps/launcher/src/local/DekoblokoLauncher.java` (518 lines) | The applet host entry point | supported, needs JDK 8 |
| `apps/launcher/src/local/awt/FakeToolkit.java` (547 lines) | A full synthetic `sun.awt.Toolkit` for headless runs | supported |
| `apps/launcher/src/local/{Trace,AwtInteractionLog}.java`, `awt/FrameProfiler.java` | Trace capture and replay, frame profiling | supported |
| `apps/launcher/assert-trace.js` | The trace oracle: a 13-step ordered regex sequence over the launcher log | supported |
| `scripts/launcher/*.sh` (8 wrappers) | Build, run, record, replay | supported |
| `tools/reflect-probe/Wrapper.java` (435 lines) | Reflection A/B oracle: drives the launcher headlessly, samples pixels, invokes UI | supported |
| `tools/patch/{AwtRequestFocusCompat,PrintHnCrash}.java` | In-place `.class` patchers | historical; no callers anywhere |

`DekoblokoLauncher.java` is the clearest decomposition target in the repository.
One class currently holds: argument parsing (`Options.parse`), dependency
location (`new URLClassLoader`), runtime construction (`loadClass` +
`System.setProperty("awt.toolkit", …)`), host services (`BasicAppletStub`,
`BasicAppletContext`, `UrlAudioClip`, `pinSoundToAlsaDefault`), session
lifecycle (`windowClosed`, the `/quit.ws` shutdown hook, `runOffscreen`),
diagnostics (~25 `Trace.log` sites) and reporting (`captureFrame`).

**`stubs/src/net/alterorb/launcher/Hook.java` and
`apps/launcher/src/net/alterorb/launcher/Hook.java` are the same class name in
the same package with different behaviour** — the stub is a no-op, the launcher
copy redirects the cache directory. Which one is on the classpath changes where
the game writes its cache.

## 2. Headless Node / jvm.js launching

| Component | Owns | Status |
|---|---|---|
| `scripts/run-jvmjs.js` (650 lines) | Boot one gamepack headlessly; save/load state; AWT replay | supported |
| `scripts/launch-alterorb-games-jvmjs.js` (2253 lines) | The multi-game smoke launcher, worker pool and report generator | supported |
| `scripts/compare-runtime.js` | Runtime-equivalence harness across variants | supported |
| `scripts/run-jre-reflection-main-menu.js` + `scripts/jre-reflection-main-menu/` | Real-JRE main-menu reachability probe | supported |
| `scripts/audit-recompiled-main-menu-evidence.js` | Audits recompiled trees for main-menu evidence | supported |
| `scripts/pipeline-cache-provenance.js` | Class-tree hashing and cache-validity stamps | supported |

`launch-alterorb-games-jvmjs.js` mixes at least nine responsibilities: argument
parsing, run provenance, gamepack fetch/extract/validate, surface capture and
PNG writing, JIT profile snapshots, frame-pacing statistics, V8 CPU profiling,
TCP/HTTP bridges and an offline HTTP server, a worker pool, and report
assembly. Two of those (provenance, offline enforcement) have now been
extracted to `scripts/lib/`; the rest is backlog item **B2**.

## 3. Browser game library, play pages and adapters

| Component | Owns | Status |
|---|---|---|
| `scripts/serve-game-library.js` (2305 lines) | Catalog page, per-game bundle serving, JS5 embedding, WebSocket→TCP bridge, telemetry | supported |
| `web/audio-diagnostics/`, `web/animation-diagnostics/`, `web/vorbis-probe/`, `web/music-visualizer/` | Browser correctness/diagnostic pages | supported; music-visualizer is the oldest and has an external CDN import |
| `scripts/serve-audio-diagnostics.js` (468 lines) | Serves all four `web/` pages plus generated data | supported |
| `scripts/debug-inspect.js`, `scripts/debug-sched.js` | Browser console snippets served dynamically by the library's `/debug-*.js` route | supported |
| `apps/launcher/browser-runtime.{js,json}` | Browser runtime manifest and pre-start script | **not touched by this cleanup**; modified by another agent |

`serve-game-library.js` has import-time side effects: it creates the telemetry
directory at module load, requires `ws` out of the java-tools checkout at line
12, and calls `start()` unconditionally at the bottom with no
`require.main === module` guard. Requiring it starts a server.

`browser-runtime.js` still names `geoblox-loader` / `GeoBloxready` while its
error text says "DekoBloko browser runtime preparation failed" — an incomplete
rename. Its `beforeStartScript` key is read by nothing:
`launch-alterorb-games-jvmjs.js` consumes only `jvmOptions`.

## 4. Source preparation, compilation, decompilation, bytecode pipeline

| Component | Owns | Status |
|---|---|---|
| `scripts/decompile-all-games.sh` (591 lines) | The authoritative whole-corpus decompiler run | supported |
| `scripts/pipeline/bulk-pipeline.js` (4385 lines) | Pipeline orchestrator: env bootstrap, AST IO, ~90 shape predicates, pass sequencing, CLI | supported |
| `scripts/pipeline/structuredGotoClone.js` (13904 lines) | One pass, effectively one function body, containing dozens of hand-written shape detectors | supported |
| `scripts/pipeline/*.js` (18 more) | Individual targeted passes | supported |
| `scripts/pipeline/profiles/*.json` (7) | Per-game bytecode-site profiles | supported; the README listed only 5 |
| `scripts/regenerate-goto-baseline.sh` (728 lines) | Baseline regeneration with six repair-phase toggles | supported |
| `scripts/check-goto-baseline.sh`, `scripts/regression-check*.sh` | Baseline gates | supported |
| `scripts/deobfuscate.sh` | Single-file generic pipeline | **broken**, see below |
| `tools/find-leaf-methods.js` | javap-based leaf-method finder | historical; hardcodes `/home/clawd/.jdks/...`, a path for a different user |

`scripts/deobfuscate.sh` sets `JAVA_TOOLS_DIR` to *this* repository's root and
then invokes `$JAVA_TOOLS_DIR/tools/asm/MultiEntryLoopNormalizer.java` and
`$JAVA_TOOLS_DIR/scripts/jvm-cli.js`. Neither exists here (both exist in
java-tools). Verified by running it: `error: file not found:
/home/kreijstal/git/dekobloko-work/tools/asm/MultiEntryLoopNormalizer.java`.
It also downloads ASM jars from Maven Central into `lib/` at run time. Nothing
in the repository calls it.

### Baselines

All four `scripts/EXPECTED-*` files are live round-trip baselines with a
consumer and a regenerator; none is stale.

| Baseline | Consumer | Regenerator |
|---|---|---|
| `EXPECTED-ALL.txt` | `regression-check-all.sh` | `regression-check-all.sh --update` |
| `EXPECTED-GOTO-ALL-GAMES.tsv` | `check-goto-baseline.sh` | `regenerate-goto-baseline.sh` |
| `EXPECTED-GOTO-FREE-GAMES.txt` | `check-goto-baseline.sh` | `regenerate-goto-baseline.sh` |
| `EXPECTED-OWN-DECOMPILER-ALL-GAMES.tsv` | `decompile-all-games.sh` | `decompile-all-games.sh` |

## 5. Gamepack retrieval, verification, cache prep and JS5

| Component | Owns | Status |
|---|---|---|
| `scripts/fetch-gamepack.sh` | Download + sha256-verify a gamepack | supported |
| `scripts/js5-server.js` (540 lines) | Game-agnostic local JS5 update server | supported |
| `scripts/js5-recorder.js` | Recording JS5 proxy | supported |
| `scripts/js5-proxy.js` | Logging TCP proxy | experimental; **listens at import time**, no `require.main` guard |
| `tools/js5/download-caches.py` (540 lines) | Reimplements the JS5 wire protocol to mirror caches without executing gamepack bytecode | supported |
| `tools/js5/fetch-all-caches.sh` | Fallback that warms caches by running real gamepack bytecode; gated behind `ALLOW_UNTRUSTED_GAMEPACK_EXECUTION=1` | supported |

`dekobloko.jar` is authoritative; `classes-original/` is its pre-exploded form
(343 classes, verified byte-identical). Neither was regenerated or modified.

## 6. Stubs and toolchain preparation

`stubs/src` → `scripts/build-stubs.sh` → `lib/dekobloko-stubs.jar`, consumed by
seven or more scripts. Supported. `stubs.tar.gz` at the repository root is a
tracked historical snapshot containing both a CFR rendering of the 343 game
classes and an old copy of `stubs/src`; eleven files differ from the current
tracked tree. Nothing reads it.

## 7. The renderer-free game-logic library

`game-logic/` has **zero** references to the browser, the launcher, jvm.js,
java-tools or `apps/`. Verified by grep over `game-logic/src/**`. Its only
outside reference is `game-logic/build.sh`'s optional, existence-guarded use of
`classes-original/` for three differential tests. It is independently usable
and must stay that way: it must not gain a dependency on browser launch or
profiling infrastructure.

Build and test: `./game-logic/build.sh`.

## 8. Music and audio tooling

`tools/music/` (56 files) is a systematic per-game corpus of Java renderers and
Python drivers, densely documented. Supported. `tools/lv2/` builds native LV2
plugins; both its required inputs are missing here and its documented output
path disagrees with what the script writes. `tools/audio-trace/` injects trace
calls into the original obfuscated jar; its inputs still exist and it derives
its root dynamically, which is the correct pattern.

`tools/music/extract-dekobloko-music.py` re-implements the JS5 buffer, index
and container parsing that `tools/js5/download-caches.py` already has. That is
a genuine duplicate of protocol logic across two languages — backlog **B6**.

## 9. Reflection probes, benchmarks and oracles

| Component | Owns | Status |
|---|---|---|
| `tools/oracle/ParityProbe.java` (760 lines), `ClearProbe.java` (471) | Ground truth from the unmodified jar via `Unsafe.allocateInstance` | supported; needs JDK 8 |
| `tools/instr/` | ASM instrumentation of the shipped server-key jar | unresolved: its jar and JDK 8 are both absent here |
| `scripts/benchmark-*.js` (3) | Node-side benchmarks with provenance stamping | supported |
| `scripts/semdiff.js` (546 lines) | Semantic differential between two class trees | experimental; no callers |

## 10. Reductions and miniature applets

See [docs/fixtures.md](fixtures.md) for the full index with roles, oracles and
commands.

## 11. Browser automation and trace analysis

Six independent implementations of the *same* debug-bridge call
(`POST http://localhost:9226` with `{context, script}`) exist across
`tools/browser-phase-probe`, `tools/differential-methods`, `tools/guest-replay`,
`tools/reduced-logo`, `tools/reduced-runtime-gap` and `tools/startup-boundary`,
under four different local names (`page`, `chrome`, `bridge`, inline). No
Playwright or Puppeteer is used anywhere in `tools/`. Backlog **B5**.

## 12. Reports, baselines, docs and history

`docs/` now separates current runbooks from history; see the README index.
Historical documents keep their original claims and timestamps.

## 13. Generated state

See [docs/artifact-retention.md](artifact-retention.md).

---

# Migration backlog

Ordered by value over risk. Each item names its evidence.

### B1 — Configuration portability *(partly done)*

**Done:** `scripts/lib/java-tools.js` names and pins all six discovery rules;
`scripts/lib/effective-config.js` is a tested registry of 54 variables;
`scripts/print-effective-config.js` makes a checkout inspectable.

**Remaining:** migrate call sites onto the `required` strategy, one family at a
time, each with its own test. Fix `bulk-pipeline.js`'s
`JAVA_TOOLS_NODE_DEPS_DIR` default and `per-class-test.sh`'s unconditional
`JT_DIR` assignment (both are bugs, not policy). Decide whether
`serve-game-library.js` should also accept `JAVA_TOOLS_DIR`.

### B2 — Decompose `launch-alterorb-games-jvmjs.js` *(started)*

**Done:** provenance and the offline guard are extracted and tested; the report
schema is unchanged, verified byte-for-byte.

**Remaining, in dependency order:** (a) surface capture and PNG writing;
(b) JIT profile / codegen / scheduler snapshots; (c) frame-pacing statistics;
(d) V8 CPU profiling; (e) the bridges and the offline HTTP server; (f) the
worker pool; (g) report assembly. Each has a clean input/output boundary and no
shared mutable state. Keep the CLI, the report schema and the exit codes
identical; the existing harness test plus a recorded report diff is the gate.

### B3 — Import-time side effects

Ten files in `scripts/` execute their work at `require()` time rather than
behind `require.main === module`:

- `js5-proxy.js` opens a TCP listener at module scope.
- `serve-game-library.js` calls `start()` (network or cache read, then
  `listen`) at module scope, and creates the telemetry directory at load.
- `serve-audio-diagnostics.js` calls `listen` at module scope.
- `merge-launch-reports.js` calls `fs.writeFileSync` at module scope.
- `check-mb-chat-name-seed.js`, `check-j-local-sanity.js`,
  `compare-offline-launch.js`, `probe-guest-vorbis-node.js`,
  `analyze-goto-pass-impact.js` read argv-derived files at module scope.
- `bulk-pipeline.js`, `test-cfr-pass-regressions.js`,
  `validate-loop-entry-candidates.js`, `check-mb-chat-name-seed.js` mutate
  `process.env.NODE_PATH` and call `Module._initPaths()` at module scope,
  changing global module resolution for the whole process.

Importing a reusable module must not start a server, fetch assets or write
files. Add a `main()` and a `require.main` guard; the exported surface is what
tests should use.

### B4 — Shared argument parsing and usage

`parseArgs` is hand-rolled in 15 files and `usage` in 9, all the same
`--flag value` shape. This is a real extraction, but it must preserve each
CLI's exact accepted flags and error behaviour, so it needs per-CLI
characterisation tests first.

### B5 — One browser debug bridge

Six copies, four names. One module, one documented contract, one place to
change when the bridge protocol moves. Keep it out of `scripts/lib/`: it is a
`tools/` concern.

### B6 — One JS5 protocol reader

`tools/js5/download-caches.py` and `tools/music/extract-dekobloko-music.py`
each implement buffer, index and container parsing. Same protocol, two
implementations, one language. Verify equivalence on a real cache before
merging.

### B7 — Do **not** unify the CFR marker patterns

Recorded as a rejected extraction, because it looks like an obvious one. The
marker predicate appears in 13+ files, but the implementations **do not
agree**: `cfr-marker-count.js` and `cfr-oracle-select-transform.js` count four
alternatives including `** while`; `cfr-check.sh`,
`cfr-goto-interesting*.sh` and `regenerate-goto-baseline.sh:188` count three;
`check-goto-baseline.sh` and `regenerate-goto-baseline.sh:724` split the count
into two separate numbers. Extracting one constant would silently change what
every baseline measures. If they should agree, that is a deliberate change to
the metric with regenerated baselines and a written justification — not a
refactor.

### B8 — Eight hand-rolled static HTTP servers

`tools/reduced-logo/server.cjs` and `tools/reduced-runtime-gap/server.cjs`
differ by two lines and share a log string. Six more exist. A fixture server is
a genuinely shared concern; a game-library server is not. Extract only the
fixture case.

### B9 — Provenance and result envelope *(partly done)*

**Done:** `scripts/lib/provenance.js` owns the digests and git state; the six
identical `sha256(file)` copies are gone; the four different commit key names
(`revisionSha1`, `commitSha1`, `commit`, `revision`) are preserved by explicit
schema adapters so existing result files stay readable.

**Remaining:** the `tools/` trees have at least six more bespoke SHA-256
provenance schemes, seven of them inside `tools/differential-methods` alone.
Define one result envelope with a schema version before merging them, and keep
old raw results readable.

### B10 — Broken references

Verified missing on disk today:

| Reference | Where | Reality |
|---|---|---|
| `scripts/runCfr.js` | `docs/residual-decompiler-panics.md` | exists in java-tools, not here |
| `scripts/verifyBrowserCompileWorker.js` | `docs/phase1-results-log.md` | same |
| `scripts/compileJava.js` | `tools/startup-boundary/README.md` | exists in java-tools |
| `../../../frame-phase-metrics.mjs` | `tools/reduced-runtime-gap/measure-logo.mjs:3` | resolves outside the repo; the real file is `tools/browser-phase-probe/frame-phase-metrics.mjs`. The script throws `ERR_MODULE_NOT_FOUND` today |
| `.work/multiplayer/gamepacks/dekobloko-serverkey.jar` | `tools/instr/build.sh:23` | absent |
| `/usr/lib/jvm/java-8-openjdk/bin` | `tools/instr`, `tools/differential-methods` | absent (11/17/21/26 installed) |
| `/home/clawd/.jdks/jdk-22.0.2+9/bin/{javap,jar}` | `tools/find-leaf-methods.js:9,13` | a different user's home |
| `tests/fixtures/golden-active-piece.tsv` | `tools/oracle/README.md:252` | absent |
| `~/.alterorb/gamepacks/dekobloko.jar` | `DekoblokoLauncher.java:256` default | absent; must be passed with `--gamepack` |
| `results/firefox-combined-final-results.json` | `tools/guest-replay/RESULTS-2026-09-07.md:92` | absent |
| `/home/kreijstal/work/deko-firefox`, `/home/kreijstal/work/deko-transition` | several `tools/` docs | external machine roots, absent |

### B11 — Orphans to resolve, not delete

- `mappings/dekobloko/{gameplay,network,platform,shared}.json` and their notes:
  zero consumers. Only the combined `mappings/dekobloko.json` is used, by
  `scripts/validate-dekobloko-rename-map.sh`.
- `arcanistsmulti/` at the repository root: an empty, untracked directory
  unreferenced by its own path.
- `libjaclib.so`, `libjaggl.so`: prebuilt native objects matching the
  `stubs/src/jaclib` and `stubs/src/jaggl` package names, with no producer and
  no consumer anywhere in the repository. Their provenance is not recoverable
  from the repository's own record.
- `dekobloko.zip` at the repository root: its contents are an unrelated
  Next.js project, not a gamepack.
- `tools/reductions/vertigo2/PqScanlineShape.java`: correctly self-labelled a
  control, not a reproducer, but nothing exercises it.

### B12 — Oversized multi-responsibility files

Beyond `launch-alterorb-games-jvmjs.js` (B2) and `serve-game-library.js`:
`scripts/pipeline/structuredGotoClone.js` (13904), `bulk-pipeline.js` (4385),
`apps/server/dekobloko_server/lobby.py` (3017) and its JS mirror (2857),
`apps/server/dekobloko_server/engine.py` (1552), `web/audio-diagnostics/app.js`
(1148), `tools/music/render-funorb-native.py` (952) and
`extract-dekobloko-music.py` (927), `tools/instr/GarbageTrace.java` (767),
`tools/oracle/ParityProbe.java` (760).

`structuredGotoClone.js` is the extreme case and also the highest risk: it is
one function body whose behaviour is pinned by a 4016-line test. Split it only
behind that test, one detector at a time.

---

## Reviewed; no change needed

- **`game-logic/`** — clean boundary, no outward dependencies, its own build
  and tests, a README.
- **`stubs/src/`** — one job, one builder, seven consumers, no drift (apart
  from the `Hook.java` collision noted in section 1).
- **`scripts/pipeline/profiles/`** — pure per-game data, loaded generically.
- **`apps/server-js/test/`** — golden vectors traceable to the authoritative
  Python implementation, with a runner.
- **`scripts/EXPECTED-*`** — all four live, consumed and regenerable.
- **`tools/js5/`** — documented, safe by default, gated fallback, correct
  `__pycache__` exclusion.
- **`tools/startup-boundary/`** — the best-organised fixture tree here: it
  keeps controls and reproductions explicitly distinct and refuses to relabel
  one as the other.
