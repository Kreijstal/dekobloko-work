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

The working decompilation experiments are in the sibling `java-tools`
repository. The best bytecode-cleanup pipeline so far is:

1. Remove useless exception table entries, but keep dead handler `athrow`
   sentinels in the instruction stream.
2. Run ASM cleanup/folding passes for static assumptions, simple local
   constants, duplicate suffixes, preheaders, and jumps.
3. Apply targeted extra fixes only when they improve CFR output.

The important lesson from Diobfuscator is that its peephole pass removes the
trivial rethrow traps from the exception table, but does not delete the bare
handler `athrow` code. Deleting both the trap metadata and the handler code made
CFR worse. In `java-tools`, this is represented by:

```bash
node scripts/jvm-cli.js peephole-clean input.class --out output.class
node scripts/jvm-cli.js strip-rethrow-handlers input.class --keep-handler-code --out output.class
```

For `qc.class`, keeping handler sentinels plus constant/jump cleanup reduced CFR
bad labels to zero. The useful static assumption there was:

```text
client.A:Z=false
```

### CFR Marker Tracking

The useful success metric is not class count or whether names moved around. The
code may be renamed, inlined, duplicated, or restructured. The boundary signals
that matter are network behavior, AWT calls, filesystem/cache behavior, and JVM
verification. For decompiler work, the local mechanical metric is whether CFR
still emits structure markers:

```bash
rg -n '\*\* GOTO|Unable to fully structure code|lbl-1000' cfr-output
```

After the main cleanup pass, the full jar was down to two bad Java files:

```text
lk.java
td.java
```

`lk.class` is fixed by the optional `java-tools` ASM pass:

```bash
build/asm-tools/run-join-block-splitter lk.class lk.fixed.class \
  --split-fallthrough-joins \
  --cleanup-jumps \
  --max-insns 2 \
  --min-incoming 9999
```

Do not enable this pass globally yet. Applied to every class, it fixed `lk` but
introduced new CFR failures in `ke` and `mm`. For now it is a targeted repair for
known-bad `lk`.

`td.class` is the final hard case. Replacing only `td.c(Lvl;)V` with a
structured donor implementation of the same BZip decode state machine made CFR
emit zero structure markers for the full jar when combined with the targeted
`lk` fix. This proves the method can be represented as CFR-friendly Java, but it
is not a real deobfuscator solution yet because it is method-specific.

The reproducible tooling added in `java-tools`:

```bash
./scripts/build-asm-tools.sh
javac -source 7 -target 7 \
  -cp /home/clawd/git/dekobloko-work/classes-original \
  -d /tmp/td-donor \
  examples/sources/java/td.java
build/asm-tools/run-replace-method-body \
  td.class /tmp/td-donor/td.class 'c' '(Lvl;)V' td.fixed.class
```

### What The Real Deobfuscator Still Needs

The `td` donor replacement should be treated as a testcase and proof, not as the
goal. A real pass needs to detect and rewrite the CFG pattern generically:

- a loop header with multiple semantic entries;
- a small shared decode/header block, usually a guard plus state assignment and
  exit `goto`;
- entries from pending-run drain code, normal decode fallthrough, and decode
  backedges;
- stack-compatible entries according to ASM analysis;
- a measurable CFR improvement after rewriting.

Naively cloning all entries to the shared header made CFR worse by moving the
bad label into the next decode block. Splitting only the initial entry was not
enough. Splitting only one backedge also moved the failure. The real pass likely
needs "multi-entry loop header normalization" with a guard: try a candidate
rewrite on one method, run CFR on that class, and keep it only if the marker
count drops.

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
