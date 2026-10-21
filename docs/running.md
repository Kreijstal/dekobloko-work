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

#### Compact native returns: first wrapper-only experiment (2026-10-18)

The public canonical entry returns status, invocation id, owner and optional
primitive value. A prototype retained that ABI while adding native entries
returning only status/value. Exact ownership moves through a weak, synchronously
consumed exit channel only on exceptional/deoptimization paths. Cold refusal
and supported bridge stubs retain the existing behavior; normal native calls
publish no exit record. Foreign exit managers cannot publish into these slots.

Five alternating fresh-process comparisons against `c9025f7` produced:

| Round | Native-raster baseline | Compact wrapper | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 876.000 ms | 835.000 ms | 611.614 ms |
| 2 | 827.000 ms | 831.000 ms | 606.714 ms |
| 3 | 858.000 ms | 815.000 ms | 599.401 ms |
| 4 | 848.000 ms | 816.000 ms | 600.459 ms |
| 5 | 819.000 ms | 867.000 ms | 607.106 ms |

Median **848.000 -> 831.000 ms** is 2.00% lower, but two pairs regress.
This is inconclusive and was not selected or committed as an improvement.
All 15 processes completed ticks 0..250 once and matched the saved RGB
reference; no warmup/replay or concurrent builds/tests/profiling occurred.
The separate coverage run confirmed the compact native calls actually execute.

The successor extends the prototype with bounded duplication of small method
bodies into their compact entries, removing the wrapper-to-main call and
active-id global handoff. One 16 KiB duplication budget covers both native
entries, prioritizing forwarded array metadata. Larger bodies retain wrappers.
Identity emission tokens mark returns and id capture; scanning raw opcode
bytes would corrupt immediates that happen to equal a return opcode.
The original public entries, exception payload capture, fuel checks and
supported older-engine paths remain covered.

Focused validation for the combined prototype (602 passing assertions):

```sh
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/compactCanonicalFrames.test.js # 121
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/canonicalDirectFrames.test.js # 109
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmParameterArrayAbi.test.js # 96
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/primitiveArrayCopyEntry.test.js # 91
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/intZeroClearEntry.test.js # 90
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/classInitializationToken.test.js # 95
```

The new cases cover all scalar/void returns, local-index preservation, opcode-
valued immediates, the shared duplication budget and executable large-method
fallback, alongside recursion, low fuel, partial exception effects, active
replacement, exact retired ownership, weak collection and old-engine entries.
The isolated browser-debug/worker webpack build passed with four existing
warnings; the 681-source audit passed, exempting only generated JRE indexing.
An AOT identity check rejected a pack recorded before the final bundle was
ready. It was regenerated; runtime/AOT identity was checked before any timing.
A fresh diagnostic then completed 251 frames and matched the saved reference.
Both compact entries are inlined in the hottest copy/gradient/solid leaf methods
(4,123,713 / 3,473,053 / 1,168,526 native entries respectively).

The combined inline-entry prototype completed these five matched pairs:

| Round | Native-raster baseline | Inline compact entries | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 821.000 ms | 799.000 ms | 602.980 ms |
| 2 | 842.000 ms | 789.000 ms | 602.835 ms |
| 3 | 832.000 ms | 955.000 ms | 601.478 ms |
| 4 | 838.000 ms | 814.000 ms | 599.428 ms |
| 5 | 1081.000 ms | 789.000 ms | 599.885 ms |

Median **838.000 -> 799.000 ms** is **4.65% lower**, with four pairs faster.
Both large baseline/candidate observations remain included. Candidate/TeaVM is
**1.328**, still above 1.10. Every process completed 251 frames and matched the
saved reference under the same fresh-process CPU-2/1-GiB constraints.
Runtime SHA-256: `e28b80b9dc152ad6e91bd7afec24826003069f27acba49984a94057e3ec0c8f1`.

#### Deferred ownership ids: measured and removed

A successor deferred ownership-id allocation in compact inline entries until
an exit needed a frame. It reserved a local sentinel and allocated before the
first spill, leaving public entries unchanged. All 606 focused assertions
passed, including exact exception/fuel ownership, normal returns without ids,
and wraparound of both reserved ids. The isolated build and 681-source audit
passed; matching offline AOT and the fresh 251-frame reference check passed.
Diagnostics explicitly stopped treating the id counter as an exact call count.

| Round | Native-raster baseline | Deferred compact ids | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 843.000 ms | 816.000 ms | 622.485 ms |
| 2 | 851.000 ms | 791.000 ms | 602.879 ms |
| 3 | 832.000 ms | 859.000 ms | 622.162 ms |
| 4 | 836.000 ms | 850.000 ms | 605.792 ms |
| 5 | 837.000 ms | 798.000 ms | 596.667 ms |

Median **837.000 -> 816.000 ms** is **2.51% lower**, with three winning pairs;
candidate/TeaVM is **1.347**. This does not establish an added benefit over the
simpler inline prototype's 4.65% result. Separate batches do not prove an
incremental regression, either. The extra id mechanism, sentinel and telemetry
change were removed before selection. Runtime SHA-256:
`4a625536a7ad769cdbd46d4fb6a41e7a98a2b3526461e47429e3e22cd9a56b63`.
All 15 fresh CPU-2/1-GiB processes completed 251 frames and matched the saved
reference, with no warmup/replay or concurrent tests/builds/profiling.

#### Inline compact entries: confirmation and retained source

Rebuilding the restored source reproduced runtime SHA-256 `e28b80b9...` exactly.
The second five-pair batch used those same runtime bytes and matching AOT:

| Round | Native-raster baseline | Inline compact entries | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 812.000 ms | 972.000 ms | 600.189 ms |
| 2 | 824.000 ms | 813.000 ms | 605.288 ms |
| 3 | 817.000 ms | 790.000 ms | 603.014 ms |
| 4 | 890.000 ms | 790.000 ms | 605.270 ms |
| 5 | 811.000 ms | 794.000 ms | 605.086 ms |

This batch's medians are **817.000 -> 794.000 ms**, with four winning pairs.
Across both byte-identical batches, all observations included, the ten-pair
medians are **828.000 -> 796.500 ms**: **3.80% lower**, with **8/10 pairs faster**.
TeaVM median is **602.908 ms**, giving **1.321x**; the required 1.10x is unmet.
Every fresh process completed 251 frames and matched the saved RGB reference;
no warmup/replay or concurrent builds/tests/profiling occurred during timing.
The second batch's report initially carried the preceding prototype's coverage
annotation; that annotation was corrected from a completed first-batch process
with matching runtime bytes. Timing/runtime/AOT identity was unaffected.

The matching AOT pack is 9,831,921 bytes, SHA-256
`a575875bebce645d7d6325bc8096e23db8a9773fc0c3ce32d542e344fe59dca1`.

Retained java-tools source commit: `c49fc8d5820b784ae11d59851a0ba232be270700` (master).

The final source has the simpler eager ownership ids, bounded inline entries,
compact native results and weak exact-exit transfer. The 121 new assertions
were rerun after reverting deferred ids. Together with the five unchanged
focused suites listed above, the retained implementation has 602 passing
assertions. No new user/runtime flag or application rule was introduced.
The final isolated build passed with four existing warnings; the 681-source
audit passed and protected decompiler WIP stayed outside the bundle.

Headless Firefox 148.0.2 passed `node /tmp/teavm-intro-firefox-proof.cjs`: all
251 frames, saved tick-80 canvas readback hash exact, 962 AOT hits and zero
misses/refusals/errors/page errors. This was a paced correctness smoke, with
no screenshot or native reference regeneration. The owned ephemeral-port
server was stopped; the existing user's server remained running.

Two separate instrumented fresh-process GC diagnostics (excluded from matched
timing) completed 251 frames and matched the reference. With CPU 2 and 1 GiB
old space, baseline/candidate animation times were 820.000/810.000 ms. Actual
first-to-last-presentation windows were 785.272/772.269 ms, overlapping only
**1.933/2.707 ms** of observed GC. Heap used at the last presentation was
403,882,744/362,112,288 bytes. These are sparse per-process diagnostics, not peak
heap or page-plus-workers acceptance. The observer's full-window inference was
unavailable because the result used stdout rather than console; no full-window
claim is made. Neither process reproduced the rare long outlier, so its cause
remains unproven. This evidence does not support blaming GC for the steady gap
in these runs. The private diagnostic hook was removed afterward.

The one comparison JSON retains the current measurements, bounded history,
source/runtime identities, browser proof and GC summary. No new report JSON or
generated Java/binary is committed. Selected/default and published artifacts
remain unchanged. The 10% execution target and original memory/startup/
presented-FPS/phone/stability release gates remain open. The next compiler
investigation should target bounded affine-loop versions that can prove a
whole range safe, preserving partial faults and low-fuel fallbacks, rather than
repeat the rejected local bounds reuse or static-field mirrors.


#### Whole-range countdown loops: first experiment (2026-10-18)

A generic SSA proof recognizes a countdown header (--count >= 0), one linear
body/backedge, and primitive array accesses indexed by header phis stepping
by one. Calls, other throwing effects, branching bodies, different strides,
non-parameter arrays, extra entries and demoted blocks refuse the proof.
Numeric integer constants are admitted without treating class/string ldc as
pure. The fast version guards the full initial range without signed overflow
and reserves exactly count+1 header checks. Low fuel or an invalid range uses
the original loop, retaining partial writes, exact resume PCs and handlers.
The fast path drops proved array representation/bounds/exception wrappers and
per-iteration fuel checks; a shared 16 KiB budget bounds extra loop code.
A method with these range versions does not also duplicate a representation-
only whole-method version. No user flag or game-specific core data was added.

Initial validation passed 740 focused assertions (79 new countdown cases,
121 compact calls, 109 canonical frames, 96 array ABI, 59 heap arrays, 91 bulk
copies, 90 integer clears and 95 class-readiness tokens). The broader
structured-Wasm suite passed 420/426; all six failure names reproduce exactly
with the committed HEAD compiler loaded instead of the candidate. Those
failures concern conservative admission/diagnostics for a partial reference
return, not these primitive loops; no assertions were weakened.

The isolated debug/worker build passed with four existing warnings. The
682-source audit passed, excluding only generated JRE indexing and leaving
protected decompiler WIP outside the bundle. Matching offline AOT ran no Java.
Fresh coverage completed 251 frames and matched the saved RGB reference. Both
hot span methods have one version removing two checks (460/368 extra bytes),
and retained compact native entries. Native entry counts were 3,473,053 and
1,168,526. Installing a version alone does not prove a dynamic guard arm ran.

| Round | Retained compact baseline | Countdown versions | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 799.000 ms | 786.000 ms | 599.319 ms |
| 2 | 797.000 ms | 774.000 ms | 617.777 ms |
| 3 | 896.000 ms | 794.000 ms | 602.661 ms |
| 4 | 827.000 ms | 798.000 ms | 605.525 ms |
| 5 | 788.000 ms | 941.000 ms | 603.705 ms |

Median **799.000 -> 794.000 ms** is only **0.63% lower**, with four winning
pairs. Candidate/TeaVM is **1.315**. All 15 fresh CPU-2/1-GiB processes completed
251 frames, no warmup/replay, saved reference exact, no concurrent build/test/
profiling during timing. Runtime SHA-256:
`d92fd5827b3313bf69b7f506441963939256e129db3599e7beabb02cea479cce`.
This modest result is unselected pending a profitability adjustment.

A separate adapter diagnostic records the actual native entry operands and
whether readiness/range/fuel conditions hold. It is excluded from timing and
heap acceptance. Every recorded hot entry satisfies the conditions, with no
uncaptured array metadata. Solid counts (1,168,526 total): zero 233,056; one
182,706; two/three 294,514; four/seven 257,931; eight/31 196,170; 32/127 4,149.
Gradient counts (3,473,053 total): zero 1,215,400; one 1,023,742; two/three
807,552; four/seven 259,282; eight/31 165,125; 32/127 1,952. There are no
negative or >=128 counts. These are observed operands satisfying the guard,
not an injected counter inside the generated fast arm. The diagnostic
completed 251 frames and matched the saved reference; its hook was removed.

Only 12.3% of gradient entries and 39.2% of solid entries have >=4 iterations.
The successor tests size first, skipping the full range/fuel guard for shorter
loops, with the original loop as fallback. The guard cost needs amortization;
validity alone is insufficient. The 10% goal and original release gates remain
open; selected/default and published artifacts are unchanged.


#### Short-loop size guard: two batches, removed

The successor checks count >=4 before evaluating the range/fuel guard. Its
105 new assertions pass, including older calling/exception paths, native
forwarded entries, actual collection of proof graphs, budget exhaustion,
primitive coercions, aliases, partial faults and exact fuel resume state.
Together with the unchanged related suites, 766 focused assertions pass.
The broader structured-Wasm result remains 420/426, with the same six failures
reproduced using committed HEAD. The isolated build and 682-source audit passed;
matching offline AOT and the fresh 251-frame saved-reference check passed.
Runtime SHA-256: `cd88d200ed4362c668113f60c02ad092d782ac520cc3776affe56af053a4c990`.
The hot gradient/solid versions add 465/373 bytes and keep both compact entries.

| Batch / round | Retained compact baseline | Size guard | TeaVM |
| --- | ---: | ---: | ---: |
| 1 / 1 | 844.000 ms | 789.000 ms | 605.470 ms |
| 1 / 2 | 806.000 ms | 1109.000 ms | 604.584 ms |
| 1 / 3 | 798.000 ms | 904.000 ms | 694.757 ms |
| 1 / 4 | 1082.000 ms | 785.000 ms | 1288.168 ms |
| 1 / 5 | 789.000 ms | 789.000 ms | 608.130 ms |
| 2 / 1 | 795.000 ms | 794.000 ms | 601.395 ms |
| 2 / 2 | 816.000 ms | 777.000 ms | 603.882 ms |
| 2 / 3 | 799.000 ms | 791.000 ms | 599.245 ms |
| 2 / 4 | 795.000 ms | 784.000 ms | 601.138 ms |
| 2 / 5 | 824.000 ms | 831.000 ms | 728.357 ms |

All 30 fresh CPU-2/1-GiB processes completed 251 frames and matched the saved
reference, with no warmup/replay or concurrent tests/builds/profiling.
Ten-pair medians are **802.500 -> 790.000 ms**, **1.56% lower**, versus TeaVM
**605.027 ms** (ratio **1.306**). There are six material wins, three regressions
and one 0.000256-ms difference that is effectively a timer-resolution tie.
Large observations are retained, including TeaVM's 1,288 ms run. Other
long-running QEMU processes and host CPU pressure were observed; no external
process or system setting was changed and no specific outlier is attributed.

Both countdown variants, their proof helper and their tests were removed:
validity and observed guard satisfaction did not establish a useful repeatable
elapsed-time gain. No browser smoke or artifact selection followed. The retained
source remains `c49fc8d`, with its ten-pair 796.500 ms versus 602.908 ms TeaVM.
The operand census stays attached to this bounded experiment record rather
than masquerading as current runtime coverage. The next experiment tests
primitive-constant rematerialization in the Wasm compiler: avoid dedicated
locals/assignments for literals, preserving phi copies, spills and exception
order. The 10% target and original release gates remain open.


#### Primitive-constant rematerialization: measured and removed

A generic compiler prototype emitted primitive/null literals at uses rather
than allocating a dedicated local for each occurrence. Phi copies and frame
spills used the same exact typed encoding; string/class resolution retained
its original order and identity. Temporary literal maps/encodings were released
when compiler diagnostics were disabled. It added no runtime flag.

The new suite passed 58 assertions covering integer/long limits, f32 rounding,
signed zero, ordinary/compact returns, stack phis, null/string identity, partial
faults, literal locals in handlers/fuel spills and collection while runtime
import metadata stayed alive. Related suites passed 121 compact-call, 109
canonical-frame, 96 array-ABI, 59 heap-array, 91 bulk-copy, 90 integer-clear,
95 readiness-token and 30 division assertions: **749 focused assertions total**.
The broader structured-Wasm suite remained 420/426 with precisely the same six
committed-baseline failures. The isolated build passed with four warnings and
681-source audit; matching offline AOT and fresh 251-frame reference passed.
The hot gradient/solid/triangle modules removed 33/13/188 literal locals; all
existing native compact entry choices remained available. No gain is inferred
from those counts.

| Round | Retained compact baseline | Immediate literals | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 828.000 ms | 811.000 ms | 601.088 ms |
| 2 | 797.000 ms | 799.000 ms | 599.742 ms |
| 3 | 815.000 ms | 800.000 ms | 601.337 ms |
| 4 | 791.000 ms | 779.000 ms | 599.174 ms |
| 5 | 797.000 ms | 808.000 ms | 694.844 ms |

Median **797.000 -> 800.000 ms**, **0.38% worse**, with three winning and two
regressing pairs. Candidate/TeaVM is **1.331**. All 15 fresh CPU-2/1-GiB
processes completed 251 frames and matched the saved reference, no warmup or
replay, no concurrent build/test/profiling. Runtime SHA-256:
`72413247182d0a487a019cd66021cd00ebad701de8e54ba933e1bd203c14065a`.
The prototype and its new tests were removed. No browser smoke or artifact
selection followed. Retained source remains `c49fc8d`.

Reviewing the older native-object-field experiment found a concrete blocker
for revisiting it: object fields call allocObject, but unlike array views their
field containers never register for reclamation. Raw object free bins exist,
but normal allocation never reports dead field containers to them. That must
be fixed and tested before wider slab allocation, irrespective of any speedup.
The 10% execution target and original release gates remain open.


#### Native object-slab reclamation: retained correctness fix

`newFields` now registers binnable native field-storage containers with the
heap's existing finalization registry. Holdings contain only allocation
identity/address/size, with no Java wrapper or storage reference. Tracking the
container lets reflection/host aliases retain storage after its Java wrapper
collects. Explicit frees unregister records; queued stale records cannot free
a replacement using the same address. Existing <=4 KiB free-bin limits and
unsupported-registry/large-allocation policy remain unchanged. Recycled slabs
are zeroed. Native raw-base caches are invocation-local, so cleanup between
host turns cannot reuse bytes while a synchronous native invocation uses them.

Retained java-tools commit: `27bf7727683902023a45948a667f623d4382d791`.
These focused commands passed **368 assertions**, including **47 new cases**:

```sh
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/objectSlabReclamation.test.js # 47
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmHeapFreeList.test.js # 71
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmHeapGrowth.test.js # 35
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmHeapBulkCopy.test.js # 21
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/slabFields.test.js # 49
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/denseFields.test.js # 20
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/workerDenseFields.test.js # 3
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmHeapArrays.test.js # 59
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/wasmInstanceInline.test.js # 63
```

The native callback test ends WeakRef construction's keep-alive job first,
then proves that GC actually clears the storage container inside a synchronous
Wasm callback. Its extent is still unavailable to nested allocation; native
code reads the original field value before returning. Only after a host turn
can reclamation reuse it. Other cases cover retained containers, reference
cycles, explicit frees, wrong-size/duplicate tracking, stale callbacks, zeroed
long/int/reference defaults, array liveness remaining independent, memory
growth and native-storage recovery after bump-space exhaustion.

The isolated debug/worker build passed with four existing warnings. All 681
source files match the committed source, excluding generated JRE indexing;
protected decompiler edits were excluded. A formatting rebuild reproduced
identical runtime bytes, so its matching dense AOT remained valid. Fresh dense
and native-storage diagnostics each completed 251 frames and matched the saved
reference. Native storage tracked 371 field containers; dense tracked zero.
Neither intro reproduced field-container reclamation (freed/reused counts
were zero); forced-GC tests provide that evidence. Native fields consumed
4,728 additional bytes of the fixed linear heap. This is not a peak-heap,
512 MiB, long-session or phone acceptance claim.

Firefox 148.0.2 passed the restored dense policy with this runtime: 251 frames,
exact saved tick-80 canvas hash, 962 AOT hits, zero misses/refusals/errors and
no page errors. No screenshot or native reference regeneration. Only the owned
ephemeral server was stopped; the user's existing server remained running.
The memory fix adds no storage flag and does not change allocation defaults.
Runtime SHA-256:
`5d471143a0767c6bf4258eaccfe8234cbdb0f417c1ecb3909f19c4e02c2a17e8`.

#### Same-runtime field storage comparison: native allocation rejected

Both modes used the identical reclaiming runtime above and independently
recorded matching AOT packs. Dense allocation takes priority even though the
debug controller's defaults enable native-field support; the initial assertion
that absent configuration meant native support was off was incorrect. Actual
storage options and tracked counts are reported. Baseline: dense true;
candidate: dense false/native true. No source/runtime difference is attributed
to the following comparison.

| Round | Dense JS fields | Native primitive fields | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 791.000 ms | 806.000 ms | 601.639 ms |
| 2 | 798.000 ms | 811.000 ms | 604.328 ms |
| 3 | 816.000 ms | 826.000 ms | 603.520 ms |
| 4 | 829.000 ms | 818.000 ms | 607.505 ms |
| 5 | 805.000 ms | 809.000 ms | 602.474 ms |

Median **805.000 -> 811.000 ms** is **0.75% worse**; four pairs regress.
TeaVM median is **603.520 ms**: dense/native ratios **1.334/1.344**. Every
fresh CPU-2/1-GiB process completed 251 frames and matched the saved reference;
no warmup/replay or concurrent build/test/profiling. Each row validates actual
allocation mode and tracked field containers, not configuration alone.
Native-field sites were installed in face rendering (12), projection (6),
logo rendering (12) and mesh bounds (18), among others. Correctness and native
coverage did not establish a speedup. Dense private policy/AOT was restored;
normal/default and published artifacts remain unchanged. No storage-default
switch followed this failed comparison. The GC fix remains for correctness.

#### Next call-site proof: ownership of numeric control globals

The earlier empty-call experiment still made an indirect native eligibility
call before omitting the empty callee. It therefore did not remove the call
boundary on that path. A successor can test eligibility in the caller only if
it reads live fuel/readiness controls without pinning retired compiled bodies.

Two separate Node 22.23.2 `--expose-gc` proofs kept a numeric fuel global alive
in another native module while retiring a module that owned an externref owner
and an import closure. After twelve host turns/forced collections, borrowing a
module-defined exported fuel global kept its owner, instance, function and
module alive. Numeric reads and prototype-setter updates worked, but its
retention violates the intended cleanup contract.

Creating the mutable i32 control with `new WebAssembly.Global` on the host,
then importing/re-exporting it from the callee, preserved re-export identity.
The owner, original instance, function and module all collected while another
module still read the live fuel (100,000,000). Calling the standard prototype
setter changed that reader to 1. The host control contains no back-reference
to the retired execution context. These are substrate/ownership POCs, not an
implemented runtime optimization, Firefox lifetime validation or speed result.

The next implementation should use host-owned control globals and symbolic
global-index relocation in the assembler, preserving existing public entries.
It must then prove caller-side omission without an eligibility call, preserving
argument effects, owner readiness, low fuel, replacement/revocation and retired
metadata collection. Reuse the bounded generic primitive-copy proof rather
than game/method names. Do not scan opcode bytes to relocate globals. Measure
fresh unchanged-workload timings before retaining an optimization.
The 10% execution target and original release gates remain open. The private
benchmark still uses the documented 32 KiB version budget and scheduler timing
sampling disabled; the normal integration defaults have not been switched to
those experimental settings or to native field allocation.

---

#### Host-owned fuel and caller-side empty-copy omission

The old empty-call trial still entered a native eligibility function for every
omitted copy. The new experiment imports the callee's mutable numeric fuel
global directly and tests a revocable word in the shared heap, without calling
an eligibility helper. A host-created `WebAssembly.Global` is necessary:
importing a module-defined exported global pinned its retired module in the
forced-GC proof. Importing the independent host-created global allowed the
owner, instance, module and function to collect. Prototype-set fuel changes
remain visible to native readers; there is no setter interception or mirror.

The assembler now relocates explicitly tagged defined-global instructions
around imported globals. Public run/runv, scalar return scratch, speculative
class flags, legacy canonical entries, compact entries and forwarded-array
entries retain their calling conventions. Relocation tests cross index 127
and use opcode-valued literal bytes, so byte scanning cannot corrupt immediates.

A foundation-only build passed the reference but installed no omission guards:
the whole-copy recognizer rejected the exported source's duplicated forward
branches. Five matched pairs measured baseline **805.000 ms**, candidate
**810.000 ms**, TeaVM **604.018 ms**; this was not a speed improvement. Its
runtime SHA was
`21dd4baaec692d49de711d133de135809f7e08a81ebc1ac67073f73c0d4550cb`.

The final proof follows all possible paths for zero count and nonnegative
source position, using bounded integer expressions, ranges and comparison
facts. It rejects reachable effects, unresolved arithmetic, handlers and
possible overflow, and stops after 2,048 instructions, 4,096 proof steps or
64 pending paths. It does not require a particular layout of copy loops or a
game name. The exact whole-copy proof remains separate from this no-effect
proof. Conservative fuel bounds include all structured loop headers. The
zero-count entry and caller optimization apply automatically when proved;
no new runtime flag was introduced, and optional bulk copying remains separate.

A caller's guard retains an independent host fuel global and numeric facts,
not retired callee metadata. Publication validates the current native target,
parameter layout, fuel identity, readiness address and fuel bound. Withdrawal,
incompatible replacement and retirement revoke omission. Argument effects
execute first; deferred array reads refuse omission. Low fuel, cold/custom
readiness and guard-allocation failure keep supported invocation paths. The
guard's eight-byte extent is recycled when its binding retires.

Fresh actual-game coverage reduced integer-copy native entries from
**4,123,713 to 240,639**, removing **3,883,074 function entries**, and retained
the saved tick-80 RGB hash across 251 frames. It does not count an eligibility
call as elimination. The diagnostic run was 775.000 ms; repeated comparisons
below decide retention, not this individual run.

Candidate runtime SHA-256:
`43e9921fcaaaf519e84eb7b6ff35571112d45a50e542064440c26c2caf1cfe8e`.
The isolated build passed with four existing webpack warnings. The source
audit checked 682 source files plus the generated JRE index and excluded the
unrelated decompiler worktree edits. Offline AOT recording executed no Java.

| Round | Baseline JVM | Candidate JVM | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 827.000 ms | 765.000 ms | 605.279 ms |
| 2 | 798.000 ms | 773.000 ms | 610.794 ms |
| 3 | 792.000 ms | 811.000 ms | 597.337 ms |
| 4 | 927.000 ms | 785.000 ms | 599.222 ms |
| 5 | 1068.000 ms | 778.000 ms | 600.447 ms |
| 6 | 793.000 ms | 779.000 ms | 599.458 ms |
| 7 | 795.000 ms | 771.000 ms | 604.137 ms |
| 8 | 1434.000 ms | 766.000 ms | 991.026 ms |
| 9 | 800.000 ms | 763.000 ms | 602.343 ms |
| 10 | 817.000 ms | 774.000 ms | 606.010 ms |

Two batches alternate first-process order. Each measurement is a fresh CPU2
Node process with `--max-old-space-size=1024`; all 251 frames execute once,
without replay or warmup. Both sides use identical dense-field allocation,
native pixel conversion, 32 KiB heap-specialization policy and disabled
scheduler sampling. No profiling, test, build or browser process overlapped
these measurements. No run was excluded, including slow baseline and TeaVM
outliers.

Batch medians: **827 -> 778 ms** and **800 -> 771 ms**. Combined medians:
**808.500 -> 773.500 ms**, **4.33% lower**, with **nine wins and one regression**.
TeaVM median **603.240 ms** leaves the candidate **28.22% slower**. Reaching
1.10× would require another approximately **14.2% reduction** from this
candidate. This is a retained incremental improvement, not achievement of the
goal or the full-game/phone acceptance gates.

Focused validation: **845 assertions** passed. Commands (from `java-tools`,
with `NODE_PATH=/home/kreijstal/git/java-tools/node_modules`):

```bash
node --expose-gc test/hostOwnedCanonicalFuel.test.js   # 160
node --expose-gc test/emptyCanonicalCopy.test.js       # 83
node --expose-gc test/compactCanonicalFrames.test.js   # 121
node --expose-gc test/canonicalDirectFrames.test.js    # 109
node --expose-gc test/wasmParameterArrayAbi.test.js     # 96
node --expose-gc test/primitiveArrayCopyEntry.test.js  # 91
node --expose-gc test/intZeroClearEntry.test.js        # 90
node --expose-gc test/classInitializationToken.test.js # 95
```

The new coverage includes real javac fixtures, duplicated branch layouts,
argument side effects and faults, scalar ABIs, reference-return scratch cleanup,
low fuel and prototype-set globals, class initialization, custom readiness,
allocation failure, withdrawal/replacement, reclamation and forced-GC ownership.
Only the generic compiler/runtime and its focused tests belong in `java-tools`;
this application profile, timings and artifact selection stay here. The selected
persistent player is unchanged. No screenshot or native reference regeneration.
The existing single comparison JSON holds the current result and bounded history.

The next useful target is surviving render-kernel overhead. Dead nonvolatile
static reads are a candidate for elimination with preserved initialization and
spill semantics; this is different from the rejected static-value heap mirrors.
Short-span specialization is another possibility. Neither is implemented or
credited as a performance gain in these results.

Generic runtime and tests committed on `java-tools` master as
`7e194e52a880d25216890ff21687a64b96b824c2`. Firefox 148.0.2 completed 251 frames and matched the saved
canvas RGB hash, with 962 AOT hits, zero cache misses/refusals/errors and no
page errors. The paced browser smoke is correctness evidence; its timing is
not used in the Node comparison or as presented-FPS/phone acceptance. The
post-commit source audit matches all 682 committed source files and only the
generated JRE index is extra. Only the owned temporary server was closed;
the user's existing intro server remains running.

#### Single-entry scalar field-cache bypass: rejected after native-code comparison

A structural compiler census confirmed one unused scalar static read in each
hot span. Those values also appear in exception/fuel snapshots (slots 17 and
8). Static-cell getters can change after compilation. Directly dropping reads
without a proof for continuation liveness and host effects would therefore be
unsafe. No additional CPU attribution run was needed to identify these sites.

A small generic prototype kept every field access, class-initialization guard,
exception site and captured SSA value, but omitted the cache value/filled pair
for a scalar static field read only once in an entry block with no incoming
edges. Repeated sites, loop entries, and reference/array generation caches
kept their existing paths. It added no runtime flag or application names.
The actual gradient and solid spans each reported one bypass. Integer-copy
entry count stayed 240,639, so this was compared against retained `7e194e5`,
not the older pre-omission baseline.

The isolated build passed with four existing warnings and a 682-source audit;
only generated JRE indexing was extra, with protected decompiler WIP excluded.
Offline AOT recording executed no Java. The fresh diagnostic completed 251
frames with the saved tick-80 pixels. Candidate runtime SHA-256:
`1fe76cdbd3406c3d08cf28738d9a093196de1c74f42baca93c989279299311f9`.

| Round | Retained JVM | Cache bypass | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 780.000 ms | 760.000 ms | 600.827 ms |
| 2 | 767.000 ms | 785.000 ms | 604.260 ms |
| 3 | 768.000 ms | 760.000 ms | 605.170 ms |
| 4 | 783.000 ms | 779.000 ms | 605.210 ms |
| 5 | 849.000 ms | 772.000 ms | 603.344 ms |

The usual five fresh matched pairs used CPU2, 1,024 MiB Node old-space, identical
policy and presentation, 251 frames once, no warmup/replay and no overlapping
build/tests/profiling. Every run matched the saved pixels. Median
**780 -> 772 ms**, **1.03% lower**, four wins/one regression, did not establish
a useful further gain. No run was excluded.

A separate eager TurboFan diagnostic then compared the real gradient method's
compact forwarded-array entry (function index 48), in an initialized-class
compilation context. The prototype shrank the module **5,477 -> 5,417 bytes**,
but both emitted **848 instructions, 3,872 bytes**, with identical instruction
text after normalizing addresses. This establishes equality for that optimized
entry/context, not every method or V8 tier. The comparison used:

```bash
node --no-liftoff --no-wasm-lazy-compilation --print-wasm-code \
  --print-wasm-code-function-index=48 -e \
  "new WebAssembly.Module(require('fs').readFileSync('/tmp/teavm-hot-span-baseline.wasm'))"
```

The equivalent candidate command selects `teavm-hot-span-candidate.wasm`.
Both isolated modules were dumped from the compiled method's `meta.bytes`. These flags were diagnostic only; timing
processes used the normal engine. No Java or animation was executed for the
native-code comparison. Both normalized instruction SHA-256 values are in the
existing single comparison JSON. Removing this Wasm bookkeeping did not remove
any optimized native instruction in the inspected entry.

The prototype and optimization-specific assertions were removed. Focused
prototype suites passed **463 assertions** (42 new, 26 static cells, 95 class
initialization, 121 compact calls, 83 empty copies, 96 array ABI). Meaningful
static-snapshot semantics were retained as a generic regression suite:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/staticFieldContinuations.test.js
```

**37 assertions pass** on the retained runtime: fuel continuations, mutation
before an exception, captured handler values, live accessor replacement,
throwable identity/original PC, cold/reset initialization, repeated writes,
entry back edges, and wide/floating values. The focused prototype initially
expected status -5 for a guest getter failure; the correct existing protocol is
-3 with an owned precise-PC spill, now asserted together with throwable identity.

The private runtime/AOT and source were restored to `7e194e5`; a fresh restored
run completed 251 frames and matched the reference. Its previous ten-pair
**773.500 ms versus TeaVM 603.240 ms** remains the retained result. The selected
persistent player, user server and protected decompiler WIP remain unchanged.
No screenshot, native-reference rerun or browser smoke was needed for the
rejected prototype. The goal is still unmet.

The next architectural candidate is native primitive static storage that owns
both reads and writes. This differs from the rejected read-only mirrors, which
kept JS-owned writes and added mirror maintenance. A bounded correctness proof
must precede integration: preserve host-accessor fallback, Map membership,
coercion timing, cell replacement, live memory and collectible ownership. No
performance gain had been demonstrated at that point; the implementation and
measurements follow below.

#### Canonical native integer statics: retained

The generic runtime now gives eligible integer static fields one canonical
native value shared by the interpreter, generated JS and structured Wasm.
Native reads and writes avoid JS field imports while normal data descriptors
are valid. A public cell/Map read observes the latest native write. This is
not the earlier read-only mirror: native putstatic updates canonical storage
directly, rather than calling a JS setter to maintain a second integer value.
A guarded fallback preserves custom accessors and coercion timing.

Each bound cell owns 16 aligned bytes: read/write capability bits, i32 value,
JS representation tag and padding. Exact JS booleans, null, undefined, -0 and
non-i32 numeric values retain their public representation until a native write.
Objects, BigInts, symbols, strings and accessor descriptors retain callable
reads; unsupported values are not coerced at assignment time. Descriptor,
delete and present-property transitions revoke native access before callbacks.
Materialization/refresh preserves reentrant native writes from a foreign
receiver's property trap. Readonly/sealed/frozen property contracts and Map
membership restoration remain observable through the original paths.

The existing heap's object finalizer reclaims the cell extent after its
references die. A live native cell retains its canonical memory, not the heap
wrapper or a compiled module. Growth refreshes its 16-byte typed view. New
bindings refuse shared memory, out-of-range signed-i32 addresses and exhausted
heaps; a cell already bound to another memory keeps its original accessors.
Reference, wide, volatile, legacy-key and custom/ordinary-Map storage retain
supported paths. Import deduplication preserves the first actual cell or refusal
when a host cell resolver changes. Only small counts/addresses survive compiler
cleanup; temporary cell/import maps are released with the other analyses.

Activation is automatic for JVMs that already have a Wasm heap. JVM and JRE
class loaders create native-capable cells before bindings can escape; runtimes
without that heap and compiler-only shadows retain ordinary cells. There is no
new public option, environment flag, application name or source-symbol map in
the generic implementation.

Implementation/tests are committed on `java-tools` master as
`40eb1c41eb09205aa68ac83cc194694c3cd827c4`. The final isolated build passed with four existing webpack
warnings. All 683 committed source files match the build source; only generated
JRE indexing is extra. Protected decompiler worktree edits stayed excluded.
Matching offline AOT recording executed no Java. Final runtime SHA-256:
`f5a21cdd2d56f658910b7e4edf85c0ac993b7a321f18e4f94a4f6c1d0e8d3c4a`.

Three successive candidates were measured separately, without pooling them:

- Initial protocol (`a6bed557…`), five pairs: **773 -> 749 ms**, four wins,
  one regression; TeaVM **605.280 ms**.
- Automatic heap-capability gating (`953af468…`), ten pairs: **766.500 ->
  738.000 ms**, **3.72% lower**, ten wins; TeaVM **603.120 ms**.
- Final range/shared-memory refusals, five pairs below; same retained
  `7e194e5` baseline. A slow candidate result remains included.

| Round | Retained JVM | Final native statics | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 763.000 ms | 738.000 ms | 601.948 ms |
| 2 | 761.000 ms | 903.000 ms | 598.190 ms |
| 3 | 760.000 ms | 740.000 ms | 599.433 ms |
| 4 | 766.000 ms | 744.000 ms | 609.280 ms |
| 5 | 778.000 ms | 759.000 ms | 598.893 ms |

Final medians: **763 -> 744 ms**, **2.49% lower**, four winning pairs and
one regression. TeaVM **599.433 ms** leaves this artifact **24.12% slower**;
the 10% target remains unmet. All processes are fresh CPU2 Node processes
with 1,024 MiB old-space; 251 frames once, no replay/warmup. Allocation,
presentation, 32 KiB specialization and sampling-off policies are identical.
No build, tests, browser or profiling overlapped these performance runs.
Every result matched the saved reference and no run was excluded.

Fresh final coverage found 63 bound scalar cells, 1,008 additional bytes in the
existing linear heap, with dense instance fields unchanged. Both hot spans,
triangles and mesh methods contain native reader sites. Write behavior was
proved by real compiled fixtures with zero getter/setter imports on the native
path, not inferred from potential-site counters. The integer-copy count remains
240,639, retaining the earlier 3,883,074 omitted calls. This is not a peak-JS-heap
or long-session memory acceptance claim.

Focused checks passed **933 assertions**. Commands from `java-tools`, with
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules`:

```bash
node --expose-gc test/nativeStaticCell.test.js           # 109
node --expose-gc test/nativeStaticFields.test.js         # 34
node --expose-gc test/staticFieldContinuations.test.js   # 37
node --expose-gc test/wasmStaticCells.test.js             # 26
node --expose-gc test/classInitializationToken.test.js   # 95
node --expose-gc test/canonicalDirectFrames.test.js      # 109
node --expose-gc test/compactCanonicalFrames.test.js      # 121
node --expose-gc test/emptyCanonicalCopy.test.js          # 83
node --expose-gc test/wasmParameterArrayAbi.test.js       # 96
node --expose-gc test/intZeroClearEntry.test.js          # 90
node test/workerBooleanSnapshot.test.js                 # 30
node --expose-gc test/wasmDirectStaticLinkContract.test.js # 57
node test/workerDirectJreTransport.test.js               # 27
node test/jitShadowCompile.test.js                      # 19
```

Worker checks include native-written booleans consumed by both Node and browser
mirror snapshots. Native cell checks include reflected values after direct
stores, cold/deleted membership, metadata refusal, deferred coercion/throwable
identity, accessor receiver identity, foreign-receiver reentrancy, memory growth,
readonly/frozen cells, old-object release, heap-wrapper collection and cell
reclamation. Continuation checks retain exact captured values and PCs after
fuel exhaustion and mutation before an exception. The initial heap-wrapper GC
test helper accidentally captured the wrapper in its module factory; capturing
only the memory corrected the fixture, and the actual ownership assertion passes.

A separate pair of diagnostic passes hashed every RGBA output frame. All
**251 frames matched exactly**, with **225 distinct frames**. SHA-256 of the
concatenated frame-hash sequence:
`a275416200c6a79aa927777ada094644d46fd628a0ce7541a5ed1239ca81f8d3`.
Hashing ran inside those diagnostic callbacks, so their elapsed times are
excluded from performance results. The private measurement harness was restored
exactly afterward. No screenshots or native reference regeneration were needed.

Firefox 148.0.2 also completed 251 frames and matched saved tick-80 canvas RGB,
with 962 AOT hits, zero cache misses/refusals/errors and no page errors. This is
a paced correctness smoke, not presented-FPS or Android acceptance. Only the
owned ephemeral server was closed. The selected persistent player and user
server remain unchanged; all results live in the existing comparison JSON with
bounded history. Original full-game heap, startup, rolling-FPS and phone gates
are still open.

Next: reference statics can potentially use independent host-created externref
globals with the same revocation/property protocol. They must release replaced
references and keep return scratch separate; array metadata should retain its
existing validation until separately proved. After that, a guarded native
kernel entry could reduce the remaining short-call/frame ABI overhead. Neither
extension is implemented or counted as a speed gain here.

### Native reference statics: rejected

Tested independent host-created mutable `externref` globals for reference
statics, using the integer cell's capability word to revoke native access on
descriptor changes. Mutable cells cleared their raw property slot, so native
replacement did not retain the previous object. Readonly properties retained
their exact reflected value; volatile/custom accessors and unsupported memory
kept the original imports. Return scratch remained separate from field globals.
The isolated source base was `java-tools` `40eb1c4`; candidate runtime SHA-256
`047de13457eced0337b2961f6eca8905e53ccfd8e95aaa988b00a609dd693ac0`.

The prototype passed **1,073 focused assertions**, including real compiled
reference exchange, 130 imported globals, return-global relocation, low-fuel
captures, mutation before an exception, descriptor/receiver invariants, replaced
object collection, retired cell/module collection, and worker transport of a
native-written array reference. Debug/worker webpack and matching AOT passed.
Separate coverage confirmed reference readers in triangle and mesh methods.

Five alternating fresh-process comparisons, CPU2, Node old-space 1,024 MiB,
251 frames once, identical 32 KiB specialization and sampling-off policies:

| Round | Retained integer statics | Native reference statics | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 779.000 ms | 879.000 ms | 671.681 ms |
| 2 | 737.000 ms | 840.000 ms | 603.201 ms |
| 3 | 742.000 ms | 723.000 ms | 608.081 ms |
| 4 | 750.000 ms | 751.000 ms | 601.866 ms |
| 5 | 757.000 ms | 725.000 ms | 601.604 ms |

Medians **750.000 -> 751.000 ms**, **0.13% worse**, two winning pairs and
three regressions. TeaVM median **603.201 ms** leaves a **24.50%** gap.
Every run completed and matched the existing tick-80 RGB hash; no result was
excluded. No build, tests, browser or profiling overlapped these timings.
Fewer native-to-JS calls did not establish an execution gain. Canonical reference
storage also makes JS readers/writers access the host global, a possible cost;
this is an explanation to investigate, not measured attribution.

Rejected and removed the prototype and its experiment-only tests. Restored the
four source overlays, worker fixture, isolated runtime and matching AOT to
`40eb1c4`. Restoration check:
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/nativeStaticFields.test.js`
passed **34 assertions**. The selected persistent player and user server remain
unchanged. Results stay in the existing comparison JSON with bounded history.

Next experiment: bounded proof of a call's zero-effect path, including only
proved ordinary nonvolatile static reads behind live capability/readiness
guards. Preserve argument effects, low-fuel continuation and replacement
revocation. No speed gain or 10% completion is claimed for that direction.

### General empty-invocation proof: measured and rejected

A bounded partial interpreter proved an entire void invocation returned without
observable effects for known constant arguments and one runtime zero argument.
Unknown branches forked; reachable writes, calls, array access, monitor work,
possible faults, arithmetic overflow uncertainty, non-returning paths and work
limits refused the proof. It admitted ordinary integer static reads only as
explicit obligations. Emitted guards checked the exact published body, its
independent host-owned fuel, class readiness, and native field capability words.
Custom accessors, volatile/inherited/unknown declarations, missing fuel metadata,
allocation refusal, replacement and withdrawal kept the original invocation.
Argument expressions still executed in order before the guard. No game identity,
method name or new runtime/environment flag selected the optimization.

The first prototype short-circuited the dependency guards for nonzero arguments.
Runtime SHA-256
`b1d277b6237c29500dd263a0a2a6ac64e0a98a0461339c001b3e5683d06d2fa3`:
five pairs **738.000 -> 732.000 ms**, **0.81% lower**, TeaVM **608.223 ms**.
This was too small to select. The final version also kept no-effect calls from
invalidating field caches and refused missing/invalid fuel bounds. Source base
`java-tools` `40eb1c4`; final runtime SHA-256
`935fc2a4e2619c3b8844cff3a40d65dea05fa5e40d85f496630e2079c2ff52d7`.

Final artifact, fifteen alternating pairs of fresh CPU2 Node processes with
1,024 MiB old-space, identical policies, 251 frames once, no warmup/replay:

| Round | Retained integer statics | Empty-invocation guards | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 853.000 ms | 840.000 ms | 673.892 ms |
| 2 | 833.000 ms | 888.000 ms | 677.371 ms |
| 3 | 836.000 ms | 812.000 ms | 666.149 ms |
| 4 | 879.000 ms | 804.000 ms | 670.072 ms |
| 5 | 866.000 ms | 825.000 ms | 752.735 ms |
| 6 | 719.000 ms | 731.000 ms | 602.372 ms |
| 7 | 755.000 ms | 827.000 ms | 610.802 ms |
| 8 | 748.000 ms | 729.000 ms | 692.083 ms |
| 9 | 767.000 ms | 760.000 ms | 603.557 ms |
| 10 | 742.000 ms | 730.000 ms | 604.109 ms |
| 11 | 845.000 ms | 765.000 ms | 621.448 ms |
| 12 | 820.000 ms | 745.000 ms | 659.346 ms |
| 13 | 745.000 ms | 741.000 ms | 603.827 ms |
| 14 | 733.000 ms | 738.000 ms | 603.849 ms |
| 15 | 761.000 ms | 765.000 ms | 600.030 ms |

The three five-pair batches had medians **853 -> 825**, **748 -> 731** and
**761 -> 745 ms**. However, the pooled fifteen-pair medians were only
**767.000 -> 765.000 ms**, **0.26% lower**. Ten pairs won; the median matched-pair
ratio was **0.98476**. At ten pairs, pooled raw medians actually regressed
**800 -> 808 ms**. All results and outliers remain included. A separately owned
`virtuoso` process was observed busy during the first batch and absent by the
end of confirmation; it was left untouched. This observation does not measure
its causal impact. The extra five-pair batch did not establish a material
repeatable gain in the stated whole-animation metric.

TeaVM's pooled median **621.448 ms** leaves **23.10%** deviation, above the
required 10%. No build, tests, browser or profiling overlapped these timings.
All 45 final-artifact comparison processes completed 251 frames and matched the
saved tick-80 RGB reference. The preliminary five pairs also matched. Source
classes, assets, presentation and the 32 KiB/sampling-off policy stayed fixed.

Separate post-timer coverage proved **1,215,400 gradient** and **233,055 solid**
native span calls were omitted: **1,448,455 calls** in total. There were 15
proved caller sites among the recorded methods. The reduced count did not
establish enough elapsed-time improvement to justify the machinery.

Focused checks passed **806 assertions**. These were experiment-only proof and
invocation suites plus the retained regression suites. Commands from
`java-tools`, with `NODE_PATH=/home/kreijstal/git/java-tools/node_modules`:

```bash
node test/emptyInvocationProof.test.js                  # 28, prototype removed
node --expose-gc test/emptyCanonicalInvocation.test.js   # 63, prototype removed
node --expose-gc test/staticFieldContinuations.test.js  # 37
node --expose-gc test/emptyCanonicalCopy.test.js         # 83
node --expose-gc test/canonicalDirectFrames.test.js     # 109
node --expose-gc test/compactCanonicalFrames.test.js    # 121
node --expose-gc test/hostOwnedCanonicalFuel.test.js    # 160
node --expose-gc test/wasmCompilerRetention.test.js      # 84
node test/workerBooleanSnapshot.test.js                # 30
node --expose-gc test/nativeStaticFields.test.js        # 34
node --expose-gc test/wasmDirectStaticLinkContract.test.js # 57
```

Proof checks covered constant guards/arithmetic, unknown branches, integer
wraparound, null/reference branches, unreachable exception regions, and work
bounds. Compiled checks covered actual native omission, nonempty effects,
argument effects and faults, getter revocation/restoration, volatile reads,
low fuel, live dependency readiness, replacement, retirement/collection, guard
reclamation and allocation refusal. The final cache/fuel corrections reran the
invocation, static-continuation and empty-copy checks. Both isolated webpack
builds passed with four existing warnings; the final audit covered 684 source
files and matching AOT recording executed no Java.

Rejected and removed the runtime changes, proof module and prototype tests.
Restored the isolated runtime/AOT and source to `40eb1c4`; restoration reran
`node --expose-gc test/emptyCanonicalCopy.test.js` (**83 passed**) and
`node --expose-gc test/nativeStaticFields.test.js` (**34 passed**), with the same
`NODE_PATH`. Failed timing did not trigger another browser/full-frame check,
screenshot or native reference regeneration. The selected persistent player,
user server and protected decompiler work remain unchanged. The existing
comparison JSON contains current results and bounded history.

Next hypothesis: structured-Wasm exception/deoptimization spills currently walk
all defined frame slots rather than backward local liveness. This may retain
otherwise dead temporary values and increase native register/stack pressure.
It is not a measured attribution or implemented speedup. A proof must include
normal and exception successors, wide/overlapping locals, original PCs across
inlining, caller operand stacks, monitors and boolean snapshot metadata. The
existing `regionSafety.computeLocalLiveness` needs an input/coverage audit before
using it: its exception-successor builder consumes numeric item PCs, while
other compiler paths also accept label-based tables. Unknown/unsupported input
must retain the current full spill, and analysis must be bounded and released.

### Original-PC local liveness for native frame spills: retained

Structured-Wasm spill callbacks previously materialized every typed, defined
local, including temporary values that interpretation could never read again.
The retained generic proof computes bounded backward local liveness over the
original method's normal and exception edges. Fuel, call handoff and exception
spills now retain the required locals and clear proved-dead slots in reused
frames. Operand-stack restoration stays separate; boolean snapshot metadata
keeps its existing conservative capture contract. Original PCs remain the basis
across inlining. Observable producers still execute even when their result is
dead. A compiled fixture proves a 1 MiB dead object collects while its spill
frame and native module remain alive.

The proof resolves numeric PCs and label-based exception tables explicitly,
including labels without instructions; it tracks wide/overlapping local slots,
branches, switches and loops. Legacy subroutines, raw wide instructions,
incomplete/ambiguous metadata, unknown operations, excessive graph size,
storage, edge count or work retain full spills. Limits are 4,096 code items,
1,024 slots, 65,536 bitset words, 32,768 counted edges and four million word/edge
operations. All analysis roots and omitted-slot plans are released when
compiler diagnostic retention is off. Only scalar coverage counts remain in
execution metadata. No game identity, symbol or new opt-in flag is involved.

An initial implementation passed the then-965 focused assertions but regressed
the real intro: median **743.000 -> 3,445.000 ms**, TeaVM **604.292 ms**, across
five alternating pairs. Runtime SHA-256
`28a44d663d2eafc5ba16a5e2c3661113f671f136a5f76eebcc381a7fa693737e`.
All 15 processes completed 251 frames and matched the reference; none was
excluded. Compiled body count fell **426 -> 404**, and regular Wasm runs rose
**4,292 -> 669,877** in the first pair. This was a rejected implementation,
not evidence that live-local filtering itself must be slow.

The cause was an import-identity bug: retrying an invocation can need locals
used by its catch handler, while resuming after that invocation can omit them.
Both used `call_spill_<pc>` even when their argument signatures and clear plans
differed. Native module validation failed, forcing slower execution paths. A
new generic fixture with a catch-only local and a call at the end of a protected
region reproduced the validation failure. Distinct retry/after-call imports
fix it and retain both normal and exceptional behavior.

Retained source: **`java-tools` `fc284ac0cfab1342757336b4641e151faa2bcfc6`**, master.
Isolated source base: `40eb1c4`. Final runtime SHA-256:
`54d93378c28b10f7d871d8e9538eea32e318787e6f659cef6aacc8d3625906a4`.
The debug/worker webpack build passed with four existing warnings; all 684
source files were audited against the base plus the two intended overlays,
excluding protected decompiler WIP. Matching AOT recording executed no Java.

Ten alternating matched comparisons used exactly those final runtime bytes and
AOT. Fresh CPU2 Node processes, 1,024 MiB old-space, 251 frames once, no animation
warmup/replay; dense instance fields, native integer statics, native RGB-to-RGBA,
32 KiB parameter specialization and sampling-off policies unchanged:

| Round | Retained integer statics | Local-liveness spills | TeaVM |
| --- | ---: | ---: | ---: |
| 1 | 732.000 ms | 697.000 ms | 609.191 ms |
| 2 | 768.000 ms | 710.000 ms | 610.060 ms |
| 3 | 749.000 ms | 718.000 ms | 609.626 ms |
| 4 | 738.000 ms | 698.000 ms | 602.981 ms |
| 5 | 742.000 ms | 691.000 ms | 616.296 ms |
| 6 | 742.000 ms | 738.000 ms | 605.781 ms |
| 7 | 741.000 ms | 701.000 ms | 606.763 ms |
| 8 | 745.000 ms | 708.000 ms | 609.567 ms |
| 9 | 739.000 ms | 691.000 ms | 602.807 ms |
| 10 | 827.000 ms | 697.000 ms | 736.559 ms |

First five-pair medians **742.000 -> 698.000 ms**; confirmation with opposite
starting order **742.000 -> 701.000 ms**. Pooled medians **742.000 -> 699.500 ms**,
**5.73% lower**, all **10/10 pairs faster**. Median paired ratio **0.94591**.
TeaVM median **609.379 ms** leaves **14.79% deviation**. The 10% target remains
unmet: its threshold is **670.317 ms**, about **29.183 ms** below this result.
Every process completed 251 frames and matched the saved reference; all
outliers, including the final slow baseline/TeaVM pair, remain included. No
build, tests, browser or profiling overlapped performance timing.

All ten candidate processes preserved **426 compiled bodies**, **4,292 regular
Wasm runs**, and every recorded direct entry count compared with its matched
baseline. Thus the measured improvement preserves the established execution
paths rather than relying on a different fallback configuration. Separate
post-timer coverage confirms liveness admission for the hot spans, triangles,
mesh rotation and mesh projection pipeline. Omitted-slot counters count unique
proved-dead original-point/kind/slot entries, including unavailable SSA entries;
they are proof coverage, not newly removed arguments or executed spill counts.
The reported storage bytes count the live-in matrix, not total analysis or VM
heap. No 512 MiB peak-heap or sustained-gameplay claim follows from these data.

Focused checks passed **975 assertions**. Commands from `java-tools`, with
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules`:

```bash
node test/frameLocalLiveness.test.js                    # 120
node --expose-gc test/frameLocalSpills.test.js           # 40
node --expose-gc test/wasmCompilerRetention.test.js       # 88
node --expose-gc test/staticFieldContinuations.test.js   # 37
node --expose-gc test/canonicalDirectFrames.test.js      # 109
node --expose-gc test/compactCanonicalFrames.test.js     # 121
node --expose-gc test/wasmExplicitMonitors.test.js        # 40
node --expose-gc test/wasmDeepInline.test.js              # 8
node --expose-gc test/wasmJsExceptionTags.test.js         # 20
node test/workerBooleanSnapshot.test.js                 # 30
node --expose-gc test/wasmInlineInitialization.test.js   # 50
node --expose-gc test/hostOwnedCanonicalFuel.test.js     # 160
node --expose-gc test/emptyCanonicalCopy.test.js         # 83
node --expose-gc test/synchronizedMethodMonitor.test.js  # 6
node --expose-gc test/wasmInstanceInline.test.js          # 63
```

The new compiled checks cover dead-reference release from a reused frame,
correct live array/bound/static snapshot spill, low-fuel continuation, effects
before a caught fault, host mutation before an exception, exact wide BigInt
values, observable unused getters, and the retry/after-call validation
regression. Cleanup checks cover both successful and failed compilation.

Separate diagnostic processes compared all **251 RGBA frames exactly**, with
**225 distinct frames**, sequence SHA-256
`a275416200c6a79aa927777ada094644d46fd628a0ce7541a5ed1239ca81f8d3`.
Hashing occurred inside their presentation callbacks, so those durations are
excluded from performance data; the private harness was restored exactly.
`node /tmp/teavm-intro-firefox-proof.cjs` also passed: Firefox **148.0.2**, 251
frames, matching tick-80 canvas RGB, **962 AOT hits**, zero misses/refusals/errors
and no page errors. This is a paced correctness smoke, not presented-FPS or
Android acceptance. No screenshots or native reference regeneration were needed.

The selected persistent player and user server stay unchanged. Only source and
tests are retained in java-tools; application measurements remain here and in
the existing comparison JSON with bounded history. No generated Java/binary is
committed. Full-game memory, warm startup, rolling presented FPS, five launches,
sustained play, supported-catalog and actual-phone gates remain unverified.

Next: prove a guarded native kernel entry for bounded primitive loops. Its fast
arm must establish ordinary field storage, readiness, array ownership/ranges,
integer-overflow safety and sufficient fuel before guest effects, then avoid
unnecessary per-element fault/frame protocol. Every rejected guard must retain
the original entry, including null/nonheap arrays, custom metadata/accessors,
low fuel, revocation and replacement. This is not implemented or credited as a
gain. Do not repeat the earlier fuel-only, SIMD, cache-bypass, empty-invocation
or deferred-id variants unchanged; a new experiment needs a distinct proof and
an incremental matched comparison against this retained liveness version.


### Single-iteration native kernels: seven layouts, prototype removed

The next generic proof partially interprets normal SSA flow with one integer
parameter equal to one. It requires all paths to return within bounded work,
refuses repeated nonconstant definitions, and admits only total integer math,
parameter-array accesses with pure parameter-derived indices, and directly
declared ordinary nonvolatile integer statics. Unknown branches fork within a
small budget. Calls, division, shared memory, unknown indices, volatile fields,
reference operations and excessive work retain the original execution path.

Before executing a trace, native guards establish class/inline readiness,
ordinary field capabilities, unsigned index bounds, memory extent without
address wrap, and store disjointness from protected readiness/native-cell
storage. Host-owned fuel must cover the proof's conservative bound. Custom
accessors, partial faults and low fuel keep the original canonical invocation,
its exception handling and exact spill owner. Only bounded instruction/type
arrays survive; SSA/proof graphs are released. There is no game identifier or
new public flag in this code.

Seven variants were compared incrementally against retained `fc284ac0` / runtime
`54d93378c28b10f7d871d8e9538eea32e318787e6f659cef6aacc8d3625906a4`:

| Layout | Baseline median | Candidate median | TeaVM median | Decision |
| --- | ---: | ---: | ---: | --- |
| Guarded callee-entry prefix | 694.000 ms | 702.000 ms | 603.167 ms | Rejected |
| Trace directly in caller | 705.000 ms | 712.000 ms | 601.892 ms | Rejected |
| Caller trace plus constant-argument propagation | 695.000 ms | 718.000 ms | 606.479 ms | Rejected |
| Constant trace, cheap count/publication check first | 696.000 ms | 701.000 ms | 606.119 ms | Rejected |
| Separate small native function | 698.000 ms | 698.000 ms | 605.493 ms | No gain |
| Small function, temporal field alias guards | 704.000 ms | 697.000 ms | 603.548 ms | Unconfirmed 1% gain, unselected |
| Temporal guards, dead trace pruning, packed arguments | 703.000 ms | 706.000 ms | 603.238 ms | Rejected |

Each row is five alternating baseline/candidate pairs with TeaVM after each
pair: 15 fresh CPU2 Node processes, 1,024 MiB old-space, 251 frames exactly once,
no warmup/replay. RGB-to-RGBA and policies are unchanged. All processes completed
and matched the saved reference; no outlier was removed. No profiling, browser,
build or tests overlapped timing. Do not pool the different candidate binaries.
Candidate runtime SHA-256, in table order:

- `46e44e7f49151e6bb8f33c3ff5140ae2cb7aa9e974d097c5705b35b4440bbbd3`
- `dbf09a85ed8a385392671ea4e7641b759b40cdf6240517f50f6a3131b82f73f1`
- `945a50d048f8fa3f7df6fa981ecb57b72d0e100c8e2c14e0821bed4f39dc95de`
- `471c023706842b4ccfeae4984429efc5255fca20c5030feef6953b6ff1e8bedb`
- `c9466cccfd5d98e7a887d96f15edf84241f237c638ae01a61033573c0ff222eb`
- `2b1aa45720e5741045daa415a54f59f180d22d2306ce16d42ef42511939f4c8b`
- `7f73db16f0ed62cdb60e940d955de78d420f15f4f4c07ad493afbae2ddbcd429`

Separate post-timer diagnostics proved the caller traces reached all six hot
triangle sites and removed exactly **1,023,742** gradient-span native entries
(**3,473,053 -> 2,449,311**). Removing calls alone did not establish a speedup.
Independent mutable host globals revoke a caller trace on callee replacement,
withdrawal or binding release. Their exact metadata reference is weak; imported
fuel is independent of the retired instance. Refreshing legacy dispatcher
companions permits old metadata/frame-owner collection. Constant propagation
requires an exact integer SSA literal at the call site; unknown/different
arguments retain the general trace. Its hot template shrank **398 -> 318 bytes**.

The first caller versions incorrectly evaluated the expensive total guard for
nonunit counts too. The count-first successor skips it, including when
publication is revoked; an intentionally trapping guard/call test verifies the
short circuit. That correction improved this layout's result but still did
not beat its matched baseline. It must not be credited as a retained gain.

Before removing the prototype, latest focused commands from `java-tools` with
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules`, passed **732 assertions**:

```bash
node test/singleIterationKernel.test.js                 # 57
node --expose-gc test/inlineSingleIterationKernel.test.js # 91
node test/wasmCompilerRetention.test.js                  # 88
node test/canonicalDirectFrames.test.js                  # 107
node test/compactCanonicalFrames.test.js                 # 119
node test/hostOwnedCanonicalFuel.test.js                 # 155
node test/nativeStaticFields.test.js                    # 34
node test/emptyCanonicalCopy.test.js                     # 81
```

The new checks cover actual omitted nonempty invocation, conditional canonical
field writes, unknown/incorrect constants, custom getters/setters, low fuel,
class readiness, forged/wrapped/overlapping array metadata, foreign-realm shared
memory, native bytecode relocation with multi-byte local indices, malformed
instruction refusal, publication lifecycle, collection after refreshing legacy
companions, and a 32-site caller that exhausts the code budget while preserving
every remaining fallback effect exactly once. The earlier callee-prefix ABI
fixture also tested public/meta entry refusal and preserving both original
16 KiB compact-entry choices; that prefix was removed after its failed timing.

Isolated debug/worker webpack builds passed with four existing warnings, and
matching AOT recording ran no Java. Source audits excluded protected decompiler
WIP (687 files for the caller experiments, six explicit overlays on `fc284ac0`).
The selected persistent player/user server and release artifacts are unchanged.
No Firefox/full-frame acceptance is claimed for these rejected binaries.

Keeping the operation in a small separate native function avoided adding its
scratch locals/body to the large caller but only tied the retained baseline.
Temporal alias analysis then protected field capabilities/readiness only when
an array store precedes a later field access. Entry guards and already-finished
reads need no store-alias protection. This passed both late-read protection and
safe final-store guard tests; the hot constant template shrank to 231 bytes.
Its five-pair 1% observation was not confirmed. Dead-trace pruning kept effects
and dependencies under the existing nonthrowing/ordinary-storage guards; it
removed dead loop updates and snapshot loads while preserving their failure
fallbacks. Decoding/relocating the remaining operand uses reduced every hot
kernel signature from 12 operands to six, and its template to 195 bytes. Actual
argument increments and faults still occurred before the call, even when the
native signature omitted their values. A synthetic native-module compilation
failure also retained the original invocation without installing imports.
The packed version still did not improve matched timing.

All kernel prototype source/tests were removed. None of these seven layouts is
retained as a speedup; the selected source remains `fc284ac0`. They do not prove
that call overhead alone explains the remaining gap. No public flag or generated
output was added. The one comparison JSON keeps bounded history; this journal
preserves the discarded experiment results after that history rolls forward.

### Exception-only spill liveness: rejected experiments

The retained local-liveness analysis merges normal and exceptional successors.
That union remains necessary for fuel exits and retry/resume handoff. A dedicated
exception spill has a narrower successor set: the operation threw, so only the
method's possible handlers can execute. Full liveness at each handler entry
still includes its normal continuation, nested handlers/finally paths and wide
locals. A new bounded matrix unions those handler live-ins at each original
throw PC. Boolean specialization captures retain their conservative contract.
If the shared storage/work budget cannot accommodate the extra matrix, the
existing full-flow proof remains the fallback. Unknown inputs still retain
full spills; no public option or application identity is involved.

Compiled checks now demonstrate that an object needed only on the normal path
collects after an access fault while the fault frame/native module remain live,
and that the handler still receives its exact object. Normal return, existing
low-fuel continuations, pre-mutation snapshots, wide BigInts and the distinct
retry/after-call import regression remain covered. Interpreter handler selection
uses method/PC/exception metadata, and monitor release uses frame monitor
ownership; neither requires the discarded normal-only locals. Focused monitor,
inlining, boolean, exception and metadata cleanup checks pass. The first five matched pairs regressed **700.999936 -> 795.000064 ms**
(TeaVM 605.449664 ms), runtime
`08b1761a23957cd37995f31e18f0a2bc327af3bcb7cb4e6de187ef679e4ce6fd`.
Shrinking exception spills crossed a 16 KiB duplication threshold and enabled
a large mesh renderer's inline entry. A second version charged the removed
operand bytes to the duplication budget, preserving all 425 method entry-policy
choices. It still failed to improve: **691.000064 -> 701.999872 ms**
(TeaVM 601.841520 ms), runtime
`984abad0bdaeef04fddf12f53c038ed1be04e210ac96b1af0b3366f2d317c030`.
All 15 processes per version completed with exact reference pixels. Both
prototypes and their added tests were removed; neither is a retained gain.

### Deferred compact ownership IDs: rejected experiment

Allocating independent ownership IDs only at terminal compact exits removed
normal inline-entry ID increments. A separate host-owned namespace preserved
legacy negative IDs, wraparound, nested exit ownership and collection of retired
modules. Focused validation passed 1,127 assertions, including low-fuel frames,
exceptions, active replacement and ownership lifetime. Five matched pairs tied:
**696.000000 -> 697.999872 ms**, TeaVM **603.508205 ms**. Runtime SHA-256:
`6b7ca9ea71b6056ceadc8f31c17bb3f0be0b84989a8bb1e3c26ce9aa3e143432`.
All 15 fresh processes completed 251 frames and matched the reference. No sample
was excluded. No runtime import calls were removed. The source/test prototype
was removed after this result; retained source remains `fc284ac0`.

A separate instrumented diagnostic counted **8,120,570 Wasm-to-JavaScript
imports** after presentation 0 through Java return (remaining 250 frames plus
final bookkeeping). Import counters were explicitly enabled on the VM before
preparation; setting an environment variable alone in the browser bundle had
not enabled them, and that earlier zero-count probe was discarded. Instrumented
timing and heap observations are excluded from acceptance. The valid census
found zero scalar return callbacks during animation, so that possible change
has no measured benefit here. The largest import totals were:

| Import | Calls |
| --- | ---: |
| `abase` | 2,121,930 |
| `alen0` | 2,121,930 |
| `alen` | 719,500 |
| `aget_r` | 671,000 |
| framebuffer static read | 651,773 |
| row-offset static read | 651,250 |
| material RGB field read | 651,000 |
| reference equality | 248,187 |

The next experiment combines a base/length pair into one import, with immediate
consumption of a module-owned linear-memory scratch word. It preserves getter
and conversion order, keeps reentrant calls from publishing partial metadata,
and falls back to the two existing imports when tracked scratch allocation is
unavailable. The isolated runtime
`44b80ad1294b22b6919a16cfa206d76a0167362cac0b96aa14f8908bd7a4e0c3`
passed 242 focused assertions (`arrayMetadataImport`:23,
`wasmParameterArrayAbi`:96, `sharedFieldArrayCaches`:32,
`primitiveArrayCopyEntry`:91). A growth fixture initially requested less than
its existing capacity; correcting its request exercised actual growth.
Five matched pairs measured **708.000000 -> 702.000128 ms** (0.85% lower),
TeaVM **603.555834 ms**, still **16.31% slower**. Two pairs regressed. All 15
fresh processes completed 251 frames and matched the reference; no run was
excluded and no profiling/tests/build overlapped timing. A separate diagnostic
including setup counted 2,221,746 combined queries, zero separate base/length
queries; its timing is excluded. This confirms execution, not a robust gain.
The prototype and added tests were removed, rather than adding complexity for
an unconfirmed sub-percent result. The 10%
execution goal and all full-game release gates remain open.

### Fixed reference-array lengths: rejected experiment

Runtime-created reference arrays now have a nonwritable length, matching Java's
fixed-length rule. Private weak membership proves this property without pinning
arrays or trusting public type/base fields. The structured compiler can reuse a
captured length for these arrays; its internal negative marker never enables raw
element access. Host arrays, proxies, worker clones and forged markers retain
the original length imports and null checks. Multidimensional reference arrays
use the same proof. No method name, application identity or public flag is used.

Focused commands from `java-tools`, with
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules`, pass 210 assertions:

```bash
node test/fixedReferenceArrayLengths.test.js # 34
node --expose-gc test/wasmParameterArrayAbi.test.js # 96
node test/sharedFieldArrayCaches.test.js # 32
node test/multianewarrayRuntime.test.js # 4
node test/arrayAssignability.test.js # 14
node test/workerBooleanSnapshot.test.js # 30
```

An initial test incorrectly read reference returns from the scalar box; it now
consumes and clears the actual native `retv` reference. Another exposed that
multidimensional allocation had its own array construction, which now fixes all
reference levels too. The isolated runtime
`8565adee7a2e781f2d354be9b23c5f0effdc5f7e76683e9c6930a12e21a752b4`
regressed in all five matched pairs: **700.000000 -> 811.000064 ms**, TeaVM
**612.356918 ms**. All 15 fresh processes completed 251 frames with matching
reference pixels; none was excluded. There was no build/test/profile overlap.
The 425 method entry selections were identical, so an entry-selection threshold
does not explain this regression. A separate diagnostic including setup confirmed that reference-array length
imports fell below the 23,869-call top-import cutoff (the previous artifact
had 723,275); instrumented timing is excluded. Avoiding those imports did not
prove a speedup. Its cause is not established. The prototype
and its new tests were removed; no fixed-length allocation change is retained.

### Bounded copy control-flow equivalence: retained native guards

The whole-copy recognizer previously required instruction-for-instruction layout
identity. A bounded graph bisimulation now allows unconditional-jump forwarding,
inverted comparisons with swapped successors and duplicated equivalent blocks.
It still matches every load, update, conditional and array effect. Missing edges,
epsilon cycles, changed element operations and proof-budget exhaustion refuse
the optimization. Inputs are bounded to 4,096 instructions, 32,769 state pairs
and 131,072 work units per template. There is no application identity.

The actual exported integer copy now proves equivalent to the existing width-8
memmove template (372 normalized instructions). Conservative fuel bounds for
nonidentical layouts charge instruction count and structured loop headers;
signed division avoids multiplication overflow in the bulk-entry guard. Low
fuel keeps the original continuation. Integer bulk copying is automatic in
this experimental bundle. Host overrides, stale captured bases/lengths, wrapped
views, wrong element kinds and shared buffers retain ordinary execution. The
strict eligibility probe invokes no custom metadata getters. Byte copies keep
their existing optional policy.

Focused commands from `java-tools`, with
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules`, pass 553 assertions:

```bash
node test/primitiveArrayCopyEntry.test.js # 178
node test/primitiveByteCopyEntry.test.js # 108
node --expose-gc test/emptyCanonicalCopy.test.js # 83
node --expose-gc test/wasmParameterArrayAbi.test.js # 96
node --expose-gc test/wasmCompilerRetention.test.js # 88
```

The copy tests mutate all 36 loads across duplicated forward/reverse tails,
compare overlapping/disjoint copies and invalid ranges, and preserve exact
negative/zero/low-fuel spill state. The default-policy check requires actual
emission without an opt-in. The isolated source audit covers 686 source files,
three explicit overlays on `fc284ac0`, excluding protected decompiler WIP.
Debug/worker webpack builds passed with four existing warnings. Runtime:
`fbb06e9d46172c5e0403f5f48a92a6e68d065146bb749589600375dbae6a9049`.
Matching AOT recording executed no Java. Five matched pairs regressed
**697.000192 -> 759.000064 ms**, TeaVM **601.558612 ms**. All 15 fresh
processes finished 251 frames and matched the saved reference; no sample was
excluded and no profiling/tests/build overlapped timing. Actual copy entries
remain 240,639, preserving the earlier empty-call omission. The new path also
adds two strict JavaScript eligibility imports per nonempty call. The plain
inline copy entry became unavailable; its heap inline entry remains present.
This first layout is rejected, not a retained improvement.

The successor uses the original compiled scalar loop's captured raw-i32 access
contract. It proves the whole Java-index range and the whole physical byte
range in Wasm. Unsigned 64-bit address calculations reject wrapping/overrun
cases, which must preserve original scalar partial stores and traps. The
memory's unshared brand is checked once during compilation. Native disjointness
also bypasses the pure reference-equality import; overlapping distinct views
still use the scalar forward-copy behavior. There is no per-copy JavaScript
eligibility import or new option. Byte-copy policy/guards are unchanged.

The successor initially passed **546 focused assertions** with the same commands above:
integer-copy 171, byte-copy 108, empty-call 83, array ABI 96, retention 88. The
integer suite now demonstrates actual nonempty bulk execution by copying data
without entering the original body's reference-equality import. It separately
compares source/target physical overruns and wrapped addresses with the scalar
method, including partial effects before traps. An initial emission error used
the array operand instead of its index in the wide range expression; native
module validation rejected it, and correcting the index made the suite pass.

Its isolated debug/worker build passed with four existing warnings, 686 audited
source files and four explicit overlays. Runtime SHA-256:
`ce467946c99f90456e7243fb4d6529ebc593f2e45dcd11c30e92f497c3d09f5c`.
Before timing, review identified another malformed-host case: the same Java
reference may yield different captured bases. Equal Java indices return without
copying; differing indices choose direction from Java indices, not physical
addresses. The alias guard now requires matching captures for overlapping
same-reference ranges, and tests Java identity when equal indices could trigger
the original early return. Two new compiled cases compare exact effects with
the original loop. Integer-copy validation now passes 173 assertions. The
`ce467946` bundle above was superseded before any performance comparison;
corrected source requires its own build and AOT pack. The corrected bundle is
`cd6907f6cc15ed6681071bf170b405075fd7059cb8ba0b6ce50c0e2aa16bbfa5`;
its matching AOT pack is 9,833,800 bytes and recording executed no Java. The
source audit again passed for 686 files/four overlays, and the isolated build
passed with four existing warnings.

Ten matched pairs of this exact corrected binary measured **700.999936 ->
693.000064 ms**, **1.14% lower** median, eight wins and two regressions. The
first five measured 726.000128 -> 693.999872 ms; the confirming five measured
697.999872 -> 692.000256 ms. The smaller confirmation gain limits the claim;
the first batch's 4.41% magnitude did not repeat. No sample was excluded. All
30 processes were fresh CPU2 Node processes with a 1,024 MiB old-space limit,
251 frames once, no warmup/replay, unchanged RGB/RGBA and preparation policies,
and no overlapping profiling/tests/build/browser. TeaVM's ten-run median was
**602.970368 ms**: the candidate is still **14.93% slower**, missing the 10%
goal by about 29.73 ms.

Final focused validation on the corrected source reran all five commands above
and passed **548 assertions** (173/108/83/96/88). Separate full-frame validation:

```bash
python3 /tmp/teavm-full-frames.py
node /tmp/teavm-intro-firefox-proof.cjs
```

All 251 RGBA frame hashes equal the retained baseline (225 distinct frames),
sequence `a275416200c6a79aa927777ada094644d46fd628a0ce7541a5ed1239ca81f8d3`.
Firefox 148.0.2 completed 251 frames, matched the saved reference and reported no
page errors. AOT replay served all 962 requests with zero misses/refusals/errors.
There were nine post-main Wasm compilations; this phase counter does not locate
them relative to the Java animation timer. The browser check is paced canvas
correctness, not a presented-FPS, Android, constrained heap or full-game gate.
No screenshot or new native reference was made. The default player/server and
published artifacts remain unchanged.

A separate post-frame-0 native-wrapper diagnostic counted all **240,187** later
integer-copy entries, exactly matching the native entry-counter delta, without
replacing method metadata or changing arguments/results. Count distribution:
149,158 length-one; 43,253 length-two; 10,639 length-three; remaining lengths
4..16. It matched the reference; its timing is excluded. This supports a future
small-copy specialization, rather than assuming typical copy sizes.

Retained generic source is committed on `java-tools` master as
`3cf454a14aaa036eecade843a3a377985fc8d02f`. This does not select or publish a runtime artifact.

The next independent experiment is the presenter's RGB staging input copy.
Current native swizzling copies the heap-backed framebuffer to a private staging
memory, converts it, then copies RGBA to the host. TeaVM already converts into
its direct output buffer before its host copy. A feature-probed multi-memory
converter could read our original heap directly and preserve that same output
handoff. Local Node supports multiple memories; unsupported engines must retain
the existing converter. The follow-up implementation and measurements are recorded below.

### Direct-heap RGB conversion: retained implementation

A weak buffer-to-Memory lookup lets the presenter recognize a genuine JVM heap
view. A feature-probed two-memory Wasm converter reads that input directly and
writes RGBA into its private output memory, retaining the existing host output
copy. It never mutates the input framebuffer or caches its byte offset across
calls. Module/instance caches use weak ownership and release retired VMs. The
same implementation generates SIMD and scalar variants. Unsupported multi-memory,
allocation failure, custom length getters and prefix/subarray behavior keep the
existing conversion path; no public flag or application identity is added.
TeaVM's renderer/converter/output handoff is unchanged.

Focused commands from `java-tools`, with
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules`, pass 256 assertions:

```bash
node --expose-gc test/raster.test.js # 179
node test/awtRasterPrefix.test.js # 18
node test/wasmHeapArrays.test.js # 59
```

Tests cover actual zero-input-copy execution, colours/alpha, tail counts,
nonzero offsets, scalar/SIMD/missing/spent backends, unchanged input, destination
sentinels, custom length evaluation counts and prefix behavior, native output
memory reuse/growth and collection of three retired guest memories while the
presenter module remains loaded. The fixed output copy is still present.

The isolated debug/worker build passed with four existing warnings. Source audit:
686 files, two explicit overlays on retained `3cf454a`; protected decompiler WIP
excluded. Runtime SHA-256:
`943b6388fa03edb44682430310044b9493542d11ce7be63058c08fca041c8b20`.
The earlier `029bf69f` build was superseded before timing after adding an
ArrayBuffer.isView guard: typed-array proxies preserve the original native
staging path and exactly one instanceof prototype probe. The final matching
AOT pack is 9,833,745 bytes; recording executed no Java.
The comparison baseline fixture now holds the verified `cd6907f6` runtime and
matching AOT, not an unverified experiment. The selected persistent player and
published artifacts remain unchanged.

Ten matched pairs of the final binary measured **699.000064 -> 684.499968 ms**,
**2.07% lower** median, with eight winning pairs, one regression and one
effectively tied pair. First five: 694.000128 -> 685.999872 ms; confirmation:
700.999936 -> 683.000064 ms. All observations remain included, including a
first-batch pair effectively tied at millisecond clock resolution. TeaVM median:
**600.503444 ms**. The candidate is still **13.99% slower**, about **23.95 ms**
above the 10% target. Each of the 30 processes was fresh, CPU2, 1,024 MiB
old-space, 251 frames once, with no warmup/replay or overlapping build, test,
profile or browser work. Pixel/output and preparation policies are unchanged;
the input staging removal is solely inside the shared runtime renderer.

Final focused validation reran all three commands above: **256 assertions**
(179/18/59). Separate validation commands:

```bash
python3 /tmp/teavm-full-frames.py
node /tmp/teavm-intro-firefox-proof.cjs
python3 /tmp/teavm-rgb-census.py
```

All 251 RGBA hashes equal the verified copy-optimized baseline, including the
same 225 distinct frames and sequence
`a275416200c6a79aa927777ada094644d46fd628a0ce7541a5ed1239ca81f8d3`.
The ordinary Firefox 148.0.2 check completed 251 frames with matching saved
canvas readback, zero page errors and all 962 AOT requests served without
misses/refusals/errors. Separate instrumented Node and Firefox runs each
confirmed **one direct-memory converter instance, used for all 251 frames**.
Their timings are excluded. The browser converter is active, not merely a
supported but unused feature. No new screenshot/native reference was made.
These remain correctness/activation checks, not presented-FPS, constrained
full-game, Android, heap-peak or long-session acceptance.

Retained generic source is committed on `java-tools` master as
`e25da1c0321e869792c65b4b332068c7c15d218a`. The default runtime artifact was not selected or published.

The remaining execution gap is about 24 ms. The prior native copy census found
149,158 length-one copies after frame 0; a specialized one-element entry could
avoid general bulk-copy range/alias work while preserving the original low-fuel,
identity, bounds and physical-fault behavior. That next step remains unmeasured.
Do not credit its potential as a gain.

### Single-element copy entry: rejected experiment

The native copy census found 149,158 length-one operations after frame 0.
A cheap length-one branch now selects a guarded raw load/store without general
interval-alias checks or `memory.copy`. Overlapping views preserve the original
single-read/single-write order. Equal Java indices with inconsistent captured
bases still retain the reference-identity/early-return rule. Whole logical and
physical bounds plus a constant conservative fuel threshold must pass; refusal
uses the original method body, and longer copies retain the bulk path. Byte
copy behavior is unchanged. Unrepresentable conservative fuel constants refuse
optimization before enabling zero-call omission. No public option is added.

Focused commands from `java-tools`, with
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules`, pass 486 assertions:

```bash
node test/primitiveArrayCopyEntry.test.js # 199
node test/primitiveByteCopyEntry.test.js # 108
node --expose-gc test/emptyCanonicalCopy.test.js # 83
node --expose-gc test/wasmParameterArrayAbi.test.js # 96
```

The additional checks cover actual one-element execution, overlapping distinct
views, negative/zero/boundary fuel with equal/distinct Java references, and
oversized fuel-proof refusal. Existing physical-overrun, wrapping and inconsistent
capture tests still pass. The isolated debug/worker build passed with four
existing warnings; source audit: 686 files, one explicit overlay on retained
`e25da1c`, excluding protected decompiler WIP. Runtime SHA-256:
`4749cfb787564c817b15b90fb8acb0de1dc5b9fcfbd7a9e80bd1b87f747ea228`.
The comparison baseline fixture is verified `943b6388` plus its matching AOT.
Five matched pairs measured **686.000128 -> 684.000000 ms**, only **0.29%**
lower, with inconsistent pair direction. TeaVM median was 605.803677 ms. All
15 fresh CPU2/1,024 MiB processes finished 251 frames and matched the saved
reference; no observation was excluded and no build/test/profile/browser
work overlapped timing. This does not confirm a gain beyond run variation.
The prototype source/tests, including its additional defensive fuel bound,
were removed. Retained source remains `e25da1c` and runtime `943b6388`.
No browser/full-frame acceptance is claimed for this rejected binary.

### Guarded nested array loops: retained implementation

Generic java-tools commit: `778f8d3af68eb3f59527ac9645f954bd335a16a2`.

The next prototype versions small, two-block counted loops nested inside an
outer loop. It requires static int-array reads, unit-step index/counter phis,
total integer arithmetic, no calls, live handlers, demotion, or inlined-callee
fuel protocol. The first cold row uses the original loop. Later rows may use
the original SSA body with repeated field/cache/bounds/fuel checks removed only
when filled-cache flags, complete logical/physical ranges, and enough fuel for
all iterations plus the final test are proven. Fuel is prepaid exactly. Stores
keep scalar order, including overlapping captures. Any refusal uses the
original loop and its exception/partial-write/continuation behavior. Duplication
is bounded to 8 KiB per method. No application names or public opt-in flags are
added. Temporary proof graphs are released after installation.

Focused commands from `java-tools`, with
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules`, pass 366 assertions:

```bash
node --expose-gc test/guardedNestedArrayLoops.test.js # 70
node --expose-gc test/wasmCompilerRetention.test.js # 88
node --expose-gc test/frameLocalSpills.test.js # 40
node --expose-gc test/hostOwnedCanonicalFuel.test.js # 160
node test/wasmDeepInline.test.js # 8
```

The fixture proves warmed execution actually skips polls, while exhausted fuel,
short/physical-overrun arrays, null/plain arrays, changing metadata getters,
overlapping views, unsupported recurrence/effects, shared metadata and code
budget refusal keep original behavior. Weak references prove the analysis is
collectible while installed code remains executable. The actual rectangle
alpha method receives one version with 372 additional body bytes. The isolated
build audits 687 files with two explicit overlays on `e25da1c`, excluding
protected decompiler WIP. Runtime SHA-256:
`dd7013198f5ea437919b6c17b769c39e7b70585ebc642cad107d3a5f3284bb7c`.
Matching AOT is 9,833,872 bytes and records without Java execution.

Fifteen alternating matched pairs, with TeaVM after each pair, measured:

| Batch | Retained RGB baseline | Guarded loops | TeaVM |
|---|---:|---:|---:|
| First five | 684.000000 ms | 663.000064 ms | 602.132204 ms |
| Confirmation five | 688.000000 ms | 660.000000 ms | 600.915409 ms |
| Additional five | 685.999872 ms | 662.000128 ms | 600.761637 ms |
| All fifteen | 685.999872 ms | 662.000128 ms | 600.915409 ms |

All fifteen candidate runs beat their paired baseline. The pooled reduction is
**3.50%**, but TeaVM deviation is **10.1653%**, so the 10% objective remains
unmet. The ten-pair interim result was only 0.18 ms inside the threshold, below
our approximately 1 ms clock resolution; the additional batch is included rather
than retaining a favorable stopping point. All 45 processes were fresh CPU2
Node processes with 1,024 MiB old-space, one 251-frame pass, no warmup/replay,
and the same RGB-to-RGBA/output work. No tests, builds, profiling or browser runs
overlapped acceptance timing, and no observations were excluded. All 425 entry
layouts remain identical, with 426 installed methods in both variants.

Exact per-process commands from the isolated Deko runner are:

```bash
taskset -c 2 node --max-old-space-size=1024 apps/intro/compare-node.mjs --worker --player BASELINE_PLAYER
taskset -c 2 node --max-old-space-size=1024 apps/intro/compare-node.mjs --worker --player CANDIDATE_PLAYER
taskset -c 2 node --max-old-space-size=1024 apps/intro/compare-node.mjs --teavm-worker --player CANDIDATE_PLAYER
```

A separate diagnostic resets import counters after frame 0 and confirms
**17,236 actual fast-loop entries** in frames 1–250. Diagnostic timings are
excluded. `python3 /tmp/teavm-full-frames.py` verifies all **251 complete RGBA
frames** exactly match across the retained baseline, candidate, and existing
TeaVM artifact, with 225 distinct frames and sequence SHA-256
`a275416200c6a79aa927777ada094644d46fd628a0ce7541a5ed1239ca81f8d3`.
No native reference or screenshots were regenerated.
`node /tmp/teavm-intro-firefox-proof.cjs` passes an uninstrumented Firefox
148.0.2 correctness smoke: 251 frames, saved tick-80 reference, no page errors,
962 AOT hits and zero misses/refusals/errors. This paced smoke is not a
presented-FPS or Android performance gate. The latest focused 70-assertion test
was rerun successfully after the final analysis shortcut. The selected default
player remains unchanged at runtime `4dd27b33`; no artifacts were published.

### Shared addresses within guarded loops: rejected experiment

The next bounded prototype adds equality guards for separately captured bases
of the same cached static-array field. Once those snapshots agree, both raw
accesses use the same base local so the native compiler can reuse their address.
All captured lengths and physical ranges are still checked. Inconsistent
snapshots retain the original loop, preserving the previous getter captures and
scalar memory order. No application-specific rules or opt-in options are added.
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/guardedNestedArrayLoops.test.js`
passes 71 assertions, including proof that inconsistent base snapshots do not
enter the optimized loop. An initial test run caught use of an optional shared
metadata map; the implementation now uses the ordinary field-cache ownership
proof and needs no shared-cache option. The isolated baseline is the verified
`dd701319` bundle plus matching AOT. The candidate audits 687 source files on
`778f8d3` plus two explicit overlays, builds with four existing warnings, and
records matching AOT (9,833,332 bytes) without Java execution. Candidate runtime
SHA-256: `a816c51664858cfa11f7870ae16775482805dbc6372ace0ba64353894e3f1f49`.
Five matched pairs measured **662.000128 -> 662.000128 ms**, with three wins,
one regression and one tie. TeaVM median was 602.490466 ms; both baseline and
candidate happened to be within 10% in this batch, so this does not demonstrate
an optimization. All 15 fresh processes completed 251 frames with the saved
reference matching; entry layouts were identical. No observations were excluded
and no other validation overlapped timing. The source/test delta was removed;
retained source remains `778f8d3` / runtime `dd701319`, whose larger 15-pair
comparison still misses the target. No additional full-frame/browser check is
claimed for the rejected binary.

### Sixteen-pixel native RGB groups: rejected experiment

The native RGB converter now unrolls its four-pixel vector loop into sixteen-
pixel groups, followed by four-pixel vector and zero-to-three-pixel scalar tails.
Memory instruction offsets address each vector within its group; source/output
ordering, alpha fill, staging and direct-heap behavior, feature probing and all
fallbacks are preserved. This targets loop/address overhead in shared
presentation, with no benchmark-host changes or new public options.
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/raster.test.js`
passes 277 assertions, including every remainder 0–15 for both staging and
actual heap input, complete output colours, unchanged input and destination
sentinels. Existing scalar/unavailable/spent-memory/custom-length/proxy/GC tests
also pass. The isolated build audits 687 files with one raster overlay on
`778f8d3`, with four existing build warnings. Runtime SHA-256:
`51df9301c4af2692a26c4b6c80a1c00f986c1fc149e0300c79d7b61c9f588aad`.
Matching AOT is 9,833,231 bytes and records without Java execution.

| Batch | Retained loop baseline | Sixteen-pixel presenter | TeaVM |
|---|---:|---:|---:|
| First five | 664.999936 ms | 661.000192 ms | 603.372149 ms |
| Confirmation five | 657.999872 ms | 660.999936 ms | 602.846369 ms |
| All ten | 660.000000 ms | 661.000064 ms | 603.109259 ms |

The confirmation reverses the first batch's small apparent gain. Overall there
are four wins and six regressions; the candidate median is 0.15% slower. All 30
fresh CPU2/1,024 MiB processes finish the same 251 frames and match the saved
reference, with unchanged hosts/policies and no validation overlap. No samples
are excluded, including TeaVM's 624.64/640.17 ms observations. A favorable
candidate/TeaVM ratio in this batch is not evidence that the candidate improved
the retained runtime; the concurrent baseline is faster. The source/test delta
is removed. The original command
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/raster.test.js`
passes all 179 assertions after restoration. No full-frame/Firefox acceptance
is claimed for this rejected binary. Retained source is `778f8d3`, runtime
`dd701319`, with its 15-pair comparison still 10.1653% behind TeaVM. The goal
remains active rather than claiming a robust margin from noisy observations.

### Conditional counted-loop proof: retained implementation

Generic java-tools commit: `d5ec5ad76a07b47724a82cbdab92a24ef7587393`.

Before this change, a separate compilation-only inspection of the exported
alpha-blit method (`Sprite.blitColorKeyAlpha`) reached native-ready state but
emitted zero guarded versions. Its nested header uses `iflt`, with one entry and two backedges.
Both backedges advance the counter and destination index by one; a source-index
increment dominates both paths. The body has only parameter-array int loads/
stores, total integer arithmetic, and one conditional zero-pixel path. There
are no intraloop calls, allocations, or reference writes. Array metadata is
already captured by the ordinary parameter-entry protocol. The original SSA
and structured tree make all of this explicit; no CPU profiling was repeated.

The retained proof rejected that combination of inverted condition, three
header predecessors, internal branch and parameter arrays. The new implementation
accepts negative-counter `ifge`/`iflt` headers with a bounded acyclic body: at
most 16 blocks and 256 instructions, pure integer branches, no extra entry,
early exit or internal cycle, and a unit counter/index recurrence on every
backedge. A topological check proves all body paths reach the header. The
original SSA branches and edge copies are cloned, with complete logical and
physical ranges plus exact prepaid fuel as before. Already-captured parameter
metadata needs no extra host callback or filled-flag query. Static arrays keep
their existing warm-cache proof. Unsafe ranges, partial faults, low fuel,
nonunit paths and unsupported effects retain original execution. There are no
application names or new public flags. The existing 8 KiB duplication budget
and analysis cleanup remain in force.

Focused commands from `java-tools`, with
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules`, pass 543 assertions:

```bash
node --expose-gc test/guardedNestedArrayLoops.test.js # 159
node --expose-gc test/hostOwnedCanonicalFuel.test.js # 160
node --expose-gc test/wasmParameterArrayAbi.test.js # 96
node --expose-gc test/wasmCompilerRetention.test.js # 88
node --expose-gc test/frameLocalSpills.test.js # 40
```

The new fixture proves actual fast-loop activation for every row and zero
repeated inner polls, both branch directions, exact fuel/partial-write states,
source/destination logical and physical faults, unused/used nulls, plain arrays,
overlapping views, inconsistent getter snapshots, and collection of installed
parameter proof graphs. Unsupported backedge counter/index deltas, an early
exit, internal cycle and field effects emit no version. Initial test harness
failures came from supplying internal ABI metadata to the public wrapper and
expecting status 0 instead of the normal -1 completion; both assertions are
corrected. The actual exported alpha-blit method compiles with one guarded
version instead of zero.

The isolated build audits 687 files with one explicit helper overlay on
`778f8d3`, excluding protected decompiler WIP; four existing webpack warnings.
Runtime SHA-256:
`23b00b90f2b171025d18f1cdc675650970ea04e883d64289042e55f1be03d889`.
Matching AOT is 9,833,756 bytes and records without Java execution. The first
five matched pairs against verified `dd701319` plus its matching AOT measure
**664.999936 -> 660.000000 ms**, TeaVM **603.110023 ms**. There are four wins
and one regression; the possible 0.75% gain requires confirmation. A separate
instrumented run resets counters after frame 0 and observes 7,847 alpha-blit,
2,660 intensity-additive, and 770 additive guarded rows, plus the existing
17,236 rectangle rows. These 11,277 new entries are actual animation execution,
not merely preparation metadata; their diagnostic timing is excluded.
The same native entry choices remain available. Specialized bodies grow for
nine eligible methods, with unchanged entry choices elsewhere.

| Batch | Retained loop baseline | Conditional loops | TeaVM | Deviation |
|---|---:|---:|---:|---:|
| First five | 664.999936 ms | 660.000000 ms | 603.110023 ms | 9.4328% |
| Confirmation five | 664.999936 ms | 660.000000 ms | 602.257550 ms | 9.5877% |
| All ten | 664.999936 ms | 660.000000 ms | 602.622404 ms | 9.5213% |

Both independent batches improve the paired baseline and satisfy the selected
**at most 10% deviation in animation execution time**. The pooled incremental
gain is **0.7519%**, with seven paired wins and three regressions; every sample
is retained, including the 770.00 ms first baseline and 689.00 ms last candidate.
All 30 processes were fresh CPU2 Node processes with 1,024 MiB old-space, ticks
0–250 exactly once, no warmup/replay, and unchanged RGB conversion/output and
host/compiler policies. No build/test/profile/browser overlapped acceptance
timing. Source, integration, assets, TeaVM artifact and runtime identities are
recorded in the one comparison JSON. This demonstrates the selected Node
animation target; it does not establish a worst-run bound or full-game FPS.

`python3 /tmp/teavm-full-frames.py` independently verifies all **251 complete
RGBA frames** exactly match across the retained baseline, candidate and existing
TeaVM artifact, with 225 distinct frames and unchanged sequence SHA-256
`a275416200c6a79aa927777ada094644d46fd628a0ce7541a5ed1239ca81f8d3`.
`node /tmp/teavm-intro-firefox-proof.cjs` passes the uninstrumented Firefox
148.0.2 correctness smoke: 251 frames, saved tick-80 reference, no page errors,
962 AOT hits and zero misses/refusals/errors. Diagnostic/browser timings are
excluded from acceptance; no native rerun or screenshot is generated.

Generic proofs recover some of the advantage TeaVM gets from compiling known
Java types and control flow directly: these loops need no repeated array/fuel
checks once the complete range and exact trip count are established. Their
fallbacks and frame protocol remain available. This is an improvement within
the existing architecture and requires no game-specific kernel or new flag.
The selected persistent player remains runtime `4dd27b33`; nothing is published.
The original full-game 512 MiB, startup, presented-FPS, stability, 6x-browser and
actual-phone release gates remain unverified by this standalone benchmark.

### Receiver upper bounds: compiler capability, no intro timing gain

The structured Wasm inliner now feeds bytecode-proven receiver bounds into
virtual/interface target selection. A stable `this` is bounded by its declaring
class; an explicit successful `checkcast` establishes a nullable upper bound.
Selection and class-epoch dependencies use that narrower cone, including inside
inlined bodies. Unrelated sibling implementations no longer exhaust the inline
limit or force invalidation. Casts still execute; null guards, original-PC
fallback, ambiguous-flow rejection, and invalidation for late overrides remain.
This is generic compiler logic in java-tools, with no new application flag or
assumption that preparation has discovered every possible allocation.

Focused validation commands, from java-tools, each with
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules`:

```bash
node test/wasmInstanceInline.test.js         # 100 assertions
node test/wasmInlineBudget.test.js           # 67 assertions
node test/wasmDeepInline.test.js             # 8 assertions
node test/wasmInlineInitialization.test.js   # 50 assertions
node test/classHierarchy.test.js            # 16 assertions
```

All **241 assertions pass**. The new fixture proves that a declared superclass
with five implementations can specialize through a narrower receiver, including
ordinary Java interface dispatch after a cast. It checks nested calls, wide
arguments, ambiguous joins, casts belonging to arguments, null/CCE behavior,
unrelated sibling loads, and newly loaded overrides. Before the change, the
initial regression fixture failed 12 assertions because those sites did not
specialize. Existing initialization, budget and receiver-proof tests still pass.

`python3 /tmp/teavm-array-build.py` built an isolated debug/worker bundle from
`d5ec5ad76a07b47724a82cbdab92a24ef7587393` with only `src/jit/wasmInline.js`
overlaid, auditing 687 files and excluding protected decompiler WIP. Webpack
finished with its four existing warnings. Source-file SHA-256 is
`24c27a9ee2de575fa41107add61a3623102d358998c6b9027d34e144901179a3`;
runtime SHA-256 is
`70f2e0a8a516b4c31935cc30223c1930f7f0165b8c29fe7a27643bfa05f86776`.
`node apps/intro/build-aot.mjs --player /tmp/teavm-parity-ORXsjp/player --runtime /tmp/teavm-parity-ORXsjp/player/runtime`
recorded a matching 9,833,871-byte pack without executing Java.

`python3 /tmp/teavm-parity-paired.py` compared five alternating pairs against
the preceding `23b00b90` runtime and matching AOT, with TeaVM after each pair.
All 15 fresh processes used CPU2, a 1,024 MiB old-space limit, ticks 0–250 once,
unchanged host/output policies, and no profiling, build or test overlap.

| Measure | Previous runtime | Receiver bounds | TeaVM |
|---|---:|---:|---:|
| Median animation | 654.000128 ms | 654.000128 ms | 602.380502 ms |
| Range | 652.999936–675.000064 ms | 651.000064–992.999936 ms | 600.385548–606.272112 ms |

There are two paired wins, two regressions and one tie; the 993 ms candidate
outlier is retained. **No intro speedup is established.** Both runtime medians
are 8.5693% above TeaVM in this batch; that differs from the historical batch
and is not an improvement attributable to this change. Comparing every decoded
prepared payload, preserving compiler variants and removing only runtime
identity, finds **all 962 entries identical** with no additions. This compares
prepared JavaScript payloads; it does not by itself establish native Wasm body
identity. The paired timing establishes no execution gain for this pass.

`python3 /tmp/teavm-full-frames.py` independently verifies all 251 complete RGBA
frames match the preceding runtime and TeaVM, with 225 distinct frames and
unchanged sequence SHA-256
`a275416200c6a79aa927777ada094644d46fd628a0ce7541a5ed1239ca81f8d3`.
Those diagnostic times are excluded. Results update the existing single
`intro-comparison.json`; no screenshot, native reference rerun, extra report,
default artifact selection or publication is performed. Firefox was not
repeated for this pass. Full-game memory, startup, presented-FPS, stability and
phone gates remain unverified.

### Shared SSA reference facts: implemented, no reliable intro gain established

java-tools now exposes one lazy `fn.referenceFacts` object per shared SSA graph.
`get(value)` supplies nullable/non-null/null knowledge, reference upper bounds,
and exact allocation types where proven. `at(value, node)` adds knowledge valid
before that instruction; a block id queries its terminator. Parameters, casts,
copies, reference phis, allocations, field descriptors, method-return
descriptors and reference-array elements participate. Nullable fields and
method results stay nullable. This remains intraprocedural: it does not infer
callee return summaries, global points-to sets, escape or alias summaries.

The inliner consumes these facts when its existing cheap receiver trace cannot
follow a reference through locals or joins. Its additional SSA analysis is
bounded to 2,048 code items, retaining existing selection/fallback beyond that.
The structured Wasm emitter consumes the same API for redundant null branches
and known-null casts/instanceof, including nulls established by preceding
branches or phi joins. Arbitrary casts retain their existing admission policy;
this does not introduce a general-cast opt-in. An entry cast can therefore
still require fallback even when SSA separately proves a later call's target.
The JavaScript renderer has not been converted to consume these facts.

Normal-edge facts are intersected at joins. Successful dereferences prove only
later uses; handler locals start opaque. A loop re-entry kills facts about its
fresh definitions before merging incoming phi facts, preventing a previous
iteration's non-null load from proving a new load safe. The analysis reuses SSA
def-use links, delays edge state until needed, retains existing literal-null
shortcuts, and compresses cast-identity paths. Value/path work and sparse-state
budgets conservatively fall back to unknown, with the state budget checked
during individual switch edges. These are compiler-work bounds, not a wall-time
or presented-FPS guarantee. Graphs and caches remain temporary and are released
with compiler diagnostics; no proof counters or graphs are added to hot
execution metadata or prepared transport. No application data or new JVM flag
is involved.

Focused checks total **706 passing assertions**. Commands below ran from
java-tools, each prefixed with
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules`:

```bash
node test/ssaReferenceFacts.test.js          # 70
node test/wasmSsaReferenceFacts.test.js       # 26
node test/ssa.test.js                       # 59
node test/wasmInstanceInline.test.js         # 118
node test/structuredNullCast.test.js         # 26
node test/wasmInlineBudget.test.js           # 67
node test/wasmDeepInline.test.js             # 8
node test/wasmInlineInitialization.test.js   # 50
node test/wasmCompilerRetention.test.js      # 88
node test/hostOwnedCanonicalFuel.test.js     # 155
node test/frameLocalSpills.test.js           # 39
```

Tests cover receiver types across aliases/joins/parameters, wide parameter
slots, nullable call returns and fields, identity, side-effect ordering,
original NPE/CCE behavior, opaque handlers, entry-loop seeds, fresh loads on
backedges, budget fallback, wide switches, cleanup, and late subclasses. A
1,024-cast chain needs 9,225 node-op reads in its regression test, avoiding
quadratic rescanning. A direct emitter test verifies that an unknown condition
retains its reference load/test while a dominated non-null condition emits a
constant, without adding diagnostic fields to runtime metadata.

`python3 /tmp/teavm-array-build.py` audits 688 source files from `d5ec5ad` plus
four explicit overlays: `ssa.js`, `referenceFacts.js`, `wasmInline.js`, and
`StructuredWasmCompiler.js`. Protected decompiler WIP is excluded. The final
bundle builds with the four existing webpack warnings. Runtime SHA-256:
`c5ac25edb37ede64a8d9e28988a55b379918146814ce311502acd4f5aba851fe`.
Reference-facts source SHA-256:
`a759d5f2c66c10b53a0a3064965fb97ed44ca8ca938c9f617ad7cea475122521`.
`node apps/intro/build-aot.mjs --player /tmp/teavm-parity-ORXsjp/player --runtime /tmp/teavm-parity-ORXsjp/player/runtime`
records the matching 9,832,396-byte pack without executing Java.

Five matched pairs per variant, always against `70f2e0a8` plus its matching
pack, produced the following animation medians (milliseconds):

| Variant | Previous runtime | Candidate |
|---|---:|---:|
| Initial shared analysis, `08cf5c5b` | 652 | 664 |
| Less eager allocation, `6ae65f26` | 652 | 691 |
| Proof counters removed from execution metadata, `1f95ac2a` | 656 | 655 |
| Memoized cast identities, `5f370ffb` | 679 | 697 |
| Final switch-budget guard, `c5ac25ed` | 665 | 660 |

The earlier slower variants are recorded, not selected or pooled with the
final binary. Removing the experimental execution-metadata counter coincided
with a near-baseline batch; subsequent variation prevents attributing a
reliable speedup to this work. The final batch's incremental reduction is only
0.7519%; TeaVM's median is 605.671164 ms, putting the candidate 8.9700% above it.
Every sample, including outliers, is retained. Each batch used 15 fresh
CPU2-pinned processes with 1,024 MiB old-space, ticks 0–250 once, unchanged
host/output/compiler policies, no warmup/replay, and no overlapping build,
test, profiling or browser work. This validates capability rather than a new
performance win; it does not replace the earlier retained-runtime evidence.

The one existing comparison JSON holds source identities, trials and separate
correctness diagnostics. Prepared JavaScript payload equality alone does not
establish native Wasm identity; the final diagnostic separately compares all
WebAssembly module compilations, including specializations. Selected persistent
artifacts remain unchanged. Full-game memory, startup, presented-FPS, stability,
6x-browser and phone acceptance remain unverified by this standalone exercise.

Final correctness commands:

```bash
python3 /tmp/teavm-full-frames.py
python3 /tmp/teavm-ssa-facts-proof.py
node /tmp/teavm-intro-firefox-proof.cjs
```

The full-frame check passes all **251 complete RGBA frames**, with 225 distinct
frames and unchanged sequence SHA-256
`a275416200c6a79aa927777ada094644d46fd628a0ce7541a5ed1239ca81f8d3`.
The separate native-code diagnostic captures every WebAssembly module
compilation: **all 1,274 module byte sequences match** the preceding runtime,
including specializations. All 962 prepared JavaScript payloads also match
after removing runtime identity. Thus this intro does not receive additional
executable-code optimization from the shared facts, despite the focused
fixtures demonstrating new capabilities. The Firefox 148.0.2 correctness smoke
passes 251 frames, the saved tick-80 hash, zero page errors, and 962 AOT hits
with zero misses/refusals/errors. All diagnostic and paced-browser timings are
excluded from the matched execution measurements. No screenshot or native
reference rerun is generated.

### TeaVM parity attempt: seven rejected runtime prototypes

This pass first tried seven generic compiler/runtime variants against the same
`c5ac25ed` VM and matching baseline pack. Each row is five alternating matched
pairs, with TeaVM after each pair: 15 fresh processes per binary, CPU2 affinity,
1,024 MiB old-space, ticks 0–250 once, no Java warmup or animation replay. Every
trial completed 251 frames and matched the saved tick-80 RGB hash. All 105
observations are retained in the existing single comparison JSON; the history
labels these prototypes as rejected. No extra report files are produced.

| Runtime prefix | Prototype | Baseline ms | Candidate ms | TeaVM ms |
|---|---|---:|---:|---:|
| 66f0382a | Explicit repeated bounds checks | 664 | 727 | 605.326 |
| ae8843e5 | Non-returning error path | 655 | 682 | 603.237 |
| d16b1504 | Guarded countdown loops | 665 | 666 | 600.636 |
| 334d6f18 | Initial SIMD | 675 | 662 | 605.136 |
| f2a8a137 | Corrected and hoisted SIMD | 666 | 681 | 602.559 |
| 2d961f46 | SSA use-aware SIMD | 667 | 679 | 608.131 |
| 6eb22356 | Nested-only SIMD | 684 | 702 | 606.869 |

The repeated-check proof reused successful primitive accesses only inside one
basic block. Tests covered independent arrays/indices, nulls, bounds failures,
loop re-entry, partial stores, fuel continuations and proof cleanup. It passed
383 focused assertions but regressed. Marking the bounds-error import
non-returning passed the 59 heap-array assertions and also regressed. Neither
change remains.

The loop prototypes extended the existing proof to predecrement countdowns,
root parameter loops, inlined arithmetic and reporter ranges, with complete
logical/physical range and exact `n+1` fuel guards. SIMD processed four independent
integer iterations, guarded physical aliasing, retained scalar tails and refused
shared memory and reductions. Later variants used SSA def-use counts and outside
frame liveness to reduce vector temporaries, and restricted SIMD to nested loops.
An oversized vector version fell back to the existing scalar proof within its
8 KiB code budget. These capabilities passed focused tests but did not establish
a safe, repeatable improvement for this intro, so they were removed.

Review found two issues in the experimental SIMD work. A diagnostic callback
initially retained its lexical proof graph; moving it outside the emitter scope
made the collection regression pass. More significantly, copying a loop header
once per four iterations did not preserve values copied from previous iterations.
The initial `334d6f18` binary matched all 251 intro frames but failed added generic
history tests; it is not safe to retain. Later variants reconstructed four exact
phi-copy iterations, including reference histories and swaps. The final rejected
variant passed 701 focused assertions. An intermediate `01668a92` build was not
benchmarked and is not counted in the table. All experimental source and test
changes were removed; the original 159-assertion guarded-loop suite passes again.

The four retained runtime source overlays match their pre-pass hashes exactly.
The isolated rebuild again audits 688 files, excludes the unrelated decompiler
work, and produces runtime SHA-256
`c5ac25edb37ede64a8d9e28988a55b379918146814ce311502acd4f5aba851fe`
with the four existing webpack warnings. No SIMD or repeated-bounds prototype is
selected or shipped.

### Intro dependency preparation: faster animation, parity still open

A diagnostic at the actual Java `System.nanoTime()` calls found a preparation
gap. Counting everything after `main()` had mixed constructor/setup compilation
with animation compilation. On the unchanged `c5ac25ed` baseline, the animation
window itself contained four nested synchronous Wasm compiles:

- `DelegatingCanvas.sineQ16(BI)I`
- `IntrusiveNodeHashTable.cosineQ16(II)I`
- `ArchiveIndex.buildLogoRotationTransform(IBI)[I`
- `Geoblox.prepareLogoMeshRotation(BI)V`

Their combined outermost diagnostic wall time was **24.654 ms**; nested inclusive
times must not be added together. An earlier 52.8 ms observation used the rejected
heavier compiler, not this retained baseline.

`apps/intro/manifest.mjs` now supplies these dependencies and their preparation
order through the VM's existing generic `wasmCalleeMethods`/`priorityMethods`
policy. `apps/intro/runtime.mjs` preserves that supplied policy. The profile
applies only to class-manifest SHA-256
`d1e394b07ecc5cabd0f5a4aa0801bfa3345db13811a5104e0fa85f0720740b98`,
which covers the original classes and standalone patch. Unknown identities use
the entry-method-only policy. The VM receives no application-specific rules or
new flags. Java class files and the 251-frame animation are unchanged.

A separate diagnostic confirms that all four owners remain uninitialized after
preparation. Ordinary Java setup initializes them before the animation timer.
With the profile, the native method count is already 426 at that timer and remains
426 at completion; synchronous post-main compilation stays at five, all from
Java setup. **VM compilation inside the animation drops from four operations to
zero.** One 255-byte native presenter module still compiles at presentation 0,
measuring 0.064 ms in that diagnostic. These diagnostic times are excluded from
the performance comparison. Required compiler work now runs before Java entry;
Java setup and every animation frame still execute once.

Ten alternating matched pairs plus TeaVM produced 30 fresh-process observations:

| Animation median | Old preparation | Profiled preparation | TeaVM |
|---|---:|---:|---:|
| First five pairs | 671 ms | 635 ms | 608.620 ms |
| Independent confirmation | 711 ms | 642 ms | 607.300 ms |
| All ten pairs | 685 ms | 639 ms | 607.960 ms |

The pooled reduction is **6.7%**, with nine paired wins and one regression.
Every sample, including slow outliers, is kept. The remaining measured deviation
from TeaVM is **5.1%**; parity is still open. Both variants use the **same VM
binary**, fixed Java classes and assets, CPU2 and the 1,024 MiB limit. The
changed variables are Deko's preparation policy and matching pack. The first
baseline process briefly overlapped a cold-static correctness check during
untimed preparation; its animation did not overlap the check. The independent
confirmation processes had no build, test or profiling overlap throughout.

This comparison keeps the preceding benchmark's
`prepareWasmPreparedUpgradesOnly:false` setting on both sides. The normal intro
still defaults to true; a focused test verifies that explicit helper selection
works with that filter enabled. This is a standalone execution comparison,
not full normal-loading-path acceptance.

Both packs have runtime identity `c5ac25ed…` and 962 prepared entries. Baseline:
9,832,396 bytes, SHA-256
`c0089d4c3cf3b6691e66a1e714d1a3f7d01e694f9f7a80cff6fa55eacfeca03c`.
Profiled pack: 9,832,174 bytes, SHA-256
`3faeb12d5f6ea7c26f698a5a23e32bf8c99a61e150a0ad39bf5b07852ff593de`.
The integration digests are respectively `2bb785a9…` and `18933dc9…`;
configuration identities are `c20276743828fbe5` and `7b120e15d54643fb`.
The comparison driver uses the matching old/new `runtime.mjs` and `manifest.mjs`
for each pack. Baseline host source is Deko commit `a5641071`; the new source
is the working profile change. Only the manifest's pre-existing benchmark
filter override is applied to both private hosts. Runtime source is JVM
`d5ec5ad` plus the four previously recorded SSA/receiver overlays.

Focused commands, from the indicated repository:

```bash
# dekobloko-work: 2 tests pass
node --test tests/intro-preparation.test.mjs

# java-tools: 20 + 46 assertions pass
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/preparationWasmHelpers.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/coldPreparedWasmStatics.test.js

# java-tools: 159 assertions pass after removing the prototypes
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc test/guardedNestedArrayLoops.test.js
```

The helper tests include explicit selections with both ordinary and upgrades-only
preparation. The manifest test checks identity mismatch fallback, profile isolation
and configuration merging. Four old cold-static assertions expected an exit at
a later join even though the retained structured compiler hoists the readiness
check before pure selection. The test now accepts a valid entry retry with live
arguments or a later exit with the selected operand, and still verifies no early
initialization, resumability and the exact final field value. No runtime guard
was weakened to make the test pass.

Build and measurement commands used the existing isolated workspace:

```bash
python3 /tmp/teavm-array-build.py
node apps/intro/build-aot.mjs --player /tmp/teavm-parity-ORXsjp/player --runtime /tmp/teavm-parity-ORXsjp/player/runtime
python3 /tmp/teavm-parity-paired.py
python3 /tmp/teavm-parity-confirm.py
python3 /tmp/teavm-full-frames.py
node /tmp/teavm-intro-firefox-proof.cjs
```

Recording the pack executes no Java. For manual repetition, run
`apps/intro/compare-node.mjs --worker --player DIR` in a fresh
`taskset -c 2 node --max-old-space-size=1024` process for each matching host/pack,
then `--teavm-worker` after the pair; alternate pair order and retain every
observation. The comparison JSON records both host digests, pack identities,
source hashes, all 30 observations and the seven rejected trials above.

The full-frame check passes **all 251 complete RGBA frames** across old
preparation, profiled preparation and TeaVM, with 225 distinct frames and sequence
SHA-256 `a275416200c6a79aa927777ada094644d46fd628a0ce7541a5ed1239ca81f8d3`.
Firefox **148.0.2** completes 251 frames with the saved tick-80 RGB hash, zero page
errors, and **962 AOT hits with no misses, refusals or errors**. Its paced
correctness timing is excluded. No screenshots or native reference reruns are
created. The selected persistent runtime and pack remain unchanged.

Further parity work must address the remaining measured execution gap. The
rejected SIMD and bounds variants are not a retained improvement. Full-game
memory, startup, rolling presented-FPS, stability, 6x-browser and phone targets
remain unverified by this standalone pass.

### Shared intro and applet preparation dependencies

The four rotation dependencies from the intro pass now live once in
`apps/launcher/browser-loader/preparation-profile.mjs`. The standalone manifest
and the normal GeoBlox applet launcher consume that same policy. The intro keeps
its browser-main entry point; no standalone entry point is added to applet
preparation. Existing host budgets, root filters and additional priorities/callees
are preserved, with shared dependencies placed first and duplicates removed.

The applet selection requires funorb-decompiled commit
`b168d7edeb104599156b5f908df62dfdc9f3b250` and source patch ABI
`catalog-account-server-v11-voice-cursor`. That source commit matches the current
remote master, and all four method signatures exist in its readable Java export.
The intro retains its existing class-manifest identity, which includes its patch.
Unknown revisions and other games retain ordinary or explicitly supplied policies.
No new flag, profile JSON, source patch or JVM game data is introduced. The shared
module is already in the cloner's ordered loader manifest; no cloner transport
change is required. Its bytes now participate in the intro integration digest,
so existing intro AOT packs must be regenerated when using the updated host.

Validation:

```bash
node --test tests/intro-preparation.test.mjs scripts/test-browser-loader.mjs
git diff --check
```

All **9 tests pass**, covering shared helper selection, independent entry points,
source/patch/game isolation, fresh arrays, supplied-policy merging, budgets and
both synchronous and asynchronous reset/reinstallation. A separate direct call
to the actual cloner's `loadClonedModuleBundle` imports all nine Deko modules from
this checkout and verifies that the configured applet VM receives the same four
helpers, with one preparation call and no standalone entry point. These are
configuration and integration checks, not a full-game execution benchmark.

Compiler optimizations themselves remain generic and are not selected by these
profiles. The cloner still consumes java-tools' committed `browser-runtime/`
artifact; its receipt currently identifies source `00d399b8…`, and its bundle
does not yet contain `wasmCalleeMethods`. No runtime artifact was replaced by
this consolidation. A rebuilt, validated bundle is still required before the
normal GitHub-loading path can use the full helper preparation behavior or
the newly committed SSA compiler work. Full-game performance and original
memory/startup/presented-FPS/phone acceptance remain unverified.

### Build the cloned JVM source in the browser

The cloner's default runtime path now builds the selected java-tools source
revision instead of reading committed `browser-runtime/` output. The new source
configuration `java-tools/config/browser-build.json` supplies both entry points,
browser aliases, Node polyfills and disabled Node modules. Webpack consumes the
same configuration for the standalone JVM site. The browser uses the pinned
esbuild-wasm 0.28.0 [browser API](https://esbuild.github.io/api/#browser) with a
virtual filesystem plugin; it generates the JRE index from sorted source paths
in memory and preserves the existing guarded utilium buffer-growth integration.

The build worker downloads only requested dependencies, resolves nested locked
packages, browser maps and conditional/wildcard exports, and checks npm tarball
integrity against the cloned lockfile before extraction. It accepts registry npm
tarballs, rejects archive traversal/corruption, bounds simultaneous package loads
to four, and limits compressed/decompressed package sizes to 16/64 MiB. Verified
tarballs use optional CacheStorage. Cache corruption triggers a fresh verified
download; cache quota errors do not stop the build. The disposable worker shuts
down after either completion or error, releasing its analysis and Wasm compiler.

One persistent runtime cache replaces older revisions. Its identity includes
the Git source commit, lockfile text, source build configuration, build options
and hashes of the pinned bundler and its integration source. Both output hashes
are checked on reuse. A hit avoids reading the source graph or starting a build
worker; a failed build cannot replace the last good runtime cache. The main JVM
and JIT worker are always generated together. Local A/B bundle overrides remain
explicit development paths. Generated build tools are staged under ignored
`public/jvm-bundler/`; no new generated JavaScript or Wasm is committed.
The compiler switches to the `javac-source-v1` class-cache ABI and drops the
obsolete bundle-era cache migration. Older compiled classes are rebuilt once
instead of assuming compatibility with the older bundled compiler. Subsequent
runtime-only commits continue to reuse the source-built class cache.

The source build uncovered an existing `const call` assignment in the decompiler's
MethodHandle rendering, rejected by esbuild. The declaration is now `let`, with
three focused int/long/reference-return regression assertions. Unrelated
decompiler lifetime-recovery edits remain excluded. The broader existing
`cfrAdditionalFeatures.test.js` suite has three baseline failures (boolean guard
formatting, Object-array refinement and wrapped buffer branching), reproduced
with clean HEAD decompiler modules: 74/77 pass. They were not changed to accept
the bundling migration.

Focused commands and results:

```bash
# blank-github-cloner: 8 tests pass
npm run test:jvm-source

# java-tools: 3 assertions pass
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node test/cfrMethodHandleReturn.test.js

# blank-github-cloner: each browser source-build integration passes
node scripts/test-jvm-source-browser.mjs
BROWSER=firefox node scripts/test-jvm-source-browser.mjs

# Production build and the relevant generated-HTML check pass
npm run build
node --test --test-name-pattern='production catalog' tests/rendered-html.test.mjs
```

The browser script builds the exact Java Git-index snapshot, excluding unrelated
unstaged edits. It exercises the actual cloner `publishClonedJvmAssets` function,
including persisted-cache writes and reuse, compiles a Java class in the real
cloner compilation worker, runs it to obtain the expected result 45, and requests
and installs a transported JIT body. Chromium 147 installed one body and Firefox
148 installed two, with no refusals, failed requests or page errors. Neither
test reads a committed JVM bundle. The generated JVM/JIT-worker outputs are
5,608,068 and 3,856,259 characters in both browsers. Observed cold/warm smoke
durations were approximately 10.9s/177ms in Chromium and 44.7s/153ms in Firefox.
These are unthrottled, unisolated integration observations, not performance
comparisons or evidence of the full-game startup, memory or frame targets.

The cloner CI now runs the same path in Chromium and Firefox. java-tools CI also
exercises this source consumer when its sources change. The production build
stages the bundler automatically, and the built deployment contains its worker,
Wasm and source loader. Lint on the new bundling implementation and test files
passes. The current changes remove the eight legacy tracked browser-runtime
artifacts and ignore that output directory; generated files remain in builds
or browser storage.

Rollout is not atomic across the repositories and deployment: publish the source
configuration first, deploy the cloner source-loading change, then publish the
legacy artifact removal. An older deployed cloner still requires the old files.
This turn validates and prepares the migration locally; it does not publish a
new deployment or establish the original full-game/phone acceptance gates.

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

### GeoBlox loading: TeaVM versus JVM.js (2026-10-21)

`apps/loading/` compares the original four-track music preparation, initial
sound effects, and the available shared-UI, game-graphics and font archive
files. Both VMs receive identical `javac --release 8` class files and asset
bytes. This isolates loading work; it excludes Git/network transfers, source
compilation, loading-screen drawing, audio-device playback and menu transitions.
It is **not** a complete navigation-to-usable-menu or FPS acceptance test. The
live cloner's Java frontend emits different bytecode, so its exact elapsed
times can differ from this controlled VM comparison.

Each observation uses a fresh browser process and one loading pass, without
warmup or replay. Checksums run after the timed decoding phases. Six observations
must match the HotSpot reference: 18 initial effect samples, 218,292 PCM bytes,
PCM CRC32 `2368412830`, 205 archive files, 7,597,510 decoded bytes and archive
CRC32 `3045679678`. Music preparation also populates the game's instrument
sample cache; the PCM checksum covers the initial effects, not every instrument.

Baseline: three alternating pairs in headless Firefox 148.0, pinned with
`taskset -c 2`, without CPU slowdown, using JVM source `5403010` and
TeaVM 0.16.0 Wasm GC:

| Phase, median | TeaVM | JVM.js | JVM.js / TeaVM |
| --- | ---: | ---: | ---: |
| Initial music and effects | 1.246 s | 15.062 s | 12.09x |
| UI, graphics and font archive decoding | 0.522 s | 4.102 s | 7.86x |
| Combined loading work | 1.768 s | 18.769 s | 10.62x |

Combined time is the median of each run's sum, rather than the sum of separate
medians. JVM.js preparation is reported separately (median 78.757 s). Despite
preparing 2,558 methods, every run records 211 synchronous compilations after
Java entry, with median outermost compilation time 9.647 s. That census includes
validation and printing outside the phase timers, so do not subtract its total
from a phase or claim an exact fraction of decoding time. The initial
entry-scoped harness was rejected for this comparison because its preparation
policy differed from the app's full preparation; its observations are retained
under `preparationDiagnostic` in the same report.

Reproduction from this repository, with the adjacent cloner and java-tools
checkouts and their installed dependencies:

```bash
node apps/loading/build-runtime.mjs --output /tmp/geoblox-loading-runtime
node apps/loading/build.mjs --runtime /tmp/geoblox-loading-runtime
taskset -c 2 node apps/loading/compare.mjs --browser firefox --pairs 3
```

The current comparison requires AOT preparation and rejects any attempted
guest-time compilation, including attempts whose assertion was caught by a
fallback. The historical `5403010` baseline therefore fails this stricter check;
build the current JVM source for a compilation-free comparison.

The default player directory is `~/.cache/dekobloko/geoblox-loading/`. Build
commands refuse to overwrite existing outputs; reuse the retained player for
comparisons or explicitly remove only these generated benchmark caches before
rebuilding. Relocated checkouts can use `--cloner`, `--java-tools`, `--sources`,
`--assets`, `--output` and `--player` paths. The sole `benchmark.json` stores
class/asset/bundle SHA-256 hashes, VM options, raw observations and the summary,
and is updated in place. Generated class files, bundles and Wasm stay in cache.
Rebuilding the source bundle reproduced both retained bundle hashes exactly.

Validation: both Java/TeaVM builds passed; `node --check` passed for all five
loading scripts; the six Firefox observations matched the HotSpot checksums.
The full-app diagnostic separately spent roughly 20-25 seconds in music
preparation and then made very slow progress through audio servicing, often
blocking the game thread on the audio-output monitor. That stall remains a
separate investigation; the intro-only parity result does not cover it.

#### AOT comparison without late compilation

JVM source `cc2b774` prepares guarded initialized-storage variants before guest
entry and follows static dependencies of every prepared Wasm module, including
children compiled recursively while preparing a root. It reserves static field
cells without evaluating guest initializers or capturing their default values.
Class initialization later publishes an existing body instead of rebuilding it.
Declared JRE fields use the same storage rule. Application names and policies
remain in Deko; the compiler change is generic and requires no game opt-in.

The baseline audit attributed all 205 JavaScript rebuilds to lazy static relinking
and six Wasm compilations to cold helper links. Two preliminary AOT candidates
were rejected by the strict harness: one missed helpers of already compiled child
modules, and the other missed two JRE-field variants. Neither failed candidate is
included in the accepted performance summary. The final harness rejects compiler
entry **before** it performs work and records attempted entries too, so catching
an assertion and continuing through a fallback cannot produce a passing run.

Three new alternating pairs, with the same Firefox version, CPU affinity,
bytecode, compressed assets and TeaVM artifact as the baseline:

| Phase, median | TeaVM | AOT-prepared JVM.js | JVM.js / TeaVM |
| --- | ---: | ---: | ---: |
| Initial music and effects | 1.108 s | 6.173 s | 5.57x |
| UI, graphics and font archive decoding | 0.426 s | 2.853 s | 6.70x |
| Combined loading work | 1.534 s | 8.716 s | 5.68x |

All three JVM observations recorded zero attempted post-preparation compiler
entries, zero completed post-main compilations and zero post-main compiler time.
All six observations matched the unchanged HotSpot checksums. Each VM executes
one loading pass in a fresh browser, without warming up or replaying the workload.
The combined JVM median decreased 53.6% from the historical baseline. The 10%
TeaVM parity target is **not met**, even with JVM.js compilation excluded.

The extra preparation has a cost: JVM preparation rose from 78.757 s to
101.026 s median, with 780 initialized-storage variants ready before execution.
That time is outside the decoding timers, not removed from startup. These results
do not establish the 60-second startup target, memory target, full-menu behavior,
presented FPS or phone compatibility. Browser engine optimization remains part
of ordinary execution for both runtimes; the zero-compilation assertion concerns
JVM.js compiler entry, not the browser's own machine-code tiers.

The sole cache report now contains the historical `baselineResults`, a bounded
compilation audit, rejected-case descriptions and the current `results`. Current
bundles rebuilt from the committed source matched both measured SHA-256 hashes:

```text
jvm-debug.js          958a39ae133981b81de936a301a76df2662638d2aaafae7672ff71f3c0a15ab2
jvm-compile-worker.js 741867c6e7ed9ec5dc983e8748780a3e1f463bf3cb1a1bd6ab7a2ea23471f2ae
```

Validation commands and results:

```bash
# Deko: exact committed runtime rebuild; both hashes above matched.
node apps/loading/build-runtime.mjs --revision cc2b774 --output /tmp/geoblox-aot-7Wjd0Z/verified-runtime
# Deko: six accepted observations, zero late compiler entries, matching checksums.
taskset -c 2 node apps/loading/compare.mjs --browser firefox --pairs 3
# Java tools: 219 assertions passed, including initialization order, untaken
# branches, mutable static arrays/scalars, JRE fields, Wasm child dependencies,
# method-budget boundaries, prepared-code replay and readiness token lifetimes.
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/lazyStaticRelink.test.js test/preparationWasmHelpers.test.js test/preparationFixedPoint.test.js test/preparationStableIdentity.test.js test/preparedWasmCallees.test.js test/preparedReplay.test.js test/classInitializationToken.test.js
# Deko: both syntax checks passed.
node --check apps/loading/browser.mjs
node --check apps/loading/compare.mjs
```

Temporary builds/logs are removed after comparison; only the single canonical
player cache is retained. No generated output is committed or deployed.

#### Native call-chain and resumption pass

The loading target is JVM.js execution time **at most 1.10 times TeaVM**, with
zero attempted JVM.js compilation after preparation. `compare.mjs` now records
that ratio and returns a failing exit status when the performance target is
missed, even when all decoding and compilation checks pass. It records the
runtime revision, bundle hashes and exact JVM options with each result.

Java tools source `cbcf8ad` adds generic changes:

- AOT settles helper dependencies in dispatcher resumption companions as well
  as entry modules. The archive decoder previously left Wasm on every resumed
  call despite those helpers already being prepared.
- Dispatcher modules access owned primitive arrays directly, with metadata
  invalidation for local replacement, aliased field writes and transitive
  calls. Null, bounds, boolean, wrapped, plain and foreign-heap arrays retain
  the supported checked paths. Temporary array-analysis maps are released.
- Both Wasm backends guard first-use initialization of ordinary static callees.
  Settling previously missed helpers exposed a missing initializer; the new
  test first failed with initializer trace `1` instead of `12`.
- Canonical native calls support instance methods and reference results, with
  closed receiver guards, later-subclass fallback, precise suspended frames,
  recursive publication, typed result signatures and released result scratch.
- Native returns skip the legacy JavaScript numeric-result callback. Ordinary
  JavaScript entries keep that callback and their existing return ABI.
- AOT respects the existing ordinary-constructor policy. Canonical constructor
  links preserve unfinished objects, prior effects and caller exception handlers.

These are general runtime mechanisms. No game identities were added to Java
tools. Existing opt-in execution policies are exercised by the benchmark;
production launcher defaults have not been promoted based on a failed gate.
The benchmark prepares the closure of its synthetic Java entry method, selects
already prepared complete Wasm bodies, and enables existing canonical-call and
ordinary-constructor options. This reduces preparation scope; it does not put
compilation inside the timed loading work. The default fixture options are shared by `build.mjs` and `browser.mjs`; a
focused assertion confirmed they exactly match the measured options without
mutating launcher policy. Exact options remain in the single cache report.

The final committed-bundle Firefox comparison is recorded below after rebuilding
from source. It uses the same classes, assets and unchanged TeaVM artifact, one
workload execution per fresh process, alternating backend order and CPU 2.
No timing run uses the profiler, method counters that disable optimization, or
workload warmup/replay.

| Phase, median | TeaVM | JVM.js | JVM.js / TeaVM |
| --- | ---: | ---: | ---: |
| Initial music and effects | 0.990 s | 4.257 s | 4.30x |
| UI, graphics and font archive decoding | 0.385 s | 1.460 s | 3.79x |
| Combined loading work | 1.372 s | 5.717 s | 4.17x |

The exact combined ratio was **4.1669097609**, so the 1.10 gate **failed**.
All six observations matched the unchanged HotSpot checksum, and all three JVM
observations had zero attempted and completed guest-time compiler entries.
JVM preparation took 35.999 s median; that time is additional to loading execution.
The historical prepared baseline was 8.716 s combined and a 5.68 ratio; neither
that baseline nor this improved candidate establishes 10% parity.

Measured bundles rebuilt from committed source `cbcf8ad`:

```text
jvm-debug.js          4d76c67a8390f236b96793fb6907f301b6853772aaed468a617da455fdc42243
jvm-compile-worker.js 9c82995537f3a198261b92cf0fb35049a68258506d0eb7e215b9302117ac50a2
```

This remains an asset-decoding comparison, not full game/menu acceptance.
Networking, drawing and audio device playback are excluded. Preparation is
outside the decoding timers and is still a real startup cost. No result here
establishes the aggregate heap, constrained-browser, presented-FPS, stability or
phone targets. Nothing from this pass has been deployed or pushed.

Diagnostic iterations and rejected approaches are retained as bounded entries
in the same `benchmark.json`, never a new report per attempt:

- Broad complete-Wasm selection on the earlier runtime failed archive output
  correctness. It was rejected rather than counted as a speed improvement.
- The first native instance-link trial rejected self-recursive methods during
  preparation, causing repeated audio-decoder exits and an approximately
  11-second profiled Node music phase. A recursion/publication test exposed
  and fixes that failure; those timings are not acceptance results.
- Switching every object to slab fields and enabling broad/deep inlining did
  not provide a repeatable overall improvement. Bounded deeper inlining also
  regressed the diagnostic workload. Neither policy was made a default.
- Constructor and compact-call diagnostics alone did not close the gap. Node
  diagnostic times are not mixed with the Firefox comparison.

The remaining execution work includes repeated host imports for object fields,
array metadata and type checks, plus JavaScript execution of the control-flow
heavy MIDI parser. The next substantive direction is reducing those data-access
boundaries and increasing complete native coverage without losing resumable
exceptions. Moving more compilation outside the timer cannot explain away this
remaining execution gap. Replacing the benchmark backend with TeaVM, dropping
assets, caching decoded results or changing its workload would not establish
JVM.js parity.

Reproduction and validation:

```bash
# Deko: rebuild the committed runtime in an empty, disposable output directory.
node apps/loading/build-runtime.mjs --revision cbcf8ad --output /tmp/geoblox-loading-runtime
# For a fresh player, build.mjs consumes the above runtime and prepares inputs.
# It retains one benchmark.json. Existing player inputs can be reused only when
# their recorded hashes and selected runtime/options match.
node apps/loading/build.mjs --runtime /tmp/geoblox-loading-runtime
# Repeated unprofiled gate: correct output and zero late compilation are required
# separately from the <=1.10 performance ratio. A missed ratio exits nonzero.
taskset -c 2 node apps/loading/compare.mjs --browser firefox --pairs 3
# Diagnostic only: samples execution of the exact browser source bundle in Node.
node apps/loading/diagnose-node.mjs
# Diagnostic only: checks one original archive byte-for-byte against Python bz2.
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node apps/loading/probe.mjs canonical
# Java tools: 633 focused assertions passed, including forced-GC lifetime checks.
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/canonicalInstanceFrames.test.js test/canonicalDirectFrames.test.js test/compactCanonicalFrames.test.js test/hostOwnedCanonicalFuel.test.js test/dispatcherHeapArrays.test.js test/preparedOsrDependencies.test.js test/preparedWasmConstructors.test.js test/preparationWasmHelpers.test.js test/preparedWasmCallees.test.js test/classInitializationToken.test.js
node --check apps/loading/build.mjs
node --check apps/loading/browser.mjs
node --check apps/loading/compare.mjs
node --check apps/loading/diagnose-node.mjs
node --check apps/loading/probe.mjs
```

An earlier, broader 390-assertion batch passed 384 assertions and failed six
read-import-count assertions in `wasmArrayCopyFieldCache.test.js`. The same six
failures were reproduced using the unchanged HEAD implementations of the three
runtime files modified at that point: 34/40 baseline assertions passed. The
array-copy value/alias correctness assertions passed in both cases; the count
expectations conflict with the existing native-static-cell path. This pass does
not change those expectations or claim that broader batch passed.

### Node-first native-storage experiments (not released)

The 1.10× TeaVM loading goal remains open. The selected runtime in the canonical
player is still `cbcf8ad`; none of the experiments below replace that artifact or
the production launcher policy. No generated Java, bundles, class files, Wasm,
heap snapshots, screenshots or profiler output are committed by this work.

TeaVM's pinned 0.16.0 Wasm GC binary was inspected with Binaryen 129. Its Java
fields and arrays use native GC structs/arrays rather than general JVM field and
array imports. The pinned source is available from
[Maven Central](https://repo.maven.apache.org/maven2/org/teavm/teavm-core/0.16.0/teavm-core-0.16.0-sources.jar).
The asset bridge also converts JS bytes into Java arrays. Our fixture now calls
`newByteArray`, which copies fresh I/O into owned primitive storage when enabled;
that copy stays inside the measured phase. This change alone did not explain or
close the loading gap. Existing resource-buffer copies already owned some of
those inputs.

Implemented and tested in the experimental java-tools source:

- Native GC object-reference storage, superclass-compatible layouts and native
  primitive-array field headers. Foreign heaps and replaced field containers
  retain checked imports. Finalizers follow the native store's lifetime.
- Storage forwarding across canonical calls, with consumed/cleared publications
  on normal, recursive, exceptional, withdrawn-target and cold-owner paths.
- Inline GC field instructions, typed storage locals and bounded positive class
  checks, preserving ordinary checks for unknown or later classes.
- AOT allocation guarded at execution time rather than refusing every cold
  class during compilation. Preparation never runs class initializers.
- Canonical constructor entry and selection based on actual guard-only coverage,
  including shallow inlining. The MIDI parser entered Wasm four times with zero
  exits without an application-specific method list. Unsupported bodies retain
  fallback and exit-storm checks.
- Bulk NIO byte-buffer copies for ordinary byte views. Bounds failures, signed
  values, slice offsets, host getters and destructive forward aliases preserve
  their previous behavior.
- Revocable native reference-array mirrors and per-element primitive-array
  headers, preserving captured aliases, host customization and GC cycles.
- Native primitive-array return metadata, consumed between canonical calls.
  Recursive calls, withdrawn targets and JavaScript fallback results retain
  checked behavior; unused host length getters are never queried by transport.
  Bulk copies still validate element representation before trusting a header.

A broad loop-free-caller selection experiment regressed the Node diagnostic and
was withdrawn. An earlier broad static-reference-cell experiment was also kept
out of the selected runtime. The narrower primitive-static-array implementation
uses allocator-owned metadata; it does not add native cells to every object
reference.

The last three-pair, fresh-process Firefox run of source `0ca9f72` measured
**5.390 s JVM.js / 1.324 s TeaVM = 4.071×**. All results matched and execution
attempted no compilation. The performance gate correctly exited nonzero.
A subsequent one-pair run added end-of-phase execution counters; it is diagnostic
and does not replace the repeated comparison. Node results are not browser
acceptance results.

For faster iteration, `probe.mjs` can load an exact Git revision into an isolated
CommonJS cache in memory. It uses the same dependency installation and pinned
input classes/assets, creates no extra checkout or bundle, executes once in a
fresh process, and updates only the existing `benchmark.json`. Bzip output is
checked byte for byte against Python bz2; the Vorbis probe decodes the largest
sample in the pinned music archive and checks every PCM byte against HotSpot.
The optional argument after the asset name is the source revision; omitting it
tests the working tree. A final `vorbis` selects that kernel instead of Bzip.
Neither kernel repeats the measured decode for warmup. Timings stop before
result and method diagnostics are collected. Compilation during guest execution
fails the command. Node version, effective options, heap limit, fixture hash,
harness hash and source identity are recorded with the result.

The loader regenerates the ignored JRE index **in memory from that revision**,
resolves source imports against the archive, and rejects missing source modules
or a different JRE file inventory. An earlier implementation fell back to the
working tree's generated index and therefore shared some JRE/core helpers with
the working tree. Its archive A/B results, including the apparent 4.6% Vorbis
gain, are invalid for performance comparisons and marked accordingly in the
single report. Bundled-runtime Firefox comparisons are unaffected.

```bash
# Run from dekobloko-work. Each invocation prepares and executes once.
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --max-old-space-size=1024 apps/loading/probe.mjs slab 1-2.bin 9be0494cee811d6b87e2f863d1c028cbae0886ab
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --max-old-space-size=1024 apps/loading/probe.mjs slab 3-0.bin 9be0494cee811d6b87e2f863d1c028cbae0886ab vorbis
# Use taskset -c 2 for both sides when comparing on the same fixed CPU.
```

Source `9be0494` is saved in `experiment/teavm-native-parity`. It remains
experimental. Reference-array stores still use the existing runtime store
bridge; this prototype does not claim to add missing covariance checks.

With the corrected loader, three alternating fresh-process Vorbis pairs on CPU
2 (`--max-old-space-size=1024`) compared `3c83f00` against `9be0494`. Median
decode time was **240.591 / 238.683 ms**; total guest execution was
**643.513 / 646.606 ms**. This is effectively flat, with no demonstrated overall
gain. Every PCM byte matched HotSpot and all six runs attempted zero guest-time
compilations. No further Firefox run or default promotion follows that result.
The complete prepare-plus-execute probe takes about 45 seconds on that pinned
CPU. Six corrected Bzip runs (`0ca9f72` versus `9be0494`) matched Python bz2,
attempted zero guest-time compilations and took about 5.3 seconds each for
preparation plus execution. Median execution was **390.680 / 396.750 ms**, also
no gain. Neither probe needs a browser or bundle build. The measured source
commits remain reachable from the experimental branch for reproduction.

Node is the first iteration tool; Firefox remains an occasional release gate.
The next execution experiments need a repeatable full-workload Node gain before
another browser run, including safe bounds-check proofs where metadata transport alone
does not help. Removing checks or silently weakening Java semantics would not
establish parity.
[TeaVM documents a strict option that adds Java checks](https://teavm.org/docs/tooling/gradle.html);
that is relevant to understanding generated code, not a reason to change the
fixed reference artifact or relax this VM's supported behavior.

Validation completed during this pass:

```bash
# java-tools: the pre-reference-array batch passed 1,204 assertions.
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/nativeObjectStorage.test.js test/nativeObjectFieldCodegen.test.js test/nativeObjectForwarding.test.js test/nativeStaticReferenceCell.test.js test/nativeStaticReferenceCodegen.test.js test/nativeByteArrayIngress.test.js test/byteBufferBulkCopy.test.js test/preparedWasmConstructors.test.js test/canonicalInstanceFrames.test.js test/canonicalDirectFrames.test.js test/compactCanonicalFrames.test.js test/hostOwnedCanonicalFuel.test.js test/wasmHeapFreeList.test.js test/wasmHeapGrowth.test.js test/objectSlabReclamation.test.js test/slabFields.test.js test/dispatcherHeapArrays.test.js test/nativeStaticCell.test.js test/nativeStaticFields.test.js test/classInitializationToken.test.js test/wasmInlineInitialization.test.js
# Reference-array integration passed 194 assertions; later cache/alias tests
# passed 80 assertions in the two directly affected files.
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/nativeReferenceArray.test.js test/nativeObjectStorage.test.js test/nativeObjectFieldCodegen.test.js test/nativeObjectForwarding.test.js test/dispatcherHeapArrays.test.js test/slabFields.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/nativeReferenceArray.test.js test/nativeObjectFieldCodegen.test.js
# Array-return and bulk-copy compatibility: 347 assertions passed.
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/nativeReferenceArray.test.js test/nativeObjectForwarding.test.js test/canonicalInstanceFrames.test.js test/compactCanonicalFrames.test.js test/dispatcherHeapArrays.test.js test/wasmHeapBulkCopy.test.js test/nativeStaticReferenceCodegen.test.js
# Deko: both inflater integration tests passed.
node --test tests/browser-inflater-async.test.mjs
# Deko: isolated browser comparison leaves the selected runtime intact.
node apps/loading/compare.mjs --browser firefox --pairs 3 --runtime /tmp/geoblox-native-parity-7zCq8O/runtime --revision SOURCE_COMMIT --options diagnostic
```

`--options diagnostic` uses the candidate options already recorded in the single
report and requires an isolated runtime. Rebuild that disposable runtime with
`build-runtime.mjs` before using the browser command; Node revision probes need
no bundle. The 512 MiB heap, 24 FPS, sustained gameplay and phone targets have not
been revalidated by this execution-only investigation.

### Full Node comparison and native calls during resumption

The same probe now supports the **complete existing loading workload** and the
unchanged TeaVM 0.16.0 Wasm GC artifact, without bundling or opening a browser.
The classes, assets and TeaVM binary are hash-checked against the existing
receipt. Both runtimes execute once per fresh Node process with a 1,024 MiB
old-space limit. This is a Node diagnostic, not browser or phone acceptance.
The Java music/graphics timers and the recorded HotSpot checksum are unchanged.
The probe additionally rejects attempted compiler entry, even if an assertion
were swallowed before the completed-compilation census could count it.

```bash
# From dekobloko-work: exact complete-workload probes, not profiled.
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --max-old-space-size=1024 apps/loading/probe.mjs slab all d7f8962d6a204b44b69fe3c7407773141a54e145 loading
node --max-old-space-size=1024 apps/loading/probe.mjs teavm all - loading
# Paired comparison, with the same mandatory 1.10 gate as the browser tool.
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node apps/loading/compare.mjs --browser node --pairs 3 --revision d7f8962d6a204b44b69fe3c7407773141a54e145 --options diagnostic
```

Node writes `nodeComparison` and `kernelDiagnostic` in the **same**
`benchmark.json`, preserving the selected runtime, JVM options and browser
results. `--revision` loads archived JVM source and generates its JRE index in
memory. Node comparisons need no `--runtime` directory. Omit `--options
diagnostic` to use the selected preparation profile; an optional `--player`
continues to select the existing fixture directory. A failed parity gate exits
nonzero after recording the actual result; it is never reported as acceptance.
The asset bridge unwraps legacy byte-array factory results to preserve the
fixture's typed-view representation while keeping fresh bytes and retaining
owned typed views from newer runtimes. A selected-runtime smoke run at `cbcf8ad`
then matched the checksum with zero late compilation; its one-pair 6.766× Node
parity result still failed. Harness hashes are captured before execution and
include the shared asset/inflater helpers.

The broader cold-static-inlining experiment (`cdc85b1`) passed semantics tests
but regressed the Vorbis diagnostic: **238.543 / 324.778 ms** median decode time
for baseline/candidate. A loop-restricted variant (`e68ecec`) did not establish
a full-loading improvement either. Both source revisions remain reproducible
in the experimental branch, and both were removed from the current prototype.
The cold-integer test's forced-fuel harness now freezes automatic compilation
between explicit rebuilds; the previous harness could capture an executable
after dependency refresh had already withdrawn it. That test failure was also
reproduced with the pre-experiment compiler.

The useful execution finding was a **fuel-exit transition to the dispatcher**.
The structured entry could call native helpers, but the OSR companion still
used JavaScript scratch-frame bridges for those calls. In the Bzip probe one
ready helper took that bridge about 320,000 times, even though its canonical
native export was eligible and published. The dispatcher now has a Wasm adapter
to the same mutable canonical table. Its successful path spills no Java frame;
refusal, suspension and exception paths preserve the original operands, PCs,
callee frames and exception identity. Replacement/withdrawal follow the live
table. Rejected translations and collectible retired modules release their
slots. The new calls are explicitly marked deoptable, so an outer legacy caller
cannot mistake them for never-exiting raw links. Primary/OSR replacement is
validated before changing the published executable pair.

The initial three Bzip pairs (`9be0494` / `417d90d`) measured **396.888 /
340.566 ms**, a 14.2% kernel gain, with exact Python bz2 output and no guest
compiler attempts. A final repeat with corrected source `d7f8962` and the
updated bridge measured **447.983 / 378.387 ms** (15.5%); absolute timings
drifted, but each of its three fresh-process pairs improved. This **did not
establish a full-loading gain**. Three
counterbalanced complete-workload source comparisons on CPU 2 used `9be0494`
and corrected candidate `d7f8962`, each against a fresh TeaVM process:

| Median | Baseline | Candidate |
| --- | ---: | ---: |
| Music | 2,024.487 ms | 2,033.954 ms |
| Graphics | 1,036.981 ms | 1,008.012 ms |
| Total loading | 3,045.136 ms | 3,038.385 ms |
| JVM.js / TeaVM ratio | 6.497× | 6.515× |

Total loading is effectively flat (0.2% difference); **every 1.10 gate failed**.
The component medians need not sum to the median total. Every PCM/archive
checksum matched and every JVM observation had zero attempted or completed
guest-time compilations. No Firefox run or release promotion follows this
result. The remaining gap also exists on paths that already execute native
calls; removing that one bridge is insufficient.

The exact measured full-loading harness is saved as Deko commit
`7286e18b8126167602877368bfff0023f6c830da` in
`experiment/node-loading-oracle`; its probe SHA-256 is
`9131f3ea787095ae523344289f5e0722e90e6c9b0f8ff63b5a5c998e80f06814`.
The current harness adds the legacy byte-wrapper fix and captures dependency
hashes before execution. The final java-tools test snapshot is `94aa985`; its
runtime source is byte-identical to measured source `d7f8962`.

Focused validation (java-tools):

```bash
# 849 assertions passed before the final additional lifetime/spill tests.
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/dispatcherCanonicalCalls.test.js test/canonicalDirectFrames.test.js test/compactCanonicalFrames.test.js test/canonicalInstanceFrames.test.js test/dispatcherHeapArrays.test.js test/preparedOsrDependencies.test.js test/hostOwnedCanonicalFuel.test.js test/nativeObjectForwarding.test.js test/nativeReferenceArray.test.js test/classInitializationToken.test.js test/preparedWasmConstructors.test.js test/wasmColdIntegerInline.test.js
# The final focused file passed 57 assertions, including zero normal spill
# imports, nested fuel exits, EH propagation, atomic replacement and slot GC.
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/dispatcherCanonicalCalls.test.js
```

`node --check apps/loading/probe.mjs`, `node --check apps/loading/compare.mjs`
and `git diff --check` passed. All implementation and test sources are saved in
the experimental java-tools branch; generated outputs remain outside Git.
`node --test tests/loading-byte-ingress.test.mjs tests/browser-inflater-async.test.mjs`
passed all three Deko integration tests.


#### Node-first native leaf proof experiments

The full-loading Node oracle is now the primary iteration path. Firefox remains
a later browser gate after a repeatable full-workload improvement; kernel gains
alone do not trigger another browser bundle/run. Source is loaded from an exact
Git archive, with no generated bundle or additional checkout. All comparisons
below use CPU 2, Node 22.23.2, 1,024 MiB old-space, unchanged pinned classes,
assets and TeaVM binary, and one workload execution per fresh process. They are
loading diagnostics, not browser/phone, memory, presentation or gameplay passes.

A bounded static-leaf version (`af3334633332e1bf9e1aa60045a6350b1b64ed61`)
proved field capabilities, numeric write tags and owned primitive-array headers
at entry, then omitted repeated checks in a callback-free body. It excluded
calls, allocations, volatile accesses, handlers, object fields and unsupported
operations. Cold/reset owner tokens deferred to the original entry without
initializing an untaken path. The generic checked body remained available for
accessors, foreign/off-heap arrays, readonly cells and host representations.
The initial focused tests passed 106 assertions; the compatibility batch passed
464. A single full-loading baseline/candidate pair measured music
1,999.752 / 2,216.894 ms and graphics 1,338.836 / 1,003.529 ms. That tradeoff
did not establish a useful gain. Coverage confirmed the version ran in the
3,148,442-entry bit-reader, rather than silently remaining unused.

The follow-up (`5eebf40694f367331717b3ca4e18a3a3cc5a7a13`) cached positive
proofs using a host-owned numeric epoch. Field capability/tag changes and array
reference replacement invalidated it synchronously. Negative proofs were
retried, and epoch saturation disabled caching rather than wrapping. Cached
metadata contained only numeric addresses/lengths; retired arrays remained
collectible. Forced fuel, Java bounds/null errors, getter/setter ordering, cold
foreign owners, descriptor replacement, GC and saturation all passed. Exact
focused validation, **418 assertions passed**:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/nativeStaticLeafVersion.test.js test/nativeStaticFields.test.js test/nativeStaticReferenceCodegen.test.js test/nativeStaticCell.test.js test/nativeStaticReferenceCell.test.js test/dispatcherCanonicalCalls.test.js test/classInitializationToken.test.js
```

Two baseline and two candidate fresh-process comparisons ran in B/C/C/B order
against a fresh TeaVM process each time. No observation was excluded:

| Source | Music ms | Graphics ms | Total ms | TeaVM total ms | Ratio |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline `94aa985` | 2,012.598 | 1,004.999 | 3,017.596 | 465.304 | 6.485× |
| Cached proof `5eebf40` | 2,615.521 | 1,488.222 | 4,103.743 | 542.037 | 7.571× |
| Cached proof `5eebf40` | 2,030.780 | 997.026 | 3,027.806 | 467.915 | 6.471× |
| Baseline `94aa985` | 2,008.775 | 1,022.698 | 3,031.473 | 464.004 | 6.533× |

One candidate observation was flat and one regressed; its two-run median was
17.9% worse. Host timings varied, but the data establish no repeatable full
loading gain. All checksums matched and all attempted/completed guest compiler
counts were zero. Every 1.10 gate failed. Both leaf versions and their epoch
mechanism were withdrawn from the current candidate. Their handwritten source
and tests remain reproducible in experimental Git history; no runtime defaults
or selected artifact changed. Compact results live under
`optimizationTrials.nativeStaticLeafFullNode` and
`optimizationTrials.nativeStaticLeafEpochFullNode` in the same `benchmark.json`.
The measured Deko harness is `3afa353`; it adds only post-timer version coverage.

Reproduction, substituting either exact source revision above:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node apps/loading/compare.mjs --browser node --pairs 1 --revision 5eebf40694f367331717b3ca4e18a3a3cc5a7a13 --options diagnostic
```

A nonzero exit after completed observations is the mandatory parity failure,
not an ignored correctness failure. Source snapshots are on
`experiment/teavm-native-parity`; use the matching historical test sources to
re-run tests for withdrawn prototypes. No generated outputs were committed.


#### Literal rematerialization on full loading: withdrawn

The earlier intro experiment found no gain from literal rematerialization.
A smaller new prototype checked that result on the complete asset-loading
workload (`cab078930067bc1071758d0e8cf365548e0892dd`). It emitted only numeric
literals at uses, including phi copies and interpreter frame spills, and omitted
their dedicated locals. It did not rematerialize string/class resolution. The
new test verified actual local omission as well as exact wide integers, f32
rounding, negative zero, NaN, branch joins, fuel exits and handler locals.

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/wasmLiteralRematerialization.test.js test/dispatcherCanonicalCalls.test.js test/nativeStaticFields.test.js test/wasmColdIntegerInline.test.js test/wasmInlineInitialization.test.js
```

That prototype batch passed **227 assertions**. The forced handler test uses
the VM's continuation path; expecting every handled guest exception to return
directly from a raw canonical export was an incorrect test assumption.

The same B/C/C/B Node protocol produced these complete-loading results, all
retained under `optimizationTrials.literalRematerializationFullNode`:

| Source | Music ms | Graphics ms | Total ms | TeaVM total ms | Ratio |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline `94aa985` | 2,257.530 | 1,137.373 | 3,394.903 | 548.088 | 6.194× |
| Literals `cab0789` | 2,003.921 | 1,043.021 | 3,046.943 | 466.139 | 6.537× |
| Literals `cab0789` | 2,114.862 | 1,028.885 | 3,143.747 | 467.642 | 6.723× |
| Baseline `94aa985` | 2,015.925 | 1,057.615 | 3,073.541 | 517.003 | 5.945× |

The raw two-run JVM medians improve 4.3%, but TeaVM also varied substantially
and the candidate/TeaVM ratios worsen. Two observations per source do not
establish a repeatable optimization. All checksums and zero guest-compiler
attempt/count checks passed; every 1.10 gate failed. The compiler change was
withdrawn. No Firefox run, artifact change or deployment followed.

The semantic cases remain in `test/wasmLiteralContinuations.test.js`; the
implementation-specific local-omission assertions were removed with the
prototype. Numeric literal optimization remains a measured rejection for both
the intro and this full-loading workload, rather than an untested next step.
The remaining loading gap requires improvements beyond this bookkeeping.


Retained validation after withdrawing both prototypes:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/wasmLiteralContinuations.test.js test/structuredSsaCatchLocal.test.js test/structuredWasmDivision.test.js test/wasmStringConstants.test.js test/wasmParameterArrayAbi.test.js
```

**225 assertions passed.** The first retained batch exposed three stale array
ABI assertions: an ordinary static array now supplies native metadata without
a JavaScript base query, and the refusal fixture stopped at an earlier static
readiness guard before reaching its intended lazy-fill guard. The updated test
checks replacement static-array metadata, explicitly reaches and refuses the
lazy fill using an uncaptured accessor value, verifies one getter evaluation,
and still requires the callee's original-reference query. No runtime guard was
weakened to satisfy it. The final source snapshot is
`bb2b71327729b897640ecaf4e6eae03b85e9c566`; its runtime source equals
`94aa985` (the differences are the retained tests). The selected runtime remains
`cbcf8ad`. Unrelated decompiler edits and the parent cloner workspace were
preserved. `git diff --check` passed in both changed repositories.


#### SSA cast identity and native array metadata

The previous CPU profile predates the native storage work. A narrower import
census of source `bb2b713` identified a concrete remaining boundary: the Bzip
block decoder performed 5,798,139 `cast__I` calls and 5,798,183 each of `abase`
and `alen0`. The full workload also calls `Math.sin` 10,481,664 times; the
unchanged TeaVM binary imports that operation too, and the VM already binds
the native Math function directly. No new CPU sampling was needed.

Deko harness `441bb59` records a post-timer import census when the existing
`JVM_WASM_IMPORT_STATS=1` diagnostic is enabled. Counting wraps imports and can
change native engine treatment of them, so these times are not performance
evidence. The comparison tool explicitly rejects instrumented JVM observations.
The same pinned fixture, checksums and no-guest-compilation checks still apply.
Diagnostic commands, from Deko:

```bash
JVM_WASM_IMPORT_STATS=1 NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 apps/loading/probe.mjs slab all bb2b71327729b897640ecaf4e6eae03b85e9c566 loading
JVM_WASM_IMPORT_STATS=1 NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 apps/loading/probe.mjs slab all 89619e8a5bf190bea1e8b1f60e25c5cc45b05251 loading
```

A successful checkcast changes type knowledge but preserves reference identity.
The compiler previously gave its result a new array metadata cache, discarded
on every loop iteration. Generic source `f0d5377` shares positive native
base/length proofs across checked aliases. Negative/uncaptured results retain
their original queries; casts still execute and no getter moves before a Java
access. In the same full-loading census that reduced each Bzip query count to
3,699,197. It was an intermediate source trial, not a timing result.

Source `89619e8` additionally transfers these numeric proofs through SSA phi
copies. Every source is captured before any destination proof is overwritten,
including cyclic swaps. The backward phi slice includes intermediate joins
that never access an array themselves. Captured native row headers can supply
a proof without a query; unknown or deferred metadata clears the destination
and cannot cause an early access. Reference definitions invalidate their proof.
No Java reference or cast verdict is stored by this analysis.

In the full-loading candidate census, each Bzip query count falls to **at most
53** (neither appears in the positive top-120 census, whose final entry is 53),
while all **5,798,139 casts remain**. Both decoded checksums match HotSpot and
there were zero attempted/completed guest-time compilations. The exact census
and its intermediate result are kept in
`optimizationTrials.castIdentityMetadata` in the existing `benchmark.json`.

Focused compatibility initially passed 211 assertions; the first alias proof
passed another 24. The phi/capture version passed 242 assertions, and final
GC cases bring the new focused file to 34 assertions. Those cases cover
simultaneous swaps, conditional row joins, reference replacement, negative
proofs, unused/failed casts, exception order, partial effects, forced fuel and
collection while installed runtime imports remain alive. Java-tools commands:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/arrayIdentityCaches.test.js test/wasmParameterArrayAbi.test.js test/nativeReferenceArray.test.js test/wasmSsaReferenceFacts.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/arrayIdentityCaches.test.js
```

The final test/source snapshot is `34532acbd82773e4b44384df4071dc0592a9c312`
on `experiment/teavm-native-parity`; its runtime matches `89619e8` exactly.
The mechanism is generic, enabled with the existing compiler and adds no
application identity or optimization flag. Generated output remains outside
Git; selected runtime `cbcf8ad` is unchanged.


The first uninstrumented full-loading batch used B/C/C/B/B/C source order,
three observations per source, and a fresh TeaVM process after each observation.
All observations are retained in `optimizationTrials.castIdentityFullNode`:

| Median | Baseline `bb2b713` | Candidate `34532ac` |
| --- | ---: | ---: |
| Music | 2,182.657 ms | 2,287.284 ms |
| Graphics/UI/font archives | 1,167.918 ms | 976.311 ms |
| Combined loading | 3,350.790 ms | 3,263.595 ms |
| TeaVM combined | 520.266 ms | 519.362 ms |

Graphics improves 16.4%, and each candidate graphics observation is faster than
its paired baseline. Combined loading improves only 2.6%; music regresses 4.8%
in this batch. This does not establish the full 1.10 target. Every correctness
and zero-guest-compilation check passes; every performance gate fails.

The follow-up source `0bf1a3999198b88b1adefed3b87fa1424f097c09` limits proof
sharing to casts inside repeated structured regions. A one-off cast cannot
amortize phi-copy overhead. It also caps the entire backward proof slice at
64 groups, refusing before allocating locals or changing existing caches when
the limit is exceeded. New tests check refusal, swaps with different lengths,
and replacement with a shorter array. The same four-file focused command above
now passes **253 assertions**.


The repeated-region version was measured in a second fresh B/C/C/B/B/C batch
with the same source baseline and unchanged harness `441bb59`. The sole report
retains all twelve JVM/TeaVM observations in
`optimizationTrials.castIdentityRepeatedFullNode`:

| Median | Baseline `bb2b713` | Repeated regions `0bf1a39` |
| --- | ---: | ---: |
| Music | 2,213.574 ms | 2,259.440 ms |
| Graphics/UI/font archives | 1,172.916 ms | 909.745 ms |
| Combined loading | 3,386.490 ms | 3,190.760 ms |
| TeaVM combined | 530.294 ms | 549.653 ms |
| Median individual JVM/TeaVM ratio | 6.542× | 5.805× |

Graphics improves **22.4%**; combined loading improves **5.8%**. Music is 2.1%
slower in this batch. Each of the three graphics pairs improves; no large or
small observation was excluded. TeaVM timings also vary, so these are the
actual medians rather than a claim that host conditions are identical. The
combined target remains far from met: **every 1.10 gate fails**, despite all
checksums matching and every attempted/completed guest compiler count being
zero. The version remains experimental and has not changed runtime selection.

Exact uninstrumented reproduction command (substitute the baseline source for
its control observations):

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node apps/loading/compare.mjs --browser node --pairs 1 --revision 0bf1a3999198b88b1adefed3b87fa1424f097c09 --options diagnostic
```

The orchestration repeats that command with source order B/C/C/B/B/C, retaining
each complete result before the next command. A fresh TeaVM process follows
every source observation. Each individual command correctly exits 1 for the
failed parity gate after writing a complete checked result. Counter-bearing
diagnostics are never mixed into these timing batches.

The remaining Bzip cast imports are a different problem: this pass transports
location and length, not runtime type identity. TeaVM's pinned bit reader
(function 48 in the inspected WAT) uses typed GC fields/arrays directly. A
further native array-type representation would need to preserve Java class
identity, CCE fallback, host-customized storage and array lifetime through GC;
merely deleting checks based on a declared field type would not prove those
requirements. That is a more substantive next direction than repeating the
rejected literal or guard-bookkeeping experiments.


The largest-sample Vorbis probe for `0bf1a39` matched **every PCM byte** against
a fresh HotSpot run, with zero guest-time compiler attempts or completions:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 apps/loading/probe.mjs slab 3-0.bin 0bf1a3999198b88b1adefed3b87fa1424f097c09 vorbis
node apps/loading/build-runtime.mjs --revision 0bf1a3999198b88b1adefed3b87fa1424f097c09 --output /tmp/geoblox-native-parity-7zCq8O/runtime
taskset -c 2 node apps/loading/compare.mjs --browser firefox --pairs 3 --runtime /tmp/geoblox-native-parity-7zCq8O/runtime --revision 0bf1a3999198b88b1adefed3b87fa1424f097c09 --options diagnostic
```

The isolated build succeeded. Bundle SHA-256 values were
`e37e76b023c399d0b87058e60ffa1b655bafd01fc785daa75f361ce865f5a9bc`
(`jvm-debug.js`) and
`6ff083b8043a1531ff4884157e8587fab45488afa8275df62e479c7d1ae68bf4`
(`jvm-compile-worker.js`). These are generated temporary artifacts, not Git
outputs or a selected deployment.

#### Firefox exposed an invalid parity statistic

The three Firefox pairs all matched the checksum and executed without guest
compilation, but timings changed markedly during the batch:

| Pair | JVM total ms | TeaVM total ms | Paired ratio |
| --- | ---: | ---: | ---: |
| 0 | 19,839.000 | 4,963.000 | 3.997× |
| 1 | 5,358.000 | 5,515.000 | 0.972× |
| 2 | 5,272.000 | 1,365.000 | 3.862× |

The old tool divided independently calculated backend medians, producing
**1.079589× and a false passing exit**. That does not establish parity: the
median paired ratio is **3.862271×**. No observation is discarded and no
particular cause of the timing shift is asserted.

Deko commit `f32bf43` adds a tested statistics helper. Acceptance now requires
**both** the median paired ratio and the ratio of backend medians to be <=1.10.
Pairs must be complete, unique and finite; they cannot be pooled independently
to hide the gap. Provenance records the helper's source hash as well as the
comparison script hash. `node --test tests/loading-statistics.test.mjs` passes
all three tests, including the exact observed false-pass case, the 1.10
boundary, conflicting estimators, missing observations and duplicated pairs.
`node --check apps/loading/compare.mjs` passes.

The saved Firefox observations were reevaluated with the tested helper;
`results.parityAudit` preserves the original passing statistic, the new helper
hash, reevaluation commit and a hash of the **unchanged** observations. The
corrected gate fails. This is a statistical correction to the old observations,
not a claim that the new helper ran during their execution. Node source trials
above used one pair per command; their per-command ratios are unchanged.
The browser result is saved in the existing trial record too.

#### Ownership compatibility follow-up

Review found that a positive base alone is insufficient for alias sharing:
untracked host TypedArray views into the same memory can have observable
length getters. Source `ba22815e88f01bf2fd5ce4119789d20aae5d3283` restricts
publication to allocator-owned arrays in the same memory. Joins accept only
an existing ownership proof or an allocator-derived native row header, not a
generic raw array cache. Untracked positive-base views retain every original
metadata query and length getter; the new regression verifies that exact case.
The existing four-file compiler command now passes **256 assertions**, including
GC retention tests. This additional guard is being remeasured; the `0bf1a39`
timings and Firefox bundle above are not relabeled as this newer source.


The ownership-safe source completed another B/C/C/B/B/C uninstrumented Node
batch, using the corrected `f32bf43` harness. Results are retained in
`optimizationTrials.castIdentityOwnedFullNode`:

| Median | Baseline `bb2b713` | Ownership-safe `ba22815` |
| --- | ---: | ---: |
| Music | 2,015.812 ms | 1,996.154 ms |
| Graphics/UI/font archives | 1,013.681 ms | 791.524 ms |
| Combined loading | 3,018.418 ms | 3,024.090 ms |
| TeaVM combined | 467.228 ms | 467.066 ms |
| Median individual JVM/TeaVM ratio | 6.460× | 6.437× |

Two candidate/control combined pairs improve and one is essentially tied
(0.2% slower). One candidate graphics observation takes 1,062.775 ms; it is
retained along with the 791.524 and 790.710 ms observations. Component medians
do not necessarily belong to the same run and cannot be summed into an
overall gain. **Combined medians are flat; no repeatable overall speedup is
established.** The graphics median improves 21.9%, which is a component result,
not the full target. All checksums and zero guest-compiler attempt/count gates
pass. Every individual 1.10 gate fails. No runtime was promoted.

A final instrumented census on `ba22815` confirms each Bzip base/length query
count remains <=53 and all 5,798,139 casts still execute. Its times are excluded
from performance evidence. The final largest-sample Vorbis probe again matches
every HotSpot PCM byte with zero attempted/completed guest-time compilation.
The final isolated browser rebuild also succeeds. Exact commands:

```bash
JVM_WASM_IMPORT_STATS=1 NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 apps/loading/probe.mjs slab all ba22815e88f01bf2fd5ce4119789d20aae5d3283 loading
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 apps/loading/probe.mjs slab 3-0.bin ba22815e88f01bf2fd5ce4119789d20aae5d3283 vorbis
node apps/loading/build-runtime.mjs --revision ba22815e88f01bf2fd5ce4119789d20aae5d3283 --output /tmp/geoblox-native-parity-7zCq8O/runtime
```

The final build hashes are
`3269f39ce4d11b1131f0dfe268f1865bacface4140a6883717450aad8edb9e23`
and `b776ec41b9454c43fab44c5ab4ea6b07b3d37848bb3d8aa4f8c442969a7b9c1b`
(debug/worker respectively). This temporary directory now contains `ba22815`,
not the earlier Firefox-tested `0bf1a39`; rebuild the matching revision in an
empty output directory when reproducing that historical observation. The
selected cached `cbcf8ad` bundle hashes were rechecked and remain unchanged.

A concrete remaining compiler issue was found by reading the dispatcher:
`MethodTranslator.checkcastImport` eagerly passes every typed Java local and
the operands below a cast into a rest-argument JavaScript import. Those values
are needed only on the unknown-class deoptimization path. Its successful cast
also discards the original array provenance. The structured import census does
not count those dispatcher imports, because that backend's import registry has
no counter wrapper. A useful next implementation is a fast cast predicate with
deferred frame materialization and identity-preserving provenance, retaining
null normalization, original exception order and the unknown-class fallback.
This is a specific code-generation finding, not a new generic CPU-profiling
plan. The full 1.10 goal remains active.


### Node iteration: deferred dispatcher cast transport

The dispatcher now tests casts with a one-reference predicate. Typed Java locals
and operands below the cast travel to JavaScript only on an unknown-class deopt.
Null/undefined normalization, CCE identity, getter order, category-2 locals,
under-stack store operands and original resume PCs remain covered. Runtime source
`c452c2be1ca2c906a5a84d34c07a36b0c5c54ab9` is saved on the experimental branch;
`6f716373f57d37474e64def747a40084bb9caf95` adds four test assertions only.

Six fresh Node observations in B/C/C/B/B/C order use CPU 2, 1 GiB old-space,
unchanged pinned classes/assets/TeaVM, one workload pass and no guest compilation.
Bzip median improves **404.905 -> 383.788 ms (5.2%)**, with all three candidate
observations faster. Full loading does **not** establish an improvement:

| Median | Baseline `ba22815` | Candidate `c452c2b` |
| --- | ---: | ---: |
| Music | 2,002.323 ms | 2,013.409 ms |
| Graphics archives | 798.795 ms | 815.871 ms |
| Combined | 2,801.575 ms | 2,829.280 ms |
| Paired JVM/TeaVM ratio | 6.007x | 6.105x |

Every checksum and zero guest-compilation gate passes; every 1.10 parity gate
fails. Records remain in the single `benchmark.json`, under
`optimizationTrials.deferredDispatcherCastsBzip` and
`optimizationTrials.deferredDispatcherCastsFullNode`. These results do not justify
promoting a runtime. The selected `cbcf8ad` runtime remains unchanged.

Validation from `java-tools` (dependency prefix omitted below only for brevity):

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/deferredDispatcherCasts.test.js test/wasmInstanceLink.test.js test/dispatcherCanonicalCalls.test.js test/dispatcherHeapArrays.test.js
```

Result: **209/209 assertions pass**. The separate compiler-retention command
passes **88/88** before the subsequent merge-copy experiment adds retention checks.

A one-pass logical-work check wraps `Math.sin` before loading the **unchanged**
pinned TeaVM artifact: **10,515,712 calls**. This is stored as explicitly
instrumented evidence under `optimizationTrials.teavmLogicalWorkCensus`; its times
are excluded from acceptance. The existing JVM census reports 10,481,664 calls in
`MusicDecoder.decodePacket` alone; the game also initializes a 32,768-entry sine
table and the MDCT setup tables. This rules out the simple hypothesis that the
pinned oracle skips all music decoding. It does not extend the existing PCM
checksum to instrument samples cached during score preparation: that checksum
currently covers the 18 initial sound-effect samples only.


### Rejected merge-copy pruning experiment

A compiler-only backwards slice seeds real normal operands, call/EH spills,
entry guards, fuel exits and deopt stubs, then follows SSA arguments. Unobserved
merge cycles need no native edge copies; producers remain in place. There is no
runtime opt-in. The tested source is `07e9a96bcb3c4fb331bb94a3bc2a966573ec3802`;
`85ffa8e4e5fbed52c39ea2dd36b16d1c2ad6e830` additionally resets analysis on diagnostic
compiler reuse and adds two regression assertions. Analysis data is released with
other compiler diagnostics. No extra spill imports are installed for analysis.

The prototype removes 513 static copy sites in `decodePacket` and 288 in
`decodeBlocks`. All 226 focused assertions pass, covering exact results and frame
state at several fuel budgets, wide handler-only locals, reference identity,
parallel swaps, observable unused producers, existing aliases and retention:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/wasmDeadPhiCopies.test.js test/frameLocalSpills.test.js test/wasmCompilerRetention.test.js test/arrayIdentityCaches.test.js test/wasmSsaReferenceFacts.test.js
```

An initial source `10caee6` also matches every HotSpot byte for the largest
Vorbis sample with no guest compilation. That initial source temporarily
created analysis-only spill imports; `07e9a96` removes those unused imports.
The sample result is not relabeled as a later revision.

Full-loading B/C/C/B/B/C comparisons use control `6f716373` and candidate
`07e9a96`, the same CPU/heap/artifacts and fresh paired TeaVM observations:

| Median | Control | Candidate |
| --- | ---: | ---: |
| Music | 1,989.272 ms | 1,996.105 ms |
| Graphics archives | 798.334 ms | 794.815 ms |
| Combined | 2,780.993 ms | 2,791.806 ms |
| Median paired JVM/TeaVM ratio | 5.935x | 6.004x |

Combined time is 0.39% higher; this does not establish a speedup. The last
candidate graphics observation (1,088.341 ms) is retained. All decoded checks and
zero guest compiler gates pass; all six parity gates fail. Data is in
`optimizationTrials.deadPhiCopiesFullNode` in the existing single receipt.
The probe records copy counts, with source hash
`2fb69f841ad18229bac434fe8d5dde07058eb5e282027444cf58752e7dadf015`.
`node --check apps/loading/probe.mjs` and all three statistics tests pass.

The optimization and its specific test are removed from the active experiment
in `72c10fdea7db6cb5c98239d4514350baeace8d8e`; the entire saved tree is identical
to `6f716373`. The attempted implementation and tests remain reproducible in its
parent history. No default or browser runtime is promoted.


### Eager host-native tier diagnostic

Both unchanged runtimes also ran one fresh full-loading pass under:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 --no-liftoff --no-wasm-lazy-compilation apps/loading/probe.mjs slab all 6f716373f57d37474e64def747a40084bb9caf95 loading
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 --no-liftoff --no-wasm-lazy-compilation apps/loading/probe.mjs teavm all - loading
```

These are diagnostic engine flags only, equally applied; they are not a runtime option or release
configuration. Each pass has fresh process/VM state and no guest replay. Node
must compile Wasm with its optimizing tier before executing it. Both results
match the recorded checksum; JVM.js has zero attempted/completed guest-time
Java compilation.

| Full pass | JVM.js `6f716373` | Pinned TeaVM |
| --- | ---: | ---: |
| Music | 1,528.446 ms | 217.178 ms |
| Graphics archives | 514.101 ms | 116.186 ms |
| Combined | 2,042.547 ms | 333.364 ms |

The ratio is **6.127x**. This is one causal diagnostic pair, not a repeated
performance acceptance result. Eager optimization makes both runtimes faster
than their normal fresh-process observations but leaves the gap. Host Wasm
warmup alone cannot explain it. Source, flags, harness hash, checks and times
are in `optimizationTrials.eagerNativeTierFullNode` in the single receipt.
The original artifacts and selected runtime hashes remain unchanged.

A concrete next code-generation direction is expanding the existing bounded
loop-versioning proof beyond its current negative-counter, integer-array shape.
Counted DSP loops over already captured primitive arrays could guard owned
representation and ranges once, then avoid repeated cache/type/bounds branches.
This needs exact exception order and fuel continuation tests, plus fresh full
Node comparisons before any Firefox confirmation; no new CPU-sampling exercise
is required to start that implementation. The 1.10 goal remains unmet.

Final validation after removing the non-improving merge-copy experiment:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/deferredDispatcherCasts.test.js test/wasmInstanceLink.test.js test/dispatcherCanonicalCalls.test.js test/dispatcherHeapArrays.test.js test/wasmCompilerRetention.test.js
node --test tests/loading-statistics.test.mjs
node --check apps/loading/probe.mjs
```

Results: **297/297 assertions**, **3/3 statistics tests**, syntax check passes.
`git diff --check` passes. The parent checkout status fingerprint remains
`230025b6f6ed4821fc55c7d52ff4a0a165c98358a75caf8745daf02356b99b1c`;
unrelated decompiler edits are excluded from the experimental source commits.


### Guarded counted loops over primitive arrays

Source `a5e5f50bb45a820935591a828d90b82ed321f743` extends the experimental
compiler with a bounded, application-independent proof for signed increasing
counted loops. It supports captured primitive arrays, float/double/long and
narrow stores, affine indices (including reversed and strided accesses), and
already-cached nonvolatile static arrays. There is no application opt-in.
Calls, callbacks, allocations, internal cycles, unproved counter updates and
additional loop exits retain the ordinary path. This first version deliberately
does not treat a Math import as a callback-free operation.

The guard proves mathematical index endpoints, physical memory coverage,
metadata generations, remaining trip count and sufficient fuel. If metadata is
missing, an ordinary iteration runs and its original backedge retries the guard;
there are no speculative getters or replayed guest effects. A successful version
charges exactly the original header-poll count. The structurer sometimes places
an entire continuation on a loop's exit arm: the implementation extracts that
continuation once, avoiding duplicate following loops, calls or writes.
Temporary plans are released. Candidate discovery and extra emitted bytes have
fixed bounds; loops with more removable memory guards are considered first.

The initial `70af609` version selects six decoder loops and matches every byte of
the largest HotSpot Vorbis sample. Its 243.299 ms sample timing is not evidence
of a gain. The final version changes prioritization, literal handling and code
accounting, so that observation is not relabeled as the final revision.

Final focused validation (from `java-tools`):

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/guardedPrimitiveArrayLoops.test.js test/guardedNestedArrayLoops.test.js test/wasmCompilerRetention.test.js test/arrayIdentityCaches.test.js test/frameLocalSpills.test.js
```

**414/414 assertions pass.** The new suite contributes 82, including actual fast
branch execution, exact continuation state at fuel boundaries, partial writes,
nulls, short arrays, signed extremes, affine ranges, aliases, observable host
metadata, NaN/infinity/negative-zero bits, 64-bit overflow, narrow stores,
sequential continuation effects, volatile/callback/early-exit refusal, code
budget refusal and GC of installed proof graphs. Three older ownership getter
expectations also failed with the new optimization disabled: allocator-owned
metadata already bypasses shadow base/length properties. Those expectations are
corrected to the existing behavior; separate untracked-host tests still verify
real getter calls and their exact order against the scalar control.

Six fresh full-loading comparisons use B/C/C/B/B/C order, control `72c10fde`
(tree-identical to `6f716373`), candidate `a5e5f50`, CPU 2 and 1 GiB old-space.
Each observation includes a fresh unchanged TeaVM process. No workload is
replayed and all Java preparation stays outside the guest timer. Commands:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node apps/loading/compare.mjs --browser node --pairs 1 --revision REVISION --options diagnostic
```

Use the recorded control/candidate revisions in the stated order. The unchanged
comparison/statistics scripts come from Deko `f3f44bd`; the probe additionally
records loop count/byte metadata, with measured source SHA-256
`aec533e1de2aee3ebd7d8a26f7943cf7430cf9ea4c03b7bd0372382e7b46a13a`.

| Median | Control | Candidate |
| --- | ---: | ---: |
| Music | 2,020.683 ms | 1,966.110 ms |
| Graphics archives | 797.594 ms | 786.003 ms |
| Combined | 2,818.277 ms | 2,757.493 ms |
| Median paired JVM/TeaVM ratio | 6.050x | 5.926x |

Music improves in all three adjacent comparisons; combined time improves in two
and regresses in one. Median music is 2.70% lower and combined time 2.16% lower.
Both graphics stalls (candidate 1,084.001 ms, control 1,109.411 ms) are retained.
Every checksum and zero guest-compilation gate passes; every 1.10 gate fails.
These are small execution-time gains, not proof of startup, heap, FPS or phone
acceptance. The selected `cbcf8ad` artifact remains unchanged. Data lives only in
`optimizationTrials.guardedPrimitiveLoopsFullNode` in the canonical receipt.

A separate diagnostic confirms actual guard execution, not just installed code:
six `decodePacket` branches run **5,118 times each**, and the residue branch runs
5,119 times. It matches the full checksum with zero guest compiler attempts.
Its times are excluded. Commands:

```bash
JVM_WASM_IMPORT_STATS=1 NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 apps/loading/probe.mjs slab all a5e5f50bb45a820935591a828d90b82ed321f743 loading
node apps/loading/build-runtime.mjs --revision a5e5f50bb45a820935591a828d90b82ed321f743 --output /tmp/geoblox-native-parity-7zCq8O/runtime
```

The isolated rebuild succeeds, with debug/worker SHA-256 respectively:
`f5f3aae1d87ff8cd519dbc8138e3086a3b54b5c5f90b0c96e84b14cbe21b6562`
and `cb5bad33436f377279cf6389124714745258c899fe7676435d434e8a3a6b28fb`.
These outputs are temporary and rebuildable, not committed binaries. Firefox
performance has not yet been measured for this source.

### Two additional hypotheses ruled out in Node

The frame-liveness instruction limit does not block the two large decoders.
Direct class inspection finds `decodePacket`: 1,401 items, liveness proved,
22,416 bytes; `decodeBlocks`: 1,186 items, liveness proved, 9,488 bytes.
Analysis takes about 9 and 3 ms respectively. No analysis limit is raised.

A one-pass diagnostic also replaces 15 direct double `sin` imports with a tiny
Wasm-to-Wasm forwarding function, leaving the original host Math.sin and all
arguments/results unchanged. It tests whether a small separately compiled
callee changes the import cost in a large caller. On unchanged control source
`72c10fde`, music is **1,997.454 ms**, graphics **801.987 ms**, combined
**2,799.441 ms**. The checksum and zero guest compilation gates pass. This does
not establish a useful gain. The hook is diagnostic only and is not integrated
into the runtime. The single receipt records its exact hash and bytecode under
`optimizationTrials.mathImportWasmBridge`.

For reproducibility, the exact temporary diagnostic hook was:

```javascript
const fs=require('node:fs'),crypto=require('node:crypto');
const Original=WebAssembly.Instance,cache=new WeakMap();
const bytes=Uint8Array.from([0,97,115,109,1,0,0,0,1,6,1,96,1,124,1,124,2,10,1,3,101,110,118,2,102,110,0,0,3,2,1,0,7,7,1,3,114,117,110,0,1,10,8,1,6,0,32,0,16,0,11]);
const bridgeModule=new WebAssembly.Module(bytes);let sites=0;
WebAssembly.Instance=new Proxy(Original,{construct(target,args,newTarget){
 const env=args[1]?.env;
 if(env?.math_sin__D_D===Math.sin){
  let fn=cache.get(Math.sin);if(!fn){fn=new Original(bridgeModule,{env:{fn:Math.sin}}).exports.run;cache.set(Math.sin,fn);}
  env.math_sin__D_D=fn;sites++;
 }
 return Reflect.construct(target,args,newTarget);
}});
process.argv=['node','probe.mjs','slab','all','72c10fdea7db6cb5c98239d4514350baeace8d8e','loading'];
(async()=>{try{await import('/home/kreijstal/git/blank-github-cloner/dekobloko-work/apps/loading/probe.mjs');}
finally{
 WebAssembly.Instance=Original;
 const file='/home/kreijstal/.cache/dekobloko/geoblox-loading/benchmark.json';
 const data=JSON.parse(fs.readFileSync(file)),d=data.kernelDiagnostic;
 d.instrumented=true;
 data.optimizationTrials.mathImportWasmBridge={diagnosticOnly:true,bridgeSites:sites,
  hookSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
  wasmSha256:crypto.createHash('sha256').update(bytes).digest('hex'),
  ...Object.fromEntries(['runtimeRevision','harnessSha256','equal','musicMs','graphicsMs','loadingMs','compilation','lateCompiles'].map(k=>[k,d[k]]))};
 fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');console.log('MATH_BRIDGE',sites);
}})().catch(e=>{console.error(e);process.exitCode=1;});
```

Save it as `/tmp/geoblox-native-parity-7zCq8O/inspect.cjs`, then execute with
`NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 /tmp/geoblox-native-parity-7zCq8O/inspect.cjs`.
The hook marks its result as instrumented/diagnostic so it cannot become a
performance-acceptance observation. It does not alter the pinned TeaVM artifact.


#### Bounded scalar fallback and final decision

Review found that an unqualified array would repeat the expensive affine guard
on every iteration. Source `1d0368e8ec168393fcd2c25475b1739ce9dc22a5` limits the
proof to two attempts per dynamic loop invocation and short-circuits cheap
trip/fuel/readiness failures. Thereafter the scalar loop has only a cheap
bypass. Tests verify the exact guard-attempt count on real plain-array execution.
`6287c3a1cc6429951ec56dc3751d9708a65d76e1` adds tests of older captured field
references after a newer field generation, with native object storage enabled;
its runtime source is byte-identical to `1d0368e`.

The final five-file compiler command above passes **423/423 assertions** before
the prototype is removed. A fresh six-command B/C/C/B/B/C comparison rechecks
`1d0368e`; earlier `a5e5f50` timings are not substituted for this source:

| Median | Control `72c10fde` | Bounded candidate `1d0368e` |
| --- | ---: | ---: |
| Music | 2,041.319 ms | 1,989.959 ms |
| Graphics archives | 809.408 ms | 838.437 ms |
| Combined | 2,838.642 ms | 2,923.600 ms |
| Median paired JVM/TeaVM ratio | 6.045x | 6.237x |
| Preparation/entry outside execution | 49,142.924 ms | 50,324.909 ms |
| Synchronous Java preparation compilation | 44,531.961 ms | 45,831.708 ms |

Music remains faster in all three adjacent raw comparisons. Combined improves in
two and regresses in one, but its median is now 3.0% higher. The third control
and its TeaVM observation are both slower than earlier observations (3,170.441
and 549.674 ms); they are retained without attributing a particular cause or
normalizing them away. The first candidate graphics stall (1,096.152 ms) is
retained too. Neither raw combined medians nor paired ratios establish an
overall gain. Every checksum and zero guest-compilation gate passes, and every
1.10 gate fails. Preparation times are now retained separately, not hidden by
excluding them from the execution target. Data is in the existing trial's
`boundedRetryFollowup` member in the single receipt.

**The prototype is removed from the active source** in
`8e7283a85494cf1dbd12565d00e8ee92a1643a52`. Its runtime tree is identical to
`72c10fde`; the only retained diff is the three corrected ownership expectations
in the old regression test. The full implementation and 423-assertion test set
remain reproducible from the parent commits. The selected runtime and default
artifacts are unchanged. No Firefox timing, phone, heap or FPS acceptance is
claimed. This rejects the optimization as sufficient progress on full loading;
the earlier 2.16% preliminary median is not promoted as the final outcome.

The final largest-sample check on `a5e5f50` also matches every HotSpot PCM byte
with zero guest compilation (244.507 ms decode, diagnostic only). It remains
labeled `a5e5f50`, not the later bounded source. Reproduce it with:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 apps/loading/probe.mjs slab 3-0.bin a5e5f50bb45a820935591a828d90b82ed321f743 vorbis
```

After removing the prototype, validate the retained ownership expectations and
compiler cleanup with:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/guardedNestedArrayLoops.test.js test/wasmCompilerRetention.test.js
```


The retained two-file command passes **247/247 assertions**. The statistics suite
passes **3/3**; probe syntax and `git diff --check` pass. The cached selected
bundle hashes and parent checkout fingerprint remain unchanged. Final status:
**full loading parity is still unproven and contradicted by every measured
1.10 gate**. No runtime publication or deployment is performed.

#### Node-first post-optimization and numeric-local experiments

Node is the iteration runner; Firefox remains a later confirmation gate.
These measurements use the same pinned full-loading classes/assets, CPU 2,
1 GiB old-space limit, fresh processes, and zero attempted/completed Java
compiles during execution. They exclude preparation from the execution target,
but record its time separately. None establishes memory, FPS, menu or phone
acceptance. The selected runtime remains `cbcf8ad`.

`apps/loading/wasm-optimizer.mjs` is a Node-only diagnostic, installed by
`JVM_WASM_OPT_DIAGNOSTIC=1` in `probe.mjs`. It transforms valid generated modules
of at least 16 KiB during preparation and restores the original constructor
before guest timing. It records tool/options, module hashes, byte counts,
optimization time and errors in the existing `benchmark.json`. It marks runs
instrumented, so `compare.mjs` rejects them for acceptance. Neither the normal
launcher nor the pinned TeaVM module uses this hook. Reproduce an observation:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules JVM_WASM_OPT_DIAGNOSTIC=1 taskset -c 2 node --max-old-space-size=1024 apps/loading/probe.mjs slab all 8e7283a85494cf1dbd12565d00e8ee92a1643a52 loading
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 apps/loading/probe.mjs teavm all - loading
node --test tests/loading-wasm-optimizer.test.mjs tests/loading-statistics.test.mjs
```

The tool is Binaryen `wasm-opt version 132 (version_132-49-gd03c25ea43)`, binary
SHA-256 `61e16362e5e9f6b90615c9fc780d369657a0a18a953886a7917eda0e71565516`.
Its exact restricted feature arguments are in the diagnostic source and each
receipt. An initial `--all-features` attempt emitted compact imports unsupported
by Node 22. It failed validation and is retained under
`optimizationTrials.binaryenPostOptimization.unsupportedFeatureAttempt`;
its timings are not evidence of performance. The restricted-feature test
preserves JS-tag throw identity and GC type identity across transformed and
untransformed modules. The command above passes **8/8 tests**.

Six B/C/C/B/B/C runs, each followed by an unchanged fresh TeaVM process, give:

| Median | Control `8e7283` | Binaryen diagnostic |
| --- | ---: | ---: |
| Music | 2,020.401 ms | 1,832.279 ms |
| Graphics | 797.164 ms | 657.714 ms |
| Combined execution | 2,817.418 ms | 2,494.243 ms |
| Paired JVM/TeaVM ratio | 6.079x | 5.351x |
| Preparation/entry | 49,131.283 ms | 77,450.597 ms |

All three adjacent raw comparisons improve and all checksums/zero guest-compile
checks pass. The 11.5% execution gain demonstrates avoidable generated-code
overhead, but leaves the 1.10 target far away. A representative run optimizes
120 modules, reducing 3,701,333 bytes to 2,457,170 bytes, at 30,283.175 ms extra
optimization work. This tool is not enabled in the runtime or deployed.

The generic compiler prototype `af23c1d143eef0fa1fd73ff4016e0baa1a755a2c`
stackifies single-use total numeric expressions within a block, protecting all
frame/operand snapshots, with a 512-value and depth-16 bound. It passes
262 focused and 614 ABI assertions. Six fresh B/C/C/B/B/C comparisons against
`8e7283` give combined medians **2,830.378 -> 2,792.630 ms**, just 1.3% lower;
paired ratios are **6.184x -> 6.132x**. Preparation/entry increases from
48,501.251 to 49,527.197 ms. All checks pass and every parity gate fails.
These results remain separately labeled under `numericStackificationFullNode`.
They are not the results of the later local-coalescing prototype.

`20c487c8050c0f7ae094b7d547da4e5d0dc63ac7` additionally limits expression
movement to gaps without effects and reuses numeric local slots only after
their complete last consumer. A value referenced by any frame/operand snapshot
or another block cannot share its slot. Reuse waits until the following
instruction so cold call-retry paths retain their original arguments.
The current focused command passes **269/269**, and the ABI command
**621/621**:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/wasmNumericStackification.test.js test/frameLocalSpills.test.js test/wasmCompilerRetention.test.js test/wasmLiteralContinuations.test.js test/arrayIdentityCaches.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/wasmNumericStackification.test.js test/canonicalDirectFrames.test.js test/compactCanonicalFrames.test.js test/hostOwnedCanonicalFuel.test.js test/wasmParameterArrayAbi.test.js test/preparedWasmConstructors.test.js
```

The first two commands run from `java-tools`; loading commands run from
`dekobloko-work`. Compare the local-coalescing source with:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node apps/loading/compare.mjs --browser node --pairs 1 --revision 20c487c8050c0f7ae094b7d547da4e5d0dc63ac7 --options diagnostic
```

Repeat six times in B/C/C/B/B/C source order, substituting `8e7283` for B.
Exit 1 after completed output/checks is the expected failing parity gate, not
a successful acceptance result. The single receipt retains all observations
under `numericLocalReuseFullNode`. No default artifact is promoted here.

The six-run local-coalescing comparison completes with matching checksums and
zero guest compiles. Combined medians are **2,827.119 -> 2,811.475 ms** (0.6%
lower), and paired ratios **6.233x -> 6.205x**. Only two of three adjacent
raw comparisons improve. The first candidate graphics observation stalls at
1,103.715 ms; it remains in the receipt. Preparation/entry medians are
49,055.914 and 49,545.054 ms. This does not establish a consistent useful gain;
the candidate remains experimental and fails the target.

Source `d39e5e301f4c66e850dd3dfcbb3ef324b681fe9e` adds a more direct
redundant-check elimination: after an ordinary array access completes, a later
access to the same SSA reference in the same basic block can omit its metadata
filled-flag test. The runtime bounds and representation checks remain. Proofs
reset at each block, are invalidated by emitted reference-cache kills, and do
not follow conditional call-argument fills or shared field-reader generations.
The focused/ABI commands above now pass **272/272** and **624/624**, including
host getters, original throwable identity, null and all intermediate bounds
failures. An initial test fixture lacked its required existing checkcast
capability; it failed at compilation, was corrected, and both commands were
rerun before measuring.

A single preliminary fresh-process Node screening pair gives music
1,981.174 ms, graphics 793.423 ms, combined **2,774.598 ms**, versus the pinned
TeaVM's **451.899 ms**: **6.140x**, so the parity gate fails. Checksums and
zero guest compilation pass. This is not a repeated matched improvement result;
the preceding control median is 2,827.119 ms under an earlier probe hash. The
trial is retained under `dominatedArrayFillFullNode`; no Firefox promotion or
default change follows this screening observation. Substitute the full source
revision above into the Node comparison command to reproduce it.

The probe now includes the already-existing compiled-method entry counters in
its post-timer report, matching the browser report's scope. No CPU sampling or
new guest-time counters were added. They show 3,605,524 canonical entries into
the Bzip bit reader, 3,148,442 into the music bit reader, 2,328,178 into the Bzip
single-bit wrapper, and 1,006,390 into the codebook scalar reader. All four have
fully compiled normal flow and zero recorded exits. Thus late Java compilation
or an interpreted bit-reader loop does not explain their costs. Entry counts
alone do not measure time or prove which part of the call protocol dominates.
The small expression/local/flag-check changes have not captured most of the
independent optimizer gain. The next larger experiment should isolate native
call-boundary overhead and consider compiler-proved direct leaf entries or
joint native compilation while preserving fuel, exception, class-readiness and
replacement semantics. Existing broad deep-inlining experiments are not new
evidence and should not simply be rerun.

#### Cold static inlining: measured regression, withdrawn

The preceding goal turn is progress: it added checked measurements and runnable
diagnostics, rather than treating a passing checksum as the 1.10 performance
goal. The selected runtime still has not changed.

Source `3f6c9b3f8dfbd027e3d065ab17f65fd4dff63725` tested a specific cause of
remaining calls. During preparation, a class with an initializer is cold;
`planStaticInline` previously admitted only pure integer operations in that
state. The prototype admitted bounded, loop-free static bodies, including heap
writes and division, with a readiness guard after argument evaluation. A miss
reconstructed the original call's argument slots and resume PC, preserving
preceding caller effects. It kept entry dependencies, handled wide operands,
and did not flatten loops or raise inline budgets. A separate generic check
refused static callees with meaningful exception handlers: their handler table
cannot be dropped during splicing.

The prototype's three-file focused command passed **182 assertions**. Its
nine-file inline/ABI batch passed **824 assertions**:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/wasmGuardedStaticInline.test.js test/wasmColdIntegerInline.test.js test/wasmInlineInitialization.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/wasmGuardedStaticInline.test.js test/wasmInlineBudget.test.js test/wasmInstanceInline.test.js test/wasmDeepInline.test.js test/canonicalDirectFrames.test.js test/compactCanonicalFrames.test.js test/hostOwnedCanonicalFuel.test.js test/wasmParameterArrayAbi.test.js test/preparedWasmConstructors.test.js
```

These commands require the historical prototype test source. Cold, untaken,
mid-argument reset, inherited initialization, wide argument restoration and
guest exceptions were exercised. The test originally tried preparing two
methods after its no-compilation marker; the assertion rejected that attempt,
so preparation was moved before the marker and the batch was rerun.

Four fresh Node comparisons ran in C/B/C/B order, each against fresh pinned
TeaVM, with CPU 2, 1 GiB old-space and no overlapping tests/builds:

| Source | Music ms | Graphics ms | Combined ms | TeaVM ms |
| --- | ---: | ---: | ---: | ---: |
| Candidate `3f6c9b3` | 2,038.271 | 799.714 | 2,837.985 | 455.636 |
| Control `d39e5e3` | 1,941.873 | 785.886 | 2,727.759 | 455.962 |
| Candidate `3f6c9b3` | 2,150.513 | 794.507 | 2,945.020 | 456.655 |
| Control `d39e5e3` | 1,923.246 | 790.354 | 2,713.600 | 456.091 |

Every checksum and zero guest-compiler gate passes; every parity gate fails.
The candidate's combined median is **2,891.502 vs 2,720.680 ms**, 6.3% higher.
It removes all **3,148,442** separate music single-bit-reader entries, yet both
observations are slower than both controls. Call count alone is therefore not
a useful optimization objective. The trial is retained under
`optimizationTrials.guardedStaticInliningFullNode` in the one receipt.

`176c3c4b0c43d62c34a93039939f64e178f0093b` withdraws the broader admission,
per-site guards and default-policy change. It retains only the static-callee
handler check and its regression test. The test exercises cold/warm classes,
native/plain arrays, exact callee catch results, propagation to a caller catch,
once-only writes and zero execution-time compilation. Its helper initially
assumed `runNested` always pushed a return value onto the carrier frame; it now
uses that API's immediate returned value when present. Retained validation:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/wasmStaticInlineHandlers.test.js test/wasmColdIntegerInline.test.js test/wasmInlineInitialization.test.js
NODE_PATH=/home/kreijstal/git/java-tools/node_modules node --expose-gc /home/kreijstal/git/java-tools/node_modules/tape/bin/tape test/wasmStaticInlineHandlers.test.js test/wasmInstanceInline.test.js test/wasmDeepInline.test.js test/canonicalDirectFrames.test.js test/compactCanonicalFrames.test.js test/hostOwnedCanonicalFuel.test.js test/wasmCompilerRetention.test.js
```

Both pass, **144/144** and **644/644**. A fresh full-loading comparison on this
retained source also matches the reference and attempts no guest compilation:
music **1,974.569 ms**, graphics **787.686 ms**, combined **2,762.255 ms** versus
TeaVM **456.041 ms**, approximately **6.057x**. This is a correctness check and
a diagnostic control, not a repeated speedup result or runtime promotion.

#### Unchecked memory-cost diagnostics

`apps/loading/unchecked-memory-probe.cjs` is an explicitly unsafe Node-only
causal diagnostic, not imported by a launcher. It temporarily changes compiler
emission in the exact archived source, restores the loader hook afterwards,
marks the resulting observation instrumented, and appends only to the existing
`benchmark.json`. It records source/harness/hook hashes, assumptions, compile-site
counts, output checks and errors. Site counts are compile-time observations,
including dry runs; they are not executed-operation counts. Reproduce from Deko:

```bash
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node apps/loading/compare.mjs --browser node --pairs 1 --revision 176c3c4b0c43d62c34a93039939f64e178f0093b --options diagnostic
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 apps/loading/unchecked-memory-probe.cjs 176c3c4b0c43d62c34a93039939f64e178f0093b /home/kreijstal/.cache/dekobloko/geoblox-loading bounds
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 apps/loading/unchecked-memory-probe.cjs 176c3c4b0c43d62c34a93039939f64e178f0093b /home/kreijstal/.cache/dekobloko/geoblox-loading statics
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 apps/loading/unchecked-memory-probe.cjs 176c3c4b0c43d62c34a93039939f64e178f0093b /home/kreijstal/.cache/dekobloko/geoblox-loading casts
NODE_PATH=/home/kreijstal/git/java-tools/node_modules taskset -c 2 node --max-old-space-size=1024 apps/loading/probe.mjs teavm all - loading
```

Each component was executed once in its own process, followed by fresh pinned
TeaVM. No result is a safe implementation, acceptance run or statistically
verified improvement. Current figures:

| Diagnostic | Music ms | Graphics ms | Combined ms | JVM/TeaVM |
| --- | ---: | ---: | ---: | ---: |
| Checked control | 1,974.569 | 787.686 | 2,762.255 | 6.057x |
| Skip native numeric-array bounds; retain representation fallbacks | 1,848.037 | 736.148 | 2,584.185 | 5.738x |
| Skip numeric static-cell capability checks | 1,968.420 | 814.876 | 2,783.296 | 6.151x |
| Assume primitive-array checkcasts succeed | 1,956.083 | 700.298 | 2,656.380 | 5.850x |

The three narrower diagnostics match the recorded outputs and attempt no Java
compilation during execution. Their skipped bounds/type/capability semantics
make them ineligible regardless. The initial combined unchecked experiment on
`d39e5e3` trapped in `MusicDecoder.decodePcmBudgeted`; it is retained as a failure,
not timed evidence. That trap alone does not identify which removed check or
experimental rewrite caused it. The final script preserves separate components
and their exact hook hashes; earlier bounds/statics observations used the
version before the cast-only component was added.

Post-timer heap accounting is now included in the normal probe. The checked
control allocates **47,474,290 bytes** of its **268,435,456-byte** linear heap,
with no growth, reclamation or exhaustion warning. Linear-heap exhaustion is
not an explanation of this run. This accounting is not a JavaScript heap peak
or browser memory-acceptance measurement.

Removing all these checks individually is insufficient to approach 1.10x.
Before implementing more complicated cast memoization, use the cast-only
screening result: even discarding its semantics saves only 3.8% of the control's
full-loading time in this single observation. One concrete remaining native
coverage gap is boolean arrays: `nativeArrayBase` and published array headers
explicitly exclude `[Z`, while the existing `castIdentityOwnedFullNode` import
census records 388,968 boolean loads and 388,968 stores in floor sorting, plus
193,216 boolean stores in floor reconstruction. This is older census evidence,
not a newly sampled profile. A next implementation can test a native boolean
array representation with explicit truthy loads and low-bit stores, keeping
byte-array semantics, host getters, foreign arrays, null/bounds errors and
metadata lifetime intact. No unchecked diagnostic is deployed.
