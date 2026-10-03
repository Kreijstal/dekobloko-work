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

Record a real boot (§3). `tools/js5/js5-builds-validated.json` records the
validated builds and their handshake revisions; it is a data record, with no
downloader in this checkout.

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
node scripts/js5-server.js --cache-dir <dir> [--port 43594] [--host 127.0.0.1] \
  [--game-crc N]
```

Run **one server per game**. The build revision in the handshake cannot route
for you: the 44 validated builds collide into 31 distinct values.

The handshake's trailing `u32` *can*. It is the game's `gamecrc` from the
AlterOrb launcher config (`dekobloko` is `2147312574`), and `--game-crc` makes
the server refuse a connection from any other game instead of answering it out
of the wrong cache. The launcher passes it automatically. This matters because
serving one game's index layer to another is invisible from the client's side:
every request is answered, and the game still never boots, because it looks an
asset up by name and the foreign table resolves it to a group that cache does
not hold.

Chaining is checked for the same reason. A recorded index layer chained with a
client cache must actually describe that cache — same archives, and matching
CRC/version for the groups it stores — or the server refuses the chain and names
the archive and group that disagree.

The launcher wires this up itself:

```bash
node scripts/launch-alterorb-games-jvmjs.js --local-cache [dir] --game chess
```

`--local-cache` starts one server per selected game on its own ephemeral port
and points that game's `gameport1`/`gameport2` at it.

`scripts/js5-recorder.js` is the recording half of that flow.

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

The bundle directory is not built by this server. Refresh it from java-tools
before any run whose result depends on runtime code, or the page keeps serving
whatever was copied there last:

```bash
(cd "$JAVA_TOOLS_ROOT" && npm run build:bundle)
cp "$JAVA_TOOLS_ROOT"/dist/*.js /tmp/dekobloko-browser-bundle/
cp /tmp/dekobloko-browser-bundle/jvm-debug.js \
   /tmp/dekobloko-browser-bundle/jvm-debug-current.js
```

`ALTERORB_JVMJS_CACHE_ROOT` moves the client-cache root the same way it does for
the Node launcher (§2), covering both readers here: the cache files mounted into
the browser and the JS5 chain's fallback layer. Point it at a copy so a run
cannot read or write the live `~/.alterorb/caches`.

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

### Compile-turn budget

A synchronous compile runs on the thread the guest runs on, so its duration is
a freeze the player sees. The runtime bounds how much extra work one compile
turn may pull in while the guest is running (`postMainCompileBudgetMs`,
default 120 ms); what it bounds today is the Wasm tier's on-demand callee
recursion. Add `?compileBudget=N` to try another value, or `?compileBudget=0`
to remove the bound.

Measured in Firefox on the NUC, back to back, clicking "Stamina Mode" on the
Deko Bloko menu (first click after the menu appears) and booting to that menu:

| bound  | freeze on the click | boot to the menu |
| ------ | ------------------- | ---------------- |
| none   | 9.7-10.0 s          | 228-247 s        |
| 120 ms | 4.3-4.8 s           | 109-114 s        |
| 40 ms  | 4.7 s               | 1226 s           |
| 15 ms  | 6.7 s               | 299 s            |

A tighter bound is not better: a turn that keeps running out leaves Wasm
modules partial, and rebuilding them costs more than the cascade did.

### What the Start Game stall is made of

Traced on one clock (`.work/start-stall/drive-timeline.js` records the browser
mousedown, AWT enqueue and dispatch, every scheduler tick with its thread and
top-of-stack method, every presented frame with an 80x60 downsample, every
outermost compile with its own start, and the JIT's prepared-deopt counter;
`timeline-report.js` classifies the frames from their pixels, partitions the
interval and cuts the deopt count at the briefing frame). The definitions
matter:

| frame | what it is | when (this host, preparation off) |
| --- | --- | --- |
| first presentation after the click | a **menu repaint** — the pressed row; 96-98% of its pixels equal the menu | 6-110 ms |
| first transition frame | the fade out of the menu begins | 4.6-5.9 s |
| first Stage 1 briefing frame | the "Stage 1: Fruit" screen, settled | 5.5-6.8 s |
| first board frame | after SPACE | +0.5-0.8 s |

An earlier iteration cut the compile timeline at the first *presentation* and
concluded that "none of the compilation falls before the first frame". That
was true of the menu repaint and false of the briefing: cut at the briefing,
with preparation off, 71-74% of the interval was synchronous compilation
(76-79 outermost compiles, 3.9-5.0 s), because this page hosts the JVM
through the debug controller, whose constructor turns the runtime's
ahead-of-main preparation off, so every gameplay method was compiled on first
use — the boot itself ran ~1000 synchronous post-main compiles (33 s).

**Preparation is now on by default here**, and complete: the page asks the
runtime for the ahead-of-main pass (`prepareBeforeMain`), which runs to a
fixed point (compile rounds until nothing new appears, a link pass over
every prepared call site, Wasm modules for the prepared oversized-loop
upgrades settled against their dependencies, then the Wasm tier frozen),
and the runtime keeps class records stable across the `um` fallback-stub
upgrade the Whirlpool adapter causes (`docs/phase1-worker-audit.md` in
java-tools has the mechanisms and the bugs each step exposed). `?prepare=0`
is the developer opt-out for A/B work; `?prepareWasm=0`, `?prepareEffectful=0`,
`?prepareLoops=1` are bisection diagnostics, not configurations to ship;
`?asyncCensus=1` records every synchronous call site that hands a call back
to the scheduler, with the reason; `?preparedConstructors=0` keeps only the
syntactic constructor admission (the java-tools
`JVM_DISABLE_PREPARED_CONSTRUCTORS` lever), and `?jitDeny=a,b` refuses JIT
admission for those guest classes in every tier (`JVM_JIT_DENY`), both for
bisecting a problem in a body only the completed preparation compiles.

Back-to-back on 2026-09-12, same page script, the previous candidate bundle
with `?prepare=1` ("prepare=1 experiment": preparation on, one pass, no
link step, prepared callees still treated as asynchronous) against the
completed preparation by default; two pairs, the second with the Gecko
profiler and the census on (which costs both arms alike):

| | `?prepare=1` experiment | completed preparation |
| --- | --- | --- |
| pre-main compiles | 2530 (80-86 s) | 2556-2561 (84-88 s) |
| post-main compiles before the briefing | 1 (18-23 ms, a Wasm callee link) | 1 (21-25 ms, the same) |
| click -> first transition frame | 865 / 1189 ms | **611 / 696 ms** |
| click -> Stage 1 briefing | 1584 / 2062 ms | **1241 / 1538 ms** |
| briefing -> 30 more frames | 2392 / 3184 ms | **1691 / 2085 ms** |
| SPACE -> board | 404 / 575 ms | 331 / 552 ms |
| prepared-body deopts, whole Start Game stage | 72458 / 75023 | **2884 / 3206** |
| … of which before the briefing | (no counter in that bundle) | 570 / 615 |
| interpreter time before the briefing (profile) | 188 ms | 150 ms |
| runtime helpers under generated code (profile) | 980 ms | 804 ms |
| longest rAF gap after the briefing | 72 / 85 ms | 70 / 79 ms |
| boot: first frame / menu | 116-134 s / 185-192 s | 126-131 s / 173-183 s |

The 90 % of the deopt churn that disappeared was one cause: the call linker
decided whether a callee is synchronous with the run-time admission, which
rejects any method that constructs an object, so a prepared caller reaching
a prepared draw/text helper (`mm.a(Ljava/lang/String;II)V` and friends)
handed every call back to the scheduler. A callee with a published
synchronous body is a synchronous callee now. Six-bytecode getters such as
`mi.c()Lol;` were left without a body by a "worth compiling" shape heuristic
that has no meaning before main, and `invokespecial` of an inherited method
never walked the superclass chain; both fixed.

What remained after that (`?asyncCensus=1`: 1318 handoffs in the stage,
293 of 5156 methods unprepared) was compiler coverage, and it is closed as
of 2026-09-12 (java-tools `docs/phase1-worker-audit.md`, "Compiler coverage
after preparation"): constructors are admitted on the resolved call graph
inside the preparation fixed point (161 constructors and their 100 callers
were interpreted for a syntactic rule), nested irreducible regions of the
two oversized `client` methods go through the dispatcher, `pop2` and
`multianewarray` are emitted by every tier, the JIT runner has the long and
switch opcodes it lacked, and the before-main preload asks the browser's
file provider for its classes, so a class the game reaches only by
`Class.forName` (`ag`, the mouse-wheel listener, whose synchronized
20-bytecode getter was the last 488-handoff site) is prepared like every
other. Two of those gaps were found the hard way: the first candidate
stalled after the logo for eight minutes and more, because a prepared body
with `new int[a][b]` deoptimised for good at its first allocation
("unsupported generated opcode multianewarray") and the loading loop then
ran on the awaited scheduler path at about a millisecond per bytecode; the
same session's census recipe (`jit.deoptedMethods` with reasons, page
snapshots every 15 s, the sampled scheduler rows' `slowPathSamples`, and a
Gecko startup profile of the stall window) is what to reach for next time.
Back to back on the same loaded host (current bundle, candidate, candidate
again): click -> briefing 1197 / 1148 / 1188 ms, briefing -> 30 frames
1502 / 1406 / 1359 ms, SPACE -> board 468 / 345 / 466 ms, longest rAF gap
107 / 61 / 62 ms, stage deopts 2951 / 1583 / 1583, interpreter share of the
click 656 / 34 / 31 ms, synchronous compiles in the stage 1 / 0 / 0, and
handoffs at synchronous call sites 2 in the whole stage (6 ms), both
singletons. 38 of 5174 methods stay unprepared: 29 `synchronized` blocks
(gated behind `JVM_ENABLE_EFFECTFUL_MONITOR_CODEGEN=1`), three
constructors that reach an asynchronous JRE shim and their callers. The
remaining 1583 stage deopts are structured-tier continuations, resume
handoffs and safe points -- scheduler quanta, not coverage.

The compiler-side numbers from the earlier iteration still stand for what
they measure: a structured-SSA compile is linear in method size, `new
Function` is 4% of it, and the indentation representation is 56% of a large
compile in SpiderMonkey (19% in V8). They describe the cost of a compile, not
why a transition would pay for one — which, with preparation on, it no
longer does.

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
| `scripts/launcher/run-launcher.sh <args>` | build, then forward any launcher options |
| `scripts/launcher/run-real-awt.sh` | human-in-the-loop real AWT window (dekobloko only) |
| `scripts/launcher/run-trace-test.sh` | automated fake-AWT boundary check / trace oracle (`apps/launcher/assert-trace.js`) |

AWT interaction recording and replay have no wrapper script; pass
`--record-awt <file>`, `--replay-awt <file>`, `--replay-speed`, `--offscreen`,
`--frames` and `--output-dir` to `run-launcher.sh` directly.

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
