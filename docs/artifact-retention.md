# Artifact retention and cleanup classification

Audit of generated state, compiled 2026-09-08. `.work/` holds **89 direct
subdirectories, 144 loose files, 4.7 GB**.

**This is a dry run. Nothing here was deleted, moved or regenerated.** Deletion
needs separate explicit authorisation. A directory name does not make its
contents disposable, and several things in `.work/` exist nowhere else.

Classification rule used throughout: a directory is only "reproducible" if the
**exact regenerating command can be named**. If it cannot, it is `unknown` and
stays. That rule alone moved ~308 MB out of the disposable column.

---

## 1. Retain — stranded source

Hand-written source, probes, fixtures and scripts that exist **only** under
`.work/`, with no copy under `scripts/`, `tools/`, `web/` or `apps/`, and no
tracked reference. Losing any of these loses the only copy. These are
candidates for promotion to a tracked path.

| Path | What it is |
|---|---|
| `.work/wasmcov/bisect.sh` + `.work/wasmcov/*.js` (20 probes) | The largest bloc of unpromoted investigation tooling in the repository: `callers`, `compile-kre`, `drill`, `guesthot`, `helpers`, `idlewhen`, `jitself`, `jitsplit`, `jrehot`, `jreload`, `jrewin`, `kindaudit`, `modself`, `probe`, `rangetop`, `slotuse`, `spillaudit`, `sweep`, `tiers`, `unattr` |
| `.work/analyze-gecko-profile.mjs` | Gecko profile analysis |
| `.work/measure-firefox-complete-frames.mjs` (45 KB) | Complete-frame measurement |
| `.work/benchmark-firefox-data-shapes.mjs`, `.work/benchmark-firefox-raster-shapes.mjs` | Shape benchmarks |
| `.work/inspect-geoblox-jit.js`, `.work/profile-brickabrac-firefox.js`, `.work/viro-pipeline-method-hybrid.js` | Runtime inspection |
| `.work/inspect-geoblox-prepared-tiers.cjs`, `.work/inspect-ma-dynamic-cones.cjs`, `.work/inspect-ma-scalar.cjs`, `.work/score-hot-graph-candidates.cjs` | Tier and call-graph inspection |
| `.work/audio-trace/capture-live-source.js` | Live audio source capture |
| `.work/viro-exception-probe/ViroExceptionProbe.java` | Hand-written probe |
| `.work/review-abi-fixture/{instance,static}-src/Owner.java`, `static-src/Ref.java` | Hand-written ABI test fixtures |
| `.work/goto16/labs/*/` (7 × `hypothesis.md` + `before.j` + `expected.json`) | `confined-dc-a`, `confined-dj-a`, `shatteredplans-km-a`, `terraphoenix-dk-a`, `terraphoenix-dk-init`, `torchallenge-qe-a`, `torchallenge-qe-l`. None has a counterpart under `tools/cfr-goto-labs/` |
| `.work/labs/escapevector-oe-h/` (`hypothesis.md`, `before.j`, `expected.json`) | The oldest orphaned goto lab; predates the promotion of `tools/cfr-goto-labs/` |
| `.work/goto16/interesting.sh` | Lowest priority: an earlier, cruder ancestor of the now-tracked `scripts/cfr-goto-interesting.sh`. Retain for provenance |

Hashes of the small key files:

```
3213549b6acad2ed2bed87dda98a85f134ca5358670e958c654ff478057f390e  .work/wasmcov/bisect.sh
481f25144ae1f2653d7c30b2fd96483dc38dab47c007b4bc5211f0e41a3244b0  .work/analyze-gecko-profile.mjs
b0867661b26efb49edbb37f88eddbd788495f6d602c98ee924fe50291f0d4037  .work/measure-firefox-complete-frames.mjs
e7b96b8e984d46ee2a9dbfe2540dcd1061568dda770edca947ba0e09ef6456e1  .work/score-hot-graph-candidates.cjs
5da82a66775b3c286f1882db6eb6830d9927d7df7edb62a8c29b580f3403cb15  .work/labs/escapevector-oe-h/hypothesis.md
c55533374d80d9c562e66684f62955df9d08b6a7eb55e7d8fa30c6b9a627de60  .work/goto16/interesting.sh
```

## 2. Retain — irreplaceable evidence

Data that a tracked document cites by name, or that cannot be re-measured
because the measurement conditions cannot be reproduced.

| Path | Size | Why |
|---|---|---|
| `.work/phase1` | 237 MB | `docs/phase1-results-log.md` cites exact filenames inside it (`dekobloko-audit.json`, `dekobloko-pacing.json`, `dekobloko-run2/4.json`, `freeze-*`) |
| `.work/cfr-goto-reduce` | 2.0 MB | `docs/cfr-goto-casebook.md` cites `steelsentinels/se.j`; `disassembled/*.j` is the cited "Source:" input for every retained goto lab |
| `.work/hotspot-geoblox-floor` | 4.0 MB | HotSpot-vs-jvm.js floor timing runs. Per the standing rule that this machine is never quiet, these cannot be re-measured identically |
| `.work/alterorb-jvmjs` | 339 MB | `docs/browser-game-library.md` and `docs/recompiled-runtime-validation.md` cite files inside it (e.g. `all-games-main-menu-report.json`) |
| `.work/animation-diagnostics` | 152 MB | `docs/node-runtime.md` cites `logo-animation-trace.json` |

Root-level:

| Path | Why |
|---|---|
| `ParticleFountain.java` | 47 KB of hand-written applet source with **no tracked copy anywhere**. sha256 `3b35c1786d3064484bb30d514920162b6ffd558f5a1ee54f4c5582d95b0217ba` |
| `libjaclib.so`, `libjaggl.so` | Prebuilt native objects matching the `stubs/src/jaclib` and `stubs/src/jaggl` package names. **No producer and no consumer anywhere in the repository.** Provenance is not recoverable from the repository's record — ask before touching |
| `dekobloko.jar` | Authoritative gamepack. `classes-original/` is its pre-exploded form, verified byte-identical across all 343 classes. Neither was regenerated |
| `main_file_cache.*`, `random.dat` | Live JS5 client cache state |
| `awt-trace.log` | Launcher AWT trace |

## 3. Dry-run deletion candidates

Only entries whose exact regenerating command can be named, with proof that
nothing tracked depends on them.

### 3a. Milestone decompiler snapshots — 418 MB

Nineteen `.work/games-*` directories: `games-allfix`, `games-allflags`,
`games-conservative`, `games-current-probe`, `games-dcefix`,
`games-dcefix-before`, `games-excfix`, `games-final`, `games-final-pub`,
`games-gates`, `games-gates2`, `games-gotofix`, `games-labelfix`,
`games-publish`, `games-publish2`, `games-sigfix`, `games-sigfix2`,
`games-sigfix3`, `games-sigoff`, `games-unchecked-fix`.

- **Regenerating command:** `scripts/decompile-all-games.sh <ROOT> [--game NAME]`.
  Every one has exactly that script's output shape:
  `owned-decompiler-all-games.tsv`, `decompilation-provenance.json`,
  `.owned-decompiler-tools/{asm,Verify.class}`, per-game
  `<game>/{classes,decompile-owned}`.
- **Proof of no dependency:** all nineteen names grepped against `docs/`,
  `scripts/`, `tools/` and `README.md` — zero hits for every one.
- **Context:** dated milestone snapshots from a single afternoon (2026-07-19)
  of the goto-residual investigation, superseded by the live `.work/games`.
- **Caveat before acting:** these were the inputs to a published comparison. If
  any figure in `docs/` was derived from a specific one, retain that one.

### 3b. Throwaway browser profiles — 380 MB

`.work/firefox-brickabrac-profile` (70 MB),
`.work/firefox-geoblox-profile` (310 MB).

- **Regenerating command:** any Firefox measurement script with a fresh
  `--profile-dir`.
- **Contents:** sqlite, cookies, places and startup-cache junk. No unique data.
- **Note:** these should never have been shared profiles. A pref leaking out of
  a shared Firefox profile has previously faked a large boot regression;
  throwaway `--profile-dir` per experiment is the correct pattern.

### 3c. Empty directories

`.work/frames`, `.work/worktrees`, `.work/review-abi-empty` — 0 files each.

**Total with a named regenerating command: ~798 MB.**

## 4. Unknown — zero references, but no named command

Zero-referenced but explicitly **not** on the deletion list, because no exact
regenerating invocation exists. About 308 MB.

| Cluster | Size | Note |
|---|---|---|
| `.work/dekobloko-preparallel-backup.Aur8N3` | 225 MB | Full pre-parallelisation backup of the games tree. Also the source `tools/reflect-probe/instrumentation.patch` targets (`*/java/{cr,d}.java`) |
| `.work/dekobloko-parallel.cA8vWJ` | 42 MB | Four-worker decompile shard |
| `.work/experimental-interclass-full.9l6H1U` | 15 MB | Full-corpus interclass-DCE experiment |
| `.work/interclass-dce-*` (9 dirs) | ~20 MB | The A/B runs behind the "interclass DCE deletes the latch pump" finding |
| `.work/constant-fold-*` (3 dirs) | 6.6 MB | Full 343-class corpora |
| `.work/review-*` (9 dirs) | 788 KB | ABI, bulk, provenance and signature review samples |
| `.work/solknight-default-audit` | 11 MB | Single-game audit sample |
| `.work/tier-audit` | 37 MB | Wasm-tier census plus a `.cpuprofile` |
| `.work/js5-local-complete` | 2.1 MB | A GeoBlox `main_file_cache` snapshot |
| `.work/phase2`, `.work/phase3` | 2.8 MB | `docs/refactor.md` and `docs/phase3-wasm-widening.md` discuss these phases narratively but do not cite these filenames |
| `.work/loop-optimizer`, `.work/original-direct-check` | 412 KB | A/B series and a smoke check |

The `mktemp`-suffixed clusters were **not** created by any script in this
repository or in java-tools — both trees were grepped for `mktemp` and for each
literal name, with no producer found. They are one-off interactive
`mktemp -d .work/<name>.XXXXXX` invocations. That is exactly why they are
`unknown` and not disposable: there is no command to recreate them.

## 5. Reproducible caches, currently in use

Named command exists **and** something tracked depends on them, so they are
regenerable but not currently disposable: `.work/games` (1.7 GB, the live
tree), `.work/gamepacks`, `.work/js5-recorded`, `.work/music`, `.work/traces`,
`.work/telemetry`, `.work/jre-reflection-main-menu`, `.work/launcher`,
`.work/abi-tools`, `.work/audio-diagnostics`, `.work/cfr-goto-casebook`,
`.work/game-library`, `.work/runtime-compare`, `.work/trace-tools`,
`.work/vorbis-probe`, `.work/upstream-alterorb-launcher`, `.work/multiplayer`.

## 6. Documented `.work/` paths that do not exist

Tracked files name 24 `.work/` paths that exist and 21 that do not. Most of the
missing ones are **parameterised documentation examples**, not broken
workflows: `tools/music/*.java` headers use `.work/js5-caches/<game>` and
`.work/js5-caches-<game>-full/<game>` as illustrative invocations, and the
per-game `js5-cache-buildNN` names change on every JS5 refresh.

Genuinely stale, with no parameterisation to excuse them:

| Path | Named by | Likely reality |
|---|---|---|
| `.work/launcher-compat-8`, `.work/launcher-current` | `apps/server/README.md`, `docs/singleplayer-reflection-differential.md` | renamed to `.work/launcher` |
| `.work/lv2` | `README.md` (now `docs/js5-cache-and-music.md`) | the script writes here; the doc says `.work/games/dekobloko/lv2` |
| `.work/cache-backup-original` | `docs/loading-and-menu-investigation.md` | gone |
| `.work/singleplayer-diff` | `docs/singleplayer-reflection-differential.md` | gone |
| `.work/alsa`, `.work/music-profile`, `.work/offline-www`, `.work/oracle-20-goto`, `.work/oracle-rerun`, `.work/rename-map-validation`, `.work/tetralink-music-tools` | various | gone |
| `.work/stubs` | `scripts/build-stubs.sh` (`CLASSES_DIR`) | absent only because stubs have not been rebuilt in this checkout; the script creates it |

## 7. Rules

1. Classify before moving. A name is not evidence.
2. Reproducible caches and run output belong under documented generated
   locations; maintained source belongs in tracked source or tooling paths.
3. Never keep the only copy of source, a patch, a helper script, an oracle, a
   failing fixture, an exact runtime bundle, or a trace behind a published
   result in `.work/`.
4. If the regenerating command cannot be named, it is not reproducible.
5. Preserve retained evidence with hashes and an index. Use a migration index
   for moved artifacts; do not rewrite the historical reports that cite them.
6. Do not regenerate `dekobloko.jar` or `classes-original/`. `dekobloko.jar` is
   authoritative; the other is its unpacked form.

## 8. Layout convention for `.work/`

Preserved from the README's original guidance, which is still the right shape:

```text
.work/games/<game>/gamepack.jar        downloaded gamepack jar
.work/games/<game>/classes/            extracted original class files
.work/games/<game>/js5-cache/          best/current downloaded JS5 cache
.work/games/<game>/music/              generated music JSON, MIDI and WAV data
.work/games/<game>/deob-<purpose>/     transformed bytecode, CFR output, logs
.work/games/<game>/compile-<purpose>/  javac/CFR compile-check output
.work/games/<game>/launcher/           game-specific launcher build output
```

Do not create root-level `.work/*-probe`, `.work/*-check`, `.work/*-buildNN` or
`.work/*-final` directories; keep the latest useful variant under the owning
game directory. The nineteen `.work/games-*` snapshots in section 3a are
exactly what that rule exists to prevent.

### One correction to the original guidance

The README used to say: *"Anything under `.work/` is disposable generated
state."* **That claim is false, and this audit is the evidence.** `.work/`
currently holds the only copy of 30+ hand-written probe scripts, two hand-written
Java fixtures, eight goto-lab hypothesis triples, and the data cited by name in
`docs/phase1-results-log.md` and `docs/cfr-goto-casebook.md`.

The rule that was always right is the sentence that followed it: if a helper
performs real work, it belongs under `tools/`, `scripts/` or `web/`, not
`.work/`. Section 1 is the list of things that should have followed it and did
not.
