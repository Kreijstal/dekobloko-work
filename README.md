# Dekobloko Harness

Small Java 8 launcher and boundary-test harness for the AlterOrb/FunOrb
`dekobloko.jar` gamepack.

The repository intentionally tracks source and retrieval scripts only. Downloaded
gamepacks, decompiler jars, class files, traces, and generated decompiler output
are ignored.

## Requirements

- JDK 8 or newer
- Bash
- Node.js for `assert-trace.js`
- `curl` for fetching the gamepack

## Fetch the Gamepack

```bash
./scripts/fetch-gamepack.sh
```

By default this downloads `dekobloko.jar` from AlterOrb and verifies:

```text
a22410ad930334f54672ce8acdf25d88c31e380550e8f88a5618bb730f3cf06e
```

Override inputs when needed:

```bash
DEKOBLOKO_GAMEPACK_URL=https://example.invalid/dekobloko.jar \
DEKOBLOKO_SHA256=<sha256> \
./scripts/fetch-gamepack.sh path/to/dekobloko.jar
```

## Build

```bash
./build-launcher.sh
```

This builds `dekobloko-launcher.jar` from `launcher-src/`.

To build dependency stubs for decompilation/compiler linking:

```bash
./scripts/build-stubs.sh
```

This writes `lib/dekobloko-stubs.jar`.

## Run Modes

Automated fake-AWT boundary check:

```bash
./run-fake-awt-check.sh
```

This uses `local.awt.FakeToolkit` and `local.awt.FakeGraphicsEnvironment` as an
AWT MITM. It does not use Xvfb and does not compare pixels. It asserts stable
boundary events such as applet parameters, cache redirects, fake display
discovery, frame peer creation/layout, and lifecycle calls.

Human-in-loop real AWT window:

```bash
./run-real-awt.sh
```

This requires `DISPLAY` or `WAYLAND_DISPLAY`.

Record real AWT interaction:

```bash
./run-record-awt.sh traces/interaction.awtlog
```

Replay interaction through fake AWT:

```bash
./run-replay-awt.sh traces/interaction.awtlog
```

Replay accepts launcher args, for example:

```bash
./run-replay-awt.sh traces/interaction.awtlog --replay-speed 4
```

## Launcher Options

Useful options:

- `--awt fake|real`
- `--headless-init`
- `--sleep-ms <millis>`
- `--trace-file <file>`
- `--record-awt <file>`
- `--replay-awt <file>`
- `--replay-speed <factor>`
- `--keep-open-after-replay`
- `--gamepack <jar>`
- `--server <url>`

## Decompilation Notes

The stubs under `stubs-src/` resolve legacy dependencies referenced by the
gamepack:

- `com.ms.awt.WComponentPeer`
- `com.ms.com.*`
- `com.ms.directX.*`
- `com.ms.dll.*`
- `com.ms.win32.User32`
- `netscape.javascript.JSObject`
- `net.alterorb.launcher.Hook`

Example CFR usage after placing `lib/cfr.jar` locally:

```bash
java -jar lib/cfr.jar dekobloko.jar \
  --extraclasspath lib/dekobloko-stubs.jar \
  --outputdir src
```

### Current State

Known gamepack:

```text
dekobloko.jar sha256=a22410ad930334f54672ce8acdf25d88c31e380550e8f88a5618bb730f3cf06e
```

After the deobfuscation pipeline below, **343 of 343 classes** decompile under
CFR with zero structure markers, and **343/343 verify clean** under ASM
`BasicVerifier`. No CFR or other decompiler is used as an oracle inside the
pipeline; CFR is for dev-time validation only.

The reproducible pipeline is owned by this repo. It uses
[`java-tools`](https://github.com/Kreijstal/java-tools) only for generic
bytecode parsing, serialization, and reusable transforms; Dekobloko-specific
pass ordering, targeted CFG fixes, and hardcoded source-conflict renames live
under `scripts/pipeline/`.

```bash
# Bulk-mode: single Node.js process, ~25 seconds for the full 343-class gamepack
./scripts/pipeline/bulk-pipeline.js classes-original/ deobfuscated-out/
```

The IMPORTANT detail is that `scripts/pipeline/bulk-pipeline.js` round-trips the
AST through the bytecode serializer between every pass — the round-trip normalizes
stack-map frames, label aliases, and constant-pool ordering, and several
passes (notably `inline-shared-exit-goto`) only fire correctly on the
normalized state. The CLI form does this round-trip implicitly because every
invocation reads and writes a `.class`.

#### The transforms in plain English

| Pass | Pattern it targets |
|---|---|
| `peephole-clean` | nop removal, single-use fall-through gotos, unreferenced labels. |
| `strip-rethrow-handlers --keep-handler-code` | Drops trivial catch-and-rethrow exception-table entries; **retains** bare `athrow` sentinels (Diobfuscator lesson — deleting both makes CFR worse). |
| `multi-entry-normalize` | Clones loop-header blocks for each forward edge so loops have a single semantic entry. Has a forward-only join splitter for fallthrough-joined CFG diamonds. |
| `coalesce-loop-load` | Folds `LOAD X; goto T2; T1: LOAD X; T2: <use X>` into `goto T1`. Cleans up the duplicate prefix that multi-entry normalization tends to leave behind. |
| `dead-flag-eliminate` | Eliminates dead conditionals on always-false static boolean flags (allowlist of 14 fields, built from clinit / self-toggle analysis). The single most important static assumption is `client.A = false`. |
| `inline-shared-exit-goto` | The crux. Tail-duplicates a shared exit/merge body at the goto-site reached as the fallthrough of a conditional jump. The obfuscator collapsed javac's natural inline-exit prologues into shared `goto EXIT` chains; this pass puts them back where it matters. Drove `td` from 2 markers → 0 and `lk` from 3 → 0. |
| `compile-conflict-renames` | Exact owner/name/descriptor renames for Java source conflicts where CFR emits short class names that collide with inherited fields or override-family methods. |
| `ei-tail-clone`, `qc-doloop-tail-clone` | Targeted tail-cloning passes for the remaining CFG shapes that CFR needs to structure `ei` and `qc` cleanly. |

#### The discovery story for `inline-shared-exit-goto`

Hand-writing Java that matches `td.c(Lvl;)V`'s semantics exactly (including
the unusual "if `var10 == 0` then return immediately, not break to the next
loop" branch) and feeding it through `javac -source 7 -target 7` produces
bytecode that CFR decompiles with **zero markers**. Diffing that bytecode
against the obfuscated `td.c` shows two differences:

1. javac **inlines the entire method-exit prologue** at the
   conditional-fallthrough site (`if var10 == 0 → write all locals back to
   fields → return`). The obfuscator replaced that inline with a single
   `goto EXIT`, where `EXIT` is a shared prologue at method end.
2. javac uses an explicit `goto INNER_LOOP_2` at the var3==1 path's exit; the
   obfuscator uses fallthrough.

Reproducing javac's inline-exit shape — i.e. tail-duplicating the merge
target's body at one specific predecessor — was sufficient to fix both `td`
and `lk`. The general rule emerged from there: the goto's previous
instruction must be a conditional jump, the target must have ≥4 forward
predecessors AND another forward predecessor reachable from inside the
conditional's then-target body (the "shared-join-inside-nested-structure"
shape), and the body must be 5–50 insns ending in a terminator.

#### Vineflower as a sanity check, not as a target

Vineflower (the modern Quiltflower fork) handles `td` and `lk` natively — its
structurer covers the patterns CFR fails on. But it has **its own** failure
mode on this gamepack: 618 javac errors (vs CFR's 244) because the
obfuscator's single-letter naming creates Java-level field-vs-class shadowing
that Vineflower doesn't qualify (e.g. `lb.a(...)` where `lb` is both a field
of type `int` and a sibling class). Switching decompiler oracles doesn't
help; cleaning up the bytecode does.

### Reproducing the result

Per-class regression (25 representative classes, fail-fast):

```bash
./scripts/regression-check.sh
```

Whole-gamepack benchmark (all 343 classes, batch verify, lock-and-update
mode):

```bash
./scripts/regression-check-all.sh             # check vs scripts/EXPECTED-ALL.txt
./scripts/regression-check-all.sh --report    # per-class table
./scripts/regression-check-all.sh --update    # write current state to EXPECTED-ALL.txt
```

Both pass at 0 regressions; the locked baseline is zero markers across all 343
classes. The frozen list is in `scripts/EXPECTED-ALL.txt`.

To reproduce the CFR-source javac count:

```bash
./scripts/compile-check-cfr.sh
```

Current result with `lib/dekobloko-stubs.jar` is `298/343` source files
compilable.

### Tools Used

Local repos and tools used during this investigation:

- `dekobloko-work`: this harness repo. It owns gamepack retrieval, dependency
  stubs, the fake/real AWT launcher, trace assertions, and experiment notes. It
  intentionally does not track downloaded jars, transformed classes, or CFR
  output.
- `java-tools` (`https://github.com/Kreijstal/java-tools`): primary
  bytecode/deobfuscation workbench. Useful pieces include Jasmin
  assemble/disassemble commands, rename/reflection analysis, call graph
  metadata, peephole cleanup, exception trap cleanup, and ASM transforms under
  `tools/asm/`.
- CFR 0.152 (`https://www.benf.org/other/cfr/` and
  `https://github.com/leibnitz27/cfr`): the main decompiler target. All bytecode
  cleanup has been measured against CFR output because the current goal is
  compilable CFR Java.
- Recaf (`https://github.com/Col-E/Recaf`): useful for inspection and
  interactive bytecode/class browsing. It wants a modern JDK, while the gamepack
  itself is Java 6/7 era bytecode.
- Diobfuscator / `Deobfuscator` (`https://github.com/Diobf/Deobfuscator`):
  useful as a reference implementation for peephole ideas. The important
  portable idea was keeping bare handler `athrow` sentinels while removing
  useless try/catch entries.
- Garlic (`https://github.com/neocanable/garlic`) and other decompilers: useful
  comparison points, but CFR remained the main target because its output and
  failure modes were easy to batch-scan.
- ASM (`https://asm.ow2.io/`, Maven artifacts `org.ow2.asm:asm`,
  `org.ow2.asm:asm-tree`, and `org.ow2.asm:asm-analysis`): used for actual class
  rewrites. `java-tools` currently builds `run-join-block-splitter` and
  `run-replace-method-body`.
- `javap` / `javac` from the JDK (`https://openjdk.org/`): `javap` was used to
  check real bytecode offsets and control-flow shapes. `javac -source 7 -target
  7` was used to produce structured donor bytecode for the `td.c(Lvl;)V` proof.
  This is a proof/testcase, not the final generic deobfuscator pass.
- `rg` / ripgrep (`https://github.com/BurntSushi/ripgrep`): used for marker
  scans, string/reflection searches, and quick output audits.
- fake AWT launcher: used as a boundary harness for applet/AWT/cache/network
  calls without Xvfb or pixel comparisons.

Supporting repos cloned during exploration:

- `katana-project/slicer`: `https://github.com/katana-project/slicer`
- `Kreijstal/java-tools`: `https://github.com/Kreijstal/java-tools`
- `alterorb/launcher`: `https://github.com/alterorb/launcher`
- `alterorb/deobfuscator`: `https://github.com/alterorb/deobfuscator`
- `neocanable/garlic`: `https://github.com/neocanable/garlic`
- `Diobf/Deobfuscator`: `https://github.com/Diobf/Deobfuscator`

Reference reading:

- Self-improving decompiler notes:
  `https://shanyu.juneja.net/thoughts/self-improving-decompiler/`

Not every cloned tool became part of the pipeline. The pieces that materially
changed the result were the `java-tools` ASM/peephole work, the Diobfuscator
peephole lesson, CFR marker scans, and the fake-AWT boundary harness.

### CFR Marker Tracking

The useful success metric is not class count or whether names moved around. The
code may be renamed, inlined, duplicated, or restructured. The boundary signals
that matter are network behavior, AWT calls, filesystem/cache behavior, and JVM
verification. For decompiler work, the local mechanical metric is whether CFR
still emits structure markers:

```bash
rg -n '\*\* GOTO|Unable to fully structure code|lbl-1000' cfr-output
```

The historic progression on this gamepack:

| Stage | Markers | Classes with markers |
|---|---|---|
| baseline (no pipeline) | many hundreds across the jar | most |
| after `peephole` + `strip-rethrow` | ~150 | ~30 |
| + `multi-entry-normalize` + `coalesce-loop-load` + `dead-flag-eliminate` | 74 | 15 |
| + `inline-shared-exit-goto` (current) | **13** | **4** (`ck=5, qk=4, kh=3, qc=1`) |

339/343 classes (98.8%) now decompile under CFR with zero structure markers,
and 343/343 verify clean under ASM `BasicVerifier`.

### What's still left

The 4 classes that retain markers (`ck`, `qk`, `kh`, `qc`) have patterns the
existing passes don't recognize:

- 6+ clause OR-shortcuts to a shared else-body (qc-style, but with bigger
  fan-in than `inline-shared-exit-goto`'s gate accepts);
- bare `goto LBL` from inside multiply-nested `if` blocks where the previous
  instruction is *not* a conditional jump (so the inline pass's "prev =
  conditional" gate skips them);
- possibly switch-on-state-machine patterns that don't fit
  `multi-entry-normalize`'s loop-header shape.

A full solution would need either generalizing `inline-shared-exit-goto` to
accept those shapes (without regressing the 339 currently-clean classes) or
adding a new tail-duplication pass keyed on different CFG signals. The
existing harnesses (`regression-check.sh`, `regression-check-all.sh`) make
that exploration safe — the locked `EXPECTED-ALL.txt` will reject any change
that increases markers on any class.

### Reduced CFR Testcases

The `java-tools` repository has reduced Jasmin examples:

- `examples/sources/jasmin/CfrBadLabelLoop.j`
- `examples/sources/jasmin/TdCExact.j`
- `examples/sources/jasmin/TdDecodeLoopShape.j`
- `examples/sources/jasmin/TwoEntryDecodeLoop.j`

The smallest CFR bad-label shape is a one-local method:

```text
0:  iload_0
1:  ifle 12
4:  iload_0
5:  ifeq 15
8:  iload_0
9:  ifne 4
12: iinc 0, 0
15: iinc 0, 0
18: return
```

CFR 0.152 emits `** GOTO` for that shape. The `--split-fallthrough-joins` pass
fixes this reduced case by cloning the small fallthrough target block and
inserting a skip `goto` so the original path no longer falls through into the
clone.

### Boundary Harness Notes

The launcher supports fake AWT, real AWT, record, and replay modes. The fake AWT
mode is an API boundary test rather than a pixel test. It is intended to keep
network/appcache/AWT/filesystem behavior anchored while bytecode changes.

Useful command shape:

```bash
timeout 20 java -Djava.awt.headless=false -jar dekobloko-launcher.jar \
  --awt fake \
  --headless-init \
  --sleep-ms 500 \
  --trace-file /tmp/headless.log \
  --gamepack /path/to/patched.jar

node assert-trace.js /tmp/headless.log
```

The quick class-only experiment jars can reach `error_game_crash` under this
harness. Compare against a known baseline before treating that as a regression.
The harness is strongest when the patched jar preserves the same packaging shape
as the original gamepack.
