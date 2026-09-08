# Fixture and reduction index

Every maintained reduction, with its role stated explicitly. Compiled
2026-09-08.

**Roles are not interchangeable.** A passing control is not a reproduced
failure, and a verifier that confirms a bug is not evidence that the runtime is
correct. Where a document's prose and its checked-in evidence disagree, that is
recorded here rather than resolved by relabelling.

| Role | Meaning |
|---|---|
| **control** | Expected to pass. Its value is that it *does not* reproduce the failure. |
| **regression** | Confirmed to reproduce a real failure, with a signature. |
| **workload** | A performance fixture. Not a correctness claim. |
| **probe** | Exploratory. Its result is not yet a conclusion either way. |
| **historical** | Kept for the record; superseded or unexercised. |

Prerequisites that are absent on this machine are marked **[blocked]**. A
missing JDK 8, browser bundle or private asset is a blocker, not a pass.

---

## tools/startup-boundary — GeoBlox pre-render termination

The best-organised fixture tree in the repository: it keeps its rejected
hypotheses and refuses to relabel them.

| Id | Role | Purpose |
|---|---|---|
| `attempt1/BoundaryApplet` | **control** | Rejected hypothesis, retained. Its README says so. |
| `attempt2/BoundaryApplet` | **control** | Rejected: matching tick tier and an exercised recovery path are insufficient. |
| `attempt3/BoundaryApplet` | **control** / historical | Incomplete signature match; the README says to stop expanding this family. |
| `observed-field-cache/BoundaryApplet` | **regression** | Reproduces the real failure. |
| `observed-field-cache/control/BoundaryApplet` | **control** | The 1-call variant of the same source; explicitly "not a reproducer". |

- **Inputs:** `fixtures/*.jar` (committed, with SHA-256 pinned in prose because
  ZIP timestamps change on rebuild), `runtime.json`.
- **Run:** `node tools/startup-boundary/server.cjs tools/startup-boundary/fixtures <bundle-dir> tools/startup-boundary/runtime.json 18169`,
  then open `?attempt=1|2|3|field-cache`, then
  `node collect.mjs result.json` and `node verify-results.mjs result.json`.
- **Independent oracle:** `observed-field-cache/OracleMain.java` runs the
  *identical Java source* under plain HotSpot and asserts
  `entered==3 && updated==384 && presented==3 && done==1 && caught==0`. That is
  ground truth that does not involve jvm.js at all — the right shape for an
  oracle.
- **Known-failure signature:** two fresh Firefox runs fail identically with a
  byte-identical `ReferenceError: ssaFieldCache0Value is not defined` in tier
  `ssa-trusted-checked-leaf-positional`, matching the real game's captured
  crash.
- **Provenance:** `EXACT-TERMINATION-2026-09-08.md`,
  `README.md`, `results/exact-termination-2026-09-08/`.
- **[blocked]** here: the browser bundle it wants lives under
  `/home/kreijstal/work/deko-firefox`, which does not exist on this machine.

## tools/guest-replay — captured guest calls replayed headlessly

| Id | Role | Oracle |
|---|---|---|
| `ReplayFixture.java` (17-line synthetic accumulator) | **control** | Real HotSpot, byte-exact |
| `StreamingAudioFixture.java` (synthetic 8-voice mixer) | **workload** / control | HotSpot PCM plus interpreter state |
| audio capture v2 (`kj.a` mixer call) | **probe** | Self-consistency: recorded vs replayed |
| visual capture v2 (`hi.a` mesh call) | **probe**, rejected by its own authors | Pixel buffer — left the raster black, so not a useful oracle |
| visual capture v5 | **probe**, accepted | Exact pixel-buffer match, 9/9 trials |
| combined audio+visual estimate | **probe**, explicitly disclaimed | none; derived |
| gameplay-level-2 mixer capture | **regression** (performance deadline) | Self-consistency plus a block deadline; all fifteen missed it |

- **Run:** `node run.cjs CAPTURE.json CLASSES <tier> <trials> [RUNTIME.json]`;
  build with `node build.cjs BUNDLE_DIR`; serve with
  `node server.cjs CLASSES CAPTURES BUNDLE_DIR PORT [RUNTIME.json]`.
- **Required options:** `GUEST_REPLAY_CAPTURE_DIR` (required),
  `GUEST_REPLAY_EXTRA_TARGET`, `GUEST_REPLAY_AUDIO_SKIP_BLOCKS`,
  `JVM_DENSE_INSTANCE_FIELDS=1`.
- **Dependency:** requires java-tools as a sibling directory.
- **Self-limiting language is correct here** and should be preserved: the
  combined estimate says in its own results file that it is "not a measured
  frame rate or proof that 24 FPS is attainable".
- **Dangling reference:** `RESULTS-2026-09-07.md:92` cites
  `results/firefox-combined-final-results.json`, which is absent.

## tools/reduced-logo — procedural logo renderer

- **Role: workload, still failing its target.** The README's own headline is
  that neither mode reaches 24 FPS or cold-frame pacing.
- **Oracle:** `LogoPixelOracle` + `LogoReductionTest`, run on host HotSpot:
  `javac --release 8 -d /tmp/logo-host tools/reduced-logo/*.java && java -cp /tmp/logo-host LogoReductionTest`.
  The oracle classes are deliberately excluded from the timed browser jar.
- **Run:** `node build.cjs OUT` → `node server.cjs OUT/fixture.jar <bundle> runtime.json PORT [ORACLE_DIR]`
  → browser `?mode=thin4|full4` → `node run-matrix.mjs http://localhost:PORT RESULTS thin4 full4`.
- **Rejected arms, correctly self-labelled and to be kept that way:**
  checked-span ("parked, no repeatable win"), single-site inline ("not
  promoted", +8.9%–34.7% regressions), cold-completion ("no demonstrated
  throughput win").
- **[blocked]** here: needs a browser bundle from an external tree.

## tools/reduced-runtime-gap — call-path dispatch gap

- **Role: regression, partly resolved.** The steady-state gap (20–25x) is
  fixed per its README; cold spikes are explicitly **not** fixed.
- **Oracle:** `ReducedRuntimeGap.main` on host HotSpot, comparing per-frame
  pixels, PCM and voice positions exactly.
- **Run:**
  `javac --release 8 -d /tmp/... ReducedRuntimeGap.java ReducedGapApplet.java`,
  then `java -cp ... ReducedRuntimeGap` for the host oracle, then
  `jar cf ...`, then
  `node server.cjs /tmp/deko-reduced-gap.jar <java-tools>/dist runtime.json 18106`,
  then browser `?mode=split` / `?mode=fused`.
- **Known defect:** `measure-logo.mjs:3` imports
  `../../../frame-phase-metrics.mjs`, which resolves outside the repository.
  The file is at `tools/browser-phase-probe/frame-phase-metrics.mjs`. The
  script throws `ERR_MODULE_NOT_FOUND` today. Not fixed here because the
  directory is untracked in-flight work; the one-line correction is
  `../browser-phase-probe/frame-phase-metrics.mjs`.

## tools/differential-methods — real-classfile method differential

- **Role: workload with a real independent oracle.** Its README is explicit
  that it is *not yet* a reproducer of the transition freeze.
- **Fixtures:** `candy.json`, `candy-render.json`, `audio-voice.json`.
- **Oracle:** a hand-written JS5 sprite decoder for the candy case; a HotSpot
  `-Xint` checksum for audio.
- **Real test:** `report.test.mjs` is a genuine `node:test` suite that runs
  offline.
- **[blocked]** here: the documented working root
  `/home/kreijstal/work/deko-transition` is absent, `/usr/lib/jvm/java-8-openjdk`
  is absent, and the pipeline expects an rsync from a second machine. Only the
  `JAVAC`/`JAVAP` environment overrides make any part of it runnable today.

## tools/browser-phase-probe — live-session phase instrumentation

- **Role: regression record, root cause unresolved.** Full-game, not reduced:
  the Geoblox thread terminates after ~169.7 s with zero presentations.
- **Notably correct practice:** the document states plainly that the existing
  reduction does **not** reproduce this failure and therefore cannot validate a
  fix. That is the opposite of a mislabel and should be preserved verbatim.
- `frame-phase-metrics.mjs` is a pure function with a real offline test
  (`frame-phase-metrics.test.mjs`) — the one piece here that runs anywhere.
- **[blocked]** for the live parts: needs a debug bridge on `localhost:9226`
  and external artifacts.

## tools/cfr-goto-labs — bytecode reduction corpus (77 tracked files)

Jasmin `.j` fixtures for CFR's residual `** GOTO` markers.

- **Run:** `node scripts/cfr-goto-lab.js run tools/cfr-goto-labs/<lab-dir>`.
- **Oracle:** real CFR (`java -jar lib/cfr.jar`), scanning output for
  `** GOTO|Unable to fully structure code|lbl-1000`. Both `lib/cfr.jar` and
  `lib/dekobloko-stubs.jar` are present.
- **Exercised by:** `scripts/test-cfr-oracle-policy.js` (four cases from
  `oracle-20-sample/accepted/` and `real-se-a-bytearray/`) — currently a
  **known failure**, see [docs/testing.md](testing.md).
- **Roles within the corpus:**
  - **landed fixes:** `fallthrough-shared-join`, `fc-url-path-cleanup`,
    `ji-b-byte-wraparound-scan` (before: markers; after: 0).
  - **probes with negative results, self-disclaimed:**
    `multi-backedge-shared-header`, `nested-sentinel-loop`,
    `se-shared-decode-headers`, `wl-g-visible-loop-gotos`.
  - **probe where the tested fix regresses:** `pb-blur-tail-join` — its
    `expected.json` deliberately encodes the regression (0→2 markers) as the
    "pass" state.
  - **historical:** `real-se-a-bytearray`, a nine-step c-vise reduction log
    ending in a landed, default-off gate.
  - **reference corpus, not pipeline input:** `oracle-20-sample`, whose own
    README says it must not be used without translating into a deterministic
    pass.
- **Recorded discrepancy:** `steel-b-event-drain-current/hypothesis.md`
  narrates an accepted transform (5→0 markers), but its `expected.json` encodes
  only the failing `before` case. The checked-in machine contract cannot verify
  the claimed fix. This is the single place in the census where prose outruns
  the evidence; it is recorded rather than "fixed" by editing either side.
- **Campaign status:** superseded. `docs/cfr-goto-casebook.md` states the
  residual markers are CFR/Vineflower heuristic limits and that the direction
  is to own the structurer, in java-tools.

## tools/reductions/vertigo2

`PqScanlineShape.java` — **control, historical, unexercised.** Its own header
says javac emits structured bytecode for it and CFR decompiles it cleanly, so
it is a control sample and not a CFR bug reproducer. No build, run or verify
command references it anywhere.

## tools/applet-host — single-file applet host

- **Role: probe / development tool**, not a fixture.
- **Run:** `node tools/applet-host/server.cjs <Applet.java> [<java-tools>/dist] [port] [telemetry.jsonl]`.
  It hard-fails at boot if the bundle's `jvm-debug.js` / `jvm-compile-worker.js`
  are missing, which is the right behaviour.
- Its likely companion is the untracked `ParticleFountain.java` at the
  repository root, which has no other copy anywhere.
- Untracked; no README.

---

## Rules for adding or moving a fixture

1. Give it a stable id, a purpose, its required inputs, and exact build/run/
   verify commands.
2. Give it an **independent** oracle — ideally the same source under a
   different runtime, as `observed-field-cache/OracleMain.java` does.
3. State the expected successful behaviour, and state any known-failure
   signature separately.
4. State the role. Never relabel a passing control as a reproduced failure.
5. Show that the intended runtime path is actually exercised. A server starting
   is not proof the applet ran.
6. Record source, runtime and artifact provenance, and link the originating
   experiment.
7. Do not change call counts, thresholds, expected pixels, audio inputs or
   scheduler settings to make a migrated fixture pass. Short-call controls and
   long-call tier-triggering fixtures are different fixtures on purpose.
8. Use the conventions already here. Do not build another reduction framework.
