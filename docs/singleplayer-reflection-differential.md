# Original-client single-player differential harness

## Purpose

This document records what is currently known about the original DekoBloko
client classes involved in starting and ticking a single-player game. It also
describes the reflection-driven bot and the Python shadow-engine comparison.

The harness exists to answer one specific question:

> Given the same board, active piece, controls, and tick, does the Python
> authoritative engine produce the same state transition as the original Java
> client?

It does not drive a desktop, synthesize X11 events, or infer state from pixels.
The launcher supplies fake AWT and the instrumentation reads and drives the
client directly.

## Artifact provenance

Two Java artifacts are relevant:

- The repository's decompiled source and rebuilt `dekobloko.jar` are the
  primary implementation that we read and modify.
- The original server-key gamepack is a compatibility reference used by
  differential tests.

Normal development should stay in the decompiled source because it is easier to
understand and is the game we intend to modify. Original bytecode inspection is
only needed when a differential test identifies a disagreement or a class hash
shows that the rebuilt class is not equivalent. If the disagreement comes from
decompilation, that is a source defect to fix in the decompiled implementation,
not a reason to work permanently from assembly.

The corresponding classes were extracted and compared:

| Class | Original hash prefix | Recompiled hash prefix | Result |
| --- | --- | --- | --- |
| `client.class` | `3029c671` | `3029c671` | Byte-identical |
| `pn.class` | `0e8cb42d` | `0e8cb42d` | Byte-identical |
| `qc.class` | `4fc9d8cd` | `4fc9d8cd` | Byte-identical |
| `lk.class` | `d35e1140` | `7802de51` | Different |

This means the decompiled implementation can be read directly for the three
identical classes. `lk` needs a focused behavioral comparison, especially
around `lk.d(II)V`. Any unintended semantic difference found there must be
repaired in the decompiled source.

Disassembly is performed with the existing java-tools checkout:

```text
/home/kreijstal/git/java-tools/scripts/jvm-cli.js
```

Example:

```bash
node /home/kreijstal/git/java-tools/scripts/jvm-cli.js \
  disassemble lk.class --out lk.j
```

No `javap` output is used. All previously generated `*.javap` files were
removed. Krakatau is not cloned or required.

Current analysis artifacts are under:

```text
.work/singleplayer-diff/classes/
.work/singleplayer-diff/disasm/
.work/singleplayer-diff/decompiled-classes/
.work/singleplayer-diff/decompiled-disasm/
```

## Class map

### `client`

Declaration:

```text
.class public final super client
.super bd
```

Relevant method:

```text
client.<init>()V
```

The instrumentation injects a call to
`GarbageTrace.startSingleplayerBot()` before each constructor return. The call
only starts a bot when `-Ddekobloko.reflectBot=true` is present.

The constructor hook is a convenient lifecycle entry point, not the game start
itself. The bot thread waits for client resources before invoking the real
single-player start method.

### `pn`

Relevant method:

```text
pn.a(ZZZ)V
```

This is the original single-player start path. Its observed behavior includes:

1. It calls `cd.a(true)`.
2. It clears `gh.e`.
3. It constructs a `qc` instance.
4. It stores that instance in `kf.I`.
5. It calls `qc.b(Z)I`.
6. It passes the result to `nn.a(ILui;Z)V`.

The observed `qc` constructor call is:

```text
qc.<init>(ZIZIIII[Ljava/lang/String;IZZZ)V
```

The reflected bot starts single player by invoking:

```text
pn.a(false, false, false)
```

This is deliberately different from the multiplayer construction path in
`client`, which reads options from protocol state in `uf`.

### `qc`

Relevant constructor:

```text
qc.<init>(ZIZIIII[Ljava/lang/String;IZZZ)V
```

`qc` is the game/session object created by the single-player path. The active
game singleton is stored in:

```text
kf.I : Lqc;
```

### `sb`

The reflected startup thread waits until:

```text
sb.u[0][0]
```

is available before invoking `pn.a(ZZZ)V`. This is used as the resource-ready
signal so the game is not started while the client is still initializing its
assets.

### `lk`

`lk` is the bucket/falling-piece state used by the original game.

The important tick method is:

```text
lk.d(II)V
```

The first argument is the current five-bit control mask. The second argument is
an obfuscation cookie used by the original client. The small private overload
`lk.d(I)V` is not the main falling-piece tick.

Instrumentation replaces argument 1 at method entry:

```text
control = GarbageTrace.beforeTick(this, control)
```

and records the resulting state before every normal return:

```text
GarbageTrace.afterTick(this, control)
```

## `lk` field map

The following mappings come from the original bytecode and reflected traces:

| Field | Meaning |
| --- | --- |
| `P` | Settled bucket grid, row-major `int[]` |
| `O` | Bucket width |
| `a` | Bucket height |
| `T` | Active-piece bitmap, row-major `int[]` |
| `C` | Active-piece width |
| `zb` | Active-piece height |
| `q` | Active-piece x position |
| `L` | Active-piece y position |
| `ab` | Active-piece orientation |
| `db` | Horizontal rotation parity/state |
| `o` | Vertical rotation parity/state |
| `A` | Previous tick's control mask |
| `Ab` | Forced-drop/new-piece countdown |
| `Cb` | Horizontal key-repeat state |
| `e` | Current gravity/drop countdown |
| `g` | Base gravity countdown reference |
| `y` | Grounded/landing state |

The names are obfuscated and should not be used as semantic names outside the
reflection boundary.

## Control mask

The first argument of `lk.d(II)V` uses these bits:

| Bit | Value | Action |
| --- | --- | --- |
| 0 | `1` | Move left |
| 1 | `2` | Move right |
| 2 | `4` | Rotate counter-clockwise |
| 3 | `8` | Rotate clockwise |
| 4 | `16` | Accelerated drop |

New presses are derived from the current and previous masks:

```text
pressed = (~A) & control
A = control
```

Holding accelerated drop clamps `e` to at most `2`. It does not bypass the
original tick method or directly edit the active piece position.

## Bot policy

The reflection bot is implemented in:

```text
tools/instr/GarbageTrace.java
```

It is enabled with:

```text
-Ddekobloko.reflectBot=true
```

The bot:

1. Waits for client assets through `sb.u[0][0]`.
2. Invokes the original `pn.a(false, false, false)` single-player path.
3. Detects a newly spawned piece using the reset of `Ab`.
4. Chooses a deterministic target orientation and x coordinate.
5. Applies one of the original control-mask values each tick.
6. Uses accelerated drop only after alignment and a short delay.
7. Never writes board cells, active-piece coordinates, or timers directly.

The policy is intentionally simple. Its purpose is reproducibility and broad
state coverage, not optimal play.

## Tick pacing

The harness can pace reflected ticks with:

```text
-Ddekobloko.botTickMillis=20
```

Pacing is performed at the `lk.d(II)V` boundary. This makes the observation and
control stream deterministic enough to replay one client transition at a time.
It does not replace all clocks used by rendering, audio, networking, or menus.

## Trace schema

Each observed frame is emitted as a single line:

```text
[CT] DIFF phase=pre|post tick=N board=ID ctrl=N \
bw=N bh=N grid=HEX pw=N ph=N piece=HEX x=N y=N orient=N \
drop=N forced=N base=N prev=N repeat=N hp=N vp=N grounded=N
```

Fields:

| Trace field | Source |
| --- | --- |
| `phase` | State immediately before or after `lk.d(II)V` |
| `tick` | Harness-local tick number |
| `board` | Reflected bucket object identity |
| `ctrl` | Control mask actually supplied to the client tick |
| `bw`, `bh` | `O`, `a` |
| `grid` | `P`, encoded as two hexadecimal digits per cell |
| `pw`, `ph` | `C`, `zb` |
| `piece` | `T`, encoded as two hexadecimal digits per cell |
| `x`, `y` | `q`, `L` |
| `orient` | `ab` |
| `drop` | `e` |
| `forced` | `Ab` |
| `base` | `g` |
| `prev` | `A` |
| `repeat` | `Cb` |
| `hp`, `vp` | `db`, `o` |
| `grounded` | `y` |

## Python shadow engine

The differential consumer is:

```text
tools/instr/singleplayer_diff.py
```

It consumes the Java trace from standard input and:

1. Builds a Python `Board` from the client's pre-tick settled grid.
2. Builds an `ActiveDomino` from the client's active bitmap and position.
3. Applies the exact control mask returned by `beforeTick`.
4. Advances the Python authoritative engine once.
5. Compares the resulting Python state with the Java post-tick frame.
6. Reports each field mismatch with the tick and both values.

Useful options:

```text
--trace PATH
--max-ticks N
```

The compared fields currently include the settled grid, dimensions, active
bitmap, position, orientation, gravity timer, forced-drop timer, previous
controls, repeat state, rotation parities, and grounded state.

## Current synchronization boundaries

The harness is strongest while a piece is actively falling. It compares that
transition tick by tick.

There are known boundaries that still require deeper instrumentation:

- When the settled grid changes, the shadow currently uses the client state as
  a new synchronization point. This means it detects the boundary but does not
  yet independently prove every cascade, pop, feedback, cooked-piece, power-up,
  or next-queue transition performed outside `lk.d(II)V`.
- The trace serializes cell values but does not yet preserve every hidden
  identity associated with a cooked solid.
- The reflected tick pacing does not virtualize every client clock.
- Startup waits for a known asset field rather than a formally named client
  lifecycle event because the original symbols are obfuscated.

These limitations are deliberate and visible. A client-state resynchronization
must not be interpreted as proof that the Python settle/cascade resolver
matched. The next extension should instrument the methods that own settling,
feedback queueing, power-up resolution, and next-piece activation, then compare
those phases independently instead of accepting the changed client grid.

## Build and run

Build an instrumented gamepack:

```bash
sh tools/instr/build.sh singleplayer-diff
```

Run the original client with fake AWT and pipe its reflected frames to the
Python engine:

```bash
PYTHONPATH="$PWD/apps/server" \
java \
  -Djava.awt.headless=false \
  -Ddekobloko.reflectBot=true \
  -Ddekobloko.botTickMillis=20 \
  -jar .work/launcher-current/dekobloko-launcher.jar \
  --awt fake \
  --gamepack tools/instr/dekobloko-trace-singleplayer-diff.jar \
  --trace-file /tmp/dekobloko-singleplayer-launcher.trace \
  --server http://127.0.0.1:8080/ \
| PYTHONPATH="$PWD/apps/server" \
  python3 tools/instr/singleplayer_diff.py \
    --trace /tmp/dekobloko-singleplayer-client.log
```

This path does not require an X server. The server URL is still needed for the
normal client bootstrap even though the selected game mode is single player.

## Rules for future reverse engineering

- Read and modify the decompiled source first.
- Use the original server-key gamepack only as the compatibility reference.
- Use java-tools disassembly for bytecode inspection.
- Do not use or regenerate `javap` files.
- Inspect bytecode only for a concrete mismatch, missing construct, or focused
  equivalence check.
- Hash corresponding classes before deciding which artifact is interchangeable.
- Treat unintended decompiler behavior differences as bugs and fix them in the
  decompiled source.
- Record descriptors, field accesses, and observed transitions rather than
  assigning meaning from obfuscated names alone.
- Keep client-derived synchronization points explicit in differential results.
- Never drive this harness through X11; use reflection and fake AWT.
