# Running the games

Every supported way to obtain a gamepack and start it: headless on `jvm.js`, in
a browser, or on a real JVM through the native applet launcher.

Configuration variables named here are documented in
[configuration.md](configuration.md); print what your checkout resolves with
`node scripts/print-effective-config.js`.

**Standing rule: no workflow contacts AlterOrb or any public game host.** All
game serving is `127.0.0.1`. `scripts/lib/offline-guard.js` enforces this at the
socket layer; install it in anything that claims to run offline.

---

## 1. Prepare inputs

### Gamepack

```bash
./scripts/fetch-gamepack.sh
```

By default this downloads `dekobloko.jar` and verifies:

```text
a22410ad930334f54672ce8acdf25d88c31e380550e8f88a5618bb730f3cf06e
```

Override inputs when needed:

```bash
DEKOBLOKO_GAMEPACK_URL=https://example.invalid/dekobloko.jar \
DEKOBLOKO_SHA256=<sha256> \
./scripts/fetch-gamepack.sh path/to/dekobloko.jar
```

`scripts/launch-alterorb-games-jvmjs.js` downloads and hash-checks missing
gamepacks into `.work/gamepacks/<game>.jar` during its normal validation run.

### Dependency stubs

```bash
./scripts/build-stubs.sh
```

This writes `lib/dekobloko-stubs.jar` from `stubs/src/`, which resolves the
legacy Microsoft J++/Netscape/AlterOrb classes the gamepacks reference. See
[decompilation.md](decompilation.md).

### JS5 cache

`tools/js5/download-caches.py` and `tools/js5/fetch-all-caches.sh` bulk-download
caches; `tools/js5/js5-builds-validated.json` records the validated builds.
For anything you intend to replay, prefer recording a real boot (below) — the
standalone sweep can desynchronize against the mirror partway through.

---

## 2. Headless on jvm.js

```bash
node scripts/run-jvmjs.js .work/games/dekobloko/classes
```

Options: `--class`, `--codebase`, `--max-insns`, `--trace`, the
`--replay-awt`/`--replay-*` family, and the save-state flags below.

### Save states

The runner can checkpoint the complete portable Java state after a wall-clock
delay and resume it in a fresh process, which skips the cache load and startup
animation during repeated experiments:

```bash
node scripts/run-jvmjs.js .work/games/dekobloko/classes \
  --save-state .work/games/dekobloko/login.state.json \
  --save-after-ms 58000 --exit-after-save

node scripts/run-jvmjs.js .work/games/dekobloko/classes \
  --load-state .work/games/dekobloko/login.state.json
```

The state stores Java heap, thread, frame and static data — not generated JIT
code. Cache files reopen on load; sockets, audio outputs and canvas handles are
host resources and are omitted from the portable payload.

### Multi-game launcher

`scripts/launch-alterorb-games-jvmjs.js` is the data-driven runtime suite. It
validates gamepacks, wires up serving, and can gate on reaching the main menu:

```bash
node scripts/launch-alterorb-games-jvmjs.js \
  --until-main-menu --jobs 2 --timeout-ms 600000 \
  --report .work/alterorb-jvmjs/all-games-main-menu-report.json
```

It is the only script that currently installs `scripts/lib/offline-guard.js`.

---

## 3. Serving JS5 locally

`scripts/js5-server.js` speaks the JS5 update protocol from a local cache, so a
game boots without reaching any remote host. It is game-agnostic — the only
per-game input is which directory to read:

```bash
node scripts/js5-server.js --cache-dir <dir> [--port 43594] [--host 127.0.0.1]
```

Run **one server per game**. The handshake carries a build revision and nothing
else, and the 44 validated builds collide into 31 distinct values, so a single
shared port cannot work out which cache a connection wants.

The launcher wires this up itself:

```bash
node scripts/launch-alterorb-games-jvmjs.js --local-cache [dir] --game chess
```

`--local-cache` starts one server per selected game on its own ephemeral port
and points that game's `gameport1`/`gameport2` at it.

`scripts/js5-recorder.js` and `scripts/js5-proxy.js` provide the recording and
proxy halves used by that flow.

### Getting a cache that can actually be replayed

A client's own on-disk cache is **not** sufficient. The client fetches the
master index (255/255), validates it in memory on every boot, never writes it to
disk, and only stores the groups it happened to need. Served from such a cache,
a game gets a synthesized unsigned master index covering almost nothing and dies
with a `RuntimeException` on a blank surface. The symptom is a stall right after
the handshake, because a client `idx255` typically lists only a handful of
archives where a complete cache has far more.

Record a real boot instead:

```bash
node scripts/launch-alterorb-games-jvmjs.js --record-cache .work/js5-recorded \
  --game chess --until-main-menu
node scripts/launch-alterorb-games-jvmjs.js --local-cache .work/js5-recorded \
  --game chess --until-main-menu
```

`--record-cache` writes every returned group to
`<dir>/<game>/<archive>-<group>.bin`, master index included. That directory is a
valid `--local-cache` input; the server detects the format from its contents.

`scripts/test-js5-server.js` checks the server against a synthetic cache it
builds itself — no game, no network, no downloaded data.

### Launching offline

```bash
node scripts/launch-alterorb-games-jvmjs.js --offline --game chess --until-main-menu
```

`--offline` needs three things staged, all of which a normal online run leaves
behind:

| What | Where | Staged by |
|---|---|---|
| launcher config | `.work/upstream-alterorb-launcher/config.json` | cached automatically on every online run |
| gamepacks | `.work/gamepacks/<game>.jar` | `ensureGamepack`, hash-verified against the config |
| JS5 groups | `.work/js5-recorded/<game>/` | `--record-cache` |

It then refuses every non-loopback connection and rejects `fetch` outright, in
the parent and in each worker. That is deliberate: offline is only a real claim
if a forgotten remote dependency fails loudly instead of working right up until
the machine is actually disconnected. The applet's codeBase is answered by a
local HTTP server that serves `.work/offline-www` if anything is staged there
and otherwise logs and 404s every request — in practice the games ask it for
nothing.

---

## 4. Browser game library

`scripts/serve-game-library.js` serves a searchable catalog of the local
gamepacks. Each card opens the same browser JVM launcher with a small game-data
manifest.

The JVM, bytecode interpreter, JIT and optimizer do not select behavior from a
game or method name. The browser adapter supplies only host integration data:
gamepack URL and catalog-verified SHA-256; main class, game CRC and standard
applet parameters; per-game virtual cache namespace; server/codebase and the
browser TCP bridge; title, menu thumbnail, loading progress and telemetry
identity.

Deko Bloko needs one legacy host compatibility adapter for Whirlpool. It is
installed only for Deko Bloko and explicitly removed before any other game
starts. Pixel and raster methods always execute through ordinary JVM/JIT
compilation; the browser launcher contains no rendering-method replacement.

The catalog expects validated JARs in `.work/gamepacks/<game>.jar`, warmed
caches in `~/.alterorb/caches/<game>/`, menu captures in
`.work/alterorb-jvmjs/menus/`, and a browser bundle in the configured bundle
directory.

```bash
JAVA_TOOLS_ROOT="$HOME/git/java-tools" \
GAME_LIBRARY_PORT=3771 \
GAME_LIBRARY_BUNDLE_DIR=/tmp/dekobloko-browser-bundle \
GAME_LIBRARY_BUNDLE=jvm-debug-current.js \
node scripts/serve-game-library.js
```

Open `http://127.0.0.1:3771/`. The server listens on `0.0.0.0`, so the same port
can be forwarded to another host.

Endpoints: `/` (catalog), `/games.json` (catalog and availability metadata),
`/play/<internal-name>` (the shared browser launcher), `/diagnostics` (browser
AWT ceiling diagnostics), `/telemetry` (launch and performance reports).

The AlterOrb catalog is refreshed at startup and cached in
`.work/game-library/config.json`. If the network is unavailable, the last valid
catalog is used. A game is offered only when its local JAR SHA-256 matches the
catalog. With `ALTERORB_CONFIG_URL` unset and that cache present, nothing is
contacted; a `file://` URL pins an offline catalog.

### JS5 bridge

The guest's game-server socket is bridged to a JS5 server the library starts
itself, one per game, on an ephemeral port. The guest still asks for 43594 —
the applet params hardcode it — and the bridge maps that to the real port. The
cache chain is the same one the Node launcher builds: the recorded index layer
in `.work/js5-recorded/<game>` chained with the client cache in
`~/.alterorb/caches/<game>`. The library never contacts an external server on
its own.

To point at an externally started backend instead, set both bridge variables,
which win over the built-in bridge:

```bash
GAME_LIBRARY_TCP_BRIDGE_HOST=127.0.0.1 GAME_LIBRARY_TCP_BRIDGE_PORT=43594 \
  node scripts/serve-game-library.js
```

`GAME_LIBRARY_JS5_GAME` picks which game's cache the bridge serves when the
socket URL carries no `game` parameter (default `dekobloko`), and
`GAME_LIBRARY_JS5_LOG=1` echoes the JS5 session log. The bridge serves one port,
so it covers one game at a time.

### Host-turn yielding

The play page yields the JVM's host turns through a `MessageChannel` task.
Firefox clamps the nested `setTimeout(0)` behind the older timer yield, which
idled the main thread for about a fifth of the loading phase. Add `?yield=timer`
to compare against the old behaviour.

### What the catalog does and does not prove

The catalog proves that each game receives the correct launch manifest, assets,
cache namespace and browser host services. It does **not** claim that every game
has reached its main menu in a browser during each server startup. The
`--until-main-menu` suite in §2 is the slower gate that does.

---

## 5. Native applet launcher

```bash
./scripts/launcher/build.sh
```

This builds `.work/launcher/dekobloko-launcher.jar` from `apps/launcher/src/`.

### Applet toolchain constraint

Every game in this harness is a `java.applet.Applet`. The Applet API is
deprecated for removal from JDK 17 onwards and is **gone in JDK 26**, so a JDK
that has dropped it cannot compile the decompiled sources, cannot build the
launcher, and cannot run either. Nothing here is a decompiler defect.

Measured on this machine (JDK 11, 17, 21 and 26 installed): `java.applet`
resolves and compiles under JDK 11, 17 and 21 (with a removal warning from 17
on) and fails under JDK 26 with `package java.applet does not exist`.
`scripts/launcher/build.sh` completes on JDK 11 — 0 errors, warnings only for
`sun.awt` internal APIs — and produces
`.work/launcher/dekobloko-launcher.jar`.

Compile decompiled sources against the stubs with a JDK that still ships
`java.applet`:

```bash
javac -nowarn -proc:none -cp lib/dekobloko-stubs.jar -d out games/vertigo2/*.java
```

On a JDK without the Applet API the same command fails hard. For vertigo2 that
is 100 errors, of which only 60 name the real cause; the other 40 are cascade
damage from `Applet` being an unknown type and look like genuine decompiler
bugs while being nothing of the sort. Re-run on an Applet-capable JDK before
investigating any of them — all 100 disappear.

The same applies to the launcher build, where the cascade shows up as
"does not override or implement a method from a supertype" errors in
`BasicAppletContext` and `UrlAudioClip`, because `AppletContext` and
`AudioClip` no longer exist there.

### Running

The launcher needs an Applet-capable JRE and a desktop session (`DISPLAY` or
`WAYLAND_DISPLAY`):

```bash
java -Djava.awt.headless=false \
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
  `build.sh` first, so it is unusable for another game. Use
  `scripts/launcher/run-launcher.sh`, which forwards its arguments, or invoke
  `java` directly as above.
- A jar built straight from `javac` output carries the decompiled field names
  rather than the original obfuscated ones. That is self-consistent for an
  all-recompiled gamepack, but it will not interoperate with original classes in
  a mixed jar.

A successful start looks like this in the trace:

```text
launcher.loadClass Vertigo2
launcher.newApplet Vertigo2
applet.setStub
stub.appletResize 640x480
applet.init.return
applet.start.return
frame.setVisible true
```

### Run modes

| Script | Mode |
|---|---|
| `scripts/launcher/run-fake-awt-check.sh` | automated fake-AWT boundary check |
| `scripts/launcher/run-real-awt.sh` | human-in-the-loop real AWT window |
| `scripts/launcher/run-record-awt.sh <file>` | record real AWT interaction |
| `scripts/launcher/run-replay-awt.sh <file> [--replay-speed 4]` | replay interaction through fake AWT |
| `scripts/launcher/run-replay-awt-capture.sh` | replay with capture |
| `scripts/launcher/run-trace-test.sh` | trace oracle (`apps/launcher/assert-trace.js`) |

The fake-AWT mode uses `local.awt.FakeToolkit` and
`local.awt.FakeGraphicsEnvironment` as an AWT man-in-the-middle. It does not use
Xvfb and does not compare pixels; it asserts stable boundary events such as
applet parameters, cache redirects, fake display discovery, frame peer
creation/layout and lifecycle calls. It is an API boundary test, and it is the
check to run after bytecode, launcher, cache or harness changes. Expected
result:

```text
Trace OK: .../.work/games/dekobloko/traces/headless-init.log
```

Launcher options: `--awt fake|real`, `--headless-init`, `--sleep-ms <millis>`,
`--trace-file <file>`, `--record-awt <file>`, `--replay-awt <file>`,
`--replay-speed <factor>`, `--keep-open-after-replay`, `--gamepack <jar>`,
`--server <url>`, `--main-class <class>`, `--gamecrc <crc>`.

### Java Sound through PipeWire

Some gamepacks open Java Sound through ALSA. Where plain ALSA maps to hardware,
that bypasses PipeWire and can either produce no mixed desktop audio or lock
`/dev/snd/pcm*` directly. Force the ALSA PipeWire plugin explicitly:

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

ALSA_CONFIG_PATH="$PWD/.work/alsa/pipewire-java.conf" \
  java -Djava.awt.headless=false -jar .work/launcher/dekobloko-launcher.jar \
    --awt real --gamepack .work/games/minerdisturbance/gamepack.jar \
    --main-class MinerDisturbance --gamecrc 1412183595
```

A direct-ALSA launch shows open fds such as `/dev/snd/pcmC0D0p`,
`/dev/snd/controlC0` and `/dev/snd/timer`. A PipeWire-routed launch loads
`libasound_module_pcm_pipewire.so`, has `pipewire-memfd` fds, and appears in
`pactl list sink-inputs`.

---

## 6. Protocol servers

```bash
PYTHONUNBUFFERED=1 PYTHONPATH=apps/server python3 -u -m dekobloko_server
PYTHONPATH=apps/server python3 -m dekobloko_demo <the same arguments>
```

`apps/server/` is the authoritative reference implementation; defaults come from
`dekobloko_server/__main__.py` and `apps/server/README.md` documents its
arguments. `dekobloko_demo` runs the same server plus scripted socket-free
sessions.

Both `PYTHONUNBUFFERED=1` and `python3 -u` are needed when redirecting the log;
without both, stdout is block-buffered and the log stays empty, which looks
identical to a server that is logging nothing.

`apps/server-js/` is a mechanical port of the same protocol, validated against
Python golden vectors (`cd apps/server-js && npm test`). It is not wired into
any launcher. The wire formats both implement are in [protocol.md](protocol.md).
