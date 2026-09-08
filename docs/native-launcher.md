# Native Java launcher: build, run modes and options

The JDK 8 AWT applet launcher under apps/launcher, its build and run
wrappers, and the applet-toolchain caveats. Moved out of README.md
unchanged.

Source: previously README.md lines 1481-1684; the text below is
unchanged apart from this header.

## Build

```bash
./scripts/launcher/build.sh
```

This builds `.work/games/dekobloko/launcher/dekobloko-launcher.jar` from
`apps/launcher/src/`.

To build dependency stubs for decompilation/compiler linking:

```bash
./scripts/build-stubs.sh
```

This writes `lib/dekobloko-stubs.jar`.

## Applet toolchain caveats

Every game in this harness is a `java.applet.Applet`. The Applet API was
deprecated for removal in JDK 17 and is gone from JDK 26, so a modern default
JDK cannot compile the decompiled sources, cannot build the launcher, and
cannot run either. Nothing here is a decompiler defect; it is purely a
toolchain constraint.

Verified locally: JDK 8 (`/usr/lib/jvm/java-8-openjdk`) works, JDK 26.0.2 does
not. The versions in between are untested here.

### Compiling decompiled sources

Compile against the stubs with a JDK that still ships `java.applet`:

```bash
JDK8=/usr/lib/jvm/java-8-openjdk
"$JDK8/bin/javac" -nowarn -proc:none \
  -cp stubs/funorb-stubs.jar -d out games/vertigo2/*.java
```

Under JDK 26 the same command fails. For vertigo2 that is 100 errors, of which
only 60 name the real cause (`package java.applet does not exist`). The other
40 are cascade damage from `Applet` being an unknown type, and they look like
genuine decompiler bugs while being nothing of the sort:

```
29  reference to a is ambiguous
 5  cannot find symbol
 2  non-static method a(byte,int) cannot be referenced from a static context
 1  name clash: class pp has two methods with the same erasure ...
 1  incompatible types: og cannot be converted to Component
 1  cannot access ComponentPeer
 1  a(Applet,int) in fk cannot override a(boolean,int) in li
```

Before investigating any of those, re-run on JDK 8. All 100 disappear.

### Building the launcher

`scripts/launcher/build.sh` also fails on a modern JDK, with 42 errors of the
form "does not override or implement a method from a supertype" in
`BasicAppletContext` and `UrlAudioClip` — those interfaces (`AppletContext`,
`AudioClip`) no longer exist. Either build under JDK 8 or reuse an existing
`.work/launcher/dekobloko-launcher.jar`; the jar is small and stable, so a
prebuilt one is usually fine.

### Running

The launcher must run on an Applet-capable JRE, and needs a desktop session
(`DISPLAY` or `WAYLAND_DISPLAY`):

```bash
"$JDK8/bin/java" -Djava.awt.headless=false \
  -jar .work/launcher/dekobloko-launcher.jar \
  --awt real \
  --gamepack /path/to/gamepack.jar \
  --main-class Vertigo2 \
  --trace-file .work/traces/run.log
```

Notes that cost time if you do not know them:

- `--main-class` is the game's entry class, not a fixed value. It is the name
  after `launcher.loadClass` in any previous trace log for that game.
- `scripts/launcher/run-real-awt.sh` hardcodes the dekobloko gamepack and calls
  `build.sh` first, so it is unusable for another game on a modern JDK. Use
  `run-launcher.sh`, which forwards its arguments, or invoke `java` directly as
  above.
- A jar built straight from `javac` output has no ABI-restore step, so its
  fields carry the decompiled names rather than the original obfuscated ones.
  That is self-consistent for an all-recompiled gamepack, but it will not
  interoperate with original classes in a hybrid jar. Use
  `scripts/build-hybrid-gamepack.sh` when mixing.
- The launcher resolves its code base against the live AlterOrb server, so a
  successful launch makes real network calls and stops at a login prompt.

A successful start looks like this in the trace:

```
launcher.loadClass Vertigo2
launcher.newApplet Vertigo2
applet.setStub
stub.appletResize 640x480
applet.init.return
applet.start.return
frame.setVisible true
```

## Run Modes

Automated fake-AWT boundary check:

```bash
./scripts/launcher/run-fake-awt-check.sh
```

This uses `local.awt.FakeToolkit` and `local.awt.FakeGraphicsEnvironment` as an
AWT MITM. It does not use Xvfb and does not compare pixels. It asserts stable
boundary events such as applet parameters, cache redirects, fake display
discovery, frame peer creation/layout, and lifecycle calls.

Human-in-loop real AWT window:

```bash
./scripts/launcher/run-real-awt.sh
```

This requires `DISPLAY` or `WAYLAND_DISPLAY`.

Some gamepacks open Java Sound through ALSA. On systems where plain ALSA maps to
hardware, that bypasses PipeWire and can either produce no mixed desktop audio
or lock `/dev/snd/pcm*` directly. Force the ALSA PipeWire plugin explicitly when
launching these clients:

```bash
mkdir -p .work/alsa
printf '%s\n' \
  '@hooks [' \
  '  {' \
  '    func load' \
  '    files [' \
  '      "/usr/share/alsa/alsa.conf"' \
  '      "/usr/share/alsa/alsa.conf.d/50-pipewire.conf"' \
  '      "/usr/share/alsa/alsa.conf.d/99-pipewire-default.conf"' \
  '    ]' \
  '    errors false' \
  '  }' \
  ']' > .work/alsa/pipewire-java.conf

DISPLAY=:10.0 ALSA_CONFIG_PATH="$PWD/.work/alsa/pipewire-java.conf" \
  java -Djava.awt.headless=false -jar .work/launcher/dekobloko-launcher.jar \
    --awt real \
    --gamepack .work/games/minerdisturbance/gamepack.jar \
    --main-class MinerDisturbance \
    --gamecrc 1412183595 \
    --server https://mgg-server.alterorb.net \
    --trace-file .work/games/minerdisturbance/logs/real-awt-pipewire.trace
```

Verify that the process is using PipeWire rather than direct ALSA hardware:

```bash
pid=<java-pid>
ls -l /proc/$pid/fd | grep -E 'snd|pipewire|pcm' || true
grep -E 'pipewire|libasound_module_pcm_pipewire|/dev/snd' /proc/$pid/maps || true
pactl list sink-inputs short
```

A direct-ALSA launch shows open fds such as `/dev/snd/pcmC0D0p`,
`/dev/snd/controlC0`, and `/dev/snd/timer`. A PipeWire-routed launch loads
`libasound_module_pcm_pipewire.so`, has `pipewire-memfd` fds, and appears in
`pactl list sink-inputs`.

Record real AWT interaction:

```bash
./scripts/launcher/run-record-awt.sh .work/games/dekobloko/traces/interaction.awtlog
```

Replay interaction through fake AWT:

```bash
./scripts/launcher/run-replay-awt.sh .work/games/dekobloko/traces/interaction.awtlog
```

Replay accepts launcher args, for example:

```bash
./scripts/launcher/run-replay-awt.sh .work/games/dekobloko/traces/interaction.awtlog --replay-speed 4
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
