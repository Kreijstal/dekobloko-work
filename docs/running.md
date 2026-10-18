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

### Jagex intro only (GeoBlox)

Build a standalone desktop player from the published readable GeoBlox sources
in the sibling `funorb-decompiled` checkout:

```bash
node apps/intro/geoblox-intro.mjs --assets ../public/jvm-assets/geoblox-js5 --check
~/.cache/dekobloko/geoblox-intro/run.sh
```

The first command compiles and checks two animation cycles in a separate
headless validation JVM. This is a correctness test, not benchmark warmup.
The second plays the original intro once and closes the window after its fade.
Escape aborts it. Mouse movement controls the original mesh lighting. Intro
assets load before the window opens. No applet, loading screen, game bootstrap
or server is started. Sound uses Java Sound when an output device is available;
`run.sh --silent` skips audio decoding and playback.

Use a JDK whose `javac` supports `--release 8` to build and Java 8–25 to run
(the game classes reference the removed Applet API). `JAVA` and `JAVAC` select
executables; the player automatically prefers an installed Java 8, 17, 21 or 11.
`FUNORB_DECOMPILED_DIR` selects another publication checkout. `--output DIR`
changes the generated player directory; it contains classes, five assets, a
launcher and one provenance receipt. The browser build adds its runtime and one
`intro.aot` artifact alongside them. Generated files stay outside the repository.
`--build-only` builds without checking or opening a window. Omit both mode
options to build and immediately play.

For the same class files in Firefox, compile the browser artifact ahead of time,
then start the loopback-only host and open its printed URL:

```bash
node apps/intro/build-aot.mjs
node apps/intro/build-aot.mjs --mode replay
node apps/intro/serve-intro.mjs
```

The compiler builds a separate browser runtime from the sibling java-tools
repository's committed HEAD, excluding working-tree edits. The selected launcher
bundle stays intact. Runtime builds use the sibling dependency installation, or
`~/git/java-tools/node_modules`. `--runtime DIR` selects an existing bundle
instead. Both compilation and the fresh-JVM replay check stop before any Java
class initializer or `main()` runs; they do not warm up the animation. Rebuilding
the desktop player invalidates the browser artifact, so run these commands after
each player rebuild.

The build selects known call and allocation dependencies of the dedicated
browser entry; unused desktop callbacks and audio stay outside that scope. It
stores independently compressed method entries, expands one entry at a time,
and bounds compressed transport plus two decoded-entry copies to 64 MiB. This
accounting budget is separate from total JVM heap. Unknown dynamic/native targets retain
normal execution fallbacks.

The page automatically replays the prepared JavaScript bodies. Its identity
checks cover class bytes, runtime bundle, compiler options and native integration.
Wasm lowering and linking still occur during preparation; the report exposes
cache misses/refusals and compilation during execution. This is not yet a fully
serialized Wasm executable. The host loads only intro containers and has no
loading UI or game bootstrap.

Run the comparison on a visible desktop with Playwright Firefox available:

```bash
DISPLAY=:0 node apps/intro/compare-intro.cjs \
  --output ~/.cache/dekobloko/intro-comparison.json
```

`PLAYWRIGHT_ROOT` selects an installed Playwright package; `--url` selects the
loopback host and `--player` the matching desktop build. The harness rejects
mismatched provenance. Each host gets a fresh JVM and exactly one pass through
ticks 0–250: no warmup, replay, frame-ID strip or external frame observer.
Both runs are silent and skip unused audio decoding. The report includes AOT
installation/preparation time, cache coverage and execution compilation counters.
An existing valid comparison without AOT is retained inside the same report as
`baseline`; failed runs leave that report intact.

For subsequent runtime comparisons, reuse that report's native timing and hash:

```bash
DISPLAY=:0 node apps/intro/compare-intro.cjs --reuse-native \
  --output ~/.cache/dekobloko/intro-comparison.json
```

This launches only a fresh Firefox process. It preserves the TeaVM result and
keeps up to eight JVM trials in the same report. Source/assets must still match
the saved native provenance. Every pass captures tick 80 in memory and checks
its RGB hash after the animation timer stops; no screenshots are saved.

Each run returns after 251 frames, targeting a 20 ms cadence. The report records
the Java animation duration and the whole Java entry-point duration. Dividing
251 by animation seconds gives average render throughput. Slower hosts stretch
the animation rather than skipping work. This is a duration comparison, not a
presented-FPS or rolling-window acceptance test. The native process wall time
also includes JVM startup/shutdown; browser wall time includes its host startup.

The first visible laptop AOT comparison (Firefox 148.0.2, HotSpot 8u504,
251 frames, silent, no warmup) failed the performance objective:

| Duration | Previous browser path | AOT browser path | HotSpot |
| --- | ---: | ---: | ---: |
| Animation | 35.603 s | 33.404 s | 5.020 s |
| Browser launch to Java return | 66.062 s | 83.420 s | — |

AOT preparation took 32.837 s, including 11.368 s restoring generated bodies.
All 962 cache entries replayed without misses/refusals. Synchronous compilation
after Java started was **zero**. The 9,654,482-byte artifact covers 924 selected
methods (916 prepared bodies, eight retained execution fallbacks). Offline
compilation and replay executed no guest code; a separate Firefox correctness
run matched the full native reference hash at tick 80.

Playback remains 6.65 times the capped native duration, and startup regressed.
This establishes a failed performance fix, not acceptance. The runtime bundle
and host entry also changed, so the small playback difference does not isolate
AOT's contribution. Generated-code execution and runtime overhead remain to be
improved. The normal launcher artifact was not replaced. A follow-up
`preparedLoopLeafWasm` experiment increased complete Wasm modules from three to
60, retained zero post-entry compilations and matched the same reference image,
but its separate local diagnostic pass took 15.128 s versus the earlier
10.754 s. It was reverted; this was not a release acceptance measurement. No CPU-throttled,
heap-limited or phone acceptance is claimed for this candidate.

For an independent canvas colour check, open `/?verify`: at tick 80, the browser
captures a canvas RGB readback instead of the submitted RGBA buffer. Both paths
hash after the animation timer stops and reuse the saved native reference.

#### TeaVM Wasm GC comparison

Compile the same cached intro renderer with TeaVM 0.16.0, then open
`http://127.0.0.1:5188/teavm` on the existing intro host:

```bash
node apps/intro/build-teavm.mjs
node apps/intro/serve-intro.mjs
DISPLAY=:0 node apps/intro/compare-teavm.cjs
```

The build uses Maven, JDK 21 and TeaVM's `WEBASSEMBLY_GC` target with `FULL`
optimization. It reads the existing player classes and writes only to
`~/.cache/dekobloko/geoblox-intro/teavm`. No generated Java, JARs or Wasm binaries
are committed. Rebuilding the native class files discards the TeaVM artifact.
The timing harness adds one `teavm` result to the existing comparison report,
reusing its saved native timing and reference hash; it does not run HotSpot.

Only browser host services differ: local JS5 assets, JPEG decoding and canvas
presentation. The original mesh/lighting/rasterizer methods are compiled from
the cached game classes. The AWT Sprite image constructor delegates to the
browser decoder. Desktop AWT/applet/Swing/audio, socket and object-input services
are unavailable in this intro: their host constructors/initializers are inert,
and other concrete service methods throw if reached. This is an intro port,
not a full game or multiplayer port. Direct NIO memory carries the RGBA frame
out of Wasm; pixel conversion stays in Java/Wasm.

The first builds lacked desktop type declarations and two serialization catch
types (`OptionalDataException`, `StreamCorruptedException`) absent from TeaVM's
class library. The latter produced invalid `br_on_cast` instructions even though
Maven reported success. Supplying the JDK declarations fixed validation. The
builder now validates the Wasm binary before replacing the current artifact.

On kreijstalaptop, Firefox 148.0.2, one fresh 251-frame pass with no warmup:

| Runtime | Animation duration |
| --- | ---: |
| Existing HotSpot reference | 5.020 s |
| Our prepared JVM | 33.404 s |
| TeaVM Wasm GC | **18.468 s** |

TeaVM loaded/instantiated its module in 0.593 s and prepared the intro in
0.542 s. The page's load-to-Java-return interval was 20.082 s; the harness's
Firefox-launch-to-completion interval was 26.801 s. Compilation took about
25.65 s on the build host with dependencies cached. The Wasm SHA-256 was
`ff16855309703ceb92e9b66a2f161004dbb8bf80c8432d5b0e6ff8aaa21a53cd`.
The existing full RGB reference hash matched at tick 80; hashing ran after the
timed pass. TeaVM was 1.81 times faster than our JVM in this comparison, but still
3.68 times the capped native duration. This does not meet the rendering target.

TeaVM setup and interop follow its [Maven configuration](https://teavm.org/docs/tooling/maven.html),
[Wasm GC loader](https://teavm.org/docs/wasm-gc-backend/loader.html) and
[direct NIO buffer interop](https://teavm.org/docs/runtime/jso.html) documentation.

The next JVM comparison isolated an execution overhead. A separate Firefox
sampling pass put about a quarter of animation samples under face-order
compaction, including repeated frame restoration and generic dispatch around
the integer-array copy. The compiler already recognized that copy, but refused
its direct call path while the owner was cold during preparation. java-tools
`85b8a0f` retains the original invoke's initialization guard and uses the direct
intrinsic after initialization. It adds no game names or opt-in policy. The
compaction body's restoring entry shrank from 18,098 to 9,958 source characters
and no longer contains generic invoke dispatch.

With the same cached classes/assets, a fresh unprofiled baseline took 37.820 s
(the earlier run was 33.404 s). The guarded-copy candidate took **20.839 s and
19.329 s** in separate fresh Firefox processes, each exactly 251 frames with
zero post-entry compilations and a matching saved RGB hash. A fresh TeaVM
comparison remained about 18.49 s. These are intro-only duration results; the
normal launcher bundle remains unchanged and the full-game performance target
is not established.

The same profile showed the large adaptive mesh-face renderer remaining in
SpiderMonkey's baseline tier. Enabling the existing proven straight-line
partitioner split its adaptive entry into four segments. Two fresh single-pass
runs took **18.359 s and 15.333 s**, with matching RGB hashes and zero runtime
compilations, versus the fresh TeaVM result of **18.490 s**. java-tools
`8f16dc1` makes this generic pass automatic, using a 98,304-character unit
threshold and a 49,152-character segment budget. Unsafe/opaque boundaries keep
their existing representation. The consumer's disable flag and size overrides
have been removed; no intro-specific compiler policy is needed.

The rebuild with default settings produced byte-identical source for all
1,301 recorded generated bodies. Its three Firefox passes took 21.438 s,
16.263 s and 19.182 s (19.182 s median); subsequent fresh TeaVM passes took
17.812 s and 17.497 s. The slower JVM passes are retained in the comparison
report. The first size policy therefore did not establish typical parity.

Reducing the generic unit/segment budgets to 49,152/24,576 characters split
the mesh renderer into seven segments. Two fresh passes took **15.402 s and
18.560 s**, a **16.981 s median**, versus **17.655 s** for the two latest
TeaVM passes. java-tools `0735505` selects those budgets by default. This
establishes a large execution improvement, but not uniform per-launch parity
or the original FPS floor. Every pass still runs just once, without warmup or
profiling; startup remains a separate unresolved cost.

The final default-settings rebuild again reproduced all 1,301 generated bodies
byte for byte. Its fresh Firefox pass took **18.095 s**, with no partitioning
options in the consumer configuration. The three smaller-budget passes thus
have an **18.095 s median**, about **2.5% longer** than recent TeaVM's
17.655 s median; their range is 15.402–18.560 s. All match the saved RGB hash
and execute zero JVM compilations after entry. The final artifact replays all
962 entries without misses/refusals/errors. Its browser-launch-to-completion
interval was 67.468 s, so animation parity does not imply startup parity.

Focused validation:

```bash
# In java-tools; NODE_PATH may select an existing dependency installation.
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/preparedArrayCopyIntrinsic.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/preparedIntegerInline.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/workerIntrinsicTransport.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/structuredAdaptivePartition.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/structuredSwitchPartition.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/structuredFramedWrapper.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/structuredResumeEntryBranches.test.js
# In dekobloko-work.
node apps/intro/build-aot.mjs
node apps/intro/build-aot.mjs --mode replay
node --test tests/intro-pixels.test.mjs
```

The compiler tests passed 70, 47, 10, 105, 51, 29 and 166 assertions respectively; offline
record/replay covered all 962 cache entries without misses, refusals or guest
execution. Pixel tests cover primary colours and alpha masking. An aligned
32-bit framebuffer packing experiment took 19.497 s, providing no improvement
over the 19.329 s byte-store run; it was reverted.

#### Local Node.js and HotSpot rendering comparison

Run a fresh, uncapped, offscreen pass on the current computer:

```bash
node apps/intro/compare-node.mjs
```

The harness uses the existing checked class files and AOT pack. Each process
renders ticks 0–250 once at 640×480, including RGB-to-RGBA framebuffer conversion.
There is no 20 ms pacing, display, warmup, replay or reference-image regeneration.
Tick 80 is captured in memory and checked against the saved native RGB hash
after timing stops. HotSpot's small host wrapper is compiled in a temporary
directory and deleted; game classes are not rebuilt. If the existing TeaVM
artifact is present, a separate fresh Node process also runs that exact Wasm
binary, checking its SHA-256 and readable-source identity first.

On the build computer (Intel i7-1360P, Node 22.23.2/V8 12.4, HotSpot 17.0.20.1),
three complete fresh-process comparisons produced:

| Runtime | Animation median | Range | Average render throughput at median |
| --- | ---: | ---: | ---: |
| HotSpot | **0.315 s** | 0.302–0.320 s | 796.9 frames/s |
| TeaVM Wasm GC in Node | **0.542 s** | 0.541–0.546 s | 463.2 frames/s |
| Our prepared JVM in Node | **2.263 s** | 2.230–2.266 s | 110.9 frames/s |

Median process wall times, including startup, were 0.517 s, 0.699 s and 7.736 s
respectively. Every runtime matched the saved reference hash on every pass.
Our JVM replayed all 962 AOT entries without misses/refusals/errors and compiled
zero guest methods after Java entry. V8/HotSpot's own machine-code compilation
remains part of the measurements. Node uses `jpeg-js` for image decoding during
setup, outside the animation timer; this is not an all-frame pixel comparison.
`JAVA`, `JAVAC` and `JAVA_TOOLS_NODE_MODULES` can select installed dependencies.

Results and at most eight recent comparisons occupy `nodeComparison` and
`nodeComparisonTrials` in the same local
`~/.cache/dekobloko/intro-comparison.json`; other report fields are preserved.
`valid` means the workload and reference checks passed, not FPS acceptance.

These measurements show substantial execution headroom on this machine,
including with TeaVM's unchanged Wasm artifact. They are not directly comparable
to the paced laptop Firefox runs: CPU, engine, presentation and pacing differ.
In particular, the saved laptop HotSpot duration of 5.020 s was cadence-capped.
Headless render throughput does not establish presented FPS, any rolling-window
minimum, the 6× slowdown/heap targets, full-game performance or phone acceptance.

Validation: `node --check apps/intro/compare-node.mjs` passed, the command above
completed three full comparisons, and
`node --test tests/intro-pixels.test.mjs tests/code-pack-compression.test.mjs`
passed all three tests. The benchmark changes no compiler defaults or selected
launcher artifacts.

#### Default array views ignore handler-only diagnostics

java-tools `2ead3b1` enables the existing normal-CFG array-optionality analysis
by default. A null check used only to construct an exception report no longer
makes a required array optional on the normal rendering path. Ordinary nullable
branches retain checked execution; throwing paths materialize the original JVM
state and execute their handlers. No consumer flag or game identity is needed.

Three fresh-process pairs on this computer, with **both** baseline and candidate
commands prefixed by `taskset -c 2`, measured:

| Pair | Previous JVM | Default normal-CFG analysis |
| --- | ---: | ---: |
| 1 | 2.832 s | 2.704 s |
| 2 | 2.821 s | 2.749 s |
| 3 | 3.040 s | 2.945 s |
| Median | **2.832 s** | **2.749 s** |

This is a modest **2.9% reduction**, not TeaVM parity. All child processes
inherited affinity to P core 2, including their host compiler threads; these
times should be compared within the pairs, not against the unrestricted table
above. Every pair rendered exactly 251 frames, matched the saved RGB hash,
replayed all 962 prepared entries, and compiled zero guest methods during
animation. No profiling or warmup ran alongside these six measurements. The
benchmark now records `machine.cpuAffinity` automatically. The current report's
`nodeOptimization.comparison` preserves this summary as its bounded trial list
advances.

The baseline is java-tools `0735505`, runtime SHA-256
`870ec5072844b1bae1f002cb742f0d2e32ee8bbce412fec3d63161ddeea4eb16`.
The isolated candidate's SHA-256 is
`ab613575466b1de4ea997fde5c17f648c06aca3c27d00550ca364adf8111638c`.
The normal launcher artifact remains unchanged. A fresh headless Firefox
correctness pass also matched the stored reference, replayed all 962 entries
without misses/refusals/errors, and compiled zero guest methods after Java
entry. It ran alongside compiler tests and is not a browser timing result.

Rebuilding committed `2ead3b1` sources reproduced all 2,216 serialized generated
source records byte for byte (digest
`4501b7f3b25e56e9346301d4c67854553e2d8a332ace59eb9634ed95322df82f`).
The rebuilt runtime hash is
`4dd27b3350685eb0ca2e8d741f86ba052b08b0f1a19120064e018ca269d48cda`;
Webpack assigns different dependency module IDs at the two build directory
depths. Its 9,832,108-byte AOT artifact replayed all 962 entries without misses,
refusals, errors or guest execution. A final unrestricted Node check took
2.215 s with the saved pixels matching and zero post-entry guest compilations;
this is a correctness/rebuild check, not another matched performance pair.

Earlier experiments in this pass were discarded:

- Conditional range proofs for cold-linked static arrays passed null, bounds,
  partial-write and transport checks, but a single 2.225 s exploratory result
  did not establish an improvement.
- Extending counted-loop recognition to several positive counter updates in
  one backedge block required preserving each intermediate SSA offset,
  retaining null checks for conditional storage, and proving termination
  without signed overflow. Focused tests caught an initially unsound merged
  range predicate that skipped a failing store partway through an unrolled
  iteration. The corrected prototype passed 173 assertions.
- Separating the long unrolled loop's bounds proof from its atomic trip budget
  retained scheduler polling and invalidated stale array proofs after a
  continuation; 186 assertions passed. The timing differences remained small
  and inconsistent. One exploratory pair overlapped a V8 optimization trace
  and was excluded. These broader renderer changes and their experimental
  fixture were removed; no opt-in policy was added.
- A separate V8 trace confirmed that the hot generated methods do reach
  TurboFan. Their remaining gap cannot be attributed solely to never reaching
  the optimizing host tier. Sampling/tracing outputs were diagnostic only.

Validation on the selected default:

```bash
# java-tools; the handler test now uses defaults, without the former opt-in.
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/handlerArrayView.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/jitCompiler.test.js
# dekobloko-work; committed sources are rebuilt in isolation.
node apps/intro/build-aot.mjs
node apps/intro/build-aot.mjs --mode replay
node apps/intro/compare-node.mjs
```

The handler test passed all 43 assertions, including interpreter comparisons
for caught null/bounds exceptions, zero-trip null input, optional/sibling arrays
and transported code. The compiler suite passed 2,361/2,364 assertions; the three
failures also reproduce using the unchanged baseline renderer: one existing
rethrow-wrapper eligibility assertion and two existing Wasm OSR return-box
assertions. They are not new failures from this default change. Browser/phone
presented FPS, constrained heap/startup and full-game stability remain unverified.


#### Prepared Wasm execution versus TeaVM

The current target compares **animation execution for the same 251 frames**,
with our duration no more than 1.10 times TeaVM's. Startup is recorded separately.
Each trial is a fresh process, without an animation warmup or replay. This target
remains unmet.

The Node harness now keeps its DOM shim until `run()` creates the executing JVM.
Previously it removed `document` after `initialize()`, silently disabling the
Wasm backend in the replacement JVM. Historical Node results above consequently
measure the JavaScript execution path. Correcting the shim alone took 2.234 s:
Wasm was enabled, but none of the twelve prepared modules executed. The harness
now reports backend enablement and a bounded census of entries, exits, direct
entries, deferred frames and bulk clears. It flushes the complete worker result
before exiting, including when stdout is a pipe; an early paired-run attempt
exposed truncated JSON and was discarded.

Inspecting the existing TeaVM binary with `wasm-dis` showed native GC-array
loads/stores and integer arithmetic in its raster spans. Small helper calls stay
inside its Wasm module. Our wider Wasm preparation initially took 7.130 s: live
handler ranges prevented integer-helper inlining, and nested helper calls crossed
JavaScript with canonical frames. Enabling the existing deep-inline machinery
allowed those helpers to inline, but selecting the remaining normal-flow bodies
still took 4.932 s. Existing direct canonical links reduced that exploratory
result to 2.275 s. These unrestricted single trials identified costs; they are
not the matched performance result below.

java-tools `eeffa15127f076cdb2727d665fffb948efd84e8e` fixes three generic cases:

- Native JavaScript-tag wrappers capture the original throwable across nested
  Wasm calls. Complete handler-free callers can therefore publish their native
  canonical exports, retaining all coverage, synchronization, speculation,
  spill and replacement guards. Older engines retain the existing bridge.
- Call-free normal paths check static class readiness once before guest effects.
  Cold dependencies return to the original entry without initializing an untaken
  branch. Calls, allocations and monitor operations retain local guards.
- The zero-fill entry proves consecutive zero stores, induction, the unrolled
  bound and scalar tail using symbolic locals. Temporary index copies and dead
  local initializations no longer defeat it. Mutable loop inputs, stale values
  across loops, zero-iteration assumptions, other field reads, altered branches
  and nonzero writes refuse the proof. Existing type, range, fuel, volatile-field
  and maximum-operation guards retain the original checked loop on failure.

The source adds no game identities or new configuration flags. The zero-fill
entry remains under its existing experimental policy. On the intro it executed
all 503 clear calls and preserved the saved reference hash.

For a controlled comparison, both runtimes used the same isolated preparation
policy: `prepareWasmPreparedUpgradesOnly:false`, with existing JIT options
`preparedCompleteWasm`, `preparedLoopLeafWasm`,
`wasmNormalFlowPreparedUpgrades`, `preparedWasmPositionalFrames`, and existing
`jit.wasm` options `deepInline`, `inlineColdIntegerLeaves`, `canonicalEhLinks`,
`canonicalDirectCalls`, `canonicalLeafCalls`, `nativeJsExceptionTags` and
`intZeroClearEntry` set true. These were changes in an isolated copy of the
consumer configuration, not a change to the selected launcher or normal player.
The baseline runtime was `2ead3b1`; the candidate was built from that archive plus
the three runtime files now committed in `eeffa15`. Unrelated decompiler working
changes were excluded.

Every command ran sequentially with `taskset -c 2`, Node's 1 GiB old-space limit,
and no profiler or concurrent build/test jobs:

| Fresh-process round | Baseline | Candidate | Existing TeaVM binary |
| --- | ---: | ---: | ---: |
| 1 | 2,920.000 ms | 2,046.000 ms | 826.252 ms |
| 2 | 3,539.000 ms | 1,765.000 ms | 832.279 ms |
| 3 | 5,278.000 ms | 2,371.000 ms | 1,027.717 ms |
| Median | **3,539.000 ms** | **2,046.000 ms** | **832.279 ms** |

The candidate improved every pair; the reduction between medians was **42.19%**.
Absolute durations varied substantially, so retain the ranges and per-pair
comparisons. Candidate/TeaVM ratios were 2.476, 2.121 and 2.307; the ratio of
medians is **2.458**, well outside the required 1.10. This is a comparison of
broader-Wasm policies, not proof of a 42% improvement to the current default
JavaScript selection. Each pass rendered exactly 251 frames and matched the
saved tick-80 RGB hash. The Wasm preparation policy still allowed nine post-entry
compilations, which must also be resolved before an execution-only rollout.

The baseline runtime SHA-256 is
`4dd27b3350685eb0ca2e8d741f86ba052b08b0f1a19120064e018ca269d48cda`;
the measured candidate is
`a89ccdefecc541f30c4d9c84f1186cf41d88a106838c346460346f89fe965e76`.
TeaVM's unchanged binary SHA-256 is
`ff16855309703ceb92e9b66a2f161004dbb8bf80c8432d5b0e6ff8aaa21a53cd`.
The exact policy, bounded trials, identities and backend census occupy
`nodeOptimization.wasmExperiment` in the single current
`~/.cache/dekobloko/intro-comparison.json` report.

Reproduction uses the existing intro scripts in isolated checkouts: apply the
policy above to the copied `apps/launcher/browser-runtime.json` and manifest,
then build each isolated runtime and its matching pack. For each of three
sequential rounds, substitute that player directory in:

```bash
node apps/intro/build-aot.mjs --player PLAYER --runtime RUNTIME
node apps/intro/build-aot.mjs --mode replay --player PLAYER --runtime RUNTIME
taskset -c 2 node --max-old-space-size=1024 apps/intro/compare-node.mjs --worker --player PLAYER
taskset -c 2 node --max-old-space-size=1024 apps/intro/compare-node.mjs --teavm-worker --player PLAYER
```

Focused validation in java-tools, using
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/FILE`:
`canonicalDirectFrames.test.js` passed 80 assertions;
`wasmLeafInitialization.test.js` 21; `intZeroClearEntry.test.js` 80;
`wasmColdIntegerInline.test.js` 54; `wasmNormalFlowCalls.test.js` 62;
`sharedFieldArrayCaches.test.js` 32; `wasmHeapArrays.test.js` 59;
`wasmJsExceptionTags.test.js` 20. The new tests exercise nested guest/host throw
identity, exactly-once effects, frame release, cold/reset readiness, symbolic
loop rejection, checked partial writes, overflow and fuel exits. The browser
bundle rebuilt successfully in isolation. In Deko,
`node --check apps/intro/compare-node.mjs` and
`node --test tests/intro-pixels.test.mjs tests/code-pack-compression.test.mjs`
passed (three tests).

The candidate AOT pack replayed all 962 entries without misses, refusals, errors
or guest execution. A fresh headless Firefox 148 pass also completed 251 frames
and matched the saved hash; it supported the native JavaScript tag and replayed
all 962 entries. Its paced animation took 6.106 s, but this was a correctness
smoke test, not a matched browser performance or presented-FPS acceptance run.
No screenshots or native reference images were regenerated.

Next work is reducing the remaining generated-loop checks and transitions,
finishing preparation before Java entry, and comparing any proposed default
selection against the selected runtime. Full-game memory, presented FPS,
constrained startup, stability and phone acceptance remain separate unresolved
gates. No release artifact or launcher policy was replaced by this experiment.

A follow-up extended the existing guarded heap-body version to call-free methods
with local handlers and static scalar caches. Its 32 KiB per-method budget was
the same in both variants. All 79 focused heap assertions passed, including
caught null/bounds failures, partial writes, mixed backing and aliasing. Three
fresh matched rounds gave baseline/candidate pairs of 3,764/3,060 ms,
2,179/1,942 ms and 1,828/2,042 ms. The median difference was only 6.29%, with a
regression in the third pair. The prototype and its added test were removed;
no default budget or selection changed. That discarded pass and earlier committed passes remain under bounded
`completedPasses` within the same JSON file. A stale-pack probe exited before Java entry while its
replacement pack was still building; it was not a timing trial.

The bounded census also exposed millions of direct calls in one fresh pass:
about 4.12 million integer-copy entries, 3.47 million gradient-span entries and
1.17 million solid-span entries. These are current-module counters, including
setup, not presented frames. At that point `arrayCacheFill` called JavaScript
imports for base and length at every array-parameter entry. A guarded heap body removes
backing branches inside a loop but does not remove those entry crossings.

#### Forwarded array metadata

java-tools `102fd83f9036ab7e0c9696a91aead3cea8d0a8b3` implements that transfer.
Eligible canonical calls automatically forward captured primitive-array bases
and lengths in an internal `canonicalHeapRun` signature. The ordinary `run`,
raw `runv` and canonical `canonicalRun` signatures stay intact. All entries share
one compiled method body; the change does not duplicate that body or create an
additional array representation. Java local slots remain separate from hidden
Wasm parameter ordinals, including category-two arguments.

An uncaptured base is `-2`; a captured non-heap/null base remains `-1`. Metadata
lives in invocation-local parameters, so recursion cannot overwrite its caller's
capture. Nonparameter caches query only after owner readiness permits it. A
refused fill explicitly leaves `-2`, so even a readiness change before entry
cannot forward an old/default pointer. Cache generation and alias rules remain
in force. Missing, late, partial and replaced exports keep the legacy Java-args
fallback and existing owned exception/fuel continuations. Compiler maps are
released with diagnostics disabled; retained callbacks do not capture SSA nodes.

The first forwarding variant removed the queries but retained redundant guards:
matched medians were 1,891 ms baseline and 1,955 ms candidate, with mixed pairwise
results. It was superseded. Folding the metadata-fill guards and eliminating
redundant result guards produced the retained variant. The comparison kept the
broader policy above and a 32 KiB parameter heap-version budget in **both**
variants, on CPU 2 with 1 GiB Node old space, sequential fresh processes, no
warmup/replay, and no counters, profiling, builds or tests alongside timing:

| Round | `eeffa15` baseline | `102fd83` candidate | Unchanged TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 1,928.000 ms | 1,753.000 ms | 751.379 ms |
| 2 | 2,165.000 ms | 1,810.000 ms | 745.272 ms |
| 3 | 1,980.000 ms | 1,604.000 ms | 837.934 ms |
| Median | **1,980.000 ms** | **1,753.000 ms** | **751.379 ms** |

Every candidate pair improved; the reduction between medians is **11.46%**.
The ratio to TeaVM is still **2.333**, so the required 1.10 target is not met.
Each process rendered 251 frames and matched the saved reference hash. The
candidate SHA-256 is
`6ee73ed498a158d9643a6ba95d7e1edaa9cbbf414b2945b80db93a9bb1cf6e0a`;
the baseline is the prior candidate
`a89ccdefecc541f30c4d9c84f1186cf41d88a106838c346460346f89fe965e76`.
The isolated build's four runtime source files matched the committed sources.

Separate fresh diagnostic processes enabled import counters. Across the main
integer-copy, gradient-span and solid-span kernels, base-plus-length queries
fell from **25,782,134 to 4,124**. The candidate's current modules recorded
2,224,279 base queries and the same number of length queries overall. These
include setup, are current-module counters rather than counts of retired
modules, and are not timing trials. The integer-copy kernel still made
**4,124,743 JavaScript reference-equality queries**. Generic bounded diagnostics
now expose parameter counts, metadata queries and reference-equality queries;
these counters are absent/null in ordinary timing runs. One early private
measurement driver failed JSON serialization before recording a complete pair;
its unpaired probe was excluded and the driver was corrected.

Validation commands in java-tools:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmParameterArrayAbi.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/canonicalDirectFrames.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmJsExceptionTags.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmHeapArrays.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmDirectStaticLinkContract.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmDirectInstanceLinkContract.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmLeafInitialization.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmColdIntegerInline.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/sharedFieldArrayCaches.test.js
```

They passed 96, 80, 20, 59, 57, 68, 21, 54 and 32 assertions respectively. The new
suite covers legacy entry compatibility, zero callee metadata queries, plain and
null arrays, recursive argument swapping, category-two slots, shared field
versions, cold/readiness transitions, unavailable expanded exports, fuel exits,
partial effects, exception payload release, and replacement during an active
throwing call. With `--expose-gc`, the SSA function and parameter/uses graph were
collected while the runtime imports remained live.

The isolated browser bundle rebuilt successfully. Offline record/replay served
all 962 AOT entries without misses, refusals, errors or Java execution. A fresh
headless Firefox 148.0.2 pass completed 251 frames and matched the reference; its
paced animation took 5.664 s. It ran alongside offline replay and is a correctness
check, not a browser performance acceptance result. The Deko syntax check and
three pixel/code-pack tests passed again. The nine post-Java-entry Wasm compiles
remain a preparation limitation. The normal launcher policy and selected player
artifact were preserved; no game export, screenshot or native reference was
regenerated.

#### Rejected reference-identity experiments

Two further candidates were tested against `102fd83`, with the same policy,
CPU 2 affinity and 1 GiB Node old-space limit. Every worker was a fresh process
rendering ticks 0–250 once, with no animation warmup or replay. The nine processes
in each group ran sequentially without profiling, counters, builds or tests
alongside timing. TeaVM was unchanged. All workers completed 251 frames and
matched the saved reference. Neither candidate was retained.

The first candidate used an existing immutable parameter-base cache to prove
**inequality** when bases differed. Equal offsets retained JavaScript reference
comparison, covering empty arrays and distinct overlapping views without any
ownership assumption or new metadata queries.

| Round | `102fd83` baseline | Unequal-base candidate | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 1,845.000 ms | 1,671.000 ms | 732.462 ms |
| 2 | 1,678.000 ms | 1,860.000 ms | 809.229 ms |
| 3 | 1,682.000 ms | 1,590.000 ms | 749.682 ms |
| Median | **1,682.000 ms** | **1,671.000 ms** | **749.682 ms** |

The 0.65% reduction between medians and mixed pairwise results did not establish
a useful repeatable improvement. A separate fresh counter run explained the
limited opportunity: the copy helper still made **4,124,736** identity imports,
only seven fewer. Its hot caller passes the same face-order array as both source
and destination. Proving only inequality leaves that case on the fallback.
The candidate runtime SHA-256 was
`a436890d878bbdfe8ecc927171f6da8fd281466b608ff023c355d2c570363a8a`.

The second candidate added a weak map of allocated views to their existing
finalizer extent records. An owned, live, nonempty allocation has a unique base;
empty arrays, foreign views, other heaps and freed/detached views refused that
proof. Structured base queries used this ownership check, allowing native
reference equality and inequality for captured owned parameter arrays. Missing
proof retained JavaScript identity. The shared bulk-copy kind guard also needed
the ownership condition: otherwise an accepted foreign view could use a refused
base of `-1`. Foreign overlapping views then used the original overlap-safe
native fallback. Explicit frees removed ownership, used the recorded extent and
refused duplicate/foreign frees.

| Round | `102fd83` baseline | Owned-base candidate | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 1,667.000 ms | 1,796.000 ms | 733.965 ms |
| 2 | 1,642.000 ms | 1,628.000 ms | 706.016 ms |
| 3 | 2,015.000 ms | 1,886.000 ms | 868.753 ms |
| Median | **1,667.000 ms** | **1,796.000 ms** | **733.965 ms** |

The median was **7.74% higher**, with mixed pairwise results: no repeatable win.
The separate counter process showed **zero** copy-helper identity imports,
compared with 4,124,743 before the change. It also recorded 2,224,279 structured
base queries, each now performing ownership validation, plus the same number of
length queries. Those counters include Java setup and current modules only;
they do not isolate animation time or prove a CPU-cost attribution. The next
experiment should distinguish the cost of the ownership checks from the saved
identity crossings, rather than treating a lower import count as success.

The owned-base runtime SHA-256 was
`6911c62d19effedeb4317aa4940740fc29c39d96774548d772645e7240dc9308`;
the baseline was
`6ee73ed498a158d9643a6ba95d7e1edaa9cbbf414b2945b80db93a9bb1cf6e0a`.
Its isolated browser/worker build passed with the same four warnings. Offline
AOT recording produced 9,830,992 bytes without executing Java; timing workers
replayed that matching pack. No Firefox/native image run was needed after
rejecting the candidate.

The discarded ownership variant passed these focused commands in java-tools:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmParameterArrayAbi.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmHeapFreeList.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmHeapGrowth.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmHeapArrays.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/sharedFieldArrayCaches.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmHeapBulkCopy.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/primitiveArrayCopyEntry.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/primitiveByteCopyEntry.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/intZeroClearEntry.test.js
```

They passed 164, 106, 35, 59, 32, 21, 91, 108 and 80 assertions: **696 total**.
Coverage included both comparison directions, ordinary/raw/expanded entries,
forwarded aliases, nulls, empty arrays sharing offsets, foreign views, forged
annotations, other heaps, changing receivers, ownership removal/reuse, detached
buffers, disabled finalizers, GC reclamation, exception/fuel continuations and
compiler-graph collection. After reverting the prototype, the retained
`wasmParameterArrayAbi` suite passed its original 96 assertions again. Rejected
runtime/test edits were removed from the worktree; the unrelated decompiler
changes were preserved. The normal launcher and selected player were unchanged.

#### Amortized ownership: measured and rejected

The caller-side ownership proposal was implemented and tested. Ordinary bases
remained cheap; a separate internal entry accepted verified captures, and the
ordinary expanded entry sanitized unproved bases. Callers obtained ownership
only for known comparison-bearing callees, once per immutable parameter or
field-cache fill. The implementation preserved old signatures, replacement,
recursion, category-two slots, readiness refusal and unsupported-export fallback.
A weak map reused the allocator's finalizer records. A captured intrinsic buffer
getter avoided executing a host accessor during ownership validation.

It passed 888 focused assertions. The separate counter run reduced ownership
queries from 2,224,279 in the global variant to **10,122**, while copy-helper
identity imports stayed at **zero**. Counts include setup/current modules and
are not timing measurements. The final bundle SHA-256 was
`872c7c856afd55fbd9cfb53f5ddf624b0f96c427f534cd27f9993a93d633b204`;
the matching offline AOT pack was 9,833,849 bytes.

Five fresh paired rounds used the same 32 KiB policy, CPU 2, 1 GiB Node old
space, no animation warmup/replay and no concurrent profiling, counters, builds
or tests. Baseline/candidate order alternated; unchanged TeaVM followed each
pair. All 15 processes completed 251 frames and matched the saved reference.

| Round | `102fd83` baseline | Amortized ownership | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 1,724.000 ms | 1,641.000 ms | 750.665 ms |
| 2 | 1,944.000 ms | 1,497.000 ms | 750.585 ms |
| 3 | 1,889.000 ms | 1,731.000 ms | 761.265 ms |
| 4 | 1,712.000 ms | 2,168.000 ms | 744.569 ms |
| 5 | 1,732.000 ms | 1,706.000 ms | 842.847 ms |
| Median | **1,732.000 ms** | **1,706.000 ms** | **750.665 ms** |

Four pairs improved, but the median reduction was only **1.50%** and one pair
regressed **26.64%**. This did not justify the extra allocation bookkeeping and
ABI machinery. The ownership implementation and its added tests were removed;
no ownership option, extra entry ABI or allocator weak map remains from it.

#### Proved empty invocations: measured and rejected

A subsequent generic prototype proved when a static void method could return
without effects under a zero integer argument. It interpreted locals and the
operand stack with constants/reference symbols and single-variable affine
integers, explored both possible reference-alias branches, and used difference-
bound matrices for signed branch constraints. Every symbolic addition had to
stay within the signed i32 interval. Reachable memory operations, calls,
class-initialization reads, throws and monitors refused the proof. All feasible
paths had to reach a void return; an unresolved or nonterminating path refused
it. Successful full re-proofs removed unnecessary nonnegative-argument guards.

The analysis was bounded to 2,048 code items, 12 parameters, 4,096 steps per
attempt, 16,384 steps total and 128 pending states. Budget exhaustion retained
the original body. The emitted entry checked block zero and reserved more
callee fuel than the proved maximum path cost. Numeric proof metadata was
frozen. There was no user flag or game/method-name rule.

For the intro's integer-copy method, the proof found argument 4 equal to zero,
argument 1 nonnegative and a maximum of 27 bytecode steps. A separate diagnostic
showed **3,884,089 of 4,124,743** calls, about 94%, taking that empty path. The
next variant let callers omit these invocations entirely after argument
evaluation. A native readiness/fuel export was reached through the existing
function table, with target/plan identity and revocation on replacement or
withdrawal. Custom JavaScript readiness hooks retained ordinary invocation.
Low fuel retained the original owned interpreter continuation.

The final diagnostic counted **3,883,074 caller omissions**, 240,639 remaining
direct copy entries, 1,015 remaining empty returns and 240,654 identity imports.
The copy method queried only 30 bases and 30 lengths. All 251 frames completed and the saved reference
hash matched. These were separate counter runs, including setup/current
modules, not performance trials.

The prototype passed 127 new assertions and related focused tests: 651 total.
Coverage included duplicated loops and local copies, signed overflow, nulls,
argument side effects, reachable effects/faults, nontermination and branching
budgets, fuel/spill continuation state, publication/withdrawal, replacement,
custom readiness, table-slot retirement and collection of compiler graphs and
superseded contexts. The final runtime SHA-256 was
`4320a13bfd5822c91ac0f023223d1041045869bd12fb9d83bc765334ad95e7a6`;
the matching offline AOT pack was 9,832,663 bytes, recorded without Java execution.

The same five-round alternating protocol produced:

| Round | `102fd83` baseline | Empty entry/caller omission | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 1,681.000 ms | 1,736.000 ms | 740.408 ms |
| 2 | 1,749.000 ms | 1,761.000 ms | 743.940 ms |
| 3 | 1,668.000 ms | 1,714.000 ms | 814.352 ms |
| 4 | 1,875.000 ms | 1,685.000 ms | 746.489 ms |
| 5 | 1,694.000 ms | 1,640.000 ms | 764.893 ms |
| Median | **1,694.000 ms** | **1,714.000 ms** | **746.489 ms** |

Three pairs regressed; the candidate median was **1.18% higher**. Eliminating
millions of these calls did not produce a useful elapsed-time improvement.
The proof, entry guard, caller omission and readiness API were removed. Neither
rejected optimization was browser-tested or selected for the normal player.
The 10% TeaVM target remains unmet; the retained baseline in this group was
still about 2.27 times TeaVM.

#### Retained cleanup: omit unused canonical-table imports

java-tools `81e29d4` retains only the table-import cleanup. The GC stress checks
uncovered a separate retention bug. Every structured
module imported the canonical table whenever that policy was enabled, including
leaves that never called through it. A focused heap snapshot showed the shared
table retaining a superseded importing instance, whose runtime-import closure
retained its compiler's execution metadata. Starting table usage at false and
marking actual canonical calls during discovery removes that unnecessary edge.
Real callers keep the import. Discovery still determines the table order before
final emission, including a raw-table call preceding a canonical call.

Another retaining path was legitimate: a live dispatcher OSR companion can pin
its original direct import. The regression test retires those callers too
before requiring all superseded leaf metadata and frame owners to collect. It
also checks that canonical, raw-only and mixed-table callers still return the
exact result after publication and replacement. This does not discard metadata
needed by an active or pinned fallback.

Running the new regression with the original table-import policy produced four
expected failures: unused leaf/raw-only imports and retained old metadata/owners.
The cleanup passes these commands in java-tools:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/canonicalDirectFrames.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmParameterArrayAbi.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmDirectStaticLinkContract.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmDirectInstanceLinkContract.test.js
```

They pass 109, 96, 57 and 68 assertions: **330 total**. The GC checks use Boolean
probes; the first diagnostic assertion tried to format the retained JVM object
and was terminated. The temporary heap snapshots and diagnostic hooks were
removed. Only the table-import cleanup and its regression coverage were retained from
these experiments; unrelated decompiler changes were left untouched. This is a verified retention fix, not a claimed FPS or
animation-time gain. Full heap, startup, presented-frame and phone gates remain
open.

The isolated cleanup runtime matches committed java-tools `81e29d4` (excluding
only the generated JRE index); protected decompiler work was excluded. Its
SHA-256 is
`edbce3d14b26ac00badd7544bee90d943633028aac8720d2aea74d28b633acd0`,
and offline AOT recording produced 9,831,153 bytes without Java execution. A
fresh Node correctness smoke completed 251 frames and matched the saved hash.
Headless Firefox 148.0.2 also completed 251 frames, matched that hash and served
962 AOT hits with zero misses, refusals or errors. Its paced animation was
5.065 s. These two smoke processes overlapped, so neither is a timing comparison;
no screenshot or native-reference image was regenerated. The owned HTTP server
was stopped afterward.

The unpaired Node smoke appeared faster (1.234 s), but a further isolated,
five-round alternating comparison showed that the baseline and TeaVM had also
sped up. All 15 matched processes completed 251 frames and matched the reference:

| Round | `102fd83` baseline | `81e29d4` cleanup | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 1,336.000 ms | 1,340.000 ms | 609.249 ms |
| 2 | 1,342.000 ms | 1,226.000 ms | 601.018 ms |
| 3 | 1,340.000 ms | 1,369.000 ms | 598.579 ms |
| 4 | 1,391.000 ms | 1,182.000 ms | 605.872 ms |
| 5 | 1,165.000 ms | 1,307.000 ms | 600.733 ms |
| Median | **1,340.000 ms** | **1,307.000 ms** | **601.018 ms** |

The reduction between medians is **2.46%**, but three pairs regressed. Retain
this change for its demonstrated collection behavior, without claiming a
repeatable elapsed-time gain. The candidate remains about **2.175 times TeaVM**;
the required maximum is 1.10. The normal launcher policy and selected default
artifact remain unchanged.

#### Native primitive object fields: not selected

The next five-round comparison used identical `81e29d4` runtime bytes and the
same 32 KiB compiler policy. The baseline used dense JS fields; the candidate
used existing native primitive field slabs with dense allocation disabled.
Dense storage takes allocation priority, so enabling slabs alone would not
exercise them. Each variant replayed its own matching offline AOT pack (dense:
9,831,153 bytes; slabs: 9,763,366 bytes). No runtime source changed in this test.

| Round | Dense JS fields | Native primitive fields | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 1,321.000 ms | 1,238.000 ms | 611.412 ms |
| 2 | 1,337.000 ms | 1,236.000 ms | 602.443 ms |
| 3 | 1,332.000 ms | 1,397.000 ms | 600.983 ms |
| 4 | 1,367.000 ms | 1,359.000 ms | 618.498 ms |
| 5 | 1,510.000 ms | 1,189.000 ms | 602.902 ms |
| Median | **1,337.000 ms** | **1,238.000 ms** | **602.902 ms** |

All 15 fresh processes completed 251 frames and matched the saved reference.
The native-field median was **7.40% lower**, with four pairs improving and one
regressing. The varying pairwise reductions (0.59% to 21.26%) do not yet establish
a reliable storage improvement; the candidate was still **2.053 times TeaVM**.
It was not selected or browser-tested. The slab allocator also needs production
reclamation validation before considering a wider switch. The private config
was restored to dense fields, and the normal player remained unchanged.

#### Protected parameter-array versions: measured and rejected

A generic prototype lifted the existing parameter-array version's exclusions
for live exception ranges and field caches. It retained the 32 KiB code budget,
immutable parameter requirement, per-operation exception wrappers, precise spill
PCs, field invalidation, fuel and null/plain-array fallback. Native object-cache
and raw linker exclusions stayed in place. The hot gradient and solid span loops
received 911-byte and 623-byte versions respectively.

The isolated build passed with four existing warnings. These focused commands
passed 114 and 59 assertions (173 total), including static field updates, unused
and used nulls, mixed storage, exact partial effects and catch locals, low-fuel
continuations, and replacement during an active throwing call:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmParameterArrayAbi.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmHeapArrays.test.js
```

Five fresh alternating pairs with unchanged TeaVM after each pair produced:

| Round | `81e29d4` baseline | Protected parameter versions | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 1,406.000 ms | 1,238.000 ms | 606.875 ms |
| 2 | 1,315.000 ms | 1,321.000 ms | 606.457 ms |
| 3 | 1,318.000 ms | 1,311.000 ms | 605.573 ms |
| 4 | 1,316.000 ms | 1,229.000 ms | 608.468 ms |
| 5 | 1,231.000 ms | 1,345.000 ms | 615.518 ms |
| Median | **1,316.000 ms** | **1,311.000 ms** | **606.875 ms** |

All 15 processes completed 251 frames and matched the saved reference. The
**0.38%** median reduction, with two regressing pairs, did not establish a useful
elapsed-time improvement. The prototype and added tests were removed; it was
not browser-tested or selected. The candidate remained **2.160 times TeaVM**.
The normal policy and default player were unchanged.

#### Native i32 static-cell getters: measured and rejected

This prototype replaced eligible integer static reads with native Wasm getter
imports over mirrored mutable globals. It applied automatically to the normal
static-field store. JavaScript/interpreter/resolved writes still updated the
same cell; deletion and clear invalidated its mirror. Nonprimitive host values
used the original conversion at read time. Ordinary Maps, references and other
primitive types retained the existing accessors. The import signatures and
artifact format were unchanged. One cached tiny module created one getter per
claimed cell, without a rendering-thread compiler or new user flag.

These commands passed 87, 109, 96 and 57 assertions respectively (349 total):

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmStaticCells.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/canonicalDirectFrames.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmParameterArrayAbi.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmDirectStaticLinkContract.test.js
```

Coverage included exact stored Map values versus Wasm i32 conversion, boolean
values, JS cell writes, membership restoration, deferred host coercion/errors,
GC of replaced values and dead stores/getter instances, and existing canonical
exception/replacement continuations. `node test/coldPreparedWasmStatics.test.js`
with the same `NODE_PATH` passed 42 and failed four assertions, identically with
the prototype and unchanged `81e29d4`. The four existing failures expect a
reached-join guard exit/stack operand where the structured backend hoists the
readiness guard to entry. No new failure was attributed to this prototype.

The isolated build passed with four existing warnings; offline AOT recording
produced 9,831,710 bytes without running Java. The candidate runtime SHA-256 was
`38e2379db2fcfd5cf945460ce89228a869e9a8f10497102fd682474df4b8e294`.
The first timing pair was excluded because focused tests might have overlapped;
it was replaced with round 6 after validation processes exited. The five valid
fresh pairs used identical 32 KiB policy, CPU 2 and 1 GiB Node old space, no
animation warmup/replay, with unchanged TeaVM after each pair:

| Round | `81e29d4` baseline | Native static getters | TeaVM |
| --- | ---: | ---: | ---: |
| 2 | 1,402.000 ms | 1,385.000 ms | 600.520 ms |
| 3 | 1,399.000 ms | 1,390.000 ms | 601.472 ms |
| 4 | 1,327.000 ms | 1,464.000 ms | 605.794 ms |
| 5 | 1,256.000 ms | 1,413.000 ms | 610.315 ms |
| 6 | 1,324.000 ms | 1,434.000 ms | 601.453 ms |
| Median | **1,327.000 ms** | **1,413.000 ms** | **601.472 ms** |

All 15 valid processes completed 251 frames and matched the saved reference.
The candidate median was **6.48% higher**, with three pairs regressing. Removing
these JavaScript read crossings did not help this workload. The prototype and
added tests were removed; no globals/accessor machinery from it remains. It was
not browser-tested or selected. The normal policy and default player remain
unchanged; the 10% TeaVM target is unmet.

#### Shared exception regions: measured and rejected

A subsequent generic prototype grouped two to sixteen throwing operations in a
basic block under one native exception region. An invocation-local selector
recorded the active operation before it ran; the exceptional dispatcher used
that operation's original bytecode PC and reaching locals. Initialization guards
stayed outside the shared region, and host errors kept their original propagation.
No new user flag or method-name rule was added.

These focused commands passed 98, 96, 109 and 40 assertions (343 total):

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmReporterHandlers.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmParameterArrayAbi.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/canonicalDirectFrames.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmExplicitMonitors.test.js
```

The new fixture faulted separately at loads, stores and division, checking the
exact spill instruction, bytecode PC, partial local value and selected catch for
both recording imports and native JS tags. Existing tests covered low fuel,
replacement during a throw, exception ownership and monitor continuation.
The isolated build passed with four existing warnings. Runtime SHA-256:
`869aa05e5d6479b691161be5c21f94e6ec27277e95e972f9561c9c2fe35591cd`.

| Round | `81e29d4` baseline | Shared exception regions | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 1,220.000 ms | 1,240.000 ms | 604.577 ms |
| 2 | 1,214.000 ms | 1,215.000 ms | 619.741 ms |
| 3 | 1,328.000 ms | 1,328.000 ms | 606.107 ms |
| 4 | 1,322.000 ms | 1,347.000 ms | 603.158 ms |
| 5 | 1,323.000 ms | 1,325.000 ms | 656.639 ms |
| Median | **1,322.000 ms** | **1,325.000 ms** | **606.107 ms** |

All 15 fresh processes completed 251 frames and matched the saved reference.
Four pairs were slower and one equal; the candidate median was **0.23% higher**.
The prototype and added tests were removed, with no browser run or default change.
The candidate remained **2.186 times TeaVM**. Fewer exception regions alone did
not improve this workload.

#### Retained intro-host conversion: two matched batches

The intro host now writes packed 32-bit RGBA output on little-endian hosts with
an aligned byte destination, instead of four clamped-byte stores per pixel.
Other destinations keep the existing scalar conversion. RGB channel order and
opaque alpha are preserved, including nonzero destination offsets. No new flag,
generated output or JVM policy change is involved. The ordinary AWT presenter
already used packed conversion; this fixes a difference in the intro helper.
TeaVM also already writes packed 32-bit output.

`node --test tests/intro-pixels.test.mjs` passes both tests, covering known colors,
1,024 deterministic packed values, aligned/unaligned views, sentinel boundaries,
plain output arrays, empty buffers and wrong-size rejection.

Two five-pair batches compared the two host helper versions with **identical**
`81e29d4` runtime and AOT bytes, the same 32 KiB policy, CPU 2 and 1 GiB Node old
space. Every process was fresh, ran ticks 0–250 once, and matched the saved
reference. There was no animation warmup/replay, native-reference regeneration
or concurrent test/build/browser process. The existing policy still has
`schedulerTimingRate: 256`; these are execution comparisons under that policy,
not uninstrumented release acceptance. Import profilers were off. Final
acceptance must disable scheduler sampling and revalidate matching artifacts.

| Batch / round | Byte stores | Packed stores | Unchanged TeaVM |
| --- | ---: | ---: | ---: |
| 1 / 1 | 1,329.000 ms | 1,229.000 ms | 615.011 ms |
| 1 / 2 | 1,343.000 ms | 1,728.000 ms | 600.310 ms |
| 1 / 3 | 1,325.000 ms | 1,208.000 ms | 603.009 ms |
| 1 / 4 | 1,214.000 ms | 1,144.000 ms | 613.989 ms |
| 1 / 5 | 1,314.000 ms | 1,225.000 ms | 600.807 ms |
| **Batch 1 median** | **1,325.000 ms** | **1,225.000 ms** | **603.009 ms** |
| 2 / 1 | 1,323.000 ms | 1,230.000 ms | 1,560.881 ms |
| 2 / 2 | 1,525.000 ms | 1,109.000 ms | 602.655 ms |
| 2 / 3 | 2,418.000 ms | 1,223.000 ms | 605.924 ms |
| 2 / 4 | 1,315.000 ms | 1,237.000 ms | 604.010 ms |
| 2 / 5 | 1,325.000 ms | 1,240.000 ms | 601.312 ms |
| **Batch 2 median** | **1,325.000 ms** | **1,230.000 ms** | **604.010 ms** |

Packed conversion won **9 of 10 pairs**. The median reductions were **7.55%**
and **7.17%**, respectively. The substantial outliers in candidate, baseline
and TeaVM remain in the table; their cause was not established. This supports
a modest host-conversion improvement, not a guaranteed latency/fps floor.
The latest candidate/TeaVM ratio is **2.036**, well above the required **1.10**.

Both runtime hashes were
`edbce3d14b26ac00badd7544bee90d943633028aac8720d2aea74d28b633acd0`,
with the same 9,831,153-byte AOT pack. Host helper SHA-256 before/after:
`b8daaf3b40d5f6102f1749cadb1e69cd723cdd8e3ed80f44b76f411718660e58` /
`e18afa2a2b696d619af8c18a87da18d56c24e21fdc774f14e3e9444ff0abe3b1`.
The one current comparison report retains bounded batch history and the host
hashes; no extra JSON report was created.

A separate headless Firefox 148.0.2 correctness smoke completed all 251 frames,
matched the saved RGB hash and replayed 962 AOT hits with zero misses, refusals
or errors. Its paced animation was 5.066 s. It was not a timing comparison or
presented-frame acceptance run. No screenshot was saved. The owned local HTTP
server and browser were stopped; the preexisting server was left alone.
The selected default JVM/runtime artifact was not replaced or published.

The rejected runtime prototypes above were removed; java-tools retained only
its previously committed table-retention fix from those experiments.

#### Automatic integer-array SIMD: inline prototype

The next generic prototype proves an independent `int[]` countdown loop with
one contiguous store and loads from the same array/index. The loop must have a
linear normal body, unit index increment and a decrement-before-test counter.
Supported scalar recurrences use wrapping integer addition/subtraction and
uniform steps; shifts require a uniform shift count. Neighbor loads, reductions,
other effects, unknown recurrences and unsupported shapes retain scalar code.
Bounds are 16 blocks, 128 body nodes, 32 header phis and eight plans per method.
Spliced callee loops are excluded because their original fuel protocol differs.
There is no application/method-name rule or user flag; engines without SIMD
retain the scalar path.

A four-lane path requires a heap-backed parameter, four remaining iterations,
a complete in-bounds range and more than four units of fuel. It consumes exactly
four scalar header polls, uses wrapping SIMD arithmetic, and updates the full
parallel header state, including reference aliases and inlined/dead-looking
temporaries. Guard failure uses the original scalar loop, preserving partial
writes, exception PCs and low-fuel continuations. Short invocations test the
count before the more expensive representation/range guards.

The inline prototype passed these focused commands: 168 vector assertions,
96 array ABI assertions and 109 canonical-call assertions, with an earlier
59-assertion heap-array check also passing:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/vectorArrayLoops.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmParameterArrayAbi.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/canonicalDirectFrames.test.js
```

The vector tests compare scalar and SIMD output, every spilled local and exact
fault PCs across fuel boundaries, null/plain arrays, bounds failures, counter
underflow and integer overflow. A test-only scalar-poll hook proves that three
vector batches execute twelve iterations. Inlined/reference temporaries agree
with the scalar continuation; GC releases installed SSA/proof graphs. Both hot
intro span methods qualify. Eligibility alone does not prove a timing gain.

The isolated build passed with four existing warnings. Both hosts now use the
retained packed conversion, and **scheduler sampling is disabled in both JVM
variants** (`schedulerTimingRate: 0`). The unchanged `81e29d4` baseline received
its own newly recorded AOT pack for that policy (9,832,376 bytes); the inline
SIMD pack was 9,833,282 bytes. Neither recording executed Java. Runtime SHA-256:
`60269ebdc2057506a53b6f628a13c57e5e2dc98f4897eb5eb1aab39a15b2e096`.
Inline vector source SHA-256:
`fc8663594ca8c6748a4ef24ac53e916ad29fd201e2bb42646a242f880dc95419`.

| Round | Scalar baseline | Inline SIMD | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 1,216.000 ms | 1,447.000 ms | 601.868 ms |
| 2 | 1,828.000 ms | 1,244.000 ms | 855.206 ms |
| 3 | 1,209.000 ms | 1,228.000 ms | 608.823 ms |
| 4 | 1,209.000 ms | 1,133.000 ms | 600.631 ms |
| 5 | 1,213.000 ms | 1,217.000 ms | 597.043 ms |
| Median | **1,213.000 ms** | **1,228.000 ms** | **601.868 ms** |

All 15 fresh processes completed 251 frames and matched the saved reference;
CPU 2, 1 GiB Node old space, no warmup/replay or concurrent profiling/tests/builds.
The candidate median was **1.24% higher**, with three regressing pairs. The
outliers remain included. It was not selected or browser-tested; its ratio to
TeaVM was **2.040**, so the 10% target remains unmet.

#### Outlined SIMD kernels: measured and rejected

The next variant put SIMD into a separate native Wasm kernel. The ordinary method
kept its scalar frame for empty/short calls. A successful range/fuel guard entered
the kernel, which processed complete groups and returned the full integer header
state and remaining fuel; reference aliases stayed in the parent. The kernel
imported only shared memory. No JavaScript callback, class-init shortcut, new
user flag or retained compiler graph was added. Metadata counted its extra code
bytes separately.

The vector suite passed **176 assertions**, including collection of three retired
kernel imports after replacement while current code remained callable. The same
96-assertion array ABI and 109-assertion canonical suites passed: **381 total**.
The first lifetime check itself held its last local across an async suspension;
retiring instances in a synchronous helper removed that test root and verified
all three weak imports collected. This was not a production retention fix.
The isolated build passed with four existing warnings; offline AOT recording
produced 9,833,481 bytes without executing Java. Runtime SHA-256:
`eca8b0da9380fd55b3d6fc71a4270391801040e7bf4fac3d5f8e7f07acb439a0`.
Outlined vector source SHA-256:
`3b609cead6a33261ade38ff8d4b0da301979e9aa2a64a2488371146dc150f6fa`.

The same sampling-disabled policy and packed host as the inline comparison produced:

| Round | Scalar baseline | Outlined SIMD | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 1,231.000 ms | 1,249.000 ms | 602.432 ms |
| 2 | 1,253.000 ms | 1,082.000 ms | 603.598 ms |
| 3 | 1,237.000 ms | 1,278.000 ms | 602.030 ms |
| 4 | 1,132.000 ms | 1,212.000 ms | 602.665 ms |
| 5 | 1,106.000 ms | 1,241.000 ms | 603.643 ms |
| Median | **1,231.000 ms** | **1,241.000 ms** | **602.665 ms** |

All 15 fresh processes completed 251 frames and matched the saved reference;
no warmup/replay or concurrent tests/builds/profiling. Four pairs regressed; the
median was **0.81% higher**, and candidate/TeaVM was **2.059**. The isolated faster
pair does not establish a gain. This variant was not selected or browser-tested.

A subsequent separate counter process completed 251 frames and matched the
reference. It recorded **426,359** gradient-kernel entries against 3,473,053
canonical gradient-span entries, and **458,251** solid-kernel entries against
1,168,526 canonical solid-span entries. Both reported zero imported integer loads.
Those counts include setup/current modules; they are not animation timings or
CPU attribution. They confirm that the new kernels ran, so simple lack of
eligibility does not explain the failed elapsed-time result.

Both SIMD prototypes, integration and added tests were removed. The private
candidate runtime/AOT was restored to the `81e29d4` baseline for the new sampling-
disabled policy. The selected default player/runtime was unchanged. Only the
previously retained host conversion remains from this phase. The one comparison
JSON retains bounded history and these diagnostics; no new report or screenshot
was created. Original memory/startup/presented-FPS/phone gates remain open.

Each canonical wrapper still calls a separate native readiness getter on entry.
The next controlled experiment should replace that call with an inline readiness
read, while preserving resets, cold refusal, custom-token fallbacks and artifact
ownership. This is a concrete call path to test, not a claim that its cost alone
explains the remaining gap. It must beat the same sampling-disabled baseline in
fresh matched runs before selection.

A small earlier Node 22 Wasm-GC proof compiled `any.convert_extern` plus an
`eqref` cast: it trapped on JS arrays, whether same or different, and succeeded
only for null. Simply replacing `ref_eq` with a GC opcode therefore does not
work with this representation. No additional application flag, signature/name
heuristic, larger heap or moved allocation should substitute for a proven
execution path and an elapsed-time win. The 10% TeaVM target remains unmet.


#### Live class-readiness words: retained (2026-10-18)

Generic runtime commit `84ea76a` replaces canonical-owner and structured
static-dependency readiness function imports with aligned reads from the existing
Wasm heap. One eight-byte allocation per token/memory remains reserved for that
memory's lifetime, since compiled imports can outlive the token or heap wrapper.
Tokens weakly track the memory, write through its current buffer after growth,
and publish every reset, erroneous state, deletion and refresh. Custom guards,
missing heap support and allocation refusal retain the callable path. Cold
checks still return through the original interpreter continuation; they never
initialize an untaken dependency early. Compiler guard maps are released when
diagnostics are disabled. No game names, new user flag or execution ABI change
was added.

An owner-wrapper-only preliminary comparison gave medians 1,224.000 -> 1,194.000
ms (2.45% lower), TeaVM 610.123 ms. Four pairs improved; one regressed 0.74%.
All five rounds (baseline / candidate / TeaVM, ms) were:
1,975.000 / 1,219.000 / 600.441;
1,213.000 / 1,222.000 / 600.577;
1,224.000 / 1,194.000 / 635.042;
1,351.000 / 1,189.000 / 613.242;
1,128.000 / 1,043.000 / 610.123. The slow first baseline remains included.
That prototype was extended before selection.

A separate baseline-only CPU diagnostic then sampled after the first render,
through the final conversion: 988 samples over 1,539,065 microseconds. A native
readiness getter accounted for 147 self samples; its Wasm script URL was verified
against a fresh token getter. Many callers were dependency checks inside compiled
bodies, which the wrapper-only prototype had left in place. RGB conversion had
140 self samples. The largest sampling gap was 442,555 microseconds, so sample
counts cannot be treated as precise elapsed CPU attribution. This run executed
251 frames once and matched the saved reference; it is excluded from timings.
Only a bounded summary is retained in the single comparison JSON, without raw
profiles or new screenshots.

The extended implementation also covers structured entry/block checks, lazy
parameter-array forwarding and bulk-clear dependency guards. Five fresh matched
comparisons against unchanged `81e29d4`, alternating JVM order and running the
unchanged TeaVM after each pair, produced:

| Round | Baseline | Live readiness words | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 1,216.000 ms | 923.000 ms | 600.722 ms |
| 2 | 1,205.000 ms | 931.000 ms | 597.479 ms |
| 3 | 1,118.000 ms | 916.000 ms | 605.172 ms |
| 4 | 1,279.000 ms | 936.000 ms | 599.667 ms |
| 5 | 1,408.000 ms | 946.000 ms | 610.232 ms |
| Median | **1,216.000 ms** | **931.000 ms** | **600.722 ms** |

All five pairs improved, with nonoverlapping JVM ranges: **23.44% lower median**.
Candidate/TeaVM is **1.550**, so the 10% target is still unmet. Every process
completed the same 251-frame animation once, including 640x480 RGB-to-RGBA output,
and matched the saved tick-80 reference. CPU 2, Node 22.23.2, 1 GiB old space,
identical packed host and 32 KiB parameter specialization policy, scheduler
sampling disabled in both JVMs; no warmup, replay, concurrent builds/tests or
profiling. Timings measure animation execution, not startup or presented FPS.

Focused validation passed **486 assertions**:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/classInitializationToken.test.js # 95
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/intZeroClearEntry.test.js # 90
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/canonicalDirectFrames.test.js # 109
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmParameterArrayAbi.test.js # 96
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmHeapGrowth.test.js # 35
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmHeapBulkCopy.test.js # 21
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmArrayCopyFieldCache.test.js # 40
```

New cases check state transitions, custom guard refusal, exhausted heaps, growth,
weak collection of heaps and memories, updates when memory outlives its heap
wrapper, ordinary/expanded canonical ABIs, exact results and bulk boundaries,
untaken cold dependencies, reset-before-access and no fabricated invocation
frames. Existing suites cover array ownership, fuel, safe replacement and copying.
The isolated webpack browser-debug/worker build passed with four existing
warnings. An archive-based audit checked 680 source files with zero mismatches,
excluding the generated JRE index; unrelated decompiler WIP was not included.
Offline AOT recording executed no Java. Runtime SHA-256:
`6c631007933dbaf422179113653fd2424d2b762b3d54e41fe759107b72fde04a`.

Firefox 148.0.2 completed 251 paced frames and matched actual canvas
`getImageData` against the saved tick-80 reference
`349844b46ebe62959fb6cf3fc354377423f061d2cbc812bb614800ac0db013e6`.
There were 962 AOT hits, zero misses/refusals/errors and no page errors. This was
a correctness smoke, not an FPS claim. The owned temporary server was stopped;
the existing user's server was left running. Source is retained, but the selected
player/runtime and published artifacts remain unchanged. Original memory,
startup, rolling presented-FPS, phone and stability gates remain open.

Next, test a shared native RGB conversion path: the current host still performs
that large loop in JavaScript. Any converter must preserve the guest raster,
handle fallback representations automatically, and demonstrate another fresh
matched elapsed-time win before retention. Removing callback counts alone is
not evidence of meeting the remaining 10% target.


#### Shared native raster conversion: retained (2026-10-18)

Generic runtime commit `c9025f7` extracts AWT's native RGB swizzle into a shared
raster utility and converts four pixels at a time with SIMD. Engines without
SIMD use its scalar Wasm module; unavailable Wasm, failed staging allocation,
plain/small arrays and unaligned destinations keep automatic JavaScript
fallbacks. The source raster is never modified. One native staging memory and
its current view are reused across frames and refreshed after growth. At
640x480 this adds about 1.2 MiB of native staging storage, in place of the
presenter's existing scalar staging allocation. No frame-sized JavaScript array,
game-specific runtime rule, rendering-thread guest compiler or user flag is added.

The browser runtime exports the same generic converter used by AWT. Both the
intro browser host and Node host select it when available; older selected
runtimes keep the existing packed converter. TeaVM and all Java source/classes
remain unchanged. This measures a presentation-path gain, not a faster guest
interpreter claim.

The first five matched pairs gave medians 934.000 -> 842.000 ms (9.85% lower),
but one pair regressed. Five additional unchanged pairs were run to resolve
that concern, without another build or AOT recording. All ten are included:

| Round | Readiness-word baseline | Native raster | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 1103.000 ms | 824.000 ms | 607.190 ms |
| 2 | 939.000 ms | 838.000 ms | 605.458 ms |
| 3 | 921.000 ms | 842.000 ms | 607.191 ms |
| 4 | 934.000 ms | 893.000 ms | 604.623 ms |
| 5 | 924.000 ms | 999.000 ms | 601.647 ms |
| 6 | 940.000 ms | 843.000 ms | 620.695 ms |
| 7 | 922.000 ms | 850.000 ms | 599.818 ms |
| 8 | 927.000 ms | 826.000 ms | 604.694 ms |
| 9 | 912.000 ms | 827.000 ms | 606.253 ms |
| 10 | 919.000 ms | 902.000 ms | 601.235 ms |

Across ten pairs the medians are **925.500 -> 842.500 ms**, **8.97% lower**;
nine pairs improve and one regresses. TeaVM's median is **605.076 ms**;
candidate/TeaVM is **1.392**, so the 10% target remains unmet. The last candidate
of the first batch (999.000 ms) remains included. Both JVM variants use the same
updated host, identical policy and fresh processes on CPU 2 with 1 GiB old space.
Each animation plays ticks 0..250 once, includes RGB conversion, and matches the
saved reference. No warmup/replay or concurrent tests/builds/profiling ran during
these 30 processes. Startup is outside this execution comparison.

Focused checks:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/raster.test.js # 104 assertions passed
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/awtRasterPrefix.test.js # 18 assertions passed
node --test tests/intro-pixels.test.mjs # 2 integration tests passed, from dekobloko-work
```

New tests exercise actual SIMD and scalar native modules, absent Wasm and
allocation failure, every vector tail length, buffer growth/reuse, full colour
and alpha conversion, unchanged guest input, source/destination offsets,
unaligned and plain-array fallbacks, bad lengths, element wrappers and visible
prefixes with unchanged padding. The isolated browser-debug/worker webpack build
passed with four existing warnings. An archive-based source audit checked 681
files with zero mismatches or unexpected sources, excluding the generated JRE
index. Protected decompiler WIP was not bundled. Matching offline AOT recording
ran no Java: 9,833,417 bytes, SHA-256
`fb0b5cdafd0c88b5805b44bc906f33418dfe72a46f82e5a93763245775f2f626`.
Candidate runtime SHA-256:
`93029f7d36a48b4ce604ce53b2837c80950591a06081111538652787ad2e1f97`.

Firefox 148.0.2 passed one paced 251-frame canvas-reference check using the new
runtime's exported converter: 962 AOT hits and zero misses/refusals/errors,
with no page errors. The reference was reused, not regenerated. This is a
correctness check; presented-FPS targets and Android remain unverified. Only
the owned temporary server was stopped. Selected/default artifacts and the
existing user's server remain unchanged.

A separate post-first-render candidate sample (excluded from the timings)
contains 728 samples over 1,159,961 microseconds; its largest sampling gap was
337,600 microseconds. The readiness getter is absent from the reported top
contexts. Native staging/conversion now has 34 self samples in its JavaScript
wrapper and 9 in its native function, versus the earlier JavaScript loop's 140
baseline samples. Those runs have different totals and sampling gaps; do not
interpret the counts as an exact speedup. The remaining largest reported guest
contexts include sorted triangles, face processing, alpha rectangles and
half-size sprite blits. Static-cell access remains visible, but is no longer
the single obvious dominant cost. Minified JS columns are retained to identify
specific accessors instead of conflating anonymous functions. Only one current
bounded diagnostic summary remains in the existing comparison JSON.

The next compiler experiment should target repeated per-element range and
representation checks inside those compiled loops. A guarded fast version can
omit a check only after proving the entire touched range safe, without changing
partial writes, null/exception order, aliasing, low-fuel continuations or cold
initialization. This requires a bounded generic proof and measured elapsed-time
improvement; neither another broad backend flag nor assuming TeaVM parity from
fewer imports is sufficient. The original memory/startup/presented-FPS/phone and
stability gates remain open.


#### Within-block bounds reuse: measured and rejected

A small automatic compiler prototype reused a successful heap bounds check for
an identical SSA array/index pair later in the same block. Pure arithmetic
preserved facts; calls and other effects cleared them. Each block started fresh,
so loop iterations and branch joins inherited no checks. The original imported
path for null/plain arrays remained intact. Only numeric elision counts survived
compiler cleanup; no user flag was introduced.

Focused commands passed **318 assertions** (54 new, 109 canonical, 96 array ABI,
59 heap arrays):

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/reusedArrayBounds.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/canonicalDirectFrames.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmParameterArrayAbi.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmHeapArrays.test.js
```

The new fixture checks invalid/negative indices before writes, different indices,
branch joins, zero-trip nulls, iteration changes, exact partial writes, native
boundaries, exception handlers and owned low-fuel continuations. The isolated
webpack build passed with four existing warnings and a 681-file source audit
with zero mismatches/unexpected sources. Matching offline AOT recording executed
no Java. Prototype runtime SHA-256:
`20ad44f7b988a4029f3e0fec72bf16763890b496464359a0e2578ccb9240f3a8`.
The initial driver description incorrectly still called this a raster experiment;
its recorded baseline runtime SHA was the correct `c9025f7` artifact. The label
has been corrected in the single current JSON.

| Round | Native-raster baseline | Within-block bounds reuse | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 835.000 ms | 821.000 ms | 598.300 ms |
| 2 | 817.000 ms | 863.000 ms | 599.566 ms |
| 3 | 824.000 ms | 823.000 ms | 603.471 ms |
| 4 | 823.000 ms | 982.000 ms | 608.646 ms |
| 5 | 830.000 ms | 1007.000 ms | 601.332 ms |

All 15 fresh processes completed 251 frames and matched the reference under the
same CPU-2/1-GiB/no-warmup protocol, without concurrent validation/profiling.
Median **824.000 -> 863.000 ms** is **4.73% worse**, with three regressing pairs.
No elisions were reported in the busiest 32 methods. Inline helper returns split
read-modify-write sequences across blocks; repeated static-field readers also
use distinct SSA array values. The fixture's useful shape therefore did not
translate into useful coverage here. Tiny winning pairs are not a speed claim.

The prototype and its new tests were removed. It was not browser-tested or
selected. The private runtime and AOT were restored to `c9025f7`, while selected
and published artifacts remain unchanged. The retained comparison is still the
native raster's ten-pair result (842.500 ms versus TeaVM 605.076 ms, ratio 1.392).
A successor needs bounded must-facts across pure inline-helper edges, intersected
at joins and invalidated by phi/node reassignment, loop re-entry and calls.
That broader proof must first demonstrate actual hot-method coverage, then an
elapsed-time win. The 10% target and original release gates remain open.


#### Cross-block bounds must-facts: measured and rejected

The successor propagated successful primitive-array checks through pure SSA
blocks, intersected facts at joins, and killed facts when their array/index
phi or producer was reassigned. Entry/handler roots started empty. Calls,
field operations, strings and class literals discarded facts; numeric constants
were retained because they lower to immediate Wasm values. An initial diagnostic
found that treating numeric `ldc` masks as runtime operations lost both span
proofs; separating numeric constants corrected that refusal without weakening
string/class behavior. Limits were 512 blocks, 8,192 nodes/phis, 1,024 pairs and
200,000 work units. Budget exhaustion discarded the entire partial proof.
No new flag or game-specific compiler rule was added.

Focused commands passed **338 assertions** (20 proof, 54 integration, 109
canonical, 96 array ABI, 59 heap array):

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/arrayBoundsFacts.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/reusedArrayBounds.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/canonicalDirectFrames.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmParameterArrayAbi.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmHeapArrays.test.js
```

Coverage includes pure helper edges, different/untaken branch paths, invalid
indices, partial writes, loop and producer re-entry, exception-handler roots,
actual work-budget exhaustion, numeric/string constants, native boundaries,
exact exception locals, low-fuel continuation and frame release. The isolated
webpack build passed with four existing warnings. Source audit: 682 files,
zero mismatches/unexpected sources; unrelated decompiler WIP excluded. Matching
offline AOT recording executed no Java. Prototype runtime SHA-256:
`21d20968bf605c02d5b59bcdf485af02ca9b0c0ea53c65bcafbe141eb61dad56`.

A separate fresh-process diagnostic completed 251 frames and matched the saved
reference. There were 38 methods with eliminated checks; seven had executed.
Each span lost one check: gradient span reported 3,473,053 canonical entries and
solid span 1,168,526. Face processing lost three checks, column blur fifteen,
and three sprite paths one each. Counts include setup/current instances and
are coverage evidence, not CPU attribution or acceptance timings.

| Round | Native-raster baseline | Cross-block bounds proof | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 826.000 ms | 820.000 ms | 605.835 ms |
| 2 | 1002.000 ms | 892.000 ms | 600.795 ms |
| 3 | 815.000 ms | 814.000 ms | 601.504 ms |
| 4 | 820.000 ms | 839.000 ms | 601.304 ms |
| 5 | 853.000 ms | 824.000 ms | 612.587 ms |

All 15 fresh timing processes completed 251 frames and matched the saved
reference, with the same CPU-2/1-GiB/32-KiB/native-raster/sampling-off policy,
alternating JVM order and unchanged TeaVM after each pair. No warmup/replay,
profiling, tests or builds overlapped timings. Median **826.000 -> 824.000 ms**
is only **0.24% lower**; four pairs improved, one regressed. Despite proven hot
coverage, this does not establish a useful elapsed-time gain. Candidate/TeaVM
was **1.370**. No browser smoke was run after this rejection.

The analysis, integration and new tests were removed, and the private runtime/
AOT was restored to `c9025f7`. Source diagnostics remain bounded in the one
comparison JSON. The selected/default player and published artifacts were not
changed. The next controlled experiment should replace integer static getter
calls with inline heap reads, preserving custom accessors/coercion and cell
lifetime; the earlier native-getter experiment retained cross-instance calls.
The 10% target and original release gates remain unmet.


#### Inline integer static words: both write variants rejected

This generic prototype replaced structured Wasm integer-static getter calls
with a validity-word guard and inline heap load. A cold declaration, ordinary
number, boolean, null or undefined kept its original stored Map value and a
native i32 mirror. Host objects, BigInts, symbols, strings and custom accessors
used the original getter at read time, preserving deferred coercion, errors and
side effects. Writes stayed on the existing setter path. Integer cells observed
assignment, definition and deletion through a Proxy installed before any JS
binding could capture the cell. Reference/wide/legacy-key cells stayed ordinary.

One eight-byte slot per cell/memory remained reserved for imported code's
lifetime. Memory references and address keys were weak; growth used the live
buffer, and native writes could still reach imported memory after its heap
wrapper died. Compiler metadata retained only numeric addresses/counts, with
compile-time maps cleared when diagnostics were disabled. No game-specific
logic, new user flag, moved worker allocation or changed guest execution ABI
was introduced. Ordinary Maps and exhausted/unsupported heaps kept callable
access. Integer dimension reads in the existing bulk-clear entry used the same
helper.

Review found that repeated binding must use the same first cell as the
already-deduplicated getter import, even when a host changes its cell resolver.
The address cache now remembered both the first successful binding and refusal.
Dedicated tests exercised alternating cells and a plain first cell. This was
fixed before these measured variants.

The initial version inspected the current descriptor and created a typed view
on each mirrored write. Its focused suites passed **596 assertions**. The
isolated build passed with four existing warnings; a 682-file source audit had
zero mismatches/unexpected sources. Separate coverage completed 251 frames,
matched the saved reference and showed 24 executed inline-reader methods,
including both spans, triangles, face processing, projection and compaction.
The returned eligible-method list was capped at 64, not a total catalog count.
Runtime SHA-256:
`37f47726539ff559128643b098205962245cd0931d8a313f4480fce292828187`.

| Round | Native-raster baseline | Descriptor/view per write | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 820.000 ms | 1241.000 ms | 606.342 ms |
| 2 | 824.000 ms | 1421.000 ms | 602.305 ms |
| 3 | 834.000 ms | 1262.000 ms | 604.325 ms |
| 4 | 859.000 ms | 1358.000 ms | 606.733 ms |
| 5 | 880.000 ms | 1440.000 ms | 601.663 ms |

All five pairs regressed: median **834.000 -> 1,358.000 ms**, **62.83% worse**.
The native read saved crossings, but its overall write representation was
unacceptable. It was extended before selection, not published or browser-tested.

The second version cached whether the target still had a writable own data
property. Ordinary writes could update that private target directly; descriptor
changes/deletion refreshed the proof, and alternate receivers/custom setters
kept normal Reflect behavior. It weakly cached each typed view, refreshed a
collected/detached view, and skipped unchanged native values. New mirror
registration forced initialization even when the value had not changed.
This removed repeated descriptor/view allocation without retaining dead buffers.

Focused commands passed **603 assertions** across the candidate work:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/staticI32HeapCells.test.js # 116, rerun after final write changes
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmStaticCells.test.js # 26
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/intZeroClearEntry.test.js # 90
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/classInitializationToken.test.js # 95
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/canonicalDirectFrames.test.js # 109
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmParameterArrayAbi.test.js # 96
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/workerBooleanSnapshot.test.js # 14
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/wasmDirectStaticLinkContract.test.js # 57
```

New coverage includes raw Map values versus native conversion, all write paths,
custom getter/setter and thrown identity, invalid coercion at read time,
readiness/reset refusal, deletion/clear and key membership, distinct receivers,
readonly/sealed/frozen cells, descriptor semantics, new-memory initialization,
weak heaps/memories/stores/cells, replaced-value collection and old imported
memory updates. The second build and 682-file source audit passed with the same
four existing warnings. Matching offline AOT recording ran no Java. The fresh
coverage run again completed 251 frames and matched the reference. Runtime SHA:
`a3fc8b3d072936d9b54f414b35d9bb6a3caa65cef477a63c655a7939396a09dc`.

| Round | Native-raster baseline | Fast observed writes | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 819.000 ms | 912.000 ms | 601.702 ms |
| 2 | 1001.000 ms | 875.000 ms | 604.945 ms |
| 3 | 822.000 ms | 897.000 ms | 604.487 ms |
| 4 | 830.000 ms | 881.000 ms | 611.845 ms |
| 5 | 1435.000 ms | 896.000 ms | 605.926 ms |

Median **830.000 -> 896.000 ms** is **7.95% worse**, with three regressing
pairs. The large baseline outliers (1,001 and 1,435 ms) remain included; isolated
winning pairs do not establish a gain. Candidate/TeaVM is **1.481**.
Both five-pair batches used fresh CPU-2/1-GiB processes, identical native-raster
host and policy, 32 KiB parameter versions and scheduler sampling off. Every
process completed ticks 0..250 once and matched the saved reference. No warmup,
replay or concurrent tests/builds/profiling occurred during timing.

Both variants and their new tests were removed. No browser smoke or artifact
selection followed failed timing. The private runtime/AOT was restored to
`c9025f7`; the selected/default player and published artifacts remain unchanged.
The one current JSON keeps bounded results/history and current diagnostic
coverage, without additional report files. The retained result is still the
native raster's ten-pair 842.500 ms versus TeaVM 605.076 ms (ratio 1.392).
The 10% target and original release gates remain unmet.

#### Next: native call result protocol

The current native canonical call returns status, invocation id, owner reference
and optional primitive value. Even a successful void call returns the owner
reference, although consumers need it only on an exit. A controlled successor
should keep the public canonical ABI, and test a compact native entry returning
status/id/value with exact owner transfer on exceptional/deoptimization paths.
This targets call-result machinery rather than another property mirror. No gain
is presumed from fewer results: verify recursion, cold refusal, exceptions,
low fuel, replacement while a callee is active, retired-owner collection and
fallback entries before fresh matched timing. The exit protocol must identify
the exact old module, not whichever replacement occupies a table slot later.

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
