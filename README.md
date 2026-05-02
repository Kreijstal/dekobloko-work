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

Current known decompiler blocker: CFR emits invalid Java for some obfuscated
control-flow traps, including `** GOTO lbl...` constructs and malformed literals.
Those need bytecode cleanup or a stronger decompilation pass before the full
decompiled source tree can compile.
